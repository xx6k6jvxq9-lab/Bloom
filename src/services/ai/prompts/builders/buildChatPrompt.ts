import { EXISTENCE_PROMPT } from '../base/existence';
import { CHAT_OUTPUT_RULES, COMMON_OUTPUT_RULES } from '../base/outputRules';
import { buildReplyLanguageRules, type ReplyLanguagePolicyInput } from '../base/languageRules';
import { PROTOCOL_RULES_PROMPT } from '../base/protocolRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import { buildLongTermMemoryContextSection, MemoryContextInput } from '../character/memoryContext';
import { AUTO_REPLY_SCENARIO_PROMPT } from '../scenarios/autoReply';
import { CHAT_SCENARIO_PROMPT } from '../scenarios/chat';

export type BuildChatPromptOptions = {
  mode?: 'chat' | 'autoReply';
  directReplyConfig?: {
    minReplies?: number;
    maxReplies?: number;
  };
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: MemoryContextInput;
  languagePolicy?: ReplyLanguagePolicyInput;
  userContext?: {
    userName?: string;
  };
  recentContext?: {
    shortTermSummary?: string;
    recentCoupleSpaceSummary?: string;
    sharedRecentRelationshipSummary?: string;
    publicAcquaintanceSummary?: string;
  };
  includeProtocolRules?: boolean;
  sections?: string[];
};

function resolveDirectReplyRange(config?: BuildChatPromptOptions['directReplyConfig']) {
  const rawMin = Number.isFinite(config?.minReplies) ? Math.floor(config!.minReplies!) : 1;
  const rawMax = Number.isFinite(config?.maxReplies) ? Math.floor(config!.maxReplies!) : 4;
  const minReplies = Math.max(1, Math.min(rawMin, 10));
  const maxReplies = Math.max(minReplies, Math.min(rawMax, 10));

  return { minReplies, maxReplies };
}

function buildDirectChatRhythmPrompt(config?: BuildChatPromptOptions['directReplyConfig']): string {
  const { minReplies, maxReplies } = resolveDirectReplyRange(config);
  const preferredRangeText = minReplies === maxReplies
    ? `${minReplies} 个短气泡`
    : `${minReplies} 到 ${maxReplies} 个短气泡`;
  const upperBoundHint = maxReplies === 1
    ? '默认就像一条自然发出去的消息，不要为了制造节奏硬拆成多条。'
    : `单次回复尽量控制在 ${preferredRangeText} 内；如果一句话本来就该连着说完，不要为了凑数量硬拆。`;

  return [
    '## 单聊节奏',
    '普通单聊默认优先像真人连续发消息，而不是一次性写成一整段。',
    `当前角色设置的单次回复条数范围是：${preferredRangeText}。`,
    maxReplies === 1
      ? '当前更适合只回一条自然消息，除非协议或特殊内容本身要求分条。'
      : `只要当前回复天然可以拆成 ${preferredRangeText}，就优先拆开：先接一句，再补一句，再压一句情绪，最后再追一句或落一句。`,
    '这些短消息应该像同一个人顺手连发，语气连续、长度不齐、轻重有变化，不要机械平均拆句。',
    '如果一句里同时包含接话、补充、提醒、转折、停顿、追问或命令节奏，优先拆成多个短气泡，不要一次性打包。',
    upperBoundHint,
    '有些中间短泡可以不带句号，但最后一句、反问句、强调句可以保留标点，让语气更像真人聊天。',
  ].join('\n');
}

const buildUserContextSection = (userContext?: BuildChatPromptOptions['userContext']): string => {
  const normalizedUserName = userContext?.userName?.trim();
  if (!normalizedUserName) return '';

  return [
    '## 用户上下文',
    `[当前对话用户] ${normalizedUserName}`,
  ].join('\n');
};

const buildRecentContextSection = (recentContext?: BuildChatPromptOptions['recentContext']): string => {
  const shortTermSummary = recentContext?.shortTermSummary?.trim();
  const recentCoupleSpaceSummary = recentContext?.recentCoupleSpaceSummary?.trim();
  const sharedRecentRelationshipSummary = recentContext?.sharedRecentRelationshipSummary?.trim();
  const publicAcquaintanceSummary = recentContext?.publicAcquaintanceSummary?.trim();

  const lines = [
    shortTermSummary ? `[近期关系余波] ${shortTermSummary}` : '',
    publicAcquaintanceSummary ? `[公开认识与群内连续性] ${publicAcquaintanceSummary}` : '',
    sharedRecentRelationshipSummary ? `[跨场景共享关系余波] ${sharedRecentRelationshipSummary}` : '',
    recentCoupleSpaceSummary ? `[最近情侣空间关系事件摘要] ${recentCoupleSpaceSummary}` : '',
  ].filter(Boolean);

  if (lines.length === 0) return '';

  return [
    '## 最近场景信号',
    '这些信号只用于提供关系余波、熟悉度和最近变化，不代表当前聊天已经自动切到线下现场。',
    '如果某些内容来自情侣空间、跨场景连续性或较强的关系推进，只能把它们当作语气和关系理解的背景；除非用户当前明确推动，否则不要把它们直接写成已经发生的现实动作。',
    ...lines,
  ].join('\n');
};

export function buildChatPrompt(options: BuildChatPromptOptions = {}): string {
  const scenario = options.mode === 'autoReply'
    ? AUTO_REPLY_SCENARIO_PROMPT
    : CHAT_SCENARIO_PROMPT;
  const includeProtocolRules = options.includeProtocolRules ?? true;

  const sections = [
    EXISTENCE_PROMPT,
    buildCharacterCoreSection(options.characterCore ?? {}),
    buildUserContextSection(options.userContext),
    buildRecentContextSection(options.recentContext),
    buildLongTermMemoryContextSection(options.memoryContext ?? {}),
    scenario,
    buildDirectChatRhythmPrompt(options.directReplyConfig),
    buildReplyLanguageRules(options.languagePolicy),
    COMMON_OUTPUT_RULES,
    CHAT_OUTPUT_RULES,
    ...(includeProtocolRules ? [PROTOCOL_RULES_PROMPT] : []),
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
