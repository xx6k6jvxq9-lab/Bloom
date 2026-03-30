import type {
  CoupleSpaceCommitMode,
  CoupleSpaceInitiativeCandidate,
  CoupleSpaceInitiativeGroup,
  CoupleSpaceInitiativeSource,
} from '../../../../types';

export type CoupleSpaceInitiativeExecutionTarget = {
  layer: 'prompt_service' | 'record_handler';
  name: string;
  summary: string;
};

export type CoupleSpaceInitiativeExecutionPayloadField = {
  key: string;
  required: boolean;
  source: 'candidate' | 'signal_context' | 'execution_context';
  description: string;
};

export type CoupleSpaceInitiativeExecutionPayloadShape = {
  kind: 'generated_text' | 'interaction_reply' | 'structured_record';
  requiredFields: CoupleSpaceInitiativeExecutionPayloadField[];
};

export type CoupleSpaceInitiativeExecutionPrecondition = {
  code:
    | 'requires-active-config'
    | 'requires-partner-id'
    | 'requires-signal-context'
    | 'requires-letter-id'
    | 'requires-post-id'
    | 'requires-comment-id'
    | 'requires-entry-id'
    | 'requires-light-evidence-summary'
    | 'requires-explicit-evidence-summary';
  description: string;
};

export type CoupleSpaceInitiativeExecutionPlan = {
  actionType: CoupleSpaceInitiativeCandidate['actionType'];
  group: CoupleSpaceInitiativeGroup;
  commitMode: CoupleSpaceCommitMode;
  source: CoupleSpaceInitiativeSource;
  target: CoupleSpaceInitiativeExecutionTarget;
  payloadShape: CoupleSpaceInitiativeExecutionPayloadShape;
  preconditions: CoupleSpaceInitiativeExecutionPrecondition[];
  summary: string;
};

function createPlan(
  candidate: CoupleSpaceInitiativeCandidate,
  target: CoupleSpaceInitiativeExecutionTarget,
  payloadShape: CoupleSpaceInitiativeExecutionPayloadShape,
  preconditions: CoupleSpaceInitiativeExecutionPrecondition[],
  summary: string,
): CoupleSpaceInitiativeExecutionPlan {
  return {
    actionType: candidate.actionType,
    group: candidate.group,
    commitMode: candidate.commitMode,
    source: candidate.source,
    target,
    payloadShape,
    preconditions,
    summary,
  };
}

export function buildCoupleSpaceInitiativeExecutionPlan(
  candidate: CoupleSpaceInitiativeCandidate | null,
): CoupleSpaceInitiativeExecutionPlan | null {
  if (!candidate) {
    return null;
  }

  switch (candidate.actionType) {
    case 'post_couple_daily':
      return createPlan(
        candidate,
        {
          layer: 'prompt_service',
          name: 'generateCoupleDailyPost',
          summary: 'Generate one relationship-internal daily post for couple space.',
        },
        {
          kind: 'generated_text',
          requiredFields: [
            {
              key: 'settings',
              required: true,
              source: 'execution_context',
              description: 'Active API config and runtime settings for prompt generation.',
            },
            {
              key: 'characterContext',
              required: true,
              source: 'execution_context',
              description: 'Resolved couple-space character/user context used to build prompt input.',
            },
            {
              key: 'recentInteractionSummary',
              required: false,
              source: 'signal_context',
              description: 'Optional recent interaction summary to ground the generated post.',
            },
          ],
        },
        [
          {
            code: 'requires-active-config',
            description: 'A usable AI config must exist before post generation can run.',
          },
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before generating a partner-authored post.',
          },
        ],
        'Prepare a publishing request for one proactive couple daily post.',
      );

    case 'write_love_letter':
      return createPlan(
        candidate,
        {
          layer: 'prompt_service',
          name: 'generateCoupleLoveLetter',
          summary: 'Generate one proactive love letter draft or final content.',
        },
        {
          kind: 'generated_text',
          requiredFields: [
            {
              key: 'settings',
              required: true,
              source: 'execution_context',
              description: 'Active API config and runtime settings for prompt generation.',
            },
            {
              key: 'characterContext',
              required: true,
              source: 'execution_context',
              description: 'Resolved couple-space character/user context used to build prompt input.',
            },
            {
              key: 'recentInteractionSummary',
              required: false,
              source: 'signal_context',
              description: 'Optional recent interaction or relationship shift summary.',
            },
          ],
        },
        [
          {
            code: 'requires-active-config',
            description: 'A usable AI config must exist before love-letter generation can run.',
          },
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before generating a partner-authored letter.',
          },
        ],
        'Prepare a publishing request for one proactive love letter, typically routed to draft first.',
      );

    case 'post_message_board_entry':
      return createPlan(
        candidate,
        {
          layer: 'prompt_service',
          name: 'generateCoupleMessageBoardEntry',
          summary: 'Generate one proactive message-board entry for couple space.',
        },
        {
          kind: 'generated_text',
          requiredFields: [
            {
              key: 'settings',
              required: true,
              source: 'execution_context',
              description: 'Active API config and runtime settings for prompt generation.',
            },
            {
              key: 'characterContext',
              required: true,
              source: 'execution_context',
              description: 'Resolved couple-space character/user context used to build prompt input.',
            },
            {
              key: 'recentInteractionSummary',
              required: false,
              source: 'signal_context',
              description: 'Optional recent interaction summary for message-board grounding.',
            },
          ],
        },
        [
          {
            code: 'requires-active-config',
            description: 'A usable AI config must exist before message-board generation can run.',
          },
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before generating a partner-authored message.',
          },
        ],
        'Prepare a publishing request for one proactive message-board entry.',
      );

    case 'write_co_note':
      return createPlan(
        candidate,
        {
          layer: 'prompt_service',
          name: 'generateCoupleCoNote',
          summary: 'Generate one memo-style co-note draft or final content.',
        },
        {
          kind: 'generated_text',
          requiredFields: [
            {
              key: 'settings',
              required: true,
              source: 'execution_context',
              description: 'Active API config and runtime settings for prompt generation.',
            },
            {
              key: 'characterContext',
              required: true,
              source: 'execution_context',
              description: 'Resolved couple-space character/user context used to build prompt input.',
            },
            {
              key: 'memoLightEvidenceSummary',
              required: true,
              source: 'signal_context',
              description: 'Light evidence summary that explains why a co-note is appropriate now.',
            },
          ],
        },
        [
          {
            code: 'requires-active-config',
            description: 'A usable AI config must exist before co-note generation can run.',
          },
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before generating a partner-authored memo.',
          },
          {
            code: 'requires-light-evidence-summary',
            description: 'Co-note generation needs memo-level evidence before it should proceed.',
          },
        ],
        'Prepare a memo-generation request for one co-note, usually routed through draft mode first.',
      );

    case 'create_ledger_entry':
      return createPlan(
        candidate,
        {
          layer: 'record_handler',
          name: 'prepareCoupleLedgerEntryDraft',
          summary: 'Prepare a structured ledger-entry draft from explicit evidence.',
        },
        {
          kind: 'structured_record',
          requiredFields: [
            {
              key: 'recordingExplicitEvidenceSummary',
              required: true,
              source: 'signal_context',
              description: 'Explicit evidence summary that can support a factual ledger proposal.',
            },
            {
              key: 'payerId',
              required: true,
              source: 'execution_context',
              description: 'Resolved actor identity for any future ledger record.',
            },
          ],
        },
        [
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before proposing a ledger entry.',
          },
          {
            code: 'requires-explicit-evidence-summary',
            description: 'Ledger entries require explicit evidence before any draft/confirm path is allowed.',
          },
        ],
        'Prepare a high-risk recording draft for ledger confirmation; this path should remain confirm-only.',
      );

    case 'reply_love_letter':
      return createPlan(
        candidate,
        {
          layer: 'prompt_service',
          name: 'generateCoupleLoveLetterReply',
          summary: 'Generate one reply to an existing love letter.',
        },
        {
          kind: 'interaction_reply',
          requiredFields: [
            {
              key: 'settings',
              required: true,
              source: 'execution_context',
              description: 'Active API config and runtime settings for prompt generation.',
            },
            {
              key: 'characterContext',
              required: true,
              source: 'execution_context',
              description: 'Resolved couple-space character/user context used to build prompt input.',
            },
            {
              key: 'letterId',
              required: true,
              source: 'signal_context',
              description: 'Target love-letter identifier to reply to.',
            },
          ],
        },
        [
          {
            code: 'requires-active-config',
            description: 'A usable AI config must exist before love-letter reply generation can run.',
          },
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before generating a reply.',
          },
          {
            code: 'requires-letter-id',
            description: 'Reply execution requires a concrete target love-letter id.',
          },
        ],
        'Prepare an interaction reply against one specific love letter.',
      );

    case 'reply_daily_comment':
      return createPlan(
        candidate,
        {
          layer: 'prompt_service',
          name: 'generateCoupleDailyCommentReply',
          summary: 'Generate one reply to an existing comment under a couple daily post.',
        },
        {
          kind: 'interaction_reply',
          requiredFields: [
            {
              key: 'settings',
              required: true,
              source: 'execution_context',
              description: 'Active API config and runtime settings for prompt generation.',
            },
            {
              key: 'characterContext',
              required: true,
              source: 'execution_context',
              description: 'Resolved couple-space character/user context used to build prompt input.',
            },
            {
              key: 'postId',
              required: true,
              source: 'signal_context',
              description: 'Target post identifier for the comment thread.',
            },
            {
              key: 'commentId',
              required: true,
              source: 'signal_context',
              description: 'Target comment identifier to reply to.',
            },
          ],
        },
        [
          {
            code: 'requires-active-config',
            description: 'A usable AI config must exist before daily-comment reply generation can run.',
          },
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before generating a reply.',
          },
          {
            code: 'requires-post-id',
            description: 'Reply execution requires a concrete post id.',
          },
          {
            code: 'requires-comment-id',
            description: 'Reply execution requires a concrete comment id.',
          },
        ],
        'Prepare an interaction reply against one specific comment under a daily post.',
      );

    case 'reply_message_board':
      return createPlan(
        candidate,
        {
          layer: 'prompt_service',
          name: 'generateCoupleMessageBoardReply',
          summary: 'Generate one reply to an existing message-board entry.',
        },
        {
          kind: 'interaction_reply',
          requiredFields: [
            {
              key: 'settings',
              required: true,
              source: 'execution_context',
              description: 'Active API config and runtime settings for prompt generation.',
            },
            {
              key: 'characterContext',
              required: true,
              source: 'execution_context',
              description: 'Resolved couple-space character/user context used to build prompt input.',
            },
            {
              key: 'entryId',
              required: true,
              source: 'signal_context',
              description: 'Target message-board entry identifier to reply to.',
            },
          ],
        },
        [
          {
            code: 'requires-active-config',
            description: 'A usable AI config must exist before message-board reply generation can run.',
          },
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before generating a reply.',
          },
          {
            code: 'requires-entry-id',
            description: 'Reply execution requires a concrete message-board entry id.',
          },
        ],
        'Prepare an interaction reply against one specific message-board entry.',
      );

    case 'react_to_existing_post':
      return createPlan(
        candidate,
        {
          layer: 'prompt_service',
          name: 'generateCoupleDailyComment',
          summary: 'Generate one reaction/comment to an existing couple post.',
        },
        {
          kind: 'interaction_reply',
          requiredFields: [
            {
              key: 'settings',
              required: true,
              source: 'execution_context',
              description: 'Active API config and runtime settings for prompt generation.',
            },
            {
              key: 'characterContext',
              required: true,
              source: 'execution_context',
              description: 'Resolved couple-space character/user context used to build prompt input.',
            },
            {
              key: 'postId',
              required: true,
              source: 'signal_context',
              description: 'Target post identifier to react to.',
            },
          ],
        },
        [
          {
            code: 'requires-active-config',
            description: 'A usable AI config must exist before post-reaction generation can run.',
          },
          {
            code: 'requires-partner-id',
            description: 'A bound couple-space partner must exist before generating a reaction.',
          },
          {
            code: 'requires-post-id',
            description: 'Reaction execution requires a concrete target post id.',
          },
        ],
        'Prepare an interaction reaction against one specific existing post.',
      );

    default:
      return null;
  }
}
