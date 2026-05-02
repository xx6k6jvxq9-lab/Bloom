import type { ApiConfig, ForumComment, ForumPost } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS } from '../../features/forum-domain/constants';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';

type GenerateForumTempOpeningInput = {
  activeConfig: ApiConfig;
  authorName: string;
  authorPersona?: string;
  channel?: ForumChannel;
  recentForumPost?: ForumPost | null;
  userComment?: ForumComment | null;
  reason: 'agreement' | 'debate' | 'followup_comment' | 'ask_followup' | 'praise_writing' | 'private_gossip' | 'comfort_or_advice' | 'curious' | string;
};

function buildReasonLine(reason: GenerateForumTempOpeningInput['reason']) {
  switch (reason) {
    case 'agreement':
      return '这次来敲用户，主要是因为你在楼里看见了她一句很对你胃口的话，想先私下认一下同路。';
    case 'debate':
      return '这次来敲用户，主要是因为你不算完全同意她，但她那个角度很能勾你继续聊。';
    case 'followup_comment':
      return '这次来敲用户，主要是因为她刚刚那条评论让你忍不住想接一句，不想停在楼里。';
    case 'ask_followup':
      return '这次来敲用户，主要是因为你觉得她那条帖子后面还有内容，想私下追问。';
    case 'praise_writing':
      return '这次来敲用户，主要是因为你真觉得她这条帖子写得好，公开区夸一句不够。';
    case 'private_gossip':
      return '这次来敲用户，主要是因为楼里人太多，有些话你更想私下说。';
    case 'comfort_or_advice':
      return '这次来敲用户，主要是因为你想安慰她，或者想给她一点更实在的建议。';
    default:
      return '这次来敲用户，主要是因为你对她起了兴趣，想先单独打个招呼。';
  }
}

function buildForumTempOpeningPrompt(input: GenerateForumTempOpeningInput) {
  const relatedTitle = input.recentForumPost?.title || input.recentForumPost?.content.slice(0, 32) || '刚刚那条楼';

  return [
    '你现在不是在公共评论区，而是在界隙论坛里的陌生人临时私聊里。',
    '这是你第一次主动来敲用户，不是后续接话。',
    '请直接生成一条“论坛网友第一次来私聊用户”的开场白。',
    '要求：',
    '1. 一定要像真人临时起意来敲，不要像系统通知，不要像客服开场。',
    '2. 长度控制在 1 到 3 句。',
    '3. 保留一点犹豫、试探、顺手来聊、忍不住想说的感觉，不要太正式。',
    '4. 不要复述整段帖子内容，不要解释规则，不要写旁白。',
    '5. 这不是正式好友私聊，也不是已经很熟的关系，不能一下子过熟。',
    `当前论坛网友：${input.authorName}`,
    input.authorPersona?.trim() ? `公开人设：${input.authorPersona.trim()}` : '',
    input.channel ? `常驻频道：${FORUM_CHANNEL_LABELS[input.channel]}` : '',
    `最近相关帖子：${relatedTitle}`,
    input.userComment?.content ? `用户刚刚在楼里说的话：${input.userComment.content}` : '',
    buildReasonLine(input.reason),
    '只输出这个论坛网友此刻发给用户的第一条私聊，不要加名字前缀。',
  ].filter(Boolean).join('\n');
}

export async function generateForumTempOpening(input: GenerateForumTempOpeningInput): Promise<string> {
  const prompt = buildForumTempOpeningPrompt(input);
  const raw = await generateTextFromMessagesWithConfig({
    activeConfig: input.activeConfig,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.95,
  });

  return (raw || '').trim();
}

