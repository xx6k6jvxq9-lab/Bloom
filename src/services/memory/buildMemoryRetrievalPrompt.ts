import type { MemoryRecord } from './memoryRecordTypes';
import { queryMemoryRecords, type MemoryQueryResult } from './queryMemoryRecords';

export type MemoryPromptView = {
  matchedFacts: MemoryQueryResult[];
  stablePreferences: MemoryQueryResult[];
  relationshipWaves: MemoryQueryResult[];
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

export function buildMemoryPromptView(
  input: {
    characterId: string;
    latestUserText?: string;
    nowTimestamp?: number;
    records?: MemoryRecord[];
  },
): MemoryPromptView {
  const nowTimestamp = input.nowTimestamp ?? Date.now();
  const latestUserText = input.latestUserText?.trim() || '';
  const thirtyDaysAgo = nowTimestamp - (30 * 24 * 60 * 60 * 1000);

  const matchedFacts = dedupeResults(queryMemoryRecords({
    characterId: input.characterId,
    kinds: ['fact', 'note'],
    textQuery: latestUserText,
    limit: 4,
  }, {
    nowTimestamp,
    records: input.records,
  }));

  const stablePreferences = dedupeResults(queryMemoryRecords({
    characterId: input.characterId,
    kinds: ['fact', 'note'],
    stabilities: ['stable'],
    limit: 4,
  }, {
    nowTimestamp,
    records: input.records,
  }).filter((result) => (
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
  )));

  const relationshipWaves = dedupeResults(queryMemoryRecords({
    characterId: input.characterId,
    kinds: ['relationship_wave'],
    textQuery: latestUserText,
    limit: 4,
  }, {
    nowTimestamp,
    records: input.records,
  }));

  const openTasks = dedupeResults(queryMemoryRecords({
    characterId: input.characterId,
    kinds: ['fact'],
    timeRange: { from: thirtyDaysAgo },
    limit: 4,
  }, {
    nowTimestamp,
    records: input.records,
  }).filter((result) => (
    result.record.kind === 'fact'
    && result.record.factType === 'plan'
  )));

  return {
    matchedFacts,
    stablePreferences,
    relationshipWaves,
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
