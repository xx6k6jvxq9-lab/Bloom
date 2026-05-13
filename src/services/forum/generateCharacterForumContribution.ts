import type {
  ApiConfig,
  Character,
  ForumGlobalSettings,
  ForumPost,
  Mask,
  WorldBookEntry,
} from '../../types';
import { buildForumCharacterContext } from '../../features/forum-domain/buildForumCharacterContext';
import type { ForumChannel } from '../../features/forum-domain/types';
import { buildCharacterForumHabit } from '../../features/forum-domain/characterForumPersona';
import { buildSharedCharacterStateFromCharacter } from '../relationship-context/buildSharedCharacterState';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { resolveForumGenerationContext } from './forumGenerationContext';

type GenerateCharacterForumReplyInput = {
  activeConfig: ApiConfig;
  character: Character;
  post: ForumPost;
  channel: ForumChannel;
  globalSettings?: ForumGlobalSettings;
  masks?: Mask[];
  worldBooks?: WorldBookEntry[];
  userComment: string;
  userCommentAuthorName?: string;
  userReplyTargetContent?: string;
  userReplyTargetAuthorName?: string;
};

function normalizeReply(text: string) {
  return text
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\r/g, '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .join(' ')
    .slice(0, 90);
}

function buildFloorContext(post: ForumPost) {
  return [...post.comments]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6)
    .map((comment, index) => `${index + 1}层：${comment.content.replace(/\s+/g, ' ').trim().slice(0, 48)}`)
    .join(' | ');
}

export async function generateCharacterForumReply(input: GenerateCharacterForumReplyInput) {
  const {
    activeConfig,
    character,
    post,
    channel,
    globalSettings,
    masks,
    worldBooks,
    userComment,
    userCommentAuthorName,
    userReplyTargetContent,
    userReplyTargetAuthorName,
  } = input;
  const forumContext = buildForumCharacterContext(character);
  const forumHabit = buildCharacterForumHabit(character, channel);
  const sharedCharacterState = buildSharedCharacterStateFromCharacter({
    character,
  });
  const generationContext = resolveForumGenerationContext({
    globalSettings,
    masks,
    worldBooks,
    worldBookScope: 'character_post',
    maskScope: 'character_post',
    worldBookQuery: [
      post.title,
      post.content,
      userComment,
      userReplyTargetContent,
      userReplyTargetAuthorName,
    ].filter(Boolean).join('\n'),
  });

  const prompt = [
    sharedCharacterState.groupPrompt ? `瑙掕壊褰撳墠鍏变韩鐘舵€侊細\n${sharedCharacterState.groupPrompt}` : '',
    '你要写一条角色本人会发在论坛楼里的回复。',
    `角色名：${character.name}`,
    forumContext.signature ? `角色签名：${forumContext.signature}` : '',
    forumContext.corePersona ? `角色核心人格：${forumContext.corePersona}` : '',
    forumContext.expressionStyle ? `角色说话风格：${forumContext.expressionStyle}` : '',
    forumContext.forumSceneHint ? `角色论坛习惯补充：${forumContext.forumSceneHint}` : '',
    forumContext.globalMemory ? `角色长期记忆：${forumContext.globalMemory}` : '',
    forumContext.longTermMemoryProfile ? `角色长期印象画像：${forumContext.longTermMemoryProfile}` : '',
    `论坛习惯：${forumHabit.persona}`,
    `说话方式：${forumHabit.speakingStyle}`,
    `常见出手：${forumHabit.preferredMove}`,
    `当前帖子标题：${post.title || '无标题'}`,
    `当前帖子正文：${post.content}`,
    buildFloorContext(post) ? `最近楼层气氛：${buildFloorContext(post)}` : '',
    userCommentAuthorName ? `用户刚刚发言的人是：${userCommentAuthorName}` : '',
    `用户刚刚评论：${userComment}`,
    userReplyTargetAuthorName ? `用户是在接：${userReplyTargetAuthorName}` : '',
    userReplyTargetContent ? `用户接的那层内容：${userReplyTargetContent}` : '',
    generationContext.worldBookPromptBlock,
    generationContext.maskPromptBlock,
    forumContext.publicPersonaGuide ? forumContext.publicPersonaGuide : '',
    '要求：',
    '1. 写成角色本人会顺手接的一句或两句，不要像系统说明，也不要像论坛路人模板话术。',
    '2. 优先直接接住用户刚刚那句，不要回到主楼重新概括。',
    '3. 可以护短、冷淡、嘴硬、阴阳、半承认、顺手补刀，但必须符合角色自己的人设和记忆。',
    '4. 不要写“作为角色”“从设定来看”“这段关系说明”这种解释腔。',
    '5. 像角色本人在楼里回人，不像 AI 网友。',
    '只输出回复正文。',
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
