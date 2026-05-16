import assert from 'node:assert/strict';
import test from 'node:test';
import type { DateSession, DatingGeneratedContent } from '../../types';
import { buildActiveDatingSharedState } from './buildDatingSharedState';

function createGeneratedContent(overrides: Partial<DatingGeneratedContent> = {}): DatingGeneratedContent {
  return {
    background: {
      source: 'character-avatar',
      image: '',
      atmosphere: '',
      focus: '',
    },
    narrative: {
      title: '夜里散步',
      segments: [
        {
          type: 'narration',
          text: '她朝你靠近半步，又像是忍住了什么。',
        },
      ],
    },
    status: {
      location: '街角',
      time: '晚上',
      mood: '克制但在升温',
      innerThought: '',
    },
    playlist: [],
    ...overrides,
  };
}

function createSession(overrides: Partial<DateSession> = {}): DateSession {
  return {
    id: 'dating-shared-state',
    characterId: 'char-1',
    location: '街角',
    scenario: '散步',
    mood: '暧昧',
    backgroundScene: '',
    messages: [],
    timestamp: 1000,
    status: 'active',
    generatedContent: createGeneratedContent(),
    ...overrides,
  };
}

test('buildActiveDatingSharedState skips special directive sessions so they do not flow back into direct chat', () => {
  const session = createSession({
    directorInstruction: '暂停主线，生成一个番外小剧场。',
    generatedContent: createGeneratedContent({
      appliedDirectorInstruction: '暂停主线，生成一个番外小剧场。',
    }),
  });

  assert.equal(buildActiveDatingSharedState(session), undefined);
});

test('buildActiveDatingSharedState also respects an explicit block tag on generated content', () => {
  const session = createSession({
    generatedContent: createGeneratedContent({
      memoryWritebackPolicy: 'block',
    }),
  });

  assert.equal(buildActiveDatingSharedState(session), undefined);
});

test('buildActiveDatingSharedState still exposes ordinary in-progress dating carryover', () => {
  const state = buildActiveDatingSharedState(createSession());

  assert.equal(Boolean(state), true);
  assert.equal(state?.status, 'active');
  assert.match(state?.summary || '', /未结束的线下约会/);
});
