import assert from 'node:assert/strict';
import test from 'node:test';
import { hydrateMoments, type PersistedMoment } from './momentsStore';

function createPersistedMoment(overrides: Partial<PersistedMoment> = {}): PersistedMoment {
  return {
    id: 'moment',
    authorId: 'user',
    content: 'content',
    timestamp: Date.now(),
    likes: 0,
    comments: [],
    ...overrides,
  };
}

test('hydrateMoments backfills legacy user moments to contacts scope', () => {
  const hydrated = hydrateMoments([
    createPersistedMoment({
      id: 'legacy-user-moment',
      authorId: 'user',
    }),
  ], []);

  assert.equal(hydrated[0]?.visibilityScope, 'contacts');
});

test('hydrateMoments backfills legacy character moments to known_network scope and keeps explicit scope', () => {
  const hydrated = hydrateMoments([
    createPersistedMoment({
      id: 'legacy-character-moment',
      authorId: 'char-a',
    }),
    createPersistedMoment({
      id: 'explicit-mirror-moment',
      authorId: 'char-b',
      visibilityScope: 'forum_mirror',
    }),
  ], []);

  assert.equal(hydrated[0]?.visibilityScope, 'known_network');
  assert.equal(hydrated[1]?.visibilityScope, 'forum_mirror');
});
