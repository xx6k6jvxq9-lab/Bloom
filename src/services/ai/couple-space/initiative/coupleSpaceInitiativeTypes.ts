import type {
  BuildCoupleDailyPostPromptOptions,
  BuildCoupleLoveLetterPromptOptions,
  CoupleSpaceInitiativeActionType,
} from '../../prompts';

/**
 * Thin initiative skeleton for future proactive couple-space behaviors.
 *
 * Current role:
 * - provide a stable action vocabulary for proactive content generation
 * - keep action modeling out of CoupleSpace page components
 *
 * Non-goal for now:
 * - no orchestration / scheduling / auto-trigger logic here yet
 */
export type CoupleSpaceInitiativeActionPayloadMap = {
  post_couple_daily: BuildCoupleDailyPostPromptOptions;
  write_love_letter: BuildCoupleLoveLetterPromptOptions;
  post_message_board_entry: {
    mode?: 'active' | 'passive';
    note?: string;
  };
  write_co_note: {
    mode?: 'active' | 'passive';
    note?: string;
  };
  create_ledger_entry: {
    mode?: 'active' | 'passive';
    note?: string;
  };
  reply_love_letter: {
    mode?: 'active' | 'passive';
    note?: string;
  };
  reply_daily_comment: {
    mode?: 'active' | 'passive';
    note?: string;
  };
  reply_message_board: {
    mode?: 'active' | 'passive';
    note?: string;
  };
  react_to_existing_post: {
    mode?: 'active' | 'passive';
    note?: string;
  };
};

export type CoupleSpaceInitiativeAction<
  T extends CoupleSpaceInitiativeActionType = CoupleSpaceInitiativeActionType,
> = {
  type: T;
  mode: 'active' | 'passive';
  triggerReason?: string;
  occasion?: string;
  payload: CoupleSpaceInitiativeActionPayloadMap[T];
};

export type CoupleSpaceInitiativeDraft = {
  action: CoupleSpaceInitiativeAction;
  previewText?: string;
};
