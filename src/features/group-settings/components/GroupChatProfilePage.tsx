import { ChevronLeft } from 'lucide-react';
import { GROUP_RELATIONSHIP_OPTIONS, GROUP_SETTINGS_PLACEHOLDERS } from '../constants';
import type { GroupSettingsFormState } from '../types';

type GroupChatProfilePageProps = {
  formState: GroupSettingsFormState;
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onBack: () => void;
};

function SectionCard({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="text-[15px] font-semibold text-zinc-900">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-zinc-500">{summary}</div>
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function getDisplayValue(value: string, placeholder: string) {
  const trimmed = value.trim();
  return trimmed || placeholder;
}

export function GroupChatProfilePage({
  formState,
  onChange,
  onBack,
}: GroupChatProfilePageProps) {
  const relationshipLabel = GROUP_RELATIONSHIP_OPTIONS.find(
    (option) => option.value === formState.memberRelationshipState,
  )?.label;
  const relationshipSummary = [relationshipLabel, formState.memberRelationshipNote.trim()]
    .filter(Boolean)
    .join(' / ') || '未设置';

  return (
    <div className="absolute inset-0 z-[121] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">群聊资料</h2>
          <span className="text-[11px] text-zinc-500">用于影响群聊语气、亲疏和场景感</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <SectionCard
            title="群背景简述"
            summary={getDisplayValue(formState.backgroundSummary, GROUP_SETTINGS_PLACEHOLDERS.backgroundSummary)}
          >
            <textarea
              value={formState.backgroundSummary}
              onChange={(event) => onChange({ backgroundSummary: event.target.value })}
              rows={4}
              placeholder={GROUP_SETTINGS_PLACEHOLDERS.backgroundSummary}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-700 outline-none placeholder:text-zinc-400"
            />
          </SectionCard>

          <SectionCard
            title="成员关系状态"
            summary={relationshipSummary}
          >
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
              rows={3}
              placeholder={GROUP_SETTINGS_PLACEHOLDERS.memberRelationshipNote}
              className="mt-3 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-700 outline-none placeholder:text-zinc-400"
            />
          </SectionCard>

          <SectionCard
            title="当前场景"
            summary={getDisplayValue(formState.currentScene, GROUP_SETTINGS_PLACEHOLDERS.currentScene)}
          >
            <textarea
              value={formState.currentScene}
              onChange={(event) => onChange({ currentScene: event.target.value })}
              rows={4}
              placeholder={GROUP_SETTINGS_PLACEHOLDERS.currentScene}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-700 outline-none placeholder:text-zinc-400"
            />
          </SectionCard>

          <SectionCard
            title="群公开事实"
            summary={getDisplayValue(formState.publicFacts, GROUP_SETTINGS_PLACEHOLDERS.publicFacts)}
          >
            <textarea
              value={formState.publicFacts}
              onChange={(event) => onChange({ publicFacts: event.target.value })}
              rows={5}
              placeholder={GROUP_SETTINGS_PLACEHOLDERS.publicFacts}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-700 outline-none placeholder:text-zinc-400"
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
