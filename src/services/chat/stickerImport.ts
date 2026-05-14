import type { StickerMetadata } from '../../types';
import { parseJsonWithCompatibility } from '../../features/import/importCompat';
import { normalizeStickerMetadata } from './stickerMetadata';

export type StickerImportEntry = {
  sticker: string;
  metadata?: StickerMetadata;
};

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const URL_REGEX = /https?:\/\/[^\s,)\]"'<>]+/gi;
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/i;
const HTML_IMAGE_REGEX = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/i;
const KEYED_FIELD_REGEX = /^(label|name|aliases|alias|traits|tags|category)\s*[:=：]\s*(.+)$/i;

function normalizeStickerValue(value: string) {
  return value.trim();
}

function normalizeStickerImportEntries(entries: StickerImportEntry[]) {
  const seen = new Map<string, StickerImportEntry>();

  for (const entry of entries) {
    const sticker = normalizeStickerValue(entry.sticker);
    if (!sticker) {
      continue;
    }

    const current = seen.get(sticker);
    if (!current) {
      seen.set(sticker, {
        sticker,
        ...(entry.metadata ? { metadata: entry.metadata } : {}),
      });
      continue;
    }

    const mergedMetadata = mergeStickerMetadata(current.metadata, entry.metadata);
    seen.set(sticker, {
      sticker,
      ...(mergedMetadata ? { metadata: mergedMetadata } : {}),
    });
  }

  return Array.from(seen.values());
}

function parseListField(raw: string): string[] | undefined {
  const normalized = Array.from(new Set(
    raw
      .split(/[\/|,，、;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  ));

  return normalized.length > 0 ? normalized : undefined;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result.filter(Boolean);
}

function splitImportColumns(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((item) => item.trim()).filter(Boolean);
  }

  if (line.includes('|')) {
    return line.split('|').map((item) => item.trim()).filter(Boolean);
  }

  if (line.includes(',')) {
    return parseCsvLine(line);
  }

  return [line.trim()].filter(Boolean);
}

function extractMetadataFromColumnPair(columns: string[]) {
  const metadataRecord: Record<string, unknown> = {};
  const unkeyedColumns: string[] = [];

  for (const column of columns) {
    const matched = column.match(KEYED_FIELD_REGEX);
    if (matched) {
      const key = matched[1].toLowerCase();
      const value = matched[2].trim();

      if (key === 'label' || key === 'name') {
        metadataRecord.label = value;
      } else if (key === 'category') {
        metadataRecord.category = value;
      } else if (key === 'aliases' || key === 'alias') {
        metadataRecord.aliases = parseListField(value);
      } else if (key === 'traits' || key === 'tags') {
        metadataRecord.traits = parseListField(value);
      }
      continue;
    }

    unkeyedColumns.push(column.trim());
  }

  if (!metadataRecord.label && unkeyedColumns[0]) {
    metadataRecord.label = unkeyedColumns[0];
  }

  const remainingColumns = metadataRecord.label
    ? unkeyedColumns.slice(1)
    : unkeyedColumns;

  if (!metadataRecord.aliases && remainingColumns[0]) {
    metadataRecord.aliases = parseListField(remainingColumns[0]);
  }

  if (!metadataRecord.traits && remainingColumns[1]) {
    metadataRecord.traits = parseListField(remainingColumns[1]);
  }

  if (!metadataRecord.category && remainingColumns[2]) {
    metadataRecord.category = remainingColumns[2];
  }

  return normalizeStickerMetadata(metadataRecord);
}

function mergeStickerMetadata(
  left: StickerMetadata | undefined,
  right: StickerMetadata | undefined,
): StickerMetadata | undefined {
  if (!left) return right;
  if (!right) return left;

  const label = right.label?.trim() || left.label?.trim();
  const category = right.category?.trim() || left.category?.trim();
  const aliases = Array.from(new Set([
    ...(left.aliases || []),
    ...(right.aliases || []),
  ].map((item) => item.trim()).filter(Boolean)));
  const traits = Array.from(new Set([
    ...(left.traits || []),
    ...(right.traits || []),
  ].map((item) => item.trim()).filter(Boolean)));

  return normalizeStickerMetadata({
    label,
    category,
    aliases,
    traits,
    caption: right.caption?.trim() || left.caption?.trim(),
    ocrText: right.ocrText?.trim() || left.ocrText?.trim(),
  });
}

function extractSingleLineStickerImport(line: string): StickerImportEntry[] {
  const markdownImage = line.match(MARKDOWN_IMAGE_REGEX);
  if (markdownImage) {
    const label = markdownImage[1]?.trim();
    const sticker = markdownImage[2]?.trim();
    return normalizeStickerImportEntries([{
      sticker,
      ...(label
        ? {
            metadata: normalizeStickerMetadata({
              label,
            }),
          }
        : {}),
    }]);
  }

  const htmlImage = line.match(HTML_IMAGE_REGEX);
  if (htmlImage) {
    return normalizeStickerImportEntries([{
      sticker: htmlImage[1].trim(),
    }]);
  }

  const columns = splitImportColumns(line);
  if (columns.length === 0) {
    return [];
  }

  const urlColumns = columns.filter((column) => /^https?:\/\//i.test(column));
  if (urlColumns.length >= 2) {
    return normalizeStickerImportEntries(urlColumns.map((sticker) => ({ sticker })));
  }

  if (urlColumns.length === 1) {
    const sticker = urlColumns[0];
    const metadataColumns = columns.filter((column) => column !== sticker);
    return normalizeStickerImportEntries([{
      sticker,
      ...(metadataColumns.length > 0
        ? {
            metadata: extractMetadataFromColumnPair(metadataColumns),
          }
        : {}),
    }]);
  }

  const urlMatches = line.match(URL_REGEX) || [];
  return normalizeStickerImportEntries(urlMatches.map((sticker) => ({ sticker: sticker.trim() })));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function extractStickerImportEntryFromObject(value: unknown): StickerImportEntry[] {
  if (typeof value === 'string') {
    return extractSingleLineStickerImport(value);
  }

  if (!isRecord(value)) {
    return [];
  }

  const sticker = [
    value.url,
    value.src,
    value.image,
    value.sticker,
    value.link,
  ]
    .find((candidate) => typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim()));

  if (typeof sticker !== 'string') {
    return [];
  }

  return normalizeStickerImportEntries([{
    sticker: sticker.trim(),
    metadata: normalizeStickerMetadata({
      label: typeof value.label === 'string'
        ? value.label
        : typeof value.name === 'string'
          ? value.name
          : undefined,
      category: typeof value.category === 'string' ? value.category : undefined,
      caption: typeof value.caption === 'string' ? value.caption : undefined,
      ocrText: typeof value.ocrText === 'string' ? value.ocrText : undefined,
      aliases: Array.isArray(value.aliases)
        ? value.aliases
        : typeof value.aliases === 'string'
          ? parseListField(value.aliases)
          : Array.isArray(value.alias)
            ? value.alias
            : typeof value.alias === 'string'
              ? parseListField(value.alias)
              : undefined,
      traits: Array.isArray(value.traits)
        ? value.traits
        : typeof value.traits === 'string'
          ? parseListField(value.traits)
          : Array.isArray(value.tags)
            ? value.tags
            : typeof value.tags === 'string'
              ? parseListField(value.tags)
              : undefined,
    }),
  }]);
}

function extractStickerImportEntriesFromHtml(html: string): StickerImportEntry[] {
  const entries: StickerImportEntry[] = [];
  const anchorRegex = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let matched: RegExpExecArray | null = null;

  while ((matched = anchorRegex.exec(html)) !== null) {
    const sticker = matched[1]?.trim();
    const label = matched[2]
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!sticker) {
      continue;
    }

    entries.push({
      sticker,
      ...(label
        ? {
            metadata: normalizeStickerMetadata({
              label,
            }),
          }
        : {}),
    });
  }

  return normalizeStickerImportEntries(entries);
}

async function extractDocxText(file: File): Promise<{ html: string; text: string }> {
  const mammothModule = await import('mammoth');
  const mammoth = ((mammothModule as unknown as { default?: unknown }).default ?? mammothModule) as {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
  };
  const arrayBuffer = await file.arrayBuffer();
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }),
    mammoth.extractRawText({ arrayBuffer }),
  ]);

  return {
    html: htmlResult.value || '',
    text: textResult.value || '',
  };
}

export function extractStickerImportEntriesFromText(raw: string): StickerImportEntry[] {
  const normalized = raw.replace(/\r/g, '\n');
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return normalizeStickerImportEntries(lines.flatMap((line) => extractSingleLineStickerImport(line)));
}

export function extractStickerImportEntriesFromJson(data: unknown): StickerImportEntry[] {
  if (Array.isArray(data)) {
    return normalizeStickerImportEntries(data.flatMap((item) => extractStickerImportEntryFromObject(item)));
  }

  if (isRecord(data)) {
    if (Array.isArray(data.stickers)) {
      return normalizeStickerImportEntries(data.stickers.flatMap((item) => extractStickerImportEntryFromObject(item)));
    }

    return normalizeStickerImportEntries(Object.values(data).flatMap((item) => extractStickerImportEntryFromObject(item)));
  }

  return [];
}

export async function importStickerFiles(
  files: File[],
  persistUploadedFile: (file: File) => Promise<string>,
): Promise<StickerImportEntry[]> {
  if (files.length === 0) {
    return [];
  }

  const entryGroups = await Promise.all(files.map(async (file) => {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const raw = await file.text();
      return extractStickerImportEntriesFromJson(parseJsonWithCompatibility(raw) ?? (() => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return null;
        }
      })());
    }

    if (
      file.type === 'text/plain'
      || file.type === 'text/csv'
      || file.type === 'text/markdown'
      || file.name.endsWith('.txt')
      || file.name.endsWith('.csv')
      || file.name.endsWith('.tsv')
      || file.name.endsWith('.md')
    ) {
      const raw = await file.text();
      return extractStickerImportEntriesFromText(raw);
    }

    if (file.type === DOCX_MIME_TYPE || file.name.endsWith('.docx')) {
      const docx = await extractDocxText(file);
      return normalizeStickerImportEntries([
        ...extractStickerImportEntriesFromHtml(docx.html),
        ...extractStickerImportEntriesFromText(docx.text),
      ]);
    }

    const assetRef = await persistUploadedFile(file);
    return [{ sticker: assetRef }];
  }));

  return normalizeStickerImportEntries(entryGroups.flat());
}

export function mergeStickerImportEntries(
  existingStickers: string[],
  currentMetadataMap: Record<string, StickerMetadata> | undefined,
  importedEntries: StickerImportEntry[],
): {
  stickers: string[];
  metadataMap?: Record<string, StickerMetadata>;
} {
  const nextStickers = Array.from(new Set([
    ...existingStickers.map((item) => item.trim()).filter(Boolean),
    ...importedEntries.map((entry) => entry.sticker.trim()).filter(Boolean),
  ]));

  const nextMetadataMap: Record<string, StickerMetadata> = { ...(currentMetadataMap || {}) };
  for (const entry of importedEntries) {
    const sticker = entry.sticker.trim();
    if (!sticker) {
      continue;
    }

    const merged = mergeStickerMetadata(nextMetadataMap[sticker], entry.metadata);
    if (merged) {
      nextMetadataMap[sticker] = merged;
    }
  }

  return {
    stickers: nextStickers,
    metadataMap: Object.keys(nextMetadataMap).length > 0 ? nextMetadataMap : undefined,
  };
}
