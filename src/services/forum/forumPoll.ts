import type { ForumPost } from '../../types';

export type ForumPollOptionState = {
  id: string;
  text: string;
  voterIds: string[];
};

function normalizeLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function collectSeedVoterIds(post: ForumPost) {
  const ids = new Set<string>();

  post.comments.forEach((comment) => {
    if (comment.authorId && comment.authorId !== post.authorId) {
      ids.add(comment.authorId);
    }
  });
  post.likes.forEach((id) => {
    if (id && id !== post.authorId) ids.add(id);
  });
  post.collections.forEach((id) => {
    if (id && id !== post.authorId) ids.add(id);
  });

  const targetCount = Math.max(
    ids.size,
    Math.min(8, Math.max(2, Math.floor((post.viewCount || 0) / 25))),
  );

  let cursor = 0;
  while (ids.size < targetCount) {
    ids.add(`poll-seed-${post.id}-${cursor}`);
    cursor += 1;
  }

  return Array.from(ids);
}

function isVoteOptionLine(value: string) {
  return /^[A-D\u7532\u4e59\u4e19\u4e01][.\s\u3001:：]/.test(value) || /^[\u2460-\u2463]\s*/.test(value);
}

function stripVotePrefix(value: string) {
  return value
    .replace(/^[A-D\u7532\u4e59\u4e19\u4e01][.\s\u3001:：]*/, '')
    .replace(/^[\u2460-\u2463]\s*/, '')
    .trim();
}

export function parseForumPollOptionsFromContent(content: string): ForumPollOptionState[] {
  return content
    .split(/\n+/)
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .filter((line) => isVoteOptionLine(line))
    .map((line, index) => {
      const text = stripVotePrefix(line);
      return {
        id: `poll-option-${index}-${hashText(text)}`,
        text,
        voterIds: [],
      };
    })
    .filter((option) => option.text.length > 0)
    .slice(0, 6);
}

export function ensureForumPollState(post: ForumPost): ForumPost {
  if (post.threadType !== 'vote') return post;
  if (post.poll?.options?.length) return post;

  const options = parseForumPollOptionsFromContent(post.content);
  if (!options.length) return post;

  const seededVoterIds = collectSeedVoterIds(post);
  const seededOptions = options.map((option) => ({
    ...option,
    voterIds: [] as string[],
  }));

  seededVoterIds.forEach((voterId, index) => {
    const targetIndex = hashText(`${post.id}:${voterId}:${index}`) % seededOptions.length;
    seededOptions[targetIndex].voterIds.push(voterId);
  });

  return {
    ...post,
    poll: {
      options: seededOptions,
    },
  };
}

export function castForumPollVote(post: ForumPost, userId: string, optionId: string): ForumPost {
  const nextPost = ensureForumPollState(post);
  const options = nextPost.poll?.options || [];
  if (!options.length) return nextPost;

  const hasOption = options.some((option) => option.id === optionId);
  if (!hasOption) return nextPost;

  return {
    ...nextPost,
    poll: {
      options: options.map((option) => ({
        ...option,
        voterIds: option.id === optionId
          ? Array.from(new Set([...option.voterIds.filter((id) => id !== userId), userId]))
          : option.voterIds.filter((id) => id !== userId),
      })),
    },
  };
}

export function getForumPollUserVote(post: ForumPost, userId: string) {
  return post.poll?.options.find((option) => option.voterIds.includes(userId))?.id || null;
}
