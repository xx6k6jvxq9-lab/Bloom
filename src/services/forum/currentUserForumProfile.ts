import type { ForumRuntimeAuthorProfile, UserProfileExtended } from '../../types';
import { resolveStableNumericId } from '../social-id/stableNumericId';

type ResolveCurrentUserForumProfileInput = {
  currentUser: UserProfileExtended;
  runtimeProfile?: ForumRuntimeAuthorProfile;
};

type BuildUpdatedCurrentUserForumProfileInput = {
  currentUser: UserProfileExtended;
  runtimeProfiles: Record<string, ForumRuntimeAuthorProfile>;
  draft: {
    name: string;
    handle: string;
    bio: string;
    avatar: string;
  };
};

export function resolveCurrentUserForumProfile(
  input: ResolveCurrentUserForumProfileInput,
): ForumRuntimeAuthorProfile {
  const { currentUser, runtimeProfile } = input;

  return {
    id: currentUser.id,
    numericId: resolveStableNumericId(currentUser.id, runtimeProfile?.numericId),
    name: runtimeProfile?.name?.trim() || currentUser.name,
    handle: runtimeProfile?.handle?.replace(/^@/, '').trim() || currentUser.id.replace(/^@/, '').trim(),
    avatar: runtimeProfile?.avatar?.trim() || currentUser.avatar,
    bio: runtimeProfile?.bio?.trim() || currentUser.bio || '',
    origin: 'custom',
    manuallyEdited: runtimeProfile?.manuallyEdited ?? false,
    generationMode: runtimeProfile?.generationMode || 'manual',
  };
}

export function buildUpdatedCurrentUserForumProfiles(
  input: BuildUpdatedCurrentUserForumProfileInput,
): Record<string, ForumRuntimeAuthorProfile> {
  const { currentUser, runtimeProfiles, draft } = input;
  const baseProfile = resolveCurrentUserForumProfile({
    currentUser,
    runtimeProfile: runtimeProfiles[currentUser.id],
  });

  return {
    ...runtimeProfiles,
    [currentUser.id]: {
      ...baseProfile,
      name: draft.name.trim() || baseProfile.name,
      handle: draft.handle.trim().replace(/^@/, '') || baseProfile.handle,
      bio: draft.bio.trim() || '',
      avatar: draft.avatar.trim() || baseProfile.avatar,
      origin: 'custom',
      manuallyEdited: true,
      generationMode: 'manual',
    },
  };
}
