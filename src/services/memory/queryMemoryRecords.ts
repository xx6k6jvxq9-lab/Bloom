import { loadMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type { MemoryRecord, MemoryRecordKind, MemoryRecordSourceScene, MemoryRecordStability, MemoryRecordVisibility } from './memoryRecordTypes';

export type MemoryTextQuery = string | {
  text: string;
  weight?: number;
};

export type MemoryQuery = {
  characterId: string;
  sourceScenes?: MemoryRecordSourceScene[];
  preferredSourceScenes?: MemoryRecordSourceScene[];
  kinds?: MemoryRecordKind[];
  visibilities?: MemoryRecordVisibility[];
  stabilities?: MemoryRecordStability[];
  timeRange?: {
    from?: number;
    to?: number;
  };
  textQuery?: string;
  textQueries?: MemoryTextQuery[];
  limit?: number;
};

export type MemoryQueryResult = {
  record: MemoryRecord;
  score: number;
  matchedTerms: string[];
};

const TOKEN_REGEX = /[\p{L}\p{N}]{2,}/gu;
const CJK_BLOCK_REGEX = /[\u4e00-\u9fff]{2,}/gu;
const SOURCE_SCENE_BOOSTS = {
  direct_chat: 2.6,
  dating: 2.35,
  couple_space: 2.1,
  group_chat: 1.95,
  forum: 1.75,
  moments: 1.4,
  music_together: 1.25,
  manual: 1.1,
} satisfies Record<MemoryRecordSourceScene, number>;

type WeightedQueryTerm = {
  term: string;
  weight: number;
};

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

function normalizeTextQuery(input: MemoryTextQuery): {
  text: string;
  weight: number;
} | null {
  if (typeof input === 'string') {
    const text = normalizeText(input);
    return text
      ? {
          text,
          weight: 1,
        }
      : null;
  }

  const text = normalizeText(input.text);
  if (!text) {
    return null;
  }

  const weight = typeof input.weight === 'number' && Number.isFinite(input.weight)
    ? Math.max(0.1, input.weight)
    : 1;

  return {
    text,
    weight,
  };
}

function buildWeightedQueryTerms(query: MemoryQuery): WeightedQueryTerm[] {
  const weightedTerms = new Map<string, number>();
  const textQueries: MemoryTextQuery[] = [
    ...(query.textQuery?.trim() ? [query.textQuery] : []),
    ...(query.textQueries || []),
  ];

  for (const textQuery of textQueries) {
    const normalizedQuery = normalizeTextQuery(textQuery);
    if (!normalizedQuery) {
      continue;
    }

    for (const term of buildQueryTerms(normalizedQuery.text)) {
      const previousWeight = weightedTerms.get(term) || 0;
      weightedTerms.set(term, Math.max(previousWeight, normalizedQuery.weight));
    }
  }

  return [...weightedTerms.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .sort((left, right) => right.weight - left.weight || right.term.length - left.term.length);
}

function buildSearchableText(record: MemoryRecord): string {
  if (record.kind === 'snapshot' || record.kind === 'note') {
    return normalizeText([
      record.summary,
      record.text,
      ...(record.retrievalHints || []),
      ...(record.sceneTags || []),
    ].join('\n'));
  }

  if (record.kind === 'scene_progress') {
    return normalizeText([
      record.summary,
      record.stageLabel,
      record.currentBeat,
      record.currentSignature,
      record.previousSignature,
      ...(record.completedActions || []),
      ...(record.bannedRepeatActions || []),
      record.unresolvedTension,
      ...(record.nextStepOptions || []),
      ...(record.retrievalHints || []),
      ...(record.sceneTags || []),
    ].filter(Boolean).join('\n'));
  }

  if (record.kind === 'relationship_wave') {
    return normalizeText([
      record.summary,
      record.eventKind,
      record.valence,
      record.intensity,
      ...(record.retrievalHints || []),
      ...(record.sceneTags || []),
    ].join('\n'));
  }

  return normalizeText([
    record.summary,
    record.kind === 'fact' ? record.factType : '',
    ...(record.retrievalHints || []),
    ...(record.sceneTags || []),
  ].join('\n'));
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

function scoreRecord(
  record: MemoryRecord,
  queryTerms: WeightedQueryTerm[],
  nowTimestamp: number,
  preferredSourceScenes: MemoryRecordSourceScene[] | undefined,
): MemoryQueryResult | null {
  const searchableText = buildSearchableText(record);
  const matchedTerms: string[] = [];
  let score = 0;

  for (const queryTerm of queryTerms) {
    const term = queryTerm.term;
    if (!term) {
      continue;
    }

    if (searchableText.includes(term)) {
      matchedTerms.push(term);
      const baseScore = searchableText === term ? 10 : searchableText.startsWith(term) ? 7 : 5;
      score += baseScore * queryTerm.weight;
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

  if (record.kind === 'scene_progress') {
    score += 0.8;
  }

  if (preferredSourceScenes?.length) {
    const preferredIndex = preferredSourceScenes.indexOf(record.sourceScene);
    if (preferredIndex >= 0) {
      const preferredBoost = SOURCE_SCENE_BOOSTS[record.sourceScene] - (preferredIndex * 0.15);
      score += Math.max(0.35, preferredBoost);
    }
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
  const queryTerms = buildWeightedQueryTerms(query);
  const nowTimestamp = options.nowTimestamp ?? Date.now();

  const results = allRecords
    .filter((record) => matchesMetadata(record, query))
    .map((record) => scoreRecord(record, queryTerms, nowTimestamp, query.preferredSourceScenes))
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
