import type { CoupleSpaceCommitMode } from '../../../../types';
import type {
  BuildCoupleCoNotePromptOptions,
  BuildCoupleDailyCommentReplyPromptOptions,
  BuildCoupleDailyCommentPromptOptions,
  BuildCoupleDailyPostPromptOptions,
  BuildCoupleLoveLetterPromptOptions,
  BuildCoupleLoveLetterReplyPromptOptions,
  BuildCoupleMessageBoardPromptOptions,
} from '../../prompts';
import type { CoupleSpaceInitiativeExecutionRequest } from './coupleSpaceInitiativeExecutionRequest';
import type { CoupleSpaceSettingsLike } from '../prompt/coupleSpacePromptService';

export type CoupleSpaceInitiativeExecutorStatus =
  | 'accepted'
  | 'rejected'
  | 'unsupported'
  | 'not_implemented';

export type CoupleSpaceInitiativeExecutorResult = {
  status: CoupleSpaceInitiativeExecutorStatus;
  actionType: CoupleSpaceInitiativeExecutionRequest['envelope']['actionType'] | null;
  reason: string;
  artifact?: CoupleSpaceInitiativeExecutorArtifact;
};

export type CoupleSpaceGeneratedTextArtifact = {
  kind: 'generated_text';
  actionType: CoupleSpaceInitiativeExecutionRequest['envelope']['actionType'];
  commitMode: CoupleSpaceCommitMode;
  targetName: string;
  content: string;
};

export type CoupleSpaceStructuredRecordProposalArtifact = {
  kind: 'structured_record_proposal';
  actionType: 'create_ledger_entry';
  commitMode: Extract<CoupleSpaceCommitMode, 'confirm'>;
  targetName: string;
  payloadSummary: string;
  proposedRecord: {
    payerId: string;
    amount: number | null;
    description: string;
    evidenceSummary: string;
    timestamp: number;
  };
};

export type CoupleSpaceInitiativeExecutorArtifact =
  | CoupleSpaceGeneratedTextArtifact
  | CoupleSpaceStructuredRecordProposalArtifact;

export type CoupleSpaceInitiativeExecutionContext = {
  settings?: CoupleSpaceSettingsLike | null;
  promptInputs?: {
    post_couple_daily?: BuildCoupleDailyPostPromptOptions;
    post_message_board_entry?: BuildCoupleMessageBoardPromptOptions;
    write_love_letter?: BuildCoupleLoveLetterPromptOptions;
    write_co_note?: BuildCoupleCoNotePromptOptions;
    reply_love_letter?: BuildCoupleLoveLetterReplyPromptOptions;
    reply_message_board?: BuildCoupleMessageBoardPromptOptions;
    reply_daily_comment?: BuildCoupleDailyCommentReplyPromptOptions;
    react_to_existing_post?: BuildCoupleDailyCommentPromptOptions;
  };
  recordInputs?: {
    create_ledger_entry?: {
      payerId: string;
      explicitEvidenceSummary: string;
      amount?: number | null;
      description?: string;
      timestamp?: number;
    };
  };
  targetRefs?: {
    reply_love_letter?: {
      letterId: string;
    };
    reply_message_board?: {
      entryId: string;
    };
    reply_daily_comment?: {
      postId: string;
      commentId: string;
    };
    react_to_existing_post?: {
      postId: string;
    };
  };
};

/**
 * Executor interface only.
 *
 * Current role:
 * - freeze the contract for the future execution layer
 * - keep execution request shape decoupled from concrete prompt/commit logic
 *
 * Non-goal:
 * - no generation
 * - no service calls
 * - no commit
 * - no side effects
 */
export interface CoupleSpaceInitiativeExecutor {
  execute(
    request: CoupleSpaceInitiativeExecutionRequest | null,
    context?: CoupleSpaceInitiativeExecutionContext,
  ): Promise<CoupleSpaceInitiativeExecutorResult>;
}

export function createNoopCoupleSpaceInitiativeExecutor(): CoupleSpaceInitiativeExecutor {
  return {
    async execute(
      request: CoupleSpaceInitiativeExecutionRequest | null,
      _context?: CoupleSpaceInitiativeExecutionContext,
    ): Promise<CoupleSpaceInitiativeExecutorResult> {
      if (!request) {
        return {
          status: 'rejected',
          actionType: null,
          reason: 'No execution request was provided.',
        };
      }

      return {
        status: 'not_implemented',
        actionType: request.envelope.actionType,
        reason:
          'Couple-space initiative executor interface is defined, but no concrete executor is wired yet.',
      };
    },
  };
}
