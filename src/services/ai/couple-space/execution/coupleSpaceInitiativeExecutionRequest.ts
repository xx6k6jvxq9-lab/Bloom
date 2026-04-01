import type { CoupleSpaceInitiativeExecutionBridgeDescriptor } from './coupleSpaceInitiativeExecutionBridge';
import type {
  CoupleSpaceInitiativeExecutionReadinessReport,
  CoupleSpaceInitiativeExecutionReadinessStatus,
} from './coupleSpaceInitiativeExecutionReadiness';

export type CoupleSpaceInitiativeExecutionRequestEnvelope = {
  actionType: CoupleSpaceInitiativeExecutionBridgeDescriptor['actionType'];
  commitMode: CoupleSpaceInitiativeExecutionBridgeDescriptor['commitMode'];
  targetName: string;
  commitSinkName: string;
  readinessStatus: CoupleSpaceInitiativeExecutionReadinessStatus;
};

export type CoupleSpaceInitiativeExecutionRequestInput = {
  key: string;
  source: 'candidate' | 'signal_context' | 'execution_context';
  required: boolean;
  description: string;
};

export type CoupleSpaceInitiativeExecutionRequestOutput = {
  kind: CoupleSpaceInitiativeExecutionBridgeDescriptor['outputShape']['kind'];
  fields: Array<{
    key: string;
    required: boolean;
    description: string;
  }>;
};

export type CoupleSpaceInitiativeExecutionRequest = {
  envelope: CoupleSpaceInitiativeExecutionRequestEnvelope;
  inputs: CoupleSpaceInitiativeExecutionRequestInput[];
  unresolvedInputs: Array<{
    key: string;
    source: 'candidate' | 'signal_context' | 'execution_context';
    reason: string;
  }>;
  output: CoupleSpaceInitiativeExecutionRequestOutput;
  bridgeSummary: string;
  readinessSummary: string;
  readyForExecutionBridge: boolean;
};

export function buildCoupleSpaceInitiativeExecutionRequest(
  bridge: CoupleSpaceInitiativeExecutionBridgeDescriptor | null,
  readiness: CoupleSpaceInitiativeExecutionReadinessReport | null,
): CoupleSpaceInitiativeExecutionRequest | null {
  if (!bridge || !readiness) {
    return null;
  }

  return {
    envelope: {
      actionType: bridge.actionType,
      commitMode: bridge.commitMode,
      targetName: bridge.targetName,
      commitSinkName: bridge.commitSinkName,
      readinessStatus: readiness.status,
    },
    inputs: bridge.requiredInputs.map((input) => ({
      key: input.key,
      source: input.source,
      required: input.required,
      description: input.description,
    })),
    unresolvedInputs: bridge.missingInputs.map((input) => ({
      key: input.key,
      source: input.source,
      reason: input.reason,
    })),
    output: {
      kind: bridge.outputShape.kind,
      fields: bridge.outputShape.fields.map((field) => ({
        key: field.key,
        required: field.required,
        description: field.description,
      })),
    },
    bridgeSummary: bridge.summary,
    readinessSummary: readiness.summary,
    readyForExecutionBridge: readiness.readyForBridge,
  };
}
