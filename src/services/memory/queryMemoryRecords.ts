import { loadMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type { MemoryRecord, MemoryRecordKind, MemoryRecordSourceScene, MemoryRecordStability, MemoryRecordVisibility } from './memoryRecordTypes';

export type MemoryQuery = {
  characterId: string;
  sourceScenes?: MemoryRecordSourceScene[];
  kinds?: MemoryRecordKind[];
  visibilities?: MemoryRecordVisibility[];
  stabilities?: MemoryRecordStability[];
  timeRange?: {
    from?: number;
    to?: number;
  };
  textQuery?: string;
  limit?: number;
};

export type MemoryQueryResult = {
  record: MemoryRecord;
  score: number;
  matchedTerms: string[];
};

const TOKEN_REGEX = /[\p{L}\p{N}]{2,}/gu;
const CJK_BLOCK_REGEX = /[\u4e00-\u9fff]{2,}/gu;

function normalizeText(value: string | undefined | null): string {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildQueryTerms(query: string): string[] {
  const normalized = normalizeText(query);
  if (!normalized) {
    return [];
  }

  const tokens = new Set<string>();
  for (const token of normalized.match(TOKEN_REGEX) || []) {
    tokens.add(token);
  }

  for (const block of normalized.match(CJK_BLOCK_REGEX) || []) {
    if (block.length <= 4) {
      tokens.add(block);
      continue;
    }

    for (let size = 4; size >= 2; size -= 1) {
      for (let index = 0; index <= block.length - size; index += 1) {
        tokens.add(block.slice(index, index + size));
      }
    }
  }

  if (tokens.size > 0) {
    return [...tokens].sort((left, right) => right.length - left.length);
  }

  return [normalized];
}

function matchesMetadata(record: MemoryRecord, query: MemoryQuery): boolean {
  if (record.characterIds.includes(query.characterId) === false) {
    return false;
  }

  if (query.sourceScenes?.length && !query.sourceScenes.includes(record.sourceScene)) {
    return false;
  }

  if (query.kinds?.length && !query.kinds.includes(record.kind)) {
    return false;
  }

  if (query.visibilities?.length && !query.visibilities.includes(record.visibility)) {
    return false;
  }

  if (query.stabilities?.length && !query.stabilities.includes(record.stability)) {
    return false;
  }

  const from = query.timeRange?.from;
  const to = query.timeRange?.to;
  if (typeof from === 'number' && record.timestamp < from) {
    return false;
  }
  if (typeof to === 'number' && record.timestamp > to) {
    return false;
  }

  return true;
}

function scoreRecord(record: MemoryRecord, queryTerms: string[], nowTimestamp: number): MemoryQueryResult | null {
  const summary = normalizeText(record.summary);
  const matchedTerms: string[] = [];
  let score = 0;

  for (const term of queryTerms) {
    if (!term) {
      continue;
    }

    if (summary.includes(term)) {
      matchedTerms.push(term);
      score += summary === term ? 10 : summary.startsWith(term) ? 7 : 5;
    }
  }

  if (queryTerms.length > 0 && matchedTerms.length === 0) {
    return null;
  }

  const ageDays = Math.max(0, (nowTimestamp - record.timestamp) / (24 * 60 * 60 * 1000));
  const recencyBonus = Math.max(0, 4 - Math.min(4, ageDays / 3));
  score += recencyBonus;

  if (record.decayHint === 'stable' || record.stability === 'stable') {
    score += 1;
  }

  if (record.kind === 'fact' && record.factType === 'preference') {
    score += 0.6;
  }

  if (record.kind === 'relationship_wave' && record.eventKind === 'bonding') {
    score += 0.4;
  }

  return {
    record,
    score,
    matchedTerms,
  };
}

export function queryMemoryRecords(
  query: MemoryQuery,
  options: {
    nowTimestamp?: number;
    records?: MemoryRecord[];
  } = {},
): MemoryQueryResult[] {
  const allRecords = options.records
    ?? (loadMemoryRecordData({
      recordsByCharacterId: {},
    }).recordsByCharacterId[query.characterId] || []);
  const queryTerms = buildQueryTerms(query.textQuery || '');
  const nowTimestamp = options.nowTimestamp ?? Date.now();

  const results = allRecords
    .filter((record) => matchesMetadata(record, query))
    .map((record) => scoreRecord(record, queryTerms, nowTimestamp))
    .filter((result): result is MemoryQueryResult => result !== null)
    .sort((left, right) => (
      right.score - left.score
      || right.record.timestamp - left.record.timestamp
      || left.record.id.localeCompare(right.record.id)
    ));

  if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
    return results.slice(0, Math.max(0, Math.floor(query.limit)));
  }

  return results;
}
