import { composeCoupleSpacePrompt } from './coupleSpaceShared';
import type { CoupleSpacePromptCommonInput } from '../coupleSpace/types';

export type BuildCoupleMessageBoardPromptOptions = CoupleSpacePromptCommonInput & {
  messageBoardContext?: {
    latestUserMessage?: string;
    boardToneHint?: string;
    maxLength?: number;
  };
};

function buildMessageBoardTaskSection(
  messageBoardContext: BuildCoupleMessageBoardPromptOptions['messageBoardContext'] = {},
): string {
  const lines = [
    '## 任务：生成情侣空间留言板内容',
    messageBoardContext.latestUserMessage ? `当前需要承接的 user 留言: ${messageBoardContext.latestUserMessage}` : '',
    messageBoardContext.boardToneHint ? `留言板语气提示: ${messageBoardContext.boardToneHint}` : '',
    `建议长度: ${messageBoardContext.maxLength ?? 30} 字以内`,
    '硬约束提醒: 留言板内容比情书轻，比普通聊天更像“留在空间里的一句话”。',
    'TODO: 后续主动行为层可复用此 builder 生成角色主动留言。',
    '输出要求: 只给出留言正文，不要加解释。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildCoupleMessageBoardPrompt(
  options: BuildCoupleMessageBoardPromptOptions = {},
): string {
  const { messageBoardContext, recentContext, ...common } = options;

  return composeCoupleSpacePrompt({
    common: {
      ...common,
      mode: options.mode ?? 'passive',
      actionType: options.actionType ?? 'post_message_board_entry',
      recentContext: {
        currentSubScene: 'couple_message_board',
        ...recentContext,
      },
    },
    taskSections: [buildMessageBoardTaskSection(messageBoardContext)],
  });
}
