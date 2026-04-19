export type DreamEntryMode = 'quick' | 'custom' | 'character';

export type DreamDomainId = 'crowd' | 'threshold' | 'shared' | 'rift';

export type DreamDepth = 'shallow' | 'deep';

export type DreamTagCategory =
  | 'world'
  | 'genre'
  | 'tension'
  | 'drive'
  | 'mood'
  | 'climate'
  | 'participants'
  | 'faction'
  | 'camp'
  | 'identity'
  | 'lead'
  | 'intensity'
  | 'interaction'
  | 'ending';

export type DreamChoice = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  reaction: string;
  emotion: string;
};

export type DreamAct = {
  id: string;
  label: string;
  scene: string;
  charState: string;
  choices: DreamChoice[];
};

export type DreamEnding = {
  title: string;
  excerpt: string;
  signature: string;
  chapter: string;
};

export type DreamAftermath = {
  summary: string;
  detail: string;
  previewMessages: [string, string];
};

export type DreamScenario = {
  id: string;
  heroName: string;
  heroGlyph: string;
  heroStatus: string;
  availableLine: string;
  expireLine: string;
  coverTitle: string;
  coverSubtitle: string;
  confirmHint: string;
  acts: DreamAct[];
  ending: DreamEnding;
  aftermath: DreamAftermath;
};

export type DreamDomain = {
  id: DreamDomainId;
  name: string;
  subtitle: string;
  description: string;
  icon: 'sparkles' | 'scan' | 'heart' | 'coffee';
};

export type DreamTagOption = {
  id: string;
  label: string;
};

export type DreamTagGroup = {
  category: DreamTagCategory;
  label: string;
  max: number;
  options: DreamTagOption[];
  detailed?: boolean;
};
