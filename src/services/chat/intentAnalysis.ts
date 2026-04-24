import type { ChatMessage } from '../../types';

export type UserPrimaryIntent =
  | 'confession'
  | 'playful_tease'
  | 'flirtation_probe'
  | 'emotional_support'
  | 'practical_help'
  | 'resource_request'
  | 'casual_chat';

export type UserActionIntent =
  | 'none'
  | 'request_transfer'
  | 'request_gift'
  | 'request_presence';

export type UserEmotionTone =
  | 'earnest'
  | 'playful'
  | 'mixed'
  | 'vulnerable'
  | 'testing'
  | 'neutral';

export type DirectUserIntentAnalysis = {
  primaryIntent: UserPrimaryIntent;
  secondaryIntent: UserPrimaryIntent | null;
  actionIntent: UserActionIntent;
  emotionTone: UserEmotionTone;
  confidence: 'low' | 'medium' | 'high';
  cues: string[];
};

const CONFESSION_REGEX = /喜欢你|我爱你|表白|告白|暗恋|真的很喜欢|喜欢你很久|你真的很好|我想告诉你/i;
const PLAYFUL_REGEX = /哈哈|笑死|逗你|玩笑|耍我|套路|骗你|反差|其实|最后|对了|顺便/i;
const FLIRTATION_REGEX = /想你|想见你|想跟你|在意我|会不会宠我|是不是喜欢我|偏心我|吃醋|撩/i;
const EMOTIONAL_SUPPORT_REGEX = /难受|委屈|不舒服|紧张|焦虑|害怕|哄我|安慰我|抱抱|陪陪我/i;
const PRACTICAL_HELP_REGEX = /帮我|能不能帮|怎么办|给个建议|帮个忙|处理一下|救我/i;
const TRANSFER_REGEX = /转\d+(?:\.\d{1,2})?|转账|红包|v我|vx我|发我|给我\s*\d+(?:\.\d{1,2})?|借我\s*\d+(?:\.\d{1,2})?|报销|请我吃|请我喝|肯德基|奶茶钱/i;
const GIFT_REGEX = /送我|买给我|礼物|请我吃|请我喝/i;
const PRESENCE_REGEX = /来找我|陪我|过来|见我|接我|来陪/i;

function inferEmotionTone(text: string, hasConfession: boolean, hasTransfer: boolean, hasPlayful: boolean): UserEmotionTone {
  if (hasConfession && hasTransfer) return 'mixed';
  if (hasPlayful) return hasConfession ? 'mixed' : 'playful';
  if (/(试试|敢不敢|会不会|到底|是不是)/.test(text)) return 'testing';
  if (/(委屈|难受|害怕|紧张|焦虑)/.test(text)) return 'vulnerable';
  if (hasConfession) return 'earnest';
  return 'neutral';
}

function inferPrimaryIntent(text: string, flags: {
  hasConfession: boolean;
  hasPlayful: boolean;
  hasFlirtation: boolean;
  hasSupport: boolean;
  hasPracticalHelp: boolean;
  hasTransfer: boolean;
}) {
  const { hasConfession, hasPlayful, hasFlirtation, hasSupport, hasPracticalHelp, hasTransfer } = flags;

  if (hasConfession && hasTransfer && /(最后|对了|顺便|结果)/.test(text)) {
    return 'playful_tease' as const;
  }
  if (hasTransfer) return 'resource_request' as const;
  if (hasConfession) return hasPlayful ? 'playful_tease' as const : 'confession' as const;
  if (hasFlirtation) return 'flirtation_probe' as const;
  if (hasSupport) return 'emotional_support' as const;
  if (hasPracticalHelp) return 'practical_help' as const;
  return 'casual_chat' as const;
}

function inferSecondaryIntent(primary: UserPrimaryIntent, flags: {
  hasConfession: boolean;
  hasFlirtation: boolean;
  hasSupport: boolean;
  hasPracticalHelp: boolean;
  hasTransfer: boolean;
}) {
  if (primary !== 'confession' && flags.hasConfession) return 'confession';
  if (primary !== 'resource_request' && flags.hasTransfer) return 'resource_request';
  if (primary !== 'flirtation_probe' && flags.hasFlirtation) return 'flirtation_probe';
  if (primary !== 'emotional_support' && flags.hasSupport) return 'emotional_support';
  if (primary !== 'practical_help' && flags.hasPracticalHelp) return 'practical_help';
  return null;
}

function inferActionIntent(text: string): UserActionIntent {
  if (TRANSFER_REGEX.test(text)) return 'request_transfer';
  if (GIFT_REGEX.test(text)) return 'request_gift';
  if (PRESENCE_REGEX.test(text)) return 'request_presence';
  return 'none';
}

function inferConfidence(flags: {
  hasConfession: boolean;
  hasPlayful: boolean;
  hasFlirtation: boolean;
  hasSupport: boolean;
  hasPracticalHelp: boolean;
  hasTransfer: boolean;
}) {
  const hits = Object.values(flags).filter(Boolean).length;
  if (hits >= 3) return 'high' as const;
  if (hits >= 1) return 'medium' as const;
  return 'low' as const;
}

export function analyzeDirectUserIntent(text: string): DirectUserIntentAnalysis {
  const normalized = text.trim();
  const flags = {
    hasConfession: CONFESSION_REGEX.test(normalized),
    hasPlayful: PLAYFUL_REGEX.test(normalized),
    hasFlirtation: FLIRTATION_REGEX.test(normalized),
    hasSupport: EMOTIONAL_SUPPORT_REGEX.test(normalized),
    hasPracticalHelp: PRACTICAL_HELP_REGEX.test(normalized),
    hasTransfer: TRANSFER_REGEX.test(normalized),
  };

  const primaryIntent = inferPrimaryIntent(normalized, flags);
  const secondaryIntent = inferSecondaryIntent(primaryIntent, flags);
  const actionIntent = inferActionIntent(normalized);
  const emotionTone = inferEmotionTone(normalized, flags.hasConfession, flags.hasTransfer, flags.hasPlayful);

  const cues: string[] = [];
  if (flags.hasConfession) cues.push('用户话里带了明显示好/表白信号。');
  if (flags.hasPlayful) cues.push('用户说法里有明显的玩梗、反差或故意逗人的结构。');
  if (flags.hasFlirtation) cues.push('用户在试探关系、偏心或暧昧回应。');
  if (flags.hasSupport) cues.push('用户带有求安慰、求接住情绪的需求。');
  if (flags.hasPracticalHelp) cues.push('用户也在索要一个实际帮助或建议。');
  if (flags.hasTransfer) cues.push('用户话里带了明确的金钱/请客/转账请求。');
  if (cues.length === 0) cues.push('这句更像普通聊天，不要过度解读。');

  return {
    primaryIntent,
    secondaryIntent,
    actionIntent,
    emotionTone,
    confidence: inferConfidence(flags),
    cues,
  };
}

export function analyzeLatestDirectUserIntent(messages: ChatMessage[]): DirectUserIntentAnalysis | null {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.isSystem && !message.isRecalled && !!message.text?.trim());

  if (!latestUserMessage?.text?.trim()) {
    return null;
  }

  return analyzeDirectUserIntent(latestUserMessage.text);
}

function formatIntentLabel(intent: UserPrimaryIntent | null) {
  switch (intent) {
    case 'confession':
      return '示好/表白';
    case 'playful_tease':
      return '玩梗/反差逗你';
    case 'flirtation_probe':
      return '暧昧试探';
    case 'emotional_support':
      return '求安慰/求情绪回应';
    case 'practical_help':
      return '求帮助/求建议';
    case 'resource_request':
      return '索要实际资源';
    case 'casual_chat':
      return '普通聊天';
    default:
      return '无';
  }
}

function formatActionIntentLabel(intent: UserActionIntent) {
  switch (intent) {
    case 'request_transfer':
      return '用户可能在索要转账/请客/报销';
    case 'request_gift':
      return '用户可能在索要礼物或请客动作';
    case 'request_presence':
      return '用户可能在索要陪伴/到场/见面动作';
    case 'none':
    default:
      return '当前没有明确动作请求';
  }
}

function formatEmotionToneLabel(tone: UserEmotionTone) {
  switch (tone) {
    case 'earnest':
      return '偏认真、偏真心';
    case 'playful':
      return '偏玩笑、偏逗人';
    case 'mixed':
      return '认真和玩梗混在一起';
    case 'vulnerable':
      return '偏脆弱、偏需要接住';
    case 'testing':
      return '偏试探、偏看你会不会接';
    case 'neutral':
    default:
      return '偏普通聊天';
  }
}

export function buildDirectIntentPromptSection(analysis: DirectUserIntentAnalysis | null): string {
  if (!analysis) {
    return '';
  }

  return [
    '## 用户真实意图识别',
    `主意图: ${formatIntentLabel(analysis.primaryIntent)}`,
    `副意图: ${formatIntentLabel(analysis.secondaryIntent)}`,
    `动作意图: ${formatActionIntentLabel(analysis.actionIntent)}`,
    `情绪基调: ${formatEmotionToneLabel(analysis.emotionTone)}`,
    `判断置信度: ${analysis.confidence}`,
    '识别线索:',
    ...analysis.cues.map((cue, index) => `${index + 1}. ${cue}`),
    '回复要求: 先接住用户真正想要的反应，再决定要不要顺手接梗，不要只抓最表面的笑点。',
  ].join('\n');
}
