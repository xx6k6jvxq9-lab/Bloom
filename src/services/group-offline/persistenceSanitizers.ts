import type {
  ChatMessage,
  GroupOfflineCard,
  GroupOfflineMode,
  GroupOfflineParticipant,
  GroupOfflineRecruitDraft,
  GroupOfflineSession,
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

function isUnsupportedLegacyGroupOfflineSessionShape(value: Partial<GroupOfflineSession>): boolean {
  const rawSessionGenerationMode = (value as { generationMode?: unknown }).generationMode;
  if (rawSessionGenerationMode === 'ensemble' || rawSessionGenerationMode === 'group') {
    return true;
  }

  const rawRounds = (
    value.generatedContent
    && typeof value.generatedContent === 'object'
    && Array.isArray((value.generatedContent as { rounds?: unknown[] }).rounds)
  )
    ? ((value.generatedContent as { rounds?: unknown[] }).rounds || [])
    : [];

  return rawRounds.some((round) => {
    if (!round || typeof round !== 'object') {
      return false;
    }

    const rawRoundGenerationMode = (round as { generationMode?: unknown }).generationMode;
    return (
      rawRoundGenerationMode === 'ensemble'
      || rawRoundGenerationMode === 'group'
      || !!(round as { articleParagraphs?: unknown[] }).articleParagraphs?.length
    );
  });
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
    ...(typeof candidate.awaitingDirectorInstruction === 'boolean'
      ? { awaitingDirectorInstruction: candidate.awaitingDirectorInstruction }
      : {}),
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
  if (isUnsupportedLegacyGroupOfflineSessionShape(candidate)) return undefined;

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
    messages: Array.isArray(candidate.messages) ? candidate.messages : [],
    generatedContent: candidate.generatedContent,
    directorInstruction: safeText(candidate.directorInstruction),
    awaitingDirectorInstruction: typeof candidate.awaitingDirectorInstruction === 'boolean'
      ? candidate.awaitingDirectorInstruction
      : undefined,
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
