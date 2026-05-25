import assert from 'node:assert/strict';
import test from 'node:test';
import { createGroupConversationPlan } from './groupConversationPlan';

test('stop_followups does not schedule extra automatic follow-up speakers', () => {
  const plan = createGroupConversationPlan({
    trigger: 'auto',
    intent: { kind: 'stop_followups' },
    memberCount: 5,
  });

  assert.deepEqual(plan, {
    targetCount: 1,
    maxFollowUpDepth: 0,
  });
});

test('force_targets limits total speakers to the mentioned target count', () => {
  const plan = createGroupConversationPlan({
    trigger: 'auto',
    intent: { kind: 'force_targets', targetIds: ['a', 'b'] },
    memberCount: 6,
    forcedSpeakerCount: 2,
  });

  assert.deepEqual(plan, {
    targetCount: 2,
    maxFollowUpDepth: 1,
  });
});

test('force_all_members does not overshoot the full-room target count', () => {
  const plan = createGroupConversationPlan({
    trigger: 'auto',
    intent: { kind: 'force_all_members' },
    memberCount: 4,
    forcedSpeakerCount: 4,
  });

  assert.deepEqual(plan, {
    targetCount: 4,
    maxFollowUpDepth: 3,
  });
});
