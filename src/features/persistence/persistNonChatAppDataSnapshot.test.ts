import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultAppData } from '../app-shell/defaultAppData';
import { buildPersistableNonChatAppDataSnapshot } from './persistNonChatAppDataSnapshot';

test('buildPersistableNonChatAppDataSnapshot strips chat preview fields and excludes chat-domain payload', () => {
  const character = {
    id: 'char-preview-test',
    name: '预览测试角色',
    gender: 'other' as const,
    avatar: 'avatar.png',
    setting: '测试角色设定',
    openingRemark: '你好',
  };
  const fallbackAppData = {
    ...createDefaultAppData(),
    characters: [character],
  };
  const appData = {
    ...fallbackAppData,
    characters: fallbackAppData.characters.map((entry, index) => (
      index === 0
        ? {
            ...entry,
            lastMessage: '这条预览不该再进角色库',
            lastTime: 1_700_000_000_123,
            lastViewedMessageTimestamp: 1_700_000_000_100,
          }
        : entry
    )),
    chatHistory: {
      [character.id]: [
        {
          role: 'model' as const,
          text: '这条聊天正文还在聊天域里',
          timestamp: 1_700_000_000_123,
        },
      ],
    },
    friendRequests: [
      {
        id: 'friend-request-1',
        fromUserId: character.id,
        fromUserName: character.name,
        fromUserAvatar: character.avatar,
        status: 'pending' as const,
        timestamp: 1_700_000_000_000,
      },
    ],
    chatGroups: [
      {
        id: 'group-1',
        name: '测试群',
        memberIds: [character.id],
        creatorId: 'user',
        createdAt: 1_700_000_000_000,
      },
    ],
    groups: ['朋友'],
  };

  const snapshot = buildPersistableNonChatAppDataSnapshot(appData, fallbackAppData);

  assert.equal(snapshot.characters[0]?.lastMessage, undefined);
  assert.equal(snapshot.characters[0]?.lastTime, undefined);
  assert.equal(snapshot.characters[0]?.lastViewedMessageTimestamp, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'chatHistory'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'friendRequests'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'chatGroups'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'groups'), false);
});
