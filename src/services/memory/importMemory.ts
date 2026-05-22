import type { MemoryLibraryEntry, MemoryLibraryKind } from '../../types';
import { createMemoryLibraryEntry, normalizeMemoryLibraryEntries } from './memoryLibrary';

const LONG_TERM_HINTS = [
  '关系定位',
  '核心相处逻辑',
  '稳定行为偏好',
  '长期关系红线',
  '重要事件锚点',
  '阶段变化',
  '长期画像',
  '长期记忆',
  '长期关系',
  '稳定印象',
  '边界',
  '偏好',
  '相处模式',
  '关系档案',
];

const SHORT_TERM_HINTS = [
  '短期总结',
  '近期记忆',
  '当前气氛',
  '未完事项',
  '近期余波',
  '最近几轮',
  '这几天',
  '今天',
  '刚刚',
  '本轮',
  '最近',
  '现在',
];

const MAX_BLOCK_CHARS = 560;
const SHORT_TERM_CURRENT_LIMIT = 1400;
const LONG_TERM_CURRENT_LIMIT = 2400;

function normalizeImportText(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function compactWhitespace(value: string): string {
  return value
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitOversizedBlock(block: string): string[] {
  if (block.length <= MAX_BLOCK_CHARS) {
    return [block];
  }

  const sentences = block
    .replace(/([。！？!?；;]+)/g, '$1\n')
    .split(/\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const chunks: string[] = [];
    for (let index = 0; index < block.length; index += MAX_BLOCK_CHARS) {
      chunks.push(block.slice(index, index + MAX_BLOCK_CHARS).trim());
    }
    return chunks.filter(Boolean);
  }

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current}${sentence}` : sentence;
    if (candidate.length <= MAX_BLOCK_CHARS) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current.trim());
    }
    current = sentence;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

function splitImportTextIntoBlocks(raw: string): string[] {
  const normalized = normalizeImportText(raw);
  if (!normalized) {
    return [];
  }

  const paragraphBlocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => compactWhitespace(block))
    .filter(Boolean);

  return paragraphBlocks.flatMap(splitOversizedBlock).filter(Boolean);
}

function countHints(text: string, hints: string[]): number {
  return hints.reduce((count, hint) => count + (text.includes(hint) ? 1 : 0), 0);
}

function classifyImportedBlock(block: string): MemoryLibraryKind {
  const longTermScore = countHints(block, LONG_TERM_HINTS);
  const shortTermScore = countHints(block, SHORT_TERM_HINTS);

  if (longTermScore > shortTermScore) {
    return 'long-term';
  }

  if (shortTermScore > longTermScore) {
    return 'short-term';
  }

  return block.length >= 220 ? 'long-term' : 'short-term';
}

function buildCurrentLayerText(entries: MemoryLibraryEntry[], kind: MemoryLibraryKind): string {
  const limit = kind === 'long-term' ? LONG_TERM_CURRENT_LIMIT : SHORT_TERM_CURRENT_LIMIT;
  const blocks = entries
    .filter((entry) => entry.kind === kind)
    .map((entry) => entry.content.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return '';
  }

  let currentLength = 0;
  const selectedBlocks: string[] = [];

  for (const block of blocks) {
    const blockLength = block.length + (selectedBlocks.length > 0 ? 2 : 0);
    if (selectedBlocks.length > 0 && currentLength + blockLength > limit) {
      break;
    }
    selectedBlocks.push(block);
    currentLength += blockLength;
  }

  return selectedBlocks.join('\n\n').trim();
}

function buildEntriesFromText(raw: string, forcedKind?: MemoryLibraryKind): MemoryLibraryEntry[] {
  return splitImportTextIntoBlocks(raw).map((block, index) =>
    createMemoryLibraryEntry({
      kind: forcedKind ?? classifyImportedBlock(block),
      source: 'manual',
      content: block,
      createdAt: Date.now() + index,
    }),
  );
}

export type PreparedMemoryImport = {
  entries: MemoryLibraryEntry[];
  shortTermCurrentText: string;
  longTermCurrentText: string;
  totalChars: number;
  shortTermCount: number;
  longTermCount: number;
};

export function prepareMemoryImportFromUnknown(data: unknown): PreparedMemoryImport | null {
  const normalizedEntries = normalizeMemoryLibraryEntries(
    typeof data === 'object' && data && 'memoryLibraryEntries' in data
      ? (data as { memoryLibraryEntries?: unknown }).memoryLibraryEntries
      : Array.isArray(data)
        ? data
        : undefined,
  );

  let entries: MemoryLibraryEntry[] = [];

  if (normalizedEntries && normalizedEntries.length > 0) {
    entries = normalizedEntries.map((entry, index) =>
      createMemoryLibraryEntry({
        kind: entry.kind,
        source: 'manual',
        content: entry.content,
        createdAt: entry.createdAt + index,
      }),
    );
  } else if (typeof data === 'string') {
    entries = buildEntriesFromText(data);
  } else if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const shortTermEntries =
      typeof record.shortTermSummary === 'string'
        ? buildEntriesFromText(record.shortTermSummary, 'short-term')
        : [];
    const longTermEntries =
      typeof record.longTermMemoryProfile === 'string'
        ? buildEntriesFromText(record.longTermMemoryProfile, 'long-term')
        : [];
    const genericText =
      typeof record.content === 'string'
        ? record.content
        : typeof record.text === 'string'
          ? record.text
          : '';

    entries = [
      ...shortTermEntries,
      ...longTermEntries,
      ...buildEntriesFromText(genericText),
    ];
  }

  if (entries.length === 0) {
    return null;
  }

  const totalChars = entries.reduce((sum, entry) => sum + entry.charCount, 0);
  const shortTermCount = entries.filter((entry) => entry.kind === 'short-term').length;
  const longTermCount = entries.filter((entry) => entry.kind === 'long-term').length;

  return {
    entries,
    shortTermCurrentText: buildCurrentLayerText(entries, 'short-term'),
    longTermCurrentText: buildCurrentLayerText(entries, 'long-term'),
    totalChars,
    shortTermCount,
    longTermCount,
  };
}
