import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ChatMessage } from '../../../types';
import type { GroupMemberRole } from '../groupRoles';
import type { GroupSettingsFormState, GroupSettingsMemberSummary } from '../types';
import { GroupCustomizationPage } from './GroupCustomizationPage';
import { GroupChatSearchPage } from './GroupChatSearchPage';
import { GroupChatProfilePage } from './GroupChatProfilePage';
import { GroupMemberManagementPage } from './GroupMemberManagementPage';
import { GroupSettingsPage } from './GroupSettingsPage';
import { GroupTitleBadgeSettingsPage } from './GroupTitleBadgeSettingsPage';

type GroupSettingsScreenProps = {
  groupName: string;
  formState: GroupSettingsFormState;
  actingRole: GroupMemberRole;
  memberCount: number;
  members: GroupSettingsMemberSummary[];
  inviteCandidates: GroupSettingsMemberSummary[];
  messages: ChatMessage[];
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onAvatarPick: () => void;
  onBack: () => void;
  onJumpToMessage: (target: { timestamp: number; text: string }) => void;
  onInviteMember: (memberId: string) => Promise<void> | void;
  onRemoveMember: (memberId: string) => Promise<void> | void;
  onToggleAdmin: (memberId: string) => Promise<void> | void;
  onUpdateBadge: (memberId: string, payload: { label: string; color: string }) => Promise<void> | void;
  resolveSenderLabel: (message: ChatMessage) => string;
  isInvitingMember?: boolean;
  isRemovingMember?: boolean;
  isUpdatingAdmin?: boolean;
  isUpdatingBadge?: boolean;
  onClearHistory: () => void;
  onLeaveGroup: () => void;
};

export function GroupSettingsScreen({
  groupName,
  formState,
  actingRole,
  memberCount,
  members,
  inviteCandidates,
  messages,
  onChange,
  onAvatarPick,
  onBack,
  onJumpToMessage,
  onInviteMember,
  onRemoveMember,
  onToggleAdmin,
  onUpdateBadge,
  resolveSenderLabel,
  isInvitingMember = false,
  isRemovingMember = false,
  isUpdatingAdmin = false,
  isUpdatingBadge = false,
  onClearHistory,
  onLeaveGroup,
}: GroupSettingsScreenProps) {
  const [page, setPage] = useState<'settings' | 'search' | 'member-management' | 'profile' | 'customization' | 'title-badges'>('settings');

  return (
    <div className="absolute inset-0 z-[120] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">群设置</h2>
          <span className="text-[11px] text-zinc-500">{memberCount} 人</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <GroupSettingsPage
          formState={formState}
          memberCount={memberCount}
          members={members}
          inviteCandidates={inviteCandidates}
          onChange={onChange}
          onAvatarPick={onAvatarPick}
          onInviteMember={onInviteMember}
          onOpenMemberManagement={() => setPage('member-management')}
          isInvitingMember={isInvitingMember}
          onOpenSearch={() => setPage('search')}
          onOpenProfile={() => setPage('profile')}
          onOpenCustomization={() => setPage('customization')}
          onClearHistory={onClearHistory}
          onLeaveGroup={onLeaveGroup}
        />
      </div>

      {page === 'search' ? (
        <GroupChatSearchPage
          groupName={groupName}
          messages={messages}
          onBack={() => setPage('settings')}
          onSelectResult={(target) => {
            onJumpToMessage(target);
          }}
          resolveSenderLabel={resolveSenderLabel}
        />
      ) : null}

      {page === 'member-management' ? (
        <GroupMemberManagementPage
          members={members.filter((member) => member.id !== 'user')}
          onBack={() => setPage('settings')}
          onRemoveMember={onRemoveMember}
          onToggleAdmin={onToggleAdmin}
          canManageAdmins={actingRole === 'owner'}
          canRemoveMembers={actingRole === 'owner' || actingRole === 'admin'}
          isRemovingMember={isRemovingMember}
          isUpdatingAdmin={isUpdatingAdmin}
        />
      ) : null}

      {page === 'profile' ? (
        <GroupChatProfilePage
          formState={formState}
          onChange={onChange}
          onBack={() => setPage('settings')}
        />
      ) : null}

      {page === 'customization' ? (
        <GroupCustomizationPage
          onBack={() => setPage('settings')}
          onOpenTitleBadges={() => setPage('title-badges')}
        />
      ) : null}

      {page === 'title-badges' ? (
        <GroupTitleBadgeSettingsPage
          members={members.filter((member) => member.id !== 'user')}
          onBack={() => setPage('customization')}
          onUpdateBadge={onUpdateBadge}
          canEditBadges={actingRole === 'owner' || actingRole === 'admin'}
          isUpdatingBadge={isUpdatingBadge}
        />
      ) : null}
    </div>
  );
}
