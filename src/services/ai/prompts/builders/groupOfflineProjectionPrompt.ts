import type {
  GroupOfflineCharacterRuntimeProjection,
  GroupOfflineRuntimeProjection,
} from '../../../group-offline/types';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function formatPeerRelations(character: GroupOfflineCharacterRuntimeProjection): string {
  const lines = character.peerRelations
    .slice(0, 3)
    .map((relation) => {
      const summary = relation.summary.replace(/\n+/g, '；').trim();
      return summary ? `- ${relation.peerName}：${summary}` : '';
    })
    .filter(Boolean);

  return lines.length > 0
    ? ['本场其他角色关系：', ...lines].join('\n')
    : '';
}

export function findProjectionCharacter(
  projection: GroupOfflineRuntimeProjection,
  characterId: string,
): GroupOfflineCharacterRuntimeProjection | undefined {
  return projection.characters.find((character) => character.identity.characterId === characterId);
}

export function pickProjectionCharacters(
  projection: GroupOfflineRuntimeProjection,
  characterIds?: string[],
): GroupOfflineCharacterRuntimeProjection[] {
  if (!characterIds || characterIds.length === 0) {
    return projection.characters;
  }

  return characterIds
    .map((characterId) => findProjectionCharacter(projection, characterId))
    .filter((character): character is GroupOfflineCharacterRuntimeProjection => !!character);
}

export function formatProjectionCharacterProfile(
  character: GroupOfflineCharacterRuntimeProjection,
): string {
  return [
    `角色：${character.identity.name}`,
    normalizeOptionalText(character.identity.remarkName) ? `备注名：${normalizeOptionalText(character.identity.remarkName)}` : '',
    normalizeOptionalText(character.persona.corePersona) ? `核心人设：${normalizeOptionalText(character.persona.corePersona)}` : '',
    normalizeOptionalText(character.identity.signature) ? `签名：${normalizeOptionalText(character.identity.signature)}` : '',
    normalizeOptionalText(character.persona.expressionStyle) ? `表达风格：${normalizeOptionalText(character.persona.expressionStyle)}` : '',
    normalizeOptionalText(character.persona.boundaryPack) ? `边界：${normalizeOptionalText(character.persona.boundaryPack)}` : '',
    normalizeOptionalText(character.persona.extendedLore) ? `扩展设定：${normalizeOptionalText(character.persona.extendedLore)}` : '',
    normalizeOptionalText(character.persona.sceneHint) ? `群线下场景提示：${normalizeOptionalText(character.persona.sceneHint)}` : '',
    normalizeOptionalText(character.memory.shortTermSummary) ? `近期状态与短期记忆：${normalizeOptionalText(character.memory.shortTermSummary)}` : '',
    normalizeOptionalText(character.memory.longTermMemoryProfile) ? `长期记忆画像：${normalizeOptionalText(character.memory.longTermMemoryProfile)}` : '',
    normalizeOptionalText(character.memory.sharedCharacterStatePrompt) ? `当前共享状态：${normalizeOptionalText(character.memory.sharedCharacterStatePrompt)}` : '',
    normalizeOptionalText(character.userRelation.relationshipSummary) ? `和用户关系：${normalizeOptionalText(character.userRelation.relationshipSummary)}` : '',
    normalizeOptionalText(character.userRelation.publicAcquaintanceSummary) ? `公开关系：${normalizeOptionalText(character.userRelation.publicAcquaintanceSummary)}` : '',
    normalizeOptionalText(character.userRelation.sharedRecentRelationshipSummary) ? `跨场景关系余波：${normalizeOptionalText(character.userRelation.sharedRecentRelationshipSummary)}` : '',
    normalizeOptionalText(character.userRelation.relationshipTensionSummary) ? `当前拉扯点：${normalizeOptionalText(character.userRelation.relationshipTensionSummary)}` : '',
    formatPeerRelations(character),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatProjectionGroupState(
  projection: GroupOfflineRuntimeProjection,
): string | undefined {
  const lines = [
    normalizeOptionalText(projection.groupSummary.groupShortTermSummary)
      ? `群当前短期状态：${normalizeOptionalText(projection.groupSummary.groupShortTermSummary)}`
      : '',
    normalizeOptionalText(projection.groupSummary.currentScene)
      ? `当前群场景：${normalizeOptionalText(projection.groupSummary.currentScene)}`
      : '',
    normalizeOptionalText(projection.groupSummary.groupLongTermAtmosphere)
      ? `群长期氛围：${normalizeOptionalText(projection.groupSummary.groupLongTermAtmosphere)}`
      : '',
    normalizeOptionalText(projection.groupSummary.groupRecurringDynamics)
      ? `群固定互动惯性：${normalizeOptionalText(projection.groupSummary.groupRecurringDynamics)}`
      : '',
    normalizeOptionalText(projection.groupSummary.groupSharedHistory)
      ? `群共同经历：${normalizeOptionalText(projection.groupSummary.groupSharedHistory)}`
      : '',
    normalizeOptionalText(projection.groupSummary.publicFacts)
      ? `公开事实：${normalizeOptionalText(projection.groupSummary.publicFacts)}`
      : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : undefined;
}
