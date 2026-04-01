import {
  formatCoupleSpaceInitiativeDecisionTrace,
  serializeCoupleSpaceInitiativeDecisionTrace,
} from './coupleSpaceInitiativeTraceSerializer';
import {
  runCoupleSpaceInitiativeHarness,
  type RunCoupleSpaceInitiativeHarnessInput,
  type RunCoupleSpaceInitiativeHarnessResult,
} from './runCoupleSpaceInitiativeHarness';

export type CoupleSpaceInitiativeDevEntryResult = {
  harnessResult: RunCoupleSpaceInitiativeHarnessResult;
  decisionText: string | null;
  runSummary: string;
};

function buildRunSummary(result: RunCoupleSpaceInitiativeHarnessResult): string {
  const selected = result.selection.bestCandidate?.actionType ?? 'none';
  const readiness = result.readiness?.status ?? 'unavailable';
  const capability = result.executorCapability?.executorName ?? 'none';
  const runStatus = result.runResult?.executorStatus ?? 'not_run';

  return [
    `selected=${selected}`,
    `readiness=${readiness}`,
    `executor=${capability}`,
    `runStatus=${runStatus}`,
  ].join(' | ');
}

/**
 * Development-only wrapper around the full harness pipeline.
 *
 * Purpose:
 * - give local debugging a single explicit entrypoint
 * - keep UI and orchestration code free from test wiring
 */
export async function runCoupleSpaceInitiativeDevEntry(
  input: RunCoupleSpaceInitiativeHarnessInput,
): Promise<CoupleSpaceInitiativeDevEntryResult> {
  const harnessResult = await runCoupleSpaceInitiativeHarness(input);

  const decisionText = harnessResult.selection.trace
    ? formatCoupleSpaceInitiativeDecisionTrace(harnessResult.selection.trace)
    : null;

  // Force snapshot serialization here as a quick integrity check for dev usage.
  if (harnessResult.selection.trace) {
    serializeCoupleSpaceInitiativeDecisionTrace(harnessResult.selection.trace);
  }

  return {
    harnessResult,
    decisionText,
    runSummary: buildRunSummary(harnessResult),
  };
}
