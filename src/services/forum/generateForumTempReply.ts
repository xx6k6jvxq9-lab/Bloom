import type { ApiConfig, ForumPost, ForumTempChatMessage } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS } from '../../features/forum-domain/constants';
import { buildDirectPersonaGuide } from '../ai/prompts/character/buildDirectPersonaGuide';
import { streamTextWithConfig } from '../ai/runtimeClient';

type GenerateForumTempReplyInput = {
  activeConfig: ApiConfig;
  authorName: string;
  authorPersona?: string;
  channel?: ForumChannel;
  recentForumPost?: ForumPost | null;
  history: ForumTempChatMessage[];
  userMessage: string;
  onProgress?: (text: string) => void;
};

export function buildForumTempReplyPrompt(input: GenerateForumTempReplyInput) {
  const { authorName, authorPersona, channel, recentForumPost, history, userMessage } = input;
  const personaGuide = authorPersona?.trim()
    ? buildDirectPersonaGuide({
        corePersona: authorPersona,
      })
    : '';
  const recentHistory = history
    .slice(-6)
    .map((message) => `${message.role === 'user' ? '用户' : authorName}：${message.text}`)
    .join('\n');

  return [
    '你现在不是在公共评论区，而是在界隙论坛里的临时单聊。',
    '这不是正式好友私聊，也不是长期稳定关系里的聊天。',
    '请严格遵守下面这些规则：',
    '1. 说话要像活人，别像客服，也别像在解释系统设定。',
    '2. 可以比论坛评论区更直接一点，但不要一下子过熟。',
    '3. 保留这个网友原本的嘴硬、损、冷、护短、敷衍、谨慎等说话习惯。',
    '4. 长度控制在 1 到 3 句，宁可自然一点，也不要整齐分析。',
    '5. 如果你们刚从论坛某条帖子互动过来，可以顺着那条帖子往下说，但不要复述主楼。',
    '6. 不要自称 AI，不要写旁白，不要写动作描写，不要加名字前缀。',
    `当前论坛网友：${authorName}`,
    authorPersona?.trim() ? `公开人设：${authorPersona.trim()}` : '',
    personaGuide,
    channel ? `常驻频道：${FORUM_CHANNEL_LABELS[channel]}` : '',
    recentForumPost ? `最近相关帖子：${recentForumPost.title || recentForumPost.content.slice(0, 40)}` : '',
    recentHistory ? `最近临时单聊记录：\n${recentHistory}` : '',
    `用户刚发的话：${userMessage}`,
    '只输出这个论坛网友此刻会回给用户的话。',
  ].filter(Boolean).join('\n');
}

export async function generateForumTempReply(input: GenerateForumTempReplyInput): Promise<string> {
  const prompt = buildForumTempReplyPrompt(input);
  let raw = '';

  await streamTextWithConfig({
    activeConfig: input.activeConfig,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.95,
    onTextChunk: (chunkText) => {
      raw += chunkText;
      input.onProgress?.(raw.trimStart());
    },
  });

  return raw.trim();
}
