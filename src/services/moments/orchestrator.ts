import type { ApiConfig, Character, ChatMessage, Mask, MomentImageCard, WorldBookEntry } from '../../types';
import { generateMomentChatReaction, generateMomentPostContent } from './generators';
import type { RecentMomentContext } from './triggers';
import { shouldAutoPublishMomentFromChat, shouldTriggerMomentPublishFromChat } from './triggers';

export type MomentPublishOrchestratorResult = {
  shouldPublish: boolean;
  chatReaction?: string;
  momentContent?: string;
  momentImageCard?: MomentImageCard;
  triggerType?: 'command' | 'auto';
  reason?: string;
};

type BaseMomentOrchestratorOptions = {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBook: WorldBookEntry[];
  recentContext?: RecentMomentContext;
};

type CommandMomentPublishOptions = BaseMomentOrchestratorOptions & {
  text: string;
};

type AutoMomentPublishOptions = BaseMomentOrchestratorOptions & {
  userText: string;
  assistantText: string;
  finalHistory: ChatMessage[];
};

export async function handleCommandTriggeredMomentPublish(
  options: CommandMomentPublishOptions,
): Promise<MomentPublishOrchestratorResult> {
  const { text, recentContext, activeConfig, character, masks, worldBook } = options;
  const shouldPublish = shouldTriggerMomentPublishFromChat(text, recentContext);

  if (!shouldPublish) {
    return { shouldPublish: false };
  }

  const chatReaction = await generateMomentChatReaction({
    activeConfig,
    character,
    masks,
    worldBook,
    requestText: text,
  });

  const momentPost = await generateMomentPostContent({
    activeConfig,
    character,
    masks,
    worldBook,
    requestText: text,
  });

  return {
    shouldPublish: true,
    chatReaction,
    momentContent: momentPost.content,
    momentImageCard: momentPost.imageCard,
    triggerType: 'command',
    reason: 'command-triggered',
  };
}

export async function maybeAutoPublishMoment(
  options: AutoMomentPublishOptions,
): Promise<MomentPublishOrchestratorResult> {
  const { userText, assistantText, recentContext, activeConfig, character, masks, worldBook } = options;
  const trigger = shouldAutoPublishMomentFromChat({
    character,
    userText,
    assistantText,
    context: recentContext,
  });

  if (!trigger.shouldPublish) {
    return {
      shouldPublish: false,
      triggerType: 'auto',
      reason: trigger.reason,
    };
  }

  const momentPost = await generateMomentPostContent({
    activeConfig,
    character,
    masks,
    worldBook,
    requestText: `自主发动态：${trigger.reason || 'auto'}`,
  });

  return {
    shouldPublish: true,
    momentContent: momentPost.content,
    momentImageCard: momentPost.imageCard,
    triggerType: 'auto',
    reason: trigger.reason,
  };
}
