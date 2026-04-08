import { useMemo, useState } from 'react';
import { Pipette, X } from 'lucide-react';
import { DEFAULT_GROUP_BADGE_COLOR } from '../memberBadges';

type GroupMemberBadgeEditorSheetProps = {
  memberName: string;
  initialLabel: string;
  initialColor: string;
  onClose: () => void;
  onSave: (payload: { label: string; color: string }) => void;
};

function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : DEFAULT_GROUP_BADGE_COLOR;
}

export function GroupMemberBadgeEditorSheet({
  memberName,
  initialLabel,
  initialColor,
  onClose,
  onSave,
}: GroupMemberBadgeEditorSheetProps) {
  const [label, setLabel] = useState(initialLabel);
  const [color, setColor] = useState(normalizeHexColor(initialColor || DEFAULT_GROUP_BADGE_COLOR));
  const trimmedLabel = label.trim();
  const previewLabel = useMemo(() => trimmedLabel || '未设置头衔', [trimmedLabel]);

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="w-full max-w-[430px] rounded-t-[28px] bg-white px-4 pb-6 pt-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[16px] font-semibold text-zinc-900">设置群内头衔</div>
            <div className="mt-1 text-[12px] text-zinc-500">{memberName}</div>
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
          <div>
            <div className="mb-2 text-[13px] font-medium text-zinc-700">头衔文字</div>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={12}
              placeholder="输入这个成员在群里的头衔"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-800 outline-none placeholder:text-zinc-400"
            />
          </div>

          <div>
            <div className="mb-2 text-[13px] font-medium text-zinc-700">头衔颜色</div>
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-8 w-8 rounded-full border border-black/10 shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <div className="text-[13px] font-medium text-zinc-800">使用取色器</div>
                  <div className="text-[12px] text-zinc-500">{color.toUpperCase()}</div>
                </div>
              </div>
              <div className="relative inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200">
                <Pipette size={14} />
                选择颜色
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(normalizeHexColor(event.target.value))}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </div>
            </label>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="mb-2 text-[12px] text-zinc-500">预览</div>
            <div className="flex items-center gap-2">
              {trimmedLabel ? (
                <span
                  className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {previewLabel}
                </span>
              ) : null}
              <span className="text-[13px] font-medium text-zinc-700">{memberName}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => onSave({ label: trimmedLabel, color })}
              className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white"
            >
              保存头衔
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
