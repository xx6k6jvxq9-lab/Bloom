import type { MemoryRecord, MemoryRecordSourceScene } from './memoryRecordTypes';
import { queryMemoryRecords, type MemoryQueryResult, type MemoryTextQuery } from './queryMemoryRecords';

export type MemoryPromptQueryText = MemoryTextQuery;

export type MemoryPromptView = {
  matchedFacts: MemoryQueryResult[];
  stablePreferences: MemoryQueryResult[];
  relationshipWaves: MemoryQueryResult[];
  sceneProgress: MemoryQueryResult[];
  openTasks: MemoryQueryResult[];
};

function dedupeResults(results: MemoryQueryResult[]): MemoryQueryResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.record.id.trim().toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatResultLine(result: MemoryQueryResult): string {
  const matchedTermsText = result.matchedTerms.length > 0
    ? ` (matched: ${result.matchedTerms.join(', ')})`
    : '';
  return `- ${result.record.summary}${matchedTermsText}`;
}

function normalizeOptionalText(value: string | undefined | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function mergePromptQueries(input: {
  latestUserText?: string;
  retrievalQueries?: MemoryPromptQueryText[];
}): MemoryPromptQueryText[] {
  const merged = new Map<string, number>();
  const sourceQueries: MemoryPromptQueryText[] = [
    ...(normalizeOptionalText(input.latestUserText)
      ? [{
          text: normalizeOptionalText(input.latestUserText)!,
          weight: 1.5,
        } satisfies MemoryPromptQueryText]
      : []),
    ...(input.retrievalQueries || []),
  ];

  for (const query of sourceQueries) {
    const normalized = typeof query === 'string'
      ? normalizeOptionalText(query)
      : normalizeOptionalText(query.text);
    if (!normalized) {
      continue;
    }

    const weight = typeof query === 'string'
      ? 1
      : (typeof query.weight === 'number' && Number.isFinite(query.weight) ? Math.max(0.1, query.weight) : 1);
    merged.set(normalized, Math.max(weight, merged.get(normalized) || 0));
  }

  return [...merged.entries()]
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)
    .map(([text, weight]) => ({ text, weight }));
}

function filterStableMemoryResults(results: MemoryQueryResult[]): MemoryQueryResult[] {
  return results.filter((result) => (
    (
      result.record.kind === 'fact'
      && (
        result.record.factType === 'preference'
        || result.record.factType === 'background'
        || result.record.factType === 'experience'
      )
    )
    || (
      result.record.kind === 'note'
      && result.record.libraryKind === 'long-term'
    )
  ));
}

function filterOpenTaskResults(results: MemoryQueryResult[]): MemoryQueryResult[] {
  return results.filter((result) => (
    result.record.kind === 'fact'
    && result.record.factType === 'plan'
  ));
}

export function buildMemoryPromptView(
  input: {
    characterId: string;
    latestUserText?: string;
    retrievalQueries?: MemoryPromptQueryText[];
    preferredSourceScenes?: MemoryRecordSourceScene[];
    forceLatestRelationshipWaves?: boolean;
    forceLatestSceneProgress?: boolean;
    forceLatestOpenTasks?: boolean;
    nowTimestamp?: number;
    records?: MemoryRecord[];
  },
): MemoryPromptView {
  const nowTimestamp = input.nowTimestamp ?? Date.now();
  const shouldForceLatestOpenTasks = input.forceLatestOpenTasks ?? true;
  const retrievalQueries = mergePromptQueries({
    latestUserText: input.latestUserText,
    retrievalQueries: input.retrievalQueries,
  });
  const hasQueryText = retrievalQueries.length > 0;
  const thirtyDaysAgo = nowTimestamp - (30 * 24 * 60 * 60 * 1000);

  const matchedFacts = hasQueryText
    ? dedupeResults(queryMemoryRecords({
        characterId: input.characterId,
        kinds: ['fact', 'note'],
        textQueries: retrievalQueries,
        preferredSourceScenes: input.preferredSourceScenes,
        limit: 4,
      }, {
        nowTimestamp,
        records: input.records,
      }))
    : [];

  const stablePreferenceMatches = hasQueryText
    ? filterStableMemoryResults(queryMemoryRecords({
        characterId: input.characterId,
        kinds: ['fact', 'note'],
        stabilities: ['stable'],
        textQueries: retrievalQueries,
        preferredSourceScenes: input.preferredSourceScenes,
        limit: 4,
      }, {
        nowTimestamp,
        records: input.records,
      }))
    : [];
  const stablePreferenceFallback = filterStableMemoryResults(queryMemoryRecords({
    characterId: input.characterId,
    kinds: ['fact', 'note'],
    stabilities: ['stable'],
    preferredSourceScenes: input.preferredSourceScenes,
    limit: 4,
  }, {
    nowTimestamp,
    records: input.records,
  }));
  const stablePreferences = dedupeResults(
    [...stablePreferenceMatches, ...stablePreferenceFallback],
  ).slice(0, 4);

  const relationshipWaveMatches = hasQueryText
    ? queryMemoryRecords({
        characterId: input.characterId,
        kinds: ['relationship_wave'],
        textQueries: retrievalQueries,
        preferredSourceScenes: input.preferredSourceScenes,
        timeRange: { from: thirtyDaysAgo },
        limit: 4,
      }, {
        nowTimestamp,
        records: input.records,
      })
    : [];
  const relationshipWaveFallback = input.forceLatestRelationshipWaves
    ? queryMemoryRecords({
        characterId: input.characterId,
        kinds: ['relationship_wave'],
        preferredSourceScenes: input.preferredSourceScenes,
        timeRange: { from: thirtyDaysAgo },
        limit: 2,
      }, {
        nowTimestamp,
        records: input.records,
      })
    : [];
  const relationshipWaves = dedupeResults(
    relationshipWaveMatches.length > 0
      ? relationshipWaveMatches
      : relationshipWaveFallback,
  );

  const sceneProgressMatches = hasQueryText
    ? queryMemoryRecords({
        characterId: input.characterId,
        kinds: ['scene_progress'],
        textQueries: retrievalQueries,
        preferredSourceScenes: input.preferredSourceScenes,
        timeRange: { from: thirtyDaysAgo },
        limit: 3,
      }, {
        nowTimestamp,
        records: input.records,
      })
    : [];
  const sceneProgressFallback = input.forceLatestSceneProgress
    ? queryMemoryRecords({
        characterId: input.characterId,
        kinds: ['scene_progress'],
        preferredSourceScenes: input.preferredSourceScenes,
        timeRange: { from: thirtyDaysAgo },
        limit: 2,
      }, {
        nowTimestamp,
        records: input.records,
      })
    : [];
  const sceneProgress = dedupeResults(
    sceneProgressMatches.length > 0
      ? sceneProgressMatches
      : sceneProgressFallback,
  );

  const openTaskMatches = hasQueryText
    ? filterOpenTaskResults(queryMemoryRecords({
        characterId: input.characterId,
        kinds: ['fact'],
        textQueries: retrievalQueries,
        preferredSourceScenes: input.preferredSourceScenes,
        timeRange: { from: thirtyDaysAgo },
        limit: 4,
      }, {
        nowTimestamp,
        records: input.records,
      }))
    : [];
  const openTaskFallback = shouldForceLatestOpenTasks
    ? filterOpenTaskResults(queryMemoryRecords({
        characterId: input.characterId,
        kinds: ['fact'],
        preferredSourceScenes: input.preferredSourceScenes,
        timeRange: { from: thirtyDaysAgo },
        limit: 2,
      }, {
        nowTimestamp,
        records: input.records,
      }))
    : [];
  const openTasks = dedupeResults(
    openTaskMatches.length > 0
      ? openTaskMatches
      : openTaskFallback,
  );

  return {
    matchedFacts,
    stablePreferences,
    relationshipWaves,
    sceneProgress,
    openTasks,
  };
}

export function buildMemoryRetrievalPromptFromView(view: MemoryPromptView): string {
  const sections = [
    view.matchedFacts.length > 0
      ? [
          '## Retrieved Related Facts',
          'Only use these when the current message truly touches them. Do not dump them all back to the user.',
          ...view.matchedFacts.map(formatResultLine),
        ].join('\n')
      : '',
    view.stablePreferences.length > 0
      ? [
          '## Stable Preferences And Background',
          'These are long-lived tendencies or background facts you can quietly honor in tone and detail choice.',
          ...view.stablePreferences.map(formatResultLine),
        ].join('\n')
      : '',
    view.relationshipWaves.length > 0
      ? [
          '## Retrieved Relationship Waves',
          'Treat these as relationship residue and stance cues, not as literal scene continuation.',
          ...view.relationshipWaves.map(formatResultLine),
        ].join('\n')
      : '',
    view.sceneProgress.length > 0
      ? [
          '## Retrieved Scene Progress',
          'Use these as stage markers and anti-repeat constraints. Continue from them only when the current scene truly reconnects to that progression.',
          ...view.sceneProgress.map(formatResultLine),
        ].join('\n')
      : '',
    view.openTasks.length > 0
      ? [
          '## Retrieved Open Tasks',
          'These are pending plans or agreed follow-ups. Only bring them back if the current turn makes them relevant.',
          ...view.openTasks.map(formatResultLine),
        ].join('\n')
      : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}

export function buildMemoryRetrievalPrompt(
  input: {
    characterId: string;
    latestUserText?: string;
    nowTimestamp?: number;
    records?: MemoryRecord[];
  },
): string {
  return buildMemoryRetrievalPromptFromView(buildMemoryPromptView(input));
}
