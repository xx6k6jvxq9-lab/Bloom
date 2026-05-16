import type {
  ChatMessage,
  Character,
  GroupOfflineCard,
  GroupOfflineGeneratedContent,
  GroupOfflineGenerationMode,
  GroupOfflineParticipant,
  GroupOfflineRound,
  GroupOfflineRoundCharacterEntry,
  GroupOfflineRoundDispatchMode,
  GroupOfflineSession,
} from '../../types';

export type GroupOfflineContentPhase = 'intro' | 'round';

type BuildFallbackGroupOfflineGeneratedContentInput = {
  session: GroupOfflineSession;
  members: Character[];
  userName: string;
  phase?: GroupOfflineContentPhase;
  selectedCharacterIds?: string[];
  dispatchMode?: GroupOfflineRoundDispatchMode;
  userMessageText?: string;
};

type PickParticipantIdsInput = {
  session: GroupOfflineSession;
  members: Character[];
  latestUserMessage?: string;
  desiredCount?: number;
};

export const MAX_GROUP_OFFLINE_BLOCK_SELECTION = 3;

const DEFAULT_WEATHER_BY_MODE: Record<GroupOfflineSession['mode'], string> = {
  daily: '晚风很轻，空气里还带着一点刚散开的热度。',
  scenario: '局势还没摊开，但压迫感已经先落到了每个人肩上。',
  random: '今晚的风向不稳定，像是随时会把场子往某个方向轻轻一带。',
};

function clampCount(value: number, max: number) {
  return Math.max(1, Math.min(value, max, MAX_GROUP_OFFLINE_BLOCK_SELECTION));
}

export function normalizeGroupOfflineGenerationMode(
  mode: GroupOfflineGenerationMode | undefined,
): 'blocks' | 'ensemble' {
  return 'blocks';
}

export function hasRemovedGroupOfflineEnsembleContent(
  session: GroupOfflineSession | null | undefined,
): boolean {
  if (!session) {
    return false;
  }

  if (session.generationMode === 'ensemble' || session.generationMode === 'group') {
    return true;
  }

  return (session.generatedContent?.rounds || []).some((round) => (
    round.generationMode === 'ensemble'
    || round.generationMode === 'group'
    || !!round.articleParagraphs?.length
  ));
}

function buildRoundLabel(session: GroupOfflineSession): string {
  if (session.currentRound <= 0) {
    return '共景';
  }
  return session.roundLimit
    ? `第 ${session.currentRound}/${session.roundLimit} 轮`
    : `第 ${session.currentRound} 轮`;
}

export function createGroupOfflineSessionId(seed = Date.now()): string {
  return `group-offline-${seed}`;
}

export function createGroupOfflineRoundId(seed = Date.now()): string {
  return `group-offline-round-${seed}`;
}

export function createGroupOfflineMessageId(seed = Date.now()): string {
  return `group-offline-msg-${seed}`;
}

function buildParticipantLabels(session: GroupOfflineSession, members: Character[]): string[] {
  return session.participants
    .map((participant) => members.find((member) => member.id === participant.characterId)?.name || '')
    .filter(Boolean);
}

function buildCardFromSession(
  session: GroupOfflineSession,
  members: Character[],
  summaryLines?: string[],
): GroupOfflineCard {
  return {
    kind: 'offline',
    sessionId: session.id,
    title: session.customActivityType?.trim() || session.activityType,
    createdBy: 'user',
    createdAt: session.createdAt,
    mode: session.mode,
    status: session.status,
    locationLabel: session.location,
    timeLabel: session.timeLabel,
    weatherLabel: session.weatherLabel,
    participantLabels: buildParticipantLabels(session, members),
    objectiveLabel: session.mode === 'scenario' ? '设定局推进中' : undefined,
    roundLabel: buildRoundLabel(session),
    summaryLines,
    soundtrack: session.generatedContent?.soundtrack,
  };
}

export function createGroupOfflineStartMessage(params: {
  session: GroupOfflineSession;
  members: Character[];
}): ChatMessage {
  const card = buildCardFromSession(params.session, params.members);
  return {
    role: 'model',
    text: `[group-offline] ${card.title}`,
    timestamp: params.session.createdAt,
    isSystem: true,
    groupOfflineCard: card,
  };
}

export function createGroupOfflineEndedMessage(params: {
  session: GroupOfflineSession;
  members: Character[];
  summaryLines: string[];
}): ChatMessage {
  const card = buildCardFromSession(
    {
      ...params.session,
      status: 'ended',
    },
    params.members,
    params.summaryLines,
  );

  return {
    role: 'model',
    text: `[group-offline-ended] ${card.title}`,
    timestamp: params.session.endedAt || Date.now(),
    isSystem: true,
    groupOfflineCard: {
      ...card,
      status: 'ended',
    },
  };
}

function resolveRoundParticipantsForShell(input: BuildFallbackGroupOfflineGeneratedContentInput): GroupOfflineParticipant[] {
  const selectedParticipants = (input.selectedCharacterIds || [])
    .map((characterId) => input.session.participants.find((participant) => participant.characterId === characterId))
    .filter((participant): participant is GroupOfflineParticipant => !!participant);

  if (selectedParticipants.length > 0) {
    return selectedParticipants;
  }

  const legacyDesiredCount = input.session.generationMode === 'single'
    ? 1
    : input.session.generationMode === 'pair'
      ? 2
      : 2;

  return input.session.participants.slice(0, clampCount(legacyDesiredCount, input.session.participants.length));
}

function buildRoundEntryShells(input: BuildFallbackGroupOfflineGeneratedContentInput): GroupOfflineRoundCharacterEntry[] {
  const selectedParticipants = resolveRoundParticipantsForShell(input);

  return selectedParticipants
    .map((participant, index) => {
      const member = input.members.find((item) => item.id === participant.characterId);
      if (!member) {
        return null;
      }

      const targetMember = selectedParticipants[index - 1]
        ? input.members.find((item) => item.id === selectedParticipants[index - 1]?.characterId)
        : undefined;

      return {
        characterId: member.id,
        speakerLabel: member.name,
        target: {
          type: index === 0 ? 'user' : 'character',
          label: index === 0 ? input.userName : (targetMember?.name || '全场'),
          ...(index === 0 ? {} : { characterId: targetMember?.id }),
        },
        text: '',
        statusFields: [],
        lastOperation: 'generated',
      } satisfies GroupOfflineRoundCharacterEntry;
    })
    .filter(Boolean) as GroupOfflineRoundCharacterEntry[];
}

export function syncGroupOfflineDerivedContent(content: GroupOfflineGeneratedContent): GroupOfflineGeneratedContent {
  const rounds = content.rounds || [];
  const latestEntries = rounds[rounds.length - 1]?.characterEntries || [];

  return {
    ...content,
    lines: rounds.flatMap((round) =>
      round.characterEntries.map((entry, index) => ({
        id: `${round.id}-line-${index + 1}`,
        speakerId: entry.characterId,
        speakerLabel: entry.speakerLabel,
        target: entry.target,
        text: entry.text,
        highlightText: entry.highlightText,
      })),
    ),
    characterBlocks: latestEntries.map((entry) => ({
      characterId: entry.characterId,
      summary: entry.text,
      target: entry.target,
      statusFields: entry.statusFields,
    })),
  };
}

export function buildGroupOfflineGeneratedContentShell(
  input: BuildFallbackGroupOfflineGeneratedContentInput,
): GroupOfflineGeneratedContent {
  const phase = input.phase || 'round';
  const participantLabels = buildParticipantLabels(input.session, input.members);

  const baseContent: GroupOfflineGeneratedContent = {
    card: {
      timeLabel: input.session.timeLabel,
      locationLabel: input.session.location,
      weatherLabel: input.session.weatherLabel || DEFAULT_WEATHER_BY_MODE[input.session.mode],
      participantLabels,
      objectiveLabel: input.session.mode === 'scenario' ? '设定局推进中。' : undefined,
      roundLabel: buildRoundLabel(input.session),
    },
    intro: input.session.generatedContent?.intro || '',
    soundtrack: input.session.generatedContent?.soundtrack,
    participantSoundtracks: input.session.generatedContent?.participantSoundtracks,
    lines: [],
    characterBlocks: [],
    rounds: input.session.generatedContent?.rounds || [],
  };

  if (phase === 'intro') {
    return baseContent;
  }

  const roundEntries = buildRoundEntryShells(input);
  const roundShell: GroupOfflineRound = {
    id: createGroupOfflineRoundId(input.session.updatedAt || Date.now()),
    title: normalizeGroupOfflineGenerationMode(input.session.generationMode) === 'ensemble' ? '同场推进' : '分块推进',
    sceneText: undefined,
    articleParagraphs: [],
    characterEntries: roundEntries,
    generationMode: normalizeGroupOfflineGenerationMode(input.session.generationMode),
    dispatchMode: input.dispatchMode,
    selectedCharacterIds: roundEntries.map((entry) => entry.characterId),
    userMessageText: input.userMessageText?.trim() || undefined,
  };

  return syncGroupOfflineDerivedContent({
    ...baseContent,
    rounds: [roundShell],
  });
}

export function mergeGroupOfflineGeneratedContent(
  previous: GroupOfflineGeneratedContent | undefined,
  next: GroupOfflineGeneratedContent,
): GroupOfflineGeneratedContent {
  if (!previous) {
    return syncGroupOfflineDerivedContent(next);
  }

  const mergedRounds = [
    ...(previous.rounds || []),
    ...((next.rounds || []).filter((round) => !(previous.rounds || []).some((existing) => existing.id === round.id))),
  ];

  return syncGroupOfflineDerivedContent({
    ...previous,
    ...next,
    rounds: mergedRounds,
  });
}

function buildMentionTokens(member: Character): string[] {
  return [
    member.name,
    member.remarkName?.trim() || '',
  ].filter(Boolean);
}

function countMentionsInText(member: Character, text: string): number {
  return buildMentionTokens(member).reduce((count, token) => (
    token && text.includes(token) ? count + 1 : count
  ), 0);
}

function getRecentRoundSpeakerSets(session: GroupOfflineSession) {
  const rounds = session.generatedContent?.rounds || [];
  const lastRound = rounds[rounds.length - 1];
  const previousRound = rounds[rounds.length - 2];

  return {
    lastRoundSpeakers: new Set((lastRound?.characterEntries || []).map((entry) => entry.characterId)),
    previousRoundSpeakers: new Set((previousRound?.characterEntries || []).map((entry) => entry.characterId)),
  };
}

function resolveParticipantMemberMap(session: GroupOfflineSession, members: Character[]) {
  const participantIds = new Set(session.participants.map((participant) => participant.characterId));
  return members.filter((member) => participantIds.has(member.id));
}

export function pickRecommendedGroupOfflineParticipantIds(
  input: PickParticipantIdsInput,
): string[] {
  const participantMembers = resolveParticipantMemberMap(input.session, input.members);
  if (participantMembers.length === 0) return [];

  const desiredCount = clampCount(input.desiredCount || Math.min(2, participantMembers.length), participantMembers.length);
  const latestUserMessage = input.latestUserMessage?.trim() || '';
  const { lastRoundSpeakers, previousRoundSpeakers } = getRecentRoundSpeakerSets(input.session);

  return participantMembers
    .map((member, index) => {
      const participant = input.session.participants.find((item) => item.characterId === member.id);
      const mentionScore = latestUserMessage ? countMentionsInText(member, latestUserMessage) * 2.8 : 0;
      const recencyScore = lastRoundSpeakers.has(member.id)
        ? -1.1
        : previousRoundSpeakers.has(member.id)
          ? 0.35
          : 1.35;
      const arrivalScore = participant?.presence === 'added_midway' ? 0.9 : 0;
      const stabilityScore = index * -0.04;
      return {
        characterId: member.id,
        score: mentionScore + recencyScore + arrivalScore + stabilityScore,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, desiredCount)
    .map((entry) => entry.characterId);
}

export function pickRandomGroupOfflineParticipantIds(
  input: PickParticipantIdsInput,
): string[] {
  const participantMembers = resolveParticipantMemberMap(input.session, input.members);
  if (participantMembers.length === 0) return [];

  const desiredCount = clampCount(input.desiredCount || Math.min(2, participantMembers.length), participantMembers.length);
  const latestUserMessage = input.latestUserMessage?.trim() || '';
  const { lastRoundSpeakers } = getRecentRoundSpeakerSets(input.session);
  const pool = participantMembers.map((member) => {
    const mentionWeight = latestUserMessage ? countMentionsInText(member, latestUserMessage) * 1.5 : 0;
    const recencyWeight = lastRoundSpeakers.has(member.id) ? 0.55 : 1.25;
    const participant = input.session.participants.find((item) => item.characterId === member.id);
    const arrivalWeight = participant?.presence === 'added_midway' ? 0.45 : 0;
    return {
      characterId: member.id,
      weight: Math.max(0.2, recencyWeight + mentionWeight + arrivalWeight),
    };
  });

  const selected: string[] = [];
  const workingPool = [...pool];

  while (selected.length < desiredCount && workingPool.length > 0) {
    const totalWeight = workingPool.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * totalWeight;
    let pickedIndex = 0;

    for (let index = 0; index < workingPool.length; index += 1) {
      cursor -= workingPool[index].weight;
      if (cursor <= 0) {
        pickedIndex = index;
        break;
      }
    }

    const [picked] = workingPool.splice(pickedIndex, 1);
    if (picked) {
      selected.push(picked.characterId);
    }
  }

  return selected;
}
