import { useState } from 'react';
import { ChevronLeft, PencilLine, Users } from 'lucide-react';
import { getDisplayableAssetValue } from '../../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../persistence/useResolvedPersistentValue';
import { GroupMemberBadgeEditorSheet } from './GroupMemberBadgeEditorSheet';
import type { GroupSettingsMemberSummary } from '../types';

type GroupTitleBadgeSettingsPageProps = {
  members: GroupSettingsMemberSummary[];
  onBack: () => void;
  onUpdateBadge: (memberId: string, payload: { label: string; color: string }) => Promise<void> | void;
  canEditBadges: boolean;
  isUpdatingBadge?: boolean;
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

export function GroupTitleBadgeSettingsPage({
  members,
  onBack,
  onUpdateBadge,
  canEditBadges,
  isUpdatingBadge = false,
}: GroupTitleBadgeSettingsPageProps) {
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const editingMember = members.find((member) => member.id === editingMemberId) || null;

  return (
    <div className="absolute inset-0 z-[122] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">群头衔设置</h2>
          <span className="text-[11px] text-zinc-500">先做成员头衔和颜色，后续再接活跃度体系</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-3 rounded-[24px] bg-white px-4 py-4 text-[13px] leading-6 text-zinc-500 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
          这一版先支持按成员设置群头衔和颜色。后续如果要参考 QQ 群头衔，再在这里继续扩成按活跃度分层的正式体系。
        </div>

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
                    {member.badgeLabel?.trim() ? (
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: member.badgeColor || '#22c55e' }}
                      >
                        {member.badgeLabel.trim()}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                        未设置头衔
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canEditBadges || isUpdatingBadge}
                  onClick={() => setEditingMemberId(member.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                    canEditBadges && !isUpdatingBadge
                      ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      : 'cursor-not-allowed bg-zinc-100 text-zinc-400'
                  }`}
                >
                  <PencilLine size={13} />
                  设置
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingMember ? (
        <GroupMemberBadgeEditorSheet
          memberName={editingMember.remarkName?.trim() || editingMember.name}
          initialLabel={editingMember.badgeLabel || ''}
          initialColor={editingMember.badgeColor || '#22c55e'}
          onClose={() => setEditingMemberId(null)}
          onSave={async (payload) => {
            await onUpdateBadge(editingMember.id, payload);
            setEditingMemberId(null);
          }}
        />
      ) : null}
    </div>
  );
}
