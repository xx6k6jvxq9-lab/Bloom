import type {
  ChatMessage,
  CouplePost,
  CouplePostComment,
  CoupleSpaceData,
  CoupleSpaceInitiativeSource,
  LoveLetter,
  LoveLetterComment,
  MessageBoardEntry,
} from '../../../../types';

type MinimalCoupleSpaceSignalState = Pick<
  CoupleSpaceData,
  'partnerId' | 'coNotes' | 'ledger' | 'loveLetters' | 'posts' | 'messageBoard'
>;

export type RecentInteractionSummary = {
  summary: string;
  lastTimestamp: number;
  signalCount: number;
};

export type MemoLightEvidenceSummary = {
  summary: string;
  source: 'co_note' | 'chat_hint';
  lastTimestamp?: number;
};

export type RecordingExplicitEvidenceSummary = {
  summary: string;
  source: 'ledger_like_chat' | 'structured_amount';
  lastTimestamp?: number;
};

export type LoveLetterReplyOpportunitySummary = {
  summary: string;
  letterId: string;
  lastTimestamp: number;
};

export type DailyCommentReplyOpportunitySummary = {
  summary: string;
  postId: string;
  commentId: string;
  lastTimestamp: number;
};

export type MessageBoardReplyOpportunitySummary = {
  summary: string;
  entryId: string;
  lastTimestamp: number;
};

export type PostReactionOpportunitySummary = {
  summary: string;
  postId: string;
  lastTimestamp: number;
};

export type CoupleSpaceInitiativeNormalizedContext = {
  triggerSource?: CoupleSpaceInitiativeSource;
  recentInteraction?: RecentInteractionSummary;
  memoLightEvidence?: MemoLightEvidenceSummary;
  recordingExplicitEvidence?: RecordingExplicitEvidenceSummary;
  replyOpportunities: {
    loveLetter?: LoveLetterReplyOpportunitySummary;
    dailyComment?: DailyCommentReplyOpportunitySummary;
    messageBoard?: MessageBoardReplyOpportunitySummary;
  };
  postReactionOpportunity?: PostReactionOpportunitySummary;
};

export type CoupleSpaceInitiativeSignalCollectorInput = {
  coupleSpace?: Partial<MinimalCoupleSpaceSignalState> | null;
  chatMessages?: ChatMessage[] | null;
  triggerSource?: CoupleSpaceInitiativeSource;
  userId?: string;
  partnerId?: string | null;
  now?: number;
};

export type CoupleSpaceInitiativeSignalCollectorResult = {
  collectedAt: number;
  normalizedContext: CoupleSpaceInitiativeNormalizedContext;
};

function truncate(text: string, maxLength = 80): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function collectRecentInteraction(
  chatMessages: ChatMessage[] = [],
): RecentInteractionSummary | undefined {
  const recentMessages = chatMessages
    .filter((message) => !message.isSystem && typeof message.text === 'string' && message.text.trim())
    .slice(-3);

  if (recentMessages.length === 0) {
    return undefined;
  }

  const lastMessage = recentMessages[recentMessages.length - 1];
  const snippet = recentMessages.map((message) => truncate(message.text.trim(), 36)).join(' / ');

  return {
    summary: `Recent chat signals: ${snippet}`,
    lastTimestamp: lastMessage.timestamp,
    signalCount: recentMessages.length,
  };
}

function collectMemoLightEvidence(
  coupleSpace: Partial<MinimalCoupleSpaceSignalState> | null | undefined,
  chatMessages: ChatMessage[] = [],
  userId: string,
): MemoLightEvidenceSummary | undefined {
  const latestUserCoNote = [...(coupleSpace?.coNotes || [])]
    .filter((note) => note.authorId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (latestUserCoNote) {
    return {
      summary: `Recent co-note signal: ${truncate(latestUserCoNote.content, 60)}`,
      source: 'co_note',
      lastTimestamp: latestUserCoNote.timestamp,
    };
  }

  const latestChatHint = [...chatMessages]
    .reverse()
    .find((message) => /一起|记得|下次|想|约|计划/.test(message.text || ''));

  if (latestChatHint) {
    return {
      summary: `Recent memo-like chat hint: ${truncate(latestChatHint.text, 60)}`,
      source: 'chat_hint',
      lastTimestamp: latestChatHint.timestamp,
    };
  }

  return undefined;
}

function collectRecordingExplicitEvidence(
  chatMessages: ChatMessage[] = [],
): RecordingExplicitEvidenceSummary | undefined {
  const latestLedgerLikeChat = [...chatMessages]
    .reverse()
    .find((message) => /¥|￥|\d+(\.\d{1,2})?|转账|账单|报销|花了|付款|AA/.test(message.text || ''));

  if (!latestLedgerLikeChat) {
    return undefined;
  }

  const source = /¥|￥|\d+(\.\d{1,2})?/.test(latestLedgerLikeChat.text || '')
    ? 'structured_amount'
    : 'ledger_like_chat';

  return {
    summary: `Recent recording-grade signal: ${truncate(latestLedgerLikeChat.text, 60)}`,
    source,
    lastTimestamp: latestLedgerLikeChat.timestamp,
  };
}

function hasPartnerLoveLetterReply(letter: LoveLetter, partnerId: string): boolean {
  return (letter.comments || []).some((comment: LoveLetterComment) => comment.authorId === partnerId);
}

function collectLoveLetterReplyOpportunity(
  coupleSpace: Partial<MinimalCoupleSpaceSignalState> | null | undefined,
  userId: string,
  partnerId: string,
): LoveLetterReplyOpportunitySummary | undefined {
  const latestPendingLetter = [...(coupleSpace?.loveLetters || [])]
    .filter((letter) => letter.authorId === userId && !hasPartnerLoveLetterReply(letter, partnerId))
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (!latestPendingLetter) {
    return undefined;
  }

  return {
    summary: `User love letter is awaiting a partner-side response: ${truncate(latestPendingLetter.content, 60)}`,
    letterId: latestPendingLetter.id,
    lastTimestamp: latestPendingLetter.timestamp,
  };
}

function collectDailyCommentReplyOpportunity(
  coupleSpace: Partial<MinimalCoupleSpaceSignalState> | null | undefined,
  userId: string,
  partnerId: string,
): DailyCommentReplyOpportunitySummary | undefined {
  const candidate = [...(coupleSpace?.posts || [])]
    .filter((post: CouplePost) => post.authorId === partnerId)
    .flatMap((post) =>
      (post.comments || [])
        .filter((comment: CouplePostComment) => comment.authorId === userId)
        .map((comment) => ({ post, comment })),
    )
    .sort((a, b) => b.comment.timestamp - a.comment.timestamp)[0];

  if (!candidate) {
    return undefined;
  }

  return {
    summary: `User recently commented on a partner-authored daily post: ${truncate(candidate.comment.content, 60)}`,
    postId: candidate.post.id,
    commentId: candidate.comment.id,
    lastTimestamp: candidate.comment.timestamp,
  };
}

function collectMessageBoardReplyOpportunity(
  coupleSpace: Partial<MinimalCoupleSpaceSignalState> | null | undefined,
  userId: string,
): MessageBoardReplyOpportunitySummary | undefined {
  const latestUserEntry = [...(coupleSpace?.messageBoard || [])]
    .filter((entry: MessageBoardEntry) => entry.authorId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (!latestUserEntry) {
    return undefined;
  }

  return {
    summary: `User recently left a message board entry: ${truncate(latestUserEntry.content, 60)}`,
    entryId: latestUserEntry.id,
    lastTimestamp: latestUserEntry.timestamp,
  };
}

function collectPostReactionOpportunity(
  coupleSpace: Partial<MinimalCoupleSpaceSignalState> | null | undefined,
  userId: string,
): PostReactionOpportunitySummary | undefined {
  const latestUserPost = [...(coupleSpace?.posts || [])]
    .filter((post: CouplePost) => post.authorId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (!latestUserPost) {
    return undefined;
  }

  return {
    summary: `User recently posted a couple-space daily entry: ${truncate(latestUserPost.content, 60)}`,
    postId: latestUserPost.id,
    lastTimestamp: latestUserPost.timestamp,
  };
}

export function collectCoupleSpaceInitiativeSignals(
  input: CoupleSpaceInitiativeSignalCollectorInput,
): CoupleSpaceInitiativeSignalCollectorResult {
  const userId = input.userId ?? 'user';
  const partnerId = input.partnerId ?? input.coupleSpace?.partnerId ?? null;
  const collectedAt = input.now ?? Date.now();
  const chatMessages = input.chatMessages || [];

  const normalizedContext: CoupleSpaceInitiativeNormalizedContext = {
    triggerSource: input.triggerSource,
    recentInteraction: collectRecentInteraction(chatMessages),
    memoLightEvidence: collectMemoLightEvidence(input.coupleSpace, chatMessages, userId),
    recordingExplicitEvidence: collectRecordingExplicitEvidence(chatMessages),
    replyOpportunities: {
      loveLetter: partnerId
        ? collectLoveLetterReplyOpportunity(input.coupleSpace, userId, partnerId)
        : undefined,
      dailyComment: partnerId
        ? collectDailyCommentReplyOpportunity(input.coupleSpace, userId, partnerId)
        : undefined,
      messageBoard: collectMessageBoardReplyOpportunity(input.coupleSpace, userId),
    },
    postReactionOpportunity: collectPostReactionOpportunity(input.coupleSpace, userId),
  };

  return {
    collectedAt,
    normalizedContext,
  };
}
