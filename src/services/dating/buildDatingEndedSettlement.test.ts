import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, DateSession, DatingGeneratedContent } from '../../types';
import { buildDatingEndedSettlement } from './buildDatingEndedSettlement';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'char-date-settlement',
    name: overrides.name ?? '测试角色',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? '',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

function createGeneratedContent(texts: string[], innerThought = ''): DatingGeneratedContent {
  return {
    background: {
      source: 'character-avatar',
      image: '',
      atmosphere: '',
      focus: '',
    },
    narrative: {
      title: '约会片段',
      segments: texts.map((text, index) => ({
        type: index % 2 === 0 ? 'narration' : 'dialogue',
        text,
      })),
    },
    status: {
      location: '街角',
      time: '傍晚',
      mood: '暧昧',
      innerThought,
    },
    playlist: [],
  };
}

function createSession(rounds: DatingGeneratedContent[]): DateSession {
  return {
    id: 'date-settlement-test',
    characterId: 'char-date-settlement',
    location: '街角',
    scenario: '散步',
    mood: '暧昧',
    backgroundScene: '',
    generatedContent: rounds[rounds.length - 1],
    messages: rounds.map((content, index) => ({
      id: `round-${index + 1}`,
      role: 'model' as const,
      text: content.narrative.segments.map((segment) => segment.text).join('\n'),
      timestamp: 1000 + index,
      generatedContent: content,
    })),
    timestamp: 1000,
    status: 'ended',
    endedAt: 2000,
  };
}

test('buildDatingEndedSettlement carries scene progress into summary, snapshot and shared state', () => {
  const session = createSession([
    createGeneratedContent([
      '她靠近了一点，没有立刻移开视线。',
      '别这样看着我。',
    ], '还是没把真正想说的话说出口。'),
    createGeneratedContent([
      '她又向你靠近半步，目光停在你脸上。',
      '你再这样，我真的会当真。',
    ], '她还是忍着没把下一步直接做出来。'),
  ]);
  const character = createCharacter({
    shortTermSummary: '旧的短期摘要',
  });

  const settlement = buildDatingEndedSettlement(character, session);
  const latestSnapshot = settlement.sharedContextSnapshots[0];
  const sceneResidueSummary = latestSnapshot?.sceneResidue?.[0]?.summary || '';

  assert.match(settlement.shortTermSummary || '', /这场约会推进到的阶段/);
  assert.match(sceneResidueSummary, /这场约会推进到的阶段/);
  assert.match(sceneResidueSummary, /最近推进/);
  assert.match(settlement.sharedState?.privateCarryover || '', /这场约会推进到的阶段/);
});
