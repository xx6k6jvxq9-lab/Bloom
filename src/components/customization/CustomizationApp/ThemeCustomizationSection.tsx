import { Download, Palette, Type, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { VisualSettings } from '../../../types';
import { showInAppConfirm } from '../../../utils';
import { buildThemeScopedCss } from '../../../features/theme/themeScopedCss';
import {
  THEME_SCOPE_GROUPS,
  THEME_SCOPE_TARGETS,
  type ThemeScopeTargetId,
} from '../../../features/theme/themeCustomizationTargets';

type ThemePanelKey = 'globalTheme' | 'scope' | 'file';

type ImportedThemePayload = {
  theme?: Partial<
    Pick<VisualSettings, 'globalCss' | 'themeScopedCss' | 'themeTypography' | 'chat' | 'desktop' | 'navBar' | 'dynamics'>
  >;
};

function buildThemeExportPayload(settings: VisualSettings) {
  return {
    version: 5,
    exportedAt: new Date().toISOString(),
    theme: {
      globalCss: settings.globalCss || '',
      themeScopedCss: settings.themeScopedCss || {},
      themeTypography: settings.themeTypography || {},
      chat: settings.chat,
      desktop: settings.desktop,
      navBar: settings.navBar,
      dynamics: settings.dynamics,
    },
  };
}

function PreviewAnchors() {
  return (
    <>
      <span aria-hidden="true" className="corner pointer-events-none absolute left-[-7px] top-[-7px] h-4 w-4 rounded-full border border-zinc-400 bg-white" />
      <span aria-hidden="true" className="corner pointer-events-none absolute right-[-7px] top-[-7px] h-4 w-4 rounded-full border border-zinc-400 bg-white" />
      <span aria-hidden="true" className="corner pointer-events-none absolute bottom-[-7px] left-[-7px] h-4 w-4 rounded-full border border-zinc-400 bg-white" />
      <span aria-hidden="true" className="corner pointer-events-none absolute bottom-[-7px] right-[-7px] h-4 w-4 rounded-full border border-zinc-400 bg-white" />
      <span
        aria-hidden="true"
        className="sticker-skull pointer-events-none absolute bottom-[-10px] right-3 h-7 w-7 rounded-full border-2 border-zinc-400 bg-white shadow-sm"
      />
    </>
  );
}

function ThemePanelTabs({
  activePanel,
  onChange,
}: {
  activePanel: ThemePanelKey;
  onChange: (panel: ThemePanelKey) => void;
}) {
  const panels: Array<{ key: ThemePanelKey; label: string }> = [
    { key: 'globalTheme', label: '全局主题' },
    { key: 'scope', label: '局部范围' },
    { key: 'file', label: '主题文件' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {panels.map((panel) => (
        <button
          key={panel.key}
          onClick={() => onChange(panel.key)}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
            activePanel === panel.key
              ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          {panel.label}
        </button>
      ))}
    </div>
  );
}

function PanelCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-[28px] border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
        {icon}
        <span>{title}</span>
      </div>
      {description ? <p className="text-xs leading-6 text-zinc-500">{description}</p> : null}
      {children}
    </div>
  );
}

function CodeEditor({
  value,
  onChange,
  placeholder,
  heightClass = 'h-72',
}: {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  heightClass?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      spellCheck="false"
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      className={`${heightClass} w-full resize-y rounded-[22px] border border-zinc-800 bg-[#111214] px-4 py-4 font-mono text-[13px] leading-6 text-zinc-50 caret-white outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-700`}
    />
  );
}

function ThemeWorkbenchPreview({ previewCss }: { previewCss: string }) {
  return (
    <div className="theme-live-preview chat-bubble-theme-scope relative overflow-hidden rounded-[24px] border border-zinc-100 bg-zinc-50 shadow-sm">
      {previewCss ? <style>{previewCss}</style> : null}
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(255, 227, 238, 0.8), transparent 32%), radial-gradient(circle at bottom right, rgba(219, 234, 254, 0.8), transparent 28%)',
        }}
      />
      <div className="relative z-10 flex h-[320px] flex-col">
        <div className="chat-session-header flex items-center justify-between border-b border-zinc-200/60 bg-white/85 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-zinc-200" />
            <div>
              <div className="text-sm font-semibold text-zinc-900">主题工作台预览</div>
              <div className="text-[11px] text-zinc-500">顶栏、气泡和底部栏会一起联动</div>
            </div>
          </div>
          <div className="h-8 w-8 rounded-full bg-zinc-100" />
        </div>

        <div className="flex-1 space-y-4 overflow-hidden px-4 py-4">
          <div className="flex justify-start">
            <div className="chat-bubble message-bubble bot-bubble relative max-w-[82%] rounded-[20px] border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 shadow-sm">
              <PreviewAnchors />
              这里会实时预览你写入的主题样式。
            </div>
          </div>
          <div className="chat-message-image ml-auto w-[72%] overflow-hidden rounded-[20px] border border-zinc-300 bg-white shadow-sm">
            <div className="h-24 bg-[linear-gradient(135deg,#fce7f3_0%,#fff7ed_40%,#dbeafe_100%)]" />
            <div className="px-3 py-2 text-xs text-zinc-500">图片消息预览</div>
          </div>
          <div className="flex justify-end">
            <div className="chat-bubble message-bubble user-bubble relative max-w-[70%] rounded-[20px] border border-zinc-300 bg-[#fdf3f8] px-4 py-3 text-sm text-zinc-800 shadow-sm">
              <PreviewAnchors />
              右侧用户气泡也会一起受影响。
            </div>
          </div>
        </div>

        <div className="chat-session-footer border-t border-zinc-200/60 bg-white/88 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-zinc-100" />
            <div className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-400 shadow-sm">
              底部输入栏预览
            </div>
            <div className="h-10 w-10 rounded-full bg-zinc-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScopePreview({
  activeTargetId,
  previewCss,
}: {
  activeTargetId: ThemeScopeTargetId;
  previewCss: string;
}) {
  if (
    activeTargetId === 'chatBubbles'
    || activeTargetId === 'sideBubbles'
    || activeTargetId === 'bubbleDecorations'
    || activeTargetId === 'chatHeaderBar'
    || activeTargetId === 'chatFooterBar'
  ) {
    return <ThemeWorkbenchPreview previewCss={previewCss} />;
  }

  return (
    <div className="theme-live-preview chat-bubble-theme-scope relative overflow-hidden rounded-[24px] border border-zinc-100 bg-zinc-50 p-4 shadow-sm">
      {previewCss ? <style>{previewCss}</style> : null}
      <div
        className="pointer-events-none absolute inset-0 opacity-85"
        style={{
          background:
            'radial-gradient(circle at top, rgba(255,255,255,0.85), transparent 56%), linear-gradient(180deg, rgba(255,248,251,0.75), rgba(244,247,255,0.9))',
        }}
      />
      <div className="relative z-10 text-zinc-900">
        {activeTargetId === 'rootVariables' && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">这里预览全局变量对整套主题的联动效果。</div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
              变量通常会同时影响卡片、气泡、输入框和边角细节。
            </div>
          </div>
        )}

        {activeTargetId === 'pageBackground' && (
          <div className="rounded-[22px] border border-zinc-100 bg-white/80 p-5 shadow-sm">
            页面背景氛围会在这里直接预览。
          </div>
        )}

        {activeTargetId === 'baseTypography' && (
          <div className="space-y-3 rounded-[22px] border border-zinc-100 bg-white p-4 shadow-sm">
            <div className="text-xl font-semibold">基础文字预览</div>
            <div className="text-sm leading-7">这里会跟随全局字体、文字颜色以及通用输入控件样式变化。</div>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              value="输入框预览"
              readOnly
            />
          </div>
        )}

        {activeTargetId === 'replyPreview' && (
          <div className="chat-reply-preview inline-flex items-start gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm">
            <div className="h-8 w-1 rounded-full bg-zinc-300" />
            <div>
              <div className="text-[11px] font-medium text-zinc-500">回复对象</div>
              <div className="mt-1 text-sm leading-6">这里是回复预览块的命中区域。</div>
            </div>
          </div>
        )}

        {activeTargetId === 'imageMessage' && (
          <div className="chat-message-image w-full overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-sm">
            <div className="h-32 bg-[linear-gradient(135deg,#f9dce6_0%,#f7f0ff_45%,#dbeafe_100%)]" />
            <div className="px-3 py-2 text-xs text-zinc-500">图片消息预览</div>
          </div>
        )}

        {activeTargetId === 'locationCard' && (
          <div className="chat-location-card overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-sm">
            <div className="p-3">
              <div className="text-sm font-semibold">公司楼下</div>
              <div className="text-[11px] text-zinc-500">高新区天府大道</div>
              <div className="mt-3 h-20 rounded-xl bg-[linear-gradient(135deg,#fde68a_0%,#fef3c7_48%,#dbeafe_100%)]" />
            </div>
            <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">位置卡片预览</div>
          </div>
        )}

        {activeTargetId === 'transferCard' && (
          <div className="chat-transfer-card overflow-hidden rounded-[22px] shadow-sm">
            <div className="flex items-center gap-3 bg-[#FA9D3B] p-3.5 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Download size={18} />
              </div>
              <div>
                <div className="text-lg font-bold">¥1314.00</div>
                <div className="text-[12px] text-white/80">转账卡片预览</div>
              </div>
            </div>
            <div className="border border-t-0 border-zinc-100 bg-white px-3 py-2 text-[11px] text-zinc-500">
              这里会应用卡片局部样式。
            </div>
          </div>
        )}

        {activeTargetId === 'noticeAndLoading' && (
          <div className="space-y-3">
            <div className="chat-notice-card inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-500 shadow-sm">
              系统通知样式预览
            </div>
            <div className="chat-loading-bubble inline-flex rounded-2xl border border-zinc-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}

        {activeTargetId === 'innerVoiceCard' && (
          <div className="chat-inner-voice-card rounded-[22px] border border-zinc-200 bg-white px-4 py-4 shadow-sm">
            心声卡片预览会显示在这里。
          </div>
        )}
      </div>
    </div>
  );
}

function GlobalThemePanel({
  settings,
  setSettings,
}: {
  settings: VisualSettings;
  setSettings: (settings: VisualSettings) => void;
}) {
  const previewCss = [settings.globalCss || '', buildThemeScopedCss(settings.themeScopedCss)]
    .filter(Boolean)
    .join('\n\n');

  return (
    <div className="space-y-6">
      <PanelCard
        title="全局主题预览"
        description="这里会同时预览全局主题代码和当前局部范围样式叠加后的效果。"
        icon={<Palette size={16} className="text-zinc-900" />}
      >
        <ThemeWorkbenchPreview previewCss={previewCss} />
      </PanelCard>

      <PanelCard
        title="全局主题"
        description="这里写的是整套主题的主样式入口。支持完整 CSS、伪元素、动画和整段选择器，不局限于气泡。"
        icon={<Type size={16} className="text-zinc-900" />}
      >
        <CodeEditor
          value={settings.globalCss || ''}
          onChange={(nextValue) => setSettings({ ...settings, globalCss: nextValue })}
          placeholder={':root {\n  --theme-accent: #f7dce6;\n  --theme-radius: 22px;\n}\n\nbody {\n  color: #4e4a4d;\n}\n\n.chat-bubble-theme-scope .chat-session-header {\n  background: rgba(255,255,255,0.78);\n  backdrop-filter: blur(18px);\n}'}
        />
      </PanelCard>
    </div>
  );
}

function ScopePanel({
  settings,
  setSettings,
}: {
  settings: VisualSettings;
  setSettings: (settings: VisualSettings) => void;
}) {
  const [activeScopeTargetId, setActiveScopeTargetId] = useState<ThemeScopeTargetId>('chatHeaderBar');
  const activeScopeTarget = THEME_SCOPE_TARGETS[activeScopeTargetId];
  const activeScopeCss = settings.themeScopedCss?.[activeScopeTargetId] || '';

  const updateScopedCss = (targetId: ThemeScopeTargetId, value: string) => {
    const nextScopedCss = { ...(settings.themeScopedCss || {}) };
    if (value.trim()) {
      nextScopedCss[targetId] = value;
    } else {
      delete nextScopedCss[targetId];
    }
    setSettings({ ...settings, themeScopedCss: nextScopedCss });
  };

  const activePreviewCss = [settings.globalCss || '', buildThemeScopedCss({ [activeScopeTargetId]: activeScopeCss })]
    .filter(Boolean)
    .join('\n\n');

  return (
    <div className="space-y-6">
      <PanelCard
        title="局部范围预览"
        description="点哪一个分组项，下面就预览哪一个局部目标。顶栏和底部栏也已经单独拆出来了。"
        icon={<Palette size={16} className="text-zinc-900" />}
      >
        <ScopePreview activeTargetId={activeScopeTargetId} previewCss={activePreviewCss} />
      </PanelCard>

      <PanelCard
        title="主题工作台"
        description="局部美化按分组放在工作台里，不再全部挤在一块。可以分别编辑顶栏、底部栏、气泡和特殊消息块。"
        icon={<Type size={16} className="text-zinc-900" />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {THEME_SCOPE_GROUPS.map((group) => (
            <div key={group.title} className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-sm font-bold text-zinc-900">{group.title}</div>
              <div className="mt-1 text-xs leading-6 text-zinc-500">{group.description}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.items.map((itemId) => {
                  const target = THEME_SCOPE_TARGETS[itemId];
                  const isActive = activeScopeTargetId === itemId;
                  const hasValue = !!settings.themeScopedCss?.[itemId]?.trim();
                  return (
                    <button
                      key={itemId}
                      onClick={() => setActiveScopeTargetId(itemId)}
                      className={`rounded-full border px-3 py-2 text-[12px] transition-all ${
                        isActive
                          ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                          : hasValue
                            ? 'border-zinc-200 bg-white text-zinc-800 shadow-sm'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      {target.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[22px] bg-zinc-50 p-4">
          <div className="text-xs font-bold text-zinc-900">{activeScopeTarget.label}</div>
          <div className="mt-1 text-xs leading-6 text-zinc-500">{activeScopeTarget.description}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeScopeTarget.selectors.map((selector) => (
              <span
                key={selector}
                className="rounded-full bg-white px-3 py-1 font-mono text-[11px] text-zinc-600 ring-1 ring-zinc-100"
              >
                {selector}
              </span>
            ))}
          </div>
        </div>

        <CodeEditor
          value={activeScopeCss}
          onChange={(nextValue) => updateScopedCss(activeScopeTargetId, nextValue)}
          placeholder={activeScopeTarget.placeholder}
        />
      </PanelCard>
    </div>
  );
}

function FilePanel({
  settings,
}: {
  settings: VisualSettings;
}) {
  const scopeCount = useMemo(
    () => Object.values(settings.themeScopedCss || {}).filter((value) => value.trim()).length,
    [settings.themeScopedCss],
  );

  return (
    <div className="space-y-6">
      <PanelCard
        title="主题文件说明"
        description="导入导出按钮放在工作台顶部，这里只展示当前主题文件里包含的内容。"
        icon={<Download size={16} className="text-zinc-900" />}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
            <div className="text-xs font-bold text-zinc-500">全局主题</div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">
              {settings.globalCss?.trim() ? '已配置' : '未配置'}
            </div>
          </div>
          <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
            <div className="text-xs font-bold text-zinc-500">局部范围</div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">{scopeCount}</div>
          </div>
          <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
            <div className="text-xs font-bold text-zinc-500">聊天外观</div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">
              {settings.chat ? '已包含' : '未包含'}
            </div>
          </div>
        </div>
        <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4 text-xs leading-7 text-zinc-500">
          导出的 `.theme` 会包含当前全局主题代码、局部范围 CSS、文字主题以及聊天、桌面、导航栏、动态页相关外观配置。
        </div>
      </PanelCard>
    </div>
  );
}

export function ThemeCustomizationSection({
  settings,
  setSettings,
}: {
  settings: VisualSettings;
  setSettings: (settings: VisualSettings) => void;
}) {
  const [activePanel, setActivePanel] = useState<ThemePanelKey>('globalTheme');
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExportTheme = () => {
    const payload = buildThemeExportPayload(settings);
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `theme_${Date.now()}.theme`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const raw = String(loadEvent.target?.result || '');
        const parsed = JSON.parse(raw) as ImportedThemePayload;
        const nextTheme = parsed?.theme;
        if (!nextTheme || typeof nextTheme !== 'object') {
          throw new Error('invalid-theme');
        }

        const confirmed = await showInAppConfirm('导入主题会覆盖当前主题相关设置，确定继续吗？');
        if (!confirmed) return;

        const currentThemeTypography = settings.themeTypography;
        const importedThemeTypography =
          nextTheme.themeTypography && typeof nextTheme.themeTypography === 'object'
            ? {
                ...(currentThemeTypography || {}),
                ...nextTheme.themeTypography,
                importedFonts: currentThemeTypography?.importedFonts || [],
              }
            : currentThemeTypography;

        setSettings({
          ...settings,
          globalCss: typeof nextTheme.globalCss === 'string' ? nextTheme.globalCss : settings.globalCss,
          themeScopedCss:
            nextTheme.themeScopedCss && typeof nextTheme.themeScopedCss === 'object'
              ? (nextTheme.themeScopedCss as Record<string, string>)
              : settings.themeScopedCss,
          themeTypography: importedThemeTypography,
          chat: { ...settings.chat, ...(nextTheme.chat || {}) },
          desktop: { ...settings.desktop, ...(nextTheme.desktop || {}) },
          navBar: { ...settings.navBar, ...(nextTheme.navBar || {}) },
          dynamics: { ...settings.dynamics, ...(nextTheme.dynamics || {}) },
        });
      } catch {
        alert('主题文件解析失败，请确认导入的是有效的 .theme 或 JSON 文件。');
      } finally {
        event.target.value = '';
      }
    };

    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-[28px] border border-zinc-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-zinc-900">主题工作台</div>
            <div className="mt-1 text-xs text-zinc-500">
              这里是完整的主题自定义入口，包含全局主题、局部美化和主题文件管理。
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".theme,.json"
              className="hidden"
              onChange={(event) => void handleImportTheme(event)}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <Upload size={15} className="mr-2" />
              导入
            </button>
            <button
              onClick={handleExportTheme}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              <Download size={15} className="mr-2" />
              导出
            </button>
          </div>
        </div>

        <ThemePanelTabs activePanel={activePanel} onChange={setActivePanel} />
      </div>

      {activePanel === 'globalTheme' && <GlobalThemePanel settings={settings} setSettings={setSettings} />}
      {activePanel === 'scope' && <ScopePanel settings={settings} setSettings={setSettings} />}
      {activePanel === 'file' && <FilePanel settings={settings} />}
    </div>
  );
}
