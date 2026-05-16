import type { GroupOfflinePromptInput, GroupOfflineRuntimeProjection } from './types';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildGroupOfflinePromptInput(
  projection: GroupOfflineRuntimeProjection,
): GroupOfflinePromptInput {
  const relationshipContextByCharacterId = Object.fromEntries(
    projection.characters.map((character) => [
      character.identity.characterId,
      character.relationshipContextSummary || '',
    ]),
  );

  const groupStateSummary = [
    normalizeOptionalText(projection.groupSummary.groupShortTermSummary)
      ? `群当前短期状态：${normalizeOptionalText(projection.groupSummary.groupShortTermSummary)}`
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
    normalizeOptionalText(projection.groupSummary.backgroundSummary)
      ? `群背景摘要：${normalizeOptionalText(projection.groupSummary.backgroundSummary)}`
      : '',
    normalizeOptionalText(projection.groupSummary.memberRelationshipState)
      ? `成员关系底色：${normalizeOptionalText(projection.groupSummary.memberRelationshipState)}`
      : '',
    normalizeOptionalText(projection.groupSummary.currentScene)
      ? `当前群场景：${normalizeOptionalText(projection.groupSummary.currentScene)}`
      : '',
    normalizeOptionalText(projection.groupSummary.publicFacts)
      ? `公开事实：${normalizeOptionalText(projection.groupSummary.publicFacts)}`
      : '',
  ].filter(Boolean).join('\n') || undefined;

  return {
    relationshipContextByCharacterId,
    groupStateSummary,
  };
}
