import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldBookEntry } from '../../types';
import { mergeImportedWorldBooksIntoLibrary } from './worldBookMerge';

function createWorldBook(overrides: Partial<WorldBookEntry>): WorldBookEntry {
  return {
    id: 'world-book',
    title: 'World Book',
    content: 'Default content.',
    category: '世界设定',
    priorityLevel: 'normal',
    isActive: true,
    isGlobal: true,
    ...overrides,
  };
}

test('mergeImportedWorldBooksIntoLibrary updates existing entries instead of duplicating exact content when metadata gets stronger', () => {
  const existing = [
    createWorldBook({
      id: 'campus-rules',
      title: '校园守则',
      content: '夜里十点后只能从东门进出。',
      category: '规则禁忌',
      priorityLevel: 'low',
      pinMode: 'none',
    }),
  ];
  const incoming = [
    createWorldBook({
      id: 'import-copy',
      title: '校园守则',
      content: '夜里十点后只能从东门进出。',
      category: '规则禁忌',
      priorityLevel: 'critical',
      pinMode: 'always',
    }),
  ];

  const result = mergeImportedWorldBooksIntoLibrary(existing, incoming);

  assert.equal(result.entries.length, 1);
  assert.equal(result.stats.insertedCount, 0);
  assert.equal(result.stats.updatedCount, 1);
  assert.equal(result.stats.skippedCount, 0);
  assert.equal(result.entries[0].id, 'campus-rules');
  assert.equal(result.entries[0].priorityLevel, 'critical');
  assert.equal(result.entries[0].pinMode, 'always');
});

test('mergeImportedWorldBooksIntoLibrary keeps the more complete version for same-title subset imports', () => {
  const existing = [
    createWorldBook({
      id: 'harbor-map',
      title: '港区地理',
      content: '港区分成东码头、西码头和旧灯塔三块区域。',
      category: '地点设定',
    }),
  ];
  const incoming = [
    createWorldBook({
      id: 'harbor-map-import',
      title: '港区地理',
      content: [
        '港区分成东码头、西码头和旧灯塔三块区域。',
        '旧灯塔旁边有一条只在退潮时出现的小路。',
      ].join('\n'),
      category: '地点设定',
    }),
  ];

  const result = mergeImportedWorldBooksIntoLibrary(existing, incoming);

  assert.equal(result.entries.length, 1);
  assert.equal(result.stats.updatedCount, 1);
  assert.match(result.entries[0].content, /旧灯塔旁边/);
  assert.equal(result.entries[0].id, 'harbor-map');
});

test('mergeImportedWorldBooksIntoLibrary collapses duplicate entries within the same import batch', () => {
  const incoming = [
    createWorldBook({
      id: 'late-night-rule-a',
      title: '夜巡规则',
      content: '广播站值夜时不能提任何人的真名。',
      category: '规则禁忌',
    }),
    createWorldBook({
      id: 'late-night-rule-b',
      title: '夜巡规则',
      content: '广播站值夜时不能提任何人的真名。',
      category: '规则禁忌',
    }),
  ];

  const result = mergeImportedWorldBooksIntoLibrary([], incoming);

  assert.equal(result.entries.length, 1);
  assert.equal(result.stats.insertedCount, 1);
  assert.equal(result.stats.updatedCount, 0);
  assert.equal(result.stats.skippedCount, 1);
});
