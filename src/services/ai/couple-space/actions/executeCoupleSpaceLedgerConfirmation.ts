import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import { createCoupleSpaceConfirmationArtifact } from '../execution/coupleSpaceInitiativeConfirmationSink';
import { createCoupleSpaceRecordingConfirmationExecutor } from '../prompt/coupleSpaceRecordingConfirmationExecutor';

export type ExecuteCoupleSpaceLedgerConfirmationInput = {
  request: CoupleSpaceInitiativeExecutionRequest | null;
  context?: CoupleSpaceInitiativeExecutionContext;
  now?: number;
};

export type ExecuteCoupleSpaceLedgerConfirmationResult = {
  executorStatus: 'accepted' | 'rejected' | 'unsupported' | 'not_implemented';
  sinkStatus?: 'created' | 'rejected' | 'unsupported';
  reason: string;
  confirmationSummary?: string;
};

/**
 * Thin integration helper for the confirm-only ledger path.
 *
 * Scope:
 * - execute only `create_ledger_entry`
 * - prepare a structured proposal through the recording confirmation executor
 * - convert that proposal into a confirmation-request artifact
 */
export async function executeCoupleSpaceLedgerConfirmation(
  input: ExecuteCoupleSpaceLedgerConfirmationInput,
): Promise<ExecuteCoupleSpaceLedgerConfirmationResult> {
  const executor = createCoupleSpaceRecordingConfirmationExecutor();
  const executorResult = await executor.execute(input.request, input.context);

  if (executorResult.status !== 'accepted' || !executorResult.artifact) {
    return {
      executorStatus: executorResult.status,
      reason: executorResult.reason,
    };
  }

  const sinkResult = createCoupleSpaceConfirmationArtifact({
    artifact: executorResult.artifact,
    now: input.now,
  });

  return {
    executorStatus: executorResult.status,
    sinkStatus: sinkResult.status,
    reason:
      sinkResult.status === 'created'
        ? 'Prepared one ledger confirmation request artifact without committing business data.'
        : sinkResult.reason,
    confirmationSummary: sinkResult.confirmationArtifact?.payloadSummary,
  };
}
