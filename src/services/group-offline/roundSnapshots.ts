import type {
  GroupOfflineRound,
  GroupOfflineRoundPlanSnapshot,
  GroupOfflineRoundRuntimeProjectionSnapshot,
  GroupOfflineSession,
  GroupOfflineTargetRef,
} from '../../types';
import type {
  GroupOfflineRoundPlan,
  GroupOfflineRoundPlanCharacterStep,
  GroupOfflineRuntimeProjection,
} from './types';

function normalizeGenerationMode(mode: GroupOfflineSession['generationMode'] | GroupOfflineRound['generationMode']): 'blocks' | 'ensemble' {
  return mode === 'ensemble' || mode === 'group' ? 'ensemble' : 'blocks';
}

function cloneTarget(target: GroupOfflineTargetRef): GroupOfflineTargetRef {
  return {
    type: target.type,
    label: target.label,
    ...(target.characterId ? { characterId: target.characterId } : {}),
  };
}

export function buildGroupOfflineRoundRuntimeProjectionSnapshot(
  projection: GroupOfflineRuntimeProjection,
): GroupOfflineRoundRuntimeProjectionSnapshot {
  return {
    userName: projection.userName,
    groupName: projection.groupName,
    groupSummary: { ...projection.groupSummary },
    characters: projection.characters.map((character) => ({
      identity: {
        ...character.identity,
        avatarCandidates: [...character.identity.avatarCandidates],
      },
      persona: { ...character.persona },
      memory: { ...character.memory },
      userRelation: { ...character.userRelation },
      peerRelations: character.peerRelations.map((relation) => ({ ...relation })),
      groupState: { ...character.groupState },
      relationshipContextSummary: character.relationshipContextSummary,
    })),
  };
}

export function hydrateGroupOfflineRuntimeProjectionSnapshot(
  snapshot: GroupOfflineRoundRuntimeProjectionSnapshot,
  session: GroupOfflineSession,
): GroupOfflineRuntimeProjection {
  return {
    session: {
      id: session.id,
      groupId: session.groupId,
      mode: session.mode,
      generationMode: session.generationMode,
      activityType: session.activityType,
      customActivityType: session.customActivityType,
      location: session.location,
      timeLabel: session.timeLabel,
      weatherLabel: session.weatherLabel,
      vibe: session.vibe,
      currentRound: session.currentRound,
    },
    userName: snapshot.userName,
    groupName: snapshot.groupName,
    generatedAt: Date.now(),
    groupSummary: { ...snapshot.groupSummary },
    characters: snapshot.characters.map((character) => ({
      identity: {
        ...character.identity,
        avatarCandidates: [...character.identity.avatarCandidates],
      },
      persona: { ...character.persona },
      memory: { ...character.memory },
      userRelation: { ...character.userRelation },
      peerRelations: character.peerRelations.map((relation) => ({ ...relation })),
      groupState: { ...character.groupState },
      relationshipContextSummary: character.relationshipContextSummary,
    })),
  };
}

export function buildGroupOfflineRoundPlanSnapshot(
  plan: GroupOfflineRoundPlan,
): GroupOfflineRoundPlanSnapshot {
  return {
    generationMode: plan.generationMode,
    dispatchMode: plan.dispatchMode,
    selectedCharacterIds: [...plan.selectedCharacterIds],
    summary: plan.summary,
    characterSteps: plan.characterSteps.map((step) => ({
      characterId: step.characterId,
      speakerLabel: step.speakerLabel,
      target: cloneTarget(step.target),
    })),
  };
}

export function hydrateGroupOfflineRoundPlanSnapshot(
  snapshot: GroupOfflineRoundPlanSnapshot,
): GroupOfflineRoundPlan {
  return {
    generationMode: snapshot.generationMode,
    dispatchMode: snapshot.dispatchMode,
    selectedCharacterIds: [...snapshot.selectedCharacterIds],
    summary: snapshot.summary,
    characterSteps: snapshot.characterSteps.map((step) => ({
      characterId: step.characterId,
      speakerLabel: step.speakerLabel,
      target: cloneTarget(step.target),
    })),
  };
}

function deriveRoundPlanSummary(round: GroupOfflineRound, steps: GroupOfflineRoundPlanCharacterStep[]): string {
  const orderedNames = steps.map((step) => step.speakerLabel).join(' -> ');
  if (!orderedNames) {
    return '本轮暂时还没有可用的出场顺序。';
  }
  if (normalizeGenerationMode(round.generationMode) === 'ensemble') {
    return `本轮继续同场，当前在场角色是：${steps.map((step) => step.speakerLabel).join('、')}。`;
  }
  if (round.dispatchMode === 'manual') {
    return `本轮按手动顺序出场：${orderedNames}。`;
  }
  if (round.dispatchMode === 'random') {
    return `本轮按随机结果出场：${orderedNames}。`;
  }
  if (round.dispatchMode === 'continue') {
    return `本轮继续同场：${orderedNames}。`;
  }
  return `本轮按系统调度出场：${orderedNames}。`;
}

export function deriveRoundPlanFromRound(
  round: GroupOfflineRound,
  session: GroupOfflineSession,
): GroupOfflineRoundPlan | undefined {
  const orderedCharacterIds = round.selectedCharacterIds?.length
    ? round.selectedCharacterIds
    : round.characterEntries.map((entry) => entry.characterId);
  if (orderedCharacterIds.length === 0) {
    return undefined;
  }

  const entryById = new Map(round.characterEntries.map((entry) => [entry.characterId, entry]));
  const steps: GroupOfflineRoundPlanCharacterStep[] = orderedCharacterIds
    .map((characterId) => {
      const entry = entryById.get(characterId);
      if (!entry) return null;
      return {
        characterId,
        speakerLabel: entry.speakerLabel,
        target: entry.target ? cloneTarget(entry.target) : { type: 'group', label: '全场' },
      } satisfies GroupOfflineRoundPlanCharacterStep;
    })
    .filter((step): step is GroupOfflineRoundPlanCharacterStep => !!step);

  if (steps.length === 0) {
    return undefined;
  }

  return {
    generationMode: normalizeGenerationMode(round.generationMode ?? session.generationMode),
    dispatchMode: round.dispatchMode,
    selectedCharacterIds: steps.map((step) => step.characterId),
    summary: deriveRoundPlanSummary(round, steps),
    characterSteps: steps,
  };
}

export function resolveRoundRuntimeProjection(
  round: GroupOfflineRound,
  session: GroupOfflineSession,
  liveProjection: GroupOfflineRuntimeProjection,
): GroupOfflineRuntimeProjection {
  return round.runtimeProjectionSnapshot
    ? hydrateGroupOfflineRuntimeProjectionSnapshot(round.runtimeProjectionSnapshot, session)
    : liveProjection;
}

export function resolveRoundPlannerSnapshot(
  round: GroupOfflineRound,
  session: GroupOfflineSession,
): GroupOfflineRoundPlan | undefined {
  if (round.plannerSnapshot) {
    return hydrateGroupOfflineRoundPlanSnapshot(round.plannerSnapshot);
  }
  return deriveRoundPlanFromRound(round, session);
}
