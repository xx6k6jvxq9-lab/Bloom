import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyGroupOfflineRecruitResponsesToDraft,
  buildGroupOfflineRecruitStatusSummary,
  getGroupOfflineRecruitPendingIds,
  mergeGroupOfflineRecruitResponses,
} from './recruitState';

test('mergeGroupOfflineRecruitResponses lets later replies replace earlier ones per character', () => {
  const merged = mergeGroupOfflineRecruitResponses(
    [{ characterId: 'a', decision: 'decline', text: '去不了。', respondedAt: 10 }],
    [{ characterId: 'a', decision: 'join', text: '我改主意了。', respondedAt: 20 }],
  );

  assert.deepEqual(merged, [
    { characterId: 'a', decision: 'join', text: '我改主意了。', respondedAt: 20 },
  ]);
});

test('getGroupOfflineRecruitPendingIds keeps only candidates without public replies', () => {
  const pendingIds = getGroupOfflineRecruitPendingIds({
    draft: {
      selectedParticipantIds: ['a', 'b', 'c'],
      recruitResponses: [
        { characterId: 'a', decision: 'join', text: '算我一个。', respondedAt: 10 },
        { characterId: 'b', decision: 'decline', text: '这次不去了。', respondedAt: 20 },
      ],
    },
  });

  assert.deepEqual(pendingIds, ['c']);
});

test('buildGroupOfflineRecruitStatusSummary counts joined, declined, and pending members', () => {
  const summary = buildGroupOfflineRecruitStatusSummary({
    draft: {
      selectedParticipantIds: ['a', 'b', 'c'],
      recruitResponses: [
        { characterId: 'a', decision: 'join', text: '我去。', respondedAt: 10 },
        { characterId: 'b', decision: 'decline', text: '我不去。', respondedAt: 20 },
      ],
    },
    members: [
      { id: 'a', name: 'Alpha', remarkName: 'A' },
      { id: 'b', name: 'Beta', remarkName: 'B' },
      { id: 'c', name: 'Gamma', remarkName: 'C' },
    ],
  });

  assert.equal(summary.invitedCount, 3);
  assert.equal(summary.joinedCount, 1);
  assert.equal(summary.declinedCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.deepEqual(summary.joinedLabels, ['A']);
});

test('applyGroupOfflineRecruitResponsesToDraft rewrites joined ids and labels from merged responses', () => {
  const nextDraft = applyGroupOfflineRecruitResponsesToDraft({
    draft: {
      createdAt: 1,
      title: '夜场',
      mode: 'daily',
      activityType: '夜场',
      location: '街角小馆',
      timeLabel: '今晚',
      weatherLabel: '晚风',
      vibe: '慢热',
      selectedParticipantIds: ['a', 'b'],
      participantLabels: [],
    },
    incomingResponses: [
      { characterId: 'a', decision: 'join', text: '我去。', respondedAt: 10 },
      { characterId: 'b', decision: 'decline', text: '我不去。', respondedAt: 20 },
    ],
    members: [
      { id: 'a', name: 'Alpha', remarkName: 'A' },
      { id: 'b', name: 'Beta', remarkName: 'B' },
    ],
  });

  assert.deepEqual(nextDraft.signedUpParticipantIds, ['a']);
  assert.deepEqual(nextDraft.participantLabels, ['A']);
  assert.equal(nextDraft.recruitResponses?.length, 2);
});
