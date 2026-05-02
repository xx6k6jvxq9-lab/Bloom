import type { Character, ForumRuntimeAuthorProfile } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { buildCharacterForumHabit } from '../../features/forum-domain/characterForumPersona';
import { buildCharacterForumAlias } from './buildCharacterForumAlias';
import { buildCharacterForumBio } from './buildCharacterForumBio';

export const CHARACTER_FORUM_ALIAS_VERSION = 4;

export function buildCharacterForumRuntimeProfile(
  character: Character,
  channel?: ForumChannel,
): ForumRuntimeAuthorProfile {
  const forumHabit = buildCharacterForumHabit(character, channel);
  const identity = buildCharacterForumAlias(
    character,
    forumHabit.primaryChannel,
    `${character.signature || ''} ${character.corePersona || ''} ${character.setting || ''}`,
  );

  return {
    id: character.id,
    name: identity.displayName,
    handle: identity.handle,
    avatar: character.avatar,
    bio: buildCharacterForumBio(character),
    homeChannel: forumHabit.primaryChannel,
    boardScope: 'public',
    persona: forumHabit.persona,
    speakingStyle: forumHabit.speakingStyle,
    preferredMove: forumHabit.preferredMove,
    origin: 'character',
    aliasVersion: CHARACTER_FORUM_ALIAS_VERSION,
    manuallyEdited: false,
    generationMode: 'fallback',
  };
}
