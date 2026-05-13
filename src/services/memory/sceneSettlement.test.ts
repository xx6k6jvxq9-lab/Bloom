import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { loadMemoryRecordData, resetMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { getLatestMemoryDiagnostic, resetMemoryDiagnostics } from './memoryDiagnostics';
import {
  buildSceneSettlementCharacterPatch,
  buildSceneSettlementResult,
  persistSceneSettlementBatch,
  persistSceneSettlement,
} from './sceneSettlement';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'char-settlement-helper',
    name: overrides.name ?? '测试角色',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? '',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  resetMemoryDiagnostics();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('buildSceneSettlementResult builds snapshots, summaries, open loops and shared state from unified inputs', () => {
  const character = createCharacter({
    shortTermSummary: '旧的短期摘要',
  });

  const result = buildSceneSettlementResult({
    character,
    sourceScene: 'dating',
    timestamp: 1_700_000_000_555,
    items: {
      relationshipResidue: [{
        type: 'relationship_residue',
        summary: '刚结束的约会留下了一点关系余波',
        sourceScene: 'dating',
        timestamp: 1_700_000_000_555,
        decay: 'medium',
        visibility: 'cross_scene_readable',
      }],
      sceneResidue: [{
        type: 'scene_residue',
        summary: '这场约会推进到的阶段：试探靠近阶段',
        sourceScene: 'dating',
        timestamp: 1_700_000_000_555,
        decay: 'medium',
        visibility: 'cross_scene_readable',
      }],
      topicAnchors: [{
        type: 'topic_anchor',
        summary: '这场约会里刚碰过的话题：下次见面',
        sourceScene: 'dating',
        timestamp: 1_700_000_000_555,
        decay: 'short',
        visibility: 'cross_scene_readable',
      }],
      taskResidue: [{
        type: 'task_residue',
        summary: '这场约会里还可能算数的约定：下周一起吃饭',
        sourceScene: 'dating',
        timestamp: 1_700_000_000_555,
        decay: 'medium',
        visibility: 'cross_scene_readable',
      }],
    },
    openLoop: {
      idPrefix: 'dating',
      taskResumeHint: '任务恢复提示',
      topicResumeHint: '话题恢复提示',
      limit: 8,
    },
    sharedState: {
      publicSummaries: ['刚结束的约会留下了一点关系余波'],
      privateSummaries: ['这场约会推进到的阶段：试探靠近阶段'],
    },
  });

  assert.equal(result.sharedContextSnapshots.length, 1);
  assert.match(result.shortTermSummary || '', /这场约会推进到的阶段/);
  assert.equal(result.openLoopRegistry?.length, 2);
  assert.match(result.sharedState?.privateCarryover || '', /试探靠近阶段/);
  assert.deepEqual(buildSceneSettlementCharacterPatch(result), {
    sharedContextSnapshots: result.sharedContextSnapshots,
    shortTermSummary: result.shortTermSummary,
    openLoopRegistry: result.openLoopRegistry,
    sharedState: result.sharedState,
  });
});

test('persistSceneSettlement writes settlement records and captures a success diagnostic', async () => {
  const character = createCharacter({
    id: 'persist-char',
    shortTermSummary: '旧的短期摘要',
  });
  const settlement = buildSceneSettlementResult({
    character,
    sourceScene: 'dating',
    timestamp: 1_700_000_000_777,
    items: {
      relationshipResidue: [{
        type: 'relationship_residue',
        summary: '刚结束的约会留下了一点关系余波',
        sourceScene: 'dating',
        timestamp: 1_700_000_000_777,
        decay: 'medium',
        visibility: 'cross_scene_readable',
      }],
      taskResidue: [{
        type: 'task_residue',
        summary: '这场约会里还可能算数的约定：下周一起吃饭',
        sourceScene: 'dating',
        timestamp: 1_700_000_000_777,
        decay: 'medium',
        visibility: 'cross_scene_readable',
      }],
    },
    openLoop: {
      idPrefix: 'dating',
      taskResumeHint: 'task hint',
      topicResumeHint: 'topic hint',
      limit: 8,
    },
    sceneProgressRecords: [{
      summary: 'this date progressed to a new beat',
      stageLabel: 'progress stage',
      currentSignature: 'close distance',
      repeatedSignature: false,
      completedActions: ['close distance'],
      bannedRepeatActions: ['stare only'],
      nextStepOptions: ['continue with new dialogue'],
    }],
  });

  const result = await persistSceneSettlement({
    characterId: character.id,
    sourceScene: 'dating',
    settlement,
    timestamp: 1_700_000_000_777,
  });

  const records = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId[character.id] || [];
  const latestDiagnostic = getLatestMemoryDiagnostic({
    characterId: character.id,
    type: 'settlement_write',
  });

  assert.equal(result.timestamp, 1_700_000_000_777);
  assert.equal(Boolean(result.characterPatch.shortTermSummary), true);
  assert.equal(records.some((record) => record.kind === 'relationship_wave'), true);
  assert.equal(records.some((record) => record.kind === 'fact' && record.factType === 'plan'), true);
  assert.equal(records.some((record) => record.kind === 'scene_progress'), true);
  const sceneProgressRecord = records.find((record) => record.kind === 'scene_progress');
  assert.equal(sceneProgressRecord?.sceneTags?.includes('dating'), true);
  assert.equal(
    sceneProgressRecord?.retrievalHints?.some((hint) => hint.includes('continue with new dialogue')) || false,
    true,
  );
  assert.equal(latestDiagnostic?.type, 'settlement_write');
  if (latestDiagnostic?.type === 'settlement_write') {
    assert.equal(latestDiagnostic.status, 'success');
    assert.equal(latestDiagnostic.plannedRecordCounts.relationship_wave, 1);
    assert.equal(latestDiagnostic.plannedRecordCounts.scene_progress, 1);
    assert.equal(latestDiagnostic.snapshotCount, 1);
  }
});

test('persistSceneSettlementBatch writes multiple settlements in sequence', async () => {
  const alpha = createCharacter({
    id: 'batch-alpha',
  });
  const beta = createCharacter({
    id: 'batch-beta',
  });
  const alphaSettlement = buildSceneSettlementResult({
    character: alpha,
    sourceScene: 'forum',
    timestamp: 1_700_000_000_888,
    items: {
      relationshipResidue: [{
        type: 'relationship_residue',
        summary: '论坛里刚公开接了你一句',
        sourceScene: 'forum',
        timestamp: 1_700_000_000_888,
        decay: 'short',
        visibility: 'cross_scene_readable',
      }],
    },
    openLoop: {
      idPrefix: 'forum',
      taskResumeHint: 'task hint',
      topicResumeHint: 'topic hint',
      limit: 8,
    },
  });
  const betaSettlement = buildSceneSettlementResult({
    character: beta,
    sourceScene: 'group_chat',
    timestamp: 1_700_000_000_889,
    items: {
      taskResidue: [{
        type: 'task_residue',
        summary: '群聊里还可能算数的约定：晚点继续聊',
        sourceScene: 'group_chat',
        timestamp: 1_700_000_000_889,
        decay: 'medium',
        visibility: 'group_public',
      }],
    },
    openLoop: {
      idPrefix: 'group',
      taskResumeHint: 'task hint',
      topicResumeHint: 'topic hint',
      limit: 8,
    },
  });

  const results = await persistSceneSettlementBatch([
    {
      characterId: alpha.id,
      sourceScene: 'forum',
      settlement: alphaSettlement,
      timestamp: 1_700_000_000_888,
    },
    {
      characterId: beta.id,
      sourceScene: 'group_chat',
      settlement: betaSettlement,
      timestamp: 1_700_000_000_889,
    },
  ]);

  const recordsByCharacterId = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId;

  assert.equal(results.length, 2);
  assert.equal((recordsByCharacterId[alpha.id] || []).length > 0, true);
  assert.equal((recordsByCharacterId[beta.id] || []).length > 0, true);
});
