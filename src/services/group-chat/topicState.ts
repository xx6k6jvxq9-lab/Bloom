import type { ChatMessage, GroupTopicState } from '../../types';

const MAX_ANCHOR_LENGTH = 48;
const STALE_TOPIC_MS = 1000 * 60 * 60 * 3;
const COOLING_TOPIC_MS = 1000 * 60 * 45;

const MEDIA_MARKERS = new Set(['[image]', '[audio]', '[sticker]']);

function getMessageMainText(message: ChatMessage): string {
  const rawText = message.text || '';
  const colonIndex = rawText.indexOf(':');
  if (message.role === 'model' && colonIndex >= 0) {
    return rawText.slice(colonIndex + 1).trim();
  }
  return rawText.trim();
}

function stripActionCues(text: string): string {
  return text
    .replace(/^\[(?:reply|quote|recall|notice|sticker)[^\]]*\]\s*/i, '')
    .replace(/^\[[^\]]+\]\s*/i, '')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function normalizeAnchorText(text: string): string {
  const cleaned = stripActionCues(text)
    .replace(/\s+/g, ' ')
    .replace(/^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  if (MEDIA_MARKERS.has(cleaned.toLowerCase())) {
    return '';
  }

  const effectiveChars = cleaned.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  if (effectiveChars < 2) {
    return '';
  }

  const punctuationChars = cleaned.match(/[\s,\uFF0C.\u3002!\uFF01?\uFF1F\u3001;\uFF1B:"'`\u2026\-()[\]{}<>]/gu)?.length ?? 0;
  if (cleaned.length >= 8 && punctuationChars / Math.max(cleaned.length, 1) > 0.55) {
    return '';
  }

  return cleaned.length > MAX_ANCHOR_LENGTH
    ? `${cleaned.slice(0, MAX_ANCHOR_LENGTH).trim()}...`
    : cleaned;
}

function getTopicHeat(text: string, previous?: GroupTopicState): GroupTopicState['heat'] {
  const compact = text.replace(/\s/g, '');
  let score = previous?.heat === 'high' ? 1 : previous?.heat === 'medium' ? 0.5 : 0;

  if (/[?\uFF1F!\uFF01]/.test(text)) {
    score += 1;
  }

  if (/(?:@|大家|你们|群里|有人|一起|继续|怎么|什么|为什么|谁)/.test(text)) {
    score += 1;
  }

  if (compact.length >= 14) {
    score += 0.5;
  }

  if (score >= 2) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}

function getTopicPhase(
  heat: GroupTopicState['heat'],
  lastUpdatedAt: number,
  now: number,
): GroupTopicState['phase'] {
  const age = now - lastUpdatedAt;
  if (age > STALE_TOPIC_MS) return 'closing';
  if (age > COOLING_TOPIC_MS) return 'cooling';
  if (heat === 'low') return 'opening';
  return 'active';
}

function shouldKeepPreviousTopic(previous: GroupTopicState | undefined, now: number): previous is GroupTopicState {
  return !!previous && now - previous.lastUpdatedAt <= STALE_TOPIC_MS;
}

function getSpeakerName(message: ChatMessage): string | undefined {
  if (message.role === 'user') {
    return undefined;
  }

  const rawText = message.text || '';
  const colonIndex = rawText.indexOf(':');
  if (colonIndex > 0) {
    return rawText.slice(0, colonIndex).trim() || undefined;
  }

  return undefined;
}

export function deriveGroupTopicStateFromHistory(params: {
  previous?: GroupTopicState;
  previousHistory?: ChatMessage[];
  nextHistory: ChatMessage[];
}): GroupTopicState | undefined {
  const { previous, previousHistory = [], nextHistory } = params;
  const appendedMessages = nextHistory.slice(previousHistory.length);
  const candidates = (appendedMessages.length > 0 ? appendedMessages : nextHistory.slice(-1))
    .filter((message) => !message.isSystem)
    .filter((message) => !message.groupPollCard && !message.groupRelayCard && !message.groupTaskCard)
    .filter((message) => !message.isRecalled);

  const latest = candidates[candidates.length - 1];
  const now = latest?.timestamp || Date.now();
  if (!latest) {
    return shouldKeepPreviousTopic(previous, now)
      ? {
          ...previous,
          phase: getTopicPhase(previous.heat, previous.lastUpdatedAt, now),
        }
      : undefined;
  }

  const anchor = normalizeAnchorText(getMessageMainText(latest));
  if (!anchor) {
    return shouldKeepPreviousTopic(previous, now)
      ? {
          ...previous,
          phase: getTopicPhase(previous.heat, previous.lastUpdatedAt, now),
        }
      : undefined;
  }

  const heat = getTopicHeat(anchor, previous);
  const startedAt = previous && now - previous.lastUpdatedAt <= COOLING_TOPIC_MS
    ? previous.startedAt
    : latest.timestamp;

  return {
    anchor,
    startedBy: latest.role === 'user' ? 'user' : 'character',
    startedById: latest.role === 'model' ? latest.senderCharacterId : undefined,
    lastSpeaker: latest.role === 'user' ? 'user' : 'character',
    lastSpeakerId: latest.role === 'model' ? latest.senderCharacterId : undefined,
    lastSpeakerName: getSpeakerName(latest),
    lastBeat: anchor,
    replyTargetLabel: latest.replyTo?.authorLabel,
    replyTargetRole: latest.replyTo?.role,
    startedAt,
    lastUpdatedAt: latest.timestamp,
    heat,
    phase: getTopicPhase(heat, latest.timestamp, now),
  };
}

export function formatGroupTopicStateForPrompt(topicState?: GroupTopicState): string {
  if (!topicState?.anchor.trim()) {
    return '';
  }

  return [
    '[Current group topic]',
    `Anchor: ${topicState.anchor}`,
    `Started by: ${topicState.startedBy}`,
    topicState.startedById ? `Started by id: ${topicState.startedById}` : '',
    `Latest beat speaker: ${topicState.lastSpeaker}${topicState.lastSpeakerName ? ` (${topicState.lastSpeakerName})` : ''}`,
    topicState.lastBeat ? `Latest beat: ${topicState.lastBeat}` : '',
    topicState.replyTargetLabel ? `Reply target: ${topicState.replyTargetLabel}` : '',
    `Heat: ${topicState.heat}`,
    `Phase: ${topicState.phase}`,
    topicState.replyTargetLabel
      ? 'Priority: keep the next reply aligned with the reply target first, then the shared topic. Do not drift back to the user unless the user is the reply target or the topic naturally asks for it.'
      : topicState.lastSpeaker === 'character'
        ? 'Priority: treat the latest character beat as the thing currently on the table. Other characters may answer, tease, add a side angle, or lightly disagree with that character instead of snapping back to the user.'
        : 'Priority: the user put this topic on the table. Characters should respond to the topic, not deliver unrelated side monologues.',
    'Use this as the shared conversation center when it still fits. A character may continue it, lightly tease around it, shift angle, or let it cool if that fits the role and timing.',
  ].filter(Boolean).join('\n');
}
