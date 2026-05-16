import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatGroup } from '../../types';
import { getGroupMemberBubbleColor, sanitizeGroupMemberBubbleColors } from './groupBubbleColors';
import { getGroupMemberBadge, sanitizeGroupMemberBadges } from './memberBadges';

test('member badge helpers tolerate malformed runtime payloads', () => {
  const group = {
    creatorId: 'user',
    memberIds: ['alpha'],
    memberBadges: { alpha: { label: '测试' } } as unknown as ChatGroup['memberBadges'],
  };

  assert.deepEqual(sanitizeGroupMemberBadges(group), []);
  assert.equal(getGroupMemberBadge(group, 'alpha'), null);
});

test('member bubble color helpers tolerate malformed runtime payloads', () => {
  const group = {
    creatorId: 'user',
    memberIds: ['alpha'],
    memberBubbleColors: { alpha: { color: '#ff0000' } } as unknown as ChatGroup['memberBubbleColors'],
  };

  assert.deepEqual(sanitizeGroupMemberBubbleColors(group), []);
  assert.equal(getGroupMemberBubbleColor(group, 'alpha'), null);
});
