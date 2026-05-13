import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage } from '../../types';
import {
  buildDirectSceneProgress,
  formatDirectSceneProgressForPrompt,
} from './buildDirectSceneProgress';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    role: overrides.role ?? 'user',
    text: overrides.text ?? '',
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  };
}

test('buildDirectSceneProgress flags repeated moves without forbidding deliberate persona repetition', () => {
  const history: ChatMessage[] = [
    createMessage({ role: 'user', text: '你又不理我', timestamp: 1 }),
    createMessage({ role: 'model', text: '别不理我。看我。', timestamp: 2 }),
    createMessage({ role: 'user', text: '就不理你', timestamp: 3 }),
    createMessage({ role: 'model', text: '别不理我。看我。', timestamp: 4 }),
  ];

  const progress = buildDirectSceneProgress(history, '你在干嘛');
  const prompt = formatDirectSceneProgressForPrompt(progress);

  assert.equal(progress?.repeatedSignature, true);
  assert.match(prompt, /## 单聊推进状态/);
  assert.match(prompt, /本轮重复提醒/);
  assert.match(prompt, /允许的人设复读/);
  assert.match(prompt, /索要回应/);
});

test('buildDirectSceneProgress notices when the user is deliberately retriggering the same point', () => {
  const history: ChatMessage[] = [
    createMessage({ role: 'user', text: '你想不想我', timestamp: 1 }),
    createMessage({ role: 'model', text: '想你。别装不知道。', timestamp: 2 }),
    createMessage({ role: 'user', text: '再说一遍', timestamp: 3 }),
    createMessage({ role: 'model', text: '想你。别装不知道。', timestamp: 4 }),
  ];

  const progress = buildDirectSceneProgress(history, '再说一遍');

  assert.equal(progress?.repeatedSignature, true);
  assert.equal(progress?.userRetriggeredSamePoint, true);
});
