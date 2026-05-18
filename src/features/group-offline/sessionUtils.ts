import type {
  ChatMessage,
  Character,
  GroupOfflineCard,
  GroupOfflineGeneratedContent,
  GroupOfflineParticipant,
  GroupOfflineRecruitDraft,
  GroupOfflineRound,
  GroupOfflineRoundCharacterEntry,
  GroupOfflineRoundDispatchMode,
  GroupOfflineSession,
} from '../../types';
import {
  buildGroupOfflineScenarioCardFields,
  getGroupOfflineScenarioRemainingRounds,
} from '../../services/group-offline/scenarioTasks';
import { buildGroupOfflineRecruitStatusSummary } from '../../services/group-offline/recruitState';

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

function buildRoundLabel(session: GroupOfflineSession): string {
  if (session.currentRound <= 0) {
    const remainingRounds = getGroupOfflineScenarioRemainingRounds(session);
    return typeof remainingRounds === 'number'
      ? `共景 · 剩余 ${remainingRounds} 轮`
      : '共景';
  }
  const remainingRounds = getGroupOfflineScenarioRemainingRounds(session);
  if (session.roundLimit) {
    return typeof remainingRounds === 'number'
      ? `第 ${session.currentRound}/${session.roundLimit} 轮 · 剩余 ${remainingRounds} 轮`
      : `第 ${session.currentRound}/${session.roundLimit} 轮`;
  }
  return `第 ${session.currentRound} 轮`;
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
  const scenarioCardFields = buildGroupOfflineScenarioCardFields(session);
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
    ...scenarioCardFields,
    roundLabel: scenarioCardFields.roundLabel || buildRoundLabel(session),
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

function normalizeRecruitParticipantIds(value: string[] | undefined): string[] {
  return Array.from(new Set((value || []).filter((item) => typeof item === 'string' && item.trim().length > 0)));
}

type BuildGroupOfflineRecruitCardParams = {
  draft: GroupOfflineRecruitDraft;
  createdBy: string;
  timestamp?: number;
  status?: GroupOfflineCard['status'];
  participantLabelsOverride?: string[];
  summaryLinesOverride?: string[];
};

export function buildGroupOfflineRecruitCard(params: BuildGroupOfflineRecruitCardParams): GroupOfflineCard {
  const createdAt = params.timestamp ?? params.draft.createdAt;
  const signupCount = normalizeRecruitParticipantIds(params.draft.signedUpParticipantIds).length;
  const invitedCount = normalizeRecruitParticipantIds(params.draft.selectedParticipantIds).length;
  const status = params.status || 'recruiting';
  const participantLabels = params.participantLabelsOverride || params.draft.participantLabels;
  const recruitStatusSummary = buildGroupOfflineRecruitStatusSummary({
    draft: params.draft,
  });
  const declinedCount = recruitStatusSummary.declinedCount;
  const pendingCount = recruitStatusSummary.pendingCount;
  const recruitSummaryLines = [
    invitedCount > 0 ? `拟邀 ${invitedCount} 人` : '开放报名中',
    `已报名 ${signupCount} 人`,
    signupCount > 0 && participantLabels.length > 0
      ? `当前报名：${participantLabels.join('、')}` : '',
    signupCount > 0
      ? '已有角色公开报名，可以按名单直接开局。'
      : '等待群里的角色公开表态。',
  ].filter(Boolean);
  const defaultStatusLabel = status === 'active'
    ? '已开局'
    : status === 'ended'
      ? '已结束'
      : signupCount > 0
        ? '待开局'
        : '征集中';
  const defaultSummaryLines = status === 'recruiting'
    ? [
        participantLabels.length > 0 ? `拟邀 ${participantLabels.length} 人` : '开放报名中',
        `已报名 ${signupCount} 人`,
        signupCount > 0 ? '有角色报名后就可以直接开局。' : '',
      ].filter(Boolean)
    : [];
  const effectiveStatusLabel = status === 'active'
    ? '已开局'
    : status === 'ended'
      ? '已结束'
      : signupCount > 0
        ? '待开局'
        : pendingCount > 0
          ? '征集中'
          : '本轮无人接局';
  const effectiveRecruitSummaryLines = [
    recruitStatusSummary.invitedCount > 0 ? `拟邀 ${recruitStatusSummary.invitedCount} 人` : '开放报名中',
    `已报名 ${signupCount} 人`,
    declinedCount > 0 ? `已婉拒 ${declinedCount} 人` : '',
    pendingCount > 0 ? `待表态 ${pendingCount} 人` : '',
    signupCount > 0 && participantLabels.length > 0 ? `当前报名：${participantLabels.join('、')}` : '',
    pendingCount > 0
      ? '还可以继续征集剩下没表态的人。'
      : signupCount > 0
        ? '这轮征集已经有名单，可以直接按报名名单开局。'
        : '这轮征集已经收口，但还没人公开接局。',
  ].filter(Boolean);

  return {
    kind: 'offline',
    sessionId: params.draft.recruitCardSessionId || `group-offline-recruit-${createdAt}`,
    title: params.draft.title,
    createdBy: params.createdBy,
    createdAt,
    mode: params.draft.mode,
    status,
    locationLabel: params.draft.location,
    timeLabel: params.draft.timeLabel,
    weatherLabel: params.draft.weatherLabel,
    participantLabels,
    statusLabel: effectiveStatusLabel,
    signupCount,
    declinedCount,
    pendingCount,
    ...(((params.summaryLinesOverride || (status === 'recruiting' ? effectiveRecruitSummaryLines : defaultSummaryLines)).length > 0)
      ? { summaryLines: params.summaryLinesOverride || (status === 'recruiting' ? effectiveRecruitSummaryLines : defaultSummaryLines) }
      : {}),
    ...(params.draft.mode === 'scenario' && params.draft.scenarioState
      ? {
          backgroundLabel: params.draft.scenarioState.backgroundLabel,
          taskLabel: params.draft.scenarioState.currentTask,
          progressLabel: params.draft.scenarioState.progressSummary,
          objectiveLabel: params.draft.scenarioState.currentTask,
          roundLabel: typeof params.draft.roundLimit === 'number'
            ? `共景 · 剩余 ${params.draft.roundLimit} 轮`
            : '共景',
        }
      : {}),
  };
}

export function createGroupOfflineRecruitMessage(params: {
  draft: GroupOfflineRecruitDraft;
  createdBy: string;
  timestamp?: number;
}): ChatMessage {
  const createdAt = params.timestamp ?? params.draft.createdAt;
  const card = buildGroupOfflineRecruitCard({
    draft: params.draft,
    createdBy: params.createdBy,
    timestamp: createdAt,
    status: 'recruiting',
  });

  return {
    role: 'user',
    text: `[group-offline-recruit] ${card.title}`,
    timestamp: createdAt,
    groupOfflineCard: card,
    groupOfflineDraft: params.draft,
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

  if (input.session.participants.length === 0) {
    return [];
  }

  const defaultDesiredCount = Math.min(2, input.session.participants.length);
  return input.session.participants.slice(0, clampCount(defaultDesiredCount, input.session.participants.length));
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
  const scenarioCardFields = buildGroupOfflineScenarioCardFields(input.session);

  const baseContent: GroupOfflineGeneratedContent = {
    card: {
      timeLabel: input.session.timeLabel,
      locationLabel: input.session.location,
      weatherLabel: input.session.weatherLabel || DEFAULT_WEATHER_BY_MODE[input.session.mode],
      participantLabels,
      objectiveLabel: scenarioCardFields.objectiveLabel,
      roundLabel: scenarioCardFields.roundLabel || buildRoundLabel(input.session),
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
    title: '分块推进',
    sceneText: undefined,
    characterEntries: roundEntries,
    generationMode: 'blocks',
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
