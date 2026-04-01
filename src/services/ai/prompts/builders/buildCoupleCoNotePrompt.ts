import { composeCoupleSpacePrompt } from './coupleSpaceShared';
import type { CoupleSpacePromptCommonInput } from '../coupleSpace/types';

export type BuildCoupleCoNotePromptOptions = CoupleSpacePromptCommonInput & {
  coNoteContext?: {
    userNoteContent?: string;
    noteThemeHint?: string;
    maxLength?: number;
  };
};

function buildCoNoteTaskSection(
  coNoteContext: BuildCoupleCoNotePromptOptions['coNoteContext'] = {},
): string {
  const lines = [
    '## 任务：生成情侣互记内容',
    coNoteContext.userNoteContent ? `user 刚写下的共同事项: ${coNoteContext.userNoteContent}` : '',
    coNoteContext.noteThemeHint ? `共同事项方向提示: ${coNoteContext.noteThemeHint}` : '',
    `建议长度: ${coNoteContext.maxLength ?? 20} 字以内`,
    '硬约束提醒: 这是“我们想一起做的事”一类内容，不要写成泛泛情话。',
    '输出要求: 只给出可直接展示的一条互记内容，不要附加解释。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildCoupleCoNotePrompt(
  options: BuildCoupleCoNotePromptOptions = {},
): string {
  const { coNoteContext, recentContext, ...common } = options;

  return composeCoupleSpacePrompt({
    common: {
      ...common,
      mode: options.mode ?? 'passive',
      actionType: options.actionType ?? 'write_co_note',
      recentContext: {
        currentSubScene: 'couple_co_note',
        ...recentContext,
      },
    },
    taskSections: [buildCoNoteTaskSection(coNoteContext)],
  });
}
