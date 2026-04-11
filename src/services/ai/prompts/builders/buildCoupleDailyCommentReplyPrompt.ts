import { composeCoupleSpacePrompt } from './coupleSpaceShared';
import type { CoupleSpacePromptCommonInput } from '../coupleSpace/types';

export type BuildCoupleDailyCommentReplyPromptOptions = CoupleSpacePromptCommonInput & {
  dailyCommentReplyContext: {
    coupleDailyContent: string;
    userComment: string;
    contentAuthor?: 'user' | 'character' | 'both';
    replyIntent?: string;
  };
};

function buildDailyCommentReplyTaskSection(
  context: BuildCoupleDailyCommentReplyPromptOptions['dailyCommentReplyContext'],
): string {
  const lines = [
    '## 任务：回复情侣动态下的评论',
    `【原动态内容】${context.coupleDailyContent}`,
    context.contentAuthor
      ? `【动态发布者】${context.contentAuthor === 'character' ? '角色本人' : context.contentAuthor === 'user' ? '用户' : '双方'}`
      : '',
    `【对方刚发的评论】${context.userComment}`,
    context.replyIntent ? `【这次回复意图】${context.replyIntent}` : '',
    '【核心原则】先像这个角色本人，再决定回得温柔、冷淡、嘴硬、随手还是有点敷衍。',
    '【场景感】这是评论区里的楼中楼，不是长谈，不是讲道理，不是正式回信。',
    '【活人感要求】短一点、偏一点、没那么圆都可以。可以像打字打到一半就发了，但仍然要像这个人。',
    '【明确禁止】不要默认用“嗯/哼/啊/欸/喂”这类语气词开头，除非这次真的非它不可。',
    '【明确禁止】不要说教，不要过度提醒，不要一上来就照顾、规训、教育对方。',
    '【明确禁止】不要使用“接住”“接着”“别让我猜”“有我在”“你开心就好”这类模板句。',
    '【明确禁止】不要复述原评论，不要把一句评论回成一小段恋爱文案。',
    '【明确禁止】不要脑补动态外、评论外没有发生的动作、表情、共同经历。',
    '【输出要求】只输出回复正文，不要解释，不要旁白，不要引号。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildCoupleDailyCommentReplyPrompt(
  options: BuildCoupleDailyCommentReplyPromptOptions,
): string {
  const { dailyCommentReplyContext, recentContext, ...common } = options;

  return composeCoupleSpacePrompt({
    common: {
      ...common,
      mode: options.mode ?? 'passive',
      recentContext: {
        currentSubScene: 'couple_daily_comment_reply',
        ...recentContext,
      },
    },
    taskSections: [buildDailyCommentReplyTaskSection(dailyCommentReplyContext)],
  });
}
