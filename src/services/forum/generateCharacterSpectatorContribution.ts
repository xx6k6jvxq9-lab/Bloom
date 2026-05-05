import type { ApiConfig, Character, ForumPost, Mask, WorldBookEntry } from '../../types';
import { buildForumCharacterContext } from '../../features/forum-domain/buildForumCharacterContext';
import { buildCharacterForumHabit, buildForumCharacterPostTitle } from '../../features/forum-domain/characterForumPersona';
import { SPECTATOR_BOARD_CATEGORY } from '../../features/forum-domain/spectatorBoard';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildForumPostMeta } from './forumOrchestration';
import { appendForumPostFooterTags } from './forumPostTags';

type GenerateCharacterSpectatorPostInput = {
  activeConfig: ApiConfig;
  character: Character;
  settingsSummary: string;
  currentUserName: string;
  selectedCharacterNames: string[];
  masks: Mask[];
  worldBook: WorldBookEntry[];
  extraContextSections?: string[];
  now?: number;
};

type GenerateCharacterSpectatorReplyInput = {
  activeConfig: ApiConfig;
  character: Character;
  post: ForumPost;
  userComment: string;
  settingsSummary: string;
  extraContextSections?: string[];
};

function normalizeReply(text: string) {
  return text
    .replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '')
    .replace(/\r/g, '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .join(' ')
    .slice(0, 90);
}

function stripCodeFence(raw: string) {
  return raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

function parseGeneratedSpectatorPost(raw: string) {
  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
    if (!body) return null;
    return { title, body };
  } catch {
    return null;
  }
}

function normalizeSpectatorPostBody(text: string) {
  return text
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function countHanTextLength(value: string) {
  return (value.match(/[\u4e00-\u9fff]/g) || []).length;
}

function buildMirrorFloorContext(post: ForumPost) {
  return [...post.comments]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6)
    .map((comment, index) => `${post.comments.length - Math.min(5, post.comments.length - 1) + index}L: ${comment.content.replace(/\s+/g, ' ').trim().slice(0, 40)}`)
    .join(' | ');
}

export async function generateCharacterSpectatorPost(input: GenerateCharacterSpectatorPostInput) {
  const {
    activeConfig,
    character,
    settingsSummary,
    currentUserName,
    selectedCharacterNames,
    extraContextSections = [],
    now = Date.now(),
  } = input;

  const forumContext = buildForumCharacterContext(character);
  const forumHabit = buildCharacterForumHabit(character, 'junction');
  const targetSummary = selectedCharacterNames.length
    ? `${currentUserName}、${selectedCharacterNames.join('、')}`
    : currentUserName;

  const prompt = [
    '你要生成一条角色本人会发在镜间里的公开帖子。',
    '镜间不是朋友圈，不是私聊，也不是系统说明，而是公共楼里角色本人偶尔留下的一条痕迹。',
    `角色名：${character.name}`,
    forumContext.signature ? `角色签名：${forumContext.signature}` : '',
    forumContext.corePersona ? `角色核心人格：${forumContext.corePersona}` : '',
    forumContext.expressionStyle ? `角色表达风格：${forumContext.expressionStyle}` : '',
    forumContext.forumSceneHint ? `角色论坛习惯补充：${forumContext.forumSceneHint}` : '',
    forumContext.longTermMemoryProfile ? `角色长期印象画像：${forumContext.longTermMemoryProfile}` : '',
    forumContext.globalMemory ? `角色长期记忆：${forumContext.globalMemory}` : '',
    `论坛习惯：${forumHabit.persona}`,
    `说话方式：${forumHabit.speakingStyle}`,
    `常见出手：${forumHabit.preferredMove}`,
    `讨论对象：${targetSummary}`,
    `当前镜间线索：${settingsSummary || '最近总有人拿这条关系线开楼。'}`,
    ...extraContextSections.filter(Boolean),
    '要求：',
    '1. 写成论坛帖子，不要写成动态文案。',
    '2. 角色可以嘴硬、冷淡、顺手补刀、半承认，但必须像角色本人，不要 OOC。',
    '3. 不要像作者旁白一样解释整段关系，也不要让角色突然知道网友才会说的话。',
    '4. 不要写用户对角色的强控制动作，也不要写强行带走、塞车、拎走这种失真桥段。',
    '5. 如果这是 essay，正文至少 400 字；如果不是 essay，就保持正常论坛帖长度，不要硬写成小说。',
    '6. 标题必须结合正文里的具体事件、画面或判断，不要用空泛模板标题。',
    '只输出 JSON：{"title":"帖子标题","body":"帖子正文"}',
  ].filter(Boolean).join('\n');

  const raw = await generateTextFromMessagesWithConfig({
    activeConfig,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.95,
  });

  const parsed = parseGeneratedSpectatorPost(raw || '');
  const content = normalizeSpectatorPostBody(parsed?.body || '');
  if (!content) return null;

  const title = parsed?.title || buildForumCharacterPostTitle(content);
  const resolvedMeta = buildForumPostMeta(title, content, 'junction');
  if (resolvedMeta.threadType === 'essay' && countHanTextLength(content) < 380) {
    return null;
  }

  const post: ForumPost = {
    id: `forum-character-spectator-post-${character.id}-${now}`,
    authorId: character.id,
    authorIdentity: 'character',
    authorCharacterId: character.id,
    board: 'spectator',
    title,
    content: appendForumPostFooterTags(content, {
      title,
      body: content,
      threadType: resolvedMeta.threadType,
      contentTier: resolvedMeta.contentTier,
      discourseAxis: resolvedMeta.discourseAxis,
      channel: 'junction',
    }),
    images: [],
    category: SPECTATOR_BOARD_CATEGORY,
    threadType: resolvedMeta.threadType,
    contentTier: resolvedMeta.contentTier,
    discourseAxis: resolvedMeta.discourseAxis,
    timestamp: now,
    viewCount: 0,
    likes: [],
    collections: [],
    comments: [],
    source: 'generated',
  };

  return post;
}

export async function generateCharacterSpectatorReply(input: GenerateCharacterSpectatorReplyInput) {
  const {
    activeConfig,
    character,
    post,
    userComment,
    settingsSummary,
    extraContextSections = [],
  } = input;
  const forumHabit = buildCharacterForumHabit(character, 'junction');
  const prompt = [
    '你要写一条镜间楼里的回帖。',
    `角色：${character.name}`,
    `角色论坛习惯：${forumHabit.persona}`,
    `角色说话方式：${forumHabit.speakingStyle}`,
    `角色常见出手：${forumHabit.preferredMove}`,
    `当前主楼标题：${post.title || '无标题'}`,
    `当前主楼内容：${post.content}`,
    `镜间线索：${settingsSummary || '这条关系最近总有人开楼'}`,
    buildMirrorFloorContext(post) ? `最近楼层：${buildMirrorFloorContext(post)}` : '',
    `用户刚刚评论：${userComment}`,
    ...extraContextSections.filter(Boolean),
    '要求：',
    '1. 写成角色自己会在楼里顺手接的一句或两句，不要像总结员。',
    '2. 优先直接接用户刚刚那句，不要绕回主楼重新概述。',
    '3. 可以护短、嘴硬、装不在意、顺手补刀、半承认，但要像活人。',
    '4. 不要写“作为角色”“从这段关系看”这种解释腔。',
    '5. 不要太工整，像在楼里真回人。',
    '只输出回帖正文。',
  ].filter(Boolean).join('\n');

  const raw = await generateTextFromMessagesWithConfig({
    activeConfig,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.95,
  });

  const content = normalizeReply(raw || '');
  if (!content) return null;

  return {
    authorId: character.id,
    content,
  };
}
