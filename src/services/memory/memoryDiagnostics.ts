import type { MemoryLayerValueSource, ResolvedMemoryLayerDiagnostics } from './types';
import type {
  MemoryRecordKind,
  MemoryRecordSourceScene,
  MemorySnapshotType,
} from './memoryRecordTypes';

export type MemoryRetrievedCounts = {
  matchedFacts: number;
  stablePreferences: number;
  relationshipWaves: number;
  sceneProgress: number;
  openTasks: number;
};

export type MemorySceneSignalCounts = {
  compatibilitySnapshots: number;
  relationshipResidue: number;
  sceneResidue?: number;
  topicAnchors: number;
  taskResidue: number;
};

export type MemorySceneProgressDiagnostic = {
  currentSignature?: string;
  previousSignature?: string;
  repeatedSignature?: boolean;
  bannedRepeatActionCount?: number;
};

export type MemoryReadDiagnosticEvent = {
  id: string;
  type: 'read';
  timestamp: number;
  sourceScene: Extract<MemoryRecordSourceScene, 'direct_chat' | 'group_chat' | 'dating'>;
  characterId: string;
  shortTermSummarySource: MemoryLayerValueSource;
  longTermMemoryProfileSource: MemoryLayerValueSource;
  fallbackToLegacy: boolean;
  shortTermSnapshotTypeUsed?: MemorySnapshotType;
  longTermSnapshotTypeUsed?: MemorySnapshotType;
  recordCounts?: ResolvedMemoryLayerDiagnostics['recordCounts'];
  sceneSignalCounts: MemorySceneSignalCounts;
  retrievedMemoryCounts: MemoryRetrievedCounts;
  sceneProgress?: MemorySceneProgressDiagnostic;
  promptSectionCount?: number;
};

export type MemoryWriteDiagnosticEvent = {
  id: string;
  type: 'settlement_write';
  timestamp: number;
  sourceScene: MemoryRecordSourceScene;
  characterId: string;
  status: 'success' | 'failed';
  plannedRecordCounts: Partial<Record<MemoryRecordKind | 'snapshot_short_term_summary' | 'snapshot_shared_state', number>>;
  snapshotCount: number;
  sharedStateIncluded: boolean;
  sceneProgressRecordCount: number;
  errorMessage?: string;
};

export type MemoryDiagnosticEvent = MemoryReadDiagnosticEvent | MemoryWriteDiagnosticEvent;

export type ListMemoryDiagnosticsQuery = {
  characterId?: string;
  sourceScene?: MemoryRecordSourceScene;
  type?: MemoryDiagnosticEvent['type'];
  status?: MemoryWriteDiagnosticEvent['status'];
  limit?: number;
};

const MAX_DIAGNOSTIC_EVENTS = 120;

let diagnosticEvents: MemoryDiagnosticEvent[] = [];

function createDiagnosticId(type: MemoryDiagnosticEvent['type'], timestamp: number): string {
  return [
    'memory-diagnostic',
    type,
    timestamp,
    Math.random().toString(36).slice(2, 8),
  ].join('|');
}

function pushMemoryDiagnosticEvent<T extends MemoryDiagnosticEvent>(
  event: Omit<T, 'id'> & { id?: string },
): T {
  const timestamp = event.timestamp || Date.now();
  const nextEvent = {
    ...event,
    timestamp,
    id: event.id ?? createDiagnosticId(event.type, timestamp),
  } as T;

  diagnosticEvents = [nextEvent, ...diagnosticEvents].slice(0, MAX_DIAGNOSTIC_EVENTS);
  return nextEvent;
}

export function recordMemoryReadDiagnostic(
  event: Omit<MemoryReadDiagnosticEvent, 'id' | 'type' | 'timestamp' | 'fallbackToLegacy'> & {
    timestamp?: number;
    fallbackToLegacy?: boolean;
  },
): MemoryReadDiagnosticEvent {
  const fallbackToLegacy = event.fallbackToLegacy
    ?? (
      event.shortTermSummarySource === 'legacy_fields'
      || event.longTermMemoryProfileSource === 'legacy_fields'
    );

  return pushMemoryDiagnosticEvent<MemoryReadDiagnosticEvent>({
    ...event,
    type: 'read',
    timestamp: event.timestamp ?? Date.now(),
    fallbackToLegacy,
  });
}

export function recordMemoryWriteDiagnostic(
  event: Omit<MemoryWriteDiagnosticEvent, 'id' | 'type' | 'timestamp'> & {
    timestamp?: number;
  },
): MemoryWriteDiagnosticEvent {
  return pushMemoryDiagnosticEvent<MemoryWriteDiagnosticEvent>({
    ...event,
    type: 'settlement_write',
    timestamp: event.timestamp ?? Date.now(),
  });
}

function matchesMemoryDiagnosticQuery(
  event: MemoryDiagnosticEvent,
  query: Omit<ListMemoryDiagnosticsQuery, 'limit'>,
): boolean {
  if (query.type && event.type !== query.type) {
    return false;
  }

  if (query.characterId && event.characterId !== query.characterId) {
    return false;
  }

  if (query.sourceScene && event.sourceScene !== query.sourceScene) {
    return false;
  }

  if (query.status) {
    if (event.type !== 'settlement_write') {
      return false;
    }

    if (event.status !== query.status) {
      return false;
    }
  }

  return true;
}

export function listMemoryDiagnostics(query: ListMemoryDiagnosticsQuery = {}): MemoryDiagnosticEvent[] {
  const limit = typeof query.limit === 'number' && Number.isFinite(query.limit)
    ? Math.max(0, Math.floor(query.limit))
    : undefined;
  const matches = diagnosticEvents.filter((event) => matchesMemoryDiagnosticQuery(event, query));

  return limit === undefined
    ? [...matches]
    : matches.slice(0, limit);
}

export function getLatestMemoryDiagnostic(
  query: Omit<ListMemoryDiagnosticsQuery, 'limit'> = {},
): MemoryDiagnosticEvent | undefined {
  return listMemoryDiagnostics({
    ...query,
    limit: 1,
  })[0];
}

export function resetMemoryDiagnostics(): void {
  diagnosticEvents = [];
}
