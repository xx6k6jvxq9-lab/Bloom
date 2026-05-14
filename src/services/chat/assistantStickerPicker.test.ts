import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAssistantStickerPromptSection,
  resolveAssistantStickerCandidates,
} from './assistantStickerPicker';

test('resolveAssistantStickerCandidates prefers metadata-rich stickers for matching context', () => {
  const candidates = resolveAssistantStickerCandidates(
    ['a.png', 'b.png'],
    {
      latestUserText: '快来哄我，我现在真的有点委屈',
      stickerMetadataMap: {
        'a.png': {
          label: '委屈',
          category: 'emotion',
          aliases: ['可怜', '来哄我'],
          traits: ['sad', 'comfort'],
        },
        'b.png': {
          label: '开心',
          category: 'reaction',
        },
      },
    },
  );

  assert.equal(candidates[0]?.sticker, 'a.png');
  assert.equal(candidates[0]?.label, '委屈');
});

test('buildAssistantStickerPromptSection exposes aliases and encourages use when top fit is strong', () => {
  const section = buildAssistantStickerPromptSection(
    ['a.png'],
    {
      latestUserText: '快来哄我，我真的委屈死了',
      stickerMetadataMap: {
        'a.png': {
          label: '委屈',
          category: 'emotion',
          aliases: ['可怜', '来哄我'],
          traits: ['sad', 'comfort'],
        },
      },
    },
  );

  assert.match(section, /委屈/);
  assert.match(section, /可怜/);
  assert.match(section, /comfort/);
  assert.match(section, /using exactly one fitting sticker is a good option/i);
});

test('pickAssistantSticker rotates within the same label cluster instead of repeating the exact same sticker', () => {
  const first = resolveAssistantStickerCandidates(
    ['a.png', 'b.png'],
    {
      latestUserText: '快来哄我，我真的委屈死了',
      stickerMetadataMap: {
        'a.png': { label: '委屈', category: 'emotion', aliases: ['可怜'], traits: ['sad', 'comfort'] },
        'b.png': { label: '委屈', category: 'emotion', aliases: ['来哄我'], traits: ['sad', 'comfort'] },
      },
    },
  )[0];

  const rotated = resolveAssistantStickerCandidates(
    ['a.png', 'b.png'],
    {
      latestUserText: '快来哄我，我真的委屈死了',
      recentStickerRefs: [first?.sticker || 'a.png'],
      recentStickerLabels: ['委屈'],
      stickerMetadataMap: {
        'a.png': { label: '委屈', category: 'emotion', aliases: ['可怜'], traits: ['sad', 'comfort'] },
        'b.png': { label: '委屈', category: 'emotion', aliases: ['来哄我'], traits: ['sad', 'comfort'] },
      },
    },
  );

  assert.equal(rotated[0]?.sticker, 'b.png');
});
