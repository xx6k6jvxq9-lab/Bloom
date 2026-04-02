import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { PROTOCOL_RULES_PROMPT } from '../base/protocolRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import { buildMemoryContextSection, MemoryContextInput } from '../character/memoryContext';
import { CHAT_SCENARIO_PROMPT } from '../scenarios/chat';
import { AUTO_REPLY_SCENARIO_PROMPT } from '../scenarios/autoReply';

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
  };
  includeProtocolRules?: boolean;
  sections?: string[];
};

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

  const lines = [
    shortTermSummary ? `[近期关系余波] ${shortTermSummary}` : '',
    recentCoupleSpaceSummary ? `[最近情侣空间关系事件摘要] ${recentCoupleSpaceSummary}` : '',
  ].filter(Boolean);

  if (lines.length === 0) return '';

  return [
    '## 最近场景信号',
    ...lines,
  ].join('\n');
};

/**
 * Draft prompt composer for chat-like scenarios.
 * Keep this builder side-effect free. It should only combine prompt sections.
 */
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
    OUTPUT_RULES_PROMPT,
    ...(includeProtocolRules ? [PROTOCOL_RULES_PROMPT] : []),
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
