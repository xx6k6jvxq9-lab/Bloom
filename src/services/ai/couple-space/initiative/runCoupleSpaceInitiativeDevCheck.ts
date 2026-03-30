import type {
  AppSettings,
  ChatHistory,
  ChatMessage,
  CoupleSpaceData,
  CoupleSpaceInitiativeSource,
} from '../../../../types';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import {
  runCoupleSpaceInitiativeDevEntry,
  type CoupleSpaceInitiativeDevEntryResult,
} from './coupleSpaceInitiativeDevEntry';

export type RunCoupleSpaceInitiativeDevCheckInput = {
  appSettings: AppSettings;
  coupleSpace: CoupleSpaceData;
  chatHistory?: ChatHistory | null;
  userId: string;
  partnerId?: string | null;
  authorId?: string;
  triggerSource?: CoupleSpaceInitiativeSource;
  executionContext?: CoupleSpaceInitiativeExecutionContext;
  now?: number;
};

export type RunCoupleSpaceInitiativeDevCheckResult = CoupleSpaceInitiativeDevEntryResult & {
  resolvedPartnerId: string | null;
  resolvedAuthorId: string;
  resolvedChatMessageCount: number;
};

function resolvePartnerChatMessages(
  chatHistory: ChatHistory | null | undefined,
  partnerId: string | null,
): ChatMessage[] {
  if (!chatHistory || !partnerId) {
    return [];
  }

  return chatHistory[partnerId] ?? [];
}

/**
 * Thin dev-only adapter that turns current app state into one harness run.
 *
 * Purpose:
 * - keep Page/UI free from debugging glue
 * - let local callers feed existing app data into the couple-space initiative harness
 *
 * Non-goals:
 * - no scheduling
 * - no UI wiring
 * - no automatic prompt-input inference beyond basic state forwarding
 */
export async function runCoupleSpaceInitiativeDevCheck(
  input: RunCoupleSpaceInitiativeDevCheckInput,
): Promise<RunCoupleSpaceInitiativeDevCheckResult> {
  const resolvedPartnerId = input.partnerId ?? input.coupleSpace.partnerId ?? null;
  const resolvedAuthorId = input.authorId ?? resolvedPartnerId ?? 'partner';
  const chatMessages = resolvePartnerChatMessages(input.chatHistory, resolvedPartnerId);

  const result = await runCoupleSpaceInitiativeDevEntry({
    settings: input.coupleSpace.initiativeSettings,
    signalInput: {
      coupleSpace: input.coupleSpace,
      chatMessages,
      triggerSource: input.triggerSource,
      userId: input.userId,
      partnerId: resolvedPartnerId,
      now: input.now,
    },
    executionContext: {
      ...input.executionContext,
      settings: input.appSettings,
    },
    coupleSpace: input.coupleSpace,
    authorId: resolvedAuthorId,
    now: input.now,
  });

  return {
    ...result,
    resolvedPartnerId,
    resolvedAuthorId,
    resolvedChatMessageCount: chatMessages.length,
  };
}
