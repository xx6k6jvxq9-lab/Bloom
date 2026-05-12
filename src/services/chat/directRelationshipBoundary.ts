import type {
  ApiConfig,
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  CoupleSpaceData,
  Mask,
  PerceptionSettings,
  WorldBookEntry,
} from '../../types';
import { generateQualityCheckedAssistantReply } from '../ai/outputQuality';
import { buildChatPrompt } from '../ai/prompts/builders/buildChatPrompt';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildTemporalContextPrompt } from '../relationship-time/buildTemporalContextPrompt';
import { buildChatSceneInput } from '../scene-inputs/buildChatSceneInput';
import type { DirectCharacterDecision } from './directCharacterDecision';
import type { DirectUserIntentAnalysis } from './intentAnalysis';
import { getLegacyTranslationParts } from './messageText';

const DIRECT_BOUNDARY_PROTOCOL_TOKEN = '[[DIRECT_BOUNDARY]]';

const HARD_INSULT_REGEX = /滚|去死|闭嘴|恶心|傻逼|废物|贱|神经病|脑残|滚远点|别来恶心我|你配吗/i;
const THREAT_REGEX = /弄死|整死|报复你|曝光你|毁了你|收拾你|别怪我/i;
const DISMISSIVE_REGEX = /别烦我|懒得理你|少管我|爱咋咋地|随便吧|别装了|离我远点|别缠着我|别碰我/i;
const CONTROLLING_REGEX = /现在就|立刻|马上|必须|你给我|听我的|不许|我命令你/i;
const HUMILIATION_REGEX = /你就这点本事|果然你就是|谁稀罕|你也配|你算什么|真下头|真可笑/i;
const APOLOGY_REGEX = /对不起|抱歉|别生气|我不是那个意思|我只是气话|刚才说重了/i;
const ASSISTANT_BOUNDARY_REGEX = /别再这样|到此为止|先冷静|我不想再重复|说话注意点|别拿这种语气|我不接受/i;

const SOFT_PERSONA_REGEX = /温柔|心软|包容|照顾|宠|哄|舍不得|偏爱|护着|在乎/i;
const PRIDE_PERSONA_REGEX = /自尊|体面|骄傲|高傲|不肯低头|嘴硬|要面子/i;
const GUARDED_PERSONA_REGEX = /克制|高冷|冷淡|疏离|理智|边界|戒备|谨慎|不好惹/i;
const VOLATILE_PERSONA_REGEX = /暴躁|易怒|冲动|炸毛|占有欲|控制欲|情绪化|较劲/i;
const DIRECT_PERSONA_REGEX = /直接|强势|不惯着|说翻脸就翻脸|不拐弯|不服软/i;

export type DirectRelationshipBoundaryDecision = 'none' | 'warn' | 'block';
export type DirectRelationshipBoundaryRisk = 'low' | 'medium' | 'high' | 'critical';

export type DirectRelationshipBoundaryAnalysis = {
  latestUserText: string;
  offenseScore: number;
  risk: DirectRelationshipBoundaryRisk;
  suggestedDecision: DirectRelationshipBoundaryDecision;
  allowedDecisions: DirectRelationshipBoundaryDecision[];
  cues: string[];
  closeness: 'low' | 'medium' | 'high';
  actionStyle: 'guarded' | 'steady' | 'indulgent' | 'tsundere';
};

export type DirectRelationshipBoundaryReplyResult = {
  reactionText: string;
  decision: DirectRelationshipBoundaryDecision | null;
  rawText: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function countRegexMatches(text: string, pattern: RegExp) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return text.match(new RegExp(pattern.source, flags))?.length ?? 0;
}

function getCharacterProfileText(character: Character) {
  const context = buildCharacterContext({ character });
  return [
    context.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
}

function getLatestUserText(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.isSystem && !message.isRecalled && !!message.text?.trim())
    ?.text
    ?.trim() || '';
}

function getRecentUserTexts(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user' && !message.isSystem && !message.isRecalled && !!message.text?.trim())
    .slice(-4)
    .map((message) => message.text.trim());
}

function getRecentAssistantTexts(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'model' && !message.isSystem && !message.isRecalled && !!message.text?.trim())
    .slice(-3)
    .map((message) => message.text.trim());
}

function buildBoundaryPersonaProfile(character: Character, directCharacterDecision: DirectCharacterDecision | null) {
  const personaText = getCharacterProfileText(character);
  const softness = countRegexMatches(personaText, SOFT_PERSONA_REGEX);
  const pride = countRegexMatches(personaText, PRIDE_PERSONA_REGEX);
  const guardedness = countRegexMatches(personaText, GUARDED_PERSONA_REGEX);
  const volatility = countRegexMatches(personaText, VOLATILE_PERSONA_REGEX);
  const directness = countRegexMatches(personaText, DIRECT_PERSONA_REGEX);

  return {
    softness,
    hardness: pride + guardedness + volatility + directness,
    closeness: directCharacterDecision?.relationshipCloseness || 'medium',
    actionStyle: directCharacterDecision?.actionStyle || 'steady',
  };
}

function formatRiskLabel(risk: DirectRelationshipBoundaryRisk) {
  switch (risk) {
    case 'critical':
      return '已经到了可能直接切断的边缘';
    case 'high':
      return '明显越界，需要正面划边界';
    case 'medium':
      return '有冲突感，但还没到关系状态变化';
    case 'low':
    default:
      return '暂时还只是普通情绪波动';
  }
}

function formatDecisionLabel(decision: DirectRelationshipBoundaryDecision) {
  switch (decision) {
    case 'warn':
      return '更像会当场警告或冷下去';
    case 'block':
      return '更像会当场切断并拉黑';
    case 'none':
    default:
      return '还没到需要关系级升级';
  }
}

export function analyzeDirectRelationshipBoundary(params: {
  character: Character;
  messages: ChatMessage[];
  intentAnalysis: DirectUserIntentAnalysis | null;
  directCharacterDecision: DirectCharacterDecision | null;
}) {
  const latestUserText = getLatestUserText(params.messages);
  if (!latestUserText) {
    return {
      latestUserText: '',
      offenseScore: 0,
      risk: 'low' as const,
      suggestedDecision: 'none' as const,
      allowedDecisions: ['none'] as DirectRelationshipBoundaryDecision[],
      cues: ['这一轮没有可判定的用户文本，不升级到关系边界判断。'],
      closeness: params.directCharacterDecision?.relationshipCloseness || 'medium',
      actionStyle: params.directCharacterDecision?.actionStyle || 'steady',
    };
  }

  const recentUserTexts = getRecentUserTexts(params.messages);
  const recentAssistantTexts = getRecentAssistantTexts(params.messages);
  const severeHits = countRegexMatches(latestUserText, HARD_INSULT_REGEX);
  const threatHits = countRegexMatches(latestUserText, THREAT_REGEX);
  const dismissiveHits = countRegexMatches(latestUserText, DISMISSIVE_REGEX);
  const controllingHits = countRegexMatches(latestUserText, CONTROLLING_REGEX);
  const humiliationHits = countRegexMatches(latestUserText, HUMILIATION_REGEX);
  const apologyHits = countRegexMatches(latestUserText, APOLOGY_REGEX);
  const recentNegativeHits = recentUserTexts.reduce((sum, text) => (
    sum
    + countRegexMatches(text, HARD_INSULT_REGEX)
    + countRegexMatches(text, THREAT_REGEX)
    + countRegexMatches(text, DISMISSIVE_REGEX)
  ), 0);
  const assistantBoundaryHits = recentAssistantTexts.reduce((sum, text) => (
    sum + countRegexMatches(text, ASSISTANT_BOUNDARY_REGEX)
  ), 0);
  const punctuationBurst = countRegexMatches(latestUserText, /[!?？！]{2,}/g);

  let offenseScore =
    severeHits * 6
    + threatHits * 7
    + dismissiveHits * 3
    + controllingHits * 2
    + humiliationHits * 4
    + Math.max(0, recentNegativeHits - 1)
    + assistantBoundaryHits * 2
    + punctuationBurst;

  if (params.intentAnalysis?.emotionTone === 'playful' && severeHits === 0 && threatHits === 0) {
    offenseScore -= 1;
  }
  if (apologyHits > 0) {
    offenseScore -= 2;
  }

  const persona = buildBoundaryPersonaProfile(params.character, params.directCharacterDecision);
  const closenessBuffer = persona.closeness === 'high' ? 2 : persona.closeness === 'medium' ? 1 : 0;
  const warnThreshold = clamp(5 - Math.min(2, persona.hardness) + Math.min(2, persona.softness), 3, 8);
  const blockThreshold = Math.max(
    warnThreshold + 2,
    clamp(
      10
        - Math.min(3, persona.hardness)
        + Math.min(3, persona.softness)
        + closenessBuffer
        + (persona.actionStyle === 'indulgent' ? 2 : 0)
        + (persona.actionStyle === 'tsundere' ? 1 : 0),
      7,
      14,
    ),
  );

  const repeatedDisrespect = assistantBoundaryHits > 0 && recentNegativeHits >= 2;
  const hardBlockSignal =
    threatHits > 0
    || (severeHits > 0 && (repeatedDisrespect || persona.hardness >= 3 || persona.closeness === 'low'));

  let suggestedDecision: DirectRelationshipBoundaryDecision = 'none';
  if (hardBlockSignal || offenseScore >= blockThreshold) {
    suggestedDecision = 'block';
  } else if (offenseScore >= warnThreshold) {
    suggestedDecision = 'warn';
  }

  const risk: DirectRelationshipBoundaryRisk =
    suggestedDecision === 'block'
      ? 'critical'
      : suggestedDecision === 'warn'
        ? 'high'
        : offenseScore >= Math.max(3, warnThreshold - 1)
          ? 'medium'
          : 'low';

  const allowedDecisions: DirectRelationshipBoundaryDecision[] =
    suggestedDecision === 'block'
      ? ['warn', 'block']
      : suggestedDecision === 'warn'
        ? ['none', 'warn']
        : ['none'];

  const cues = [
    severeHits > 0 ? '最新这句里有明显的人身攻击或粗暴驱赶。' : '',
    threatHits > 0 ? '最新这句里出现了威胁或报复意味。' : '',
    dismissiveHits > 0 ? '最新这句里有明确的嫌弃、驱赶或羞辱。' : '',
    controllingHits > 0 ? '最新这句里带着强压式命令口气。' : '',
    humiliationHits > 0 ? '最新这句更像是在故意压低、踩或羞辱角色。' : '',
    assistantBoundaryHits > 0 ? '最近几轮里，角色其实已经划过边界或提醒过一次。' : '',
    persona.actionStyle === 'guarded' ? '这个角色底色偏克制警惕，不会无限接这种语气。' : '',
    persona.actionStyle === 'indulgent' ? '这个角色平时更会让一步，所以更适合先看会不会警告而不是直接切断。' : '',
    persona.actionStyle === 'tsundere' ? '这个角色更容易先炸、先顶回去，但不一定第一下就真的拉黑。' : '',
    persona.closeness === 'high' ? '你们最近关系不算疏，真的走到拉黑需要更强触发。' : '',
    apologyHits > 0 ? '这句里也夹了缓和或道歉信号，所以不能机械判死。' : '',
    `本地边界分数约 ${Math.max(0, offenseScore)}，建议结果是“${formatDecisionLabel(suggestedDecision)}”。`,
  ].filter(Boolean);

  return {
    latestUserText,
    offenseScore: Math.max(0, offenseScore),
    risk,
    suggestedDecision,
    allowedDecisions,
    cues,
    closeness: persona.closeness,
    actionStyle: persona.actionStyle,
  };
}

export function buildFallbackDirectBoundaryReply(params: {
  character: Character;
  boundary: DirectRelationshipBoundaryAnalysis;
  decision: Exclude<DirectRelationshipBoundaryDecision, 'none'>;
}) {
  const displayName = params.character.remarkName?.trim() || params.character.name;
  if (params.decision === 'block') {
    switch (params.boundary.actionStyle) {
      case 'guarded':
        return `${displayName}冷了下来，只回了你一句：“到这里吧。你先别再来找我。”`;
      case 'indulgent':
        return `${displayName}这次没有再顺着你，只低声回你：“我没法继续这样跟你说下去。这次先到这里，我会把消息口关掉。”`;
      case 'tsundere':
        return `${displayName}像是被你彻底惹炸了，硬邦邦地回你：“行，就到这里。你这句我不接了。”`;
      case 'steady':
      default:
        return `${displayName}把语气收得很冷：“先到这里吧。你冷静下来之前，我不继续接这轮了。”`;
    }
  }

  switch (params.boundary.actionStyle) {
    case 'guarded':
      return `${displayName}语气冷了下来：“说话注意点。我不是来接你这种情绪的。再这样，我就不接了。”`;
    case 'indulgent':
      return `${displayName}明显压着火：“我现在是真的生气了。你可以跟我吵，但别拿这种话来伤我。”`;
    case 'tsundere':
      return `${displayName}被你惹得有点炸毛：“你再拿这种语气跟我说一句试试。我不是每次都会让着你。”`;
    case 'steady':
    default:
      return `${displayName}没有顺着你，只是把边界说得很清楚：“先把语气收一收。我不接受你这样跟我说话。”`;
  }
}

function isChineseLanguageName(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || '';
  if (!normalized) {
    return false;
  }

  return [
    '中文',
    '汉语',
    '普通话',
    '简体中文',
    '繁体中文',
    'chinese',
    'mandarin',
    'simplified chinese',
    'traditional chinese',
  ].includes(normalized);
}

function shouldRequestBoundaryTranslation(character: Character) {
  if (!character.autoTranslate) {
    return false;
  }

  if (character.replyLanguageMode === 'follow-user' || character.replyLanguageMode === 'chinese-with-native-flavor') {
    return false;
  }

  if (character.replyLanguageMode === 'native-first') {
    return !isChineseLanguageName(character.nativeLanguage);
  }

  if (character.replyLanguageMode === 'fixed') {
    return !isChineseLanguageName(character.fixedReplyLanguage);
  }

  return false;
}

function buildBoundaryTranslationPrompt(character: Character) {
  const targetLanguage = character.replyLanguageMode === 'fixed'
    ? (character.fixedReplyLanguage?.trim() || character.nativeLanguage?.trim() || '角色设定语言')
    : (character.nativeLanguage?.trim() || '角色母语');

  return [
    '## 双语输出',
    `本轮请先只输出角色实际会说的 ${targetLanguage} 原文。`,
    '如果正文不是简体中文，必须在正文全部结束后另起一行输出 `---TRANSLATION---`，然后给出与正文严格对应的简体中文翻译。',
    '如果正文拆成多条短消息，翻译也必须按相同顺序输出，并使用 `|||` 分隔。',
    '翻译部分只做自然中文转写，不要补充解释、语言标签或额外说明。',
  ].join('\n');
}

function hasLegacyTranslation(text: string) {
  return getLegacyTranslationParts(text).translation.trim().length > 0;
}

async function backfillBoundaryTranslation(options: {
  activeConfig: ApiConfig;
  reactionText: string;
}) {
  const { activeConfig, reactionText } = options;
  const { mainText, translation } = getLegacyTranslationParts(reactionText);
  if (!mainText.trim() || translation.trim()) {
    return reactionText;
  }

  const translated = await generateTextFromMessagesWithConfig({
    activeConfig,
    messages: [
      {
        role: 'system',
        content: [
          'Translate the following in-character reply into natural Simplified Chinese.',
          'Return only the translation text itself.',
          'If the original contains multiple short messages, keep the same order and separate each translated line with ` ||| `.',
          'Do not add notes, labels, or explanations.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: mainText,
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 180,
  });

  const normalizedTranslation = translated.trim();
  if (!normalizedTranslation) {
    return reactionText;
  }

  return `${mainText}\n\n---TRANSLATION---\n${normalizedTranslation}`;
}

function buildPerceptionPrompt(perception: PerceptionSettings | undefined) {
  return buildTemporalContextPrompt({
    perception,
    now: Date.now(),
  });
}

function toRuntimeHistoryMessage(message: ChatMessage) {
  if (message.isRecalled) {
    return null;
  }

  if (message.audioUrl) {
    return {
      role: message.role === 'user' ? 'user' as const : 'assistant' as const,
      content: message.audioTranscript?.trim()
        ? `[语音消息转写] ${message.audioTranscript.trim()}`
        : '[语音消息]',
    };
  }

  if (message.imageUrl) {
    return {
      role: message.role === 'user' ? 'user' as const : 'assistant' as const,
      content: message.text?.trim() ? `[图片消息] ${message.text.trim()}` : '[图片消息]',
    };
  }

  const text = (message.text || '').trim();
  if (!text) {
    return null;
  }

  return {
    role: message.role === 'user' ? 'user' as const : 'assistant' as const,
    content: text,
  };
}

function parseDirectBoundaryProtocol(text: string) {
  const tokenIndex = text.lastIndexOf(DIRECT_BOUNDARY_PROTOCOL_TOKEN);
  if (tokenIndex < 0) {
    return {
      reactionText: text.trim(),
      decision: null,
    };
  }

  const reactionText = text.slice(0, tokenIndex).trim();
  const protocolText = text.slice(tokenIndex + DIRECT_BOUNDARY_PROTOCOL_TOKEN.length).trim();
  const jsonStart = protocolText.indexOf('{');
  const jsonEnd = protocolText.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    return {
      reactionText,
      decision: null,
    };
  }

  try {
    const parsed = JSON.parse(protocolText.slice(jsonStart, jsonEnd + 1)) as {
      decision?: unknown;
    };
    return {
      reactionText,
      decision: typeof parsed.decision === 'string'
        ? parsed.decision as DirectRelationshipBoundaryDecision
        : null,
    };
  } catch {
    return {
      reactionText,
      decision: null,
    };
  }
}

export async function generateDirectRelationshipBoundaryReply(params: {
  activeConfig: ApiConfig;
  character: Character;
  allCharacters: Character[];
  userName: string;
  history: ChatMessage[];
  directChatHistory: ChatHistory;
  chatGroups?: ChatGroup[];
  masks?: Mask[];
  worldBook?: WorldBookEntry[];
  perception?: PerceptionSettings;
  coupleSpace?: CoupleSpaceData;
  latestUserText: string;
  draftReplyText: string;
  boundary: DirectRelationshipBoundaryAnalysis;
}) : Promise<DirectRelationshipBoundaryReplyResult | null> {
  if (params.boundary.allowedDecisions.length <= 1) {
    return null;
  }

  const shouldTranslate = shouldRequestBoundaryTranslation(params.character);
  const activeMask = (params.masks || []).find((mask) => mask.isActive && mask.linkedCharacters.includes(params.character.id)) || null;
  const activeWorldBooks = (params.worldBook || []).filter((worldBook) => {
    const isManuallySelected = !!params.character.activeWorldBookIds?.includes(worldBook.id);
    return isManuallySelected || (!!worldBook.isActive && (worldBook.isGlobal || worldBook.characterIds?.includes(params.character.id)));
  });
  const sceneInput = buildChatSceneInput({
    mode: 'chat',
    character: params.character,
    allCharacters: params.allCharacters,
    userName: params.userName,
    coupleSpace: params.coupleSpace,
    activeMask,
    activeWorldBooks,
    worldBooks: params.worldBook,
    perception: params.perception,
    perceptionPrompt: buildPerceptionPrompt(params.perception),
    directChatHistory: params.directChatHistory,
    chatGroups: params.chatGroups,
    latestUserText: params.latestUserText,
    worldBookQuery: params.latestUserText,
  });

  const eventUserMessage = [
    '【单聊边界判断】',
    `用户刚刚对你说：${params.latestUserText}`,
    params.draftReplyText.trim() ? `你原本的普通回复草稿：${params.draftReplyText.trim()}` : '',
    `本地边界读数：${formatRiskLabel(params.boundary.risk)}。`,
    `本地建议：${formatDecisionLabel(params.boundary.suggestedDecision)}。`,
    '本地线索：',
    ...params.boundary.cues.map((cue, index) => `${index + 1}. ${cue}`),
    '请按角色自己的人设、脾气、关系阶段和此刻情绪，决定这轮是保持正常、明确警告，还是直接切断。',
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = buildChatPrompt({
    ...sceneInput,
    sections: [
      ...(sceneInput.sections || []),
      '## 单聊边界事件',
      '这不是普通自由发挥的新聊天，而是在判断这句对话有没有真的把你惹翻。',
      '请只写角色会发给用户的真实聊天回复，像微信里会发出的短消息，不要分析流程，不要解释规则。',
      '如果你只是生气、冷下来、吵回去或明确划边界，但还没到切断聊天，decision 写 warn。',
      '只有当你按自己的人设真的会在这句之后直接拒收普通消息，decision 才写 block。',
      '如果这句虽然让你不舒服，但你还没升级到关系状态变化，decision 写 none。',
      `这轮允许的 decision 只有：${params.boundary.allowedDecisions.join(', ')}`,
      ...(shouldTranslate ? [buildBoundaryTranslationPrompt(params.character)] : []),
      `最后另起一行输出 ${DIRECT_BOUNDARY_PROTOCOL_TOKEN} {"decision":"..."}`,
      '你显示给用户看的正文、翻译和 decision 必须互相一致。',
    ],
  });

  const historyMessages = params.history
    .filter((message) => !message.isSystem)
    .slice(-10)
    .map(toRuntimeHistoryMessage)
    .filter((message): message is { role: 'user' | 'assistant'; content: string } => !!message);

  const qualityResult = await generateQualityCheckedAssistantReply({
    activeConfig: params.activeConfig,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: eventUserMessage },
    ],
    allowStructuredProtocols: true,
    temperature: Math.min(params.activeConfig.temperature ?? 0.7, 0.45),
  });

  if (!qualityResult.ok) {
    return null;
  }

  const parsed = parseDirectBoundaryProtocol(qualityResult.cleanedText);
  const reactionText = shouldTranslate && parsed.reactionText.trim() && !hasLegacyTranslation(parsed.reactionText)
    ? await backfillBoundaryTranslation({
        activeConfig: params.activeConfig,
        reactionText: parsed.reactionText,
      })
    : parsed.reactionText;

  return {
    reactionText,
    decision: parsed.decision,
    rawText: qualityResult.cleanedText,
  };
}
