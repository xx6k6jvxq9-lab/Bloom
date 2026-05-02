import type {
  ForumComment,
  ForumNotification,
  ForumPost,
  ForumRuntimeAuthorProfile,
  ForumTempChatMessage,
  ForumTempChatSession,
} from '../../types';
import { createForumNotification } from './forumNotifications';

type CandidateAuthor = Pick<ForumRuntimeAuthorProfile, 'id' | 'name' | 'handle' | 'avatar' | 'bio'> & {
  interactionScore?: number;
  isCharacter?: boolean;
};

type EvaluateForumUserMomentumInput = {
  event: 'post' | 'comment';
  currentUserId: string;
  currentUserName: string;
  post: ForumPost;
  comment?: ForumComment;
  allowNpcTempChat?: boolean;
  followedUsers: string[];
  followerMap: Record<string, string[]>;
  tempChats: Record<string, ForumTempChatSession>;
  candidates: CandidateAuthor[];
  now?: number;
};

type MomentumResult = {
  followerMap: Record<string, string[]>;
  notifications: ForumNotification[];
  tempChats: Record<string, ForumTempChatSession>;
  likedByIds: string[];
  collectedByIds: string[];
  summaryNotice?: string;
  dmOpenIntent?: {
    authorId: string;
    reason: string;
    postId: string;
  };
};

function uniqueIds(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildCandidateFingerprint(candidate: CandidateAuthor) {
  return `${candidate.name || ''} ${candidate.handle || ''} ${candidate.bio || ''}`.trim();
}

function resolveCandidateTemperament(candidate: CandidateAuthor) {
  const fingerprint = buildCandidateFingerprint(candidate);
  return {
    privateTalker: /匿名|旁听|潜水|夜聊|树洞|别在楼里说|不想公开|先私下/u.test(fingerprint),
    cautious: /慢热|旁听|潜水|看情况|先看|不站队|谨慎/u.test(fingerprint),
    expressive: /嘴快|补刀|开麦|吃瓜|路过顺嘴|乐子人/u.test(fingerprint),
    romantic: /嗑|代餐|短文|旧糖|偏心|护短/u.test(fingerprint),
    workplace: /工位|白名单|权限|日志|前台|值夜|加班/u.test(fingerprint),
  };
}

function scoreContentHeat(post: ForumPost) {
  const text = `${post.title}\n${post.content}`;
  let score = 0;

  if (text.length >= 80) score += 2;
  if (text.length >= 180) score += 1;
  if (/同人|短文|脑补|代餐|目击|复盘|匿名|投票|旧糖|双标|护短|吃醋|占有|修罗场/u.test(text)) score += 2;
  if (/求助|怎么办|删帖|社死|回不回|是不是|到底算不算/u.test(text)) score += 1;
  if (/闭嘴|烦死|有病|笑死|别来沾边/u.test(text)) score -= 2;

  if (post.contentTier === 'highlight') score += 3;
  if (post.contentTier === 'ferment') score += 2;
  if (post.contentTier === 'fragment') score += 1;

  if (post.threadType === 'vote' || post.threadType === 'reversal' || post.threadType === 'sameTopic') score += 1;
  if (post.threadType === 'timeline' || post.threadType === 'ownerUpdate') score += 1;
  if ((post.discourseAxis || '').trim()) score += 1;

  return score;
}

function scoreCommentVibe(text: string) {
  let score = 0;
  if (/谢谢|懂你|我也是|我站你|说得对|先抱抱/u.test(text)) score += 2;
  if (/建议|可以|不如|最好|先别/u.test(text)) score += 1;
  if (/闭嘴|有病|笑死|离谱/u.test(text)) score -= 2;
  return score;
}

function pickTopCandidates(candidates: CandidateAuthor[], count: number) {
  return [...candidates]
    .sort((a, b) => (b.interactionScore || 0) - (a.interactionScore || 0))
    .slice(0, count);
}

function resolveForumDmReason(input: EvaluateForumUserMomentumInput) {
  const text = `${input.post.title}\n${input.post.content}\n${input.comment?.content || ''}`;

  if (input.event === 'comment' && input.comment) {
    if (/我也|我也是|说得对|站你|确实|就是这样/u.test(input.comment.content)) return 'agreement';
    if (/不对|不一定|我反而|别急|你这个角度/u.test(input.comment.content)) return 'debate';
    return 'followup_comment';
  }

  if (input.post.contentTier === 'highlight') return 'ask_followup';
  if (/同人|短文|代餐|片段|脑补/u.test(text)) return 'praise_writing';
  if (/匿名|爆料|目击|复盘|风声|旧糖/u.test(text)) return 'private_gossip';
  if (/求助|怎么办|回不回|删帖|是不是/u.test(text)) return 'comfort_or_advice';
  return 'curious';
}

function resolveFollowThreshold(candidate: CandidateAuthor, input: EvaluateForumUserMomentumInput, index: number) {
  const temperament = resolveCandidateTemperament(candidate);
  let threshold = input.post.contentTier === 'highlight'
    ? (index === 0 ? 2 : 3)
    : input.post.contentTier === 'ferment'
      ? (index === 0 ? 3 : 4)
      : index === 0 ? 4 : 5;

  if (input.event === 'comment') threshold += 1;
  if (temperament.cautious) threshold += 1;
  if (temperament.expressive) threshold -= 1;
  if (temperament.romantic && /同人|短文|代餐|旧糖|护短/u.test(`${input.post.title}\n${input.post.content}`)) threshold -= 1;

  return Math.max(1, threshold);
}

function resolveDmThreshold(candidate: CandidateAuthor, input: EvaluateForumUserMomentumInput) {
  const temperament = resolveCandidateTemperament(candidate);
  let threshold = input.post.contentTier === 'highlight'
    ? 3
    : input.post.contentTier === 'ferment'
      ? 4
      : 5;

  if (input.event === 'comment') threshold += 1;
  if (temperament.privateTalker) threshold -= 1;
  if (temperament.cautious) threshold += 1;
  if (temperament.romantic && /同人|短文|代餐|旧糖|护短/u.test(`${input.post.title}\n${input.post.content}`)) threshold -= 1;

  return Math.max(2, threshold);
}

export function evaluateForumUserMomentum(input: EvaluateForumUserMomentumInput): MomentumResult {
  const now = input.now || Date.now();
  const contentScore = scoreContentHeat(input.post);
  const commentScore = input.comment ? scoreCommentVibe(input.comment.content) : 0;
  const netScore = contentScore + commentScore;
  const myFollowerIds = uniqueIds(input.followerMap[input.currentUserId] || []);
  const nextFollowerIds = [...myFollowerIds];
  const notifications: ForumNotification[] = [];
  const nextTempChats = { ...input.tempChats };

  const primaryCandidates = pickTopCandidates(
    input.candidates.filter((candidate) => candidate.id !== input.currentUserId),
    3,
  );

  const followerAdds: string[] = [];
  const followerRemoves: string[] = [];
  const silentLikeIds: string[] = [];
  const silentCollectionIds: string[] = [];
  const maxFollowerAdds = input.event === 'comment' ? 1 : input.post.contentTier === 'highlight' ? 2 : 1;

  primaryCandidates.forEach((candidate, index) => {
    const alreadyFollowing = nextFollowerIds.includes(candidate.id);
    const threshold = resolveFollowThreshold(candidate, input, index);
    const shouldSoftLike = netScore >= (input.post.contentTier === 'fragment' ? 0 : 1) && index < 2;

    if (shouldSoftLike) {
      if (input.event === 'comment' && input.comment) {
        notifications.push(createForumNotification({
          userId: input.currentUserId,
          type: 'like_comment',
          sourceUserId: candidate.id,
          postId: input.post.id,
          commentId: input.comment.id,
          timestamp: now + index,
        }));
      } else {
        notifications.push(createForumNotification({
          userId: input.currentUserId,
          type: 'like_post',
          sourceUserId: candidate.id,
          postId: input.post.id,
          timestamp: now + index,
        }));
        silentLikeIds.push(candidate.id);
      }
    }

    if (input.event === 'post' && netScore >= (input.post.contentTier === 'fragment' ? 1 : 2) && index === 0) {
      silentCollectionIds.push(candidate.id);
    }

    if (!alreadyFollowing && followerAdds.length < maxFollowerAdds && netScore >= threshold) {
      nextFollowerIds.push(candidate.id);
      followerAdds.push(candidate.id);
      notifications.push(createForumNotification({
        userId: input.currentUserId,
        type: 'follow',
        sourceUserId: candidate.id,
        postId: input.post.id,
        timestamp: now + index,
      }));
    } else if (alreadyFollowing && netScore <= -2 && index === primaryCandidates.length - 1) {
      const filtered = nextFollowerIds.filter((id) => id !== candidate.id);
      nextFollowerIds.length = 0;
      nextFollowerIds.push(...filtered);
      followerRemoves.push(candidate.id);
    }
  });

  const dmCandidate = primaryCandidates.find((candidate) => (
    !!input.allowNpcTempChat
    && !candidate.isCharacter
    && !input.followedUsers.includes(candidate.id)
    && !nextTempChats[candidate.id]
    && netScore >= resolveDmThreshold(candidate, input)
  )) || primaryCandidates.find((candidate) => (
    !!input.allowNpcTempChat
    && !candidate.isCharacter
    && !nextTempChats[candidate.id]
    && netScore >= resolveDmThreshold(candidate, input) + 1
  ));

  const nextFollowerMap = {
    ...input.followerMap,
    [input.currentUserId]: uniqueIds(nextFollowerIds),
  };

  let summaryNotice = '';
  if (followerAdds.length > 0 && dmCandidate) {
    summaryNotice = `这次互动后多了 ${followerAdds.length} 个新关注，还有人主动来敲你私聊。`;
  } else if (followerAdds.length > 0) {
    summaryNotice = `这次互动后多了 ${followerAdds.length} 个新关注。`;
  } else if (silentCollectionIds.length > 0) {
    summaryNotice = '有人先把这条楼收进去了，像是在悄悄记住你。';
  } else if (silentLikeIds.length > 0) {
    summaryNotice = '有人先给你留了轻互动，像是在楼里默默看见你了。';
  } else if (followerRemoves.length > 0) {
    summaryNotice = '这次互动里有人对你改观了，也有人悄悄取关了。';
  } else if (dmCandidate) {
    summaryNotice = '有人看完帖子后主动来敲你私聊了。';
  }

  return {
    followerMap: nextFollowerMap,
    notifications,
    tempChats: nextTempChats,
    likedByIds: uniqueIds(silentLikeIds),
    collectedByIds: uniqueIds(silentCollectionIds),
    summaryNotice,
    dmOpenIntent: dmCandidate
      ? {
          authorId: dmCandidate.id,
          reason: resolveForumDmReason(input),
          postId: input.post.id,
        }
      : undefined,
  };
}
