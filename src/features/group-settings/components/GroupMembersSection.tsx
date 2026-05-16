import { useState } from 'react';
import { ChevronRight, Crown, Plus, Shield, Users, X } from 'lucide-react';
import { getDisplayableAssetValue } from '../../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../persistence/useResolvedPersistentValue';
import { GROUP_SETTINGS_SECTIONS } from '../constants';
import { getGroupAwarenessSourceLabel } from '../groupAwareness';
import { getGroupRoleCapabilitySummary, getGroupRoleLabel, type GroupMemberRole } from '../groupRoles';
import type { GroupSettingsMemberSummary } from '../types';

type GroupMembersSectionProps = {
  memberCount: number;
  members: GroupSettingsMemberSummary[];
  inviteCandidates: GroupSettingsMemberSummary[];
  actingRole: GroupMemberRole;
  canInviteMembers: boolean;
  onInviteMember: (memberId: string) => Promise<void> | void;
  onRevealGroupToMember: (memberId: string) => Promise<void> | void;
  onOpenMemberManagement: () => void;
  onOpenPermissionManagement: () => void;
  isInviting?: boolean;
  isRevealingGroup?: boolean;
};

function getRoleTone(role: GroupMemberRole) {
  switch (role) {
    case 'owner':
      return {
        chipClassName: 'bg-amber-50 text-amber-700',
        badgeClassName: 'bg-amber-500',
        textClassName: 'text-amber-700',
      };
    case 'admin':
      return {
        chipClassName: 'bg-sky-50 text-sky-700',
        badgeClassName: 'bg-sky-500',
        textClassName: 'text-sky-700',
      };
    default:
      return {
        chipClassName: 'bg-zinc-100 text-zinc-600',
        badgeClassName: '',
        textClassName: 'text-zinc-500',
      };
  }
}

function RoleMarker({ role }: { role: GroupMemberRole }) {
  if (role === 'owner') {
    return <Crown size={10} />;
  }

  if (role === 'admin') {
    return <Shield size={10} />;
  }

  return null;
}

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

function formatCooldownTime(timestamp: number | undefined): string {
  if (!timestamp) {
    return '';
  }

  return new Date(timestamp).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function GroupMembersSection({
  memberCount,
  members,
  inviteCandidates,
  actingRole,
  canInviteMembers,
  onInviteMember,
  onRevealGroupToMember,
  onOpenMemberManagement,
  onOpenPermissionManagement,
  isInviting = false,
  isRevealingGroup = false,
}: GroupMembersSectionProps) {
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const previewMembers = members.slice(0, 8);
  const adminCount = members.filter((member) => member.role === 'admin').length;
  const dutyAdminCount = members.filter((member) => member.isDutyAdmin).length;
  const temporaryGrantCount = members.filter((member) => member.hasTemporaryManagedFeatureGrant).length;
  const actingRoleTone = getRoleTone(actingRole);
  const inviteDisabled = !canInviteMembers || inviteCandidates.length === 0 || isInviting;

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
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
              <span>{memberCount} 人</span>
              <span>{adminCount > 0 ? `${adminCount} 位管理员` : '暂无管理员'}</span>
              <span>{dutyAdminCount > 0 ? `${dutyAdminCount} 位值日` : '暂无值日'}</span>
              <span>{temporaryGrantCount > 0 ? `${temporaryGrantCount} 份临时授权` : '暂无临时授权'}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${actingRoleTone.chipClassName}`}>
                <RoleMarker role={actingRole} />
                当前身份：{getGroupRoleLabel(actingRole)}
              </span>
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600">
                当前权限：{getGroupRoleCapabilitySummary(actingRole)}
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-300" />
        </button>

        <div className="px-4 py-4">
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            {previewMembers.map((member) => (
              <div key={member.id} className="flex w-16 flex-col items-center gap-1">
                <div className="relative">
                  <ResolvedMemberAvatar member={member} />
                  {member.role !== 'member' ? (
                    <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-white ${getRoleTone(member.role).badgeClassName}`}>
                      <RoleMarker role={member.role} />
                    </span>
                  ) : null}
                </div>
                <div className="line-clamp-1 w-full text-center text-[11px] leading-4 text-zinc-500">
                  {member.remarkName?.trim() || member.name}
                </div>
                {member.role !== 'member' ? (
                  <div className={`line-clamp-1 w-full text-center text-[10px] font-medium ${getRoleTone(member.role).textClassName}`}>
                    {getGroupRoleLabel(member.role)}
                  </div>
                ) : null}
                {member.isDutyAdmin ? (
                  <div className="line-clamp-1 w-full text-center text-[10px] font-medium text-amber-700">
                    值日
                  </div>
                ) : member.hasTemporaryManagedFeatureGrant ? (
                  <div className="line-clamp-1 w-full text-center text-[10px] font-medium text-sky-700">
                    临时权
                  </div>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setShowInvitePicker(true)}
              disabled={inviteDisabled}
              className="flex w-16 flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 transition-colors hover:bg-zinc-100">
                <Plus size={18} />
              </div>
              <div className="line-clamp-1 w-full text-center text-[11px] leading-4 text-zinc-500">
                邀请
              </div>
            </button>
            <button
              type="button"
              onClick={onOpenPermissionManagement}
              className="flex w-16 flex-col items-center gap-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-100">
                <Shield size={18} />
              </div>
              <div className="line-clamp-1 w-full text-center text-[11px] leading-4 text-zinc-500">
                权限
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
                  你可以直接邀请，也可以只让对方知道这个群存在，留给后面自然申请。
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
                {inviteCandidates.map((member) => {
                  const canReveal = !member.knowsGroup;

                  return (
                    <div
                      key={member.id}
                      className="rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <ResolvedMemberAvatar member={member} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-zinc-900">
                            {member.remarkName?.trim() || member.name}
                          </div>
                          <div className="truncate text-[12px] text-zinc-500">{member.name}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {member.knowsGroup ? (
                              <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                                {getGroupAwarenessSourceLabel(member.groupAwarenessSource)}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                                尚未知情
                              </span>
                            )}
                            {member.joinRequestCooldownUntil ? (
                              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                                申请冷却中
                              </span>
                            ) : null}
                          </div>
                          {member.joinRequestCooldownUntil ? (
                            <div className="mt-1 text-[11px] text-amber-700">
                              冷却到 {formatCooldownTime(member.joinRequestCooldownUntil)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isInviting}
                          onClick={async () => {
                            await onInviteMember(member.id);
                            setShowInvitePicker(false);
                          }}
                          className="rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                        >
                          直接邀请
                        </button>
                        <button
                          type="button"
                          disabled={!canReveal || isRevealingGroup}
                          onClick={async () => {
                            await onRevealGroupToMember(member.id);
                          }}
                          className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                            canReveal && !isRevealingGroup
                              ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                              : 'cursor-not-allowed bg-zinc-100 text-zinc-400'
                          }`}
                        >
                          {member.knowsGroup ? '已知情' : '让TA知道'}
                        </button>
                      </div>
                    </div>
                  );
                })}
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
