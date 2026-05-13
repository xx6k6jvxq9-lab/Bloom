import type {
  Character,
  CharacterFriendshipStatus,
  ChatMessage,
  FriendRequest,
  FriendRequestDirection,
} from '../../types';
import { splitDirectAssistantReplyText, stripAssistantSpeakerPrefix } from '../../services/chat/assistantText';
import { getLegacyTranslationParts, sanitizePipeMarkers } from '../../services/chat/messageText';
import { isFriendRequestReleased } from './friendRequestThreads';

const POSITIVE_HINTS = ['谢谢', '喜欢', '想你', '重新', '和好', '在乎', '认真', '愿意', '可以吗', '回来', '继续', '别生气', '抱抱'];
const NEGATIVE_HINTS = ['讨厌', '别烦', '滚', '算了', '不想', '烦', '闭嘴', '离我远点', '拉黑', '屏蔽', '删掉', '别来'];
const APOLOGY_HINTS = ['对不起', '抱歉', '别生气', '重新认识', '重新加', '和好', '给我一次机会', '想继续'];
const WARM_PERSONA_HINTS = ['温柔', '照顾', '心软', '在乎', '护着', '想念', '喜欢', '关心', '体贴', '舍不得', '嘴硬心软'];
const GUARDED_PERSONA_HINTS = ['克制', '冷', '疏离', '理智', '边界', '戒备', '别靠近', '强势', '冷淡', '不近人情'];
const EXCITABLE_PERSONA_HINTS = ['冲动', '暴躁', '炸毛', '易怒', '情绪化', '嘴硬', '占有欲', '直球', '别扭', '话痨', '激动', '疯'];
const STUBBORN_PERSONA_HINTS = ['嘴硬', '不服输', '认死理', '执拗', '倔', '倔强', '不甘心', '死心眼', '较劲', '硬撑'];
const PRIDE_PERSONA_HINTS = ['自尊', '体面', '骄傲', '要面子', '不肯低头', '不服软', '高傲', '嘴硬'];
const ATTACHMENT_PERSONA_HINTS = ['舍不得', '离不开', '想念', '黏人', '依赖', '护着', '放不下', '惦记', '在乎'];
const POSSESSIVE_PERSONA_HINTS = ['占有欲', '控制欲', '不许走', '不肯放手', '盯得紧', '吃醋', '护短', '认领'];
const DIRECT_PERSONA_HINTS = ['直球', '不拐弯', '会追', '会抢', '主动', '步步紧逼', '不绕弯'];

export type CharacterBlockState = 'none' | 'user' | 'character' | 'mutual';
export type CharacterFriendRequestDecision =
  | {
      outcome: 'accept';
      resolutionMessage: string;
    }
  | {
      outcome: 'reject';
      resolutionMessage: string;
      counterBlock: boolean;
    }
  | {
      outcome: 'counter_request';
      resolutionMessage: string;
      requestMessage: string;
    };

function countHints(text: string, hints: string[]) {
  return hints.reduce((count, hint) => (text.includes(hint) ? count + 1 : count), 0);
}

function resolvePersonaStyle(character: Pick<Character, 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark'>) {
  const personaText = [
    character.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
  const warmScore = countHints(personaText, WARM_PERSONA_HINTS);
  const guardedScore = countHints(personaText, GUARDED_PERSONA_HINTS);

  if (guardedScore > warmScore && guardedScore > 0) {
    return 'guarded' as const;
  }
  if (warmScore > guardedScore && warmScore > 0) {
    return 'warm' as const;
  }
  return 'neutral' as const;
}

function summarizeRecentRelationshipTone(history: ChatMessage[]) {
  const recentText = history
    .filter((message) => !message.isSystem && !message.isRecalled)
    .slice(-8)
    .map((message) => message.text || '')
    .join(' ');

  return {
    positive: countHints(recentText, POSITIVE_HINTS),
    negative: countHints(recentText, NEGATIVE_HINTS),
  };
}

function evaluateRelationshipMomentum(
  character: Pick<Character, 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark' | 'blockedByCharacter'>,
  history: ChatMessage[],
  note: string,
) {
  const style = resolvePersonaStyle(character);
  const tone = summarizeRecentRelationshipTone(history);
  const notePositive = countHints(note, POSITIVE_HINTS);
  const noteNegative = countHints(note, NEGATIVE_HINTS);
  const apologyScore = countHints(note, APOLOGY_HINTS);
  const score =
    tone.positive
    - tone.negative
    + notePositive * 2
    - noteNegative * 2
    + apologyScore
    + (style === 'warm' ? 1 : style === 'guarded' ? -1 : 0)
    - (character.blockedByCharacter ? 1 : 0);

  return {
    score,
    style,
    tone,
    apologyScore,
  };
}

export function getCharacterFriendshipStatus(
  character: Pick<Character, 'friendshipStatus'>,
): CharacterFriendshipStatus {
  return character.friendshipStatus === 'none' ? 'none' : 'friends';
}

export function getCharacterBlockState(
  character: Pick<Character, 'blockedByUser' | 'blockedByCharacter'>,
): CharacterBlockState {
  if (character.blockedByUser && character.blockedByCharacter) {
    return 'mutual';
  }
  if (character.blockedByUser) {
    return 'user';
  }
  if (character.blockedByCharacter) {
    return 'character';
  }
  return 'none';
}

export function canChatWithCharacter(
  character: Pick<Character, 'friendshipStatus' | 'blockedByUser' | 'blockedByCharacter'>,
) {
  return getCharacterFriendshipStatus(character) === 'friends' && getCharacterBlockState(character) === 'none';
}

export function getFriendRequestCharacterId(request: FriendRequest) {
  return request.characterId
    || (request.sourceScene !== 'forum' && request.fromUserId ? request.fromUserId : undefined);
}

function countRegexMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length || 0;
}

export function resolveFriendRequestDirection(request: FriendRequest): FriendRequestDirection {
  if (request.direction === 'incoming' || request.direction === 'outgoing') {
    return request.direction;
  }
  return request.initiator === 'user' ? 'outgoing' : 'incoming';
}

export function isIncomingFriendRequest(request: FriendRequest) {
  return resolveFriendRequestDirection(request) === 'incoming';
}

export function isOutgoingFriendRequest(request: FriendRequest) {
  return resolveFriendRequestDirection(request) === 'outgoing';
}

export function getPendingCharacterRequest(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
  direction?: FriendRequestDirection,
) {
  const requestList = Array.isArray(requests) ? requests : [];
  return [...requestList]
    .filter((request) => request.status === 'pending')
    .filter((request) => isFriendRequestReleased(request))
    .filter((request) => getFriendRequestCharacterId(request) === characterId)
    .filter((request) => !direction || resolveFriendRequestDirection(request) === direction)
    .sort((left, right) => right.timestamp - left.timestamp)[0] || null;
}

export function getLatestCharacterRequest(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
) {
  const requestList = Array.isArray(requests) ? requests : [];
  return [...requestList]
    .filter((request) => isFriendRequestReleased(request))
    .filter((request) => getFriendRequestCharacterId(request) === characterId)
    .sort((left, right) => right.timestamp - left.timestamp)[0] || null;
}

export function supersedePendingCharacterRequests(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
  nextTimestamp = Date.now(),
  supersededById?: string,
) {
  const requestList = Array.isArray(requests) ? requests : [];
  return requestList.map((request) => {
    if (request.status !== 'pending' || getFriendRequestCharacterId(request) !== characterId) {
      return request;
    }
    return {
      ...request,
      status: 'superseded' as const,
      resolutionMessage: request.resolutionMessage || '已被新的申请替代',
      lastUpdatedAt: nextTimestamp,
      ...(supersededById ? { supersededById } : {}),
    };
  });
}

export function createRelationshipSystemMessage(
  text: string,
  timestamp = Date.now(),
  options?: {
    tone?: 'default' | 'danger';
  },
): ChatMessage {
  return {
    role: 'model',
    text,
    timestamp,
    isSystem: true,
    systemTone: options?.tone || 'default',
  };
}

function buildRelationshipPursuitProfile(
  character: Pick<Character, 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark'>,
  history: ChatMessage[],
) {
  const personaText = [
    character.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
  const style = resolvePersonaStyle(character);
  const tone = summarizeRecentRelationshipTone(history);
  const attachment = countHints(personaText, ATTACHMENT_PERSONA_HINTS);
  const stubbornness = countHints(personaText, STUBBORN_PERSONA_HINTS);
  const possessiveness = countHints(personaText, POSSESSIVE_PERSONA_HINTS);
  const pride = countHints(personaText, PRIDE_PERSONA_HINTS);
  const volatility = countHints(personaText, EXCITABLE_PERSONA_HINTS);
  const directness = countHints(personaText, DIRECT_PERSONA_HINTS);
  const warmth = countHints(personaText, WARM_PERSONA_HINTS);
  const guardedness = countHints(personaText, GUARDED_PERSONA_HINTS);
  const closenessBias = tone.positive - tone.negative;
  const chaseDrive =
    attachment * 2
    + stubbornness * 2
    + possessiveness * 2
    + volatility
    + directness
    + (warmth > guardedness ? 1 : 0)
    + Math.max(0, closenessBias);
  const selfProtect =
    pride * 2
    + guardedness * 2
    + Math.max(0, tone.negative - tone.positive);

  return {
    style,
    tone,
    attachment,
    stubbornness,
    possessiveness,
    pride,
    volatility,
    directness,
    warmth,
    guardedness,
    chaseDrive,
    selfProtect,
  };
}

function hashSeedToUnitInterval(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }

  return (hash % 1000) / 999;
}

export function createCharacterRelationshipMessages(
  characterId: string,
  text: string,
  timestamp = Date.now(),
  options?: {
    assistantAliases?: string[];
    maxBubbles?: number;
  },
): ChatMessage[] {
  const { mainText, translation } = getLegacyTranslationParts(text);
  const normalizedMainText = stripAssistantSpeakerPrefix(
    sanitizePipeMarkers(mainText || text, '\n'),
    options?.assistantAliases || [],
  );
  const mainParts = splitDirectAssistantReplyText(normalizedMainText, options?.maxBubbles ?? 3);
  const normalizedTranslation = sanitizePipeMarkers(translation, '\n');
  const translationParts = normalizedTranslation
    ? splitDirectAssistantReplyText(normalizedTranslation, options?.maxBubbles ?? 3)
    : [];
  const pairTranslationByIndex = translationParts.length === mainParts.length;

  return mainParts.map((part, index) => ({
    role: 'model' as const,
    text: part,
    timestamp: timestamp + index,
    senderCharacterId: characterId,
    ...(
      pairTranslationByIndex
        ? (translationParts[index] ? { translation: translationParts[index] } : {})
        : index === 0 && normalizedTranslation
          ? { translation: normalizedTranslation }
          : {}
    ),
  }));
}

export function getRelationshipReactionBubbleCap(
  character: Pick<Character, 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark'>,
  text: string,
  options?: {
    intensity?: 'normal' | 'high';
  },
) {
  const style = resolvePersonaStyle(character);
  const personaText = [
    character.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
  const excitableScore = countHints(personaText, EXCITABLE_PERSONA_HINTS);
  const punctuationBurst = countRegexMatches(text, /[!?！？]/g);
  const lineBreaks = countRegexMatches(text, /\n/g);
  const compactLength = text.replace(/\s/gu, '').length;

  let cap = 3;
  if (compactLength >= 36) cap = 4;
  if (compactLength >= 64) cap = 5;
  if (compactLength >= 96) cap = 6;
  if (compactLength >= 132) cap = 7;
  if (compactLength >= 170) cap = 8;

  if (options?.intensity === 'high') {
    cap += 1;
  }

  if (excitableScore > 0) {
    cap += Math.min(2, excitableScore);
  }

  if (punctuationBurst >= 3) {
    cap += 1;
  }

  if (lineBreaks >= 2) {
    cap += 1;
  }

  if (style === 'guarded') {
    cap -= 1;
  }

  return Math.max(3, Math.min(cap, 10));
}

export function decideCharacterFriendRequestResponse(
  character: Pick<Character, 'id' | 'name' | 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark' | 'blockedByCharacter'>,
  history: ChatMessage[],
  note: string,
): CharacterFriendRequestDecision {
  const { score, style, tone, apologyScore } = evaluateRelationshipMomentum(character, history, note);

  if (score >= 3 || (apologyScore > 0 && score >= 2)) {
    return {
      outcome: 'accept',
      resolutionMessage: '对方通过了你的申请',
    };
  }

  if (score <= -2 || (style === 'guarded' && tone.negative > tone.positive + 1)) {
    const counterBlock = style === 'guarded' || tone.negative >= 2;
    return {
      outcome: 'reject',
      counterBlock,
      resolutionMessage: counterBlock ? '对方拒绝了这次申请，并把你拉黑了' : '对方拒绝了这次申请',
    };
  }

  return {
    outcome: 'counter_request',
    requestMessage: style === 'warm'
      ? '我不是不想加回来，只是想确认这次你不会再随手把我推开。'
      : style === 'guarded'
        ? '你要是真想加回来，就把这条申请认真收下。'
        : '这次换我把申请递给你，你来决定。',
    resolutionMessage: '对方没有直接通过，而是回了一条新的好友申请',
  };
}

export function decideCharacterUnblockGesture(
  character: Pick<Character, 'id' | 'name' | 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark' | 'blockedByCharacter'>,
  history: ChatMessage[],
) {
  const { score, style } = evaluateRelationshipMomentum(character, history, '');

  if (style === 'warm' && score >= 0) {
    return {
      sendRequest: true,
      requestMessage: '如果你这次是认真的，就把我这条申请收下吧。',
    };
  }

  if (character.blockedByCharacter) {
    return {
      sendRequest: false,
    };
  }

  return {
    sendRequest: false,
  };
}

export function getCharacterRelationshipStatusText(
  character: Pick<Character, 'id' | 'friendshipStatus' | 'blockedByUser' | 'blockedByCharacter'>,
  requests: FriendRequest[],
) {
  const blockState = getCharacterBlockState(character);
  const latestRequest = getLatestCharacterRequest(requests, character.id);

  if (canChatWithCharacter(character)) {
    return '已互相通过';
  }
  if (blockState === 'mutual') {
    return '互相拉黑';
  }
  if (blockState === 'user') {
    return '你已拉黑对方';
  }
  if (blockState === 'character') {
    return '对方已拉黑你';
  }
  if (latestRequest?.status === 'pending') {
    return isIncomingFriendRequest(latestRequest) ? '对方正在等你处理' : '等待对方决定';
  }
  return '还不是好友';
}

export function getFriendRequestStatusLabel(request: FriendRequest) {
  if (request.status === 'pending') {
    return isIncomingFriendRequest(request) ? '待你处理' : '等待对方';
  }
  if (request.status === 'accepted') {
    return '已通过';
  }
  if (request.status === 'rejected') {
    return '已拒绝';
  }
  return '已替换';
}
export function resolveCharacterBlockedFollowupDelayMs(
  character: Pick<Character, 'id' | 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark'>,
  history: ChatMessage[],
  nextAttemptNo: number,
) {
  const profile = buildRelationshipPursuitProfile(character, history);
  const baseMinMs = profile.volatility >= 2 || profile.directness >= 2
    ? 8_000
    : profile.attachment >= 2 || profile.style === 'warm'
      ? 18_000
      : 12_000;
  const baseMaxMs = profile.pride >= 2 || profile.guardedness >= 2
    ? 60_000
    : profile.attachment >= 2 || profile.style === 'warm'
      ? 48_000
      : 36_000;
  const fatigueExtensionMs = nextAttemptNo <= 1 ? 0 : Math.min(12_000, (nextAttemptNo - 1) * 4_000);
  const minMs = Math.min(50_000, baseMinMs + Math.floor(fatigueExtensionMs * 0.35));
  const maxMs = Math.min(60_000, Math.max(minMs + 5_000, baseMaxMs + fatigueExtensionMs));
  const ratio = hashSeedToUnitInterval(`${character.id}|blocked-followup|${nextAttemptNo}`);

  return Math.min(
    60_000,
    minMs + Math.round((maxMs - minMs) * ratio),
  );
}
