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
import { HEART_CAPSULE_BASE_PROMPT } from './heartCapsuleBasePrompt';
import {
  RELATIONSHIP_SHIFT_PARTNER_OPENING_PROMPT,
  RELATIONSHIP_SHIFT_PARTNER_RESULT_PROMPT,
  RELATIONSHIP_SHIFT_SELF_ROUND_PROMPT,
  RELATIONSHIP_SHIFT_TYPE_PROMPT,
} from './relationshipShiftPrompt';
import type { RelationshipShiftCapsule } from './types';

type Options = {
  activeConfig?: ApiConfig;
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  capsule: RelationshipShiftCapsule;
  userInput?: string;
  mode?: 'self' | 'partner_opening' | 'partner_result';
};

function getRoundPrompt(mode: 'self' | 'partner_opening' | 'partner_result') {
  if (mode === 'partner_opening') {
    return RELATIONSHIP_SHIFT_PARTNER_OPENING_PROMPT;
  }

  if (mode === 'partner_result') {
    return RELATIONSHIP_SHIFT_PARTNER_RESULT_PROMPT;
  }

  return RELATIONSHIP_SHIFT_SELF_ROUND_PROMPT;
}

function buildSystemPrompt(options: {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  capsule: RelationshipShiftCapsule;
  mode: 'self' | 'partner_opening' | 'partner_result';
}) {
  const { user, partner, coupleSpace, capsule, mode } = options;
  const context = buildHeartCapsulePromptContext({ user, partner, coupleSpace });

  return [
    HEART_CAPSULE_BASE_PROMPT,
    '',
    RELATIONSHIP_SHIFT_TYPE_PROMPT,
    '',
    getRoundPrompt(mode),
    '',
    '【角色与关系背景】',
    context,
    '',
    '【当前扭蛋】',
    `名称：${capsule.name}`,
    `今日关系异变：${capsule.relationshipTitle}`,
    `这一轮氛围说明：${capsule.summary}`,
    `关系背景：${capsule.relationshipDescription}`,
    '',
    '【当前语境补充】',
    '这次互动可以读取角色与用户的长期记忆和短期关系摘要，但不要引用最近聊天原文，也不要延续上一轮扭蛋的即时气氛。',
    '',
    '【输出要求】',
    '1. 直接输出角色此刻会发出去的话。',
    '2. 使用自然中文，像真实聊天，不要标题，不要引号，不要解释。',
    '3. 通常写成 2 到 4 句短句，给这一轮一个完整但克制的落点。',
    '4. 不要替用户说话，不要假设用户动作，不要写线下动作描写。',
  ].join('\n');
}

function buildUserPrompt(options: {
  capsule: RelationshipShiftCapsule;
  userInput?: string;
  mode: 'self' | 'partner_opening' | 'partner_result';
}) {
  const { capsule, userInput, mode } = options;

  if (mode === 'partner_opening') {
    return [
      `请按“${capsule.name}”这轮关系异变先开场。`,
      `这轮关系状态是：${capsule.relationshipTitle}。`,
      '请直接给出角色发出的第一条消息。',
    ].join('\n');
  }

  return [
    `当前扭蛋：${capsule.name}`,
    `当前关系状态：${capsule.relationshipTitle}`,
    `用户刚刚发来的话：${userInput || ''}`,
    '请只根据这一轮规则，以角色本人身份直接回复。',
  ].join('\n');
}

export async function generateRelationshipShiftReply({
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
