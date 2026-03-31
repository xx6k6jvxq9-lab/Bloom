import type {
  CalendarEvent,
  CalendarMoodStampId,
  ChatMessage,
  CoNote,
  CouplePost,
  CoupleSpaceData,
  LoveLetter,
  MessageBoardEntry,
} from '../../types';
import { buildRelationshipTimeSummary } from './buildRelationshipTimeSummary';

type BuildCalendarMoodStampInput = {
  date: string;
  chatMessages?: ChatMessage[];
  coupleSpace?: CoupleSpaceData | null;
  now?: number;
};

export type PartnerCalendarMoodStamp = {
  mood: CalendarMoodStampId;
  reason: string;
};

function toDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function countOnDate(
  date: string,
  items: Array<{ timestamp: number; isArchived?: boolean } | undefined>,
): number {
  return items.filter((item) => item && !item.isArchived && toDateString(item.timestamp) === date)
    .length;
}

function getFutureCalendarEventCount(date: string, calendarEvents: CalendarEvent[] = []) {
  return calendarEvents.filter((event) => event.date >= date).length;
}

export function buildCalendarMoodStamp(
  input: BuildCalendarMoodStampInput,
): PartnerCalendarMoodStamp | null {
  const { date, coupleSpace, chatMessages } = input;
  if (!coupleSpace) return null;

  const now = input.now ?? Date.now();
  const today = toDateString(now);
  const summary = buildRelationshipTimeSummary({ now, coupleSpace, chatMessages });

  const chatCount = (chatMessages || []).filter(
    (message) => !message.isSystem && toDateString(message.timestamp) === date,
  ).length;
  const loveLetterCount = countOnDate(date, (coupleSpace.loveLetters || []) as LoveLetter[]);
  const postCount = countOnDate(date, (coupleSpace.posts || []) as CouplePost[]);
  const noteCount = countOnDate(
    date,
    (coupleSpace.coNotes || []).filter((note) => !note.replyToNoteId) as CoNote[],
  );
  const messageBoardCount = countOnDate(
    date,
    (coupleSpace.messageBoard || []) as MessageBoardEntry[],
  );
  const totalCount = chatCount + loveLetterCount + postCount + noteCount + messageBoardCount;
  const upcomingEventCount = getFutureCalendarEventCount(date, coupleSpace.calendarEvents || []);

  if (loveLetterCount > 0) {
    return { mood: 'flutter', reason: '这天有一封值得记住的情书。' };
  }

  if (noteCount > 0 && chatCount > 0) {
    return { mood: 'expecting', reason: '这天记下了共同计划，也继续接住了彼此。' };
  }

  if (totalCount >= 6) {
    return { mood: 'clingy', reason: '这天你们来回互动很多，状态是黏黏的。' };
  }

  if (totalCount >= 3) {
    return { mood: 'happy', reason: '这天的互动不少，气氛是轻轻开心的。' };
  }

  if (messageBoardCount > 0 || postCount > 0) {
    return { mood: 'softened', reason: '这天留下了想说的话，心会慢慢软下来。' };
  }

  if (date !== today) {
    return null;
  }

  if (upcomingEventCount > 0 && summary.silenceLevel !== 'distant') {
    return { mood: 'expecting', reason: '今天心里有在期待接下来一起要做的事。' };
  }

  if (summary.daysSinceLastInteraction != null && summary.daysSinceLastInteraction >= 3) {
    return { mood: 'missing_you', reason: '安静了几天，会更容易想起你。' };
  }

  if (summary.interactionTrend === 'warming' && summary.recent24hInteractionCount >= 6) {
    return { mood: 'clingy', reason: '最近明显更黏一点，今天也想继续靠近。' };
  }

  if (summary.interactionTrend === 'warming') {
    return { mood: 'happy', reason: '最近关系在慢慢升温，今天心情也会亮一点。' };
  }

  if (summary.interactionTrend === 'cooling' && summary.silenceLevel !== 'active') {
    return { mood: 'sulky', reason: '最近安静得有点久，心里会有一点点别扭。' };
  }

  if (summary.silenceLevel === 'quiet') {
    return { mood: 'quiet', reason: '今天更安静一点，像在慢慢想你。' };
  }

  if (summary.recent7dCoupleSpaceEventCount > 0) {
    return { mood: 'softened', reason: '这几天一直有把你们的小事放在心上。' };
  }

  return { mood: 'quiet', reason: '今天的情绪更安静一点。' };
}
