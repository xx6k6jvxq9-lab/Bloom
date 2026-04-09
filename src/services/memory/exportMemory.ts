import type { MemoryLibraryEntry, MemoryLibraryKind } from '../../types';

export type MemoryExportScope = 'library' | 'year' | 'month';
export type MemoryExportFormat = 'json' | 'txt';

export type MemoryExportPayload = {
  kind: MemoryLibraryKind;
  scope: MemoryExportScope;
  label: string;
  exportedAt: number;
  totalEntries: number;
  totalChars: number;
  entries: MemoryLibraryEntry[];
};

function formatDateTime(entry: MemoryLibraryEntry): string {
  const month = String(entry.month).padStart(2, '0');
  const day = String(entry.day).padStart(2, '0');
  const hour = String(entry.hour).padStart(2, '0');
  const minute = String(entry.minute).padStart(2, '0');
  return `${entry.year}-${month}-${day} ${hour}:${minute}`;
}

function getKindLabel(kind: MemoryLibraryKind): string {
  return kind === 'short-term' ? '短期记忆' : '长期记忆';
}

function getSourceLabel(source: MemoryLibraryEntry['source']): string {
  return source === 'auto' ? '自动总结' : '手动总结';
}

export function buildMemoryExportPayload(
  kind: MemoryLibraryKind,
  scope: MemoryExportScope,
  label: string,
  entries: MemoryLibraryEntry[],
): MemoryExportPayload {
  const sortedEntries = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  return {
    kind,
    scope,
    label,
    exportedAt: Date.now(),
    totalEntries: sortedEntries.length,
    totalChars: sortedEntries.reduce((sum, entry) => sum + entry.charCount, 0),
    entries: sortedEntries,
  };
}

export function stringifyMemoryExportAsText(payload: MemoryExportPayload): string {
  const lines: string[] = [
    `${getKindLabel(payload.kind)}导出`,
    `范围：${payload.label}`,
    `条数：${payload.totalEntries}`,
    `总字数：${payload.totalChars}`,
    '',
  ];

  for (const entry of payload.entries) {
    lines.push(`[${formatDateTime(entry)}] ${getSourceLabel(entry.source)} · ${entry.charCount}字`);
    lines.push(entry.content.trim());
    lines.push('');
  }

  return lines.join('\n').trim();
}
