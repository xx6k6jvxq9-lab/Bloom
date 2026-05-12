import assert from 'node:assert/strict';
import test from 'node:test';
import type { PersistedChatHistoryData } from '../../features/persistence/chatHistoryStore';
import { buildMemoryRecordDataFromChatHistory } from './buildMemoryRecordData';

function createPersistedChatHistoryData(): PersistedChatHistoryData {
  return {
    updatedAt: 999,
    directHistory: {},
    directSessionMetadata: {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  };
}

test('buildMemoryRecordDataFromChatHistory records settled transfer events into fact memory records', () => {
  const persistedChatHistory = createPersistedChatHistoryData();
  persistedChatHistory.directHistory['char-transfer-memory'] = [
    {
      role: 'user',
      text: '[转账 2000.00]',
      contentType: 'transfer',
      timestamp: 100,
      transferStatus: 'pending',
      transferId: 'transfer-pending',
    },
    {
      role: 'user',
      text: '[转账 520.00]',
      contentType: 'transfer',
      timestamp: 200,
      transferStatus: 'received',
      transferId: 'transfer-received',
      transferSettledAt: 450,
    },
    {
      role: 'model',
      text: '[转账 88.00]',
      contentType: 'transfer',
      timestamp: 300,
      transferStatus: 'rejected',
      transferId: 'transfer-rejected',
      transferSettledAt: 470,
    },
  ];

  const memoryRecordData = buildMemoryRecordDataFromChatHistory(persistedChatHistory);
  const records = memoryRecordData.recordsByCharacterId['char-transfer-memory'] || [];

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => ({
      kind: record.kind,
      timestamp: record.timestamp,
      summary: record.summary,
    })),
    [
      {
        kind: 'fact',
        timestamp: 470,
        summary: '对方向你转了 88.00 元，你已经退回。',
      },
      {
        kind: 'fact',
        timestamp: 450,
        summary: '你向对方转了 520.00 元，对方已经收款。',
      },
    ],
  );
});
