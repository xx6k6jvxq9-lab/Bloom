import type {
  ApiConfig,
  AssistantReplyEnvelope,
  AssistantReplyEnvelopeGameCardItem,
  AssistantReplyEnvelopeItem,
  AssistantReplyEnvelopeTextItem,
  AssistantReplyEnvelopeTokenName,
} from '../../types';
import { sanitizePipeMarkers } from '../chat/messageText';
import { streamTextWithConfig, type RuntimeChatMessage } from './runtimeClient';

export const STRUCTURED_ASSISTANT_REPLY_TOKEN = '[ASSISTANT_REPLY]';
const LEGACY_BILINGUAL_REPLY_TOKEN = '[BILINGUAL_REPLY]';

function normalizeReplyLine(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return sanitizePipeMarkers(value, ' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

function stripTokenCodeFence(text: string, token: string): string {
  let jsonString = text.replace(token, '').trim();

  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }

  return jsonString;
}

function parseJsonBody(text: string, token: string): Record<string, unknown> | null {
  const jsonString = stripTokenCodeFence(text, token);
  const jsonStart = jsonString.indexOf('{');
  const jsonEnd = jsonString.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonString.slice(jsonStart, jsonEnd + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function normalizeTransferAmount(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value.toFixed(2);
  }

  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return '';
  }

  const amount = Number.parseFloat(trimmed);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : '';
}

function normalizeTokenName(value: unknown): AssistantReplyEnvelopeTokenName | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (normalized === 'COUPLE_SPACE_INVITE' || normalized === 'COUPLE_SPACE_INVITE_ACCEPTED') {
    return normalized;
  }

  return null;
}

function parseStructuredTextItem(item: Record<string, unknown>): AssistantReplyEnvelopeTextItem | null {
  const text = normalizeReplyLine(item.text);
  if (!text) {
    return null;
  }

  const translation = normalizeReplyLine(item.translation);
  return translation
    ? { kind: 'text', text, translation }
    : { kind: 'text', text };
}

function parseStructuredGameCardItem(item: Record<string, unknown>): AssistantReplyEnvelopeGameCardItem | null {
  const payload = item.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const translation = normalizeReplyLine(item.translation);
  return translation
    ? { kind: 'game_card', payload: payload as Record<string, unknown>, translation }
    : { kind: 'game_card', payload: payload as Record<string, unknown> };
}

function parseStructuredItem(item: unknown): AssistantReplyEnvelopeItem | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const typedItem = item as Record<string, unknown>;
  const kind = typeof typedItem.kind === 'string' ? typedItem.kind.trim() : '';

  switch (kind) {
    case 'text':
      return parseStructuredTextItem(typedItem);
    case 'game_card':
      return parseStructuredGameCardItem(typedItem);
    case 'transfer': {
      const amount = normalizeTransferAmount(typedItem.amount);
      return amount ? { kind: 'transfer', amount } : null;
    }
    case 'token': {
      const name = normalizeTokenName(typedItem.name);
      return name ? { kind: 'token', name } : null;
    }
    default:
      return null;
  }
}

function normalizeStructuredEnvelope(items: AssistantReplyEnvelopeItem[]): AssistantReplyEnvelope | null {
  if (items.length === 0) {
    return null;
  }

  const gameCardCount = items.filter((item) => item.kind === 'game_card').length;
  if (gameCardCount > 1) {
    return null;
  }

  if (gameCardCount === 1 && items.length > 1) {
    return null;
  }

  const textItems = items.filter((item): item is AssistantReplyEnvelopeTextItem => item.kind === 'text');
  const translatedTextCount = textItems.filter((item) => !!item.translation).length;
  if (translatedTextCount > 0 && translatedTextCount !== textItems.length) {
    return null;
  }

  return { items };
}

function parseStructuredAssistantReplyEnvelopeBody(parsed: Record<string, unknown>): AssistantReplyEnvelope | null {
  if (!Array.isArray(parsed.items)) {
    return null;
  }

  const items = parsed.items
    .map((item) => parseStructuredItem(item))
    .filter((item): item is AssistantReplyEnvelopeItem => !!item);

  return normalizeStructuredEnvelope(items);
}

function parseLegacyStructuredBilingualReply(text: string): AssistantReplyEnvelope | null {
  if (!text.trim().startsWith(LEGACY_BILINGUAL_REPLY_TOKEN)) {
    return null;
  }

  const parsed = parseJsonBody(text, LEGACY_BILINGUAL_REPLY_TOKEN);
  if (!parsed || !Array.isArray(parsed.segments)) {
    return null;
  }

  const items = parsed.segments
    .map((segment) => {
      if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
        return null;
      }

      const typedSegment = segment as Record<string, unknown>;
      const item = parseStructuredTextItem({
        kind: 'text',
        text: typedSegment.text,
        translation: typedSegment.translation,
      });
      return item && item.translation ? item : null;
    })
    .filter((item): item is AssistantReplyEnvelopeTextItem => !!item);

  return normalizeStructuredEnvelope(items);
}

export function parseStructuredAssistantReplyEnvelope(text: string): AssistantReplyEnvelope | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(STRUCTURED_ASSISTANT_REPLY_TOKEN)) {
    const parsed = parseJsonBody(trimmed, STRUCTURED_ASSISTANT_REPLY_TOKEN);
    return parsed ? parseStructuredAssistantReplyEnvelopeBody(parsed) : null;
  }

  return parseLegacyStructuredBilingualReply(trimmed);
}

export function serializeStructuredAssistantReplyEnvelope(envelope: AssistantReplyEnvelope): string {
  return `${STRUCTURED_ASSISTANT_REPLY_TOKEN} ${JSON.stringify(envelope)}`;
}

function buildLegacyTranslationSection(items: AssistantReplyEnvelopeTextItem[]): string {
  if (items.length === 0 || items.some((item) => !item.translation)) {
    return '';
  }

  return items.map((item) => item.translation!.trim()).join(' ||| ');
}

function buildLegacyTextReply(items: AssistantReplyEnvelopeItem[]): string {
  const mainParts: string[] = [];
  const textItems: AssistantReplyEnvelopeTextItem[] = [];

  items.forEach((item) => {
    switch (item.kind) {
      case 'text':
        mainParts.push(item.text);
        textItems.push(item);
        break;
      case 'transfer':
        mainParts.push(`[transfer]${item.amount}[/transfer]`);
        break;
      case 'token':
        mainParts.push(`[${item.name}]`);
        break;
      default:
        break;
    }
  });

  const mainText = mainParts.join('\n').trim();
  if (!mainText) {
    return '';
  }

  const translationText = buildLegacyTranslationSection(textItems);
  return translationText
    ? `${mainText}\n\n---TRANSLATION---\n${translationText}`
    : mainText;
}

function buildLegacyGameCardReply(item: AssistantReplyEnvelopeGameCardItem): string {
  const base = `[GAME_CARD] ${JSON.stringify(item.payload)}`;
  return item.translation
    ? `${base}\n\n---TRANSLATION---\n${item.translation}`
    : base;
}

export function normalizeStructuredAssistantReplyToLegacyFormat(text: string): string {
  const envelope = parseStructuredAssistantReplyEnvelope(text);
  if (!envelope) {
    return text;
  }

  const gameCardItem = envelope.items.find((item): item is AssistantReplyEnvelopeGameCardItem => item.kind === 'game_card');
  if (gameCardItem) {
    return buildLegacyGameCardReply(gameCardItem);
  }

  return buildLegacyTextReply(envelope.items);
}

function buildEnvelopePreviewText(envelope: AssistantReplyEnvelope): string {
  const itemTexts = envelope.items.map((item) => {
    if (item.kind === 'text') {
      return item.text;
    }

    if (item.kind === 'game_card') {
      const payloadContent = normalizeReplyLine(item.payload.content);
      if (payloadContent) {
        return payloadContent;
      }

      return normalizeReplyLine(item.payload.question);
    }

    return '';
  }).filter(Boolean);

  return itemTexts.join('\n').trim();
}

function extractPreviewFields(protocolBody: string, fieldPattern: RegExp): string[] {
  const texts: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = fieldPattern.exec(protocolBody)) !== null) {
    const decodedText = normalizeReplyLine(
      decodeJsonString(match[1] || ''),
    );
    if (decodedText) {
      texts.push(decodedText);
    }
  }

  return texts;
}

export function extractStructuredAssistantReplyPreviewText(text: string): string {
  const envelope = parseStructuredAssistantReplyEnvelope(text);
  if (envelope) {
    return buildEnvelopePreviewText(envelope);
  }

  const trimmedText = text.trim();
  if (!trimmedText.startsWith(STRUCTURED_ASSISTANT_REPLY_TOKEN) && !trimmedText.startsWith(LEGACY_BILINGUAL_REPLY_TOKEN)) {
    return '';
  }

  const token = trimmedText.startsWith(STRUCTURED_ASSISTANT_REPLY_TOKEN)
    ? STRUCTURED_ASSISTANT_REPLY_TOKEN
    : LEGACY_BILINGUAL_REPLY_TOKEN;
  const protocolBody = stripTokenCodeFence(trimmedText, token);
  const textSegments = extractPreviewFields(protocolBody, /"text"\s*:\s*"((?:\\.|[^"\\])*)"/g);
  if (textSegments.length > 0) {
    return textSegments.join('\n').trim();
  }

  const contentSegments = extractPreviewFields(protocolBody, /"content"\s*:\s*"((?:\\.|[^"\\])*)"/g);
  return contentSegments.join('\n').trim();
}

export async function streamStructuredAssistantReply(params: {
  activeConfig: ApiConfig;
  messages: RuntimeChatMessage[];
  onPreview?: (previewText: string) => void;
  traceLabel?: string;
}): Promise<string> {
  let raw = '';
  let lastPreviewText = '';

  await streamTextWithConfig({
    activeConfig: params.activeConfig,
    messages: params.messages,
    traceLabel: params.traceLabel,
    onTextChunk: (chunkText) => {
      raw += chunkText;
      const previewText = extractStructuredAssistantReplyPreviewText(raw);
      if (!previewText || previewText === lastPreviewText) {
        return;
      }

      lastPreviewText = previewText;
      params.onPreview?.(previewText);
    },
  });

  return raw.trim();
}
