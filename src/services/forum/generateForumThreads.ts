import type { ApiConfig, ForumPost } from '../../types';
import { forumThreadV2ToLegacyPost } from '../../features/forum-domain/adapters';
import type { ForumChannel, ForumCommentV2, ForumThreadType, ForumThreadV2 } from '../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS, FORUM_THREAD_TYPE_LABELS, getForumWorldTheme } from '../../features/forum-domain/constants';
import { FORUM_SCENARIO_PROMPT } from '../ai/prompts/scenarios/forum';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';

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
  recurringAuthors?: GeneratedForumAuthorDraft[];
};

export type GenerateForumThreadsResult = {
  authors: GeneratedForumAuthorDraft[];
  posts: ForumPost[];
  threads: ForumThreadV2[];
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

const VALID_FORUM_THREAD_TYPES: ForumThreadType[] = ['normal', 'rift', 'sameTopic', 'commission', 'reversal', 'ownerUpdate'];

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
  return containsHan(normalized) && normalized.length >= 10 && normalized.length <= 48;
}

function isValidGeneratedBatch(batch: ParsedGeneratedBatch) {
  const authorNames = new Set(batch.authors.map((author) => author.displayName.trim()));
  return batch.authors.length >= 4
    && batch.authors.every((author) => (
      containsHan(author.displayName)
      && looksLivelyForumHandle(author.handle)
      && looksLivelyForumBio(author.bio)
    ))
    && batch.posts.every((post) => (
      authorNames.has(post.displayName.trim())
      && (!post.comments || post.comments.every((comment) => authorNames.has(comment.displayName.trim())))
    ));
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

function tryParseGeneratedBatch(raw: string): ParsedGeneratedBatch | null {
  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  const jsonText = cleaned.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;

    const authors = Array.isArray(record.authors)
      ? record.authors
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const authorRecord = item as Record<string, unknown>;
          return {
            displayName: typeof authorRecord.displayName === 'string' ? authorRecord.displayName.trim() : '',
            bio: typeof authorRecord.bio === 'string' ? authorRecord.bio.trim() : '',
            handle: typeof authorRecord.handle === 'string' ? authorRecord.handle.trim() : '',
            persona: typeof authorRecord.persona === 'string' ? authorRecord.persona.trim() : '',
            speakingStyle: typeof authorRecord.speakingStyle === 'string' ? authorRecord.speakingStyle.trim() : '',
            avatarSeed: typeof authorRecord.avatarSeed === 'string' ? authorRecord.avatarSeed.trim() : '',
          };
        })
        .filter((author) => author.displayName)
      : [];

    const posts = Array.isArray(record.posts)
      ? record.posts
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const postRecord = item as Record<string, unknown>;
          return {
            displayName: typeof postRecord.displayName === 'string' ? postRecord.displayName.trim() : '',
            threadType: isForumThreadType(postRecord.threadType) ? postRecord.threadType : undefined,
            title: typeof postRecord.title === 'string' ? postRecord.title.trim() : '',
            body: typeof postRecord.body === 'string' ? postRecord.body.trim() : '',
            comments: Array.isArray(postRecord.comments)
              ? postRecord.comments
                .filter((comment) => comment && typeof comment === 'object')
                .map((comment) => {
                  const commentRecord = comment as Record<string, unknown>;
                  return {
                    displayName: typeof commentRecord.displayName === 'string' ? commentRecord.displayName.trim() : '',
                    content: typeof commentRecord.content === 'string' ? commentRecord.content.trim() : '',
                    replyToFloor: typeof commentRecord.replyToFloor === 'number'
                      ? Math.max(1, Math.floor(commentRecord.replyToFloor))
                      : undefined,
                  };
                })
                .filter((comment) => comment.displayName && comment.content)
              : [],
          };
        })
        .filter((post) => post.displayName && post.body)
      : [];

    return { authors, posts };
  } catch {
    return null;
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

function resolveReusableAuthor(
  author: ParsedGeneratedAuthor,
  recurringAuthors: GeneratedForumAuthorDraft[],
) {
  const normalizedDisplayName = normalizeName(author.displayName);
  const normalizedHandle = normalizeName(author.handle || '');
  return recurringAuthors.find((item) => (
    normalizeName(item.displayName) === normalizedDisplayName
    || (!!normalizedHandle && normalizeName(item.handle || '') === normalizedHandle)
    || (!!item.sourceDisplayName && normalizeName(item.sourceDisplayName) === normalizedDisplayName)
  ));
}

function buildBatchThreadPrompt(input: GenerateForumThreadsInput) {
  const { channel, existingPosts, count } = input;
  const recentTopicHints = buildRecentTopicHints(existingPosts);
  const worldTheme = getForumWorldTheme(channel);
  const topicBuckets = CHANNEL_TOPIC_BUCKETS[channel] || [];

  return [
    FORUM_SCENARIO_PROMPT,
    '## 刷新补帖任务',
    `目标频道：${FORUM_CHANNEL_LABELS[channel]}`,
    `本轮一次性生成 ${count} 条新帖子。`,
    '这些帖子是用户手动刷新论坛后看到的新帖子，所以要像同一时间段内冒出来的新内容，但不要互相重复。',
    recentTopicHints.length ? `最近已有帖子，尽量避开重复话题：${recentTopicHints.join(' | ')}` : '',
    topicBuckets.length ? `这一轮优先从这些不同子话题里分散选题：${topicBuckets.join('、')}` : '',
    worldTheme?.exampleTopics?.length ? `世界参考话题只作语气参考，不要照抄：${worldTheme.exampleTopics.join('；')}` : '',
    '同一轮里你还要顺带生成这批“新网友”，不要只用固定熟面孔。',
    '请先生成 4 到 6 个本轮会出现的论坛网友，再让他们去发帖和评论。',
    '这些网友要像论坛里真实会反复见到的人，不要叫“网友A”“路人1”“用户1234”。',
    '每条帖子都要有：发帖显示名、标题、正文、4条精选评论。',
    '评论也必须像论坛现场，不要整齐回答，可以短一点，可以接话，可以阴阳怪气。',
    '本轮最重要限制：',
    '1. 5到8条帖子的话题必须分散，不能连续都写同一种暧昧/已读不回/点赞暴露。',
    '2. 标题不能高度相似，正文开头也不能高度相似。',
    '3. 不要把“事情是这样的”“我先声明”这种句式在多条帖子里重复使用。',
    '4. 允许有一两条短帖，但多数帖子正文必须完整，不要只写半句。',
    '输出必须是一个 JSON 对象，不要输出解释，不要输出 markdown 标题。',
    'JSON 对象格式固定为：',
    '{',
    '  "authors": [',
    '    {',
    '      "displayName": "网友显示名",',
    '      "handle": "论坛handle",',
    '      "persona": "公开人设简介",',
    '      "speakingStyle": "说话方式",',
    '      "avatarSeed": "头像seed词"',
    '    }',
    '  ],',
    '  "posts": [',
    '    {',
    '      "displayName": "必须从authors里选一个",',
    '      "title": "帖子标题",',
    '      "body": "帖子正文",',
    '      "comments": [',
    '        { "displayName": "必须从authors里选一个", "content": "评论正文" },',
    '        { "displayName": "必须从authors里选一个", "content": "评论正文", "replyToFloor": 1 }',
    '      ]',
    '    }',
    '  ]',
    '}',
    'replyToFloor 表示这条评论是在回复本帖评论列表中的第几条评论，只有在需要楼中楼时才填写。',
    'authors 至少 4 个，posts 必须等于本轮要求数量。',
    '不要缺字段，不要输出 null，不要输出对象外的任何说明文字。',
  ].filter(Boolean).join('\n');
}

function buildDynamicForumBatchPrompt(input: GenerateForumThreadsInput) {
  const { channel, existingPosts, count, recurringAuthors = [] } = input;
  const recentTopicHints = buildRecentTopicHints(existingPosts);
  const worldTheme = getForumWorldTheme(channel);
  const topicBuckets = CHANNEL_TOPIC_BUCKETS[channel] || [];
  const recurringAuthorHint = recurringAuthors.length
    ? `这一轮优先复用这些已经在本区活跃过的论坛熟脸，至少回收其中 2 到 3 个，不要每次都全换新人：${recurringAuthors.map((author) => `${author.displayName}(@${author.handle || author.displayName})`).join('、')}`
    : '';
  const recurringAuthorStabilityHint = recurringAuthors.length
    ? '如果复用了老网友，就继续沿用他们原来的显示名和论坛 ID，不要轻微改字重新造一个近似新名字。'
    : '';

  return [
    FORUM_SCENARIO_PROMPT,
    recurringAuthorHint,
    '## 刷新论坛帖子任务',
    `目标频道：${FORUM_CHANNEL_LABELS[channel]}`,
    `本轮一次性生成 ${count} 条新帖子。`,
    '这些帖子是用户手动刷新论坛后看到的新内容，要像同一时间段里一起冒出来的新帖，但彼此不能太像。',
    recentTopicHints.length ? `最近已经出现过的话题，尽量避开：${recentTopicHints.join(' | ')}` : '',
    topicBuckets.length ? `优先从这些不同子话题里分散选题：${topicBuckets.join('、')}` : '',
    worldTheme?.exampleTopics?.length ? `世界观话题仅供语气参考，不要照抄：${worldTheme.exampleTopics.join('、')}` : '',
    '先生成 4 到 6 个本轮会出现的论坛网友，再让他们去发帖和评论。',
    '网友必须有活人感，像中文论坛里会反复见到的人，不要像系统用户。',
    'authors.displayName 必须像真人昵称，例如“今天也不想上班”“权限不足但想看”“前线医疗兵E”。',
    'authors.handle 必须像中文论坛ID，例如“工位弄丢失败”“白名单旁听生”“别急我路过”，不要带@，不要英文串、下划线、编号串。',
    'authors.bio 必须像个人主页简介，要活一点，像网友自己写的短签名，不要模板句，不要总结腔，不要“常在xx出没”。',
    'authors.avatarSeed 要偏二次元角色感，可以写中文短词或角色气质词，例如“冷脸黑发”“粉发猫眼”“软萌短发”。',
    'posts.displayName 和 comments.displayName 必须直接复用 authors 里已有的 displayName，不要另起新名字。',
    '每条帖子都要有：发帖显示名、标题、正文、几条精选评论。',
    '评论要像论坛现场，不要整齐回答，可以接话，可以阴阳怪气。',
    '最重要的限制：',
    '1. 本轮帖子的话题必须分散，不能连续都在写同一种瓜。',
    '2. 标题不能高度相似，正文开头也不能高度相似。',
    '3. 简介、昵称、ID 都不要模板化重复。',
    '4. 输出必须是一个 JSON 对象，不要输出解释，不要输出 markdown。',
    'JSON 格式固定为：',
    '{',
    '  "authors": [',
    '    {',
    '      "displayName": "网友显示名",',
    '      "bio": "个人主页简介，像网友自己写的短签名",',
    '      "handle": "论坛ID，不带@",',
    '      "persona": "公开人设简介",',
    '      "speakingStyle": "说话方式",',
    '      "avatarSeed": "偏二次元角色感的头像seed"',
    '    }',
    '  ],',
    '  "posts": [',
    '    {',
    '      "displayName": "必须从 authors 里选一个",',
    '      "title": "帖子标题",',
    '      "body": "帖子正文",',
    '      "comments": [',
    '        { "displayName": "必须从 authors 里选一个", "content": "评论正文" },',
    '        { "displayName": "必须从 authors 里选一个", "content": "评论正文", "replyToFloor": 1 }',
    '      ]',
    '    }',
    '  ]',
    '}',
    'replyToFloor 表示这条评论是在回复本帖评论列表中的第几条评论，只有在需要楼中楼时才填写。',
    'authors 至少 4 个，posts 必须等于本轮要求数量。',
    '不要缺字段，不要输出 null，不要输出对象外的任何说明文字。',
  ].filter(Boolean).join('\n');
}

export async function generateForumThreads(input: GenerateForumThreadsInput): Promise<{
  authors: GeneratedForumAuthorDraft[];
  posts: ForumPost[];
  threads: ForumThreadV2[];
}> {
  const { activeConfig, channel, existingPosts, count, recurringAuthors = [] } = input;
  if (count <= 0) return { authors: [], posts: [], threads: [] };

  const prompt = buildDynamicForumBatchPrompt(input);
  let raw = '';
  let parsedBatch: ParsedGeneratedBatch | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    raw = await generateTextFromMessagesWithConfig({
      activeConfig,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.95,
    }) || '';

    parsedBatch = tryParseGeneratedBatch(raw);
    if (parsedBatch && parsedBatch.authors.length > 0 && parsedBatch.posts.length > 0 && isValidGeneratedBatch(parsedBatch)) {
      break;
    }
  }

  if (!parsedBatch || !parsedBatch.authors.length || !parsedBatch.posts.length || !isValidGeneratedBatch(parsedBatch)) {
    console.error('[forum] batch thread parse failed', {
      channel,
      count,
      rawPreview: (raw || '').slice(0, 400),
    });
    return { authors: [], posts: [], threads: [] };
  }

  const now = Date.now();
  const generatedAuthors: GeneratedForumAuthorDraft[] = parsedBatch.authors.map((author, index) => {
    const reusable = resolveReusableAuthor(author, recurringAuthors);
    return {
      id: reusable?.id || `forum_runtime_${channel}_${now}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      displayName: reusable?.displayName || author.displayName,
      bio: reusable?.bio || author.bio,
      handle: (reusable?.handle || author.handle || '').replace(/^@/, '').trim(),
      persona: reusable?.persona || author.persona,
      speakingStyle: reusable?.speakingStyle || author.speakingStyle,
      avatarSeed: reusable?.avatarSeed || author.avatarSeed || `${author.displayName}${author.handle || ''}`,
      sourceDisplayName: reusable?.sourceDisplayName || author.displayName,
    };
  });

  const dedupedPosts = parsedBatch.posts.filter((item, index, collection) => {
    const titleKey = normalizeTopicFingerprint(item.title);
    const bodyKey = normalizeTopicFingerprint(item.body);
    return collection.findIndex((candidate) => (
      normalizeTopicFingerprint(candidate.title) === titleKey
      || normalizeTopicFingerprint(candidate.body) === bodyKey
    )) === index;
  });

  const existingTitleKeys = new Set(existingPosts.map((post) => normalizeTopicFingerprint(post.title)));
  const existingBodyKeys = new Set(existingPosts.map((post) => normalizeTopicFingerprint(post.content)));
  const uniquePosts = dedupedPosts.filter((item) => {
    const titleKey = normalizeTopicFingerprint(item.title);
    const bodyKey = normalizeTopicFingerprint(item.body);
    return !existingTitleKeys.has(titleKey) && !existingBodyKeys.has(bodyKey);
  });

  const threads = uniquePosts.slice(0, count).map((item, index): ForumThreadV2 => {
    const postId = `generated-post-${now}-${index}-${Math.random().toString(36).slice(2, 7)}`;
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
      title: item.title,
      body: item.body,
      channel,
      threadType: item.threadType || inferThreadTypeFromContent(item),
      authorType: 'forumNpc',
      authorId: resolveAuthorId(item.displayName, generatedAuthors),
      authorDisplayName: item.displayName,
      tags: [],
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
  };
}
