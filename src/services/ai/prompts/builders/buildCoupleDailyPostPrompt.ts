import { composeCoupleSpacePrompt } from './coupleSpaceShared';
import type { CoupleSpacePromptCommonInput } from '../coupleSpace/types';

export type BuildCoupleDailyPostPromptOptions = CoupleSpacePromptCommonInput & {
  dailyPostContext?: {
    sharedMomentSummary?: string;
    desiredTone?: string;
    maxLength?: number;
    includeUserPresence?: boolean;
    avoidPublicFeedTone?: boolean;
    relationshipStage?: string;
    emotionalAftertaste?: string;
  };
};

function buildDailyPostTaskSection(
  dailyPostContext: BuildCoupleDailyPostPromptOptions['dailyPostContext'] = {},
): string {
  const maxLength = dailyPostContext.maxLength ?? 120;

  const lines = [
    '## 核心任务：生成一条具有“私密呼吸感”的情侣空间日常碎片',
    '这不是朋友圈，不是公开日志。这是 char 的“私人情绪备忘录”或“隔空对 user 说的悄悄话”。它记录的是聊天之外的余温、瞬间的挂念、或是没好意思当面说出口的微小情绪。',

    '### 输入信息',
    dailyPostContext.sharedMomentSummary
      ? `【已知关系线索】: ${dailyPostContext.sharedMomentSummary}`
      : '【已知关系线索】: 无（请基于当下情绪自然生发，严禁自行捏造具体共同经历）',
    dailyPostContext.relationshipStage ? `【当前关系阶段】: ${dailyPostContext.relationshipStage}` : '',
    dailyPostContext.emotionalAftertaste ? `【当前情绪余温】: ${dailyPostContext.emotionalAftertaste}` : '',
    dailyPostContext.desiredTone
      ? `【期望语气】: ${dailyPostContext.desiredTone}`
      : '【期望语气】: 必须极度贴合 char 的人设底色（如：傲娇的口是心非、成熟的内敛温柔等）。',

    '### 🎯 称呼与视角约束（绝对核心，防机器味）',
    '1. 【严禁直呼全名/系统ID】：既然已经是情侣，绝对不能生硬地像播报新闻一样使用对方的全名/ID。',
    '2. 【动态提取专属昵称】：请严格从近期的对话上下文（recentContext）中，提取 char 最近对 user 真实使用过的专属称呼（如：宝宝、小乖、笨蛋、小朋友等），并在内容中自然使用。',
    '3. 【私密视角的代词】：如果近期没有特殊昵称，请优先使用“你”、“她/他”，或者符合 char 人设的口语化代称（如“某人”、“那家伙”）。例如：不说“大鹅没回消息”，而是说“你又跑哪去野了”，或者“某人又不看手机”。',

    '### 💡 活人感写作指南（怎么写才不像机器人报告）',
    '1. 【隔空对话 / 内心独白】：把它当成是一条“没有按发送键的微信”或者“写在纸条上的碎碎念”。',
    '2. 【抓住情绪毛边】：不要流水账地记录动作（如“我看了一眼手机又放下”）。去写动作背后的情绪微澜，比如一瞬间的失落、莫名其妙的笑意、或者假装不在意的傲娇。',
    '3. 【留白与克制】：字数不需要多，有时候一两句没头没尾的话（例如：“今天风很大，不知道你穿够了没。”）比长篇大论的表白更有破坏力。不要像情感博主一样做任何总结和升华。',

    '### 🚫 雷区禁令（触发即重写）',
    ' - 查重警告：如果把内容里的昵称换成别人，这句话依然成立（套话/废话），则不合格。必须带有 char 强烈的个人口吻。',
    ' - 视角错乱：严禁像“上帝视角旁白”一样描述自己，严禁出现括号动作描写（如“（叹了口气）”）。',
    ' - 强行造假：绝对禁止编造输入信息中未提供的童年往事、昨天发生的事、或是没有过的具体约会细节。',
    ' - 社交媒体味：不能有“今天也是开心的一天”、“大家”这类公开营业的语气。',

    '### 输出前终极自查',
    '1. 称呼是不是自然亲昵？有没有死板地直呼其名？',
    '2. 语气像不像 char 这种性格的人会在私密空间里留下的文字？',
    '3. 是否只是客观描述了“对方没理我/我喝了水”，而没有透出任何情感涟漪？（如果是流水账，必须重写）',

    '### 输出要求',
    ` - 直接输出可展示的正文内容，字数随情绪自然流动，控制在 ${maxLength} 字以内。`,
    ' - 绝对不要带任何标题、前缀（如“动态：”）、解释说明或括号动作。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildCoupleDailyPostPrompt(
  options: BuildCoupleDailyPostPromptOptions = {},
): string {
  const { dailyPostContext, recentContext, ...common } = options;

  return composeCoupleSpacePrompt({
    common: {
      ...common,
      mode: options.mode ?? 'active',
      actionType: options.actionType ?? 'post_couple_daily',
      recentContext: {
        currentSubScene: 'couple_daily_post',
        ...recentContext,
      },
    },
    taskSections: [buildDailyPostTaskSection(dailyPostContext)],
  });
}
