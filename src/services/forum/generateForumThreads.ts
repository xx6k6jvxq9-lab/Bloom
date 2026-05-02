import type { ApiConfig, ForumGlobalSettings, ForumPost, WorldBookEntry } from '../../types';
import { forumThreadV2ToLegacyPost } from '../../features/forum-domain/adapters';
import type { ForumChannel, ForumCommentV2, ForumThreadType, ForumThreadV2 } from '../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS, getForumWorldTheme } from '../../features/forum-domain/constants';
import { buildReadableForumHandle } from '../../features/forum-domain/characterForumPersona';
import { FORUM_SCENARIO_PROMPT } from '../ai/prompts/scenarios/forum';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import type { ForumTopicPackage } from './forumTopicPlanner';
import { buildForumPostMeta } from './forumOrchestration';
import { inferForumContentTier, inferForumDiscourseAxis } from './forumContentTier';
import { polishGeneratedForumThread } from './polishGeneratedForumThread';
import { buildForumPostFooterTags } from './forumPostTags';

export type GeneratedForumAuthorDraft = {
  id: string;
  displayName: string;
  bio?: string;
  persona?: string;
  speakingStyle?: string;
  handle?: string;
  avatarSeed?: string;
  sourceDisplayName?: string;
};

type GenerateForumThreadsInput = {
  activeConfig: ApiConfig;
  channel: ForumChannel;
  existingPosts: ForumPost[];
  count: number;
  globalSettings?: ForumGlobalSettings;
  worldBooks?: WorldBookEntry[];
  recurringAuthors?: GeneratedForumAuthorDraft[];
  allowedThreadTypes?: ForumThreadType[];
  ordinaryPostFloor?: number;
  recurringAuthorTargetCount?: number;
  preferNewAuthors?: boolean;
  suppressForcedVariety?: boolean;
  preferredTopicText?: string;
  preferredSceneText?: string;
  preferredConflictText?: string;
  preferredRelationshipText?: string;
  excludedTopicText?: string;
};

export type GenerateForumThreadsResult = {
  authors: GeneratedForumAuthorDraft[];
  posts: ForumPost[];
  threads: ForumThreadV2[];
  topicPackage?: ForumTopicPackage;
};

type ParsedGeneratedComment = {
  displayName: string;
  content: string;
  replyToFloor?: number;
};

type ParsedGeneratedPost = {
  displayName: string;
  threadType?: ForumThreadType;
  title: string;
  body: string;
  comments?: ParsedGeneratedComment[];
};

type ParsedGeneratedAuthor = {
  displayName: string;
  bio?: string;
  handle?: string;
  persona?: string;
  speakingStyle?: string;
  avatarSeed?: string;
};

type ParsedGeneratedBatch = {
  authors: ParsedGeneratedAuthor[];
  posts: ParsedGeneratedPost[];
};

type RankedGeneratedPost = {
  index: number;
  post: ParsedGeneratedPost;
  resolvedThreadType: ForumThreadType;
};

const VALID_FORUM_THREAD_TYPES: ForumThreadType[] = ['normal', 'gossip', 'help', 'rift', 'sameTopic', 'sighting', 'timeline', 'essay', 'vote', 'commission', 'reversal', 'ownerUpdate'];

function isForumThreadType(value: unknown): value is ForumThreadType {
  return typeof value === 'string' && VALID_FORUM_THREAD_TYPES.includes(value as ForumThreadType);
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeName(value: string) {
  return value.replace(/^@/, '').replace(/\s+/g, '').trim().toLowerCase();
}

function containsHan(value: string) {
  return /\p{Script=Han}/u.test(value);
}

function looksMachineGeneratedIdentity(value?: string) {
  if (!value) return true;
  const normalized = value.trim();
  return /forum[_-]?runtime|generated[_-]?post|seed-|guest|visitor|temp|npc|system|runtime/i.test(normalized)
    || /[A-Za-z]{4,}[_-][A-Za-z0-9_-]{2,}/.test(normalized)
    || /^[A-Za-z0-9_]{8,}$/.test(normalized)
    || /_{1,}/.test(normalized)
    || /\d{3,}/.test(normalized);
}

function looksLivelyForumHandle(value?: string) {
  if (!value) return false;
  const normalized = value.replace(/^@/, '').trim();
  return containsHan(normalized)
    && !looksMachineGeneratedIdentity(normalized)
    && /^[\p{Script=Han}A-Za-z0-9·]{2,12}$/u.test(normalized);
}

function looksLivelyForumBio(value?: string) {
  if (!value) return false;
  const normalized = value.trim();
  return containsHan(normalized) && normalized.length >= 4 && normalized.length <= 48;
}

function isValidGeneratedBatch(batch: ParsedGeneratedBatch) {
  return batch.authors.length >= 1
    && batch.posts.length >= 1
    && batch.authors.every((author) => containsHan(author.displayName))
    && batch.posts.every((post) => !!post.displayName && !!post.body);
}

function buildRecentTopicHints(posts: ForumPost[]) {
  return posts
    .slice(0, 8)
    .map((post) => `${post.title || '无标题'}：${post.content.slice(0, 36).replace(/\s+/g, ' ')}`);
}

const CHANNEL_TOPIC_BUCKETS: Record<ForumChannel, string[]> = {
  junction: ['匿名掉马', '公共区互呛', '护短被看出来', '跨频道围观', '旧事翻车', '熟人装路人', '论坛社死', '权限没收回'],
  present: ['已读不回', '朋友圈秒赞', '室友边界', '打工人关系', '前任返场', '暧昧拉扯', '树洞社死', '相亲翻车'],
  oldDynasty: ['名分拉扯', '后宅误会', '婚约体面', '王府照拂', '席间失态', '家宴站队', '退婚风波', '私下护短'],
  xianmen: ['闭关前后', '破戒迹象', '心魔失控', '道侣误读', '灵脉照看', '师门偏心', '历劫事故', '无情道嘴硬'],
  otherworld: ['冒险队夜守', '契约边界', '公会委托', '幼崽粘人', '龙族宣示', '跨种族误会', '圣堂事故', '旅店八卦'],
  starSea: ['白名单异常', '权限越界', '匹配度嘴硬', '舰桥目光', '精神海波动', '作战链偏爱', '保密协定', '冷脸护人'],
  weird: ['规则更新', '门外敲门', '电梯异常', '走廊脚步', '旧楼广播', '白纸规则', '活人误入', '例外保护'],
  cyber: ['日志越权', '监控盯人', '仿生人边界', '系统冻结', '权限回收', '数据误删', '替你决定', '内网事故'],
  apocalypse: ['物资分配', '避难所关系', '巡夜轮班', '感染猜疑', '旧信号'],
  underworld: ['引魂误会', '判官偏袒', '名册异常', '忘川旧事', '冥灯失火'],
  dragonPalace: ['婚配旧约', '龙鳞忌讳', '海宴风波', '赐珠误解', '夜巡偏心'],
  infiniteTower: ['层数事故', '队友绑定', '奖励分配', '通关嘴硬', '危险提示'],
  godCourt: ['神谕偏心', '司命失笔', '神庭宴席', '降罚护短', '天规空子'],
  dreamStation: ['梦站偶遇', '转乘失联', '梦境掉马', '夜车目击', '错站重逢'],
  bookCity: ['角色出格', '章节改命', '作者偏爱', '番外事故', '设定穿帮'],
  beastPlain: ['兽群守夜', '标记误会', '幼崽认人', '领地争执', '换毛期嘴硬'],
};

function normalizeTopicFingerprint(value: string) {
  return value
    .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, '')
    .slice(0, 24)
    .toLowerCase();
}

function inferThreadTypeFromContent(post: Pick<ParsedGeneratedPost, 'title' | 'body'>): ForumThreadType {
  const text = `${post.title} ${post.body}`.toLowerCase();
  if (/后续|更新|补充|二编|编辑一下|再补一句|说下后续|汇报/.test(text)) return 'ownerUpdate';
  if (/反转|打脸|结果是|没想到|后来发现|真相|反而是/.test(text)) return 'reversal';
  if (/投票|站队|押|开盘|选哪个|买股/.test(text)) return 'vote';
  if (/片段|短打|短文|同人|脑补/.test(text)) return 'essay';
  if (/时间线|复盘|记录|repo|整理一下/.test(text)) return 'timeline';
  if (/看见|目击|撞见|路过|我在现场/.test(text)) return 'sighting';
  if (/爆料|吃瓜|风声|听说|不保真/.test(text)) return 'gossip';
  if (/求助|怎么办|该不该|想问问|有人懂/.test(text)) return 'help';
  if (/求助|怎么办|委托|悬赏|有没有人|谁能|帮忙/.test(text)) return 'commission';
  if (/同题|也来|同样|同一个问题|来个同题|跟风/.test(text)) return 'sameTopic';
  if (/跨区|串台|裂缝|两个世界|界外|错频|时空/.test(text)) return 'rift';
  return 'normal';
}

function stripCodeFence(raw: string) {
  return raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function normalizePossiblyBrokenJson(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function sanitizeGeneratedJsonKey(value: string) {
  const normalized = value.trim().replace(/^['"]|['"]$/g, '');
  const tail = normalized.split(/[\\/]/).pop() || normalized;
  return tail.trim() || normalized;
}

function normalizeForumJsonCandidate(value: string) {
  return normalizePossiblyBrokenJson(value)
    .replace(/([{,]\s*)'([^']+)'\s*:/g, (_, prefix: string, key: string) => `${prefix}"${sanitizeGeneratedJsonKey(key)}":`)
    .replace(/([{,]\s*)"([^"]+)"\s*:/g, (_, prefix: string, key: string) => `${prefix}"${sanitizeGeneratedJsonKey(key)}":`)
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_/-]*)\s*:/g, (_, prefix: string, key: string) => `${prefix}"${sanitizeGeneratedJsonKey(key)}":`)
    .replace(/:\s*'((?:\\.|[^'\\])*)'/g, (_, rawValue: string) => `: "${rawValue.replace(/"/g, '\\"')}"`);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function randomAlphaTag(length = 4) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let token = '';
  for (let index = 0; index < length; index += 1) {
    token += letters[Math.floor(Math.random() * letters.length)];
  }
  return token;
}

function sanitizeIdWord(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
  if (!normalized) return '';
  if (/[a-z]/.test(normalized)) return normalized.slice(0, 8);
  return '';
}

function buildHumanForumId(prefix: string, seed: string, fallbackWord: string) {
  const moodPool = ['soft', 'night', 'mild', 'hush', 'after', 'moon', 'glass', 'paper', 'amber', 'velvet'] as const;
  const placePool = ['room', 'hall', 'gate', 'desk', 'lane', 'note', 'floor', 'corner', 'cloud', 'echo'] as const;
  const hash = hashString(`${prefix}:${seed}`);
  const mood = moodPool[hash % moodPool.length];
  const place = placePool[Math.floor(hash / moodPool.length) % placePool.length];
  const word = sanitizeIdWord(seed) || fallbackWord;
  return `${prefix}_${word}_${mood}_${place}_${randomAlphaTag(3)}`;
}

function findBalancedSegment(value: string, startIndex: number, openChar: string, closeChar: string) {
  let depth = 0;
  let inString = false;
  let quoteChar = '';
  let escaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quoteChar) {
        inString = false;
        quoteChar = '';
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      quoteChar = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function extractNamedArraySegment(value: string, fieldName: string) {
  const patterns = [
    new RegExp(`"${fieldName}"\\s*:`, 'i'),
    new RegExp(`'${fieldName}'\\s*:`, 'i'),
    new RegExp(`\\b${fieldName}\\b\\s*:`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (!match) continue;
    const arrayStart = value.indexOf('[', match.index + match[0].length);
    if (arrayStart === -1) continue;
    const segment = findBalancedSegment(value, arrayStart, '[', ']');
    if (segment) return segment;
  }

  return null;
}

function extractTopLevelObjectLiterals(arrayText: string) {
  const objects: string[] = [];
  let cursor = 0;

  while (cursor < arrayText.length) {
    const start = arrayText.indexOf('{', cursor);
    if (start === -1) break;
    const segment = findBalancedSegment(arrayText, start, '{', '}');
    if (!segment) break;
    objects.push(segment);
    cursor = start + segment.length;
  }

  return objects;
}

function buildFallbackTitleFromBody(body: string) {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length <= 24 ? compact : `${compact.slice(0, 24)}…`;
}

function parseAuthorRecord(item: unknown): ParsedGeneratedAuthor | null {
  if (!item || typeof item !== 'object') return null;
  const authorRecord = item as Record<string, unknown>;
  const displayName = typeof authorRecord.displayName === 'string'
    ? authorRecord.displayName.trim()
    : typeof authorRecord.name === 'string'
      ? authorRecord.name.trim()
      : '';
  if (!displayName) return null;

  return {
    displayName,
    bio: typeof authorRecord.bio === 'string'
      ? authorRecord.bio.trim()
      : typeof authorRecord.description === 'string'
        ? authorRecord.description.trim()
        : '',
    handle: typeof authorRecord.handle === 'string'
      ? authorRecord.handle.trim()
      : typeof authorRecord.id === 'string'
        ? authorRecord.id.trim()
        : '',
    persona: typeof authorRecord.persona === 'string' ? authorRecord.persona.trim() : '',
    speakingStyle: typeof authorRecord.speakingStyle === 'string' ? authorRecord.speakingStyle.trim() : '',
    avatarSeed: typeof authorRecord.avatarSeed === 'string'
      ? authorRecord.avatarSeed.trim()
      : typeof authorRecord.avatar === 'string'
        ? authorRecord.avatar.trim()
        : '',
  };
}

function parseCommentRecord(item: unknown): ParsedGeneratedComment | null {
  if (!item || typeof item !== 'object') return null;
  const commentRecord = item as Record<string, unknown>;
  const displayName = typeof commentRecord.displayName === 'string'
    ? commentRecord.displayName.trim()
    : typeof commentRecord.author === 'string'
      ? commentRecord.author.trim()
      : '';
  const content = typeof commentRecord.content === 'string' ? commentRecord.content.trim() : '';
  if (!displayName || !content) return null;

  return {
    displayName,
    content,
    replyToFloor: typeof commentRecord.replyToFloor === 'number'
      ? Math.max(1, Math.floor(commentRecord.replyToFloor))
      : undefined,
  };
}

function parsePostRecord(item: unknown): ParsedGeneratedPost | null {
  if (!item || typeof item !== 'object') return null;
  const postRecord = item as Record<string, unknown>;
  const displayName = typeof postRecord.displayName === 'string'
    ? postRecord.displayName.trim()
    : typeof postRecord.author === 'string'
      ? postRecord.author.trim()
      : '';
  const body = typeof postRecord.body === 'string'
    ? postRecord.body.trim()
    : typeof postRecord.content === 'string'
      ? postRecord.content.trim()
      : '';
  if (!displayName || !body) return null;

  return {
    displayName,
    threadType: isForumThreadType(postRecord.threadType) ? postRecord.threadType : undefined,
    title: typeof postRecord.title === 'string' ? postRecord.title.trim() : buildFallbackTitleFromBody(body),
    body,
    comments: Array.isArray(postRecord.comments)
      ? postRecord.comments
        .map((comment) => parseCommentRecord(comment))
        .filter((comment): comment is ParsedGeneratedComment => !!comment)
      : [],
  };
}

function parseLooseRecordArray<T>(raw: string, fieldName: string, parser: (item: unknown) => T | null): T[] {
  const segment = extractNamedArraySegment(raw, fieldName);
  if (!segment) return [];

  return extractTopLevelObjectLiterals(segment)
    .map((literal) => {
      try {
        return JSON.parse(normalizeForumJsonCandidate(literal)) as unknown;
      } catch {
        return null;
      }
    })
    .map((item) => parser(item))
    .filter((item): item is T => !!item);
}

function buildFallbackAuthorsFromPosts(posts: ParsedGeneratedPost[]) {
  const deduped = new Map<string, ParsedGeneratedAuthor>();

  const register = (displayName: string) => {
    const normalized = normalizeName(displayName);
    if (!normalized || deduped.has(normalized)) return;
    deduped.set(normalized, { displayName });
  };

  posts.forEach((post) => {
    register(post.displayName);
    (post.comments || []).forEach((comment) => register(comment.displayName));
  });

  return [...deduped.values()];
}

function finalizeParsedBatch(batch: ParsedGeneratedBatch): ParsedGeneratedBatch | null {
  const posts = batch.posts
    .map((post) => ({
      ...post,
      title: post.title?.trim() || buildFallbackTitleFromBody(post.body),
      body: post.body.trim(),
      comments: (post.comments || []).filter((comment) => comment.displayName && comment.content),
    }))
    .filter((post) => post.displayName && post.body);

  if (!posts.length) return null;

  const authors = [...batch.authors, ...buildFallbackAuthorsFromPosts(posts)]
    .reduce<ParsedGeneratedAuthor[]>((collection, author) => {
      const normalized = normalizeName(author.displayName);
      if (!normalized) return collection;
      if (collection.some((item) => normalizeName(item.displayName) === normalized)) return collection;
      collection.push(author);
      return collection;
    }, []);

  if (!authors.length) return null;

  return { authors, posts };
}

function selectGeneratedPosts(input: {
  posts: ParsedGeneratedPost[];
  count: number;
  ordinaryPostFloor?: number;
}) {
  const { posts, count, ordinaryPostFloor = 0 } = input;
  const rankedPosts: RankedGeneratedPost[] = posts.map((post, index) => ({
    index,
    post,
    resolvedThreadType: post.threadType || inferThreadTypeFromContent(post),
  }));
  const desiredNormalCount = Math.max(0, Math.min(count, ordinaryPostFloor));
  const normalCandidates = rankedPosts.filter((entry) => entry.resolvedThreadType === 'normal');
  const nonNormalCandidates = rankedPosts.filter((entry) => entry.resolvedThreadType !== 'normal');
  const selected: RankedGeneratedPost[] = [];
  const selectedIndexes = new Set<number>();

  normalCandidates.slice(0, desiredNormalCount).forEach((entry) => {
    selected.push(entry);
    selectedIndexes.add(entry.index);
  });

  nonNormalCandidates.slice(0, Math.max(0, count - selected.length)).forEach((entry) => {
    if (selectedIndexes.has(entry.index)) return;
    selected.push(entry);
    selectedIndexes.add(entry.index);
  });

  rankedPosts.forEach((entry) => {
    if (selected.length >= count) return;
    if (selectedIndexes.has(entry.index)) return;
    selected.push(entry);
    selectedIndexes.add(entry.index);
  });

  let normalShortfall = desiredNormalCount - selected.filter((entry) => entry.resolvedThreadType === 'normal').length;
  if (normalShortfall > 0) {
    selected.forEach((entry) => {
      if (normalShortfall <= 0) return;
      if (entry.resolvedThreadType === 'normal') return;
      if (entry.post.threadType) return;
      entry.resolvedThreadType = 'normal';
      normalShortfall -= 1;
    });
  }

  return selected
    .sort((left, right) => left.index - right.index)
    .slice(0, count);
}

function tryParseGeneratedBatch(raw: string): ParsedGeneratedBatch | null {
  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;

  const jsonText = normalizeForumJsonCandidate(cleaned.slice(start, end + 1));

  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    const authors = Array.isArray(record.authors)
      ? record.authors
        .map((item) => parseAuthorRecord(item))
        .filter((author): author is ParsedGeneratedAuthor => !!author)
      : [];
    const posts = Array.isArray(record.posts)
      ? record.posts
        .map((item) => parsePostRecord(item))
        .filter((post): post is ParsedGeneratedPost => !!post)
      : [];

    return finalizeParsedBatch({ authors, posts });
  } catch {
    const authors = parseLooseRecordArray(cleaned, 'authors', parseAuthorRecord);
    const posts = parseLooseRecordArray(cleaned, 'posts', parsePostRecord);
    return finalizeParsedBatch({ authors, posts });
  }
}

function resolveAuthorId(displayName: string, authors: GeneratedForumAuthorDraft[]) {
  const normalized = normalizeName(displayName);
  const matched = authors.find((author) => (
    normalizeName(author.displayName) === normalized
    || normalizeName(author.handle || '') === normalized
    || normalizeName(author.sourceDisplayName || '') === normalized
  ));
  return matched?.id || authors[0]?.id || 'forum_npc_momo';
}

function resolveReusableAuthor(author: ParsedGeneratedAuthor, recurringAuthors: GeneratedForumAuthorDraft[]) {
  const normalizedDisplayName = normalizeName(author.displayName);
  const normalizedHandle = normalizeName(author.handle || '');
  return recurringAuthors.find((item) => (
    normalizeName(item.displayName) === normalizedDisplayName
    || (!!normalizedHandle && normalizeName(item.handle || '') === normalizedHandle)
    || (!!item.sourceDisplayName && normalizeName(item.sourceDisplayName) === normalizedDisplayName)
  ));
}

function buildFallbackForumBio(displayName: string, channel: ForumChannel, threadType?: ForumThreadType) {
  const channelLabel = FORUM_CHANNEL_LABELS[channel];
  const fallbackPool = [
    `${channelLabel}常驻，偶尔冒头`,
    `路过${channelLabel}，顺手回帖`,
    `在${channelLabel}蹲楼`,
    `${threadType || 'normal'}体质，看到就会说两句`,
  ];
  return fallbackPool[hashString(`${displayName}:${channel}:${threadType || 'normal'}`) % fallbackPool.length];
}

function buildSimpleForumBatchPrompt(input: GenerateForumThreadsInput) {
  const {
    channel,
    existingPosts,
    count,
    recurringAuthors = [],
    allowedThreadTypes,
    preferredTopicText,
    preferredSceneText,
    preferredConflictText,
    preferredRelationshipText,
    excludedTopicText,
  } = input;
  const recentTopicHints = buildRecentTopicHints(existingPosts);
  const worldTheme = getForumWorldTheme(channel);
  const topicBuckets = CHANNEL_TOPIC_BUCKETS[channel] || [];
  const resolvedAllowedThreadTypes = (allowedThreadTypes || []).length > 0
    ? (allowedThreadTypes || []).join(' | ')
    : VALID_FORUM_THREAD_TYPES.join(' | ');
  const recurringAuthorHint = recurringAuthors.length
    ? `这一轮可以优先复用这些熟脸，但不要全用熟脸：${recurringAuthors.map((author) => `${author.displayName}(@${author.handle || author.displayName})`).join('、')}`
    : '';

  return [
    FORUM_SCENARIO_PROMPT,
    '## 刷新论坛帖子任务',
    `目标频道：${FORUM_CHANNEL_LABELS[channel]}`,
    `本轮一次性生成 ${count} 条新帖子。`,
    '这些帖子是用户手动刷新论坛后看到的新内容，要像同一时间段一起冒出来的新帖，但不要互相太像。',
    recentTopicHints.length ? `最近已有帖子，尽量避开重复话题：${recentTopicHints.join(' | ')}` : '',
    topicBuckets.length ? `优先从这些不同子话题里分散选题：${topicBuckets.join('、')}` : '',
    worldTheme?.exampleTopics?.length ? `世界参考话题只作语气参考，不要照抄：${worldTheme.exampleTopics.join('、')}` : '',
    preferredTopicText?.trim() ? `Preferred topic cues: ${preferredTopicText.trim()}` : '',
    preferredSceneText?.trim() ? `Preferred scene cues: ${preferredSceneText.trim()}` : '',
    preferredConflictText?.trim() ? `Preferred conflict cues: ${preferredConflictText.trim()}` : '',
    preferredRelationshipText?.trim() ? `Preferred relationship cues: ${preferredRelationshipText.trim()}` : '',
    excludedTopicText?.trim() ? `Avoid these directions: ${excludedTopicText.trim()}` : '',
    recurringAuthorHint,
    `这一轮允许的 threadType：${resolvedAllowedThreadTypes}`,
    input.ordinaryPostFloor ? `普通帖尽量保底 ${Math.min(count, input.ordinaryPostFloor)} 条，但不用为了凑数写得很假。` : '',
    '请先生成 4 到 6 个本轮会出现的论坛网友，再让他们去发帖和评论。',
    '这些网友要像论坛里真实会反复见到的人，不要叫“网友A”“路人1”“用户1234”。',
    '每条帖子都要有：发帖显示名、标题、正文、几条评论。',
    '帖子和评论都要像论坛现场，不要像说明书，也不要像标准作文。',
    '输出必须是一个 JSON 对象，不要输出解释。',
    'JSON 对象格式固定为：',
    '{',
    '  "authors": [',
    '    { "displayName": "网友显示名", "bio": "短简介", "handle": "论坛ID", "persona": "公开人设简介", "speakingStyle": "说话方式", "avatarSeed": "头像seed词" }',
    '  ],',
    '  "posts": [',
    '    {',
    '      "displayName": "必须从authors里选一个",',
    '      "threadType": "normal | gossip | help | commission | sameTopic | sighting | timeline | essay | vote | reversal | ownerUpdate | rift",',
    '      "title": "帖子标题",',
    '      "body": "帖子正文",',
    '      "comments": [',
    '        { "displayName": "必须从authors里选一个", "content": "评论正文" },',
    '        { "displayName": "必须从authors里选一个", "content": "评论正文", "replyToFloor": 1 }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '不要缺字段，不要输出 null，不要输出对象外的任何说明文字。',
    'JSON key names must stay exactly as written above.',
    'Do not prefix keys with ln/, line/, index, notes, or any extra markers.',
    'Use standard double quotes for every key and every string value.',
    'Essay posts must be 400 to 500 Chinese characters and broken into multiple paragraphs.',
    'Vote posts must include clear A/B/C/D options on separate lines so the poll card can render.',
    'Use varied paragraph rhythms and at most 3 visual decoration blocks in the body.',
    input.ordinaryPostFloor ? `At least ${Math.min(count, input.ordinaryPostFloor)} posts should use threadType "normal".` : '',
  ].filter(Boolean).join('\n');
}

export async function generateForumThreads(input: GenerateForumThreadsInput): Promise<GenerateForumThreadsResult> {
  const { activeConfig, channel, existingPosts, count, recurringAuthors = [] } = input;
  if (count <= 0) return { authors: [], posts: [], threads: [], topicPackage: undefined };

  const prompt = buildSimpleForumBatchPrompt(input);
  const raw = await generateTextFromMessagesWithConfig({
    activeConfig,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.68,
  }) || '';

  const parsedBatch = tryParseGeneratedBatch(raw);
  if (!parsedBatch || !parsedBatch.authors.length || !parsedBatch.posts.length || !isValidGeneratedBatch(parsedBatch)) {
    console.error('[forum] batch thread parse failed', {
      channel,
      count,
      rawPreview: (raw || '').slice(0, 400),
    });
    return { authors: [], posts: [], threads: [], topicPackage: undefined };
  }

  const now = Date.now();
  const generatedAuthors: GeneratedForumAuthorDraft[] = parsedBatch.authors.map((author, index) => {
    const reusable = resolveReusableAuthor(author, recurringAuthors);
    const displayName = reusable?.displayName || author.displayName;
    const handle = (reusable?.handle || author.handle || '').replace(/^@/, '').trim();
    const finalHandle = looksLivelyForumHandle(handle)
      ? handle
      : buildReadableForumHandle({ id: `${channel}-${displayName}-${index}`, name: displayName });
    return {
      id: reusable?.id || buildHumanForumId(`forum_runtime_${channel}`, `${displayName}_${finalHandle}_${index}`, 'guest'),
      displayName,
      bio: reusable?.bio || (looksLivelyForumBio(author.bio) ? author.bio : buildFallbackForumBio(displayName, channel)),
      handle: finalHandle,
      persona: reusable?.persona || author.persona,
      speakingStyle: reusable?.speakingStyle || author.speakingStyle,
      avatarSeed: reusable?.avatarSeed || author.avatarSeed || `${displayName}${finalHandle}`,
      sourceDisplayName: reusable?.sourceDisplayName || author.displayName,
    };
  });

  const dedupedPosts = parsedBatch.posts.filter((item, index, collection) => {
    const titleKey = normalizeTopicFingerprint(item.title);
    const bodyKey = normalizeTopicFingerprint(item.body);
    return collection.findIndex((candidate) => (
      normalizeTopicFingerprint(candidate.title) === titleKey
      && normalizeTopicFingerprint(candidate.body) === bodyKey
    )) === index;
  });

  const existingTitleKeys = new Set(existingPosts.map((post) => normalizeTopicFingerprint(post.title)));
  const existingBodyKeys = new Set(existingPosts.map((post) => normalizeTopicFingerprint(post.content)));
  const uniquePosts = dedupedPosts.filter((item) => {
    const titleKey = normalizeTopicFingerprint(item.title);
    const bodyKey = normalizeTopicFingerprint(item.body);
    return !(existingTitleKeys.has(titleKey) && existingBodyKeys.has(bodyKey));
  });

  const candidatePosts = uniquePosts.length >= Math.max(1, Math.min(count, 4))
    ? uniquePosts
    : dedupedPosts;

  const selectedPosts = selectGeneratedPosts({
    posts: candidatePosts,
    count,
    ordinaryPostFloor: input.ordinaryPostFloor,
  });

  const threads = selectedPosts.map(({ post: item, resolvedThreadType }, index): ForumThreadV2 => {
    const inferredMeta = buildForumPostMeta(item.title, item.body, channel);
    const resolvedContentTier = resolvedThreadType === 'essay'
      ? inferForumContentTier(resolvedThreadType, item.title, item.body)
      : inferForumContentTier(resolvedThreadType, item.title, item.body);
    const resolvedDiscourseAxis = inferForumDiscourseAxis(resolvedThreadType, channel, item.title, item.body);
    const polished = polishGeneratedForumThread({
      channel,
      threadType: resolvedThreadType,
      contentTier: resolvedContentTier,
      discourseAxis: resolvedDiscourseAxis || inferredMeta.discourseAxis,
      title: item.title,
      body: item.body,
    });
    const postId = buildHumanForumId('generated_post', `${item.title}_${item.displayName}_${index}`, 'post');
    const postTimestamp = now - index * 60000;
    const commentIdByFloor = new Map<number, string>();
    const comments: ForumCommentV2[] = (item.comments || []).slice(0, 4).map((comment, commentIndex) => {
      const floor = commentIndex + 1;
      const commentId = `${postId}-comment-${floor}`;
      commentIdByFloor.set(floor, commentId);
      return {
        id: commentId,
        threadId: postId,
        parentId: typeof comment.replyToFloor === 'number' && comment.replyToFloor > 0
          ? commentIdByFloor.get(comment.replyToFloor)
          : undefined,
        floor,
        authorType: 'forumNpc',
        authorId: resolveAuthorId(comment.displayName, generatedAuthors),
        authorDisplayName: comment.displayName,
        body: comment.content,
        likes: 0,
        createdAt: postTimestamp + floor,
      };
    });

    return {
      id: postId,
      title: polished.title.trim(),
      body: polished.body.trim(),
      channel,
      threadType: resolvedThreadType,
      contentTier: resolvedContentTier,
      discourseAxis: resolvedDiscourseAxis || inferredMeta.discourseAxis,
      authorType: 'forumNpc',
      authorId: resolveAuthorId(item.displayName, generatedAuthors),
      authorDisplayName: item.displayName,
      tags: buildForumPostFooterTags({
        title: polished.title,
        body: polished.body,
        threadType: resolvedThreadType,
        contentTier: resolvedContentTier,
        discourseAxis: resolvedDiscourseAxis || inferredMeta.discourseAxis,
        channel,
      }),
      comments,
      lifecycleStage: comments.length > 0 ? 'initialReplies' : 'new',
      stats: {
        likes: randomInt(0, 24),
        favorites: 0,
        comments: comments.length,
        views: randomInt(40, 380),
      },
      source: 'generated',
      createdAt: postTimestamp,
      updatedAt: comments.length > 0 ? comments[comments.length - 1].createdAt : postTimestamp,
    };
  });

  const posts = threads.map((thread) => forumThreadV2ToLegacyPost(thread));

  return {
    authors: generatedAuthors,
    posts,
    threads,
    topicPackage: undefined,
  };
}
