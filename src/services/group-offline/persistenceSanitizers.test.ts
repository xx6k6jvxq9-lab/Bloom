import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sanitizeChatMessageArrayForOfflineFields,
  sanitizeGroupOfflineRecruitDraft,
  sanitizeGroupOfflineSession,
} from './persistenceSanitizers';

test('sanitizeGroupOfflineRecruitDraft normalizes invalid mode and missing arrays', () => {
  const sanitized = sanitizeGroupOfflineRecruitDraft({
    createdAt: 1,
    title: '深夜续摊',
    mode: 'broken',
    activityType: '深夜续摊',
    location: '街角小馆',
    timeLabel: '今晚 20:30',
    weatherLabel: '晚风轻',
    vibe: '慢热开场',
  });

  assert.equal(sanitized?.mode, 'daily');
  assert.deepEqual(sanitized?.selectedParticipantIds, []);
  assert.deepEqual(sanitized?.participantLabels, []);
});

test('sanitizeChatMessageArrayForOfflineFields drops malformed offline draft payloads but keeps the message', () => {
  const messages = sanitizeChatMessageArrayForOfflineFields([{
    role: 'user',
    text: '[group-offline-recruit] 深夜续摊',
    timestamp: 10,
    groupOfflineCard: {
      title: '深夜续摊',
      mode: 'broken',
      status: 'recruiting',
      locationLabel: '街角小馆',
      timeLabel: '今晚 20:30',
      participantLabels: ['A'],
    },
    groupOfflineDraft: {
      mode: 'broken',
    },
  }]);

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.groupOfflineCard?.mode, 'daily');
  assert.equal(messages[0]?.groupOfflineDraft, undefined);
});

test('sanitizeGroupOfflineSession keeps activityType but repairs mode and participant list shape', () => {
  const session = sanitizeGroupOfflineSession({
    mode: 'broken',
    activityType: '深夜续摊',
    location: '街角小馆',
    timeLabel: '今晚 20:30',
    weatherLabel: '晚风轻',
    vibe: '慢热开场',
    participants: [
      { characterId: 'a', presence: 'arrived' },
      { characterId: '', presence: 'arrived' },
    ],
    messages: [],
    status: 'active',
  });

  assert.equal(session?.mode, 'daily');
  assert.deepEqual(session?.participants.map((item) => item.characterId), ['a']);
});

test('sanitizeGroupOfflineSession drops unsupported legacy ensemble payloads', () => {
  const session = sanitizeGroupOfflineSession({
    mode: 'daily',
    generationMode: 'ensemble',
    activityType: '娣卞缁憡',
    location: '琛楄灏忛',
    timeLabel: '浠婃櫄 20:30',
    weatherLabel: '鏅氶杞?',
    vibe: '鎱㈢儹寮€鍦?',
    participants: [],
    messages: [],
    status: 'active',
  });

  assert.equal(session, undefined);
});

test('sanitizeGroupOfflineSession drops unsupported articleParagraphs rounds', () => {
  const session = sanitizeGroupOfflineSession({
    mode: 'daily',
    activityType: '娣卞缁憡',
    location: '琛楄灏忛',
    timeLabel: '浠婃櫄 20:30',
    weatherLabel: '鏅氶杞?',
    vibe: '鎱㈢儹寮€鍦?',
    participants: [],
    messages: [],
    status: 'active',
    generatedContent: {
      card: {
        timeLabel: '浠婃櫄 20:30',
        locationLabel: '琛楄灏忛',
        weatherLabel: '鏅氶杞?',
        participantLabels: [],
      },
      intro: '',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        generationMode: 'blocks',
        characterEntries: [],
        articleParagraphs: [{ id: 'legacy', text: 'legacy' }],
      }],
    },
  });

  assert.equal(session, undefined);
});

test('sanitizeGroupOfflineRecruitDraft keeps recruit flow fields when valid', () => {
  const draft = sanitizeGroupOfflineRecruitDraft({
    createdAt: 12,
    recruitCardSessionId: 'group-offline-recruit-12',
    title: '深夜续摊',
    mode: 'daily',
    activityType: '深夜续摊',
    location: '街角小馆',
    timeLabel: '今晚 20:30',
    weatherLabel: '晚风偏凉',
    vibe: '慢热开场',
    selectedParticipantIds: ['a', 'b'],
    participantLabels: ['A', 'B'],
    signedUpParticipantIds: ['a'],
    confirmedParticipantIds: ['a'],
    rosterLockedAt: 20,
    launchedAt: 30,
  });

  assert.equal(draft?.recruitCardSessionId, 'group-offline-recruit-12');
  assert.deepEqual(draft?.signedUpParticipantIds, ['a']);
  assert.deepEqual(draft?.confirmedParticipantIds, ['a']);
  assert.equal(draft?.rosterLockedAt, 20);
  assert.equal(draft?.launchedAt, 30);
});
