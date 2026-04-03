import type { Character, ChatMessage } from '../../../types';
import { buildResolvedMemoryLayers } from '../../memory/buildResolvedMemoryLayers';
import { buildCharacterContext } from '../../relationship-context/buildCharacterContext';
import type { CoupleSpaceInviteContext } from './coupleSpaceInviteTypes';

const INVITE_CONTEXT_WINDOW = 6;

export function buildCoupleSpaceInviteContext(params: {
  userName: string;
  character: Character;
  history: ChatMessage[];
}): CoupleSpaceInviteContext {
  const characterContext = buildCharacterContext({
    character: params.character,
  });
  const memory = buildResolvedMemoryLayers(params.character);
  const recentMessages = params.history
    .filter((message) => !message.isSystem)
    .filter((message) => {
      const text = message.text.trim();
      return text !== '[COUPLE_SPACE_INVITE]' && text !== '[COUPLE_SPACE_INVITE_ACCEPTED]';
    })
    .slice(-INVITE_CONTEXT_WINDOW);

  return {
    userName: params.userName,
    character: params.character,
    recentMessages,
    corePersona: characterContext.corePersona,
    longTermMemoryProfile: memory.longTermMemoryProfile,
  };
}
