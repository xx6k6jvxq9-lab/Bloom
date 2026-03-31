import type { ChatMessage, CoupleSpaceData } from '../../types';

export type RelationshipInteractionTrend = 'warming' | 'steady' | 'cooling';

export type RelationshipSilenceLevel = 'active' | 'quiet' | 'distant';

export type RelationshipDayPhase =
  | 'late_night'
  | 'morning'
  | 'afternoon'
  | 'evening';

export type RelationshipTimeSummaryInput = {
  chatMessages?: ChatMessage[];
  coupleSpace?: CoupleSpaceData | null;
  now?: number;
};

export type RelationshipTimeSummary = {
  now: number;
  today: string;
  weekday: number;
  isWeekend: boolean;
  dayPhase: RelationshipDayPhase;
  lastChatAt: number | null;
  lastCoupleSpaceInteractionAt: number | null;
  lastInteractionAt: number | null;
  relationshipStartedAt: number | null;
  hoursSinceLastChat: number | null;
  daysSinceLastChat: number | null;
  hoursSinceLastCoupleSpaceInteraction: number | null;
  daysSinceLastCoupleSpaceInteraction: number | null;
  hoursSinceLastInteraction: number | null;
  daysSinceLastInteraction: number | null;
  daysSinceRelationshipStarted: number | null;
  recent24hChatCount: number;
  recent7dChatCount: number;
  recent24hCoupleSpaceEventCount: number;
  recent7dCoupleSpaceEventCount: number;
  recent24hInteractionCount: number;
  recent7dInteractionCount: number;
  interactionTrend: RelationshipInteractionTrend;
  silenceLevel: RelationshipSilenceLevel;
};
