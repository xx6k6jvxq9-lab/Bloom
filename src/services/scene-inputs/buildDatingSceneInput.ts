import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildTemporalContextPrompt } from '../relationship-time/buildTemporalContextPrompt';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';
import { buildSharedCharacterState } from '../relationship-context/buildSharedCharacterState';
import { buildCharacterTemporalState } from '../relationship-time/buildCharacterTemporalState';
import {
  buildDatingSceneProgress,
  buildDatingSceneProgressSummary,
  formatDatingSceneProgressForPrompt,
} from '../dating/buildDatingSceneProgress';
import {
  buildMemoryPromptView,
  buildMemoryRetrievalPromptFromView,
  type MemoryPromptView,
  type MemoryPromptQueryText,
} from '../memory/buildMemoryRetrievalPrompt';
import { buildDirectPersonaGuide } from '../ai/prompts/character/buildDirectPersonaGuide';
import { recordMemoryReadDiagnostic } from '../memory/memoryDiagnostics';
import { compressShortTermSummaryAfterLongTerm } from '../memory/buildShortTermSummary';
import {
  compileSpecialDirective,
  type CompiledSpecialDirective,
} from '../special-directives/compileSpecialDirective';
import type {
  Character,
  ChatHistory,
  ChatMessage,
  DateDescriptionDensity,
  DateDialogueFormat,
  DatingPageEpisodeType,
  DateNarrativePerspective,
  DateRelationshipStageOverride,
  DateWritingReference,
  DateWritingPreset,
  DateSession,
  Mask,
  PerceptionSettings,
  UserProfileExtended,
  WorldBookEntry,
} from '../../types';
import { selectActiveCharacterWorldBooks } from '../world-book/worldBookAccess';
import type { MemoryContextInput } from '../ai/prompts/character/memoryContext';
import type { ReplyLanguagePolicyInput } from '../ai/prompts/base/languageRules';
import type { ChatRecentContext } from '../relationship-context/types';

export type DatingSceneOutputMode = 'scene' | 'page_episode';

export type DatingPageEpisodeIntent = {
  pageType: DatingPageEpisodeType;
  platform?: CompiledSpecialDirective['platform'];
  outputKind?: CompiledSpecialDirective['outputKind'];
  statusBarMode: CompiledSpecialDirective['chrome']['statusBarMode'];
  statusBarInstruction?: string;
  canonMode: CompiledSpecialDirective['writebackPolicy'];
};

export type DatingSceneInput = {
  mode: 'start' | 'continue';
  outputMode?: DatingSceneOutputMode;
  specialDirectivePlan?: CompiledSpecialDirective;
  pagePromptContext?: {
    directReplyConfig?: {
      minReplies?: number;
      maxReplies?: number;
    };
    languagePolicy?: ReplyLanguagePolicyInput;
    memoryContext?: MemoryContextInput;
    recentContext?: ChatRecentContext & { retrievedMemory?: MemoryPromptView };
  };
  pageEpisodeIntent?: DatingPageEpisodeIntent;
  pageEpisodeInstructionBlock?: string;
  characterName: string;
  corePersona: string;
  signature?: string;
  openingRemark?: string;
  personaGuidePrompt?: string;
  maskPrompt?: string;
  worldBookPrompt?: string;
  userName: string;
  location?: string;
  scenario?: string;
  mood?: string;
  narrativePerspective?: DateNarrativePerspective;
  writingPreset?: DateWritingPreset;
  writingReference?: DateWritingReference;
  dialogueFormat?: DateDialogueFormat;
  descriptionDensity?: DateDescriptionDensity;
  writingStyleCustom?: string;
  backgroundRule: string;
  relationshipBaselineBlock?: string;
  directorInstructionBlock?: string;
  pastChatContext: string;
  datingMessages: string;
  sceneProgress: string;
  currentGeneratedStatus: string;
  currentGeneratedPlaylist: string;
  task: string;
  sections: string[];
};

type BuildDatingSceneInputOptions = {
  mode: 'start' | 'continue';
  character: Character;
  userProfile: UserProfileExtended;
  session: DateSession;
  chatHistory: ChatMessage[];
  activeMask?: Mask | null;
  worldBooks?: WorldBookEntry[];
  perception?: PerceptionSettings;
  latestUserInput?: string;
  directorMode?: 'rewrite' | 'next_round';
  directorInstructionOverride?: string;
};

const DATING_PROMPT_BUDGET = {
  maxPastChatMessages: 12,
  maxPastChatChars: 2200,
  maxPastChatLineChars: 180,
  maxDatingMessages: 8,
  maxDatingChars: 2600,
  maxDatingLineChars: 260,
  maxNarrativeSegments: 6,
  maxNarrativeChars: 2400,
  maxNarrativeLineChars: 240,
  maxStatusFieldChars: 120,
  maxPlaylistItems: 3,
  maxPlaylistNoteChars: 90,
  maxSectionChars: 1200,
  maxSections: 7,
  maxCorePersonaChars: 2000,
  maxSignatureChars: 120,
  maxTaskChars: 320,
  maxStyleCustomChars: 240,
} as const;

type DatingRelationshipBaselineLevel = 'careful' | 'growing' | 'intimate';

const EXPLICIT_INTIMATE_RELATION_REGEX = /情侣|恋人|爱人|已经在一起|确认关系|稳定亲密|亲密关系|公开在一起|热恋|成人亲密|nsfw|接吻|吻过|睡在一起|发生过亲密行为/u;
const GROWING_INTIMACY_REGEX = /暧昧|喜欢|想你|心动|偏爱|依赖|在意|吃醋|靠近|抱抱|牵手|拥抱|舍不得|告白|试探/u;
const DIRECT_CHAT_AFFECTION_REGEX = /宝贝|宝宝|亲爱的|想你|想见你|喜欢你|爱你|抱抱|亲亲|乖|吻/u;

function normalizeInlineText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDirectiveText(value: string | null | undefined): string {
  return (value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function truncateFromStart(value: string | null | undefined, maxChars: number): string {
  const normalized = (value || '').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 1) return normalized.slice(0, maxChars);
  return `${normalized.slice(0, maxChars - 1)}…`;
}

function countPatternHits(text: string, pattern: RegExp): number {
  if (!text.trim()) {
    return 0;
  }

  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return text.match(new RegExp(pattern.source, flags))?.length ?? 0;
}

function collectRecentDirectChatText(chatHistory: ChatMessage[], maxMessages = 8): string {
  return chatHistory
    .filter((message) => !message.isSystem && !message.isRecalled && normalizeInlineText(message.text))
    .slice(-maxMessages)
    .map((message) => normalizeInlineText(message.text))
    .filter(Boolean)
    .join('\n');
}

function inferDatingRelationshipBaselineLevel(input: {
  longTermMemoryProfile?: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
  recentCoupleSpaceSummary?: string;
  chatHistory: ChatMessage[];
  relationshipStageOverride?: DateRelationshipStageOverride;
}): DatingRelationshipBaselineLevel {
  if (input.relationshipStageOverride && input.relationshipStageOverride !== 'auto') {
    return input.relationshipStageOverride;
  }

  const recentDirectChatText = collectRecentDirectChatText(input.chatHistory);
  const combinedText = [
    input.longTermMemoryProfile,
    input.shortTermSummary,
    input.sharedRecentRelationshipSummary,
    input.recentCoupleSpaceSummary,
    recentDirectChatText,
  ]
    .map((value) => normalizeInlineText(value))
    .filter(Boolean)
    .join('\n');

  const intimateHits = countPatternHits(combinedText, EXPLICIT_INTIMATE_RELATION_REGEX);
  const growingHits = countPatternHits(combinedText, GROWING_INTIMACY_REGEX);
  const directAffectionHits = countPatternHits(recentDirectChatText, DIRECT_CHAT_AFFECTION_REGEX);

  if (normalizeInlineText(input.recentCoupleSpaceSummary) || intimateHits > 0 || directAffectionHits >= 3) {
    return 'intimate';
  }

  if (growingHits > 0 || directAffectionHits > 0) {
    return 'growing';
  }

  return 'careful';
}

function buildRelationshipBaselineBlock(input: {
  level: DatingRelationshipBaselineLevel;
  userName: string;
  characterName: string;
  manualOverride?: DateRelationshipStageOverride;
  allowAdultIntimacy?: boolean;
}): string {
  const overrideLine = input.manualOverride && input.manualOverride !== 'auto'
    ? `[手动关系阶段覆盖] 当前约会按「${
        input.manualOverride === 'intimate'
          ? '已成立亲密关系'
          : input.manualOverride === 'growing'
            ? '持续升温 / 暧昧基础'
            : '谨慎关系基线'
      }」处理。这是导演手动指定的关系基线，不要再往回降。`
    : '';
  const adultLine = input.allowAdultIntimacy
    ? '[成人亲密允许] 当前约会允许更开放的成人亲密表达，不要因为通用保守模板自动收住。是否写到这一步，仍要服从角色人设、用户当前输入和当轮气氛。'
    : '';

  switch (input.level) {
    case 'intimate':
      return [
        '## 当前关系基线',
        overrideLine,
        `[已成立关系基线] ${input.characterName} 和 ${input.userName} 当前已经是明确成立的亲密关系，不是刚开始试探，也不是线下见面后要重新从生疏写起。`,
        '[硬约束] 不要因为“线下约会”场景，或因为本轮推进里出现了“靠近 / 对视 / 停顿”这类节奏标签，就把你们整体关系降回初识、浅暧昧或不敢碰的状态。',
        '[亲密表达] 只要符合角色人设、边界、用户当前输入和这轮气氛，动作与回应都不需要被场景格式自动降级；包括更开放的成人亲密表达在内，也不是被这个场景默认禁止。',
        adultLine,
      ].filter(Boolean).join('\n');
    case 'growing':
      return [
        '## 当前关系基线',
        overrideLine,
        `[已成立关系基线] ${input.characterName} 和 ${input.userName} 当前已经不止是普通客套，关系里有持续升温、偏爱、拉扯或暧昧基础。`,
        '[硬约束] 不要把整体关系写回陌生试探或客服式礼貌。即使本轮节奏偏停顿、嘴硬或拉扯，也要保留已经成立的熟悉感和靠近感。',
        '[亲密表达] 是否进一步靠近，取决于角色本人、当前输入和这轮气氛；但这段关系不该被无故写冷。',
        adultLine,
      ].filter(Boolean).join('\n');
    case 'careful':
    default:
      return [
        '## 当前关系基线',
        overrideLine,
        `[已成立关系基线] ${input.characterName} 和 ${input.userName} 当前仍应按更谨慎的关系底色处理。`,
        '[硬约束] 可以有靠近、拉扯、试探或突然变热的事件，但不要把个别动作直接写成已经稳定亲密的长期关系结论。',
        adultLine,
      ].filter(Boolean).join('\n');
  }
}

function describeCompiledDirective(plan: CompiledSpecialDirective | undefined): string {
  if (!plan) {
    return '';
  }

  switch (plan.outputKind) {
    case 'platform_page':
      switch (plan.platform) {
        case 'wechat':
          return '微信聊天页面番外';
        case 'moments':
          return '朋友圈页面番外';
        case 'weibo':
          return '微博页面番外';
        case 'xiaohongshu':
          return '小红书页面番外';
        case 'netease':
          return '网易云页面番外';
        case 'survey':
          return '问卷页面番外';
        case 'campus':
          return '校园页面番外';
        default:
          return '平台页面番外';
      }
    case 'micro_app':
      return '互动小模块番外';
    case 'custom_html':
      return '自定义 HTML 页面番外';
    case 'narrative_episode':
    default:
      return '剧情番外';
  }
}

function buildCompiledDirectiveLines(plan: CompiledSpecialDirective | undefined): string[] {
  if (!plan) {
    return [];
  }

  return [
    `[统一指令路由] ${plan.outputKind}${plan.platform ? ` / ${plan.platform}` : ''}`,
    plan.sceneHandling === 'pause_mainline'
      ? '[主线处理] 本次先暂停当前主线，按受控番外分支执行。'
      : '[主线处理] 本次不强制暂停主线，可作为当前链路内的特殊生成要求。',
    plan.eventPlan.length > 0
      ? ['[高优先级事件骨架]', ...plan.eventPlan.map((line) => `- ${line}`)].join('\n')
      : '',
    plan.hardConstraints.length > 0
      ? ['[高优先级结构限制]', ...plan.hardConstraints.map((line) => `- ${line}`)].join('\n')
      : '',
    plan.softPreferences.length > 0
      ? [
          '[低优先级风格偏好]',
          '下面这些只在不违背角色原设时才允许少量采用，不能为了它们把角色写成另一个人：',
          ...plan.softPreferences.map((line) => `- ${line}`),
        ].join('\n')
      : '',
  ].filter(Boolean);
}

function buildDirectorInstructionBlock(
  value: string | undefined,
  mode?: 'rewrite' | 'next_round',
  plan?: CompiledSpecialDirective | null,
): string {
  const normalized = normalizeDirectiveText(value);
  if (!normalized) {
    return '';
  }

  return [
    '## 导演额外指令',
    mode === 'rewrite'
      ? '本轮首要任务不是默认续写，而是按这条导演指令重写当前轮。'
      : mode === 'next_round'
        ? '本轮首要任务不是按默认主线惯性继续，而是先执行这条导演指令来生成下一轮。'
        : '这是用户当前手动输入的导演指令。只要不违背角色设定、硬边界和当前世界观，就把它当成高优先级剧情指令来执行，而不只是轻量参考。',
    '如果导演指令和默认主线续写冲突，以导演指令为准；允许暂停当前主线、切去番外 / 平行线 / 独立小剧场，但仍要保持角色人设、关系基线与可解析输出结构。',
    '导演指令主要决定事件骨架、页面形式、输出长度和额外限制，不负责重写角色灵魂；如果导演要求的语气、浓度、幽默感、直白度和角色原设冲突，永远先保住角色本人。',
    ...buildCompiledDirectiveLines(plan || undefined),
    `[原始导演指令]\n${normalized}`,
  ].join('\n');
}

function buildPageEpisodeInstructionBlock(plan: CompiledSpecialDirective | undefined): string {
  if (!plan || !plan.pageType) {
    return '';
  }

  const pageTypeLabel = describeCompiledDirective(plan);
  const canonLabel = plan.writebackPolicy === 'mainline' ? '允许把这次页面内容并入主线。' : '默认作为番外，不主动写回主线。';
  const statusBarLabel = plan.chrome.statusBarMode === 'hidden'
    ? '隐藏状态栏'
    : plan.chrome.statusBarMode === 'custom'
      ? `自定义状态栏${plan.chrome.statusBarInstruction ? `：${plan.chrome.statusBarInstruction}` : ''}`
      : '自动状态栏';
  const customHtmlLines = plan.pageType === 'micro_app' || plan.pageType === 'custom_html'
    ? [
        '如果是 micro_app / custom_html，首屏必须直接可见，不要整页只有背景、空壳容器或必须点很多次才出现正文。',
        '至少给出一个明确根容器、一个主要视觉区、一个可操作控件和一个操作后的反馈区；点击或切换后要看得出状态变化。',
        '不要把整页内容塞进一大段说明文；把标题、说明、状态、按钮、反馈节点拆开，像一个真的可玩的页面。',
        '优先用内联 script 驱动少量清晰交互，不要只摆静态 div 假装是模块。',
      ]
    : [];

  return [
    '## 页面番外输出模式',
    `本轮输出协议切换为 \`page_episode\`，页面类型按 \`${plan.pageType}\` 处理。`,
    `页面类型：${pageTypeLabel}`,
    `主线归属：${canonLabel}`,
    `状态栏：${statusBarLabel}`,
    '导演指令只决定这次番外发生什么、页面长什么样，不决定角色要变成另一个人；语气、边界、攻击性、克制感、嘴硬程度、冷暖质地都必须优先服从角色原设。',
    '如果导演要求的是多条动态、多条朋友圈、多条微博或多条小红书，不要把 5 条内容编号塞进一个 body；要拆成 `pageEpisode.feed.items` 里的多条独立动态卡片。',
    '如果平台是微博 / 小红书 / 网易云 / 校园墙，优先把标题、来源、地点、标签这些平台字段拆出来，不要全糊进正文。',
    '微博默认按“主页资料区 + 下面动态流”来写；除微信和朋友圈外，社交媒体页默认要有网友评论，如果用户要求评论条数就补足对应数量。',
    '如果是微博 / 小红书 / 网易云 / 校园墙这类社交媒体页，不要只给一条孤零零正文，默认带出网友评论区。',
    ...customHtmlLines,
    ...buildCompiledDirectiveLines(plan),
    '当前 user 和 char 的头像、昵称、备注名由前端自动注入；不要伪造图片外链、base64 头像或网页资源地址。',
    '页面里的每一条消息、系统提示、撤回提示或转账卡片都必须服务剧情推进，不能只做空壳 UI。',
    '页面之外仍要补齐 narrative / status / playlist，使这次页面番外依然能被约会系统读取为剧情。',
  ].join('\n');
}

function resolveDirectorInstruction(options: BuildDatingSceneInputOptions): string {
  return normalizeDirectiveText(options.directorInstructionOverride) || normalizeDirectiveText(options.session.directorInstruction);
}

function joinBudgetedLines(
  lines: string[],
  options: {
    maxLines: number;
    maxChars: number;
    maxLineChars: number;
  },
): string {
  const normalizedLines = lines
    .map((line) => truncateFromStart(normalizeInlineText(line), options.maxLineChars))
    .filter(Boolean)
    .slice(-options.maxLines);

  const selected: string[] = [];
  let usedChars = 0;

  for (let index = normalizedLines.length - 1; index >= 0; index -= 1) {
    const line = normalizedLines[index];
    const nextUsedChars = usedChars + line.length + (selected.length > 0 ? 1 : 0);
    if (nextUsedChars > options.maxChars && selected.length > 0) {
      break;
    }
    selected.unshift(line);
    usedChars = nextUsedChars;
  }

  return selected.join('\n');
}

function isImageDataValue(value: string | null | undefined): boolean {
  return /^data:image\//i.test((value || '').trim());
}

function buildBackgroundRule(session: DateSession): string {
  if (!session.backgroundImage) {
    return '本次约会背景图未单独设置，页面默认使用角色头像作为背景。不要把背景图当成文本线索。';
  }

  if (session.backgroundSource === 'local-upload') {
    return '本次约会背景图已设置为用户上传图片。页面会使用这张图片作为视觉背景，但不要把图片内容或编码文本当成剧情线索。';
  }

  if (session.backgroundSource === 'url') {
    return isImageDataValue(session.backgroundImage)
      ? '本次约会背景图已设置为外部图片资源。页面会使用这张图片作为视觉背景，但不要把图片编码文本当成剧情线索。'
      : '本次约会背景图已设置为外部图片链接。页面会使用这张图片作为视觉背景，但不要把图片链接文本当成剧情线索。';
  }

  return '本次约会背景图使用角色头像。页面会以角色头像作为视觉背景，但不要把头像地址或图片编码文本当成剧情线索。';
}

function budgetSections(sections: string[]): string[] {
  return sections
    .map((section) => truncateFromStart(section, DATING_PROMPT_BUDGET.maxSectionChars))
    .filter(Boolean)
    .slice(0, DATING_PROMPT_BUDGET.maxSections);
}

function formatPastChatContext(chatHistory: ChatMessage[], characterName: string): string {
  return joinBudgetedLines(
    chatHistory.map((message) => `${message.role === 'user' ? '用户' : characterName}：${normalizeInlineText(message.text)}`),
    {
      maxLines: DATING_PROMPT_BUDGET.maxPastChatMessages,
      maxChars: DATING_PROMPT_BUDGET.maxPastChatChars,
      maxLineChars: DATING_PROMPT_BUDGET.maxPastChatLineChars,
    },
  );
}

function formatDatingMessages(session: DateSession): string {
  return joinBudgetedLines(
    session.messages.map((message) => {
      if (message.role === 'user') {
        return `用户在约会中说：${normalizeInlineText(message.text)}`;
      }

      if (message.generatedContent && !message.isEdited) {
        const summary = message.generatedContent.narrative.segments
          .slice(-4)
          .map((segment) => normalizeInlineText(segment.text))
          .filter(Boolean)
          .join(' ');
        return `角色上一轮剧情：${summary}`;
      }

      return `角色上一轮剧情：${normalizeInlineText(message.text)}`;
    }),
    {
      maxLines: DATING_PROMPT_BUDGET.maxDatingMessages,
      maxChars: DATING_PROMPT_BUDGET.maxDatingChars,
      maxLineChars: DATING_PROMPT_BUDGET.maxDatingLineChars,
    },
  );
}

function formatCurrentGeneratedNarrative(session: DateSession): string {
  if (!session.generatedContent?.narrative?.segments?.length) {
    return '当前还没有已生成的正式约会正文。';
  }

  return joinBudgetedLines(
    session.generatedContent.narrative.segments.map((segment) => (
      `${segment.type === 'dialogue' ? '[对白]' : '[叙述]'} ${normalizeInlineText(segment.text)}`
    )),
    {
      maxLines: DATING_PROMPT_BUDGET.maxNarrativeSegments,
      maxChars: DATING_PROMPT_BUDGET.maxNarrativeChars,
      maxLineChars: DATING_PROMPT_BUDGET.maxNarrativeLineChars,
    },
  );
}

function formatCurrentGeneratedStatus(session: DateSession): string {
  if (!session.generatedContent?.status) {
    return '当前还没有已生成的状态。';
  }

  return `当前状态：
地点：${truncateFromStart(session.generatedContent.status.location, DATING_PROMPT_BUDGET.maxStatusFieldChars)}
时间：${truncateFromStart(session.generatedContent.status.time, DATING_PROMPT_BUDGET.maxStatusFieldChars)}
心情：${truncateFromStart(session.generatedContent.status.mood, DATING_PROMPT_BUDGET.maxStatusFieldChars)}
内心 OS：${truncateFromStart(session.generatedContent.status.innerThought, DATING_PROMPT_BUDGET.maxStatusFieldChars)}`;
}

function formatCurrentGeneratedPlaylist(session: DateSession): string {
  if (!session.generatedContent?.playlist?.length) {
    return '当前还没有已生成的歌单。';
  }

  return `当前歌单：
${session.generatedContent.playlist
    .slice(0, DATING_PROMPT_BUDGET.maxPlaylistItems)
    .map((song) => (
      `- ${truncateFromStart(song.title, 48)} / ${truncateFromStart(song.artist, 32)}：${truncateFromStart(song.note || '符合当前氛围', DATING_PROMPT_BUDGET.maxPlaylistNoteChars)}`
    ))
    .join('\n')}`;
}

function buildTask(options: BuildDatingSceneInputOptions): string {
  const normalizedDirectorInstruction = resolveDirectorInstruction(options);
  const compiledSpecialDirective = compileSpecialDirective(normalizedDirectorInstruction);
  const normalizedDirectorPreview = normalizeInlineText(normalizedDirectorInstruction);
  if (normalizedDirectorInstruction) {
    if (compiledSpecialDirective && compiledSpecialDirective.outputKind !== 'narrative_episode') {
      const pageTypeLabel = describeCompiledDirective(compiledSpecialDirective);
      const canonLabel = compiledSpecialDirective.writebackPolicy === 'mainline'
        ? '允许把这次页面内容并入主线。'
        : '默认把这次内容当作不主动写回主线的番外。';

      if (options.directorMode === 'rewrite') {
        return truncateFromStart(
          `当前任务：按导演指令把当前轮重写成一页${pageTypeLabel}，并同时补一段能被约会系统读取的剧情摘要。${canonLabel}
导演指令：${normalizedDirectorPreview}`,
          DATING_PROMPT_BUDGET.maxTaskChars,
        );
      }

      if (options.directorMode === 'next_round') {
        return truncateFromStart(
          `当前任务：下一轮优先生成一页${pageTypeLabel}，不要继续默认主线正文；同时补齐 narrative、status、playlist 作为剧情层。${canonLabel}
导演指令：${normalizedDirectorPreview}`,
          DATING_PROMPT_BUDGET.maxTaskChars,
        );
      }

      return truncateFromStart(
        `当前任务：优先按导演指令生成一页${pageTypeLabel}，并保留同一套人设、关系、记忆和世界书上下文。${canonLabel}
导演指令：${normalizedDirectorPreview}`,
        DATING_PROMPT_BUDGET.maxTaskChars,
      );
    }

    if (options.directorMode === 'rewrite') {
      return truncateFromStart(
        `当前任务：按导演指令重写当前轮，不要被默认主线续写惯性绑住。
导演指令：${normalizedDirectorPreview}
如果这条指令要求暂停当前主线、切出番外 / 平行线 / 独立小剧场，就优先执行它；但仍要保住角色设定、关系基线和输出结构。`,
        DATING_PROMPT_BUDGET.maxTaskChars,
      );
    }

    if (options.directorMode === 'next_round') {
      return truncateFromStart(
        `当前任务：下一轮优先执行导演指令，不要只按默认主线往下接。
导演指令：${normalizedDirectorPreview}
如果这条指令要求暂停当前主线、切出番外 / 平行线 / 独立小剧场，就先生成这条受控分支；但仍要保住角色设定、关系基线和输出结构。`,
        DATING_PROMPT_BUDGET.maxTaskChars,
      );
    }
  }

  if (options.mode === 'start') {
    return '现在请正式生成这次约会的第一轮内容。第一轮内容也必须是即时生成，不能使用默认模板文案。';
  }

  if (options.latestUserInput) {
    return truncateFromStart(
      `用户刚刚在正式约会里说了：${normalizeInlineText(options.latestUserInput)}
请从这句之后继续推进剧情，并同步更新状态与歌单。`,
      DATING_PROMPT_BUDGET.maxTaskChars,
    );
  }

  return '请基于当前保留的约会上下文继续生成后续内容。';
}

function getLatestDatingMemoryQueryText(options: BuildDatingSceneInputOptions): string | undefined {
  const normalizedLatestUserInput = normalizeInlineText(options.latestUserInput);
  if (normalizedLatestUserInput) {
    return normalizedLatestUserInput;
  }

  const latestDatingUserText = [...options.session.messages]
    .reverse()
    .find((message) => message.role === 'user' && normalizeInlineText(message.text))
    ?.text;
  const normalizedDatingUserText = normalizeInlineText(latestDatingUserText);
  if (normalizedDatingUserText) {
    return normalizedDatingUserText;
  }

  const latestDirectUserText = [...options.chatHistory]
    .reverse()
    .find((message) => message.role === 'user' && normalizeInlineText(message.text))
    ?.text;
  return normalizeInlineText(latestDirectUserText) || undefined;
}

function buildRecentDatingTranscriptQueryText(session: DateSession): string | undefined {
  const transcript = (session.messages || [])
    .slice(-6)
    .map((message) => normalizeInlineText(message.text))
    .filter(Boolean)
    .join(' ');

  return transcript.trim() || undefined;
}

function formatTypedResidueLines<T extends { summary: string }>(
  title: string,
  items: T[] | undefined,
  usageNote: string,
): string {
  const typedItems = (items || [])
    .map((item) => item.summary.trim())
    .filter(Boolean);
  if (typedItems.length === 0) {
    return '';
  }

  return [
    title,
    usageNote,
    ...typedItems.map((summary) => `- ${summary}`),
  ].join('\n');
}

function buildExtraSections(input: {
  sharedCharacterStatePrompt?: string;
  temporalContext?: string;
  maskPrompt?: string;
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  worldBookPrompt?: string;
  datingSceneHint?: string;
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
  retrievedMemoryPrompt?: string;
  relationshipResidue?: Array<{ summary: string }>;
  topicAnchors?: Array<{ summary: string }>;
  taskResidue?: Array<{ summary: string }>;
  sceneProgress?: string;
  recentCoupleSpaceSummary?: string;
  sharedRecentRelationshipSummary?: string;
}): string[] {
  return [
    input.sharedCharacterStatePrompt || '',
    input.temporalContext || '',
    input.maskPrompt ? ['## 用户当前面具设定', input.maskPrompt].join('\n') : '',
    input.expressionStyle ? ['## 表达风格与相处方式', input.expressionStyle].join('\n') : '',
    input.boundaryPack ? ['## 边界与禁区', input.boundaryPack].join('\n') : '',
    input.extendedLore ? ['## 扩展背景与长期补充', input.extendedLore].join('\n') : '',
    input.datingSceneHint ? ['## 当前约会场景补充', input.datingSceneHint].join('\n') : '',
    input.shortTermSummary ? ['## 近期关系余波', input.shortTermSummary].join('\n') : '',
    input.longTermMemoryProfile ? ['## 长期关系印象', input.longTermMemoryProfile].join('\n') : '',
    input.retrievedMemoryPrompt || '',
    formatTypedResidueLines(
      '## Typed Relationship Residue',
      input.relationshipResidue,
      '这些是最近还能影响约会语气和亲密感的关系余波。只把它们当成关系底色，不要直接改写成当前约会现场已经发生的动作。',
    ),
    formatTypedResidueLines(
      '## Typed Topic Anchors',
      input.topicAnchors,
      '这些是旧梗或旧话题锚点。只有这轮约会真的碰到时才可轻量带回，不要无缘无故自己翻旧梗。',
    ),
    formatTypedResidueLines(
      '## Typed Task Residue',
      input.taskResidue,
      '这些是仍可能算数的待办、约定或还没完全落地的事。只有当前语境相关时才轻量恢复。',
    ),
    input.recentCoupleSpaceSummary ? ['## 最近情侣空间相关痕迹', input.recentCoupleSpaceSummary].join('\n') : '',
    input.sharedRecentRelationshipSummary
      ? ['## 最近关系连续性', input.sharedRecentRelationshipSummary].join('\n')
      : '',
  ].filter(Boolean);
}

function normalizeStyleValue<T extends string>(value: T | undefined, fallback: T): T {
  return value && value !== fallback ? value : fallback;
}

export function buildDatingSceneInput(options: BuildDatingSceneInputOptions): DatingSceneInput {
  const activeWorldBooks = selectActiveCharacterWorldBooks(options.character, options.worldBooks);
  const characterContext = buildCharacterContext({
    character: options.character,
    activeMask: options.activeMask,
    activeWorldBooks,
    worldBookQuery: options.latestUserInput,
    worldBookRecentText: options.chatHistory
      .slice(-8)
      .map((message) => normalizeInlineText(message.text))
      .filter(Boolean),
  });
  const directPersonaGuide = buildDirectPersonaGuide({
    corePersona: characterContext.corePersona,
    expressionStyle: characterContext.expressionStyle,
    boundaryPack: characterContext.boundaryPack,
    extendedLore: characterContext.extendedLore,
    signature: options.character.signature,
    openingRemark: options.character.openingRemark,
  });
  const directChatHistory: ChatHistory = {
    [options.character.id]: options.chatHistory,
  };
  const relationshipProjection = buildRelationshipProjection({
    character: options.character,
    userName: options.userProfile.name,
    directMessages: options.chatHistory,
  });
  const characterTemporalState = buildCharacterTemporalState({
    characterId: options.character.id,
    perception: options.perception,
    directChatHistory,
    sceneScope: 'direct',
  });
  const sharedCharacterState = buildSharedCharacterState({
    character: options.character,
    temporalState: characterTemporalState,
    sceneScopedSignals: relationshipProjection.sceneScopedSignals,
  });
  const { characterScopedMemory, sceneScopedSignals } = relationshipProjection;
  const shortTermSummary = characterScopedMemory.longTermMemoryProfile
    ? compressShortTermSummaryAfterLongTerm(characterScopedMemory.shortTermSummary || '')
    : characterScopedMemory.shortTermSummary;
  const relationshipBaselineLevel = inferDatingRelationshipBaselineLevel({
    longTermMemoryProfile: characterScopedMemory.longTermMemoryProfile,
    shortTermSummary,
    sharedRecentRelationshipSummary: sceneScopedSignals.sharedRecentRelationshipSummary,
    recentCoupleSpaceSummary: sceneScopedSignals.recentCoupleSpaceSummary,
    chatHistory: options.chatHistory,
    relationshipStageOverride: options.session.relationshipStageOverride,
  });
  const relationshipBaselineBlock = truncateFromStart(
    buildRelationshipBaselineBlock({
      level: relationshipBaselineLevel,
      userName: options.userProfile.name,
      characterName: options.character.name,
      manualOverride: options.session.relationshipStageOverride,
      allowAdultIntimacy: options.session.allowAdultIntimacy,
    }),
    DATING_PROMPT_BUDGET.maxSectionChars,
  );
  const resolvedDirectorInstruction = resolveDirectorInstruction(options);
  const compiledSpecialDirective = compileSpecialDirective(resolvedDirectorInstruction);
  const outputMode: DatingSceneOutputMode = compiledSpecialDirective && compiledSpecialDirective.outputKind !== 'narrative_episode'
    ? 'page_episode'
    : 'scene';
  const pageEpisodeIntent = compiledSpecialDirective?.pageType
    ? {
        pageType: compiledSpecialDirective.pageType,
        platform: compiledSpecialDirective.platform,
        outputKind: compiledSpecialDirective.outputKind,
        statusBarMode: compiledSpecialDirective.chrome.statusBarMode,
        statusBarInstruction: compiledSpecialDirective.chrome.statusBarInstruction,
        canonMode: compiledSpecialDirective.writebackPolicy,
      } satisfies DatingPageEpisodeIntent
    : undefined;
  const directorInstructionBlock = truncateFromStart(
    buildDirectorInstructionBlock(resolvedDirectorInstruction, options.directorMode, compiledSpecialDirective),
    DATING_PROMPT_BUDGET.maxSectionChars,
  );
  const pageEpisodeInstructionBlock = truncateFromStart(
    buildPageEpisodeInstructionBlock(compiledSpecialDirective || undefined),
    DATING_PROMPT_BUDGET.maxSectionChars,
  );
  const sceneProgress = buildDatingSceneProgress(options.session);
  const sceneProgressSummary = buildDatingSceneProgressSummary(sceneProgress);
  const retrievalQueries: MemoryPromptQueryText[] = [
    ...(buildRecentDatingTranscriptQueryText(options.session)
      ? [{
          text: buildRecentDatingTranscriptQueryText(options.session)!,
          weight: 0.9,
        }]
      : []),
    ...(sceneProgressSummary
      ? [{
          text: sceneProgressSummary,
          weight: 1.05,
        }]
      : []),
    ...(sceneProgress.currentBeat?.trim()
      ? [{
          text: sceneProgress.currentBeat.trim(),
          weight: 0.95,
        }]
      : []),
    ...(sceneProgress.currentSignature?.trim()
      ? [{
          text: sceneProgress.currentSignature.trim(),
          weight: 1,
        }]
      : []),
    ...(sceneScopedSignals.topicAnchors || []).slice(0, 2).map((item) => ({
      text: item.summary,
      weight: 0.95,
    })),
    ...(sceneScopedSignals.taskResidue || []).slice(0, 2).map((item) => ({
      text: item.summary,
      weight: 1.05,
    })),
    ...(sceneScopedSignals.relationshipResidue || []).slice(0, 2).map((item) => ({
      text: item.summary,
      weight: 0.75,
    })),
    ...(sceneScopedSignals.sharedRecentRelationshipSummary
      ? [{
          text: sceneScopedSignals.sharedRecentRelationshipSummary,
          weight: 0.65,
        }]
      : []),
    ...(sceneScopedSignals.recentCoupleSpaceSummary
      ? [{
          text: sceneScopedSignals.recentCoupleSpaceSummary,
          weight: 0.55,
        }]
      : []),
  ];
  const retrievedMemory = buildMemoryPromptView({
    characterId: options.character.id,
    latestUserText: getLatestDatingMemoryQueryText(options),
    retrievalQueries,
    preferredSourceScenes: ['dating', 'couple_space', 'direct_chat', 'forum', 'group_chat'],
    forceLatestRelationshipWaves: true,
    forceLatestSceneProgress: true,
    forceLatestOpenTasks: true,
  });
  const hasRetrievedMemory = (
    retrievedMemory.matchedFacts.length
    || retrievedMemory.stablePreferences.length
    || retrievedMemory.relationshipWaves.length
    || retrievedMemory.sceneProgress.length
    || retrievedMemory.openTasks.length
  ) > 0;
  const worldBookPromptSection = truncateFromStart(characterContext.worldBookPrompt, DATING_PROMPT_BUDGET.maxSectionChars);
  const sceneProgressPrompt = truncateFromStart(
    formatDatingSceneProgressForPrompt(sceneProgress),
    DATING_PROMPT_BUDGET.maxSectionChars,
  );
  const retrievedMemoryPrompt = hasRetrievedMemory
    ? truncateFromStart(
        buildMemoryRetrievalPromptFromView(retrievedMemory),
        DATING_PROMPT_BUDGET.maxSectionChars,
      )
    : '';
  const sharedCharacterStatePrompt = truncateFromStart(sharedCharacterState.directPrompt, DATING_PROMPT_BUDGET.maxSectionChars);
  const temporalContextPrompt = buildTemporalContextPrompt({
    perception: options.perception,
    now: Date.now(),
  });
  const sections = budgetSections([
    ...buildExtraSections({
      sharedCharacterStatePrompt,
      temporalContext: temporalContextPrompt,
      maskPrompt: truncateFromStart(characterContext.maskPrompt, DATING_PROMPT_BUDGET.maxSectionChars),
      expressionStyle: truncateFromStart(characterContext.expressionStyle, DATING_PROMPT_BUDGET.maxSectionChars),
      boundaryPack: truncateFromStart(characterContext.boundaryPack, DATING_PROMPT_BUDGET.maxSectionChars),
      extendedLore: truncateFromStart(characterContext.extendedLore, DATING_PROMPT_BUDGET.maxSectionChars),
      datingSceneHint: truncateFromStart(characterContext.sceneHints?.dating, DATING_PROMPT_BUDGET.maxSectionChars),
      shortTermSummary: truncateFromStart(shortTermSummary, DATING_PROMPT_BUDGET.maxSectionChars),
      longTermMemoryProfile: truncateFromStart(characterScopedMemory.longTermMemoryProfile, DATING_PROMPT_BUDGET.maxSectionChars),
      retrievedMemoryPrompt,
      relationshipResidue: sceneScopedSignals.relationshipResidue?.slice(0, 3),
      topicAnchors: sceneScopedSignals.topicAnchors?.slice(0, 2),
      taskResidue: sceneScopedSignals.taskResidue?.slice(0, 2),
      recentCoupleSpaceSummary: truncateFromStart(sceneScopedSignals.recentCoupleSpaceSummary, DATING_PROMPT_BUDGET.maxSectionChars),
      sharedRecentRelationshipSummary: truncateFromStart(sceneScopedSignals.sharedRecentRelationshipSummary, DATING_PROMPT_BUDGET.maxSectionChars),
    }),
    worldBookPromptSection ? ['## World Book Context', worldBookPromptSection].join('\n') : '',
  ]);
  const pagePromptContext = {
    directReplyConfig: {
      minReplies: Math.max(1, Math.min(options.character.minReplies || 1, 10)),
      maxReplies: Math.max(
        Math.max(1, Math.min(options.character.minReplies || 1, 10)),
        Math.min(options.character.maxReplies || 3, 10),
      ),
    },
    languagePolicy: options.character as ReplyLanguagePolicyInput,
    memoryContext: {
      shortTermSummary: truncateFromStart(shortTermSummary, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
      longTermMemoryProfile: truncateFromStart(characterScopedMemory.longTermMemoryProfile, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
      perceptionPrompt: temporalContextPrompt || undefined,
      sharedCharacterStatePrompt: sharedCharacterStatePrompt || undefined,
    } satisfies MemoryContextInput,
    recentContext: {
      shortTermSummary: truncateFromStart(shortTermSummary, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
      relationshipResidue: sceneScopedSignals.relationshipResidue,
      sceneResidue: sceneScopedSignals.sceneResidue,
      topicAnchors: sceneScopedSignals.topicAnchors,
      taskResidue: sceneScopedSignals.taskResidue,
      recentCoupleSpaceSummary: truncateFromStart(sceneScopedSignals.recentCoupleSpaceSummary, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
      sharedRecentRelationshipSummary: truncateFromStart(sceneScopedSignals.sharedRecentRelationshipSummary, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
      publicAcquaintanceSummary: truncateFromStart(sceneScopedSignals.publicAcquaintanceSummary, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
      retrievedMemory: hasRetrievedMemory ? retrievedMemory : undefined,
    },
  };

  recordMemoryReadDiagnostic({
    sourceScene: 'dating',
    characterId: options.character.id,
    shortTermSummarySource: characterScopedMemory.diagnostics?.shortTermSummarySource || 'empty',
    longTermMemoryProfileSource: characterScopedMemory.diagnostics?.longTermMemoryProfileSource || 'empty',
    shortTermSnapshotTypeUsed: characterScopedMemory.diagnostics?.shortTermSnapshotTypeUsed,
    longTermSnapshotTypeUsed: characterScopedMemory.diagnostics?.longTermSnapshotTypeUsed,
    recordCounts: characterScopedMemory.diagnostics?.recordCounts,
    sceneSignalCounts: {
      compatibilitySnapshots: sceneScopedSignals.compatibilitySnapshotCount || 0,
      relationshipResidue: sceneScopedSignals.relationshipResidue?.length || 0,
      sceneResidue: sceneScopedSignals.sceneResidue?.length || 0,
      topicAnchors: sceneScopedSignals.topicAnchors?.length || 0,
      taskResidue: sceneScopedSignals.taskResidue?.length || 0,
    },
    retrievedMemoryCounts: {
      matchedFacts: retrievedMemory.matchedFacts.length,
      stablePreferences: retrievedMemory.stablePreferences.length,
      relationshipWaves: retrievedMemory.relationshipWaves.length,
      sceneProgress: retrievedMemory.sceneProgress.length,
      openTasks: retrievedMemory.openTasks.length,
    },
    sceneProgress: {
      currentSignature: sceneProgress.currentSignature,
      previousSignature: sceneProgress.previousSignature,
      repeatedSignature: sceneProgress.repeatedSignature,
      bannedRepeatActionCount: sceneProgress.bannedRepeatActions.length,
    },
    promptSectionCount: sections.length,
  });

  return {
    mode: options.mode,
    outputMode,
    specialDirectivePlan: compiledSpecialDirective || undefined,
    pagePromptContext,
    pageEpisodeIntent,
    pageEpisodeInstructionBlock,
    characterName: options.character.name,
    corePersona: truncateFromStart(characterContext.corePersona, DATING_PROMPT_BUDGET.maxCorePersonaChars),
    signature: truncateFromStart(options.character.signature, DATING_PROMPT_BUDGET.maxSignatureChars) || undefined,
    openingRemark: truncateFromStart(options.character.openingRemark, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
    personaGuidePrompt: truncateFromStart(directPersonaGuide, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
    maskPrompt: truncateFromStart(characterContext.maskPrompt, DATING_PROMPT_BUDGET.maxSectionChars) || undefined,
    worldBookPrompt: worldBookPromptSection || undefined,
    userName: options.userProfile.name,
    location: options.session.location,
    scenario: options.session.scenario,
    mood: options.session.mood,
    narrativePerspective: normalizeStyleValue(options.session.narrativePerspective, 'default'),
    writingPreset: normalizeStyleValue(options.session.writingPreset, 'default'),
    writingReference: normalizeStyleValue(options.session.writingReference, 'none'),
    dialogueFormat: normalizeStyleValue(options.session.dialogueFormat, 'default'),
    descriptionDensity: normalizeStyleValue(options.session.descriptionDensity, 'default'),
    writingStyleCustom: truncateFromStart(options.session.writingStyleCustom?.trim(), DATING_PROMPT_BUDGET.maxStyleCustomChars) || undefined,
    backgroundRule: buildBackgroundRule(options.session),
    relationshipBaselineBlock,
    directorInstructionBlock,
    pastChatContext: formatPastChatContext(options.chatHistory, options.character.name),
    datingMessages: formatDatingMessages(options.session),
    sceneProgress: sceneProgressPrompt,
    currentGeneratedStatus: formatCurrentGeneratedStatus(options.session),
    currentGeneratedPlaylist: formatCurrentGeneratedPlaylist(options.session),
    task: buildTask(options),
    sections,
  };
}
