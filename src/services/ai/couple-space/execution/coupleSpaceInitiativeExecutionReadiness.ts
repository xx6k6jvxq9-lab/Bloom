import type { CoupleSpaceInitiativeExecutionBridgeDescriptor } from './coupleSpaceInitiativeExecutionBridge';

export type CoupleSpaceInitiativeExecutionReadinessStatus = 'ready' | 'partial' | 'blocked';

export type CoupleSpaceInitiativeExecutionReadinessReason = {
  code:
    | 'no-bridge-descriptor'
    | 'required-input-missing'
    | 'blocking-preconditions-present'
    | 'human-confirmation-required'
    | 'ready-for-bridge';
  description: string;
};

export type CoupleSpaceInitiativeExecutionReadinessReport = {
  actionType: CoupleSpaceInitiativeExecutionBridgeDescriptor['actionType'] | null;
  status: CoupleSpaceInitiativeExecutionReadinessStatus;
  readyForBridge: boolean;
  requiresHumanConfirmation: boolean;
  missingRequiredInputCount: number;
  blockingPreconditionCount: number;
  reasons: CoupleSpaceInitiativeExecutionReadinessReason[];
  summary: string;
};

export function evaluateCoupleSpaceInitiativeExecutionReadiness(
  bridge: CoupleSpaceInitiativeExecutionBridgeDescriptor | null,
): CoupleSpaceInitiativeExecutionReadinessReport {
  if (!bridge) {
    return {
      actionType: null,
      status: 'blocked',
      readyForBridge: false,
      requiresHumanConfirmation: false,
      missingRequiredInputCount: 0,
      blockingPreconditionCount: 0,
      reasons: [
        {
          code: 'no-bridge-descriptor',
          description: 'No execution bridge descriptor is available, so bridge readiness cannot be evaluated.',
        },
      ],
      summary: 'Bridge readiness is blocked because no execution bridge descriptor was provided.',
    };
  }

  const missingRequiredInputCount = bridge.missingInputs.length;
  const blockingPreconditionCount = bridge.blockingPreconditions.length;
  const requiresHumanConfirmation = bridge.outputShape.kind === 'confirmation-request';

  const reasons: CoupleSpaceInitiativeExecutionReadinessReason[] = [];

  if (missingRequiredInputCount > 0) {
    reasons.push({
      code: 'required-input-missing',
      description: `${missingRequiredInputCount} required bridge inputs still need to be supplied before execution can proceed.`,
    });
  }

  if (blockingPreconditionCount > 0) {
    reasons.push({
      code: 'blocking-preconditions-present',
      description: `${blockingPreconditionCount} blocking preconditions are still attached to the current bridge descriptor.`,
    });
  }

  if (requiresHumanConfirmation) {
    reasons.push({
      code: 'human-confirmation-required',
      description: 'This bridge would route into a confirmation request and therefore still requires a manual confirmation layer.',
    });
  }

  const readyForBridge = missingRequiredInputCount === 0 && blockingPreconditionCount === 0;

  if (readyForBridge) {
    reasons.push({
      code: 'ready-for-bridge',
      description: 'All required bridge inputs are present and no blocking preconditions remain in the static descriptor.',
    });
  }

  const status: CoupleSpaceInitiativeExecutionReadinessStatus = !readyForBridge
    ? 'blocked'
    : requiresHumanConfirmation
      ? 'partial'
      : 'ready';

  const summary =
    status === 'ready'
      ? `Execution bridge for ${bridge.actionType} is statically ready to form a direct bridge request.`
      : status === 'partial'
        ? `Execution bridge for ${bridge.actionType} is structurally ready, but still expects a manual confirmation path.`
        : `Execution bridge for ${bridge.actionType} is blocked until required inputs and preconditions are satisfied.`;

  return {
    actionType: bridge.actionType,
    status,
    readyForBridge,
    requiresHumanConfirmation,
    missingRequiredInputCount,
    blockingPreconditionCount,
    reasons,
    summary,
  };
}
