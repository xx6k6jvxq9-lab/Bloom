import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import { createCoupleSpaceDraftArtifact } from '../execution/coupleSpaceInitiativeDraftSink';
import { createCoupleSpacePromptGenerationDraftExecutor } from '../prompt/coupleSpacePromptGenerationDraftExecutor';

export type ExecuteCoupleSpaceCoNoteDraftInput = {
  request: CoupleSpaceInitiativeExecutionRequest | null;
  context?: CoupleSpaceInitiativeExecutionContext;
  now?: number;
};

export type ExecuteCoupleSpaceCoNoteDraftResult = {
  executorStatus: 'accepted' | 'rejected' | 'unsupported' | 'not_implemented';
  sinkStatus?: 'created' | 'rejected' | 'unsupported';
  reason: string;
  draftContent?: string;
};

/**
 * Thin integration helper for the memo draft path.
 *
 * Scope:
 * - execute only `write_co_note`
 * - generate an artifact through the concrete draft executor
 * - convert the artifact into a draft sink artifact
 */
export async function executeCoupleSpaceCoNoteDraft(
  input: ExecuteCoupleSpaceCoNoteDraftInput,
): Promise<ExecuteCoupleSpaceCoNoteDraftResult> {
  const executor = createCoupleSpacePromptGenerationDraftExecutor();
  const executorResult = await executor.execute(input.request, input.context);

  if (executorResult.status !== 'accepted' || !executorResult.artifact) {
    return {
      executorStatus: executorResult.status,
      reason: executorResult.reason,
    };
  }

  const sinkResult = createCoupleSpaceDraftArtifact({
    artifact: executorResult.artifact,
    now: input.now,
  });

  return {
    executorStatus: executorResult.status,
    sinkStatus: sinkResult.status,
    reason:
      sinkResult.status === 'created'
        ? 'Generated and converted one proactive co-note into a draft artifact.'
        : sinkResult.reason,
    draftContent: sinkResult.draftArtifact?.content,
  };
}
