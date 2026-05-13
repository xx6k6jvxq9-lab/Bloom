import type { Character } from '../../types';
import { buildShortTermSummary } from '../../services/memory/buildShortTermSummary';

export type RelationshipRecoveryContextKind = 'reconnect_accepted' | 'unblocked';

const RECOVERY_CONTEXT_MARKERS = [
  '你们刚重新恢复联系',
  '你们刚从拉黑状态里重新开了口',
];

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function mergeSummaryLines(...blocks: Array<string | undefined>): string | undefined {
  const lines = blocks
    .flatMap((block) => (block || '').split(/\r?\n+/))
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return [...new Set(lines)].join('\n');
}

function stripPreviousRecoveryContext(summary: string | undefined) {
  const normalized = normalizeOptionalText(summary);
  if (!normalized) {
    return undefined;
  }

  const keptLines = normalized
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !RECOVERY_CONTEXT_MARKERS.some((marker) => line.includes(marker)));

  return keptLines.length > 0 ? keptLines.join('\n') : undefined;
}

export function buildRelationshipRecoveryContext(kind: RelationshipRecoveryContextKind) {
  if (kind === 'unblocked') {
    return '短期余波：你们刚从拉黑状态里重新开了口，关系门刚重新打开。';
  }

  return '短期余波：你们刚重新恢复联系，这次恢复前经历过一轮关系波动。';
}

export function applyRelationshipRecoveryContext(
  character: Pick<Character, 'shortTermSummary'> & Partial<Pick<Character, 'id'>>,
  kind: RelationshipRecoveryContextKind,
) {
  const effectiveSummary = character.id
    ? buildShortTermSummary({
        id: character.id,
        shortTermSummary: character.shortTermSummary,
      }) ?? character.shortTermSummary
    : character.shortTermSummary;

  return mergeSummaryLines(
    stripPreviousRecoveryContext(effectiveSummary),
    buildRelationshipRecoveryContext(kind),
  );
}
