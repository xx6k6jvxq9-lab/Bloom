import type { CoupleSpaceData } from '../../../../types';
import { applyCoupleSpaceDirectWriteArtifact } from '../execution/coupleSpaceInitiativeDirectWriteSink';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import { createCoupleSpacePromptGenerationReplyExecutor } from '../prompt/coupleSpacePromptGenerationReplyExecutor';

export type ExecuteCoupleSpacePostReactionInput = {
  request: CoupleSpaceInitiativeExecutionRequest | null;
  context?: CoupleSpaceInitiativeExecutionContext;
  coupleSpace: CoupleSpaceData;
  authorId: string;
  now?: number;
};

export type ExecuteCoupleSpacePostReactionResult = {
  executorStatus: 'accepted' | 'rejected' | 'unsupported' | 'not_implemented';
  sinkStatus?: 'applied' | 'rejected' | 'unsupported';
  reason: string;
  nextCoupleSpace: CoupleSpaceData;
  artifactContent?: string;
};

/**
 * Thin integration helper for the post reaction path.
 *
 * Scope:
 * - execute only `react_to_existing_post`
 * - generate an artifact through the concrete reply executor
 * - apply the artifact through the direct-write sink to append a post comment
 */
export async function executeCoupleSpacePostReaction(
  input: ExecuteCoupleSpacePostReactionInput,
): Promise<ExecuteCoupleSpacePostReactionResult> {
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
    targetRefs: input.context?.targetRefs,
    now: input.now,
  });

  return {
    executorStatus: executorResult.status,
    sinkStatus: sinkResult.status,
    reason:
      sinkResult.status === 'applied'
        ? 'Generated and applied one reaction comment to an existing couple post.'
        : sinkResult.reason,
    nextCoupleSpace: sinkResult.nextCoupleSpace,
    artifactContent:
      executorResult.artifact.kind === 'generated_text'
        ? executorResult.artifact.content
        : undefined,
  };
}
