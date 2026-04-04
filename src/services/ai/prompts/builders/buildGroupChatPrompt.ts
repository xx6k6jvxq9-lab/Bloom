import type { GroupChatSceneInput } from '../../../scene-inputs/buildGroupChatSceneInput';

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
    `你正在一个多人群聊里发言。你当前扮演的角色是：${sceneInput.speakerName}。`,
    `群成员：${sceneInput.memberNames.join('、')}。`,
    `用户名字：${sceneInput.userName}。`,
    '',
    '你必须严格遵守以下规则：',
    '1. 你只能代表当前角色说话，不能替其他角色发言，不能替用户发言。',
    '2. 你这一次只输出一条当前角色会真实发出的群消息，不要写成长篇小说，不要写旁白，不要写动作描写，不要写心理描写。',
    '3. 不要添加说话人前缀，不要输出“某某：”，不要加引号，不要写解释，不要写 Markdown。',
    '4. 发言必须像群聊消息，而不是单聊小作文。优先简洁、自然、能接上当前话题。',
    '5. 发言长度控制在 1 到 4 句之间，通常不超过 120 字；除非上下文确实需要，否则不要输出一大整段。',
    '6. 必须保留当前角色的人设、公开表达风格、边界感和说话习惯，不要和其他角色串味。',
    '7. 群聊是公共场合，要弱化私密单聊质地，不要突然进入只适合双人私聊的语气、亲密度或越界表达。',
    '8. 如果当前角色不想接话、没必要长聊，允许简短回复；但不要敷衍成空洞套话。',
    '9. 如果你想把话题抛给另一位角色，可以自然地 @ 对方；只有在真的合理时才这样做，不要强行点名。',
    '10. 你必须回应最近聊天上下文，不能无缘无故跳话题，也不能把整段历史重新总结一遍。',
    '',
    '当前角色资料：',
    `核心人设：${sceneInput.speakerCorePersona || '未提供'}`,
    sceneInput.speakerSignature ? `个性签名：${sceneInput.speakerSignature}` : '',
    buildRecentContextBlock(sceneInput),
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
