import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import { resetMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type { Character, ChatGroup } from '../../types';
import {
  buildGroupPublicCharacterPromptCollection,
  buildGroupPublicCharacterPromptContext,
} from './buildGroupPublicCharacterPromptContext';

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
    sceneHints: overrides.sceneHints,
    remarkName: overrides.remarkName,
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
    currentScene: overrides.currentScene,
    ...overrides,
  };
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('buildGroupPublicCharacterPromptContext exposes public persona anchors and speaking style', () => {
  const speaker = createCharacter({
    sceneHints: {
      groupChat: '公开场合会先看人群里谁在盯着你，再决定把话落多重。',
    },
  });
  const peer = createCharacter({
    id: 'beta',
    name: 'Beta',
    setting: '普通群友。',
    expressionStyle: '说话简短。',
    signature: '在线。',
  });

  const block = buildGroupPublicCharacterPromptContext({
    speaker,
    members: [speaker, peer],
    group: createGroup({
      currentScene: '大家刚聊到今晚去哪儿，气氛还没完全定下来。',
    }),
    userName: 'User',
    history: [],
    directChatHistory: {
      alpha: [],
      beta: [],
    },
  });

  assert.match(block, /核心人设：/);
  assert.match(block, /公开说话手感：/);
  assert.match(block, /公开场合角色锚点：/);
  assert.match(block, /宣示主权/);
  assert.match(block, /群内关系起点：/);
  assert.match(block, /群聊场景提示：/);
});

test('buildGroupPublicCharacterPromptCollection keeps separate blocks per speaker', () => {
  const alpha = createCharacter({
    id: 'alpha',
    name: 'Alpha',
  });
  const beta = createCharacter({
    id: 'beta',
    name: 'Beta',
    setting: '表面更轻快，但不喜欢把态度说穿。',
  });

  const block = buildGroupPublicCharacterPromptCollection({
    speakers: [alpha, beta],
    members: [alpha, beta],
    userName: 'User',
    history: [],
    directChatHistory: {
      alpha: [],
      beta: [],
    },
  });

  assert.match(block, /### Alpha \/ alpha/);
  assert.match(block, /### Beta \/ beta/);
});
