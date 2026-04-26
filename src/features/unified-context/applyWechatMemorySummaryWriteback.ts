import type { Character } from '../../types';
import type { WechatIncomingBridgeMessage } from '../wechat-bridge/types';

const WECHAT_MEMORY_BLOCK_START = '[wechat_memory_state]';
const WECHAT_MEMORY_BLOCK_END = '[/wechat_memory_state]';
const MAX_SIGNAL_COUNT = 3;
const MAX_SIGNAL_LENGTH = 24;

type ParsedWechatMemoryBlock = {
  prefix: string;
  suffix: string;
  recentSignals: string[];
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function sanitizeWechatText(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return '有一条新的微信消息';
  }

  const noisyQuestionMarks = normalized.match(/[?？]/g)?.length ?? 0;
  const noiseRatio = noisyQuestionMarks / Math.max(normalized.length, 1);
  if (noiseRatio > 0.35 || normalized.includes('�')) {
    return '有一条内容存在编码噪音的微信消息';
  }

  return normalized
    .replace(/\[wechat_memory_state]|\[\/wechat_memory_state]/gi, '')
    .trim();
}

function buildSignalSnippet(message: WechatIncomingBridgeMessage): string {
  return truncateText(sanitizeWechatText(message.text), MAX_SIGNAL_LENGTH);
}

function parseRecentSignals(lines: string[]): string[] {
  const signalLine = lines.find((line) => line.startsWith('最近线索：'));
  if (!signalLine) {
    return [];
  }

  return signalLine
    .slice('最近线索：'.length)
    .split('；')
    .map((item) => normalizeWhitespace(item.replace(/^[""'']|[""'']$/g, '')))
    .filter(Boolean);
}

function parseWechatMemoryBlock(summary?: string): ParsedWechatMemoryBlock {
  const raw = summary?.trim() || '';
  if (!raw) {
    return {
      prefix: '',
      suffix: '',
      recentSignals: [],
    };
  }

  const startIndex = raw.indexOf(WECHAT_MEMORY_BLOCK_START);
  const endIndex = raw.indexOf(WECHAT_MEMORY_BLOCK_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return {
      prefix: raw,
      suffix: '',
      recentSignals: [],
    };
  }

  const prefix = raw.slice(0, startIndex).trim();
  const suffix = raw.slice(endIndex + WECHAT_MEMORY_BLOCK_END.length).trim();
  const innerLines = raw
    .slice(startIndex + WECHAT_MEMORY_BLOCK_START.length, endIndex)
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  return {
    prefix,
    suffix,
    recentSignals: parseRecentSignals(innerLines),
  };
}

function mergeSignals(currentSignals: string[], nextSignal: string): string[] {
  const deduped = currentSignals.filter((signal) => signal !== nextSignal);
  return [...deduped, nextSignal].slice(-MAX_SIGNAL_COUNT);
}

function buildTopicLine(signals: string[]): string {
  if (!signals.length) {
    return '最近主题：微信侧有新的互动，先作为轻量背景保留。';
  }

  if (signals.length === 1) {
    return `最近主题：最近提到过“${signals[0]}”。`;
  }

  return `最近主题：最近主要围绕“${signals.join('”、“')}”这些内容展开。`;
}

function buildStateLine(signals: string[]): string {
  if (!signals.length) {
    return '当前状态：最近多了一点来自微信侧的互动线索，先轻量同步，不放大处理。';
  }

  if (signals.some((signal) => /累|困|难受|烦|低落|不舒服|生病|压力|崩溃/.test(signal))) {
    return '当前状态：最近状态里有一点疲惫或压力感，后续更适合先接住情绪。';
  }

  if (signals.some((signal) => /想你|想聊|陪我|陪陪|抱抱|晚安|早安|开心|想见/.test(signal))) {
    return '当前状态：最近互动更偏靠近和陪伴，气氛是温和上升的。';
  }

  return '当前状态：最近有连续互动，可以作为近况保留，但不需要压过当下对话。';
}

function buildInteractionLine(): string {
  return '相处倾向：把这些内容当作背景线索自然承接即可，不复述微信原话，也不强行续聊旧节点。';
}

function buildSignalsLine(signals: string[]): string {
  if (!signals.length) {
    return '最近线索：暂无需要额外保留的线索。';
  }

  return `最近线索：${signals.map((signal) => `“${signal}”`).join('；')}`;
}

function buildWechatMemoryBlock(signals: string[]): string {
  return [
    WECHAT_MEMORY_BLOCK_START,
    buildTopicLine(signals),
    buildStateLine(signals),
    buildInteractionLine(),
    buildSignalsLine(signals),
    WECHAT_MEMORY_BLOCK_END,
  ].join('\n');
}

function joinSections(sections: string[]): string | undefined {
  const normalized = sections.map((section) => section.trim()).filter(Boolean);
  if (!normalized.length) {
    return undefined;
  }
  return normalized.join('\n\n');
}

export function applyWechatMemorySummaryWriteback(
  character: Pick<Character, 'shortTermSummary'>,
  message: WechatIncomingBridgeMessage,
): string | undefined {
  const parsed = parseWechatMemoryBlock(character.shortTermSummary);
  const nextSignals = mergeSignals(parsed.recentSignals, buildSignalSnippet(message));

  return joinSections([
    parsed.prefix,
    buildWechatMemoryBlock(nextSignals),
    parsed.suffix,
  ]);
}

export function extractWechatMemorySnapshot(summary?: string): string | undefined {
  const raw = summary?.trim() || '';
  if (!raw) {
    return undefined;
  }

  const startIndex = raw.indexOf(WECHAT_MEMORY_BLOCK_START);
  const endIndex = raw.indexOf(WECHAT_MEMORY_BLOCK_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return undefined;
  }

  const inner = raw
    .slice(startIndex + WECHAT_MEMORY_BLOCK_START.length, endIndex)
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  return inner.length ? inner.join('\n') : undefined;
}
