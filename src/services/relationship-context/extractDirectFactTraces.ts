import type { ChatMessage } from '../../types';
import type { FactTraceWriteCandidate } from './buildFactTraceWriteRules';

type ExtractDirectFactTracesInput = {
  characterId: string;
  messages: ChatMessage[];
};

function getMessageText(message: ChatMessage): string {
  return (message.text || '').replace(/^[^:：]+[:：]\s*/, '').trim();
}

function inferFactType(text: string): FactTraceWriteCandidate['factType'] | null {
  if (/想吃|爱吃|喜欢吃|不吃|讨厌吃|最爱/.test(text)) return 'preference';
  if (/想去|打算|准备|计划|待会|等下|明天要|周末去/.test(text)) return 'plan';
  if (/最近|今天|刚下班|加班|生病|发烧|头疼|累|忙|困/.test(text)) return 'status';
  if (/一起|刚刚|上次|那次|刚看完|刚去了|刚玩了|一起去/.test(text)) return 'experience';
  if (/是我姐|是我哥|我爸|我妈|前任|同事|室友|发小|青梅竹马/.test(text)) return 'background';
  return null;
}

function inferSubjectType(text: string): FactTraceWriteCandidate['subjectType'] {
  if (/我|本人|最近我/.test(text)) return 'character';
  return 'character';
}

function inferStability(factType: NonNullable<ReturnType<typeof inferFactType>>, text: string) {
  if (factType === 'background') return 'stable' as const;
  if (factType === 'experience') return 'situational' as const;
  if (/最近|今天|刚刚|待会|等下|明天/.test(text)) return 'temporary' as const;
  return 'situational' as const;
}

export function extractDirectFactTraces(
  input: ExtractDirectFactTracesInput,
): FactTraceWriteCandidate[] {
  return input.messages
    .filter((message) => !message.isSystem)
    .slice(-10)
    .flatMap((message) => {
      const text = getMessageText(message);
      if (!text) return [];

      if (message.role === 'user') {
        return [];
      }

      const factType = inferFactType(text);
      if (!factType) return [];

      return [{
        sourceScene: 'direct_chat' as const,
        factType,
        subjectType: inferSubjectType(text),
        subjectId: input.characterId,
        relatedCharacterIds: [input.characterId],
        visibility: 'cross_scene_readable' as const,
        stability: inferStability(factType, text),
        confidence: 'explicit' as const,
        summary: text,
        timestamp: message.timestamp,
        isExplicit: true,
        isPublic: false,
      }];
    });
}
