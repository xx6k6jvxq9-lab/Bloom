import type {
  FactTraceConfidence,
  FactTraceSourceScene,
  FactTraceStability,
  FactTraceSubjectType,
  FactTraceType,
  FactTraceVisibility,
} from '../relationship-context/factTypes';
import type {
  RelationshipWaveEventKind,
  RelationshipWaveIntensity,
  RelationshipWaveRelationType,
  RelationshipWaveScope,
  RelationshipWaveSourceScene,
  RelationshipWaveValence,
} from '../relationship-context/types';

export type MemoryRecordKind = 'fact' | 'relationship_wave';
export type MemoryRecordVisibility = FactTraceVisibility | RelationshipWaveScope;
export type MemoryRecordStability = FactTraceStability;
export type MemoryRecordDecayHint = 'short' | 'medium' | 'stable';
export type MemoryRecordSourceScene = FactTraceSourceScene | RelationshipWaveSourceScene;
export type MemoryRecordSourceSessionType = 'direct' | 'group';

type BaseMemoryRecord = {
  id: string;
  kind: MemoryRecordKind;
  sourceScene: MemoryRecordSourceScene;
  sourceSessionType: MemoryRecordSourceSessionType;
  sourceSessionId: string;
  sourceEventIds: string[];
  characterIds: string[];
  groupId?: string;
  visibility: MemoryRecordVisibility;
  stability: MemoryRecordStability;
  decayHint: MemoryRecordDecayHint;
  summary: string;
  timestamp: number;
};

export type FactMemoryRecord = BaseMemoryRecord & {
  kind: 'fact';
  factType: FactTraceType;
  subjectType: FactTraceSubjectType;
  subjectId: string;
  confidence: FactTraceConfidence;
  relatedCharacterIds?: string[];
};

export type RelationshipWaveMemoryRecord = BaseMemoryRecord & {
  kind: 'relationship_wave';
  relationType: RelationshipWaveRelationType;
  eventKind: RelationshipWaveEventKind;
  valence: RelationshipWaveValence;
  intensity: RelationshipWaveIntensity;
  sourceCharacterId: string;
  targetCharacterId?: string;
  targetUser?: boolean;
};

export type MemoryRecord = FactMemoryRecord | RelationshipWaveMemoryRecord;
