import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { buildMomentReadableMemoryView } from './momentMemoryVisibility';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    ...overrides,
  } as Character;
}

test('buildMomentReadableMemoryView keeps public residue while separating private afterglow', () => {
  const character = createCharacter({
    sharedState: {
      updatedAt: Date.now(),
      sourceScene: 'direct_chat',
      availability: 'recent',
      publicCarryover: '下班后情绪慢慢回温',
      privateCarryover: '刚被你哄好，还想抱着你不放',
    },
  });

  const view = buildMomentReadableMemoryView({
    character,
    shortTermSummary: '今天收工后有点累\n刚聊完，心里还是偏向你那边',
    longTermMemoryProfile: '平时会记生活碎片\n喜欢夜里散步和听歌',
  });

  assert.match(view.publicMemoryProfile || '', /平时会记生活碎片/);
  assert.match(view.publicMemoryProfile || '', /喜欢夜里散步和听歌/);
  assert.match(view.publicResidueSummary || '', /下班后情绪慢慢回温/);
  assert.match(view.publicResidueSummary || '', /今天收工后有点累/);
  assert.match(view.privateAfterglowSummary || '', /刚被你哄好/);
  assert.match(view.privateAfterglowSummary || '', /刚聊完/);
});

test('buildMomentReadableMemoryView keeps explicit user-directed memory out of public profile', () => {
  const character = createCharacter();

  const view = buildMomentReadableMemoryView({
    character,
    longTermMemoryProfile: '对你会明显偏心\n平时嘴硬但会记很多小事',
  });

  assert.doesNotMatch(view.publicMemoryProfile || '', /对你会明显偏心/);
  assert.match(view.publicMemoryProfile || '', /平时嘴硬但会记很多小事/);
  assert.match(view.privateAfterglowSummary || '', /对你会明显偏心/);
});
