import type { DreamSelection, DreamCustomTag } from './dreamRuntimeTypes';

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function normalizeDreamCustomTags(customTags: DreamSelection['customTags']): DreamCustomTag[] {
  if (!Array.isArray(customTags)) return [];

  const seen = new Set<string>();

  return customTags
    .map((tag, index) => {
      const label = normalizeOptionalText(tag?.label);
      const category = tag?.category;
      if (!label || !category || category === 'world') return null;

      const id = normalizeOptionalText(tag.id) || `custom-tag-${category}-${index + 1}`;
      const fingerprint = `${category}::${label.toLowerCase()}`;
      if (seen.has(fingerprint)) return null;
      seen.add(fingerprint);

      return {
        id,
        category,
        label,
      } satisfies DreamCustomTag;
    })
    .filter((tag): tag is DreamCustomTag => Boolean(tag));
}

export function resolveDreamSelection(selection: DreamSelection, _seed: string): DreamSelection {
  return {
    ...selection,
    customTags: normalizeDreamCustomTags(selection.customTags),
    supplementNote: normalizeOptionalText(selection.supplementNote),
  };
}
