import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldBookEntry } from '../../types';
import { applyDerivedWorldBookMetadata } from './worldBookDerived';
import { buildBudgetedWorldBookPrompt, buildWorldBookPromptDiagnostics } from './worldBookBudget';

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

test('applyDerivedWorldBookMetadata derives compact overview fields from imported world books', () => {
  const entry = applyDerivedWorldBookMetadata(createWorldBook({
    id: 'campus-rules',
    title: '校园守则',
    category: '规则禁忌',
    priorityLevel: 'critical',
    content: [
      '学生会统筹校园秩序，广播站负责每天傍晚的闭校提醒。',
      '- 绝不能在广播站提及任何人的真名。',
      '- 夜里十点后只能从东门进出。',
    ].join('\n'),
  }));

  assert.match(entry.summary || '', /学生会统筹校园秩序/);
  assert.ok(entry.mustReadFacts?.some((fact) => /真名/.test(fact)));
  assert.ok(entry.mustReadFacts?.some((fact) => /东门/.test(fact)));
  assert.ok((entry.keywords || []).length > 0);
  assert.ok(entry.fingerprint?.includes('校园守则'));
});

test('buildBudgetedWorldBookPrompt keeps the full overview while still expanding relevant details', () => {
  const worldBooks = [
    applyDerivedWorldBookMetadata(createWorldBook({
      id: 'campus-rules',
      title: '校园守则',
      category: '规则禁忌',
      priorityLevel: 'critical',
      content: [
        '学生会统筹校园秩序，广播站负责每天傍晚的闭校提醒。',
        '- 绝不能在广播站提及任何人的真名。',
        '- 夜里十点后只能从东门进出。',
      ].join('\n'),
    })),
    applyDerivedWorldBookMetadata(createWorldBook({
      id: 'harbor-map',
      title: '港区地理',
      category: '地点设定',
      content: [
        '港区分成东码头、西码头和旧灯塔三块区域。',
        '旧灯塔旁边有一条只在退潮时出现的小路。',
      ].join('\n'),
    })),
  ];

  const prompt = buildBudgetedWorldBookPrompt(worldBooks, 'direct', {
    query: '广播站',
    recentText: ['今晚要去广播站值班吗'],
  }) || '';

  assert.match(prompt, /\[World Book Overview \/ Full Map\]/);
  assert.match(prompt, /校园守则/);
  assert.match(prompt, /港区地理/);
  assert.match(prompt, /\[World Book Must Read \/ Stable Rules\]/);
  assert.match(prompt, /真名/);
  assert.match(prompt, /\[World Book Details \/ Current Relevant Excerpts\]/);
  assert.match(prompt, /广播站/);
});

test('buildWorldBookPromptDiagnostics reports full injected layers instead of only detail excerpts', () => {
  const worldBooks = [
    applyDerivedWorldBookMetadata(createWorldBook({
      id: 'campus-rules',
      title: '校园守则',
      category: '规则禁忌',
      priorityLevel: 'critical',
      content: [
        '学生会统筹校园秩序，广播站负责每天傍晚的闭校提醒。',
        '- 绝不能在广播站提及任何人的真名。',
        '- 夜里十点后只能从东门进出。',
      ].join('\n'),
    })),
    applyDerivedWorldBookMetadata(createWorldBook({
      id: 'harbor-map',
      title: '港区地理',
      category: '地点设定',
      content: '港区分成东码头、西码头和旧灯塔三块区域。',
    })),
  ];

  const diagnostics = buildWorldBookPromptDiagnostics(worldBooks, 'direct', {
    query: '广播站',
    recentText: ['今晚去广播站值班'],
  });

  assert.equal(diagnostics.overviewCount, 2);
  assert.ok(diagnostics.overviewChars > 0);
  assert.ok(diagnostics.mustReadChars > 0);
  assert.ok(diagnostics.detailChars > 0);
  assert.ok(diagnostics.totalChars > diagnostics.detailChars);
  assert.equal(diagnostics.selectedCount, diagnostics.selected.length);
});
