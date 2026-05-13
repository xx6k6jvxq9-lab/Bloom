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
      '浠栨槸鍢寸‖鍙堥粡浜虹殑骞翠笂锛屽钩鏃惰璇濈煭锛屼笉鐖辫В閲娿€?',
      '琚喎钀戒細绔嬪埢鐑﹁簛锛屽父璇粹€滆繃鏉モ€濃€滃埆瑁呮病鐪嬭鎴戔€濄€?',
    ].join('\n'),
    openingRemark: overrides.openingRemark ?? '鎬庝箞鐜板湪鎵嶆潵銆?',
    signature: overrides.signature ?? '鎳掑緱鍝勪汉锛屼絾浼氱瓑浣犮€?',
    boundaryPack: overrides.boundaryPack ?? '鍏崇郴娌″埌鏃朵笉瑕佺獊鐒惰杩囩伀鐨勮瘽銆?',
    expressionStyle: overrides.expressionStyle ?? '璇磋瘽鍋忕煭鍙ワ紝鎯呯华涓婃潵浼氳繛鍙戜袱涓夋潯銆?',
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
    latestUserText: '浣犲湪骞插槢',
  });

  assert.equal(sceneInput.characterCore?.openingRemark, '鎬庝箞鐜板湪鎵嶆潵銆?');
  assert.equal(sceneInput.characterCore?.signature, '鎳掑緱鍝勪汉锛屼絾浼氱瓑浣犮€?');
  assert.match(sceneInput.characterCore?.personaGuidePrompt || '', /## 原文防漏锚点/);
  assert.match(sceneInput.characterCore?.personaGuidePrompt || '', /\[开口语感锚点\]/);
  assert.match(sceneInput.characterCore?.personaGuidePrompt || '', /\[原文里的高优先级片段\]/);
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
