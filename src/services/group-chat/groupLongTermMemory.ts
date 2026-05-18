import type { ChatMessage, GroupLongTermMemory } from '../../types';
import { isUsableChatText, normalizeChatPunctuationNoise } from '../chat/messageHygiene';

const MAX_FIELD_LENGTH = 420;
const MAX_ROLE_LENGTH = 180;
const MAX_HISTORY_MESSAGES = 80;

function compactLine(text: string, maxLength = 80): string {
  const normalized = normalizeChatPunctuationNoise(text)
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/^\[(?:reply|quote|recall|notice|sticker)[^\]]*\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || !isUsableChatText(normalized)) {
    return '';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trim()}...`
    : normalized;
}

function getMainText(message: ChatMessage): string {
  const rawText = message.text || '';
  const colonIndex = rawText.indexOf(':');
  if (message.role === 'model' && colonIndex >= 0) {
    return rawText.slice(colonIndex + 1).trim();
  }
  return rawText.trim();
}

function getSpeakerName(message: ChatMessage, memberNames: Record<string, string>): string {
  if (message.role === 'user') {
    return '用户';
  }

  if (message.senderCharacterId && memberNames[message.senderCharacterId]) {
    return memberNames[message.senderCharacterId];
  }

  const rawText = message.text || '';
  const colonIndex = rawText.indexOf(':');
  if (colonIndex > 0) {
    return rawText.slice(0, colonIndex).trim() || '群成员';
  }

  return '群成员';
}

function isPublicMessage(message: ChatMessage): boolean {
  return !message.isSystem
    && !message.isRecalled
    && !message.groupPollCard
    && !message.groupRelayCard
    && !message.groupTaskCard
    && !message.groupOfflineCard;
}

function sanitizeField(value: unknown, maxLength = MAX_FIELD_LENGTH): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const compacted = compactLine(value, maxLength);
  return compacted || undefined;
}

export function sanitizeGroupLongTermMemory(value: unknown, memberIds?: string[]): GroupLongTermMemory | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const source = value as GroupLongTermMemory;
  const allowedIds = memberIds ? new Set(memberIds) : null;
  const memberRoles: Record<string, string> = {};

  if (source.memberRoles && typeof source.memberRoles === 'object' && !Array.isArray(source.memberRoles)) {
    Object.entries(source.memberRoles).forEach(([memberId, role]) => {
      if (allowedIds && !allowedIds.has(memberId)) {
        return;
      }

      const sanitizedRole = sanitizeField(role, MAX_ROLE_LENGTH);
      if (sanitizedRole) {
        memberRoles[memberId] = sanitizedRole;
      }
    });
  }

  const result: GroupLongTermMemory = {
    atmosphere: sanitizeField(source.atmosphere),
    recurringDynamics: sanitizeField(source.recurringDynamics),
    sharedHistory: sanitizeField(source.sharedHistory),
    memberRoles: Object.keys(memberRoles).length > 0 ? memberRoles : undefined,
  };

  return result.atmosphere || result.recurringDynamics || result.sharedHistory || result.memberRoles
    ? result
    : undefined;
}

export function deriveGroupLongTermMemoryFromHistory(params: {
  history: ChatMessage[];
  memberIds: string[];
  memberNames?: Record<string, string>;
  previous?: GroupLongTermMemory;
  backgroundSummary?: string;
  publicFacts?: string;
}): GroupLongTermMemory | undefined {
  const memberNames = params.memberNames || {};
  const messages = params.history
    .filter(isPublicMessage)
    .slice(-MAX_HISTORY_MESSAGES);

  if (messages.length < 6 && !params.previous) {
    return undefined;
  }

  const modelMessages = messages.filter((message) => message.role === 'model' && !!message.senderCharacterId);
  const speakerCounts = new Map<string, number>();
  const replyPairs = new Map<string, number>();

  modelMessages.forEach((message) => {
    if (!message.senderCharacterId) {
      return;
    }

    speakerCounts.set(message.senderCharacterId, (speakerCounts.get(message.senderCharacterId) || 0) + 1);

    const replyLabel = message.replyTo?.authorLabel?.trim();
    if (replyLabel) {
      const pairKey = `${message.senderCharacterId}::${replyLabel}`;
      replyPairs.set(pairKey, (replyPairs.get(pairKey) || 0) + 1);
    }
  });

  const distinctSpeakers = new Set(modelMessages.map((message) => message.senderCharacterId).filter(Boolean)).size;
  const replyCount = modelMessages.filter((message) => !!message.replyTo).length;

  const activityLabel = messages.length >= 36
    ? '这个群已经形成比较稳定的长期聊天节奏。'
    : messages.length >= 16
      ? '这个群正在形成可辨认的聊天节奏。'
      : '这个群的长期节奏还在慢慢形成。';

  const interactionLabel = replyCount >= 8 || distinctSpeakers >= 4
    ? '成员之间会互相接话，不只是围着用户回答。'
    : replyCount >= 3
      ? '成员之间已经有一些接话连续性，但整体还比较轻。'
      : '目前更多还是由话题推动，成员之间的固定互动还不算多。';

  const atmosphereParts = [
    activityLabel,
    interactionLabel,
    params.backgroundSummary ? `群背景：${compactLine(params.backgroundSummary, 120)}` : '',
  ].filter(Boolean);

  const topPairs = [...replyPairs.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([key, count]) => {
      const [speakerId, targetLabel] = key.split('::');
      const speakerName = speakerId ? memberNames[speakerId] || speakerId : '某个成员';
      return `${speakerName}经常接${targetLabel}的话（${count}次）`;
    });

  const recurringDynamics = topPairs.length > 0
    ? topPairs.join('；')
    : params.previous?.recurringDynamics || undefined;

  const notableLines = messages
    .filter((message) => {
      const text = compactLine(getMainText(message), 90);
      return text.length >= 12 && !/^\[(?:image|audio|sticker)\]/i.test(text);
    })
    .slice(-6)
    .map((message) => `${getSpeakerName(message, memberNames)}：${compactLine(getMainText(message), 70)}`)
    .filter(Boolean)
    .slice(-3);

  const sharedHistory = [
    params.publicFacts ? `群公开事实：${compactLine(params.publicFacts, 120)}` : '',
    notableLines.length > 0 ? `最近值得记住的共同话题：${notableLines.join(' | ')}` : '',
  ].filter(Boolean).join(' ') || params.previous?.sharedHistory;

  const memberRoles: Record<string, string> = {};
  params.memberIds.forEach((memberId) => {
    const count = speakerCounts.get(memberId) || 0;
    const memberName = memberNames[memberId] || memberId;
    const repliesTo = [...replyPairs.entries()]
      .filter(([key]) => key.startsWith(`${memberId}::`))
      .sort((left, right) => right[1] - left[1])
      .slice(0, 2)
      .map(([key]) => key.split('::')[1])
      .filter((value): value is string => !!value);

    const activityRole = count >= 8
      ? '经常主动发言'
      : count >= 3
        ? '偶尔参与接话'
        : '相对安静一些';
    const replyRole = repliesTo.length > 0
      ? `最近常接${Array.from(new Set(repliesTo)).join('、')}的话。`
      : '暂时还没有固定接话对象。';

    memberRoles[memberId] = `${memberName}在群里属于${activityRole}，${replyRole}`;
  });

  return sanitizeGroupLongTermMemory({
    atmosphere: atmosphereParts.join(' '),
    recurringDynamics,
    sharedHistory,
    memberRoles,
  }, params.memberIds);
}
