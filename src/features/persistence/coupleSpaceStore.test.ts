import assert from 'node:assert/strict';
import test from 'node:test';
import type { PerceptionSettings } from '../../types';
import {
  acceptCoupleSpaceInviteState,
  createDefaultCoupleSpaceData,
  deletePartnerCoupleSpaceState,
  getPartnerCoupleSpaceData,
  hydratePersistedCoupleSpacePayload,
  isPartnerCoupleSpaceDismissed,
  projectCoupleSpaceStateFromCurrentSpace,
  switchCurrentCoupleSpaceState,
} from './coupleSpaceStore';
import { createDefaultPerceptionSettings } from './perceptionStore';

function buildPerception(dateTimeValue: string): PerceptionSettings {
  return {
    ...createDefaultPerceptionSettings(),
    enabled: true,
    dateTime: {
      enabled: true,
      value: dateTimeValue,
    },
  };
}

test('hydratePersistedCoupleSpacePayload preserves legacy perception without partner', () => {
  const legacyPerception = buildPerception('2077-06-01T21:00');

  const hydrated = hydratePersistedCoupleSpacePayload({
    perception: legacyPerception,
  });

  assert.deepEqual(hydrated.coupleSpaceState.sharedPerception, legacyPerception);
  assert.deepEqual(hydrated.coupleSpace.perception, legacyPerception);
  assert.equal(hydrated.coupleSpace.partnerId, null);
});

test('switchCurrentCoupleSpaceState keeps shared perception when switching partner', () => {
  const sharedPerception = buildPerception('2088-03-15T08:30');
  const currentSpace = createDefaultCoupleSpaceData({
    partnerId: 'char-a',
  });

  const switched = switchCurrentCoupleSpaceState(
    {
      currentPartnerId: 'char-a',
      spacesByPartnerId: {
        'char-a': currentSpace,
      },
      sharedPerception,
    },
    currentSpace,
    'char-b',
  );

  assert.deepEqual(switched.coupleSpaceState.sharedPerception, sharedPerception);
  assert.deepEqual(switched.coupleSpace.perception, sharedPerception);
  assert.equal(switched.coupleSpace.partnerId, 'char-b');
});

test('acceptCoupleSpaceInviteState syncs legacy addedPartnerIds for current space compatibility', () => {
  const accepted = acceptCoupleSpaceInviteState(
    {
      currentPartnerId: 'char-a',
      spacesByPartnerId: {
        'char-a': createDefaultCoupleSpaceData({
          partnerId: 'char-a',
        }),
      },
    },
    createDefaultCoupleSpaceData({
      partnerId: 'char-a',
    }),
    'char-b',
  );

  assert.deepEqual(accepted.coupleSpaceState.currentPartnerId, 'char-b');
  assert.deepEqual(Object.keys(accepted.coupleSpaceState.spacesByPartnerId), ['char-b', 'char-a']);
  assert.deepEqual(accepted.coupleSpace.addedPartnerIds, ['char-b', 'char-a']);
  assert.deepEqual(
    accepted.coupleSpaceState.spacesByPartnerId['char-a']?.addedPartnerIds,
    ['char-b', 'char-a'],
  );
  assert.deepEqual(
    accepted.coupleSpaceState.spacesByPartnerId['char-b']?.addedPartnerIds,
    ['char-b', 'char-a'],
  );
});

test('projectCoupleSpaceStateFromCurrentSpace recovers legacy addedPartnerIds without a current partner', () => {
  const projected = projectCoupleSpaceStateFromCurrentSpace(
    createDefaultCoupleSpaceData({
      partnerId: null,
      addedPartnerIds: ['char-a', 'char-b'],
    }),
  );

  assert.equal(projected.currentPartnerId, 'char-a');
  assert.deepEqual(Object.keys(projected.spacesByPartnerId), ['char-a', 'char-b']);
  assert.deepEqual(projected.spacesByPartnerId['char-a']?.addedPartnerIds, ['char-a', 'char-b']);
  assert.deepEqual(projected.spacesByPartnerId['char-b']?.addedPartnerIds, ['char-a', 'char-b']);
});

test('getPartnerCoupleSpaceData returns the requested partner space instead of the global current space', () => {
  const partnerSpace = getPartnerCoupleSpaceData(
    {
      currentPartnerId: 'char-a',
      spacesByPartnerId: {
        'char-a': createDefaultCoupleSpaceData({
          partnerId: 'char-a',
          loveLetters: [{ id: 'a-letter', authorId: 'user', content: 'a', timestamp: 1, comments: [] }],
          addedPartnerIds: ['char-a', 'char-b'],
        }),
        'char-b': createDefaultCoupleSpaceData({
          partnerId: 'char-b',
          loveLetters: [{ id: 'b-letter', authorId: 'user', content: 'b', timestamp: 2, comments: [] }],
          addedPartnerIds: ['char-a', 'char-b'],
        }),
      },
    },
    createDefaultCoupleSpaceData({
      partnerId: 'char-a',
      addedPartnerIds: ['char-a', 'char-b'],
    }),
    'char-b',
  );

  assert.equal(partnerSpace.partnerId, 'char-b');
  assert.equal(partnerSpace.loveLetters[0]?.id, 'b-letter');
  assert.deepEqual(partnerSpace.addedPartnerIds, ['char-b', 'char-a']);
});

test('getPartnerCoupleSpaceData keeps unopened characters out of opened couple-space state', () => {
  const partnerSpace = getPartnerCoupleSpaceData(
    {
      currentPartnerId: 'char-a',
      spacesByPartnerId: {
        'char-a': createDefaultCoupleSpaceData({
          partnerId: 'char-a',
          addedPartnerIds: ['char-a'],
        }),
      },
    },
    createDefaultCoupleSpaceData({
      partnerId: 'char-a',
      addedPartnerIds: ['char-a'],
    }),
    'char-b',
  );

  assert.equal(partnerSpace.partnerId, null);
  assert.deepEqual(partnerSpace.addedPartnerIds, ['char-a']);
});

test('deletePartnerCoupleSpaceState marks an intentionally removed partner as dismissed', () => {
  const deleted = deletePartnerCoupleSpaceState(
    {
      currentPartnerId: 'char-a',
      spacesByPartnerId: {
        'char-a': createDefaultCoupleSpaceData({
          partnerId: 'char-a',
          addedPartnerIds: ['char-a', 'char-b'],
        }),
        'char-b': createDefaultCoupleSpaceData({
          partnerId: 'char-b',
          addedPartnerIds: ['char-a', 'char-b'],
        }),
      },
    },
    createDefaultCoupleSpaceData({
      partnerId: 'char-a',
      addedPartnerIds: ['char-a', 'char-b'],
    }),
    'char-b',
  );

  assert.equal(isPartnerCoupleSpaceDismissed(deleted.coupleSpaceState, deleted.coupleSpace, 'char-b'), true);
  assert.deepEqual(Object.keys(deleted.coupleSpaceState.spacesByPartnerId), ['char-a']);
});

test('acceptCoupleSpaceInviteState clears the dismissed flag when the user reopens a deleted space', () => {
  const reopened = acceptCoupleSpaceInviteState(
    {
      currentPartnerId: 'char-a',
      spacesByPartnerId: {
        'char-a': createDefaultCoupleSpaceData({
          partnerId: 'char-a',
          addedPartnerIds: ['char-a'],
        }),
      },
      dismissedPartnerIds: ['char-b'],
    },
    createDefaultCoupleSpaceData({
      partnerId: 'char-a',
      addedPartnerIds: ['char-a'],
    }),
    'char-b',
  );

  assert.equal(isPartnerCoupleSpaceDismissed(reopened.coupleSpaceState, reopened.coupleSpace, 'char-b'), false);
  assert.equal(reopened.coupleSpace.partnerId, 'char-b');
});
