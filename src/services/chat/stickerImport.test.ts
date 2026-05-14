import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractStickerImportEntriesFromJson,
  extractStickerImportEntriesFromText,
  mergeStickerImportEntries,
} from './stickerImport';

test('extractStickerImportEntriesFromText parses url plus metadata columns', () => {
  const entries = extractStickerImportEntriesFromText(
    'https://example.com/a.png | 委屈 | 可怜/来哄我 | sad, comfort | category: emotion',
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.sticker, 'https://example.com/a.png');
  assert.equal(entries[0]?.metadata?.label, '委屈');
  assert.equal(entries[0]?.metadata?.aliases?.includes('来哄我'), true);
  assert.equal(entries[0]?.metadata?.traits?.includes('comfort'), true);
  assert.equal(entries[0]?.metadata?.category, 'emotion');
});

test('extractStickerImportEntriesFromText can read markdown image labels', () => {
  const entries = extractStickerImportEntriesFromText(
    '![困困](https://example.com/sleepy.png)',
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.metadata?.label, '困困');
});

test('extractStickerImportEntriesFromJson parses structured sticker objects', () => {
  const entries = extractStickerImportEntriesFromJson([
    {
      url: 'https://example.com/a.png',
      label: '贴贴',
      category: 'relationship',
      aliases: ['抱抱', '靠近'],
      traits: ['affection', 'comfort'],
    },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.metadata?.label, '贴贴');
  assert.equal(entries[0]?.metadata?.category, 'relationship');
  assert.equal(entries[0]?.metadata?.aliases?.includes('抱抱'), true);
  assert.equal(entries[0]?.metadata?.traits?.includes('affection'), true);
});

test('mergeStickerImportEntries keeps imported metadata and existing stickers together', () => {
  const merged = mergeStickerImportEntries(
    ['https://example.com/existing.png'],
    {
      'https://example.com/existing.png': {
        label: '开心',
      },
    },
    [{
      sticker: 'https://example.com/a.png',
      metadata: {
        label: '委屈',
        aliases: ['可怜'],
        traits: ['sad'],
      },
    }],
  );

  assert.equal(merged.stickers.length, 2);
  assert.equal(merged.metadataMap?.['https://example.com/a.png']?.label, '委屈');
  assert.equal(merged.metadataMap?.['https://example.com/existing.png']?.label, '开心');
});
