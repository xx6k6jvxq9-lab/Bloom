import type {
  ChatMessage,
  CoNote,
  CouplePost,
  CouplePostComment,
  CoupleSpaceInitiativeCadence,
  CoupleSpaceInitiativeSettings,
  LoveLetter,
  LoveLetterComment,
  MessageBoardEntry,
} from '../../../../types';
import { getMessageMainText, getSummaryHistoryWindow } from '../../../../utils';
import { buildResolvedMemoryLayers } from '../../../memory/buildResolvedMemoryLayers';
import { buildCharacterContext } from '../../../relationship-context/buildCharacterContext';
import { buildRelationshipProjection } from '../../../relationship-context/buildRelationshipProjection';
import { buildSharedCharacterState } from '../../../relationship-context/buildSharedCharacterState';
import { buildCharacterTemporalState } from '../../../relationship-time/buildCharacterTemporalState';
import { buildTemporalContextPrompt } from '../../../relationship-time/buildTemporalContextPrompt';
import { selectActiveCharacterWorldBooks } from '../../../world-book/worldBookAccess';
import type {
  CoupleSpacePromptCommonInputDiagnostics,
  CoupleSpacePromptCommonInputEnvelope,
  CoupleSpacePromptContextBuildOptions,
  CoupleSpacePromptRuntimePolicy,
  CoupleSpaceRecentArtifactSummary,
  CoupleSpaceRecentChatTurn,
  CoupleSpaceRelationshipEvent,
  CreateCoupleSpacePromptCommonInputSource,
  CoupleSpacePromptSceneInput,
} from './types';

const DEFAULT_OPTIONS: Required<CoupleSpacePromptContextBuildOptions> = {
  historyLimit: 20,
  includeRecentChatTranscript: true,
  includeRecentChatTurns: true,
  includeRecentChatSummary: false,
  includeRelatedChatContext: false,
  includeRecentRelationshipEvents: true,
  includeRecentCoupleSpaceArtifacts: true,
  recentChatTurnLimit: 8,
  relatedChatTurnLimit: 3,
  relationshipEventLimit: 4,
  allowHeavyContext: false,
  preferRelatedContextOverFullTranscript: true,
};

type CreateCoupleSpacePromptCommonInputParams = {
  source: CreateCoupleSpacePromptCommonInputSource;
  scene?: CoupleSpacePromptSceneInput;
  options?: CoupleSpacePromptContextBuildOptions;
};

export function createCoupleSpacePromptCommonInput(
  params: CreateCoupleSpacePromptCommonInputParams,
): CoupleSpacePromptCommonInputEnvelope {
  const { source, scene } = params;
  const perception = source.perception ?? source.coupleSpace.perception;
  const options = mergeBuildOptions(params.options);
  const policy = buildRuntimePolicy(source, scene, options);
  const characterContext = buildCharacterContext({
    character: source.partner,
  });
  const resolvedMemory = buildResolvedMemoryLayers(source.partner);
  const relationshipProjection = buildRelationshipProjection({
    character: source.partner,
    coupleSpace: source.coupleSpace,
    userName: source.user.name,
    directMessages: source.chatHistory?.[source.partner.id] || [],
  });
  const characterCoreResult = buildCharacterCore(source);
  const recentChatMessages = getRecentChatMessages(source, options, policy);
  const recentChatTurns = options.includeRecentChatTurns
    ? buildRecentChatTurns(recentChatMessages, source.partner.name, source.user.name)
    : [];
  const recentChatTranscript = shouldIncludeTranscript(policy, options)
    ? buildRecentChatTranscript(recentChatTurns)
    : undefined;
  const recentChatSummary = options.includeRecentChatSummary
    ? buildRecentChatSummary(recentChatTurns)
    : undefined;
  const recentCoupleSpaceArtifacts = options.includeRecentCoupleSpaceArtifacts
    ? buildRecentArtifacts(source, policy)
    : [];
  const recentImageReferences = buildRecentImageReferences(source);
  const recentRelationshipEvents = options.includeRecentRelationshipEvents
    ? buildRelationshipEvents(source, recentChatTurns, recentCoupleSpaceArtifacts, policy)
    : [];
  const sharedContextSummary = buildSharedContextSummary(source, recentCoupleSpaceArtifacts);
  const recentCoupleSpaceSummary = buildRecentCoupleSpaceSummary(recentCoupleSpaceArtifacts);
  const crossDomainRelationshipMemory = buildCrossDomainRelationshipMemory(
    recentChatTurns,
    recentCoupleSpaceArtifacts,
  );
  const temporalState = buildCharacterTemporalState({
    characterId: source.partner.id,
    now: source.now,
    perception,
    directChatHistory: source.chatHistory ?? undefined,
    coupleSpace: source.coupleSpace,
  });
  const temporalContext = buildTemporalContextPrompt({
    now: source.now,
    perception,
  });
  const sharedCharacterState = buildSharedCharacterState({
    character: source.partner,
    temporalState,
    sceneScopedSignals: relationshipProjection.sceneScopedSignals,
  });

  const diagnostics: CoupleSpacePromptCommonInputDiagnostics = {
    usedMaskId: characterCoreResult.usedMaskId,
    usedWorldBookIds: characterCoreResult.usedWorldBookIds,
    historyMessageCount: source.chatHistory?.[source.partner.id]?.length ?? 0,
    selectedRecentTurnCount: recentChatTurns.length,
    selectedRelationshipEventCount: recentRelationshipEvents.length,
    selectedArtifactCount: recentCoupleSpaceArtifacts.length,
    warnings: collectWarnings(source, recentChatTurns.length, recentCoupleSpaceArtifacts.length),
  };

  return {
    common: {
      mode: scene?.mode,
      actionType: scene?.actionType,
      characterCore: characterCoreResult.value,
      memoryContext: {
        longTermMemoryProfile: resolvedMemory.longTermMemoryProfile,
        sharedCharacterStatePrompt: sharedCharacterState.directPrompt,
      },
      characterProfile: {
        characterName: source.partner.name,
        signature: source.partner.signature?.trim() || undefined,
        personaSummary: characterContext.corePersona,
        speakingStyle: characterContext.expressionStyle ?? (source.partner.signature?.trim() || undefined),
        initiativeStyle:
          source.partner.postFrequency && source.partner.postFrequency !== 'none'
            ? source.partner.postFrequency
            : undefined,
      },
      relationshipContext: {
        userName: source.user.name,
        relationshipStage: 'couple_space',
        relationshipSummary: `${source.user.name} 和 ${source.partner.name} 共享一段持续中的情侣关系，需要让聊天与情侣空间保持同一段关系记忆。`,
        sharedContextSummary,
        // Phase 2 keeps a conservative default because the current data model
        // does not expose a dedicated stable intimacy-boundary field.
        intimacyBoundary: '保持亲密、自然、克制，不越出当前关系边界。',
      },
      recentContext: {
        currentSubScene: scene?.currentSubScene ?? scene?.subScene,
        relationshipResidue: relationshipProjection.sceneScopedSignals.relationshipResidue?.slice(0, 3),
        topicAnchors: relationshipProjection.sceneScopedSignals.topicAnchors?.slice(0, 2),
        taskResidue: relationshipProjection.sceneScopedSignals.taskResidue?.slice(0, 2),
        sharedRecentRelationshipSummary: relationshipProjection.sceneScopedSignals.sharedRecentRelationshipSummary,
        publicAcquaintanceSummary: relationshipProjection.sceneScopedSignals.publicAcquaintanceSummary,
        recentCoupleSpaceSummary,
        recentRelatedContentSummary: scene?.relatedContentSummary,
        recentSharedMomentsSummary: scene?.sharedMomentsSummary,
        occasion: scene?.occasion,
        triggerReason: scene?.triggerReason,
        recentImageReferences,
        recentChatTurns,
        recentChatTranscript,
        recentChatSummary,
        recentRelationshipEvents,
        recentCoupleSpaceArtifacts,
        crossDomainRelationshipMemory,
      },
      sections: [
        temporalContext,
        formatTemporalStatePrompt(temporalState),
        formatRecentImageReferencePrompt(recentImageReferences),
      ].filter((value): value is string => Boolean(value)),
    },
    policy,
    diagnostics,
  };
}

function mergeBuildOptions(
  options?: CoupleSpacePromptContextBuildOptions,
): Required<CoupleSpacePromptContextBuildOptions> {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

function buildRuntimePolicy(
  source: CreateCoupleSpacePromptCommonInputSource,
  scene: CoupleSpacePromptSceneInput | undefined,
  options: Required<CoupleSpacePromptContextBuildOptions>,
): CoupleSpacePromptRuntimePolicy {
  const settings = source.settings?.initiativeSettings ?? source.coupleSpace.initiativeSettings;
  const level = resolveCadence(settings, scene);
  const mapped = getPolicyPreset(level);

  return {
    generationPolicy: {
      enabled: level !== 'off',
      cadenceOrOpportunity: level,
      cooldownMinutes: mapped.cooldownMinutes,
    },
    promptBudgetPolicy: {
      historyWindowSize: Math.min(options.historyLimit, mapped.maxRecentTurns),
      maxRecentTurns: Math.min(options.recentChatTurnLimit, mapped.maxRecentTurns),
      allowHeavyContext: mapped.allowHeavyContext || options.allowHeavyContext,
      includeRelatedChatContext: mapped.includeRelatedChatContext || options.includeRelatedChatContext,
      preferRelatedContextOverFullTranscript:
        mapped.preferRelatedContextOverFullTranscript && options.preferRelatedContextOverFullTranscript,
      maxRelationshipEvents: Math.min(options.relationshipEventLimit, mapped.maxRelationshipEvents),
      maxRecentArtifacts: Math.min(options.relationshipEventLimit, mapped.maxRelationshipEvents),
    },
  };
}

function resolveCadence(
  settings: CoupleSpaceInitiativeSettings | undefined,
  scene: CoupleSpacePromptSceneInput | undefined,
): CoupleSpaceInitiativeCadence | 'off' {
  if (!settings) {
    return 'off';
  }

  switch (scene?.actionType) {
    case 'post_couple_daily':
      return settings.publishing.dailyPost.enabled ? settings.publishing.dailyPost.cadence : 'off';
    case 'write_love_letter':
      return settings.publishing.loveLetter.enabled ? settings.publishing.loveLetter.cadence : 'off';
    case 'post_message_board_entry':
      return settings.publishing.messageBoard.enabled ? settings.publishing.messageBoard.cadence : 'off';
    case 'write_co_note':
      return settings.memo.writeCoNote.enabled ? settings.memo.writeCoNote.opportunityLevel : 'off';
    case 'reply_love_letter':
      return settings.interaction.replyLoveLetter.enabled ? settings.interaction.replyLoveLetter.opportunityLevel : 'off';
    case 'reply_daily_comment':
      return settings.interaction.replyDailyComment.enabled ? settings.interaction.replyDailyComment.opportunityLevel : 'off';
    case 'reply_message_board':
      return settings.interaction.replyMessageBoard.enabled ? settings.interaction.replyMessageBoard.opportunityLevel : 'off';
    case 'react_to_existing_post':
      return settings.interaction.reactToExistingPost.enabled ? settings.interaction.reactToExistingPost.opportunityLevel : 'off';
    case 'create_ledger_entry':
      return settings.recording.createLedgerEntry.enabled ? 'medium' : 'off';
    default:
      return resolveAggregateCadence(settings);
  }
}

function resolveAggregateCadence(settings: CoupleSpaceInitiativeSettings): CoupleSpaceInitiativeCadence | 'off' {
  const levels: Array<CoupleSpaceInitiativeCadence | 'off'> = [];

  if (settings.publishing.dailyPost.enabled) levels.push(settings.publishing.dailyPost.cadence);
  if (settings.publishing.loveLetter.enabled) levels.push(settings.publishing.loveLetter.cadence);
  if (settings.publishing.messageBoard.enabled) levels.push(settings.publishing.messageBoard.cadence);
  if (settings.memo.writeCoNote.enabled) levels.push(settings.memo.writeCoNote.opportunityLevel);
  if (settings.recording.createLedgerEntry.enabled) levels.push('medium');
  if (settings.interaction.replyLoveLetter.enabled) levels.push(settings.interaction.replyLoveLetter.opportunityLevel);
  if (settings.interaction.replyDailyComment.enabled) levels.push(settings.interaction.replyDailyComment.opportunityLevel);
  if (settings.interaction.replyMessageBoard.enabled) levels.push(settings.interaction.replyMessageBoard.opportunityLevel);
  if (settings.interaction.reactToExistingPost.enabled) levels.push(settings.interaction.reactToExistingPost.opportunityLevel);

  return levels.sort(compareCadence).at(-1) ?? 'off';
}

function compareCadence(a: CoupleSpaceInitiativeCadence | 'off', b: CoupleSpaceInitiativeCadence | 'off'): number {
  return getCadenceWeight(a) - getCadenceWeight(b);
}

function getCadenceWeight(level: CoupleSpaceInitiativeCadence | 'off'): number {
  switch (level) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function getPolicyPreset(level: CoupleSpaceInitiativeCadence | 'off') {
  switch (level) {
    case 'low':
      return {
        maxRecentTurns: 6,
        allowHeavyContext: false,
        includeRelatedChatContext: false,
        preferRelatedContextOverFullTranscript: true,
        maxRelationshipEvents: 3,
        cooldownMinutes: 24 * 60,
      };
    case 'medium':
      return {
        maxRecentTurns: 8,
        allowHeavyContext: false,
        includeRelatedChatContext: true,
        preferRelatedContextOverFullTranscript: true,
        maxRelationshipEvents: 4,
        cooldownMinutes: 12 * 60,
      };
    case 'high':
      return {
        maxRecentTurns: 10,
        allowHeavyContext: true,
        includeRelatedChatContext: true,
        preferRelatedContextOverFullTranscript: false,
        maxRelationshipEvents: 6,
        cooldownMinutes: 6 * 60,
      };
    default:
      return {
        maxRecentTurns: 0,
        allowHeavyContext: false,
        includeRelatedChatContext: false,
        preferRelatedContextOverFullTranscript: true,
        maxRelationshipEvents: 0,
        cooldownMinutes: undefined,
      };
  }
}

function buildCharacterCore(source: CreateCoupleSpacePromptCommonInputSource): {
  value: CoupleSpacePromptCommonInputEnvelope['common']['characterCore'];
  usedMaskId?: string;
  usedWorldBookIds?: string[];
} {
  const activeMask = source.masks?.find(
    (mask) => mask.isActive && mask.linkedCharacters.includes(source.partner.id),
  );
  const activeWorldBooks = selectActiveCharacterWorldBooks(source.partner, source.worldBooks);
  const characterContext = buildCharacterContext({
    character: source.partner,
    activeMask,
    activeWorldBooks,
  });

  return {
    value: {
      characterSetting: characterContext.corePersona,
      maskPrompt: characterContext.maskPrompt,
      worldBookPrompt: characterContext.worldBookPrompt,
    },
    usedMaskId: activeMask?.id,
    usedWorldBookIds: activeWorldBooks.map((worldBook) => worldBook.id),
  };
}

function getRecentChatMessages(
  source: CreateCoupleSpacePromptCommonInputSource,
  options: Required<CoupleSpacePromptContextBuildOptions>,
  policy: CoupleSpacePromptRuntimePolicy,
): ChatMessage[] {
  const history = source.chatHistory?.[source.partner.id] ?? [];
  const summaryWindow = getSummaryHistoryWindow(history, source.partner.memoryLimit);
  const limit = Math.max(
    0,
    Math.min(
      options.historyLimit,
      options.recentChatTurnLimit,
      policy.promptBudgetPolicy.maxRecentTurns,
    ),
  );

  return summaryWindow
    .filter((message) => !!getMessageMainText(message))
    .slice(-limit);
}

function buildRecentChatTurns(
  messages: ChatMessage[],
  characterName: string,
  userName: string,
): CoupleSpaceRecentChatTurn[] {
  return messages.map((message) => ({
    role: message.role === 'user' ? 'user' : 'character',
    authorLabel: message.role === 'user' ? userName : characterName,
    text: getMessageMainText(message),
    timestamp: message.timestamp,
    replyToAuthorLabel: message.replyTo?.authorLabel,
    replyPreview: message.replyTo?.preview,
  }));
}

function shouldIncludeTranscript(
  policy: CoupleSpacePromptRuntimePolicy,
  options: Required<CoupleSpacePromptContextBuildOptions>,
): boolean {
  if (!options.includeRecentChatTranscript) {
    return false;
  }

  if (policy.promptBudgetPolicy.maxRecentTurns === 0) {
    return false;
  }

  return !policy.promptBudgetPolicy.preferRelatedContextOverFullTranscript;
}

function buildRecentChatTranscript(turns: CoupleSpaceRecentChatTurn[]): string | undefined {
  if (!turns.length) {
    return undefined;
  }

  return turns.map((turn) => `${turn.authorLabel}: ${turn.text}`).join('\n');
}

function buildRecentChatSummary(turns: CoupleSpaceRecentChatTurn[]): string | undefined {
  if (!turns.length) {
    return undefined;
  }

  return turns
    .slice(-3)
    .map((turn) => `${turn.authorLabel}提到：${turn.text}`)
    .join('；');
}

function formatTemporalStatePrompt(
  state: ReturnType<typeof buildCharacterTemporalState>,
): string {
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
  const readinessLabelMap: Record<typeof state.initiativeReadiness, string> = {
    ready: '可以主动',
    hold: '先收一收',
    low: '暂时偏低',
  };
  const momentumLabelMap: Record<typeof state.sceneMomentum, string> = {
    continue: '继续',
    soften: '放缓',
    shift: '转场',
    close: '收束',
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
    `[主动意愿] ${readinessLabelMap[state.initiativeReadiness]}`,
    `[场景动量] ${momentumLabelMap[state.sceneMomentum]}`,
    state.topicHeatState.lastTopicAnchor ? `[最近话题锚点] ${state.topicHeatState.lastTopicAnchor}` : '',
  ].filter(Boolean).join('\n');
}

function buildRecentArtifacts(
  source: CreateCoupleSpacePromptCommonInputSource,
  policy: CoupleSpacePromptRuntimePolicy,
): CoupleSpaceRecentArtifactSummary[] {
  const artifacts: CoupleSpaceRecentArtifactSummary[] = [];
  const latestLoveLetter = getLatestByTimestamp(source.coupleSpace.loveLetters);
  const latestLoveLetterReply = latestLoveLetter ? getLatestByTimestamp(latestLoveLetter.comments) : undefined;
  const latestCoNote = getLatestByTimestamp(source.coupleSpace.coNotes);
  const latestMessageBoard = getLatestByTimestamp(source.coupleSpace.messageBoard ?? []);
  const latestPost = getLatestByTimestamp(source.coupleSpace.posts ?? []);
  const latestPostComment = latestPost ? getLatestByTimestamp(latestPost.comments) : undefined;

  pushArtifact(artifacts, buildArtifactFromLoveLetter(source, latestLoveLetter));
  pushArtifact(artifacts, buildArtifactFromLoveLetterReply(source, latestLoveLetterReply));
  pushArtifact(artifacts, buildArtifactFromCoNote(source, latestCoNote));
  pushArtifact(artifacts, buildArtifactFromMessageBoard(source, latestMessageBoard));
  pushArtifact(artifacts, buildArtifactFromPost(source, latestPost));
  pushArtifact(artifacts, buildArtifactFromPostComment(source, latestPostComment));

  return artifacts
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, policy.promptBudgetPolicy.maxRecentArtifacts);
}

function buildRelationshipEvents(
  source: CreateCoupleSpacePromptCommonInputSource,
  recentChatTurns: CoupleSpaceRecentChatTurn[],
  artifacts: CoupleSpaceRecentArtifactSummary[],
  policy: CoupleSpacePromptRuntimePolicy,
): CoupleSpaceRelationshipEvent[] {
  const events: CoupleSpaceRelationshipEvent[] = [];

  for (const turn of recentChatTurns.slice(-2)) {
    events.push({
      id: `chat-${turn.role}-${turn.timestamp}`,
      domain: 'chat',
      direction: turn.role === 'user' ? 'user_to_character' : 'character_to_user',
      summary: turn.text,
      timestamp: turn.timestamp,
      emotionalWeight: turn.text.length > 30 ? 'medium' : 'light',
      sourceRef: {
        type: 'chat_message',
        id: `chat-${turn.timestamp}`,
      },
    });
  }

  for (const artifact of artifacts.slice(0, 2)) {
    events.push({
      id: `${artifact.type}-${artifact.authorId}-${artifact.timestamp}`,
      domain: mapArtifactTypeToEventDomain(artifact.type),
      direction: artifact.authorId === 'user' ? 'user_to_character' : 'character_to_user',
      summary: artifact.summary,
      timestamp: artifact.timestamp,
      emotionalWeight: artifact.type === 'love_letter' ? 'high' : 'light',
      sourceRef: {
        type: artifact.type,
        id: `${artifact.type}-${artifact.timestamp}`,
      },
    });
  }

  if (!events.length && source.coupleSpace.anniversaryDate) {
    events.push({
      id: `anniversary-${source.coupleSpace.anniversaryDate}`,
      domain: 'post',
      direction: 'mutual',
      summary: `${source.user.name} 和 ${source.partner.name} 的情侣空间关系仍在持续中。`,
      timestamp: source.coupleSpace.anniversaryDate,
      emotionalWeight: 'light',
      sourceRef: {
        type: 'anniversary_anchor',
        id: String(source.coupleSpace.anniversaryDate),
      },
    });
  }

  return events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, policy.promptBudgetPolicy.maxRelationshipEvents);
}

function mapArtifactTypeToEventDomain(
  type: CoupleSpaceRecentArtifactSummary['type'],
): CoupleSpaceRelationshipEvent['domain'] {
  switch (type) {
    case 'love_letter':
      return 'love_letter';
    case 'co_note':
      return 'co_note';
    case 'message_board':
      return 'message_board';
    case 'comment_reply':
      return 'comment';
    default:
      return 'post';
  }
}

function getLatestByTimestamp<T extends { timestamp: number }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => b.timestamp - a.timestamp)[0];
}

function pushArtifact(
  artifacts: CoupleSpaceRecentArtifactSummary[],
  artifact: CoupleSpaceRecentArtifactSummary | undefined,
) {
  if (artifact) {
    artifacts.push(artifact);
  }
}

function buildArtifactFromLoveLetter(
  source: CreateCoupleSpacePromptCommonInputSource,
  letter: LoveLetter | undefined,
): CoupleSpaceRecentArtifactSummary | undefined {
  if (!letter) return undefined;
  return {
    type: 'love_letter',
    authorId: letter.authorId,
    authorLabel: resolveAuthorLabel(source, letter.authorId),
    summary: summarizeText(letter.content),
    timestamp: letter.timestamp,
  };
}

function buildArtifactFromLoveLetterReply(
  source: CreateCoupleSpacePromptCommonInputSource,
  comment: LoveLetterComment | undefined,
): CoupleSpaceRecentArtifactSummary | undefined {
  if (!comment) return undefined;
  return {
    type: 'comment_reply',
    authorId: comment.authorId,
    authorLabel: resolveAuthorLabel(source, comment.authorId),
    summary: summarizeText(comment.content),
    timestamp: comment.timestamp,
  };
}

function buildArtifactFromCoNote(
  source: CreateCoupleSpacePromptCommonInputSource,
  note: CoNote | undefined,
): CoupleSpaceRecentArtifactSummary | undefined {
  if (!note) return undefined;
  return {
    type: 'co_note',
    authorId: note.authorId,
    authorLabel: resolveAuthorLabel(source, note.authorId),
    summary: summarizeText(note.content),
    timestamp: note.timestamp,
  };
}

function buildArtifactFromMessageBoard(
  source: CreateCoupleSpacePromptCommonInputSource,
  entry: MessageBoardEntry | undefined,
): CoupleSpaceRecentArtifactSummary | undefined {
  if (!entry) return undefined;
  return {
    type: 'message_board',
    authorId: entry.authorId,
    authorLabel: resolveAuthorLabel(source, entry.authorId),
    summary: summarizeText(entry.content),
    timestamp: entry.timestamp,
  };
}

function buildArtifactFromPost(
  source: CreateCoupleSpacePromptCommonInputSource,
  post: CouplePost | undefined,
): CoupleSpaceRecentArtifactSummary | undefined {
  if (!post) return undefined;
  return {
    type: 'post',
    authorId: post.authorId,
    authorLabel: resolveAuthorLabel(source, post.authorId),
    summary: summarizeText(post.content),
    timestamp: post.timestamp,
  };
}

function buildRecentImageReferences(source: CreateCoupleSpacePromptCommonInputSource) {
  const imagePosts = [...(source.coupleSpace.posts ?? [])]
    .filter((post) => Array.isArray(post.images) && post.images.length > 0)
    .sort((a, b) => b.timestamp - a.timestamp);

  const references: Array<{
    imageUrl: string;
    authorLabel?: string;
    timestamp?: number;
    relatedText?: string;
  }> = [];

  for (const post of imagePosts) {
    for (const imageUrl of post.images.slice(0, 2)) {
      if (!imageUrl) {
        continue;
      }

      references.push({
        imageUrl,
        authorLabel: resolveAuthorLabel(source, post.authorId),
        timestamp: post.timestamp,
        relatedText: summarizeText(post.content),
      });

      if (references.length >= 2) {
        return references;
      }
    }
  }

  return references;
}

function buildArtifactFromPostComment(
  source: CreateCoupleSpacePromptCommonInputSource,
  comment: CouplePostComment | undefined,
): CoupleSpaceRecentArtifactSummary | undefined {
  if (!comment) return undefined;
  return {
    type: 'comment_reply',
    authorId: comment.authorId,
    authorLabel: resolveAuthorLabel(source, comment.authorId),
    summary: summarizeText(comment.content),
    timestamp: comment.timestamp,
  };
}

function resolveAuthorLabel(
  source: CreateCoupleSpacePromptCommonInputSource,
  authorId: string,
): string {
  if (authorId === 'user') {
    return source.user.name;
  }
  if (authorId === source.partner.id) {
    return source.partner.name;
  }
  return authorId;
}

function summarizeText(text: string | undefined): string {
  const normalized = text?.replace(/\s+/g, ' ').trim() || '';
  if (!normalized) {
    return '';
  }
  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
}

function formatRecentImageReferencePrompt(
  references: Array<{
    imageUrl: string;
    authorLabel?: string;
    timestamp?: number;
    relatedText?: string;
  }>,
): string | undefined {
  if (!references.length) {
    return undefined;
  }

  const lines = [
    '## 最近相关图片参考',
    '本次会同时附上最近的情侣空间图片作为多模态参考。',
    '只能依据图片里直接可见的内容辅助判断，不要虚构图片外的信息。',
    ...references.map((reference, index) => {
      const parts = [
        `${index + 1}.`,
        reference.authorLabel ? `发布者：${reference.authorLabel}` : '',
        reference.relatedText ? `配文：${reference.relatedText}` : '',
      ].filter((value): value is string => Boolean(value));
      return parts.join(' ');
    }),
  ];

  return lines.join('\n');
}

function buildSharedContextSummary(
  source: CreateCoupleSpacePromptCommonInputSource,
  artifacts: CoupleSpaceRecentArtifactSummary[],
): string | undefined {
  const parts: string[] = [];

  if (source.coupleSpace.anniversaryDate != null) {
    const days = Math.max(
      1,
      Math.floor((Date.now() - source.coupleSpace.anniversaryDate) / (1000 * 60 * 60 * 24)),
    );
    parts.push(`相伴约 ${days} 天。`);
  }

  if (artifacts[0]) {
    parts.push(`最近的情侣空间互动是：${artifacts[0].summary}`);
  }

  return parts.join(' ') || undefined;
}

function buildRecentCoupleSpaceSummary(
  artifacts: CoupleSpaceRecentArtifactSummary[],
): string | undefined {
  if (!artifacts.length) {
    return undefined;
  }

  return artifacts
    .slice(0, 2)
    .map((artifact) => `${artifact.authorLabel}留下了“${artifact.summary}”`)
    .join('；');
}

function buildCrossDomainRelationshipMemory(
  recentChatTurns: CoupleSpaceRecentChatTurn[],
  artifacts: CoupleSpaceRecentArtifactSummary[],
): string | undefined {
  const latestChat = recentChatTurns.at(-1);
  const latestArtifact = artifacts[0];
  const parts: string[] = [];

  if (latestChat) {
    parts.push(`最近聊天里，${latestChat.authorLabel}提到“${latestChat.text}”`);
  }

  if (latestArtifact) {
    parts.push(`情侣空间里最近的互动是${latestArtifact.authorLabel}写下“${latestArtifact.summary}”`);
  }

  return parts.join('；') || undefined;
}

function collectWarnings(
  source: CreateCoupleSpacePromptCommonInputSource,
  selectedRecentTurnCount: number,
  selectedArtifactCount: number,
): string[] {
  const warnings: string[] = [];

  if (!source.chatHistory?.[source.partner.id]?.length) {
    warnings.push('No chat history found for the current partner; recent chat context fell back to long-term memory only.');
  }

  if (!source.settings?.initiativeSettings && !source.coupleSpace.initiativeSettings) {
    warnings.push('No initiative settings were provided; runtime policy used the conservative off preset.');
  }

  if (selectedRecentTurnCount === 0) {
    warnings.push('Recent chat turns are empty; prompt continuity relies on longTermMemoryProfile and relationshipContext.');
  }

  if (selectedArtifactCount === 0) {
    warnings.push('No recent couple-space artifacts were found; recent couple-space continuity relies on anniversary and chat context.');
  }

  return warnings;
}
