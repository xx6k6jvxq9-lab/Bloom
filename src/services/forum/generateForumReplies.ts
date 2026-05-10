import type { ApiConfig, ForumComment, ForumGlobalSettings, ForumPost, Mask, WorldBookEntry } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS } from '../../features/forum-domain/constants';
import {
  buildForumReplyPrompt,
  type ForumReplyParticipantHint,
} from '../ai/prompts/builders/buildForumReplyPrompt';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';

type ForumReplyKnownAuthor = {
  id: string;
  displayName: string;
};

type GenerateForumRepliesInput = {
  activeConfig: ApiConfig;
  post: ForumPost;
  channel: ForumChannel;
  knownAuthors: ForumReplyKnownAuthor[];
  participants: ForumReplyParticipantHint[];
  globalSettings?: ForumGlobalSettings;
  masks?: Mask[];
  worldBooks?: WorldBookEntry[];
  replyCount?: number;
  replyMode?: 'mixed' | 'independent_only' | 'threaded_only';
  userNewComment?: ForumComment;
};

export type GeneratedForumReplyDraft = {
  authorId: string;
  content: string;
  replyToId?: string;
  rootCommentId?: string;
};

function normalizeName(value: string) {
  return value.replace(/^@/, '').replace(/\s+/g, '').trim().toLowerCase();
}

function buildCommentFloorMap(comments: ForumComment[]) {
  const sorted = [...comments].sort((a, b) => a.timestamp - b.timestamp);
  const floorMap = new Map<string, number>();
  sorted.forEach((comment, index) => {
    floorMap.set(comment.id, index + 1);
  });
  return { sorted, floorMap };
}

function buildFloorContext(post: ForumPost, knownAuthors: ForumReplyKnownAuthor[]) {
  const authorMap = new Map(knownAuthors.map((author) => [author.id, author.displayName]));
  const { sorted, floorMap } = buildCommentFloorMap(post.comments);

  return sorted.slice(-10).map((comment) => {
    const floor = floorMap.get(comment.id) || 0;
    const authorName = authorMap.get(comment.authorId) || '路过网友';
    const snippet = comment.content.replace(/\s+/g, ' ').trim().slice(0, 80);
    return `${floor}L ${authorName}：${snippet}`;
  });
}

function getCommentFloor(post: ForumPost, commentId: string) {
  const { floorMap } = buildCommentFloorMap(post.comments);
  return floorMap.get(commentId);
}

function parseReplyTargetTag(value: string) {
  const match = value.match(/^回复\s*(\d+)L\b/i);
  if (!match?.[1]) return null;
  return Number(match[1]);
}

function splitReplyLine(line: string) {
  const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const [kind, displayName, ...contentParts] = parts;
  const content = contentParts.join(' | ').trim();
  if (!kind || !displayName || !content) return null;

  return { kind, displayName, content };
}

function resolveAuthorId(displayName: string, knownAuthors: ForumReplyKnownAuthor[], fallbackIndex: number) {
  const normalizedDisplayName = normalizeName(displayName);
  const exactMatch = knownAuthors.find((author) => normalizeName(author.displayName) === normalizedDisplayName);
  if (exactMatch) return exactMatch.id;

  const fallback = knownAuthors[fallbackIndex % knownAuthors.length];
  return fallback?.id || knownAuthors[0]?.id || 'forum_npc_momo';
}

function trimResponseLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildThreadStanceHints(post: ForumPost, replyCount: number, hasUserNewComment: boolean) {
  const hints: string[] = [
    '这一轮回复不要都像同一个人发的，尽量拆成不同站位。',
  ];

  if (replyCount >= 2) {
    hints.push('至少带出两种不同气氛，比如一个人在护短，另一个人在看戏或怀疑。');
  }

  if (replyCount >= 3) {
    hints.push('如果本轮有三条及以上回复，尽量凑出“护/嘲/看戏”或“共情/质疑/补刀”的层次。');
  }

  if (post.threadType === 'commission') {
    hints.push('委托帖里不要全是起哄，至少要有一条认真给建议，另一条可以吐槽或怀疑。');
  }

  if (post.threadType === 'reversal') {
    hints.push('反转帖里优先出现“打脸感”和“前后态度变化”，允许有人补刀，有人重新站队。');
  }

  if (post.threadType === 'ownerUpdate') {
    hints.push('楼主补充帖里要有“我就说吧”的围观感，也要有人继续追问细节。');
  }

  if (post.threadType === 'sameTopic') {
    hints.push('同题帖里允许有人来认领同款经历，有人顺势接梗。');
  }

  if (post.threadType === 'rift') {
    hints.push('裂隙帖里要保留频道混杂感，可以出现“不同世界观对不上”的回帖气质。');
  }

  if (hasUserNewComment) {
    hints.push('如果用户刚下场，至少有一条站在用户这边接话，另一条可以保留怀疑或围观。');
  }

  return hints;
}

export async function generateForumReplies(input: GenerateForumRepliesInput): Promise<GeneratedForumReplyDraft[]> {
  const {
    activeConfig,
    post,
    channel,
    knownAuthors,
    participants,
    replyCount = 3,
    replyMode = 'mixed',
    userNewComment,
  } = input;

  if (!knownAuthors.length || !participants.length) {
    return [];
  }

  const prompt = buildForumReplyPrompt({
    channel,
    threadTitle: post.title,
    threadBody: post.content,
    floorContext: buildFloorContext(post, knownAuthors),
    replyCount,
    participants,
    userNewComment: userNewComment?.content,
    userNewCommentAuthorName: userNewComment
      ? (knownAuthors.find((author) => author.id === userNewComment.authorId)?.displayName || '用户')
      : undefined,
    userNewCommentFloor: userNewComment ? getCommentFloor(post, userNewComment.id) : undefined,
    replyMode,
    styleHints: [
      `频道语境保持在${FORUM_CHANNEL_LABELS[channel]}`,
      '优先让评论区像已经聊开了，而不是新起一轮标准问答。',
      userNewComment ? '先接住用户刚发那句话真正想表达的情绪和判断，再决定怎么回。' : '',
      ...buildThreadStanceHints(post, replyCount, !!userNewComment),
    ].filter(Boolean),
  });

  const raw = await generateTextFromMessagesWithConfig({
    activeConfig,
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\n请直接输出论坛回帖内容。`,
      },
    ],
    temperature: 0.95,
  });

  const lines = trimResponseLines(raw || '');
  if (!lines.length) return [];

  const { sorted, floorMap } = buildCommentFloorMap(post.comments);
  const floorToCommentId = new Map<number, string>();
  sorted.forEach((comment) => {
    const floor = floorMap.get(comment.id);
    if (floor) floorToCommentId.set(floor, comment.id);
  });

  const drafts: GeneratedForumReplyDraft[] = [];

  lines.forEach((line, index) => {
    const parsed = splitReplyLine(line);
    if (!parsed) return;

    const authorId = resolveAuthorId(parsed.displayName, knownAuthors, index);
    const replyFloor = parseReplyTargetTag(parsed.kind);
    const parsedReplyToId = replyFloor ? floorToCommentId.get(replyFloor) : undefined;
    const replyToId = index === 0 && userNewComment
      ? userNewComment.id
      : parsedReplyToId;
    const targetComment = replyToId ? post.comments.find((comment) => comment.id === replyToId) : null;

    drafts.push({
      authorId,
      content: parsed.content,
      replyToId,
      rootCommentId: targetComment
        ? (targetComment.rootCommentId || targetComment.id)
        : undefined,
    });
  });

  if (userNewComment) {
    const prioritized = drafts.filter((draft) => draft.replyToId === userNewComment.id);
    const remainder = drafts.filter((draft) => draft.replyToId !== userNewComment.id);
    if (prioritized.length > 0) {
      return [...prioritized, ...remainder];
    }
  }

  return drafts;
}
