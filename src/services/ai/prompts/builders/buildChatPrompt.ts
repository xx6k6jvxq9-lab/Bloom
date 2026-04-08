import { EXISTENCE_PROMPT } from '../base/existence';
import { CHAT_OUTPUT_RULES, COMMON_OUTPUT_RULES } from '../base/outputRules';
import { PROTOCOL_RULES_PROMPT } from '../base/protocolRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import { buildLongTermMemoryContextSection, MemoryContextInput } from '../character/memoryContext';
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
    publicAcquaintanceSummary?: string;
  };
  includeProtocolRules?: boolean;
  sections?: string[];
};

const DIRECT_CHAT_RHYTHM_PROMPT = [
  '## 单聊节奏',
  '普通单聊默认优先像真人连续发消息，而不是一次性写成一整段。',
  '只要当前回复天然可以拆成 2 到 4 个短气泡，就优先拆开：先接一句，再补一句，再压一句情绪，最后再追一句或落一句。',
  '这些短消息应该像同一个人顺手连发，语气连续、长度不齐、轻重有变化，不要机械平均拆句。',
  '如果一句里同时包含接话、补充、提醒、转折、停顿、追问或命令节奏，优先拆成多个短气泡，不要一次性打包。',
  '有些中间短泡可以不带句号，但最后一句、反问句、强调句可以保留标点，让语气更像真人聊天。',
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
    DIRECT_CHAT_RHYTHM_PROMPT,
    COMMON_OUTPUT_RULES,
    CHAT_OUTPUT_RULES,
    ...(includeProtocolRules ? [PROTOCOL_RULES_PROMPT] : []),
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
