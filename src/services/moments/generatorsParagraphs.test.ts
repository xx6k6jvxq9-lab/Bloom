import assert from 'node:assert/strict';
import test from 'node:test';
import { rebalanceMomentParagraphs } from './generators';

test('rebalanceMomentParagraphs preserves meaningful single-line breaks for non-short shapes', () => {
  const output = rebalanceMomentParagraphs(
    [
      '刚洗完手，指尖那股创药水味儿还没散。',
      '现在的客人都没长嘴是吧？',
      '最后半罐红牛也见底了。',
    ].join('\n'),
    'tiny_complaint',
  );

  assert.match(output, /\n\n/);
});

test('rebalanceMomentParagraphs auto-splits medium-long complaint text instead of flattening it', () => {
  const output = rebalanceMomentParagraphs(
    '刚洗完手，指尖那股创药水味儿还没散，闻久了想吐。现在的客人都没长嘴是吧？非得让我猜，猜不对还摆脸色，真想直接拿针扎深两毫米让他们清醒清醒。最后半罐红牛也见底了。唉。要是有人现在能命令我滚去睡觉，我大概会表现得像个好人。',
    'tiny_complaint',
  );

  assert.match(output, /\n\n/);
});

test('rebalanceMomentParagraphs still keeps short_status flattened', () => {
  const output = rebalanceMomentParagraphs(
    '第一句。\n第二句。',
    'short_status',
  );

  assert.equal(output.includes('\n\n'), false);
});
