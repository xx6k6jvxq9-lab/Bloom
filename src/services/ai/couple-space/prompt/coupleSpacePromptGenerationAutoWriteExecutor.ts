import {
  generateCoupleDailyPost,
  generateCoupleMessageBoardEntry,
  type CoupleSpaceSettingsLike,
} from './coupleSpacePromptService';
import type {
  CoupleSpaceInitiativeExecutionContext,
  CoupleSpaceInitiativeExecutor,
  CoupleSpaceInitiativeExecutorResult,
} from '../execution/coupleSpaceInitiativeExecutor';
import type { CoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';

function hasUsableSettings(settings: CoupleSpaceSettingsLike | null | undefined): settings is CoupleSpaceSettingsLike {
  return Boolean(settings?.configs?.length);
}

function buildRejectedResult(
  request: CoupleSpaceInitiativeExecutionRequest | null,
  reason: string,
): CoupleSpaceInitiativeExecutorResult {
  return {
    status: 'rejected',
    actionType: request?.envelope.actionType ?? null,
    reason,
  };
}

/**
 * First concrete executor for the lowest-risk proactive publishing path.
 *
 * Scope:
 * - supports only `post_couple_daily`
 * - generates text through prompt service
 * - returns an execution artifact
 *
 * Non-goals:
 * - no couple-space data write
 * - no commit dispatch
 * - no UI hook-up
 */
export function createCoupleSpacePromptGenerationAutoWriteExecutor(): CoupleSpaceInitiativeExecutor {
  return {
    async execute(
      request: CoupleSpaceInitiativeExecutionRequest | null,
      context?: CoupleSpaceInitiativeExecutionContext,
    ): Promise<CoupleSpaceInitiativeExecutorResult> {
      if (!request) {
        return buildRejectedResult(request, 'No execution request was provided.');
      }

      if (
        request.envelope.actionType !== 'post_couple_daily' &&
        request.envelope.actionType !== 'post_message_board_entry'
      ) {
        return {
          status: 'unsupported',
          actionType: request.envelope.actionType,
          reason:
            'This concrete executor currently supports only post_couple_daily and post_message_board_entry.',
        };
      }

      if (!request.readyForExecutionBridge) {
        return buildRejectedResult(
          request,
          'Execution request is not bridge-ready yet; required inputs or preconditions are still unresolved.',
        );
      }

      if (!hasUsableSettings(context?.settings)) {
        return buildRejectedResult(
          request,
          'Execution context is missing usable couple-space settings with at least one API config.',
        );
      }

      if (
        request.envelope.actionType === 'post_couple_daily' &&
        !context?.promptInputs?.post_couple_daily
      ) {
        return buildRejectedResult(
          request,
          'Execution context is missing the post_couple_daily prompt input payload.',
        );
      }

      if (
        request.envelope.actionType === 'post_message_board_entry' &&
        !context?.promptInputs?.post_message_board_entry
      ) {
        return buildRejectedResult(
          request,
          'Execution context is missing the post_message_board_entry prompt input payload.',
        );
      }

      const content = (
        request.envelope.actionType === 'post_couple_daily'
          ? await generateCoupleDailyPost(
              context.settings,
              context.promptInputs!.post_couple_daily!,
            )
          : await generateCoupleMessageBoardEntry(
              context.settings,
              context.promptInputs!.post_message_board_entry!,
            )
      ).trim();

      if (!content) {
        return buildRejectedResult(
          request,
          'Prompt generation returned empty content, so no executable artifact was produced.',
        );
      }

      return {
        status: 'accepted',
        actionType: request.envelope.actionType,
        reason:
          request.envelope.actionType === 'post_couple_daily'
            ? 'Generated a proactive couple daily post artifact without committing it.'
            : 'Generated a proactive message-board entry artifact without committing it.',
        artifact: {
          kind: 'generated_text',
          actionType: request.envelope.actionType,
          commitMode: request.envelope.commitMode,
          targetName: request.envelope.targetName,
          content,
        },
      };
    },
  };
}
