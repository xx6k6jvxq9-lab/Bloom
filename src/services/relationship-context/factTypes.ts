export type FactTraceSourceScene =
  | 'direct_chat'
  | 'group_chat'
  | 'dating'
  | 'couple_space'
  | 'moments';

export type FactTraceType =
  | 'preference'
  | 'plan'
  | 'status'
  | 'experience'
  | 'background';

export type FactTraceSubjectType = 'user' | 'character' | 'group';

export type FactTraceVisibility = 'private' | 'group_public' | 'cross_scene_readable';

export type FactTraceStability = 'temporary' | 'situational' | 'stable';

export type FactTraceConfidence = 'explicit' | 'inferred';

export type FactTraceDecayHint = 'short' | 'medium' | 'stable';

export type FactTraceRecord = {
  sourceScene: FactTraceSourceScene;
  factType: FactTraceType;
  subjectType: FactTraceSubjectType;
  subjectId: string;
  relatedCharacterIds?: string[];
  groupId?: string;
  visibility: FactTraceVisibility;
  stability: FactTraceStability;
  confidence: FactTraceConfidence;
  summary: string;
  timestamp: number;
  decayHint: FactTraceDecayHint;
};
