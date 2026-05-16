import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import { resetMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type { Character, ChatGroup } from '../../types';
import { buildGroupChatSceneInput } from './buildGroupChatSceneInput';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? 'Alpha',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? [
      '他在别人面前不避讳占有欲，喜欢半开玩笑提你，像在宣示主权。',
      '但不会把私聊原话直接搬出去。',
    ].join('\n'),
    openingRemark: overrides.openingRemark ?? '你终于来了。',
    signature: overrides.signature ?? '懒得装不在意。',
    expressionStyle: overrides.expressionStyle ?? '公开场合会轻描淡写地阴阳一句，再装作若无其事。',
    boundaryPack: overrides.boundaryPack ?? '不会把私聊原话直接搬到群里。',
    ...overrides,
  } as Character;
}

function createGroup(overrides: Partial<ChatGroup> = {}): ChatGroup {
  return {
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? '测试群',
    memberIds: overrides.memberIds ?? ['alpha', 'beta'],
    creatorId: overrides.creatorId ?? 'user',
    createdAt: overrides.createdAt ?? 1,
    adminIds: overrides.adminIds ?? [],
    ...overrides,
  };
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('buildGroupChatSceneInput exposes only the public persona guide for group prompts', () => {
  const speaker = createCharacter();
  const peer = createCharacter({
    id: 'beta',
    name: 'Beta',
    setting: '普通群友。',
    expressionStyle: '说话简短。',
    signature: '在线。',
  });

  const sceneInput = buildGroupChatSceneInput({
    speaker,
    members: [speaker, peer],
    userName: 'User',
    history: [],
    directChatHistory: {
      alpha: [],
      beta: [],
    },
  });

  assert.match(sceneInput.speakerPublicPersonaGuide || '', /## 公开场合角色锚点/);
  assert.match(sceneInput.speakerPublicPersonaGuide || '', /宣示主权/);
  assert.match(sceneInput.speakerPublicPersonaGuide || '', /不会把私聊原话直接搬到群里/);
});

test('buildGroupChatSceneInput includes structural group roles for admin gameplay context', () => {
  const speaker = createCharacter();
  const peer = createCharacter({
    id: 'beta',
    name: 'Beta',
    setting: '普通群友。',
  });

  const sceneInput = buildGroupChatSceneInput({
    speaker,
    members: [speaker, peer],
    group: createGroup({
      memberIds: [speaker.id, peer.id],
      creatorId: 'user',
      adminIds: [speaker.id],
    }),
    userName: 'User',
    history: [],
    directChatHistory: {
      alpha: [],
      beta: [],
    },
  });

  assert.equal(sceneInput.recentContext?.speakerStructuralGroupRole, '管理员');
  assert.equal(sceneInput.recentContext?.userStructuralGroupRole, '群主');
  assert.match(sceneInput.recentContext?.groupManagementSummary || '', /群主：User/);
  assert.match(sceneInput.recentContext?.groupManagementSummary || '', /管理员：Alpha/);
});
