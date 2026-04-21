import type {
  CoupleSpaceData,
  CoupleSpaceInitiativeDraftEntry,
  LoveLetter,
} from '../../../../types';
import { applyCoupleSpaceInitiativeRuntimeResult } from './coupleSpaceInitiativeRuntimePersistence';
import { appendCoupleSpaceInitiativeDraft, createCoupleSpaceInitiativeDraftEntry } from './coupleSpaceDraftBuffer';
import { matchesExecutionBoundaryOutcome } from './coupleSpaceInitiativeExecutionOutcome';
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

function appendPublishedLoveLetter(
  coupleSpace: CoupleSpaceData,
  content: string,
  now: number,
): CoupleSpaceData {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return coupleSpace;
  }

  const existingLetters = coupleSpace.loveLetters ?? [];
  const duplicate = existingLetters.some((letter) => (
    letter.authorId === coupleSpace.partnerId
    && letter.content.trim() === normalizedContent
  ));

  if (duplicate) {
    return coupleSpace;
  }

  const nextLetter: LoveLetter = {
    id: `initiative-love-letter-${now}-${Math.random().toString(36).slice(2, 8)}`,
    authorId: coupleSpace.partnerId || 'partner',
    content: normalizedContent,
    timestamp: now,
    comments: [],
  };

  const previousRuntime = coupleSpace.initiativeRuntime ?? {};
  const previousLoveLetterRuntime = previousRuntime.write_love_letter ?? {
    lastTriggeredAt: null,
    lastDraftedAt: null,
    lastCommittedAt: null,
  };

  return {
    ...coupleSpace,
    loveLetters: [nextLetter, ...existingLetters],
    initiativeRuntime: {
      ...previousRuntime,
      write_love_letter: {
        ...previousLoveLetterRuntime,
        lastTriggeredAt: now,
        lastCommittedAt: now,
      },
    },
  };
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

  if (!runResult || !('draftContent' in runResult) || !runResult.draftContent) {
    return {
      nextCoupleSpace: runtimeAppliedSpace,
      draftSaved: false,
      updatedModuleLabel:
        matchesExecutionBoundaryOutcome(runResult, 'direct_write', 'applied')
          ? getModuleLabel(runResult)
          : null,
    };
  }

  if (runResult.actionType === 'write_love_letter') {
    return {
      nextCoupleSpace: appendPublishedLoveLetter(baseCoupleSpace, runResult.draftContent, now),
      draftSaved: false,
      updatedModuleLabel: getModuleLabel(runResult),
    };
  }

  if (runResult.actionType !== 'write_co_note') {
    return {
      nextCoupleSpace: runtimeAppliedSpace,
      draftSaved: false,
      updatedModuleLabel:
        matchesExecutionBoundaryOutcome(runResult, 'direct_write', 'applied')
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
