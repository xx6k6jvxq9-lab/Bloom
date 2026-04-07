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
import type { TruthVariantCapsule } from './types';

type Options = {
  activeConfig?: ApiConfig;
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  capsule: TruthVariantCapsule;
  question: string;
  userAnswer?: string;
  mode?: 'self' | 'partner_opening' | 'partner_result';
};

export type TruthVariantGeneratedResult =
  | {
      mode: 'partner_opening';
      visibleReply: string;
      hiddenThought: null;
    }
  | {
      mode: 'self' | 'partner_result';
      visibleReply: string;
      hiddenThought: string;
    };

function getCapsuleSpecificConstraint(capsule: TruthVariantCapsule) {
  switch (capsule.id) {
    case 'truth-variant-no-direct-answer':
      return '禁止直接回答“是 / 不是 / 会 / 不会”这类正面答案，必须绕开直球，用侧面表达代替。';
    case 'truth-variant-half-admit':
      return '只能承认一半，另一半必须留白或按住，不能整段全说满。';
    case 'truth-variant-tsundere-truth':
      return '真心可以给，但态度不能太软，必须保留一点嘴硬或别扭。';
    case 'truth-variant-incomplete':
      return '最关键的地方必须停住，不能完整说透，要把最重的一截留给对方自己领会。';
    case 'truth-variant-detour-then-admit':
      return '可以先绕一下，但最后必须落到真实心意上，不能一直兜圈子。';
    case 'truth-variant-one-line':
      return '只能输出一句话，不允许拆成多句。';
    case 'truth-variant-no-reasoning':
      return '禁止讲道理、分析原因，只能给态度和情绪反应。';
    case 'truth-variant-cannot-ignore':
      return '不能装作没听见，也不能滑过去，必须正面接住问题。';
    case 'truth-variant-vague-confession':
      return '不能直接说“喜欢、爱”这类直白词，要把心意藏进细节和侧面表达里。';
    case 'truth-variant-privileged-question':
      return '这一轮允许更往前递一步，不能过于保守躲开。';
    default:
      return '';
  }
}

function buildSystemPrompt(options: {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  capsule: TruthVariantCapsule;
  question: string;
  mode: 'self' | 'partner_opening' | 'partner_result';
}) {
  const { user, partner, coupleSpace, capsule, question, mode } = options;
  const context = buildHeartCapsulePromptContext({ user, partner, coupleSpace });
  const modePrompt =
    mode === 'partner_opening'
      ? '这一轮由角色先开场，角色要先把问题抛给用户。'
      : mode === 'partner_result'
        ? '这一轮由角色收口，角色要接住用户刚刚的回答。'
        : '这一轮由用户先回答，角色要在规则限制下回应。';

  return [
    '你正在完成情侣空间里的心动扭蛋互动。',
    '这一轮玩法重点是真心话被规则限制：角色心里有更真实的话，但表达必须受当前扭蛋约束。',
    '你始终是这个角色本人，不要解释玩法，不要解释规则，不要像系统播报。',
    '可以读取角色与用户的长期记忆和短期关系摘要，但不要引用最近聊天原文，也不要沿用上一轮扭蛋的即时气氛。',
    '',
    '【角色与关系背景】',
    context,
    '',
    '【当前扭蛋】',
    `名称：${capsule.name}`,
    `当前规则：${capsule.answerRule}`,
    `当前气氛：${capsule.feeling}`,
    `当前问题：${question}`,
    getCapsuleSpecificConstraint(capsule) ? `补充限制：${getCapsuleSpecificConstraint(capsule)}` : '',
    '',
    '【当前轮次要求】',
    modePrompt,
    '',
    '【输出规则】',
    mode === 'partner_opening'
      ? '直接输出角色会发给用户的那句话，不要附加标题或解释。'
      : [
          '必须严格输出两段内容：',
          '【表面回复】',
          '这里写角色真正发出口的话。',
          '',
          '【真实想法】',
          '这里写角色这轮没直接说出口、但当下真实在想的那层心思。',
        ].join('\n'),
    '',
    '【通用要求】',
    '1. 使用自然中文，像真实聊天，不要玩法旁白。',
    '2. 不要替用户说话，不要假设用户动作，不要写线下动作描写。',
    '3. 表面回复必须遵守当前扭蛋规则。',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUserPrompt(options: {
  capsule: TruthVariantCapsule;
  question: string;
  userAnswer?: string;
  mode: 'self' | 'partner_opening' | 'partner_result';
}) {
  const { capsule, question, userAnswer, mode } = options;

  if (mode === 'partner_opening') {
    return [
      `请按“${capsule.name}”这轮规则先开场。`,
      `你要抛出的核心问题是：${question}`,
      '请直接输出角色发出的那句话。',
    ].join('\n');
  }

  return [
    `当前扭蛋：${capsule.name}`,
    `当前问题：${question}`,
    `用户刚刚的回答：${userAnswer || ''}`,
    '请按当前规则，以角色本人身份回应。',
  ].join('\n');
}

function extractSection(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`【${escaped}】([\\s\\S]*?)(?=\\n【|$)`);
  const match = text.match(regex);
  return match?.[1]?.trim() ?? '';
}

function parseGeneratedResult(
  rawText: string,
  mode: 'self' | 'partner_opening' | 'partner_result',
): TruthVariantGeneratedResult {
  if (mode === 'partner_opening') {
    return {
      mode,
      visibleReply: rawText.trim(),
      hiddenThought: null,
    };
  }

  const visibleReply = extractSection(rawText, '表面回复') || rawText.trim();
  const hiddenThought = extractSection(rawText, '真实想法') || '他嘴上收着，心里其实已经把答案想得更满了。';

  return {
    mode,
    visibleReply,
    hiddenThought,
  };
}

export async function generateTruthVariantReply({
  activeConfig,
  user,
  partner,
  coupleSpace,
  chatHistory: _chatHistory,
  capsule,
  question,
  userAnswer,
  mode = 'self',
}: Options) {
  if (!activeConfig) {
    throw new Error('当前还没有可用的模型配置。');
  }

  const messages: RuntimeChatMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({ user, partner, coupleSpace, capsule, question, mode }),
    },
    {
      role: 'user',
      content: buildUserPrompt({ capsule, question, userAnswer, mode }),
    },
  ];

  let rawText = '';
  await streamTextWithConfig({
    activeConfig,
    messages,
    temperature: 0.72,
    onTextChunk: (chunk) => {
      rawText += chunk;
    },
  });

  return parseGeneratedResult(rawText, mode);
}
