import type {
  ApiConfig,
  Character,
  ChatHistory,
  CoupleSpaceData,
  UserProfileExtended,
} from '../../../types';
import {
  streamTextWithConfig,
  type RuntimeChatMessage,
} from '../../../services/ai/runtimeClient';
import { buildHeartCapsulePromptContext } from './buildHeartCapsulePromptContext';
import type { AsyncDualRuleCapsule } from './types';

type Options = {
  activeConfig?: ApiConfig;
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  capsule: AsyncDualRuleCapsule;
  userInput?: string;
  mode?: 'self' | 'partner_opening' | 'partner_result';
};

function buildSystemPrompt(options: {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  capsule: AsyncDualRuleCapsule;
  mode: 'self' | 'partner_opening' | 'partner_result';
}) {
  const { user, partner, coupleSpace, capsule, mode } = options;
  const context = buildHeartCapsulePromptContext({ user, partner, coupleSpace });
  const modePrompt =
    mode === 'partner_opening'
      ? '这一轮由角色先开场。角色先带着自己那侧知道的信息抛出第一条消息。'
      : mode === 'partner_result'
        ? '这一轮由角色收口。角色要接住用户刚刚的话，但不要把整轮规则直接讲透。'
        : '这一轮由用户先开口。角色要在信息不同步的前提下自然接话。';

  return [
    '你正在完成情侣空间里的心动扭蛋互动。',
    '这一轮玩法重点是“双人不同步”：双方知道的信息不完全相同，但互动要像真实聊天，而不是规则说明。',
    '你始终是这个角色本人，不要解释玩法，不要播报规则。',
    '可以读取角色与用户的长期记忆和短期关系摘要，但不要引用最近聊天原文，也不要沿用上一轮扭蛋的即时气氛。',
    '',
    '【角色与关系背景】',
    context,
    '',
    '【当前扭蛋】',
    `名称：${capsule.name}`,
    `你这一侧先知道的是：${capsule.partnerHiddenTask}`,
    `用户这一侧拿到的是：${capsule.userTask}`,
    `这一轮目标：${capsule.roundGoal}`,
    '',
    '【当前轮次要求】',
    modePrompt,
    '',
    '【输出要求】',
    '1. 只输出角色会发出去的话。',
    '2. 使用自然中文，像真实聊天，不要标题，不要解释，不要玩法旁白。',
    '3. 通常控制在 2 到 4 句短句里，保留一点信息差和拉扯感。',
    '4. 不要替用户说话，不要假设用户动作，不要写线下动作描写。',
  ].join('\n');
}

function buildUserPrompt(options: {
  capsule: AsyncDualRuleCapsule;
  userInput?: string;
  mode: 'self' | 'partner_opening' | 'partner_result';
}) {
  const { capsule, userInput, mode } = options;

  if (mode === 'partner_opening') {
    return [
      `请按“${capsule.name}”这一轮的不同步规则先开场。`,
      `这轮目标是：${capsule.roundGoal}`,
      '请直接给出角色发出的第一条消息。',
    ].join('\n');
  }

  return [
    `当前扭蛋：${capsule.name}`,
    `当前轮次目标：${capsule.roundGoal}`,
    `用户刚刚发来的话：${userInput || ''}`,
    '请根据这一轮不同步信息差，以角色本人身份直接回复。',
  ].join('\n');
}

export async function generateAsyncDualRuleReply({
  activeConfig,
  user,
  partner,
  coupleSpace,
  chatHistory: _chatHistory,
  capsule,
  userInput,
  mode = 'self',
}: Options) {
  if (!activeConfig) {
    throw new Error('当前还没有可用的模型配置。');
  }

  const messages: RuntimeChatMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({ user, partner, coupleSpace, capsule, mode }),
    },
    {
      role: 'user',
      content: buildUserPrompt({ capsule, userInput, mode }),
    },
  ];

  let responseText = '';
  await streamTextWithConfig({
    activeConfig,
    messages,
    temperature: 0.85,
    onTextChunk: (chunk) => {
      responseText += chunk;
    },
  });

  return responseText;
}
