import type { ChatMessage } from '../../types';
import { looksLikeTopicText } from '../chat/topicRecall';
import type { FactTraceRecord } from './factTypes';
import type {
  RelationshipResidueItem,
  RelationshipWaveRecord,
  SceneResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
  TypedContextDecay,
  TypedContextVisibility,
} from './types';

type BuildSharedRelationshipMemoryInput = {
  characterId?: string;
  characterName: string;
  directMessages?: ChatMessage[];
  groupMessages?: ChatMessage[];
  relationshipWaves?: RelationshipWaveRecord[];
  factTraces?: FactTraceRecord[];
};

type CrossSceneMessageRecord = {
  summary: string;
  timestamp: number;
  sourceScene: 'direct_chat' | 'group_chat';
  visibility: TypedContextVisibility;
};

function getMainText(message: ChatMessage): string {
  return (message.text || '').replace(/^[^:：]+[:：]\s*/, '').trim();
}

function normalizeLine(line: string): string | null {
  const trimmed = line.trim();
  return trimmed ? trimmed : null;
}

function toTypedDecay(value: string | undefined): TypedContextDecay {
  return value === 'stable' || value === 'medium' ? value : 'short';
}

function dedupeBySummary<T extends { summary: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.summary.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectDirectRecords(characterName: string, messages: ChatMessage[]): CrossSceneMessageRecord[] {
  return messages
    .filter((message) => !message.isSystem)
    .slice(-6)
    .flatMap((message) => {
      const text = getMainText(message);
      if (!text) {
        return [];
      }

      const label = message.role === 'user' ? '私聊里你' : `私聊里${characterName}`;
      const summary = normalizeLine(`${label}：${text}`);
      if (!summary) {
        return [];
      }

      return [{
        summary,
        timestamp: message.timestamp,
        sourceScene: 'direct_chat' as const,
        visibility: 'private' as const,
      }];
    });
}

function collectGroupRecords(characterName: string, messages: ChatMessage[]): CrossSceneMessageRecord[] {
  return messages
    .filter((message) => !message.isSystem)
    .filter((message) => message.role === 'user' || message.senderCharacterId)
    .filter((message) => message.role === 'user' || getMainText(message).length > 0)
    .slice(-8)
    .flatMap((message) => {
      if (message.role === 'user') {
        const summary = normalizeLine(`群聊里你：${getMainText(message)}`);
        if (!summary) {
          return [];
        }

        return [{
          summary,
          timestamp: message.timestamp,
          sourceScene: 'group_chat' as const,
          visibility: 'cross_scene_readable' as const,
        }];
      }

      const text = getMainText(message);
      if (!text) {
        return [];
      }

      const senderName = message.text.split(/[:：]/)[0]?.trim() || characterName;
      if (senderName !== characterName) {
        return [];
      }

      const summary = normalizeLine(`群聊里${characterName}：${text}`);
      if (!summary) {
        return [];
      }

      return [{
        summary,
        timestamp: message.timestamp,
        sourceScene: 'group_chat' as const,
        visibility: 'cross_scene_readable' as const,
      }];
    });
}

function collectDirectLines(characterName: string, messages: ChatMessage[]): string[] {
  return collectDirectRecords(characterName, messages)
    .map((record) => record.summary)
    .slice(-4);
}

function collectGroupLines(characterName: string, messages: ChatMessage[]): string[] {
  return collectGroupRecords(characterName, messages)
    .map((record) => record.summary)
    .slice(-6);
}

function collectWaveLines(
  characterId: string | undefined,
  waves: RelationshipWaveRecord[],
): string[] {
  return waves
    .filter((wave) => {
      if (!characterId) {
        return wave.targetUser === true;
      }

      return (
        wave.sourceCharacterId === characterId
        || wave.targetCharacterId === characterId
        || wave.targetUser === true
      );
    })
    .slice(-4)
    .map((wave) => normalizeLine(`关系余波：${wave.summary}`))
    .filter((line): line is string => !!line);
}

function collectFactLines(
  characterId: string | undefined,
  factTraces: FactTraceRecord[],
): string[] {
  return factTraces
    .filter((factTrace) => {
      if (factTrace.visibility === 'private') {
        return false;
      }

      if (!characterId) {
        return true;
      }

      return (
        factTrace.subjectId === characterId
        || factTrace.relatedCharacterIds?.includes(characterId)
        || factTrace.subjectType === 'group'
      );
    })
    .slice(-4)
    .map((factTrace) => normalizeLine(`事实痕迹：${factTrace.summary}`))
    .filter((line): line is string => !!line);
}

function collectPublicAcquaintanceWaveLines(
  characterId: string | undefined,
  waves: RelationshipWaveRecord[],
): string[] {
  return waves
    .filter((wave) => wave.scope !== 'private')
    .filter((wave) => {
      if (!characterId) {
        return wave.targetUser === true || wave.relationType === 'public_group_event';
      }

      return (
        wave.relationType === 'public_group_event'
        || wave.sourceCharacterId === characterId
        || wave.targetCharacterId === characterId
      );
    })
    .slice(-4)
    .map((wave) => normalizeLine(`公开关系：${wave.summary}`))
    .filter((line): line is string => !!line);
}

function collectPublicAcquaintanceFactLines(
  characterId: string | undefined,
  factTraces: FactTraceRecord[],
): string[] {
  return factTraces
    .filter((factTrace) => factTrace.visibility !== 'private')
    .filter((factTrace) => {
      if (!characterId) {
        return factTrace.subjectType === 'group';
      }

      return (
        factTrace.subjectType === 'group'
        || factTrace.subjectId === characterId
        || factTrace.relatedCharacterIds?.includes(characterId)
      );
    })
    .slice(-4)
    .map((factTrace) => normalizeLine(`公开事实：${factTrace.summary}`))
    .filter((line): line is string => !!line);
}

export function buildRelationshipResidueItems(
  input: BuildSharedRelationshipMemoryInput,
): RelationshipResidueItem[] {
  const waveItems: RelationshipResidueItem[] = (input.relationshipWaves || [])
    .filter((wave) => {
      if (!input.characterId) {
        return wave.targetUser === true;
      }

      return (
        wave.sourceCharacterId === input.characterId
        || wave.targetCharacterId === input.characterId
        || wave.targetUser === true
      );
    })
    .slice(-4)
    .map((wave) => ({
      type: 'relationship_residue',
      summary: wave.summary,
      sourceScene: wave.sourceScene,
      timestamp: wave.timestamp,
      decay: wave.decayHint,
      visibility: wave.scope,
    }));

  const coupleFactItems: RelationshipResidueItem[] = (input.factTraces || [])
    .filter((factTrace) => factTrace.sourceScene === 'couple_space')
    .filter((factTrace) => factTrace.visibility !== 'private')
    .slice(-2)
    .map((factTrace) => ({
      type: 'relationship_residue',
      summary: factTrace.summary,
      sourceScene: factTrace.sourceScene,
      timestamp: factTrace.timestamp,
      decay: toTypedDecay(factTrace.decayHint),
      visibility: factTrace.visibility,
    }));

  return dedupeBySummary([...waveItems, ...coupleFactItems])
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 4);
}

export function buildSceneResidueItems(
  input: BuildSharedRelationshipMemoryInput,
): SceneResidueItem[] {
  const factItems: SceneResidueItem[] = (input.factTraces || [])
    .filter((factTrace) => factTrace.visibility !== 'private')
    .filter((factTrace) => factTrace.factType === 'status' || factTrace.factType === 'experience')
    .filter((factTrace) => factTrace.stability !== 'stable')
    .slice(-3)
    .map((factTrace) => ({
      type: 'scene_residue',
      summary: factTrace.summary,
      sourceScene: factTrace.sourceScene,
      timestamp: factTrace.timestamp,
      decay: toTypedDecay(factTrace.decayHint),
      visibility: factTrace.visibility,
    }));

  const messageItems: SceneResidueItem[] = [
    ...collectDirectRecords(input.characterName, input.directMessages || []),
    ...collectGroupRecords(input.characterName, input.groupMessages || []),
  ]
    .filter((record) => /在|刚|还在|路上|门口|楼下|回去|过来|等你|现场|这边/.test(record.summary))
    .slice(-2)
    .map((record) => ({
      type: 'scene_residue',
      summary: record.summary,
      sourceScene: record.sourceScene,
      timestamp: record.timestamp,
      decay: 'short' as const,
      visibility: record.visibility,
    }));

  return dedupeBySummary([...factItems, ...messageItems])
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 3);
}

export function buildTopicAnchorItems(
  input: BuildSharedRelationshipMemoryInput,
): TopicAnchorItem[] {
  const messageItems: TopicAnchorItem[] = [
    ...collectDirectRecords(input.characterName, input.directMessages || []),
    ...collectGroupRecords(input.characterName, input.groupMessages || []),
  ]
    .filter((record) => looksLikeTopicText(record.summary))
    .slice(-4)
    .map((record) => ({
      type: 'topic_anchor',
      summary: record.summary,
      sourceScene: record.sourceScene,
      timestamp: record.timestamp,
      decay: 'short' as const,
      visibility: record.visibility,
    }));

  return dedupeBySummary(messageItems)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 3);
}

export function buildTaskResidueItems(
  input: BuildSharedRelationshipMemoryInput,
): TaskResidueItem[] {
  const factItems: TaskResidueItem[] = (input.factTraces || [])
    .filter((factTrace) => factTrace.factType === 'plan')
    .filter((factTrace) => factTrace.visibility !== 'private')
    .slice(-4)
    .map((factTrace) => ({
      type: 'task_residue',
      summary: factTrace.summary,
      sourceScene: factTrace.sourceScene,
      timestamp: factTrace.timestamp,
      decay: toTypedDecay(factTrace.decayHint),
      visibility: factTrace.visibility,
    }));

  return dedupeBySummary(factItems)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 3);
}

export function buildSharedRelationshipMemory(
  input: BuildSharedRelationshipMemoryInput,
): string | undefined {
  const directLines = collectDirectLines(input.characterName, input.directMessages || []);
  const groupLines = collectGroupLines(input.characterName, input.groupMessages || []);
  const waveLines = collectWaveLines(input.characterId, input.relationshipWaves || []);
  const factLines = collectFactLines(input.characterId, input.factTraces || []);
  const combined = [
    ...factLines.slice(-2),
    ...waveLines.slice(-2),
    ...groupLines.slice(-2),
    ...directLines.slice(-2),
  ].slice(-5);

  if (combined.length === 0) {
    return undefined;
  }

  return combined.join('\n');
}

export function buildPublicAcquaintanceSummary(
  input: BuildSharedRelationshipMemoryInput,
): string | undefined {
  const factLines = collectPublicAcquaintanceFactLines(input.characterId, input.factTraces || []);
  const waveLines = collectPublicAcquaintanceWaveLines(input.characterId, input.relationshipWaves || []);
  const combined = [
    ...factLines.slice(-2),
    ...waveLines.slice(-2),
  ].slice(-4);

  if (combined.length === 0) {
    return undefined;
  }

  return combined.join('\n');
}
