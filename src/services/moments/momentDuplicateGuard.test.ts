import test from 'node:test';
import { buildRecentMomentAvoidanceLines, findSimilarRecentMoment } from './momentDuplicateGuard';

test('findSimilarRecentMoment catches exact duplicate posts across authors', () => {
  const hit = findSimilarRecentMoment({
    content: '窗外的天色还在，今天先记这一点。',
    moments: [
      {
        id: 'moment-1',
        authorId: 'role-a',
        content: '窗外的天色还在，今天先记这一点。',
        timestamp: Date.now() - 10_000,
      },
    ],
    now: Date.now(),
  });

  assert.equal(hit?.reason, 'exact');
  assert.equal(hit?.authorId, 'role-a');
});

test('findSimilarRecentMoment ignores clearly different posts', () => {
  const hit = findSimilarRecentMoment({
    content: '今天在楼下买到一杯还热着的豆浆。',
    moments: [
      {
        id: 'moment-1',
        authorId: 'role-a',
        content: '耳机里的那首歌循环到第三遍，人才慢慢安静下来。',
        timestamp: Date.now() - 10_000,
      },
    ],
    now: Date.now(),
  });

  assert.equal(hit, null);
});

test('buildRecentMomentAvoidanceLines summarizes recent feed previews', () => {
  const lines = buildRecentMomentAvoidanceLines([
    {
      id: 'moment-1',
      authorId: 'role-a',
      content: '手机屏幕还在眼前，情绪也还没完全落下去。',
      timestamp: 2,
    },
    {
      id: 'moment-2',
      authorId: 'role-b',
      content: '窗外的天色还在，今天先记这一点。',
      timestamp: 1,
    },
  ]);

  assert.equal(lines.length >= 2, true);
  assert.match(lines[0] || '', /最近公开动态预览/);
});
