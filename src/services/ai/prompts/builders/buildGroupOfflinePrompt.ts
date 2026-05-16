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

type GroupOfflinePromptPhase = 'intro' | 'round';

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
};

function normalizeGenerationMode(mode: GroupOfflineSession['generationMode']): 'blocks' | 'ensemble' {
  return mode === 'ensemble' || mode === 'group' ? 'ensemble' : 'blocks';
}

function formatExistingRounds(rounds: GroupOfflineRound[] | undefined): string {
  if (!rounds || rounds.length === 0) {
    return '暂无已生成轮次。';
  }

  return rounds
    .slice(-4)
    .map((round, index) => {
      const lines = round.characterEntries
        .map((entry) => `- ${entry.speakerLabel}：${entry.text}`)
        .join('\n');

      return [
        `${index + 1}. ${round.title || `第 ${index + 1} 轮`}`,
        round.userMessageText ? `用户输入：${round.userMessageText}` : '',
        round.sceneText ? `场景推进：${round.sceneText}` : '',
        lines,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function formatRoundPlan(plan: GroupOfflineRoundPlan | undefined): string {
  if (!plan) return '暂无。';

  const dispatchLabel = plan.dispatchMode === 'manual'
    ? '手动选人'
    : plan.dispatchMode === 'random'
      ? '带权随机'
      : plan.dispatchMode === 'continue'
        ? '继续同场'
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
    '注意：这份规划只负责谁出场、顺序和目标对象，不替角色决定语气、主动性、占有欲、亲密尺度或态度强弱。',
  ].join('\n\n');
}

function buildParticipantNames(options: BuildGroupOfflinePromptOptions): string[] {
  return options.session.participants
    .map((participant) => findProjectionCharacter(options.runtimeProjection, participant.characterId)?.identity.displayName || '')
    .filter(Boolean);
}

function buildIntroPrompt(options: BuildGroupOfflinePromptOptions): string {
  const participantNames = buildParticipantNames(options);
  const groupStateSummary = formatProjectionGroupState(options.runtimeProjection);

  return [
    '你现在要为一个“群聊线下场景页”生成开场共景。',
    '这不是普通群聊，也不是单人约会，而是多人同场的线下现场。',
    '',
    '硬性要求：',
    '1. 只输出 JSON，不要输出解释。',
    '2. 这一步只负责共景、氛围、场景歌曲和全场角色推荐歌单，不要生成角色正文段落。',
    '3. intro 要有镜头感，要同时写到环境、在场角色之间的空气感和当下尚未说破的牵引。',
    '4. 不能把角色分开逐个长篇描写，这一步只是把现场铺开。',
    '5. 场景推荐歌曲不限制语种，可以是中文、韩文、泰文、英文或别的语言；只看这首歌和当前场景是否真的配得上。',
    '5.1 场景音乐里的歌词必须是这首歌里真实存在的原句短摘录，并且按行输出；如果拿不准真实歌词，就把 soundtrack.note 留空字符串，不要自己编歌词感句子。',
    '6. 文风只能改变句子节奏、描写密度、镜头感和措辞，不要把角色集体写成另一种人。',
    '7. 输出 JSON 结构：{"card": {...}, "intro": "...", "soundtrack": {...}, "participantSoundtracks": [...], "rounds": []}',
    '',
    '## 当前局信息',
    `模式：${options.session.mode}`,
    `玩法：${normalizeGenerationMode(options.session.generationMode) === 'blocks' ? '分块推进' : '同场群像'}`,
    `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
    options.session.scenePrompt?.trim() ? `情景：${options.session.scenePrompt.trim()}` : '',
    `地点：${options.session.location}`,
    `时间：${options.session.timeLabel}`,
    `天气/世界状态：${options.session.weatherLabel}`,
    `氛围：${options.session.vibe}`,
    `参与角色：${participantNames.join('、') || '暂无'}`,
    options.session.highlightColor?.trim() ? `高亮颜色：${options.session.highlightColor.trim()}` : '',
    '',
    '## 用户',
    `用户名：${options.runtimeProjection.userName}`,
    '',
    '## 角色资料',
    options.runtimeProjection.characters.map((character) => formatProjectionCharacterProfile(character)).join('\n\n'),
    '',
    options.worldBookPrompt?.trim()
      ? ['## 世界书', options.worldBookPrompt.trim()].join('\n')
      : '',
    groupStateSummary
      ? ['## 群线下运行时状态', groupStateSummary].join('\n')
      : '',
    options.session.writingStyleCustom?.trim()
      ? ['## 文风附加要求', options.session.writingStyleCustom.trim()].join('\n')
      : '',
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
    '    "note": "这首歌里真实存在的歌词原句短摘录；直接分行输出；拿不准就留空字符串；不要自己编歌词感句子；歌曲语种不限"',
    '  },',
    '  "participantSoundtracks": [',
    '    {',
    '      "characterId": "角色 id",',
    '      "characterName": "角色名",',
    '      "title": "该角色想推的歌",',
    '      "artist": "歌手",',
    '      "note": "这个角色会推这首歌的简短理由"',
    '    }',
    '  ],',
    '  "rounds": []',
    '}',
  ].filter(Boolean).join('\n');
}

function buildRoundPrompt(options: BuildGroupOfflinePromptOptions): string {
  const normalizedMode = normalizeGenerationMode(options.session.generationMode);
  const selectedCharacters = pickProjectionCharacters(options.runtimeProjection, options.selectedCharacterIds);
  const selectedNames = selectedCharacters.map((character) => character.identity.displayName);
  const groupStateSummary = formatProjectionGroupState(options.runtimeProjection);

  if (normalizedMode === 'ensemble') {
    return [
      '你现在要为一个“群聊线下场景页”生成下一轮同场群像推进内容。',
      '这不是普通群聊，也不是单人约会，而是多人同场的线下现场。',
      '',
      '硬性要求：',
      '1. 只输出 JSON，不要输出解释。',
      '2. 这次只生成一轮，rounds 数组里只能有 1 个 round。',
      '3. 当前玩法是：同场群像。',
      `4. 当前在场角色是：${selectedNames.join('、') || '暂无'}。这一轮必须写成同场群像的一篇连续正文，不要再按角色分块输出，也不要把正文拆成“角色1一块、角色2一块”。`,
      '5. round.articleParagraphs 才是主阅读正文。每个 paragraph 都是一段可直接阅读的小说式叙事，可以包含 0 到 N 句高亮台词。',
      '6. articleParagraphs 必须明显分段：一段最好控制在 1 到 3 句，或者一个自然动作/接话拍点。不要把整轮写成一整大段长墙。',
      '7. articleParagraphs 里的 text 必须把环境、动作、视线、停顿和真正说出口的话揉在同一段里，让多人自然接话、观察、打断、抢节奏，但不要平均分配戏份。',
      '7.1 角色真正说出口的话必须明确放进引号里，例如“...”或「...」；不要把角色说的话埋在叙述句里不加引号，也不要只写“他说了句什么”而不把原话给出来。',
      '8. articleParagraphs[].highlights 只负责机读标记：标出这段里谁说了哪句、对谁说。quote 必须是 text 里真实存在的原句，不要编台词，不要写成摘要句；同一段里只要有角色说话，就要把对应引号原句逐句标出来。',
      '8.1 每个 paragraph 还要补 focusCharacterIds 和 speakerCharacterIds，用来明确这段主要聚焦谁、谁在这一段开口，不要只靠 highlights 猜。',
      '9. 仍然要输出 characterEntries，但 characterEntries 不是主阅读正文，而是给侧栏和状态层用的本轮角色摘要。每个在场角色都要有 1 个 entry。',
      '9.1 characterEntries[].text 只用 2 到 3 句概括这个角色本轮最关键的动作、态度和一句真实话头，不要把整段 articleParagraphs 原文复制进去。',
      '9.2 characterEntries[].highlightText 必须是一句该角色在 articleParagraphs 里真实说过的话。',
      '10. statusFields 只能从这一轮正文里长出来，不能凭空补新的事实；固定只保留 4 个字段：状态、衣着、动作、心声，每个 value 维持在约 30 到 50 个汉字。',
      '11. 每个角色 entry 还要补 3 个区域：notebook（记事本）、aftereffects（事后痕迹）、memoryPanel（记忆）。这些都必须像这个角色本人真的会留下的东西。',
      '11.1 notebook 必须严格控制在 30 到 50 个汉字，少一字、多一字都不行，不要写成一整段发散独白。',
      '11.2 aftereffects.items 固定输出 4 张卡，四张都必须由这次生成直接给出，不要省略、不要拿搜索记录顶替、不要留给系统兜底补卡。',
      '11.3 memoryPanel.shortTerm 在当前这一轮只新增 1 条，而且必须记录这一轮发生过的具体事情，不要写“这一轮怎么了”“话没说透”“余温留下来”这种模板话；系统会跨轮累计展示，不是覆盖旧条目。',
      '11.4 当累计短期记忆满 10 条时，memoryPanel.longTerm 才允许输出 1 条总结，用来把这 10 条短期记忆归并成一件更长期的事；一旦归并，短期记忆池会清空重新开始累计。',
      '12. 人设优先：不要把所有角色写成一个腔调。每个角色的句词、停顿、动作偏好、表达强弱、对距离的态度，都要真正反映他自己的核心人设、表达风格、边界和近期状态。',
      '13. 文风只能改变句子节奏、描写密度、镜头感和措辞；不得改变角色主动性、占有欲、亲密尺度、说话力度、边界或人物关系判断。',
      '14. 未参加这场线下的人不能突然在现场实体出现、说话、嘲讽、插嘴或被现场角色直接看见。可以提群历史，但不能把没到场的人写进这一轮现场。',
      '15. 当前是多人同场群线下，默认仍是公开现场。除非这一轮用户输入、前文和角色边界都明确支撑，否则不要突然写搂腰、锁住、贴颈、耳边磨蹭、把人按进怀里这类过强身体动作。',
      '16. 这一步不要重新生成或改写开局共景时已经定下来的场景音乐和全场歌单；后续轮次沿用开局那一次，不要输出新的 soundtrack 或 participantSoundtracks。',
      `17. 总字数控制在 ${Math.max(300, Math.min(options.session.maxGeneratedChars || 800, 2200))} 汉字以内。`,
      '',
      '## 当前局信息',
      `模式：${options.session.mode}`,
      '玩法：同场群像',
      `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
      options.session.scenePrompt?.trim() ? `情景：${options.session.scenePrompt.trim()}` : '',
      `地点：${options.session.location}`,
      `时间：${options.session.timeLabel}`,
      `天气/世界状态：${options.session.weatherLabel}`,
      `氛围：${options.session.vibe}`,
      `当前轮次：第 ${options.session.currentRound} 轮`,
      `当前在场角色：${selectedNames.join('、') || '暂无'}`,
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
      '## 角色资料',
      options.runtimeProjection.characters.map((character) => formatProjectionCharacterProfile(character)).join('\n\n'),
      '',
      options.worldBookPrompt?.trim()
        ? ['## 世界书', options.worldBookPrompt.trim()].join('\n')
        : '',
      groupStateSummary
        ? ['## 群线下运行时状态', groupStateSummary].join('\n')
        : '',
      options.session.writingStyleCustom?.trim()
        ? ['## 当前固定文风要求', options.session.writingStyleCustom.trim()].join('\n')
        : '',
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
      '      "sceneText": "这一轮的场景推进，1到2句即可",',
      '      "articleParagraphs": [',
      '        {',
      '          "id": "段落 id",',
      '          "text": "连续小说正文段落",',
      '          "highlights": [',
      '            {',
      '              "characterId": "角色 id",',
      '              "speakerLabel": "角色名",',
      '              "quote": "这段里真实出现的台词原句",',
      '              "target": { "type": "user|character|group|scene", "label": "可选", "characterId": "可选" }',
      '            }',
      '          ],',
      '          "presentCharacterIds": ["出现在这段里的角色 id"],',
      '          "focusCharacterIds": ["这一段主要聚焦的角色 id"],',
      '          "speakerCharacterIds": ["这一段实际开口的角色 id"]',
      '        }',
      '      ],',
      '      "characterEntries": [',
      '        {',
      '          "characterId": "角色 id",',
      '          "speakerLabel": "角色名",',
      '          "target": { "type": "user|character|group|scene", "label": "可选", "characterId": "可选" },',
      '          "text": "这个角色本轮的短摘要，不是主正文",',
      '          "highlightText": "该角色在 articleParagraphs 里真实说过的一句台词",',
      '          "statusFields": [',
      '            { "key": "state", "label": "状态", "value": "30到50字左右" }',
      '          ],',
      '          "notebook": "严格 30 到 50 个汉字；像角色自己的记事本，不要写成系统总结",',
      '          "aftereffects": {',
      '            "searches": ["像活人会搜的内容", "第二条搜索"],',
      '            "items": [',
      '              { "sourceLabel": "相册/备忘录/网易云音乐等具体来源", "actionText": "要写成真实会出现在这个来源里的具体内容，不要写概括句", "residueText": "再补一句角色自己的余波心思" }',
      '            ]',
      '          },',
      '          "memoryPanel": {',
      '            "shortTerm": ["当前这一轮新增的 1 条具体记忆，系统会跨轮累计显示"],',
      '            "longTerm": ["只有累计短期记忆满 10 条时才输出 1 条总结；未满 10 条就留空"]',
      '          }',
      '        }',
      '      ]',
      '    }',
      '  ]',
      '}',
    ].filter(Boolean).join('\n');
  }

  return [
    '你现在要为一个“群聊线下场景页”生成下一轮推进内容。',
    '这不是普通群聊，也不是单人约会，而是多人同场的线下现场。',
    '',
    '硬性要求：',
    '1. 只输出 JSON，不要输出解释。',
    '2. 这次只生成一轮，rounds 数组里只能有 1 个 round。',
    `3. 当前玩法是：${normalizedMode === 'blocks' ? '分块推进' : '同场群像'}`,
    normalizedMode === 'blocks'
      ? `4. 这一轮只写被调度到的角色：${selectedNames.join('、') || '暂无'}。他们要各自拥有独立角色块，不要把全场所有人都写进来。`
      : '4. 这一轮是同场群像推进，要保留多人同场的流动感，让在场角色都能自然参与。',
    normalizedMode === 'blocks'
      ? `5. 本轮调度方式：${options.dispatchMode === 'manual' ? '手动选人' : options.dispatchMode === 'random' ? '带权随机' : '系统推荐'}。如果给了多个角色，顺序必须遵守：${selectedNames.join(' -> ') || '暂无'}。`
      : '5. 同场群像里允许角色彼此接话，但不要平均分配戏份。',
    options.roundPlan
      ? '5.5. 下面会给你本轮调度。它只约束谁先出场、对谁出声，不替角色决定语气、主动性、占有欲、亲密尺度或表演力度。'
      : '',
    '6. 每个角色正文都要把动作、环境细节、语气和真正说出口的话写在同一段叙事里，不要只吐对白。',
    '7. 每个角色正文最好 2 到 4 段，highlightText 必须是一句已经出现在 text 里的高亮台词，并且这句台词要单独成一段，不要和说明句混在同一行。',
    '8. 不要输出“这句话是说给谁听的”这种解释句，但可以通过 target 结构给 UI 提供胶囊信息。',
    '9. statusFields 只能从这一轮正文里长出来，不能凭空补新的事实；固定只保留 4 个字段：状态、衣着、动作、心声，每个 value 维持在约 30 到 50 个汉字。',
    '10. 每个角色块还要补 3 个区域：notebook（记事本）、aftereffects（事后痕迹）、memoryPanel（记忆）。这些也都必须像这个角色本人真的会留下的东西。',
    '10.1 notebook 必须严格控制在 30 到 50 个汉字，少一字、多一字都不行，不要写成一整段发散独白。',
    '10.2 aftereffects.items 固定输出 4 张卡，四张都必须由这次生成直接给出，不要省略、不要拿搜索记录顶替、不要留给系统兜底补卡。',
    '10.3 memoryPanel.shortTerm 在当前这一轮只新增 1 条，而且必须记录这一轮发生过的具体事情，不要写“这一轮怎么了”“话没说透”“余温留下来”这种模板话；系统会跨轮累计展示，不是覆盖旧条目。',
    '10.4 当累计短期记忆满 10 条时，memoryPanel.longTerm 才允许输出 1 条总结，用来把这 10 条短期记忆归并成一件更长期的事；一旦归并，短期记忆池会清空重新开始累计。',
    '11. 人设优先：不要把所有角色写成一个腔调。每个角色的句词、停顿、动作偏好、表达强弱、对距离的态度，都要真正反映他自己的核心人设、表达风格、边界和近期状态。',
    '12. 文风只能改变句子节奏、描写密度、镜头感和措辞；不得改变角色主动性、占有欲、亲密尺度、说话力度、边界或人物关系判断。',
    '13. 未参加这场线下的人不能突然在现场实体出现、说话、嘲讽、插嘴或被现场角色直接看见。可以提群历史，但不能把没到场的人写进这一轮现场。',
    '14. 当前是多人同场群线下，默认仍是公开现场。除非这一轮用户输入、前文和角色边界都明确支撑，否则不要突然写搂腰、锁住、贴颈、耳边磨蹭、把人按进怀里这类过强身体动作。',
    '15. 这一步不要重新生成或改写开局共景时已经定下来的场景音乐和全场歌单；后续轮次沿用开局那一次，不要输出新的 soundtrack 或 participantSoundtracks。',
    `16. 总字数控制在 ${Math.max(300, Math.min(options.session.maxGeneratedChars || 800, 2200))} 汉字以内。`,
    '',
    '## 当前局信息',
    `模式：${options.session.mode}`,
    `玩法：${normalizedMode === 'blocks' ? '分块推进' : '同场群像'}`,
    `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
    options.session.scenePrompt?.trim() ? `情景：${options.session.scenePrompt.trim()}` : '',
    `地点：${options.session.location}`,
    `时间：${options.session.timeLabel}`,
    `天气/世界状态：${options.session.weatherLabel}`,
    `氛围：${options.session.vibe}`,
    `当前轮次：第 ${options.session.currentRound} 轮`,
    normalizedMode === 'blocks' ? `本轮出场角色：${selectedNames.join('、') || '暂无'}` : '',
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
    '## 角色资料',
    options.runtimeProjection.characters.map((character) => formatProjectionCharacterProfile(character)).join('\n\n'),
    '',
    options.worldBookPrompt?.trim()
      ? ['## 世界书', options.worldBookPrompt.trim()].join('\n')
      : '',
    groupStateSummary
      ? ['## 群线下运行时状态', groupStateSummary].join('\n')
      : '',
    options.session.writingStyleCustom?.trim()
      ? ['## 当前固定文风要求', options.session.writingStyleCustom.trim()].join('\n')
      : '',
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
    '      "characterEntries": [',
    '        {',
    '          "characterId": "角色 id",',
    '          "speakerLabel": "角色名",',
    '          "target": { "type": "user|character|group|scene", "label": "可选", "characterId": "可选" },',
    '          "text": "该角色这一轮的完整正文，允许分段",',
    '          "highlightText": "可选高亮句，且这句话已经出现在 text 里，并单独成段",',
    '          "statusFields": [',
    '            { "key": "state", "label": "状态", "value": "30到50字左右" }',
    '          ],',
    '          "notebook": "严格 30 到 50 个汉字；像角色自己的记事本，不要写成系统总结",',
    '          "aftereffects": {',
    '            "searches": ["像活人会搜的内容", "第二条搜索"],',
    '            "items": [',
    '              { "sourceLabel": "相册/备忘录/网易云音乐等具体来源", "actionText": "要写成真实会出现在这个来源里的具体内容，不要写概括句", "residueText": "再补一句角色自己的余波心思" }',
    '            ]',
    '          },',
    '          "memoryPanel": {',
    '            "shortTerm": ["当前这一轮新增的 1 条具体记忆，系统会跨轮累计显示"],',
    '            "longTerm": ["只有累计短期记忆满 10 条时才输出 1 条总结；未满 10 条就留空"]',
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
