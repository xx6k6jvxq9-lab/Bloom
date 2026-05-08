import type { WorldBookEntry } from '../../types';
import type { DreamCustomTag, DreamPersonaFloor, DreamPreflightPlan, DreamSelection } from './dreamRuntimeTypes';
import { buildDreamTagSummary } from './dreamTagMeta';

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function uniqueStrings(values: Array<string | null | undefined>, limit?: number) {
  const seen = new Set<string>();
  const result = values
    .map((value) => normalizeOptionalText(value))
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });

  return typeof limit === 'number' ? result.slice(0, limit) : result;
}

function resolveCustomTagLabels(customTags: DreamCustomTag[] | undefined) {
  return uniqueStrings((customTags || []).map((tag) => tag.label));
}

function resolveActiveWorldBookTitles(worldBooks: WorldBookEntry[]) {
  return uniqueStrings(worldBooks.map((entry) => entry.title), 6);
}

export function buildDreamPreflightPlan(input: {
  selection: DreamSelection;
  worldBooks: WorldBookEntry[];
  worldBookConflictSummary?: string;
  affectedWorldBookTitles?: string[];
  personaFloor: DreamPersonaFloor;
}): DreamPreflightPlan {
  const customTagLabels = resolveCustomTagLabels(input.selection.customTags);
  const selectedLabels = uniqueStrings([
    ...buildDreamTagSummary(input.selection.selectedTags, input.selection.customTags)
      .split('\n')
      .flatMap((line) => line.split(':').slice(1).join(':').split('/').map((item) => item.trim())),
    ...customTagLabels,
  ]);

  return {
    selectedLabels,
    customTagLabels,
    supplementNote: normalizeOptionalText(input.selection.supplementNote),
    worldBookCount: input.worldBooks.length,
    activeWorldBookTitles: resolveActiveWorldBookTitles(input.worldBooks),
    worldBookConflictSummary: normalizeOptionalText(input.worldBookConflictSummary),
    affectedWorldBookTitles: uniqueStrings(input.affectedWorldBookTitles, 6),
    personaFloor: input.personaFloor,
  };
}
