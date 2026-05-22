import type { Character } from '../../types';
import type { MemoryContextInput } from '../ai/prompts/character/memoryContext';
import type { MomentPostMode } from './postBlueprints';

export type MomentFactRiskCategory =
  | 'workline'
  | 'schoolline'
  | 'residence'
  | 'family'
  | 'pet'
  | 'stable_supporting_cast';

export type MomentFactBoundary = {
  promptLines: string[];
  supportedRiskCategories: MomentFactRiskCategory[];
};

export type MomentFactBoundaryViolation = {
  blockedCategories: MomentFactRiskCategory[];
  reason: string;
  rewriteHints: string[];
};

export type MomentFactBoundarySoftCorrection = {
  content: string;
  changed: boolean;
  strategy: 'pass_through' | 'softened' | 'trimmed' | 'failed';
  remainingViolation: MomentFactBoundaryViolation | null;
};

type BuildMomentFactBoundaryOptions = {
  character: Character;
  memoryContext?: MemoryContextInput;
  mode: MomentPostMode;
};

type RiskCategoryRule = {
  id: MomentFactRiskCategory;
  label: string;
  evidencePattern: RegExp;
  contentPattern: RegExp;
  blockedSummary: string;
};

type SofteningRule = {
  pattern: RegExp;
  replace: string;
};

const RISK_CATEGORY_RULES: RiskCategoryRule[] = [
  {
    id: 'workline',
    label: '固定工作/实习线',
    evidencePattern: /工作|上班|下班|加班|收工|实习|兼职|公司|办公室|工位|开会|排班|客户|报表|职场|律所|门店|值班/i,
    contentPattern: /上班|下班|加班|收工|实习|兼职|公司|办公室|工位|开会|排班|客户|报表|值班/i,
    blockedSummary: '凭空新增了固定工作/实习线。',
  },
  {
    id: 'schoolline',
    label: '固定学校/校园线',
    evidencePattern: /学生|大一|大二|大三|大四|研一|研二|学校|学院|专业|课程|选课|期末|论文|答辩|实验室|导师|社团|宿舍/i,
    contentPattern: /学校|学院|专业|课程|选课|期末|论文|答辩|实验室|教室|宿舍/i,
    blockedSummary: '凭空新增了固定学校/校园线。',
  },
  {
    id: 'residence',
    label: '固定住处/室友线',
    evidencePattern: /室友|合租|寝室|宿舍|房东|租房|公寓|独居/i,
    contentPattern: /室友|合租|寝室|房东|租房|公寓/i,
    blockedSummary: '凭空新增了固定住处或室友线。',
  },
  {
    id: 'family',
    label: '家庭成员线',
    evidencePattern: /妈妈|爸爸|父母|家人|哥哥|姐姐|弟弟|妹妹|爷爷|奶奶|外婆|外公/i,
    contentPattern: /妈妈|爸爸|父母|家人|哥哥|姐姐|弟弟|妹妹|爷爷|奶奶|外婆|外公/i,
    blockedSummary: '凭空新增了家庭成员线。',
  },
  {
    id: 'pet',
    label: '固定宠物线',
    evidencePattern: /宠物|我家猫|我家狗|养猫|养狗|遛狗|铲屎|猫粮|狗粮/i,
    contentPattern: /我家猫|我家狗|宠物|养猫|养狗|遛狗|铲屎|猫粮|狗粮/i,
    blockedSummary: '凭空新增了固定宠物线。',
  },
  {
    id: 'stable_supporting_cast',
    label: '结构性稳定配角',
    evidencePattern: /室友|同事|我老板|导师|学长|学姐|队友|搭子|组长|经理|店长|甲方|乙方|客户|前辈|后辈/i,
    contentPattern: /室友|同事|我老板|导师|学长|学姐|队友|搭子|组长|经理|店长|甲方|乙方|客户|前辈|后辈/i,
    blockedSummary: '凭空新增了结构性稳定配角。',
  },
];

const SOFTENING_RULES: SofteningRule[] = [
  { pattern: /我老板/g, replace: '有人' },
  { pattern: /同事|导师|学长|学姐|队友|搭子|组长|经理|店长|前辈|后辈|老板/g, replace: '有人' },
  { pattern: /室友|房东/g, replace: '有人' },
  { pattern: /公司楼下|公司门口/g, replace: '楼下' },
  { pattern: /办公室|公司|工位|会议室|开会/g, replace: '这边' },
  { pattern: /下班/g, replace: '忙完' },
  { pattern: /上班/g, replace: '在忙' },
  { pattern: /实习|兼职/g, replace: '这阵子在忙的事' },
  { pattern: /值班|排班|报表/g, replace: '手边这点事' },
  { pattern: /客户|甲方|乙方/g, replace: '那边的人' },
  { pattern: /学校|学院|专业|课程|选课|期末|论文|答辩|实验室|教室/g, replace: '这边' },
  { pattern: /宿舍|寝室|合租|公寓|租房/g, replace: '房间' },
  { pattern: /妈妈|爸爸|父母|家人|哥哥|姐姐|弟弟|妹妹|爷爷|奶奶|外婆|外公/g, replace: '有人' },
  { pattern: /我家猫|我家狗/g, replace: '那只小家伙' },
  { pattern: /宠物/g, replace: '那只小家伙' },
  { pattern: /养猫|养狗/g, replace: '照顾那只小家伙' },
  { pattern: /遛狗/g, replace: '出门走一圈' },
  { pattern: /铲屎/g, replace: '收拾一下' },
  { pattern: /猫粮|狗粮/g, replace: '手边的东西' },
];

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\r/g, '').replace(/\s+/g, ' ').trim();
  return normalized ? normalized : undefined;
}

function trimFactLine(value: string | undefined, maxChars = 72): string | undefined {
  if (!value) return undefined;
  return value.length > maxChars ? `${value.slice(0, maxChars).trim()}...` : value;
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function normalizeSoftenedContent(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/([，。！？!?；;])\1+/g, '$1')
    .replace(/(^|[，。！？!?；;\n])\s+/g, '$1')
    .replace(/\s+([，。！？!?；;])/g, '$1')
    .replace(/有人有人/g, '有人')
    .replace(/这边这边/g, '这边')
    .trim();
}

function splitSentences(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/([。！？!?；;]+)/g, '$1\n')
    .split(/\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function collectBoundaryEvidence(options: BuildMomentFactBoundaryOptions) {
  const { character, memoryContext } = options;
  const currentTimeline = normalizeOptionalText(character.activeDatingState?.summary)
    || normalizeOptionalText(character.activeDatingState?.sceneProgressSummary)
    || normalizeOptionalText(character.sharedState?.currentActivity)
    || normalizeOptionalText(character.sharedState?.attentionNote);
  const publicCarryover = normalizeOptionalText(character.sharedState?.publicCarryover);
  const recentLifeBeat = normalizeOptionalText(character.presenceState?.recentLifeBeat);
  const sceneLines = [
    currentTimeline,
    publicCarryover,
    recentLifeBeat,
  ]
    .map((line) => normalizeOptionalText(line))
    .filter((line): line is string => Boolean(line));

  const stableLines = [
    character.corePersona,
    character.setting,
    character.extendedLore,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
    memoryContext?.longTermMemoryProfile,
    memoryContext?.sharedCharacterStatePrompt,
    memoryContext?.shortTermSummary,
    memoryContext?.perceptionPrompt,
  ]
    .map((line) => normalizeOptionalText(line))
    .filter((line): line is string => Boolean(line));

  return {
    currentTimeline,
    publicCarryover,
    recentLifeBeat,
    sceneLines,
    stableLines,
    combinedEvidence: [...sceneLines, ...stableLines].join('\n'),
  };
}

function buildKnownFactLines(options: {
  currentTimeline?: string;
  publicCarryover?: string;
  recentLifeBeat?: string;
  supportedCategoryLabels: string[];
}) {
  const lines = [
    options.currentTimeline ? `当前时间线：${trimFactLine(options.currentTimeline)}` : '',
    options.publicCarryover ? `当前公开余波：${trimFactLine(options.publicCarryover)}` : '',
    options.recentLifeBeat ? `最近生活节奏：${trimFactLine(options.recentLifeBeat)}` : '',
    options.supportedCategoryLabels.length > 0
      ? `已有来源明确支持的稳定生活线：${options.supportedCategoryLabels.join('、')}。只有这些类型可以继续展开。`
      : '当前没有足够证据支撑新的固定工作、学校、住处、家庭、宠物或结构性稳定配角。',
  ].filter(Boolean);

  return uniqueLines(lines);
}

export function buildMomentFactBoundary(options: BuildMomentFactBoundaryOptions): MomentFactBoundary {
  const evidence = collectBoundaryEvidence(options);
  const supportedRiskCategories = RISK_CATEGORY_RULES
    .filter((rule) => rule.evidencePattern.test(evidence.combinedEvidence))
    .map((rule) => rule.id);
  const supportedCategoryLabels = RISK_CATEGORY_RULES
    .filter((rule) => supportedRiskCategories.includes(rule.id))
    .map((rule) => rule.label);
  const knownFactLines = buildKnownFactLines({
    currentTimeline: evidence.currentTimeline,
    publicCarryover: evidence.publicCarryover,
    recentLifeBeat: evidence.recentLifeBeat,
    supportedCategoryLabels,
  });

  return {
    supportedRiskCategories,
    promptLines: [
      '事实来源优先级：当前场景 > 已写回共享状态/近期记忆 > 角色设定与长期设定 > 模型自由补充。',
      '没有来源的事实一律视为“未知”，不是“不存在”；可以不写，但不要硬补成稳定设定。',
      ...knownFactLines,
      '安全扩写：允许补物件、环境、天气、身体状态、穿着、桌面、镜子、灯光、路上、饮料、耳机和微习惯。',
      '一次性扩写：允许一闪而过的小事件、路人、店员、司机、排队的人，或一个模糊的“朋友/熟人/有人”，但必须匿名、低信息量、不命名，也不要把它写成固定关系主线。',
      '高风险扩写：新的固定职业/学校/住处/家庭结构/宠物/室友/同事/导师/长期副业/稳定社交圈，只有在已有来源明确支持时才允许出现。',
      '如果事实不够，就退回低风险锚点，不要为了真实感临时开出一条新人生线。',
    ],
  };
}

export function validateMomentFactBoundaryDelta(options: {
  content: string;
  boundary: MomentFactBoundary;
}): MomentFactBoundaryViolation | null {
  const normalized = normalizeOptionalText(options.content);
  if (!normalized) {
    return null;
  }

  const blockedRules = RISK_CATEGORY_RULES.filter((rule) => (
    !options.boundary.supportedRiskCategories.includes(rule.id)
    && rule.contentPattern.test(normalized)
  ));

  if (blockedRules.length === 0) {
    return null;
  }

  const labels = blockedRules.map((rule) => rule.label);

  return {
    blockedCategories: blockedRules.map((rule) => rule.id),
    reason: blockedRules.map((rule) => rule.blockedSummary).join(' '),
    rewriteHints: [
      `上一版凭空新增了这些高风险稳定事实：${labels.join('、')}。`,
      '重写时不要补新的固定职业、学校、住处、家庭、宠物或结构性稳定配角。',
      '如果需要生活感，只能补低风险锚点，或者一个匿名、一次性的模糊路人/朋友影子。',
    ],
  };
}

export function buildMomentFactBoundarySection(boundary: MomentFactBoundary): string[] {
  return boundary.promptLines;
}

export function softlyCorrectMomentFactBoundaryDelta(options: {
  content: string;
  boundary: MomentFactBoundary;
  violation?: MomentFactBoundaryViolation | null;
}): MomentFactBoundarySoftCorrection {
  const original = normalizeOptionalText(options.content);
  if (!original) {
    return {
      content: '',
      changed: false,
      strategy: 'failed',
      remainingViolation: options.violation || null,
    };
  }

  const initialViolation = options.violation ?? validateMomentFactBoundaryDelta({
    content: original,
    boundary: options.boundary,
  });

  if (!initialViolation) {
    return {
      content: original,
      changed: false,
      strategy: 'pass_through',
      remainingViolation: null,
    };
  }

  let softened = original;
  for (const rule of SOFTENING_RULES) {
    softened = softened.replace(rule.pattern, rule.replace);
  }
  softened = normalizeSoftenedContent(softened);

  let remainingViolation = validateMomentFactBoundaryDelta({
    content: softened,
    boundary: options.boundary,
  });

  if (!remainingViolation) {
    return {
      content: softened,
      changed: softened !== original,
      strategy: softened === original ? 'pass_through' : 'softened',
      remainingViolation: null,
    };
  }

  const trimmedSentences = splitSentences(softened).filter((sentence) => !validateMomentFactBoundaryDelta({
    content: sentence,
    boundary: options.boundary,
  }));
  const trimmed = normalizeSoftenedContent(trimmedSentences.join(' '));

  if (trimmed) {
    remainingViolation = validateMomentFactBoundaryDelta({
      content: trimmed,
      boundary: options.boundary,
    });

    if (!remainingViolation) {
      return {
        content: trimmed,
        changed: trimmed !== original,
        strategy: 'trimmed',
        remainingViolation: null,
      };
    }
  }

  return {
    content: softened || original,
    changed: softened !== original,
    strategy: 'failed',
    remainingViolation,
  };
}
