import type {
  ChatMessage,
  DatingPageEpisode,
  GroupOfflineAftereffects,
  GroupOfflineCard,
  GroupOfflineCharacterBlock,
  GroupOfflineDirectorOutputMode,
  GroupOfflineEndingVoice,
  GroupOfflineGeneratedContent,
  GroupOfflineLiveMessage,
  GroupOfflineMemoryPanel,
  GroupOfflineMemoryWritebackPolicy,
  GroupOfflineMode,
  GroupOfflineParticipant,
  GroupOfflineParticipantSoundtrack,
  GroupOfflineRecruitResponseRecord,
  GroupOfflineRecruitDraft,
  GroupOfflineRound,
  GroupOfflineRoundCharacterEntry,
  GroupOfflineRoundDispatchMode,
  GroupOfflineSceneLine,
  GroupOfflineSession,
  GroupOfflineSoundtrack,
  GroupOfflineStatusField,
  GroupOfflineTargetRef,
  WorldBookEntry,
} from '../../types';
import { buildGroupOfflineWorldBookSnapshot } from './worldBookSnapshot';

function safeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeMode(value: unknown): GroupOfflineMode {
  return value === 'scenario' || value === 'random' || value === 'daily'
    ? value
    : 'daily';
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)));
}

function sanitizeRecruitResponses(value: unknown): GroupOfflineRecruitResponseRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GroupOfflineRecruitResponseRecord | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineRecruitResponseRecord>;
      const characterId = safeText(candidate.characterId);
      const decision = candidate.decision === 'join' || candidate.decision === 'decline'
        ? candidate.decision
        : undefined;
      const text = safeText(candidate.text);
      const respondedAt = typeof candidate.respondedAt === 'number' && Number.isFinite(candidate.respondedAt)
        ? candidate.respondedAt
        : undefined;
      if (!characterId || !decision || !text || respondedAt === undefined) {
        return null;
      }
      return {
        characterId,
        decision,
        text,
        respondedAt,
      };
    })
    .filter((item): item is GroupOfflineRecruitResponseRecord => !!item);
}

function sanitizeDirectorOutputMode(value: unknown): GroupOfflineDirectorOutputMode | undefined {
  return value === 'auto'
    || value === 'narrative'
    || value === 'wechat_chat'
    || value === 'feed_post'
    || value === 'document_page'
    || value === 'custom_html'
    || value === 'micro_app'
    ? value
    : undefined;
}

function sanitizeMemoryWritebackPolicy(value: unknown): GroupOfflineMemoryWritebackPolicy | undefined {
  return value === 'allow' || value === 'block'
    ? value
    : undefined;
}

function sanitizeParticipants(value: unknown): GroupOfflineParticipant[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GroupOfflineParticipant | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineParticipant>;
      if (typeof candidate.characterId !== 'string' || !candidate.characterId.trim()) return null;
      const presence = candidate.presence === 'arrived'
        || candidate.presence === 'en_route'
        || candidate.presence === 'late'
        || candidate.presence === 'left'
        || candidate.presence === 'added_midway'
        || candidate.presence === 'pending'
        ? candidate.presence
        : 'arrived';
      return {
        characterId: candidate.characterId,
        joinedAt: typeof candidate.joinedAt === 'number' && Number.isFinite(candidate.joinedAt)
          ? candidate.joinedAt
          : Date.now(),
        presence,
        ...(candidate.isTemporary ? { isTemporary: true as boolean } : {}),
        ...(safeText(candidate.note) ? { note: safeText(candidate.note) } : {}),
      } satisfies GroupOfflineParticipant;
    })
    .filter((item): item is GroupOfflineParticipant => !!item);
}

function sanitizeWorldBookSnapshot(value: unknown): WorldBookEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return buildGroupOfflineWorldBookSnapshot(value as WorldBookEntry[]);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasUnsupportedStoredGenerationMode(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value !== 'blocks';
}

function sanitizeTargetRef(value: unknown): GroupOfflineTargetRef | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<GroupOfflineTargetRef>;
  const type = safeText(candidate.type);
  const label = safeText(candidate.label);
  const characterId = safeText(candidate.characterId);
  if (
    !label
    || (type !== 'user' && type !== 'character' && type !== 'group' && type !== 'scene')
  ) {
    return undefined;
  }

  return {
    type,
    label,
    ...(characterId ? { characterId } : {}),
  };
}

function sanitizeStatusFields(value: unknown): GroupOfflineStatusField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GroupOfflineStatusField | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineStatusField>;
      const key = safeText(candidate.key);
      const label = safeText(candidate.label);
      const fieldValue = safeText(candidate.value);
      if (!key || !label || !fieldValue) return null;
      return {
        key,
        label,
        value: fieldValue,
      };
    })
    .filter((item): item is GroupOfflineStatusField => !!item);
}

function sanitizeSoundtrack(value: unknown): GroupOfflineSoundtrack | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<GroupOfflineSoundtrack>;
  const title = safeText(candidate.title);
  const artist = safeText(candidate.artist);
  const note = safeText(candidate.note);
  if (!title && !artist && !note) return undefined;
  return {
    title: title || '未命名曲目',
    artist: artist || '未知来源',
    note: note || '',
  };
}

function sanitizeParticipantSoundtracks(value: unknown): GroupOfflineParticipantSoundtrack[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GroupOfflineParticipantSoundtrack | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineParticipantSoundtrack>;
      const characterId = safeText(candidate.characterId);
      const characterName = safeText(candidate.characterName);
      const soundtrack = sanitizeSoundtrack(candidate);
      if (!characterId || !characterName || !soundtrack) return null;
      return {
        characterId,
        characterName,
        title: soundtrack.title,
        artist: soundtrack.artist,
        note: soundtrack.note,
      };
    })
    .filter((item): item is GroupOfflineParticipantSoundtrack => !!item);
}

function sanitizeAftereffects(value: unknown): GroupOfflineAftereffects | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<GroupOfflineAftereffects>;
  const searches = sanitizeStringArray(candidate.searches);
  const items = Array.isArray(candidate.items)
    ? candidate.items
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const sourceLabel = safeText((item as { sourceLabel?: unknown }).sourceLabel);
          const actionText = safeText((item as { actionText?: unknown }).actionText);
          const residueText = safeText((item as { residueText?: unknown }).residueText);
          if (!sourceLabel || !actionText || !residueText) return null;
          return {
            sourceLabel,
            actionText,
            residueText,
          };
        })
        .filter((item): item is NonNullable<GroupOfflineAftereffects['items'][number]> => !!item)
    : [];

  if (searches.length === 0 && items.length === 0) {
    return undefined;
  }

  return {
    searches,
    items,
  };
}

function sanitizeMemoryPanel(value: unknown): GroupOfflineMemoryPanel | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<GroupOfflineMemoryPanel>;
  const shortTerm = sanitizeStringArray(candidate.shortTerm);
  const longTerm = sanitizeStringArray(candidate.longTerm);
  if (shortTerm.length === 0 && longTerm.length === 0) return undefined;
  return {
    shortTerm,
    longTerm,
  };
}

function sanitizeSceneLines(value: unknown): GroupOfflineSceneLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): GroupOfflineSceneLine | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineSceneLine>;
      const text = safeText(candidate.text);
      if (!text) return null;
      const id = safeText(candidate.id) || `group-offline-line-${index + 1}`;
      const speakerId = safeText(candidate.speakerId);
      const speakerLabel = safeText(candidate.speakerLabel);
      const target = sanitizeTargetRef(candidate.target);
      const highlightText = safeText(candidate.highlightText);
      return {
        id,
        ...(speakerId ? { speakerId } : {}),
        ...(speakerLabel ? { speakerLabel } : {}),
        ...(target ? { target } : {}),
        text,
        ...(highlightText ? { highlightText } : {}),
      };
    })
    .filter((item): item is GroupOfflineSceneLine => !!item);
}

function sanitizeCharacterBlocks(value: unknown): GroupOfflineCharacterBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GroupOfflineCharacterBlock | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineCharacterBlock>;
      const characterId = safeText(candidate.characterId);
      const summary = safeText(candidate.summary);
      if (!characterId || !summary) return null;
      const target = sanitizeTargetRef(candidate.target);
      const statusFields = sanitizeStatusFields(candidate.statusFields);
      return {
        characterId,
        summary,
        ...(target ? { target } : {}),
        statusFields,
      };
    })
    .filter((item): item is GroupOfflineCharacterBlock => !!item);
}

function sanitizeRoundCharacterEntries(value: unknown): GroupOfflineRoundCharacterEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GroupOfflineRoundCharacterEntry | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineRoundCharacterEntry>;
      const characterId = safeText(candidate.characterId);
      const speakerLabel = safeText(candidate.speakerLabel);
      const text = safeText(candidate.text);
      if (!characterId || !speakerLabel || !text) return null;
      const target = sanitizeTargetRef(candidate.target);
      const highlightText = safeText(candidate.highlightText);
      const recommendedSong = sanitizeSoundtrack(candidate.recommendedSong);
      const statusFields = sanitizeStatusFields(candidate.statusFields);
      const notebook = safeText(candidate.notebook);
      const aftereffects = sanitizeAftereffects(candidate.aftereffects);
      const memoryPanel = sanitizeMemoryPanel(candidate.memoryPanel);
      const lastOperation = candidate.lastOperation === 'generated'
        || candidate.lastOperation === 'retried'
        || candidate.lastOperation === 'polished'
        || candidate.lastOperation === 'edited'
        ? candidate.lastOperation
        : undefined;

      return {
        characterId,
        speakerLabel,
        ...(target ? { target } : {}),
        text,
        ...(highlightText ? { highlightText } : {}),
        ...(recommendedSong ? { recommendedSong } : {}),
        statusFields,
        ...(notebook ? { notebook } : {}),
        ...(aftereffects ? { aftereffects } : {}),
        ...(memoryPanel ? { memoryPanel } : {}),
        ...(lastOperation ? { lastOperation } : {}),
      };
    })
    .filter((item): item is GroupOfflineRoundCharacterEntry => !!item);
}

function sanitizeDispatchMode(value: unknown): GroupOfflineRoundDispatchMode | undefined {
  return value === 'recommend' || value === 'random' || value === 'manual' || value === 'continue'
    ? value
    : undefined;
}

function sanitizeEndingVoices(value: unknown): GroupOfflineEndingVoice[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GroupOfflineEndingVoice | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineEndingVoice>;
      const characterId = safeText(candidate.characterId);
      const characterName = safeText(candidate.characterName);
      const text = safeText(candidate.text);
      if (!characterId || !characterName || !text) return null;
      return {
        characterId,
        characterName,
        text,
      };
    })
    .filter((item): item is GroupOfflineEndingVoice => !!item);
}

function sanitizePageEpisode(value: unknown): DatingPageEpisode | undefined {
  return value && typeof value === 'object'
    ? value as DatingPageEpisode
    : undefined;
}

function sanitizeRound(value: unknown, index: number): GroupOfflineRound | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<GroupOfflineRound>;
  if (hasUnsupportedStoredGenerationMode(candidate.generationMode)) {
    return null;
  }

  const pageEpisode = sanitizePageEpisode(candidate.pageEpisode);
  const id = safeText(candidate.id) || `group-offline-round-${index + 1}`;
  const title = safeText(candidate.title);
  const sceneText = safeText(candidate.sceneText);
  const characterEntries = sanitizeRoundCharacterEntries(candidate.characterEntries);
  const appliedDirectorInstruction = safeText(candidate.appliedDirectorInstruction);
  const mode = candidate.mode === 'scene' || candidate.mode === 'page_episode'
    ? candidate.mode
    : pageEpisode
      ? 'page_episode'
      : undefined;
  const dispatchMode = sanitizeDispatchMode(candidate.dispatchMode);
  const selectedCharacterIds = sanitizeStringArray(candidate.selectedCharacterIds);
  const userMessageText = safeText(candidate.userMessageText);
  const scenarioUpdate = candidate.scenarioUpdate && typeof candidate.scenarioUpdate === 'object'
    ? candidate.scenarioUpdate
    : undefined;
  const runtimeProjectionSnapshot = candidate.runtimeProjectionSnapshot && typeof candidate.runtimeProjectionSnapshot === 'object'
    ? candidate.runtimeProjectionSnapshot
    : undefined;
  const plannerSnapshot = candidate.plannerSnapshot && typeof candidate.plannerSnapshot === 'object'
    ? candidate.plannerSnapshot
    : undefined;

  if (!sceneText && characterEntries.length === 0 && !pageEpisode) {
    return null;
  }

  return {
    id,
    ...(title ? { title } : {}),
    ...(sceneText ? { sceneText } : {}),
    characterEntries,
    ...(appliedDirectorInstruction ? { appliedDirectorInstruction } : {}),
    ...(mode ? { mode } : {}),
    ...(pageEpisode ? { pageEpisode } : {}),
    generationMode: 'blocks',
    ...(dispatchMode ? { dispatchMode } : {}),
    ...(selectedCharacterIds.length > 0 ? { selectedCharacterIds } : {}),
    ...(userMessageText ? { userMessageText } : {}),
    ...(scenarioUpdate ? { scenarioUpdate } : {}),
    ...(runtimeProjectionSnapshot ? { runtimeProjectionSnapshot } : {}),
    ...(plannerSnapshot ? { plannerSnapshot } : {}),
  };
}

function sanitizeGeneratedContent(value: unknown): GroupOfflineGeneratedContent | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<GroupOfflineGeneratedContent>;
  const cardCandidate = candidate.card && typeof candidate.card === 'object'
    ? candidate.card as Partial<GroupOfflineGeneratedContent['card']>
    : {};
  const soundtrack = sanitizeSoundtrack(candidate.soundtrack);
  const participantSoundtracks = sanitizeParticipantSoundtracks(candidate.participantSoundtracks);
  const rounds = Array.isArray(candidate.rounds)
    ? candidate.rounds
        .map((round, index) => sanitizeRound(round, index))
        .filter((round): round is GroupOfflineRound => !!round)
    : undefined;
  const endingVoices = sanitizeEndingVoices(candidate.endingVoices);

  return {
    card: {
      timeLabel: safeText(cardCandidate.timeLabel) || '',
      locationLabel: safeText(cardCandidate.locationLabel) || '',
      weatherLabel: safeText(cardCandidate.weatherLabel) || '',
      participantLabels: sanitizeStringArray(cardCandidate.participantLabels),
      ...(safeText(cardCandidate.objectiveLabel) ? { objectiveLabel: safeText(cardCandidate.objectiveLabel) } : {}),
      ...(safeText(cardCandidate.roundLabel) ? { roundLabel: safeText(cardCandidate.roundLabel) } : {}),
    },
    intro: safeText(candidate.intro) || '',
    ...(soundtrack ? { soundtrack } : {}),
    ...(participantSoundtracks.length > 0 ? { participantSoundtracks } : {}),
    lines: sanitizeSceneLines(candidate.lines),
    characterBlocks: sanitizeCharacterBlocks(candidate.characterBlocks),
    ...(rounds ? { rounds } : {}),
    ...(endingVoices.length > 0 ? { endingVoices } : {}),
  };
}

function sanitizeLiveMessages(value: unknown): GroupOfflineLiveMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): GroupOfflineLiveMessage | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<GroupOfflineLiveMessage>;
      const role = candidate.role === 'user' || candidate.role === 'system'
        ? candidate.role
        : null;
      const text = safeText(candidate.text);
      const timestamp = isFiniteNumber(candidate.timestamp) ? candidate.timestamp : null;
      if (!role || !text || timestamp === null) return null;
      const id = safeText(candidate.id) || `group-offline-live-${index + 1}`;
      const targetLabel = safeText(candidate.targetLabel);
      return {
        id,
        role,
        text,
        timestamp,
        ...(targetLabel ? { targetLabel } : {}),
      };
    })
    .filter((item): item is GroupOfflineLiveMessage => !!item);
}

function sanitizeSummaryCard(value: unknown): GroupOfflineSession['summaryCard'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<NonNullable<GroupOfflineSession['summaryCard']>>;
  const title = safeText(candidate.title);
  const lines = sanitizeStringArray(candidate.lines);
  if (!title && lines.length === 0) return undefined;
  return {
    title: title || '群线下已结束',
    lines,
  };
}

export function sanitizeGroupOfflineCard(value: unknown): GroupOfflineCard | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<GroupOfflineCard>;
  const title = safeText(candidate.title);
  if (!title) return undefined;
  const status = candidate.status === 'recruiting' || candidate.status === 'active' || candidate.status === 'ended'
    ? candidate.status
    : 'active';

  return {
    kind: 'offline',
    sessionId: safeText(candidate.sessionId) || `group-offline-card-${Date.now()}`,
    title,
    createdBy: safeText(candidate.createdBy) || 'user',
    createdAt: typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt) ? candidate.createdAt : Date.now(),
    mode: normalizeMode(candidate.mode),
    status,
    locationLabel: safeText(candidate.locationLabel) || '地点待定',
    timeLabel: safeText(candidate.timeLabel) || '时间待定',
    ...(safeText(candidate.weatherLabel) ? { weatherLabel: safeText(candidate.weatherLabel) } : {}),
    participantLabels: sanitizeStringArray(candidate.participantLabels),
    ...(safeText(candidate.backgroundLabel) ? { backgroundLabel: safeText(candidate.backgroundLabel) } : {}),
    ...(safeText(candidate.taskLabel) ? { taskLabel: safeText(candidate.taskLabel) } : {}),
    ...(safeText(candidate.statusLabel) ? { statusLabel: safeText(candidate.statusLabel) } : {}),
    ...(safeText(candidate.progressLabel) ? { progressLabel: safeText(candidate.progressLabel) } : {}),
    ...(typeof candidate.signupCount === 'number' && Number.isFinite(candidate.signupCount) ? { signupCount: candidate.signupCount } : {}),
    ...(typeof candidate.confirmedCount === 'number' && Number.isFinite(candidate.confirmedCount) ? { confirmedCount: candidate.confirmedCount } : {}),
    ...(typeof candidate.declinedCount === 'number' && Number.isFinite(candidate.declinedCount) ? { declinedCount: candidate.declinedCount } : {}),
    ...(typeof candidate.pendingCount === 'number' && Number.isFinite(candidate.pendingCount) ? { pendingCount: candidate.pendingCount } : {}),
    ...(typeof candidate.rosterLockedAt === 'number' && Number.isFinite(candidate.rosterLockedAt)
      ? { rosterLockedAt: candidate.rosterLockedAt }
      : {}),
    ...(safeText(candidate.objectiveLabel) ? { objectiveLabel: safeText(candidate.objectiveLabel) } : {}),
    ...(safeText(candidate.roundLabel) ? { roundLabel: safeText(candidate.roundLabel) } : {}),
    ...(Array.isArray(candidate.summaryLines) ? { summaryLines: sanitizeStringArray(candidate.summaryLines) } : {}),
    ...(candidate.soundtrack ? { soundtrack: candidate.soundtrack } : {}),
  };
}

export function sanitizeGroupOfflineRecruitDraft(value: unknown): GroupOfflineRecruitDraft | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<GroupOfflineRecruitDraft>;
  const mode = normalizeMode(candidate.mode);
  const activityType = safeText(candidate.activityType) || '';
  const title = safeText(candidate.title) || activityType;
  if (!title || !activityType) return undefined;

  return {
    createdAt: typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt) ? candidate.createdAt : Date.now(),
    ...(safeText(candidate.recruitCardSessionId) ? { recruitCardSessionId: safeText(candidate.recruitCardSessionId) } : {}),
    title,
    mode,
    activityType,
    ...(safeText(candidate.customActivityType) ? { customActivityType: safeText(candidate.customActivityType) } : {}),
    location: safeText(candidate.location) || '',
    ...(safeText(candidate.scenePrompt) ? { scenePrompt: safeText(candidate.scenePrompt) } : {}),
    timeLabel: safeText(candidate.timeLabel) || '',
    weatherLabel: safeText(candidate.weatherLabel) || '',
    vibe: safeText(candidate.vibe) || '',
    ...(safeText(candidate.highlightColor) ? { highlightColor: safeText(candidate.highlightColor) } : {}),
    ...(safeText(candidate.bodyTextColor) ? { bodyTextColor: safeText(candidate.bodyTextColor) } : {}),
    selectedParticipantIds: sanitizeStringArray(candidate.selectedParticipantIds),
    participantLabels: sanitizeStringArray(candidate.participantLabels),
    selectedWorldBookIds: sanitizeStringArray(candidate.selectedWorldBookIds),
    ...(sanitizeWorldBookSnapshot(candidate.worldBookSnapshot) ? { worldBookSnapshot: sanitizeWorldBookSnapshot(candidate.worldBookSnapshot) } : {}),
    ...(safeText(candidate.backgroundImage) ? { backgroundImage: safeText(candidate.backgroundImage) } : {}),
    ...(candidate.backgroundSource === 'group-background' || candidate.backgroundSource === 'url' || candidate.backgroundSource === 'local-upload'
      ? { backgroundSource: candidate.backgroundSource }
      : {}),
    ...(candidate.narrativePerspective ? { narrativePerspective: candidate.narrativePerspective } : {}),
    ...(candidate.writingPreset ? { writingPreset: candidate.writingPreset } : {}),
    ...(candidate.writingReference ? { writingReference: candidate.writingReference } : {}),
    ...(candidate.dialogueFormat ? { dialogueFormat: candidate.dialogueFormat } : {}),
    ...(candidate.descriptionDensity ? { descriptionDensity: candidate.descriptionDensity } : {}),
    ...(safeText(candidate.writingStyleCustom) ? { writingStyleCustom: safeText(candidate.writingStyleCustom) } : {}),
    ...(safeText(candidate.directorInstruction) ? { directorInstruction: safeText(candidate.directorInstruction) } : {}),
    ...(sanitizeDirectorOutputMode(candidate.directorInstructionOutputMode)
      ? { directorInstructionOutputMode: sanitizeDirectorOutputMode(candidate.directorInstructionOutputMode) }
      : {}),
    ...(sanitizeMemoryWritebackPolicy(candidate.memoryWritebackPolicy)
      ? { memoryWritebackPolicy: sanitizeMemoryWritebackPolicy(candidate.memoryWritebackPolicy) }
      : {}),
    ...(typeof candidate.awaitingDirectorInstruction === 'boolean'
      ? { awaitingDirectorInstruction: candidate.awaitingDirectorInstruction }
      : {}),
    ...(candidate.recruitResponses ? { recruitResponses: sanitizeRecruitResponses(candidate.recruitResponses) } : {}),
    ...(candidate.signedUpParticipantIds ? { signedUpParticipantIds: sanitizeStringArray(candidate.signedUpParticipantIds) } : {}),
    ...(candidate.confirmedParticipantIds ? { confirmedParticipantIds: sanitizeStringArray(candidate.confirmedParticipantIds) } : {}),
    ...(typeof candidate.rosterLockedAt === 'number' && Number.isFinite(candidate.rosterLockedAt)
      ? { rosterLockedAt: candidate.rosterLockedAt }
      : {}),
    ...(typeof candidate.launchedAt === 'number' && Number.isFinite(candidate.launchedAt)
      ? { launchedAt: candidate.launchedAt }
      : {}),
    ...(typeof candidate.maxGeneratedChars === 'number' && Number.isFinite(candidate.maxGeneratedChars)
      ? { maxGeneratedChars: candidate.maxGeneratedChars }
      : {}),
    ...(typeof candidate.roundLimit === 'number' && Number.isFinite(candidate.roundLimit)
      ? { roundLimit: candidate.roundLimit }
      : {}),
    ...(candidate.scenarioState ? { scenarioState: candidate.scenarioState } : {}),
  };
}

export function sanitizeGroupOfflineSession(value: unknown): GroupOfflineSession | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<GroupOfflineSession>;
  const activityType = safeText(candidate.activityType);
  if (!activityType) return undefined;
  if (hasUnsupportedStoredGenerationMode((candidate as { generationMode?: unknown }).generationMode)) return undefined;

  return {
    ...(candidate as GroupOfflineSession),
    mode: normalizeMode(candidate.mode),
    generationMode: 'blocks',
    activityType,
    customActivityType: safeText(candidate.customActivityType),
    location: safeText(candidate.location) || '',
    scenePrompt: safeText(candidate.scenePrompt),
    timeLabel: safeText(candidate.timeLabel) || '',
    weatherLabel: safeText(candidate.weatherLabel) || '',
    vibe: safeText(candidate.vibe) || '',
    selectedWorldBookIds: sanitizeStringArray(candidate.selectedWorldBookIds),
    worldBookSnapshot: sanitizeWorldBookSnapshot(candidate.worldBookSnapshot),
    participants: sanitizeParticipants(candidate.participants),
    messages: sanitizeLiveMessages(candidate.messages),
    generatedContent: sanitizeGeneratedContent(candidate.generatedContent),
    directorInstruction: safeText(candidate.directorInstruction),
    directorInstructionOutputMode: sanitizeDirectorOutputMode(candidate.directorInstructionOutputMode),
    memoryWritebackPolicy: sanitizeMemoryWritebackPolicy(candidate.memoryWritebackPolicy),
    awaitingDirectorInstruction: typeof candidate.awaitingDirectorInstruction === 'boolean'
      ? candidate.awaitingDirectorInstruction
      : undefined,
    summaryCard: sanitizeSummaryCard(candidate.summaryCard),
    sourceRecruitCardSessionId: safeText(candidate.sourceRecruitCardSessionId),
  } as GroupOfflineSession;
}

export function sanitizeChatMessageForOfflineFields(value: unknown): ChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ChatMessage>;
  const timestamp = typeof candidate.timestamp === 'number' && Number.isFinite(candidate.timestamp)
    ? candidate.timestamp
    : null;
  const role = candidate.role === 'user' || candidate.role === 'model' || candidate.role === 'system'
    ? candidate.role
    : null;
  if (timestamp === null || role === null) {
    return null;
  }

  return {
    ...(candidate as ChatMessage),
    timestamp,
    role,
    text: typeof candidate.text === 'string' ? candidate.text : '',
    ...(candidate.groupOfflineCard !== undefined
      ? { groupOfflineCard: sanitizeGroupOfflineCard(candidate.groupOfflineCard) }
      : {}),
    ...(candidate.groupOfflineDraft !== undefined
      ? { groupOfflineDraft: sanitizeGroupOfflineRecruitDraft(candidate.groupOfflineDraft) }
      : {}),
  };
}

export function sanitizeChatMessageArrayForOfflineFields(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((message) => sanitizeChatMessageForOfflineFields(message))
    .filter((message): message is ChatMessage => !!message);
}
