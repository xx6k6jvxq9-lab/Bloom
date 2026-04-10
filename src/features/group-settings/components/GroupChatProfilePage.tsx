import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { GROUP_RELATIONSHIP_OPTIONS, GROUP_SETTINGS_PLACEHOLDERS } from '../constants';
import type { GroupSettingsFormState } from '../types';

type GroupChatProfilePageProps = {
  formState: GroupSettingsFormState;
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onOpenWorldBooks: () => void;
  onBack: () => void;
};

function SectionCard({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
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

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-zinc-900">{label}</div>
        <div className="mt-1 text-[12px] leading-5 text-zinc-500">{description}</div>
      </div>
      <span
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
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

function getDisplayValue(value: string, placeholder: string) {
  const trimmed = value.trim();
  return trimmed || placeholder;
}

export function GroupChatProfilePage({
  formState,
  onChange,
  onOpenWorldBooks,
  onBack,
}: GroupChatProfilePageProps) {
  const activeWorldBookIds = formState.activeWorldBookIds || [];
  const relationshipLabel = GROUP_RELATIONSHIP_OPTIONS.find(
    (option) => option.value === formState.memberRelationshipState,
  )?.label;
  const relationshipSummary = [relationshipLabel, formState.memberRelationshipNote.trim()]
    .filter(Boolean)
    .join(' / ') || '\u672a\u8bbe\u7f6e';
  const directInteropSummary = formState.allowDirectMemoryInterop
    ? '\u5f53\u524d\u7fa4\u8d44\u6599\u4f1a\u7ee7\u7eed\u5f71\u54cd\u5bf9\u5e94\u89d2\u8272\u7684\u5355\u804a\u8bed\u5883\u3002'
    : '\u5f53\u524d\u7fa4\u8d44\u6599\u9ed8\u8ba4\u53ea\u5728\u8fd9\u4e2a\u7fa4\u91cc\u751f\u6548\u3002';

  return (
    <div className="absolute inset-0 z-[121] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">{'\u7fa4\u804a\u8d44\u6599'}</h2>
          <span className="text-[11px] text-zinc-500">{'\u7528\u4e8e\u5f71\u54cd\u7fa4\u804a\u8bed\u6c14\u3001\u4eb2\u758f\u548c\u573a\u666f\u611f'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <SectionCard
            title={'\u4e0e\u5355\u804a\u8d44\u6599\u4e92\u901a'}
            summary={directInteropSummary}
          >
            <ToggleRow
              label={'\u4e0e\u5355\u804a\u8d44\u6599\u4e92\u901a'}
              description={'\u5f00\u542f\u540e\uff0c\u8fd9\u4e2a\u7fa4\u91cc\u7684\u7fa4\u8d44\u6599\u3001\u7fa4\u4e16\u754c\u4e66\u3001\u516c\u5f00\u4e8b\u5b9e\uff0c\u4ee5\u53ca\u7fa4\u5185\u5f62\u6210\u7684\u76f8\u5173\u5173\u7cfb\u4f59\u6ce2\uff0c\u90fd\u53ef\u4ee5\u7ee7\u7eed\u5f71\u54cd\u5bf9\u5e94\u89d2\u8272\u7684\u5355\u804a\u3002\u5173\u95ed\u540e\uff0c\u8fd9\u4e9b\u5185\u5bb9\u9ed8\u8ba4\u53ea\u7559\u5728\u5f53\u524d\u7fa4\u91cc\u3002'}
              checked={formState.allowDirectMemoryInterop}
              onToggle={() => onChange({ allowDirectMemoryInterop: !formState.allowDirectMemoryInterop })}
            />
          </SectionCard>

          <SectionCard
            title={'\u7fa4\u4e16\u754c\u4e66'}
            summary={activeWorldBookIds.length > 0 ? `\u5df2\u7ed1\u5b9a ${activeWorldBookIds.length} \u6761` : '\u672a\u7ed1\u5b9a'}
          >
            <button
              type="button"
              onClick={onOpenWorldBooks}
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-zinc-900">{'\u7ba1\u7406\u7fa4\u804a\u8bfb\u53d6\u7684\u4e16\u754c\u4e66'}</div>
                <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                  {'\u5f53\u524d\u7fa4\u804a\u4f1a\u8bfb\u53d6\u8fd9\u91cc\u7ed1\u5b9a\u7684\u4e16\u754c\u4e66\uff0c\u7528\u6765\u8865\u5145\u7fa4\u8bbe\u5b9a\u548c\u516c\u5171\u8bed\u5883\u3002'}
                </div>
              </div>
              <span className="text-[12px] text-zinc-400">{'\u8fdb\u5165'}</span>
            </button>
          </SectionCard>

          <SectionCard
            title={'\u7fa4\u80cc\u666f\u7b80\u8ff0'}
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
            title={'\u6210\u5458\u5173\u7cfb\u72b6\u6001'}
            summary={relationshipSummary}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChange({ memberRelationshipState: undefined })}
                className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                  !formState.memberRelationshipState ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {'\u4e0d\u8bbe\u7f6e'}
              </button>
              {GROUP_RELATIONSHIP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ memberRelationshipState: option.value })}
                  className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                    formState.memberRelationshipState === option.value
                      ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
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
            title={'\u5f53\u524d\u573a\u666f'}
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
            title={'\u7fa4\u516c\u5f00\u4e8b\u5b9e'}
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
