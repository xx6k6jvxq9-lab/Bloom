import type { CoupleSpaceInitiativeExecutorArtifact } from './coupleSpaceInitiativeExecutor';

export type CoupleSpaceInitiativeDraftArtifact = {
  kind: 'love_letter_draft' | 'co_note_draft';
  actionType: 'write_love_letter' | 'write_co_note';
  targetName: string;
  content: string;
  createdAt: number;
  editable: boolean;
};

export type CoupleSpaceDraftSinkInput = {
  artifact: CoupleSpaceInitiativeExecutorArtifact | null;
  now?: number;
};

export type CoupleSpaceDraftSinkResult = {
  status: 'created' | 'rejected' | 'unsupported';
  reason: string;
  draftArtifact?: CoupleSpaceInitiativeDraftArtifact;
};

export function createCoupleSpaceDraftArtifact(
  input: CoupleSpaceDraftSinkInput,
): CoupleSpaceDraftSinkResult {
  const { artifact } = input;
  const now = input.now ?? Date.now();

  if (!artifact) {
    return {
      status: 'rejected',
      reason: 'No execution artifact was provided to the draft sink.',
    };
  }

  if (artifact.kind !== 'generated_text') {
    return {
      status: 'unsupported',
      reason: `Draft sink does not support artifact kind ${artifact.kind}.`,
    };
  }

  if (artifact.commitMode !== 'draft') {
    return {
      status: 'rejected',
      reason: `Draft sink only accepts draft commit artifacts, received ${artifact.commitMode}.`,
    };
  }

  if (
    artifact.actionType !== 'write_love_letter' &&
    artifact.actionType !== 'write_co_note'
  ) {
    return {
      status: 'unsupported',
      reason: `Draft sink currently supports only write_love_letter and write_co_note, received ${artifact.actionType}.`,
    };
  }

  const content = artifact.content.trim();
  if (!content) {
    return {
      status: 'rejected',
      reason: 'Generated artifact content is empty, so no draft artifact can be created.',
    };
  }

  return {
    status: 'created',
    reason:
      artifact.actionType === 'write_love_letter'
        ? 'Draft sink converted the generated artifact into a love-letter draft artifact.'
        : 'Draft sink converted the generated artifact into a co-note draft artifact.',
    draftArtifact: {
      kind: artifact.actionType === 'write_love_letter' ? 'love_letter_draft' : 'co_note_draft',
      actionType: artifact.actionType,
      targetName: artifact.targetName,
      content,
      createdAt: now,
      editable: true,
    },
  };
}
