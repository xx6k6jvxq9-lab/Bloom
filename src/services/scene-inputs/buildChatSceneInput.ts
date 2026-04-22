import { buildGroupWorldBookPrompt } from '../../features/group-world-book/buildGroupWorldBookPrompt';
import { selectActiveGroupWorldBooks } from '../../features/group-world-book/selectActiveGroupWorldBooks';
import { loadChatHistoryRecords } from '../../features/persistence/chatHistoryStore';
import type {
  Character,
  ChatGroup,
  ChatHistory,
  CoupleSpaceData,
  Mask,
  PerceptionSettings,
  WorldBookEntry,
} from '../../types';
import type { BuildChatPromptOptions } from '../ai/prompts/builders/buildChatPrompt';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';
import type { ChatRecentContext, UserGlobalContext } from '../relationship-context/types';
import { buildCharacterTemporalState } from '../relationship-time/buildCharacterTemporalState';
import { decayShortTermSummaryForContinuity } from '../memory/buildShortTermSummary';
import { applyChatPromptBudget } from './buildChatPromptBudget';

type BuildChatSceneInputParams = {
  character: Character;
  userName: string;
  coupleSpace?: CoupleSpaceData;
  activeMask?: Mask | null;
  activeWorldBooks?: WorldBookEntry[];
  worldBooks?: WorldBookEntry[];
  perception?: PerceptionSettings;
  perceptionPrompt?: string;
  mode?: BuildChatPromptOptions['mode'];
  includeProtocolRules?: boolean;
  directChatHistory?: ChatHistory;
  chatGroups?: ChatGroup[];
};

function getDirectMemoryReadableGroups(
  chatGroups: ChatGroup[] | undefined,
  characterId: string,
): ChatGroup[] {
  return (chatGroups || [])
    .filter((group) => (
      group.allowDirectMemoryInterop !== false
      && Array.isArray(group.memberIds)
      && group.memberIds.includes(characterId)
    ))
    .sort((left, right) => (right.lastTime || 0) - (left.lastTime || 0));
}

function buildSharedGroupInteropSections(
  groups: ChatGroup[],
  character: Character,
  worldBooks: WorldBookEntry[] | undefined,
): string[] {
  return groups
    .map((group) => {
      const groupWorldBookPrompt = buildGroupWorldBookPrompt(
        selectActiveGroupWorldBooks({
          speaker: character,
          group,
          worldBooks: worldBooks || [],
        }),
      );

      const lines = [
        group.backgroundSummary?.trim()
          ? `[群背景简述] ${group.backgroundSummary.trim()}`
          : '',
        group.memberRelationshipNote?.trim()
          ? `[成员关系补充] ${group.memberRelationshipNote.trim()}`
          : '',
        group.currentScene?.trim()
          ? `[群当前场景] ${group.currentScene.trim()}`
          : '',
        group.publicFacts?.trim()
          ? `[群公开事实] ${group.publicFacts.trim()}`
          : '',
        groupWorldBookPrompt
          ? `[群世界书]\n${groupWorldBookPrompt}`
          : '',
      ].filter(Boolean);

      if (lines.length === 0) {
        return '';
      }

      return [`## 可共享的群聊资料：${group.name}`, ...lines].join('\n');
    })
    .filter(Boolean);
}

function buildExtraSections(input: {
  temporalStatePrompt?: string;
  continuityPrompt?: string;
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  chatSceneHint?: string;
}): string[] {
  return [
    input.temporalStatePrompt || '',
    input.continuityPrompt || '',
    input.expressionStyle
      ? ['## 表达风格与互动手感', input.expressionStyle].join('\n')
      : '',
    input.boundaryPack
      ? ['## 边界与禁区', input.boundaryPack].join('\n')
      : '',
    input.extendedLore
      ? ['## 扩展背景与长期补充', input.extendedLore].join('\n')
      : '',
    input.chatSceneHint
      ? ['## 当前聊天场景补充', input.chatSceneHint].join('\n')
      : '',
  ].filter(Boolean);
}

function buildContinuityResumePrompt(state: ReturnType<typeof buildCharacterTemporalState>): string {
  if (state.continuityMode === 'continuous_scene') {
    return [
      '## 连续性判断',
      '[当前模式] 连续场景',
      '[规则] 这是同一段正在延续的聊天，可以自然接上上一轮，但仍然只推进一个主要点，不要机械复述刚刚的话题。',
    ].join('\n');
  }

  if (state.continuityMode === 'same_day_resume') {
    return [
      '## 连续性判断',
      '[当前模式] 同日重连',
      '[规则] 这是同一天里隔了一段时间后重新接上。先回到角色当前状态、这段时间在做什么，带一点新的生活感，再决定是否轻轻接回旧话题。',
      '[限制] 不要把上一次聊天的最后一句当成眼前刚发生的事直接续写。',
    ].join('\n');
  }

  return [
    '## 连续性判断',
    '[当前模式] 隔段重连',
    '[规则] 这不是上一句的直接继续，而是角色过了一段自己的生活后重新出现。默认先回到当下时间、角色当前状态、他这段时间在做什么。',
    '[限制] 除非用户主动提起，或上一轮有明显未完的强情绪线，否则不要默认直接续昨天或更早的话题。',
    '[表达要求] 让角色像一个重新上线的人，而不是一直停在上次聊天现场的人。',
  ].join('\n');
}

function formatPresenceCuePrompt(state: ReturnType<typeof buildCharacterTemporalState>): string {
  if (state.continuityMode === 'continuous_scene') {
    return [
      '## 角色当前在线存在感',
      '[上线方式] 当前仍是连续聊天，不需要额外表演“重新出现”。',
      `[当下状态提示] ${state.presenceCue.attentionNote}`,
      '[表达要求] 自然延续即可，不要突然补一段“这段时间发生了什么”。',
    ].join('\n');
  }

  const resumeStyleLabelMap: Record<typeof state.presenceCue.resumeStyle, string> = {
    natural_continue: '自然延续',
    soft_return: '轻量回线',
    fresh_reentry: '重新上线',
  };

  return [
    '## 角色当前在线存在感',
    `[上线方式] ${resumeStyleLabelMap[state.presenceCue.resumeStyle]}`,
    `[当前生活底色] ${state.presenceCue.currentActivity}`,
    `[开口力度] ${state.presenceCue.attentionNote}`,
    `[余波提醒] ${state.presenceCue.lifeResidue}`,
    state.continuityMode === 'same_day_resume'
      ? '[表达要求] 这轮更像同一天里隔了一会儿又回来，不要演成久别重逢，也不要把状态说明书式地说出来。'
      : '[表达要求] 这轮更像隔了一段时间后重新上线，可以带一点“刚回来”的气息，但不要播报日程、不要突然制造关键新事实。',
  ].join('\n');
}

function formatTemporalStatePrompt(state: ReturnType<typeof buildCharacterTemporalState>): string {
  const timePeriodLabelMap: Record<typeof state.temporalFacts.timePeriod, string> = {
    late_night: '深夜',
    early_morning: '清晨',
    morning: '上午',
    noon: '中午',
    afternoon: '下午',
    evening: '晚上',
  };
  const densityLabelMap: Record<typeof state.interactionGapState.recentInteractionDensity, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  const topicHeatLabelMap: Record<typeof state.topicHeatState.currentTopicHeat, string> = {
    hot: '高热',
    warm: '温热',
    fading: '降温中',
    cold: '已冷却',
  };
  const topicActionLabelMap: Record<typeof state.topicHeatState.suggestedTopicAction, string> = {
    continue: '继续承接',
    soften: '放缓一点',
    shift: '自然转场',
    close: '可以收束',
  };
  const energyLabelMap: Record<typeof state.energyState, string> = {
    high: '高',
    steady: '稳定',
    low: '偏低',
    sleepy: '困倦',
  };
  const socialLabelMap: Record<typeof state.socialState, string> = {
    open: '开放',
    neutral: '中性',
    reserved: '收着一点',
    avoidant: '回避',
  };
  const attentionLabelMap: Record<typeof state.attentionState, string> = {
    focused: '集中',
    split: '分散',
    drifting: '游离',
    resting: '休息中',
  };
  const pullLabelMap: Record<typeof state.relationshipPull, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  const momentumLabelMap: Record<typeof state.sceneMomentum, string> = {
    continue: '继续',
    soften: '放缓',
    shift: '转场',
    close: '收束',
  };
  const topicActionGuideMap: Record<typeof state.topicHeatState.suggestedTopicAction, string> = {
    continue: '最近的话题还可以自然接着聊，但仍然只推进一个点，不要把一整轮说满。',
    soften: '最近的话题已经偏热，优先收一点力度，接住核心情绪即可，不要继续围着同一个点反复追打。',
    shift: '最近的话题可以自然转场，优先回到当下时间、角色状态或新的更轻一点的话题，不要死咬旧点。',
    close: '最近的话题已经可以收束，允许留白、停顿或以后再说，不要硬续。',
  };

  return [
    '## 角色当前时间状态',
    `[时间来源] ${state.temporalFacts.timeSource === 'perceived' ? '感知时间' : '现实时间'}`,
    `[当前时间] ${state.temporalFacts.dateText}`,
    `[当前时段] ${timePeriodLabelMap[state.temporalFacts.timePeriod]}`,
    `[互动密度] ${densityLabelMap[state.interactionGapState.recentInteractionDensity]}`,
    `[话题热度] ${topicHeatLabelMap[state.topicHeatState.currentTopicHeat]}`,
    `[话题建议] ${topicActionLabelMap[state.topicHeatState.suggestedTopicAction]}`,
    `[能量状态] ${energyLabelMap[state.energyState]}`,
    `[社交状态] ${socialLabelMap[state.socialState]}`,
    `[注意力状态] ${attentionLabelMap[state.attentionState]}`,
    `[关系牵引] ${pullLabelMap[state.relationshipPull]}`,
    `[场景动量] ${momentumLabelMap[state.sceneMomentum]}`,
    state.topicHeatState.lastTopicAnchor ? `[最近话题锚点] ${state.topicHeatState.lastTopicAnchor}` : '',
    `[回复节奏提醒] ${topicActionGuideMap[state.topicHeatState.suggestedTopicAction]}`,
  ].filter(Boolean).join('\n');
}

export function buildChatSceneInput(
  params: BuildChatSceneInputParams,
): BuildChatPromptOptions {
  const persistedChatHistory = loadChatHistoryRecords();
  const directEvidenceWaves = persistedChatHistory.directRelationshipWaves?.[params.character.id] || [];
  const directEvidenceFacts = persistedChatHistory.directFactTraces?.[params.character.id] || [];
  const directMemoryReadableGroups = getDirectMemoryReadableGroups(
    params.chatGroups,
    params.character.id,
  );
  const characterContext = buildCharacterContext({
    character: params.character,
    activeMask: params.activeMask,
    activeWorldBooks: params.activeWorldBooks,
  });
  const relationshipProjection = buildRelationshipProjection({
    character: params.character,
    coupleSpace: params.coupleSpace,
    userName: params.userName,
    directMessages: params.directChatHistory?.[params.character.id] || [],
    groupMessages: directMemoryReadableGroups
      .flatMap((group) => group.history || [])
      .filter((message) => message.role === 'user' || message.senderCharacterId === params.character.id),
    groupRelationshipWaves: [
      ...directEvidenceWaves,
      ...directMemoryReadableGroups
        .flatMap((group) => group.relationshipWaves || [])
        .filter((wave) => wave.scope === 'cross_scene_readable'),
    ],
    factTraces: [
      ...directEvidenceFacts,
      ...directMemoryReadableGroups
        .flatMap((group) => group.factTraces || [])
        .filter((factTrace) => factTrace.visibility === 'cross_scene_readable'),
    ],
  });
  const { characterScopedMemory, sceneScopedSignals } = relationshipProjection;
  const directGroupMessages = directMemoryReadableGroups
    .flatMap((group) => group.history || [])
    .filter((message) => message.role === 'user' || message.senderCharacterId === params.character.id);
  const characterTemporalState = buildCharacterTemporalState({
    characterId: params.character.id,
    perception: params.perception ?? params.coupleSpace?.perception,
    directChatHistory: params.directChatHistory,
    groupMessages: directGroupMessages,
    coupleSpace: params.coupleSpace,
  });
  const userContext: UserGlobalContext = {
    userName: params.userName,
  };
  const recentContext: ChatRecentContext = {
    shortTermSummary: characterScopedMemory.shortTermSummary
      ? decayShortTermSummaryForContinuity(
        characterScopedMemory.shortTermSummary,
        characterTemporalState.continuityMode,
      )
      : characterScopedMemory.shortTermSummary,
    recentCoupleSpaceSummary: sceneScopedSignals.recentCoupleSpaceSummary,
    sharedRecentRelationshipSummary: sceneScopedSignals.sharedRecentRelationshipSummary,
    publicAcquaintanceSummary: sceneScopedSignals.publicAcquaintanceSummary,
  };
  const budgetedContext = applyChatPromptBudget({
    recentContext,
    sections: buildExtraSections({
      temporalStatePrompt: formatTemporalStatePrompt(characterTemporalState),
      continuityPrompt: buildContinuityResumePrompt(characterTemporalState),
      expressionStyle: characterContext.expressionStyle,
      boundaryPack: characterContext.boundaryPack,
      extendedLore: characterContext.extendedLore,
      chatSceneHint: characterContext.sceneHints?.chat,
    }).concat(
      formatPresenceCuePrompt(characterTemporalState),
      buildSharedGroupInteropSections(
        directMemoryReadableGroups,
        params.character,
        params.worldBooks,
      ),
    ),
  });

  return {
    mode: params.mode,
    directReplyConfig: {
      minReplies: Math.max(1, Math.min(params.character.minReplies || 1, 10)),
      maxReplies: Math.max(
        Math.max(1, Math.min(params.character.minReplies || 1, 10)),
        Math.min(params.character.maxReplies || 3, 10),
      ),
    },
    includeProtocolRules: params.includeProtocolRules,
    characterCore: {
      characterSetting: characterContext.corePersona ?? '',
      maskPrompt: characterContext.maskPrompt,
      worldBookPrompt: characterContext.worldBookPrompt,
    },
    userContext,
    memoryContext: {
      longTermMemoryProfile: characterScopedMemory.longTermMemoryProfile ?? '',
      perceptionPrompt: params.perceptionPrompt,
    },
    languagePolicy: params.character,
    recentContext: budgetedContext.recentContext,
    sections: budgetedContext.sections,
  };
}
