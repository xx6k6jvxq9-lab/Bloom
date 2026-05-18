import type { Character, GroupOfflineSession } from '../../types';
import { decideFactTraceWrite } from '../relationship-context/buildFactTraceWriteRules';
import { decideRelationshipWaveWrite } from '../relationship-context/buildRelationshipWaveWriteRules';
import type { FactTraceRecord } from '../relationship-context/factTypes';
import type { RelationshipWaveEventKind, RelationshipWaveRecord } from '../relationship-context/types';
import {
  buildGroupOfflineWritebackPlan,
  type GroupOfflineWritebackPlan,
} from './groupOfflineWritebackPlan';

const MAX_GROUP_CONTEXT_WAVES = 24;
const MAX_GROUP_CONTEXT_FACTS = 24;

function normalizeText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function buildWaveKey(record: RelationshipWaveRecord): string {
  return [
    record.sourceScene,
    record.relationType,
    record.sourceCharacterId,
    record.targetCharacterId || '',
    record.targetUser ? 'user' : '',
    record.groupId || '',
    record.eventKind,
    normalizeText(record.summary),
  ].join('|');
}

function buildFactKey(record: FactTraceRecord): string {
  return [
    record.sourceScene,
    record.factType,
    record.subjectType,
    record.subjectId,
    record.groupId || '',
    normalizeText(record.summary),
  ].join('|');
}

export function mergeRelationshipWaveRecords(
  existing: RelationshipWaveRecord[] | undefined,
  incoming: RelationshipWaveRecord[] | undefined,
  limit = MAX_GROUP_CONTEXT_WAVES,
): RelationshipWaveRecord[] {
  const merged = [...(existing || []), ...(incoming || [])]
    .filter((record) => !!normalizeText(record.summary));
  const seen = new Set<string>();
  return merged
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .filter((record) => {
      const key = buildWaveKey(record);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function mergeFactTraceRecords(
  existing: FactTraceRecord[] | undefined,
  incoming: FactTraceRecord[] | undefined,
  limit = MAX_GROUP_CONTEXT_FACTS,
): FactTraceRecord[] {
  const merged = [...(existing || []), ...(incoming || [])]
    .filter((record) => !!normalizeText(record.summary));
  const seen = new Set<string>();
  return merged
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .filter((record) => {
      const key = buildFactKey(record);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function inferWaveEventKind(summary: string, fallbackKind: 'user' | 'pair' | 'group'): RelationshipWaveEventKind {
  if (/(和好|缓和|别气了|算了|不闹了|松口)/.test(summary)) return 'reconcile';
  if (/(吃醋|介意|酸|别理他|别靠近别人)/.test(summary)) return 'jealousy';
  if (/(烦你|生气|顶嘴|不想理|别说了|翻篇)/.test(summary)) return 'conflict';
  if (/(护着|照顾|别在外面|先回去|到家|安全|看着你回去)/.test(summary)) return 'protect';
  if (/(站你|懂你|替你接住|顺着你)/.test(summary)) return 'support';
  if (/(逗你|调侃|嘴硬|起哄)/.test(summary)) return 'tease';
  if (/(更亲近|靠近|熟了|后劲还在|挂着|没散)/.test(summary)) return 'bonding';
  if (fallbackKind === 'user') return 'protect';
  if (fallbackKind === 'pair') return 'bonding';
  return 'shared_experience';
}

function inferWaveValence(eventKind: RelationshipWaveEventKind): RelationshipWaveRecord['valence'] {
  if (eventKind === 'conflict' || eventKind === 'jealousy') return 'negative';
  if (eventKind === 'reconcile') return 'mixed';
  return 'positive';
}

function inferWaveIntensity(summary: string): RelationshipWaveRecord['intensity'] {
  if (/(明显|真的|一直|还在|没散|更近了|更僵了)/.test(summary)) return 'high';
  if (summary.length >= 24) return 'medium';
  return 'low';
}

function buildParticipantRelationshipWaves(params: {
  session: GroupOfflineSession;
  members: Character[];
  writebackPlan: GroupOfflineWritebackPlan;
}): RelationshipWaveRecord[] {
  const memberMap = new Map(params.members.map((member) => [member.id, member]));
  const waves = Object.values(params.writebackPlan.participantEvidenceByCharacterId)
    .flatMap((evidence) => {
      const member = memberMap.get(evidence.characterId);
      if (!member || !evidence.preferredCarryoverText) {
        return [];
      }

      const summarySeed = normalizeText(evidence.preferredCarryoverText)
        || normalizeText(evidence.latestHighlightText)
        || normalizeText(evidence.latestEntryText);
      if (!summarySeed) {
        return [];
      }

      if (evidence.latestTargetType === 'user') {
        const summary = `${member.remarkName?.trim() || member.name}在这场群线下散场后，对用户那条线还没收住：${summarySeed}`;
        const eventKind = inferWaveEventKind(summary, 'user');
        const decision = decideRelationshipWaveWrite({
          sourceScene: 'group_offline',
          relationType: 'character_user',
          sourceCharacterId: member.id,
          targetUser: true,
          groupId: params.session.groupId,
          eventKind,
          valence: inferWaveValence(eventKind),
          intensity: inferWaveIntensity(summary),
          scope: 'cross_scene_readable',
          summary,
          timestamp: params.session.endedAt || Date.now(),
          decayHint: 'medium',
          isExplicit: true,
          isPublic: true,
        });
        return decision.shouldWrite ? [decision.record] : [];
      }

      if (evidence.latestTargetType === 'character' && evidence.latestTargetCharacterId) {
        const targetMember = memberMap.get(evidence.latestTargetCharacterId);
        const targetLabel = targetMember?.remarkName?.trim() || targetMember?.name || evidence.latestTargetLabel || '另一个角色';
        const summary = `${member.remarkName?.trim() || member.name}在这场群线下散场后，对${targetLabel}那条线还挂着：${summarySeed}`;
        const eventKind = inferWaveEventKind(summary, 'pair');
        const decision = decideRelationshipWaveWrite({
          sourceScene: 'group_offline',
          relationType: 'character_character',
          sourceCharacterId: member.id,
          targetCharacterId: evidence.latestTargetCharacterId,
          groupId: params.session.groupId,
          eventKind,
          valence: inferWaveValence(eventKind),
          intensity: inferWaveIntensity(summary),
          scope: 'cross_scene_readable',
          summary,
          timestamp: params.session.endedAt || Date.now(),
          decayHint: 'medium',
          isExplicit: true,
          isPublic: true,
        });
        return decision.shouldWrite ? [decision.record] : [];
      }

      return [];
    });

  return mergeRelationshipWaveRecords([], waves);
}

function buildSharedEventFactTrace(params: {
  session: GroupOfflineSession;
  participantIds: string[];
  writebackPlan: GroupOfflineWritebackPlan;
}): FactTraceRecord[] {
  const summary = normalizeText(params.writebackPlan.sharedEventSummary);
  if (!summary) {
    return [];
  }

  const decision = decideFactTraceWrite({
    sourceScene: 'group_offline',
    factType: 'experience',
    subjectType: 'group',
    subjectId: params.session.groupId,
    relatedCharacterIds: params.participantIds,
    groupId: params.session.groupId,
    visibility: 'group_public',
    stability: 'situational',
    confidence: 'explicit',
    summary: `这场群聊线下的共同经历：${summary}`,
    timestamp: params.session.endedAt || Date.now(),
    decayHint: 'medium',
    isExplicit: true,
    isPublic: true,
  });

  return decision.shouldWrite ? [decision.record] : [];
}

export function buildGroupOfflineUnifiedContextPatch(params: {
  session: GroupOfflineSession;
  members: Character[];
  existingRelationshipWaves?: RelationshipWaveRecord[];
  existingFactTraces?: FactTraceRecord[];
  writebackPlan?: GroupOfflineWritebackPlan;
}) {
  const writebackPlan = params.writebackPlan || buildGroupOfflineWritebackPlan(params.session, params.members);
  const participantIds = params.members.map((member) => member.id);
  const incomingRelationshipWaves = buildParticipantRelationshipWaves({
    session: params.session,
    members: params.members,
    writebackPlan,
  });
  const incomingFactTraces = buildSharedEventFactTrace({
    session: params.session,
    participantIds,
    writebackPlan,
  });

  return {
    relationshipWaves: mergeRelationshipWaveRecords(
      params.existingRelationshipWaves,
      incomingRelationshipWaves,
    ),
    factTraces: mergeFactTraceRecords(
      params.existingFactTraces,
      incomingFactTraces,
    ),
  };
}
