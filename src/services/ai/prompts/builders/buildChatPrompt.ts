import { EXISTENCE_PROMPT } from '../base/existence';
import { CHAT_OUTPUT_RULES, COMMON_OUTPUT_RULES } from '../base/outputRules';
import { PROTOCOL_RULES_PROMPT } from '../base/protocolRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import { buildMemoryContextSection, MemoryContextInput } from '../character/memoryContext';
import { AUTO_REPLY_SCENARIO_PROMPT } from '../scenarios/autoReply';
import { CHAT_SCENARIO_PROMPT } from '../scenarios/chat';

export type BuildChatPromptOptions = {
  mode?: 'chat' | 'autoReply';
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: MemoryContextInput;
  userContext?: {
    userName?: string;
  };
  recentContext?: {
    shortTermSummary?: string;
    recentCoupleSpaceSummary?: string;
    sharedRecentRelationshipSummary?: string;
  };
  includeProtocolRules?: boolean;
  sections?: string[];
};

const DIRECT_CHAT_RHYTHM_PROMPT = [
  '## 单聊节奏',
  '普通单聊允许更像真人发消息，可以在合适时自然地连续发 2 到 4 条短消息。',
  '优先按聊天节拍来表达：先结论，再补一句，再追问一句，或再落一记收尾，不要总是写成一整段完整书面回复。',
  '短消息之间要像同一个人顺手连发，保持语气连贯，不要机械拆句，不要为了分条而分条。',
  '有些中间短泡可以不带句号，但最后一句、反问句、强调句可以保留标点，让语气像真人聊天。',
].join('\n');

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

  const lines = [
    shortTermSummary ? `[近期关系余波] ${shortTermSummary}` : '',
    sharedRecentRelationshipSummary ? `[跨场景共享关系余波] ${sharedRecentRelationshipSummary}` : '',
    recentCoupleSpaceSummary ? `[最近情侣空间关系事件摘要] ${recentCoupleSpaceSummary}` : '',
  ].filter(Boolean);

  if (lines.length === 0) return '';

  return [
    '## 最近场景信号',
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
    buildMemoryContextSection(options.memoryContext ?? {}),
    buildRecentContextSection(options.recentContext),
    scenario,
    DIRECT_CHAT_RHYTHM_PROMPT,
    COMMON_OUTPUT_RULES,
    CHAT_OUTPUT_RULES,
    ...(includeProtocolRules ? [PROTOCOL_RULES_PROMPT] : []),
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
