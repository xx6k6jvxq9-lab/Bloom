import type { MomentItem } from '../../types';

export type ComparableMoment = Pick<MomentItem, 'id' | 'authorId' | 'content' | 'timestamp'>;

export type SimilarRecentMomentHit = {
  momentId: string;
  authorId: string;
  preview: string;
  score: number;
  reason: 'exact' | 'same-opening' | 'high-overlap' | 'contained';
};

type FindSimilarRecentMomentOptions = {
  content: string;
  moments?: ComparableMoment[];
  now?: number;
  maxCandidates?: number;
  withinMs?: number;
};

const COMPARISON_STRIP_REGEX = /[\s"'“”‘’`~～….,，。！？!?、:：;；()（）[\]【】{}<>《》\-—_\\/|]+/g;

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.replace(/\r/g, '').replace(/\s+/g, ' ').trim();
  return normalized ? normalized : '';
}

function compactMomentText(value: string) {
  return normalizeOptionalText(value)
    .replace(COMPARISON_STRIP_REGEX, '')
    .toLowerCase();
}

function trimMomentPreview(value: string, maxChars = 56) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return '';
  }

  return normalized.length > maxChars
    ? `${normalized.slice(0, maxChars).trim()}...`
    : normalized;
}

function buildCharacterNgrams(value: string, size = 2) {
  if (!value) {
    return [];
  }

  if (value.length <= size) {
    return [value];
  }

  const grams: string[] = [];
  for (let index = 0; index <= value.length - size; index += 1) {
    grams.push(value.slice(index, index + size));
  }
  return grams;
}

function computeDiceCoefficient(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftNgrams = buildCharacterNgrams(left);
  const rightCounts = new Map<string, number>();
  buildCharacterNgrams(right).forEach((gram) => {
    rightCounts.set(gram, (rightCounts.get(gram) || 0) + 1);
  });

  let overlap = 0;
  leftNgrams.forEach((gram) => {
    const current = rightCounts.get(gram) || 0;
    if (current <= 0) {
      return;
    }

    overlap += 1;
    rightCounts.set(gram, current - 1);
  });

  return (2 * overlap) / (leftNgrams.length + buildCharacterNgrams(right).length);
}

export function buildRecentMomentAvoidanceLines(
  moments: ComparableMoment[] | undefined,
  maxItems = 3,
) {
  const previews = [...(moments || [])]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .map((moment) => trimMomentPreview(moment.content))
    .filter(Boolean)
    .slice(0, maxItems);

  if (previews.length === 0) {
    return [];
  }

  return [
    `最近公开动态预览：${previews.map((preview) => `「${preview}」`).join('；')}`,
    '这次不要重复这些动态的开头、核心意象、句型或收尾。',
  ];
}

export function findSimilarRecentMoment(options: FindSimilarRecentMomentOptions): SimilarRecentMomentHit | null {
  const candidate = compactMomentText(options.content);
  if (!candidate) {
    return null;
  }

  const now = options.now ?? Date.now();
  const withinMs = options.withinMs ?? 14 * 24 * 60 * 60 * 1000;
  const candidates = [...(options.moments || [])]
    .filter((moment) => {
      const compact = compactMomentText(moment.content);
      if (!compact) {
        return false;
      }

      if (!Number.isFinite(moment.timestamp)) {
        return true;
      }

      return now - moment.timestamp <= withinMs;
    })
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .slice(0, options.maxCandidates ?? 16);

  for (const moment of candidates) {
    const existing = compactMomentText(moment.content);
    if (!existing) {
      continue;
    }

    if (candidate === existing) {
      return {
        momentId: moment.id,
        authorId: moment.authorId,
        preview: trimMomentPreview(moment.content),
        score: 1,
        reason: 'exact',
      };
    }

    const minLength = Math.min(candidate.length, existing.length);
    if (minLength < 14) {
      continue;
    }

    const score = computeDiceCoefficient(candidate, existing);
    const sameOpening = candidate.slice(0, 10) === existing.slice(0, 10);
    const contained = candidate.includes(existing) || existing.includes(candidate);
    const lengthDelta = Math.abs(candidate.length - existing.length);

    if (contained && lengthDelta <= 18) {
      return {
        momentId: moment.id,
        authorId: moment.authorId,
        preview: trimMomentPreview(moment.content),
        score,
        reason: 'contained',
      };
    }

    if (sameOpening && score >= 0.58) {
      return {
        momentId: moment.id,
        authorId: moment.authorId,
        preview: trimMomentPreview(moment.content),
        score,
        reason: 'same-opening',
      };
    }

    if (score >= 0.82) {
      return {
        momentId: moment.id,
        authorId: moment.authorId,
        preview: trimMomentPreview(moment.content),
        score,
        reason: 'high-overlap',
      };
    }
  }

  return null;
}
