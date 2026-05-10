import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage } from '../../types';
import { createDefaultCoupleSpaceData } from '../persistence/coupleSpaceStore';
import {
  hasAcceptedCoupleSpaceInviteInHistory,
  hasOpenedCoupleSpaceForCharacter,
} from './coupleSpaceInviteGuard';

test('hasOpenedCoupleSpaceForCharacter returns true when partner is already in global couple-space state', () => {
  const opened = hasOpenedCoupleSpaceForCharacter({
    characterId: 'char-b',
    coupleSpace: createDefaultCoupleSpaceData({
      partnerId: 'char-a',
      addedPartnerIds: ['char-a', 'char-b'],
    }),
    history: [],
  });

  assert.equal(opened, true);
});

test('hasOpenedCoupleSpaceForCharacter falls back to accepted invite history', () => {
  const history: ChatMessage[] = [
    {
      role: 'model',
      text: '[COUPLE_SPACE_INVITE_ACCEPTED]',
      contentType: 'couple-space-invite-accepted',
      timestamp: Date.now(),
    },
  ];

  const opened = hasOpenedCoupleSpaceForCharacter({
    characterId: 'char-b',
    coupleSpace: createDefaultCoupleSpaceData(),
    history,
  });

  assert.equal(opened, true);
  assert.equal(hasAcceptedCoupleSpaceInviteInHistory(history), true);
});

test('hasOpenedCoupleSpaceForCharacter ignores accepted history when the space was intentionally deleted', () => {
  const history: ChatMessage[] = [
    {
      role: 'model',
      text: '[COUPLE_SPACE_INVITE_ACCEPTED]',
      contentType: 'couple-space-invite-accepted',
      timestamp: Date.now(),
    },
  ];

  const opened = hasOpenedCoupleSpaceForCharacter({
    characterId: 'char-b',
    coupleSpace: createDefaultCoupleSpaceData(),
    history,
    isDismissed: true,
  });

  assert.equal(opened, false);
});
