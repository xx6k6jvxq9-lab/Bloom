import type { Character, CoupleSpaceData, UserProfileExtended } from '../../../types';
import { buildResolvedMemoryLayers } from '../../../services/memory/buildResolvedMemoryLayers';
import { buildCharacterContext } from '../../../services/relationship-context/buildCharacterContext';

type HeartCapsuleContextOptions = {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
};

function buildRelationshipSummary(coupleSpace: CoupleSpaceData) {
  const parts: string[] = [];

  if (coupleSpace.anniversaryDate) {
    const days = Math.max(
      1,
      Math.floor((Date.now() - coupleSpace.anniversaryDate) / (1000 * 60 * 60 * 24)),
    );
    parts.push(`你们已经在一起或进入情侣空间大约 ${days} 天。`);
  }

  const letterCount = coupleSpace.loveLetters?.length ?? 0;
  const noteCount = coupleSpace.coNotes?.length ?? 0;
  const postCount = coupleSpace.posts?.length ?? 0;
  const messageBoardCount = coupleSpace.messageBoard?.length ?? 0;

  if (letterCount || noteCount || postCount || messageBoardCount) {
    parts.push(
      `情侣空间里已有 ${letterCount} 封情书、${noteCount} 条互记、${postCount} 条动态、${messageBoardCount} 条留言。`,
    );
  }

  return parts.join('\n');
}

export function buildHeartCapsulePromptContext({
  user,
  partner,
  coupleSpace,
}: HeartCapsuleContextOptions) {
  const memory = buildResolvedMemoryLayers(partner);
  const characterContext = buildCharacterContext({ character: partner });

  const lines = [
    `角色名字：${partner.name}`,
    `角色核心人设：${characterContext.corePersona || '未提供'}`,
    characterContext.expressionStyle ? `表达风格与相处方式：${characterContext.expressionStyle}` : '',
    partner.signature ? `角色签名：${partner.signature}` : '',
    partner.openingRemark ? `角色初始语气：${partner.openingRemark}` : '',
    memory.shortTermSummary ? `短期记忆摘要：${memory.shortTermSummary}` : '',
    memory.longTermMemoryProfile ? `长期记忆画像：${memory.longTermMemoryProfile}` : '',
    `用户名字：${user.name || '未命名用户'}`,
    buildRelationshipSummary(coupleSpace)
      ? `当前情侣关系摘要：${buildRelationshipSummary(coupleSpace)}`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}
