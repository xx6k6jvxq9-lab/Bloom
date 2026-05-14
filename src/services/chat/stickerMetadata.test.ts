import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAutoStickerMetadata,
  buildStickerMetadataSemanticText,
  normalizeStickerMetadata,
} from './stickerMetadata';

test('buildAutoStickerMetadata expands inferred label into aliases and traits', () => {
  const metadata = buildAutoStickerMetadata('sob-tears-sticker.png');

  assert.equal(metadata?.label, '大哭');
  assert.equal(metadata?.aliases?.includes('哭哭'), true);
  assert.equal(metadata?.traits?.includes('sad'), true);
  assert.equal(metadata?.category, 'emotion');
});

test('buildStickerMetadataSemanticText keeps label aliases and traits together', () => {
  const text = buildStickerMetadataSemanticText({
    'sticker-a': {
      label: '委屈',
      aliases: ['可怜', '来哄我'],
      traits: ['sad', 'comfort'],
      caption: '一只狗坐在工位前，看起来快没电了。',
      ocrText: '没救了',
    },
  }, 'sticker-a');

  assert.match(text, /委屈/);
  assert.match(text, /可怜/);
  assert.match(text, /comfort/);
  assert.match(text, /没救了/);
});

test('normalizeStickerMetadata rejects url-like labels', () => {
  const metadata = normalizeStickerMetadata({
    label: 'https://img.heliar.top/file/1773930.png',
    aliases: ['抱抱'],
    category: 'relationship',
  });

  assert.equal(metadata?.label, undefined);
  assert.equal(metadata?.aliases?.includes('抱抱'), true);
  assert.equal(metadata?.category, 'relationship');
});
