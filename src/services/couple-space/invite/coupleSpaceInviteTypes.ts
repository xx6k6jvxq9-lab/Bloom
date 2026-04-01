import type { Character, ChatMessage } from '../../../types';

export type CoupleSpaceInviteContext = {
  userName: string;
  character: Character;
  recentMessages: ChatMessage[];
  memorySummary?: string;
};

