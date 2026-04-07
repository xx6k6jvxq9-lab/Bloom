export type CharacterContext = {
  corePersona?: string;
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  sceneHints?: Record<string, string>;
  maskPrompt?: string;
  worldBookPrompt?: string;
};

export type CharacterScopedMemory = {
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
};

export type RelationshipWaveSourceScene =
  | 'direct_chat'
  | 'group_chat'
  | 'dating'
  | 'couple_space'
  | 'moments';

export type RelationshipWaveRelationType =
  | 'character_user'
  | 'character_character'
  | 'public_group_event';

export type RelationshipWaveEventKind =
  | 'support'
  | 'tease'
  | 'conflict'
  | 'reconcile'
  | 'protect'
  | 'jealousy'
  | 'bonding'
  | 'public_stance'
  | 'shared_experience';

export type RelationshipWaveValence = 'positive' | 'negative' | 'mixed';

export type RelationshipWaveIntensity = 'low' | 'medium' | 'high';

export type RelationshipWaveScope = 'private' | 'group_public' | 'cross_scene_readable';

export type RelationshipWaveDecayHint = 'short' | 'medium' | 'stable';

export type RelationshipWaveRecord = {
  sourceScene: RelationshipWaveSourceScene;
  relationType: RelationshipWaveRelationType;
  sourceCharacterId: string;
  targetCharacterId?: string;
  targetUser?: boolean;
  groupId?: string;
  eventKind: RelationshipWaveEventKind;
  valence: RelationshipWaveValence;
  intensity: RelationshipWaveIntensity;
  scope: RelationshipWaveScope;
  summary: string;
  timestamp: number;
  decayHint: RelationshipWaveDecayHint;
};

export type SceneScopedSignals = {
  recentCoupleSpaceSummary?: string;
  sharedRecentRelationshipSummary?: string;
};

export type UserGlobalContext = {
  userName?: string;
};

export type ChatRecentContext = {
  shortTermSummary?: string;
  recentCoupleSpaceSummary?: string;
  sharedRecentRelationshipSummary?: string;
};

export type RelationshipProjection = {
  characterScopedMemory: CharacterScopedMemory;
  sceneScopedSignals: SceneScopedSignals;
};
