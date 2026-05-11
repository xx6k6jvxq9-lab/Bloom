import type {
  Character,
  CharacterFriendshipStatus,
  ChatMessage,
  FriendRequest,
  FriendRequestDirection,
} from '../../types';
import { splitDirectAssistantReplyText, stripAssistantSpeakerPrefix } from '../../services/chat/assistantText';
import { getLegacyTranslationParts, sanitizePipeMarkers } from '../../services/chat/messageText';

const POSITIVE_HINTS = ['谢谢', '喜欢', '想你', '重新', '和好', '在乎', '认真', '愿意', '可以吗', '回来', '继续', '别生气', '抱抱'];
const NEGATIVE_HINTS = ['讨厌', '别烦', '滚', '算了', '不想', '烦', '闭嘴', '离我远点', '拉黑', '屏蔽', '删掉', '别来'];
const APOLOGY_HINTS = ['对不起', '抱歉', '别生气', '重新认识', '重新加', '和好', '给我一次机会', '想继续'];
const WARM_PERSONA_HINTS = ['温柔', '照顾', '心软', '在乎', '护着', '想念', '喜欢', '关心', '体贴', '舍不得', '嘴硬心软'];
const GUARDED_PERSONA_HINTS = ['克制', '冷', '疏离', '理智', '边界', '戒备', '别靠近', '强势', '冷淡', '不近人情'];

export type CharacterBlockState = 'none' | 'user' | 'character' | 'mutual';
export type CharacterFriendRequestDecision =
  | {
      outcome: 'accept';
      reactionText: string;
      resolutionMessage: string;
    }
  | {
      outcome: 'reject';
      reactionText: string;
      resolutionMessage: string;
      counterBlock: boolean;
    }
  | {
      outcome: 'counter_request';
      reactionText: string;
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

export function createRelationshipSystemMessage(text: string, timestamp = Date.now()): ChatMessage {
  return {
    role: 'model',
    text,
    timestamp,
    isSystem: true,
  };
}

export function createCharacterRelationshipMessage(
  characterId: string,
  text: string,
  timestamp = Date.now(),
): ChatMessage {
  const { mainText, translation } = getLegacyTranslationParts(text);
  return {
    role: 'model',
    text: mainText || text,
    timestamp,
    senderCharacterId: characterId,
    ...(translation ? { translation } : {}),
  };
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

export function decideCharacterBlockReaction(
  character: Pick<Character, 'id' | 'name' | 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark' | 'blockedByCharacter'>,
  history: ChatMessage[],
) {
  const { score, style, tone } = evaluateRelationshipMomentum(character, history, '');

  if (style === 'guarded' || score < 0 || tone.negative > tone.positive) {
    return {
      counterBlock: true,
      reactionText: `${character.name}安静了一会儿，最后只回了一句：“行，那我也先把门关上。”`,
    };
  }

  if (style === 'warm') {
    return {
      counterBlock: false,
      reactionText: `${character.name}像是被噎了一下，低声回你：“你真要这样，我就先退开。但这次我会记住。”`,
    };
  }

  return {
    counterBlock: false,
    reactionText: `${character.name}沉默了几秒，语气平平地说：“好，我知道了。你想再来，就带着诚意来。”`,
  };
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
      reactionText: style === 'guarded'
        ? `${character.name}看完你的附言，嘴上还是淡淡的：“只这一次。加回来之后别又乱来。”`
        : style === 'warm'
          ? `${character.name}明显松了口气，轻声回你：“好，这次我通过。别再把我弄丢了。”`
          : `${character.name}回得很快：“行，我通过了。之后好好说。”`,
      resolutionMessage: '对方通过了你的申请',
    };
  }

  if (score <= -2 || (style === 'guarded' && tone.negative > tone.positive + 1)) {
    const counterBlock = style === 'guarded' || tone.negative >= 2;
    return {
      outcome: 'reject',
      counterBlock,
      reactionText: counterBlock
        ? `${character.name}看完你的附言，神情冷了下来：“现在还不行。既然你来来回回地推开，那这次换我不接。”`
        : `${character.name}没有直接发火，只是回了一句：“我先不通过。你想清楚了再来。”`,
      resolutionMessage: counterBlock ? '对方拒绝了这次申请，并把你拉黑了' : '对方拒绝了这次申请',
    };
  }

  return {
    outcome: 'counter_request',
    reactionText: style === 'warm'
      ? `${character.name}像是还没完全放下戒备，却还是把话递了回来：“你先别急，我也给你发一条。你要是认真的，就自己收下。”`
      : style === 'guarded'
        ? `${character.name}没有直接答应，只抬了抬眼：“想加回来可以。先收下我这条申请，再让我看看你是不是真的来认领。”`
        : `${character.name}回你：“我不直接点通过。换我发一条，你自己来收。”`,
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
      reactionText: `${character.name}听见你把黑名单放开，语气还是别扭：“既然门开了，那这次换我来敲。”`,
      requestMessage: '如果你这次是认真的，就把我这条申请收下吧。',
    };
  }

  if (character.blockedByCharacter) {
    return {
      sendRequest: false,
      reactionText: `${character.name}没有顺势松口，只淡淡地回你：“我知道了。想加回来，就正经发申请。”`,
    };
  }

  return {
    sendRequest: false,
    reactionText: `${character.name}应了一声：“黑名单开了就开了。想把关系补回来，还是得看你接下来怎么做。”`,
  };
}

export function decideCharacterRequestAfterBeingBlocked(
  character: Pick<Character, 'id' | 'name' | 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark' | 'blockedByCharacter'>,
  history: ChatMessage[],
  nextAttemptNo: number,
) {
  const { score, style, tone } = evaluateRelationshipMomentum(character, history, '');

  if (nextAttemptNo > 10) {
    return {
      sendRequest: false,
      reactionText: `${character.name}没有再继续追着递申请，只冷冷留下一句：“行，我知道了。”`,
    };
  }

  if (style === 'warm' && score >= -1 && tone.positive >= tone.negative) {
    return {
      sendRequest: true,
      reactionText: `${character.name}明明还在生气，却还是把话丢了回来：“你要拉黑就先拉黑，但这次申请我还是递给你。”`,
      requestMessage: nextAttemptNo >= 3
        ? '我知道你已经把我推开过了，但这次我还是认真再递一次。'
        : '你先别急着把门关死，这次申请你看完再决定。',
    };
  }

  return {
    sendRequest: false,
    reactionText: style === 'guarded'
      ? `${character.name}把情绪压了回去，只淡淡丢下一句：“行，那我先不再往前走。”`
      : `${character.name}像是把话忍住了，只低声回了一句：“好，那先这样。”`,
  };
}

export function decideCharacterRetryAfterRejectedRequest(
  character: Pick<Character, 'id' | 'name' | 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark' | 'blockedByCharacter'>,
  history: ChatMessage[],
  nextAttemptNo: number,
) {
  const { score, style, tone } = evaluateRelationshipMomentum(character, history, '');

  if (nextAttemptNo > 10) {
    return {
      sendRequest: false,
      reactionText: `${character.name}这次没有再继续递申请，只轻声说：“好，我知道你的答案了。”`,
    };
  }

  if (style === 'warm' && score >= -1) {
    return {
      sendRequest: true,
      reactionText: `${character.name}被你这次拒绝刺了一下，却还是没把手收回去：“那我再递一次，这次你看完再决定。”`,
      requestMessage: nextAttemptNo >= 3
        ? '我知道你已经拒过我了，但这次我还是想认真再问一次。'
        : '刚才那次你没收，那我换一句再递给你。',
    };
  }

  if (style === 'neutral' && score >= 1 && tone.positive >= Math.max(0, tone.negative - 1)) {
    return {
      sendRequest: true,
      reactionText: `${character.name}沉默了一下，没有直接退开：“那我再发一次，你自己看着办。”`,
      requestMessage: '这次我把话说清楚了，你要不要接，由你决定。',
    };
  }

  return {
    sendRequest: false,
    reactionText: style === 'guarded'
      ? `${character.name}没有再继续追着递申请，只淡淡留下一句：“行，我先不往前逼你。”`
      : `${character.name}这次把话收了回去，只轻轻回了一句：“好，那先这样。”`,
  };
}

export function buildCharacterIncomingRequestResolution(
  character: Pick<Character, 'name' | 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark'>,
  accepted: boolean,
) {
  const style = resolvePersonaStyle(character);

  if (accepted) {
    if (style === 'guarded') {
      return `${character.name}低低地“嗯”了一声：“通过了。以后别再拿这种事试我。”`;
    }
    if (style === 'warm') {
      return `${character.name}像是终于松了口气：“好，这次算我们都点头了。”`;
    }
    return `${character.name}回你：“好，重新加上了。”`;
  }

  if (style === 'guarded') {
    return `${character.name}没有追问，只留下一句：“行，我知道你的答案了。”`;
  }
  if (style === 'warm') {
    return `${character.name}沉默了一会儿，还是把情绪压了下去：“那我先不往前逼你。”`;
  }
  return `${character.name}把话收了回去：“好，那先这样。”`;
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
