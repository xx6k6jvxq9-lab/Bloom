import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMallData } from '../mall/defaultMallData';
import { hydrateMallData } from './mallDataStore';

test('hydrateMallData prefers fallback catalog copy for known items while keeping clean unknown ids', () => {
  const fallback = createDefaultMallData();
  const persisted = {
    catalog: [
      {
        ...fallback.catalog[0],
        title: '鏌旀钀借偐鐭',
        category: '鐢疯',
      },
      {
        ...fallback.catalog[1],
        title: '鏉＄汗灞呭鐫¤。濂楄',
        category: '鐫＄湢',
      },
      {
        ...fallback.catalog[0],
        id: 'custom-item',
        title: '只存在于本地的额外商品',
      },
    ],
  };

  const hydrated = hydrateMallData(persisted, fallback);

  assert.equal(hydrated.catalog.find((item) => item.id === fallback.catalog[0].id)?.title, '柔棉落肩短袖');
  assert.equal(hydrated.catalog.find((item) => item.id === fallback.catalog[0].id)?.category, '男装');
  assert.equal(hydrated.catalog.find((item) => item.id === fallback.catalog[1].id)?.title, '条纹居家睡衣套装');
  assert.equal(hydrated.catalog.find((item) => item.id === 'custom-item')?.title, '只存在于本地的额外商品');
});

test('hydrateMallData drops suspicious mojibake-only unknown catalog entries during startup cleanup', () => {
  const fallback = createDefaultMallData();
  const hydrated = hydrateMallData({
    catalog: [
      {
        ...fallback.catalog[0],
      },
      {
        ...fallback.catalog[0],
        id: 'broken-custom-item',
        title: '鍙瓨鍦ㄤ簬鏈湴鐨勯澶栧晢鍝?',
        category: '鍏卞悓绌洪棿',
        copy: {
          ...fallback.catalog[0].copy,
          cardBlurb: '鏇撮€傚悎鍦ㄦ埧闂撮噷鎱㈡參鐢ㄨ捣鏉?',
        },
      },
    ],
  }, fallback);

  assert.equal(hydrated.catalog.some((item) => item.id === 'broken-custom-item'), false);
  assert.equal(hydrated.catalog.some((item) => item.id === fallback.catalog[0].id), true);
});
