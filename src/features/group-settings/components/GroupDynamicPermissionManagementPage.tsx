import { ChevronLeft, Clock3, Shield, Sparkles, Users } from 'lucide-react';
import { getDisplayableAssetValue } from '../../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../persistence/useResolvedPersistentValue';
import { getGroupRoleLabel, type GroupMemberRole } from '../groupRoles';
import type { GroupSettingsMemberSummary } from '../types';

type GroupDynamicPermissionManagementPageProps = {
  members: GroupSettingsMemberSummary[];
  actingRole: GroupMemberRole;
  canManageDynamicPermissions: boolean;
  isUpdatingPermissions?: boolean;
  onBack: () => void;
  onAssignDutyAdmin: (memberId: string) => Promise<void> | void;
  onClearDutyAdmin: (memberId: string) => Promise<void> | void;
  onGrantTemporaryPermission: (memberId: string) => Promise<void> | void;
  onRevokeTemporaryPermission: (memberId: string) => Promise<void> | void;
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

function formatExpiryLabel(timestamp: number | undefined): string {
  if (!timestamp) {
    return '未设置';
  }

  return new Date(timestamp).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function GroupDynamicPermissionManagementPage({
  members,
  actingRole,
  canManageDynamicPermissions,
  isUpdatingPermissions = false,
  onBack,
  onAssignDutyAdmin,
  onClearDutyAdmin,
  onGrantTemporaryPermission,
  onRevokeTemporaryPermission,
}: GroupDynamicPermissionManagementPageProps) {
  const dutyAdminMember = members.find((member) => member.isDutyAdmin);
  const temporaryGrantMembers = members.filter((member) => member.hasTemporaryManagedFeatureGrant);

  return (
    <div className="absolute inset-0 z-[121] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">动态权限</h2>
          <span className="text-[11px] text-zinc-500">值日管理员和一次性群事件授权</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <section className="rounded-[28px] border border-zinc-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600">
                当前身份：{getGroupRoleLabel(actingRole)}
              </span>
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600">
                {canManageDynamicPermissions ? '可管理动态权限' : '仅可查看动态权限'}
              </span>
            </div>

            <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-800">
                <Clock3 size={15} />
                值日管理员
              </div>
              {dutyAdminMember ? (
                <div className="mt-2 space-y-1 text-[13px] text-amber-900">
                  <div>{dutyAdminMember.remarkName?.trim() || dutyAdminMember.name}</div>
                  <div className="text-[12px] text-amber-700">到期时间：{formatExpiryLabel(dutyAdminMember.dutyAdminExpiresAt)}</div>
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-amber-700">当前没有值日管理员。</div>
              )}
            </div>

            <div className="mt-3 rounded-[24px] border border-sky-200 bg-sky-50/80 px-4 py-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-sky-800">
                <Sparkles size={15} />
                临时群事件权
              </div>
              {temporaryGrantMembers.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {temporaryGrantMembers.map((member) => (
                    <div key={member.id} className="text-[12px] text-sky-800">
                      <div>{member.remarkName?.trim() || member.name}</div>
                      <div className="text-sky-700">
                        剩余 {member.temporaryManagedFeatureGrantRemainingUses || 1} 次，至 {formatExpiryLabel(member.temporaryManagedFeatureGrantExpiresAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-sky-700">当前没有临时群事件授权。</div>
              )}
            </div>
          </section>

          {members.map((member) => {
            const displayName = member.remarkName?.trim() || member.name;
            const canGrantDynamicPermission = member.role === 'member';

            return (
              <section
                key={member.id}
                className="rounded-[28px] border border-zinc-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center gap-3">
                  <ResolvedMemberAvatar member={member} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-zinc-900">{displayName}</div>
                    <div className="truncate text-[12px] text-zinc-500">{member.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                        {getGroupRoleLabel(member.role)}
                      </span>
                      {member.isDutyAdmin ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                          值日中
                        </span>
                      ) : null}
                      {member.hasTemporaryManagedFeatureGrant ? (
                        <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                          临时群事件权
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {(member.isDutyAdmin || member.hasTemporaryManagedFeatureGrant) ? (
                  <div className="mt-3 space-y-1 text-[12px] text-zinc-500">
                    {member.isDutyAdmin ? (
                      <div>值日到期：{formatExpiryLabel(member.dutyAdminExpiresAt)}</div>
                    ) : null}
                    {member.hasTemporaryManagedFeatureGrant ? (
                      <div>
                        临时群事件权剩余 {member.temporaryManagedFeatureGrantRemainingUses || 1} 次，至 {formatExpiryLabel(member.temporaryManagedFeatureGrantExpiresAt)}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      !canManageDynamicPermissions
                      || isUpdatingPermissions
                      || (!member.isDutyAdmin && !canGrantDynamicPermission)
                    }
                    onClick={() => {
                      if (member.isDutyAdmin) {
                        void onClearDutyAdmin(member.id);
                        return;
                      }
                      void onAssignDutyAdmin(member.id);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                      canManageDynamicPermissions && canGrantDynamicPermission && !isUpdatingPermissions
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'cursor-not-allowed bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {member.isDutyAdmin ? '结束值日' : '设为今日值日'}
                  </button>

                  <button
                    type="button"
                    disabled={
                      !canManageDynamicPermissions
                      || isUpdatingPermissions
                      || (!member.hasTemporaryManagedFeatureGrant && !canGrantDynamicPermission)
                    }
                    onClick={() => {
                      if (member.hasTemporaryManagedFeatureGrant) {
                        void onRevokeTemporaryPermission(member.id);
                        return;
                      }
                      void onGrantTemporaryPermission(member.id);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                      canManageDynamicPermissions && canGrantDynamicPermission && !isUpdatingPermissions
                        ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                        : 'cursor-not-allowed bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {member.hasTemporaryManagedFeatureGrant ? '撤销临时授权' : '授权一次群事件'}
                  </button>
                </div>

                {!canGrantDynamicPermission && !member.isDutyAdmin && !member.hasTemporaryManagedFeatureGrant ? (
                  <div className="mt-3 text-[11px] text-zinc-400">
                    固定管理员本身已有群事件权限，不需要额外动态授权。
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
