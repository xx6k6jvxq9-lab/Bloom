import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, GroupOfflineSession } from '../../types';
import {
  buildGroupOfflineGeneratedContentShell,
  hasRemovedGroupOfflineEnsembleContent,
  normalizeGroupOfflineGenerationMode,
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

function createSession(generationMode: GroupOfflineSession['generationMode']): GroupOfflineSession {
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

test('legacy ensemble sessions are normalized away from runtime use', () => {
  const session = createSession('ensemble');

  assert.equal(normalizeGroupOfflineGenerationMode(session.generationMode), 'blocks');
  assert.equal(hasRemovedGroupOfflineEnsembleContent(session), true);
});

test('buildGroupOfflineGeneratedContentShell now always falls back to blocks shells', () => {
  const members = [
    createCharacter('a', 'A'),
    createCharacter('b', 'B'),
    createCharacter('c', 'C'),
  ];

  const content = buildGroupOfflineGeneratedContentShell({
    session: createSession('ensemble'),
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
  assert.equal((content.rounds?.[0]?.articleParagraphs || []).length, 0);
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
  assert.equal((content.rounds?.[0]?.articleParagraphs || []).length, 0);
  assert.equal(content.rounds?.[0]?.characterEntries.every((entry) => entry.text === ''), true);
});
