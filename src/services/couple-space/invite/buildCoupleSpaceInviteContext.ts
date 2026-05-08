import type { Character, ChatMessage } from '../../../types';
import { buildResolvedMemoryLayers } from '../../memory/buildResolvedMemoryLayers';
import { buildCharacterContext } from '../../relationship-context/buildCharacterContext';
import type { CoupleSpaceInviteContext } from './coupleSpaceInviteTypes';

const INVITE_CONTEXT_WINDOW = 6;

export function buildCoupleSpaceInviteContext(params: {
  userName: string;
  character: Character;
  history: ChatMessage[];
}): CoupleSpaceInviteContext {
  const characterContext = buildCharacterContext({
    character: params.character,
  });
  const memory = buildResolvedMemoryLayers(params.character);
  const recentMessages = params.history
    .filter((message) => !message.isSystem)
    .filter((message) => {
      const text = message.text.trim();
      return text !== '[COUPLE_SPACE_INVITE]' && text !== '[COUPLE_SPACE_INVITE_ACCEPTED]';
    })
    .slice(-INVITE_CONTEXT_WINDOW);
  const characterSetting = [
    characterContext.corePersona,
    characterContext.expressionStyle ? `表达风格：${characterContext.expressionStyle}` : '',
    params.character.signature?.trim() ? `个人签名：${params.character.signature.trim()}` : '',
    params.character.openingRemark?.trim() ? `常见开场语气参考：${params.character.openingRemark.trim()}` : '',
    characterContext.boundaryPack ? `边界与禁区：${characterContext.boundaryPack}` : '',
    characterContext.extendedLore ? `扩展设定：${characterContext.extendedLore}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    userName: params.userName,
    character: params.character,
    recentMessages,
    characterSetting,
    longTermMemoryProfile: memory.longTermMemoryProfile,
  };
}
