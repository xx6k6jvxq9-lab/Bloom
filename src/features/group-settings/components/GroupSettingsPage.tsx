import { GROUP_SETTINGS_SECTIONS } from '../constants';
import type { GroupMemberRole } from '../groupRoles';
import type { GroupSettingsFormState, GroupSettingsMemberSummary } from '../types';
import { GroupBasicInfoSection } from './GroupBasicInfoSection';
import { GroupChatPreferencesSection } from './GroupChatPreferencesSection';
import { GroupMembersSection } from './GroupMembersSection';
import { GroupProfileSection } from './GroupProfileSection';

type GroupSettingsPageProps = {
  formState: GroupSettingsFormState;
  actingRole: GroupMemberRole;
  canEditNotice: boolean;
  noticePermissionHint: string;
  memberCount: number;
  members: GroupSettingsMemberSummary[];
  inviteCandidates: GroupSettingsMemberSummary[];
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onAvatarPick: () => void;
  onInviteMember: (memberId: string) => Promise<void> | void;
  onRevealGroupToMember: (memberId: string) => Promise<void> | void;
  onOpenMemberManagement: () => void;
  onOpenPermissionManagement: () => void;
  isInvitingMember?: boolean;
  isRevealingGroup?: boolean;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenCustomization: () => void;
  onOpenMemory: () => void;
  onClearHistory: () => void;
  onLeaveGroup: () => void;
};

const TEXT = {
  clearHistory: '\u6e05\u7a7a\u804a\u5929\u8bb0\u5f55',
  leaveGroup: '\u9000\u51fa\u7fa4\u804a',
} as const;

export function GroupSettingsPage({
  formState,
  actingRole,
  canEditNotice,
  noticePermissionHint,
  memberCount,
  members,
  inviteCandidates,
  onChange,
  onAvatarPick,
  onInviteMember,
  onRevealGroupToMember,
  onOpenMemberManagement,
  onOpenPermissionManagement,
  isInvitingMember = false,
  isRevealingGroup = false,
  onOpenSearch,
  onOpenProfile,
  onOpenCustomization,
  onOpenMemory,
  onClearHistory,
  onLeaveGroup,
}: GroupSettingsPageProps) {
  return (
    <div className="min-h-full bg-[#f5f5f7] p-4">
      <div className="space-y-3">
        <GroupBasicInfoSection
          groupName={formState.name}
          groupAvatar={formState.avatar}
          onGroupNameChange={(value) => onChange({ name: value })}
          onAvatarPick={onAvatarPick}
        />

        <GroupMembersSection
          memberCount={memberCount}
          members={members}
          inviteCandidates={inviteCandidates}
          actingRole={actingRole}
          canInviteMembers={actingRole === 'owner' || actingRole === 'admin'}
          onInviteMember={onInviteMember}
          onRevealGroupToMember={onRevealGroupToMember}
          onOpenMemberManagement={onOpenMemberManagement}
          onOpenPermissionManagement={onOpenPermissionManagement}
          isInviting={isInvitingMember}
          isRevealingGroup={isRevealingGroup}
        />

        <GroupProfileSection
          canEditNotice={canEditNotice}
          noticePermissionHint={noticePermissionHint}
          formState={formState}
          onChange={onChange}
          onOpenSearch={onOpenSearch}
          onOpenProfile={onOpenProfile}
          onOpenCustomization={onOpenCustomization}
          onOpenMemory={onOpenMemory}
        />

        <GroupChatPreferencesSection
          groupNickname={formState.groupNickname}
          groupRemark={formState.groupRemark}
          muteNotifications={formState.muteNotifications}
          pinChat={formState.pinChat}
          manualReplyEnabled={formState.manualReplyEnabled}
          voiceRepliesEnabled={formState.voiceRepliesEnabled}
          voiceReplyMemberIds={formState.voiceReplyMemberIds}
          members={members}
          onChange={onChange}
        />

        <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
          <div className="border-b border-zinc-100 px-4 py-3 text-[13px] font-medium text-zinc-500">
            {GROUP_SETTINGS_SECTIONS.dangerTitle}
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <button
              onClick={onClearHistory}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700"
            >
              {TEXT.clearHistory}
            </button>
            <button
              onClick={onLeaveGroup}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-500"
            >
              {TEXT.leaveGroup}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
