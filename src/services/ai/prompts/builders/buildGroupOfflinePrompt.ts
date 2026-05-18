import type {
  GroupOfflineRound,
  GroupOfflineRoundDispatchMode,
  GroupOfflineSession,
} from '../../../../types';
import type {
  GroupOfflineRoundPlan,
  GroupOfflineRuntimeProjection,
} from '../../../group-offline/types';
import {
  findProjectionCharacter,
  formatProjectionCharacterProfile,
  formatProjectionGroupState,
  pickProjectionCharacters,
} from './groupOfflineProjectionPrompt';
import {
  buildGroupOfflineScenarioRoundRuleLines,
  buildGroupOfflineScenarioSchemaLines,
  formatGroupOfflineScenarioBrief,
} from './groupOfflineScenarioPrompt';
import {
  compileSpecialDirective,
  type CompiledSpecialDirective,
} from '../../../special-directives/compileSpecialDirective';

type GroupOfflinePromptPhase = 'intro' | 'round';
type GroupOfflineDirectorMode = 'start' | 'rewrite' | 'next_round';
type GroupOfflineHtmlPagePlan = {
  pageType: 'micro_app' | 'custom_html';
  compiled: CompiledSpecialDirective;
};

type BuildGroupOfflinePromptOptions = {
  session: GroupOfflineSession;
  runtimeProjection: GroupOfflineRuntimeProjection;
  worldBookPrompt?: string;
  roundPlan?: GroupOfflineRoundPlan;
  latestUserMessage?: string;
  existingRounds?: GroupOfflineRound[];
  phase?: GroupOfflinePromptPhase;
  selectedCharacterIds?: string[];
  dispatchMode?: GroupOfflineRoundDispatchMode;
  directorInstructionOverride?: string;
  directorMode?: GroupOfflineDirectorMode;
};

function formatExistingRounds(rounds: GroupOfflineRound[] | undefined): string {
  if (!rounds || rounds.length === 0) {
    return '暂无已生成轮次。';
  }

  return rounds
    .slice(-4)
    .map((round, index) => {
      const entries = round.characterEntries
        .map((entry) => `- ${entry.speakerLabel}: ${entry.text}`)
        .join('\n');

      return [
        `${index + 1}. ${round.title || `第 ${index + 1} 轮`}`,
        round.userMessageText ? `用户输入：${round.userMessageText}` : '',
        round.sceneText ? `场景推进：${round.sceneText}` : '',
        entries,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function formatRoundPlan(plan: GroupOfflineRoundPlan | undefined): string {
  if (!plan) {
    return '暂无。';
  }

  const dispatchLabel = plan.dispatchMode === 'manual'
    ? '手动选人'
    : plan.dispatchMode === 'random'
      ? '随机出场'
      : '系统推荐';

  return [
    `调度摘要：${plan.summary}`,
    `调度方式：${dispatchLabel}`,
    plan.characterSteps.length > 0
      ? [
          '出场顺序：',
          ...plan.characterSteps.map((step, index) => `${index + 1}. ${step.speakerLabel} -> ${step.target.label}`),
        ].join('\n')
      : '出场顺序：暂无。',
    '注意：这份调度只约束谁先出场、对谁出声，不替角色决定语气、主动性、占有欲、亲密尺度或态度强弱。',
  ].join('\n\n');
}

function buildParticipantNames(options: BuildGroupOfflinePromptOptions): string[] {
  return options.session.participants
    .map((participant) => findProjectionCharacter(options.runtimeProjection, participant.characterId)?.identity.displayName || '')
    .filter(Boolean);
}

function resolveDirectorInstruction(options: BuildGroupOfflinePromptOptions): string {
  const override = options.directorInstructionOverride?.trim();
  if (override) {
    return override;
  }
  if (options.session.awaitingDirectorInstruction) {
    return options.session.directorInstruction?.trim() || '';
  }
  return '';
}

function hasExplicitLengthDirective(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  return (
    /\d{2,5}\s*(字|汉字|字符|字左右)/u.test(normalized)
    || /[一二两三四五六七八九十百千万]+字/u.test(normalized)
    || /(篇幅|长篇|短篇|写长|写满|放开写|尽量写长|尽量详细|详细展开|多写一点|少写一点)/u.test(normalized)
  );
}

function buildDirectorInstructionBlock(options: BuildGroupOfflinePromptOptions): string {
  const instruction = resolveDirectorInstruction(options);
  if (!instruction) {
    return '';
  }

  return [
    '## 导演额外指令',
    options.directorMode === 'rewrite'
      ? '本轮首要任务不是默认续写，而是按这条导演指令重写当前轮。'
      : options.directorMode === 'next_round'
        ? '这一轮先执行这条导演指令，再按既定调度继续推进。'
        : options.directorMode === 'start'
          ? '这次要先按这条导演指令生成开场和第一轮，而不是按默认方式开局。'
          : '这是用户当前手动输入的导演指令。只要不违背角色设定、世界观和硬边界，就按高优先级执行。',
    hasExplicitLengthDirective(instruction)
      ? '如果这条特殊指令明确要求了篇幅或字数，以这条特殊指令为准；外部默认字数上限只在特殊指令没提篇幅时兜底。'
      : '如果这条特殊指令没有明确要求篇幅，再回退到外部默认字数设置。',
    '优先级顺序：角色设定 / 世界观 / 不在场约束 > 设定局任务 > 调度顺序 > 导演指令 > 文风。',
    '导演指令只负责本轮推进方式、焦点、节奏、回应对象和额外限制，不负责改角色灵魂，也不能改谁出场。',
    '不要把不在场的人写进现场，不要推翻当前任务目标，也不要把 currentTask / successCondition / failureCondition / taskSteps 改成另一套。',
    `[原始导演指令]\n${instruction}`,
  ].join('\n');
}

function resolveHtmlPagePlan(options: BuildGroupOfflinePromptOptions): GroupOfflineHtmlPagePlan | undefined {
  const instruction = resolveDirectorInstruction(options);
  if (!instruction) {
    return undefined;
  }

  const compiled = compileSpecialDirective(instruction);
  if (!compiled || (compiled.pageType !== 'micro_app' && compiled.pageType !== 'custom_html')) {
    return undefined;
  }

  return {
    pageType: compiled.pageType,
    compiled,
  };
}

function buildCommonInfoSections(options: BuildGroupOfflinePromptOptions): string[] {
  const groupStateSummary = formatProjectionGroupState(options.runtimeProjection);
  const scenarioBrief = formatGroupOfflineScenarioBrief(options.session);
  const directorInstructionBlock = buildDirectorInstructionBlock(options);

  return [
    '## 角色资料',
    options.runtimeProjection.characters.map((character) => formatProjectionCharacterProfile(character)).join('\n\n'),
    '',
    options.worldBookPrompt?.trim()
      ? ['## 世界书', options.worldBookPrompt.trim()].join('\n')
      : '',
    groupStateSummary
      ? ['## 群线下运行时状态', groupStateSummary].join('\n')
      : '',
    scenarioBrief || '',
    options.session.writingStyleCustom?.trim()
      ? ['## 当前固定文风要求', options.session.writingStyleCustom.trim()].join('\n')
      : '',
    directorInstructionBlock,
  ].filter(Boolean);
}

function buildIntroPrompt(options: BuildGroupOfflinePromptOptions): string {
  const participantNames = buildParticipantNames(options);

  return [
    '你现在要为一个“群聊线下场景页”生成开场共景。',
    '这不是普通群聊，也不是单人约会，而是多人在同一现场的线下局。',
    '',
    '硬性要求：',
    '1. 只输出 JSON，不要输出解释。',
    '2. 这一步只负责开场共景、氛围、场景歌曲和全场角色推荐歌单，不要生成角色正文。',
    '3. intro 要有镜头感，要把环境、在场角色间的空气感和当下未说破的牵引写出来。',
    '4. 不要把角色逐个分块长篇描写，这一步只是把现场铺开。',
    options.session.mode === 'scenario'
      ? '4.5. 如果当前是设定局，必须把背景、当前任务和倒数压力一起铺清楚；背景要写出这场局为什么会出现，当前任务要落到具体对象、身份、地点或交接动作上。'
      : '',
    options.session.mode === 'scenario'
      ? '4.6. 设定局整体手感更像副本开局、快穿落点或临时异轨事件，不要写成平直说明文、值班记录或系统总结。'
      : '',
    options.session.mode === 'scenario'
      ? '4.7. 设定局里用户必须是局内人，开场就要给到用户明确切入口或牵扯点，不要把用户排除在任务之外。'
      : '',
    '5. 歌曲不限制语种，但 note 只能写真实歌词短摘；拿不准就留空。',
    '6. 文风只能改变句子节奏、描写密度和镜头感，不要把角色集体写成另一种人。',
    '7. card.objectiveLabel 如果当前是设定局，必须写清当前任务。',
    '',
    '## 当前局信息',
    `模式：${options.session.mode}`,
    '玩法：分块推进',
    `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
    options.session.scenePrompt?.trim() ? `背景/情景：${options.session.scenePrompt.trim()}` : '',
    `地点：${options.session.location}`,
    `时间：${options.session.timeLabel}`,
    `天气/世界状态：${options.session.weatherLabel}`,
    `氛围：${options.session.vibe}`,
    `参与角色：${participantNames.join('、') || '暂无'}`,
    '',
    '## 用户',
    `用户名：${options.runtimeProjection.userName}`,
    '',
    ...buildCommonInfoSections(options),
    '',
    '## JSON 输出结构',
    '{',
    '  "card": {',
    '    "timeLabel": "字符串",',
    '    "locationLabel": "字符串",',
    '    "weatherLabel": "字符串",',
    '    "participantLabels": ["字符串"],',
    '    "objectiveLabel": "可选字符串",',
    '    "roundLabel": "字符串"',
    '  },',
    '  "intro": "开场共景正文",',
    '  "soundtrack": {',
    '    "title": "歌名",',
    '    "artist": "歌手",',
    '    "note": "真实歌词短摘；拿不准就留空字符串"',
    '  },',
    '  "participantSoundtracks": [',
    '    {',
    '      "characterId": "角色 id",',
    '      "characterName": "角色名",',
    '      "title": "该角色会推荐的歌",',
    '      "artist": "歌手",',
    '      "note": "该角色会推这首歌的简短理由"',
    '    }',
    '  ],',
    '  "rounds": []',
    '}',
  ].filter(Boolean).join('\n');
}

function buildHtmlRoundPrompt(
  options: BuildGroupOfflinePromptOptions,
  pagePlan: GroupOfflineHtmlPagePlan,
): string {
  const selectedCharacters = pickProjectionCharacters(options.runtimeProjection, options.selectedCharacterIds);
  const selectedNames = selectedCharacters.map((character) => character.identity.displayName);
  const scenarioRuleLines = buildGroupOfflineScenarioRoundRuleLines(options.session);

  return [
    '你现在要为一个“群聊线下场景页”生成下一轮内容，但这一次输出协议不是普通正文轮，而是独立 HTML 页面轮。',
    '这不是普通群聊，也不是单人约会，而是多人在同一现场的线下局。',
    '',
    '硬性要求：',
    '1. 只输出 JSON，不要输出解释。',
    '2. 这次只生成一轮，rounds 数组里只能有 1 个 round。',
    `3. 本轮输出模式固定为 \`page_episode\`，页面类型固定为 \`${pagePlan.pageType}\`。`,
    `4. 本轮仍然只围绕被调度到的角色推进：${selectedNames.join('、') || '暂无'}。页面内容必须服务这一轮的同场推进，不能脱离当前现场。`,
    `5. 本轮调度方式：${options.dispatchMode === 'manual' ? '手动选人' : options.dispatchMode === 'random' ? '随机出场' : '系统推荐'}。如给了多个角色，顺序必须遵守：${selectedNames.join(' -> ') || '暂无'}。`,
    options.roundPlan ? '5.5. 下面会给你本轮调度。它只约束谁先出场、对谁出声，不替角色决定语气、主动性、占有欲、亲密尺度或表演力度。' : '',
    ...scenarioRuleLines,
    '6. round.sceneText 仍然必须写，而且它不再是普通共景正文，而是这一轮页面内容的剧情摘要，用来让主线继续衔接。',
    '7. round.pageEpisode.htmlDocument 必须给出完整、可独立渲染的 html 页面内容；可以是完整文档，也可以是可直接包进页面容器的主体结构。',
    '8. 如果页面类型是 custom_html / micro_app，首屏必须直接可见，不要整页只有背景、空壳容器或必须点很多次才出现正文。',
    '9. 至少给出一个明确根容器、一个主要视觉区、一个可操作控件和一个操作后的反馈区；点击或切换后要看得出状态变化。',
    '10. 不要把整页内容塞进一大段说明文；把标题、说明、状态、按钮、反馈节点拆开，像一个真的可玩的页面。',
    '11. 不要把不在场的人写进页面，不要推翻当前任务目标，也不要脱离当前局的人设、关系、世界观和硬边界。',
    '12. 如果这条特殊指令明确要求了篇幅、互动或视觉结构，以特殊指令为准；普通外层字数设置在这一轮只当兜底参考。',
    '',
    '## 当前局信息',
    `模式：${options.session.mode}`,
    '玩法：分块推进',
    `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
    options.session.scenePrompt?.trim() ? `背景/情景：${options.session.scenePrompt.trim()}` : '',
    `地点：${options.session.location}`,
    `时间：${options.session.timeLabel}`,
    `天气/世界状态：${options.session.weatherLabel}`,
    `氛围：${options.session.vibe}`,
    `当前轮次：第 ${options.session.currentRound} 轮`,
    `本轮出场角色：${selectedNames.join('、') || '暂无'}`,
    '',
    '## 用户',
    `用户名：${options.runtimeProjection.userName}`,
    options.latestUserMessage?.trim() ? `用户刚刚输入：${options.latestUserMessage.trim()}` : '用户这轮没有额外输入，只是在继续往下看。',
    '',
    '## 最近几轮内容',
    formatExistingRounds(options.existingRounds),
    '',
    '## 本轮调度',
    formatRoundPlan(options.roundPlan),
    '',
    ...buildCommonInfoSections(options),
    '',
    '## JSON 输出结构',
    '{',
    '  "card": {',
    '    "timeLabel": "字符串",',
    '    "locationLabel": "字符串",',
    '    "weatherLabel": "字符串",',
    '    "participantLabels": ["字符串"],',
    '    "objectiveLabel": "可选字符串",',
    '    "roundLabel": "字符串"',
    '  },',
    '  "intro": "可以为空字符串，若填写也只能是很短的承接句",',
    '  "rounds": [',
    '    {',
    '      "id": "唯一字符串",',
    '      "mode": "page_episode",',
    '      "title": "本轮标题",',
    '      "sceneText": "这轮页面内容对应的剧情摘要，用于主线衔接",',
    ...buildGroupOfflineScenarioSchemaLines(options.session, '      '),
    '      "pageEpisode": {',
    `        "pageType": "${pagePlan.pageType}",`,
    '        "title": "页面标题",',
    '        "subtitle": "页面副标题",',
    '        "caption": "页面补充说明，可选",',
    '        "htmlDocument": "完整 html 或可直接渲染的主体结构"',
    '      },',
    '      "characterEntries": []',
    '    }',
    '  ]',
    '}',
  ].filter(Boolean).join('\n');
}

function buildRoundPrompt(options: BuildGroupOfflinePromptOptions): string {
  const htmlPagePlan = resolveHtmlPagePlan(options);
  if (htmlPagePlan) {
    return buildHtmlRoundPrompt(options, htmlPagePlan);
  }

  const selectedCharacters = pickProjectionCharacters(options.runtimeProjection, options.selectedCharacterIds);
  const selectedNames = selectedCharacters.map((character) => character.identity.displayName);
  const scenarioRuleLines = buildGroupOfflineScenarioRoundRuleLines(options.session);
  const directorInstruction = resolveDirectorInstruction(options);
  const directorOverridesLength = hasExplicitLengthDirective(directorInstruction);

  return [
    '你现在要为一个“群聊线下场景页”生成下一轮推进内容。',
    '这不是普通群聊，也不是单人约会，而是多人在同一现场的线下局。',
    '',
    '硬性要求：',
    '1. 只输出 JSON，不要输出解释。',
    '2. 这次只生成一轮，rounds 数组里只能有 1 个 round。',
    '3. 当前玩法是：分块推进。',
    `4. 这一轮只写被调度到的角色：${selectedNames.join('、') || '暂无'}。他们要各自拥有独立角色块，不要把全场所有人都写进来。`,
    `5. 本轮调度方式：${options.dispatchMode === 'manual' ? '手动选人' : options.dispatchMode === 'random' ? '随机出场' : '系统推荐'}。如给了多个角色，顺序必须遵守：${selectedNames.join(' -> ') || '暂无'}。`,
    options.roundPlan ? '5.5. 下面会给你本轮调度。它只约束谁先出场、对谁出声，不替角色决定语气、主动性、占有欲、亲密尺度或表演力度。' : '',
    ...scenarioRuleLines,
    '6. 每个角色正文都要把动作、环境细节、语气和真正说出口的话写在同一段叙事里，不要只吐对白。',
    '7. 每个角色正文最好 2 到 4 段；highlightText 必须是 text 里已经出现过的一句台词，并且单独成段。',
    '8. 不要输出“这句话是说给谁听的”这类解释句，但可以通过 target 结构给 UI 提供信息。',
    '9. statusFields 只能从这一轮正文里长出来，不能凭空补新事实；固定只保留 4 个字段：状态、衣着、动作、心声，每个 value 控制在约 30 到 50 个汉字。',
    '10. 每个角色块还要补 3 个区域：notebook、aftereffects、memoryPanel。它们都必须像这个角色本人真的会留下来的东西。',
    '10.1 notebook 必须严格控制在 30 到 50 个汉字，不要写成一整段发散独白。',
    '10.2 aftereffects.items 固定输出 4 张卡，四张都必须由这次生成直接给出。',
    '10.3 memoryPanel.shortTerm 在当前这一轮只新增 1 条；只有累计短期记忆满 10 条时，longTerm 才允许输出 1 条总结。',
    '11. 人设优先：不要把所有角色写成同一口气，每个角色都要保留自己的表达习惯和边界。',
    '12. 文风只能改句子节奏、描写密度和镜头感，不得改变角色的主动性、边界和关系判断。',
    '13. 未参加这场线下的人不能突然在现场实体出现、说话、插嘴或被现场角色直接看见。',
    '14. 这一轮不要重新生成开局共景里已经定下来的 soundtrack 和 participantSoundtracks。',
    directorOverridesLength
      ? '15. 这次如果特殊指令明确要求了篇幅或字数，以特殊指令为准，不要再被外部默认字数上限截断。'
      : `15. 总字数控制在 ${Math.max(300, Math.min(options.session.maxGeneratedChars || 800, 2200))} 汉字以内。`,
    '',
    '## 当前局信息',
    `模式：${options.session.mode}`,
    '玩法：分块推进',
    `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
    options.session.scenePrompt?.trim() ? `背景/情景：${options.session.scenePrompt.trim()}` : '',
    `地点：${options.session.location}`,
    `时间：${options.session.timeLabel}`,
    `天气/世界状态：${options.session.weatherLabel}`,
    `氛围：${options.session.vibe}`,
    `当前轮次：第 ${options.session.currentRound} 轮`,
    `本轮出场角色：${selectedNames.join('、') || '暂无'}`,
    '',
    '## 用户',
    `用户名：${options.runtimeProjection.userName}`,
    options.latestUserMessage?.trim() ? `用户刚刚输入：${options.latestUserMessage.trim()}` : '用户这轮没有额外输入，只是在继续往下看。',
    '',
    '## 最近几轮内容',
    formatExistingRounds(options.existingRounds),
    '',
    '## 本轮调度',
    formatRoundPlan(options.roundPlan),
    '',
    ...buildCommonInfoSections(options),
    '',
    '## JSON 输出结构',
    '{',
    '  "card": {',
    '    "timeLabel": "字符串",',
    '    "locationLabel": "字符串",',
    '    "weatherLabel": "字符串",',
    '    "participantLabels": ["字符串"],',
    '    "objectiveLabel": "可选字符串",',
    '    "roundLabel": "字符串"',
    '  },',
    '  "intro": "可以为空字符串，若填写也只能是很短的承接句",',
    '  "rounds": [',
    '    {',
    '      "id": "唯一字符串",',
    '      "title": "本轮标题",',
    '      "sceneText": "这一轮的场景推进",',
    ...buildGroupOfflineScenarioSchemaLines(options.session, '      '),
    '      "characterEntries": [',
    '        {',
    '          "characterId": "角色 id",',
    '          "speakerLabel": "角色名",',
    '          "target": { "type": "user|character|group|scene", "label": "可选", "characterId": "可选" },',
    '          "text": "该角色这一轮的完整正文，允许分段",',
    '          "highlightText": "可选高亮句，而且这句话已经出现在 text 里，并且单独成段",',
    '          "statusFields": [',
    '            { "key": "state", "label": "状态", "value": "30到50字左右" }',
    '          ],',
    '          "notebook": "严格 30 到 50 个汉字，像角色自己的记事本",',
    '          "aftereffects": {',
    '            "searches": ["像活人会搜的内容", "第二条搜索"],',
    '            "items": [',
    '              { "sourceLabel": "相册/备忘录/音乐等来源", "actionText": "真实会出现的内容", "residueText": "这件事后面留下的一句余波" }',
    '            ]',
    '          },',
    '          "memoryPanel": {',
    '            "shortTerm": ["当前这一轮新增的 1 条具体记忆"],',
    '            "longTerm": ["只有累计满 10 条时才允许写 1 条长期总结"]',
    '          }',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
  ].filter(Boolean).join('\n');
}

export function buildGroupOfflinePrompt(options: BuildGroupOfflinePromptOptions): string {
  if ((options.phase || 'round') === 'intro') {
    return buildIntroPrompt(options);
  }

  return buildRoundPrompt(options);
}
