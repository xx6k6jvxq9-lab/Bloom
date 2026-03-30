import type { ChatMessage, CoupleSpaceInitiativeCadence } from '../../../../types';
import { getMessageMainText } from '../../../../utils';
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
  const options = mergeBuildOptions(params.options);
  const now = source.now ?? Date.now();

  const policy = buildRuntimePolicySkeleton(source, options);
  const recentChatMessages = getRecentChatMessages(source, options);
  const recentChatTurns = options.includeRecentChatTurns
    ? buildRecentChatTurns(recentChatMessages, source.partner.name)
    : [];
  const recentChatTranscript = options.includeRecentChatTranscript
    ? buildRecentChatTranscript(recentChatTurns)
    : undefined;
  const recentRelationshipEvents = options.includeRecentRelationshipEvents
    ? buildRelationshipEventSkeletons(source, options, recentChatTurns, now)
    : [];
  const recentCoupleSpaceArtifacts = options.includeRecentCoupleSpaceArtifacts
    ? buildRecentArtifactSkeletons(source, options)
    : [];

  const diagnostics: CoupleSpacePromptCommonInputDiagnostics = {
    historyMessageCount: source.chatHistory?.[source.partner.id]?.length ?? 0,
    selectedRecentTurnCount: recentChatTurns.length,
    selectedRelationshipEventCount: recentRelationshipEvents.length,
    selectedArtifactCount: recentCoupleSpaceArtifacts.length,
    warnings: collectSkeletonWarnings(source, recentChatTurns.length),
  };

  const common: CoupleSpacePromptCommonInputEnvelope['common'] = {
    mode: scene?.mode,
    actionType: scene?.actionType,
    characterCore: {
      characterSetting: source.partner.setting,
      maskPrompt: undefined,
      worldBookPrompt: undefined,
    },
    memoryContext: {
      memorySummary: source.partner.memorySummary?.trim() || undefined,
    },
    characterProfile: {
      characterName: source.partner.name,
      signature: source.partner.signature,
      personaSummary: source.partner.setting,
      speakingStyle: source.partner.signature || undefined,
      initiativeStyle: source.partner.postFrequency || undefined,
    },
    relationshipContext: {
      userName: source.user.name,
      relationshipStage: 'couple_space',
      relationshipSummary: `${source.user.name} 与 ${source.partner.name} 处于情侣空间关系语境中。`,
      sharedContextSummary: buildSharedContextSummary(source, now),
      intimacyBoundary: '保持亲密但自然，不越出当前关系边界。',
    },
    recentContext: {
      currentSubScene: scene?.currentSubScene ?? scene?.subScene,
      recentCoupleSpaceSummary: undefined,
      recentRelatedContentSummary: scene?.relatedContentSummary,
      recentSharedMomentsSummary: scene?.sharedMomentsSummary,
      occasion: scene?.occasion,
      triggerReason: scene?.triggerReason,
      recentChatTurns,
      recentChatTranscript,
      recentChatSummary: undefined,
      recentRelationshipEvents,
      recentCoupleSpaceArtifacts,
      crossDomainRelationshipMemory: undefined,
    },
    sections: [],
  };

  return {
    common,
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

function buildRuntimePolicySkeleton(
  source: CreateCoupleSpacePromptCommonInputSource,
  options: Required<CoupleSpacePromptContextBuildOptions>,
): CoupleSpacePromptRuntimePolicy {
  const cadence = resolveCadence(source);

  return {
    generationPolicy: {
      enabled: cadence !== 'off',
      cadenceOrOpportunity: cadence,
    },
    promptBudgetPolicy: {
      historyWindowSize: options.historyLimit,
      maxRecentTurns: options.recentChatTurnLimit,
      allowHeavyContext: options.allowHeavyContext,
      includeRelatedChatContext: options.includeRelatedChatContext,
      preferRelatedContextOverFullTranscript: options.preferRelatedContextOverFullTranscript,
      maxRelationshipEvents: options.relationshipEventLimit,
      maxRecentArtifacts: options.relationshipEventLimit,
    },
  };
}

function resolveCadence(source: CreateCoupleSpacePromptCommonInputSource): CoupleSpaceInitiativeCadence | 'off' {
  const settings = source.settings?.initiativeSettings ?? source.coupleSpace.initiativeSettings;
  if (!settings) {
    return 'off';
  }

  // Phase 1 keeps policy derivation intentionally conservative:
  // if any active couple-space path exists, we expose a medium skeleton budget.
  const hasEnabledRule =
    settings.publishing.dailyPost.enabled ||
    settings.publishing.loveLetter.enabled ||
    settings.publishing.messageBoard.enabled ||
    settings.memo.writeCoNote.enabled ||
    settings.recording.createLedgerEntry.enabled ||
    settings.interaction.replyLoveLetter.enabled ||
    settings.interaction.replyDailyComment.enabled ||
    settings.interaction.replyMessageBoard.enabled ||
    settings.interaction.reactToExistingPost.enabled;

  return hasEnabledRule ? 'medium' : 'off';
}

function getRecentChatMessages(
  source: CreateCoupleSpacePromptCommonInputSource,
  options: Required<CoupleSpacePromptContextBuildOptions>,
): ChatMessage[] {
  const history = source.chatHistory?.[source.partner.id] ?? [];
  const limit = Math.min(options.historyLimit, Math.max(1, options.recentChatTurnLimit));
  return history.slice(-limit);
}

function buildRecentChatTurns(messages: ChatMessage[], characterName: string): CoupleSpaceRecentChatTurn[] {
  return messages.map((message) => ({
    role: message.role === 'user' ? 'user' : 'character',
    authorLabel: message.role === 'user' ? '用户' : characterName,
    text: getMessageMainText(message),
    timestamp: message.timestamp,
    replyToAuthorLabel: message.replyTo?.authorLabel,
    replyPreview: message.replyTo?.preview,
  }));
}

function buildRecentChatTranscript(turns: CoupleSpaceRecentChatTurn[]): string | undefined {
  if (!turns.length) {
    return undefined;
  }

  return turns
    .map((turn) => `${turn.authorLabel}: ${turn.text}`)
    .join('\n');
}

function buildRelationshipEventSkeletons(
  source: CreateCoupleSpacePromptCommonInputSource,
  options: Required<CoupleSpacePromptContextBuildOptions>,
  recentChatTurns: CoupleSpaceRecentChatTurn[],
  now: number,
): CoupleSpaceRelationshipEvent[] {
  const events: CoupleSpaceRelationshipEvent[] = [];

  if (recentChatTurns.length > 0) {
    const latestTurn = recentChatTurns[recentChatTurns.length - 1];
    events.push({
      id: `chat-latest-${latestTurn.timestamp}`,
      domain: 'chat',
      direction: latestTurn.role === 'user' ? 'user_to_character' : 'character_to_user',
      summary: latestTurn.text,
      timestamp: latestTurn.timestamp,
      sourceRef: {
        type: 'chat_message',
        id: `chat-${latestTurn.timestamp}`,
      },
    });
  }

  // TODO: Phase 2 will extract richer cross-domain relationship events from
  // posts / love letters / message board / co-notes instead of only adding
  // a lightweight chat-adjacent placeholder.
  if (!events.length && source.coupleSpace.anniversaryDate) {
    events.push({
      id: `anniversary-${source.coupleSpace.anniversaryDate}`,
      domain: 'post',
      direction: 'mutual',
      summary: `${source.user.name} 与 ${source.partner.name} 的情侣空间关系仍在延续中。`,
      timestamp: Math.min(now, source.coupleSpace.anniversaryDate),
      sourceRef: {
        type: 'anniversary_anchor',
        id: String(source.coupleSpace.anniversaryDate),
      },
    });
  }

  return events.slice(0, options.relationshipEventLimit);
}

function buildRecentArtifactSkeletons(
  source: CreateCoupleSpacePromptCommonInputSource,
  options: Required<CoupleSpacePromptContextBuildOptions>,
): CoupleSpaceRecentArtifactSummary[] {
  const artifacts: CoupleSpaceRecentArtifactSummary[] = [];
  const latestLoveLetter = [...source.coupleSpace.loveLetters].sort((a, b) => b.timestamp - a.timestamp)[0];
  const latestCoNote = [...source.coupleSpace.coNotes].sort((a, b) => b.timestamp - a.timestamp)[0];
  const latestMessageBoard = [...(source.coupleSpace.messageBoard ?? [])].sort((a, b) => b.timestamp - a.timestamp)[0];
  const latestPost = [...(source.coupleSpace.posts ?? [])].sort((a, b) => b.timestamp - a.timestamp)[0];

  if (latestLoveLetter) {
    artifacts.push({
      type: 'love_letter',
      authorId: latestLoveLetter.authorId,
      authorLabel: latestLoveLetter.authorId === 'user' ? source.user.name : source.partner.name,
      summary: latestLoveLetter.content.trim(),
      timestamp: latestLoveLetter.timestamp,
    });
  }

  if (latestCoNote) {
    artifacts.push({
      type: 'co_note',
      authorId: latestCoNote.authorId,
      authorLabel: latestCoNote.authorId === 'user' ? source.user.name : source.partner.name,
      summary: latestCoNote.content.trim(),
      timestamp: latestCoNote.timestamp,
    });
  }

  if (latestMessageBoard) {
    artifacts.push({
      type: 'message_board',
      authorId: latestMessageBoard.authorId,
      authorLabel: latestMessageBoard.authorId === 'user' ? source.user.name : source.partner.name,
      summary: latestMessageBoard.content.trim(),
      timestamp: latestMessageBoard.timestamp,
    });
  }

  if (latestPost) {
    artifacts.push({
      type: 'post',
      authorId: latestPost.authorId,
      authorLabel: latestPost.authorId === 'user' ? source.user.name : source.partner.name,
      summary: latestPost.content.trim(),
      timestamp: latestPost.timestamp,
    });
  }

  return artifacts
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, options.relationshipEventLimit);
}

function buildSharedContextSummary(
  source: CreateCoupleSpacePromptCommonInputSource,
  now: number,
): string | undefined {
  if (source.coupleSpace.anniversaryDate == null) {
    return undefined;
  }

  const days = Math.max(
    1,
    Math.floor((now - source.coupleSpace.anniversaryDate) / (1000 * 60 * 60 * 24)),
  );

  return `相伴约 ${days} 天。`;
}

function collectSkeletonWarnings(
  source: CreateCoupleSpacePromptCommonInputSource,
  selectedRecentTurnCount: number,
): string[] {
  const warnings: string[] = [];

  if (!source.chatHistory?.[source.partner.id]?.length) {
    warnings.push('No chat history found for the current partner; recent chat context is empty.');
  }

  if (!source.settings?.initiativeSettings && !source.coupleSpace.initiativeSettings) {
    warnings.push('No initiative settings were provided; runtime policy uses a conservative fallback.');
  }

  if (selectedRecentTurnCount === 0) {
    warnings.push('Recent chat turns are empty; Phase 1 only provides a skeleton relationship continuity layer.');
  }

  return warnings;
}
