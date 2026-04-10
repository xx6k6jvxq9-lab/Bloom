import type {
  SharedCommitArtifactKind,
  SharedCommitChannel,
  SharedExecutionRequestKind,
} from '../../../execution/commitRouteTypes';

export type CoupleSpaceInitiativeExecutionBoundary = {
  channel: SharedCommitChannel;
  artifactKind: SharedCommitArtifactKind;
  requestKind: SharedExecutionRequestKind;
  sinkName: string;
  appliesBusinessWrite: boolean;
};

export function createDirectWriteExecutionBoundary(
  sinkName: string,
): CoupleSpaceInitiativeExecutionBoundary {
  return {
    channel: 'direct_write',
    artifactKind: 'direct-write-artifact',
    requestKind: 'direct-write-request',
    sinkName,
    appliesBusinessWrite: true,
  };
}

export function createDraftExecutionBoundary(
  sinkName: string,
): CoupleSpaceInitiativeExecutionBoundary {
  return {
    channel: 'draft_buffer',
    artifactKind: 'draft-artifact',
    requestKind: 'draft-creation-request',
    sinkName,
    appliesBusinessWrite: false,
  };
}

export function createConfirmationExecutionBoundary(
  sinkName: string,
): CoupleSpaceInitiativeExecutionBoundary {
  return {
    channel: 'confirmation_queue',
    artifactKind: 'confirmation-request-artifact',
    requestKind: 'confirmation-request',
    sinkName,
    appliesBusinessWrite: false,
  };
}
