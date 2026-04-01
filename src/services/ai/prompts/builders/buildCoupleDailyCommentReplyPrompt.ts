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
    '## 核心任务：回复 user 对情侣日常（动态/朋友圈）的评论',
    '【场景设定】：你们正在情侣空间里互动。这就像是在微信朋友圈底下的“楼中楼”回复，需要极度的口语化、生活化和随意感。',
    
    '### 互动上下文',
    `【原动态内容】: ${context.coupleDailyContent}`,
    context.contentAuthor ? `【动态发布者】: ${context.contentAuthor === 'character' ? '你 (char)' : context.contentAuthor === 'user' ? '对方 (user)' : '你们共同'}` : '',
    `【对方的评论】: ${context.userComment}`,
    context.replyIntent ? `【本次回复意图】: ${context.replyIntent}` : '',

    '### 🚫 极度去 AI 化约束（触发即重写）',
    '1. 【拒绝长篇大论】：绝对不要像写小作文一样回复！正常人在评论区回复通常只有一两句话，甚至只是一个词、一个吐槽。',
    '2. 【拒绝正式感】：不许使用“抱歉”、“好的”、“明白了”等客服词汇。多用语气词（啊、呢、啧、嘛、呗）。',
    '3. 【拒绝复述与过度解释】：不要在回复里重复原动态或对方评论的内容，直接给出反应。',

    '### 💡 活人感回复指南',
    '1. 【情绪直给】：如果对方在开玩笑，你可以顺着调侃或者回怼；如果对方在撒娇，你可以宠溺或傲娇地回应。',
    '2. 【留白与呼吸感】：话不要说太满，要有那种“打字打到一半发出去”的真实网聊感。',
    
    '### 输出格式',
    ' - 直接输出回复正文，不要包含任何前置解释、引号或旁白动作描述。',
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
