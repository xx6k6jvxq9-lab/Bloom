import { GROUP_SETTINGS_SECTIONS } from '../constants';
import type { GroupSettingsFormState, GroupSettingsMemberSummary } from '../types';
import { GroupBasicInfoSection } from './GroupBasicInfoSection';
import { GroupChatPreferencesSection } from './GroupChatPreferencesSection';
import { GroupMembersSection } from './GroupMembersSection';
import { GroupProfileSection } from './GroupProfileSection';

type GroupSettingsPageProps = {
  formState: GroupSettingsFormState;
  memberCount: number;
  members: GroupSettingsMemberSummary[];
  inviteCandidates: GroupSettingsMemberSummary[];
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onAvatarPick: () => void;
  onInviteMember: (memberId: string) => Promise<void> | void;
  onOpenMemberManagement: () => void;
  isInvitingMember?: boolean;
  onOpenSearch: () => void;
  onClearHistory: () => void;
  onLeaveGroup: () => void;
};

export function GroupSettingsPage({
  formState,
  memberCount,
  members,
  inviteCandidates,
  onChange,
  onAvatarPick,
  onInviteMember,
  onOpenMemberManagement,
  isInvitingMember = false,
  onOpenSearch,
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
          onInviteMember={onInviteMember}
          onOpenMemberManagement={onOpenMemberManagement}
          isInviting={isInvitingMember}
        />

        <GroupProfileSection formState={formState} onChange={onChange} onOpenSearch={onOpenSearch} />

        <GroupChatPreferencesSection
          groupNickname={formState.groupNickname}
          groupRemark={formState.groupRemark}
          muteNotifications={formState.muteNotifications}
          pinChat={formState.pinChat}
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
              清空聊天记录
            </button>
            <button
              onClick={onLeaveGroup}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-500"
            >
              退出群聊
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
