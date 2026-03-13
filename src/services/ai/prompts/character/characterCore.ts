/**
 * Character core layer.
 *
 * This file does not own business data. It only wraps already-available
 * role inputs into stable prompt sections so the caller can compose them later.
 */

export type CharacterCoreSectionsInput = {
  characterSetting?: string;
  maskPrompt?: string;
  worldBookPrompt?: string;
};

export const CHARACTER_CORE_HEADER = [
  '以下内容定义角色的稳定人格与世界身份。',
  '优先保持一致性，不要为了短期迎合而偏离核心设定。',
].join('\n');

export function buildCharacterCoreSection(input: CharacterCoreSectionsInput): string {
  const sections = [
    CHARACTER_CORE_HEADER,
    input.characterSetting?.trim()
      ? ['[角色核心设定]', input.characterSetting.trim()].join('\n')
      : '',
    input.maskPrompt?.trim()
      ? ['[Mask / 身份补充]', input.maskPrompt.trim()].join('\n')
      : '',
    input.worldBookPrompt?.trim()
      ? ['[World Book / 世界事实]', input.worldBookPrompt.trim()].join('\n')
      : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}
