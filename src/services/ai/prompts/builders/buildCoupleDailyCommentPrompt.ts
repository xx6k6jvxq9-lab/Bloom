import { composeCoupleSpacePrompt } from './coupleSpaceShared';
import type { CoupleSpacePromptCommonInput } from '../coupleSpace/types';

export type BuildCoupleDailyCommentPromptOptions = CoupleSpacePromptCommonInput & {
  dailyCommentContext: {
    coupleDailyContent: string;
    contentAuthor?: 'user' | 'character' | 'both';
    commentIntent?: string;
    maxLength?: number;
  };
};

function buildDailyCommentTaskSection(
  dailyCommentContext: BuildCoupleDailyCommentPromptOptions['dailyCommentContext'],
): string {
  const lines = [
    '## 任务：评论情侣空间里的动态',
    `【被评论的动态】${dailyCommentContext.coupleDailyContent}`,
    dailyCommentContext.contentAuthor ? `【动态发布者】${dailyCommentContext.contentAuthor}` : '',
    dailyCommentContext.commentIntent ? `【这次评论意图】${dailyCommentContext.commentIntent}` : '',
    `【建议长度】${dailyCommentContext.maxLength ?? 30} 字以内`,
    '【核心原则】先像这个角色本人，再决定要不要温柔、嘴硬、敷衍、别扭或调侃。',
    '【场景边界】这是情侣空间里的随手评论，不是长回复，不是情感分析，不是借题发挥的小作文。',
    '【活人感要求】允许短，允许不完美，允许只回半句，允许带一点停顿感，不要为了显得会说而写满。',
    '【明确禁止】不要默认语气词开头；不要一上来就哄；不要说教；不要把所有内容都往照顾、提醒、教育上带。',
    '【明确禁止】不要使用“接住”“接着”“别让我猜”“有我在”“你开心就好”这类模板句。',
    '【明确禁止】不要脑补图片外或动态外没发生的动作、场景、共同经历。',
    '【输出要求】只输出评论正文，不要解释，不要旁白，不要引号。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildCoupleDailyCommentPrompt(
  options: BuildCoupleDailyCommentPromptOptions,
): string {
  const { dailyCommentContext, recentContext, ...common } = options;

  return composeCoupleSpacePrompt({
    common: {
      ...common,
      mode: options.mode ?? 'passive',
      recentContext: {
        currentSubScene: 'couple_daily_comment',
        ...recentContext,
      },
    },
    taskSections: [buildDailyCommentTaskSection(dailyCommentContext)],
  });
}
