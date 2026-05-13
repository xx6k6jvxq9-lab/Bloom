import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLightInteractionResult } from './generateLightInteraction';
import type { DirectLightInteractionGenerationInput } from './lightInteractionTypes';

function createDirectInput(): DirectLightInteractionGenerationInput {
  return {
    activeConfig: { provider: 'gemini', model: 'test-model' } as DirectLightInteractionGenerationInput['activeConfig'],
    type: 'poke',
    scene: 'direct',
    actor: {
      role: 'user',
      label: '你',
    },
    target: {
      label: '小悟',
      character: {
        id: 'char-1',
        name: '小悟',
        maxReplies: 3,
      } as DirectLightInteractionGenerationInput['target']['character'],
    },
    sceneInput: {} as DirectLightInteractionGenerationInput['sceneInput'],
    recentMessages: [],
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
