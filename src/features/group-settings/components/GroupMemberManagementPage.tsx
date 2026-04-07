import { ChevronLeft, Users, X } from 'lucide-react';
import { getDisplayableAssetValue } from '../../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../persistence/useResolvedPersistentValue';
import { getGroupRoleLabel } from '../groupRoles';
import type { GroupSettingsMemberSummary } from '../types';

type GroupMemberManagementPageProps = {
  members: GroupSettingsMemberSummary[];
  onBack: () => void;
  onRemoveMember: (memberId: string) => Promise<void> | void;
  onToggleAdmin: (memberId: string) => Promise<void> | void;
  canManageAdmins: boolean;
  canRemoveMembers: boolean;
  isRemovingMember?: boolean;
  isUpdatingAdmin?: boolean;
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

export function GroupMemberManagementPage({
  members,
  onBack,
  onRemoveMember,
  onToggleAdmin,
  canManageAdmins,
  canRemoveMembers,
  isRemovingMember = false,
  isUpdatingAdmin = false,
}: GroupMemberManagementPageProps) {
  return (
    <div className="absolute inset-0 z-[121] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">管理成员</h2>
          <span className="text-[11px] text-zinc-500">这里只处理管理员身份和移出成员</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="rounded-[28px] bg-white px-4 py-4 shadow-[0_8px_32px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center gap-3">
                <ResolvedMemberAvatar member={member} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-zinc-900">
                    {member.remarkName?.trim() || member.name}
                  </div>
                  <div className="truncate text-[12px] text-zinc-500">{member.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                      {getGroupRoleLabel(member.role)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {member.role !== 'owner' ? (
                  <button
                    type="button"
                    disabled={!canManageAdmins || isUpdatingAdmin}
                    onClick={() => void onToggleAdmin(member.id)}
                    className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                      canManageAdmins && !isUpdatingAdmin
                        ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        : 'cursor-not-allowed bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {member.role === 'admin' ? '取消管理员' : '设为管理员'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canRemoveMembers || isRemovingMember || member.role === 'owner'}
                  onClick={() => void onRemoveMember(member.id)}
                  className="rounded-full bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`移出${member.remarkName?.trim() || member.name}`}
                  title="移出成员"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
