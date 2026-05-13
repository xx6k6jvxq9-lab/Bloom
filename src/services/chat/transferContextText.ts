import type { ChatMessage } from '../../types';

const TRANSFER_BRACKET_REGEX = /\[转账\s*([\d.]+)\]/i;
const TRANSFER_BLOCK_REGEX = /\[transfer\]\s*([\d.]+)\s*\[\/transfer\]/i;
const TRANSFER_PIPE_REGEX = /^TRANSFER\|([\d.]+)\|([\s\S]*)$/i;

export type TransferContextDirection = 'user_to_character' | 'character_to_user';
export type TransferContextStatus = NonNullable<ChatMessage['transferStatus']>;

export type ResolvedTransferContextMessage = {
  amountText: string;
  status: TransferContextStatus;
  direction: TransferContextDirection;
  isReceipt: boolean;
  transferId?: string;
  transferSettledAt?: number;
};

export function extractTransferAmountText(text: string | null | undefined): string | null {
  const normalizedText = text?.trim() || '';
  if (!normalizedText) {
    return null;
  }

  const bracketMatch = normalizedText.match(TRANSFER_BRACKET_REGEX);
  if (bracketMatch?.[1]) {
    return bracketMatch[1];
  }

  const blockMatch = normalizedText.match(TRANSFER_BLOCK_REGEX);
  if (blockMatch?.[1]) {
    return blockMatch[1];
  }

  const pipeMatch = normalizedText.match(TRANSFER_PIPE_REGEX);
  return pipeMatch?.[1] ?? null;
}

export function isTransferLikeMessage(
  message: Pick<ChatMessage, 'text' | 'contentType' | 'transferStatus'>,
): boolean {
  return message.contentType === 'transfer'
    || !!message.transferStatus
    || extractTransferAmountText(message.text) != null;
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function resolveTransferDirection(
  message: Pick<ChatMessage, 'role' | 'transferId'>,
  status: TransferContextStatus,
): {
  direction: TransferContextDirection;
  isReceipt: boolean;
} {
  if (message.transferId) {
    return {
      direction: message.role === 'user' ? 'user_to_character' : 'character_to_user',
      isReceipt: false,
    };
  }

  if (status === 'pending') {
    return {
      direction: message.role === 'user' ? 'user_to_character' : 'character_to_user',
      isReceipt: false,
    };
  }

  return {
    direction: message.role === 'user' ? 'character_to_user' : 'user_to_character',
    isReceipt: true,
  };
}

export function resolveTransferContextMessage(
  message: Pick<
    ChatMessage,
    'role' | 'text' | 'contentType' | 'transferStatus' | 'transferId' | 'transferSettledAt'
  >,
): ResolvedTransferContextMessage | null {
  if (!isTransferLikeMessage(message)) {
    return null;
  }

  const amountText = extractTransferAmountText(message.text);
  if (!amountText) {
    return null;
  }

  const status = message.transferStatus ?? 'pending';
  const { direction, isReceipt } = resolveTransferDirection(message, status);

  return {
    amountText,
    status,
    direction,
    isReceipt,
    ...(message.transferId ? { transferId: message.transferId } : {}),
    ...(typeof message.transferSettledAt === 'number' ? { transferSettledAt: message.transferSettledAt } : {}),
  };
}

export function formatTransferMessageForContext(
  message: Pick<
    ChatMessage,
    'role' | 'text' | 'contentType' | 'transferStatus' | 'transferId' | 'transferSettledAt'
  >,
  options: {
    userLabel?: string;
    characterLabel?: string;
  } = {},
): string | null {
  const transferContext = resolveTransferContextMessage(message);
  if (!transferContext) {
    return null;
  }

  const userLabel = normalizeLabel(options.userLabel, '你');
  const characterLabel = normalizeLabel(options.characterLabel, '对方');
  const amountLabel = `${transferContext.amountText} 元`;

  if (transferContext.direction === 'user_to_character') {
    if (transferContext.status === 'pending') {
      return `${userLabel}向${characterLabel}转了 ${amountLabel}，等待${characterLabel}收款。`;
    }

    if (transferContext.status === 'received') {
      return transferContext.isReceipt
        ? `${characterLabel}刚刚收下了${userLabel}转去的 ${amountLabel}。`
        : `${userLabel}向${characterLabel}转了 ${amountLabel}，${characterLabel}已经收款。`;
    }

    return transferContext.isReceipt
      ? `${characterLabel}刚刚退回了${userLabel}转去的 ${amountLabel}。`
      : `${userLabel}向${characterLabel}转了 ${amountLabel}，${characterLabel}已经退回。`;
  }

  if (transferContext.status === 'pending') {
    return `${characterLabel}向${userLabel}转了 ${amountLabel}，等待${userLabel}收款。`;
  }

  if (transferContext.status === 'received') {
    return transferContext.isReceipt
      ? `${userLabel}刚刚收下了${characterLabel}转来的 ${amountLabel}。`
      : `${characterLabel}向${userLabel}转了 ${amountLabel}，${userLabel}已经收款。`;
  }

  return transferContext.isReceipt
    ? `${userLabel}刚刚退回了${characterLabel}转来的 ${amountLabel}。`
    : `${characterLabel}向${userLabel}转了 ${amountLabel}，${userLabel}已经退回。`;
}
