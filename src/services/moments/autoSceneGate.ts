import type { Character } from '../../types';
import { rebuildSharedStateFromCharacter } from '../relationship-context/buildSharedCharacterState';
import type { AutoMomentSchedulerTrigger } from './autoScheduler';

export type AutoMomentSceneGateDecision = {
  allowed: boolean;
  reason?: string;
  restriction?: 'scene_carryover_only';
};

const AUTO_MOMENT_RECENT_STRONG_SCENE_LOCK_MS = 12 * 60 * 1000;

const STRONG_INTERACTION_SURFACES = new Set([
  'chat-session',
  'group-chat-session',
  'couple-space',
  'music',
  'forum',
  'dream',
]);

const STRONG_CHARACTER_SOURCE_SCENES = new Set<NonNullable<Character['sharedState']>['sourceScene']>([
  'direct_chat',
  'group_chat',
  'dating',
  'music_together',
  'couple_space',
]);

export function isStrongAutoMomentInteractionSurface(activeApp: string) {
  return STRONG_INTERACTION_SURFACES.has(activeApp);
}

export function getCharacterAutoMomentSceneGate(options: {
  character: Character;
  trigger: AutoMomentSchedulerTrigger;
  now?: number;
  recentLockMs?: number;
}): AutoMomentSceneGateDecision {
  const {
    character,
    trigger,
    now = Date.now(),
    recentLockMs = AUTO_MOMENT_RECENT_STRONG_SCENE_LOCK_MS,
  } = options;

  if (character.activeDatingState?.status === 'active') {
    if (trigger === 'manual_refresh') {
      return {
        allowed: true,
        reason: 'active-dating-scene',
        restriction: 'scene_carryover_only',
      };
    }

    return {
      allowed: false,
      reason: 'active-dating-scene',
    };
  }

  const sharedState = rebuildSharedStateFromCharacter({
    character,
  });
  if (!sharedState || !STRONG_CHARACTER_SOURCE_SCENES.has(sharedState.sourceScene)) {
    return { allowed: true };
  }

  const updatedAt = sharedState.updatedAt || 0;
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return { allowed: true };
  }

  if (now - updatedAt < recentLockMs) {
    if (trigger === 'manual_refresh') {
      return {
        allowed: true,
        reason: `recent-${sharedState.sourceScene}`,
        restriction: 'scene_carryover_only',
      };
    }

    return {
      allowed: false,
      reason: `recent-${sharedState.sourceScene}`,
    };
  }

  return { allowed: true };
}

export function filterAutoMomentSceneUnlockedCharacters(options: {
  characters: Character[];
  trigger: AutoMomentSchedulerTrigger;
  now?: number;
  includeRestricted?: boolean;
}) {
  const {
    characters,
    trigger,
    now = Date.now(),
    includeRestricted = false,
  } = options;

  return characters.filter((character) => {
    const decision = getCharacterAutoMomentSceneGate({
      character,
      trigger,
      now,
    });

    if (!decision.allowed) {
      return false;
    }

    if (!includeRestricted && decision.restriction === 'scene_carryover_only') {
      return false;
    }

    return true;
  });
}
