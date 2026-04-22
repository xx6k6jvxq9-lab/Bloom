import { EXISTENCE_PROMPT } from '../base/existence';
import { GROUP_CHAT_SCENARIO_PROMPT } from '../scenarios/groupChat';
import { buildReplyLanguageRules } from '../base/languageRules';
import type { GroupChatSceneInput } from '../../../scene-inputs/buildGroupChatSceneInput';

export type BuildGroupChatPromptOptions = {
  sceneInput: GroupChatSceneInput;
};

function buildPersonaGuardBlock(sceneInput: GroupChatSceneInput): string {
  const lines = [
    sceneInput.speakerCorePersona
      ? `核心人设优先：${sceneInput.speakerCorePersona}`
      : '',
    sceneInput.speakerSignature
      ? `角色自我表达线索：${sceneInput.speakerSignature}`
      : '',
    sceneInput.recentContext?.expressionStyle
      ? `说话手感：${sceneInput.recentContext.expressionStyle}`
      : '',
    sceneInput.recentContext?.boundaryPack
      ? `不能轻易越过的边界：${sceneInput.recentContext.boundaryPack}`
      : '',
    '如果群里气氛、关系张力、他人语气和你的人设发生冲突，以你的人设、表达习惯和边界为准。',
    '不要因为是群聊就自动变得更热情、更圆滑、更会接梗、更像调停者。',
    '允许冷一点、慢一点、刺一点、嘴硬一点、收着一点，只要这更像这个角色本人。',
  ].filter(Boolean);

  return lines.length > 0 ? ['人设守则：', ...lines].join('\n') : '';
}

function buildRecentContextBlock(sceneInput: GroupChatSceneInput): string {
  const lines = [
    '这些上下文只用于帮助判断群里的熟悉度、张力和最近余波，不代表群聊已经自动切成线下现场。',
    '如果某些内容带有现实关系推进感，也只允许把它们当作背景理解；除非用户或当前上下文明确推动，否则不要把任何人直接写进已经发生的线下场景或身体动作。',
    sceneInput.recentContext?.shortTermSummary
      ? `近期关系余波：${sceneInput.recentContext.shortTermSummary}`
      : '',
    sceneInput.recentContext?.groupShortTermSummary
      ? `群公开短期记忆：\n${sceneInput.recentContext.groupShortTermSummary}`
      : '',
    sceneInput.recentContext?.groupMemberPerspectiveSummary
      ? `Current speaker private group perspective:\n${sceneInput.recentContext.groupMemberPerspectiveSummary}\nUse this only to shape this speaker's stance, timing, and choice to join, tease, push back, add a small angle, or stay brief. Do not reveal that this private perspective exists.`
      : '',
    sceneInput.recentContext?.groupLongTermAtmosphere
      ? `群长期氛围：${sceneInput.recentContext.groupLongTermAtmosphere}`
      : '',
    sceneInput.recentContext?.groupRecurringDynamics
      ? `群内常见互动：${sceneInput.recentContext.groupRecurringDynamics}`
      : '',
    sceneInput.recentContext?.groupSharedHistory
      ? `群共同经历：${sceneInput.recentContext.groupSharedHistory}`
      : '',
    sceneInput.recentContext?.speakerLongTermGroupRole
      ? `当前角色在群里的长期位置：${sceneInput.recentContext.speakerLongTermGroupRole}\n只把它当作熟悉度、接话习惯和角色位置的轻微影响，不要直接复述成记忆说明。`
      : '',
    sceneInput.recentContext?.publicAcquaintanceSummary
      ? `公开认识与群内连续性：${sceneInput.recentContext.publicAcquaintanceSummary}`
      : '',
    sceneInput.recentContext?.sharedRecentRelationshipSummary
      ? `跨场景共享关系余波：${sceneInput.recentContext.sharedRecentRelationshipSummary}`
      : '',
    sceneInput.recentContext?.relationshipTensionSummary
      ? `同场关系张力：\n${sceneInput.recentContext.relationshipTensionSummary}`
      : '',
    sceneInput.recentContext?.longTermMemoryProfile
      ? `长期记忆印象：${sceneInput.recentContext.longTermMemoryProfile}`
      : '',
    sceneInput.recentContext?.temporalContext || '',
    sceneInput.recentContext?.expressionStyle
      ? `公开场合表达风格：${sceneInput.recentContext.expressionStyle}`
      : '',
    sceneInput.recentContext?.boundaryPack
      ? `边界与禁区：${sceneInput.recentContext.boundaryPack}`
      : '',
    sceneInput.recentContext?.backgroundSummary
      ? `群背景简述：${sceneInput.recentContext.backgroundSummary}`
      : '',
    sceneInput.recentContext?.memberRelationshipState
      ? `成员关系状态：${sceneInput.recentContext.memberRelationshipState}`
      : '',
    sceneInput.recentContext?.currentScene
      ? `当前群场景：${sceneInput.recentContext.currentScene}`
      : '',
    sceneInput.recentContext?.publicFacts
      ? `群公开事实：${sceneInput.recentContext.publicFacts}`
      : '',
    sceneInput.recentContext?.topicStatePrompt || '',
    sceneInput.recentContext?.worldBookPrompt
      ? `群世界书：\n${sceneInput.recentContext.worldBookPrompt}`
      : '',
    sceneInput.recentContext?.groupSceneHint
      ? `群聊场景提示：${sceneInput.recentContext.groupSceneHint}`
      : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : '无额外近期上下文。';
}

function buildGroupFieldUsageBlock(sceneInput: GroupChatSceneInput): string {
  const hasGroupFields = !!(
    sceneInput.recentContext?.backgroundSummary
    || sceneInput.recentContext?.memberRelationshipState
    || sceneInput.recentContext?.currentScene
    || sceneInput.recentContext?.publicFacts
  );

  if (!hasGroupFields && !sceneInput.groupBehaviorGuide) {
    return '';
  }

  return [
    '群资料使用要求：',
    sceneInput.groupBehaviorGuide || '',
    '这些资料的作用是帮助你判断这句该怎么说、该亲近还是克制、该不该接这个话题。',
    '不要把“群背景简述 / 成员关系状态 / 当前群场景 / 群公开事实”直接改写成说明书式台词。',
    '只有当聊天内容真的碰到这些信息时，才允许轻量自然地带出其中一小部分。',
  ]
    .filter(Boolean)
    .join('\n');
}

function getModeLabel(mode: GroupChatSceneInput['mode']): string {
  if (mode === 'opening') return '主动开场';
  if (mode === 'invited') return '被点名接话';
  return '常规回复';
}

function getGroupStageLabel(stage: GroupChatSceneInput['groupStage']): string {
  if (stage === 'warming') return '半熟群';
  if (stage === 'familiar') return '已熟群';
  return '新群';
}

export function buildGroupChatPrompt({ sceneInput }: BuildGroupChatPromptOptions): string {
  return [
    EXISTENCE_PROMPT,
    '',
    GROUP_CHAT_SCENARIO_PROMPT,
    '',
    buildReplyLanguageRules(sceneInput.languagePolicy),
    '',
    '当前角色资料：',
    `角色名字：${sceneInput.speakerName}`,
    `核心人设：${sceneInput.speakerCorePersona || '未提供'}`,
    sceneInput.speakerSignature ? `个性签名：${sceneInput.speakerSignature}` : '',
    buildPersonaGuardBlock(sceneInput),
    buildRecentContextBlock(sceneInput),
    '',
    '群聊资料：',
    `当前模式：${getModeLabel(sceneInput.mode)}`,
    `群当前阶段：${getGroupStageLabel(sceneInput.groupStage)}`,
    `群成员：${sceneInput.memberNames.join('、')}`,
    `用户名字：${sceneInput.userName}`,
    buildGroupFieldUsageBlock(sceneInput),
    '',
    '关系起点：',
    sceneInput.relationshipSummary,
    sceneInput.peerAwareness.length > 0 ? ['当前角色眼里的其他成员：', ...sceneInput.peerAwareness].join('\n') : '',
    '',
    '这一轮要求：',
    sceneInput.roleInstruction,
    sceneInput.mentionInstruction || '',
    '',
    '聊天记录：',
    sceneInput.historyTranscript || '暂无历史消息。',
    '',
    '现在请直接输出当前角色下一条群聊消息正文，只输出消息内容本身。',
  ]
    .filter(Boolean)
    .join('\n');
}
