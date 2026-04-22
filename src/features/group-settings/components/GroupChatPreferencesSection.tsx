import { GROUP_SETTINGS_PLACEHOLDERS, GROUP_SETTINGS_SECTIONS } from '../constants';

type GroupChatPreferencesSectionProps = {
  groupNickname: string;
  groupRemark: string;
  muteNotifications: boolean;
  pinChat: boolean;
  manualReplyEnabled: boolean;
  onChange: (patch: {
    groupNickname?: string;
    groupRemark?: string;
    muteNotifications?: boolean;
    pinChat?: boolean;
    manualReplyEnabled?: boolean;
  }) => void;
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
      <div className="w-28 shrink-0 pt-1 text-[15px] text-zinc-900">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-none bg-transparent px-0 py-0 text-right text-[14px] text-zinc-500 outline-none placeholder:text-zinc-400"
      />
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-4 text-left"
    >
      <span className="text-[15px] text-zinc-900">{label}</span>
      <span
        className={`relative h-7 w-12 rounded-full transition-colors ${
          checked ? 'bg-zinc-900' : 'bg-zinc-200'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}

export function GroupChatPreferencesSection({
  groupNickname,
  groupRemark,
  muteNotifications,
  pinChat,
  manualReplyEnabled,
  onChange,
}: GroupChatPreferencesSectionProps) {
  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <div className="border-b border-zinc-100 px-4 py-3 text-[13px] font-medium text-zinc-500">
        {GROUP_SETTINGS_SECTIONS.chatPreferencesTitle}
      </div>
      <TextRow
        label="我在本群的昵称"
        value={groupNickname}
        placeholder={GROUP_SETTINGS_PLACEHOLDERS.groupNickname}
        onChange={(value) => onChange({ groupNickname: value })}
      />
      <div className="border-t border-zinc-100" />
      <TextRow
        label="群备注"
        value={groupRemark}
        placeholder={GROUP_SETTINGS_PLACEHOLDERS.groupRemark}
        onChange={(value) => onChange({ groupRemark: value })}
      />
      <div className="border-t border-zinc-100" />
      <ToggleRow
        label="\u624b\u52a8\u56de\u590d\u6a21\u5f0f"
        checked={manualReplyEnabled}
        onToggle={() => onChange({ manualReplyEnabled: !manualReplyEnabled })}
      />
      <div className="border-t border-zinc-100" />
      <ToggleRow
        label="消息免打扰"
        checked={muteNotifications}
        onToggle={() => onChange({ muteNotifications: !muteNotifications })}
      />
      <div className="border-t border-zinc-100" />
      <ToggleRow
        label="置顶聊天"
        checked={pinChat}
        onToggle={() => onChange({ pinChat: !pinChat })}
      />
    </section>
  );
}
