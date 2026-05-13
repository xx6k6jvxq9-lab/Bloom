import type { MemorySnapshotType } from './memoryRecordTypes';

export type MemoryLayerValueSource =
  | 'derived_records'
  | 'snapshot_records'
  | 'legacy_fields'
  | 'empty';

export type ResolvedMemoryLayerDiagnostics = {
  shortTermSummarySource: MemoryLayerValueSource;
  longTermMemoryProfileSource: MemoryLayerValueSource;
  shortTermSnapshotTypeUsed?: MemorySnapshotType;
  longTermSnapshotTypeUsed?: MemorySnapshotType;
  recordCounts: {
    facts: number;
    relationshipWaves: number;
    snapshots: number;
    notes: number;
  };
};

export type ResolvedMemoryLayers = {
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
  diagnostics: ResolvedMemoryLayerDiagnostics;
};
