import type { Character, ForumRuntimeAuthorProfile } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { buildCharacterForumRuntimeProfile } from './buildCharacterForumRuntimeProfile';

function isCustomRuntimeName(runtimeProfile: ForumRuntimeAuthorProfile | undefined, character: Character) {
  const value = runtimeProfile?.name?.trim();
  if (!value) return false;
  return value !== character.name && value !== (character.remarkName || '').trim();
}

function isCustomRuntimeHandle(runtimeProfile: ForumRuntimeAuthorProfile | undefined, character: Character) {
  const value = runtimeProfile?.handle?.replace(/^@/, '').trim();
  if (!value) return false;
  return value !== character.name && value !== (character.remarkName || '').trim();
}

function shouldPreserveCharacterBio(runtimeProfile: ForumRuntimeAuthorProfile | undefined) {
  if (!runtimeProfile?.bio?.trim()) return false;
  return !!runtimeProfile.manuallyEdited || runtimeProfile.generationMode === 'ai';
}

export function resolveCharacterForumDisplayProfile(
  character: Character,
  runtimeProfile?: ForumRuntimeAuthorProfile,
  channel?: ForumChannel,
): ForumRuntimeAuthorProfile {
  const baseProfile = buildCharacterForumRuntimeProfile(character, channel);

  return {
    ...baseProfile,
    name: isCustomRuntimeName(runtimeProfile, character) ? runtimeProfile!.name : baseProfile.name,
    handle: isCustomRuntimeHandle(runtimeProfile, character) ? runtimeProfile!.handle : baseProfile.handle,
    avatar: character.avatar,
    bio: shouldPreserveCharacterBio(runtimeProfile) ? runtimeProfile!.bio.trim() : baseProfile.bio,
    persona: runtimeProfile?.persona || baseProfile.persona,
    speakingStyle: runtimeProfile?.speakingStyle || baseProfile.speakingStyle,
    preferredMove: runtimeProfile?.preferredMove || baseProfile.preferredMove,
  };
}
