import type { WorldBookEntry } from '../../types';
import { buildWorldBookChunkCache } from './worldBookBudget';
import { applyDerivedWorldBookMetadata, buildWorldBookFingerprint, tokenizeWorldBookRecallText } from './worldBookDerived';
import { getWorldBookPriorityWeight, normalizeWorldBookCategory, normalizeWorldBookPriorityLevel } from './worldBookMeta';

export type WorldBookAutoMergeAction = 'insert' | 'update' | 'skip';

export type WorldBookAutoMergeReason =
  | 'same_id'
  | 'same_fingerprint'
  | 'same_title_loose_content'
  | 'same_title_subset_content'
  | 'same_title_high_similarity';

export type WorldBookAutoMergeDecision = {
  action: WorldBookAutoMergeAction;
  reason: WorldBookAutoMergeReason | 'new_entry';
  incomingId: string;
  incomingTitle: string;
  targetId?: string;
  targetTitle?: string;
};

export type WorldBookLibraryMergeResult = {
  entries: WorldBookEntry[];
  stats: {
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
    decisions: WorldBookAutoMergeDecision[];
  };
};

type WorldBookMatch = {
  entry: WorldBookEntry;
  reason: WorldBookAutoMergeReason;
  similarity?: number;
};

const LOOSE_SUBSET_MIN_LENGTH = 12;
const HIGH_SIMILARITY_THRESHOLD = 0.82;
const HIGH_SIMILARITY_MIN_SHARED_TOKENS = 4;

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function normalizeTitleKey(title: string | null | undefined): string {
  return normalizeOptionalText(title)
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeLooseContent(value: string | null | undefined): string {
  return normalizeOptionalText(value)
    .toLowerCase()
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)、]\s+/gm, '')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '');
}

function hasLooseSubset(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }

  return left.length >= LOOSE_SUBSET_MIN_LENGTH
    && right.length >= LOOSE_SUBSET_MIN_LENGTH
    && (left.includes(right) || right.includes(left));
}

function splitMergeSegments(content: string): string[] {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length > 1) {
    return blocks;
  }

  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergeUniqueContent(primary: string, secondary: string): string {
  const seen = new Set<string>();
  const merged: string[] = [];

  [primary, secondary].forEach((content) => {
    splitMergeSegments(content).forEach((segment) => {
      const key = normalizeLooseContent(segment);
      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      merged.push(segment);
    });
  });

  return merged.join('\n\n').trim();
}

function computeTokenSimilarity(left: string, right: string): { similarity: number; sharedCount: number } {
  const leftTokens = new Set(tokenizeWorldBookRecallText(left));
  const rightTokens = new Set(tokenizeWorldBookRecallText(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return { similarity: 0, sharedCount: 0 };
  }

  let sharedCount = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      sharedCount += 1;
    }
  });

  const unionCount = new Set([...leftTokens, ...rightTokens]).size;
  return {
    similarity: unionCount > 0 ? sharedCount / unionCount : 0,
    sharedCount,
  };
}

function choosePreferredTitle(existing: WorldBookEntry, incoming: WorldBookEntry): string {
  const existingTitle = normalizeOptionalText(existing.title);
  const incomingTitle = normalizeOptionalText(incoming.title);

  if (!existingTitle) return incomingTitle;
  if (!incomingTitle) return existingTitle;

  const existingKey = normalizeTitleKey(existingTitle);
  const incomingKey = normalizeTitleKey(incomingTitle);

  if (existingKey === incomingKey) {
    return incomingTitle.length >= existingTitle.length ? incomingTitle : existingTitle;
  }

  return incomingTitle.length > existingTitle.length ? incomingTitle : existingTitle;
}

function choosePreferredCategory(existing: WorldBookEntry, incoming: WorldBookEntry): string {
  const existingCategory = normalizeWorldBookCategory(existing.category);
  const incomingCategory = normalizeWorldBookCategory(incoming.category);

  if (existingCategory === '其他') return incomingCategory;
  if (incomingCategory === '其他') return existingCategory;
  if (existingCategory === incomingCategory) return incomingCategory;

  return incomingCategory;
}

function chooseMergedContent(existing: WorldBookEntry, incoming: WorldBookEntry, reason: WorldBookAutoMergeReason): string {
  const existingContent = normalizeOptionalText(existing.content);
  const incomingContent = normalizeOptionalText(incoming.content);
  const existingLoose = normalizeLooseContent(existingContent);
  const incomingLoose = normalizeLooseContent(incomingContent);

  if (!existingContent) return incomingContent;
  if (!incomingContent) return existingContent;

  if (existingLoose === incomingLoose) {
    return incomingContent.length >= existingContent.length ? incomingContent : existingContent;
  }

  if (reason === 'same_title_subset_content' || hasLooseSubset(existingLoose, incomingLoose)) {
    return incomingContent.length >= existingContent.length ? incomingContent : existingContent;
  }

  if (reason === 'same_title_high_similarity') {
    return mergeUniqueContent(incomingContent, existingContent) || incomingContent || existingContent;
  }

  return mergeUniqueContent(incomingContent, existingContent) || incomingContent || existingContent;
}

function finalizeWorldBookEntry(entry: WorldBookEntry): WorldBookEntry {
  const normalized = applyDerivedWorldBookMetadata({
    ...entry,
    title: normalizeOptionalText(entry.title),
    content: normalizeOptionalText(entry.content),
    category: normalizeWorldBookCategory(entry.category),
    priorityLevel: normalizeWorldBookPriorityLevel(entry.priorityLevel),
    isActive: entry.isActive !== false,
    isGlobal: entry.isGlobal !== false,
    characterIds: Array.from(new Set((entry.characterIds || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))),
    pinMode: entry.pinMode === 'always' ? 'always' : 'none',
  });

  return {
    ...normalized,
    chunkCache: buildWorldBookChunkCache({
      id: normalized.id,
      title: normalized.title,
      content: normalized.content,
      category: normalized.category,
      keywords: normalized.keywords,
    }),
  };
}

function entriesEquivalent(left: WorldBookEntry, right: WorldBookEntry): boolean {
  return JSON.stringify({
    title: normalizeOptionalText(left.title),
    content: normalizeOptionalText(left.content),
    category: normalizeWorldBookCategory(left.category),
    priorityLevel: normalizeWorldBookPriorityLevel(left.priorityLevel),
    isActive: left.isActive !== false,
    isGlobal: left.isGlobal !== false,
    characterIds: [...(left.characterIds || [])].sort(),
    pinMode: left.pinMode === 'always' ? 'always' : 'none',
    summary: normalizeOptionalText(left.summary),
    mustReadFacts: left.mustReadFacts || [],
    keywords: left.keywords || [],
    fingerprint: left.fingerprint || buildWorldBookFingerprint(left),
  }) === JSON.stringify({
    title: normalizeOptionalText(right.title),
    content: normalizeOptionalText(right.content),
    category: normalizeWorldBookCategory(right.category),
    priorityLevel: normalizeWorldBookPriorityLevel(right.priorityLevel),
    isActive: right.isActive !== false,
    isGlobal: right.isGlobal !== false,
    characterIds: [...(right.characterIds || [])].sort(),
    pinMode: right.pinMode === 'always' ? 'always' : 'none',
    summary: normalizeOptionalText(right.summary),
    mustReadFacts: right.mustReadFacts || [],
    keywords: right.keywords || [],
    fingerprint: right.fingerprint || buildWorldBookFingerprint(right),
  });
}

function buildMergedEntry(existing: WorldBookEntry, incoming: WorldBookEntry, reason: WorldBookAutoMergeReason): WorldBookEntry {
  const incomingGlobal = incoming.isGlobal !== false;
  const existingGlobal = existing.isGlobal !== false;
  const mergedCharacterIds = existingGlobal || incomingGlobal
    ? []
    : Array.from(new Set([...(existing.characterIds || []), ...(incoming.characterIds || [])]));

  return finalizeWorldBookEntry({
    ...existing,
    id: existing.id,
    title: choosePreferredTitle(existing, incoming),
    content: chooseMergedContent(existing, incoming, reason),
    category: choosePreferredCategory(existing, incoming),
    priorityLevel: getWorldBookPriorityWeight(incoming.priorityLevel) >= getWorldBookPriorityWeight(existing.priorityLevel)
      ? normalizeWorldBookPriorityLevel(incoming.priorityLevel)
      : normalizeWorldBookPriorityLevel(existing.priorityLevel),
    isActive: existing.isActive !== false || incoming.isActive !== false,
    isGlobal: existingGlobal || incomingGlobal,
    characterIds: mergedCharacterIds,
    pinMode: existing.pinMode === 'always' || incoming.pinMode === 'always' ? 'always' : 'none',
  });
}

function findBestWorldBookMatch(existingEntries: WorldBookEntry[], incoming: WorldBookEntry): WorldBookMatch | null {
  const incomingId = normalizeOptionalText(incoming.id);
  if (incomingId) {
    const byId = existingEntries.find((entry) => normalizeOptionalText(entry.id) === incomingId);
    if (byId) {
      return { entry: byId, reason: 'same_id' };
    }
  }

  const incomingFingerprint = incoming.fingerprint || buildWorldBookFingerprint(incoming);
  if (incomingFingerprint) {
    const byFingerprint = existingEntries.find((entry) => (entry.fingerprint || buildWorldBookFingerprint(entry)) === incomingFingerprint);
    if (byFingerprint) {
      return { entry: byFingerprint, reason: 'same_fingerprint' };
    }
  }

  const incomingTitleKey = normalizeTitleKey(incoming.title);
  if (!incomingTitleKey) {
    return null;
  }

  const sameTitleEntries = existingEntries.filter((entry) => normalizeTitleKey(entry.title) === incomingTitleKey);
  if (sameTitleEntries.length === 0) {
    return null;
  }

  const incomingLoose = normalizeLooseContent(incoming.content);
  for (const entry of sameTitleEntries) {
    if (normalizeLooseContent(entry.content) === incomingLoose) {
      return { entry, reason: 'same_title_loose_content' };
    }
  }

  for (const entry of sameTitleEntries) {
    if (hasLooseSubset(normalizeLooseContent(entry.content), incomingLoose)) {
      return { entry, reason: 'same_title_subset_content' };
    }
  }

  let bestMatch: WorldBookMatch | null = null;
  sameTitleEntries.forEach((entry) => {
    const similarity = computeTokenSimilarity(entry.content, incoming.content);
    if (
      similarity.sharedCount >= HIGH_SIMILARITY_MIN_SHARED_TOKENS
      && similarity.similarity >= HIGH_SIMILARITY_THRESHOLD
      && (!bestMatch || (bestMatch.similarity || 0) < similarity.similarity)
    ) {
      bestMatch = {
        entry,
        reason: 'same_title_high_similarity',
        similarity: similarity.similarity,
      };
    }
  });

  return bestMatch;
}

export function getWorldBookAutoMergeReasonLabel(reason: WorldBookAutoMergeDecision['reason']): string {
  switch (reason) {
    case 'same_id':
      return '命中相同 ID';
    case 'same_fingerprint':
      return '正文完全重复';
    case 'same_title_loose_content':
      return '同名且内容等价';
    case 'same_title_subset_content':
      return '同名且一版内容更完整';
    case 'same_title_high_similarity':
      return '同名且高度相似';
    case 'new_entry':
    default:
      return '新条目';
  }
}

export function previewWorldBookAutoMerge(
  existingEntries: WorldBookEntry[],
  incomingEntry: WorldBookEntry,
): WorldBookAutoMergeDecision {
  const finalizedIncoming = finalizeWorldBookEntry(incomingEntry);
  const match = findBestWorldBookMatch(existingEntries.map(finalizeWorldBookEntry), finalizedIncoming);

  if (!match) {
    return {
      action: 'insert',
      reason: 'new_entry',
      incomingId: finalizedIncoming.id,
      incomingTitle: finalizedIncoming.title,
    };
  }

  const mergedEntry = buildMergedEntry(match.entry, finalizedIncoming, match.reason);
  return {
    action: entriesEquivalent(match.entry, mergedEntry) ? 'skip' : 'update',
    reason: match.reason,
    incomingId: finalizedIncoming.id,
    incomingTitle: finalizedIncoming.title,
    targetId: match.entry.id,
    targetTitle: match.entry.title,
  };
}

export function mergeImportedWorldBooksIntoLibrary(
  existingEntries: WorldBookEntry[],
  incomingEntries: WorldBookEntry[],
): WorldBookLibraryMergeResult {
  const workingEntries = existingEntries.map((entry) => finalizeWorldBookEntry(entry));
  const insertedEntries: WorldBookEntry[] = [];
  const decisions: WorldBookAutoMergeDecision[] = [];
  let updatedCount = 0;
  let skippedCount = 0;

  incomingEntries.forEach((incomingEntry) => {
    const finalizedIncoming = finalizeWorldBookEntry(incomingEntry);
    const currentLibrary = [...workingEntries, ...insertedEntries];
    const match = findBestWorldBookMatch(currentLibrary, finalizedIncoming);

    if (!match) {
      insertedEntries.push(finalizedIncoming);
      decisions.push({
        action: 'insert',
        reason: 'new_entry',
        incomingId: finalizedIncoming.id,
        incomingTitle: finalizedIncoming.title,
      });
      return;
    }

    const mergedEntry = buildMergedEntry(match.entry, finalizedIncoming, match.reason);
    const targetInInsertedIndex = insertedEntries.findIndex((entry) => entry.id === match.entry.id);
    const targetInExistingIndex = workingEntries.findIndex((entry) => entry.id === match.entry.id);
    const equivalent = entriesEquivalent(match.entry, mergedEntry);

    if (equivalent) {
      skippedCount += 1;
      decisions.push({
        action: 'skip',
        reason: match.reason,
        incomingId: finalizedIncoming.id,
        incomingTitle: finalizedIncoming.title,
        targetId: match.entry.id,
        targetTitle: match.entry.title,
      });
      return;
    }

    if (targetInInsertedIndex >= 0) {
      insertedEntries[targetInInsertedIndex] = mergedEntry;
    } else if (targetInExistingIndex >= 0) {
      workingEntries[targetInExistingIndex] = mergedEntry;
    }

    updatedCount += 1;
    decisions.push({
      action: 'update',
      reason: match.reason,
      incomingId: finalizedIncoming.id,
      incomingTitle: finalizedIncoming.title,
      targetId: match.entry.id,
      targetTitle: match.entry.title,
    });
  });

  return {
    entries: [...insertedEntries, ...workingEntries],
    stats: {
      insertedCount: insertedEntries.length,
      updatedCount,
      skippedCount,
      decisions,
    },
  };
}
