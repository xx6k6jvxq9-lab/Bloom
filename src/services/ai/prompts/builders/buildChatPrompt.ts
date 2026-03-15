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
  includeProtocolRules?: boolean;
  sections?: string[];
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
    buildMemoryContextSection(options.memoryContext ?? {}),
    scenario,
    OUTPUT_RULES_PROMPT,
    ...(includeProtocolRules ? [PROTOCOL_RULES_PROMPT] : []),
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
