import type { CoupleSpaceCommitMode } from '../../../../types';
import type { CoupleSpaceInitiativeExecutionPlan } from '../execution/coupleSpaceInitiativeExecutionPlan';

export type CoupleSpaceInitiativeCommitChannel = 'direct_write' | 'draft_buffer' | 'confirmation_queue';

export type CoupleSpaceInitiativeCommitSink = {
  name: string;
  summary: string;
  allowsDirectWrite: boolean;
  requiresHumanConfirmation: boolean;
};

export type CoupleSpaceInitiativeCommitArtifactField = {
  key: string;
  required: boolean;
  description: string;
};

export type CoupleSpaceInitiativeCommitArtifactShape = {
  kind: 'direct-write-artifact' | 'draft-artifact' | 'confirmation-request-artifact';
  fields: CoupleSpaceInitiativeCommitArtifactField[];
};

export type CoupleSpaceInitiativeCommitRoute = {
  actionType: CoupleSpaceInitiativeExecutionPlan['actionType'];
  commitMode: CoupleSpaceCommitMode;
  channel: CoupleSpaceInitiativeCommitChannel;
  sink: CoupleSpaceInitiativeCommitSink;
  artifactShape: CoupleSpaceInitiativeCommitArtifactShape;
  requiresHumanConfirmation: boolean;
  summary: string;
};

function createCommonArtifactFields(plan: CoupleSpaceInitiativeExecutionPlan): CoupleSpaceInitiativeCommitArtifactField[] {
  return [
    {
      key: 'actionType',
      required: true,
      description: `The selected initiative action type, fixed as ${plan.actionType}.`,
    },
    {
      key: 'target',
      required: true,
      description: `The future execution target name, fixed as ${plan.target.name}.`,
    },
    {
      key: 'commitMode',
      required: true,
      description: `The selected commit mode, fixed as ${plan.commitMode}.`,
    },
    {
      key: 'payloadSourceSummary',
      required: true,
      description: 'A compact description of which signal/execution inputs would feed the future payload.',
    },
    {
      key: 'missingPreconditions',
      required: true,
      description: 'A list of unmet preconditions, if any, captured before any real execution step.',
    },
  ];
}

export function buildCoupleSpaceInitiativeCommitRoute(
  plan: CoupleSpaceInitiativeExecutionPlan | null,
): CoupleSpaceInitiativeCommitRoute | null {
  if (!plan) {
    return null;
  }

  const commonFields = createCommonArtifactFields(plan);

  switch (plan.commitMode) {
    case 'auto':
      return {
        actionType: plan.actionType,
        commitMode: plan.commitMode,
        channel: 'direct_write',
        sink: {
          name: 'couple-space-direct-write-sink',
          summary:
            'Future auto-mode actions can flow into a direct-write sink after generation and validation complete.',
          allowsDirectWrite: true,
          requiresHumanConfirmation: false,
        },
        artifactShape: {
          kind: 'direct-write-artifact',
          fields: [
            ...commonFields,
            {
              key: 'generatedContent',
              required: true,
              description: 'The future generated text or structured content that would be written to the target object.',
            },
            {
              key: 'targetObjectHint',
              required: true,
              description: 'A hint for the eventual target collection, such as posts, message board, or reply thread.',
            },
          ],
        },
        requiresHumanConfirmation: false,
        summary:
          'This plan is auto-route eligible: after future generation and validation, it may write directly to the intended couple-space target.',
      };

    case 'draft':
      return {
        actionType: plan.actionType,
        commitMode: plan.commitMode,
        channel: 'draft_buffer',
        sink: {
          name: 'couple-space-draft-sink',
          summary:
            'Future draft-mode actions should land in a draft buffer before any user-facing commit happens.',
          allowsDirectWrite: false,
          requiresHumanConfirmation: false,
        },
        artifactShape: {
          kind: 'draft-artifact',
          fields: [
            ...commonFields,
            {
              key: 'draftContent',
              required: true,
              description: 'The future generated content prepared as a draft rather than a final committed object.',
            },
            {
              key: 'editableFields',
              required: false,
              description: 'A list of fields that future editing/review flow may allow users or systems to adjust.',
            },
          ],
        },
        requiresHumanConfirmation: false,
        summary:
          'This plan is draft-route eligible: future execution should produce a draft artifact first instead of writing into couple-space data directly.',
      };

    case 'confirm':
      return {
        actionType: plan.actionType,
        commitMode: plan.commitMode,
        channel: 'confirmation_queue',
        sink: {
          name: 'couple-space-confirmation-request-sink',
          summary:
            'Future confirm-mode actions should land in a confirmation queue and must not write business data directly.',
          allowsDirectWrite: false,
          requiresHumanConfirmation: true,
        },
        artifactShape: {
          kind: 'confirmation-request-artifact',
          fields: [
            ...commonFields,
            {
              key: 'proposedContent',
              required: false,
              description: 'Optional proposed generated or structured content attached to the confirmation request.',
            },
            {
              key: 'confirmationReason',
              required: true,
              description: 'A short explanation for why this action requires manual confirmation before commit.',
            },
          ],
        },
        requiresHumanConfirmation: true,
        summary:
          'This plan is confirm-route only: future execution should produce a confirmation request artifact and keep high-risk data out of direct writes.',
      };

    default:
      return null;
  }
}
