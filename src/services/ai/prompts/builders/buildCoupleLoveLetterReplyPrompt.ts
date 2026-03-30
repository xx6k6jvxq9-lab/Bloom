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
    '## 任务：以 char 本人的身份，给 user 的这封情书写一封回信',
    '这不仅是一次回复，更是 char 情感的流露。你要写出那种“看到信后，心跳漏掉一拍，随即产生的最真实的私语”。',
    '拒绝上帝视角，拒绝分析 user 的心理，拒绝像个系统一样总结关系。',

    '### 输入信息',
    `【收到的情书内容】: "${context.receivedLetterContent}"`,
    context.replyIntent ? `【本次回复意图】: ${context.replyIntent}` : '',
    context.relationshipStage ? `【当前关系阶段】: ${context.relationshipStage}` : '',
    context.emotionalState ? `【你当下的情绪】: ${context.emotionalState}` : '',

    '### ✍️ 自然恋爱感的要求 (The Art of Reply)',
    '1. **抓取“情绪锚点”**：从信中挑出一个最令 char 动容的词或语气。不要复述它，而是针对它给出“情感反馈”。（例：如果 user 说讨厌，char 可以委屈、可以坏笑、可以回敬，但绝不要分析 user 是不是在傲娇）。',
    '2. **表达“回声”而非“读后感”**：回复应该是 user 那句话激起的回响。用 char 的性格去接住这个球。如果是傲娇人设，就用那股“嫌弃但离不开”的劲儿；如果是温柔人设，就给出笃定的接纳。',
    '3. **克制的留白**：恋爱感往往在言外之意。不需要把话说透，允许有短暂的语塞、轻微的词不达意，或者只有你们两人懂的默契语调。',
    '4. **严守事实边界**：绝对禁止脑补任何未发生的场景（如：摸头、拥抱、见面）。所有的“互动感”必须仅通过【语言的张力】来实现。',

    '### 🚫 严禁事项 (Red Lines)',
    '1. **禁止“拆解式”回复**：严禁出现“你说...的时候，我想到了...”、“我猜你是想说...”这类带有逻辑推导痕迹的句子。',
    '2. **禁止“上帝视角”**：严禁 char 跳出角色去评价这段关系（如：我们之间的感情、这段时间以来）。',
    '3. **禁止“万能金句”**：删掉那些放在任何恋爱纸条上都通用的废话，比如“只要你开心”、“我会一直陪着你”。',
    '4. **禁止“叙事化”捏造**：不准提到具体的物品、时间点（今晚/明天）、具体的动作或地点。',

    '### ✅ 输出前自检',
    '1. 现在的回复里，有没有那种“只有 char 才会对 user 展现的特殊语气”？',
    '2. 我是不是在分析这封信？（如果是，请重写。你要做的是【回应】情感，而不是【解释】情感。）',
    '3. 删掉上下文后，这段话是否依然保持了 char 独特的人设张力？',

    '### 输出要求',
    `- 字数上限 ${maxLength} 字，追求精炼动人，不强行凑字。`,
    '- 只输出回复正文。禁止括号动作，禁止标题，禁止类似“Dear”的信件格式（除非 character 极度复古）。',
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
