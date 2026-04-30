import type { SingleChatCallConfig } from '../../../types';

function includesCharacterId(characterIds: string[] | undefined, characterId: string) {
  return Array.isArray(characterIds) && characterIds.includes(characterId);
}

export function matchSingleChatRule(
  rules: SingleChatCallConfig[],
  characterId?: string | null,
): SingleChatCallConfig | null {
  const enabledRules = rules
    .filter((rule) => rule.enabled)
    .sort((left, right) => left.priority - right.priority);

  if (!characterId) {
    return enabledRules.find((rule) => rule.roleScope.mode === 'all') || null;
  }

  const includeRule = enabledRules.find((rule) => (
    rule.roleScope.mode === 'include'
    && includesCharacterId(rule.roleScope.characterIds, characterId)
  ));
  if (includeRule) {
    return includeRule;
  }

  const allRule = enabledRules.find((rule) => rule.roleScope.mode === 'all');
  if (allRule) {
    return allRule;
  }

  const excludeRule = enabledRules.find((rule) => (
    rule.roleScope.mode === 'exclude'
    && !includesCharacterId(rule.roleScope.characterIds, characterId)
  ));

  return excludeRule || null;
}
