import type { Character, ChatMessage } from '../../../../types';

export type BuildGroupChatPromptOptions = {
  speaker: Character;
  members: Character[];
  userName: string;
  history: ChatMessage[];
  mode?: 'reply' | 'invited';
};

function buildGroupChatHistorySection(history: ChatMessage[], userName: string): string {
  return history
    .map(message => {
      if (message.role === 'user') {
        return `${userName}: ${message.text}`;
      }
      return message.text;
    })
    .join('\n');
}

export function buildGroupChatPrompt({
  speaker,
  members,
  userName,
  history,
  mode = 'reply',
}: BuildGroupChatPromptOptions): string {
  const roleInstruction = mode === 'invited'
    ? 'You were just @mentioned or invited to speak. Please reply to the conversation.'
    : 'Please reply to the conversation in the group chat context.';
  const mentionInstruction = mode === 'reply'
    ? 'If you want to invite another character to speak, you can @mention them (e.g., "@Name").'
    : '';

  return [
    `You are in a group chat. Your name is ${speaker.name}.`,
    `Group members: ${members.map(member => member.name).join(', ')}.`,
    `User: ${userName}.`,
    '',
    `Your setting: ${speaker.setting}`,
    '',
    roleInstruction,
    mentionInstruction,
    'Keep your response concise and in character.',
    '',
    'Chat History:',
    buildGroupChatHistorySection(history, userName),
    '',
    `${speaker.name}:`,
  ].filter(Boolean).join('\n');
}
