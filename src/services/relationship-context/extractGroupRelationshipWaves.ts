import type { ChatMessage } from '../../types';
import type { RelationshipWaveWriteCandidate } from './buildRelationshipWaveWriteRules';

type ExtractGroupRelationshipWavesInput = {
  groupId: string;
  messages: ChatMessage[];
  memberIds: string[];
};

function getMessageText(message: ChatMessage): string {
  return (message.text || '').replace(/^[^:：]+[:：]\s*/, '').trim();
}

function inferEventKind(text: string): RelationshipWaveWriteCandidate['eventKind'] | null {
  if (/护着|护你|帮你说话|替你说话|站你这边/.test(text)) return 'protect';
  if (/吃醋|酸|不爽|介意|别靠太近/.test(text)) return 'jealousy';
  if (/和好|别气了|算了|不吵了|缓和/.test(text)) return 'reconcile';
  if (/吵|烦|滚|闭嘴|别说了|有病|冲突/.test(text)) return 'conflict';
  if (/支持|赞成|我也觉得|有道理|挺你/.test(text)) return 'support';
  if (/一起|都在|刚刚|那次|这波|我们/.test(text)) return 'shared_experience';
  if (/站队|表态|我站|偏向/.test(text)) return 'public_stance';
  if (/熟了|默契|关系不错|聊得来|靠近/.test(text)) return 'bonding';
  if (/逗你|调侃|接梗|嘴硬/.test(text)) return 'tease';
  return null;
}

function inferValence(eventKind: NonNullable<ReturnType<typeof inferEventKind>>) {
  if (eventKind === 'conflict' || eventKind === 'jealousy') return 'negative' as const;
  if (eventKind === 'reconcile') return 'mixed' as const;
  return 'positive' as const;
}

function inferIntensity(text: string): RelationshipWaveWriteCandidate['intensity'] {
  if (/特别|明显|直接|当场|一直|真的|非常/.test(text)) return 'high';
  if (text.length >= 18) return 'medium';
  return 'low';
}

export function extractGroupRelationshipWaves(
  input: ExtractGroupRelationshipWavesInput,
): RelationshipWaveWriteCandidate[] {
  return input.messages
    .filter((message) => message.role === 'model' && !!message.senderCharacterId && !message.isSystem)
    .slice(-12)
    .flatMap((message) => {
      const text = getMessageText(message);
      if (!text) return [];

      const eventKind = inferEventKind(text);
      if (!eventKind) return [];

      return [{
        sourceScene: 'group_chat' as const,
        relationType: 'public_group_event' as const,
        sourceCharacterId: message.senderCharacterId!,
        groupId: input.groupId,
        eventKind,
        valence: inferValence(eventKind),
        intensity: inferIntensity(text),
        scope: 'group_public' as const,
        summary: text,
        timestamp: message.timestamp,
        isExplicit: true,
        isPublic: true,
      }];
    });
}
