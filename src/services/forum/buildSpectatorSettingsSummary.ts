import type { Character, ForumSpectatorSettings } from '../../types';
import {
  normalizeSpectatorTargetCharacters,
  normalizeSpectatorUserSlot,
  resolveSpectatorTargetLabel,
} from '../../features/forum-domain/spectatorBoard';
import { getSpectatorWorldShellMeta, resolveSpectatorWorldShell } from '../../features/forum-domain/spectatorWorldShells';
import { buildSpectatorObjectSemantics } from './spectatorSettingsManager';

type BuildSpectatorSettingsSummaryInput = {
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Character[];
};

export function buildSpectatorSettingsSummary(input: BuildSpectatorSettingsSummaryInput) {
  const { settings, currentUserName, selectedCharacters } = input;
  const isSingleCharacterMode = settings.objectMode === 'single_character';
  const targetLabel = resolveSpectatorTargetLabel({
    settings,
    currentUserName,
    selectedCharacters,
  });
  const shellMeta = getSpectatorWorldShellMeta(resolveSpectatorWorldShell(settings.worldShell));
  const angleSummary = (settings.angles || []).slice(0, 4).join(' / ');
  const userSlot = normalizeSpectatorUserSlot(settings);
  const objectSemantics = buildSpectatorObjectSemantics({
    currentUserName,
    characters: selectedCharacters,
    targets: normalizeSpectatorTargetCharacters(settings),
    userSlotMode: userSlot.mode,
    objectMode: settings.objectMode,
  });
  const coordinates = objectSemantics.relationshipCoordinates;

  return [
    `场子：${shellMeta.label}`,
    `对象：${targetLabel}`,
    !isSingleCharacterMode ? `用户对象：${objectSemantics.userObjectLabel}` : '',
    objectSemantics.roleSummary ? `角色对象：${objectSemantics.roleSummary}` : '',
    !isSingleCharacterMode && coordinates?.focusLine ? `坐标主线：${coordinates.focusLine}` : '',
    !isSingleCharacterMode && coordinates?.supportingRoleSummary ? `坐标辅线：${coordinates.supportingRoleSummary}` : '',
    objectSemantics.focusGuidance ? `展开：${objectSemantics.focusGuidance}` : '',
    !isSingleCharacterMode && coordinates?.actionRuleSummary ? `动作边界：${coordinates.actionRuleSummary}` : '',
    settings.relationshipSummary ? `线索：${settings.relationshipSummary}` : '',
    settings.topicHint?.trim() ? `题材：${settings.topicHint.trim()}` : '',
    angleSummary ? `楼味：${angleSummary}` : '',
  ].filter(Boolean).join('；');
}
