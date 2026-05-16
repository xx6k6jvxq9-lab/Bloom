import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, ChatGroup, ChatMessage, MomentItem } from '../../types';
import {
  buildDirectChatMentionAwarenessForCharacter,
  buildMomentExposureAwarenessPatches,
  getMentionedGroupIdsFromText,
} from './groupAwarenessPropagation';

function createGroup(overrides: Partial<ChatGroup> = {}): ChatGroup {
  return {
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? '夜聊群',
    memberIds: overrides.memberIds ?? ['alpha'],
    creatorId: overrides.creatorId ?? 'user',
    createdAt: overrides.createdAt ?? 1,
    awarenessMode: overrides.awarenessMode ?? 'private',
    ...overrides,
  };
}

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'beta',
    name: overrides.name ?? 'Beta',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: 'hi',
    friendshipStatus: overrides.friendshipStatus ?? 'friends',
    ...overrides,
  } as Character;
}

test('getMentionedGroupIdsFromText finds safe group-name mentions only', () => {
  const groups = [
    createGroup({ id: 'g1', name: '夜聊群' }),
    createGroup({ id: 'g2', name: '1' }),
  ];

  assert.deepEqual(getMentionedGroupIdsFromText('昨晚那个夜聊群也太热闹了', groups), ['g1']);
});

test('buildDirectChatMentionAwarenessForCharacter reveals a private group after direct mention', () => {
  const patches = buildDirectChatMentionAwarenessForCharacter({
    characterId: 'beta',
    history: [
      { role: 'user', text: '我刚从夜聊群出来', timestamp: 1 } as ChatMessage,
    ],
    chatGroups: [createGroup()],
    now: 10,
  });

  assert.equal(patches.length, 1);
  assert.equal(patches[0]?.awarenessEntries?.[0]?.memberId, 'beta');
  assert.equal(patches[0]?.awarenessEntries?.[0]?.source, 'direct_chat_mention');
});

test('buildMomentExposureAwarenessPatches reveals mentioned groups through public-facing moments', () => {
  const patches = buildMomentExposureAwarenessPatches({
    moment: {
      id: 'm1',
      authorId: 'alpha',
      content: '今天夜聊群又吵起来了',
      visibilityScope: 'known_network',
    } as MomentItem,
    characters: [
      createCharacter({ id: 'alpha', name: 'Alpha' }),
      createCharacter({ id: 'beta', name: 'Beta' }),
      createCharacter({ id: 'gamma', name: 'Gamma', friendshipStatus: 'none' }),
    ],
    chatGroups: [createGroup()],
    now: 20,
  });

  assert.equal(patches.length, 1);
  assert.equal(patches[0]?.awarenessEntries?.some((entry) => entry.memberId === 'beta'), true);
  assert.equal(patches[0]?.awarenessEntries?.some((entry) => entry.memberId === 'gamma'), true);
});
