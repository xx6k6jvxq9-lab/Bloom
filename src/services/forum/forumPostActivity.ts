import type { Character, ForumPost, ForumRuntimeAuthorProfile } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { buildHumanizedForumIdentity } from '../../features/forum-domain/runtimeAuthorStyle';
import { buildCharacterForumRuntimeProfile } from './buildCharacterForumRuntimeProfile';
import { getForumBoardScope } from './forumBoardScope';
import { resolveStableNumericId } from '../social-id/stableNumericId';

type SimulateForumAmbientActivityInput = {
  posts: ForumPost[];
  runtimeAuthorProfiles: Record<string, ForumRuntimeAuthorProfile>;
  characters: Character[];
  currentUserId: string;
  inferChannel: (category: string) => ForumChannel;
  now?: number;
};

type SimulateForumAmbientActivityResult = {
  posts: ForumPost[];
  runtimeAuthorProfiles: Record<string, ForumRuntimeAuthorProfile>;
  changed: boolean;
};

export type ForumTrendBreakdown = {
  score: number;
  ageHours: number;
  directReplyCount: number;
  nestedReplyCount: number;
  interactionCount: number;
  replyScore: number;
  likeScore: number;
  collectionScore: number;
  viewScore: number;
  freshnessScore: number;
  tierScore: number;
  velocityScore: number;
  discussionScore: number;
  continuationScore: number;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildAmbientAvatar(seed: string) {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear&backgroundColor=ffe4ef,ffeef8,e8f2ff,f3ecff&radius=50&scale=110`;
}

function randomFrom<T>(items: T[], seed: number) {
  if (!items.length) return undefined;
  return items[Math.abs(seed) % items.length];
}

const CHANNEL_BIO_POOL: Record<ForumChannel, string[]> = {
  junction: ['常在跨区热楼里补一句，见过太多翻车现场。', '交界常驻，热帖一停楼就会冒出来。'],
  present: ['今世区常驻，工位和宿舍瓜都能接上两句。', '白天装忙，夜里回楼，专看顺手和嘴硬。'],
  oldDynasty: ['旧朝区常驻，最爱看体面人失手。', '帘间风声听多了，谁在装样子一眼就知道。'],
  xianmen: ['山门夜话常驻，专看破戒和嘴硬。', '灵石未必多，热楼肯定会蹲。'],
  otherworld: ['旅店和公会两头跑，离谱委托看得太多。', '异域区旁听生，夜守和赏金单都爱接。'],
  starSea: ['白名单外常驻，权限事故会追到尾。', '值夜频道潜水员，高冷发言最容易被记住。'],
  weird: ['凌晨在线概率更高，白天看帖不一定作数。', '怪谈区常驻，先看规则再决定回不回。'],
  cyber: ['内网热帖常驻，日志和监控味一闻就懂。', '报错和八卦都看，越权楼最容易让我失眠。'],
  apocalypse: ['巡夜回来再上楼，补给贴和广播贴最常蹲。', '活着就会回两句，口粮楼不爱错过。'],
  underworld: ['冥府常驻，旧账楼和判词楼都会多看几眼。', '引魂路听多了，谁在心虚很好认。'],
  dragonPalace: ['海宴散场后更常上线，旧约楼很难不蹲。', '潮声里听惯了场话，珠口和水廊楼最爱看。'],
  infiniteTower: ['高层活久了，路线复盘楼会多停几分钟。', '补给点旁听生，奖励分配楼最容易点。'],
  godCourt: ['云阶风声听多了，命格楼和降罚楼都会点进去。', '神庭常驻，最爱看高位人装公事公办。'],
  dreamStation: ['夜车到站前还会刷两页，错站楼总要看完。', '梦站旁听生，醒后装不熟这类楼最有后劲。'],
  bookCity: ['番外区潜水员，作者手滑和设定穿帮都爱看。', '章节边角常驻，角色失控楼基本不会错过。'],
  beastPlain: ['巡夜火堆边上常刷楼，风口和领地楼最对味。', '换毛期脾气一般，但热楼还是会蹲。'],
};

function buildAmbientProfile(channel: ForumChannel, seed: string): ForumRuntimeAuthorProfile {
  const identity = buildHumanizedForumIdentity({
    channel,
    seed,
    rawDisplayName: '',
    rawHandle: '',
    persona: seed,
  });
  const bioPool = CHANNEL_BIO_POOL[channel] || CHANNEL_BIO_POOL.junction;
  const profileId = `forum_runtime_${hashString(seed).toString(36)}`;
  return {
    id: profileId,
    numericId: resolveStableNumericId(profileId),
    name: identity.displayName,
    handle: identity.handle,
    avatar: buildAmbientAvatar(seed),
    bio: randomFrom(bioPool, hashString(`${seed}:bio`)) || bioPool[0],
    homeChannel: channel,
    boardScope: 'public',
  };
}

function buildResidentProfile(channel: ForumChannel, slot: number): ForumRuntimeAuthorProfile {
  return buildAmbientProfile(channel, `resident:${channel}:${slot}`);
}

function getRecentHeat(post: ForumPost, now: number) {
  const ageHours = Math.max(1, (now - post.timestamp) / (60 * 60 * 1000));
  return post.viewCount * 0.12 + post.likes.length * 5 + post.comments.length * 9 + Math.max(0, 42 - ageHours);
}

export function getForumHeatScore(post: ForumPost, now = Date.now()) {
  return getRecentHeat(post, now);
}

function getNestedReplyCount(post: ForumPost) {
  return post.comments.filter((comment) => !!comment.replyToId).length;
}

function getDirectReplyCount(post: ForumPost) {
  return Math.max(0, post.comments.length - getNestedReplyCount(post));
}

function getContinuationMomentum(post: ForumPost, now: number) {
  if (!post.lastHotContinuationAt) return 0;
  const ageMinutes = Math.max(0, (now - post.lastHotContinuationAt) / 60000);
  if (ageMinutes > 180) return 0;

  const baseBoost = post.lastHotContinuationSource === 'detail_refresh' ? 10 : 18;
  const decay = Math.max(0.2, 1 - ageMinutes / 180);
  const repetitionPenalty = Math.max(0.45, 1 - (post.hotContinuationCount || 0) * 0.18);
  return baseBoost * decay * repetitionPenalty;
}

export function getForumTrendBreakdown(post: ForumPost, now = Date.now()): ForumTrendBreakdown {
  const ageHours = Math.max(1, (now - post.timestamp) / (60 * 60 * 1000));
  const directReplyCount = getDirectReplyCount(post);
  const nestedReplyCount = getNestedReplyCount(post);
  const interactionCount = post.comments.length + post.likes.length + post.collections.length;
  const replyScore = directReplyCount * 15 + nestedReplyCount * 11;
  const likeScore = post.likes.length * 3.2;
  const collectionScore = post.collections.length * 5.6;
  const viewScore = Math.log10(Math.max(10, post.viewCount) + 1) * 15;
  const freshnessScore = ageHours <= 36
    ? Math.max(0, 26 - ageHours * 0.72)
    : -Math.min(18, (ageHours - 36) * 0.25);
  const tierScore = post.contentTier === 'highlight'
    ? 14
    : post.contentTier === 'ferment'
      ? 9
      : post.contentTier === 'fragment'
        ? 3
        : 0;
  const velocityBase = interactionCount / Math.max(1.4, ageHours / 6);
  const velocityScore = Math.min(22, velocityBase * 4.2);
  const discussionScore = directReplyCount >= 2
    ? Math.min(16, directReplyCount * 1.6 + nestedReplyCount * 0.8)
    : 0;
  const continuationScore = getContinuationMomentum(post, now);
  const score = replyScore
    + likeScore
    + collectionScore
    + viewScore
    + freshnessScore
    + tierScore
    + velocityScore
    + discussionScore
    + continuationScore;

  return {
    score,
    ageHours,
    directReplyCount,
    nestedReplyCount,
    interactionCount,
    replyScore,
    likeScore,
    collectionScore,
    viewScore,
    freshnessScore,
    tierScore,
    velocityScore,
    discussionScore,
    continuationScore,
  };
}

export function getForumTrendScore(post: ForumPost, now = Date.now()) {
  return getForumTrendBreakdown(post, now).score;
}

export function resolveForumTrendState(post: ForumPost, now = Date.now()) {
  const breakdown = getForumTrendBreakdown(post, now);
  const score = breakdown.score;
  const enoughDiscussion = post.comments.length >= 4;
  const enoughReach = post.viewCount >= 120 || post.likes.length >= 8 || post.collections.length >= 4;
  const warmDiscussion = post.comments.length >= 2;
  const warmReach = post.viewCount >= 60 || post.likes.length >= 4 || post.collections.length >= 2;

  if (score >= 128 && enoughDiscussion && enoughReach) {
    return { score, state: 'hot' as const, breakdown };
  }
  if (score >= 88 && warmDiscussion && warmReach) {
    return { score, state: 'warm' as const, breakdown };
  }
  return { score, state: 'none' as const, breakdown };
}

export function getForumTrendMeta(post: ForumPost, now = Date.now()) {
  const { state, breakdown } = resolveForumTrendState(post, now);
  if (state === 'hot' && breakdown.velocityScore >= 14) {
    return { label: '爆热', direction: 'up' as const };
  }
  if (breakdown.ageHours <= 18 && breakdown.velocityScore >= 9) {
    return { label: '急升', direction: 'up' as const };
  }
  if (state !== 'none' && breakdown.discussionScore >= 8) {
    return { label: '热议', direction: 'flat' as const };
  }
  if (breakdown.ageHours <= 48 && breakdown.score >= 70) {
    return { label: '平走', direction: 'flat' as const };
  }
  return { label: '回落', direction: 'down' as const };
}

export function normalizeForumTrendStates(
  posts: ForumPost[],
  inferChannel: (category: string) => ForumChannel,
  now = Date.now(),
) {
  const nextPosts = posts.map((post) => ({
    ...post,
    hotScore: getForumTrendScore(post, now),
    hotState: 'none' as const,
  }));

  const groups = new Map<string, ForumPost[]>();
  nextPosts.forEach((post) => {
    const board = getForumBoardScope(post);
    const key = board === 'spectator' ? 'spectator' : `public:${inferChannel(post.category)}`;
    const items = groups.get(key) || [];
    items.push(post);
    groups.set(key, items);
  });

  groups.forEach((groupPosts) => {
    const ranked = [...groupPosts].sort((left, right) => getForumTrendScore(right, now) - getForumTrendScore(left, now));
    const qualifiedHot = ranked.filter((post) => resolveForumTrendState(post, now).state === 'hot');
    const qualifiedWarm = ranked.filter((post) => {
      const state = resolveForumTrendState(post, now).state;
      return state === 'hot' || state === 'warm';
    });
    const hotLimit = Math.min(2, Math.max(0, Math.ceil(groupPosts.length * 0.08)));
    const warmLimit = Math.min(4, Math.max(hotLimit + 1, Math.ceil(groupPosts.length * 0.18)));
    const hotIds = new Set(qualifiedHot.slice(0, hotLimit).map((post) => post.id));
    const warmIds = new Set(qualifiedWarm.slice(0, warmLimit).map((post) => post.id));

    groupPosts.forEach((post) => {
      post.hotState = hotIds.has(post.id)
        ? 'hot'
        : warmIds.has(post.id)
          ? 'warm'
          : 'none';
    });
  });

  return nextPosts;
}

export function simulateForumAmbientActivity(input: SimulateForumAmbientActivityInput): SimulateForumAmbientActivityResult {
  const now = input.now || Date.now();
  const nextProfiles = { ...input.runtimeAuthorProfiles };
  let changed = false;
  const nextPosts = input.posts.map((post) => ({ ...post, comments: [...post.comments] }));
  const rankedPosts = [...nextPosts]
    .filter((post) => now - post.timestamp < 72 * 60 * 60 * 1000)
    .sort((a, b) => getRecentHeat(b, now) - getRecentHeat(a, now))
    .slice(0, 6);

  rankedPosts.forEach((post, index) => {
    const seed = hashString(`${post.id}:${now}:${index}`);
    const viewGain = 3 + (seed % 7) + Math.min(10, post.comments.length * 2);
    if (viewGain > 0) {
      post.viewCount += viewGain;
      changed = true;
    }

    const channel = input.inferChannel(post.category);
    const participantIds = new Set<string>([
      post.authorId,
      ...post.comments.map((comment) => comment.authorId),
    ]);
    const residentProfiles = Array.from({ length: 3 }, (_, residentIndex) => buildResidentProfile(channel, residentIndex));
    residentProfiles.forEach((profile) => {
      nextProfiles[profile.id] = profile;
      participantIds.add(profile.id);
    });

    const selectedCharacter = randomFrom(
      input.characters.filter((character) => character.id !== input.currentUserId),
      seed,
    );

    const shouldAddLike = seed % 100 < 55;
    if (shouldAddLike) {
      let likeAuthorId = randomFrom(Array.from(participantIds).filter((id) => id !== input.currentUserId), seed + 9);
      if (!likeAuthorId && selectedCharacter && seed % 4 === 0) {
        const profile = buildCharacterForumRuntimeProfile(selectedCharacter, channel);
        nextProfiles[selectedCharacter.id] = {
          ...(nextProfiles[selectedCharacter.id] || {}),
          ...profile,
          avatar: selectedCharacter.avatar,
          homeChannel: channel,
          boardScope: 'public',
        };
        likeAuthorId = selectedCharacter.id;
      }
      if (!likeAuthorId) {
        const newcomer = randomFrom(residentProfiles, seed + 13) || buildAmbientProfile(channel, `${post.id}:${seed}:like`);
        nextProfiles[newcomer.id] = newcomer;
        likeAuthorId = newcomer.id;
      }
      if (likeAuthorId && !post.likes.includes(likeAuthorId) && likeAuthorId !== input.currentUserId) {
        post.likes = [...post.likes, likeAuthorId];
        changed = true;
      }
    }

    const shouldAddCollection = seed % 100 < 22;
    if (shouldAddCollection) {
      let collectorId = randomFrom(Array.from(participantIds).filter((id) => id !== input.currentUserId), seed + 17);
      if (!collectorId && selectedCharacter && seed % 6 === 0) {
        const profile = buildCharacterForumRuntimeProfile(selectedCharacter, channel);
        nextProfiles[selectedCharacter.id] = {
          ...(nextProfiles[selectedCharacter.id] || {}),
          ...profile,
          avatar: selectedCharacter.avatar,
          homeChannel: channel,
          boardScope: 'public',
        };
        collectorId = selectedCharacter.id;
      }
      if (collectorId && !post.collections.includes(collectorId) && collectorId !== input.currentUserId) {
        post.collections = [...post.collections, collectorId];
        changed = true;
      }
    }
  });

  return {
    posts: nextPosts,
    runtimeAuthorProfiles: nextProfiles,
    changed,
  };
}
