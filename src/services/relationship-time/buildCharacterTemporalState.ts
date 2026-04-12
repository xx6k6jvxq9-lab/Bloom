import type { ChatHistory, ChatMessage, CoupleSpaceData, PerceptionSettings } from '../../types';
import { buildInteractionGapState, type InteractionGapState } from './buildInteractionGapState';
import { buildTemporalFacts, type TemporalFacts } from './buildTemporalFacts';
import { buildTopicHeatState, type TopicHeatState } from './buildTopicHeatState';

export type CharacterTemporalState = {
  temporalFacts: TemporalFacts;
  interactionGapState: InteractionGapState;
  topicHeatState: TopicHeatState;
  continuityMode: InteractionGapState['continuityMode'];
  energyState: 'high' | 'steady' | 'low' | 'sleepy';
  socialState: 'open' | 'neutral' | 'reserved' | 'avoidant';
  attentionState: 'focused' | 'split' | 'drifting' | 'resting';
  relationshipPull: 'high' | 'medium' | 'low';
  initiativeReadiness: 'ready' | 'hold' | 'low';
  sceneMomentum: 'continue' | 'soften' | 'shift' | 'close';
};

type BuildCharacterTemporalStateInput = {
  characterId: string;
  now?: number;
  perception?: PerceptionSettings;
  directChatHistory?: ChatHistory;
  groupMessages?: ChatMessage[];
  coupleSpace?: CoupleSpaceData;
};

function deriveEnergyState(
  temporalFacts: TemporalFacts,
  interactionGapState: InteractionGapState,
): CharacterTemporalState['energyState'] {
  if (temporalFacts.isLateNight) return 'sleepy';
  if (temporalFacts.timePeriod === 'early_morning') return 'low';
  if (interactionGapState.recentInteractionDensity === 'high') return 'high';
  if (temporalFacts.timePeriod === 'afternoon' || temporalFacts.timePeriod === 'evening') return 'steady';
  return 'low';
}

function deriveSocialState(
  topicHeatState: TopicHeatState,
  interactionGapState: InteractionGapState,
): CharacterTemporalState['socialState'] {
  if (topicHeatState.hasPendingEmotionalThread) return 'open';
  if (interactionGapState.recentInteractionDensity === 'high') return 'open';
  if (interactionGapState.minutesSinceLastDirectChat !== null && interactionGapState.minutesSinceLastDirectChat > 12 * 60) return 'reserved';
  return 'neutral';
}

function deriveAttentionState(
  temporalFacts: TemporalFacts,
  interactionGapState: InteractionGapState,
): CharacterTemporalState['attentionState'] {
  if (temporalFacts.isLateNight) return 'resting';
  if (interactionGapState.recentInteractionDensity === 'high') return 'focused';
  if (interactionGapState.minutesSinceLastDirectChat !== null && interactionGapState.minutesSinceLastDirectChat <= 30) return 'focused';
  if (interactionGapState.minutesSinceLastGroupChat !== null && interactionGapState.minutesSinceLastGroupChat <= 30) return 'split';
  return 'drifting';
}

function deriveRelationshipPull(
  topicHeatState: TopicHeatState,
  interactionGapState: InteractionGapState,
): CharacterTemporalState['relationshipPull'] {
  if (topicHeatState.hasPendingEmotionalThread) return 'high';
  if (interactionGapState.minutesSinceLastDirectChat !== null && interactionGapState.minutesSinceLastDirectChat <= 60) return 'medium';
  return 'low';
}

function deriveInitiativeReadiness(
  temporalFacts: TemporalFacts,
  topicHeatState: TopicHeatState,
  interactionGapState: InteractionGapState,
): CharacterTemporalState['initiativeReadiness'] {
  if (temporalFacts.isLateNight) return 'low';
  if (topicHeatState.topicDecayStage === 'overextended') return 'hold';
  if (interactionGapState.minutesSinceLastDirectChat !== null && interactionGapState.minutesSinceLastDirectChat <= 20) return 'hold';
  return topicHeatState.hasPendingEmotionalThread ? 'ready' : 'low';
}

export function buildCharacterTemporalState(
  input: BuildCharacterTemporalStateInput,
): CharacterTemporalState {
  const temporalFacts = buildTemporalFacts({
    now: input.now,
    perception: input.perception,
  });
  const directMessages = input.directChatHistory?.[input.characterId] || [];
  const interactionGapState = buildInteractionGapState({
    nowTimestamp: temporalFacts.nowTimestamp,
    characterId: input.characterId,
    directChatHistory: input.directChatHistory,
    groupMessages: input.groupMessages,
    coupleSpace: input.coupleSpace,
  });
  const topicHeatState = buildTopicHeatState({
    nowTimestamp: temporalFacts.nowTimestamp,
    directMessages,
  });
  const energyState = deriveEnergyState(temporalFacts, interactionGapState);
  const socialState = deriveSocialState(topicHeatState, interactionGapState);
  const attentionState = deriveAttentionState(temporalFacts, interactionGapState);
  const relationshipPull = deriveRelationshipPull(topicHeatState, interactionGapState);
  const initiativeReadiness = deriveInitiativeReadiness(temporalFacts, topicHeatState, interactionGapState);

  return {
    temporalFacts,
    interactionGapState,
    topicHeatState,
    continuityMode: interactionGapState.continuityMode,
    energyState,
    socialState,
    attentionState,
    relationshipPull,
    initiativeReadiness,
    sceneMomentum: interactionGapState.continuityMode === 'resume_after_gap'
      ? (topicHeatState.hasPendingEmotionalThread ? 'shift' : 'close')
      : topicHeatState.suggestedTopicAction,
  };
}
