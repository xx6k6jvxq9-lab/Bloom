import type { CoupleSpaceData } from '../../../../types';
import { applyCoupleSpaceDirectWriteArtifact } from '../execution/coupleSpaceInitiativeDirectWriteSink';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import { createCoupleSpacePromptGenerationReplyExecutor } from '../prompt/coupleSpacePromptGenerationReplyExecutor';

export type ExecuteCoupleSpaceMessageBoardReplyInput = {
  request: CoupleSpaceInitiativeExecutionRequest | null;
  context?: CoupleSpaceInitiativeExecutionContext;
  coupleSpace: CoupleSpaceData;
  authorId: string;
  now?: number;
};

export type ExecuteCoupleSpaceMessageBoardReplyResult = {
  executorStatus: 'accepted' | 'rejected' | 'unsupported' | 'not_implemented';
  sinkStatus?: 'applied' | 'rejected' | 'unsupported';
  reason: string;
  nextCoupleSpace: CoupleSpaceData;
  artifactContent?: string;
};

/**
 * Thin integration helper for the first interaction reply path.
 *
 * Scope:
 * - execute only `reply_message_board`
 * - generate an artifact through the concrete reply executor
 * - apply the artifact through the direct-write sink
 */
export async function executeCoupleSpaceMessageBoardReply(
  input: ExecuteCoupleSpaceMessageBoardReplyInput,
): Promise<ExecuteCoupleSpaceMessageBoardReplyResult> {
  const executor = createCoupleSpacePromptGenerationReplyExecutor();
  const executorResult = await executor.execute(input.request, input.context);

  if (executorResult.status !== 'accepted' || !executorResult.artifact) {
    return {
      executorStatus: executorResult.status,
      reason: executorResult.reason,
      nextCoupleSpace: input.coupleSpace,
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
        ? 'Generated and applied one message-board reply through the minimal interaction path.'
        : sinkResult.reason,
    nextCoupleSpace: sinkResult.nextCoupleSpace,
    artifactContent:
      executorResult.artifact.kind === 'generated_text'
        ? executorResult.artifact.content
        : undefined,
  };
}
