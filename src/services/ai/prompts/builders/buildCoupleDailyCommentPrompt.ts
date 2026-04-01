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
    '## 任务：评论情侣日常内容',
    `被评论的情侣日常内容: ${dailyCommentContext.coupleDailyContent}`,
    dailyCommentContext.contentAuthor ? `该内容主要由谁发出: ${dailyCommentContext.contentAuthor}` : '',
    dailyCommentContext.commentIntent ? `本次评论意图: ${dailyCommentContext.commentIntent}` : '',
    `建议长度: ${dailyCommentContext.maxLength ?? 30} 字以内`,
    '硬约束提醒: 这是情侣空间里的日常互动评论，不是公共评论区发言。',
    '输出要求: 只给出评论正文，不要补解释。',
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
