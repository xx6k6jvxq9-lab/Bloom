# Bloom Memory System V1 Runtime Status

Updated: 2026-05-14

## 1. Scope

This document describes the current implemented state of the non-vector memory system.

It is not a future-facing brainstorm. It is the runtime contract that the repo currently follows:

- what the source of truth is
- how writes enter the system
- how reads resolve in records-first order
- which character fields are compatibility-only
- how to inspect diagnostics

## 2. Source Of Truth

The primary memory source of truth is `memoryRecords`.

Runtime behavior should treat the following as the main chain:

1. structured records in `memoryRecords`
2. snapshot records in `memoryRecords`
3. legacy character fields only as fallback

The primary record kinds are:

- `fact`
- `relationship_wave`
- `scene_progress`
- `snapshot`
- `note`

## 3. Write Paths

There are three main write paths.

### 3.1 Chat-History Derived Writes

`chatHistoryStore` derives `fact` and `relationship_wave` records from persisted direct/group history and keeps those derived records refreshed.

Files:

- `src/features/persistence/chatHistoryStore.ts`
- `src/services/memory/buildMemoryRecordData.ts`

### 3.2 Scene Settlement Writes

Scenes such as direct chat settlement, group chat, dating, forum, and couple-space produce structured settlement payloads and then persist them through the shared settlement write path.

The shared write entry is:

- `src/services/memory/sceneSettlement.ts`

This path is responsible for:

- snapshot carryover
- short-term summary snapshot
- shared state snapshot
- structured `fact`
- structured `relationship_wave`
- structured `scene_progress`

### 3.3 Manual/User Writes

Manual summary edits, memory imports, and shared-state rebuild actions also write into `memoryRecords`.

Files:

- `src/components/chat/ChatSettingsPanel.tsx`
- `src/services/memory/memoryRecordSnapshots.ts`

## 4. Read Order

The intended read order is:

1. `derived_records`
2. `snapshot_records`
3. `legacy_fields`

This applies to:

- short-term summary resolution
- long-term profile resolution
- open-loop reconstruction
- shared-state reconstruction
- scene signal projection

Primary files:

- `src/services/memory/buildResolvedMemoryLayers.ts`
- `src/services/memory/buildResolvedOpenLoopRegistry.ts`
- `src/services/relationship-context/buildRelationshipProjection.ts`
- `src/services/relationship-context/buildSharedCharacterState.ts`

## 5. Retrieval Model

This system is intentionally non-vector for now.

Current retrieval uses:

- metadata filtering
- weighted text queries
- preferred source-scene boosts
- recent-scene fallback recall
- records-first structured signal recovery

The main retrieval entry is:

- `src/services/memory/buildMemoryRetrievalPrompt.ts`

The low-level query engine is:

- `src/services/memory/queryMemoryRecords.ts`

Current retrieval supports:

- multiple weighted query texts
- stronger searchable text for `scene_progress`
- `retrievalHints`
- `sceneTags`
- preferred source-scene ordering
- optional latest-wave / latest-scene-progress / latest-open-task fallback recall

## 6. Compatibility Fields

The following fields still exist on `Character`, but should be treated as compatibility layers rather than the primary runtime source:

- `memorySummary`
- `shortTermSummary`
- `longTermMemoryProfile`
- `memoryLibraryEntries`
- `openLoopRegistry`
- `sharedState`
- `sharedContextSnapshots`

Their roles today are:

- migration support
- export/import compatibility
- UI compatibility
- fallback when records are unavailable

They should not be used as the first-choice source when records already exist.

## 7. Diagnostics

The repo includes an in-memory diagnostics ring buffer for memory reads and settlement writes.

Files:

- `src/services/memory/memoryDiagnostics.ts`

Read diagnostics capture:

- short-term source
- long-term source
- fallback-to-legacy flag
- retrieved-memory counts
- scene-signal counts
- dating scene-progress anti-repeat info

Write diagnostics capture:

- planned record counts
- snapshot count
- scene-progress count
- success/failure status
- error message

## 8. Current Acceptance Commands

Use these commands for quick verification:

```bash
npm run lint
npm test
```

## 9. Practical Maintenance Rule

When modifying memory behavior:

- prefer changing record generation, query behavior, or records-first projection
- avoid adding new business reads from legacy character fields
- keep legacy-field reads isolated to compatibility or explicit fallback paths

