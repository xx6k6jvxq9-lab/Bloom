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

test('buildMemoryPromptView exposes retrieved scene progress separately', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-query': [
        {
          id: 'scene-progress-cocoa',
          kind: 'scene_progress',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'current scene progress: talking closely about cocoa',
          timestamp: now - 400,
          stageLabel: '试探靠近阶段',
          currentBeat: 'the conversation stayed close around the cocoa kiosk',
          currentSignature: '靠近 / 对视',
          previousSignature: '靠近',
          repeatedSignature: false,
          completedActions: ['靠近', '对视'],
          bannedRepeatActions: ['靠近'],
          unresolvedTension: 'still waiting for the next move',
          nextStepOptions: ['turn the close distance into a direct reply'],
        },
      ],
    },
  });

  const view = buildMemoryPromptView({
    characterId: 'char-query',
    latestUserText: 'cocoa',
  });
  const prompt = buildMemoryRetrievalPromptFromView(view);

  assert.equal(view.sceneProgress[0]?.record.id, 'scene-progress-cocoa');
  assert.match(prompt, /Retrieved Scene Progress/);
  assert.match(prompt, /current scene progress: talking closely about cocoa/);
});

test('queryMemoryRecords can match scene progress through beat and signature text, not only summary', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-query': [
        {
          id: 'scene-progress-rooftop',
          kind: 'scene_progress',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'date moved to the next beat',
          timestamp: now - 100,
          stageLabel: 'close distance stage',
          currentBeat: 'they stayed near the rooftop cocoa stand',
          currentSignature: 'rooftop / cocoa / close distance',
          previousSignature: 'rooftop',
          repeatedSignature: false,
          completedActions: ['close distance'],
          bannedRepeatActions: ['repeat the same pause'],
          unresolvedTension: 'someone still needs to say the next line',
          nextStepOptions: ['turn the rooftop pause into a direct answer'],
        },
      ],
    },
  });

  const results = queryMemoryRecords({
    characterId: 'char-query',
    kinds: ['scene_progress'],
    textQuery: 'rooftop cocoa',
    limit: 3,
  });

  assert.equal(results[0]?.record.id, 'scene-progress-rooftop');
  assert.equal(results[0]?.matchedTerms.includes('rooftop'), true);
});

test('queryMemoryRecords respects preferred source scene weighting when records are otherwise similar', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-query': [
        {
          id: 'fact-forum',
          kind: 'fact',
          sourceScene: 'forum',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'revisit the rooftop cafe soon',
          timestamp: now - 200,
          factType: 'experience',
          subjectType: 'character',
          subjectId: 'char-query',
          confidence: 'explicit',
          relatedCharacterIds: ['char-query'],
        },
        {
          id: 'fact-dating',
          kind: 'fact',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'revisit the rooftop cafe soon',
          timestamp: now - 200,
          factType: 'experience',
          subjectType: 'character',
          subjectId: 'char-query',
          confidence: 'explicit',
          relatedCharacterIds: ['char-query'],
        },
      ],
    },
  });

  const results = queryMemoryRecords({
    characterId: 'char-query',
    kinds: ['fact'],
    textQuery: 'rooftop cafe',
    preferredSourceScenes: ['dating', 'forum'],
    limit: 3,
  });

  assert.equal(results[0]?.record.id, 'fact-dating');
});

test('buildMemoryPromptView can combine extra queries and strong fallback recall', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-query': [
        {
          id: 'fact-rooftop',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'remember the rooftop cafe promise',
          timestamp: now - 300,
          factType: 'experience',
          subjectType: 'character',
          subjectId: 'char-query',
          confidence: 'explicit',
          relatedCharacterIds: ['char-query'],
        },
        {
          id: 'plan-rooftop',
          kind: 'fact',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'medium',
          summary: 'buy cocoa beans together next week',
          timestamp: now - 250,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'char-query',
          confidence: 'explicit',
          relatedCharacterIds: ['char-query'],
        },
        {
          id: 'wave-rooftop',
          kind: 'relationship_wave',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'the mood softened after the rooftop pause',
          timestamp: now - 240,
          relationType: 'character_user',
          eventKind: 'bonding',
          valence: 'positive',
          intensity: 'medium',
          sourceCharacterId: 'char-query',
          targetUser: true,
        },
        {
          id: 'scene-progress-rooftop-fallback',
          kind: 'scene_progress',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-query',
          sourceEventIds: [],
          characterIds: ['char-query'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'date progressed to a closer rooftop pause',
          timestamp: now - 200,
          stageLabel: 'close distance stage',
          currentBeat: 'they stayed near the cocoa stand',
          currentSignature: 'rooftop / pause',
          previousSignature: 'rooftop',
          repeatedSignature: false,
          completedActions: ['pause together'],
          bannedRepeatActions: ['restart the same introduction'],
          unresolvedTension: 'they still owe each other a direct answer',
          nextStepOptions: ['answer the rooftop question directly'],
        },
      ],
    },
  });

  const view = buildMemoryPromptView({
    characterId: 'char-query',
    latestUserText: 'then what',
    retrievalQueries: [{
      text: 'rooftop cafe',
      weight: 1,
    }],
    preferredSourceScenes: ['dating', 'direct_chat'],
    forceLatestRelationshipWaves: true,
    forceLatestSceneProgress: true,
    forceLatestOpenTasks: true,
  });

  assert.equal(view.matchedFacts.some((result) => result.record.id === 'fact-rooftop'), true);
  assert.equal(view.openTasks.some((result) => result.record.id === 'plan-rooftop'), true);
  assert.equal(view.relationshipWaves.some((result) => result.record.id === 'wave-rooftop'), true);
  assert.equal(view.sceneProgress.some((result) => result.record.id === 'scene-progress-rooftop-fallback'), true);
});
