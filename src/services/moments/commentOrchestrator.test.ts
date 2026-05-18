import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, MomentComment, MomentItem } from '../../types';
import { pickPrimaryMomentReplyResponder, resolveMomentAuthorReplyPolicy } from './commentOrchestrator';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    ...overrides,
  } as Character;
}

function createMoment(overrides: Partial<MomentItem> = {}): MomentItem {
  return {
    id: 'moment',
    authorId: 'user',
    visibilityScope: 'known_network',
    content: 'content',
    timestamp: Date.now(),
    likes: 0,
    comments: [],
    ...overrides,
  };
}

function createComment(overrides: Partial<MomentComment> = {}): MomentComment {
  return {
    id: 'comment',
    authorId: 'user',
    content: 'comment',
    timestamp: Date.now(),
    ...overrides,
  };
}

test('user comment on a character moment always picks the moment author as the primary responder', () => {
  const author = createCharacter({ id: 'author', name: 'Author' });
  const familiarPeer = createCharacter({
    id: 'peer',
    name: 'Peer',
    publicThreadPeerHints: [{
      targetCharacterId: author.id,
      familiarity: 'familiar',
      source: 'manual',
      updatedAt: 1,
    }],
  });
  const triggerComment = createComment({ authorId: 'user', content: '来回我一下' });

  const primaryResponder = pickPrimaryMomentReplyResponder({
    moment: createMoment({ authorId: author.id }),
    characters: [author, familiarPeer],
    triggerComment,
  });

  assert.equal(resolveMomentAuthorReplyPolicy({
    moment: createMoment({ authorId: author.id }),
    characters: [author, familiarPeer],
    triggerComment,
  }), 'author');
  assert.equal(primaryResponder?.id, author.id);
});

test('non-user comments still fall back to the normal responder selection', () => {
  const author = createCharacter({
    id: 'author',
    name: 'Author',
  });
  const triggerComment = createComment({ authorId: 'peer', content: '接一下' });

  const primaryResponder = pickPrimaryMomentReplyResponder({
    moment: createMoment({ authorId: author.id }),
    characters: [author],
    triggerComment,
  });

  assert.equal(resolveMomentAuthorReplyPolicy({
    moment: createMoment({ authorId: author.id }),
    characters: [author],
    triggerComment,
  }), 'normal');
  assert.equal(primaryResponder?.id, author.id);
});

test('low-signal user comments on character moments can skip the forced author reply', () => {
  const author = createCharacter({ id: 'author', name: 'Author' });
  const triggerComment = createComment({ authorId: 'user', content: '哈哈' });
  const moment = createMoment({ authorId: author.id });

  assert.equal(resolveMomentAuthorReplyPolicy({
    moment,
    characters: [author],
    triggerComment,
  }), 'skip');
  assert.equal(pickPrimaryMomentReplyResponder({
    moment,
    characters: [author],
    triggerComment,
  }), null);
});

test('days-later character moments can skip the forced author reply', () => {
  const author = createCharacter({ id: 'author', name: 'Author' });
  const triggerComment = createComment({ authorId: 'user', content: '现在才看到，还是想说一句。' });
  const moment = createMoment({
    authorId: author.id,
    timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000),
  });

  assert.equal(resolveMomentAuthorReplyPolicy({
    moment,
    characters: [author],
    triggerComment,
  }), 'skip');
  assert.equal(pickPrimaryMomentReplyResponder({
    moment,
    characters: [author],
    triggerComment,
  }), null);
});

test('once the author has already replied in the same thread, later user replies fall back to normal selection', () => {
  const author = createCharacter({ id: 'author', name: 'Author' });
  const topLevel = createComment({
    id: 'c1',
    authorId: 'user',
    content: '认真说一句',
  });
  const authorReply = createComment({
    id: 'c2',
    authorId: author.id,
    replyToCommentId: topLevel.id,
    replyToAuthorId: 'user',
    replyToAuthorName: 'User',
    content: '我看到了',
  });
  const userFollowup = createComment({
    id: 'c3',
    authorId: 'user',
    replyToCommentId: authorReply.id,
    replyToAuthorId: author.id,
    replyToAuthorName: author.name,
    content: '那我再补一句',
  });
  const moment = createMoment({
    authorId: author.id,
    comments: [topLevel, authorReply, userFollowup],
  });

  assert.equal(resolveMomentAuthorReplyPolicy({
    moment,
    characters: [author],
    triggerComment: userFollowup,
  }), 'normal');
});
