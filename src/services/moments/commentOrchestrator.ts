import type { ApiConfig, Character, ChatGroup, MomentComment, MomentItem } from '../../types';
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
  chatGroups?: ChatGroup[];
  userName: string;
  appendComment: AppendComment;
};

type CommentReplySequenceOptions = {
  activeConfig: ApiConfig;
  moment: MomentItem;
  characters: Character[];
  chatGroups?: ChatGroup[];
  userName: string;
  triggerComment: MomentComment;
  appendComment: AppendComment;
};

export type MomentAuthorReplyPolicy = 'author' | 'normal' | 'skip';

const LOW_SIGNAL_MOMENT_COMMENT_REGEX = /^(?:[1-9]+|哈+|呵+|嘿+|hhh+|hh+|测试|试试|在吗|嗯+|哦+|诶+|欸+|ok+|kk+|lol+|hi+|hello+|收到|\?+|？+|!+|！+|~+|～+|\.{2,})$/i;
const PURE_EMOJI_OR_PUNCTUATION_REGEX = /^[\p{Extended_Pictographic}\s!！?？~～,，.。]+$/u;

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

function isLowSignalMomentComment(text: string) {
  const normalized = text.trim();
  if (!normalized) return true;
  if (normalized.length <= 2) return true;
  if (LOW_SIGNAL_MOMENT_COMMENT_REGEX.test(normalized)) return true;
  if (PURE_EMOJI_OR_PUNCTUATION_REGEX.test(normalized) && normalized.length <= 8) return true;
  return false;
}

function getMomentCommentThreadRootId(moment: MomentItem, targetComment: MomentComment) {
  const commentsById = new Map((moment.comments || []).map((comment) => [comment.id, comment]));
  let current = targetComment;
  const visited = new Set<string>();

  while (current.replyToCommentId && !visited.has(current.replyToCommentId)) {
    visited.add(current.replyToCommentId);
    const parent = commentsById.get(current.replyToCommentId);
    if (!parent) {
      break;
    }
    current = parent;
  }

  return current.id;
}

function hasMomentAuthorAlreadyRepliedInThread(moment: MomentItem, triggerComment: MomentComment) {
  if (moment.authorId === 'user') {
    return false;
  }

  const rootId = getMomentCommentThreadRootId(moment, triggerComment);
  return (moment.comments || []).some((comment) => (
    comment.id !== triggerComment.id
    && comment.authorId === moment.authorId
    && getMomentCommentThreadRootId(moment, comment) === rootId
  ));
}

export function resolveMomentAuthorReplyPolicy(options: {
  moment: MomentItem;
  characters: Character[];
  triggerComment: MomentComment;
  chatGroups?: ChatGroup[];
}): MomentAuthorReplyPolicy {
  const { moment, characters, triggerComment, chatGroups } = options;

  if (triggerComment.authorId !== 'user' || moment.authorId === 'user') {
    return 'normal';
  }

  const momentAuthor = characters.find((character) => character.id === moment.authorId) || null;
  if (!momentAuthor) {
    return 'normal';
  }

  const loopContext = buildCommentLoopContext(moment, characters, chatGroups);
  if (loopContext.timeMode === 'days_later' || loopContext.timeMode === 'stale') {
    return 'skip';
  }

  if (isLowSignalMomentComment(triggerComment.content)) {
    return 'skip';
  }

  if (hasMomentAuthorAlreadyRepliedInThread(moment, triggerComment)) {
    return 'normal';
  }

  return 'author';
}

export function pickPrimaryMomentReplyResponder(options: {
  moment: MomentItem;
  characters: Character[];
  triggerComment: MomentComment;
  chatGroups?: ChatGroup[];
}) {
  const { moment, characters, triggerComment, chatGroups } = options;
  const authorReplyPolicy = resolveMomentAuthorReplyPolicy({
    moment,
    characters,
    triggerComment,
    chatGroups,
  });

  if (authorReplyPolicy === 'author') {
    const momentAuthor = characters.find((character) => character.id === moment.authorId) || null;
    if (momentAuthor) {
      return momentAuthor;
    }
  }

  if (authorReplyPolicy === 'skip') {
    return null;
  }

  return pickNextResponder({
    moment,
    characters,
    triggerComment,
    recentChain: [triggerComment],
    usedAuthorIds: [triggerComment.authorId],
    chatGroups,
  });
}

async function generateReplyText(params: {
  activeConfig: ApiConfig;
  replyCharacter: Character;
  moment: MomentItem;
  targetComment: MomentComment;
  characters: Character[];
  chatGroups?: ChatGroup[];
  userName: string;
  recentChain?: MomentComment[];
}) {
  const { activeConfig, replyCharacter, moment, targetComment, characters, chatGroups, userName, recentChain = [] } = params;
  try {
    return (await generateMomentThreadReply({
      activeConfig,
      replyCharacter,
      moment,
      targetComment,
      characters,
      chatGroups,
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
  chatGroups?: ChatGroup[];
  userName: string;
  appendComment: AppendComment;
  liveComments: MomentComment[];
  chain: MomentComment[];
  currentDepth: number;
}) {
  const { activeConfig, baseMoment, characters, chatGroups, userName, appendComment, liveComments, chain, currentDepth } = params;
  const triggerComment = chain[chain.length - 1];
  if (!triggerComment) {
    return;
  }

  const momentWithComments = {
    ...baseMoment,
    comments: [...baseMoment.comments, ...liveComments],
  };

  if (!shouldTriggerFollowUpReply(momentWithComments, triggerComment, currentDepth, characters, chain, chatGroups)) {
    return;
  }

  const usedAuthorIds = Array.from(new Set(chain.map((comment) => comment.authorId)));
  const responder = pickNextResponder({
    moment: momentWithComments,
    characters,
    triggerComment,
    recentChain: chain,
    usedAuthorIds,
    chatGroups,
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
    chatGroups,
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
    chatGroups,
    userName,
    appendComment,
    liveComments,
    chain,
    currentDepth: currentDepth + 1,
  });
}

export async function runMomentPublishCommentSequence(options: PublishCommentSequenceOptions) {
  const { activeConfig, moment, characters, chatGroups, userName, appendComment } = options;
  const liveComments: MomentComment[] = [];
  const loopContext = buildCommentLoopContext(moment, characters, chatGroups);
  const initialCommenters = pickInitialCommenters({
    moment,
    characters,
    chatGroups,
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
        chatGroups,
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
          chatGroups,
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
  const { activeConfig, moment, characters, chatGroups, userName, triggerComment, appendComment } = options;
  const loopContext = buildCommentLoopContext(moment, characters, chatGroups);
  if (loopContext.maxDepth <= 0) {
    return;
  }

  const liveComments: MomentComment[] = [];
  const momentWithTrigger = {
    ...moment,
    comments: [...moment.comments, triggerComment],
  };

  const primaryResponder = pickPrimaryMomentReplyResponder({
    moment: momentWithTrigger,
    characters,
    triggerComment,
    chatGroups,
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
    chatGroups,
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
    chatGroups,
    userName,
    appendComment,
    liveComments,
    chain: [triggerComment, primaryReply],
    currentDepth: 1,
  });
}
