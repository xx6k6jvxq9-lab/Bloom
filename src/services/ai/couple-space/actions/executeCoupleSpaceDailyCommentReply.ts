import type { CoupleSpaceData } from '../../../../types';
import { applyCoupleSpaceDirectWriteArtifact } from '../execution/coupleSpaceInitiativeDirectWriteSink';
import {
  createDirectWriteExecutionBoundary,
  type CoupleSpaceInitiativeExecutionBoundary,
} from '../execution/coupleSpaceInitiativeExecutionBoundary';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import { createCoupleSpacePromptGenerationReplyExecutor } from '../prompt/coupleSpacePromptGenerationReplyExecutor';

export type ExecuteCoupleSpaceDailyCommentReplyInput = {
  request: CoupleSpaceInitiativeExecutionRequest | null;
  context?: CoupleSpaceInitiativeExecutionContext;
  coupleSpace: CoupleSpaceData;
  authorId: string;
  now?: number;
};

export type ExecuteCoupleSpaceDailyCommentReplyResult = {
  executorStatus: 'accepted' | 'rejected' | 'unsupported' | 'not_implemented';
  sinkStatus?: 'applied' | 'rejected' | 'unsupported';
  reason: string;
  nextCoupleSpace: CoupleSpaceData;
  artifactContent?: string;
  executionBoundary: CoupleSpaceInitiativeExecutionBoundary;
};

/**
 * Thin integration helper for the daily-comment reply path.
 *
 * Scope:
 * - execute only `reply_daily_comment`
 * - generate an artifact through the concrete reply executor
 * - apply the artifact through the direct-write sink to append a post comment
 */
export async function executeCoupleSpaceDailyCommentReply(
  input: ExecuteCoupleSpaceDailyCommentReplyInput,
): Promise<ExecuteCoupleSpaceDailyCommentReplyResult> {
  const executionBoundary = createDirectWriteExecutionBoundary('couple-space-direct-write-sink');
  const executor = createCoupleSpacePromptGenerationReplyExecutor();
  const executorResult = await executor.execute(input.request, input.context);

  if (executorResult.status !== 'accepted' || !executorResult.artifact) {
    return {
      executorStatus: executorResult.status,
      reason: executorResult.reason,
      nextCoupleSpace: input.coupleSpace,
      executionBoundary,
    };
  }

  const sinkResult = applyCoupleSpaceDirectWriteArtifact({
    artifact: executorResult.artifact,
    coupleSpace: input.coupleSpace,
    authorId: input.authorId,
    targetRefs: input.context?.targetRefs,
    now: input.now,
  });

  return {
    executorStatus: executorResult.status,
    sinkStatus: sinkResult.status,
    reason:
      sinkResult.status === 'applied'
        ? 'Generated and applied one reply to a couple post comment.'
        : sinkResult.reason,
    nextCoupleSpace: sinkResult.nextCoupleSpace,
    artifactContent:
      executorResult.artifact.kind === 'generated_text'
        ? executorResult.artifact.content
        : undefined,
    executionBoundary,
  };
}
