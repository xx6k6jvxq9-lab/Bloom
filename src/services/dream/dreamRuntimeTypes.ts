import type { DreamNarrativeDocument } from './dreamNarrativeSchema';
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
  storyPush: string;
  emotion: string;
};

export type DreamContinuationChoice = DreamGeneratedChoice & {
  reaction?: string;
  fromCustom?: boolean;
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

export type DreamActProgression = {
  consequence: string;
  plotAdvance: string;
  tensionShift: string;
};

export type DreamRuntimeAct = {
  id: string;
  label: string;
  scene: string;
  charState: string;
  beatSummary?: string;
  narrative: DreamNarrativeDocument;
  choiceSet: DreamRuntimeChoiceSet;
  progression: DreamActProgression;
};

export type DreamStoryFrame = {
  worldTitle: string;
  worldSummary: string;
  userDreamIdentity: string;
  characterDreamIdentity: string;
  dreamRelationship: string;
  openingNode: string;
  storyObjective: string;
  coreConflict: string;
  realityAnchor: string;
  timeNode: string;
  currentCrisis: string;
  forbiddenRule: string;
  immediateGoal: string;
};

export type DreamPresentation = {
  themeId: string;
  themeName: string;
  accent: string;
  accentSoft: string;
  dialogueText: string;
  frameBorder: string;
  frameFill: string;
  layoutId: string;
  layoutName: string;
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

export type DreamEndingOutput = {
  title: string;
  body: string;
  excerpt: string;
  chapter: string;
};

export type DreamAftermathOutput = {
  summary: string;
  detail: string;
  previewMessages: [string, string];
};

export type DreamDecisionRecord = {
  actId: string;
  actLabel: string;
  choiceId: string;
  title: string;
  direction: string;
  detail: string;
  reaction: string;
  storyPush: string;
  emotion: string;
  fromCustom?: boolean;
};

export type DreamRuntimeScenario = {
  id: string;
  coverTitle: string;
  coverSubtitle: string;
  confirmHint: string;
  depth: DreamDepth;
  entryMode: DreamEntryMode;
  domainId: DreamDomainId;
  storyFrame: DreamStoryFrame;
  presentation: DreamPresentation;
  memorySummary?: string;
  acts: DreamRuntimeAct[];
  decisionTrail: DreamDecisionRecord[];
  endingInput: DreamEndingInput;
  endingOutput?: DreamEndingOutput;
  aftermathInput: DreamAftermathInput;
  aftermathOutput?: DreamAftermathOutput;
};

export type GenerateDreamScenarioOptions = {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBooks: WorldBookEntry[];
  selection: DreamSelection;
};

export type DreamContinuationMode = 'custom' | 'deeper' | 'deep-end';

export type GenerateDreamContinuationOptions = GenerateDreamScenarioOptions & {
  scenario: DreamRuntimeScenario;
  actIndex: number;
  mode: DreamContinuationMode;
  userInput?: string;
  selectedChoice?: DreamContinuationChoice | null;
};

export type DreamContinuationPayload = {
  reactionText?: string;
  emotion?: string;
  storyPush?: string;
  nextAct?: DreamRuntimeAct;
  nextActs?: DreamRuntimeAct[];
  finalAct?: DreamRuntimeAct;
  endingInput?: DreamEndingInput;
  aftermathInput?: DreamAftermathInput;
};
