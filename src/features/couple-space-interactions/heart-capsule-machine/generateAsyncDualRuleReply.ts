import type {
  ApiConfig,
  Character,
  ChatHistory,
  CoupleSpaceData,
  UserProfileExtended,
} from '../../../types';
import { generateTextWithConfig } from '../../../services/ai/runtimeClient';
import { ASYNC_DUAL_RULE_PARTNER_OPENING_PROMPT, ASYNC_DUAL_RULE_PARTNER_RESULT_PROMPT, ASYNC_DUAL_RULE_SELF_ROUND_PROMPT, ASYNC_DUAL_RULE_TYPE_PROMPT } from './asyncDualRulePrompt';
import { HEART_CAPSULE_BASE_PROMPT } from './heartCapsuleBasePrompt';
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

function buildRoundPrompt(options: {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  capsule: AsyncDualRuleCapsule;
  userInput?: string;
  mode: 'self' | 'partner_opening' | 'partner_result';
}) {
  const { user, partner, coupleSpace, chatHistory, capsule, userInput, mode } = options;
  const recentChat = getRecentChatSnippet(chatHistory, partner.id);
  const relationshipSummary = getRelationshipSummary(coupleSpace);
  const longTermMemorySummary = getLongTermMemorySummary(user, partner);
  const roundPrompt =
    mode === 'partner_opening'
      ? ASYNC_DUAL_RULE_PARTNER_OPENING_PROMPT
      : mode === 'partner_result'
        ? ASYNC_DUAL_RULE_PARTNER_RESULT_PROMPT
        : ASYNC_DUAL_RULE_SELF_ROUND_PROMPT;

  return [
    HEART_CAPSULE_BASE_PROMPT,
    ASYNC_DUAL_RULE_TYPE_PROMPT,
    roundPrompt,
    '【当前固定信息】',
    longTermMemorySummary,
    relationshipSummary ? `【当前关系摘要】\n${relationshipSummary}` : '',
    `【当前扭蛋】${capsule.name}`,
    `【你这一侧任务】${capsule.partnerHiddenTask}`,
    `【用户这一侧任务】${capsule.userTask}`,
    `【这轮目标】${capsule.roundGoal}`,
    userInput ? `【用户刚刚这句】${userInput}` : '',
    recentChat ? `【最近相关聊天】\n${recentChat}` : '',
    '【输出要求】',
    '1. 直接输出角色此刻会说的话。',
    '2. 用自然中文输出，不要带标题、前缀、引号和解释。',
    '3. 不要只回一句。通常用 2 到 4 句，让这轮错位互动有完整回应和收尾。',
    '4. 不要解释规则，不要一下讲透你的隐藏任务。',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function generateAsyncDualRuleReply({
  activeConfig,
  user,
  partner,
  coupleSpace,
  chatHistory,
  capsule,
  userInput,
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
    userInput,
    mode,
  });

  return generateTextWithConfig({
    activeConfig,
    prompt,
    temperature: 0.85,
  });
}
