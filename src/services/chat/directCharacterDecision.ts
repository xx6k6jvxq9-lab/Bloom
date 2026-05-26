import type { Character, ChatMessage } from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import type { DirectUserIntentAnalysis } from './intentAnalysis';
import { isTransferInitiationReplyConsistent } from './transferEventSemantics';

export type RelationshipCloseness = 'low' | 'medium' | 'high';
export type CharacterActionStyle = 'guarded' | 'steady' | 'indulgent' | 'tsundere';
export type TransferDisposition = 'ignore' | 'consider' | 'lean_grant' | 'lean_refuse';

export type DirectCharacterDecision = {
  relationshipCloseness: RelationshipCloseness;
  closenessScore: number;
  actionStyle: CharacterActionStyle;
  actionBiasScore: number;
  transferDisposition: TransferDisposition;
  transferReadiness: number;
  suggestedApproach: string;
  cues: string[];
  requestedAmount: number | null;
};

const INDULGENT_REGEX = /宠|纵容|惯着|护短|偏爱|大方|请客|照顾|心软|温柔|舍得|给你买/i;
const GUARDED_REGEX = /克制|谨慎|防备|高冷|理性|边界|冷淡|疏离/i;
const TSUNDERE_REGEX = /嘴硬|别扭|傲娇|毒舌|口是心非|不坦率/i;
const MONEY_SENSITIVE_REGEX = /省钱|节俭|抠|理财|精打细算|不乱花|财务/i;
const ACTION_ORIENTED_REGEX = /行动派|直接|说到做到|靠谱|会做|照顾人|有担当/i;
const WARMTH_REGEX = /喜欢|想你|抱抱|乖|宝|宝宝|陪你|想见你|在意|偏心|撒娇|亲亲/i;
const CARE_REGEX = /我在|别怕|放心|抱|陪|照顾|给你|护着|哄你|安慰/i;

const TRANSFER_PROTOCOL_REGEX = /\[transfer\]\s*[\d.]+\s*\[\/transfer\]/i;
const EXPLICIT_GRANT_REGEX = /转给你|转你|钱给你|给你转|给你了|拿着|收着|报销|给你报|我出|请你|发过去了|打过去了|收款|给你这次|先给你/i;
const EXPLICIT_REFUSE_REGEX = /不给|不转|没门|休想|想得美|自己买|不报销|先别想|不能给|这次不行/i;
const HEDGE_REGEX = /回头再说|看表现|下次再说|以后再说|先欠着|再看看/i;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getCharacterProfileText(character: Character) {
  const characterContext = buildCharacterContext({ character });
  return [
    characterContext.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
  ]
    .filter(Boolean)
    .join('\n');
}

function countMatches(text: string, regex: RegExp) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  return text.match(new RegExp(regex.source, flags))?.length ?? 0;
}

function scoreRelationshipCloseness(messages: ChatMessage[]) {
  const recentMessages = messages
    .filter((message) => !message.isSystem && !message.isRecalled && !!message.text?.trim())
    .slice(-12);
  const transcript = recentMessages.map((message) => message.text.trim()).join('\n');
  const modelMessages = recentMessages.filter((message) => message.role === 'model');
  const userMessages = recentMessages.filter((message) => message.role === 'user');

  let score = 18;
  score += Math.min(recentMessages.length, 12) * 3;
  score += countMatches(transcript, WARMTH_REGEX) * 8;
  score += modelMessages.filter((message) => CARE_REGEX.test(message.text)).length * 6;
  score += userMessages.filter((message) => /喜欢|想你|陪我|宝|宝宝|亲爱|依赖|抱抱/i.test(message.text)).length * 5;

  const closenessScore = clampScore(score);
  const cues: string[] = [];
  if (recentMessages.length >= 10) {
    cues.push('最近来回聊天比较密，关系不是纯路人状态。');
  } else if (recentMessages.length >= 6) {
    cues.push('最近已经有持续互动，不是只说过一两句。');
  }
  if (closenessScore >= 68) {
    cues.push('最近对话里有比较明显的亲近、照顾或偏爱信号。');
  }

  const relationshipCloseness: RelationshipCloseness = closenessScore >= 68
    ? 'high'
    : closenessScore >= 42
      ? 'medium'
      : 'low';

  if (cues.length === 0) {
    cues.push('最近可读到的亲近信号不多，默认按更谨慎的熟悉度处理。');
  }

  return {
    relationshipCloseness,
    closenessScore,
    cues,
  };
}

function inferActionStyle(character: Character) {
  const profile = getCharacterProfileText(character);
  let actionBiasScore = 0;
  const cues: string[] = [];

  if (INDULGENT_REGEX.test(profile)) {
    actionBiasScore += 18;
    cues.push('角色底色偏宠、偏愿意照顾人。');
  }
  if (TSUNDERE_REGEX.test(profile)) {
    actionBiasScore += 8;
    cues.push('角色有嘴硬心软或先怼后松口的味道。');
  }
  if (ACTION_ORIENTED_REGEX.test(profile)) {
    actionBiasScore += 10;
    cues.push('角色更像会用实际动作回应，而不只停在嘴上。');
  }
  if (GUARDED_REGEX.test(profile)) {
    actionBiasScore -= 14;
    cues.push('角色边界感比较强，不会轻易顺着请求走。');
  }
  if (MONEY_SENSITIVE_REGEX.test(profile)) {
    actionBiasScore -= 18;
    cues.push('角色对金钱或资源使用更谨慎。');
  }

  const actionStyle: CharacterActionStyle = TSUNDERE_REGEX.test(profile)
    ? 'tsundere'
    : actionBiasScore >= 16
      ? 'indulgent'
      : actionBiasScore <= -10
        ? 'guarded'
        : 'steady';

  if (cues.length === 0) {
    cues.push('角色没有特别极端的行动倾向，先按相对稳的反应处理。');
  }

  return {
    actionStyle,
    actionBiasScore,
    cues,
  };
}

function extractRequestedAmount(messages: ChatMessage[], analysis: DirectUserIntentAnalysis | null) {
  if (!analysis || analysis.actionIntent !== 'request_transfer') {
    return null;
  }

  const latestUserText = [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.isSystem && !message.isRecalled && !!message.text?.trim())
    ?.text;

  if (!latestUserText) {
    return null;
  }

  const amountMatch = latestUserText.match(/(?:转|给我|借我|报销|发我)\s*(\d+(?:\.\d{1,2})?)/i)
    || latestUserText.match(/(\d+(?:\.\d{1,2})?)\s*(?:块|元)/i);

  if (!amountMatch) {
    return null;
  }

  const amount = Number.parseFloat(amountMatch[1]);
  return Number.isFinite(amount) ? amount : null;
}

function scoreTransferReadiness(params: {
  analysis: DirectUserIntentAnalysis | null;
  requestedAmount: number | null;
  closenessScore: number;
  actionBiasScore: number;
  character: Character;
}) {
  const {
    analysis,
    requestedAmount,
    closenessScore,
    actionBiasScore,
    character,
  } = params;
  const cues: string[] = [];

  if (!analysis || analysis.actionIntent !== 'request_transfer') {
    return {
      transferDisposition: 'ignore' as const,
      transferReadiness: 0,
      cues,
    };
  }

  const profile = getCharacterProfileText(character);
  const amount = requestedAmount ?? 0;
  let readiness = 20 + Math.round(closenessScore * 0.45) + actionBiasScore;

  if (analysis.primaryIntent === 'confession') {
    readiness += 10;
    cues.push('这句不是干巴巴要钱，前面有比较明显的示好信号。');
  } else if (analysis.primaryIntent === 'playful_tease') {
    readiness += 6;
    cues.push('这句带着逗人和试探，角色不该只把它当个笑话略过去。');
  }

  if (analysis.emotionTone === 'vulnerable') {
    readiness += 5;
  } else if (analysis.emotionTone === 'testing') {
    readiness += 2;
  }

  if (amount > 0 && amount <= 20) {
    readiness += 10;
    cues.push('金额很小，顺手答应的成本不高。');
  } else if (amount > 20 && amount <= 66) {
    readiness += 2;
    cues.push('金额不算夸张，更像在试探会不会宠她。');
  } else if (amount > 66 && amount <= 200) {
    readiness -= 14;
    cues.push('金额开始变大，角色会更认真掂量。');
  } else if (amount > 200) {
    readiness -= 28;
    cues.push('金额偏大，除非关系和人设都很强，否则不会轻易答应。');
  }

  if (MONEY_SENSITIVE_REGEX.test(profile)) {
    readiness -= 8;
  }

  const transferReadiness = clampScore(readiness);
  const transferDisposition: TransferDisposition = transferReadiness >= 74
    ? 'lean_grant'
    : transferReadiness >= 48
      ? 'consider'
      : 'lean_refuse';

  if (transferDisposition === 'lean_refuse' && cues.length === 0) {
    cues.push('这轮确实识别到了金额请求，但角色更可能先压住，不会直接顺着给。');
  }

  return {
    transferDisposition,
    transferReadiness,
    cues,
  };
}

function inferSuggestedApproach(params: {
  analysis: DirectUserIntentAnalysis | null;
  actionStyle: CharacterActionStyle;
  transferDisposition: TransferDisposition;
  transferReadiness: number;
}) {
  const { analysis, actionStyle, transferDisposition, transferReadiness } = params;

  if (!analysis) {
    return '先正常接住内容，不要空泛敷衍。';
  }

  if (analysis.actionIntent === 'request_transfer') {
    if (transferDisposition === 'lean_grant') {
      return actionStyle === 'tsundere'
        ? '可以先嘴硬、先吐槽，但最后要明确给，并把动作真正落地。'
        : '先按你自己的关系方式回应，再明确答应或顺着往下给，不要只停在调侃。';
    }
    if (transferDisposition === 'consider') {
      return actionStyle === 'guarded'
        ? '先稳住边界再表态，可以不立刻答应，但别装作没看见金额请求。'
        : '可以先用你本人的语气逗、试探或绕一下，但最后必须给出给还是不给的态度。';
    }
    return transferReadiness < 30
      ? '更像要谨慎拒绝，但也要按你自己的方式回应用户要关注的动作，别只拿金额开玩笑。'
      : '这轮更适合先压住动作请求，再角色化地解释或拒绝。';
  }

  if (analysis.primaryIntent === 'confession' || analysis.primaryIntent === 'flirtation_probe') {
    return actionStyle === 'guarded'
      ? '先回应示好，再稳住边界，不要冷得像系统消息。'
      : '先让你对示好或试探产生反应，再按你的个性决定是靠近、嘴硬、逗回、压住还是躲开。';
  }

  if (analysis.primaryIntent === 'emotional_support') {
    return '这一轮优先由你本人处理这份情绪；温柔、嘴笨、冷硬、别扭、强势或安抚都必须按人设来，不要默认心理咨询式安慰。';
  }

  return '先判断你会被哪一点触发，再决定是接住、顶回去、轻调侃、转开还是留白。';
}

export function analyzeDirectCharacterDecision(params: {
  character: Character;
  messages: ChatMessage[];
  intentAnalysis: DirectUserIntentAnalysis | null;
}): DirectCharacterDecision | null {
  const { character, messages, intentAnalysis } = params;
  if (!intentAnalysis) {
    return null;
  }

  const closeness = scoreRelationshipCloseness(messages);
  const style = inferActionStyle(character);
  const requestedAmount = extractRequestedAmount(messages, intentAnalysis);
  const transfer = scoreTransferReadiness({
    analysis: intentAnalysis,
    requestedAmount,
    closenessScore: closeness.closenessScore,
    actionBiasScore: style.actionBiasScore,
    character,
  });

  return {
    relationshipCloseness: closeness.relationshipCloseness,
    closenessScore: closeness.closenessScore,
    actionStyle: style.actionStyle,
    actionBiasScore: style.actionBiasScore,
    transferDisposition: transfer.transferDisposition,
    transferReadiness: transfer.transferReadiness,
    suggestedApproach: inferSuggestedApproach({
      analysis: intentAnalysis,
      actionStyle: style.actionStyle,
      transferDisposition: transfer.transferDisposition,
      transferReadiness: transfer.transferReadiness,
    }),
    cues: [...closeness.cues, ...style.cues, ...transfer.cues],
    requestedAmount,
  };
}

function formatClosenessLabel(closeness: RelationshipCloseness) {
  switch (closeness) {
    case 'high':
      return '偏近，已经不是纯客气关系';
    case 'medium':
      return '中等熟悉，可以自然接住';
    case 'low':
    default:
      return '还要更谨慎一点';
  }
}

function formatActionStyleLabel(style: CharacterActionStyle) {
  switch (style) {
    case 'guarded':
      return '偏克制谨慎，不会轻易顺着给';
    case 'indulgent':
      return '偏宠、偏愿意照顾人';
    case 'tsundere':
      return '偏嘴硬心软，可能先怼再松口';
    case 'steady':
    default:
      return '偏稳，会先看场景再表态';
  }
}

function formatTransferDispositionLabel(disposition: TransferDisposition) {
  switch (disposition) {
    case 'lean_grant':
      return '这轮明显更偏向答应';
    case 'lean_refuse':
      return '这轮明显更偏向压住或拒绝';
    case 'consider':
      return '这轮要正面处理，但未必直接答应';
    case 'ignore':
    default:
      return '当前没有强动作处理要求';
  }
}

export function buildDirectCharacterDecisionPromptSection(decision: DirectCharacterDecision | null) {
  if (!decision) {
    return '';
  }

  return [
    '## 当前你的反应参考',
    '说明: 这里只是本轮行动与关系判断的辅助层，不得覆盖你的核心人设、说话手感和当前状态。',
    `关系熟悉度: ${formatClosenessLabel(decision.relationshipCloseness)}（${decision.closenessScore}/100）`,
    `你的行动风格: ${formatActionStyleLabel(decision.actionStyle)}（偏置 ${decision.actionBiasScore >= 0 ? '+' : ''}${decision.actionBiasScore}）`,
    `动作请求倾向: ${formatTransferDispositionLabel(decision.transferDisposition)}（${decision.transferReadiness}/100）`,
    decision.requestedAmount != null ? `用户提到的金额: ${decision.requestedAmount.toFixed(2)}` : '',
    '决策线索:',
    ...decision.cues.map((cue, index) => `${index + 1}. ${cue}`),
    `回复策略: ${decision.suggestedApproach}`,
    '要求: 不要只抓表面笑点；如果你这轮已经决定给，就把动作真的落地，不要只口头答应；如果你的人设不适合温柔安抚，就不要硬软化。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function applyDirectTransferBridge(params: {
  replyText: string;
  intentAnalysis: DirectUserIntentAnalysis | null;
  decision: DirectCharacterDecision | null;
}) {
  const { replyText, intentAnalysis, decision } = params;
  const trimmedReply = replyText.trim();

  if (!trimmedReply || !intentAnalysis || !decision) {
    return replyText;
  }
  if (intentAnalysis.actionIntent !== 'request_transfer' || decision.requestedAmount == null) {
    return replyText;
  }
  if (TRANSFER_PROTOCOL_REGEX.test(trimmedReply)) {
    return replyText;
  }

  const hasGrantCue = EXPLICIT_GRANT_REGEX.test(trimmedReply);
  const hasRefuseCue = EXPLICIT_REFUSE_REGEX.test(trimmedReply);
  const hasHedgeCue = HEDGE_REGEX.test(trimmedReply);
  const hasInitiationConflict = !isTransferInitiationReplyConsistent('character_to_user', trimmedReply);

  if ((hasRefuseCue || hasInitiationConflict) && !hasGrantCue) {
    return replyText;
  }

  const shouldAppendProtocol =
    hasGrantCue
    || (decision.transferDisposition === 'lean_grant' && !hasHedgeCue)
    || (decision.transferReadiness >= 82 && !hasHedgeCue);

  if (!shouldAppendProtocol) {
    return replyText;
  }

  return `${trimmedReply}\n[transfer]${decision.requestedAmount.toFixed(2)}[/transfer]`;
}
