import type {
  ChatMessage,
  CouplePostComment,
  CoupleSpaceData,
  LedgerEntry,
  LoveLetter,
  LoveLetterComment,
  MessageBoardEntry,
} from '../../types';
import type {
  RelationshipDayPhase,
  RelationshipInteractionTrend,
  RelationshipSilenceLevel,
  RelationshipTimeSummary,
  RelationshipTimeSummaryInput,
} from './types';

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;
const WINDOW_24H_MS = DAY_MS;
const WINDOW_3D_MS = DAY_MS * 3;
const WINDOW_7D_MS = DAY_MS * 7;

function toDayPhase(hours: number): RelationshipDayPhase {
  if (hours < 5) return 'late_night';
  if (hours < 12) return 'morning';
  if (hours < 18) return 'afternoon';
  return 'evening';
}

function formatLocalDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getHoursSince(now: number, timestamp: number | null): number | null {
  if (timestamp == null) return null;
  return Math.max(0, Math.floor((now - timestamp) / HOUR_MS));
}

function getDaysSince(now: number, timestamp: number | null): number | null {
  if (timestamp == null) return null;
  return Math.max(0, Math.floor((now - timestamp) / DAY_MS));
}

function countRecent(timestamps: number[], now: number, windowMs: number): number {
  const cutoff = now - windowMs;
  return timestamps.filter((timestamp) => timestamp >= cutoff).length;
}

function getLatestTimestamp(timestamps: number[]): number | null {
  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

function getEarliestTimestamp(timestamps: number[]): number | null {
  if (timestamps.length === 0) return null;
  return Math.min(...timestamps);
}

function pushIfValid(target: number[], timestamp: number | null | undefined) {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0) {
    target.push(timestamp);
  }
}

function collectLoveLetterCommentTimestamps(comments: LoveLetterComment[] | undefined): number[] {
  const timestamps: number[] = [];
  for (const comment of comments || []) {
    pushIfValid(timestamps, comment.timestamp);
  }
  return timestamps;
}

function collectPostCommentTimestamps(comments: CouplePostComment[] | undefined): number[] {
  const timestamps: number[] = [];
  for (const comment of comments || []) {
    pushIfValid(timestamps, comment.timestamp);
  }
  return timestamps;
}

function collectCoupleSpaceInteractionTimestamps(coupleSpace?: CoupleSpaceData | null): number[] {
  if (!coupleSpace) return [];

  const timestamps: number[] = [];

  for (const letter of coupleSpace.loveLetters || []) {
    if (letter.isArchived) continue;
    pushIfValid(timestamps, letter.timestamp);
    collectLoveLetterCommentTimestamps(letter.comments).forEach((timestamp) => pushIfValid(timestamps, timestamp));
  }

  for (const post of coupleSpace.posts || []) {
    if (post.isArchived) continue;
    pushIfValid(timestamps, post.timestamp);
    collectPostCommentTimestamps(post.comments).forEach((timestamp) => pushIfValid(timestamps, timestamp));
  }

  for (const note of coupleSpace.coNotes || []) {
    if (note.isArchived) continue;
    pushIfValid(timestamps, note.timestamp);
  }

  for (const message of coupleSpace.messageBoard || []) {
    if (message.isArchived) continue;
    pushIfValid(timestamps, message.timestamp);
  }

  for (const entry of coupleSpace.ledger || []) {
    pushIfValid(timestamps, entry.timestamp);
  }

  return timestamps.sort((a, b) => b - a);
}

function collectChatTimestamps(chatMessages?: ChatMessage[]): number[] {
  return (chatMessages || [])
    .filter((message) => !message.isSystem)
    .map((message) => message.timestamp)
    .filter((timestamp): timestamp is number => typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0)
    .sort((a, b) => b - a);
}

function deriveInteractionTrend(
  chatTimestamps: number[],
  coupleSpaceTimestamps: number[],
  now: number,
  lastInteractionAt: number | null,
): RelationshipInteractionTrend {
  const interactionTimestamps = [...chatTimestamps, ...coupleSpaceTimestamps];
  const recent3dCount = countRecent(interactionTimestamps, now, WINDOW_3D_MS);
  const recent7dCount = countRecent(interactionTimestamps, now, WINDOW_7D_MS);
  const previous4dCount = Math.max(0, recent7dCount - recent3dCount);
  const hoursSinceLastInteraction = getHoursSince(now, lastInteractionAt);

  if (recent3dCount >= Math.max(3, previous4dCount + 2)) {
    return 'warming';
  }

  if (
    previous4dCount >= recent3dCount + 2 &&
    (hoursSinceLastInteraction == null || hoursSinceLastInteraction >= 24)
  ) {
    return 'cooling';
  }

  return 'steady';
}

function deriveSilenceLevel(hoursSinceLastInteraction: number | null): RelationshipSilenceLevel {
  if (hoursSinceLastInteraction == null) return 'distant';
  if (hoursSinceLastInteraction <= 24) return 'active';
  if (hoursSinceLastInteraction <= 72) return 'quiet';
  return 'distant';
}

export function buildRelationshipTimeSummary(
  input: RelationshipTimeSummaryInput,
): RelationshipTimeSummary {
  const now = input.now ?? Date.now();
  const currentDate = new Date(now);
  const dayPhase = toDayPhase(currentDate.getHours());
  const today = formatLocalDate(now);
  const weekday = currentDate.getDay();
  const isWeekend = weekday === 0 || weekday === 6;

  const chatTimestamps = collectChatTimestamps(input.chatMessages);
  const coupleSpaceTimestamps = collectCoupleSpaceInteractionTimestamps(input.coupleSpace);
  const allInteractionTimestamps = [...chatTimestamps, ...coupleSpaceTimestamps].sort((a, b) => b - a);

  const lastChatAt = getLatestTimestamp(chatTimestamps);
  const lastCoupleSpaceInteractionAt = getLatestTimestamp(coupleSpaceTimestamps);
  const lastInteractionAt = getLatestTimestamp(allInteractionTimestamps);

  const relationshipStartedAt =
    input.coupleSpace?.anniversaryDate ??
    getEarliestTimestamp(allInteractionTimestamps);

  const hoursSinceLastChat = getHoursSince(now, lastChatAt);
  const daysSinceLastChat = getDaysSince(now, lastChatAt);
  const hoursSinceLastCoupleSpaceInteraction = getHoursSince(now, lastCoupleSpaceInteractionAt);
  const daysSinceLastCoupleSpaceInteraction = getDaysSince(now, lastCoupleSpaceInteractionAt);
  const hoursSinceLastInteraction = getHoursSince(now, lastInteractionAt);
  const daysSinceLastInteraction = getDaysSince(now, lastInteractionAt);
  const daysSinceRelationshipStarted = getDaysSince(now, relationshipStartedAt);

  const recent24hChatCount = countRecent(chatTimestamps, now, WINDOW_24H_MS);
  const recent7dChatCount = countRecent(chatTimestamps, now, WINDOW_7D_MS);
  const recent24hCoupleSpaceEventCount = countRecent(coupleSpaceTimestamps, now, WINDOW_24H_MS);
  const recent7dCoupleSpaceEventCount = countRecent(coupleSpaceTimestamps, now, WINDOW_7D_MS);
  const recent24hInteractionCount = countRecent(allInteractionTimestamps, now, WINDOW_24H_MS);
  const recent7dInteractionCount = countRecent(allInteractionTimestamps, now, WINDOW_7D_MS);

  const interactionTrend = deriveInteractionTrend(
    chatTimestamps,
    coupleSpaceTimestamps,
    now,
    lastInteractionAt,
  );
  const silenceLevel = deriveSilenceLevel(hoursSinceLastInteraction);

  return {
    now,
    today,
    weekday,
    isWeekend,
    dayPhase,
    lastChatAt,
    lastCoupleSpaceInteractionAt,
    lastInteractionAt,
    relationshipStartedAt,
    hoursSinceLastChat,
    daysSinceLastChat,
    hoursSinceLastCoupleSpaceInteraction,
    daysSinceLastCoupleSpaceInteraction,
    hoursSinceLastInteraction,
    daysSinceLastInteraction,
    daysSinceRelationshipStarted,
    recent24hChatCount,
    recent7dChatCount,
    recent24hCoupleSpaceEventCount,
    recent7dCoupleSpaceEventCount,
    recent24hInteractionCount,
    recent7dInteractionCount,
    interactionTrend,
    silenceLevel,
  };
}
