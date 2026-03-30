import type { CoupleSpaceData } from '../../../../types';
import { applyCoupleSpaceDirectWriteArtifact } from '../execution/coupleSpaceInitiativeDirectWriteSink';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import { createCoupleSpacePromptGenerationAutoWriteExecutor } from '../prompt/coupleSpacePromptGenerationAutoWriteExecutor';

export type ExecuteCoupleSpaceDailyPostInput = {
  request: CoupleSpaceInitiativeExecutionRequest | null;
  context?: CoupleSpaceInitiativeExecutionContext;
  coupleSpace: CoupleSpaceData;
  authorId: string;
  now?: number;
};

export type ExecuteCoupleSpaceDailyPostResult = {
  executorStatus: 'accepted' | 'rejected' | 'unsupported' | 'not_implemented';
  sinkStatus?: 'applied' | 'rejected' | 'unsupported';
  reason: string;
  nextCoupleSpace: CoupleSpaceData;
  artifactContent?: string;
};

/**
 * Thin integration helper for the first end-to-end proactive path.
 *
 * Scope:
 * - execute only `post_couple_daily`
 * - generate an artifact through the concrete executor
 * - apply the artifact through the direct-write sink
 *
 * Non-goals:
 * - no UI updates
 * - no automatic scheduling
 * - no orchestration across multiple action types
 */
export async function executeCoupleSpaceDailyPost(
  input: ExecuteCoupleSpaceDailyPostInput,
): Promise<ExecuteCoupleSpaceDailyPostResult> {
  const executor = createCoupleSpacePromptGenerationAutoWriteExecutor();
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
        ? 'Generated and applied one proactive couple daily post through the minimal execution path.'
        : sinkResult.reason,
    nextCoupleSpace: sinkResult.nextCoupleSpace,
    artifactContent:
      executorResult.artifact.kind === 'generated_text'
        ? executorResult.artifact.content
        : undefined,
  };
}
