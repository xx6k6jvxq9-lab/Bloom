import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatGroup } from '../../types';
import {
  buildRejectedJoinRequestCooldownPatch,
  buildRevealGroupPatch,
  canCharacterRequestToJoinGroup,
  doesCharacterKnowGroup,
  getGroupAwarenessEntry,
  getGroupAwarenessMode,
  sanitizeGroupAwarenessEntries,
} from './groupAwareness';

function createGroup(overrides: Partial<ChatGroup> = {}): ChatGroup {
  return {
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? '测试群',
    memberIds: overrides.memberIds ?? ['alpha'],
    creatorId: overrides.creatorId ?? 'user',
    createdAt: overrides.createdAt ?? 1,
    awarenessMode: overrides.awarenessMode ?? 'private',
    ...overrides,
  };
}

test('public groups are known by outsiders automatically', () => {
  const group = createGroup({ awarenessMode: 'public' });

  assert.equal(getGroupAwarenessMode(group), 'public');
  assert.equal(doesCharacterKnowGroup(group, 'beta'), true);
  assert.equal(canCharacterRequestToJoinGroup(group, 'beta'), true);
});

test('private groups need explicit awareness entry', () => {
  const group = createGroup();

  assert.equal(doesCharacterKnowGroup(group, 'beta'), false);

  const patch = buildRevealGroupPatch(group, 'beta', 'manual_reveal', 100);
  const nextGroup = {
    ...group,
    ...patch,
  };

  assert.equal(doesCharacterKnowGroup(nextGroup, 'beta'), true);
  assert.equal(canCharacterRequestToJoinGroup(nextGroup, 'beta', 110), true);
});

test('rejected join request writes cooldown onto awareness entry', () => {
  const group = createGroup({
    awarenessEntries: [
      {
        memberId: 'beta',
        knownAt: 100,
        source: 'manual_reveal',
      },
    ],
  });

  const patch = buildRejectedJoinRequestCooldownPatch(group, 'beta', 200);
  const nextGroup = {
    ...group,
    ...patch,
  };

  assert.equal(canCharacterRequestToJoinGroup(nextGroup, 'beta', 300), false);
  assert.ok((getGroupAwarenessEntry(nextGroup, 'beta')?.joinRequestCooldownUntil || 0) > 300);
});

test('sanitizeGroupAwarenessEntries drops invalid members and duplicates', () => {
  const entries = sanitizeGroupAwarenessEntries([
    {
      memberId: 'beta',
      knownAt: 100,
      source: 'manual_reveal',
    },
    {
      memberId: 'beta',
      knownAt: 200,
      source: 'direct_invite',
    },
    {
      memberId: 'ghost',
      knownAt: 100,
      source: 'manual_reveal',
    },
  ], {
    validCharacterIds: ['alpha', 'beta'],
  });

  assert.equal(entries?.length, 1);
  assert.equal(entries?.[0]?.memberId, 'beta');
});

test('awareness helpers tolerate malformed runtime payloads', () => {
  const group = createGroup({
    awarenessEntries: { beta: { source: 'manual_reveal' } } as unknown as ChatGroup['awarenessEntries'],
  });

  assert.equal(getGroupAwarenessEntry(group, 'beta'), undefined);
  assert.equal(doesCharacterKnowGroup(group, 'beta'), false);
  assert.deepEqual(buildRevealGroupPatch(group, 'beta', 'manual_reveal', 100).awarenessEntries, [
    {
      memberId: 'beta',
      knownAt: 100,
      source: 'manual_reveal',
    },
  ]);
});
