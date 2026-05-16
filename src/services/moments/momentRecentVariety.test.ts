import assert from 'node:assert/strict';
import test from 'node:test';
import type { MomentItem } from '../../types';
import {
  analyzeRecentMomentVariety,
  buildRecentMomentShapeHints,
  buildRecentMomentVarietyPromptLines,
} from './momentRecentVariety';

function createMoment(timestamp: number, overrides: Partial<MomentItem> = {}): MomentItem {
  return {
    id: `moment-${timestamp}`,
    authorId: 'character',
    content: 'test',
    timestamp,
    likes: 0,
    comments: [],
    ...overrides,
  };
}

const LONG_MOMENT_TEXT = [
  '今天这一整天都像被拆成很多小段，走到现在才慢慢收回来一点。',
  '有些念头刚冒出来的时候还很吵，过一会儿又只剩一点余温留在身上。',
  '先记在这里，免得明天醒来又忘了自己今天到底是怎么过来的。',
].join('\n');

test('recent variety analysis detects long and visual streaks', () => {
  const profile = analyzeRecentMomentVariety([
    createMoment(3, {
      content: LONG_MOMENT_TEXT,
      imageCard: {
        title: 'a',
        description: 'a',
        theme: 'film',
      },
    }),
    createMoment(2, {
      content: LONG_MOMENT_TEXT,
      imageCard: {
        title: 'b',
        description: 'b',
        theme: 'film',
      },
    }),
  ]);

  assert.equal(profile.longStreak, 2);
  assert.equal(profile.visualStreak, 2);
  assert.equal(profile.latestOpeningRepeatCount >= 2, true);
});

test('recent variety shape hints keep the provided shape pool balanced', () => {
  const profile = analyzeRecentMomentVariety([
    createMoment(3, {
      content: LONG_MOMENT_TEXT,
      imageCard: {
        title: 'a',
        description: 'a',
        theme: 'film',
      },
    }),
    createMoment(2, {
      content: LONG_MOMENT_TEXT,
      imageCard: {
        title: 'b',
        description: 'b',
        theme: 'film',
      },
    }),
  ]);

  const hints = buildRecentMomentShapeHints({
    baseAllowedShapes: ['photo_dump', 'multi_paragraph', 'short_status', 'journal_note'],
    recentVariety: profile,
  });

  assert.equal(hints.forceTextOnly, undefined);
  assert.equal(hints.allowedShapes.includes('short_status'), true);
  assert.equal(hints.allowedShapes.includes('photo_dump'), true);
  assert.equal(hints.allowedShapes.includes('multi_paragraph'), true);
  assert.equal(hints.allowedShapes.includes('journal_note'), true);
  assert.equal(hints.blockedShapes, undefined);
  assert.equal(
    buildRecentMomentVarietyPromptLines(profile).some((line) => line.includes('不要硬禁长文')),
    true,
  );
  assert.equal(
    buildRecentMomentVarietyPromptLines(profile).some((line) => line.includes('图文和纯文字仍按正常概率选择')),
    true,
  );
});
