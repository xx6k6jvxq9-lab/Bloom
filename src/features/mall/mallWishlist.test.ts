import assert from 'node:assert/strict';
import test from 'node:test';
import { isMallItemWishlisted, toggleMallWishlistItem } from './mallWishlist';

test('isMallItemWishlisted checks whether the item id exists', () => {
  assert.equal(isMallItemWishlisted(['item-a', 'item-b'], 'item-a'), true);
  assert.equal(isMallItemWishlisted(['item-a', 'item-b'], 'item-c'), false);
});

test('toggleMallWishlistItem prepends a newly wishlisted item', () => {
  assert.deepEqual(
    toggleMallWishlistItem(['item-a', 'item-b'], 'item-c'),
    ['item-c', 'item-a', 'item-b'],
  );
});

test('toggleMallWishlistItem removes an existing item cleanly', () => {
  assert.deepEqual(
    toggleMallWishlistItem(['item-a', 'item-b', 'item-c'], 'item-b'),
    ['item-a', 'item-c'],
  );
});

test('toggleMallWishlistItem dedupes stale duplicates while toggling on', () => {
  assert.deepEqual(
    toggleMallWishlistItem(['item-a', 'item-c', 'item-a'], 'item-b'),
    ['item-b', 'item-a', 'item-c'],
  );
});
