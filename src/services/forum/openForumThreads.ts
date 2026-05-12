import type { ApiConfig, ForumGlobalSettings, ForumPost, ForumRuntimeAuthorProfile, WorldBookEntry } from '../../types';
import type { ForumChannel, ForumThreadType } from '../../features/forum-domain/types';
import { FORUM_CHANNEL_TABS, FORUM_FILTER_THREAD_TYPES } from '../../features/forum-domain/forumPresentation';
import { buildReadableForumHandle } from '../../features/forum-domain/characterForumPersona';
import { resolveStableNumericId } from '../social-id/stableNumericId';
import { generateForumThreads, type GeneratedForumAuthorDraft } from './generateForumThreads';
import { pickRecurringForumAuthorsForChannel } from './forumReplyAuthorPool';
import type { ForumTopicPackage } from './forumTopicPlanner';

export type ForumOpenMode = 'random' | 'configured';

type ResolvedForumAuthorProfile = {
  id: string;
  name: string;
  handle?: string;
  bio?: string;
  description?: string;
  persona?: string;
  speakingStyle?: string;
};

type OpenForumThreadsInput = {
  activeConfig: ApiConfig;
  activeChannel: ForumChannel;
  mode: ForumOpenMode;
  selectedChannels: ForumChannel[];
  selectedThreadTypes: ForumThreadType[];
  preferredTopicText?: string;
  preferredSceneText?: string;
  preferredConflictText?: string;
  preferredRelationshipText?: string;
  excludedTopicText?: string;
  posts: ForumPost[];
  globalSettings?: ForumGlobalSettings;
  worldBooks?: WorldBookEntry[];
  currentUserId: string;
  followedUserIds: string[];
  inferChannel: (category: string) => ForumChannel;
  getAuthor: (authorId: string) => ResolvedForumAuthorProfile;
};

export type OpenForumThreadsResult = {
  posts: ForumPost[];
  runtimeProfiles: ForumRuntimeAuthorProfile[];
  openedChannels: ForumChannel[];
  selectedThreadTypes: ForumThreadType[];
  requestedCount: number;
  actualCount: number;
  hotFollowupCount: number;
  hotFollowupSourcePostIds: string[];
  updatedSourcePosts: ForumPost[];
  topicFeedbackLines: string[];
};

const OPEN_THREAD_TOTAL_COUNT = 10;
const RANDOM_NORMAL_FLOOR = 5;
const MAX_RECURRING_AUTHORS = 2;
const ANIME_AVATAR_STYLES = ['lorelei', 'lorelei-neutral'] as const;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildAnimeAvatar(seed: string, label?: string) {
  const style = ANIME_AVATAR_STYLES[hashString(seed) % ANIME_AVATAR_STYLES.length];
  const safeSeed = `${label || seed}-${hashString(seed).toString(36).slice(0, 4)}`;
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(safeSeed)}&backgroundType=gradientLinear&backgroundColor=ffe4ef,ffeef8,e8f2ff,f3ecff&radius=50&scale=110&translateY=-2`;
}

function distributeCounts(total: number, bucketCount: number) {
  if (bucketCount <= 0) return [];
  const base = Math.floor(total / bucketCount);
  const remainder = total % bucketCount;
  return Array.from({ length: bucketCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function shuffleArray<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function pickRandomOpenedChannel() {
  const allChannels = FORUM_CHANNEL_TABS.map((item) => item.id);
  return allChannels[Math.floor(Math.random() * allChannels.length)];
}

function pickRandomAllowedThreadTypes() {
  const nonNormal = shuffleArray(FORUM_FILTER_THREAD_TYPES.filter((threadType) => threadType !== 'normal'));
  const specialCount = Math.max(4, Math.min(nonNormal.length, 4 + Math.floor(Math.random() * 4)));
  return ['normal', ...nonNormal.slice(0, specialCount)] as ForumThreadType[];
}

function splitDraftTokens(value: string | undefined) {
  return (value || '')
    .split(/[\/、,，\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickRandomDraftValue(value: string | undefined) {
  const tokens = splitDraftTokens(value);
  if (tokens.length <= 1) return (value || '').trim();
  return tokens[Math.floor(Math.random() * tokens.length)] || '';
}

function normalizeSelectedChannels(activeChannel: ForumChannel, selectedChannels: ForumChannel[]) {
  const unique = selectedChannels.filter((channel, index, collection) => collection.indexOf(channel) === index);
  return unique.length > 0 ? unique : [activeChannel];
}

function normalizeSelectedThreadTypes(selectedThreadTypes: ForumThreadType[]) {
  const unique = selectedThreadTypes.filter((threadType, index, collection) => collection.indexOf(threadType) === index);
  if (unique.length > 0) return unique;
  return FORUM_FILTER_THREAD_TYPES;
}

function pickChannelRecurringAuthors(input: {
  posts: ForumPost[];
  channel: ForumChannel;
  currentUserId: string;
  followedUserIds: string[];
  inferChannel: (category: string) => ForumChannel;
  getAuthor: (authorId: string) => ResolvedForumAuthorProfile;
  remainingSlots: number;
  usedIds: Set<string>;
}) {
  const {
    posts,
    channel,
    currentUserId,
    followedUserIds,
    inferChannel,
    getAuthor,
    remainingSlots,
    usedIds,
  } = input;
  if (remainingSlots <= 0) return [] as GeneratedForumAuthorDraft[];

  const candidates = pickRecurringForumAuthorsForChannel({
    posts,
    channel,
    currentUserId,
    inferChannel,
    getAuthor,
  });
  const preferred = candidates.filter((candidate) => followedUserIds.includes(candidate.id));
  const fallback = candidates.filter((candidate) => !followedUserIds.includes(candidate.id));
  const picked: GeneratedForumAuthorDraft[] = [];

  [...preferred, ...fallback].forEach((candidate) => {
    if (picked.length >= remainingSlots) return;
    if (usedIds.has(candidate.id)) return;
    usedIds.add(candidate.id);
    picked.push(candidate);
  });

  return picked;
}

function buildRuntimeProfile(author: GeneratedForumAuthorDraft, channel: ForumChannel): ForumRuntimeAuthorProfile {
  const handle = (author.handle || '').replace(/^@/, '').trim() || buildReadableForumHandle({
    id: author.id,
    name: author.displayName,
  });
  return {
    id: author.id,
    numericId: resolveStableNumericId(author.id),
    name: author.displayName,
    handle,
    avatar: buildAnimeAvatar(author.avatarSeed || `${author.displayName}${handle}`, author.displayName),
    bio: author.bio || '',
    persona: author.persona || author.bio || '',
    speakingStyle: author.speakingStyle,
    preferredMove: author.speakingStyle ? `说话常带 ${author.speakingStyle}` : undefined,
    homeChannel: channel,
    boardScope: 'public',
  };
}

async function generateChannelOpenBatch(input: {
  activeConfig: ApiConfig;
  channel: ForumChannel;
  existingPosts: ForumPost[];
  count: number;
  globalSettings?: ForumGlobalSettings;
  worldBooks?: WorldBookEntry[];
  allowedThreadTypes: ForumThreadType[];
  ordinaryPostFloor: number;
  recurringAuthors: GeneratedForumAuthorDraft[];
  preferredTopicText?: string;
  preferredSceneText?: string;
  preferredConflictText?: string;
  preferredRelationshipText?: string;
  excludedTopicText?: string;
}) {
  const {
    activeConfig,
    channel,
    existingPosts,
    count,
    globalSettings,
    worldBooks,
    allowedThreadTypes,
    ordinaryPostFloor,
    recurringAuthors,
    preferredTopicText,
    preferredSceneText,
    preferredConflictText,
    preferredRelationshipText,
    excludedTopicText,
  } = input;
  const generated = await generateForumThreads({
    activeConfig,
    channel,
    existingPosts,
    count,
    globalSettings,
    worldBooks,
    recurringAuthors,
    allowedThreadTypes,
    ordinaryPostFloor,
    recurringAuthorTargetCount: recurringAuthors.length,
    preferNewAuthors: true,
    suppressForcedVariety: true,
    preferredTopicText,
    preferredSceneText,
    preferredConflictText,
    preferredRelationshipText,
    excludedTopicText,
  });

  return {
    posts: generated.posts.slice(0, count),
    authors: generated.authors,
    topicPackage: generated.topicPackage,
  };
}

export async function openForumThreads(input: OpenForumThreadsInput): Promise<OpenForumThreadsResult> {
  const {
    activeConfig,
    activeChannel,
    mode,
    selectedChannels,
    selectedThreadTypes,
    preferredTopicText,
    preferredSceneText,
    preferredConflictText,
    preferredRelationshipText,
    excludedTopicText,
    posts,
    globalSettings,
    worldBooks,
    currentUserId,
    followedUserIds,
    inferChannel,
    getAuthor,
  } = input;

  const openedChannels = mode === 'random'
    ? [pickRandomOpenedChannel()]
    : normalizeSelectedChannels(activeChannel, selectedChannels);
  const allowedThreadTypes = mode === 'random'
    ? pickRandomAllowedThreadTypes()
    : normalizeSelectedThreadTypes(selectedThreadTypes);
  const resolvedPreferredTopicText = mode === 'random' ? pickRandomDraftValue(preferredTopicText) : (preferredTopicText || '').trim();
  const resolvedPreferredSceneText = mode === 'random' ? pickRandomDraftValue(preferredSceneText) : (preferredSceneText || '').trim();
  const resolvedPreferredConflictText = mode === 'random' ? pickRandomDraftValue(preferredConflictText) : (preferredConflictText || '').trim();
  const resolvedPreferredRelationshipText = mode === 'random' ? pickRandomDraftValue(preferredRelationshipText) : (preferredRelationshipText || '').trim();
  const resolvedExcludedTopicText = mode === 'random' ? pickRandomDraftValue(excludedTopicText) : (excludedTopicText || '').trim();
  const postCounts = distributeCounts(OPEN_THREAD_TOTAL_COUNT, openedChannels.length);
  const normalCounts = mode === 'random' && allowedThreadTypes.includes('normal')
    ? distributeCounts(RANDOM_NORMAL_FLOOR, openedChannels.length)
    : openedChannels.map(() => 0);

  const recurringUsedIds = new Set<string>();
  let remainingRecurringSlots = MAX_RECURRING_AUTHORS;

  const batches = await Promise.all(openedChannels.map(async (channel, index) => {
    const count = postCounts[index] || 0;
    if (count <= 0) {
      return {
        authors: [] as GeneratedForumAuthorDraft[],
        posts: [] as ForumPost[],
        channel,
      };
    }

    const recurringCap = openedChannels.length === 1
      ? Math.min(MAX_RECURRING_AUTHORS, remainingRecurringSlots)
      : Math.min(1, remainingRecurringSlots);
    const recurringAuthors = pickChannelRecurringAuthors({
      posts,
      channel,
      currentUserId,
      followedUserIds,
      inferChannel,
      getAuthor,
      remainingSlots: recurringCap,
      usedIds: recurringUsedIds,
    });
    remainingRecurringSlots = Math.max(0, remainingRecurringSlots - recurringAuthors.length);

    const channelPosts = posts.filter((post) => (
      (post.board ?? 'public') !== 'spectator' && inferChannel(post.category) === channel
    ));

    const generated = await generateChannelOpenBatch({
      activeConfig,
      channel,
      existingPosts: channelPosts,
      count,
      globalSettings,
      worldBooks,
      allowedThreadTypes,
      ordinaryPostFloor: normalCounts[index] || 0,
      recurringAuthors,
      preferredTopicText: resolvedPreferredTopicText,
      preferredSceneText: resolvedPreferredSceneText,
      preferredConflictText: resolvedPreferredConflictText,
      preferredRelationshipText: resolvedPreferredRelationshipText,
      excludedTopicText: resolvedExcludedTopicText,
    });

    return {
      authors: generated.authors,
      posts: generated.posts,
      topicPackage: generated.topicPackage,
      channel,
    };
  }));

  const runtimeProfiles = batches.flatMap((batch) => (
    batch.authors.map((author) => buildRuntimeProfile(author, batch.channel))
  ));
  const batchPosts = batches.flatMap((batch) => batch.posts);
  const topicFeedbackLines = batches.flatMap((batch) => {
    const topicPackage = batch.topicPackage;
    if (!topicPackage) return [];
    const ecologySummary = topicPackage.ecologyLabels.length > 0
      ? `命中子生态：${topicPackage.ecologyLabels.join('、')}`
      : '';
    const userSummary = topicPackage.userSummaryLines.length > 0
      ? topicPackage.userSummaryLines[0].replace(/。$/, '')
      : '';
    const threadTypeSummary = topicPackage.threadTypePlanLines[0]?.replace(/。$/, '') || '';
    return [ecologySummary, userSummary, threadTypeSummary].filter(Boolean).slice(0, 3);
  }).filter((line, index, collection) => collection.indexOf(line) === index);
  return {
    posts: batchPosts,
    runtimeProfiles,
    openedChannels,
    selectedThreadTypes: allowedThreadTypes,
    requestedCount: OPEN_THREAD_TOTAL_COUNT,
    actualCount: batchPosts.length,
    hotFollowupCount: 0,
    hotFollowupSourcePostIds: [],
    updatedSourcePosts: [],
    topicFeedbackLines,
  };
}
