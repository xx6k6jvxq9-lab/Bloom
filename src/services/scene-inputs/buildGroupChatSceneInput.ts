import type { Character, ChatMessage } from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';

export type GroupChatSceneInput = {
  speakerName: string;
  speakerCorePersona: string;
  speakerSignature?: string;
  userName: string;
  memberNames: string[];
  mode: 'reply' | 'invited';
  roleInstruction: string;
  mentionInstruction?: string;
  recentContext?: {
    shortTermSummary?: string;
    longTermMemoryProfile?: string;
    groupSceneHint?: string;
  };
  historyTranscript: string;
};

type BuildGroupChatSceneInputOptions = {
  speaker: Character;
  members: Character[];
  userName: string;
  history: ChatMessage[];
  mode?: 'reply' | 'invited';
};

function buildHistoryTranscript(history: ChatMessage[], userName: string): string {
  return history
    .map((message) => {
      if (message.role === 'user') {
        return `${userName}: ${message.text}`;
      }

      return message.text;
    })
    .join('\n');
}

export function buildGroupChatSceneInput(
  options: BuildGroupChatSceneInputOptions,
): GroupChatSceneInput {
  const mode = options.mode ?? 'reply';
  const characterContext = buildCharacterContext({
    character: options.speaker,
  });
  const memory = buildResolvedMemoryLayers(options.speaker);

  return {
    speakerName: options.speaker.name,
    speakerCorePersona: characterContext.corePersona ?? '',
    speakerSignature: options.speaker.signature?.trim() || undefined,
    userName: options.userName,
    memberNames: options.members.map((member) => member.name),
    mode,
    roleInstruction:
      mode === 'invited'
        ? 'You were just @mentioned or invited to speak. Please reply to the conversation.'
        : 'Please reply to the conversation in the group chat context.',
    mentionInstruction:
      mode === 'reply'
        ? 'If you want to invite another character to speak, you can @mention them (e.g., "@Name").'
        : undefined,
    recentContext: {
      shortTermSummary: memory.shortTermSummary,
      longTermMemoryProfile: memory.longTermMemoryProfile,
      groupSceneHint: characterContext.sceneHints?.groupChat,
    },
    historyTranscript: buildHistoryTranscript(options.history, options.userName),
  };
}
