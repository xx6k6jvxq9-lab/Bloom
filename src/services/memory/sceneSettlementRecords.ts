import type { CharacterSharedState } from '../../types';
import { decideFactTraceWrite } from '../relationship-context/buildFactTraceWriteRules';
import { decideRelationshipWaveWrite } from '../relationship-context/buildRelationshipWaveWriteRules';
import type { FactTraceRecord } from '../relationship-context/factTypes';
import type {
  CharacterSharedContextSnapshot,
  RelationshipResidueItem,
  RelationshipWaveRecord,
  RelationshipWaveSourceScene,
  SceneResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import type { MemoryRecord, MemoryRecordSourceSessionType } from './memoryRecordTypes';
import type { MemoryRecordSourceScene } from './memoryRecordTypes';
import { mapFactTraceToMemoryRecord, mapRelationshipWaveToMemoryRecord } from './buildMemoryRecordData';

type SettlementScene = CharacterSharedContextSnapshot['sourceScene'];

function inferSourceSessionType(
  sourceScene: SettlementScene,
  explicitType?: MemoryRecordSourceSessionType,
): MemoryRecordSourceSessionType {
  if (explicitType) {
    return explicitType;
  }

  return sourceScene === 'group_chat' ? 'group' : 'direct';
}

function inferWaveEventKind(summary: string): RelationshipWaveRecord['eventKind'] {
  if (/(和好|缓和|别气了|算了|不闹了)/.test(summary)) return 'reconcile';
  if (/(吃醋|介意|酸|别理他|别靠近别人)/.test(summary)) return 'jealousy';
  if (/(烦你|生气|顶嘴|不想理|别说了)/.test(summary)) return 'conflict';
  if (/(护着|照顾|替你|让你先|递给你)/.test(summary)) return 'protect';
  if (/(支持你|站你|懂你)/.test(summary)) return 'support';
  if (/(逗你|调侃|嘴硬|揶揄)/.test(summary)) return 'tease';
  if (/(更亲密|靠近|关系往前|关系过渡|默契|熟了|推进到的阶段)/.test(summary)) return 'bonding';
  return 'shared_experience';
}

function inferWaveValence(eventKind: RelationshipWaveRecord['eventKind']): RelationshipWaveRecord['valence'] {
  if (eventKind === 'conflict' || eventKind === 'jealousy') return 'negative';
  if (eventKind === 'reconcile') return 'mixed';
  return 'positive';
}

function inferWaveIntensity(summary: string): RelationshipWaveRecord['intensity'] {
  if (/(特别|明显|真的|已经|更亲密|正式关系)/.test(summary)) return 'high';
  if (summary.length >= 24) return 'medium';
  return 'low';
}

function inferRelationType(sourceScene: SettlementScene): RelationshipWaveRecord['relationType'] {
  return sourceScene === 'group_chat' || sourceScene === 'forum'
    ? 'public_group_event'
    : 'character_user';
}

function relationshipResidueToWaveRecord(params: {
  item: RelationshipResidueItem;
  characterId: string;
}): RelationshipWaveRecord | null {
  const eventKind = inferWaveEventKind(params.item.summary);
  const decision = decideRelationshipWaveWrite({
    sourceScene: params.item.sourceScene,
    relationType: inferRelationType(params.item.sourceScene),
    sourceCharacterId: params.characterId,
    ...(params.item.sourceScene === 'group_chat' || params.item.sourceScene === 'forum'
      ? {}
      : { targetUser: true }),
    eventKind,
    valence: inferWaveValence(eventKind),
    intensity: inferWaveIntensity(params.item.summary),
    scope: params.item.visibility,
    summary: params.item.summary,
    timestamp: params.item.timestamp,
    decayHint: params.item.decay,
    isExplicit: true,
    isPublic: params.item.visibility !== 'private',
  });

  return decision.shouldWrite ? decision.record : null;
}

function sceneResidueToFactRecord(params: {
  item: SceneResidueItem;
  characterId: string;
}): FactTraceRecord | null {
  const decision = decideFactTraceWrite({
    sourceScene: params.item.sourceScene,
    factType: 'experience',
    subjectType: 'character',
    subjectId: params.characterId,
    relatedCharacterIds: [params.characterId],
    visibility: params.item.visibility,
    stability: params.item.decay === 'stable' ? 'stable' : 'situational',
    confidence: 'explicit',
    summary: params.item.summary,
    timestamp: params.item.timestamp,
    decayHint: params.item.decay,
    isExplicit: true,
    isPublic: params.item.visibility !== 'private',
  });

  return decision.shouldWrite ? decision.record : null;
}

function topicAnchorToFactRecord(params: {
  item: TopicAnchorItem;
  characterId: string;
}): FactTraceRecord | null {
  const decision = decideFactTraceWrite({
    sourceScene: params.item.sourceScene,
    factType: 'experience',
    subjectType: 'character',
    subjectId: params.characterId,
    relatedCharacterIds: [params.characterId],
    visibility: params.item.visibility,
    stability: 'temporary',
    confidence: 'explicit',
    summary: params.item.summary,
    timestamp: params.item.timestamp,
    decayHint: params.item.decay,
    isExplicit: true,
    isPublic: params.item.visibility !== 'private',
  });

  return decision.shouldWrite ? decision.record : null;
}

function taskResidueToFactRecord(params: {
  item: TaskResidueItem;
  characterId: string;
}): FactTraceRecord | null {
  const decision = decideFactTraceWrite({
    sourceScene: params.item.sourceScene,
    factType: 'plan',
    subjectType: 'character',
    subjectId: params.characterId,
    relatedCharacterIds: [params.characterId],
    visibility: params.item.visibility,
    stability: params.item.decay === 'stable' ? 'stable' : 'temporary',
    confidence: 'explicit',
    summary: params.item.summary,
    timestamp: params.item.timestamp,
    decayHint: params.item.decay,
    isExplicit: true,
    isPublic: params.item.visibility !== 'private',
  });

  return decision.shouldWrite ? decision.record : null;
}

function getLatestSettlementSnapshot(
  snapshots: CharacterSharedContextSnapshot[] | undefined,
  timestamp?: number,
): CharacterSharedContextSnapshot | undefined {
  if (!snapshots?.length) {
    return undefined;
  }

  if (typeof timestamp === 'number') {
    const matched = snapshots.find((snapshot) => snapshot.settledAt === timestamp);
    if (matched) {
      return matched;
    }
  }

  return snapshots[0];
}

export function buildStructuredRecordsFromSceneSettlement(input: {
  characterId: string;
  sourceScene: MemoryRecordSourceScene;
  settlement: {
    sharedContextSnapshots?: CharacterSharedContextSnapshot[];
    sharedState?: CharacterSharedState;
  };
  sourceSessionType?: MemoryRecordSourceSessionType;
  sourceSessionId?: string;
  timestamp?: number;
}): MemoryRecord[] {
  if (input.sourceScene === 'manual') {
    return [];
  }

  const snapshot = getLatestSettlementSnapshot(input.settlement.sharedContextSnapshots, input.timestamp);
  if (!snapshot) {
    return [];
  }

  const sourceSessionType = inferSourceSessionType(input.sourceScene, input.sourceSessionType);
  const sourceSessionId = input.sourceSessionId ?? input.characterId;
  const relationshipRecords = (snapshot.relationshipResidue || [])
    .map((item) => relationshipResidueToWaveRecord({
      item,
      characterId: input.characterId,
    }))
    .filter((record): record is RelationshipWaveRecord => record !== null)
    .map((record) => mapRelationshipWaveToMemoryRecord({
      record,
      sourceSessionType,
      sourceSessionId,
      fallbackCharacterId: input.characterId,
    }))
    .filter((record): record is MemoryRecord => record !== null);

  const factSourceItems = [
    ...(snapshot.sceneResidue || []).map((item) => sceneResidueToFactRecord({
      item,
      characterId: input.characterId,
    })),
    ...(snapshot.topicAnchors || []).map((item) => topicAnchorToFactRecord({
      item,
      characterId: input.characterId,
    })),
    ...(snapshot.taskResidue || []).map((item) => taskResidueToFactRecord({
      item,
      characterId: input.characterId,
    })),
  ].filter((record): record is FactTraceRecord => record !== null);

  const factRecords = factSourceItems
    .map((record) => mapFactTraceToMemoryRecord({
      record,
      sourceSessionType,
      sourceSessionId,
      fallbackCharacterId: input.characterId,
    }))
    .filter((record): record is MemoryRecord => record !== null);

  return [
    ...relationshipRecords,
    ...factRecords,
  ];
}
