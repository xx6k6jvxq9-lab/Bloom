import type { CoNote, LoveLetter, MessageBoardEntry, UserProfileExtended } from '../../../../types';

type CoupleSpaceSummarySource = {
  coupleSpace: {
    coNotes?: CoNote[];
    loveLetters?: LoveLetter[];
    messageBoard?: MessageBoardEntry[];
  };
  user: UserProfileExtended;
  partner: {
    id: string;
    name: string;
  };
  now?: number;
};

type RelationshipEventType = 'love_letter' | 'co_note' | 'message_board';

type RecentCoupleSpaceEvent = {
  type: RelationshipEventType;
  direction: 'user_to_character' | 'character_to_user' | 'mutual';
  timestamp: number;
  summary: string;
};

export type BuildRecentCoupleSpaceSummaryResult = {
  recentCoupleSpaceSummary?: string;
  recentEvents: RecentCoupleSpaceEvent[];
};

/**
 * Lightweight helper for chat backflow.
 * Phase A/B only need a short semantic summary of recent couple-space events,
 * not full content, not long narrative, and not retrieval-heavy logic.
 */
export function buildRecentCoupleSpaceSummary(
  source: CoupleSpaceSummarySource,
): BuildRecentCoupleSpaceSummaryResult {
  const recentEvents = [
    ...collectLoveLetterEvents(source),
    ...collectCoNoteEvents(source),
    ...collectMessageBoardEvents(source),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  return {
    recentCoupleSpaceSummary: recentEvents.length > 0
      ? recentEvents.map((event) => event.summary).join('；')
      : undefined,
    recentEvents,
  };
}

function collectLoveLetterEvents(source: CoupleSpaceSummarySource): RecentCoupleSpaceEvent[] {
  const letters = source.coupleSpace.loveLetters ?? [];
  const events: RecentCoupleSpaceEvent[] = [];

  for (const letter of letters) {
    const contentFocus = summarizeContentFocus(letter.content);
    const direction = letter.authorId === 'user' ? 'user_to_character' : 'character_to_user';

    events.push({
      type: 'love_letter',
      direction,
      timestamp: letter.timestamp,
      summary: letter.authorId === 'user'
        ? `${source.user.name} 最近在情侣空间留下一封情书，重点在${contentFocus}`
        : `${source.partner.name} 最近在情侣空间写下一封情书，重点在${contentFocus}`,
    });
  }

  return events;
}

function collectCoNoteEvents(source: CoupleSpaceSummarySource): RecentCoupleSpaceEvent[] {
  const notes = source.coupleSpace.coNotes ?? [];
  const events: RecentCoupleSpaceEvent[] = [];

  for (const note of notes) {
    const contentFocus = summarizeContentFocus(note.content);
    const isReply = Boolean(note.replyToNoteId);

    if (note.authorId === 'user') {
      events.push({
        type: 'co_note',
        direction: isReply ? 'mutual' : 'user_to_character',
        timestamp: note.timestamp,
        summary: isReply
          ? `${source.user.name} 最近在互记里补了一句，重点在${contentFocus}`
          : `${source.user.name} 最近在互记里记下了一件事，重点在${contentFocus}`,
      });
      continue;
    }

    events.push({
      type: 'co_note',
      direction: isReply ? 'mutual' : 'character_to_user',
      timestamp: note.timestamp,
      summary: isReply
        ? `${source.partner.name} 最近在互记里回应过一件事，重点在${contentFocus}`
        : `${source.partner.name} 最近在互记里记下了一件事，重点在${contentFocus}`,
    });
  }

  return events;
}

function collectMessageBoardEvents(source: CoupleSpaceSummarySource): RecentCoupleSpaceEvent[] {
  const messages = source.coupleSpace.messageBoard ?? [];
  const events: RecentCoupleSpaceEvent[] = [];

  for (const message of messages) {
    const direction = message.authorId === 'user' ? 'user_to_character' : 'character_to_user';
    const contentFocus = summarizeContentFocus(message.content);

    events.push({
      type: 'message_board',
      direction,
      timestamp: message.timestamp,
      summary: message.authorId === 'user'
        ? `${source.user.name} 最近在留言板留下一句话，重点在${contentFocus}`
        : `${source.partner.name} 最近在留言板回过一句话，重点在${contentFocus}`,
    });
  }

  return events;
}

function summarizeContentFocus(content?: string): string {
  const normalized = normalizeText(content);
  if (!normalized) {
    return '最近的相处和挂念';
  }

  const compact = normalized.replace(/[，。！？；、,.!?;:：]/g, ' ');
  const candidate = compact
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .find((part) => part.length >= 2);

  if (!candidate) {
    return '最近的相处和挂念';
  }

  if (candidate.length <= 12) {
    return `“${candidate}”这件事`;
  }

  return `“${candidate.slice(0, 12)}”这件事`;
}

function normalizeText(content?: string): string {
  return (content ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[“”"]/g, '')
    .trim();
}
