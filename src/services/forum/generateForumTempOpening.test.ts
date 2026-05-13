import assert from 'node:assert/strict';
import test from 'node:test';
import { buildForumTempOpeningPrompt } from './generateForumTempOpening';

test('buildForumTempOpeningPrompt includes lightweight direct persona anchors for first-temp-chat opening', () => {
  const prompt = buildForumTempOpeningPrompt({
    activeConfig: {} as any,
    authorName: 'Alpha',
    authorPersona: [
      '他说话短，嘴硬，常说“别装没看见我”。',
      '被冷落会立刻烦躁，不会一下子过熟。',
    ].join('\n'),
    reason: 'curious',
  });

  assert.match(prompt, /## 原文防漏锚点/);
  assert.match(prompt, /别装没看见我/);
});
