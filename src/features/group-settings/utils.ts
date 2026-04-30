import type { ChatGroup } from '../../types';
import type { GroupSettingsFormState, GroupSettingsPatch } from './types';

function getEffectiveAllowDirectMemoryInterop(group: ChatGroup): boolean {
  return group.allowDirectMemoryInteropConfigured === true
    ? group.allowDirectMemoryInterop !== false
    : true;
}

export function createGroupSettingsFormState(group: ChatGroup): GroupSettingsFormState {
  const groupMemberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
  const voiceReplyMemberIds = Array.isArray(group.voiceReplyMemberIds)
    ? group.voiceReplyMemberIds.filter((memberId): memberId is string => (
        typeof memberId === 'string' && groupMemberIds.includes(memberId)
      ))
    : groupMemberIds;

  return {
    name: group.name,
    avatar: group.avatar,
    groupBackground: group.groupBackground || '',
    headerStyle: group.headerStyle || 'default',
    headerOpacity: group.headerOpacity ?? 0.92,
    footerStyle: group.footerStyle || 'default',
    footerOpacity: group.footerOpacity ?? 0.92,
    groupNickname: group.groupNickname || '',
    groupNotice: group.groupNotice || '',
    groupRemark: group.groupRemark || '',
    backgroundSummary: group.backgroundSummary || '',
    memberRelationshipState: group.memberRelationshipState,
    memberRelationshipNote: group.memberRelationshipNote || '',
    currentScene: group.currentScene || '',
    publicFacts: group.publicFacts || '',
    activeWorldBookIds: group.activeWorldBookIds || [],
    allowDirectMemoryInterop: getEffectiveAllowDirectMemoryInterop(group),
    muteNotifications: !!group.muteNotifications,
    pinChat: !!group.pinChat,
    manualReplyEnabled: group.manualReplyEnabled !== false,
    voiceRepliesEnabled: !!group.voiceRepliesEnabled,
    voiceReplyMemberIds,
  };
}

export function buildGroupSettingsPatch(state: GroupSettingsFormState): GroupSettingsPatch {
  return {
    name: state.name.trim(),
    avatar: state.avatar || undefined,
    groupBackground: toOptionalTrimmedValue(state.groupBackground),
    headerStyle: state.headerStyle,
    headerOpacity: clampOpacity(state.headerOpacity),
    footerStyle: state.footerStyle,
    footerOpacity: clampOpacity(state.footerOpacity),
    groupNickname: toOptionalTrimmedValue(state.groupNickname),
    groupNotice: toOptionalTrimmedValue(state.groupNotice),
    groupRemark: toOptionalTrimmedValue(state.groupRemark),
    backgroundSummary: toOptionalTrimmedValue(state.backgroundSummary),
    memberRelationshipState: state.memberRelationshipState,
    memberRelationshipNote: toOptionalTrimmedValue(state.memberRelationshipNote),
    currentScene: toOptionalTrimmedValue(state.currentScene),
    publicFacts: toOptionalTrimmedValue(state.publicFacts),
    activeWorldBookIds: state.activeWorldBookIds,
    allowDirectMemoryInterop: state.allowDirectMemoryInterop,
    allowDirectMemoryInteropConfigured: true,
    muteNotifications: state.muteNotifications,
    pinChat: state.pinChat,
    manualReplyEnabled: state.manualReplyEnabled,
    voiceRepliesEnabled: state.voiceRepliesEnabled,
    voiceReplyMemberIds: state.voiceReplyMemberIds,
  };
}

export function hasGroupSettingsChanges(group: ChatGroup, state: GroupSettingsFormState): boolean {
  const patch = buildGroupSettingsPatch(state);
  return patch.name !== group.name
    || (patch.avatar || '') !== (group.avatar || '')
    || (patch.groupBackground || '') !== (group.groupBackground || '')
    || patch.headerStyle !== (group.headerStyle || 'default')
    || (patch.headerOpacity ?? 0.92) !== (group.headerOpacity ?? 0.92)
    || patch.footerStyle !== (group.footerStyle || 'default')
    || (patch.footerOpacity ?? 0.92) !== (group.footerOpacity ?? 0.92)
    || (patch.groupNickname || '') !== (group.groupNickname || '')
    || (patch.groupNotice || '') !== (group.groupNotice || '')
    || (patch.groupRemark || '') !== (group.groupRemark || '')
    || (patch.backgroundSummary || '') !== (group.backgroundSummary || '')
    || patch.memberRelationshipState !== group.memberRelationshipState
    || (patch.memberRelationshipNote || '') !== (group.memberRelationshipNote || '')
    || (patch.currentScene || '') !== (group.currentScene || '')
    || (patch.publicFacts || '') !== (group.publicFacts || '')
    || JSON.stringify(patch.activeWorldBookIds || []) !== JSON.stringify(group.activeWorldBookIds || [])
    || patch.allowDirectMemoryInterop !== getEffectiveAllowDirectMemoryInterop(group)
    || patch.muteNotifications !== !!group.muteNotifications
    || patch.pinChat !== !!group.pinChat
    || patch.manualReplyEnabled !== (group.manualReplyEnabled !== false)
    || patch.voiceRepliesEnabled !== !!group.voiceRepliesEnabled
    || JSON.stringify(patch.voiceReplyMemberIds || []) !== JSON.stringify(
      Array.isArray(group.voiceReplyMemberIds)
        ? group.voiceReplyMemberIds
        : (group.voiceRepliesEnabled ? group.memberIds || [] : []),
    );
}

function toOptionalTrimmedValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 0.92;
  return Math.max(0.1, Math.min(1, Number(value.toFixed(2))));
}
