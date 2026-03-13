import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { PROTOCOL_RULES_PROMPT } from '../base/protocolRules';
import { CHARACTER_CORE_PROMPT } from '../character/characterCore';
import { MEMORY_CONTEXT_PROMPT } from '../character/memoryContext';
import { CHAT_SCENARIO_PROMPT } from '../scenarios/chat';
import { AUTO_REPLY_SCENARIO_PROMPT } from '../scenarios/autoReply';

export type BuildChatPromptOptions = {
  mode?: 'chat' | 'autoReply';
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

  const sections = [
    EXISTENCE_PROMPT,
    CHARACTER_CORE_PROMPT,
    MEMORY_CONTEXT_PROMPT,
    scenario,
    OUTPUT_RULES_PROMPT,
    PROTOCOL_RULES_PROMPT,
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
