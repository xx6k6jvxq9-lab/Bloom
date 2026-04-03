import type { Character, ChatMessage } from '../../../types';

export type CoupleSpaceInviteContext = {
  userName: string;
  character: Character;
  recentMessages: ChatMessage[];
  corePersona?: string;
  longTermMemoryProfile?: string;
};
