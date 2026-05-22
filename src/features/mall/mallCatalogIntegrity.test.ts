import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMallData } from './defaultMallData';
import {
  isSuspectedMojibakeMallItem,
  isSuspectedMojibakeText,
  sanitizeMallCatalogSource,
} from './mallCatalogIntegrity';

test('isSuspectedMojibakeText distinguishes obvious mojibake from normal chinese copy', () => {
  assert.equal(isSuspectedMojibakeText('鏌旀钀借偐鐭'), true);
  assert.equal(isSuspectedMojibakeText('柔棉落肩短袖'), false);
});

test('sanitizeMallCatalogSource keeps known ids but drops suspicious unknown entries', () => {
  const fallback = createDefaultMallData().catalog;
  const sanitized = sanitizeMallCatalogSource([
    fallback[0],
    {
      ...fallback[0],
      id: 'broken-custom-item',
      title: '鍙瓨鍦ㄤ簬鏈湴鐨勯澶栧晢鍝?',
      category: '鍏卞悓绌洪棿',
      copy: {
        ...fallback[0].copy,
        cardBlurb: '鏇撮€傚悎鍦ㄦ埧闂撮噷鎱㈡參鐢ㄨ捣鏉?',
      },
    },
  ], fallback);

  assert.equal(sanitized?.some((item) => item.id === fallback[0].id), true);
  assert.equal(sanitized?.some((item) => item.id === 'broken-custom-item'), false);
  assert.equal(isSuspectedMojibakeMallItem({
    ...fallback[0],
    title: '鏌旀钀借偐鐭',
  }), true);
});
