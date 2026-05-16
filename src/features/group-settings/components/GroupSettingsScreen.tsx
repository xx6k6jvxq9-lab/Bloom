import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ChatGroup, ChatMessage, WorldBookEntry } from '../../../types';
import { buildGroupWorldBookRetrievalOptions } from '../../group-world-book/groupWorldBookRetrieval';
import { buildWorldBookPromptDiagnostics } from '../../../services/world-book/worldBookBudget';
import type { GroupMemberRole } from '../groupRoles';
import type { GroupSettingsFormState, GroupSettingsMemberSummary } from '../types';
import { GroupChatBackgroundPage } from './GroupChatBackgroundPage';
import { GroupBubbleColorSettingsPage } from './GroupBubbleColorSettingsPage';
import { GroupCustomizationPage } from './GroupCustomizationPage';
import { GroupChatSearchPage } from './GroupChatSearchPage';
import { GroupDynamicPermissionManagementPage } from './GroupDynamicPermissionManagementPage';
import { GroupChatProfilePage } from './GroupChatProfilePage';
import { GroupInterfaceSettingsPage } from './GroupInterfaceSettingsPage';
import { GroupMemberManagementPage } from './GroupMemberManagementPage';
import { GroupMemorySettingsPage } from './GroupMemorySettingsPage';
import { GroupSettingsPage } from './GroupSettingsPage';
import { GroupTitleBadgeSettingsPage } from './GroupTitleBadgeSettingsPage';
import { GroupWorldBookSettingsPage } from './GroupWorldBookSettingsPage';

type GroupSettingsScreenProps = {
  groupName: string;
  formState: GroupSettingsFormState;
  actingRole: GroupMemberRole;
  canEditNotice: boolean;
  noticePermissionHint: string;
  canManageDynamicPermissions: boolean;
  memberCount: number;
  members: GroupSettingsMemberSummary[];
  inviteCandidates: GroupSettingsMemberSummary[];
  worldBooks: WorldBookEntry[];
  messages: ChatMessage[];
  groupShortTermSummary?: ChatGroup['groupShortTermSummary'];
  groupMemberPerspectiveSummaries?: ChatGroup['groupMemberPerspectiveSummaries'];
  groupLongTermMemory?: ChatGroup['groupLongTermMemory'];
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onClearMemory: (patch: Pick<Partial<ChatGroup>, 'groupShortTermSummary' | 'groupMemberPerspectiveSummaries' | 'groupLongTermMemory'>) => void;
  onAvatarPick: () => void;
  onBack: () => void;
  onJumpToMessage: (target: { timestamp: number; text: string }) => void;
  onInviteMember: (memberId: string) => Promise<void> | void;
  onRevealGroupToMember: (memberId: string) => Promise<void> | void;
  onRemoveMember: (memberId: string) => Promise<void> | void;
  onToggleAdmin: (memberId: string) => Promise<void> | void;
  onToggleMute: (memberId: string) => Promise<void> | void;
  onAssignDutyAdmin: (memberId: string) => Promise<void> | void;
  onClearDutyAdmin: (memberId: string) => Promise<void> | void;
  onGrantTemporaryPermission: (memberId: string) => Promise<void> | void;
  onRevokeTemporaryPermission: (memberId: string) => Promise<void> | void;
  onUpdateBadge: (memberId: string, payload: { label: string; color: string }) => Promise<void> | void;
  onUpdateBubbleColor: (memberId: string, color: string | null) => Promise<void> | void;
  onUpdateGroupBackground: (value: string) => void;
  resolveSenderLabel: (message: ChatMessage) => string;
  isInvitingMember?: boolean;
  isRevealingGroup?: boolean;
  isRemovingMember?: boolean;
  isUpdatingAdmin?: boolean;
  isUpdatingMute?: boolean;
  isUpdatingDynamicPermissions?: boolean;
  isUpdatingBadge?: boolean;
  onClearHistory: () => void;
  onLeaveGroup: () => void;
};

const TEXT = {
  title: '\u7fa4\u8bbe\u7f6e',
  peopleSuffix: ' \u4eba',
} as const;

function confirmClearMemory(label: string): boolean {
  return window.confirm(`确认清空${label}吗？这不会删除聊天记录。`);
}

export function GroupSettingsScreen({
  groupName,
  formState,
  actingRole,
  canEditNotice,
  noticePermissionHint,
  canManageDynamicPermissions,
  memberCount,
  members,
  inviteCandidates,
  worldBooks = [],
  messages,
  groupShortTermSummary,
  groupMemberPerspectiveSummaries,
  groupLongTermMemory,
  onChange,
  onClearMemory,
  onAvatarPick,
  onBack,
  onJumpToMessage,
  onInviteMember,
  onRevealGroupToMember,
  onRemoveMember,
  onToggleAdmin,
  onToggleMute,
  onAssignDutyAdmin,
  onClearDutyAdmin,
  onGrantTemporaryPermission,
  onRevokeTemporaryPermission,
  onUpdateBadge,
  onUpdateBubbleColor,
  onUpdateGroupBackground,
  resolveSenderLabel,
  isInvitingMember = false,
  isRevealingGroup = false,
  isRemovingMember = false,
  isUpdatingAdmin = false,
  isUpdatingMute = false,
  isUpdatingDynamicPermissions = false,
  isUpdatingBadge = false,
  onClearHistory,
  onLeaveGroup,
}: GroupSettingsScreenProps) {
  const [page, setPage] = useState<
    'settings' | 'search' | 'member-management' | 'permission-management' | 'profile' | 'customization' | 'background' | 'interface' | 'bubble-colors' | 'title-badges' | 'world-books' | 'memory'
  >('settings');
  const activeGroupWorldBooks = worldBooks.filter((worldBook) => formState.activeWorldBookIds.includes(worldBook.id));
  const groupWorldBookDiagnostics = activeGroupWorldBooks.length > 0
    ? buildWorldBookPromptDiagnostics(
        activeGroupWorldBooks,
        'group',
        buildGroupWorldBookRetrievalOptions({ history: messages }),
      )
    : null;

  return (
    <div className="absolute inset-0 z-[120] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">{TEXT.title}</h2>
          <span className="text-[11px] text-zinc-500">{`${memberCount}${TEXT.peopleSuffix}`}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <GroupSettingsPage
          formState={formState}
          actingRole={actingRole}
          canEditNotice={canEditNotice}
          noticePermissionHint={noticePermissionHint}
          memberCount={memberCount}
          members={members}
          inviteCandidates={inviteCandidates}
          onChange={onChange}
          onAvatarPick={onAvatarPick}
          onInviteMember={onInviteMember}
          onRevealGroupToMember={onRevealGroupToMember}
          onOpenMemberManagement={() => setPage('member-management')}
          onOpenPermissionManagement={() => setPage('permission-management')}
          isInvitingMember={isInvitingMember}
          isRevealingGroup={isRevealingGroup}
          onOpenSearch={() => setPage('search')}
          onOpenProfile={() => setPage('profile')}
          onOpenCustomization={() => setPage('customization')}
          onOpenMemory={() => setPage('memory')}
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
          actingRole={actingRole}
          onBack={() => setPage('settings')}
          onRemoveMember={onRemoveMember}
          onToggleAdmin={onToggleAdmin}
          onToggleMute={onToggleMute}
          canManageAdmins={actingRole === 'owner'}
          canMuteMembers={actingRole === 'owner' || actingRole === 'admin'}
          canRemoveMembers={actingRole === 'owner' || actingRole === 'admin'}
          isRemovingMember={isRemovingMember}
          isUpdatingAdmin={isUpdatingAdmin}
          isUpdatingMute={isUpdatingMute}
        />
      ) : null}

      {page === 'profile' ? (
        <GroupChatProfilePage
          formState={formState}
          onChange={onChange}
          onOpenWorldBooks={() => setPage('world-books')}
          onBack={() => setPage('settings')}
        />
      ) : null}

      {page === 'permission-management' ? (
        <GroupDynamicPermissionManagementPage
          members={members.filter((member) => member.id !== 'user')}
          actingRole={actingRole}
          canManageDynamicPermissions={canManageDynamicPermissions}
          isUpdatingPermissions={isUpdatingDynamicPermissions}
          onBack={() => setPage('settings')}
          onAssignDutyAdmin={onAssignDutyAdmin}
          onClearDutyAdmin={onClearDutyAdmin}
          onGrantTemporaryPermission={onGrantTemporaryPermission}
          onRevokeTemporaryPermission={onRevokeTemporaryPermission}
        />
      ) : null}

      {page === 'memory' ? (
        <GroupMemorySettingsPage
          groupShortTermSummary={groupShortTermSummary}
          groupMemberPerspectiveSummaries={groupMemberPerspectiveSummaries}
          groupLongTermMemory={groupLongTermMemory}
          members={members}
          onBack={() => setPage('settings')}
          onClearShortTermMemory={() => {
            if (confirmClearMemory('群公开短期记忆')) {
              onClearMemory({ groupShortTermSummary: undefined });
            }
          }}
          onClearMemberPerspectives={() => {
            if (confirmClearMemory('角色群内视角')) {
              onClearMemory({ groupMemberPerspectiveSummaries: undefined });
            }
          }}
          onClearLongTermMemory={() => {
            if (confirmClearMemory('群长期记忆')) {
              onClearMemory({ groupLongTermMemory: undefined });
            }
          }}
          onClearAllMemory={() => {
            if (confirmClearMemory('全部群聊后台记忆')) {
              onClearMemory({
                groupShortTermSummary: undefined,
                groupMemberPerspectiveSummaries: undefined,
                groupLongTermMemory: undefined,
              });
            }
          }}
        />
      ) : null}

      {page === 'customization' ? (
        <GroupCustomizationPage
          onBack={() => setPage('settings')}
          onOpenBackground={() => setPage('background')}
          onOpenInterface={() => setPage('interface')}
          onOpenBubbleColors={() => setPage('bubble-colors')}
          onOpenTitleBadges={() => setPage('title-badges')}
        />
      ) : null}

      {page === 'background' ? (
        <GroupChatBackgroundPage
          value={formState.groupBackground}
          onChange={onUpdateGroupBackground}
          onBack={() => setPage('customization')}
        />
      ) : null}

      {page === 'interface' ? (
        <GroupInterfaceSettingsPage
          formState={formState}
          onChange={onChange}
          onBack={() => setPage('customization')}
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

      {page === 'bubble-colors' ? (
        <GroupBubbleColorSettingsPage
          members={members}
          onBack={() => setPage('customization')}
          onUpdateBubbleColor={onUpdateBubbleColor}
        />
      ) : null}

      {page === 'world-books' ? (
        <GroupWorldBookSettingsPage
          worldBooks={worldBooks}
          activeWorldBookIds={formState.activeWorldBookIds}
          diagnostics={groupWorldBookDiagnostics}
          onBack={() => setPage('profile')}
          onToggleWorldBook={(worldBookId) => {
            const currentIds = formState.activeWorldBookIds || [];
            const nextIds = currentIds.includes(worldBookId)
              ? currentIds.filter((id) => id !== worldBookId)
              : [...currentIds, worldBookId];
            onChange({ activeWorldBookIds: nextIds });
          }}
        />
      ) : null}
    </div>
  );
}
