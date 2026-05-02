import type { GeneratedForumAuthorDraft } from './generateForumThreads';

type BuildForumRecurringAuthorSelectionInput = {
  authors: GeneratedForumAuthorDraft[];
  seed?: string;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickDeterministicCount(seed: string) {
  const roll = hashString(seed) % 100;
  if (roll < 60) return 0;
  if (roll < 90) return 1;
  return 2;
}

export function buildForumRecurringAuthorSelection(input: BuildForumRecurringAuthorSelectionInput) {
  const { authors, seed = `${Date.now()}` } = input;
  if (!authors.length) return [];

  const desiredCount = Math.min(authors.length, pickDeterministicCount(seed));
  if (desiredCount <= 0) return [];

  const sorted = [...authors].sort((left, right) => {
    const leftScore = hashString(`${seed}:${left.id}:${left.displayName}`);
    const rightScore = hashString(`${seed}:${right.id}:${right.displayName}`);
    return leftScore - rightScore;
  });

  return sorted.slice(0, desiredCount);
}
