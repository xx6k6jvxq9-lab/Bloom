import { useState } from 'react';
import { ChevronLeft, Pipette, Users, X } from 'lucide-react';
import { getDisplayableAssetValue } from '../../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../persistence/useResolvedPersistentValue';
import type { GroupSettingsMemberSummary } from '../types';

type GroupBubbleColorSettingsPageProps = {
  members: GroupSettingsMemberSummary[];
  onBack: () => void;
  onUpdateBubbleColor: (memberId: string, color: string | null) => Promise<void> | void;
};

function ResolvedMemberAvatar({ member }: { member: GroupSettingsMemberSummary }) {
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

function BubbleColorEditorSheet({
  member,
  onClose,
  onSave,
}: {
  member: GroupSettingsMemberSummary;
  onClose: () => void;
  onSave: (color: string | null) => Promise<void> | void;
}) {
  const normalizeColor = (value?: string | null) => (value?.trim() || '#ffffff').toUpperCase();
  const [savedColor, setSavedColor] = useState(normalizeColor(member.bubbleColor));
  const [color, setColor] = useState(normalizeColor(member.bubbleColor));
  const hasChanges = color !== savedColor;
  const isDefaultColor = color === '#FFFFFF';

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="w-full max-w-[430px] rounded-t-[28px] bg-white px-4 pb-6 pt-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[16px] font-semibold text-zinc-900">设置群气泡颜色</div>
            <div className="mt-1 text-[12px] text-zinc-500">{member.remarkName?.trim() || member.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className="h-8 w-8 rounded-full border border-zinc-300 bg-zinc-200 shadow-sm"
                style={{ backgroundColor: color }}
              />
              <div>
                <div className="text-[13px] font-medium text-zinc-800">选择气泡颜色</div>
                <div className="text-[12px] text-zinc-500">{color}</div>
              </div>
            </div>
            <div className="relative inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200">
              <Pipette size={14} />
              取色
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          </label>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="mb-2 text-[12px] text-zinc-500">预览</div>
            <div className="flex items-center gap-3">
              <div
                className="rounded-2xl rounded-tl-sm border px-4 py-2 text-[14px] text-zinc-800 shadow-sm"
                style={{
                  backgroundColor: color,
                  borderColor: color === '#FFFFFF' ? '#e4e4e7' : color,
                }}
              >
                今天群气泡会按这个颜色显示。
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setColor(savedColor)}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                hasChanges
                  ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              取消
            </button>
            <button
              type="button"
              onClick={async () => {
                await onSave(null);
                setSavedColor('#FFFFFF');
                setColor('#FFFFFF');
              }}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                isDefaultColor
                  ? 'border-zinc-300 bg-zinc-200 text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              恢复默认
            </button>
            <button
              type="button"
              onClick={async () => {
                await onSave(color);
                setSavedColor(color);
              }}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                hasChanges
                  ? 'border-zinc-300 bg-zinc-200 text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GroupBubbleColorSettingsPage({
  members,
  onBack,
  onUpdateBubbleColor,
}: GroupBubbleColorSettingsPageProps) {
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const editingMember = members.find((member) => member.id === editingMemberId) || null;

  return (
    <div className="absolute inset-0 z-[122] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">群气泡颜色设置</h2>
          <span className="text-[11px] text-zinc-500">按成员设置群消息气泡颜色，只影响当前群聊</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-3 rounded-[24px] bg-white px-4 py-4 text-[13px] leading-6 text-zinc-500 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
          这里设置的是群聊里的成员气泡颜色，不会改动单聊气泡配置。
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
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded-full border border-zinc-300 bg-zinc-100"
                      style={{ backgroundColor: member.bubbleColor || '#ffffff' }}
                    />
                    <span className="text-[12px] text-zinc-500">
                      {member.bubbleColor ? member.bubbleColor.toUpperCase() : '默认白色'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMemberId(member.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] text-zinc-700 transition-colors ${
                    editingMemberId === member.id ? 'bg-zinc-200' : 'bg-zinc-100 hover:bg-zinc-200'
                  }`}
                >
                  <Pipette size={13} />
                  设置
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingMember ? (
        <BubbleColorEditorSheet
          member={editingMember}
          onClose={() => setEditingMemberId(null)}
          onSave={async (color) => {
            await onUpdateBubbleColor(editingMember.id, color);
          }}
        />
      ) : null}
    </div>
  );
}
