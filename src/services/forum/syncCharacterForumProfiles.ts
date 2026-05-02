import type { Character, ForumRuntimeAuthorProfile } from '../../types';
import { buildCharacterForumRuntimeProfile, CHARACTER_FORUM_ALIAS_VERSION } from './buildCharacterForumRuntimeProfile';

type SyncCharacterForumProfilesInput = {
  characters: Character[];
  runtimeAuthorProfiles: Record<string, ForumRuntimeAuthorProfile>;
};

function areProfilesEqual(left?: ForumRuntimeAuthorProfile, right?: ForumRuntimeAuthorProfile) {
  if (!left || !right) return false;
  return left.id === right.id
    && left.name === right.name
    && left.handle === right.handle
    && left.avatar === right.avatar
    && left.bio === right.bio
    && left.homeChannel === right.homeChannel
    && left.boardScope === right.boardScope
    && left.persona === right.persona
    && left.speakingStyle === right.speakingStyle
    && left.preferredMove === right.preferredMove
    && left.origin === right.origin
    && left.aliasVersion === right.aliasVersion
    && left.manuallyEdited === right.manuallyEdited
    && left.generationMode === right.generationMode
    && left.aiGeneratedAt === right.aiGeneratedAt
    && left.aiLastAttemptAt === right.aiLastAttemptAt
    && left.aiLastFailedAt === right.aiLastFailedAt;
}

function shouldRegenerateCharacterProfile(
  existingProfile: ForumRuntimeAuthorProfile | undefined,
  character: Character,
) {
  if (!existingProfile) return true;
  if (existingProfile.manuallyEdited) return false;
  if (existingProfile.origin !== 'character') return true;
  if (existingProfile.generationMode === 'ai') return false;
  if (existingProfile.aliasVersion !== CHARACTER_FORUM_ALIAS_VERSION) return true;
  if (existingProfile.avatar !== character.avatar) return true;
  return false;
}

export function syncCharacterForumProfiles({
  characters,
  runtimeAuthorProfiles,
}: SyncCharacterForumProfilesInput) {
  let changed = false;
  const nextProfiles = { ...runtimeAuthorProfiles };

  characters.forEach((character) => {
    const existingProfile = nextProfiles[character.id];
    const generatedProfile = buildCharacterForumRuntimeProfile(character);

    if (shouldRegenerateCharacterProfile(existingProfile, character)) {
      if (!areProfilesEqual(existingProfile, generatedProfile)) {
        nextProfiles[character.id] = generatedProfile;
        changed = true;
      }
      return;
    }

    if (!existingProfile) return;

    const refreshedProfile: ForumRuntimeAuthorProfile = {
      ...existingProfile,
      bio: existingProfile.manuallyEdited ? existingProfile.bio : generatedProfile.bio,
      avatar: character.avatar,
      persona: existingProfile.persona || generatedProfile.persona,
      speakingStyle: existingProfile.speakingStyle || generatedProfile.speakingStyle,
      preferredMove: existingProfile.preferredMove || generatedProfile.preferredMove,
      origin: 'character',
      aliasVersion: existingProfile.aliasVersion || CHARACTER_FORUM_ALIAS_VERSION,
      generationMode: existingProfile.generationMode || generatedProfile.generationMode,
      aiGeneratedAt: existingProfile.aiGeneratedAt,
      aiLastAttemptAt: existingProfile.aiLastAttemptAt,
      aiLastFailedAt: existingProfile.aiLastFailedAt,
    };

    if (!areProfilesEqual(existingProfile, refreshedProfile)) {
      nextProfiles[character.id] = refreshedProfile;
      changed = true;
    }
  });

  return {
    changed,
    runtimeAuthorProfiles: nextProfiles,
  };
}
