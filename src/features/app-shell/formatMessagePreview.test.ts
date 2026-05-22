import assert from 'node:assert/strict';
import test from 'node:test';
import { formatChatMessagePreview, formatMessagePreview, sanitizePreviewText } from './formatMessagePreview';

test('sanitizePreviewText strips encoded html tags after decoding entities', () => {
  const raw = '&lt;summary style=&quot;font-size: 1.2em; font-weight: 600;&quot;&gt;\u6d4b\u8bd5\u6458\u8981&lt;/summary&gt;';

  assert.equal(sanitizePreviewText(raw), '\u6d4b\u8bd5\u6458\u8981');
});

test('formatMessagePreview does not leak encoded summary tags into chat list preview', () => {
  const raw = '&lt;summary style=&quot;font-size: 1.2em; font-weight: 600;&quot;&gt;\u6d4b\u8bd5\u6458\u8981&lt;/summary&gt;';

  assert.equal(formatMessagePreview(raw), '\u6d4b\u8bd5\u6458\u8981');
});

test('formatChatMessagePreview keeps mall-card previews out of structured text', () => {
  assert.equal(
    formatChatMessagePreview({
      role: 'user',
      text: '&lt;summary style=&quot;font-size: 1.2em; font-weight: 600;&quot;&gt;\u6d4b\u8bd5\u6458\u8981&lt;/summary&gt;',
      sharedMallItem: {
        id: 'mall-item-1',
        title: '\u6d4b\u8bd5\u5546\u54c1',
        category: '\u6d4b\u8bd5\u5206\u7c7b',
        price: 99,
        blurb: '\u6d4b\u8bd5\u7b80\u4ecb',
      },
    }),
    '[\u95ee\u95eeTA] \u6d4b\u8bd5\u5546\u54c1',
  );
});
