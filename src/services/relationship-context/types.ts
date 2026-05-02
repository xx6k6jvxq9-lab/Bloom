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
  | 'music_together'
  | 'couple_space'
  | 'forum'
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

export type TypedContextDecay = 'short' | 'medium' | 'stable';

export type TypedContextVisibility = 'private' | 'group_public' | 'cross_scene_readable';

export type RelationshipResidueItem = {
  type: 'relationship_residue';
  summary: string;
  sourceScene: RelationshipWaveSourceScene;
  timestamp: number;
  decay: TypedContextDecay;
  visibility: TypedContextVisibility;
};

export type SceneResidueItem = {
  type: 'scene_residue';
  summary: string;
  sourceScene: RelationshipWaveSourceScene;
  timestamp: number;
  decay: TypedContextDecay;
  visibility: TypedContextVisibility;
};

export type TopicAnchorItem = {
  type: 'topic_anchor';
  summary: string;
  sourceScene: RelationshipWaveSourceScene;
  timestamp: number;
  decay: TypedContextDecay;
  visibility: TypedContextVisibility;
};

export type TaskResidueItem = {
  type: 'task_residue';
  summary: string;
  sourceScene: RelationshipWaveSourceScene;
  timestamp: number;
  decay: TypedContextDecay;
  visibility: TypedContextVisibility;
};

export type CharacterSharedContextSnapshot = {
  sourceScene: RelationshipWaveSourceScene;
  settledAt: number;
  relationshipResidue?: RelationshipResidueItem[];
  sceneResidue?: SceneResidueItem[];
  topicAnchors?: TopicAnchorItem[];
  taskResidue?: TaskResidueItem[];
};

export type SceneScopedSignals = {
  relationshipResidue?: RelationshipResidueItem[];
  sceneResidue?: SceneResidueItem[];
  topicAnchors?: TopicAnchorItem[];
  taskResidue?: TaskResidueItem[];
  recentCoupleSpaceSummary?: string;
  sharedRecentRelationshipSummary?: string;
  publicAcquaintanceSummary?: string;
};

export type UserGlobalContext = {
  userName?: string;
};

export type ChatRecentContext = {
  shortTermSummary?: string;
  relationshipResidue?: RelationshipResidueItem[];
  sceneResidue?: SceneResidueItem[];
  topicAnchors?: TopicAnchorItem[];
  taskResidue?: TaskResidueItem[];
  recentCoupleSpaceSummary?: string;
  sharedRecentRelationshipSummary?: string;
  publicAcquaintanceSummary?: string;
};

export type RelationshipProjection = {
  characterScopedMemory: CharacterScopedMemory;
  sceneScopedSignals: SceneScopedSignals;
};
