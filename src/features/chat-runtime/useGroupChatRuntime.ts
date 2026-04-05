import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ApiConfig, Character, ChatMessage } from '../../types';
import { streamTextWithConfig, type RuntimeChatMessage } from '../../services/ai/runtimeClient';
import { buildGroupChatPrompt } from '../../services/ai/prompts/builders/buildGroupChatPrompt';
import { buildGroupChatSceneInput } from '../../services/scene-inputs/buildGroupChatSceneInput';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { useSessionRuntimeCore } from './useSessionRuntimeCore';

type UseGroupChatRuntimeArgs = {
  members: Character[];
  groupMeta?: {
    lastMessage?: string;
    lastTime?: number;
  };
  history: ChatMessage[];
  setHistory: Dispatch<SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: (value: string) => void;
  replyingTo: ChatMessage['replyTo'] | null;
  setReplyingTo: (value: ChatMessage['replyTo'] | null) => void;
  userName: string;
  activeConfig?: ApiConfig;
};

type UseGroupChatRuntimeResult = {
  isLoading: boolean;
  error: string | null;
  sendText: () => Promise<void>;
  sendImageMessage: (base64String: string) => Promise<void>;
  sendLocationMessage: (location: { name: string; address?: string; isVirtual?: boolean }) => Promise<void>;
  maybeOpenScene: () => Promise<void>;
};

const EXTRA_SPEAKER_KEYWORDS = [
  '\u5176\u4ed6\u4eba',
  '\u522b\u4eba',
  '\u6362\u4e2a\u4eba',
  '\u53e6\u4e00\u4e2a\u4eba',
  '\u518d\u6765\u4e00\u4e2a',
  '\u518d\u8bf4\u4e00\u53e5',
];

const MENTION_REGEX = new RegExp('@([^\\s@,\\uFF0C\\u3002\\uFF01\\uFF1F!?]+)', 'g');

function wantsAnotherSpeaker(text: string): boolean {
  return EXTRA_SPEAKER_KEYWORDS.some((keyword) => text.includes(keyword));
}

function buildCharacterEvidence(character: Character): string {
  return [
    character.corePersona,
    character.setting,
    character.expressionStyle,
    character.signature,
    character.sceneHints?.groupChat,
  ]
    .filter((value): value is string => !!value?.trim())
    .join('\n')
    .toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferGroupSpeakerWeight(character: Character, userText: string): number {
  const evidence = buildCharacterEvidence(character);
  const normalizedUserText = userText.toLowerCase();
  let score = 1;

  if (includesAny(evidence, ['带头', '主导', '组织', '安排', '掌控'])) {
    score += 1.2;
  }

  if (includesAny(evidence, ['毒舌', '爱接梗', '起哄', '嘴硬', '爱逗', '插嘴'])) {
    score += 1;
  }

  if (includesAny(evidence, ['护短', '护着', '偏心', '占有'])) {
    score += includesAny(normalizedUserText, ['你们', '他', '她']) ? 0.9 : 0.4;
  }

  if (includesAny(evidence, ['话少', '冷淡', '克制', '安静', '沉默'])) {
    score -= 0.5;
  }

  return Math.max(score, 0.2);
}

function inferReadableSpeakerWeight(character: Character, userText: string): number {
  const evidence = buildCharacterEvidence(character);
  const normalizedUserText = userText.toLowerCase();
  let score = 1;

  if (includesAny(evidence, ['带头', '主导', '组织', '安排', '掌控'])) {
    score += 1.2;
  }

  if (includesAny(evidence, ['毒舌', '爱接梗', '起哄', '嘴硬', '爱逗', '插嘴', '吐槽'])) {
    score += 1;
  }

  if (includesAny(evidence, ['护短', '护着', '偏心', '占有'])) {
    score += includesAny(normalizedUserText, ['你们', '他', '她']) ? 0.9 : 0.4;
  }

  if (includesAny(evidence, ['话少', '冷淡', '克制', '安静', '沉默'])) {
    score -= 0.5;
  }

  return Math.max(score, 0.2);
}

function buildRuntimeMessages(params: {
  systemPrompt: string;
  history: ChatMessage[];
  mode: 'reply' | 'invited' | 'opening';
}): RuntimeChatMessage[] {
  const historyMessages = params.history
    .filter((message) => !message.isSystem)
    .map<RuntimeChatMessage>((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.text,
    }));

  const instructionByMode: Record<'reply' | 'invited' | 'opening', string> = {
    reply: 'Reply as the current speaker using short live group-chat beats. One short bubble is often enough, but 2 to 3 short bubbles are allowed when the rhythm needs them. Prefer short bubbles over one complete paragraph.',
    invited: 'Reply as the current speaker using short live group-chat beats. You were just invited or @mentioned to speak, so you may answer briefly, selectively, and in 1 to 3 short bubbles instead of one full answer.',
    opening: 'Send a brief opening as the current speaker using short live group-chat beats. Keep it natural, brief, and closer to short bubbles than one complete paragraph.',
  };

  return [
    { role: 'system', content: params.systemPrompt },
    ...historyMessages,
    { role: 'user', content: instructionByMode[params.mode] },
  ];
}

function normalizeGeneratedReply(text: string, speaker: Character): string {
  const aliases = Array.from(
    new Set([speaker.name, speaker.remarkName?.trim()].filter((value): value is string => !!value)),
  );

  let normalized = text.trim();

  for (const alias of aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(`^${escapedAlias}\\s*[:\\uFF1A]\\s*`), '').trim();
  }

  normalized = normalized.replace(/^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g, '').trim();
  return normalized;
}

function buildFailureText(detail: string): string {
  return `[\u7cfb\u7edf\u63d0\u793a] \u7fa4\u804a\u56de\u590d\u5931\u8d25\uff1a${detail}`;
}

function getMessageMainText(message: ChatMessage): string {
  const text = message.text || '';
  if (message.role === 'model') {
    const senderPrefix = /^[^:]+:\s*/;
    return text.replace(senderPrefix, '').trim();
  }
  return text.trim();
}

function buildReplyPreviewPayload(message: ChatMessage, fallbackAuthor: string): NonNullable<ChatMessage['replyTo']> {
  const mainText = getMessageMainText(message);
  return {
    text: mainText || message.text,
    role: message.role,
    timestamp: message.timestamp,
    authorLabel: message.role === 'user' ? fallbackAuthor : fallbackAuthor,
    preview: mainText.replace(/\r?\n+/g, ' ').trim().slice(0, 120) || '[消息]',
  };
}

function parseActionCue(segment: string): {
  kind: 'normal' | 'reply' | 'notice' | 'sticker';
  content: string;
  replyTargetName?: string;
} {
  const trimmed = segment.trim();
  const replyMatch = trimmed.match(/^\[(?:reply|reply to)\s*:\s*([^\]]+)\]\s*(.*)$/i);
  if (replyMatch) {
    return {
      kind: 'reply',
      replyTargetName: replyMatch[1].trim(),
      content: replyMatch[2].trim(),
    };
  }

  const noticeMatch = trimmed.match(/^\[(?:notice|system)\]\s*(.*)$/i);
  if (noticeMatch) {
    return {
      kind: 'notice',
      content: noticeMatch[1].trim(),
    };
  }

  const stickerMatch = trimmed.match(/^\[(?:sticker|image)\]\s*(.*)$/i);
  if (stickerMatch) {
    return {
      kind: 'sticker',
      content: stickerMatch[1].trim(),
    };
  }

  return {
    kind: 'normal',
    content: trimmed,
  };
}

function splitLongChatClause(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= 22) {
    return [normalized];
  }

  const commaParts = normalized
    .split(/(?<=[\uFF0C,])/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (commaParts.length <= 1) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of commaParts) {
    const nextValue = current ? `${current}${part}` : part;
    if (current && nextValue.length > 24) {
      chunks.push(current.trim());
      current = part;
      continue;
    }

    current = nextValue;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitRhythmicChatClause(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized
    .split(/(?<=[\uFF0C,])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    const cleanPart = part.trim();
    const currentLength = current.replace(/[\uFF0C,\s]/g, '').length;
    const partLength = cleanPart.replace(/[\uFF0C,\s]/g, '').length;
    const shouldBreak =
      !!current && (
        currentLength >= 7
        || partLength >= 9
        || /[?？!！]$/.test(current)
        || /^(快|先|那|行|走|别|要不|不然|不过|所以|然后|哥哥|搭档|行吧|等等|哦|欸|诶)/.test(cleanPart)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = cleanPart;
      continue;
    }

    current = current ? `${current}${cleanPart}` : cleanPart;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitReadableRhythmicChatClause(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized
    .split(/(?<=[\uFF0C,])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    const cleanPart = part.trim();
    const currentLength = current.replace(/[\uFF0C,\s]/g, '').length;
    const partLength = cleanPart.replace(/[\uFF0C,\s]/g, '').length;
    const shouldBreak =
      !!current && (
        currentLength >= 7
        || partLength >= 9
        || /[?？!！]$/.test(current)
        || /^(快|先|那|行|走|别|要不|不然|不过|所以|然后|哥哥|搭档|行吧|等等|哦|欸|诶|不是|得了|行了)/.test(cleanPart)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = cleanPart;
      continue;
    }

    current = current ? `${current}${cleanPart}` : cleanPart;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitByChatActionBeats(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const candidateParts = normalized
    .split(/(?<=[。！？!?；;…]+|[，,])\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (candidateParts.length <= 1) {
    return [normalized];
  }

  const isShortReactionBubble = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^(嗯|嗯嗯|嗯哼|哦|喔|哈|呵|欸|诶|哎|行|滚|操|草|？|\?|……|…)$/.test(trimmed)) {
      return true;
    }
    return trimmed.length <= 6 && /[?？!！…]+$/.test(trimmed);
  };

  const isShortEvaluationBubble = (value: string) => {
    const trimmed = value.trim().replace(/[。！？!?，,；;…]+$/u, '');
    if (!trimmed || trimmed.length > 10) return false;
    return /^(你正常点|真服了|我觉得很可爱|没眼看|你有病吧|别太离谱|差不多得了|少来这套|还.+呢)$/.test(trimmed);
  };

  const isShortAddressingBubble = (value: string) => {
    const trimmed = value.trim().replace(/[。！？!?，,；;…]+$/u, '');
    if (!trimmed || trimmed.length > 12) return false;
    return /^(小回|张白|大鹅|搭档|哥|姐姐|哥哥|你)[^，。！？!?]*$/.test(trimmed);
  };

  const chunks: string[] = [];
  let current = '';

  for (const part of candidateParts) {
    const cleanPart = part.trim();
    const currentLength = current.replace(/\s/g, '').length;
    const partLength = cleanPart.replace(/\s/g, '').length;
    const actionFirst = isShortReactionBubble(cleanPart) || isShortEvaluationBubble(cleanPart) || isShortAddressingBubble(cleanPart);
    const currentIsAction = isShortReactionBubble(current) || isShortEvaluationBubble(current) || isShortAddressingBubble(current);
    const shouldBreak =
      !!current && (
        actionFirst
        || currentIsAction
        || currentLength >= 16
        || (currentLength >= 9 && partLength >= 9)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = cleanPart;
      continue;
    }

    current = current ? `${current}${cleanPart}` : cleanPart;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitByNaturalChatBeats(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const candidateParts = normalized
    .split(/(?<=[\u3002\uFF01\uFF1F!?\uFF1B;…]+|[\uFF0C,])\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (candidateParts.length <= 1) {
    return [normalized];
  }

  const stripEndingPunctuation = (value: string) => value.trim().replace(/[\u3002\uFF01\uFF1F!?\uFF0C,\uFF1B;…]+$/u, '');

  const isShortReactionBubble = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^(?:\u55ef|\u55ef\u55ef|\u55ef\u54fc|\u54e6|\u5594|\u54c8|\u5475|\u6b38|\u8bf6|\u54ce|\u884c|\u6eda|\u64cd|\u8349|\uFF1F|\?|\u2026\u2026|\u2026)$/.test(trimmed)) {
      return true;
    }
    return trimmed.length <= 6 && /[\uFF1F?!\u2026]+$/.test(trimmed);
  };

  const isShortEvaluationBubble = (value: string) => {
    const trimmed = stripEndingPunctuation(value);
    if (!trimmed || trimmed.length > 10) return false;
    return /^(?:\u4f60\u6b63\u5e38\u70b9|\u771f\u670d\u4e86|\u6211\u89c9\u5f97\u5f88\u53ef\u7231|\u6ca1\u773c\u770b|\u4f60\u6709\u75c5\u5427|\u522b\u592a\u79bb\u8c31|\u5dee\u4e0d\u591a\u5f97\u4e86|\u5c11\u6765\u8fd9\u5957|\u8fd8.+\u5462)$/.test(trimmed);
  };

  const isShortAddressingBubble = (value: string) => {
    const trimmed = stripEndingPunctuation(value);
    if (!trimmed || trimmed.length > 12) return false;
    return /^(?:\u5c0f\u56de|\u5f20\u767d|\u5927\u9e45|\u642d\u6863|\u54e5|\u59d0\u59d0|\u54e5\u54e5|\u4f60)[^\uFF0C,\u3002\uFF01\uFF1F!?]*$/.test(trimmed);
  };

  const chunks: string[] = [];
  let current = '';

  for (const part of candidateParts) {
    const cleanPart = part.trim();
    const currentLength = current.replace(/\s/g, '').length;
    const partLength = cleanPart.replace(/\s/g, '').length;
    const actionFirst = isShortReactionBubble(cleanPart) || isShortEvaluationBubble(cleanPart) || isShortAddressingBubble(cleanPart);
    const currentIsAction = isShortReactionBubble(current) || isShortEvaluationBubble(current) || isShortAddressingBubble(current);
    const shouldBreak =
      !!current && (
        actionFirst
        || currentIsAction
        || currentLength >= 16
        || (currentLength >= 9 && partLength >= 9)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = cleanPart;
      continue;
    }

    current = current ? `${current}${cleanPart}` : cleanPart;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function normalizeShortBubbleEnding(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return normalized;
  }

  const stripped = normalized.replace(/[\u3002\uFF01\uFF1F!?\uFF0C,\uFF1B;…]+$/u, '');
  const bareLength = stripped.length;
  const isShortChatBeat = bareLength <= 12;
  const looksLikeNaturalShortMessage =
    /^(?:[\u4e00-\u9fffA-Za-z0-9]+(?:[\u4e00-\u9fffA-Za-z0-9\s]+)?|[\u4e00-\u9fffA-Za-z0-9]+[\u2026]+)$/.test(stripped)
    && !/^(?:为什么|凭什么|怎么|谁|哪|什么|真的假的|是不是|要不要|行不行)/.test(stripped);

  const shouldDropEnding =
    isShortChatBeat
    && looksLikeNaturalShortMessage
    && (
      /^(?:我在|你继续|行啊|来啊|不是吧|真服了|你正常点|还奖励呢|小回别真信她|大鹅你少拱火|没眼看|我觉得很可爱|滚|行|呵|哈|嗯|嗯嗯|哦|喔|诶|欸)/.test(stripped)
      || bareLength <= 6
    );

  if (shouldDropEnding) {
    return stripped;
  }

  return normalized;
}

function normalizeChatMessageEnding(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return normalized;
  }

  const stripped = normalized.replace(/[\u3002\uFF01\uFF1F!?\uFF0C,\uFF1B;\u2026]+$/u, '');
  if (!stripped) {
    return normalized;
  }

  const bareLength = stripped.length;
  const endsWithQuestionLike = /[\uFF1F?]$/.test(normalized);
  const endsWithExclaimLike = /[\uFF01!]$/.test(normalized);
  const hasPauseDots = /[\u2026]+$/.test(normalized);

  const isChallengeOrQuestion =
    /^(?:\u4e3a\u4ec0\u4e48|\u51ed\u4ec0\u4e48|\u600e\u4e48|\u8c01|\u54ea|\u4ec0\u4e48|\u771f\u7684\u5047\u7684|\u662f\u4e0d\u662f|\u8981\u4e0d\u8981|\u884c\u4e0d\u884c|\u51ed\u5565)/.test(stripped);

  const isStrongEmotion =
    /^(?:\u5475|\u54c8|\u7b11\u6b7b|\u6eda|\u64cd|\u8349|\u4f60\u6709\u75c5\u5427|\u771f\u79bb\u8c31|\u79bb\u8c31)/.test(stripped);

  const looksLikeChatMessage =
    /^(?:[\u4e00-\u9fffA-Za-z0-9]+(?:[\u4e00-\u9fffA-Za-z0-9\s]+)*)$/.test(stripped)
    && bareLength <= 30;

  const isNaturalStatementLead =
    /^(?:\u90a3|\u8fd9|\u963f\u59e8|\u6211\u4eec|\u5979|\u4ed6|\u4f60|\u6211|\u8fd9\u4e2a|\u8fd9\u79cd|\u5176\u5b9e|\u53cd\u6b63|\u8981\u6211\u8bf4|\u770b\u8d77\u6765|\u542c\u8d77\u6765|\u611f\u89c9|\u90a3\u5c31|\u662f\u8fd9\u6837|\u8bf4\u767d\u4e86|\u6211\u89c9\u5f97|\u6211\u770b|\u6211\u60f3)/.test(stripped);

  const isNaturalConversationalStatement =
    /^(?:\u90a3\u5c31|\u8fd9\u4e2a|\u6211\u4eec|\u5979\u53ef\u80fd|\u4ed6\u53ef\u80fd|\u6211\u5148|\u6211\u770b|\u6211\u89c9\u5f97|\u6211\u60f3|\u5176\u5b9e|\u53cd\u6b63|\u5c31\u662f|\u672c\u6765|\u5e94\u8be5|\u53ef\u80fd\u662f|\u542c\u8d77\u6765|\u770b\u8d77\u6765|\u8bf4\u767d\u4e86|\u6211\u4eec\u7fa4\u91cc|\u7fa4\u91cc\u6709\u4e2a|\u8fd9\u4e8b|\u8fd9\u8bdd|\u8fd9\u79cd\u8bdd)/.test(stripped);

  const hasSarcasmOrPressureTone =
    /(?:\u5462|\u5427|\u54e6|\u5466)$/.test(stripped)
    && /^(?:\u4f60|\u521a\u624d|\u8fd8|\u5c31|\u600e\u4e48|\u539f\u6765|\u90a3\u4f60)/.test(stripped);

  const needsPauseFeeling =
    /(?:\u7136\u540e|\u4e0d\u8fc7|\u4f46\u662f|\u800c\u4e14|\u6240\u4ee5).{8,}$/.test(stripped);

  const isCompactChatBeat =
    bareLength <= 12
    && /^(?:\u6211\u5728|\u4f60\u7ee7\u7eed|\u884c\u554a|\u6765\u554a|\u4e0d\u662f\u5427|\u771f\u670d\u4e86|\u4f60\u6b63\u5e38\u70b9|\u8fd8\u5956\u52b1\u5462|\u5c0f\u56de\u522b\u771f\u4fe1\u5979|\u5927\u9e45\u4f60\u5c11\u62f1\u706b|\u6ca1\u773c\u770b|\u6211\u89c9\u5f97\u5f88\u53ef\u7231|\u4f60\u8bf4|\u4f60\u6765)$/.test(stripped);

  const shouldDropEnding =
    !endsWithQuestionLike
    && !endsWithExclaimLike
    && !hasPauseDots
    && !isChallengeOrQuestion
    && !isStrongEmotion
    && !hasSarcasmOrPressureTone
    && !needsPauseFeeling
    && (
      isCompactChatBeat
      || (looksLikeChatMessage && isNaturalStatementLead)
      || (looksLikeChatMessage && isNaturalConversationalStatement)
      || (looksLikeChatMessage && bareLength <= 6)
    );

  if (shouldDropEnding) {
    return stripped;
  }

  return normalized;
}

function splitGroupReplyIntoMessages(text: string, speaker: Character, baseTimestamp = Date.now()): ChatMessage[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const paragraphParts = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const sentenceRegex = /[^\u3002\uFF01\uFF1F!?;\uFF1B\n]+(?:[\u3002\uFF01\uFF1F!?;\uFF1B]+)?/g;

  const sentenceParts = paragraphParts.length > 1
    ? paragraphParts
        .flatMap((part) => (
          part.match(sentenceRegex)
            ?.map((sentence) => sentence.trim())
            .filter(Boolean)
          ?? [part]
        ))
    : (
      normalized.match(sentenceRegex)
        ?.map((part) => part.trim())
        .filter(Boolean)
      ?? [normalized]
    );

  const parts = (sentenceParts.length > 0 ? sentenceParts : [normalized])
    .flatMap((part) => splitLongChatClause(part))
    .flatMap((part) => splitByNaturalChatBeats(part))
    .map((part) => normalizeChatMessageEnding(part))
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, 3);

  console.info('[group-chat] split reply parts', {
    speakerId: speaker.id,
    speakerName: speaker.name,
    original: normalized,
    partCount: parts.length,
    parts,
  });

  return parts.map((part, index) => {
    const cue = parseActionCue(part);
    return {
      role: 'model' as const,
      text: cue.kind === 'notice' ? `[notice] ${cue.content}` : `${speaker.name}: ${part}`,
      timestamp: baseTimestamp + index,
      senderCharacterId: speaker.id,
      isSystem: cue.kind === 'notice' ? true : undefined,
    };
  });
}

export function useGroupChatRuntime({
  members,
  groupMeta,
  history,
  setHistory,
  input,
  setInput,
  replyingTo,
  setReplyingTo,
  userName,
  activeConfig,
}: UseGroupChatRuntimeArgs): UseGroupChatRuntimeResult {
  const { isLoading, error, setError, activeGenerationIdRef, runGeneration } = useSessionRuntimeCore();
  const { getCharacterByName } = createCharacterDirectory({ characters: members });
  const hasActiveConfig = !!activeConfig?.apiKey?.trim();
  const delayedSpeakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const activeInteractionIdRef = useRef(0);
  const openingRequestIdRef = useRef(0);
  const secondarySpeakerRequestIdRef = useRef(0);
  const historyRef = useRef(history);

  const clearDelayedSpeakerTimer = useCallback(() => {
    if (delayedSpeakerTimerRef.current) {
      clearTimeout(delayedSpeakerTimerRef.current);
      delayedSpeakerTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearDelayedSpeakerTimer();
    };
  }, [clearDelayedSpeakerTimer]);

  const generateMessageForSpeaker = useCallback(async (params: {
    speaker: Character;
    currentHistory: ChatMessage[];
    mode: 'reply' | 'invited' | 'opening';
  }) => {
    if (!activeConfig) {
      throw new Error('Missing active API config.');
    }

    const systemPrompt = buildGroupChatPrompt({
      sceneInput: buildGroupChatSceneInput({
        speaker: params.speaker,
        members,
        userName,
        history: params.currentHistory,
        mode: params.mode,
      }),
    });
    console.info('[group-chat] generating message', {
      mode: params.mode,
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      memberCount: members.length,
      historyLength: params.currentHistory.length,
    });

    let responseText = '';
    await streamTextWithConfig({
      activeConfig,
      messages: buildRuntimeMessages({
        systemPrompt,
        history: params.currentHistory,
        mode: params.mode,
      }),
      temperature: 0.7,
      onTextChunk: (chunkText) => {
        responseText += chunkText;
      },
    });

    const normalizedResponse = normalizeGeneratedReply(responseText, params.speaker);
    if (!normalizedResponse) {
      throw new Error('\u6a21\u578b\u8fd4\u56de\u4e3a\u7a7a');
    }

    console.info('[group-chat] raw model output', {
      mode: params.mode,
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      rawText: responseText,
    });
    console.info('[group-chat] normalized model output', {
      mode: params.mode,
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      normalizedText: normalizedResponse,
    });
    console.info('[group-chat] generation completed', {
      mode: params.mode,
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      rawLength: responseText.length,
      normalizedLength: normalizedResponse.length,
      preview: normalizedResponse.slice(0, 80),
    });
    return normalizedResponse;
  }, [activeConfig, members, userName]);

  const appendSystemFailure = useCallback((detail: string) => {
    setError(detail);
    setHistory((prevHistory) => [
      ...prevHistory,
      {
        role: 'model',
        text: buildFailureText(detail),
        timestamp: Date.now(),
        isSystem: true,
      },
    ]);
  }, [setError, setHistory]);

  const resolveReplyTarget = useCallback((targetName: string, currentHistory: ChatMessage[]) => {
    const normalizedTarget = targetName.trim().toLowerCase();
    if (!normalizedTarget) {
      return null;
    }

    for (let index = currentHistory.length - 1; index >= 0; index -= 1) {
      const message = currentHistory[index];
      if (message.isSystem) {
        continue;
      }

      if (message.role === 'user' && userName.toLowerCase() === normalizedTarget) {
        return buildReplyPreviewPayload(message, userName);
      }

      if (message.senderCharacterId) {
        const sender = members.find((member) => member.id === message.senderCharacterId);
        const aliases = [sender?.name, sender?.remarkName].filter((value): value is string => !!value?.trim());
        if (aliases.some((alias) => alias.trim().toLowerCase() === normalizedTarget)) {
          return buildReplyPreviewPayload(message, sender?.name || targetName);
        }
      }
    }

    return null;
  }, [members, userName]);

  const appendSpeakerMessage = useCallback((
    speaker: Character,
    text: string,
    timestamp = Date.now(),
    currentHistory: ChatMessage[] = historyRef.current,
    forcedReplyTo?: ChatMessage['replyTo'] | null,
  ): ChatMessage[] => {
    const messages = splitGroupReplyIntoMessages(text, speaker, timestamp);
    if (messages.length === 0) {
      return [];
    }

    const structuredMessages = messages.map((message) => {
      const rawContent = getMessageMainText(message);
      const cue = parseActionCue(rawContent);
      const cleanedText = cue.kind === 'sticker'
        ? `[sticker] ${cue.content || '...'}`
        : cue.kind === 'reply'
          ? cue.content || rawContent
          : cue.content || rawContent;

      const replyPayload = forcedReplyTo
        || (cue.replyTargetName ? resolveReplyTarget(cue.replyTargetName, currentHistory) : null);

      return {
        ...message,
        text: cue.kind === 'notice' ? `[notice] ${cue.content || rawContent}` : `${speaker.name}: ${cleanedText}`,
        isSystem: cue.kind === 'notice' ? true : undefined,
        replyTo: replyPayload || undefined,
      };
    });

    console.info('[group-chat] append speaker messages', {
      speakerId: speaker.id,
      speakerName: speaker.name,
      appendedCount: structuredMessages.length,
      previews: structuredMessages.map((message) => ({
        preview: getMessageMainText(message).slice(0, 80),
        isSystem: !!message.isSystem,
        hasReplyTo: !!message.replyTo,
      })),
    });
    setHistory((prevHistory) => [...prevHistory, ...structuredMessages]);
    return structuredMessages;
  }, [resolveReplyTarget, setHistory]);

  const triggerAISpeaker = useCallback(async (
    speaker: Character,
    currentHistory: ChatMessage[],
    interactionId: number,
    forcedReplyTo?: ChatMessage['replyTo'] | null,
  ) => {
    const requestId = secondarySpeakerRequestIdRef.current + 1;
    secondarySpeakerRequestIdRef.current = requestId;

    try {
      const responseText = await generateMessageForSpeaker({
        speaker,
        currentHistory,
        mode: 'invited',
      });

      if (
        responseText
        && isMountedRef.current
        && activeInteractionIdRef.current === interactionId
        && secondarySpeakerRequestIdRef.current === requestId
      ) {
        appendSpeakerMessage(speaker, responseText, Date.now(), currentHistory, forcedReplyTo);
      }
    } catch (runtimeError) {
      console.error('Triggered speaker error:', runtimeError);
      if (isMountedRef.current && activeInteractionIdRef.current === interactionId) {
        setHistory((prevHistory) => [...prevHistory, {
          role: 'model',
          text: buildFailureText(runtimeError instanceof Error ? runtimeError.message : '\u7fa4\u6210\u5458\u63a5\u8bdd\u5931\u8d25'),
          timestamp: Date.now(),
          isSystem: true,
        }]);
      }
    }
  }, [appendSpeakerMessage, generateMessageForSpeaker, setHistory]);

  const maybeOpenScene = useCallback(async () => {
    if (!hasActiveConfig || members.length === 0) {
      console.info('[group-chat] skip opening scene', {
        reason: !hasActiveConfig ? 'missing_active_config' : 'missing_members',
        memberCount: members.length,
      });
      return;
    }

    const hasExistingSession = history.length > 0 || !!groupMeta?.lastMessage || !!groupMeta?.lastTime;
    if (hasExistingSession) {
      console.info('[group-chat] skip opening scene', {
        reason: 'existing_session',
        historyLength: history.length,
        lastMessage: groupMeta?.lastMessage || '',
        lastTime: groupMeta?.lastTime || null,
      });
      return;
    }

    const openerCandidates = members.filter(
      (member) => !!member.sceneHints?.groupChat || !!member.corePersona?.trim() || !!member.signature?.trim(),
    );
    const openerPool = openerCandidates.length > 0 ? openerCandidates : members;
    const opener = openerPool[Math.floor(Math.random() * openerPool.length)];

    const requestId = openingRequestIdRef.current + 1;
    openingRequestIdRef.current = requestId;
    const interactionId = activeInteractionIdRef.current;
    console.info('[group-chat] opening scene started', {
      speakerId: opener.id,
      speakerName: opener.name,
      requestId,
      interactionId,
    });

    try {
      const responseText = await generateMessageForSpeaker({
        speaker: opener,
        currentHistory: history,
        mode: 'opening',
      });

      if (
        responseText
        && isMountedRef.current
        && activeInteractionIdRef.current === interactionId
        && openingRequestIdRef.current === requestId
      ) {
        console.info('[group-chat] opening scene append message', {
          speakerId: opener.id,
          speakerName: opener.name,
          requestId,
        });
        const openingMessages = splitGroupReplyIntoMessages(responseText, opener);
        setHistory((prevHistory) => (
          prevHistory.length > 0 ? prevHistory : [...prevHistory, ...openingMessages]
        ));
      }
    } catch (runtimeError) {
      console.error('Opening speaker error:', runtimeError);
      if (
        isMountedRef.current
        && activeInteractionIdRef.current === interactionId
        && openingRequestIdRef.current === requestId
      ) {
        setHistory((prevHistory) => [...prevHistory, {
          role: 'model',
          text: buildFailureText(runtimeError instanceof Error ? runtimeError.message : '\u7fa4\u804a\u5f00\u573a\u5931\u8d25'),
          timestamp: Date.now(),
          isSystem: true,
        }]);
      }
    }
  }, [generateMessageForSpeaker, groupMeta?.lastMessage, groupMeta?.lastTime, hasActiveConfig, history, members, setHistory]);

  const submitUserMessage = useCallback(async (params: {
    message: ChatMessage;
    promptText: string;
  }) => {
    const countRecentMessagesBySpeaker = (characterId: string) =>
      historyRef.current
        .filter((message) => message.role === 'model' && message.senderCharacterId === characterId)
        .slice(-6)
        .length;

    const getMemberAliases = (member: Character) =>
      Array.from(
        new Set(
          [member.name, member.remarkName]
            .map((value) => value?.trim())
            .filter((value): value is string => !!value),
        ),
      );

    const extractMentionedMember = (text: string, excludedIds: string[] = []) => {
      const normalized = text.trim();
      if (!normalized) return null;

      const atMatches = Array.from(normalized.matchAll(MENTION_REGEX));
      for (const match of atMatches) {
        const candidate = getCharacterByName(match[1]);
        if (candidate && !excludedIds.includes(candidate.id)) {
          return candidate;
        }
      }

      for (const member of members) {
        if (excludedIds.includes(member.id)) continue;
        const aliases = getMemberAliases(member);
        if (aliases.some((alias) => normalized.includes(alias))) {
          return member;
        }
      }

      return null;
    };

    const pickPrimaryResponder = (userText: string) => {
      const mentionedMember = extractMentionedMember(userText);
      if (mentionedMember) {
        return mentionedMember;
      }

      const latestModelSpeakerId = [...historyRef.current]
        .reverse()
        .find((message) => message.role === 'model')
        ?.senderCharacterId;

      const weightedMembers = members.map((member) => {
        let weight = inferReadableSpeakerWeight(member, userText);
        const aliases = getMemberAliases(member);
        const mentionHit = aliases.some((alias) => userText.includes(alias));

        if (mentionHit) {
          weight += 3;
        }

        if (member.id === latestModelSpeakerId) {
          weight -= wantsAnotherSpeaker(userText) ? 1.2 : 0.6;
        }

        const recentCount = countRecentMessagesBySpeaker(member.id);
        weight -= recentCount * 0.45;

        if (wantsAnotherSpeaker(userText) && member.id !== latestModelSpeakerId) {
          weight += 0.8;
        }

        return {
          member,
          weight: Math.max(weight, 0.2),
        };
      });

      const totalWeight = weightedMembers.reduce((sum, item) => sum + item.weight, 0);
      let cursor = Math.random() * totalWeight;
      for (const item of weightedMembers) {
        cursor -= item.weight;
        if (cursor <= 0) {
          return item.member;
        }
      }

      return weightedMembers[weightedMembers.length - 1]?.member ?? members[0];
    };

    const resolveSecondarySpeaker = (userText: string, primarySpeaker: Character, primaryResponse: string) => {
      const explicitSecondary = extractMentionedMember(userText, [primarySpeaker.id]);
      if (explicitSecondary) {
        return explicitSecondary;
      }

      const responseMention = extractMentionedMember(primaryResponse, [primarySpeaker.id]);
      if (responseMention) {
        return responseMention;
      }

      const candidateMembers = members.filter((member) => member.id !== primarySpeaker.id);
      if (candidateMembers.length === 0) {
        return null;
      }

      const vibeAllowsFollowUp = wantsAnotherSpeaker(userText)
        || primaryResponse.includes('?')
        || primaryResponse.includes('？')
        || primaryResponse.length <= 10;

      if (!vibeAllowsFollowUp) {
        return null;
      }

      const weightedCandidates = candidateMembers.map((member) => {
        let weight = inferReadableSpeakerWeight(member, `${userText}\n${primaryResponse}`);
        const recentCount = countRecentMessagesBySpeaker(member.id);
        weight -= recentCount * 0.4;

        if (includesAny(buildCharacterEvidence(member), ['话少', '冷淡', '克制', '沉默']) && !wantsAnotherSpeaker(userText)) {
          weight -= 0.8;
        }

        return {
          member,
          weight: Math.max(weight, 0.1),
        };
      });

      const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) {
        return null;
      }

      if (Math.random() > 0.42 && !explicitSecondary && !responseMention) {
        return null;
      }

      let cursor = Math.random() * totalWeight;
      for (const item of weightedCandidates) {
        cursor -= item.weight;
        if (cursor <= 0) {
          return item.member;
        }
      }

      return weightedCandidates[weightedCandidates.length - 1]?.member ?? null;
    };

    clearDelayedSpeakerTimer();
    const interactionId = activeInteractionIdRef.current + 1;
    activeInteractionIdRef.current = interactionId;
    openingRequestIdRef.current += 1;
    secondarySpeakerRequestIdRef.current += 1;

    const newHistory = [...historyRef.current, params.message];
    setHistory(newHistory);
    setInput('');
    setReplyingTo(null);
    console.info('[group-chat] user message appended', {
      text: params.message.text,
      historyLength: newHistory.length,
      memberCount: members.length,
    });

    try {
      await runGeneration(async ({ generationId }) => {
        const responder = pickPrimaryResponder(params.promptText);

        if (!responder) {
          throw new Error('\u7fa4\u804a\u4e2d\u6ca1\u6709\u53ef\u7528\u7684\u56de\u590d\u89d2\u8272');
        }
        console.info('[group-chat] primary responder selected', {
          responderId: responder.id,
          responderName: responder.name,
          generationId,
          interactionId,
        });

        try {
          const responseText = await generateMessageForSpeaker({
            speaker: responder,
            currentHistory: newHistory,
            mode: 'reply',
          });

          if (!isMountedRef.current || activeInteractionIdRef.current !== interactionId || activeGenerationIdRef.current !== generationId) {
            console.info('[group-chat] primary response ignored due to stale interaction', {
              generationId,
              interactionId,
              activeInteractionId: activeInteractionIdRef.current,
              activeGenerationId: activeGenerationIdRef.current,
            });
            return;
          }

          const resolvedMessages = appendSpeakerMessage(responder, responseText, Date.now(), newHistory);
          const latestHistory = [...newHistory, ...resolvedMessages];

          const nextSpeaker = resolveSecondarySpeaker(params.promptText, responder, responseText);
          if (nextSpeaker && nextSpeaker.id !== responder.id) {
            console.info('[group-chat] secondary responder scheduled', {
              responderId: nextSpeaker.id,
              responderName: nextSpeaker.name,
              interactionId,
            });
            delayedSpeakerTimerRef.current = setTimeout(() => {
              if (!isMountedRef.current || activeInteractionIdRef.current !== interactionId) {
                return;
              }
              const latestReplySource = resolvedMessages[resolvedMessages.length - 1];
              const replyPayload = latestReplySource
                ? buildReplyPreviewPayload(latestReplySource, responder.name)
                : null;
              void triggerAISpeaker(nextSpeaker, latestHistory, interactionId, replyPayload);
            }, 1200);
          }
        } catch (runtimeError) {
          console.error('Group chat error:', runtimeError);
          if (!isMountedRef.current || activeInteractionIdRef.current !== interactionId || activeGenerationIdRef.current !== generationId) {
            return;
          }

          appendSystemFailure(runtimeError instanceof Error ? runtimeError.message : '\u672a\u77e5\u9519\u8bef');
          setError(runtimeError instanceof Error ? runtimeError.message : '\u672a\u77e5\u9519\u8bef');
        }
      });
    } catch (runtimeError) {
      console.error('Group chat fatal error:', runtimeError);
      appendSystemFailure(runtimeError instanceof Error ? runtimeError.message : '\u672a\u77e5\u9519\u8bef');
    }
  }, [
    activeGenerationIdRef,
    clearDelayedSpeakerTimer,
    appendSpeakerMessage,
    appendSystemFailure,
    generateMessageForSpeaker,
    getCharacterByName,
    members,
    runGeneration,
    setError,
    setHistory,
    setInput,
    setReplyingTo,
    triggerAISpeaker,
  ]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (!hasActiveConfig) {
      setError('\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u914d\u7f6e\u53ef\u7528\u7684 API');
      return;
    }

    await submitUserMessage({
      message: {
        role: 'user',
        text: input.trim(),
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: input.trim(),
    });
  }, [hasActiveConfig, input, isLoading, replyingTo, setError, submitUserMessage]);

  const sendImageMessage = useCallback(async (base64String: string) => {
    if (isLoading || !hasActiveConfig) return;

    await submitUserMessage({
      message: {
        role: 'user',
        text: '[image]',
        imageUrl: base64String,
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: '[sent an image]',
    });
  }, [hasActiveConfig, isLoading, replyingTo, submitUserMessage]);

  const sendLocationMessage = useCallback(async (location: { name: string; address?: string; isVirtual?: boolean }) => {
    if (isLoading || !hasActiveConfig) return;

    await submitUserMessage({
      message: {
        role: 'user',
        text: `[location] ${location.name}`,
        location,
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: `[sent location] ${location.name}${location.address ? `, ${location.address}` : ''}`,
    });
  }, [hasActiveConfig, isLoading, replyingTo, submitUserMessage]);

  return {
    isLoading,
    error,
    sendText: handleSend,
    sendImageMessage,
    sendLocationMessage,
    maybeOpenScene,
  };
}
