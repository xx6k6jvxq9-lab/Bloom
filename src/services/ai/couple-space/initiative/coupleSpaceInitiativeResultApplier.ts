import type {
  CoupleSpaceData,
  CoupleSpaceInitiativeDraftEntry,
} from '../../../../types';
import { applyCoupleSpaceInitiativeRuntimeResult } from './coupleSpaceInitiativeRuntimePersistence';
import { appendCoupleSpaceInitiativeDraft, createCoupleSpaceInitiativeDraftEntry } from './coupleSpaceDraftBuffer';
import type { RunCoupleSpaceInitiativeCandidateResult } from './runCoupleSpaceInitiativeCandidate';

export type CoupleSpaceInitiativeResultApplySource = CoupleSpaceInitiativeDraftEntry['source'];

export type ApplyCoupleSpaceInitiativeResultOutput = {
  nextCoupleSpace: CoupleSpaceData;
  draftSaved: boolean;
  updatedModuleLabel: string | null;
};

export function buildAppliedInitiativeStatusText(
  baseStatusText: string,
  appliedResult: Pick<ApplyCoupleSpaceInitiativeResultOutput, 'draftSaved'>,
): string {
  return appliedResult.draftSaved
    ? `${baseStatusText} 这条草稿已经存进草稿箱了。`
    : baseStatusText;
}

function getModuleLabel(runResult: RunCoupleSpaceInitiativeCandidateResult | null): string | null {
  switch (runResult?.actionType) {
    case 'post_couple_daily':
      return '动态';
    case 'write_love_letter':
      return '情书';
    case 'post_message_board_entry':
    case 'reply_message_board':
      return '留言板';
    case 'write_co_note':
      return '互记';
    case 'create_ledger_entry':
      return '账本';
    case 'reply_love_letter':
      return '情书回复';
    case 'reply_daily_comment':
      return '评论回复';
    case 'react_to_existing_post':
      return '动态互动';
    default:
      return null;
  }
}

export function applyCoupleSpaceInitiativeRunResult(
  baseCoupleSpace: CoupleSpaceData,
  runResult: RunCoupleSpaceInitiativeCandidateResult | null,
  source: CoupleSpaceInitiativeResultApplySource,
  now = Date.now(),
): ApplyCoupleSpaceInitiativeResultOutput {
  const runtimeAppliedSpace = applyCoupleSpaceInitiativeRuntimeResult(
    baseCoupleSpace,
    runResult,
    now,
  );

  if (
    !runResult ||
    (runResult.actionType !== 'write_love_letter' && runResult.actionType !== 'write_co_note') ||
    !('draftContent' in runResult) ||
    !runResult.draftContent
  ) {
    return {
      nextCoupleSpace: runtimeAppliedSpace,
      draftSaved: false,
      updatedModuleLabel:
        runResult &&
        'executionBoundary' in runResult &&
        runResult.executorStatus === 'accepted' &&
        runResult.executionBoundary.channel === 'direct_write'
          ? getModuleLabel(runResult)
          : null,
    };
  }

  const nextCoupleSpace = appendCoupleSpaceInitiativeDraft(
    runtimeAppliedSpace,
    createCoupleSpaceInitiativeDraftEntry({
      actionType: runResult.actionType,
      content: runResult.draftContent,
      createdAt: now,
      source,
    }),
  );

  return {
    nextCoupleSpace,
    draftSaved: nextCoupleSpace !== baseCoupleSpace,
    updatedModuleLabel: getModuleLabel(runResult),
  };
}
