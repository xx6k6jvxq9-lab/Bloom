import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Character, ChatGroup, ChatMessage, WorldBookEntry } from '../../types';
import { GroupSettingsScreen } from '../group-settings/components/GroupSettingsScreen';
import {
  buildGroupSettingsSystemMessages,
  createAssignDutyAdminSystemMessage,
  createCancelAdminSystemMessage,
  createClearDutyAdminSystemMessage,
  createClearMemberBadgeSystemMessage,
  createGrantTemporaryPermissionSystemMessage,
  createInviteMemberSystemMessage,
  createLeaveGroupSystemMessage,
  createMuteMemberSystemMessage,
  createRemoveMemberSystemMessage,
  createRevealGroupAwarenessSystemMessage,
  createRevokeTemporaryPermissionSystemMessage,
  createSetAdminSystemMessage,
  createSetMemberBadgeSystemMessage,
  createUnmuteMemberSystemMessage,
} from '../group-settings/groupSystemMessages';
import {
  buildRevealGroupPatch,
  doesCharacterKnowGroup,
  getGroupAwarenessEntry,
} from '../group-settings/groupAwareness';
import {
  buildDutyAdminAssignment,
  buildTemporaryManagedFeatureGrant,
  getActiveDutyAdminAssignment,
  getTemporaryManagedFeatureGrant,
} from '../group-settings/groupDynamicPermissions';
import {
  getActiveMutedMemberEntries,
  getMutedMemberEntry,
  isGroupMemberMuted,
  removeMutedMemberEntry,
  upsertMutedMemberEntry,
} from '../group-settings/groupMutedMembers';
import {
  canEditGroupNotice,
  canManageDynamicGroupPermissions,
  filterGroupSettingsPatchForActor,
  getGroupNoticePermissionHintForActor,
} from '../group-settings/groupPermissionRules';
import {
  canManageGroupAdmins,
  canManageGroupMembers,
  isProtectedGroupMember,
  resolveGroupMemberRole,
} from '../group-settings/groupRoles';
import { getGroupMemberBubbleColor } from '../group-settings/groupBubbleColors';
import { getGroupMemberBadge } from '../group-settings/memberBadges';
import type { GroupSettingsFormState, GroupSettingsMemberSummary } from '../group-settings/types';
import {
  buildGroupSettingsPatch,
  createGroupSettingsFormState,
  hasGroupSettingsChanges,
} from '../group-settings/utils';
import { resolveGroupGovernanceMessage } from './groupGovernanceCards';
import { parseModerationDurationMs } from './groupModerationCommands';

type NoticeReactionRunner = (params: {
  noticeText: string;
  currentHistory: ChatMessage[];
}) => Promise<void> | void;

type ApprovedJoinReactionRunner = (
  invitedCharacter: Character,
  currentHistory: ChatMessage[],
  noticeTimestamp: number,
) => Promise<void>;

type ModerationFollowupParams = {
  kind: 'mute' | 'unmute' | 'remove';
  targetMemberId: string;
  targetMemberName: string;
  actorId?: string;
  actorName?: string;
  currentHistory: ChatMessage[];
  contextMembers?: Character[];
  groupOverride?: ChatGroup;
};

type GroupSettingsControllerProps = {
  isOpen: boolean;
  group: ChatGroup;
  members: Character[];
  inviteableCharacters: Character[];
  history: ChatMessage[];
  worldBooks: WorldBookEntry[];
  userName: string;
  userAvatar: string;
  setHistory: Dispatch<SetStateAction<ChatMessage[]>>;
  onUpdateGroup: (patch: Partial<ChatGroup>) => void;
  onClearHistory: () => void;
  onLeaveGroup: () => void;
  onRequestClose: () => void;
  onJumpToMessage: (target: { timestamp: number; text: string }) => void;
  resolveSenderLabel: (message: ChatMessage) => string;
  reactToNoticeUpdate: NoticeReactionRunner;
  runApprovedJoinReaction: ApprovedJoinReactionRunner;
  runModerationFollowupReactions: (params: ModerationFollowupParams) => Promise<void>;
};

function resolveMuteDurationDraftMs(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const durationMs = parseModerationDurationMs(trimmed)
    ?? (/^\d+$/.test(trimmed) ? Number(trimmed) * 60 * 1000 : undefined);

  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }

  return durationMs;
}

export function GroupSettingsController(props: GroupSettingsControllerProps) {
  const [groupSettingsForm, setGroupSettingsForm] = useState<GroupSettingsFormState>(() => createGroupSettingsFormState(props.group));
  const [muteDurationSheet, setMuteDurationSheet] = useState<{ memberId: string; memberName: string } | null>(null);
  const [muteDurationMode, setMuteDurationMode] = useState<'timed' | 'manual'>('timed');
  const [muteDurationDraft, setMuteDurationDraft] = useState('30m');
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [isRevealingGroup, setIsRevealingGroup] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);
  const [isUpdatingMute, setIsUpdatingMute] = useState(false);
  const [isUpdatingDynamicPermissions, setIsUpdatingDynamicPermissions] = useState(false);
  const [isUpdatingBadge, setIsUpdatingBadge] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);

  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const previousOpenRef = useRef(false);
  const previousGroupIdRef = useRef(props.group.id);

  const groupDisplayName = props.group.groupRemark?.trim() || props.group.name;
  const groupUserDisplayName = props.group.groupNickname?.trim() || props.userName;
  const participantCount = props.members.length + 1;
  const actingRole = resolveGroupMemberRole(props.group, 'user');
  const canCurrentUserEditGroupNotice = canEditGroupNotice(props.group, 'user');
  const canCurrentUserManageDynamicPermissions = canManageDynamicGroupPermissions(props.group, 'user');
  const groupNoticePermissionHint = getGroupNoticePermissionHintForActor(props.group, 'user');
  const activeDutyAdminAssignment = getActiveDutyAdminAssignment(props.group);
  const currentTemporaryPermissionGrants = Array.isArray(props.group.temporaryPermissionGrants)
    ? props.group.temporaryPermissionGrants
    : [];
  const currentMutedMemberEntries = getActiveMutedMemberEntries(props.group);
  const currentMemberBadges = Array.isArray(props.group.memberBadges)
    ? props.group.memberBadges
    : [];
  const currentMemberBubbleColors = Array.isArray(props.group.memberBubbleColors)
    ? props.group.memberBubbleColors
    : [];
  const hasGroupInfoChanges = hasGroupSettingsChanges(props.group, groupSettingsForm);

  useEffect(() => {
    const didJustOpen = props.isOpen && !previousOpenRef.current;
    const didJustClose = !props.isOpen && previousOpenRef.current;
    const switchedGroup = previousGroupIdRef.current !== props.group.id;

    if (didJustOpen || switchedGroup) {
      setGroupSettingsForm(createGroupSettingsFormState(props.group));
    }

    if (didJustClose) {
      setMuteDurationSheet(null);
      setMuteDurationMode('timed');
      setMuteDurationDraft('30m');
    }

    previousOpenRef.current = props.isOpen;
    previousGroupIdRef.current = props.group.id;
  }, [props.group, props.isOpen]);

  const groupSettingsMembers = useMemo<GroupSettingsMemberSummary[]>(() => [
    { id: 'user', name: groupUserDisplayName, avatar: props.userAvatar, role: actingRole, voiceEnabled: false },
    ...props.members.map((member): GroupSettingsMemberSummary => {
      const temporaryGrant = getTemporaryManagedFeatureGrant(props.group, member.id);
      const badge = getGroupMemberBadge(props.group, member.id);
      const bubbleColor = getGroupMemberBubbleColor(props.group, member.id);
      const nominationCooldownUntil = props.group.adminNominationCooldowns?.find((entry) => entry.memberId === member.id)?.cooldownUntil;
      const mutedEntry = getMutedMemberEntry(props.group, member.id);
      const summary: GroupSettingsMemberSummary = {
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        role: resolveGroupMemberRole(props.group, member.id),
        voiceEnabled: member.voiceProfile?.enabled === true,
        isDutyAdmin: activeDutyAdminAssignment?.memberId === member.id,
        hasTemporaryManagedFeatureGrant: !!temporaryGrant,
        isMuted: isGroupMemberMuted(props.group, member.id),
      };

      if (member.remarkName) {
        summary.remarkName = member.remarkName;
      }
      if (badge?.label) {
        summary.badgeLabel = badge.label;
      }
      if (badge?.color) {
        summary.badgeColor = badge.color;
      }
      if (bubbleColor) {
        summary.bubbleColor = bubbleColor;
      }
      if (activeDutyAdminAssignment?.memberId === member.id) {
        summary.dutyAdminExpiresAt = activeDutyAdminAssignment.expiresAt;
      }
      if (temporaryGrant?.expiresAt != null) {
        summary.temporaryManagedFeatureGrantExpiresAt = temporaryGrant.expiresAt;
      }
      if (temporaryGrant?.remainingUses != null) {
        summary.temporaryManagedFeatureGrantRemainingUses = temporaryGrant.remainingUses;
      }
      if (nominationCooldownUntil != null) {
        summary.nominationCooldownUntil = nominationCooldownUntil;
      }
      if (mutedEntry?.mutedAt != null) {
        summary.mutedAt = mutedEntry.mutedAt;
      }
      if (mutedEntry?.expiresAt != null) {
        summary.muteExpiresAt = mutedEntry.expiresAt;
      }

      return summary;
    }),
  ], [
    actingRole,
    activeDutyAdminAssignment,
    groupUserDisplayName,
    props.group,
    props.members,
    props.userAvatar,
  ]);

  const groupSettingsInviteCandidates = useMemo<GroupSettingsMemberSummary[]>(() => (
    props.inviteableCharacters.map((character): GroupSettingsMemberSummary => {
      const awarenessEntry = getGroupAwarenessEntry(props.group, character.id);
      const summary: GroupSettingsMemberSummary = {
        id: character.id,
        name: character.name,
        avatar: character.avatar,
        role: 'member',
        knowsGroup: doesCharacterKnowGroup(props.group, character.id),
      };

      if (character.remarkName) {
        summary.remarkName = character.remarkName;
      }
      if (awarenessEntry?.source) {
        summary.groupAwarenessSource = awarenessEntry.source;
      }
      if (awarenessEntry?.joinRequestCooldownUntil != null) {
        summary.joinRequestCooldownUntil = awarenessEntry.joinRequestCooldownUntil;
      }

      return summary;
    })
  ), [props.group, props.inviteableCharacters]);

  const resolveGroupManagedMemberName = useCallback((memberId: string) => {
    if (memberId === 'user') {
      return groupUserDisplayName;
    }

    const member = props.members.find((item) => item.id === memberId);
    return member?.remarkName?.trim() || member?.name || '成员';
  }, [groupUserDisplayName, props.members]);

  const handleGroupAvatarUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setGroupSettingsForm((prev) => ({
        ...prev,
        avatar: (reader.result as string) || '',
      }));
    };
    reader.readAsDataURL(file);

    if (groupAvatarInputRef.current) {
      groupAvatarInputRef.current.value = '';
    }
  }, []);

  const handleSaveGroupInfo = useCallback(() => {
    let nextPatch = filterGroupSettingsPatchForActor(props.group, 'user', buildGroupSettingsPatch(groupSettingsForm));

    if (nextPatch.awarenessMode === 'public') {
      let awarenessEntries = props.group.awarenessEntries;
      props.inviteableCharacters.forEach((character) => {
        if (getGroupAwarenessEntry({ awarenessEntries }, character.id)) {
          return;
        }
        awarenessEntries = buildRevealGroupPatch(
          { awarenessEntries },
          character.id,
          'public_group',
          Date.now(),
        ).awarenessEntries;
      });
      nextPatch = {
        ...nextPatch,
        ...(awarenessEntries ? { awarenessEntries } : {}),
      };
    }

    if ('name' in nextPatch && !String(nextPatch.name || '').trim()) {
      return;
    }

    const previousNotice = props.group.groupNotice?.trim() || '';
    const nextNotice = 'groupNotice' in nextPatch
      ? (nextPatch.groupNotice?.trim() || '')
      : previousNotice;
    const systemMessages = buildGroupSettingsSystemMessages(props.group, nextPatch, Date.now());

    if (Object.keys(nextPatch).length > 0) {
      props.onUpdateGroup(nextPatch);
    }

    if (systemMessages.length > 0) {
      props.setHistory((prev) => [...prev, ...systemMessages]);
    }
    if (canCurrentUserEditGroupNotice && nextNotice && nextNotice !== previousNotice) {
      void props.reactToNoticeUpdate({
        noticeText: nextNotice,
        currentHistory: [...props.history, ...systemMessages],
      });
    }
  }, [
    canCurrentUserEditGroupNotice,
    groupSettingsForm,
    props.group,
    props.history,
    props.inviteableCharacters,
    props.onUpdateGroup,
    props.reactToNoticeUpdate,
    props.setHistory,
  ]);

  const handleCloseGroupSettings = useCallback(() => {
    if (hasGroupInfoChanges) {
      handleSaveGroupInfo();
    }
    props.onRequestClose();
  }, [handleSaveGroupInfo, hasGroupInfoChanges, props]);

  const handleUpdateGroupBackground = useCallback((value: string) => {
    setGroupSettingsForm((prev) => ({
      ...prev,
      groupBackground: value,
    }));
    props.onUpdateGroup({
      groupBackground: value.trim() ? value : undefined,
    });
  }, [props]);

  const handleInviteMember = useCallback(async (memberId: string) => {
    const invitedCharacter = props.inviteableCharacters.find((character) => character.id === memberId);
    if (
      !invitedCharacter
      || props.group.memberIds.includes(memberId)
      || isInvitingMember
      || !canManageGroupMembers(props.group, 'user')
    ) {
      return;
    }

    setIsInvitingMember(true);
    const invitedName = invitedCharacter.remarkName?.trim() || invitedCharacter.name;
    const pendingJoinRequest = props.history.find((message) => (
      message.groupGovernanceCard?.kind === 'join-request'
      && message.groupGovernanceCard.targetMemberId === invitedCharacter.id
      && message.groupGovernanceCard.status === 'pending'
    ));
    const resolvedAt = Date.now();
    const noticeTimestamp = resolvedAt + 1;
    const resolvedHistory = pendingJoinRequest
      ? props.history.map((message) => (
          message.timestamp === pendingJoinRequest.timestamp
            ? resolveGroupGovernanceMessage({
                message,
                status: 'approved',
                resolvedById: 'user',
                resolvedByName: groupUserDisplayName,
                resolvedAt,
              })
            : message
        ))
      : props.history;
    const noticeMessage = createInviteMemberSystemMessage(invitedName, noticeTimestamp);
    const nextHistory = [...resolvedHistory, noticeMessage];

    props.onUpdateGroup({
      memberIds: Array.from(new Set([...props.group.memberIds, invitedCharacter.id])),
      ...buildRevealGroupPatch(props.group, invitedCharacter.id, 'direct_invite', resolvedAt),
    });
    props.setHistory(nextHistory);

    try {
      await props.runApprovedJoinReaction(invitedCharacter, nextHistory, noticeTimestamp);
    } finally {
      setIsInvitingMember(false);
    }
  }, [
    groupUserDisplayName,
    isInvitingMember,
    props.group,
    props.history,
    props.inviteableCharacters,
    props.onUpdateGroup,
    props.runApprovedJoinReaction,
    props.setHistory,
  ]);

  const handleRevealGroupToMember = useCallback(async (memberId: string) => {
    const targetCharacter = props.inviteableCharacters.find((character) => character.id === memberId);
    if (
      !targetCharacter
      || isRevealingGroup
      || !canManageGroupMembers(props.group, 'user')
      || doesCharacterKnowGroup(props.group, memberId)
    ) {
      return;
    }

    setIsRevealingGroup(true);
    const timestamp = Date.now();
    props.onUpdateGroup(buildRevealGroupPatch(props.group, memberId, 'manual_reveal', timestamp));
    props.setHistory((prev) => [
      ...prev,
      createRevealGroupAwarenessSystemMessage(targetCharacter.remarkName?.trim() || targetCharacter.name, timestamp),
    ]);
    setIsRevealingGroup(false);
  }, [isRevealingGroup, props]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    const member = props.members.find((item) => item.id === memberId);
    if (!member || isRemovingMember || !canManageGroupMembers(props.group, 'user') || isProtectedGroupMember(props.group, memberId)) {
      return;
    }

    const memberName = member.remarkName?.trim() || member.name;
    if (!window.confirm(`确认将 ${memberName} 移出当前群聊吗？`)) {
      return;
    }

    setIsRemovingMember(true);

    props.onUpdateGroup({
      memberIds: props.group.memberIds.filter((id) => id !== memberId),
      adminIds: (props.group.adminIds || []).filter((id) => id !== memberId),
      ...buildRevealGroupPatch(props.group, memberId, 'former_member', Date.now()),
      dutyAdminAssignment: props.group.dutyAdminAssignment?.memberId === memberId ? undefined : props.group.dutyAdminAssignment,
      temporaryPermissionGrants: currentTemporaryPermissionGrants.filter((grant) => grant.memberId !== memberId),
      mutedMemberEntries: currentMutedMemberEntries.filter((entry) => entry.memberId !== memberId),
      voiceReplyMemberIds: (props.group.voiceReplyMemberIds || []).filter((id) => id !== memberId),
    });

    const removalMessage = createRemoveMemberSystemMessage(memberName, Date.now());
    const nextHistory = [...props.history, removalMessage];
    props.setHistory(nextHistory);
    void props.runModerationFollowupReactions({
      kind: 'remove',
      targetMemberId: memberId,
      targetMemberName: memberName,
      currentHistory: nextHistory,
      contextMembers: props.members.filter((item) => item.id !== memberId),
      groupOverride: {
        ...props.group,
        memberIds: props.group.memberIds.filter((id) => id !== memberId),
        mutedMemberEntries: currentMutedMemberEntries.filter((entry) => entry.memberId !== memberId),
      },
    });

    setIsRemovingMember(false);
  }, [
    currentMutedMemberEntries,
    currentTemporaryPermissionGrants,
    isRemovingMember,
    props.group,
    props.history,
    props.members,
    props.onUpdateGroup,
    props.runModerationFollowupReactions,
    props.setHistory,
  ]);

  const handleToggleAdmin = useCallback(async (memberId: string) => {
    const member = props.members.find((item) => item.id === memberId);
    if (!member || isUpdatingAdmin || !canManageGroupAdmins(props.group, 'user') || isProtectedGroupMember(props.group, memberId)) {
      return;
    }

    const memberName = member.remarkName?.trim() || member.name;
    const isAdmin = (props.group.adminIds || []).includes(memberId);
    const pendingNomination = props.history.find((message) => (
      message.groupGovernanceCard?.kind === 'admin-nomination'
      && message.groupGovernanceCard.nomineeId === memberId
      && message.groupGovernanceCard.status === 'pending'
    ));
    setIsUpdatingAdmin(true);

    if (!isAdmin) {
      const resolvedAt = Date.now();
      const resolvedHistory = pendingNomination
        ? props.history.map((message) => (
            message.timestamp === pendingNomination.timestamp
              ? resolveGroupGovernanceMessage({
                  message,
                  status: 'approved',
                  resolvedById: 'user',
                  resolvedByName: groupUserDisplayName,
                  resolvedAt,
                })
              : message
          ))
        : props.history;

      props.onUpdateGroup({
        adminIds: [...new Set([...(props.group.adminIds || []), memberId])],
        dutyAdminAssignment: props.group.dutyAdminAssignment?.memberId === memberId
          ? undefined
          : props.group.dutyAdminAssignment,
        temporaryPermissionGrants: currentTemporaryPermissionGrants.filter((grant) => grant.memberId !== memberId),
      });

      props.setHistory([
        ...resolvedHistory,
        createSetAdminSystemMessage(memberName, resolvedAt + 1),
      ]);
      setIsUpdatingAdmin(false);
      return;
    }

    props.onUpdateGroup({
      adminIds: (props.group.adminIds || []).filter((id) => id !== memberId),
    });

    props.setHistory((prev) => [
      ...prev,
      createCancelAdminSystemMessage(memberName, Date.now()),
    ]);

    setIsUpdatingAdmin(false);
  }, [
    currentTemporaryPermissionGrants,
    groupUserDisplayName,
    isUpdatingAdmin,
    props.group,
    props.history,
    props.members,
    props.onUpdateGroup,
    props.setHistory,
  ]);

  const handleToggleMute = useCallback(async (memberId: string) => {
    const member = props.members.find((item) => item.id === memberId);
    if (!member || isUpdatingMute || !canManageGroupMembers(props.group, 'user') || isProtectedGroupMember(props.group, memberId)) {
      return;
    }

    const memberName = member.remarkName?.trim() || member.name;
    const mutedEntry = getMutedMemberEntry(props.group, memberId);
    const timestamp = Date.now();
    setIsUpdatingMute(true);

    if (mutedEntry) {
      const nextPatch = removeMutedMemberEntry(props.group, memberId);
      const systemMessage = createUnmuteMemberSystemMessage(memberName, timestamp);
      const nextHistory = [...props.history, systemMessage];

      props.onUpdateGroup(nextPatch);
      props.setHistory(nextHistory);
      void props.runModerationFollowupReactions({
        kind: 'unmute',
        targetMemberId: memberId,
        targetMemberName: memberName,
        currentHistory: nextHistory,
        groupOverride: {
          ...props.group,
          ...nextPatch,
        },
      });
      setIsUpdatingMute(false);
      return;
    }

    setIsUpdatingMute(false);
    setMuteDurationMode('timed');
    setMuteDurationDraft('30m');
    setMuteDurationSheet({ memberId, memberName });
  }, [isUpdatingMute, props]);

  const handleConfirmMuteDuration = useCallback(async () => {
    if (!muteDurationSheet || isUpdatingMute) {
      return;
    }

    const member = props.members.find((item) => item.id === muteDurationSheet.memberId);
    if (!member || isGroupMemberMuted(props.group, muteDurationSheet.memberId)) {
      setMuteDurationSheet(null);
      return;
    }

    const durationMs = muteDurationMode === 'manual'
      ? undefined
      : resolveMuteDurationDraftMs(muteDurationDraft);

    if (muteDurationMode === 'timed' && !durationMs) {
      window.alert('禁言时长格式无效，请输入例如 30m、2h、1d。');
      return;
    }

    const timestamp = Date.now();
    setIsUpdatingMute(true);

    const nextPatch = upsertMutedMemberEntry(props.group, {
      memberId: muteDurationSheet.memberId,
      mutedById: 'user',
      mutedAt: timestamp,
      ...(typeof durationMs === 'number' ? { expiresAt: timestamp + durationMs } : {}),
    });
    const systemMessage = createMuteMemberSystemMessage(muteDurationSheet.memberName, timestamp);
    const nextHistory = [...props.history, systemMessage];

    props.onUpdateGroup(nextPatch);
    props.setHistory(nextHistory);
    setMuteDurationSheet(null);
    void props.runModerationFollowupReactions({
      kind: 'mute',
      targetMemberId: muteDurationSheet.memberId,
      targetMemberName: muteDurationSheet.memberName,
      currentHistory: nextHistory,
      groupOverride: {
        ...props.group,
        ...nextPatch,
      },
    });
    setIsUpdatingMute(false);
  }, [
    isUpdatingMute,
    muteDurationDraft,
    muteDurationMode,
    muteDurationSheet,
    props.group,
    props.history,
    props.members,
    props.onUpdateGroup,
    props.runModerationFollowupReactions,
    props.setHistory,
  ]);

  const handleAssignDutyAdmin = useCallback(async (memberId: string) => {
    const member = props.members.find((item) => item.id === memberId);
    if (
      !member
      || isUpdatingDynamicPermissions
      || !canCurrentUserManageDynamicPermissions
      || resolveGroupMemberRole(props.group, memberId) !== 'member'
      || activeDutyAdminAssignment?.memberId === memberId
    ) {
      return;
    }

    setIsUpdatingDynamicPermissions(true);

    const timestamp = Date.now();
    const nextAssignment = buildDutyAdminAssignment({
      memberId,
      grantedById: 'user',
      grantedAt: timestamp,
    });
    const nextMessages: ChatMessage[] = [];

    if (activeDutyAdminAssignment) {
      nextMessages.push(createClearDutyAdminSystemMessage(
        resolveGroupManagedMemberName(activeDutyAdminAssignment.memberId),
        timestamp,
      ));
    }

    nextMessages.push(createAssignDutyAdminSystemMessage(
      member.remarkName?.trim() || member.name,
      timestamp + nextMessages.length,
    ));

    props.onUpdateGroup({
      dutyAdminAssignment: nextAssignment,
    });
    props.setHistory((prev) => [...prev, ...nextMessages]);
    setIsUpdatingDynamicPermissions(false);
  }, [
    activeDutyAdminAssignment,
    canCurrentUserManageDynamicPermissions,
    isUpdatingDynamicPermissions,
    props.group,
    props.members,
    props.onUpdateGroup,
    props.setHistory,
    resolveGroupManagedMemberName,
  ]);

  const handleClearDutyAdmin = useCallback(async (memberId: string) => {
    if (
      isUpdatingDynamicPermissions
      || !canCurrentUserManageDynamicPermissions
      || activeDutyAdminAssignment?.memberId !== memberId
    ) {
      return;
    }

    const memberName = resolveGroupManagedMemberName(memberId);
    setIsUpdatingDynamicPermissions(true);
    props.onUpdateGroup({
      dutyAdminAssignment: undefined,
    });
    props.setHistory((prev) => [
      ...prev,
      createClearDutyAdminSystemMessage(memberName, Date.now()),
    ]);
    setIsUpdatingDynamicPermissions(false);
  }, [
    activeDutyAdminAssignment,
    canCurrentUserManageDynamicPermissions,
    isUpdatingDynamicPermissions,
    props,
    resolveGroupManagedMemberName,
  ]);

  const handleGrantTemporaryPermission = useCallback(async (memberId: string) => {
    const member = props.members.find((item) => item.id === memberId);
    if (
      !member
      || isUpdatingDynamicPermissions
      || !canCurrentUserManageDynamicPermissions
      || resolveGroupMemberRole(props.group, memberId) !== 'member'
      || !!getTemporaryManagedFeatureGrant(props.group, memberId)
    ) {
      return;
    }

    setIsUpdatingDynamicPermissions(true);
    const nextGrant = buildTemporaryManagedFeatureGrant({
      memberId,
      grantedById: 'user',
    });
    const currentGrants = currentTemporaryPermissionGrants.filter((grant) => grant.memberId !== memberId);

    props.onUpdateGroup({
      temporaryPermissionGrants: [...currentGrants, nextGrant],
    });
    props.setHistory((prev) => [
      ...prev,
      createGrantTemporaryPermissionSystemMessage(member.remarkName?.trim() || member.name, Date.now()),
    ]);
    setIsUpdatingDynamicPermissions(false);
  }, [
    canCurrentUserManageDynamicPermissions,
    currentTemporaryPermissionGrants,
    isUpdatingDynamicPermissions,
    props.group,
    props.members,
    props.onUpdateGroup,
    props.setHistory,
  ]);

  const handleRevokeTemporaryPermission = useCallback(async (memberId: string) => {
    const currentGrant = getTemporaryManagedFeatureGrant(props.group, memberId);
    if (
      isUpdatingDynamicPermissions
      || !canCurrentUserManageDynamicPermissions
      || !currentGrant
    ) {
      return;
    }

    setIsUpdatingDynamicPermissions(true);
    props.onUpdateGroup({
      temporaryPermissionGrants: currentTemporaryPermissionGrants.filter((grant) => grant.id !== currentGrant.id),
    });
    props.setHistory((prev) => [
      ...prev,
      createRevokeTemporaryPermissionSystemMessage(resolveGroupManagedMemberName(memberId), Date.now()),
    ]);
    setIsUpdatingDynamicPermissions(false);
  }, [
    canCurrentUserManageDynamicPermissions,
    currentTemporaryPermissionGrants,
    isUpdatingDynamicPermissions,
    props.group,
    props.onUpdateGroup,
    props.setHistory,
    resolveGroupManagedMemberName,
  ]);

  const handleUpdateBadge = useCallback(async (memberId: string, payload: { label: string; color: string }) => {
    const member = props.members.find((item) => item.id === memberId);
    if (!member || isUpdatingBadge || !canManageGroupMembers(props.group, 'user')) {
      return;
    }

    const memberName = member.remarkName?.trim() || member.name;
    const nextLabel = payload.label.trim();
    const nextColor = payload.color.trim() || '#22c55e';
    const nextBadges = nextLabel
      ? [
          ...currentMemberBadges.filter((badge) => badge.memberId !== memberId),
          { memberId, label: nextLabel, color: nextColor },
        ]
      : currentMemberBadges.filter((badge) => badge.memberId !== memberId);

    setIsUpdatingBadge(true);
    props.onUpdateGroup({ memberBadges: nextBadges });
    props.setHistory((prev) => [
      ...prev,
      nextLabel
        ? createSetMemberBadgeSystemMessage(memberName, nextLabel, Date.now())
        : createClearMemberBadgeSystemMessage(memberName, Date.now()),
    ]);
    setIsUpdatingBadge(false);
  }, [currentMemberBadges, isUpdatingBadge, props]);

  const handleUpdateBubbleColor = useCallback(async (memberId: string, color: string | null) => {
    const isUserMember = memberId === 'user';
    const member = props.members.find((item) => item.id === memberId);
    if (!isUserMember && !member) {
      return;
    }

    const nextColors = color
      ? [
          ...currentMemberBubbleColors.filter((item) => item.memberId !== memberId),
          { memberId, color },
        ]
      : currentMemberBubbleColors.filter((item) => item.memberId !== memberId);

    props.onUpdateGroup({ memberBubbleColors: nextColors });
  }, [currentMemberBubbleColors, props]);

  const handleLeaveCurrentGroup = useCallback(() => {
    if (isLeavingGroup) {
      return;
    }

    setIsLeavingGroup(true);
    props.setHistory((prev) => [
      ...prev,
      createLeaveGroupSystemMessage(Date.now()),
    ]);

    window.setTimeout(() => {
      props.onLeaveGroup();
    }, 280);
  }, [isLeavingGroup, props]);

  return (
    <>
      <AnimatePresence>
        {muteDurationSheet ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isUpdatingMute) {
                  setMuteDurationSheet(null);
                }
              }}
              className="absolute inset-0 z-[122] bg-black/28 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="absolute inset-x-0 bottom-0 z-[123] mx-auto w-full max-w-[430px] rounded-t-[32px] border border-zinc-200 bg-white px-5 pb-6 pt-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[18px] font-semibold text-zinc-900">设置禁言时长</div>
                  <div className="mt-1 text-[13px] leading-5 text-zinc-500">
                    给 {muteDurationSheet.memberName} 选择一个禁言时长，或者保持到手动解除。
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isUpdatingMute}
                  onClick={() => setMuteDurationSheet(null)}
                  className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { label: '10分钟', value: '10m' },
                  { label: '30分钟', value: '30m' },
                  { label: '1小时', value: '1h' },
                  { label: '1天', value: '1d' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isUpdatingMute}
                    onClick={() => {
                      setMuteDurationMode('timed');
                      setMuteDurationDraft(option.value);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                      muteDurationMode === 'timed' && muteDurationDraft === option.value
                        ? 'bg-zinc-200 text-zinc-800'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isUpdatingMute}
                  onClick={() => setMuteDurationMode('manual')}
                  className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                    muteDurationMode === 'manual'
                      ? 'bg-zinc-200 text-zinc-800'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  直到解除
                </button>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[12px] text-zinc-500">自定义时长</div>
                <input
                  value={muteDurationDraft}
                  disabled={muteDurationMode === 'manual' || isUpdatingMute}
                  onChange={(event) => {
                    setMuteDurationMode('timed');
                    setMuteDurationDraft(event.target.value);
                  }}
                  placeholder="例如：45m / 2h / 1d"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
                />
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={isUpdatingMute}
                  onClick={() => setMuteDurationSheet(null)}
                  className="flex-1 rounded-2xl bg-zinc-100 px-4 py-3 text-[14px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-400"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isUpdatingMute}
                  onClick={() => void handleConfirmMuteDuration()}
                  className="flex-1 rounded-2xl bg-zinc-100 px-4 py-3 text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-400"
                >
                  {isUpdatingMute ? '处理中...' : '确认禁言'}
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {props.isOpen ? (
          <>
            <input
              ref={groupAvatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGroupAvatarUpload}
            />
            <GroupSettingsScreen
              groupName={groupDisplayName}
              formState={groupSettingsForm}
              actingRole={actingRole}
              canEditNotice={canCurrentUserEditGroupNotice}
              noticePermissionHint={groupNoticePermissionHint}
              canManageDynamicPermissions={canCurrentUserManageDynamicPermissions}
              memberCount={participantCount}
              members={groupSettingsMembers}
              inviteCandidates={groupSettingsInviteCandidates}
              worldBooks={props.worldBooks}
              messages={props.history}
              groupShortTermSummary={props.group.groupShortTermSummary}
              groupMemberPerspectiveSummaries={props.group.groupMemberPerspectiveSummaries}
              groupLongTermMemory={props.group.groupLongTermMemory}
              onChange={(patch) => setGroupSettingsForm((prev) => ({ ...prev, ...patch }))}
              onClearMemory={(patch) => props.onUpdateGroup(patch)}
              onUpdateGroupBackground={handleUpdateGroupBackground}
              onAvatarPick={() => groupAvatarInputRef.current?.click()}
              onBack={handleCloseGroupSettings}
              onJumpToMessage={(target) => {
                props.onRequestClose();
                props.onJumpToMessage(target);
              }}
              onInviteMember={handleInviteMember}
              onRevealGroupToMember={handleRevealGroupToMember}
              onRemoveMember={handleRemoveMember}
              onToggleAdmin={handleToggleAdmin}
              onToggleMute={handleToggleMute}
              onAssignDutyAdmin={handleAssignDutyAdmin}
              onClearDutyAdmin={handleClearDutyAdmin}
              onGrantTemporaryPermission={handleGrantTemporaryPermission}
              onRevokeTemporaryPermission={handleRevokeTemporaryPermission}
              onUpdateBadge={handleUpdateBadge}
              onUpdateBubbleColor={handleUpdateBubbleColor}
              resolveSenderLabel={props.resolveSenderLabel}
              isInvitingMember={isInvitingMember}
              isRevealingGroup={isRevealingGroup}
              isRemovingMember={isRemovingMember}
              isUpdatingAdmin={isUpdatingAdmin}
              isUpdatingMute={isUpdatingMute}
              isUpdatingDynamicPermissions={isUpdatingDynamicPermissions}
              isUpdatingBadge={isUpdatingBadge}
              onClearHistory={() => {
                if (!window.confirm('确认清空当前群聊记录吗？')) return;
                props.onClearHistory();
                props.onRequestClose();
              }}
              onLeaveGroup={() => {
                if (!window.confirm('确认退出当前群聊吗？')) return;
                props.onRequestClose();
                handleLeaveCurrentGroup();
              }}
            />
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
