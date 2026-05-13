import type { Character } from '../../types';
import { buildDerivedMemoryLayersFromRecords } from './deriveMemoryLayersFromRecords';
import { buildLongTermMemoryProfile } from './buildLongTermMemoryProfile';
import { buildShortTermSummary } from './buildShortTermSummary';
import type { ResolvedMemoryLayers } from './types';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildResolvedMemoryLayers(
  character: Pick<Character, 'id' | 'shortTermSummary' | 'longTermMemoryProfile'>,
): ResolvedMemoryLayers {
  const derivedLayers = buildDerivedMemoryLayersFromRecords(character);
  const shortTermSummary = buildShortTermSummary(character, {
    derivedLayers,
  });
  const longTermMemoryProfile = buildLongTermMemoryProfile(character, {
    derivedLayers,
  });

  return {
    shortTermSummary,
    longTermMemoryProfile,
    diagnostics: {
      ...derivedLayers.diagnostics,
      shortTermSummarySource: shortTermSummary
        ? derivedLayers.diagnostics.shortTermSummarySource === 'empty'
          ? normalizeOptionalText(character.shortTermSummary)
            ? 'legacy_fields'
            : 'empty'
          : derivedLayers.diagnostics.shortTermSummarySource
        : 'empty',
      longTermMemoryProfileSource: longTermMemoryProfile
        ? derivedLayers.diagnostics.longTermMemoryProfileSource === 'empty'
          ? normalizeOptionalText(character.longTermMemoryProfile)
            ? 'legacy_fields'
            : 'empty'
          : derivedLayers.diagnostics.longTermMemoryProfileSource
        : 'empty',
    },
  };
}
