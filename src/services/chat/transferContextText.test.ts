import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage } from '../../types';
import {
  extractTransferAmountText,
  formatTransferMessageForContext,
  resolveTransferContextMessage,
} from './transferContextText';

function createTransferMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    role: overrides.role ?? 'user',
    text: overrides.text ?? '[转账 2000.00]',
    timestamp: overrides.timestamp ?? 100,
    ...overrides,
  };
}

test('extractTransferAmountText reads transfer amount from direct transfer cards', () => {
  assert.equal(extractTransferAmountText('[转账 520.00]'), '520.00');
  assert.equal(extractTransferAmountText('[transfer]88.50[/transfer]'), '88.50');
});

test('formatTransferMessageForContext keeps settled user-to-character transfers explicit', () => {
  const text = formatTransferMessageForContext(createTransferMessage({
    role: 'user',
    text: '[转账 2000.00]',
    contentType: 'transfer',
    transferStatus: 'received',
    transferId: 'transfer-1',
  }), {
    userLabel: '沐行舟',
    characterLabel: '贺言岑',
  });

  assert.equal(text, '沐行舟向贺言岑转了 2000.00 元，贺言岑已经收款。');
});

test('formatTransferMessageForContext keeps settled character-to-user receipts explicit', () => {
  const text = formatTransferMessageForContext(createTransferMessage({
    role: 'user',
    text: '[转账 2000.00]',
    contentType: 'transfer',
    transferStatus: 'received',
    transferDisplayLabel: '已收款',
    transferSettledAt: 300,
  }), {
    userLabel: '你',
    characterLabel: '贺言岑',
  });

  assert.equal(text, '你刚刚收下了贺言岑转来的 2000.00 元。');
});

test('resolveTransferContextMessage distinguishes original transfers from receipt cards', () => {
  const originalTransfer = resolveTransferContextMessage(createTransferMessage({
    role: 'model',
    text: '[转账 88.00]',
    transferStatus: 'rejected',
    transferId: 'transfer-2',
    transferSettledAt: 777,
  }));
  const receiptTransfer = resolveTransferContextMessage(createTransferMessage({
    role: 'user',
    text: '[转账 88.00]',
    transferStatus: 'rejected',
    transferDisplayLabel: '已退回',
    transferSettledAt: 778,
  }));

  assert.deepEqual(originalTransfer, {
    amountText: '88.00',
    status: 'rejected',
    direction: 'character_to_user',
    isReceipt: false,
    transferId: 'transfer-2',
    transferSettledAt: 777,
  });
  assert.deepEqual(receiptTransfer, {
    amountText: '88.00',
    status: 'rejected',
    direction: 'character_to_user',
    isReceipt: true,
    transferSettledAt: 778,
  });
});
