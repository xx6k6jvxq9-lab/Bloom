import type { ApiConfig, Character, Mask, WorldBookEntry } from '../../types';
import type { DreamDepth, DreamDomainId, DreamEntryMode, DreamTagCategory } from '../../components/dream/types';

export type DreamSelection = {
  entryMode: DreamEntryMode;
  domainId: DreamDomainId;
  depth: DreamDepth;
  selectedTags: Record<DreamTagCategory, string[]>;
};

export type DreamGeneratedChoice = {
  id: string;
  title: string;
  direction: string;
  detail: string;
  reactionHint: string;
  emotion: string;
};

export type DreamCustomChoice = {
  id: 'custom-input';
  title: '自定义描述';
  placeholder: string;
  guidance: string;
};

export type DreamRuntimeChoiceSet = {
  generated: [DreamGeneratedChoice, DreamGeneratedChoice, DreamGeneratedChoice];
  custom: DreamCustomChoice;
};

export type DreamRuntimeAct = {
  id: string;
  label: string;
  scene: string;
  charState: string;
  choiceSet: DreamRuntimeChoiceSet;
};

export type DreamEndingInput = {
  titlePoolKey: string;
  endingDirection: string;
  keyActionSummary: string;
};

export type DreamAftermathInput = {
  relationshipShift: string;
  toneDrift: string;
  messagePreviewDirection: string;
};

export type DreamRuntimeScenario = {
  id: string;
  coverTitle: string;
  coverSubtitle: string;
  confirmHint: string;
  acts: DreamRuntimeAct[];
  endingInput: DreamEndingInput;
  aftermathInput: DreamAftermathInput;
};

export type GenerateDreamScenarioOptions = {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBooks: WorldBookEntry[];
  selection: DreamSelection;
};
