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

test('buildMemoryRecordDataFromChatHistory attaches retrieval hints and scene tags to derived records', () => {
  const persistedChatHistory = createPersistedChatHistoryData();
  persistedChatHistory.directFactTraces['char-hints'] = [
    {
      sourceScene: 'direct_chat',
      factType: 'plan',
      subjectType: 'character',
      subjectId: 'char-hints',
      relatedCharacterIds: ['char-hints'],
      visibility: 'cross_scene_readable',
      stability: 'temporary',
      confidence: 'explicit',
      summary: 'next time, grab cocoa on the rooftop together',
      timestamp: 100,
      decayHint: 'medium',
    },
  ];
  persistedChatHistory.directRelationshipWaves['char-hints'] = [
    {
      sourceScene: 'dating',
      relationType: 'character_user',
      sourceCharacterId: 'char-hints',
      targetUser: true,
      eventKind: 'bonding',
      valence: 'positive',
      intensity: 'medium',
      scope: 'cross_scene_readable',
      summary: 'the date atmosphere moved into a warmer beat',
      timestamp: 120,
      decayHint: 'medium',
    },
  ];

  const memoryRecordData = buildMemoryRecordDataFromChatHistory(persistedChatHistory);
  const records = memoryRecordData.recordsByCharacterId['char-hints'] || [];
  const planRecord = records.find((record) => record.kind === 'fact' && record.factType === 'plan');
  const waveRecord = records.find((record) => record.kind === 'relationship_wave');

  assert.equal(planRecord?.sceneTags?.includes('direct chat'), true);
  assert.equal(planRecord?.retrievalHints?.includes('plan'), true);
  assert.equal(waveRecord?.sceneTags?.includes('dating'), true);
  assert.equal(waveRecord?.retrievalHints?.includes('bonding'), true);
});
