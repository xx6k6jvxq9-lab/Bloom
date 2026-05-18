import type {
  GroupOfflineRound,
  GroupOfflineSession,
  GroupOfflineStylePresetId,
} from '../../../../types';
import type {
  GroupOfflineRoundPlan,
  GroupOfflineRuntimeProjection,
} from '../../../group-offline/types';
import {
  findProjectionCharacter,
  formatProjectionCharacterProfile,
  formatProjectionGroupState,
} from './groupOfflineProjectionPrompt';
import { getGroupOfflineStylePreset } from './groupOfflineStylePresets';
import {
  buildGroupOfflineScenarioRoundRuleLines,
  buildGroupOfflineScenarioSchemaLines,
  formatGroupOfflineScenarioBrief,
} from './groupOfflineScenarioPrompt';
import { compileSpecialDirective } from '../../../special-directives/compileSpecialDirective';

export type GroupOfflineRoundRewriteMode = 'style_preset' | 'custom_style' | 'retry_round' | 'director_instruction';

type BuildGroupOfflineRoundRewritePromptOptions = {
  mode: GroupOfflineRoundRewriteMode;
  session: GroupOfflineSession;
  round: GroupOfflineRound;
  runtimeProjection: GroupOfflineRuntimeProjection;
  previousRounds?: GroupOfflineRound[];
  stylePresetId?: GroupOfflineStylePresetId;
  customStyleText?: string;
  directorInstructionText?: string;
  roundPlan?: GroupOfflineRoundPlan;
  directorPagePlanOverride?: {
    pageType: NonNullable<NonNullable<GroupOfflineRound['pageEpisode']>['pageType']>;
    platform?: NonNullable<GroupOfflineRound['pageEpisode']>['platform'];
  };
};

function formatPreviousRounds(rounds: GroupOfflineRound[] | undefined, currentRoundId: string): string {
  const filtered = (rounds || []).filter((round) => round.id !== currentRoundId);
  if (filtered.length === 0) {
    return '暂无前文。';
  }

  return filtered
    .slice(-3)
    .map((round, index) => {
      const entries = round.characterEntries.map((entry) => `- ${entry.speakerLabel}: ${entry.text}`).join('\n');
      return [
        `${index + 1}. ${round.title || `第 ${index + 1} 轮`}`,
        round.userMessageText ? `用户输入：${round.userMessageText}` : '',
        round.sceneText ? `场景推进：${round.sceneText}` : '',
        entries,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function formatCurrentRound(round: GroupOfflineRound): string {
  return [
    `轮标题：${round.title || '当前轮'}`,
    round.mode === 'page_episode' && round.pageEpisode
      ? `页面模式：${round.pageEpisode.pageType}`
      : '',
    round.pageEpisode?.title ? `页面标题：${round.pageEpisode.title}` : '',
    round.pageEpisode?.subtitle ? `页面副标题：${round.pageEpisode.subtitle}` : '',
    round.pageEpisode?.caption ? `页面说明：${round.pageEpisode.caption}` : '',
    round.pageEpisode?.htmlDocument ? `页面 HTML：${round.pageEpisode.htmlDocument}` : '',
    round.userMessageText ? `对应用户输入：${round.userMessageText}` : '',
    round.sceneText ? `场景推进：${round.sceneText}` : '',
    ...round.characterEntries.map((entry) => [
      `角色：${entry.speakerLabel}`,
      entry.target?.label ? `target：${entry.target.label}` : '',
      `正文：${entry.text}`,
      entry.highlightText ? `高亮句：${entry.highlightText}` : '',
      entry.statusFields.length > 0
        ? ['状态栏：', ...entry.statusFields.map((field) => `- ${field.label}: ${field.value}`)].join('\n')
        : '',
      entry.notebook?.trim() ? `记事本：${entry.notebook.trim()}` : '',
      entry.aftereffects?.searches?.length
        ? ['搜索记录：', ...entry.aftereffects.searches.map((item) => `- ${item}`)].join('\n')
        : '',
      entry.aftereffects?.items?.length
        ? ['事后痕迹：', ...entry.aftereffects.items.map((item) => `- ${item.sourceLabel}: ${item.actionText} / ${item.residueText}`)].join('\n')
        : '',
      entry.memoryPanel?.shortTerm?.length
        ? ['短期记忆：', ...entry.memoryPanel.shortTerm.map((item) => `- ${item}`)].join('\n')
        : '',
      entry.memoryPanel?.longTerm?.length
        ? ['长期记忆：', ...entry.memoryPanel.longTerm.map((item) => `- ${item}`)].join('\n')
        : '',
    ].filter(Boolean).join('\n')),
  ].filter(Boolean).join('\n\n');
}

function resolvePageRewritePlan(
  options: BuildGroupOfflineRoundRewritePromptOptions,
): {
  pageType: NonNullable<NonNullable<GroupOfflineRound['pageEpisode']>['pageType']>;
  platform?: NonNullable<GroupOfflineRound['pageEpisode']>['platform'];
} | undefined {
  if (options.directorPagePlanOverride) {
    return options.directorPagePlanOverride;
  }

  const compiled = options.directorInstructionText?.trim()
    ? compileSpecialDirective(options.directorInstructionText.trim())
    : null;
  if (compiled?.pageType) {
    return {
      pageType: compiled.pageType,
      ...(compiled.platform ? { platform: compiled.platform } : {}),
    };
  }

  if (options.round.pageEpisode?.pageType) {
    return {
      pageType: options.round.pageEpisode.pageType,
      platform: options.round.pageEpisode.platform,
    };
  }

  return undefined;
}

function buildGroupOfflinePageRewriteRuleLines(
  pagePlan: {
    pageType: NonNullable<NonNullable<GroupOfflineRound['pageEpisode']>['pageType']>;
    platform?: NonNullable<GroupOfflineRound['pageEpisode']>['platform'];
  },
): string[] {
  if (pagePlan.pageType === 'wechat_chat') {
    return [
      '6. round.pageEpisode.chat.messages 必须给出完整聊天记录；用 message 数组拆开时间戳、系统提示、转账卡片和普通消息，不要把整页聊天揉成一段说明文。',
      '7. 如果导演要求隐藏状态栏或自定义状态栏，把 round.pageEpisode.statusBar 一起写出来；如果没要求，就按正常微信聊天页处理。',
      '8. 聊天内容必须服务这一轮推进，不能只做 UI 壳子或空白占位。',
    ];
  }

  if (pagePlan.pageType === 'feed_post') {
    return [
      '6. 如果导演要求的是多条动态/多条帖子，不要把编号硬塞进一个 body；要拆成 round.pageEpisode.feed.items 里的多条独立动态卡片。',
      '7. round.pageEpisode.feed 要把 authorName、headline、body、comments 等字段拆开；微博/小红书/网易云/校园墙这类平台页，不要把标题、来源、地点、标签全糊进正文。',
      '8. 除微信和朋友圈外，社交媒体页默认要有评论区；如果导演要求评论条数，要补足对应数量。',
    ];
  }

  if (pagePlan.pageType === 'document_page') {
    return [
      '6. round.pageEpisode.document 必须给出完整文档结构：title、subtitle、intro、sections，以及需要的话 primaryActionLabel / secondaryActionLabel。',
      '7. sections 要拆成多段信息块，不要把所有内容塞成一整段说明文。',
      '8. 文档页也必须服务这一轮推进，像调查页、通知页、报名页或现场记录页，而不是脱离剧情的模板空壳。',
    ];
  }

  return [
    '6. round.pageEpisode.htmlDocument 必须给出完整、可渲染的 html 页面内容；首屏必须直接可见，不能只有空壳背景。',
    '7. 至少给出一个明确根容器、一个主要视觉区、一个可操作控件和一个操作后的反馈区；点击或切换后要看得出状态变化。',
    '8. 页面内容仍然必须服务这轮剧情推进，不能脱离当前现场的人设、关系、任务和世界观。',
  ];
}

function buildGroupOfflinePageRewriteSchemaLines(
  pagePlan: {
    pageType: NonNullable<NonNullable<GroupOfflineRound['pageEpisode']>['pageType']>;
    platform?: NonNullable<GroupOfflineRound['pageEpisode']>['platform'];
  },
  indent = '    ',
): string[] {
  const lines = [
    `${indent}"pageEpisode": {`,
    `${indent}  "pageType": "${pagePlan.pageType}",`,
    ...(pagePlan.platform ? [`${indent}  "platform": "${pagePlan.platform}",`] : []),
    `${indent}  "title": "页面标题",`,
    `${indent}  "subtitle": "页面副标题",`,
    `${indent}  "caption": "页面补充说明，可选",`,
  ];

  if (pagePlan.pageType === 'wechat_chat') {
    return [
      ...lines,
      `${indent}  "statusBar": { "mode": "auto|hidden|custom", "time": "22:18", "carrier": "中国移动", "network": "5G", "battery": 86 },`,
      `${indent}  "chat": {`,
      `${indent}    "headerTitle": "聊天页顶部标题",`,
      `${indent}    "headerSubtitle": "聊天页副标题，可选",`,
      `${indent}    "inputPlaceholder": "输入框提示，可选",`,
      `${indent}    "messages": [`,
      `${indent}      { "sender": "system|user|character", "kind": "text|timestamp|system|transfer", "text": "消息正文", "timestampLabel": "22:18", "amountLabel": "¥520.00", "note": "可选备注" }`,
      `${indent}    ]`,
      `${indent}  }`,
      `${indent}}`,
    ];
  }

  if (pagePlan.pageType === 'feed_post') {
    return [
      ...lines,
      `${indent}  "feed": {`,
      `${indent}    "authorName": "主发帖人",`,
      `${indent}    "authorBadge": "身份标记，可选",`,
      `${indent}    "headline": "动态标题，可选",`,
      `${indent}    "body": "主动态正文",`,
      `${indent}    "sourceLabel": "来源，可选",`,
      `${indent}    "timestampLabel": "时间，可选",`,
      `${indent}    "locationLabel": "地点，可选",`,
      `${indent}    "topics": ["标签1", "标签2"],`,
      `${indent}    "likeCountLabel": "99+",`,
      `${indent}    "commentCountLabel": "12",`,
      `${indent}    "repostCountLabel": "8",`,
      `${indent}    "comments": [{ "authorName": "评论人", "authorRole": "character|user|other", "text": "评论正文", "badge": "可选" }],`,
      `${indent}    "items": [`,
      `${indent}      { "authorName": "动态作者", "headline": "单条动态标题，可选", "body": "单条动态正文", "comments": [] }`,
      `${indent}    ]`,
      `${indent}  }`,
      `${indent}}`,
    ];
  }

  if (pagePlan.pageType === 'document_page') {
    return [
      ...lines,
      `${indent}  "document": {`,
      `${indent}    "title": "文档标题",`,
      `${indent}    "subtitle": "文档副标题，可选",`,
      `${indent}    "intro": "文档导语，可选",`,
      `${indent}    "sections": [`,
      `${indent}      { "heading": "分节标题，可选", "body": "分节正文" }`,
      `${indent}    ],`,
      `${indent}    "primaryActionLabel": "主按钮文案，可选",`,
      `${indent}    "secondaryActionLabel": "次按钮文案，可选"`,
      `${indent}  }`,
      `${indent}}`,
    ];
  }

  return [
    ...lines,
    `${indent}  "htmlDocument": "完整 html 或可直接渲染的主体结构"`,
    `${indent}}`,
  ];
}

function buildDirectorInstructionBlock(options: BuildGroupOfflineRoundRewritePromptOptions): string {
  const rawInstruction = options.directorInstructionText?.trim();
  const instruction = rawInstruction;
  if (options.mode !== 'director_instruction' || !instruction) {
    return '';
  }

  return [
    '## 导演额外指令',
    '这次重写当前轮时，要把这条导演指令当成高优先级剧情指令来执行，而不是轻量参考。',
    /(\d{2,5}\s*(字|汉字|字符|字左右)|[一二两三四五六七八九十百千万]+字|(篇幅|长篇|短篇|写长|写满|放开写|尽量写长|尽量详细|详细展开|多写一点|少写一点))/u.test(rawInstruction || '')
      ? '如果这条特殊指令明确要求了篇幅或字数，以这条特殊指令为准，不要回退到外部默认字数限制。'
      : '如果这条特殊指令没有明确要求篇幅，再按外部默认字数去控制。',
    '优先级顺序：角色设定 / 世界观 / 不在场约束 > 设定局任务 > 当前轮已确定的调度顺序 > 导演指令 > 文风。',
    '导演指令只能改这一轮的推进方式、焦点、节奏、回应对象和额外限制，不能增删出场角色，也不能把不在场的人写进现场。',
    '不要推翻当前任务目标，也不要把 currentTask / successCondition / failureCondition / taskSteps 改成另一套。',
    `[原始导演指令]\n${instruction}`,
  ].join('\n');
}

export function buildGroupOfflineRoundRewritePrompt(
  options: BuildGroupOfflineRoundRewritePromptOptions,
): string {
  const stylePreset = options.stylePresetId
    ? getGroupOfflineStylePreset(options.stylePresetId)
    : undefined;
  const customStyleText = options.customStyleText?.trim() || '';
  const groupStateSummary = formatProjectionGroupState(options.runtimeProjection);
  const scenarioBrief = formatGroupOfflineScenarioBrief(options.session);
  const scenarioRuleLines = buildGroupOfflineScenarioRoundRuleLines(options.session);
  const directorInstructionBlock = buildDirectorInstructionBlock(options);
  const pageRewritePlan = resolvePageRewritePlan(options);
  const roundCharacters = options.round.characterEntries.length > 0
    ? options.round.characterEntries
        .map((entry) => findProjectionCharacter(options.runtimeProjection, entry.characterId))
        .filter(Boolean)
    : (options.round.selectedCharacterIds || [])
        .map((characterId) => findProjectionCharacter(options.runtimeProjection, characterId))
        .filter(Boolean);
  const selectedNames = roundCharacters.map((character) => character.identity.displayName).join('、');
  const roundProfiles = roundCharacters.map((character) => formatProjectionCharacterProfile(character));

  if (pageRewritePlan && options.mode !== 'style_preset' && options.mode !== 'custom_style') {
    const pageRuleLines = buildGroupOfflinePageRewriteRuleLines(pageRewritePlan);
    return [
      options.mode === 'director_instruction'
        ? '你现在要按导演指令重写群聊线下里的当前轮，而且这一轮必须继续以独立 page_episode 页面轮的形式输出。'
        : '你现在要重试群聊线下里的当前轮，而且这一轮必须继续以独立 page_episode 页面轮的形式输出。',
      '这不是普通群聊，也不是单人约会，而是多人在同一现场的群线下。',
      '',
      '硬性要求：',
      '1. 只输出 JSON，不要解释，不要 markdown。',
      '2. 只处理当前轮，不要改前面的轮次。',
      `3. 当前轮输出模式固定为 \`page_episode\`，页面类型固定为 \`${pageRewritePlan.pageType}\`。`,
      '4. 保留当前轮的出场角色、出场顺序、玩法、用户输入和基本事件事实，不要增删角色，不要把不在场的人写进页面。',
      roundCharacters.length > 1 ? '4.5. 当前轮是多人同场，不要把页面误写成只剩一个人的单人页；至少让其他出场角色通过评论、回复、并列卡片或同页互动被看见。' : '',
      ...scenarioRuleLines,
      '5. round.sceneText 仍然必须写，而且它是这轮页面内容的剧情摘要，用于主线衔接，不是大段普通正文。',
      ...pageRuleLines,
      '9. 如果导演指令明确要求了篇幅、互动或视觉结构，以导演指令为准，不要回退到外部默认字数限制。',
      '',
      directorInstructionBlock,
      '',
      '## 当前局信息',
      `模式：${options.session.mode}`,
      '玩法：分块推进',
      `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
      `地点：${options.session.location}`,
      `时间：${options.session.timeLabel}`,
      `天气/世界状态：${options.session.weatherLabel}`,
      `氛围：${options.session.vibe}`,
      `当前轮角色：${selectedNames || '暂无'}`,
      '',
      scenarioBrief || '',
      '',
      '## 用户',
      `用户名：${options.runtimeProjection.userName}`,
      '',
      '## 前文（不要改写，只用于衔接）',
      formatPreviousRounds(options.previousRounds, options.round.id),
      '',
      '## 当前轮原始数据',
      formatCurrentRound(options.round),
      options.round.pageEpisode ? `当前页面 JSON：${JSON.stringify(options.round.pageEpisode)}` : '',
      '',
      options.roundPlan?.characterSteps?.length
        ? [
            '## 当前轮原始调度',
            `调度摘要：${options.roundPlan.summary}`,
            ...options.roundPlan.characterSteps.map((step, index) => `${index + 1}. ${step.speakerLabel} -> ${step.target.label}`),
            '这份调度只约束谁先出场、对谁出声，不替角色决定语气、主动性、占有欲、亲密尺度或表演力度。',
          ].join('\n')
        : '',
      groupStateSummary
        ? ['## 群线下运行时状态', groupStateSummary].join('\n')
        : '',
      '',
      '## 角色资料',
      roundProfiles.join('\n\n'),
      '',
      '## JSON 输出结构',
      '{',
      '  "round": {',
      '    "mode": "page_episode",',
      '    "title": "当前轮标题",',
      '    "sceneText": "当前轮页面内容对应的剧情摘要",',
      ...buildGroupOfflineScenarioSchemaLines(options.session, '    '),
      ...buildGroupOfflinePageRewriteSchemaLines(pageRewritePlan, '    '),
      '    "characterEntries": []',
      '  }',
      '}',
    ].filter(Boolean).join('\n');
  }

  return [
    options.mode === 'style_preset' || options.mode === 'custom_style'
      ? '你现在要重写群聊线下里的当前轮，只改文风，不改事件。'
      : options.mode === 'director_instruction'
        ? '你现在要按导演指令重写群聊线下里的当前轮，在保持前文连续的前提下改写这一轮的推进方式。'
        : '你现在要重试群聊线下里的当前轮，在保持前文连续的前提下重生成这一轮。',
    '这不是普通群聊，也不是单人约会，而是多人在同一现场的群线下。',
    '',
    '硬性要求：',
    '1. 只输出 JSON，不要解释，不要 markdown。',
    '2. 只处理当前轮，不要改前面的轮次。',
    '3. 保留当前轮的出场角色、出场顺序、玩法、用户输入和基本事件事实。',
    '4. 不要增删角色，也不要把分块推进改成别的玩法。',
    ...scenarioRuleLines,
    '5. 每个角色块仍要输出 text / highlightText / statusFields / notebook / aftereffects / memoryPanel。',
    '6. highlightText 必须仍然是 text 里已经出现过的一句台词，并且单独成段。',
    '7. statusFields 固定只保留 4 个字段：状态、衣着、动作、心声，并且每个字段控制在 30 到 50 个汉字。',
    '7.5. notebook 必须严格控制在 30 到 50 个汉字；memoryPanel.shortTerm 这一轮只新增 1 条。',
    options.mode === 'style_preset' || options.mode === 'custom_style'
      ? '8. 这次目标是换写法，不换剧情，不要把已经成立的动作、场面关系和事件结果改掉。'
      : options.mode === 'director_instruction'
        ? '8. 这次目标是按导演指令改写这一轮：可以重排推进重点、调整谁先回应谁、压缩或放大某些落点，但不要改前文已成立的条件。'
        : '8. 这次目标是重试这一轮：可以换细节、换措辞、换推进落点，但不要改前文已成立的条件。',
    '8.5. aftereffects.items 固定输出 4 张卡，四张都必须由这次重写直接给出。',
    '9. 人设优先：不要把全部角色写成同一种说话手感。',
    '10. 文风只能改变句子节奏、描写密度和镜头感，不得改变角色主动性、边界和关系判断。',
    '',
    stylePreset
      ? [
          `## 本次文风预设：${stylePreset.label}`,
          `目标手感：${stylePreset.summary}`,
          ...stylePreset.rules.map((rule, index) => `${index + 1}. ${rule}`),
        ].join('\n')
      : '',
    customStyleText
      ? ['## 本次自定义文风要求', customStyleText].join('\n')
      : '',
    directorInstructionBlock,
    '',
    '## 当前局信息',
    `模式：${options.session.mode}`,
    '玩法：分块推进',
    `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
    `地点：${options.session.location}`,
    `时间：${options.session.timeLabel}`,
    `天气/世界状态：${options.session.weatherLabel}`,
    `氛围：${options.session.vibe}`,
    `当前轮角色：${selectedNames || '暂无'}`,
    '',
    scenarioBrief || '',
    '',
    '## 用户',
    `用户名：${options.runtimeProjection.userName}`,
    '',
    '## 前文（不要改写，只用于衔接）',
    formatPreviousRounds(options.previousRounds, options.round.id),
    '',
    '## 当前轮原始数据',
    formatCurrentRound(options.round),
    '',
    options.roundPlan?.characterSteps?.length
      ? [
          '## 当前轮原始调度',
          `调度摘要：${options.roundPlan.summary}`,
          ...options.roundPlan.characterSteps.map((step, index) => `${index + 1}. ${step.speakerLabel} -> ${step.target.label}`),
          '这份调度只约束谁先出场、对谁出声，不替角色决定语气、主动性、占有欲、亲密尺度或表演力度。',
        ].join('\n')
      : '',
    options.session.writingStyleCustom?.trim() && !customStyleText
      ? ['## 当前已经固定的文风要求', options.session.writingStyleCustom.trim()].join('\n')
      : '',
    groupStateSummary
      ? ['## 群线下运行时状态', groupStateSummary].join('\n')
      : '',
    '',
    '## 角色资料',
    roundProfiles.join('\n\n'),
    '',
    '## JSON 输出结构',
    '{',
    '  "round": {',
    '    "title": "当前轮标题",',
    '    "sceneText": "当前轮场景推进",',
    ...buildGroupOfflineScenarioSchemaLines(options.session, '    '),
    '    "characterEntries": [',
    '      {',
    '        "characterId": "角色 id",',
    '        "speakerLabel": "角色名",',
    '        "target": { "type": "user|character|group|scene", "label": "可选", "characterId": "可选" },',
    '        "text": "该角色这一轮的完整正文",',
    '        "highlightText": "该角色在 text 里真实说过的一句台词",',
    '        "statusFields": [',
    '          { "key": "state", "label": "状态", "value": "30到50字左右" }',
    '        ],',
    '        "notebook": "严格 30 到 50 个汉字，像角色本人会记下来的内容",',
    '        "aftereffects": {',
    '          "searches": ["活人会搜的内容"],',
    '          "items": [',
    '            { "sourceLabel": "相册/备忘录/音乐等来源", "actionText": "真实会出现的内容", "residueText": "一条余波" }',
    '          ]',
    '        },',
    '        "memoryPanel": {',
    '          "shortTerm": ["当前这一轮新增的 1 条具体记忆"],',
    '          "longTerm": ["只有累计满 10 条时才允许写 1 条长期总结"]',
    '        }',
    '      }',
    '    ]',
    '  }',
    '}',
  ].filter(Boolean).join('\n');
}
