import type { CoupleSpaceData } from '../../../../types';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import {
  executeCoupleSpaceCoNoteDraft,
  type ExecuteCoupleSpaceCoNoteDraftResult,
} from '../actions/executeCoupleSpaceCoNoteDraft';
import {
  executeCoupleSpaceDailyCommentReply,
  type ExecuteCoupleSpaceDailyCommentReplyResult,
} from '../actions/executeCoupleSpaceDailyCommentReply';
import {
  executeCoupleSpaceDailyPost,
  type ExecuteCoupleSpaceDailyPostResult,
} from '../actions/executeCoupleSpaceDailyPost';
import {
  executeCoupleSpaceLedgerConfirmation,
  type ExecuteCoupleSpaceLedgerConfirmationResult,
} from '../actions/executeCoupleSpaceLedgerConfirmation';
import {
  executeCoupleSpaceLoveLetterDraft,
  type ExecuteCoupleSpaceLoveLetterDraftResult,
} from '../actions/executeCoupleSpaceLoveLetterDraft';
import {
  executeCoupleSpaceLoveLetterReply,
  type ExecuteCoupleSpaceLoveLetterReplyResult,
} from '../actions/executeCoupleSpaceLoveLetterReply';
import {
  executeCoupleSpaceMessageBoardEntry,
  type ExecuteCoupleSpaceMessageBoardEntryResult,
} from '../actions/executeCoupleSpaceMessageBoardEntry';
import {
  executeCoupleSpaceMessageBoardReply,
  type ExecuteCoupleSpaceMessageBoardReplyResult,
} from '../actions/executeCoupleSpaceMessageBoardReply';
import {
  executeCoupleSpacePostReaction,
  type ExecuteCoupleSpacePostReactionResult,
} from '../actions/executeCoupleSpacePostReaction';

export type RunCoupleSpaceInitiativeCandidateInput = {
  request: CoupleSpaceInitiativeExecutionRequest | null;
  context?: CoupleSpaceInitiativeExecutionContext;
  coupleSpace: CoupleSpaceData;
  authorId: string;
  now?: number;
};

export type RunCoupleSpaceInitiativeCandidateResult =
  | ({
      actionType: 'post_couple_daily';
    } & ExecuteCoupleSpaceDailyPostResult)
  | ({
      actionType: 'post_message_board_entry';
    } & ExecuteCoupleSpaceMessageBoardEntryResult)
  | ({
      actionType: 'write_love_letter';
    } & ExecuteCoupleSpaceLoveLetterDraftResult)
  | ({
      actionType: 'write_co_note';
    } & ExecuteCoupleSpaceCoNoteDraftResult)
  | ({
      actionType: 'reply_message_board';
    } & ExecuteCoupleSpaceMessageBoardReplyResult)
  | ({
      actionType: 'react_to_existing_post';
    } & ExecuteCoupleSpacePostReactionResult)
  | ({
      actionType: 'reply_daily_comment';
    } & ExecuteCoupleSpaceDailyCommentReplyResult)
  | ({
      actionType: 'reply_love_letter';
    } & ExecuteCoupleSpaceLoveLetterReplyResult)
  | ({
      actionType: 'create_ledger_entry';
    } & ExecuteCoupleSpaceLedgerConfirmationResult)
  | {
      actionType: CoupleSpaceInitiativeExecutionRequest['envelope']['actionType'] | null;
      executorStatus: 'rejected' | 'unsupported';
      reason: string;
      nextCoupleSpace: CoupleSpaceData;
    };

/**
 * Thin unified bridge over the already-existing single-action execution helpers.
 *
 * Scope:
 * - route one prepared execution request into the matching concrete helper
 * - keep each action's executor/sink boundary intact
 *
 * Non-goals:
 * - no candidate selection
 * - no orchestration across multiple actions
 * - no UI updates
 * - no scheduling
 */
export async function runCoupleSpaceInitiativeCandidate(
  input: RunCoupleSpaceInitiativeCandidateInput,
): Promise<RunCoupleSpaceInitiativeCandidateResult> {
  const actionType = input.request?.envelope.actionType ?? null;

  if (!input.request) {
    return {
      actionType,
      executorStatus: 'rejected',
      reason: 'No execution request was provided to the initiative runner bridge.',
      nextCoupleSpace: input.coupleSpace,
    };
  }

  switch (input.request.envelope.actionType) {
    case 'post_couple_daily': {
      const result = await executeCoupleSpaceDailyPost(input);
      return { actionType: 'post_couple_daily', ...result };
    }

    case 'post_message_board_entry': {
      const result = await executeCoupleSpaceMessageBoardEntry(input);
      return { actionType: 'post_message_board_entry', ...result };
    }

    case 'write_love_letter': {
      const result = await executeCoupleSpaceLoveLetterDraft({
        request: input.request,
        context: input.context,
        now: input.now,
      });
      return { actionType: 'write_love_letter', ...result };
    }

    case 'write_co_note': {
      const result = await executeCoupleSpaceCoNoteDraft({
        request: input.request,
        context: input.context,
        now: input.now,
      });
      return { actionType: 'write_co_note', ...result };
    }

    case 'reply_message_board': {
      const result = await executeCoupleSpaceMessageBoardReply(input);
      return { actionType: 'reply_message_board', ...result };
    }

    case 'react_to_existing_post': {
      const result = await executeCoupleSpacePostReaction(input);
      return { actionType: 'react_to_existing_post', ...result };
    }

    case 'reply_daily_comment': {
      const result = await executeCoupleSpaceDailyCommentReply(input);
      return { actionType: 'reply_daily_comment', ...result };
    }

    case 'reply_love_letter': {
      const result = await executeCoupleSpaceLoveLetterReply(input);
      return { actionType: 'reply_love_letter', ...result };
    }

    case 'create_ledger_entry': {
      const result = await executeCoupleSpaceLedgerConfirmation({
        request: input.request,
        context: input.context,
        now: input.now,
      });
      return { actionType: 'create_ledger_entry', ...result };
    }

    default:
      return {
        actionType: input.request.envelope.actionType,
        executorStatus: 'unsupported',
        reason: `No concrete run helper is wired for ${input.request.envelope.actionType} yet.`,
        nextCoupleSpace: input.coupleSpace,
      };
  }
}
