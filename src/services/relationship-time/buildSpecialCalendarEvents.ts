import type { CalendarEvent, ChatMessage, CoupleSpaceData } from '../../types';
import { buildRelationshipTimeSummary } from './buildRelationshipTimeSummary';

type BuildSpecialCalendarEventsInput = {
  chatMessages?: ChatMessage[];
  coupleSpace?: CoupleSpaceData | null;
  now?: number;
};

function toDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createSpecialEvent(
  id: string,
  timestamp: number,
  title: string,
  description: string,
): CalendarEvent {
  return {
    id: `special-${id}-${timestamp}`,
    date: toDateString(timestamp),
    title,
    description,
    authorId: 'system',
  };
}

export function buildSpecialCalendarEvents(
  input: BuildSpecialCalendarEventsInput,
): CalendarEvent[] {
  const { coupleSpace } = input;
  if (!coupleSpace) return [];

  const summary = buildRelationshipTimeSummary(input);
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();

  const push = (event: CalendarEvent) => {
    if (seen.has(event.id)) return;
    seen.add(event.id);
    events.push(event);
  };

  if (coupleSpace.anniversaryDate) {
    push(
      createSpecialEvent(
        'relationship-start',
        coupleSpace.anniversaryDate,
        '建立情侣空间',
        '这一天，你们正式拥有了属于彼此的情侣空间。',
      ),
    );

    const milestoneDays = [7, 30, 100];
    for (const day of milestoneDays) {
      const milestoneTime = coupleSpace.anniversaryDate + day * 24 * 60 * 60 * 1000;
      if (milestoneTime <= summary.now) {
        push(
          createSpecialEvent(
            `relationship-day-${day}`,
            milestoneTime,
            `第 ${day} 天`,
            `这是你们建立情侣空间后的第 ${day} 天。`,
          ),
        );
      }
    }
  }

  const firstLoveLetter = [...(coupleSpace.loveLetters || [])]
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  if (firstLoveLetter) {
    push(
      createSpecialEvent(
        'first-love-letter',
        firstLoveLetter.timestamp,
        '第一次写情书',
        '你们第一次把心意认真写进了情书里。',
      ),
    );
  }

  const firstTopLevelCoNote = [...(coupleSpace.coNotes || [])]
    .filter((note) => !note.replyToNoteId)
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  if (firstTopLevelCoNote) {
    push(
      createSpecialEvent(
        'first-co-note',
        firstTopLevelCoNote.timestamp,
        '第一次一起写互记',
        '这是你们第一次把共同的小事认真记下来。',
      ),
    );
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
