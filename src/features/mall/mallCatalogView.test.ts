import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMallData } from './defaultMallData';
import {
  getMallVisibleCategories,
  normalizeMallCategorySelection,
  sanitizeMallGeneratedShelfPlan,
} from './mallCatalogView';

test('normalizeMallCategorySelection respects the current home mode', () => {
  const catalog = createDefaultMallData().catalog;

  assert.equal(normalizeMallCategorySelection('家居', catalog, 'self'), '家居');
  assert.equal(normalizeMallCategorySelection('私密', catalog, 'self'), null);
  assert.equal(normalizeMallCategorySelection('私密', catalog, 'private'), '私密');
  assert.equal(normalizeMallCategorySelection('全部', catalog, 'gift'), '全部');
});

test('getMallVisibleCategories keeps private goods out of regular modes', () => {
  const catalog = createDefaultMallData().catalog;

  assert.equal(getMallVisibleCategories(catalog, 'self').includes('私密'), false);
  assert.equal(getMallVisibleCategories(catalog, 'private').includes('私密'), true);
});

test('sanitizeMallGeneratedShelfPlan rejects invalid categories and mode-mismatched items', () => {
  const catalog = createDefaultMallData().catalog;
  const selfItem = catalog.find((item) => item.category === '家居');
  const privateItem = catalog.find((item) => item.category === '私密');

  assert.ok(selfItem);
  assert.ok(privateItem);

  assert.equal(sanitizeMallGeneratedShelfPlan({
    title: '坏货架',
    description: '类目无效',
    itemIds: [selfItem!.id],
    categoryHint: '不存在的类目',
  }, catalog, 'self'), null);

  assert.equal(sanitizeMallGeneratedShelfPlan({
    title: '坏货架',
    description: '模式不匹配',
    itemIds: [privateItem!.id],
    categoryHint: '私密',
  }, catalog, 'self'), null);

  assert.deepEqual(sanitizeMallGeneratedShelfPlan({
    title: '正常货架',
    description: '会去重并保留有效类目',
    itemIds: [selfItem!.id, selfItem!.id],
    categoryHint: '家居',
  }, catalog, 'self'), {
    title: '正常货架',
    description: '会去重并保留有效类目',
    itemIds: [selfItem!.id],
    categoryHint: '家居',
  });
});
