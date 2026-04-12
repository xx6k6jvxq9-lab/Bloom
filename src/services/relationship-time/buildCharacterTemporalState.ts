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
  presenceCue: {
    currentActivity: string;
    attentionNote: string;
    lifeResidue: string;
    resumeStyle: 'natural_continue' | 'soft_return' | 'fresh_reentry';
  };
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

function deriveCurrentActivity(
  temporalFacts: TemporalFacts,
  energyState: CharacterTemporalState['energyState'],
  attentionState: CharacterTemporalState['attentionState'],
): string {
  if (temporalFacts.isLateNight) {
    return '偏夜里的慢节奏，像是准备休息前顺手看一眼消息。';
  }

  if (temporalFacts.timePeriod === 'early_morning') {
    return energyState === 'low'
      ? '刚醒不久，还在慢慢找状态。'
      : '刚进入一天的节奏，顺手抬头回消息。';
  }

  if (temporalFacts.timePeriod === 'morning') {
    return attentionState === 'focused'
      ? '白天安排还在推进，中间抽空回来一下。'
      : '白天节奏在走，像是顺手看到了这边的消息。';
  }

  if (temporalFacts.timePeriod === 'noon') {
    return '像是在一天中间稍微停一下，顺手回到这里。';
  }

  if (temporalFacts.timePeriod === 'afternoon') {
    return attentionState === 'split'
      ? '像是在处理别的事，注意力没完全停在一个点上。'
      : '下午的事还在推进，中途分一眼回来。';
  }

  if (temporalFacts.timePeriod === 'evening') {
    return energyState === 'steady'
      ? '一天快收住了，人也回到稍微松一点的状态。'
      : '像是刚从白天的事里退出来，注意力慢慢收回来。';
  }

  return '像是从自己的节奏里抬头，顺手回到这边看看。';
}

function deriveAttentionNote(
  attentionState: CharacterTemporalState['attentionState'],
  socialState: CharacterTemporalState['socialState'],
): string {
  if (attentionState === 'focused') {
    return '这轮注意力相对在这里，可以自然接住当下这个点。';
  }

  if (attentionState === 'split') {
    return '这轮注意力有点分散，更适合轻一点、短一点。';
  }

  if (attentionState === 'resting') {
    return '这轮更像半休息半回应，表达可以更松一点。';
  }

  if (socialState === 'reserved' || socialState === 'avoidant') {
    return '这轮开口不要太满，像先轻轻探一下。';
  }

  return '这轮先回到当下状态，再慢慢决定往哪边聊。';
}

function deriveLifeResidue(
  interactionGapState: InteractionGapState,
  topicHeatState: TopicHeatState,
): string {
  if (topicHeatState.hasPendingEmotionalThread && topicHeatState.lastTopicAnchor) {
    return `上一轮的余波还在，但只要轻轻带进语气里，不要一上来就把「${topicHeatState.lastTopicAnchor}」整段硬续回来。`;
  }

  if (interactionGapState.minutesSinceLastCoupleSpaceActivity !== null && interactionGapState.minutesSinceLastCoupleSpaceActivity <= 12 * 60) {
    return '最近还有一点共同生活留下来的余温，但它更像背景气氛。';
  }

  if (interactionGapState.recentInteractionDensity === 'high') {
    return '最近互动不算少，熟悉感还在，但这轮仍应先回到“现在”。';
  }

  return '没有特别强的旧情节必须立刻续写，优先把这轮当成一次新的重新接触。';
}

function deriveResumeStyle(
  continuityMode: InteractionGapState['continuityMode'],
): CharacterTemporalState['presenceCue']['resumeStyle'] {
  if (continuityMode === 'continuous_scene') {
    return 'natural_continue';
  }

  if (continuityMode === 'same_day_resume') {
    return 'soft_return';
  }

  return 'fresh_reentry';
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
  const resumeStyle = deriveResumeStyle(interactionGapState.continuityMode);

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
    presenceCue: {
      currentActivity: deriveCurrentActivity(temporalFacts, energyState, attentionState),
      attentionNote: deriveAttentionNote(attentionState, socialState),
      lifeResidue: deriveLifeResidue(interactionGapState, topicHeatState),
      resumeStyle,
    },
  };
}
