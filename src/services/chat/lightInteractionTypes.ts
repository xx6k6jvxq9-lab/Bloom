import type { ApiConfig, Character, ChatMessage } from '../../types';
import type { BuildChatPromptOptions } from '../ai/prompts/builders/buildChatPrompt';
import type { GroupChatSceneInput } from '../scene-inputs/buildGroupChatSceneInput';

export type LightInteractionType = 'poke';
export type LightInteractionScene = 'direct' | 'group';

export type LightInteractionActor = {
  role: 'user' | 'character';
  label: string;
  characterId?: string;
};

export type LightInteractionCounterAction = {
  type: 'none' | 'poke_back';
  systemLine?: string;
};

export type LightInteractionState = {
  mood?: string;
  streak?: number;
  recentDescriptors?: string[];
};

export type LightInteractionResult = {
  type: LightInteractionType;
  scene: LightInteractionScene;
  systemLine: string;
  assistantBubbles: string[];
  spectatorReply?: {
    speakerLabel: string;
    bubbles: string[];
  };
  counterAction?: LightInteractionCounterAction;
  nextActions?: string[];
  interactionState?: LightInteractionState;
};

export type DirectLightInteractionGenerationInput = {
  activeConfig: ApiConfig;
  type: 'poke';
  scene: 'direct';
  actor: LightInteractionActor;
  target: {
    character: Character;
    label: string;
  };
  sceneInput: BuildChatPromptOptions;
  recentMessages: ChatMessage[];
  recentSystemLines?: string[];
  recentDescriptors?: string[];
  latestMood?: string;
  latestNextActions?: string[];
  latestCounterActionType?: LightInteractionCounterAction['type'];
  upcomingStreak?: number;
};

export type GroupLightInteractionGenerationInput = {
  activeConfig: ApiConfig;
  type: 'poke';
  scene: 'group';
  actor: LightInteractionActor;
  target: {
    character: Character;
    label: string;
  };
  spectatorCandidates: Array<{
    character: Character;
    label: string;
  }>;
  sceneInput: GroupChatSceneInput;
  recentMessages: ChatMessage[];
  recentSystemLines?: string[];
  recentDescriptors?: string[];
  latestMood?: string;
  latestCounterActionType?: LightInteractionCounterAction['type'];
  upcomingStreak?: number;
};
