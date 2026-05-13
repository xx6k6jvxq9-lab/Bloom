import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRelationshipResidueItem,
  createTaskResidueItemFromText,
  createTopicAnchorItemFromText,
  normalizeSettlementText,
  summarizeSettlementText,
} from './sceneSettlementItems';

test('sceneSettlementItems normalize and summarize text consistently', () => {
  assert.equal(normalizeSettlementText('  你好   世界  '), '你好 世界');
  assert.equal(summarizeSettlementText('  你好   世界  ', 3), '你好 ');
});

test('sceneSettlementItems create topic and task items from structured text', () => {
  const topic = createTopicAnchorItemFromText({
    content: '你又提那个老梗了',
    summaryPrefix: '刚碰过的话题：',
    sourceScene: 'dating',
    timestamp: 1,
  });
  const task = createTaskResidueItemFromText({
    content: '下周一起去看电影',
    summaryPrefix: '还可能算数的约定：',
    sourceScene: 'dating',
    timestamp: 1,
  });
  const relationship = createRelationshipResidueItem({
    summary: '刚结束的约会留下了一点关系余波',
    sourceScene: 'dating',
    timestamp: 1,
  });

  assert.ok(topic);
  assert.match(topic?.summary || '', /刚碰过的话题/);
  assert.ok(task);
  assert.match(task?.summary || '', /还可能算数的约定/);
  assert.ok(relationship);
  assert.match(relationship?.summary || '', /关系余波/);
});
