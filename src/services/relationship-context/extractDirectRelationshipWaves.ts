import type { ChatMessage } from '../../types';
import type { RelationshipWaveWriteCandidate } from './buildRelationshipWaveWriteRules';

type ExtractDirectRelationshipWavesInput = {
  characterId: string;
  messages: ChatMessage[];
};

function getMessageText(message: ChatMessage): string {
  return (message.text || '').replace(/^[^:：]+[:：]\s*/, '').trim();
}

function inferEventKind(text: string): RelationshipWaveWriteCandidate['eventKind'] | null {
  if (/护着你|我站你|帮你|替你说话/.test(text)) return 'protect';
  if (/吃醋|不爽|介意|别理他|别靠近/.test(text)) return 'jealousy';
  if (/和好|别气了|算了|不闹了|缓和/.test(text)) return 'reconcile';
  if (/烦你|别说了|滚|闭嘴|不想理你|生气/.test(text)) return 'conflict';
  if (/支持你|赞成你|我懂你|挺你/.test(text)) return 'support';
  if (/我们刚刚|一起|那次|这波/.test(text)) return 'shared_experience';
  if (/熟了|默契|关系不错|聊得来|靠近/.test(text)) return 'bonding';
  if (/逗你|调侃你|嘴硬/.test(text)) return 'tease';
  return null;
}

function inferValence(eventKind: NonNullable<ReturnType<typeof inferEventKind>>) {
  if (eventKind === 'conflict' || eventKind === 'jealousy') return 'negative' as const;
  if (eventKind === 'reconcile') return 'mixed' as const;
  return 'positive' as const;
}

function inferIntensity(text: string): RelationshipWaveWriteCandidate['intensity'] {
  if (/特别|明显|直接|一直|真的|非常/.test(text)) return 'high';
  if (text.length >= 16) return 'medium';
  return 'low';
}

export function extractDirectRelationshipWaves(
  input: ExtractDirectRelationshipWavesInput,
): RelationshipWaveWriteCandidate[] {
  return input.messages
    .filter((message) => !message.isSystem)
    .slice(-10)
    .flatMap((message) => {
      const text = getMessageText(message);
      if (!text) return [];

      if (message.role === 'user') {
        return [];
      }

      const eventKind = inferEventKind(text);
      if (!eventKind) return [];

      return [{
        sourceScene: 'direct_chat' as const,
        relationType: 'character_user' as const,
        sourceCharacterId: input.characterId,
        targetUser: true,
        eventKind,
        valence: inferValence(eventKind),
        intensity: inferIntensity(text),
        scope: 'cross_scene_readable' as const,
        summary: text,
        timestamp: message.timestamp,
        isExplicit: true,
        isPublic: false,
      }];
    });
}
