import type { ApiConfig, Character, ChatMessage } from '../../types';
import { streamTextWithConfig } from '../ai/runtimeClient';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { formatTransferMessageForContext } from './transferContextText';
import {
  buildTransferReactionFactPrompt,
  buildTransferSettlementEventLine,
  isTransferReplyConsistentWithEvent,
  resolveTransferReplyTextForEvent,
  type TransferSettlementEvent,
} from './transferEventSemantics';

export type TransferDecision = {
  decision: 'accept' | 'reject';
  replyText: string;
};

export type TransferReactionResult = {
  replyText: string;
};

const extractJsonObject = (text: string) => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  return (objectMatch?.[0] ?? candidate).trim();
};

const normalizeReplyText = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

const parseDecision = (text: string): TransferDecision | null => {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as Partial<TransferDecision>;
    if (parsed.decision !== 'accept' && parsed.decision !== 'reject') {
      return null;
    }

    const replyText = normalizeReplyText(parsed.replyText);

    return {
      decision: parsed.decision,
      replyText,
    };
  } catch (error) {
    console.warn('[transfer-decision] Ignoring invalid JSON payload.', error);
    return null;
  }
};

async function generateTransferModelText(options: {
  activeConfig: ApiConfig;
  prompt: string;
}) {
  let responseText = '';

  await streamTextWithConfig({
    activeConfig: options.activeConfig,
    messages: [
      {
        role: 'system',
        content: '你是一个只负责完成当前任务的角色判断与角色回复生成器。严格遵守用户消息里的格式要求。',
      },
      { role: 'user', content: options.prompt },
    ],
    temperature: 0.2,
    onTextChunk: (chunkText) => {
      responseText += chunkText;
    },
  });

  const normalized = responseText.trim();
  if (!normalized) {
    throw new Error('转账判定结果为空');
  }

  return normalized;
}

function resolveTransferPersonaSummary(character: Character): string {
  const characterContext = buildCharacterContext({ character });
  const parts = [
    characterContext.corePersona,
    character.signature?.trim(),
    character.openingRemark?.trim(),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('\n') : '未提供';
}

function buildTransferDecisionPrompt(params: {
  character: Character;
  amount: number;
  compactHistory: string;
  personaSummary: string;
}): string {
  return [
    '你现在只负责判断一个聊天角色是否会收下用户的转账。',
    `角色名：${params.character.name}`,
    `角色设定：${params.personaSummary}`,
    `转账金额：${params.amount.toFixed(2)} 元`,
    '最近聊天：',
    params.compactHistory || '无',
    '',
    '请只返回 JSON，不要输出任何解释，也不要使用 Markdown 代码块。',
    '格式如下：{"decision":"accept","replyText":"角色在这个场景下会自然说出的回应"}',
    '规则：',
    '1. decision 只能是 accept 或 reject。',
    '2. replyText 必须像角色本人说的话，自然、贴合人设和当前气氛，不要写成系统说明。',
    '3. 这次只判断“你是否收下用户转来的这笔钱”，不要把转账方向看反。',
    '4. 如果 decision=accept，replyText 必须和“你已经收下用户的转账”一致，不能再说不收、退回、让对方把钱留着。',
    '5. 如果 decision=reject，replyText 必须和“你已经退回用户的转账”一致，不能再说已经收下或到账。',
  ].join('\n');
}

function buildTransferEventReactionPrompt(params: {
  character: Character;
  personaSummary: string;
  compactHistory: string;
  event: TransferSettlementEvent;
}): string {
  return [
    '你现在只负责生成角色在转账结果落地后的即时自然反应。',
    `角色名：${params.character.name}`,
    `角色设定：${params.personaSummary}`,
    `事件：${buildTransferSettlementEventLine(params.event)}`,
    buildTransferReactionFactPrompt(params.event),
    '最近聊天：',
    params.compactHistory || '无',
    '',
    '请只输出角色此刻会自然说出的内容，不要输出 JSON、协议、旁白、解释或系统提示。',
    '反应长度和语气由角色人设、关系和当前气氛自然决定，但必须像真实聊天。',
    '不要再次输出任何转账协议，例如 [transfer]、[转账]、TRANSFER|...|... 。',
  ].join('\n');
}

function formatCompactHistoryLine(
  message: ChatMessage,
  options: {
    userName: string;
    characterName: string;
  },
): string {
  const transferContextText = formatTransferMessageForContext(message, {
    userLabel: options.userName,
    characterLabel: options.characterName,
  });
  if (transferContextText) {
    return transferContextText;
  }

  return `${message.role === 'user' ? options.userName : options.characterName}: ${message.text}`;
}

export async function decideTransferOutcome(options: {
  activeConfig: ApiConfig;
  character: Character;
  amount: number;
  history: ChatMessage[];
  userName: string;
}) {
  const { activeConfig, character, amount, history, userName } = options;
  const compactHistory = history
    .slice(-6)
    .map(message => formatCompactHistoryLine(message, {
      userName,
      characterName: character.name,
    }))
    .join('\n');
  const personaSummary = resolveTransferPersonaSummary(character);
  const result = await generateTransferModelText({
    activeConfig,
    prompt: buildTransferDecisionPrompt({
      character,
      amount,
      compactHistory,
      personaSummary,
    }),
  });
  const parsed = parseDecision(result);
  if (!parsed) {
    return null;
  }

  const event: TransferSettlementEvent = {
    direction: 'user_to_character',
    status: parsed.decision === 'accept' ? 'received' : 'rejected',
    amount,
    userName,
    characterName: character.name,
  };
  if (!isTransferReplyConsistentWithEvent(event, parsed.replyText)) {
    console.warn('[transfer-decision] replyText contradicted transfer fact; dropping conflicting reply.', {
      decision: parsed.decision,
      replyText: parsed.replyText,
      eventLine: buildTransferSettlementEventLine(event),
    });
  }

  return {
    ...parsed,
    replyText: resolveTransferReplyTextForEvent(event, parsed.replyText),
  };
}

export async function generateTransferEventReaction(options: {
  activeConfig: ApiConfig;
  character: Character;
  history: ChatMessage[];
  event: TransferSettlementEvent;
}) {
  const { activeConfig, character, history, event } = options;
  const compactHistory = history
    .slice(-8)
    .map(message => formatCompactHistoryLine(message, {
      userName: event.userName,
      characterName: character.name,
    }))
    .join('\n');
  const personaSummary = resolveTransferPersonaSummary(character);
  const replyText = (await generateTransferModelText({
    activeConfig,
    prompt: buildTransferEventReactionPrompt({
      character,
      personaSummary,
      compactHistory,
      event,
    }),
  })).trim();
  if (!isTransferReplyConsistentWithEvent(event, replyText)) {
    console.warn('[transfer-reaction] reply contradicted transfer event; dropping conflicting reply.', {
      replyText,
      eventLine: buildTransferSettlementEventLine(event),
    });
  }

  return {
    replyText: resolveTransferReplyTextForEvent(event, replyText),
  } satisfies TransferReactionResult;
}
