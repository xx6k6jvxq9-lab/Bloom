export type SharedCommitChannel =
  | 'direct_write'
  | 'draft_buffer'
  | 'confirmation_queue';

export type SharedCommitArtifactKind =
  | 'direct-write-artifact'
  | 'draft-artifact'
  | 'confirmation-request-artifact';

export type SharedExecutionRequestKind =
  | 'direct-write-request'
  | 'draft-creation-request'
  | 'confirmation-request';
