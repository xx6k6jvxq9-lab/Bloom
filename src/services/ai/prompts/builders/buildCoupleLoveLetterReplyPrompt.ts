import type { CoupleSpacePromptCommonInput } from '../coupleSpace/types';
import { composeCoupleSpacePrompt } from './coupleSpaceShared';

export type BuildCoupleLoveLetterReplyPromptOptions = CoupleSpacePromptCommonInput & {
  loveLetterReplyContext: {
    receivedLetterContent: string;
    replyIntent?: string;
    maxLength?: number;
    relationshipStage?: string;
    emotionalState?: string;
  };
};

function buildLoveLetterReplyTaskSection(
  context: BuildCoupleLoveLetterReplyPromptOptions['loveLetterReplyContext'],
): string {
  const maxLength = context.maxLength ?? 220;

  const lines = [
    '## 任务：以 char 本人的身份，回应 user 留下的这封情书',
    '这是一封情书的回信。回复主体必须始终是 char 自己，只写 char 此刻真实的态度、情绪和分寸。',
    '不要写成系统替两个人总结关系，不要写成泛用恋爱回复，也不要写成小说片段、纸条回复或聊天框里的秒回。',

    '### 输入信息',
    `【收到的情书内容】: "${context.receivedLetterContent}"`,
    context.replyIntent ? `【本次回复意图】: ${context.replyIntent}` : '',
    context.relationshipStage ? `【当前关系阶段】: ${context.relationshipStage}` : '',
    context.emotionalState ? `【你当下的情绪】: ${context.emotionalState}` : '',

    '### 写法要求',
    '1. 只从 char 当下怎么被这封情书碰到出发，只写此刻的态度、分寸、松动、别扭、心软、嘴硬或保留。',
    '2. 可以有关系感，但关系感只能来自 char 现在的回应，不能靠任何故事、例子、场景、动作、物件来制造。',
    '3. recentContext 和最近聊天主要作为理解来源，不要机械复述、整段拼接或扩写成具体经历；但若其中已有可直接回答 user 问题的高置信事实，可以自然点中。',
    '4. 如果 user 在这封信里问的是一个最近聊天里已经有明确答案的问题，可以自然点中这个高置信事实；当高置信事实已经足够回答问题时，优先回答事实，不要先凭人设自由发挥；但点中事实之后，仍然要写成回信中的一句回应或一段回应，不能退化成聊天框里的短答。',
    '5. 所有表达先过人设，再过阶段。宁可更少、更硬、更克制，也不要说出不符合这个 char 的泛用甜话或泛用傲娇话。',
    '6. 可以只回应最触动 char 的那一小部分，不需要接满，也不要为了完整而一股脑说完。',

    '### 严格禁止',
    '1. 禁止任何未经输入明确提供的共同记忆、共同经历、个人经历、具体事件、具体对话、具体物品、具体地点、具体时间顺序。',
    '2. 禁止任何未经输入明确提供的当前场景、动作状态、外貌状态、手头正在做的事，以及任何邀约、计划、见面安排。',
    '3. 禁止举例证明态度，禁止出现带过程的叙事，禁止出现“上次、那次、之前、小时候、刚刚、今晚、明天、后来、结果”等会把内容落成事件的写法。',
    '4. 禁止把 user 一次临时说的话、一次当下想法，擅自写成长期喜好、固定习惯或稳定偏好。',
    '5. 禁止八股文、说教感、情感博主腔、油腻霸道感，也禁止“你开心就行”“算了不反驳了”这类去角色化后谁都能说的安全模板句。',

    '### 输出前自检',
    '1. 这段话是不是只在表达 char 现在的态度，而没有讲任何故事？',
    '2. 如果这封信里问到了一个最近聊天里已经有明确答案的问题，这段回复有没有自然接住，而不是绕开？',
    '3. 这段话删掉角色名之后，是否像很多恋爱角色都能说？如果是，说明太泛，重写。',
    '4. 里面有没有任何输入未提供的事件、场景、动作、物件、时间落点？如果有，重写。',
    '5. 去掉所有画面感和过程感之后，这段回复还能成立吗？如果不能，说明它在靠编或靠模板支撑，重写。',

    '### 输出要求',
    `- 字数自然即可，上限控制在 ${maxLength} 字内。`,
    '- 只输出回复正文，不要标题，不要称呼，不要括号动作，不要额外解释。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildCoupleLoveLetterReplyPrompt(
  options: BuildCoupleLoveLetterReplyPromptOptions,
): string {
  const { loveLetterReplyContext, recentContext, ...common } = options;

  return composeCoupleSpacePrompt({
    common: {
      ...common,
      mode: options.mode ?? 'passive',
      recentContext: {
        currentSubScene: 'couple_love_letter_reply',
        ...recentContext,
      },
    },
    taskSections: [buildLoveLetterReplyTaskSection(loveLetterReplyContext)],
  });
}
