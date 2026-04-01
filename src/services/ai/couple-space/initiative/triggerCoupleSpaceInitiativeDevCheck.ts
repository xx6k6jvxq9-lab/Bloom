import type { CoupleSpaceInitiativeDevEntryResult } from './coupleSpaceInitiativeDevEntry';
import {
  runCoupleSpaceInitiativeDevCheck,
  type RunCoupleSpaceInitiativeDevCheckInput,
  type RunCoupleSpaceInitiativeDevCheckResult,
} from './runCoupleSpaceInitiativeDevCheck';

export type TriggerCoupleSpaceInitiativeDevCheckResult = {
  result: RunCoupleSpaceInitiativeDevCheckResult;
  summary: string;
  decisionText: string | null;
};

export type TriggerCoupleSpaceInitiativeDevCheckOptions = RunCoupleSpaceInitiativeDevCheckInput & {
  logger?: (message: string, payload?: unknown) => void;
};

function buildTriggerSummary(result: CoupleSpaceInitiativeDevEntryResult): string {
  return result.runSummary;
}

/**
 * Explicit dev-only trigger for one couple-space initiative check/run pass.
 *
 * Purpose:
 * - keep manual debugging out of Page.tsx
 * - expose a single service-layer entrypoint for console/dev-panel/test callers
 */
export async function triggerCoupleSpaceInitiativeDevCheck(
  input: TriggerCoupleSpaceInitiativeDevCheckOptions,
): Promise<TriggerCoupleSpaceInitiativeDevCheckResult> {
  const result = await runCoupleSpaceInitiativeDevCheck(input);
  const summary = buildTriggerSummary(result);
  const decisionText = result.decisionText;

  if (input.logger) {
    input.logger(summary, {
      resolvedPartnerId: result.resolvedPartnerId,
      resolvedAuthorId: result.resolvedAuthorId,
      resolvedChatMessageCount: result.resolvedChatMessageCount,
      bestCandidate: result.harnessResult.selection.bestCandidate,
      runResult: result.harnessResult.runResult,
    });

    if (decisionText) {
      input.logger(decisionText);
    }
  }

  return {
    result,
    summary,
    decisionText,
  };
}
