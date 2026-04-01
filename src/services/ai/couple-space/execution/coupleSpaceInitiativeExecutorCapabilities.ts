import type { CoupleSpaceInitiativeExecutionRequest } from './coupleSpaceInitiativeExecutionRequest';

export type CoupleSpaceInitiativeExecutorCapabilityKey =
  | 'prompt_generation_auto_write'
  | 'prompt_generation_draft'
  | 'prompt_generation_reply'
  | 'recording_confirmation'
  | 'unsupported';

export type CoupleSpaceInitiativeExecutorCapability = {
  actionType: CoupleSpaceInitiativeExecutionRequest['envelope']['actionType'];
  capabilityKey: CoupleSpaceInitiativeExecutorCapabilityKey;
  executorName: string;
  summary: string;
  supportsExecution: boolean;
};

export function getCoupleSpaceInitiativeExecutorCapability(
  request: CoupleSpaceInitiativeExecutionRequest | null,
): CoupleSpaceInitiativeExecutorCapability | null {
  if (!request) {
    return null;
  }

  switch (request.envelope.actionType) {
    case 'post_couple_daily':
    case 'post_message_board_entry':
      return {
        actionType: request.envelope.actionType,
        capabilityKey: 'prompt_generation_auto_write',
        executorName: 'PromptGenerationAutoWriteExecutor',
        summary:
          'Future execution should generate content through prompt service and then route it into a direct-write style sink.',
        supportsExecution: true,
      };

    case 'write_love_letter':
    case 'write_co_note':
      return {
        actionType: request.envelope.actionType,
        capabilityKey: 'prompt_generation_draft',
        executorName: 'PromptGenerationDraftExecutor',
        summary:
          'Future execution should generate content through prompt service and keep the result in a draft-oriented sink first.',
        supportsExecution: true,
      };

    case 'reply_love_letter':
    case 'reply_daily_comment':
    case 'reply_message_board':
    case 'react_to_existing_post':
      return {
        actionType: request.envelope.actionType,
        capabilityKey: 'prompt_generation_reply',
        executorName: 'PromptGenerationReplyExecutor',
        summary:
          'Future execution should generate a context-bound reply/reaction through prompt service, then route it to the interaction sink.',
        supportsExecution: true,
      };

    case 'create_ledger_entry':
      return {
        actionType: request.envelope.actionType,
        capabilityKey: 'recording_confirmation',
        executorName: 'RecordingConfirmationExecutor',
        summary:
          'Future execution should stay on a confirmation-first recording path and must not auto-write structured ledger data.',
        supportsExecution: true,
      };

    default:
      return {
        actionType: request.envelope.actionType,
        capabilityKey: 'unsupported',
        executorName: 'UnsupportedCoupleSpaceExecutor',
        summary: 'No concrete executor capability has been assigned for this action yet.',
        supportsExecution: false,
      };
  }
}
