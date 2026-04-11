import type {
  AppSettings,
  Character,
  ChatHistory,
  CoupleSpaceData,
  CoupleSpaceInitiativeCandidate,
  CoupleSpaceInitiativeRuntimeRule,
  CoupleSpaceInitiativeSource,
  Mask,
  UserProfileExtended,
  WorldBookEntry,
} from '../../../../types';
import type {
  BuildCoupleCoNotePromptOptions,
  BuildCoupleDailyCommentPromptOptions,
  BuildCoupleDailyCommentReplyPromptOptions,
  BuildCoupleDailyPostPromptOptions,
  BuildCoupleLoveLetterPromptOptions,
  BuildCoupleLoveLetterReplyPromptOptions,
  BuildCoupleMessageBoardPromptOptions,
} from '../../prompts';
import { createCoupleSpacePromptCommonInput } from '../context/createCoupleSpacePromptCommonInput';
import type { CoupleSpacePromptCommonSections } from '../context/types';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import { buildCoupleSpaceInitiativeExecutionPlan } from '../execution/coupleSpaceInitiativeExecutionPlan';
import { buildCoupleSpaceInitiativeCommitRoute } from './coupleSpaceInitiativeCommitRoute';
import { buildCoupleSpaceInitiativeExecutionBridge } from '../execution/coupleSpaceInitiativeExecutionBridge';
import { evaluateCoupleSpaceInitiativeExecutionReadiness } from '../execution/coupleSpaceInitiativeExecutionReadiness';
import { buildCoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import {
  runCoupleSpaceInitiativeDevCheck,
  type RunCoupleSpaceInitiativeDevCheckResult,
} from './runCoupleSpaceInitiativeDevCheck';
import { runCoupleSpaceInitiativeCandidate } from './runCoupleSpaceInitiativeCandidate';
import { buildCharacterContext } from '../../../relationship-context/buildCharacterContext';
import {
  buildExecutionBoundaryAwareArtifactPreview,
  buildExecutionBoundaryAwareStatusText,
} from './coupleSpaceInitiativeExecutionFeedback';

export type CoupleSpaceInitiativeCheckCommonContext = {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory?: ChatHistory | null;
  masks?: Mask[] | null;
  worldBooks?: WorldBookEntry[] | null;
  appSettings: AppSettings;
  triggerSource?: CoupleSpaceInitiativeSource;
  now?: number;
};

export type RunCoupleSpaceInitiativeManualCheckInput = CoupleSpaceInitiativeCheckCommonContext & {
  now?: number;
};

export type RunCoupleSpaceInitiativeManualCheckResult = {
  devCheck: RunCoupleSpaceInitiativeDevCheckResult;
  runResult: Awaited<ReturnType<typeof runCoupleSpaceInitiativeCandidate>> | null;
  nextCoupleSpace: CoupleSpaceData;
  statusText: string;
  artifactPreview: {
    kind: 'draft' | 'confirmation';
    title: string;
    content: string;
    note?: string;
  } | null;
};

function getReadableActionLabel(actionType: CoupleSpaceInitiativeCandidate['actionType'] | null | undefined): string {
  switch (actionType) {
    case 'post_couple_daily':
      return '情侣日常';
    case 'post_message_board_entry':
      return '留言板内容';
    case 'write_love_letter':
      return '情书草稿';
    case 'write_co_note':
      return '互记草稿';
    case 'reply_message_board':
      return '留言板回复';
    case 'react_to_existing_post':
      return '动态评论';
    case 'reply_daily_comment':
      return '评论回复';
    case 'reply_love_letter':
      return '情书回复';
    case 'create_ledger_entry':
      return '账本待确认记录';
    default:
      return '主动内容';
  }
}

function humanizeRunReason(reason: string | null | undefined): string {
  if (!reason) {
    return '当前这条主动内容还没有成功落到对应通路。';
  }

  if (reason.includes('Prompt generation returned empty content')) {
    return '这次已经进入生成阶段，但模型没有产出可用内容，所以没有继续生成结果。';
  }

  if (reason.includes('Execution request is not bridge-ready yet')) {
    return '这次已经命中候选，但执行前需要的输入还没有补齐，所以先停在这里。';
  }

  if (reason.includes('missing the write_love_letter prompt input payload')) {
    return '这次想生成情书草稿，但执行输入还不完整，所以没有继续。';
  }

  if (reason.includes('missing the write_co_note prompt input payload')) {
    return '这次想生成互记草稿，但执行输入还不完整，所以没有继续。';
  }

  if (reason.includes('missing usable couple-space settings')) {
    return '当前主动内容配置还不完整，所以这次没有继续执行。';
  }

  if (reason.includes('unsupported')) {
    return '这条主动内容暂时还没有接上对应执行通路。';
  }

  return reason;
}

export function appendFallbackStatusNote(
  baseText: string,
  attemptedCount: number,
  usedFallbackCandidate: boolean,
): string {
  if (!usedFallbackCandidate || attemptedCount <= 1) {
    return baseText;
  }

  return `${baseText} 系统已自动跳过前面的失败候选，并在第 ${attemptedCount} 个候选上继续尝试成功。`;
}

function getActionLabel(actionType: CoupleSpaceInitiativeCandidate['actionType'] | null | undefined): string {
  switch (actionType) {
    case 'post_couple_daily':
      return '情侣日常';
    case 'post_message_board_entry':
      return '留言板内容';
    case 'write_love_letter':
      return '情书草稿';
    case 'write_co_note':
      return '互记草稿';
    case 'reply_message_board':
      return '留言板回复';
    case 'react_to_existing_post':
      return '动态评论';
    case 'reply_daily_comment':
      return '评论回复';
    case 'reply_love_letter':
      return '情书回复';
    case 'create_ledger_entry':
      return '账本待确认记录';
    default:
      return '主动内容';
  }
}

export function buildNoCandidateStatusText(devCheck: RunCoupleSpaceInitiativeDevCheckResult): string {
  const rules = Object.values(devCheck.harnessResult.selection.runtimeState.rules);
  const normalized = devCheck.harnessResult.normalizedContext;
  const enabledRuleCount = rules.filter(
    (rule) => rule.enabled && rule.cadence !== 'off' && rule.opportunityLevel !== 'off',
  ).length;
  const hasReplyOpportunity =
    !!normalized.replyOpportunities.loveLetter ||
    !!normalized.replyOpportunities.dailyComment ||
    !!normalized.replyOpportunities.messageBoard ||
    !!normalized.postReactionOpportunity;

  if (enabledRuleCount === 0) {
    return '这次没有可触发的主动内容：当前主动功能都处于关闭状态。';
  }

  if (hasReplyOpportunity) {
    return '这次检测到了新的互动线索，但还没有形成可执行的主动候选。';
  }

  if (normalized.memoLightEvidence) {
    return '这次发现了互记线索，但还不足以稳定触发一条主动内容。';
  }

  if (normalized.recordingExplicitEvidence) {
    return '这次发现了记录线索，但账本类内容仍然需要更明确的确认路径。';
  }

  if (normalized.recentInteraction) {
    return '这次检查已完成，但当前没有新的可回复内容，也没有足够线索触发主动发布。';
  }

  return '这次没有可触发的主动内容：当前没有新的互动、互记或记录线索。';
}

export function buildRunStatusText(
  candidate: CoupleSpaceInitiativeCandidate,
  runResult: Awaited<ReturnType<typeof runCoupleSpaceInitiativeCandidate>>,
): string {
  return buildExecutionBoundaryAwareStatusText(candidate, runResult);
}

/* legacy manual feedback path kept for reference while consumers migrate.
if (runResult.executorStatus !== 'accepted') {
    return `这次选中了${label}，但没有继续执行：${runResult.reason}`;
  }

  if ('sinkStatus' in runResult) {
    if (runResult.sinkStatus === 'applied') {
      return `这次已成功生成并写入${label}。`;
    }

    if (runResult.sinkStatus === 'created') {
      if ('draftContent' in runResult) {
        return `这次已生成${label}，当前先作为草稿保留，还没有直接写入。`;
      }

      if ('confirmationSummary' in runResult) {
        return `这次已生成${label}，当前进入待确认状态，还没有直接写入账本。`;
      }

      return `这次已生成${label}，当前还没有直接写入。`;
    }

    if (runResult.sinkStatus === 'rejected' || runResult.sinkStatus === 'unsupported') {
      return `这次选中了${label}，但结果还没有成功落到对应通路：${runResult.reason}`;
    }
  }

  return `这次选中了${label}：${runResult.reason}`;
}

*/
export function buildArtifactPreview(
  candidate: CoupleSpaceInitiativeCandidate,
  runResult: Awaited<ReturnType<typeof runCoupleSpaceInitiativeCandidate>>,
): RunCoupleSpaceInitiativeManualCheckResult['artifactPreview'] {
  return buildExecutionBoundaryAwareArtifactPreview(candidate, runResult);
}

/* legacy manual artifact preview path kept for reference while consumers migrate.
  if ('draftContent' in runResult && runResult.draftContent) {
    return {
      kind: 'draft',
      title: `${label}已生成草稿`,
      content: runResult.draftContent,
      note: '这次先保留为草稿，还没有直接写入情侣空间。',
    };
  }

  if ('confirmationSummary' in runResult && runResult.confirmationSummary) {
    return {
      kind: 'confirmation',
      title: `${label}已生成待确认内容`,
      content: runResult.confirmationSummary,
      note: '这次进入待确认状态，还没有直接写入正式记录。',
    };
  }

  return null;
}
*/

function buildCommonPromptInput({ user, partner, coupleSpace }: CoupleSpaceInitiativeCheckCommonContext) {
  const personaSummary = buildCharacterContext({ character: partner }).corePersona;
  return {
    characterProfile: {
      characterName: partner.name,
      signature: partner.signature,
      personaSummary,
      speakingStyle: buildCharacterContext({ character: partner }).expressionStyle ?? (partner.signature || undefined),
      initiativeStyle: partner.postFrequency || undefined,
    },
    relationshipContext: {
      userName: user.name,
      relationshipStage: 'couple_space',
      relationshipSummary: `${user.name} 与 ${partner.name} 处于情侣空间关系中。`,
      sharedContextSummary:
        coupleSpace.anniversaryDate != null
          ? `相伴约 ${Math.max(
              1,
              Math.floor((Date.now() - coupleSpace.anniversaryDate) / (1000 * 60 * 60 * 24)),
            )} 天。`
          : undefined,
      intimacyBoundary: '保持亲密但自然，不越出当前关系边界。',
    },
  };
}

function buildUnifiedCommonPromptInput(
  input: CoupleSpaceInitiativeCheckCommonContext,
): CoupleSpacePromptCommonSections {
  const envelope = createCoupleSpacePromptCommonInput({
    source: {
      user: input.user,
      partner: input.partner,
      coupleSpace: input.coupleSpace,
      chatHistory: input.chatHistory,
      masks: input.masks ?? undefined,
      worldBooks: input.worldBooks ?? undefined,
      settings: {
        initiativeSettings: input.coupleSpace.initiativeSettings,
      },
      now: input.now,
    },
  });

  return envelope.common;
}

export function buildCoupleSpaceInitiativeExecutionContext(
  input: CoupleSpaceInitiativeCheckCommonContext,
  candidate: CoupleSpaceInitiativeCandidate | null,
  devCheck: RunCoupleSpaceInitiativeDevCheckResult,
): CoupleSpaceInitiativeExecutionContext {
  const common = buildUnifiedCommonPromptInput(input);
  const normalized = devCheck.harnessResult.normalizedContext;
  const targetRefs: CoupleSpaceInitiativeExecutionContext['targetRefs'] = {};
  const promptInputs: CoupleSpaceInitiativeExecutionContext['promptInputs'] = {};
  const recordInputs: CoupleSpaceInitiativeExecutionContext['recordInputs'] = {};

  const latestLoveLetter =
    normalized.replyOpportunities.loveLetter &&
    input.coupleSpace.loveLetters.find(
      (letter) => letter.id === normalized.replyOpportunities.loveLetter?.letterId,
    );
  const latestDailyComment =
    normalized.replyOpportunities.dailyComment &&
    input.coupleSpace.posts?.find((post) => post.id === normalized.replyOpportunities.dailyComment?.postId);
  const latestComment =
    latestDailyComment &&
    normalized.replyOpportunities.dailyComment &&
    latestDailyComment.comments.find(
      (comment) => comment.id === normalized.replyOpportunities.dailyComment?.commentId,
    );
  const latestMessageBoardEntry =
    normalized.replyOpportunities.messageBoard &&
    input.coupleSpace.messageBoard?.find(
      (entry) => entry.id === normalized.replyOpportunities.messageBoard?.entryId,
    );
  const latestReactionPost =
    normalized.postReactionOpportunity &&
    input.coupleSpace.posts?.find((post) => post.id === normalized.postReactionOpportunity?.postId);

  switch (candidate?.actionType) {
    case 'post_couple_daily':
      promptInputs.post_couple_daily = {
        ...common,
        dailyPostContext: {
          sharedMomentSummary: normalized.recentInteraction?.summary,
          emotionalAftertaste: candidate.reason,
          relationshipStage: 'couple_space',
        },
      } satisfies BuildCoupleDailyPostPromptOptions;
      break;

    case 'post_message_board_entry':
      promptInputs.post_message_board_entry = {
        ...common,
        mode: 'active',
        actionType: 'post_message_board_entry',
        messageBoardContext: {
          latestUserMessage: normalized.recentInteraction?.summary,
          boardToneHint: candidate.reason,
        },
      } satisfies BuildCoupleMessageBoardPromptOptions;
      break;

    case 'write_love_letter':
      promptInputs.write_love_letter = {
        ...common,
        loveLetterContext: {
          occasion: normalized.recentInteraction?.summary,
          writingIntent: candidate.reason,
          recentRelationshipShift: normalized.recentInteraction?.summary,
        },
      } satisfies BuildCoupleLoveLetterPromptOptions;
      break;

    case 'write_co_note':
      promptInputs.write_co_note = {
        ...common,
        coNoteContext: {
          userNoteContent: normalized.memoLightEvidence?.summary,
          noteThemeHint: candidate.reason,
        },
      } satisfies BuildCoupleCoNotePromptOptions;
      break;

    case 'reply_message_board':
      if (normalized.replyOpportunities.messageBoard?.entryId) {
        targetRefs.reply_message_board = {
          entryId: normalized.replyOpportunities.messageBoard.entryId,
        };
      }
      promptInputs.reply_message_board = {
        ...common,
        mode: 'passive',
        actionType: 'reply_message_board',
        messageBoardContext: {
          latestUserMessage: latestMessageBoardEntry?.content ?? normalized.replyOpportunities.messageBoard?.summary,
          boardToneHint: candidate.reason,
        },
      } satisfies BuildCoupleMessageBoardPromptOptions;
      break;

    case 'react_to_existing_post':
      if (normalized.postReactionOpportunity?.postId) {
        targetRefs.react_to_existing_post = {
          postId: normalized.postReactionOpportunity.postId,
        };
      }
      promptInputs.react_to_existing_post = {
        ...common,
        dailyCommentContext: {
          coupleDailyContent:
            latestReactionPost?.content ?? normalized.postReactionOpportunity?.summary ?? '',
          contentAuthor: 'user',
          commentIntent: candidate.reason,
        },
      } satisfies BuildCoupleDailyCommentPromptOptions;
      break;

    case 'reply_daily_comment':
      if (normalized.replyOpportunities.dailyComment?.postId && normalized.replyOpportunities.dailyComment?.commentId) {
        targetRefs.reply_daily_comment = {
          postId: normalized.replyOpportunities.dailyComment.postId,
          commentId: normalized.replyOpportunities.dailyComment.commentId,
        };
      }
      promptInputs.reply_daily_comment = {
        ...common,
        dailyCommentReplyContext: {
          coupleDailyContent: latestDailyComment?.content ?? '',
          userComment: latestComment?.content ?? normalized.replyOpportunities.dailyComment?.summary ?? '',
          contentAuthor: latestDailyComment?.authorId === input.user.id ? 'user' : 'character',
          replyIntent: candidate.reason,
        },
      } satisfies BuildCoupleDailyCommentReplyPromptOptions;
      break;

    case 'reply_love_letter':
      if (normalized.replyOpportunities.loveLetter?.letterId) {
        targetRefs.reply_love_letter = {
          letterId: normalized.replyOpportunities.loveLetter.letterId,
        };
      }
      promptInputs.reply_love_letter = {
        ...common,
        loveLetterReplyContext: {
          receivedLetterContent:
            latestLoveLetter?.content ?? normalized.replyOpportunities.loveLetter?.summary ?? '',
          replyIntent: candidate.reason,
          relationshipStage: 'couple_space',
          emotionalState: normalized.recentInteraction?.summary,
        },
      } satisfies BuildCoupleLoveLetterReplyPromptOptions;
      break;

    case 'create_ledger_entry':
      recordInputs.create_ledger_entry = {
        payerId: input.partner.id,
        explicitEvidenceSummary: normalized.recordingExplicitEvidence?.summary ?? '',
        description: candidate.reason,
        timestamp: input.now,
      };
      break;
  }

  return {
    settings: input.appSettings,
    promptInputs,
    recordInputs,
    targetRefs,
  };
}

export function resolvePreparedExecutionRequest(
  request: CoupleSpaceInitiativeExecutionRequest,
): CoupleSpaceInitiativeExecutionRequest {
  return {
    ...request,
    envelope: {
      ...request.envelope,
      readinessStatus:
        request.envelope.commitMode === 'confirm' ? 'partial' : 'ready',
    },
    unresolvedInputs: [],
    readinessSummary:
      request.envelope.commitMode === 'confirm'
        ? 'Manual check assembled the required execution context; this action can continue into a confirmation path.'
        : 'Manual check assembled the required execution context and this request is ready for the execution bridge.',
    readyForExecutionBridge: true,
  };
}

function shouldTryNextCandidate(
  runResult: Awaited<ReturnType<typeof runCoupleSpaceInitiativeCandidate>>,
): boolean {
  if (runResult.executorStatus !== 'accepted') {
    return true;
  }

  if (!('executionBoundary' in runResult) || !('sinkStatus' in runResult)) {
    return false;
  }

  switch (runResult.executionBoundary.channel) {
    case 'direct_write':
    case 'draft_buffer':
    case 'confirmation_queue':
      return runResult.sinkStatus === 'rejected' || runResult.sinkStatus === 'unsupported';
    default:
      return false;
  }
}

function buildPreparedExecutionRequestForCandidate(
  candidate: CoupleSpaceInitiativeCandidate,
): CoupleSpaceInitiativeExecutionRequest | null {
  const plan = buildCoupleSpaceInitiativeExecutionPlan(candidate);
  const route = buildCoupleSpaceInitiativeCommitRoute(plan);
  const bridge = buildCoupleSpaceInitiativeExecutionBridge(plan, route);
  const readiness = evaluateCoupleSpaceInitiativeExecutionReadiness(bridge);
  const request = buildCoupleSpaceInitiativeExecutionRequest(bridge, readiness);

  return request ? resolvePreparedExecutionRequest(request) : null;
}

export async function runPreparedCoupleSpaceInitiativeCandidates(
  input: CoupleSpaceInitiativeCheckCommonContext & {
    devCheck: RunCoupleSpaceInitiativeDevCheckResult;
    now?: number;
  },
): Promise<{
  candidate: CoupleSpaceInitiativeCandidate | null;
  runResult: Awaited<ReturnType<typeof runCoupleSpaceInitiativeCandidate>> | null;
  nextCoupleSpace: CoupleSpaceData;
  attemptedCount: number;
  usedFallbackCandidate: boolean;
}> {
  const sortedCandidates = input.devCheck.harnessResult.selection.sortedCandidates;

  if (!sortedCandidates.length) {
    return {
      candidate: null,
      runResult: null,
      nextCoupleSpace: input.coupleSpace,
      attemptedCount: 0,
      usedFallbackCandidate: false,
    };
  }

  let attemptedCount = 0;

  for (const candidate of sortedCandidates) {
    const executionContext = buildCoupleSpaceInitiativeExecutionContext(
      input,
      candidate,
      input.devCheck,
    );
    const request = buildPreparedExecutionRequestForCandidate(candidate);

    if (!request) {
      continue;
    }

    attemptedCount += 1;
    const runResult = await runCoupleSpaceInitiativeCandidate({
      request,
      context: executionContext,
      coupleSpace: input.coupleSpace,
      authorId: input.partner.id,
      now: input.now,
    });

    if (!shouldTryNextCandidate(runResult)) {
      return {
        candidate,
        runResult,
        nextCoupleSpace:
          'nextCoupleSpace' in runResult ? runResult.nextCoupleSpace : input.coupleSpace,
        attemptedCount,
        usedFallbackCandidate: attemptedCount > 1,
      };
    }
  }

  const fallbackCandidate = sortedCandidates[0] ?? null;
  const fallbackContext = fallbackCandidate
    ? buildCoupleSpaceInitiativeExecutionContext(input, fallbackCandidate, input.devCheck)
    : undefined;
  const fallbackRequest = fallbackCandidate
    ? buildPreparedExecutionRequestForCandidate(fallbackCandidate)
    : null;
  const fallbackRunResult =
    fallbackRequest && fallbackContext
      ? await runCoupleSpaceInitiativeCandidate({
          request: fallbackRequest,
          context: fallbackContext,
          coupleSpace: input.coupleSpace,
          authorId: input.partner.id,
          now: input.now,
        })
      : null;

  return {
    candidate: fallbackCandidate,
    runResult: fallbackRunResult,
    nextCoupleSpace:
      fallbackRunResult && 'nextCoupleSpace' in fallbackRunResult
        ? fallbackRunResult.nextCoupleSpace
        : input.coupleSpace,
    attemptedCount: attemptedCount + (fallbackRunResult ? 1 : 0),
    usedFallbackCandidate: !!fallbackRunResult,
  };
}

export async function runCoupleSpaceInitiativeManualCheck(
  input: RunCoupleSpaceInitiativeManualCheckInput,
): Promise<RunCoupleSpaceInitiativeManualCheckResult> {
  const devCheck = await runCoupleSpaceInitiativeDevCheck({
    appSettings: input.appSettings,
    coupleSpace: input.coupleSpace,
    chatHistory: input.chatHistory,
    userId: input.user.id,
    partnerId: input.partner.id,
    authorId: input.partner.id,
    triggerSource: input.triggerSource ?? 'manual_check',
    now: input.now,
  });

  if (!devCheck.harnessResult.selection.sortedCandidates.length) {
    return {
      devCheck,
      runResult: null,
      nextCoupleSpace: input.coupleSpace,
      statusText: buildNoCandidateStatusText(devCheck),
      artifactPreview: null,
    };
  }

  const attemptResult = await runPreparedCoupleSpaceInitiativeCandidates({
    ...input,
    devCheck,
  });
  const candidate = attemptResult.candidate;
  const runResult = attemptResult.runResult;

  if (!candidate || !runResult) {
    return {
      devCheck,
      runResult: null,
      nextCoupleSpace: input.coupleSpace,
      statusText: buildNoCandidateStatusText(devCheck),
      artifactPreview: null,
    };
  }

  return {
    devCheck,
    runResult,
    nextCoupleSpace: attemptResult.nextCoupleSpace,
    statusText: appendFallbackStatusNote(
      buildRunStatusText(candidate, runResult),
      attemptResult.attemptedCount,
      attemptResult.usedFallbackCandidate,
    ),
    artifactPreview: buildArtifactPreview(candidate, runResult),
  };
}
