import { useState } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_GROUP_BADGE_COLOR, GROUP_BADGE_COLOR_PRESETS } from '../memberBadges';

type GroupMemberBadgeEditorSheetProps = {
  memberName: string;
  initialLabel: string;
  initialColor: string;
  onClose: () => void;
  onSave: (payload: { label: string; color: string }) => void;
};

export function GroupMemberBadgeEditorSheet({
  memberName,
  initialLabel,
  initialColor,
  onClose,
  onSave,
}: GroupMemberBadgeEditorSheetProps) {
  const [label, setLabel] = useState(initialLabel);
  const [color, setColor] = useState(initialColor || DEFAULT_GROUP_BADGE_COLOR);

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
              maxLength={14}
              placeholder="例如：Lv4 小方狗"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-800 outline-none placeholder:text-zinc-400"
            />
          </div>

          <div>
            <div className="mb-2 text-[13px] font-medium text-zinc-700">头衔颜色</div>
            <div className="flex flex-wrap gap-3">
              {GROUP_BADGE_COLOR_PRESETS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`h-8 w-8 rounded-full ring-2 transition-transform hover:scale-105 ${
                    color === presetColor ? 'ring-zinc-900' : 'ring-transparent'
                  }`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="mb-2 text-[12px] text-zinc-500">预览</div>
            <div className="flex items-center gap-2">
              {label.trim() ? (
                <span
                  className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {label.trim()}
                </span>
              ) : null}
              <span className="text-[13px] text-zinc-700">{memberName}</span>
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
              onClick={() => onSave({ label, color })}
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
