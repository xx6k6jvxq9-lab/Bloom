import type { ChatMessage } from '../../types';

type DirectSceneProgressTag =
  | 'close_pull'
  | 'cling_attention'
  | 'tease_push'
  | 'comfort_care'
  | 'jealousy_claim'
  | 'guarded_distance'
  | 'practical_followthrough'
  | 'daily_presence'
  | 'general_presence';

type DirectSceneActionDefinition = {
  tag: DirectSceneProgressTag;
  label: string;
  stage: string;
  pattern: RegExp;
  nextStepHints: string[];
};

export type DirectSceneProgress = {
  currentStage: string;
  recentSignature: string;
  previousSignature?: string;
  repeatedSignature: boolean;
  repeatedMoveLabels: string[];
  userRetriggeredSamePoint: boolean;
  nextStepHints: string[];
  latestAssistantPreview?: string;
  previousAssistantPreview?: string;
};

const ACTION_DEFINITIONS: DirectSceneActionDefinition[] = [
  {
    tag: 'close_pull',
    label: '靠近试探',
    stage: '正在往更近的互动推进',
    pattern: /(过来|靠近|来我这|来这边|抱|亲|贴过来|摸摸|凑近|来给我)/u,
    nextStepHints: [
      '让靠近落到新的态度变化、边界确认或情绪波动，不要只重复同一句拉近。',
      '如果还想继续逼近，给这次逼近一个新的落点，比如试探、命令、嘴硬松口或故意停顿。',
    ],
  },
  {
    tag: 'cling_attention',
    label: '索要回应',
    stage: '在黏着、催回应、确认对方有没有把自己放在心上',
    pattern: /(理我|别不理我|看看我|看我|等你|想你|摸摸我|你是不是不要我了|别装没看见我)/u,
    nextStepHints: [
      '继续索要回应也可以，但要让这次更像有意图的逼近、委屈或试探，而不是原句复读。',
      '把催回应推进成新的情绪落点，比如赌气、装乖、得寸进尺、嘴硬后松口。',
    ],
  },
  {
    tag: 'tease_push',
    label: '嘴硬逗回',
    stage: '在一边逗一边顶、一边接一边不承认',
    pattern: /(笑什么|还笑|装什么|少来|就这|行啊|逗你|嘴硬|你再说一遍|谁理你)/u,
    nextStepHints: [
      '如果继续顶回去，让这次多一点新的试探、补刀或松动，不要只是同一句式换词。',
      '允许继续嘴硬，但最好让嘴硬后面的在意更往前露一点。',
    ],
  },
  {
    tag: 'comfort_care',
    label: '安抚照顾',
    stage: '在接住情绪、照顾状态或把人往稳处放',
    pattern: /(别怕|没事|我在|慢慢来|先休息|先睡|不哭|抱抱|我陪你|缓一缓)/u,
    nextStepHints: [
      '继续安抚可以，但别每轮都用同一种安慰模板；换成更贴人设的照顾方式。',
      '如果这轮还要稳住对方，优先用这个角色自己的手感去照顾，而不是标准客服安慰句。',
    ],
  },
  {
    tag: 'jealousy_claim',
    label: '在意占位',
    stage: '在吃醋、偏心、护短或半公开占位',
    pattern: /(吃醋|偏心|只准|我的|别看别人|别理别人|宣示主权|护短)/u,
    nextStepHints: [
      '如果继续占位，给这次占位一个新动作：暗示、阴阳、挑明、装作不在意后补刀。',
      '不要只是反复说“我的”或“别理别人”，要让占位带着新的态度变化。',
    ],
  },
  {
    tag: 'guarded_distance',
    label: '收着回避',
    stage: '在压着不让关系一下子滑过去',
    pattern: /(别闹|先这样|不聊这个|不行|算了|到此为止|别靠太近|别越线)/u,
    nextStepHints: [
      '继续收着可以，但别只是机械挡回去；让收着里带一点新的观察、迟疑或松动。',
      '如果这轮还不想放人进来，换个更像活人的拦法，而不是反复同一句堵门。',
    ],
  },
  {
    tag: 'practical_followthrough',
    label: '动作落地',
    stage: '在把承诺、安排或动作真的往下落实',
    pattern: /(我来处理|我去弄|已经给你|安排好了|我去接|给你转|等我一下|马上来)/u,
    nextStepHints: [
      '既然已经在落地动作，下一步更适合补动作后的态度，而不是重复口头答应。',
      '不要每轮都只说“我来”或“等我”，让动作真的往后推进一点。',
    ],
  },
  {
    tag: 'daily_presence',
    label: '生活接续',
    stage: '在带着自己的日常状态顺手接话',
    pattern: /(刚忙完|在忙|在路上|刚回来|刚醒|在看|在收拾|刚处理完)/u,
    nextStepHints: [
      '日常状态可以继续带着走，但别一直只报状态；把状态接到关系或当下话题上。',
      '如果还想保持生活感，给这次上线一个新的接话点，不要连续几轮都只是“刚忙完”。',
    ],
  },
];

const USER_REPEAT_PERMISSION_PATTERN = /(再说|再来|继续|就这样|多来点|你再|再叫一遍|还要|继续这个)/u;

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

function compactText(value: string, maxLength = 72): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return '';
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getVisibleMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => !message.isSystem && !message.isRecalled && normalizeOptionalText(message.text));
}

function getAssistantReplies(messages: ChatMessage[]): ChatMessage[] {
  return getVisibleMessages(messages).filter((message) => message.role === 'model');
}

function extractTags(text: string): DirectSceneProgressTag[] {
  const normalized = normalizeOptionalText(text);
  if (!normalized) {
    return ['general_presence'];
  }

  const matched = ACTION_DEFINITIONS
    .filter((definition) => definition.pattern.test(normalized))
    .map((definition) => definition.tag);

  return matched.length > 0 ? [...new Set(matched)] : ['general_presence'];
}

function getDefinition(tag: DirectSceneProgressTag): DirectSceneActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((definition) => definition.tag === tag);
}

function getTagLabels(tags: DirectSceneProgressTag[]): string[] {
  return tags
    .map((tag) => getDefinition(tag)?.label || (tag === 'general_presence' ? '顺手接话' : ''))
    .filter(Boolean);
}

function buildSignature(tags: DirectSceneProgressTag[]): string {
  return getTagLabels(tags).slice(0, 3).join(' / ');
}

function inferStage(tags: DirectSceneProgressTag[]): string {
  const priority: DirectSceneProgressTag[] = [
    'jealousy_claim',
    'close_pull',
    'cling_attention',
    'comfort_care',
    'guarded_distance',
    'tease_push',
    'practical_followthrough',
    'daily_presence',
    'general_presence',
  ];

  const hit = priority.find((tag) => tags.includes(tag));
  if (!hit || hit === 'general_presence') {
    return '在顺手接住当前聊天，但还没有明显换轨';
  }

  return getDefinition(hit)?.stage || '在顺手接住当前聊天';
}

function buildNextStepHints(tags: DirectSceneProgressTag[], repeatedSignature: boolean): string[] {
  const hints = [...new Set(tags.flatMap((tag) => getDefinition(tag)?.nextStepHints || []))].filter(Boolean);

  if (hints.length > 0) {
    return hints.slice(0, repeatedSignature ? 3 : 2);
  }

  return [
    '允许继续保持这个角色的手感，但别只复述上一轮已经用过的那一下。',
    '如果这轮还想重复同一招，至少让重复带一个新的情绪落点或关系动作。',
  ].slice(0, repeatedSignature ? 2 : 1);
}

function didUserRetriggerSamePoint(latestUserText: string | undefined, tags: DirectSceneProgressTag[]): boolean {
  const normalized = normalizeOptionalText(latestUserText);
  if (!normalized) {
    return false;
  }

  if (USER_REPEAT_PERMISSION_PATTERN.test(normalized)) {
    return true;
  }

  return tags.some((tag) => {
    const definition = getDefinition(tag);
    return !!definition?.pattern.test(normalized);
  });
}

export function buildDirectSceneProgress(messages: ChatMessage[], latestUserText?: string): DirectSceneProgress | null {
  const assistantReplies = getAssistantReplies(messages).slice(-3);
  const latestReply = assistantReplies[assistantReplies.length - 1];
  const previousReply = assistantReplies.length > 1 ? assistantReplies[assistantReplies.length - 2] : undefined;

  if (!latestReply?.text?.trim()) {
    return null;
  }

  const latestTags = extractTags(latestReply.text);
  const previousTags = previousReply?.text?.trim() ? extractTags(previousReply.text) : [];
  const recentSignature = buildSignature(latestTags) || '顺手接话';
  const previousSignature = previousTags.length > 0 ? buildSignature(previousTags) || '顺手接话' : undefined;
  const repeatedSignature = !!previousSignature && previousSignature === recentSignature;
  const previousTagSet = new Set(previousTags);
  const repeatedMoveLabels = getTagLabels(latestTags.filter((tag) => previousTagSet.has(tag)));

  return {
    currentStage: inferStage(latestTags),
    recentSignature,
    previousSignature,
    repeatedSignature,
    repeatedMoveLabels,
    userRetriggeredSamePoint: didUserRetriggerSamePoint(latestUserText, latestTags),
    nextStepHints: buildNextStepHints(latestTags, repeatedSignature),
    latestAssistantPreview: compactText(latestReply.text),
    previousAssistantPreview: previousReply?.text?.trim() ? compactText(previousReply.text) : undefined,
  };
}

export function formatDirectSceneProgressForPrompt(progress: DirectSceneProgress | null): string {
  if (!progress) {
    return '';
  }

  const lines = [
    '## 单聊推进状态',
    `[当前推进阶段] ${progress.currentStage}`,
    `[最近一次推进方式] ${progress.recentSignature}`,
    progress.previousSignature ? `[上一轮推进方式] ${progress.previousSignature}` : '',
    progress.latestAssistantPreview ? `[最近一次回复预览] ${progress.latestAssistantPreview}` : '',
    progress.previousAssistantPreview ? `[上一轮回复预览] ${progress.previousAssistantPreview}` : '',
    progress.repeatedSignature
      ? `[本轮重复提醒] 你最近已经连续两轮都在用「${progress.recentSignature}」推进。${progress.userRetriggeredSamePoint
        ? '用户这轮还在拱同一个点，允许继续延续，但要让重复像故意施压、撒娇、逗回、回声式逼近或嘴硬松口，不要只是原样复述。'
        : '除非这就是角色本人故意施压、撒娇、回声式逼近、占位或复读口癖，否则不要把上一招原样再来一遍。'}`
      : '',
    progress.repeatedMoveLabels.length > 0
      ? ['[最近重复出现的推进动作]', ...progress.repeatedMoveLabels.map((label) => `- ${label}`)].join('\n')
      : '',
    '[允许的人设复读] 口癖、称呼、故意复读、压迫式回声、撒娇式连着要回应都可以保留；只要这个重复带着新的情绪、态度、停顿、轻重或落点，就不算空转。',
    progress.nextStepHints.length > 0
      ? ['[下一步更自然的推进方向]', ...progress.nextStepHints.map((hint) => `- ${hint}`)].join('\n')
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}
