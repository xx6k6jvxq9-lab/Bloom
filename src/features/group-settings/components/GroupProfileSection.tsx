import { ChevronRight, Palette, Search } from 'lucide-react';
import { GROUP_SETTINGS_PLACEHOLDERS, GROUP_SETTINGS_SECTIONS } from '../constants';
import type { GroupSettingsFormState } from '../types';

type GroupProfileSectionProps = {
  formState: GroupSettingsFormState;
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenCustomization: () => void;
};

function TextRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-start gap-4 px-4 py-4">
      <div className="w-20 shrink-0 pt-1 text-[15px] text-zinc-900">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-none bg-transparent px-0 py-0 text-right text-[14px] text-zinc-500 outline-none placeholder:text-zinc-400"
      />
    </label>
  );
}

function Divider() {
  return <div className="border-t border-zinc-100" />;
}

export function GroupProfileSection({
  formState,
  onChange,
  onOpenSearch,
  onOpenProfile,
  onOpenCustomization,
}: GroupProfileSectionProps) {
  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <div className="border-b border-zinc-100 px-4 py-3 text-[13px] font-medium text-zinc-500">
        {GROUP_SETTINGS_SECTIONS.profileTitle}
      </div>

      <TextRow
        label="群公告"
        value={formState.groupNotice}
        placeholder={GROUP_SETTINGS_PLACEHOLDERS.groupNotice}
        onChange={(value) => onChange({ groupNotice: value })}
      />
      <Divider />

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Search size={16} className="text-zinc-400" />
          <span className="text-[15px] text-zinc-900">查找聊天内容</span>
        </div>
        <ChevronRight size={16} className="text-zinc-300" />
      </button>
      <Divider />

      <button
        type="button"
        onClick={onOpenCustomization}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Palette size={16} className="text-zinc-400" />
          <div className="min-w-0">
            <div className="text-[15px] text-zinc-900">群自定义</div>
            <div className="mt-1 line-clamp-2 text-[13px] text-zinc-500">
              管理群聊天背景、群气泡颜色和群头衔设置
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-zinc-300" />
      </button>
      <Divider />

      <button
        type="button"
        onClick={onOpenProfile}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="text-[15px] text-zinc-900">群聊资料</div>
          <div className="mt-1 line-clamp-2 text-[13px] text-zinc-500">
            管理群背景简述、成员关系状态、当前场景和群公开事实
          </div>
        </div>
        <ChevronRight size={16} className="text-zinc-300" />
      </button>
    </section>
  );
}
