import assert from 'node:assert/strict';
import test from 'node:test';
import type { MemoryRecord } from './memoryRecordTypes';
import { buildSceneSignalsFromRecords } from './sceneSignalRecords';

test('buildSceneSignalsFromRecords projects structured records into scene signals', () => {
  const records: MemoryRecord[] = [
    {
      id: 'wave-1',
      kind: 'relationship_wave',
      sourceScene: 'dating',
      sourceSessionType: 'direct',
      sourceSessionId: 'char-a',
      sourceEventIds: [],
      characterIds: ['char-a'],
      visibility: 'cross_scene_readable',
      stability: 'situational',
      decayHint: 'medium',
      summary: '刚结束的约会留下了一点关系余波',
      timestamp: 1000,
      relationType: 'character_user',
      eventKind: 'bonding',
      valence: 'positive',
      intensity: 'medium',
      sourceCharacterId: 'char-a',
      targetUser: true,
    },
    {
      id: 'fact-experience-1',
      kind: 'fact',
      sourceScene: 'dating',
      sourceSessionType: 'direct',
      sourceSessionId: 'char-a',
      sourceEventIds: [],
      characterIds: ['char-a'],
      visibility: 'cross_scene_readable',
      stability: 'situational',
      decayHint: 'medium',
      summary: '这场约会推进到的阶段：试探靠近阶段',
      timestamp: 1001,
      factType: 'experience',
      subjectType: 'character',
      subjectId: 'char-a',
      confidence: 'explicit',
      relatedCharacterIds: ['char-a'],
    },
    {
      id: 'fact-plan-1',
      kind: 'fact',
      sourceScene: 'dating',
      sourceSessionType: 'direct',
      sourceSessionId: 'char-a',
      sourceEventIds: [],
      characterIds: ['char-a'],
      visibility: 'cross_scene_readable',
      stability: 'temporary',
      decayHint: 'medium',
      summary: '这场约会里还可能算数的约定：下周一起吃饭',
      timestamp: 1002,
      factType: 'plan',
      subjectType: 'character',
      subjectId: 'char-a',
      confidence: 'explicit',
      relatedCharacterIds: ['char-a'],
    },
    {
      id: 'scene-progress-1',
      kind: 'scene_progress',
      sourceScene: 'dating',
      sourceSessionType: 'direct',
      sourceSessionId: 'char-a',
      sourceEventIds: [],
      characterIds: ['char-a'],
      visibility: 'cross_scene_readable',
      stability: 'situational',
      decayHint: 'medium',
      summary: 'current scene progress: close distance and hold eye contact',
      timestamp: 1002,
      stageLabel: '试探靠近阶段',
      currentBeat: 'she stayed close instead of stepping back',
      currentSignature: '靠近 / 对视',
      previousSignature: '靠近',
      repeatedSignature: false,
      completedActions: ['靠近', '对视'],
      bannedRepeatActions: ['靠近'],
      unresolvedTension: 'there is still one sentence left unsaid',
      nextStepOptions: ['turn the pause into a new line of dialogue'],
    },
    {
      id: 'fact-topic-1',
      kind: 'fact',
      sourceScene: 'forum',
      sourceSessionType: 'direct',
      sourceSessionId: 'char-a',
      sourceEventIds: [],
      characterIds: ['char-a'],
      visibility: 'cross_scene_readable',
      stability: 'temporary',
      decayHint: 'short',
      summary: '论坛里刚碰到的话题还留着一点余温：你又提那个老梗了',
      timestamp: 1003,
      factType: 'experience',
      subjectType: 'character',
      subjectId: 'char-a',
      confidence: 'explicit',
      relatedCharacterIds: ['char-a'],
    },
  ];

  const signals = buildSceneSignalsFromRecords({
    characterId: 'char-a',
    records,
    nowTimestamp: 1004,
  });

  assert.equal(signals.relationshipResidue.length > 0, true);
  assert.equal(signals.sceneResidue.length > 0, true);
  assert.equal(signals.taskResidue.length > 0, true);
  assert.equal(signals.topicAnchors.length > 0, true);
  assert.equal(
    signals.sceneResidue.some((item) => item.summary.includes('current scene progress')),
    true,
  );
});
