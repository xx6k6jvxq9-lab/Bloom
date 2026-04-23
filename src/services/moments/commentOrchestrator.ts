import type { ApiConfig, Character, MomentComment, MomentItem } from '../../types';
import {
  buildMomentThreadReplyFallback,
  generateMomentBodyComment,
  generateMomentThreadReply,
} from './commentGeneration';
import {
  buildCommentLoopContext,
  pickInitialCommenters,
  pickNextResponder,
  shouldTriggerFollowUpReply,
} from './commentRules';

type AppendComment = (comment: MomentComment) => void;

type PublishCommentSequenceOptions = {
  activeConfig: ApiConfig;
  moment: MomentItem;
  characters: Character[];
  userName: string;
  appendComment: AppendComment;
};

type CommentReplySequenceOptions = {
  activeConfig: ApiConfig;
  moment: MomentItem;
  characters: Character[];
  userName: string;
  triggerComment: MomentComment;
  appendComment: AppendComment;
};

function createCommentId(suffix: string) {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${suffix}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createReplyComment(options: {
  authorId: string;
  content: string;
  targetComment: MomentComment;
  targetAuthorName: string;
}) {
  return {
    id: createCommentId(options.authorId),
    authorId: options.authorId,
    content: options.content.trim(),
    timestamp: Date.now(),
    replyToCommentId: options.targetComment.id,
    replyToAuthorId: options.targetComment.authorId,
    replyToAuthorName: options.targetAuthorName,
  } satisfies MomentComment;
}

function getCommentAuthorName(authorId: string, characters: Character[], userName: string) {
  if (authorId === 'user') return userName;
  return characters.find((character) => character.id === authorId)?.name || '未知角色';
}

async function generateReplyText(params: {
  activeConfig: ApiConfig;
  replyCharacter: Character;
  moment: MomentItem;
  targetComment: MomentComment;
  characters: Character[];
  userName: string;
  recentChain?: MomentComment[];
}) {
  const { activeConfig, replyCharacter, moment, targetComment, characters, userName, recentChain = [] } = params;
  try {
    return (await generateMomentThreadReply({
      activeConfig,
      replyCharacter,
      moment,
      targetComment,
      characters,
      userName,
      recentChain,
    })).trim();
  } catch (error) {
    console.error('Moment thread reply generation failed', error);
    return buildMomentThreadReplyFallback({
      replyCharacter,
      moment,
      targetComment,
      characters,
      userName,
    });
  }
}

async function maybeContinueThread(params: {
  activeConfig: ApiConfig;
  baseMoment: MomentItem;
  characters: Character[];
  userName: string;
  appendComment: AppendComment;
  liveComments: MomentComment[];
  chain: MomentComment[];
  currentDepth: number;
}) {
  const { activeConfig, baseMoment, characters, userName, appendComment, liveComments, chain, currentDepth } = params;
  const triggerComment = chain[chain.length - 1];
  if (!triggerComment) {
    return;
  }

  const momentWithComments = {
    ...baseMoment,
    comments: [...baseMoment.comments, ...liveComments],
  };

  if (!shouldTriggerFollowUpReply(momentWithComments, triggerComment, currentDepth, characters, chain)) {
    return;
  }

  const usedAuthorIds = Array.from(new Set(chain.map((comment) => comment.authorId)));
  const responder = pickNextResponder({
    moment: momentWithComments,
    characters,
    triggerComment,
    recentChain: chain,
    usedAuthorIds,
  });

  if (!responder) {
    return;
  }

  const replyText = await generateReplyText({
    activeConfig,
    replyCharacter: responder,
    moment: momentWithComments,
    targetComment: triggerComment,
    characters,
    userName,
    recentChain: chain,
  });

  if (!replyText) {
    return;
  }

  const replyComment = createReplyComment({
    authorId: responder.id,
    content: replyText,
    targetComment: triggerComment,
    targetAuthorName: getCommentAuthorName(triggerComment.authorId, characters, userName),
  });

  liveComments.push(replyComment);
  appendComment(replyComment);
  chain.push(replyComment);

  await sleep(180 + Math.floor(Math.random() * 260));
  await maybeContinueThread({
    activeConfig,
    baseMoment,
    characters,
    userName,
    appendComment,
    liveComments,
    chain,
    currentDepth: currentDepth + 1,
  });
}

export async function runMomentPublishCommentSequence(options: PublishCommentSequenceOptions) {
  const { activeConfig, moment, characters, userName, appendComment } = options;
  const liveComments: MomentComment[] = [];
  const loopContext = buildCommentLoopContext(moment, characters);
  const initialCommenters = pickInitialCommenters({
    moment,
    characters,
  });

  for (const commenter of initialCommenters) {
    try {
      const generatedText = await generateMomentBodyComment({
        activeConfig,
        replyCharacter: commenter,
        moment: {
          ...moment,
          comments: [...moment.comments, ...liveComments],
        },
        characters,
        userName,
      });
      const normalizedContent = generatedText.trim();
      if (!normalizedContent) continue;

      const comment: MomentComment = {
        id: createCommentId(commenter.id),
        authorId: commenter.id,
        content: normalizedContent,
        timestamp: Date.now(),
      };

      liveComments.push(comment);
      appendComment(comment);

      if (loopContext.maxDepth > 0) {
        await sleep(220 + Math.floor(Math.random() * 320));
        await maybeContinueThread({
          activeConfig,
          baseMoment: moment,
          characters,
          userName,
          appendComment,
          liveComments,
          chain: [comment],
          currentDepth: 0,
        });
      }

      await sleep(160 + Math.floor(Math.random() * 220));
    } catch (error) {
      console.error('Moment publish comment sequence failed', error);
    }
  }
}

export async function runMomentCommentReplySequence(options: CommentReplySequenceOptions) {
  const { activeConfig, moment, characters, userName, triggerComment, appendComment } = options;
  const loopContext = buildCommentLoopContext(moment, characters);
  if (loopContext.maxDepth <= 0) {
    return;
  }

  const liveComments: MomentComment[] = [];
  const momentWithTrigger = {
    ...moment,
    comments: [...moment.comments, triggerComment],
  };

  const primaryResponder = pickNextResponder({
    moment: momentWithTrigger,
    characters,
    triggerComment,
    recentChain: [triggerComment],
    usedAuthorIds: [triggerComment.authorId],
  });

  if (!primaryResponder) {
    return;
  }

  const primaryReplyText = await generateReplyText({
    activeConfig,
    replyCharacter: primaryResponder,
    moment: momentWithTrigger,
    targetComment: triggerComment,
    characters,
    userName,
    recentChain: [triggerComment],
  });

  if (!primaryReplyText) {
    return;
  }

  const primaryReply = createReplyComment({
    authorId: primaryResponder.id,
    content: primaryReplyText,
    targetComment: triggerComment,
    targetAuthorName: getCommentAuthorName(triggerComment.authorId, characters, userName),
  });

  liveComments.push(primaryReply);
  appendComment(primaryReply);
  await sleep(180 + Math.floor(Math.random() * 260));

  await maybeContinueThread({
    activeConfig,
    baseMoment: momentWithTrigger,
    characters,
    userName,
    appendComment,
    liveComments,
    chain: [triggerComment, primaryReply],
    currentDepth: 1,
  });
}
