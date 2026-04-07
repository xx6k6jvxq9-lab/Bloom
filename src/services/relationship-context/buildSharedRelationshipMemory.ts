import type { ChatMessage } from '../../types';
import type { FactTraceRecord } from './factTypes';
import type { RelationshipWaveRecord } from './types';

type BuildSharedRelationshipMemoryInput = {
  characterId?: string;
  characterName: string;
  directMessages?: ChatMessage[];
  groupMessages?: ChatMessage[];
  relationshipWaves?: RelationshipWaveRecord[];
  factTraces?: FactTraceRecord[];
};

function getMainText(message: ChatMessage): string {
  return (message.text || '').replace(/^[^:：]+[:：]\s*/, '').trim();
}

function normalizeLine(line: string): string | null {
  const trimmed = line.trim();
  return trimmed ? trimmed : null;
}

function collectDirectLines(characterName: string, messages: ChatMessage[]): string[] {
  return messages
    .filter((message) => !message.isSystem)
    .slice(-4)
    .map((message) => {
      const label = message.role === 'user' ? '私聊里你' : `私聊里${characterName}`;
      return normalizeLine(`${label}：${getMainText(message)}`);
    })
    .filter((line): line is string => !!line);
}

function collectGroupLines(characterName: string, messages: ChatMessage[]): string[] {
  return messages
    .filter((message) => !message.isSystem)
    .filter((message) => message.role === 'user' || message.senderCharacterId)
    .filter((message) => message.role === 'user' || getMainText(message).length > 0)
    .slice(-6)
    .flatMap((message) => {
      if (message.role === 'user') {
        return normalizeLine(`群聊里你：${getMainText(message)}`);
      }

      const text = getMainText(message);
      if (!text) return [];

      const senderName = message.text.split(/[:：]/)[0]?.trim() || characterName;
      if (senderName !== characterName) {
        return [];
      }

      return normalizeLine(`群聊里${characterName}：${text}`);
    })
    .filter((line): line is string => !!line);
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
