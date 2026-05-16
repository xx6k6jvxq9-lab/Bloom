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

export type GroupOfflineRoundRewriteMode = 'style_preset' | 'custom_style' | 'retry_round';

type BuildGroupOfflineRoundRewritePromptOptions = {
  mode: GroupOfflineRoundRewriteMode;
  session: GroupOfflineSession;
  round: GroupOfflineRound;
  runtimeProjection: GroupOfflineRuntimeProjection;
  previousRounds?: GroupOfflineRound[];
  stylePresetId?: GroupOfflineStylePresetId;
  customStyleText?: string;
  roundPlan?: GroupOfflineRoundPlan;
};

function normalizeGenerationMode(mode: GroupOfflineSession['generationMode']): 'blocks' | 'ensemble' {
  return mode === 'ensemble' || mode === 'group' ? 'ensemble' : 'blocks';
}

function formatPreviousRounds(rounds: GroupOfflineRound[] | undefined, currentRoundId: string): string {
  const filtered = (rounds || []).filter((round) => round.id !== currentRoundId);
  if (filtered.length === 0) {
    return '暂无前文。';
  }

  return filtered
    .slice(-3)
    .map((round, index) => {
      const entries = round.characterEntries.map((entry) => `- ${entry.speakerLabel}：${entry.text}`).join('\n');
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
    round.userMessageText ? `对应用户输入：${round.userMessageText}` : '',
    round.sceneText ? `场景推进：${round.sceneText}` : '',
    ...round.characterEntries.map((entry) => [
      `角色：${entry.speakerLabel}`,
      entry.target?.label ? `target：${entry.target.label}` : '',
      `正文：${entry.text}`,
      entry.highlightText ? `高亮句：${entry.highlightText}` : '',
      entry.statusFields.length > 0
        ? ['状态栏：', ...entry.statusFields.map((field) => `- ${field.label}：${field.value}`)].join('\n')
        : '',
      entry.notebook?.trim() ? `记事本：${entry.notebook.trim()}` : '',
      entry.aftereffects?.searches?.length
        ? ['搜索记录：', ...entry.aftereffects.searches.map((item) => `- ${item}`)].join('\n')
        : '',
      entry.aftereffects?.items?.length
        ? ['事后痕迹：', ...entry.aftereffects.items.map((item) => `- ${item.sourceLabel}：${item.actionText} / ${item.residueText}`)].join('\n')
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

function formatCurrentRoundArticle(round: GroupOfflineRound): string {
  if (!round.articleParagraphs?.length) {
    return '当前轮主正文：暂无。';
  }

  return [
    '当前轮主正文：',
    ...round.articleParagraphs.map((paragraph, index) => [
      `段落 ${index + 1}：${paragraph.text}`,
      paragraph.focusCharacterIds?.length
        ? `聚焦角色：${paragraph.focusCharacterIds.join('、')}`
        : '',
      paragraph.speakerCharacterIds?.length
        ? `开口角色：${paragraph.speakerCharacterIds.join('、')}`
        : '',
      paragraph.highlights.length > 0
        ? ['高亮标记：', ...paragraph.highlights.map((highlight) => (
          `- ${highlight.speakerLabel}${highlight.target?.label ? ` -> ${highlight.target.label}` : ''}：${highlight.quote}`
        ))].join('\n')
        : '',
    ].filter(Boolean).join('\n')),
  ].join('\n');
}

export function buildGroupOfflineRoundRewritePrompt(
  options: BuildGroupOfflineRoundRewritePromptOptions,
): string {
  const stylePreset = options.stylePresetId
    ? getGroupOfflineStylePreset(options.stylePresetId)
    : undefined;
  const customStyleText = options.customStyleText?.trim() || '';
  const selectedNames = options.round.characterEntries.map((entry) => entry.speakerLabel).join('、');
  const groupStateSummary = formatProjectionGroupState(options.runtimeProjection);
  const roundProfiles = options.round.characterEntries
    .map((entry) => findProjectionCharacter(options.runtimeProjection, entry.characterId))
    .filter(Boolean)
    .map((character) => formatProjectionCharacterProfile(character));

  if (normalizeGenerationMode(options.session.generationMode) === 'ensemble') {
    return [
      options.mode === 'style_preset' || options.mode === 'custom_style'
        ? '你现在要重写群聊线下里的当前同场群像轮，只改文风，不改事件。'
        : '你现在要重试群聊线下里的当前同场群像轮，在保持前文连续的前提下重生成这一轮。',
      '这不是普通群聊，也不是单人约会，而是多人同场的群线下。',
      '',
      '硬性要求：',
      '1. 只输出 JSON，不要解释，不要 markdown。',
      '2. 只处理当前轮，不要改前面的轮次。',
      '3. 保留当前轮的在场角色、玩法、用户输入和基本事件事实。',
      '4. 这轮仍然是“同场群像”，不要改成分块推进，也不要把正文拆成“角色1一块、角色2一块”。',
      '5. 主阅读正文必须继续输出在 round.articleParagraphs 里；它是一篇连续小说正文，不是角色块列表。',
      '6. articleParagraphs 必须明显分段：一段最好控制在 1 到 3 句，或者一个自然动作/接话拍点。不要把整轮压成一整大段长墙。',
      '6.1 角色真正说出口的话必须明确放进引号里，例如“...”或「...」；不要把角色说的话埋在叙述句里不加引号，也不要只写“他说了句什么”而不把原话给出来。',
      '7. articleParagraphs[].highlights 只负责机读标记：标出这段里谁说了哪句、对谁说。quote 必须是 text 里真实存在的原句；同一段里只要有角色说话，就要把对应引号原句逐句标出来。',
      '7.1 每个 paragraph 还要补 focusCharacterIds 和 speakerCharacterIds，用来明确这段主要聚焦谁、谁在这一段开口，不要只靠 highlights 猜。',
      '8. characterEntries 仍然要保留，但它们不是主正文，而是给侧栏/状态层用的本轮角色摘要。每个在场角色都要有 1 个 entry。',
      '8.1 characterEntries[].text 只用 2 到 3 句概括这个角色本轮最关键的动作、态度和一句真实话头，不要把 articleParagraphs 整段复制进去。',
      '8.2 characterEntries[].highlightText 必须是一句该角色在 articleParagraphs 里真实说过的话。',
      '9. statusFields 固定只保留 4 个字段：状态、衣着、动作、心声，且每个字段控制在 30 到 50 个汉字。',
      '9.5. notebook 必须严格控制在 30 到 50 个汉字，少一字、多一字都不行；memoryPanel.shortTerm 在当前这一轮只新增 1 条，并且必须记录这一轮发生过的具体事情，不要写“这一轮怎么了”“话没说透”“余温留下来”这种模板话；系统会跨轮累计展示，不是覆盖旧条目。',
      options.mode === 'style_preset' || options.mode === 'custom_style'
        ? '10. 这次的目标是换写法，不换剧情，不要把已有动作、场面关系和事件结果改掉。'
        : '10. 这次的目标是重试这一轮：可以换细节、换措辞、换推进落点，但不要改前文成立的条件。',
      '10.5. aftereffects.items 固定输出 4 张卡，四张都必须由这次重写直接给出，不要省略、不要留给系统兜底补卡。',
      '10.6. 只有当累计短期记忆满 10 条时，memoryPanel.longTerm 才允许输出 1 条总结；未满 10 条时 longTerm 置空。归并完成后，短期记忆池会清空重新累计。',
      '11. 人设优先：不要把全部角色换成同一种说话手感。重写后的句子、停顿、话里的力度和动作偏好，要真正反映角色的核心人设、表达风格、边界和近期状态。',
      '12. 文风只能改变句子节奏、描写密度、镜头感和措辞；不得改变角色主动性、占有欲、亲密尺度、说话力度、边界或人物关系判断。',
      '13. 未参加这场线下的人不能突然在现场实体出现、说话、嘲讽、插嘴或被现场角色直接看见。',
      '14. 当前是多人同场群线下，默认仍是公开现场。除非前文和角色边界都明确支撑，否则不要突然写过强身体动作或过浓私密占有场面。',
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
      '',
      '## 当前局信息',
      `模式：${options.session.mode}`,
      '玩法：同场群像',
      `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
      `地点：${options.session.location}`,
      `时间：${options.session.timeLabel}`,
      `天气/世界状态：${options.session.weatherLabel}`,
      `氛围：${options.session.vibe}`,
      `当前轮角色：${selectedNames || '暂无'}`,
      '',
      '## 用户',
      `用户名：${options.runtimeProjection.userName}`,
      '',
      '## 前文（不要改写，只用于衔接）',
      formatPreviousRounds(options.previousRounds, options.round.id),
      '',
      '## 当前轮原文',
      formatCurrentRoundArticle(options.round),
      '',
      '## 当前轮角色侧栏数据',
      formatCurrentRound(options.round),
      '',
      options.roundPlan?.characterSteps?.length
        ? [
            '## 当前轮原始调度',
            `调度摘要：${options.roundPlan.summary}`,
            ...options.roundPlan.characterSteps.map((step, index) => `${index + 1}. ${step.speakerLabel} -> ${step.target.label}`),
            '这份调度只约束同场时更偏向谁、对谁出声，不替角色决定语气、主动性、占有欲、亲密尺度或表演力度。',
          ].join('\n')
        : '',
      '',
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
      '    "sceneText": "当前轮场景推进，1到2句即可",',
      '    "articleParagraphs": [',
      '      {',
      '        "id": "段落 id",',
      '        "text": "连续小说正文段落",',
      '        "highlights": [',
      '          {',
      '            "characterId": "角色 id",',
      '            "speakerLabel": "角色名",',
      '            "quote": "这段里真实出现的台词原句",',
      '            "target": { "type": "user|character|group|scene", "label": "可选", "characterId": "可选" }',
      '          }',
      '        ],',
      '        "presentCharacterIds": ["出现在这段里的角色 id"],',
      '        "focusCharacterIds": ["这一段主要聚焦的角色 id"],',
      '        "speakerCharacterIds": ["这一段实际开口的角色 id"]',
      '      }',
      '    ],',
      '    "characterEntries": [',
      '      {',
      '        "characterId": "角色 id",',
      '        "speakerLabel": "角色名",',
      '        "target": { "type": "user|character|group|scene", "label": "可选", "characterId": "可选" },',
      '        "text": "这个角色本轮的短摘要，不是主正文",',
      '        "highlightText": "该角色在 articleParagraphs 里真实说过的一句台词",',
      '        "statusFields": [',
      '          { "key": "state", "label": "状态", "value": "30到50字左右" }',
      '        ],',
      '        "notebook": "严格 30 到 50 个汉字，像角色本人会记下来的内容",',
      '        "aftereffects": {',
      '          "searches": ["活人会搜的内容"],',
      '          "items": [',
      '            { "sourceLabel": "相册/备忘录/网易云音乐等来源", "actionText": "真实会出现在这个来源里的具体内容", "residueText": "这件事后面残留的一句心思" }',
      '          ]',
      '        },',
      '        "memoryPanel": {',
      '          "shortTerm": ["当前这一轮新增的 1 条具体记忆，系统会跨轮累计显示"],',
      '          "longTerm": ["只有累计短期记忆满 10 条时才输出 1 条总结；未满 10 条就留空"]',
      '        }',
      '      }',
      '    ]',
      '  }',
      '}',
    ].filter(Boolean).join('\n');
  }

  return [
    options.mode === 'style_preset' || options.mode === 'custom_style'
      ? '你现在要重写群聊线下里的当前轮，只改文风，不改事件。'
      : '你现在要重试群聊线下里的当前轮，在保持前文连续的前提下重生成这一轮。',
    '这不是普通群聊，也不是单人约会，而是多人同场的群线下。',
    '',
    '硬性要求：',
    '1. 只输出 JSON，不要解释，不要 markdown。',
    '2. 只处理当前轮，不要改前面的轮次。',
    '3. 保留当前轮的出场角色、出场顺序、玩法、用户输入和基本事件事实。',
    '4. 不要增删角色，不要把分块推进改成同场群像，也不要反过来。',
    '5. 每个角色块仍要输出 text / highlightText / statusFields / notebook / aftereffects / memoryPanel。',
    '6. highlightText 必须仍然是 text 里已经出现过的一句台词，并且单独成段。',
    '7. statusFields 固定只保留 4 个字段：状态、衣着、动作、心声，且每个字段控制在 30 到 50 个汉字。',
    '7.5. notebook 必须严格控制在 30 到 50 个汉字，少一字、多一字都不行；memoryPanel.shortTerm 在当前这一轮只新增 1 条，并且必须记录这一轮发生过的具体事情，不要写“这一轮怎么了”“话没说透”“余温留下来”这种模板话；系统会跨轮累计展示，不是覆盖旧条目。',
    options.mode === 'style_preset' || options.mode === 'custom_style'
      ? '8. 这次的目标是换写法，不换剧情，不要把已有动作、场面关系和事件结果改掉。'
      : '8. 这次的目标是重试这一轮：可以换细节、换措辞、换推进落点，但不要改前文成立的条件。',
    '8.5. aftereffects.items 固定输出 4 张卡，四张都必须由这次重写直接给出，不要省略、不要留给系统兜底补卡。',
    '8.6. 只有当累计短期记忆满 10 条时，memoryPanel.longTerm 才允许输出 1 条总结；未满 10 条时 longTerm 置空。归并完成后，短期记忆池会清空重新累计。',
    '9. 人设优先：不要把全部角色换成同一种说话手感。重写后的句子、停顿、话里的力度和动作偏好，要真正反映角色的核心人设、表达风格、边界和近期状态。',
    '10. 文风只能改变句子节奏、描写密度、镜头感和措辞；不得改变角色主动性、占有欲、亲密尺度、说话力度、边界或人物关系判断。',
    '11. 未参加这场线下的人不能突然在现场实体出现、说话、嘲讽、插嘴或被现场角色直接看见。',
    '12. 当前是多人同场群线下，默认仍是公开现场。除非前文和角色边界都明确支撑，否则不要突然写过强身体动作或过浓私密占有场面。',
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
    '',
    '## 当前局信息',
    `模式：${options.session.mode}`,
    `玩法：${options.session.generationMode === 'ensemble' || options.session.generationMode === 'group' ? '同场群像' : '分块推进'}`,
    `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
    `地点：${options.session.location}`,
    `时间：${options.session.timeLabel}`,
    `天气/世界状态：${options.session.weatherLabel}`,
    `氛围：${options.session.vibe}`,
    `当前轮角色：${selectedNames || '暂无'}`,
    '',
    '## 用户',
    `用户名：${options.runtimeProjection.userName}`,
    '',
    '## 前文（不要改写，只用于衔接）',
    formatPreviousRounds(options.previousRounds, options.round.id),
    '',
    '## 当前轮原文',
    formatCurrentRound(options.round),
    '',
    options.roundPlan?.characterSteps?.length
      ? [
          '## 当前轮原始调度',
          `调度摘要：${options.roundPlan.summary}`,
          ...options.roundPlan.characterSteps.map((step, index) => `${index + 1}. ${step.speakerLabel} -> ${step.target.label}`),
          '这份调度只约束谁出场、顺序和目标对象，不替角色决定语气、主动性、占有欲、亲密尺度或表演力度。',
        ].join('\n')
      : '',
    '',
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
    '    "characterEntries": [',
    '      {',
    '        "characterId": "角色 id",',
    '        "speakerLabel": "角色名",',
    '        "target": { "type": "user|character|group|scene", "label": "可选", "characterId": "可选" },',
    '        "text": "该角色这一轮完整正文",',
    '        "highlightText": "已出现在 text 里的高亮台词",',
    '        "statusFields": [',
    '          { "key": "state", "label": "状态", "value": "30到50字左右" }',
    '        ],',
    '        "notebook": "严格 30 到 50 个汉字，像角色本人会记下来的内容",',
    '        "aftereffects": {',
    '          "searches": ["活人会搜的内容"],',
    '          "items": [',
    '            { "sourceLabel": "相册/备忘录/网易云音乐等来源", "actionText": "真实会出现在这个来源里的具体内容", "residueText": "这件事后面残留的一句心思" }',
    '          ]',
    '        },',
    '        "memoryPanel": {',
    '          "shortTerm": ["当前这一轮新增的 1 条具体记忆，系统会跨轮累计显示"],',
    '          "longTerm": ["只有累计短期记忆满 10 条时才输出 1 条总结；未满 10 条就留空"]',
    '        }',
    '      }',
    '    ]',
    '  }',
    '}',
  ].filter(Boolean).join('\n');
}
