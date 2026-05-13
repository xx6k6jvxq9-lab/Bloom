import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import { resetMemoryRecordData, saveMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type { Character } from '../../types';
import { buildChatSceneInput } from './buildChatSceneInput';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? 'Alpha',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? [
      '他是嘴硬又黏人的年上，平时说话短，不爱解释。',
      '被冷落会立刻烦躁，常说“过来”“别装没看见我”。',
    ].join('\n'),
    openingRemark: overrides.openingRemark ?? '怎么现在才来？',
    signature: overrides.signature ?? '懒得哄人，但会等你。',
    boundaryPack: overrides.boundaryPack ?? '关系没到时不要突然说过火的话。',
    expressionStyle: overrides.expressionStyle ?? '说话偏短句，情绪上来会连发两三条。',
    ...overrides,
  } as Character;
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('buildChatSceneInput injects direct persona guide and opening anchors into character core', () => {
  const sceneInput = buildChatSceneInput({
    character: createCharacter(),
    userName: 'User',
    directChatHistory: {
      alpha: [],
    },
    latestUserText: '你在干嘛',
  });

  assert.equal(sceneInput.characterCore?.openingRemark, '怎么现在才来？');
  assert.equal(sceneInput.characterCore?.signature, '懒得哄人，但会等你。');
  assert.match(sceneInput.characterCore?.personaGuidePrompt || '', /## 原文防漏锚点/);
  assert.match(sceneInput.characterCore?.personaGuidePrompt || '', /\[开口语感锚点\]/);
  assert.match(sceneInput.characterCore?.personaGuidePrompt || '', /\[说话与反应锚点\]/);
});

test('buildChatSceneInput can recall memory from recent transcript even when latest user text is vague', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      alpha: [
        {
          id: 'fact-rooftop-direct',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'remember the rooftop cafe promise',
          timestamp: now - 200,
          factType: 'experience',
          subjectType: 'character',
          subjectId: 'alpha',
          confidence: 'explicit',
          relatedCharacterIds: ['alpha'],
        },
      ],
    },
  });

  const sceneInput = buildChatSceneInput({
    character: createCharacter(),
    userName: 'User',
    directChatHistory: {
      alpha: [
        {
          role: 'user',
          text: 'We still have not gone back to that rooftop cafe.',
          timestamp: now - 400,
        },
        {
          role: 'model',
          text: 'I know, I still remember it.',
          timestamp: now - 300,
        },
      ],
    },
    latestUserText: 'then what',
  });

  assert.equal(
    sceneInput.recentContext?.retrievedMemory?.matchedFacts.some((result) => result.record.id === 'fact-rooftop-direct'),
    true,
  );
});

test('buildChatSceneInput includes direct scene progress when recent replies are looping the same move', () => {
  const sceneInput = buildChatSceneInput({
    character: createCharacter(),
    userName: 'User',
    directChatHistory: {
      alpha: [
        {
          role: 'user',
          text: '你又不理我',
          timestamp: 1,
        },
        {
          role: 'model',
          text: '别不理我。看我。',
          timestamp: 2,
        },
        {
          role: 'user',
          text: '就不理你',
          timestamp: 3,
        },
        {
          role: 'model',
          text: '别不理我。看我。',
          timestamp: 4,
        },
      ],
    },
    latestUserText: '你在干嘛',
  });

  const joinedSections = (sceneInput.sections || []).join('\n\n');

  assert.match(joinedSections, /## 单聊推进状态/);
  assert.match(joinedSections, /本轮重复提醒/);
  assert.match(joinedSections, /允许的人设复读/);
});

test('buildChatSceneInput includes initiative guidance for proactive life-line carryover', () => {
  const sceneInput = buildChatSceneInput({
    character: createCharacter(),
    userName: 'User',
    directChatHistory: {
      alpha: [
        {
          role: 'user',
          text: '你刚刚不是还在忙吗',
          timestamp: Date.now() - 3600_000,
        },
        {
          role: 'model',
          text: '嗯，刚忙完。',
          timestamp: Date.now() - 3500_000,
        },
      ],
    },
    latestUserText: '你刚在干嘛',
  });

  const joinedSections = (sceneInput.sections || []).join('\n\n');

  assert.match(joinedSections, /## 角色主动带线参考/);
  assert.match(joinedSections, /可以主动带出的方向/);
  assert.match(joinedSections, /主动不等于必须热情/);
});
