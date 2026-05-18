import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, GroupOfflineSession } from '../../types';
import {
  buildGroupOfflineRecruitCard,
  buildGroupOfflineGeneratedContentShell,
  createGroupOfflineRecruitMessage,
} from './sessionUtils';

function createCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    gender: 'other',
    avatar: '',
    setting: `${name} persona.`,
  } as Character;
}

function createSession(generationMode: GroupOfflineSession['generationMode'] = 'blocks'): GroupOfflineSession {
  return {
    id: 'offline-1',
    groupId: 'group-1',
    mode: 'daily',
    generationMode,
    activityType: 'Late-night continuation',
    location: 'Street-corner cafe',
    scenePrompt: 'The room is not loud, but everyone can tell who picks up whose line first.',
    timeLabel: 'Saturday 20:05',
    weatherLabel: 'Cool night wind',
    vibe: 'Slow-burn opening',
    participants: [
      { characterId: 'a', joinedAt: 1, presence: 'arrived' },
      { characterId: 'b', joinedAt: 1, presence: 'arrived' },
      { characterId: 'c', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: 1,
    updatedAt: 1,
    currentRound: 1,
    messages: [],
    status: 'active',
  } as GroupOfflineSession;
}

test('buildGroupOfflineGeneratedContentShell now always falls back to blocks shells', () => {
  const members = [
    createCharacter('a', 'A'),
    createCharacter('b', 'B'),
    createCharacter('c', 'C'),
  ];

  const content = buildGroupOfflineGeneratedContentShell({
    session: createSession(),
    members,
    userName: 'User',
    phase: 'round',
  });

  assert.equal(content.soundtrack, undefined);
  assert.equal(content.rounds?.[0]?.generationMode, 'blocks');
  assert.deepEqual(
    content.rounds?.[0]?.characterEntries.map((entry) => entry.characterId),
    ['a', 'b'],
  );
  assert.equal(content.rounds?.[0]?.characterEntries.every((entry) => entry.text === ''), true);
});

test('buildGroupOfflineGeneratedContentShell keeps blocks rounds on a limited speaker subset by default', () => {
  const members = [
    createCharacter('a', 'A'),
    createCharacter('b', 'B'),
    createCharacter('c', 'C'),
  ];

  const content = buildGroupOfflineGeneratedContentShell({
    session: createSession('blocks'),
    members,
    userName: 'User',
    phase: 'round',
  });

  assert.equal(content.rounds?.[0]?.generationMode, 'blocks');
  assert.deepEqual(
    content.rounds?.[0]?.characterEntries.map((entry) => entry.characterId),
    ['a', 'b'],
  );
  assert.equal(content.rounds?.[0]?.characterEntries.every((entry) => entry.text === ''), true);
});

test('createGroupOfflineRecruitMessage carries a restartable draft payload', () => {
  const message = createGroupOfflineRecruitMessage({
    createdBy: 'User',
    draft: {
      createdAt: 5,
      title: '倒计时任务',
      mode: 'scenario',
      activityType: '倒计时任务',
      location: '封锁区后门',
      timeLabel: '今晚 21:30',
      weatherLabel: '风压很低',
      vibe: '越聊越紧',
      selectedParticipantIds: ['a', 'b'],
      participantLabels: ['A', 'B'],
      selectedWorldBookIds: ['wb-1'],
      worldBookSnapshot: [],
    },
  });

  assert.equal(message.groupOfflineCard?.status, 'recruiting');
  assert.equal(message.groupOfflineDraft?.title, '倒计时任务');
  assert.deepEqual(message.groupOfflineCard?.participantLabels, ['A', 'B']);
});

test('createGroupOfflineRecruitMessage supports an empty invite list for pre-recruit drafts', () => {
  const message = createGroupOfflineRecruitMessage({
    createdBy: 'User',
    draft: {
      createdAt: 8,
      title: '深夜续摊',
      mode: 'daily',
      activityType: '深夜续摊',
      location: '街角小馆',
      timeLabel: '今晚 20:30',
      weatherLabel: '晚风轻 / 氛围刚刚好',
      vibe: '慢热开场',
      selectedParticipantIds: [],
      participantLabels: [],
      selectedWorldBookIds: [],
      worldBookSnapshot: [],
    },
  });

  assert.equal(message.groupOfflineCard?.status, 'recruiting');
  assert.deepEqual(message.groupOfflineCard?.participantLabels, []);
});

test('buildGroupOfflineRecruitCard reflects signup-only recruit state', () => {
  const card = buildGroupOfflineRecruitCard({
    createdBy: 'User',
    draft: {
      createdAt: 10,
      recruitCardSessionId: 'group-offline-recruit-10',
      title: '深夜续摊',
      mode: 'daily',
      activityType: '深夜续摊',
      location: '街角小馆',
      timeLabel: '今晚 20:30',
      weatherLabel: '晚风偏凉',
      vibe: '慢热开场',
      selectedParticipantIds: ['a', 'b'],
      participantLabels: ['A', 'B'],
      signedUpParticipantIds: ['a', 'b'],
    },
    status: 'recruiting',
    timestamp: 10,
  });

  assert.equal(card.status, 'recruiting');
  assert.equal(card.signupCount, 2);
  assert.equal(card.statusLabel, '待开局');
});
