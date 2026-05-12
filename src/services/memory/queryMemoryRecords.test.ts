import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryRecordData, saveMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { buildMemoryPromptView, buildMemoryRetrievalPromptFromView } from './buildMemoryRetrievalPrompt';
import { queryMemoryRecords } from './queryMemoryRecords';

async function clearQueryState() {
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  await clearQueryState();
});

test('queryMemoryRecords filters by metadata and keyword relevance', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-query': [
        {
          id: 'fact-cocoa',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: ['direct:char-query:1'],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'stable',
          decayHint: 'stable',
          summary: '喜欢热可可，也会在意你怕冷',
          timestamp: now - 1000,
          factType: 'preference',
          subjectType: 'character',
          subjectId: 'char-query',
          confidence: 'explicit',
          relatedCharacterIds: ['char-query'],
        },
        {
          id: 'plan-movie',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: ['direct:char-query:2'],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'short',
          summary: '周末一起去看电影',
          timestamp: now - 500,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'char-query',
          confidence: 'explicit',
          relatedCharacterIds: ['char-query'],
        },
        {
          id: 'note-cold-night',
          kind: 'note',
          sourceScene: 'manual',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'stable',
          decayHint: 'stable',
          summary: '你怕冷，夜里聊天时会下意识照顾你。',
          timestamp: now - 900,
          noteType: 'imported',
          libraryKind: 'long-term',
          librarySource: 'manual',
          text: '你怕冷，夜里聊天时会下意识照顾你。',
        },
      ],
    },
  });

  const results = queryMemoryRecords({
    characterId: 'char-query',
    kinds: ['fact'],
    textQuery: '热可可',
    limit: 5,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0]?.record.id, 'fact-cocoa');
  assert.equal(results[0]?.matchedTerms.includes('热可可'), true);
});

test('buildMemoryPromptView groups stable preferences and open tasks separately', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-query': [
        {
          id: 'fact-cocoa',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: ['direct:char-query:1'],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'stable',
          decayHint: 'stable',
          summary: '喜欢热可可，也会在意你怕冷',
          timestamp: now - 1000,
          factType: 'preference',
          subjectType: 'character',
          subjectId: 'char-query',
          confidence: 'explicit',
          relatedCharacterIds: ['char-query'],
        },
        {
          id: 'plan-movie',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: ['direct:char-query:2'],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'short',
          summary: '周末一起去看电影',
          timestamp: now - 500,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'char-query',
          confidence: 'explicit',
          relatedCharacterIds: ['char-query'],
        },
        {
          id: 'note-cold-night',
          kind: 'note',
          sourceScene: 'manual',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'stable',
          decayHint: 'stable',
          summary: '你怕冷，夜里聊天时会下意识照顾你。',
          timestamp: now - 900,
          noteType: 'imported',
          libraryKind: 'long-term',
          librarySource: 'manual',
          text: '你怕冷，夜里聊天时会下意识照顾你。',
        },
      ],
    },
  });

  const view = buildMemoryPromptView({
    characterId: 'char-query',
    latestUserText: '你还记得热可可吗',
  });
  const prompt = buildMemoryRetrievalPromptFromView(view);

  assert.equal(view.stablePreferences[0]?.record.id, 'fact-cocoa');
  assert.equal(
    view.stablePreferences.some((result) => result.record.id === 'note-cold-night'),
    true,
  );
  assert.equal(view.openTasks[0]?.record.id, 'plan-movie');
  assert.match(prompt, /Retrieved Related Facts/);
  assert.match(prompt, /Stable Preferences And Background/);
  assert.match(prompt, /Retrieved Open Tasks/);
});
