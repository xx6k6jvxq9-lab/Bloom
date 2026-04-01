import {
  generateCoupleCoNote,
  generateCoupleLoveLetter,
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
 * First concrete draft executor for proactive publishing paths that should not
 * commit directly into couple-space data.
 *
 * Scope:
 * - supports `write_love_letter` and `write_co_note`
 * - generates text through prompt service
 * - returns an execution artifact without committing it
 */
export function createCoupleSpacePromptGenerationDraftExecutor(): CoupleSpaceInitiativeExecutor {
  return {
    async execute(
      request: CoupleSpaceInitiativeExecutionRequest | null,
      context?: CoupleSpaceInitiativeExecutionContext,
    ): Promise<CoupleSpaceInitiativeExecutorResult> {
      if (!request) {
        return buildRejectedResult(request, 'No execution request was provided.');
      }

      if (
        request.envelope.actionType !== 'write_love_letter' &&
        request.envelope.actionType !== 'write_co_note'
      ) {
        return {
          status: 'unsupported',
          actionType: request.envelope.actionType,
          reason: 'This concrete draft executor currently supports only write_love_letter and write_co_note.',
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
        request.envelope.actionType === 'write_love_letter' &&
        !context?.promptInputs?.write_love_letter
      ) {
        return buildRejectedResult(
          request,
          'Execution context is missing the write_love_letter prompt input payload.',
        );
      }

      if (
        request.envelope.actionType === 'write_co_note' &&
        !context?.promptInputs?.write_co_note
      ) {
        return buildRejectedResult(
          request,
          'Execution context is missing the write_co_note prompt input payload.',
        );
      }

      const content = (
        request.envelope.actionType === 'write_love_letter'
          ? await generateCoupleLoveLetter(
              context.settings,
              context.promptInputs!.write_love_letter!,
            )
          : await generateCoupleCoNote(
              context.settings,
              context.promptInputs!.write_co_note!,
            )
      ).trim();

      if (!content) {
        return buildRejectedResult(
          request,
          'Prompt generation returned empty content, so no draft artifact was produced.',
        );
      }

      return {
        status: 'accepted',
        actionType: request.envelope.actionType,
        reason:
          request.envelope.actionType === 'write_love_letter'
            ? 'Generated a proactive love-letter draft artifact without committing it.'
            : 'Generated a proactive co-note draft artifact without committing it.',
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
