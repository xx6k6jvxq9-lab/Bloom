import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanupExpiredMutedMemberEntries,
  getNearestMutedMemberExpiryAt,
  getMutedMemberEntry,
  isGroupMemberMuted,
  removeMutedMemberEntry,
  sanitizeMutedMemberEntries,
  upsertMutedMemberEntry,
} from './groupMutedMembers';

test('sanitizeMutedMemberEntries keeps only valid unique member entries', () => {
  const entries = sanitizeMutedMemberEntries([
    { memberId: 'alpha', mutedById: 'user', mutedAt: 100, expiresAt: 200 },
    { memberId: 'alpha', mutedById: 'user', mutedAt: 200 },
    { memberId: 'user', mutedById: 'user', mutedAt: 100 },
  ], {
    memberIds: ['alpha', 'beta'],
    creatorId: 'user',
  });

  assert.deepEqual(entries, [
    { memberId: 'alpha', mutedById: 'user', mutedAt: 100, expiresAt: 200 },
  ]);
});

test('upsertMutedMemberEntry and removeMutedMemberEntry manage muted state', () => {
  const patch = upsertMutedMemberEntry({}, {
    memberId: 'alpha',
    mutedById: 'user',
    mutedAt: 100,
  });

  assert.equal(isGroupMemberMuted(patch, 'alpha'), true);
  assert.equal(getMutedMemberEntry(patch, 'alpha')?.mutedById, 'user');

  const clearedPatch = removeMutedMemberEntry(patch, 'alpha');
  assert.equal(isGroupMemberMuted(clearedPatch, 'alpha'), false);
});

test('cleanupExpiredMutedMemberEntries removes expired timed mutes', () => {
  const cleanup = cleanupExpiredMutedMemberEntries({
    mutedMemberEntries: [
      { memberId: 'alpha', mutedById: 'user', mutedAt: 100, expiresAt: 150 },
      { memberId: 'beta', mutedById: 'user', mutedAt: 120, expiresAt: 300 },
    ],
  }, 200);

  assert.ok(cleanup);
  assert.deepEqual(cleanup?.expiredEntries, [
    { memberId: 'alpha', mutedById: 'user', mutedAt: 100, expiresAt: 150 },
  ]);
  assert.deepEqual(cleanup?.patch.mutedMemberEntries, [
    { memberId: 'beta', mutedById: 'user', mutedAt: 120, expiresAt: 300 },
  ]);
});

test('getNearestMutedMemberExpiryAt returns the earliest timed mute expiry', () => {
  assert.equal(getNearestMutedMemberExpiryAt({
    mutedMemberEntries: [
      { memberId: 'alpha', mutedById: 'user', mutedAt: 100, expiresAt: 500 },
      { memberId: 'beta', mutedById: 'user', mutedAt: 120, expiresAt: 300 },
    ],
  }), 300);
});
