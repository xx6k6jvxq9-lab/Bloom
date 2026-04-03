import type { GroupChatSceneInput } from '../../../scene-inputs/buildGroupChatSceneInput';

export type BuildGroupChatPromptOptions = {
  sceneInput: GroupChatSceneInput;
};

export function buildGroupChatPrompt({ sceneInput }: BuildGroupChatPromptOptions): string {
  return [
    `You are in a group chat. Your name is ${sceneInput.speakerName}.`,
    `Group members: ${sceneInput.memberNames.join(', ')}.`,
    `User: ${sceneInput.userName}.`,
    '',
    `Your core persona: ${sceneInput.speakerCorePersona || 'Not provided.'}`,
    sceneInput.speakerSignature ? `Your signature: ${sceneInput.speakerSignature}` : '',
    sceneInput.recentContext?.shortTermSummary
      ? `Recent relationship afterglow: ${sceneInput.recentContext.shortTermSummary}`
      : '',
    sceneInput.recentContext?.longTermMemoryProfile
      ? `Long-term relationship memory: ${sceneInput.recentContext.longTermMemoryProfile}`
      : '',
    sceneInput.recentContext?.groupSceneHint
      ? `Group chat scene hint: ${sceneInput.recentContext.groupSceneHint}`
      : '',
    '',
    sceneInput.roleInstruction,
    sceneInput.mentionInstruction,
    'Keep your response concise and in character.',
    '',
    'Chat History:',
    sceneInput.historyTranscript,
    '',
    `${sceneInput.speakerName}:`,
  ].filter(Boolean).join('\n');
}
