import type {
  ApiConfig,
  AppSettings,
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  CoupleSpaceData,
  Mask,
  PerceptionSettings,
  WorldBookEntry,
} from '../../types';
import { generateQualityCheckedAssistantReply } from '../../services/ai/outputQuality';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { generateTextFromMessagesWithConfig } from '../../services/ai/runtimeClient';
import { buildChatSceneInput } from '../../services/scene-inputs/buildChatSceneInput';
import { buildTemporalContextPrompt } from '../../services/relationship-time/buildTemporalContextPrompt';
import { getLegacyTranslationParts } from '../../services/chat/messageText';

const REL_EVENT_PROTOCOL_TOKEN = '[[REL_EVENT]]';

export type RelationshipEventDecision =
  | 'accept'
  | 'reject'
  | 'reject_and_block'
  | 'counter_request'
  | 'counter_block'
  | 'no_counter_block'
  | 'send_request'
  | 'wait_for_user'
  | 'none';

export type RelationshipEventKind =
  | 'user_blocked_character'
  | 'user_unblocked_character'
  | 'user_sent_friend_request'
  | 'user_accepted_character_request'
  | 'user_rejected_character_request';

export type RelationshipEventReplyResult = {
  reactionText: string;
  decision: RelationshipEventDecision | null;
  requestMessage?: string;
  rawText: string;
};

type GenerateRelationshipEventReplyParams = {
  settings: AppSettings;
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
  event: {
    kind: RelationshipEventKind;
    note?: string;
  };
};

function buildRelationshipEventSpec(event: GenerateRelationshipEventReplyParams['event']) {
  switch (event.kind) {
    case 'user_blocked_character':
      return {
        userMessage:
          '【关系事件】用户刚刚把你拉黑了。这不是普通聊天输入，而是刚发生的关系动作。请你只用角色口吻做出当下反应。',
        allowedDecisions: ['counter_block', 'no_counter_block', 'send_request'] as RelationshipEventDecision[],
        instruction:
          '如果你觉得自己会把对方也拉黑，decision 写 counter_block；如果只是表达情绪但不反拉黑，decision 写 no_counter_block；如果你虽然生气但还是想主动递一条好友申请，decision 写 send_request，并填写 requestMessage。',
      };
    case 'user_unblocked_character':
      return {
        userMessage:
          '【关系事件】用户刚刚把你从黑名单里放了出来。这不是普通聊天输入，而是刚发生的关系动作。请你只用角色口吻做出当下反应。',
        allowedDecisions: ['send_request', 'wait_for_user'] as RelationshipEventDecision[],
        instruction:
          '如果你会主动再递一条好友申请，decision 写 send_request，并填写 requestMessage；如果你只是表态但暂时不主动申请，decision 写 wait_for_user。',
      };
    case 'user_sent_friend_request':
      return {
        userMessage:
          `【关系事件】用户刚刚向你发来一条好友申请，附言是：${event.note || '想把你加回来。'}。这不是普通聊天输入，而是刚发生的关系动作。请你只用角色口吻做出当下反应。`,
        allowedDecisions: ['accept', 'reject', 'reject_and_block', 'counter_request'] as RelationshipEventDecision[],
        instruction:
          '如果你愿意直接通过，decision 写 accept；如果你拒绝但不反拉黑，decision 写 reject；如果你拒绝并决定顺手把对方拉黑，decision 写 reject_and_block；如果你不直接通过，而是想反过来递一条申请让对方来收，decision 写 counter_request，并填写 requestMessage。',
      };
    case 'user_accepted_character_request':
      return {
        userMessage:
          '【关系事件】用户刚刚通过了你发出的好友申请。请你只用角色口吻做出当下反应。',
        allowedDecisions: ['none'] as RelationshipEventDecision[],
        instruction: 'decision 固定写 none。',
      };
    case 'user_rejected_character_request':
      return {
        userMessage:
          '【关系事件】用户刚刚拒绝了你发出的好友申请。请你只用角色口吻做出当下反应。',
        allowedDecisions: ['none', 'send_request'] as RelationshipEventDecision[],
        instruction: '如果你决定先停下，decision 写 none；如果你还想继续递下一条好友申请，decision 写 send_request，并填写这一次新的 requestMessage。',
      };
    default:
      return {
        userMessage: '【关系事件】请根据刚发生的关系动作做出角色反应。',
        allowedDecisions: ['none'] as RelationshipEventDecision[],
        instruction: 'decision 固定写 none。',
      };
  }
}

function buildPerceptionPrompt(perception: PerceptionSettings | undefined) {
  return buildTemporalContextPrompt({
    perception,
    now: Date.now(),
  });
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

function shouldRequestRelationshipTranslation(character: Character) {
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

function buildRelationshipTranslationPrompt(character: Character) {
  const targetLanguage = character.replyLanguageMode === 'fixed'
    ? (character.fixedReplyLanguage?.trim() || character.nativeLanguage?.trim() || '角色设定语言')
    : (character.nativeLanguage?.trim() || '角色母语');

  return [
    '## 双语输出',
    `本轮请先只输出角色实际会说的 ${targetLanguage} 原文。`,
    '如果正文不是简体中文，必须在正文全部结束后另起一行输出 `---TRANSLATION---`，然后给出与正文严格对应的简体中文翻译。',
    '如果正文拆成多句短消息，翻译也必须按相同顺序给出，并使用 `|||` 分隔。',
    '翻译部分只做自然中文转写，不要补充解释、注释、语言标签、括号说明或额外寒暄。',
  ].join('\n');
}

function hasLegacyTranslation(text: string) {
  return getLegacyTranslationParts(text).translation.trim().length > 0;
}

async function backfillRelationshipTranslation(options: {
  activeConfig: ApiConfig | null;
  reactionText: string;
}) {
  const { activeConfig, reactionText } = options;
  if (!activeConfig) {
    return reactionText;
  }

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
          'Do not add notes, quotes, labels, or explanations.',
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

function parseRelationshipProtocol(text: string) {
  const tokenIndex = text.lastIndexOf(REL_EVENT_PROTOCOL_TOKEN);
  if (tokenIndex < 0) {
    return {
      reactionText: text.trim(),
      decision: null,
      requestMessage: undefined,
    };
  }

  const reactionText = text.slice(0, tokenIndex).trim();
  const protocolText = text.slice(tokenIndex + REL_EVENT_PROTOCOL_TOKEN.length).trim();
  const jsonStart = protocolText.indexOf('{');
  const jsonEnd = protocolText.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    return {
      reactionText,
      decision: null,
      requestMessage: undefined,
    };
  }

  try {
    const parsed = JSON.parse(protocolText.slice(jsonStart, jsonEnd + 1)) as {
      decision?: unknown;
      requestMessage?: unknown;
    };
    return {
      reactionText,
      decision: typeof parsed.decision === 'string' ? parsed.decision as RelationshipEventDecision : null,
      requestMessage: typeof parsed.requestMessage === 'string' ? parsed.requestMessage.trim() || undefined : undefined,
    };
  } catch {
    return {
      reactionText,
      decision: null,
      requestMessage: undefined,
    };
  }
}

export async function generateRelationshipEventReply(
  params: GenerateRelationshipEventReplyParams,
): Promise<RelationshipEventReplyResult | null> {
  const activeConfig = resolveSceneTextApiConfig({
    settings: params.settings,
    scene: 'single-chat',
    characterId: params.character.id,
  }).runtimeConfig;

  if (!activeConfig) {
    return null;
  }

  const eventSpec = buildRelationshipEventSpec(params.event);
  const shouldTranslate = shouldRequestRelationshipTranslation(params.character);
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
    latestUserText: eventSpec.userMessage,
    worldBookQuery: eventSpec.userMessage,
  });

  const systemPrompt = buildChatPrompt({
    ...sceneInput,
    sections: [
      ...(sceneInput.sections || []),
      '## 关系事件规则',
      '你现在收到的不是普通聊天，而是一条刚发生的关系事件。',
      '请只写角色本人此刻会说出口的话，像真实聊天一样，不要解释规则，不要分析流程，不要写旁白总结。',
      '反应控制在 1 到 3 句短消息的长度内，可以有情绪，但不要变成系统播报。',
      ...(shouldTranslate ? [buildRelationshipTranslationPrompt(params.character)] : []),
      eventSpec.instruction,
      `最后另起一行输出 ${REL_EVENT_PROTOCOL_TOKEN} {"decision":"...","requestMessage":"..."}`,
      '如果这个事件不需要 requestMessage，就不要写这个字段。',
      `decision 只能从这几个值里选：${eventSpec.allowedDecisions.join(', ')}`,
      '你显示给用户看的正文、翻译和 decision 必须互相一致，不要正文像是同意，但 decision 却写成拒绝。',
    ],
  });

  const historyMessages = params.history
    .filter((message) => !message.isSystem)
    .slice(-10)
    .map(toRuntimeHistoryMessage)
    .filter((message): message is { role: 'user' | 'assistant'; content: string } => !!message);

  const qualityResult = await generateQualityCheckedAssistantReply({
    activeConfig,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: eventSpec.userMessage },
    ],
    allowStructuredProtocols: true,
    temperature: Math.min(activeConfig.temperature ?? 0.7, 0.45),
  });

  if (!qualityResult.ok) {
    return null;
  }

  const parsed = parseRelationshipProtocol(qualityResult.cleanedText);
  const reactionText = shouldTranslate && parsed.reactionText.trim() && !hasLegacyTranslation(parsed.reactionText)
    ? await backfillRelationshipTranslation({
        activeConfig,
        reactionText: parsed.reactionText,
      })
    : parsed.reactionText;
  return {
    reactionText,
    decision: parsed.decision,
    requestMessage: parsed.requestMessage,
    rawText: qualityResult.cleanedText,
  };
}
