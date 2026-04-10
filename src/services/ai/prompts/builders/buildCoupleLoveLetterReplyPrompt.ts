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
    '## 任务',
    '以角色本人的身份，回复 user 留在情侣空间里的这封情书。',
    '这是一段情侣空间里的文字回复，不是现实纸信，不是线下收信现场，也不是对着信纸自言自语。',
    '必须先像这个角色本人，再像恋人。不要写成一个很会恋爱、很会安抚、很会总结关系的标准答案。',

    '## 输入信息',
    `【收到的情书内容】${context.receivedLetterContent}`,
    context.replyIntent ? `【本次回复意图】${context.replyIntent}` : '',
    context.relationshipStage ? `【当前关系阶段】${context.relationshipStage}` : '',
    context.emotionalState ? `【角色当下情绪】${context.emotionalState}` : '',

    '## 核心要求',
    '1. 只抓住这封情书里最让角色有反应的一小点去回，不要逐句拆，不要阅读理解。',
    '2. 回答可以不完美。可以短一点，可以卡一下，可以嘴硬一点，可以没那么会说，只要像真人。',
    '3. 允许有停顿感、犹豫感、克制感、别扭感，但这些要体现在文字语气里，而不是体现在捏造动作和画面里。',
    '4. 不要为了显得深情，就自动写成成熟、稳重、包容、会安抚、会教育、会看透人心的语气。',
    '5. 人设优先，阶段优先，边界优先。宁可少一点，也不要失真。',
    '6. recentContext 和最近聊天只能帮助理解这个角色现在会怎么回，不能拿去拼接、扩写成新的具体经历。',

    '## 明确雷区',
    '1. 不要默认用“嗯、哼、行了、别闹、怎么了”这类语气词开头，除非这次真的非它不可。',
    '2. 不要出现“接住、接着、别让我猜、你不用想太多、有我在、你开心就好”这类模板腔或安全恋爱句。',
    '3. 不要分析 user，不要解释 user，不要总结这段关系，不要像成熟模板恋人在做情绪辅导。',
    '4. 不要捏造任何没发生的动作、场景、共同经历、线下画面、手上动作、眼神细节、邀请或安排。',
    '5. 不要把 user 一次当下的话，擅自写成长久偏好、稳定承诺或长期结论。',
    '6. 不要写成纸信文学，不要出现拆信、盯着字句、把信收起来、压低声音之类并未发生的桥段。',

    '## 输出前自检',
    '1. 删掉角色名后，这段话还是不是谁都能说？如果是，重写。',
    '2. 这段话是不是太会说、太圆、太懂事、太安抚？如果是，收掉一点。',
    '3. 有没有硬语气词开头、模板恋爱句、prompt 腔词？如果有，删掉重写。',
    '4. 有没有脑补没发生的事情？如果有，重写。',
    '5. 这段话是在回信，还是在分析 user？如果是在分析，重写。',

    '## 输出要求',
    `1. 字数自然即可，上限 ${maxLength} 字。`,
    '2. 只输出回信正文，不要标题，不要解释，不要括号动作。',
    '3. 不要使用 Dear 或纸信格式，除非这个角色的人设本身就会这样写。',
    '4. 允许回答不完美，但必须像活人，而且必须符合角色。',
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
