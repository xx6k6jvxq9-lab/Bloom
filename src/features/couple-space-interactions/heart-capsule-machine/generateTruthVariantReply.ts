import type {
  ApiConfig,
  Character,
  ChatHistory,
  CoupleSpaceData,
  UserProfileExtended,
} from '../../../types';
import { generateTextWithConfig } from '../../../services/ai/runtimeClient';
import { HEART_CAPSULE_BASE_PROMPT } from './heartCapsuleBasePrompt';
import {
  TRUTH_VARIANT_PARTNER_OPENING_PROMPT,
  TRUTH_VARIANT_PARTNER_RESULT_PROMPT,
  TRUTH_VARIANT_SELF_ROUND_PROMPT,
  TRUTH_VARIANT_TYPE_PROMPT,
} from './truthVariantPrompt';
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

function getRecentChatSnippet(chatHistory: ChatHistory, partnerId: string) {
  const messages = chatHistory[partnerId] ?? [];
  return messages
    .slice(-4)
    .map((message) => `${message.role === 'user' ? '用户' : 'TA'}：${message.text}`)
    .join('\n');
}

function getRelationshipSummary(coupleSpace: CoupleSpaceData) {
  const parts: string[] = [];

  if (coupleSpace.anniversaryDate) {
    const days = Math.max(
      1,
      Math.floor((Date.now() - coupleSpace.anniversaryDate) / (1000 * 60 * 60 * 24)),
    );
    parts.push(`你们已经在一起或进入情侣空间大约 ${days} 天。`);
  }

  const letterCount = coupleSpace.loveLetters?.length ?? 0;
  const noteCount = coupleSpace.coNotes?.length ?? 0;
  const postCount = coupleSpace.posts?.length ?? 0;
  const messageBoardCount = coupleSpace.messageBoard?.length ?? 0;

  if (letterCount || noteCount || postCount || messageBoardCount) {
    parts.push(
      `情侣空间里已经有 ${letterCount} 封情书、${noteCount} 条互记、${postCount} 条动态、${messageBoardCount} 条留言。`,
    );
  }

  return parts.join('\n');
}

function getLongTermMemorySummary(user: UserProfileExtended, partner: Character) {
  const lines = [
    `角色名字：${partner.name}`,
    `角色设定：${partner.setting || '未提供'}`,
    partner.signature ? `角色签名：${partner.signature}` : '',
    partner.openingRemark ? `角色初始语气：${partner.openingRemark}` : '',
    `用户名字：${user.name || '未命名用户'}`,
  ].filter(Boolean);

  return lines.join('\n');
}

function getCapsuleSpecificConstraint(capsule: TruthVariantCapsule) {
  switch (capsule.id) {
    case 'truth-variant-no-direct-answer':
      return '【硬规则】禁止直接说“是 / 不是 / 会 / 不会”这类正面答案，必须绕开直球，用侧面表达代替。';
    case 'truth-variant-half-admit':
      return '【硬规则】只能承认一半，另一半必须留白或按住，不能整段全说满。';
    case 'truth-variant-tsundere-truth':
      return '【硬规则】真心可以给，但态度不能太乖，必须保留一点嘴硬或别扭。';
    case 'truth-variant-incomplete':
      return '【硬规则】最关键的地方必须停住，不能完整说透，要把最重的一截留给对方自己领会。';
    case 'truth-variant-detour-then-admit':
      return '【硬规则】可以先绕一下，但最后必须落到真实心意上，不能一直兜圈子不落点。';
    case 'truth-variant-one-line':
      return '【硬规则】只能输出一句话，不允许拆成多句。';
    case 'truth-variant-no-reasoning':
      return '【硬规则】禁止讲道理、分析原因，只能给态度和情绪反应。';
    case 'truth-variant-cannot-ignore':
      return '【硬规则】不能装作没听见，也不能滑过去，必须正面接住问题。';
    case 'truth-variant-vague-confession':
      return '【硬规则】不能直接说“喜欢、爱”这类直白词，要把心意藏进细节和侧面表达里。';
    case 'truth-variant-privileged-question':
      return '【硬规则】这一轮允许更往前递一步，不能过于保守躲开。';
    default:
      return '';
  }
}

function getOutputFormatPrompt(mode: 'self' | 'partner_opening' | 'partner_result') {
  if (mode === 'partner_opening') {
    return [
      '【输出格式】',
      '直接输出角色开场会说的话。',
      '不要加标题，不要加解释，不要加额外标签。',
    ].join('\n');
  }

  return [
    '【输出格式】',
    '必须严格按下面格式输出两段内容：',
    '【表面回复】',
    '这里写角色这轮真正说出口的话。',
    '',
    '【真实想法】',
    '这里写角色这轮没直接说出口、但当下真实在想的那层心思。',
    '',
    '两段都必须输出。',
    '表面回复必须遵守当前扭蛋规则。',
    '真实想法可以更直白一点，但仍然要符合角色本人和当前关系。',
  ].join('\n');
}

function buildRoundPrompt(options: {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  capsule: TruthVariantCapsule;
  question: string;
  userAnswer?: string;
  mode: 'self' | 'partner_opening' | 'partner_result';
}) {
  const { user, partner, coupleSpace, chatHistory, capsule, question, userAnswer, mode } = options;
  const recentChat = getRecentChatSnippet(chatHistory, partner.id);
  const relationshipSummary = getRelationshipSummary(coupleSpace);
  const longTermMemorySummary = getLongTermMemorySummary(user, partner);
  const roundPrompt =
    mode === 'partner_opening'
      ? TRUTH_VARIANT_PARTNER_OPENING_PROMPT
      : mode === 'partner_result'
        ? TRUTH_VARIANT_PARTNER_RESULT_PROMPT
        : TRUTH_VARIANT_SELF_ROUND_PROMPT;

  return [
    HEART_CAPSULE_BASE_PROMPT,
    TRUTH_VARIANT_TYPE_PROMPT,
    roundPrompt,
    getCapsuleSpecificConstraint(capsule),
    '【当前固定信息】',
    longTermMemorySummary,
    relationshipSummary ? `【当前关系摘要】\n${relationshipSummary}` : '',
    `【当前扭蛋】${capsule.name}`,
    `【当前规则】${capsule.answerRule}`,
    `【当前题目】${question}`,
    `【当前气氛】${capsule.feeling}`,
    userAnswer ? `【用户刚刚的回答】${userAnswer}` : '',
    recentChat ? `【最近相关聊天】\n${recentChat}` : '',
    '【全局要求】',
    '不要解释规则，不要解释自己为什么这样说。',
    '如果你会把答案直接说满，请收回来，改成符合规则的表达。',
    getOutputFormatPrompt(mode),
  ]
    .filter(Boolean)
    .join('\n\n');
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
  const hiddenThought = extractSection(rawText, '真实想法') || '他嘴上收着，心里其实已经把答案说得更满了。';

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
  chatHistory,
  capsule,
  question,
  userAnswer,
  mode = 'self',
}: Options) {
  if (!activeConfig) {
    throw new Error('当前还没有可用的模型配置。');
  }

  const prompt = buildRoundPrompt({
    user,
    partner,
    coupleSpace,
    chatHistory,
    capsule,
    question,
    userAnswer,
    mode,
  });

  const rawText = await generateTextWithConfig({
    activeConfig,
    prompt,
    temperature: 0.72,
  });

  return parseGeneratedResult(rawText, mode);
}
