import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTransferSettlementEventLine,
  findTransferReplyContradiction,
  findTransferInitiationReplyContradiction,
  resolveTransferReplyTextForEvent,
  type TransferSettlementEvent,
} from './transferEventSemantics';

function createEvent(
  overrides: Partial<TransferSettlementEvent> = {},
): TransferSettlementEvent {
  return {
    direction: 'character_to_user',
    status: 'received',
    amount: 200000,
    userName: '你',
    characterName: 'Vera',
    ...overrides,
  };
}

test('buildTransferSettlementEventLine describes character to user received events explicitly', () => {
  assert.equal(
    buildTransferSettlementEventLine(createEvent()),
    '你刚刚收下了Vera转来的 200000.00 元。',
  );
});

test('findTransferReplyContradiction catches received-state refusal wording', () => {
  const contradiction = findTransferReplyContradiction(
    createEvent(),
    '你的钱自己留着，别再跟我转这么清楚。',
  );

  assert.equal(contradiction, 'received_fact_conflict');
});

test('findTransferReplyContradiction catches rejected-state acceptance wording', () => {
  const contradiction = findTransferReplyContradiction(
    createEvent({
      direction: 'user_to_character',
      status: 'rejected',
      amount: 520,
      characterName: '沐星河',
    }),
    '这笔我已经收下了，你别担心。',
  );

  assert.equal(contradiction, 'rejected_fact_conflict');
});

test('findTransferInitiationReplyContradiction catches outgoing transfer refusal wording', () => {
  const contradiction = findTransferInitiationReplyContradiction(
    'character_to_user',
    '钱你自己留着，别想从我这里拿。',
  );

  assert.equal(contradiction, 'character_to_user_initiation_conflict');
});

test('resolveTransferReplyTextForEvent keeps aligned replies untouched', () => {
  const replyText = resolveTransferReplyTextForEvent(
    createEvent(),
    '收着，别跟我客气。',
  );

  assert.equal(replyText, '收着，别跟我客气。');
});

test('resolveTransferReplyTextForEvent drops reply when it contradicts received fact', () => {
  const replyText = resolveTransferReplyTextForEvent(
    createEvent(),
    '你的钱自己留着，下午来公司把小饼干带好就行。',
  );

  assert.equal(replyText, '');
});

test('resolveTransferReplyTextForEvent drops reply when it contradicts rejected fact', () => {
  const replyText = resolveTransferReplyTextForEvent(
    createEvent({
      direction: 'user_to_character',
      status: 'rejected',
      amount: 88,
      characterName: '沐星河',
    }),
    '这笔我收了，你不用再解释。',
  );

  assert.equal(replyText, '');
});
