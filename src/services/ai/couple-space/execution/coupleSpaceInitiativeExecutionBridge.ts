import type { CoupleSpaceInitiativeCommitRoute } from '../initiative/coupleSpaceInitiativeCommitRoute';
import type {
  CoupleSpaceInitiativeExecutionPayloadField,
  CoupleSpaceInitiativeExecutionPlan,
} from './coupleSpaceInitiativeExecutionPlan';

export type CoupleSpaceInitiativeBridgeInputField = {
  key: string;
  required: boolean;
  source: 'candidate' | 'signal_context' | 'execution_context';
  description: string;
};

export type CoupleSpaceInitiativeBridgeMissingInput = {
  key: string;
  source: 'candidate' | 'signal_context' | 'execution_context';
  reason: string;
};

export type CoupleSpaceInitiativeBridgeOutputShape = {
  kind: 'direct-write-request' | 'draft-creation-request' | 'confirmation-request';
  fields: Array<{
    key: string;
    required: boolean;
    description: string;
  }>;
};

export type CoupleSpaceInitiativeExecutionBridgeDescriptor = {
  actionType: CoupleSpaceInitiativeExecutionPlan['actionType'];
  commitMode: CoupleSpaceInitiativeExecutionPlan['commitMode'];
  targetName: string;
  commitSinkName: string;
  payloadPrimarySources: Array<'candidate' | 'signal_context' | 'execution_context'>;
  requiredInputs: CoupleSpaceInitiativeBridgeInputField[];
  missingInputs: CoupleSpaceInitiativeBridgeMissingInput[];
  blockingPreconditions: string[];
  outputShape: CoupleSpaceInitiativeBridgeOutputShape;
  summary: string;
};

function dedupeSources(
  fields: CoupleSpaceInitiativeExecutionPayloadField[],
): Array<'candidate' | 'signal_context' | 'execution_context'> {
  const sources = new Set<'candidate' | 'signal_context' | 'execution_context'>();
  fields.forEach((field) => sources.add(field.source));
  return [...sources];
}

function mapOutputShapeKind(
  route: CoupleSpaceInitiativeCommitRoute,
): CoupleSpaceInitiativeBridgeOutputShape['kind'] {
  switch (route.channel) {
    case 'direct_write':
      return 'direct-write-request';
    case 'draft_buffer':
      return 'draft-creation-request';
    case 'confirmation_queue':
      return 'confirmation-request';
    default:
      return 'draft-creation-request';
  }
}

function buildMissingInputs(
  plan: CoupleSpaceInitiativeExecutionPlan,
): CoupleSpaceInitiativeBridgeMissingInput[] {
  return plan.preconditions.map((precondition) => {
    switch (precondition.code) {
      case 'requires-active-config':
        return {
          key: 'settings',
          source: 'execution_context',
          reason: precondition.description,
        };
      case 'requires-partner-id':
        return {
          key: 'partnerId',
          source: 'execution_context',
          reason: precondition.description,
        };
      case 'requires-letter-id':
        return {
          key: 'letterId',
          source: 'signal_context',
          reason: precondition.description,
        };
      case 'requires-post-id':
        return {
          key: 'postId',
          source: 'signal_context',
          reason: precondition.description,
        };
      case 'requires-comment-id':
        return {
          key: 'commentId',
          source: 'signal_context',
          reason: precondition.description,
        };
      case 'requires-entry-id':
        return {
          key: 'entryId',
          source: 'signal_context',
          reason: precondition.description,
        };
      case 'requires-light-evidence-summary':
        return {
          key: 'memoLightEvidenceSummary',
          source: 'signal_context',
          reason: precondition.description,
        };
      case 'requires-explicit-evidence-summary':
        return {
          key: 'recordingExplicitEvidenceSummary',
          source: 'signal_context',
          reason: precondition.description,
        };
      case 'requires-signal-context':
        return {
          key: 'signalContext',
          source: 'signal_context',
          reason: precondition.description,
        };
      default:
        return {
          key: precondition.code,
          source: 'execution_context',
          reason: precondition.description,
        };
    }
  });
}

export function buildCoupleSpaceInitiativeExecutionBridge(
  plan: CoupleSpaceInitiativeExecutionPlan | null,
  route: CoupleSpaceInitiativeCommitRoute | null,
): CoupleSpaceInitiativeExecutionBridgeDescriptor | null {
  if (!plan || !route) {
    return null;
  }

  const requiredInputs: CoupleSpaceInitiativeBridgeInputField[] = plan.payloadShape.requiredFields.map(
    (field) => ({
      key: field.key,
      required: field.required,
      source: field.source,
      description: field.description,
    }),
  );

  const missingInputs = buildMissingInputs(plan);
  const blockingPreconditions = plan.preconditions.map((item) => item.description);

  return {
    actionType: plan.actionType,
    commitMode: plan.commitMode,
    targetName: plan.target.name,
    commitSinkName: route.sink.name,
    payloadPrimarySources: dedupeSources(plan.payloadShape.requiredFields),
    requiredInputs,
    missingInputs,
    blockingPreconditions,
    outputShape: {
      kind: mapOutputShapeKind(route),
      fields: route.artifactShape.fields.map((field) => ({
        key: field.key,
        required: field.required,
        description: field.description,
      })),
    },
    summary: `${plan.target.name} would bridge into ${route.sink.name} as a ${mapOutputShapeKind(
      route,
    )}, provided the required execution inputs and preconditions are satisfied.`,
  };
}
