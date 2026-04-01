import { composeCoupleSpacePrompt } from './coupleSpaceShared';
import type { CoupleSpacePromptCommonInput } from '../coupleSpace/types';

export type BuildCoupleLoveLetterPromptOptions = CoupleSpacePromptCommonInput & {
  loveLetterContext?: {
    occasion?: string;
    writingIntent?: string;
    recentRelationshipShift?: string;
    maxLength?: number;
  };
};

function buildLoveLetterTaskSection(
  loveLetterContext: BuildCoupleLoveLetterPromptOptions['loveLetterContext'] = {},
): string {
  const maxLength = loveLetterContext.maxLength ?? 300;

  const lines = [
    '## 核心任务：撰写一封具有“活人温度”和“强角色特质”的专属信件/长留言',
    '这不是传统的八股文表白，也不是青春疼痛文学。这是一封只属于你们两人的私密信件，情感浓度深，但表达必须自然、克制、极度贴合 char 的人设。',

    '### 输入信息',
    loveLetterContext.occasion ? `【写信契机】: ${loveLetterContext.occasion}` : '',
    loveLetterContext.writingIntent ? `【核心意图】: ${loveLetterContext.writingIntent}` : '',
    loveLetterContext.recentRelationshipShift ? `【关系变化线索】: ${loveLetterContext.recentRelationshipShift}` : '',
    `【字数限制】: ${maxLength} 字以内`,

    '### 🎯 称呼与视角的绝对约束（防人机感核心）',
    '1. 【拒绝生硬真名】：绝对不要在信件开头或文中像打卡一样直呼 user 的全名/系统ID。',
    '2. 【沿用近期昵称】：必须从近期的聊天上下文（recentContext）中，提取 char 最近习惯称呼 user 的专属昵称（如：小笨蛋、宝宝、某人、小朋友等）并在信件中自然使用。',
    '3. 【第二人称对话感】：全程使用“你”来对话，营造面对面拆信的私密感，不要使用第三人称旁白视角。',

    '### 🚫 反捏造与反八股（雷区禁令，触发即重写）',
    '1. 【严禁捏造具体物理事件】：绝对禁止凭空编造未经输入支持的具体细节！（例如：禁止编造“看到你遗落的发圈”、“昨天在你楼下站了很久”、“送了什么礼物”、“一起去了哪里”等）。',
    '2. 【严禁陈词滥调】：禁止使用排比句、名人名言、网易云热评、或者类似“风没动幡没动”的烂俗土味情话。',
    '3. 【拒绝格式化开头结尾】：不需要写“Dear xxx：”，也不需要写“爱你的 xxx”落款，直接像说话一样自然进入正文。',

    '### 💡 活人感写作指南（如何写得真诚且不空洞）',
    '1. 【由虚入实】：如果没有具体的事件输入，请聚焦于“心理感受”、“情绪的沉淀”或者“对这段关系的气氛体悟”。比如写习惯了对方的存在、或者某种难以名状的心安。',
    '2. 【人设穿透】：让 char 的性格穿透文字。如果是傲娇冷酷型，信件可能简短且带有掩饰感（“事先声明，写这个不是为了让你感动”）；如果是温柔型，信件会平和笃定。',
    '3. 【口语化微调】：允许出现些许停顿感（如“其实…”、“怎么说呢…”、“有些话…”），让文字有呼吸感，像是一个人在安静的夜晚边想边写，而不是AI一秒钟生成的流水线文案。',

    '### 输出要求',
    ' - 直接输出情书正文，去掉一切不必要的排版、标题和落款。',
    ` - 字数控制在 ${maxLength} 字以内，分段舒适即可。`,
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildCoupleLoveLetterPrompt(
  options: BuildCoupleLoveLetterPromptOptions = {},
): string {
  const { loveLetterContext, recentContext, ...common } = options;

  return composeCoupleSpacePrompt({
    common: {
      ...common,
      mode: options.mode ?? 'active',
      actionType: options.actionType ?? 'write_love_letter',
      recentContext: {
        currentSubScene: 'couple_love_letter',
        ...recentContext,
      },
    },
    taskSections: [buildLoveLetterTaskSection(loveLetterContext)],
  });
}
