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

export type MemoryRecordKind = 'fact' | 'relationship_wave' | 'scene_progress' | 'snapshot' | 'note';
export type MemoryRecordVisibility = FactTraceVisibility | RelationshipWaveScope;
export type MemoryRecordStability = FactTraceStability;
export type MemoryRecordDecayHint = 'short' | 'medium' | 'stable';
export type MemoryRecordSourceScene = FactTraceSourceScene | RelationshipWaveSourceScene | 'manual';
export type MemoryRecordSourceSessionType = 'direct' | 'group';
export type MemorySnapshotType = 'short_term_summary' | 'long_term_profile' | 'shared_state';
export type MemoryRecordLibraryKind = 'short-term' | 'long-term';
export type MemoryRecordLibrarySource = 'auto' | 'manual';
export type MemoryNoteType = 'manual' | 'imported';

export type SceneProgressMemoryRecordDraft = {
  summary: string;
  stageLabel: string;
  currentBeat?: string;
  currentSignature?: string;
  previousSignature?: string;
  repeatedSignature?: boolean;
  completedActions?: string[];
  bannedRepeatActions?: string[];
  unresolvedTension?: string;
  nextStepOptions?: string[];
  visibility?: MemoryRecordVisibility;
  stability?: MemoryRecordStability;
  decayHint?: MemoryRecordDecayHint;
};

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
  retrievalHints?: string[];
  sceneTags?: string[];
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

export type SceneProgressMemoryRecord = BaseMemoryRecord & {
  kind: 'scene_progress';
  stageLabel: string;
  currentBeat?: string;
  currentSignature?: string;
  previousSignature?: string;
  repeatedSignature: boolean;
  completedActions: string[];
  bannedRepeatActions: string[];
  unresolvedTension?: string;
  nextStepOptions: string[];
};

export type SnapshotMemoryRecord = BaseMemoryRecord & {
  kind: 'snapshot';
  snapshotType: MemorySnapshotType;
  text: string;
};

export type NoteMemoryRecord = BaseMemoryRecord & {
  kind: 'note';
  noteType: MemoryNoteType;
  libraryKind: MemoryRecordLibraryKind;
  librarySource: MemoryRecordLibrarySource;
  text: string;
};

export type MemoryRecord =
  | FactMemoryRecord
  | RelationshipWaveMemoryRecord
  | SceneProgressMemoryRecord
  | SnapshotMemoryRecord
  | NoteMemoryRecord;
