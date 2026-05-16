import assert from 'node:assert/strict';
import test from 'node:test';
import type { DateSession, DatingGeneratedContent } from '../../types';
import {
  hasDatingSpecialDirectiveContent,
  resolveDatingWritebackPolicy,
  shouldWriteDatingMemoryBackToDirectChat,
} from './datingWritebackPolicy';

function createGeneratedContent(overrides: Partial<DatingGeneratedContent> = {}): DatingGeneratedContent {
  return {
    background: {
      source: 'character-avatar',
      image: '',
      atmosphere: '',
      focus: '',
    },
    narrative: {
      title: '测试约会',
      segments: [],
    },
    status: {
      location: '街角',
      time: '夜里',
      mood: '克制',
      innerThought: '',
    },
    playlist: [],
    ...overrides,
  };
}

function createSession(overrides: Partial<DateSession> = {}): DateSession {
  return {
    id: 'dating-writeback-policy',
    characterId: 'char-1',
    location: '街角',
    scenario: '散步',
    mood: '暧昧',
    backgroundScene: '',
    messages: [],
    timestamp: 1000,
    status: 'active',
    ...overrides,
  };
}

test('special directive content blocks direct-chat memory writeback even when it asks to merge into mainline', () => {
  const session = createSession({
    directorInstruction: '暂停主线，生成一个番外小剧场，但这次内容计入主线。',
    generatedContent: createGeneratedContent({
      appliedDirectorInstruction: '暂停主线，生成一个番外小剧场，但这次内容计入主线。',
      pageEpisode: {
        pageType: 'feed_post',
        platform: 'weibo',
        title: '微博页',
        canonMode: 'mainline',
        feed: {
          authorName: '测试角色',
          body: '正文',
          comments: [],
        },
      },
    }),
  });

  assert.equal(hasDatingSpecialDirectiveContent(session), true);
  assert.equal(resolveDatingWritebackPolicy(session), 'side_story');
  assert.equal(shouldWriteDatingMemoryBackToDirectChat(session), false);
});

test('explicit generated writeback policy wins even when directive text is gone later', () => {
  const session = createSession({
    generatedContent: createGeneratedContent({
      memoryWritebackPolicy: 'block',
    }),
  });

  assert.equal(hasDatingSpecialDirectiveContent(session), false);
  assert.equal(resolveDatingWritebackPolicy(session), 'side_story');
  assert.equal(shouldWriteDatingMemoryBackToDirectChat(session), false);
});

test('ordinary dating sessions without special directives can still write back to direct-chat memory', () => {
  const session = createSession({
    generatedContent: createGeneratedContent(),
  });

  assert.equal(hasDatingSpecialDirectiveContent(session), false);
  assert.equal(resolveDatingWritebackPolicy(session), 'mainline');
  assert.equal(shouldWriteDatingMemoryBackToDirectChat(session), true);
});
