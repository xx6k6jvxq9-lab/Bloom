import { ChevronLeft, Trash2 } from 'lucide-react';
import type { ChatGroup } from '../../../types';
import { cleanLegacyGroupMemberPerspectiveText } from '../../../services/group-chat/groupShortTermMemory';
import type { GroupSettingsMemberSummary } from '../types';

type GroupMemorySettingsPageProps = {
  groupShortTermSummary?: ChatGroup['groupShortTermSummary'];
  groupMemberPerspectiveSummaries?: ChatGroup['groupMemberPerspectiveSummaries'];
  groupLongTermMemory?: ChatGroup['groupLongTermMemory'];
  members: GroupSettingsMemberSummary[];
  onBack: () => void;
  onClearShortTermMemory: () => void;
  onClearMemberPerspectives: () => void;
  onClearLongTermMemory: () => void;
  onClearAllMemory: () => void;
};

const TEXT = {
  title: '群聊记忆',
  subtitle: '后台用于稳定群聊，不会在聊天页直接显示',
  publicShortTerm: '群公开短期记忆',
  memberPerspectives: '角色群内视角',
  longTerm: '群长期记忆',
  empty: '暂无内容',
  clear: '清空',
  clearAll: '清空全部群记忆',
} as const;

function formatMemoryForDisplay(value?: string): string {
  if (!value) {
    return '';
  }

  return cleanLegacyGroupMemberPerspectiveText(value)
    .replace(/\s+([，。！？；：])/g, '$1')
    .trim();
}

function MemorySection({
  title,
  children,
  onClear,
}: {
  title: string;
  children: React.ReactNode;
  onClear: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="text-[13px] font-medium text-zinc-500">{title}</div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-600 active:bg-zinc-200"
        >
          <Trash2 size={13} />
          {TEXT.clear}
        </button>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function EmptyState() {
  return <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-[13px] leading-5 text-zinc-400">{TEXT.empty}</div>;
}

function TextBlock({ value }: { value?: string }) {
  const displayValue = formatMemoryForDisplay(value);
  if (!displayValue) {
    return <EmptyState />;
  }

  return (
    <div className="whitespace-pre-wrap rounded-2xl bg-zinc-50 px-4 py-3 text-[13px] leading-6 text-zinc-700">
      {displayValue}
    </div>
  );
}

function getMemberName(memberId: string, members: GroupSettingsMemberSummary[]): string {
  const member = members.find((item) => item.id === memberId);
  return member?.remarkName?.trim() || member?.name || memberId;
}

export function GroupMemorySettingsPage({
  groupShortTermSummary,
  groupMemberPerspectiveSummaries,
  groupLongTermMemory,
  members,
  onBack,
  onClearShortTermMemory,
  onClearMemberPerspectives,
  onClearLongTermMemory,
  onClearAllMemory,
}: GroupMemorySettingsPageProps) {
  const perspectiveEntries = Object.entries(groupMemberPerspectiveSummaries || {})
    .map(([memberId, value]) => [memberId, formatMemoryForDisplay(value)] as const)
    .filter(([, value]) => value.length > 0);
  const memberRoleEntries = Object.entries(groupLongTermMemory?.memberRoles || {})
    .map(([memberId, value]) => [memberId, formatMemoryForDisplay(value)] as const)
    .filter(([, value]) => value.length > 0);

  return (
    <div className="absolute inset-0 z-[140] flex flex-col bg-[#f5f5f7]">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-zinc-900">{TEXT.title}</h2>
          <div className="mt-0.5 text-[11px] text-zinc-500">{TEXT.subtitle}</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <MemorySection title={TEXT.publicShortTerm} onClear={onClearShortTermMemory}>
          <TextBlock value={groupShortTermSummary} />
        </MemorySection>

        <MemorySection title={TEXT.memberPerspectives} onClear={onClearMemberPerspectives}>
          {perspectiveEntries.length > 0 ? (
            perspectiveEntries.map(([memberId, value]) => (
              <div key={memberId} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">{getMemberName(memberId, members)}</div>
                <div className="whitespace-pre-wrap text-[13px] leading-6 text-zinc-700">{value}</div>
              </div>
            ))
          ) : (
            <EmptyState />
          )}
        </MemorySection>

        <MemorySection title={TEXT.longTerm} onClear={onClearLongTermMemory}>
          <TextBlock value={groupLongTermMemory?.atmosphere} />
          <TextBlock value={groupLongTermMemory?.recurringDynamics} />
          <TextBlock value={groupLongTermMemory?.sharedHistory} />
          {memberRoleEntries.length > 0 ? (
            memberRoleEntries.map(([memberId, value]) => (
              <div key={memberId} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">{getMemberName(memberId, members)}</div>
                <div className="whitespace-pre-wrap text-[13px] leading-6 text-zinc-700">{value}</div>
              </div>
            ))
          ) : null}
        </MemorySection>

        <button
          type="button"
          onClick={onClearAllMemory}
          className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-red-50 px-4 py-4 text-[14px] font-semibold text-red-500 active:bg-red-100"
        >
          <Trash2 size={16} />
          {TEXT.clearAll}
        </button>
      </div>
    </div>
  );
}
