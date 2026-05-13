import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { buildForumSharedSettlement } from './buildForumSharedSettlement';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'forum-char',
    name: overrides.name ?? 'Forum Character',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? '',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

test('buildForumSharedSettlement emits structured scene progress for forum continuity', () => {
  const settlement = buildForumSharedSettlement(createCharacter(), {
    kind: 'friend_request_sent',
    actorName: 'Alpha',
    content: '那你加我一下，我们晚点继续聊这个话题。',
    timestamp: 1_700_000_000_001,
    postTitle: '今天的旧话题又被翻出来了',
  });

  const record = settlement.sceneProgressRecords?.[0];

  assert.equal(Boolean(record), true);
  assert.match(record?.summary || '', /论坛互动推进到/);
  assert.match(record?.stageLabel || '', /关系转场阶段/);
  assert.match(record?.currentSignature || '', /好友申请/);
  assert.equal(record?.bannedRepeatActions?.length ? true : false, true);
});
