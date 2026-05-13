import type { DateMessage, DateSession, DatingGeneratedContent } from '../../types';

type SceneActionTag =
  | 'close_distance'
  | 'eye_contact'
  | 'teasing'
  | 'pause_tension'
  | 'touch_probe'
  | 'hand_hold'
  | 'embrace'
  | 'memory_callback'
  | 'care_support'
  | 'confession_edge'
  | 'jealousy_probe'
  | 'farewell_hesitation'
  | 'general_progress';

type ActionDefinition = {
  tag: SceneActionTag;
  label: string;
  stage: string;
  pattern: RegExp;
  nextStepOptions: string[];
};

export type DatingSceneProgress = {
  currentBeat: string;
  stageLabel: string;
  completedActions: string[];
  bannedRepeatActions: string[];
  unresolvedTension?: string;
  nextStepOptions: string[];
  currentSignature: string;
  previousSignature?: string;
  repeatedSignature: boolean;
};

const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    tag: 'close_distance',
    label: '靠近',
    stage: '试探靠近阶段',
    pattern: /(靠近|凑近|贴近|挨近|俯身|前倾|向你靠过去|缩短距离)/,
    nextStepOptions: [
      '把靠近后的反应落到新的对白上',
      '让角色对用户这轮反馈做出新回应',
      '把气氛推进成态度变化，不要只重复靠近',
    ],
  },
  {
    tag: 'eye_contact',
    label: '对视',
    stage: '试探靠近阶段',
    pattern: /(对视|目光|视线|眼神|看着你|盯着你|移不开眼)/,
    nextStepOptions: [
      '让对视后的态度发生一点变化',
      '把停顿推进成一句更具体的话',
      '不要只重复看着对方不动',
    ],
  },
  {
    tag: 'teasing',
    label: '试探逗弄',
    stage: '暧昧拉扯阶段',
    pattern: /(逗你|逗了逗|调侃|揶揄|嘴硬|故意|轻笑了一声|哼笑|拿你打趣)/,
    nextStepOptions: [
      '让玩笑后出现一点认真',
      '把逗弄转成新的态度表露',
      '不要只重复嘴硬和揶揄',
    ],
  },
  {
    tag: 'pause_tension',
    label: '停顿拉扯',
    stage: '暧昧拉扯阶段',
    pattern: /(停顿|顿了顿|沉默了|没立刻|呼吸一滞|僵了|停在|欲言又止|卡住了半秒)/,
    nextStepOptions: [
      '让停顿之后真的出现一个新选择',
      '把拉扯推进到回应，不要只反复停住',
      '让情绪变化落地成动作或表态',
    ],
  },
  {
    tag: 'touch_probe',
    label: '指尖接触',
    stage: '试探靠近阶段',
    pattern: /(伸手|手指|碰了碰|触到|指尖|手腕|衣角|掠过|碰上你的手)/,
    nextStepOptions: [
      '把试探接触后的反应写出来',
      '转成对白或态度变化，不要重复同一种触碰',
      '让角色确认或收回一步新的边界感',
    ],
  },
  {
    tag: 'hand_hold',
    label: '牵手',
    stage: '身体靠近阶段',
    pattern: /(牵住|牵起|十指|扣住你的手|握住你的手|手心贴上|掌心相贴)/,
    nextStepOptions: [
      '把牵手后的心态变化写出来',
      '转成情绪确认或边界确认',
      '不要继续重复同一种牵手动作',
    ],
  },
  {
    tag: 'embrace',
    label: '拥抱',
    stage: '身体靠近阶段',
    pattern: /(抱住|拥住|揽进怀里|环住|搂住|圈进怀里)/,
    nextStepOptions: [
      '把拥抱后的情绪反应落地',
      '转成更细的态度变化或收束',
      '不要继续重复同一种拥抱动作',
    ],
  },
  {
    tag: 'memory_callback',
    label: '回钩旧话题',
    stage: '暧昧拉扯阶段',
    pattern: /(上次|之前|那天|还记得|又提起|旧梗|以前说过|先前提过)/,
    nextStepOptions: [
      '把旧话题转成新的推进点',
      '不要只重复回钩同一个梗',
      '让回忆真正影响这轮选择',
    ],
  },
  {
    tag: 'care_support',
    label: '照顾关心',
    stage: '关心升温阶段',
    pattern: /(照顾|护着|替你|递给你|问你冷不冷|替你整理|放轻语气|让你先|迁就你)/,
    nextStepOptions: [
      '让关心之后出现新的关系表态',
      '把照顾落到更具体的互动变化',
      '不要只重复同一种关心动作',
    ],
  },
  {
    tag: 'confession_edge',
    label: '关系挑明',
    stage: '态度挑明阶段',
    pattern: /(喜欢你|心动|说出口|告白|承认|偏爱|舍不得否认|不想骗你)/,
    nextStepOptions: [
      '让挑明后的回应更清楚一点',
      '推进到态度确认，不要只停在含混边缘',
      '把关系变化落到新的互动选择',
    ],
  },
  {
    tag: 'jealousy_probe',
    label: '在意试探',
    stage: '暧昧拉扯阶段',
    pattern: /(吃醋|酸|在意|别和他|别和别人|有点介意|装作不在意)/,
    nextStepOptions: [
      '让在意后出现更明确的态度变化',
      '不要只重复酸一下又收回去',
      '把试探推进成新的关系表态',
    ],
  },
  {
    tag: 'farewell_hesitation',
    label: '道别前迟疑',
    stage: '收束前拉扯阶段',
    pattern: /(送你|舍不得|不想放开|临走|道别|转身前|还没松开|走之前)/,
    nextStepOptions: [
      '把迟疑推进成最后一个新动作点',
      '让收束前的情绪变化更明确',
      '不要只反复写舍不得和回头',
    ],
  },
];

const TENSION_PATTERNS: Array<{ pattern: RegExp; template: string }> = [
  { pattern: /(没说出口|说不出口|咽回去)/, template: '还有一句没真正说出口的话卡着。' },
  { pattern: /(忍住|克制|按住)/, template: '角色还在压着一点想继续靠近的冲动。' },
  { pattern: /(装作|假装|嘴硬)/, template: '表面态度和真实情绪之间还有落差。' },
  { pattern: /(不确定|迟疑|犹豫)/, template: '角色还没完全确认下一步该怎么迈出去。' },
  { pattern: /(没躲开|没有躲开|没有抽回)/, template: '边界已经松了一点，但还没有真正说开。' },
];

function normalizeText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function compactText(value: string, maxChars: number): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  if (maxChars <= 1) {
    return normalized.slice(0, maxChars);
  }

  return `${normalized.slice(0, maxChars - 1)}...`;
}

function collectGeneratedRounds(session: Pick<DateSession, 'messages' | 'generatedContent'>): DatingGeneratedContent[] {
  const rounds = (session.messages || [])
    .filter((message): message is DateMessage & { generatedContent: DatingGeneratedContent } => Boolean(message.generatedContent))
    .map((message) => message.generatedContent);

  if (rounds.length > 0) {
    return rounds;
  }

  return session.generatedContent ? [session.generatedContent] : [];
}

function buildNarrativeText(content: DatingGeneratedContent | undefined): string {
  if (!content) {
    return '';
  }

  return normalizeText(content.narrative.segments.map((segment) => segment.text).join(' '));
}

function extractActionTags(text: string): SceneActionTag[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const tags = ACTION_DEFINITIONS
    .filter((definition) => definition.pattern.test(normalized))
    .map((definition) => definition.tag);

  return tags.length > 0 ? [...new Set(tags)] : ['general_progress'];
}

function getDefinition(tag: SceneActionTag): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((definition) => definition.tag === tag);
}

function getActionLabels(tags: SceneActionTag[]): string[] {
  return tags
    .map((tag) => getDefinition(tag)?.label || (tag === 'general_progress' ? '气氛推进' : ''))
    .filter(Boolean);
}

function buildSignature(tags: SceneActionTag[]): string {
  if (tags.length === 0) {
    return '';
  }

  const labels = getActionLabels(tags);
  if (labels.length === 0) {
    return '';
  }

  return labels.slice(0, 3).join(' / ');
}

function inferStageLabel(tags: SceneActionTag[]): string {
  const priority: SceneActionTag[] = [
    'embrace',
    'hand_hold',
    'confession_edge',
    'touch_probe',
    'close_distance',
    'teasing',
    'pause_tension',
    'care_support',
    'memory_callback',
    'jealousy_probe',
    'farewell_hesitation',
    'eye_contact',
  ];

  const hit = priority.find((tag) => tags.includes(tag));
  if (!hit) {
    return '气氛推进阶段';
  }

  return getDefinition(hit)?.stage || '气氛推进阶段';
}

function buildCurrentBeat(content: DatingGeneratedContent | undefined): string {
  if (!content) {
    return '';
  }

  const recentSegments = content.narrative.segments
    .slice(-2)
    .map((segment) => segment.text)
    .filter(Boolean)
    .join(' ');
  const fromSegments = compactText(recentSegments, 96);
  if (fromSegments) {
    return fromSegments;
  }

  return compactText(content.status.innerThought || content.status.mood, 96);
}

function inferUnresolvedTension(
  latestText: string,
  innerThought: string,
  repeatedSignature: boolean,
): string | undefined {
  const combined = normalizeText([latestText, innerThought].filter(Boolean).join(' '));
  for (const entry of TENSION_PATTERNS) {
    if (entry.pattern.test(combined)) {
      return entry.template;
    }
  }

  if (repeatedSignature) {
    return '上一轮的试探已经发生过了，这一轮需要换一种推进方式，不能继续原地打转。';
  }

  return undefined;
}

function buildNextStepOptions(tags: SceneActionTag[], repeatedSignature: boolean): string[] {
  const options = tags.flatMap((tag) => getDefinition(tag)?.nextStepOptions || []);
  const unique = [...new Set(options)].filter(Boolean);

  if (unique.length > 0) {
    if (repeatedSignature) {
      return unique.slice(0, 3);
    }
    return unique.slice(0, 2);
  }

  return [
    '推进一个新的动作点',
    '让角色明确一点新的态度变化',
    '不要只重复上一轮的气氛描写',
  ].slice(0, repeatedSignature ? 3 : 2);
}

export function buildDatingSceneProgress(
  session: Pick<DateSession, 'messages' | 'generatedContent'>,
): DatingSceneProgress {
  const rounds = collectGeneratedRounds(session);
  const latestRound = rounds[rounds.length - 1];
  const previousRound = rounds.length > 1 ? rounds[rounds.length - 2] : undefined;
  const latestText = buildNarrativeText(latestRound);
  const previousText = buildNarrativeText(previousRound);
  const latestTags = extractActionTags(latestText);
  const previousTags = extractActionTags(previousText);
  const currentSignature = buildSignature(latestTags);
  const previousSignature = buildSignature(previousTags) || undefined;
  const repeatedSignature = !!currentSignature && !!previousSignature && currentSignature === previousSignature;
  const previousTagSet = new Set(previousTags);
  const repeatedActionLabels = getActionLabels(
    latestTags.filter((tag) => previousTagSet.has(tag)),
  );
  const completedActions = getActionLabels(latestTags).slice(0, 4);
  const bannedRepeatActions = repeatedSignature
    ? completedActions
    : repeatedActionLabels;

  return {
    currentBeat: buildCurrentBeat(latestRound),
    stageLabel: inferStageLabel(latestTags),
    completedActions,
    bannedRepeatActions,
    unresolvedTension: inferUnresolvedTension(
      latestText,
      latestRound?.status.innerThought || '',
      repeatedSignature,
    ),
    nextStepOptions: buildNextStepOptions(latestTags, repeatedSignature),
    currentSignature,
    previousSignature,
    repeatedSignature,
  };
}

export function buildDatingSceneProgressSummary(progress: DatingSceneProgress): string {
  const pieces = [
    progress.stageLabel ? `当前阶段：${progress.stageLabel}` : '',
    progress.currentSignature ? `最近推进：${progress.currentSignature}` : '',
    progress.bannedRepeatActions.length > 0
      ? `不要重复：${progress.bannedRepeatActions.join('、')}`
      : '',
    progress.unresolvedTension || '',
  ].filter(Boolean);

  return pieces.join('；');
}

export function formatDatingSceneProgressForPrompt(progress: DatingSceneProgress): string {
  const lines = [
    '## Scene Progress',
    progress.stageLabel ? `[当前阶段] ${progress.stageLabel}` : '',
    progress.currentBeat ? `[当前推进到] ${progress.currentBeat}` : '',
    progress.currentSignature ? `[本轮推进签名] ${progress.currentSignature}` : '',
    progress.previousSignature ? `[上一轮推进签名] ${progress.previousSignature}` : '',
    progress.completedActions.length > 0
      ? ['[已完成动作]', ...progress.completedActions.map((action) => `- ${action}`)].join('\n')
      : '',
    progress.bannedRepeatActions.length > 0
      ? ['[本轮禁止重复]', ...progress.bannedRepeatActions.map((action) => `- ${action}`)].join('\n')
      : '',
    progress.unresolvedTension ? `[未解决张力] ${progress.unresolvedTension}` : '',
    progress.nextStepOptions.length > 0
      ? ['[优先推进方向]', ...progress.nextStepOptions.map((option) => `- ${option}`)].join('\n')
      : '',
    progress.repeatedSignature
      ? '[强约束] 上一轮和当前轮的推进签名重复了，这一轮必须换一种推进方式，不要重复同一种靠近、停顿、对视或旧话题回钩。'
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}
