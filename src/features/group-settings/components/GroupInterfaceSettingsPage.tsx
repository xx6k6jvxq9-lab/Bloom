import { ChevronLeft } from 'lucide-react';
import type { GroupSettingsFormState } from '../types';

type GroupInterfaceSettingsPageProps = {
  formState: GroupSettingsFormState;
  onChange: (patch: Partial<GroupSettingsFormState>) => void;
  onBack: () => void;
};

const STYLE_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'glass', label: '毛玻璃' },
  { value: 'solid', label: '纯色' },
  { value: 'transparent', label: '透明' },
] as const;

const TEXT = {
  title: '群界面显示',
  subtitle: '只影响当前群聊的顶部和底部栏样式',
  headerLabel: '顶部栏样式',
  headerOpacityLabel: '顶部栏透明度',
  footerLabel: '底部栏样式',
  footerOpacityLabel: '底部栏透明度',
} as const;

function getPreviewBarStyle(style: GroupSettingsFormState['headerStyle'], opacity: number): React.CSSProperties {
  if (style === 'solid') {
    return { backgroundColor: `rgba(244, 244, 245, ${opacity})` };
  }
  if (style === 'transparent') {
    return { backgroundColor: `rgba(255, 255, 255, ${Math.max(0, opacity - 0.2)})` };
  }
  return { backgroundColor: `rgba(255, 255, 255, ${opacity})` };
}

function OptionGrid({
  value,
  onChange,
}: {
  value: GroupSettingsFormState['headerStyle'] | GroupSettingsFormState['footerStyle'];
  onChange: (next: GroupSettingsFormState['headerStyle']) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STYLE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors ${
            value === option.value
              ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
              : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function GroupInterfaceSettingsPage({
  formState,
  onChange,
  onBack,
}: GroupInterfaceSettingsPageProps) {
  const headerStyle = formState.headerStyle || 'default';
  const headerOpacity = formState.headerOpacity ?? 0.92;
  const footerStyle = formState.footerStyle || 'default';
  const footerOpacity = formState.footerOpacity ?? 0.92;

  return (
    <div className="absolute inset-0 z-[122] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">{TEXT.title}</h2>
          <span className="text-[11px] text-zinc-500">{TEXT.subtitle}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
          <div className="rounded-[24px] bg-zinc-100 p-4">
            <div className="mx-auto flex h-64 w-48 flex-col overflow-hidden rounded-[24px] bg-white shadow-sm">
              <div
                className={`flex h-12 shrink-0 items-center gap-2 border-b px-3 ${
                  headerStyle === 'glass'
                    ? 'border-zinc-100/50 backdrop-blur-md'
                    : headerStyle === 'solid'
                      ? 'border-zinc-200'
                      : headerStyle === 'transparent'
                        ? 'border-transparent'
                        : 'border-zinc-100'
                }`}
                style={getPreviewBarStyle(headerStyle, headerOpacity)}
              >
                <div className="h-6 w-6 rounded-full bg-zinc-200" />
                <div className="h-3 w-16 rounded-full bg-zinc-200" />
              </div>

              <div className="flex-1 bg-zinc-50 p-3" />

              <div
                className={`flex h-14 shrink-0 items-center gap-2 border-t px-3 ${
                  footerStyle === 'glass'
                    ? 'border-zinc-100/50 backdrop-blur-md'
                    : footerStyle === 'solid'
                      ? 'border-zinc-200'
                      : footerStyle === 'transparent'
                        ? 'border-transparent'
                        : 'border-zinc-100'
                }`}
                style={getPreviewBarStyle(footerStyle, footerOpacity)}
              >
                <div className="h-8 w-8 rounded-full bg-zinc-200" />
                <div
                  className={`h-9 flex-1 rounded-full border ${
                    footerStyle === 'transparent'
                      ? 'border-white/50 bg-white/75'
                      : footerStyle === 'glass'
                        ? 'border-white/50 bg-white/80'
                        : footerStyle === 'solid'
                          ? 'border-zinc-200 bg-white'
                          : 'border-zinc-100 bg-zinc-50'
                  }`}
                />
                <div className="h-8 w-8 rounded-full bg-zinc-200" />
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <div className="text-[13px] font-semibold text-zinc-700">{TEXT.headerLabel}</div>
              <OptionGrid
                value={headerStyle}
                onChange={(next) => onChange({ headerStyle: next })}
              />
            </div>

            <div className="space-y-2">
              <label className="flex justify-between text-[12px] font-medium text-zinc-500">
                <span>{TEXT.headerOpacityLabel}</span>
                <span>{Math.round(headerOpacity * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={headerOpacity}
                onChange={(event) => onChange({ headerOpacity: Number(event.target.value) })}
                className="w-full accent-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <div className="text-[13px] font-semibold text-zinc-700">{TEXT.footerLabel}</div>
              <OptionGrid
                value={footerStyle}
                onChange={(next) => onChange({ footerStyle: next })}
              />
            </div>

            <div className="space-y-2">
              <label className="flex justify-between text-[12px] font-medium text-zinc-500">
                <span>{TEXT.footerOpacityLabel}</span>
                <span>{Math.round(footerOpacity * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={footerOpacity}
                onChange={(event) => onChange({ footerOpacity: Number(event.target.value) })}
                className="w-full accent-zinc-900"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
