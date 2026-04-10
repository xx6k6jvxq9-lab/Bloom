import type { CoupleSpaceData } from '../../../../types';
import { applyCoupleSpaceDirectWriteArtifact } from '../execution/coupleSpaceInitiativeDirectWriteSink';
import {
  createDirectWriteExecutionBoundary,
  type CoupleSpaceInitiativeExecutionBoundary,
} from '../execution/coupleSpaceInitiativeExecutionBoundary';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import { createCoupleSpacePromptGenerationAutoWriteExecutor } from '../prompt/coupleSpacePromptGenerationAutoWriteExecutor';

export type ExecuteCoupleSpaceMessageBoardEntryInput = {
  request: CoupleSpaceInitiativeExecutionRequest | null;
  context?: CoupleSpaceInitiativeExecutionContext;
  coupleSpace: CoupleSpaceData;
  authorId: string;
  now?: number;
};

export type ExecuteCoupleSpaceMessageBoardEntryResult = {
  executorStatus: 'accepted' | 'rejected' | 'unsupported' | 'not_implemented';
  sinkStatus?: 'applied' | 'rejected' | 'unsupported';
  reason: string;
  nextCoupleSpace: CoupleSpaceData;
  artifactContent?: string;
  executionBoundary: CoupleSpaceInitiativeExecutionBoundary;
};

/**
 * Thin integration helper for the second low-risk proactive publishing path.
 *
 * Scope:
 * - execute only `post_message_board_entry`
 * - generate an artifact through the concrete executor
 * - apply the artifact through the direct-write sink
 */
export async function executeCoupleSpaceMessageBoardEntry(
  input: ExecuteCoupleSpaceMessageBoardEntryInput,
): Promise<ExecuteCoupleSpaceMessageBoardEntryResult> {
  const executionBoundary = createDirectWriteExecutionBoundary('couple-space-direct-write-sink');
  const executor = createCoupleSpacePromptGenerationAutoWriteExecutor();
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
    now: input.now,
  });

  return {
    executorStatus: executorResult.status,
    sinkStatus: sinkResult.status,
    reason:
      sinkResult.status === 'applied'
        ? 'Generated and applied one proactive message-board entry through the minimal execution path.'
        : sinkResult.reason,
    nextCoupleSpace: sinkResult.nextCoupleSpace,
    artifactContent:
      executorResult.artifact.kind === 'generated_text'
        ? executorResult.artifact.content
        : undefined,
    executionBoundary,
  };
}
