import type { ApiConfig, Character, ForumGlobalSettings, ForumPost, ForumSpectatorSettings, Mask, WorldBookEntry } from '../../types';
import type {
  ForumCommentV2,
  ForumContentTier,
  ForumThreadType,
  ForumThreadV2,
} from '../../features/forum-domain/types';
import { forumThreadV2ToLegacyPost } from '../../features/forum-domain/adapters';
import { buildForumPostMeta } from './forumOrchestration';
import { buildSpectatorThreadPrompt } from '../ai/prompts/builders/buildSpectatorThreadPrompt';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import type { GeneratedForumAuthorDraft } from './generateForumThreads';
import { buildForumInitialEngagement } from './buildForumInitialEngagement';
import { applyForumHotState } from './forumHotState';
import { inferForumContentTier, inferForumDiscourseAxis } from './forumContentTier';
import { polishGeneratedForumThread } from './polishGeneratedForumThread';
import { resolveForumGenerationContext } from './forumGenerationContext';
import { enrichSpectatorParsedAuthors } from './spectatorAuthorPool';
import { buildForumPostFooterTags } from './forumPostTags';

type GenerateSpectatorThreadsInput = {
  activeConfig: ApiConfig;
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Character[];
  existingPosts: ForumPost[];
  globalSettings?: ForumGlobalSettings;
  masks?: Mask[];
  worldBooks?: WorldBookEntry[];
  count?: number;
  allowedThreadTypes?: ForumThreadType[];
};

type ParsedGeneratedComment = {
  displayName: string;
  content: string;
  replyToFloor?: number;
};

type ParsedGeneratedPost = {
  displayName: string;
  threadType?: ForumThreadType;
  contentTier?: ForumContentTier;
  discourseAxis?: string;
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

const VALID_FORUM_THREAD_TYPES: ForumThreadType[] = [
  'normal',
  'gossip',
  'help',
  'rift',
  'sameTopic',
  'sighting',
  'timeline',
  'essay',
  'vote',
  'commission',
  'reversal',
  'ownerUpdate',
];

function isForumThreadType(value: unknown): value is ForumThreadType {
  return typeof value === 'string' && VALID_FORUM_THREAD_TYPES.includes(value as ForumThreadType);
}

function isForumContentTier(value: unknown): value is ForumContentTier {
  return value === 'baseline' || value === 'ferment' || value === 'highlight' || value === 'fragment';
}

function stripCodeFence(raw: string) {
  return raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

function tryParseGeneratedBatch(raw: string): ParsedGeneratedBatch | null {
  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const authors = Array.isArray(parsed.authors)
      ? parsed.authors
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const record = item as Record<string, unknown>;
          return {
            displayName: typeof record.displayName === 'string' ? record.displayName.trim() : '',
            bio: typeof record.bio === 'string' ? record.bio.trim() : '',
            handle: typeof record.handle === 'string' ? record.handle.trim() : '',
            persona: typeof record.persona === 'string' ? record.persona.trim() : '',
            speakingStyle: typeof record.speakingStyle === 'string' ? record.speakingStyle.trim() : '',
            avatarSeed: typeof record.avatarSeed === 'string' ? record.avatarSeed.trim() : '',
          };
        })
        .filter((item) => item.displayName)
      : [];

    const posts = Array.isArray(parsed.posts)
      ? parsed.posts
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const record = item as Record<string, unknown>;
          return {
            displayName: typeof record.displayName === 'string' ? record.displayName.trim() : '',
            threadType: isForumThreadType(record.threadType) ? record.threadType : undefined,
            contentTier: isForumContentTier(record.contentTier) ? record.contentTier : undefined,
            discourseAxis: typeof record.discourseAxis === 'string' ? record.discourseAxis.trim() : '',
            title: typeof record.title === 'string' ? record.title.trim() : '',
            body: typeof record.body === 'string' ? record.body.trim() : '',
            comments: Array.isArray(record.comments)
              ? record.comments
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
        .filter((item) => item.displayName && item.title && item.body)
      : [];

    return authors.length && posts.length ? { authors, posts } : null;
  } catch {
    return null;
  }
}

function normalizeName(value: string) {
  return value.replace(/^@/, '').replace(/\s+/g, '').trim().toLowerCase();
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

function resolveAuthorId(displayName: string, authors: GeneratedForumAuthorDraft[]) {
  const normalized = normalizeName(displayName);
  return authors.find((author) => normalizeName(author.displayName) === normalized)?.id || authors[0]?.id || 'forum_spectator_guest';
}

function countHanTextLength(value: string) {
  return (value.match(/[\u4e00-\u9fff]/g) || []).length;
}

function buildSpectatorActionBanPatterns(currentUserName: string, selectedCharacters: Character[]) {
  const names = [currentUserName, ...selectedCharacters.map((character) => character.name)]
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const namePattern = names.length ? `(?:${names.join('|')})` : '[\\u4e00-\\u9fffA-Za-z0-9_]{1,12}';

  return [
    new RegExp(`${namePattern}.{0,6}(拎上车|拎进车|塞进副驾|扔进副驾|拖上车|拽上车|强行带走)`),
    new RegExp(`${namePattern}.{0,6}(按在墙上|摁在墙上|扛走|拖走|抱走)`),
    /谁是谁的人/,
    /这波是测试赢了吗/,
  ];
}

function isSpectatorPostStructurallyValid(
  post: ParsedGeneratedPost,
  selectedCharacters: Character[],
  currentUserName: string,
) {
  const text = `${post.title}\n${post.body}`;
  if (buildSpectatorActionBanPatterns(currentUserName, selectedCharacters).some((pattern) => pattern.test(text))) {
    return false;
  }

  const inferredMeta = buildForumPostMeta(post.title, post.body, 'junction');
  const resolvedThreadType = post.threadType || inferredMeta.threadType;
  const resolvedContentTier = post.contentTier || inferForumContentTier(resolvedThreadType, post.title, post.body);

  if (resolvedThreadType === 'essay' && countHanTextLength(post.body) < 380) {
    return false;
  }

  if (resolvedThreadType === 'essay' && /^(投一段|来口代餐|片段一则)/.test(post.title.trim())) {
    return false;
  }

  if (resolvedContentTier === 'fragment' && resolvedThreadType !== 'essay' && countHanTextLength(post.body) > 220) {
    return false;
  }

  return true;
}

export async function generateSpectatorThreads(input: GenerateSpectatorThreadsInput): Promise<{
  authors: GeneratedForumAuthorDraft[];
  posts: ForumPost[];
  threads: ForumThreadV2[];
}> {
  const generationContext = resolveForumGenerationContext({
    globalSettings: input.globalSettings,
    worldBooks: input.worldBooks,
    masks: input.masks,
    worldBookScope: 'spectator_open',
    maskScope: 'spectator_open',
    spectatorSettings: input.settings,
    worldBookQuery: [
      input.currentUserName,
      ...input.selectedCharacters.map((character) => character.name),
      ...(input.existingPosts.slice(0, 4).map((post) => post.title).filter(Boolean)),
    ].join('\n'),
  });
  const prompt = buildSpectatorThreadPrompt({
    settings: input.settings,
    currentUserName: input.currentUserName,
    selectedCharacters: input.selectedCharacters.map((character) => ({ id: character.id, name: character.name })),
    existingTitles: input.existingPosts.slice(0, 8).map((post) => post.title).filter(Boolean),
    count: input.count || 10,
    allowedThreadTypes: input.allowedThreadTypes,
    extraContextSections: [
      generationContext.worldBookPromptBlock,
      generationContext.maskPromptBlock,
    ].filter(Boolean),
  });

  const raw = await generateTextFromMessagesWithConfig({
    activeConfig: input.activeConfig,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.98,
  });

  const parsed = tryParseGeneratedBatch(raw || '');
  if (!parsed) {
    return { authors: [], posts: [], threads: [] };
  }
  const enrichedAuthors = enrichSpectatorParsedAuthors(parsed.authors, {
    currentUserName: input.currentUserName,
    selectedCharacterNames: input.selectedCharacters.map((character) => character.name),
  });

  const now = Date.now();
  const authors: GeneratedForumAuthorDraft[] = enrichedAuthors.map((author, index) => ({
    id: buildHumanForumId('forum_spectator_runtime', `${author.displayName}_${author.handle || ''}_${index}`, 'watcher'),
    displayName: author.displayName,
    bio: author.bio,
    handle: (author.handle || '').replace(/^@/, '').trim(),
    persona: author.persona || author.bio,
    speakingStyle: author.speakingStyle,
    avatarSeed: author.avatarSeed || author.displayName,
    sourceDisplayName: author.displayName,
  }));

  const threads = parsed.posts
    .map((post, index) => ({ post, index }))
    .filter(({ post }) => isSpectatorPostStructurallyValid(post, input.selectedCharacters, input.currentUserName))
    .filter(({ post }) => {
      if (!input.allowedThreadTypes || input.allowedThreadTypes.length === 0) return true;
      const inferredMeta = buildForumPostMeta(post.title, post.body, 'junction');
      const resolvedThreadType = post.threadType || inferredMeta.threadType;
      return input.allowedThreadTypes.includes(resolvedThreadType);
    })
    .slice(0, Math.max(1, input.count || 10))
    .map(({ post, index }): ForumThreadV2 => {
      const threadId = buildHumanForumId('spectator_generated', `${post.title}_${post.displayName}_${index}`, 'thread');
      const commentIdByFloor = new Map<number, string>();
      const createdAt = now - index * 60_000;
      const inferredMeta = buildForumPostMeta(post.title, post.body, 'junction');
      const resolvedThreadType = post.threadType || inferredMeta.threadType;
      const resolvedContentTier = resolvedThreadType === 'essay'
        ? inferForumContentTier(resolvedThreadType, post.title, post.body)
        : (post.contentTier || inferForumContentTier(resolvedThreadType, post.title, post.body));
      const resolvedDiscourseAxis = post.discourseAxis || inferForumDiscourseAxis(resolvedThreadType, 'junction', post.title, post.body);
      const polished = polishGeneratedForumThread({
        channel: 'junction',
        threadType: resolvedThreadType,
        contentTier: resolvedContentTier,
        discourseAxis: resolvedDiscourseAxis,
        title: post.title,
        body: post.body,
      });

      const comments: ForumCommentV2[] = (post.comments || []).slice(0, 5).map((comment, commentIndex) => {
        const floor = commentIndex + 1;
        const id = `${threadId}-comment-${floor}`;
        commentIdByFloor.set(floor, id);
        return {
          id,
          threadId,
          floor,
          parentId: comment.replyToFloor ? commentIdByFloor.get(comment.replyToFloor) : undefined,
          authorType: 'forumNpc',
          authorId: resolveAuthorId(comment.displayName, authors),
          authorDisplayName: comment.displayName,
          body: comment.content,
          likes: 0,
          createdAt: createdAt + floor,
        };
      });

      return {
        id: threadId,
        title: polished.title,
        body: polished.body,
        channel: 'junction',
        threadType: resolvedThreadType,
        contentTier: resolvedContentTier,
        discourseAxis: resolvedDiscourseAxis,
        authorType: 'forumNpc',
        authorId: resolveAuthorId(post.displayName, authors),
        authorDisplayName: post.displayName,
        tags: buildForumPostFooterTags({
          title: polished.title,
          body: polished.body,
          threadType: resolvedThreadType,
          contentTier: resolvedContentTier,
          discourseAxis: resolvedDiscourseAxis,
          channel: 'junction',
        }),
        comments,
        lifecycleStage: comments.length > 0 ? 'initialReplies' : 'new',
        stats: {
          likes: 0,
          favorites: 0,
          comments: comments.length,
          views: 30 + index * 15,
        },
        source: 'generated',
        createdAt,
        updatedAt: comments.length > 0 ? comments[comments.length - 1].createdAt : createdAt,
      };
    });

  return {
    authors,
    posts: buildForumInitialEngagement({
      posts: threads.map((thread) => forumThreadV2ToLegacyPost(thread)).map((post) => ({
        ...post,
        board: 'spectator',
        category: '镜间',
        source: 'generated',
      })),
      authors,
      boardLabel: '镜间',
    }).map((post) => applyForumHotState(post)),
    threads,
  };
}
