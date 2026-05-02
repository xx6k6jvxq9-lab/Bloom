import { FORUM_SEED_NPC_PROFILES, type ForumSeedNpcProfile } from '../../features/forum-domain/seedThreadsCatalog';
import type { ForumChannel, ForumThreadType } from '../../features/forum-domain/types';
import type { ForumPost } from '../../types';
import type { GeneratedForumAuthorDraft } from './generateForumThreads';

type ForumReplyRoleTag = 'op' | 'character' | 'familiar' | 'regular' | 'seed';

type ResolvedForumAuthorProfile = {
  id: string;
  name: string;
  bio?: string;
  description?: string;
  persona?: string;
  speakingStyle?: string;
  preferredMove?: string;
  handle?: string;
};

type ForumReplyParticipantPoolItem = {
  id: string;
  displayName: string;
  persona: string;
  speakingStyle?: string;
  preferredMove?: string;
  roleTag?: ForumReplyRoleTag;
};

type PickRecurringForumAuthorsForChannelInput = {
  posts: ForumPost[];
  channel: ForumChannel;
  currentUserId: string;
  inferChannel: (category: string) => ForumChannel;
  getAuthor: (authorId: string) => ResolvedForumAuthorProfile;
};

type SelectForumReplyAuthorPoolInput = {
  post: ForumPost;
  desiredReplyCount?: number;
  currentUserId: string;
  inferChannel: (category: string) => ForumChannel;
  getAuthor: (authorId: string) => ResolvedForumAuthorProfile;
  getCharacterById: (authorId: string) => unknown;
  recurringAuthors?: GeneratedForumAuthorDraft[];
  seedProfiles?: ForumSeedNpcProfile[];
  prioritizedAuthorIds?: string[];
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickByHash<T>(items: T[], seed: string) {
  if (!items.length) return undefined;
  return items[hashString(seed) % items.length];
}

function inferAuthorPreferredMove(authorId: string) {
  const profile = FORUM_SEED_NPC_PROFILES.find((item) => item.id === authorId);
  if (!profile) return undefined;
  const bio = `${profile.name} ${profile.bio}`;
  if (/补刀|扎心|嘴损|点破/.test(bio)) return '顺手补刀';
  if (/观察|分析|看得懂|冷静/.test(bio)) return '认真分析';
  if (/看戏|吃瓜|围观/.test(bio)) return '看戏接话';
  return undefined;
}

function buildReplyArchetype(post: ForumPost, authorId: string, inferChannel: (category: string) => ForumChannel, roleTag?: ForumReplyRoleTag) {
  const threadType = post.threadType || 'normal';
  const channel = inferChannel(post.category);
  const basePersona = roleTag === 'op'
    ? [
        '楼主本人，回帖更像被点到才出来补一句、改口一点或追问一句。',
        '不要重复主楼，要像真在楼里接人。',
      ]
    : roleTag === 'familiar'
      ? [
          '这个号在这类楼里常冒头，像会被人认出来的熟脸。',
          '说话可以更直接，带一点固定脾气和固定偏见。',
        ]
      : roleTag === 'seed'
        ? [
            '更像路过网友，句子可以短，但别像模板托。',
            '不用每次都正经分析，可以顺手接一句、阴阳一句、站边一句。',
          ]
        : [
            '普通常驻网友，不是系统旁白。',
            '说话可以有偏见、有倾向、有顺手接话感。',
          ];

  const movePools: Partial<Record<ForumThreadType, string[]>> = {
    commission: ['认真给建议', '先质疑边界再给方案', '顺手吐槽但还是会回正题'],
    ownerUpdate: ['追问细节', '拿前面楼层来对照', '顺手说一句“我就知道没那么简单”'],
    reversal: ['改口站队', '补刀前面判断', '抓住反转点往下接'],
    sameTopic: ['认领同款经历', '补一个更离谱的细节', '顺手抬高楼里的那句定义'],
    timeline: ['补时间点', '抓一处最不对劲的环节', '顺手翻前面某层旧账'],
    vote: ['明确站队', '半认真半看戏地押后续', '顺手拱火让别人选边'],
    essay: ['接余味', '接画面', '一句像会被复读的感叹'],
    help: ['认真分析', '先护楼主再给建议', '提醒别被楼里带偏'],
  };

  const speakingPools: Partial<Record<ForumChannel, string[]>> = {
    present: ['像工位边八卦和宿舍楼道里的接话', '嘴上克制一点，但句尾容易带判断'],
    junction: ['像跨区热楼里会出现的接梗口气', '更适合半真半假的围观感'],
    weird: ['像夜里翻楼时顺手留下的一句冷评论', '可以轻微发毛，但不要像规则说明'],
    cyber: ['像内网吃瓜和权限楼里的冷静阴阳', '更适合短句点破，不适合抒情'],
    dreamStation: ['像夜车错站楼里的半醒评论', '可以轻一点、漂一点，但还是论坛口气'],
  };

  const preferredMove = pickByHash(
    movePools[threadType] || ['顺手接一句', '补刀一句', '认真回一句'],
    `${post.id}:${authorId}:move`,
  );
  const speakingStyle = pickByHash(
    speakingPools[channel] || ['句子短一点，像楼里顺手接话', '别太工整，要像真的在刷楼时回的'],
    `${post.id}:${authorId}:style`,
  );

  return {
    persona: basePersona.join(' '),
    speakingStyle,
    preferredMove,
  };
}

export function pickRecurringForumAuthorsForChannel(input: PickRecurringForumAuthorsForChannelInput): GeneratedForumAuthorDraft[] {
  const { posts, channel, currentUserId, inferChannel, getAuthor } = input;
  const scoreMap = new Map<string, number>();
  const bump = (authorId: string, score: number) => {
    if (!authorId || authorId === currentUserId) return;
    if (authorId.startsWith(`seed-anon-${currentUserId}-`)) return;
    scoreMap.set(authorId, (scoreMap.get(authorId) || 0) + score);
  };

  posts.forEach((post) => {
    if (post.board === 'spectator') return;
    if (inferChannel(post.category) !== channel) return;
    bump(post.authorId, 5);
    post.comments.forEach((comment) => bump(comment.authorId, comment.replyToId ? 2 : 3));
  });

  return Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([authorId]) => {
      const author = getAuthor(authorId);
      return {
        id: authorId,
        displayName: author.name,
        bio: author.bio || author.description || '',
        handle: author.handle || '',
        avatarSeed: `${author.name}${author.handle || authorId}`,
      };
    })
    .filter((author) => !!author.displayName);
}

export function selectForumReplyAuthorPool(input: SelectForumReplyAuthorPoolInput) {
  const {
    post,
    desiredReplyCount = 6,
    currentUserId,
    inferChannel,
    getAuthor,
    getCharacterById,
    recurringAuthors = [],
    seedProfiles = FORUM_SEED_NPC_PROFILES,
    prioritizedAuthorIds = [],
  } = input;
  const prioritizedIdSet = new Set(prioritizedAuthorIds);

  const recentThreadAuthors = new Map<string, { count: number; lastSeenAt: number }>();
  [post.authorId, ...post.comments.map((comment) => comment.authorId)].forEach((authorId) => {
    if (!authorId || authorId === currentUserId) return;
    const existing = recentThreadAuthors.get(authorId);
    recentThreadAuthors.set(authorId, {
      count: (existing?.count || 0) + 1,
      lastSeenAt: authorId === post.authorId
        ? Math.max(existing?.lastSeenAt || 0, post.timestamp)
        : Math.max(existing?.lastSeenAt || 0, ...post.comments.filter((comment) => comment.authorId === authorId).map((comment) => comment.timestamp)),
    });
  });

  const threadAuthorIds = Array.from(recentThreadAuthors.entries())
    .sort((left, right) => {
      if (left[0] === post.authorId) return -1;
      if (right[0] === post.authorId) return 1;
      if (right[1].count !== left[1].count) return right[1].count - left[1].count;
      return right[1].lastSeenAt - left[1].lastSeenAt;
    })
    .map(([authorId]) => authorId);

  const knownAuthors: ForumReplyParticipantPoolItem[] = threadAuthorIds
    .filter((authorId) => !getCharacterById(authorId))
    .map((authorId) => {
      const author = getAuthor(authorId);
      const roleTag = authorId === post.authorId ? 'op' : recentThreadAuthors.get(authorId)?.count && recentThreadAuthors.get(authorId)!.count >= 2 ? 'familiar' : 'regular';
      const archetype = buildReplyArchetype(post, authorId, inferChannel, roleTag);
      return {
        id: authorId,
        displayName: author.name,
        persona: [author.persona || author.description || author.bio || '', archetype.persona].filter(Boolean).join('；'),
        speakingStyle: author.speakingStyle || archetype.speakingStyle,
        preferredMove: author.preferredMove || inferAuthorPreferredMove(authorId) || archetype.preferredMove,
        roleTag,
      };
    });

  const category = inferChannel(post.category);
  const channelKeyword = category === 'oldDynasty'
    ? 'old'
    : category === 'otherworld'
      ? 'other'
      : category === 'starSea'
        ? 'star'
        : category;

  const recurringChannelAuthors: ForumReplyParticipantPoolItem[] = recurringAuthors
    .filter((author) => !getCharacterById(author.id))
    .filter((author) => !knownAuthors.some((item) => item.id === author.id))
    .slice(0, Math.max(3, Math.min(6, Math.ceil(desiredReplyCount / 4))))
    .map((author) => {
      const archetype = buildReplyArchetype(post, author.id, inferChannel, 'familiar');
      return {
        id: author.id,
        displayName: author.displayName,
        persona: [author.bio, archetype.persona].filter(Boolean).join('；'),
        speakingStyle: author.speakingStyle || archetype.speakingStyle,
        preferredMove: archetype.preferredMove,
        roleTag: 'familiar',
      };
    });

  const supplementalAuthors: ForumReplyParticipantPoolItem[] = seedProfiles
    .filter((profile) => profile.id.includes(channelKeyword) || category === 'junction')
    .filter((profile) => !knownAuthors.some((author) => author.id === profile.id))
    .filter((profile) => !recurringChannelAuthors.some((author) => author.id === profile.id))
    .slice(0, Math.max(4, Math.min(10, desiredReplyCount)))
    .map((profile) => {
      const archetype = buildReplyArchetype(post, profile.id, inferChannel, 'seed');
      return {
        id: profile.id,
        displayName: profile.name,
        persona: [profile.bio, archetype.persona].filter(Boolean).join('；'),
        speakingStyle: archetype.speakingStyle,
        preferredMove: archetype.preferredMove,
        roleTag: 'seed',
      };
    });

  const targetPoolSize = Math.max(6, Math.min(12, Math.ceil(desiredReplyCount / 2) + 2));
  const pool: ForumReplyParticipantPoolItem[] = [...knownAuthors, ...recurringChannelAuthors, ...supplementalAuthors]
    .sort((left, right) => {
      const leftPriority = prioritizedIdSet.has(left.id) ? 1 : 0;
      const rightPriority = prioritizedIdSet.has(right.id) ? 1 : 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return 0;
    })
    .slice(0, targetPoolSize);

  return {
    knownAuthors: pool.map(({ id, displayName }) => ({ id, displayName })),
    participants: pool.map(({ displayName, persona, speakingStyle, preferredMove, roleTag }) => ({
      displayName,
      persona,
      speakingStyle,
      preferredMove,
      roleTag,
    })),
  };
}
