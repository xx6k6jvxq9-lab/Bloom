import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { GROUP_RELATIONSHIP_OPTIONS, GROUP_SETTINGS_PLACEHOLDERS } from '../constants';
import type { GroupSettingsFormState } from '../types';

type GroupBackgroundSectionProps = {
  formState: GroupSettingsFormState;
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
};

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-4">
      <div className="text-[15px] text-zinc-900">{label}</div>
      <div className="max-w-[60%] text-right text-[13px] leading-5 text-zinc-500">{value || '未设置'}</div>
    </div>
  );
}

export function GroupBackgroundSection({
  formState,
  onChange,
}: GroupBackgroundSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const relationshipLabel = GROUP_RELATIONSHIP_OPTIONS.find(
    (option) => option.value === formState.memberRelationshipState,
  )?.label;

  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <div>
          <div className="text-[15px] font-semibold text-zinc-900">群背景</div>
          <div className="mt-1 text-[12px] text-zinc-500">让群资料更像真实群，而不是生硬配置。</div>
        </div>
        {isExpanded ? <ChevronDown size={18} className="text-zinc-400" /> : <ChevronRight size={18} className="text-zinc-400" />}
      </button>

      {!isExpanded ? (
        <div className="border-t border-zinc-100">
          <SummaryRow label="群背景简述" value={formState.backgroundSummary} />
          <div className="border-t border-zinc-100" />
          <SummaryRow
            label="成员关系状态"
            value={[relationshipLabel, formState.memberRelationshipNote].filter(Boolean).join(' / ')}
          />
          <div className="border-t border-zinc-100" />
          <SummaryRow label="当前场景" value={formState.currentScene} />
          <div className="border-t border-zinc-100" />
          <SummaryRow label="群公开事实" value={formState.publicFacts} />
        </div>
      ) : (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4">
          <div>
            <div className="mb-2 text-[12px] text-zinc-500">群背景简述</div>
            <textarea
              value={formState.backgroundSummary}
              onChange={(event) => onChange({ backgroundSummary: event.target.value })}
              rows={2}
              placeholder={GROUP_SETTINGS_PLACEHOLDERS.backgroundSummary}
              className="w-full resize-none rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>

          <div>
            <div className="mb-2 text-[12px] text-zinc-500">成员关系状态</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChange({ memberRelationshipState: undefined })}
                className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                  !formState.memberRelationshipState ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                不设置
              </button>
              {GROUP_RELATIONSHIP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ memberRelationshipState: option.value })}
                  className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                    formState.memberRelationshipState === option.value
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <textarea
              value={formState.memberRelationshipNote}
              onChange={(event) => onChange({ memberRelationshipNote: event.target.value })}
              rows={2}
              placeholder={GROUP_SETTINGS_PLACEHOLDERS.memberRelationshipNote}
              className="mt-3 w-full resize-none rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>

          <div>
            <div className="mb-2 text-[12px] text-zinc-500">当前场景</div>
            <textarea
              value={formState.currentScene}
              onChange={(event) => onChange({ currentScene: event.target.value })}
              rows={2}
              placeholder={GROUP_SETTINGS_PLACEHOLDERS.currentScene}
              className="w-full resize-none rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>

          <div>
            <div className="mb-2 text-[12px] text-zinc-500">群公开事实</div>
            <textarea
              value={formState.publicFacts}
              onChange={(event) => onChange({ publicFacts: event.target.value })}
              rows={3}
              placeholder={GROUP_SETTINGS_PLACEHOLDERS.publicFacts}
              className="w-full resize-none rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
        </div>
      )}
    </section>
  );
}
