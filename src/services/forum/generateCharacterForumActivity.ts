import type {
  ApiConfig,
  Character,
  ForumComment,
  ForumGlobalSettings,
  ForumPost,
  Mask,
  WorldBookEntry,
} from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { buildCharacterForumHabit } from '../../features/forum-domain/characterForumPersona';
import { generateCharacterForumReply } from './generateCharacterForumContribution';

type GenerateCharacterForumReplyActivityInput = {
  activeConfig: ApiConfig;
  post: ForumPost;
  channel: ForumChannel;
  userNewComment?: ForumComment;
  allCharacters: Character[];
  existingPosts: ForumPost[];
  globalSettings?: ForumGlobalSettings;
  masks?: Mask[];
  worldBooks?: WorldBookEntry[];
  resolveAuthorName?: (authorId: string) => string | undefined;
};

function includesCharacterName(text: string, character: Character) {
  const target = `${character.name} ${character.remarkName || ''}`.trim();
  if (!target) return false;
  return target
    .split(/\s+/)
    .filter(Boolean)
    .some((fragment) => text.includes(fragment));
}

function pickWeightedCharacter<T extends { weight: number }>(items: T[]) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;

  let cursor = Math.random() * totalWeight;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return items[0] || null;
}

function getRecentCharacterReplyTimestamp(existingPosts: ForumPost[], characterId: string) {
  return existingPosts
    .flatMap((post) => post.comments)
    .filter((comment) => comment.authorId === characterId)
    .sort((left, right) => right.timestamp - left.timestamp)[0]?.timestamp;
}

function getThreadCharacterIds(post: ForumPost, characterMap: Map<string, Character>) {
  const ids = new Set<string>();
  if (characterMap.has(post.authorId)) ids.add(post.authorId);
  post.comments.forEach((comment) => {
    if (characterMap.has(comment.authorId)) {
      ids.add(comment.authorId);
    }
  });
  return ids;
}

export async function maybeGenerateCharacterForumReplyActivity(
  input: GenerateCharacterForumReplyActivityInput,
) {
  const {
    activeConfig,
    post,
    channel,
    userNewComment,
    allCharacters,
    existingPosts,
    globalSettings,
    masks,
    worldBooks,
    resolveAuthorName,
  } = input;

  if (!userNewComment?.content.trim()) return null;

  const characterMap = new Map(allCharacters.map((character) => [character.id, character]));
  const threadCharacterIds = getThreadCharacterIds(post, characterMap);
  const targetComment = userNewComment.replyToId
    ? post.comments.find((comment) => comment.id === userNewComment.replyToId)
    : undefined;
  const targetedCharacterId = targetComment && characterMap.has(targetComment.authorId)
    ? targetComment.authorId
    : undefined;
  const triggerText = `${post.title} ${post.content} ${userNewComment.content} ${targetComment?.content || ''}`;
  const now = Date.now();

  const candidates = allCharacters
    .filter((character) => (character.postFrequency || 'medium') !== 'none')
    .map((character) => {
      const frequency = character.postFrequency || 'medium';
      const habit = buildCharacterForumHabit(character, channel);
      const recentReplyAt = getRecentCharacterReplyTimestamp(existingPosts, character.id);
      const cooldownMs = frequency === 'high'
        ? 20 * 60 * 1000
        : frequency === 'low'
          ? 100 * 60 * 1000
          : 50 * 60 * 1000;
      const inCooldown = !!recentReplyAt && (now - recentReplyAt) < cooldownMs;
      const isThreadCharacter = threadCharacterIds.has(character.id);
      const isTargetedCharacter = targetedCharacterId === character.id;
      const isPostAuthor = post.authorId === character.id;
      const mentioned = includesCharacterName(triggerText, character);
      const affinityScore = habit.affinity.includes(channel) ? 3 : 0;
      const frequencyScore = frequency === 'high' ? 4 : frequency === 'low' ? 1 : 2;
      const backgroundScore = character.setting?.trim() || character.corePersona?.trim() ? 1 : 0;
      const weight = frequencyScore
        + affinityScore
        + backgroundScore
        + (isThreadCharacter ? 4 : 0)
        + (isTargetedCharacter ? 8 : 0)
        + (isPostAuthor ? 5 : 0)
        + (mentioned ? 2 : 0)
        - (inCooldown ? 6 : 0);

      return {
        character,
        isTargetedCharacter,
        isPostAuthor,
        isThreadCharacter,
        weight,
      };
    })
    .filter((entry) => entry.weight > 0);

  if (!candidates.length) return null;

  const picked = pickWeightedCharacter(candidates);
  if (!picked) return null;

  const triggerChance = picked.isTargetedCharacter
    ? 0.74
    : picked.isPostAuthor
      ? 0.52
      : picked.isThreadCharacter
        ? 0.38
        : 0.22;
  if (Math.random() > triggerChance) return null;

  return generateCharacterForumReply({
    activeConfig,
    character: picked.character,
    post,
    channel,
    globalSettings,
    masks,
    worldBooks,
    userComment: userNewComment.content,
    userCommentAuthorName: resolveAuthorName?.(userNewComment.authorId),
    userReplyTargetContent: targetComment?.content,
    userReplyTargetAuthorName: targetComment ? resolveAuthorName?.(targetComment.authorId) : undefined,
  });
}
