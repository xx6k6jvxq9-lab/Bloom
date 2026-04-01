import { ChevronLeft } from 'lucide-react';
import type {
  CoupleSpaceInitiativeCadence,
  CoupleSpaceInitiativeSettings,
  CoupleSpaceOpportunityLevel,
} from '../../../types';

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  settings: CoupleSpaceInitiativeSettings;
  onChange: (next: CoupleSpaceInitiativeSettings) => void;
};

const cadenceOptions: Array<{ value: CoupleSpaceInitiativeCadence; label: string }> = [
  { value: 'off', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

const opportunityOptions: Array<{ value: CoupleSpaceOpportunityLevel; label: string }> = [
  { value: 'off', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-zinc-700">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-full border border-[#f2cddd] bg-[#fff8fb] px-4 py-2 pr-9 text-sm text-zinc-700 shadow-sm outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronLeft
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 text-[#d99ab5]"
        />
      </div>
    </div>
  );
}

export function CoupleSpaceInitiativeSettingsCard({
  isOpen,
  onToggle,
  settings,
  onChange,
}: Props) {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="font-bold text-zinc-800">主动内容设置</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            默认全部关闭，只有你明确开启后，系统才会考虑对应的主动内容。
          </p>
        </div>
        <ChevronLeft
          size={18}
          className={`transition-transform ${isOpen ? '-rotate-90' : 'rotate-180'} text-[#d99ab5]`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-[#f7d7e3]">
          <div className="border-b border-[#f7d7e3] p-4">
            <p className="mb-3 text-xs font-bold uppercase text-[#d99ab5]">发布类</p>
            <div className="space-y-3">
              <SelectRow
                label="情侣日常"
                value={settings.publishing.dailyPost.cadence}
                options={cadenceOptions}
                onChange={(value) =>
                  onChange({
                    ...settings,
                    publishing: {
                      ...settings.publishing,
                      dailyPost: {
                        enabled: value !== 'off',
                        cadence: value as CoupleSpaceInitiativeCadence,
                      },
                    },
                  })
                }
              />
              <SelectRow
                label="主动情书"
                value={settings.publishing.loveLetter.cadence}
                options={cadenceOptions}
                onChange={(value) =>
                  onChange({
                    ...settings,
                    publishing: {
                      ...settings.publishing,
                      loveLetter: {
                        enabled: value !== 'off',
                        cadence: value as CoupleSpaceInitiativeCadence,
                      },
                    },
                  })
                }
              />
              <SelectRow
                label="留言板内容"
                value={settings.publishing.messageBoard.cadence}
                options={cadenceOptions}
                onChange={(value) =>
                  onChange({
                    ...settings,
                    publishing: {
                      ...settings.publishing,
                      messageBoard: {
                        enabled: value !== 'off',
                        cadence: value as CoupleSpaceInitiativeCadence,
                      },
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="border-b border-[#f7d7e3] p-4">
            <p className="mb-3 text-xs font-bold uppercase text-[#d99ab5]">互记类</p>
            <label className="mb-3 flex items-center justify-between gap-3 py-1">
              <span className="text-sm text-zinc-700">主动补记互记</span>
              <input
                type="checkbox"
                checked={settings.memo.writeCoNote.enabled}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    memo: {
                      ...settings.memo,
                      writeCoNote: {
                        ...settings.memo.writeCoNote,
                        enabled: e.target.checked,
                      },
                    },
                  })
                }
                className="h-4 w-4 rounded border-[#f2cddd] accent-[#f6b6cd]"
              />
            </label>
            <SelectRow
              label="触发积极度"
              value={settings.memo.writeCoNote.opportunityLevel}
              options={opportunityOptions}
              onChange={(value) =>
                onChange({
                  ...settings,
                  memo: {
                    ...settings.memo,
                    writeCoNote: {
                      ...settings.memo.writeCoNote,
                      enabled: value !== 'off' ? true : settings.memo.writeCoNote.enabled,
                      opportunityLevel: value as CoupleSpaceOpportunityLevel,
                    },
                  },
                })
              }
            />
          </div>

          <div className="border-b border-[#f7d7e3] p-4">
            <p className="mb-3 text-xs font-bold uppercase text-[#d99ab5]">记录类</p>
            <label className="flex items-center justify-between gap-3 py-1">
              <div>
                <span className="text-sm text-zinc-700">账本待确认记录</span>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  这类内容不会自动入账，只会生成待确认结果。
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.recording.createLedgerEntry.enabled}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    recording: {
                      ...settings.recording,
                      createLedgerEntry: {
                        ...settings.recording.createLedgerEntry,
                        enabled: e.target.checked,
                      },
                    },
                  })
                }
                className="h-4 w-4 rounded border-[#f2cddd] accent-[#f6b6cd]"
              />
            </label>
          </div>

          <div className="p-4">
            <p className="mb-3 text-xs font-bold uppercase text-[#d99ab5]">互动类</p>
            <div className="space-y-3">
              <SelectRow
                label="情书回复"
                value={settings.interaction.replyLoveLetter.opportunityLevel}
                options={opportunityOptions}
                onChange={(value) =>
                  onChange({
                    ...settings,
                    interaction: {
                      ...settings.interaction,
                      replyLoveLetter: {
                        enabled: value !== 'off',
                        opportunityLevel: value as CoupleSpaceOpportunityLevel,
                      },
                    },
                  })
                }
              />
              <SelectRow
                label="评论回复"
                value={settings.interaction.replyDailyComment.opportunityLevel}
                options={opportunityOptions}
                onChange={(value) =>
                  onChange({
                    ...settings,
                    interaction: {
                      ...settings.interaction,
                      replyDailyComment: {
                        enabled: value !== 'off',
                        opportunityLevel: value as CoupleSpaceOpportunityLevel,
                      },
                    },
                  })
                }
              />
              <SelectRow
                label="留言板回复"
                value={settings.interaction.replyMessageBoard.opportunityLevel}
                options={opportunityOptions}
                onChange={(value) =>
                  onChange({
                    ...settings,
                    interaction: {
                      ...settings.interaction,
                      replyMessageBoard: {
                        enabled: value !== 'off',
                        opportunityLevel: value as CoupleSpaceOpportunityLevel,
                      },
                    },
                  })
                }
              />
              <SelectRow
                label="动态互动"
                value={settings.interaction.reactToExistingPost.opportunityLevel}
                options={opportunityOptions}
                onChange={(value) =>
                  onChange({
                    ...settings,
                    interaction: {
                      ...settings.interaction,
                      reactToExistingPost: {
                        enabled: value !== 'off',
                        opportunityLevel: value as CoupleSpaceOpportunityLevel,
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
