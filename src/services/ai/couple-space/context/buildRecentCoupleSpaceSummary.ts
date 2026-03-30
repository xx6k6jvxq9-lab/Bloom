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
 * Phase A helper for chat backflow.
 * Keep this intentionally light: only recent high-value couple-space events,
 * no full-content injection, no ranking model, no long narrative summary.
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
    const direction = letter.authorId === 'user' ? 'user_to_character' : 'character_to_user';
    events.push({
      type: 'love_letter',
      direction,
      timestamp: letter.timestamp,
      summary: letter.authorId === 'user'
        ? `${source.user.name} 最近在情侣空间里留下一封情书`
        : `${source.partner.name} 最近在情侣空间里写过一封情书`,
    });
  }

  return events;
}

function collectCoNoteEvents(source: CoupleSpaceSummarySource): RecentCoupleSpaceEvent[] {
  const notes = source.coupleSpace.coNotes ?? [];
  const events: RecentCoupleSpaceEvent[] = [];

  for (const note of notes) {
    const isReply = Boolean(note.replyToNoteId);

    if (note.authorId === 'user') {
      events.push({
        type: 'co_note',
        direction: 'user_to_character',
        timestamp: note.timestamp,
        summary: isReply
          ? `${source.user.name} 最近在互记里追加了一句回应`
          : `${source.user.name} 最近在互记里记下一条想一起做的事`,
      });
      continue;
    }

    events.push({
      type: 'co_note',
      direction: isReply ? 'character_to_user' : 'character_to_user',
      timestamp: note.timestamp,
      summary: isReply
        ? `${source.partner.name} 最近在互记里回应过 ${source.user.name}`
        : `${source.partner.name} 最近在互记里记下一条关于你们的小事`,
    });
  }

  return events;
}

function collectMessageBoardEvents(source: CoupleSpaceSummarySource): RecentCoupleSpaceEvent[] {
  const messages = source.coupleSpace.messageBoard ?? [];
  const events: RecentCoupleSpaceEvent[] = [];

  for (const message of messages) {
    const direction = message.authorId === 'user' ? 'user_to_character' : 'character_to_user';
    events.push({
      type: 'message_board',
      direction,
      timestamp: message.timestamp,
      summary: message.authorId === 'user'
        ? `${source.user.name} 最近在留言板里留下一句话`
        : `${source.partner.name} 最近在留言板里回过一句话`,
    });
  }

  return events;
}
