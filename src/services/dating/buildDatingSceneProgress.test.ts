import assert from 'node:assert/strict';
import test from 'node:test';
import type { DateSession, DatingGeneratedContent } from '../../types';
import {
  buildDatingSceneProgress,
  buildDatingSceneProgressSummary,
  formatDatingSceneProgressForPrompt,
} from './buildDatingSceneProgress';

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
    id: 'date-progress-test',
    characterId: 'char-date',
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
    status: 'active',
  };
}

test('buildDatingSceneProgress detects repeated progression signatures', () => {
  const session = createSession([
    createGeneratedContent([
      '她靠近了一点，没有立刻移开视线，只是停在你呼吸能碰到的距离。',
      '别这样看着我。',
    ], '还是没把真正想说的话说出口。'),
    createGeneratedContent([
      '她又向你靠近半步，目光停在你脸上，像是在等你先给出反应。',
      '你再这样，我真的会当真。',
    ], '她还是忍着没把下一步直接做出来。'),
  ]);

  const progress = buildDatingSceneProgress(session);

  assert.equal(progress.repeatedSignature, true);
  assert.match(progress.currentSignature, /靠近|对视/);
  assert.ok(progress.bannedRepeatActions.length > 0);
  assert.ok(progress.nextStepOptions.length > 0);
  assert.ok(progress.unresolvedTension);
  assert.match(formatDatingSceneProgressForPrompt(progress), /本轮禁止重复/);
  assert.match(formatDatingSceneProgressForPrompt(progress), /强约束/);
});

test('buildDatingSceneProgressSummary compresses current scene progress for shared state', () => {
  const session = createSession([
    createGeneratedContent([
      '她把外套递给你，手指轻轻碰到你的手背。',
      '先披上，别嘴硬。',
    ]),
  ]);

  const summary = buildDatingSceneProgressSummary(buildDatingSceneProgress(session));
  assert.match(summary, /本轮推进阶段/);
  assert.match(summary, /最近推进/);
});
