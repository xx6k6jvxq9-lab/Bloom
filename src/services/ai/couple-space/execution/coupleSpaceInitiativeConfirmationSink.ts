import type {
  CoupleSpaceInitiativeExecutorArtifact,
  CoupleSpaceStructuredRecordProposalArtifact,
} from './coupleSpaceInitiativeExecutor';

export type CoupleSpaceInitiativeConfirmationArtifact = {
  kind: 'ledger_entry_confirmation_request';
  actionType: 'create_ledger_entry';
  targetName: string;
  payloadSummary: string;
  proposedRecord: CoupleSpaceStructuredRecordProposalArtifact['proposedRecord'];
  createdAt: number;
  requiresHumanConfirmation: true;
};

export type CoupleSpaceConfirmationSinkInput = {
  artifact: CoupleSpaceInitiativeExecutorArtifact | null;
  now?: number;
};

export type CoupleSpaceConfirmationSinkResult = {
  status: 'created' | 'rejected' | 'unsupported';
  reason: string;
  confirmationArtifact?: CoupleSpaceInitiativeConfirmationArtifact;
};

export function createCoupleSpaceConfirmationArtifact(
  input: CoupleSpaceConfirmationSinkInput,
): CoupleSpaceConfirmationSinkResult {
  const { artifact } = input;
  const now = input.now ?? Date.now();

  if (!artifact) {
    return {
      status: 'rejected',
      reason: 'No execution artifact was provided to the confirmation sink.',
    };
  }

  if (!artifact || artifact.kind !== 'structured_record_proposal') {
    return {
      status: 'unsupported',
      reason: artifact
        ? `Confirmation sink does not support artifact kind ${artifact.kind}.`
        : 'Confirmation sink requires a structured record proposal artifact.',
    };
  }

  return {
    status: 'created',
    reason: 'Confirmation sink converted the structured record proposal into a ledger confirmation request artifact.',
    confirmationArtifact: {
      kind: 'ledger_entry_confirmation_request',
      actionType: 'create_ledger_entry',
      targetName: artifact.targetName,
      payloadSummary: artifact.payloadSummary,
      proposedRecord: artifact.proposedRecord,
      createdAt: now,
      requiresHumanConfirmation: true,
    },
  };
}
