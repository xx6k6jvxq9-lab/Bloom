import type {
  DreamAftermathInput,
  DreamEndingInput,
  DreamPresentation,
  DreamRuntimeScenario,
  DreamSelection,
  DreamStoryFrame,
} from './dreamRuntimeTypes';
import { buildPresentation, sanitizeCustomAct, sanitizeCustomStoryFrame, toAct, type RawChoice } from './dreamRuntimeNormalize';
import { hydrateDreamRuntimeScenario } from './dreamRuntimeSummaries';
import type { DreamDepth, DreamDomainId, DreamEntryMode } from '../../components/dream/types';

type CompactRawAct = {
  id?: string;
  label?: string;
  scene?: string;
  sceneParagraphs?: unknown;
  charState?: string;
  choices?: unknown;
  progression?: unknown;
};

export type CompactRawScenario = {
  coverTitle?: string;
  coverSubtitle?: string;
  confirmHint?: string;
  storyFrame?: unknown;
  acts?: unknown;
  endingInput?: unknown;
  aftermathInput?: unknown;
};

export type CompactDreamScenarioResult = {
  parsed: CompactRawScenario | null;
  runtimeScenario: DreamRuntimeScenario | null;
  issues: string[];
  issueDetails: CompactDreamScenarioIssue[];
  repairIssueCount: number;
  qualityIssueCount: number;
  needsRepair: boolean;
  isValid: boolean;
};

export type CompactDreamScenarioIssueSeverity = 'repair' | 'quality';

export type CompactDreamScenarioIssue = {
  code:
    | 'parse_failed'
    | 'missing_cover_title'
    | 'missing_confirm_hint'
    | 'acts_count_mismatch'
    | 'act_missing_label'
    | 'act_paragraphs_short'
    | 'act_scene_too_short'
    | 'act_choices_count_mismatch'
    | 'act_choice_field_empty';
  severity: CompactDreamScenarioIssueSeverity;
  message: string;
  actIndex?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pickText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderChoiceTitle(value: string) {
  const normalized = value.trim();
  if (!normalized) return true;
  return /^\[?待定\]?$/u.test(normalized) || /^选项\s*\d+$/u.test(normalized);
}

function repairCommonJsonIssues(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(
      /(^\s*"[^"\r\n]+"\s*:\s*"[^"\r\n\\]*(?:\\.[^"\r\n\\]*)*)(?=,\s*$)/gm,
      '$1"',
    );
}

function stripCodeFence(raw: string) {
  return raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
}

function extractLikelyJsonObject(raw: string) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return '';
  return raw.slice(start, end + 1);
}

function tryParseJson(raw: string): unknown | null {
  const candidates = [raw, repairCommonJsonIssues(raw)];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

function unwrapScenarioRecord(parsed: unknown): CompactRawScenario | null {
  if (!isRecord(parsed)) return null;
  if (Array.isArray(parsed.acts)) return parsed as CompactRawScenario;

  const nestedKeys = ['scenario', 'result', 'data', 'payload'];
  for (const key of nestedKeys) {
    const candidate = Reflect.get(parsed, key);
    if (isRecord(candidate) && Array.isArray(Reflect.get(candidate, 'acts'))) {
      return candidate as CompactRawScenario;
    }
  }

  return parsed as CompactRawScenario;
}

export function parseCompactDreamScenario(raw: string): CompactRawScenario | null {
  const cleaned = stripCodeFence(raw);
  const extracted = extractLikelyJsonObject(cleaned);
  const candidates = [cleaned, extracted].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    const unwrapped = unwrapScenarioRecord(parsed);
    if (unwrapped) return unwrapped;
  }

  return null;
}

function splitSceneIntoParagraphs(scene: string) {
  const direct = scene
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (direct.length > 1) return direct;

  const sentences = scene
    .replace(/([。！？!?]+)/gu, '$1\n')
    .split(/\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [];

  const paragraphs: string[] = [];
  let current = '';

  sentences.forEach((sentence) => {
    if ((current + sentence).length > 120 && current) {
      paragraphs.push(current.trim());
      current = sentence;
      return;
    }
    current += sentence;
  });

  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs;
}

function normalizeParagraphs(rawParagraphs: unknown, fallbackScene: string) {
  const paragraphs = Array.isArray(rawParagraphs)
    ? rawParagraphs
      .map((paragraph) => pickText(paragraph))
      .filter(Boolean)
    : [];

  if (paragraphs.length > 0) return paragraphs;
  return fallbackScene ? splitSceneIntoParagraphs(fallbackScene) : [];
}

function normalizeChoices(rawChoices: unknown): RawChoice[] {
  if (!Array.isArray(rawChoices)) return [];

  return rawChoices
    .slice(0, 3)
    .map((choice) => {
      if (!isRecord(choice)) return {};
      return {
        id: pickText(choice.id),
        title: pickText(choice.title),
        direction: pickText(choice.direction),
        detail: pickText(choice.detail),
        reactionHint: pickText(choice.reactionHint),
        storyPush: pickText(choice.storyPush),
        emotion: pickText(choice.emotion),
      };
    });
}

function normalizeProgression(rawProgression: unknown) {
  if (!isRecord(rawProgression)) {
    return {
      consequence: '',
      plotAdvance: '',
      tensionShift: '',
    };
  }

  return {
    consequence: pickText(rawProgression.consequence),
    plotAdvance: pickText(rawProgression.plotAdvance),
    tensionShift: pickText(rawProgression.tensionShift),
  };
}

function normalizeAct(rawAct: unknown): CompactRawAct {
  if (!isRecord(rawAct)) {
    return {};
  }

  return {
    id: pickText(rawAct.id),
    label: pickText(rawAct.label),
    scene: pickText(rawAct.scene),
    sceneParagraphs: Reflect.get(rawAct, 'sceneParagraphs'),
    charState: pickText(rawAct.charState),
    choices: Reflect.get(rawAct, 'choices'),
    progression: Reflect.get(rawAct, 'progression'),
  };
}

function normalizeStoryFrame(rawStoryFrame: unknown): Partial<DreamStoryFrame> {
  if (!isRecord(rawStoryFrame)) return {};
  return {
    worldTitle: pickText(rawStoryFrame.worldTitle),
    worldSummary: pickText(rawStoryFrame.worldSummary),
    userDreamIdentity: pickText(rawStoryFrame.userDreamIdentity),
    characterDreamIdentity: pickText(rawStoryFrame.characterDreamIdentity),
    dreamRelationship: pickText(rawStoryFrame.dreamRelationship),
    openingNode: pickText(rawStoryFrame.openingNode),
    storyObjective: pickText(rawStoryFrame.storyObjective),
    coreConflict: pickText(rawStoryFrame.coreConflict),
    realityAnchor: pickText(rawStoryFrame.realityAnchor),
    timeNode: pickText(rawStoryFrame.timeNode),
    currentCrisis: pickText(rawStoryFrame.currentCrisis),
    forbiddenRule: pickText(rawStoryFrame.forbiddenRule),
    immediateGoal: pickText(rawStoryFrame.immediateGoal),
  };
}

function normalizeEndingInput(rawEndingInput: unknown): Partial<DreamEndingInput> {
  if (!isRecord(rawEndingInput)) return {};
  return {
    titlePoolKey: pickText(rawEndingInput.titlePoolKey),
    endingDirection: pickText(rawEndingInput.endingDirection),
    keyActionSummary: pickText(rawEndingInput.keyActionSummary),
  };
}

function normalizeAftermathInput(rawAftermathInput: unknown): Partial<DreamAftermathInput> {
  if (!isRecord(rawAftermathInput)) return {};
  return {
    relationshipShift: pickText(rawAftermathInput.relationshipShift),
    toneDrift: pickText(rawAftermathInput.toneDrift),
    messagePreviewDirection: pickText(rawAftermathInput.messagePreviewDirection),
  };
}

export function validateCompactDreamScenario(parsed: CompactRawScenario | null, expectedActs: number) {
  const issues: CompactDreamScenarioIssue[] = [];
  const addIssue = (
    severity: CompactDreamScenarioIssueSeverity,
    code: CompactDreamScenarioIssue['code'],
    message: string,
    actIndex?: number,
  ) => {
    issues.push({ severity, code, message, actIndex });
  };

  if (!parsed) {
    addIssue('repair', 'parse_failed', '无法解析模型返回的 JSON。');
    return issues;
  }

  const acts = Array.isArray(parsed.acts) ? parsed.acts.map((act) => normalizeAct(act)) : [];

  if (!pickText(parsed.coverTitle)) addIssue('quality', 'missing_cover_title', '缺少 coverTitle。');
  if (!pickText(parsed.confirmHint)) addIssue('quality', 'missing_confirm_hint', '缺少 confirmHint。');
  if (acts.length !== expectedActs) addIssue('repair', 'acts_count_mismatch', `acts 数量不是 ${expectedActs}。`);

  acts.forEach((act, index) => {
    const scene = pickText(act.scene);
    const paragraphs = normalizeParagraphs(act.sceneParagraphs, scene);
    const choices = normalizeChoices(act.choices);
    const sceneText = paragraphs.join('');

    if (!pickText(act.label)) addIssue('quality', 'act_missing_label', `第 ${index + 1} 幕缺少 label。`, index);
    if (paragraphs.length < 3) addIssue('repair', 'act_paragraphs_short', `第 ${index + 1} 幕分段不足。`, index);
    if (sceneText.length < 280) addIssue('quality', 'act_scene_too_short', `第 ${index + 1} 幕正文过短。`, index);
    if (choices.length !== 3) {
      addIssue('repair', 'act_choices_count_mismatch', `第 ${index + 1} 幕选项数量不是 3 个。`, index);
    } else if (choices.some((choice) => {
      const title = pickText(choice.title);
      return isPlaceholderChoiceTitle(title) || !pickText(choice.detail) || !pickText(choice.direction);
    })) {
      addIssue('repair', 'act_choice_field_empty', `第 ${index + 1} 幕存在空选项字段或占位选项。`, index);
    }
  });

  return issues;
}

export function compactScenarioToRuntimeScenario(args: {
  parsed: CompactRawScenario | null;
  selection: DreamSelection;
  expectedActs: number;
  seed: string;
  depth: DreamDepth;
  entryMode: DreamEntryMode;
  domainId: DreamDomainId;
}) {
  if (!args.parsed) return null;

  const presentation: DreamPresentation = buildPresentation(args.seed);
  const acts = Array.isArray(args.parsed.acts) ? args.parsed.acts.map((act) => normalizeAct(act)) : [];
  const storyFrame = normalizeStoryFrame(args.parsed.storyFrame);
  const endingInput = normalizeEndingInput(args.parsed.endingInput);
  const aftermathInput = normalizeAftermathInput(args.parsed.aftermathInput);

  const normalizedActs = Array.from({ length: args.expectedActs }, (_, index) => {
    const rawAct = acts[index] || {};
    const scene = pickText(rawAct.scene);
    const paragraphs = normalizeParagraphs(rawAct.sceneParagraphs, scene);
    const mergedScene = paragraphs.join('\n\n') || scene;

    return sanitizeCustomAct(
      toAct(
        {
          id: rawAct.id,
          label: rawAct.label,
          scene: mergedScene,
          charState: rawAct.charState,
          choices: normalizeChoices(rawAct.choices),
          progression: normalizeProgression(rawAct.progression),
        },
        index,
        presentation,
      ),
      args.selection,
    );
  });

  const normalizedStoryFrame = sanitizeCustomStoryFrame({
    worldTitle: storyFrame.worldTitle?.trim() || '',
    worldSummary: storyFrame.worldSummary?.trim() || '',
    userDreamIdentity: storyFrame.userDreamIdentity?.trim() || '',
    characterDreamIdentity: storyFrame.characterDreamIdentity?.trim() || '',
    dreamRelationship: storyFrame.dreamRelationship?.trim() || '',
    openingNode: storyFrame.openingNode?.trim() || '',
    storyObjective: storyFrame.storyObjective?.trim() || '',
    coreConflict: storyFrame.coreConflict?.trim() || '',
    realityAnchor: storyFrame.realityAnchor?.trim() || '',
    timeNode: storyFrame.timeNode?.trim() || '',
    currentCrisis: storyFrame.currentCrisis?.trim() || '',
    forbiddenRule: storyFrame.forbiddenRule?.trim() || '',
    immediateGoal: storyFrame.immediateGoal?.trim() || '',
  }, args.selection);

  return hydrateDreamRuntimeScenario({
    id: `dream-${args.domainId}-${args.depth}-${Date.now()}`,
    coverTitle: pickText(args.parsed.coverTitle) || '今夜',
    coverSubtitle: pickText(args.parsed.coverSubtitle),
    confirmHint: pickText(args.parsed.confirmHint),
    depth: args.depth,
    entryMode: args.entryMode,
    domainId: args.domainId,
    storyFrame: normalizedStoryFrame,
    presentation,
    acts: normalizedActs,
    decisionTrail: [],
    endingInput: {
      titlePoolKey: endingInput.titlePoolKey?.trim() || 'default',
      endingDirection: endingInput.endingDirection?.trim() || '',
      keyActionSummary: endingInput.keyActionSummary?.trim() || '',
    },
    aftermathInput: {
      relationshipShift: aftermathInput.relationshipShift?.trim() || '',
      toneDrift: aftermathInput.toneDrift?.trim() || '',
      messagePreviewDirection: aftermathInput.messagePreviewDirection?.trim() || '',
    },
  });
}

export function parseCompactDreamScenarioResult(args: {
  raw: string;
  selection: DreamSelection;
  expectedActs: number;
  seed: string;
  depth: DreamDepth;
  entryMode: DreamEntryMode;
  domainId: DreamDomainId;
}): CompactDreamScenarioResult {
  const parsed = parseCompactDreamScenario(args.raw);
  const issueDetails = validateCompactDreamScenario(parsed, args.expectedActs);
  const issues = issueDetails.map((issue) => issue.message);
  const repairIssueCount = issueDetails.filter((issue) => issue.severity === 'repair').length;
  const qualityIssueCount = issueDetails.filter((issue) => issue.severity === 'quality').length;
  const runtimeScenario = compactScenarioToRuntimeScenario({
    parsed,
    selection: args.selection,
    expectedActs: args.expectedActs,
    seed: args.seed,
    depth: args.depth,
    entryMode: args.entryMode,
    domainId: args.domainId,
  });

  return {
    parsed,
    runtimeScenario,
    issues,
    issueDetails,
    repairIssueCount,
    qualityIssueCount,
    needsRepair: repairIssueCount > 0,
    isValid: Boolean(parsed) && issueDetails.length === 0,
  };
}
