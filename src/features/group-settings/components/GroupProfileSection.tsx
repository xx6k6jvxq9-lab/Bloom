import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { GROUP_RELATIONSHIP_OPTIONS, GROUP_SETTINGS_PLACEHOLDERS, GROUP_SETTINGS_SECTIONS } from '../constants';
import type { GroupSettingsFormState } from '../types';

type GroupProfileSectionProps = {
  formState: GroupSettingsFormState;
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onOpenSearch: () => void;
};

type ExpandableKey =
  | 'backgroundSummary'
  | 'memberRelationship'
  | 'currentScene'
  | 'publicFacts';

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

function ExpandableRow({
  label,
  summary,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="text-[15px] text-zinc-900">{label}</div>
          <div className="mt-1 line-clamp-1 text-[13px] text-zinc-500">{summary}</div>
        </div>
        {expanded ? (
          <ChevronDown size={18} className="shrink-0 text-zinc-300" />
        ) : (
          <ChevronRight size={18} className="shrink-0 text-zinc-300" />
        )}
      </button>
      {expanded ? <div className="border-t border-zinc-100 px-4 py-4">{children}</div> : null}
    </div>
  );
}

function getDisplayValue(value: string, placeholder: string) {
  const trimmed = value.trim();
  return trimmed || placeholder;
}

export function GroupProfileSection({
  formState,
  onChange,
  onOpenSearch,
}: GroupProfileSectionProps) {
  const [expandedKey, setExpandedKey] = useState<ExpandableKey | null>(null);

  const relationshipLabel = GROUP_RELATIONSHIP_OPTIONS.find(
    (option) => option.value === formState.memberRelationshipState,
  )?.label;
  const relationshipSummary = [relationshipLabel, formState.memberRelationshipNote.trim()]
    .filter(Boolean)
    .join(' / ') || '未设置';

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

      <ExpandableRow
        label="群背景简述"
        summary={getDisplayValue(formState.backgroundSummary, GROUP_SETTINGS_PLACEHOLDERS.backgroundSummary)}
        expanded={expandedKey === 'backgroundSummary'}
        onToggle={() => setExpandedKey((prev) => (prev === 'backgroundSummary' ? null : 'backgroundSummary'))}
      >
        <textarea
          value={formState.backgroundSummary}
          onChange={(event) => onChange({ backgroundSummary: event.target.value })}
          rows={3}
          placeholder={GROUP_SETTINGS_PLACEHOLDERS.backgroundSummary}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-700 outline-none placeholder:text-zinc-400"
        />
      </ExpandableRow>
      <Divider />

      <ExpandableRow
        label="成员关系状态"
        summary={relationshipSummary}
        expanded={expandedKey === 'memberRelationship'}
        onToggle={() => setExpandedKey((prev) => (prev === 'memberRelationship' ? null : 'memberRelationship'))}
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
          rows={2}
          placeholder={GROUP_SETTINGS_PLACEHOLDERS.memberRelationshipNote}
          className="mt-3 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-700 outline-none placeholder:text-zinc-400"
        />
      </ExpandableRow>
      <Divider />

      <ExpandableRow
        label="当前场景"
        summary={getDisplayValue(formState.currentScene, GROUP_SETTINGS_PLACEHOLDERS.currentScene)}
        expanded={expandedKey === 'currentScene'}
        onToggle={() => setExpandedKey((prev) => (prev === 'currentScene' ? null : 'currentScene'))}
      >
        <textarea
          value={formState.currentScene}
          onChange={(event) => onChange({ currentScene: event.target.value })}
          rows={3}
          placeholder={GROUP_SETTINGS_PLACEHOLDERS.currentScene}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-700 outline-none placeholder:text-zinc-400"
        />
      </ExpandableRow>
      <Divider />

      <ExpandableRow
        label="群公开事实"
        summary={getDisplayValue(formState.publicFacts, GROUP_SETTINGS_PLACEHOLDERS.publicFacts)}
        expanded={expandedKey === 'publicFacts'}
        onToggle={() => setExpandedKey((prev) => (prev === 'publicFacts' ? null : 'publicFacts'))}
      >
        <textarea
          value={formState.publicFacts}
          onChange={(event) => onChange({ publicFacts: event.target.value })}
          rows={4}
          placeholder={GROUP_SETTINGS_PLACEHOLDERS.publicFacts}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-700 outline-none placeholder:text-zinc-400"
        />
      </ExpandableRow>
    </section>
  );
}
