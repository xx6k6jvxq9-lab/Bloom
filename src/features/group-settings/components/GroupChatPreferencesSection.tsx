import { GROUP_SETTINGS_PLACEHOLDERS, GROUP_SETTINGS_SECTIONS } from '../constants';
import type { GroupSettingsMemberSummary } from '../types';

type GroupChatPreferencesSectionProps = {
  groupNickname: string;
  groupRemark: string;
  muteNotifications: boolean;
  pinChat: boolean;
  manualReplyEnabled: boolean;
  voiceRepliesEnabled: boolean;
  voiceReplyMemberIds: string[];
  members: GroupSettingsMemberSummary[];
  onChange: (patch: {
    groupNickname?: string;
    groupRemark?: string;
    muteNotifications?: boolean;
    pinChat?: boolean;
    manualReplyEnabled?: boolean;
    voiceRepliesEnabled?: boolean;
    voiceReplyMemberIds?: string[];
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
  voiceRepliesEnabled,
  voiceReplyMemberIds,
  members,
  onChange,
}: GroupChatPreferencesSectionProps) {
  const voiceMembers = members.filter((member) => member.id !== 'user');
  const enabledMemberIds = new Set(voiceReplyMemberIds);

  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <div className="border-b border-zinc-100 px-4 py-3 text-[13px] font-medium text-zinc-500">
        {GROUP_SETTINGS_SECTIONS.chatPreferencesTitle}
      </div>
      <TextRow
        label="我在本群昵称"
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
        label="手动回复模式"
        checked={manualReplyEnabled}
        onToggle={() => onChange({ manualReplyEnabled: !manualReplyEnabled })}
      />
      <div className="border-t border-zinc-100" />
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] text-zinc-900">群聊角色语音</div>
            <div className="mt-1 text-[12px] leading-5 text-zinc-500">
              开启后，群聊里的角色会尝试复用各自在单聊里绑定好的语音设置来发声。
            </div>
          </div>
          <span
            onClick={() => onChange({
              voiceRepliesEnabled: !voiceRepliesEnabled,
              voiceReplyMemberIds: !voiceRepliesEnabled
                ? voiceMembers.map((member) => member.id)
                : voiceReplyMemberIds,
            })}
            className={`relative mt-0.5 h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
              voiceRepliesEnabled ? 'bg-zinc-900' : 'bg-zinc-200'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                voiceRepliesEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </span>
        </div>
        {voiceRepliesEnabled ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] leading-5 text-zinc-500">
              成员开关只决定这个群里要不要尝试播语音。实际是否成功发声，还取决于角色页语音是否开启，以及 API 中心默认 voiceId 或角色自己的 voiceId 是否可用。
            </div>
            {voiceMembers.map((member) => {
              const label = member.remarkName?.trim() || member.name;
              const checked = enabledMemberIds.has(member.id);

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    const nextIds = checked
                      ? voiceReplyMemberIds.filter((id) => id !== member.id)
                      : [...voiceReplyMemberIds, member.id];
                    onChange({ voiceReplyMemberIds: nextIds });
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-zinc-900">{label}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {member.voiceEnabled ? '已在角色页开启语音' : '如果角色页没开语音，这里开启后也不会发声'}
                    </div>
                  </div>
                  <span
                    className={`relative ml-3 h-6 w-11 shrink-0 rounded-full transition-colors ${
                      checked ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        checked ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
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
