import assert from 'node:assert/strict';
import test from 'node:test';
import type { MallCatalogItem } from '../../types';
import {
  createCoupleSpaceSharedMallItem,
  removeCoupleSpaceSharedMallItem,
  resolveMallOwnedOwnership,
  supportsMallSharedSpacePlacement,
  upsertCoupleSpaceSharedMallItems,
} from './mallSharedSpace';

function createMallItem(overrides: Partial<MallCatalogItem> = {}): MallCatalogItem {
  return {
    id: 'mall-item-candle',
    title: '白茶香氛蜡烛',
    category: '家居',
    price: 89,
    tags: ['香氛'],
    sensitivity: 'normal',
    destinationKinds: ['self', 'shared_space'],
    isDisplayable: true,
    media: {
      fallbackEmoji: '🕯️',
      fallbackIcon: 'package',
      backgroundPreset: 'warm-amber',
      accentColor: '#d2a56a',
    },
    copy: {
      cardBlurb: '适合放在共同空间。',
      detailDescription: '测试描述。',
    },
    ...overrides,
  };
}

test('supportsMallSharedSpacePlacement follows destinationKinds', () => {
  assert.equal(supportsMallSharedSpacePlacement(createMallItem()), true);
  assert.equal(
    supportsMallSharedSpacePlacement(createMallItem({ destinationKinds: ['self'] })),
    false,
  );
});

test('resolveMallOwnedOwnership returns shared-space capable decor to self before placement', () => {
  assert.equal(resolveMallOwnedOwnership(createMallItem()), 'self');
  assert.equal(resolveMallOwnedOwnership(createMallItem({ isWearable: true })), 'wardrobe');
  assert.equal(
    resolveMallOwnedOwnership(createMallItem({ destinationKinds: ['digital'] })),
    'digital',
  );
});

test('createCoupleSpaceSharedMallItem keeps a reusable mall snapshot', () => {
  const entry = createCoupleSpaceSharedMallItem(createMallItem(), {
    sourceOrderId: 'order-1',
    sourceOwnedItemId: 'owned-1',
    placedAt: 123,
  });

  assert.equal(entry.itemId, 'mall-item-candle');
  assert.equal(entry.snapshot.title, '白茶香氛蜡烛');
  assert.equal(entry.sourceOrderId, 'order-1');
  assert.equal(entry.sourceOwnedItemId, 'owned-1');
  assert.equal(entry.placedAt, 123);
});

test('upsertCoupleSpaceSharedMallItems replaces duplicate source-owned entries', () => {
  const first = createCoupleSpaceSharedMallItem(createMallItem(), {
    sourceOwnedItemId: 'owned-1',
    placedAt: 100,
  });
  const second = createCoupleSpaceSharedMallItem(createMallItem({ title: '新摆件' }), {
    sourceOwnedItemId: 'owned-1',
    placedAt: 200,
  });

  assert.deepEqual(upsertCoupleSpaceSharedMallItems([first], second), [second]);
});

test('removeCoupleSpaceSharedMallItem drops the selected shared entry', () => {
  const first = createCoupleSpaceSharedMallItem(createMallItem(), { placedAt: 100 });
  const second = createCoupleSpaceSharedMallItem(createMallItem({ id: 'mall-item-lamp' }), { placedAt: 200 });

  assert.deepEqual(removeCoupleSpaceSharedMallItem([first, second], first.id), [second]);
});
