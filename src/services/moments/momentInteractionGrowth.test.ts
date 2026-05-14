import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, MomentComment, MomentItem } from '../../types';
import { applyMomentInteractionGrowth } from './momentInteractionGrowth';

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

function createComment(overrides: Partial<MomentComment> = {}): MomentComment {
  return {
    id: 'comment',
    authorId: 'user',
    content: 'comment',
    timestamp: Date.now(),
    ...overrides,
  };
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

test('top-level character comment on another character moment promotes pair to aware via moment growth', () => {
  const author = createCharacter({ id: 'author', name: 'Author' });
  const commenter = createCharacter({ id: 'commenter', name: 'Commenter' });
  const comment = createComment({ authorId: commenter.id, content: 'first public comment' });
  const nextCharacters = applyMomentInteractionGrowth({
    characters: [author, commenter],
    moment: createMoment({
      authorId: author.id,
      comments: [comment],
    }),
    newComment: comment,
  });

  const nextAuthorHint = nextCharacters.find((character) => character.id === author.id)
    ?.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === commenter.id);
  const nextCommenterHint = nextCharacters.find((character) => character.id === commenter.id)
    ?.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === author.id);

  assert.equal(nextAuthorHint?.familiarity, 'aware');
  assert.equal(nextCommenterHint?.familiarity, 'aware');
  assert.equal(nextAuthorHint?.source, 'moment_growth');
  assert.equal(nextCommenterHint?.source, 'moment_growth');
});

test('multi-turn direct replies can promote aware pairs to familiar', () => {
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: [{
      targetCharacterId: 'commenter',
      familiarity: 'aware',
      source: 'moment_growth',
      updatedAt: 1,
    }],
  });
  const commenter = createCharacter({
    id: 'commenter',
    name: 'Commenter',
    publicThreadPeerHints: [{
      targetCharacterId: 'author',
      familiarity: 'aware',
      source: 'moment_growth',
      updatedAt: 1,
    }],
  });
  const topLevel = createComment({ id: 'c1', authorId: commenter.id, content: 'first comment' });
  const authorReply = createComment({
    id: 'c2',
    authorId: author.id,
    replyToCommentId: topLevel.id,
    replyToAuthorId: commenter.id,
    replyToAuthorName: commenter.name,
    content: 'reply back',
  });
  const commenterReply = createComment({
    id: 'c3',
    authorId: commenter.id,
    replyToCommentId: authorReply.id,
    replyToAuthorId: author.id,
    replyToAuthorName: author.name,
    content: 'reply again',
  });
  const nextCharacters = applyMomentInteractionGrowth({
    characters: [author, commenter],
    moment: createMoment({
      authorId: author.id,
      comments: [topLevel, authorReply, commenterReply],
    }),
    newComment: commenterReply,
  });

  const nextAuthorHint = nextCharacters.find((character) => character.id === author.id)
    ?.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === commenter.id);

  assert.equal(nextAuthorHint?.familiarity, 'familiar');
  assert.equal(nextAuthorHint?.source, 'moment_growth');
});

test('manual public-thread hints are not overwritten by automatic moment growth', () => {
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: [{
      targetCharacterId: 'commenter',
      familiarity: 'stranger',
      source: 'manual',
      note: 'keep distance',
      updatedAt: 1,
    }],
  });
  const commenter = createCharacter({ id: 'commenter', name: 'Commenter' });
  const comment = createComment({ authorId: commenter.id, content: 'first public comment' });

  const nextCharacters = applyMomentInteractionGrowth({
    characters: [author, commenter],
    moment: createMoment({
      authorId: author.id,
      comments: [comment],
    }),
    newComment: comment,
  });

  const nextAuthorHint = nextCharacters.find((character) => character.id === author.id)
    ?.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === commenter.id);

  assert.equal(nextAuthorHint?.familiarity, 'stranger');
  assert.equal(nextAuthorHint?.source, 'manual');
  assert.equal(nextAuthorHint?.note, 'keep distance');
});
