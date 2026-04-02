import type { ApiConfig, Character, ChatMessage } from '../../types';
import { streamTextWithConfig } from '../ai/runtimeClient';

export type TransferDecision = {
  decision: 'accept' | 'reject';
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

async function generateTransferDecisionText(options: {
  activeConfig: ApiConfig;
  prompt: string;
}) {
  let responseText = '';

  await streamTextWithConfig({
    activeConfig: options.activeConfig,
    messages: [{ role: 'system', content: options.prompt }],
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
    .map(message => `${message.role === 'user' ? userName : character.name}: ${message.text}`)
    .join('\n');

  const prompt = [
    '你现在只负责判断一个聊天角色是否会收下用户的转账。',
    `角色名：${character.name}`,
    `角色设定：${character.setting || '未提供'}`,
    `转账金额：${amount.toFixed(2)} 元`,
    '最近聊天：',
    compactHistory || '无',
    '',
    '请只返回 JSON，不要输出任何解释，也不要使用 Markdown 代码块。',
    '格式如下：{"decision":"accept","replyText":"一句不超过20字的自然回复"}',
    '规则：',
    '1. decision 只能是 accept 或 reject。',
    '2. replyText 必须像角色本人说的话，简短自然。',
    '3. 如果角色会收款就返回 accept，否则返回 reject。',
  ].join('\n');

  const result = await generateTransferDecisionText({
    activeConfig,
    prompt,
  });

  return parseDecision(result);
}
