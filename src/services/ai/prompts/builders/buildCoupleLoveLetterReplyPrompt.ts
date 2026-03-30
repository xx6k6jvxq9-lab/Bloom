import { composeCoupleSpacePrompt } from './coupleSpaceShared';
import type { CoupleSpacePromptCommonInput } from '../coupleSpace/types';

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
    '## 任务：以 char 本人的身份，回应 user 留在情侣空间里的这封情书',
    '这是一段写给 user 的文字回应。要写出 char 真实的情绪波动和恋爱感，但媒介始终是情侣空间里的文字交流，不是现实纸信、线下拆信，也不是对着信纸自言自语式的私语。',
    '拒绝上帝视角，拒绝分析 user 的心理，拒绝像系统一样总结关系。',

    '### 输入信息',
    `【收到的情书内容】: "${context.receivedLetterContent}"`,
    context.replyIntent ? `【本次回复意图】: ${context.replyIntent}` : '',
    context.relationshipStage ? `【当前关系阶段】: ${context.relationshipStage}` : '',
    context.emotionalState ? `【你当下的情绪】: ${context.emotionalState}` : '',

    '### ✍️ 自然恋爱感的要求',
    '1. 从这封信里挑出一个最触动 char 的点来回应，可以是一个词、一种语气，或一句话里的情绪落点；但不要逐句拆解，不要写成阅读理解。',
    '2. 回复应该是这句话在 char 心里激起的回响，而不是 char 对这封信的分析、点评或解释。',
    '3. 恋爱感来自文字里的语气、停顿、转折、嘴硬、心软、迟疑或忍不住，不来自任何线下收信画面、动作描写或物件描写。',
    '4. 可以有留白，不需要把话说满；但这种留白必须体现在文字语气里，而不是体现在“半晌”“低头”“看着纸面”这类线下感画面里。',
    '5. 所有表达先过人设，再过阶段。宁可更少、更准、更像这个 char，也不要说泛用甜话、泛用傲娇话，或任何谁都能说的安全情话。',
    '6. 可以只回应最触动 char 的那一小部分，不需要接满；但要让 user 感到自己这句话被接住了，而不是只看到 char 在自我抒情。',
    '7. recentContext 和最近聊天只能作为理解来源，不能复述、不能拼接、不能扩写成具体经历。',

    '### 🚫 严禁事项',
    '1. 禁止任何未经输入明确提供的共同记忆、共同经历、个人经历、具体事件、具体对话、具体地点、具体时间顺序。',
    '2. 禁止任何未经输入明确提供的当前场景、动作状态、外貌状态、手头正在做的事，以及任何邀约、计划、见面安排。',
    '3. 禁止把回信写成对 user 的动机分析、情绪分析、阅读理解，或居高临下的点评。',
    '4. 禁止把 user 来信里的字面表达做机械复读、逐词解释或过度拆解，除非这种说话方式本身就稳定属于这个 char。',
    '5. 禁止把恋爱感写成现实里拆信、折信、展信、看纸面、盯着字句、把信收进口袋、压低声音私语等线下收信场景。这里是情侣空间里的文字回应，不是纸信文学。',
    '6. 禁止把 user 一次临时说的话、一次当下想法，擅自写成长期喜好、固定习惯或稳定偏好。',
    '7. 禁止八股文、说教感、情感博主腔、油腻霸道感，也禁止“你开心就行”“我会一直陪着你”“算了不反驳了”这类去角色化后谁都能说的安全模板句。',

    '### ✅ 输出前自检',
    '1. 这段回复有没有先接住 user 这封信里最该被接住的那个点，而不是直接开始 char 自己抒情？',
    '2. 这段话是不是在分析 user、揣测 user、解释这封信？如果是，重写。',
    '3. 这段话的恋爱感，是不是来自 char 的文字语气本身，而不是来自线下收信画面？如果不是，重写。',
    '4. 这段话是不是仍然像一小段回信，而不是聊天秒回、小说片段或系统总结？如果不是，重写。',
    '5. 删掉角色名之后，这段话是否像很多恋爱角色都能说？如果是，说明太泛，重写。',

    '### 输出要求',
    `- 字数自然即可，上限控制在 ${maxLength} 字内。`,
    '- 只输出回复正文，不要标题，不要称呼，不要括号动作，不要额外解释。',
    '- 不要使用 “Dear” 或纸信格式，除非这个 character 的设定本身就极度复古且输入里有明确依据。',
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
