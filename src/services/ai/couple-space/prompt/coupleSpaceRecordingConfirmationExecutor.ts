import type {
  CoupleSpaceInitiativeExecutionContext,
  CoupleSpaceInitiativeExecutor,
  CoupleSpaceInitiativeExecutorResult,
} from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';

function buildRejectedResult(
  request: CoupleSpaceInitiativeExecutionRequest | null,
  reason: string,
): CoupleSpaceInitiativeExecutorResult {
  return {
    status: 'rejected',
    actionType: request?.envelope.actionType ?? null,
    reason,
  };
}

/**
 * Confirmation-first executor for high-risk recording actions.
 *
 * Scope:
 * - supports only `create_ledger_entry`
 * - does not call prompt service
 * - turns explicit evidence into a structured-record proposal artifact
 * - keeps the path confirm-only
 */
export function createCoupleSpaceRecordingConfirmationExecutor(): CoupleSpaceInitiativeExecutor {
  return {
    async execute(
      request: CoupleSpaceInitiativeExecutionRequest | null,
      context?: CoupleSpaceInitiativeExecutionContext,
    ): Promise<CoupleSpaceInitiativeExecutorResult> {
      if (!request) {
        return buildRejectedResult(request, 'No execution request was provided.');
      }

      if (request.envelope.actionType !== 'create_ledger_entry') {
        return {
          status: 'unsupported',
          actionType: request.envelope.actionType,
          reason: 'This recording confirmation executor currently supports only create_ledger_entry.',
        };
      }

      if (!request.readyForExecutionBridge) {
        return buildRejectedResult(
          request,
          'Execution request is not bridge-ready yet; required inputs or preconditions are still unresolved.',
        );
      }

      const recordInput = context?.recordInputs?.create_ledger_entry;
      if (!recordInput) {
        return buildRejectedResult(
          request,
          'Execution context is missing the create_ledger_entry recording input payload.',
        );
      }

      if (!recordInput.payerId) {
        return buildRejectedResult(
          request,
          'Recording confirmation executor needs a payerId before it can form a ledger proposal.',
        );
      }

      const evidenceSummary = recordInput.explicitEvidenceSummary?.trim();
      if (!evidenceSummary) {
        return buildRejectedResult(
          request,
          'Recording confirmation executor needs an explicit evidence summary before it can form a ledger proposal.',
        );
      }

      const description =
        recordInput.description?.trim() ||
        evidenceSummary.slice(0, 120) ||
        'Proposed couple ledger entry';

      return {
        status: 'accepted',
        actionType: request.envelope.actionType,
        reason: 'Prepared one structured ledger proposal artifact for confirmation without committing it.',
        artifact: {
          kind: 'structured_record_proposal',
          actionType: 'create_ledger_entry',
          commitMode: 'confirm',
          targetName: request.envelope.targetName,
          payloadSummary: evidenceSummary,
          proposedRecord: {
            payerId: recordInput.payerId,
            amount: recordInput.amount ?? null,
            description,
            evidenceSummary,
            timestamp: recordInput.timestamp ?? Date.now(),
          },
        },
      };
    },
  };
}
