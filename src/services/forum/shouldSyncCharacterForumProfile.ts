import type { Character, ForumRuntimeAuthorProfile } from '../../types';
import { CHARACTER_FORUM_ALIAS_VERSION } from './buildCharacterForumRuntimeProfile';

export const FORUM_PROFILE_AI_RETRY_COOLDOWN_MS = 15 * 60 * 1000;

type ShouldSyncCharacterForumProfileInput = {
  character: Character;
  profile?: ForumRuntimeAuthorProfile;
  now?: number;
  cooldownMs?: number;
};

export function isCharacterForumProfileAiReady(
  character: Character,
  profile?: ForumRuntimeAuthorProfile,
) {
  if (!profile) return false;
  return profile.generationMode === 'ai'
    && profile.aliasVersion === CHARACTER_FORUM_ALIAS_VERSION
    && profile.avatar === character.avatar;
}

export function shouldSyncCharacterForumProfile(input: ShouldSyncCharacterForumProfileInput) {
  const { character, profile } = input;
  const now = input.now || Date.now();
  const cooldownMs = input.cooldownMs || FORUM_PROFILE_AI_RETRY_COOLDOWN_MS;

  if (!profile) return true;
  if (profile.manuallyEdited || profile.generationMode === 'manual') return false;
  if (isCharacterForumProfileAiReady(character, profile)) return false;

  const lastAttemptAt = profile.aiLastAttemptAt || 0;
  const lastFailedAt = profile.aiLastFailedAt || 0;
  if (lastFailedAt > 0 && now - lastFailedAt < cooldownMs) return false;
  if (lastAttemptAt > 0 && now - lastAttemptAt < cooldownMs) return false;

  return true;
}
