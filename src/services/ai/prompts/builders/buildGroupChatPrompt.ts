import type { GroupChatSceneInput } from '../../../scene-inputs/buildGroupChatSceneInput';
import { GROUP_CHAT_SCENARIO_PROMPT } from '../scenarios/groupChat';

export type BuildGroupChatPromptOptions = {
  sceneInput: GroupChatSceneInput;
};

function buildRecentContextBlock(sceneInput: GroupChatSceneInput): string {
  const lines = [
    sceneInput.recentContext?.shortTermSummary
      ? `近期关系余波：${sceneInput.recentContext.shortTermSummary}`
      : '',
    sceneInput.recentContext?.publicAcquaintanceSummary
      ? `公开认识与群内连续性：${sceneInput.recentContext.publicAcquaintanceSummary}`
      : '',
    sceneInput.recentContext?.sharedRecentRelationshipSummary
      ? `跨场景共享关系余波：${sceneInput.recentContext.sharedRecentRelationshipSummary}`
      : '',
    sceneInput.recentContext?.longTermMemoryProfile
      ? `长期记忆印象：${sceneInput.recentContext.longTermMemoryProfile}`
      : '',
    sceneInput.recentContext?.temporalContext
      ? sceneInput.recentContext.temporalContext
      : '',
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
    '这些资料的作用是帮你决定这句该怎么说、该亲近还是克制、该不该接这个话题。',
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
    GROUP_CHAT_SCENARIO_PROMPT,
    '',
    '当前角色资料：',
    `角色名字：${sceneInput.speakerName}`,
    `核心人设：${sceneInput.speakerCorePersona || '未提供'}`,
    sceneInput.speakerSignature ? `个性签名：${sceneInput.speakerSignature}` : '',
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
