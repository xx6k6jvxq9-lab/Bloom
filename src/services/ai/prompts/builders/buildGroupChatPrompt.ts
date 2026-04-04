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
    sceneInput.recentContext?.longTermMemoryProfile
      ? `长期关系印象：${sceneInput.recentContext.longTermMemoryProfile}`
      : '',
    sceneInput.recentContext?.expressionStyle
      ? `公开场合表达风格：${sceneInput.recentContext.expressionStyle}`
      : '',
    sceneInput.recentContext?.boundaryPack
      ? `边界与禁区：${sceneInput.recentContext.boundaryPack}`
      : '',
    sceneInput.recentContext?.groupSceneHint
      ? `群聊场景提示：${sceneInput.recentContext.groupSceneHint}`
      : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : '无额外最近上下文。';
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
    `群成员：${sceneInput.memberNames.join('、')}`,
    `用户名字：${sceneInput.userName}`,
    '',
    '当前轮次要求：',
    sceneInput.roleInstruction,
    sceneInput.mentionInstruction || '',
    '',
    '聊天记录：',
    sceneInput.historyTranscript,
    '',
    '现在请直接输出当前角色下一条群聊消息正文，只输出消息内容本身。',
  ].filter(Boolean).join('\n');
}
