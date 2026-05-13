import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { buildSceneSettlementResult } from './sceneSettlement';

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
});
