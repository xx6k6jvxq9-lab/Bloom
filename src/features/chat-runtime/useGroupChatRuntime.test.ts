import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { splitGroupReplyIntoMessages } from './useGroupChatRuntime';

function createSpeaker(overrides: Partial<Character> = {}): Character {
  return {
    id: 'speaker',
    name: 'Mina',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    friendshipStatus: 'friends',
    blockedByUser: false,
    blockedByCharacter: false,
    ...overrides,
  } as Character;
}

test('splitGroupReplyIntoMessages can expand structured assistant reply text items into group bubbles', () => {
  const speaker = createSpeaker();
  const messages = splitGroupReplyIntoMessages(
    '[ASSISTANT_REPLY] {"items":[{"kind":"text","text":"[reply: 阿青] 先别急。","translation":"先别急。"},{"kind":"text","text":"[notice] 这话题先收一下。","translation":"这话题先收一下。"}]}',
    speaker,
    1000,
  );

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.text, 'Mina: [reply: 阿青] 先别急。');
  assert.equal(messages[0]?.translation, '先别急。');
  assert.equal(messages[1]?.text, '[notice] 这话题先收一下。');
  assert.equal(messages[1]?.isSystem, true);
});

test('splitGroupReplyIntoMessages keeps structured game card items as card messages without speaker prefixes', () => {
  const speaker = createSpeaker();
  const messages = splitGroupReplyIntoMessages(
    '[ASSISTANT_REPLY] {"items":[{"kind":"game_card","payload":{"game":"qna","type":"answer","content":"那你先说。"},"translation":"那你先说。"}]}',
    speaker,
    2000,
  );

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.contentType, 'game-card');
  assert.equal(messages[0]?.text, '[GAME_CARD] {"game":"qna","type":"answer","content":"那你先说。"}');
  assert.equal(messages[0]?.translation, '那你先说。');
  assert.equal(messages[0]?.senderCharacterId, 'speaker');
});
