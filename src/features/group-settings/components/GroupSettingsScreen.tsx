import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ChatMessage } from '../../../types';
import type { GroupSettingsFormState, GroupSettingsMemberSummary } from '../types';
import { GroupChatSearchPage } from './GroupChatSearchPage';
import { GroupSettingsPage } from './GroupSettingsPage';

type GroupSettingsScreenProps = {
  groupName: string;
  formState: GroupSettingsFormState;
  memberCount: number;
  members: GroupSettingsMemberSummary[];
  inviteCandidates: GroupSettingsMemberSummary[];
  messages: ChatMessage[];
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onAvatarPick: () => void;
  onBack: () => void;
  onInviteMember: (memberId: string) => Promise<void> | void;
  resolveSenderLabel: (message: ChatMessage) => string;
  isInvitingMember?: boolean;
  onClearHistory: () => void;
  onLeaveGroup: () => void;
};

export function GroupSettingsScreen({
  groupName,
  formState,
  memberCount,
  members,
  inviteCandidates,
  messages,
  onChange,
  onAvatarPick,
  onBack,
  onInviteMember,
  resolveSenderLabel,
  isInvitingMember = false,
  onClearHistory,
  onLeaveGroup,
}: GroupSettingsScreenProps) {
  const [page, setPage] = useState<'settings' | 'search'>('settings');

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
          isInvitingMember={isInvitingMember}
          onOpenSearch={() => setPage('search')}
          onClearHistory={onClearHistory}
          onLeaveGroup={onLeaveGroup}
        />
      </div>

      {page === 'search' ? (
        <GroupChatSearchPage
          groupName={groupName}
          messages={messages}
          onBack={() => setPage('settings')}
          resolveSenderLabel={resolveSenderLabel}
        />
      ) : null}
    </div>
  );
}
