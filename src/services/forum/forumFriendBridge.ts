import type { AppDataExtended, Character, ForumTempChatSession } from '../../types';
import { buildForumFriendBridgeCharacter } from './forumFriendRequests';

type BridgeForumFriendInput = {
  appData: AppDataExtended;
  author: {
    id: string;
    name: string;
    avatar: string;
    handle?: string;
    bio?: string;
    description?: string;
    persona?: string;
  };
  session?: ForumTempChatSession;
  now?: number;
};

type BridgeForumFriendResult = {
  nextCharacters: Character[];
  nextChatHistory: Record<string, any>;
  nextTempSession: ForumTempChatSession;
};

export function bridgeForumFriendToFormalChat(
  input: BridgeForumFriendInput,
): BridgeForumFriendResult {
  const now = input.now || Date.now();
  const bridgeCharacter = buildForumFriendBridgeCharacter({
    id: `forum-upgrade-${input.author.id}-${now}`,
    fromUserId: input.author.id,
    fromUserName: input.author.name,
    fromUserAvatar: input.author.avatar,
    status: 'accepted',
    timestamp: now,
    sourceScene: 'forum',
    sourceTempChatAuthorId: input.author.id,
    forumHandle: input.author.handle,
    forumBio: input.author.bio || input.author.description,
    forumPersona: input.author.persona,
  });

  const existingHistory = (input.appData as any).chatHistory?.[input.author.id];
  const initialHistory = existingHistory && existingHistory.length > 0
    ? existingHistory
    : [{
        role: 'model' as const,
        text: `${bridgeCharacter.openingRemark} 现在如果你愿意，我们可以换到正式聊天里继续。`,
        timestamp: now,
      }];

  const existingCharacter = input.appData.characters.find((character) => character.id === input.author.id);
  const nextCharacters = existingCharacter
    ? input.appData.characters
    : [...input.appData.characters, bridgeCharacter];

  const nextTempSession: ForumTempChatSession = {
    ...(input.session || {
      authorId: input.author.id,
      createdAt: now,
      updatedAt: now,
      messages: [],
    }),
    addedAsFriend: true,
    friendRequestState: 'accepted',
    convertedFriendId: input.author.id,
    updatedAt: now,
  };

  return {
    nextCharacters,
    nextChatHistory: {
      ...(((input.appData as any).chatHistory) || {}),
      [input.author.id]: initialHistory,
    },
    nextTempSession,
  };
}

