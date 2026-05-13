import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getLatestMemoryDiagnostic,
  listMemoryDiagnostics,
  recordMemoryReadDiagnostic,
  recordMemoryWriteDiagnostic,
  resetMemoryDiagnostics,
} from './memoryDiagnostics';

test.beforeEach(() => {
  resetMemoryDiagnostics();
});

test('memory diagnostics support filtering by character, scene, type, and limit', () => {
  recordMemoryWriteDiagnostic({
    characterId: 'alpha',
    sourceScene: 'dating',
    status: 'success',
    plannedRecordCounts: {
      scene_progress: 1,
    },
    snapshotCount: 1,
    sharedStateIncluded: true,
    sceneProgressRecordCount: 1,
    timestamp: 100,
  });
  recordMemoryReadDiagnostic({
    characterId: 'alpha',
    sourceScene: 'dating',
    shortTermSummarySource: 'snapshot_records',
    longTermMemoryProfileSource: 'legacy_fields',
    sceneSignalCounts: {
      compatibilitySnapshots: 1,
      relationshipResidue: 2,
      topicAnchors: 1,
      taskResidue: 1,
    },
    retrievedMemoryCounts: {
      matchedFacts: 1,
      stablePreferences: 0,
      relationshipWaves: 1,
      sceneProgress: 1,
      openTasks: 1,
    },
    promptSectionCount: 6,
    timestamp: 200,
  });
  recordMemoryReadDiagnostic({
    characterId: 'beta',
    sourceScene: 'direct_chat',
    shortTermSummarySource: 'legacy_fields',
    longTermMemoryProfileSource: 'empty',
    sceneSignalCounts: {
      compatibilitySnapshots: 0,
      relationshipResidue: 0,
      topicAnchors: 0,
      taskResidue: 0,
    },
    retrievedMemoryCounts: {
      matchedFacts: 0,
      stablePreferences: 0,
      relationshipWaves: 0,
      sceneProgress: 0,
      openTasks: 0,
    },
    promptSectionCount: 3,
    timestamp: 300,
  });

  const alphaEvents = listMemoryDiagnostics({
    characterId: 'alpha',
  });
  const latestAlphaRead = getLatestMemoryDiagnostic({
    characterId: 'alpha',
    type: 'read',
  });
  const betaRead = getLatestMemoryDiagnostic({
    characterId: 'beta',
    sourceScene: 'direct_chat',
  });

  assert.equal(alphaEvents.length, 2);
  assert.equal(alphaEvents[0]?.timestamp, 200);
  assert.equal(listMemoryDiagnostics({
    type: 'read',
    limit: 1,
  }).length, 1);
  assert.equal(listMemoryDiagnostics({
    type: 'settlement_write',
    status: 'success',
  }).length, 1);
  assert.equal(latestAlphaRead?.type, 'read');
  if (latestAlphaRead?.type === 'read') {
    assert.equal(latestAlphaRead.fallbackToLegacy, true);
    assert.equal(latestAlphaRead.retrievedMemoryCounts.sceneProgress, 1);
  }
  assert.equal(betaRead?.type, 'read');
  if (betaRead?.type === 'read') {
    assert.equal(betaRead.fallbackToLegacy, true);
  }
});

test('memory diagnostics keep only the most recent ring-buffer events', () => {
  for (let index = 0; index < 130; index += 1) {
    recordMemoryWriteDiagnostic({
      characterId: 'alpha',
      sourceScene: 'group_chat',
      status: 'success',
      plannedRecordCounts: {},
      snapshotCount: 0,
      sharedStateIncluded: false,
      sceneProgressRecordCount: 0,
      timestamp: 1_000 + index,
    });
  }

  const diagnostics = listMemoryDiagnostics();

  assert.equal(diagnostics.length, 120);
  assert.equal(diagnostics[0]?.timestamp, 1_129);
  assert.equal(diagnostics[119]?.timestamp, 1_010);
});
