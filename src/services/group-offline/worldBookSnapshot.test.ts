import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupOfflineRecruitDraft, GroupOfflineSession, WorldBookEntry } from '../../types';
import {
  buildGroupOfflineWorldBookSnapshot,
  resolveGroupOfflineWorldBookSnapshot,
} from './worldBookSnapshot';

function createWorldBook(id: string, title: string, content: string): WorldBookEntry {
  return {
    id,
    title,
    content,
    category: 'group',
    isActive: true,
    isGlobal: true,
    summary: `${title} summary`,
  };
}

test('buildGroupOfflineWorldBookSnapshot clones entries instead of reusing live objects', () => {
  const source = [createWorldBook('wb-1', '夜港规则', '原始内容')];
  const snapshot = buildGroupOfflineWorldBookSnapshot(source);

  source[0].content = '外部改掉的版本';

  assert.equal(snapshot[0]?.content, '原始内容');
  assert.notEqual(snapshot[0], source[0]);
});

test('resolveGroupOfflineWorldBookSnapshot prefers stored session snapshot over current active world books', () => {
  const session = {
    selectedWorldBookIds: ['wb-1'],
    worldBookSnapshot: [createWorldBook('wb-1', '夜港规则', '开局时的版本')],
  } as Pick<GroupOfflineSession, 'selectedWorldBookIds' | 'worldBookSnapshot'>;
  const activeWorldBooks = [createWorldBook('wb-1', '夜港规则', '后来被改掉的版本')];

  const resolved = resolveGroupOfflineWorldBookSnapshot(session, activeWorldBooks);

  assert.equal(resolved[0]?.content, '开局时的版本');
});

test('resolveGroupOfflineWorldBookSnapshot can rebuild a draft snapshot from selected ids', () => {
  const draft = {
    selectedWorldBookIds: ['wb-2'],
  } as Pick<GroupOfflineRecruitDraft, 'selectedWorldBookIds' | 'worldBookSnapshot'>;
  const activeWorldBooks = [
    createWorldBook('wb-1', '普通设定', 'A'),
    createWorldBook('wb-2', '锁定设定', 'B'),
  ];

  const resolved = resolveGroupOfflineWorldBookSnapshot(draft, activeWorldBooks);

  assert.deepEqual(resolved.map((entry) => entry.id), ['wb-2']);
});
