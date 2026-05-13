import type { ForumChannel } from '../../features/forum-domain/types';
import type { ApiConfig, Character, ForumComment, ForumGlobalSettings, ForumPost, Mask, WorldBookEntry } from '../../types';
import { generateForumReplies } from './generateForumReplies';
import { pickRecurringForumAuthorsForChannel, selectForumReplyAuthorPool } from './forumReplyAuthorPool';

type ReplyMode = 'mixed' | 'independent_only' | 'threaded_only';

type CharacterReplyDraft = {
  authorId: string;
  content: string;
};

type OrchestrateForumRepliesInput = {
  activeConfig: ApiConfig;
  post: ForumPost;
  currentUserId: string;
  desiredReplyCount?: number;
  minimumReplyCount?: number;
  replyMode?: ReplyMode;
  userNewComment?: ForumComment;
  allCharacters: Character[];
  existingPosts: ForumPost[];
  globalSettings?: ForumGlobalSettings;
  masks?: Mask[];
  worldBooks?: WorldBookEntry[];
  inferChannel: (category: string) => ForumChannel;
  getAuthor: (authorId: string) => {
    id: string;
    name: string;
    bio?: string;
    description?: string;
    persona?: string;
    speakingStyle?: string;
    preferredMove?: string;
    handle?: string;
  };
  getCharacterById: (authorId: string) => unknown;
  appendReplies: (replies: Array<{
    authorId: string;
    content: string;
    replyToId?: string;
    rootCommentId?: string;
  }>) => Promise<void> | void;
  allowCharacterReply?: boolean;
  resolveCharacterReply?: (context: {
    post: ForumPost;
    channel: ForumChannel;
    triggerComment: ForumComment;
    allCharacters: Character[];
    existingPosts: ForumPost[];
  }) => Promise<CharacterReplyDraft | null>;
};

type OrchestrateForumRepliesResult = {
  addedCount: number;
  didAppendReplies: boolean;
};

function buildWavePlan(desiredReplyCount: number, minimumReplyCount: number, hasUserNewComment: boolean) {
  if (hasUserNewComment || minimumReplyCount <= 0) {
    return [desiredReplyCount];
  }

  const target = Math.max(minimumReplyCount, desiredReplyCount);
  const firstWave = Math.max(8, Math.min(12, Math.ceil(target * 0.4)));
  const secondWave = Math.max(6, Math.min(10, Math.ceil((target - firstWave) * 0.6)));
  const thirdWave = Math.max(4, target - firstWave - secondWave);

  return [firstWave, secondWave, thirdWave].filter((count) => count > 0);
}

export async function orchestrateForumReplies(input: OrchestrateForumRepliesInput): Promise<OrchestrateForumRepliesResult> {
  const {
    activeConfig,
    post,
    currentUserId,
    desiredReplyCount = 3,
    minimumReplyCount = 0,
    replyMode = 'mixed',
    userNewComment,
    allCharacters,
    existingPosts,
    globalSettings,
    masks,
    worldBooks,
    inferChannel,
    getAuthor,
    getCharacterById,
    appendReplies,
    allowCharacterReply = true,
    resolveCharacterReply,
  } = input;

  const channel = inferChannel(post.category);
  const wavePlan = buildWavePlan(desiredReplyCount, minimumReplyCount, !!userNewComment);
  let workingPost = post;
  let totalAddedCount = 0;

  for (const requestedCount of wavePlan) {
    const recurringAuthors = pickRecurringForumAuthorsForChannel({
      posts: existingPosts,
      channel,
      currentUserId,
      inferChannel,
      getAuthor,
    });

    const { knownAuthors, participants } = selectForumReplyAuthorPool({
      post: workingPost,
      desiredReplyCount: requestedCount,
      currentUserId,
      inferChannel,
      getAuthor,
      getCharacterById,
      recurringAuthors,
      prioritizedAuthorIds: userNewComment?.replyToId
        ? [workingPost.comments.find((comment) => comment.id === userNewComment.replyToId)?.authorId || '']
        : [],
    });

    if (!knownAuthors.length || !participants.length) {
      continue;
    }

    const generatedReplies = await generateForumReplies({
      activeConfig,
      post: workingPost,
      channel,
      knownAuthors,
      participants,
      globalSettings,
      masks,
      worldBooks,
      replyCount: requestedCount,
      replyMode,
      userNewComment: totalAddedCount === 0 ? userNewComment : undefined,
    });

    if (!generatedReplies.length) {
      continue;
    }

    await appendReplies(generatedReplies);
    totalAddedCount += generatedReplies.length;

    workingPost = {
      ...workingPost,
      comments: [
        ...workingPost.comments,
        ...generatedReplies.map((reply, index) => ({
          id: `forum-orchestrated-${workingPost.id}-${Date.now()}-${totalAddedCount}-${index}`,
          postId: workingPost.id,
          authorId: reply.authorId,
          content: reply.content,
          timestamp: Date.now() + index,
          likes: [],
          replyToId: reply.replyToId,
          rootCommentId: reply.rootCommentId,
        })),
      ],
    };

    if (!userNewComment && minimumReplyCount > 0 && totalAddedCount >= minimumReplyCount) {
      break;
    }
  }

  const characterTriggerComment = userNewComment
    || (desiredReplyCount >= 12 ? workingPost.comments[workingPost.comments.length - 1] : undefined);

  if (allowCharacterReply && resolveCharacterReply && characterTriggerComment) {
    const characterReply = await resolveCharacterReply({
      post: workingPost,
      channel,
      triggerComment: characterTriggerComment,
      allCharacters,
      existingPosts,
    });

    if (characterReply) {
      await appendReplies([{
        authorId: characterReply.authorId,
        content: characterReply.content,
        replyToId: characterTriggerComment.id,
        rootCommentId: characterTriggerComment.rootCommentId || characterTriggerComment.id,
      }]);
      totalAddedCount += 1;
    }
  }

  return {
    addedCount: totalAddedCount,
    didAppendReplies: totalAddedCount > 0,
  };
}
