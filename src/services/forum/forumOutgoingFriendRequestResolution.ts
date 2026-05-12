import type {
  ForumNotification,
  ForumPost,
  ForumTempChatMessage,
  ForumTempChatSession,
} from '../../types';

type ForumResolutionAuthor = {
  id: string;
  name: string;
  handle?: string;
  bio?: string;
  persona?: string;
};

type ForumOutgoingFriendRequestResolutionInput = {
  author: ForumResolutionAuthor;
  session: ForumTempChatSession;
  relatedPost?: ForumPost | null;
  currentUserId: string;
  followedUsers: string[];
  followerMap: Record<string, string[]>;
  now?: number;
};

type ForumOutgoingFriendRequestResolutionResult = {
  accepted: boolean;
  responseText: string;
  resolutionMessage: string;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildFingerprint(author: ForumResolutionAuthor) {
  return `${author.name} ${author.handle || ''} ${author.bio || ''} ${author.persona || ''}`;
}

function resolveTemperament(author: ForumResolutionAuthor) {
  const fingerprint = buildFingerprint(author);
  return {
    privateTalker: /匿名|旁听|潜水|夜聊|树洞|别在楼里说|不想公开|先私下/u.test(fingerprint),
    cautious: /慢热|旁听|潜水|看情况|先看|不站队|谨慎/u.test(fingerprint),
    expressive: /嘴快|补刀|开麦|吃瓜|路过顺嘴|乐子人/u.test(fingerprint),
    romantic: /嗑|代餐|短文|旧糖|偏心|护短/u.test(fingerprint),
  };
}

function pickBySeed(items: string[], seed: string) {
  return items[hashString(seed) % items.length] || items[0] || '';
}

export function resolveOutgoingForumFriendRequestDelayMs(input: {
  author: ForumResolutionAuthor;
  session: ForumTempChatSession;
}) {
  const temperament = resolveTemperament(input.author);
  const rounds = input.session.completedExchangeRounds || 0;
  const meaningfulReplies = input.session.meaningfulReplyCount || 0;

  let minMs = temperament.expressive ? 8_000 : temperament.cautious || temperament.privateTalker ? 18_000 : 12_000;
  let maxMs = temperament.expressive ? 18_000 : temperament.cautious || temperament.privateTalker ? 38_000 : 24_000;

  if (rounds >= 6) {
    minMs = Math.max(6_000, minMs - 3_000);
    maxMs = Math.max(minMs + 4_000, maxMs - 4_000);
  } else if (rounds <= 1 && meaningfulReplies <= 1) {
    maxMs += 8_000;
  }

  const ratio = hashString(`${input.author.id}:${rounds}:${meaningfulReplies}:friend-request-delay`) % 1000 / 999;
  return minMs + Math.round((maxMs - minMs) * ratio);
}

export function appendForumFriendResolutionMessage(
  session: ForumTempChatSession,
  text: string,
  timestamp: number,
): ForumTempChatSession {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return {
      ...session,
      updatedAt: timestamp,
    };
  }

  const latestMessage = session.messages[session.messages.length - 1];
  if (latestMessage?.role === 'npc' && latestMessage.text.trim() === normalizedText) {
    return {
      ...session,
      updatedAt: Math.max(session.updatedAt, timestamp),
    };
  }

  const message: ForumTempChatMessage = {
    id: `forum-temp-npc-friend-resolution-${session.authorId}-${timestamp}`,
    role: 'npc',
    text: normalizedText,
    timestamp,
  };

  return {
    ...session,
    messages: [...session.messages, message],
    updatedAt: timestamp,
  };
}

export function resolveOutgoingForumFriendRequest(input: ForumOutgoingFriendRequestResolutionInput): ForumOutgoingFriendRequestResolutionResult {
  const now = input.now || Date.now();
  const temperament = resolveTemperament(input.author);
  const rounds = input.session.completedExchangeRounds || 0;
  const meaningfulReplies = input.session.meaningfulReplyCount || 0;
  const proactiveTurns = input.session.proactiveNpcTurnCount || 0;
  const userFollowsAuthor = input.followedUsers.includes(input.author.id)
    || (input.followerMap[input.author.id] || []).includes(input.currentUserId);
  const authorFollowsUser = (input.followerMap[input.currentUserId] || []).includes(input.author.id);
  const topicText = `${input.relatedPost?.title || ''} ${input.relatedPost?.content || ''}`;

  let score = 0;
  if (rounds >= 10) score += 3;
  else if (rounds >= 5) score += 2;
  else if (rounds >= 2) score += 1;
  if (meaningfulReplies >= 8) score += 2;
  else if (meaningfulReplies >= 4) score += 1;
  if (proactiveTurns >= 1) score += 1;
  if (input.relatedPost) score += 1;
  if (userFollowsAuthor) score += 1;
  if (authorFollowsUser) score += 2;
  if (temperament.expressive) score += 1;
  if (temperament.privateTalker) score -= 1;
  if (temperament.cautious) score -= 1;
  if (temperament.romantic && /同人|短文|代餐|旧糖|护短/u.test(topicText)) score += 1;
  if (input.session.lastGhostedAt && now - input.session.lastGhostedAt < 3 * 24 * 60 * 60 * 1000) score -= 2;

  const accepted = score >= 3 || (score >= 2 && (authorFollowsUser || rounds >= 3 || !!input.relatedPost));

  if (accepted) {
    const responseText = temperament.cautious || temperament.privateTalker
      ? pickBySeed([
          '可以先加上，不过别在楼里到处声张。',
          '先加上吧，之后有话私下说会方便一点。',
          '行，先加上，但这条线还是低调点。',
        ], `${input.author.id}:accept:cautious`)
      : temperament.expressive
        ? pickBySeed([
            '行啊，都被你用好友ID找过来了，那就正式认识一下。',
            '可以，论坛都聊到这了，再装不认识也挺假。',
            '加吧，反正你都找过来了。',
          ], `${input.author.id}:accept:expressive`)
        : pickBySeed([
            '可以，先加上吧，以后好找你。',
            '好啊，正式认识一下。',
            '那就先加上，之后继续聊。',
          ], `${input.author.id}:accept:default`);

    return {
      accepted: true,
      responseText,
      resolutionMessage: '对方通过了你的申请',
    };
  }

  const responseText = temperament.cautious || temperament.privateTalker
    ? pickBySeed([
        '先别急着加好友，我们先在论坛里聊吧。',
        '这次先不加了，楼里碰到再说。',
        '我还想先在论坛里看看，再决定要不要加。',
      ], `${input.author.id}:reject:cautious`)
    : temperament.expressive
      ? pickBySeed([
          '这次先不加，楼里见也够了。',
          '先别急着加好友，论坛里碰上再说。',
          '先不用，楼里聊着也挺好。',
        ], `${input.author.id}:reject:expressive`)
      : pickBySeed([
          '这次先不加了，论坛里有缘再聊。',
          '先不用加好友，之后楼里碰到再说吧。',
          '先到这吧，我们还可以在论坛里继续碰面。',
        ], `${input.author.id}:reject:default`);

  return {
    accepted: false,
    responseText,
    resolutionMessage: '对方暂时没有通过你的申请',
  };
}
