import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLightInteractionPrompt } from './buildLightInteractionPrompt';
import type { DirectLightInteractionGenerationInput } from '../../../chat/lightInteractionTypes';

function createCharacterInitiatedDirectInput(): DirectLightInteractionGenerationInput {
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
      role: 'character',
      label: '小悟',
      characterId: 'char-1',
    },
    responderCharacter,
    target: {
      label: '你',
      character: responderCharacter,
    },
    sceneInput: {
      sections: [],
    } as DirectLightInteractionGenerationInput['sceneInput'],
    recentMessages: [
      {
        role: 'user',
        text: '你在干嘛',
        timestamp: 1,
      },
      {
        role: 'model',
        text: '刚忙完。',
        timestamp: 2,
      },
    ],
  };
}

test('buildLightInteractionPrompt keeps direct character-initiated poke bubbles on the character side', () => {
  const prompt = buildLightInteractionPrompt(createCharacterInitiatedDirectInput());

  assert.match(prompt, /发起者：小悟/);
  assert.match(prompt, /目标：你/);
  assert.match(prompt, /assistantBubbles` 必须是当前角色本人在主动拍完之后顺手发出来的/);
  assert.match(prompt, /不要代写用户气泡，也不要让用户自动回应/);
  assert.match(prompt, /counterAction\.type` 固定为 `"none"`/);
  assert.match(prompt, /你：你在干嘛/);
  assert.match(prompt, /小悟：刚忙完/);
});
