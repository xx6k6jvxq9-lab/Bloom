import {
  generateCoupleDailyComment,
  generateCoupleDailyCommentReply,
  generateCoupleLoveLetterReply,
  generateCoupleMessageBoardReply,
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
 * First concrete reply executor for interaction-style proactive actions.
 *
 * Scope:
 * - supports `reply_love_letter`, `reply_message_board`, `reply_daily_comment`, and `react_to_existing_post`
 * - generates text through prompt service
 * - returns an execution artifact without committing it
 */
export function createCoupleSpacePromptGenerationReplyExecutor(): CoupleSpaceInitiativeExecutor {
  return {
    async execute(
      request: CoupleSpaceInitiativeExecutionRequest | null,
      context?: CoupleSpaceInitiativeExecutionContext,
    ): Promise<CoupleSpaceInitiativeExecutorResult> {
      if (!request) {
        return buildRejectedResult(request, 'No execution request was provided.');
      }

      if (
        request.envelope.actionType !== 'reply_love_letter' &&
        request.envelope.actionType !== 'reply_message_board' &&
        request.envelope.actionType !== 'reply_daily_comment' &&
        request.envelope.actionType !== 'react_to_existing_post'
      ) {
        return {
          status: 'unsupported',
          actionType: request.envelope.actionType,
          reason:
            'This concrete reply executor currently supports only reply_love_letter, reply_message_board, reply_daily_comment, and react_to_existing_post.',
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
        request.envelope.actionType === 'reply_love_letter' &&
        !context?.promptInputs?.reply_love_letter
      ) {
        return buildRejectedResult(
          request,
          'Execution context is missing the reply_love_letter prompt input payload.',
        );
      }

      if (
        request.envelope.actionType === 'reply_message_board' &&
        !context?.promptInputs?.reply_message_board
      ) {
        return buildRejectedResult(
          request,
          'Execution context is missing the reply_message_board prompt input payload.',
        );
      }

      if (
        request.envelope.actionType === 'reply_daily_comment' &&
        !context?.promptInputs?.reply_daily_comment
      ) {
        return buildRejectedResult(
          request,
          'Execution context is missing the reply_daily_comment prompt input payload.',
        );
      }

      if (
        request.envelope.actionType === 'react_to_existing_post' &&
        !context?.promptInputs?.react_to_existing_post
      ) {
        return buildRejectedResult(
          request,
          'Execution context is missing the react_to_existing_post prompt input payload.',
        );
      }

      const content = (
        request.envelope.actionType === 'reply_love_letter'
          ? await generateCoupleLoveLetterReply(
              context.settings,
              context.promptInputs!.reply_love_letter!,
            )
          : request.envelope.actionType === 'reply_message_board'
          ? await generateCoupleMessageBoardReply(
              context.settings,
              context.promptInputs!.reply_message_board!,
            )
          : request.envelope.actionType === 'reply_daily_comment'
            ? await generateCoupleDailyCommentReply(
                context.settings,
                context.promptInputs!.reply_daily_comment!,
              )
          : await generateCoupleDailyComment(
              context.settings,
              context.promptInputs!.react_to_existing_post!,
            )
      ).trim();

      if (!content) {
        return buildRejectedResult(
          request,
          'Prompt generation returned empty content, so no reply artifact was produced.',
        );
      }

      return {
        status: 'accepted',
        actionType: request.envelope.actionType,
        reason:
          request.envelope.actionType === 'reply_love_letter'
            ? 'Generated a love-letter reply artifact without committing it.'
            : request.envelope.actionType === 'reply_message_board'
            ? 'Generated a message-board reply artifact without committing it.'
            : request.envelope.actionType === 'reply_daily_comment'
              ? 'Generated a daily-comment reply artifact without committing it.'
              : 'Generated a post-reaction artifact without committing it.',
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
