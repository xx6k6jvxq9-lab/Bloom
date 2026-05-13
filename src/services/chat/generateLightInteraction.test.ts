import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLightInteractionResult } from './generateLightInteraction';
import type { DirectLightInteractionGenerationInput } from './lightInteractionTypes';

function createDirectInput(
  overrides: Partial<DirectLightInteractionGenerationInput> = {},
): DirectLightInteractionGenerationInput {
  const responderCharacter = {
    id: 'char-1',
    name: '小悟',
    maxReplies: 3,
  } as DirectLightInteractionGenerationInput['responderCharacter'];

  return {
    activeConfig: { provider: 'gemini', model: 'test-model' } as DirectLightInteractionGenerationInput['activeConfig'],
    type: 'poke',
    scene: 'direct',
    actor: {
      role: 'user',
      label: '你',
    },
    responderCharacter,
    target: {
      label: '小悟',
      character: responderCharacter,
    },
    sceneInput: {} as DirectLightInteractionGenerationInput['sceneInput'],
    recentMessages: [],
    ...overrides,
  };
}

test('parseLightInteractionResult strips malformed fenced JSON scaffolding from fallback bubbles', () => {
  const input = createDirectInput();
  const rawText = [
    '```json',
    '{',
    '  "systemLine": "你拍了拍小悟",',
    '  "assistantBubbles": [',
    '    "……你拍我干嘛。",',
    '    "有话就说。"',
    '  ],',
    '  "counterAction": {',
    '    "type": "none",',
    '    "systemLine": ""',
    '  }',
    '}',
    '```',
  ].join('\n');

  const result = parseLightInteractionResult(rawText, input);

  assert.equal(result.systemLine, '你拍了拍小悟');
  assert.deepEqual(result.assistantBubbles, ['……你拍我干嘛。', '有话就说。']);
  assert.ok(result.assistantBubbles.every((bubble) => !/^(?:json|\{|"systemLine")$/i.test(bubble)));
});

test('parseLightInteractionResult repairs trailing commas before parsing JSON payload', () => {
  const input = createDirectInput();
  const rawText = `{
  "systemLine": "你拍了拍小悟",
  "assistantBubbles": ["别拍。", "说事。",],
  "counterAction": {
    "type": "none",
    "systemLine": "",
  },
}`;

  const result = parseLightInteractionResult(rawText, input);

  assert.equal(result.systemLine, '你拍了拍小悟');
  assert.deepEqual(result.assistantBubbles, ['别拍。', '说事。']);
});

test('parseLightInteractionResult drops counterAction when the character initiates a direct poke', () => {
  const responderCharacter = {
    id: 'char-1',
    name: '小悟',
    maxReplies: 3,
  } as DirectLightInteractionGenerationInput['responderCharacter'];
  const input = createDirectInput({
    actor: {
      role: 'character',
      label: '小悟',
      characterId: 'char-1',
    },
    responderCharacter,
    target: {
      label: '你',
      character: responderCharacter,
    },
  });
  const rawText = `{
  "systemLine": "小悟拍了拍你",
  "assistantBubbles": ["拍你一下。"],
  "counterAction": {
    "type": "poke_back",
    "systemLine": "你拍了拍小悟"
  }
}`;

  const result = parseLightInteractionResult(rawText, input);

  assert.equal(result.systemLine, '小悟拍了拍你');
  assert.deepEqual(result.assistantBubbles, ['拍你一下。']);
  assert.deepEqual(result.counterAction, {
    type: 'none',
    systemLine: '',
  });
});

test('parseLightInteractionResult keeps counterAction available when the recent direct vibe is serious', () => {
  const input = createDirectInput({
    recentMessages: [
      {
        role: 'user',
        text: '我今天真的很难受。',
        timestamp: 1,
      },
      {
        role: 'model',
        text: '先休息。',
        timestamp: 2,
      },
    ],
    sceneInput: {
      recentContext: {
        shortTermSummary: '最近气氛偏低落，正在说身体不舒服。',
      },
    } as DirectLightInteractionGenerationInput['sceneInput'],
  });
  const rawText = `{
  "systemLine": "你拍了拍小悟",
  "assistantBubbles": ["？"],
  "counterAction": {
    "type": "poke_back",
    "systemLine": "小悟拍了拍你"
  }
}`;

  const result = parseLightInteractionResult(rawText, input);

  assert.deepEqual(result.counterAction, {
    type: 'poke_back',
    systemLine: '小悟拍了拍你',
  });
});
