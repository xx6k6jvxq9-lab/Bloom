import type { ChatGroup } from '../../types';
import type { GroupSettingsFormState, GroupSettingsPatch } from './types';

function getEffectiveAllowDirectMemoryInterop(group: ChatGroup): boolean {
  return group.allowDirectMemoryInteropConfigured === true
    ? group.allowDirectMemoryInterop !== false
    : true;
}

export function createGroupSettingsFormState(group: ChatGroup): GroupSettingsFormState {
  return {
    name: group.name,
    avatar: group.avatar,
    groupNickname: group.groupNickname || '',
    groupNotice: group.groupNotice || '',
    groupRemark: group.groupRemark || '',
    backgroundSummary: group.backgroundSummary || '',
    memberRelationshipState: group.memberRelationshipState,
    memberRelationshipNote: group.memberRelationshipNote || '',
    currentScene: group.currentScene || '',
    publicFacts: group.publicFacts || '',
    allowDirectMemoryInterop: getEffectiveAllowDirectMemoryInterop(group),
    muteNotifications: !!group.muteNotifications,
    pinChat: !!group.pinChat,
  };
}

export function buildGroupSettingsPatch(state: GroupSettingsFormState): GroupSettingsPatch {
  return {
    name: state.name.trim(),
    avatar: state.avatar || undefined,
    groupNickname: toOptionalTrimmedValue(state.groupNickname),
    groupNotice: toOptionalTrimmedValue(state.groupNotice),
    groupRemark: toOptionalTrimmedValue(state.groupRemark),
    backgroundSummary: toOptionalTrimmedValue(state.backgroundSummary),
    memberRelationshipState: state.memberRelationshipState,
    memberRelationshipNote: toOptionalTrimmedValue(state.memberRelationshipNote),
    currentScene: toOptionalTrimmedValue(state.currentScene),
    publicFacts: toOptionalTrimmedValue(state.publicFacts),
    allowDirectMemoryInterop: state.allowDirectMemoryInterop,
    allowDirectMemoryInteropConfigured: true,
    muteNotifications: state.muteNotifications,
    pinChat: state.pinChat,
  };
}

export function hasGroupSettingsChanges(group: ChatGroup, state: GroupSettingsFormState): boolean {
  const patch = buildGroupSettingsPatch(state);
  return patch.name !== group.name
    || (patch.avatar || '') !== (group.avatar || '')
    || (patch.groupNickname || '') !== (group.groupNickname || '')
    || (patch.groupNotice || '') !== (group.groupNotice || '')
    || (patch.groupRemark || '') !== (group.groupRemark || '')
    || (patch.backgroundSummary || '') !== (group.backgroundSummary || '')
    || patch.memberRelationshipState !== group.memberRelationshipState
    || (patch.memberRelationshipNote || '') !== (group.memberRelationshipNote || '')
    || (patch.currentScene || '') !== (group.currentScene || '')
    || (patch.publicFacts || '') !== (group.publicFacts || '')
    || patch.allowDirectMemoryInterop !== getEffectiveAllowDirectMemoryInterop(group)
    || patch.muteNotifications !== !!group.muteNotifications
    || patch.pinChat !== !!group.pinChat;
}

function toOptionalTrimmedValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
