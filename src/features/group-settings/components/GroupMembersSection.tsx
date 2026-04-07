import { useState } from 'react';
import { ChevronRight, Plus, Users, X } from 'lucide-react';
import { getDisplayableAssetValue } from '../../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../persistence/useResolvedPersistentValue';
import { GROUP_SETTINGS_SECTIONS } from '../constants';
import type { GroupSettingsMemberSummary } from '../types';

type GroupMembersSectionProps = {
  memberCount: number;
  members: GroupSettingsMemberSummary[];
  inviteCandidates: GroupSettingsMemberSummary[];
  onInviteMember: (memberId: string) => Promise<void> | void;
  onOpenMemberManagement: () => void;
  isInviting?: boolean;
};

function ResolvedMemberAvatar({
  member,
}: {
  member: GroupSettingsMemberSummary;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(member.avatar);
  const src = getDisplayableAssetValue(member.avatar, resolvedUrl);

  if (!src) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200">
        <Users size={16} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={member.remarkName?.trim() || member.name}
      className="h-12 w-12 rounded-full object-cover ring-1 ring-zinc-200"
    />
  );
}

export function GroupMembersSection({
  memberCount,
  members,
  inviteCandidates,
  onInviteMember,
  onOpenMemberManagement,
  isInviting = false,
}: GroupMembersSectionProps) {
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const previewMembers = members.slice(0, 8);

  return (
    <>
      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          onClick={onOpenMemberManagement}
          className="flex w-full items-center justify-between border-b border-zinc-100 px-4 py-3 text-left"
        >
          <div>
            <div className="text-[15px] font-semibold text-zinc-900">{GROUP_SETTINGS_SECTIONS.membersTitle}</div>
            <div className="mt-1 text-[12px] text-zinc-500">{memberCount} 人</div>
          </div>
          <ChevronRight size={18} className="text-zinc-300" />
        </button>

        <div className="px-4 py-4">
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            {previewMembers.map((member) => (
              <div key={member.id} className="flex w-16 flex-col items-center gap-1">
                <ResolvedMemberAvatar member={member} />
                <div className="line-clamp-1 w-full text-center text-[11px] leading-4 text-zinc-500">
                  {member.remarkName?.trim() || member.name}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setShowInvitePicker(true)}
              disabled={inviteCandidates.length === 0 || isInviting}
              className="flex w-16 flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 transition-colors hover:bg-zinc-100">
                <Plus size={18} />
              </div>
              <div className="line-clamp-1 w-full text-center text-[11px] leading-4 text-zinc-500">
                邀请
              </div>
            </button>
          </div>
        </div>
      </section>

      {showInvitePicker && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/35 backdrop-blur-[1px]">
          <div className="w-full max-w-[430px] rounded-t-[28px] bg-white px-4 pb-6 pt-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[16px] font-semibold text-zinc-900">邀请成员进群</div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  选择一个还没进群的角色
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvitePicker(false)}
                className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X size={18} />
              </button>
            </div>

            {inviteCandidates.length > 0 ? (
              <div className="max-h-[48vh] space-y-2 overflow-y-auto pb-2">
                {inviteCandidates.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    disabled={isInviting}
                    onClick={async () => {
                      await onInviteMember(member.id);
                      setShowInvitePicker(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-left transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ResolvedMemberAvatar member={member} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-900">
                        {member.remarkName?.trim() || member.name}
                      </div>
                      <div className="truncate text-[12px] text-zinc-500">{member.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-zinc-50 px-4 py-5 text-center text-[13px] text-zinc-500">
                暂时没有可邀请的成员
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
