export type CharacterContext = {
  corePersona?: string;
  expressionStyle?: string;
  extendedLore?: string;
  sceneHints?: Record<string, string>;
  maskPrompt?: string;
  worldBookPrompt?: string;
};

export type CharacterScopedMemory = {
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
};

export type SceneScopedSignals = {
  recentCoupleSpaceSummary?: string;
};

export type UserGlobalContext = {
  userName?: string;
};

export type ChatRecentContext = {
  shortTermSummary?: string;
  recentCoupleSpaceSummary?: string;
};

export type RelationshipProjection = {
  characterScopedMemory: CharacterScopedMemory;
  sceneScopedSignals: SceneScopedSignals;
};
