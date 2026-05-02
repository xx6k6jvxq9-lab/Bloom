import type { Character, FriendRequest, ForumPost, ForumTempChatSession } from '../../types';

type ForumFriendAuthor = {
  id: string;
  name: string;
  avatar: string;
  handle?: string;
  bio?: string;
  description?: string;
  persona?: string;
};

export function createForumFriendRequest(input: {
  author: ForumFriendAuthor;
  session: ForumTempChatSession;
  relatedPost?: ForumPost | null;
  now?: number;
}): FriendRequest {
  const { author, session, relatedPost } = input;
  const now = input.now || Date.now();
  const exchangeRounds = session.completedExchangeRounds || 0;
  const relatedTitle = relatedPost?.title?.trim();
  const fingerprint = `${author.name} ${author.handle || ''} ${author.bio || ''} ${author.persona || ''}`;
  const isCautious = /慢热|旁听|潜水|先看|谨慎/u.test(fingerprint);
  const isExpressive = /嘴快|开麦|补刀|乐子|吃瓜/u.test(fingerprint);
  const isRomantic = /嗑|代餐|旧糖|偏心|护短|短文/u.test(fingerprint);
  const topicText = `${relatedTitle || ''} ${relatedPost?.content || ''}`;

  let message = '';
  if (relatedTitle && /同人|短文|代餐|片段/u.test(topicText) && isRomantic) {
    message = `从《${relatedTitle}》那楼一路聊下来，我还挺想继续认识你的。要不要加个好友慢慢说？`;
  } else if (relatedTitle && /匿名|爆料|目击|复盘|旧糖/u.test(topicText)) {
    message = isCautious
      ? `《${relatedTitle}》那楼有些话我还是想慢慢和你说。要不要先加个好友，以后好找你？`
      : `《${relatedTitle}》那楼聊到这一步，我不太想只停在论坛里。要不要加个好友继续？`;
  } else if (exchangeRounds >= 14) {
    message = isExpressive
      ? `都来回聊这么多轮了，再装路过也有点假。要不要正式认识一下？`
      : `我们已经在论坛里来回聊了不少了，我想把这段关系往前放一步。要不要加个好友？`;
  } else {
    message = relatedTitle
      ? `论坛里聊到《${relatedTitle}》之后，感觉你很对胃口。要不要正式认识一下？`
      : `和你在论坛里聊了挺久，想正式认识一下。`;
  }

  return {
    id: `forum-friend-request-${author.id}-${now}`,
    fromUserId: author.id,
    fromUserName: author.name,
    fromUserAvatar: author.avatar,
    status: 'pending',
    timestamp: now,
    message,
    sourceScene: 'forum',
    sourcePostId: relatedPost?.id,
    sourceTempChatAuthorId: session.authorId,
    forumHandle: author.handle,
    forumBio: author.bio || author.description,
    forumPersona: author.persona,
  };
}

export function hasPendingForumFriendRequest(friendRequests: FriendRequest[], authorId: string) {
  return friendRequests.some((request) => (
    request.fromUserId === authorId
    && request.sourceScene === 'forum'
    && request.status === 'pending'
  ));
}

export function buildForumFriendBridgeCharacter(request: FriendRequest): Character {
  const profileText = request.forumPersona || request.forumBio || `${request.fromUserName}是在论坛里认识的新朋友。`;

  return {
    id: request.fromUserId,
    name: request.fromUserName,
    gender: 'other',
    avatar: request.fromUserAvatar,
    setting: profileText,
    corePersona: profileText,
    signature: request.forumBio || `${request.fromUserName}常驻论坛，和你聊熟后加上了好友。`,
    openingRemark: '终于不用隔着论坛说话了。',
    lastMessage: '终于不用隔着论坛说话了。',
    lastTime: Date.now(),
    groupId: '论坛网友',
    maxReplies: 3,
    autoReplyEnabled: true,
    postFrequency: 'medium',
    showTime: true,
  };
}
