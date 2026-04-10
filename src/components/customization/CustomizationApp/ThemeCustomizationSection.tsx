import { Download, Palette, Type, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { VisualSettings } from '../../../types';
import { showInAppConfirm } from '../../../utils';
import { buildThemeScopedCss } from '../../../features/theme/themeScopedCss';
import { buildThemePreviewCss } from '../../../features/theme/themeTypography';
import {
  DISABLED_THEME_SCOPE_TARGET_IDS,
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

const disabledThemeScopeTargetIds = new Set<ThemeScopeTargetId>(DISABLED_THEME_SCOPE_TARGET_IDS);

function sanitizeThemeScopedCss(themeScopedCss?: Record<string, string>) {
  if (!themeScopedCss) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(themeScopedCss).filter(([targetId, value]) => {
      if (disabledThemeScopeTargetIds.has(targetId as ThemeScopeTargetId)) {
        return false;
      }
      return typeof value === 'string' && value.trim().length > 0;
    }),
  ) as Record<string, string>;
}

function buildThemeExportPayload(settings: VisualSettings) {
  return {
    version: 5,
    exportedAt: new Date().toISOString(),
    theme: {
      globalCss: settings.globalCss || '',
      themeScopedCss: sanitizeThemeScopedCss(settings.themeScopedCss),
      themeTypography: settings.themeTypography || {},
      chat: settings.chat,
      desktop: settings.desktop,
      navBar: settings.navBar,
      dynamics: settings.dynamics,
    },
  };
}

function buildThemeWorkbenchPreviewCss(rawCss: string): string {
  if (!rawCss.trim()) {
    return '';
  }

  return buildThemePreviewCss(rawCss).replace(/\.chat-bubble-theme-scope\b/g, '.theme-preview-scope');
}

const THEME_PANEL_TEXT = {
  tabs: {
    globalTheme: '\u5168\u5c40\u4e3b\u9898',
    scope: '\u5c40\u90e8\u8303\u56f4',
    file: '\u4e3b\u9898\u6587\u4ef6',
  },
  previewTitle: '\u4e3b\u9898\u5de5\u4f5c\u53f0\u9884\u89c8',
  previewSubtitle: '\u9876\u680f\u3001\u5361\u7247\u4e0e\u5e95\u90e8\u680f\u4f1a\u4e00\u8d77\u8054\u52a8',
  previewMainCard: '\u8fd9\u91cc\u4f1a\u5b9e\u65f6\u9884\u89c8\u4f60\u5199\u5165\u7684\u6574\u9875\u4e3b\u9898\u6837\u5f0f\u3002',
  previewImage: '\u6269\u5c55\u6d88\u606f\u9884\u89c8',
  previewAccentCard: '\u53f3\u4fa7\u5361\u7247\u4e5f\u4f1a\u8ddf\u7740\u4e3b\u9898\u4e00\u8d77\u53d8\u5316\u3002',
  previewFooter: '\u5e95\u90e8\u8f93\u5165\u680f\u9884\u89c8',
  rootVariablesMain: '\u8fd9\u91cc\u9884\u89c8\u5168\u5c40\u53d8\u91cf\u5bf9\u6574\u5957\u4e3b\u9898\u7684\u8054\u52a8\u6548\u679c\u3002',
  rootVariablesSub: '\u53d8\u91cf\u901a\u5e38\u4f1a\u540c\u65f6\u5f71\u54cd\u5361\u7247\u3001\u8f93\u5165\u6846\u3001\u6309\u94ae\u548c\u8fb9\u89d2\u7ec6\u8282\u3002',
  pageBackground: '\u9875\u9762\u80cc\u666f\u6c1b\u56f4\u4f1a\u5728\u8fd9\u91cc\u76f4\u63a5\u9884\u89c8\u3002',
  baseTypographyTitle: '\u57fa\u7840\u6587\u5b57\u9884\u89c8',
  baseTypographySub: '\u8fd9\u91cc\u4f1a\u8ddf\u968f\u5168\u5c40\u5b57\u4f53\u3001\u6587\u5b57\u989c\u8272\u4ee5\u53ca\u901a\u7528\u8f93\u5165\u63a7\u4ef6\u6837\u5f0f\u53d8\u5316\u3002',
  inputPreview: '\u8f93\u5165\u6846\u9884\u89c8',
  globalPreviewTitle: '\u5168\u5c40\u4e3b\u9898\u9884\u89c8',
  globalPreviewDescription:
    '\u8fd9\u91cc\u4f1a\u540c\u65f6\u9884\u89c8\u5168\u5c40\u4e3b\u9898\u4ee3\u7801\u548c\u5f53\u524d\u5c40\u90e8\u8303\u56f4\u6837\u5f0f\u53e0\u52a0\u540e\u7684\u6548\u679c\u3002',
  globalThemeTitle: '\u5168\u5c40\u4e3b\u9898',
  globalThemeDescription:
    '\u8fd9\u91cc\u5199\u7684\u662f\u6574\u5957\u4e3b\u9898\u7684\u4e3b\u6837\u5f0f\u5165\u53e3\u3002\u652f\u6301\u5b8c\u6574 CSS\u3001\u4f2a\u5143\u7d20\u3001\u52a8\u753b\u548c\u6574\u6bb5\u9009\u62e9\u5668\uff0c\u4e0d\u53ea\u9650\u4e8e\u804a\u5929\u6c14\u6ce1\u3002',
  scopePreviewTitle: '\u5c40\u90e8\u8303\u56f4\u9884\u89c8',
  scopePreviewDescription:
    '\u70b9\u54ea\u4e00\u4e2a\u5206\u7ec4\u9879\uff0c\u4e0b\u9762\u5c31\u9884\u89c8\u54ea\u4e00\u4e2a\u5c40\u90e8\u76ee\u6807\u3002\u9876\u680f\u548c\u5e95\u90e8\u680f\u90fd\u5df2\u7ecf\u5355\u72ec\u62c6\u51fa\u6765\u4e86\u3002',
  workbenchTitle: '\u4e3b\u9898\u5de5\u4f5c\u53f0',
  workbenchDescription:
    '\u5c40\u90e8\u7f8e\u5316\u6309\u5206\u7ec4\u653e\u5728\u5de5\u4f5c\u53f0\u91cc\uff0c\u4e0d\u518d\u5168\u90e8\u6324\u5728\u4e00\u5757\u3002\u53ef\u4ee5\u5206\u522b\u7f16\u8f91\u9876\u680f\u3001\u5e95\u90e8\u680f\u3001\u5361\u7247\u548c\u7279\u6b8a\u6d88\u606f\u5757\u3002',
} as const;

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
    { key: 'globalTheme', label: THEME_PANEL_TEXT.tabs.globalTheme },
    { key: 'scope', label: THEME_PANEL_TEXT.tabs.scope },
    { key: 'file', label: THEME_PANEL_TEXT.tabs.file },
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
      className={`${heightClass} w-full resize-y rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 font-mono text-[13px] leading-6 text-zinc-800 caret-zinc-900 outline-none transition-colors placeholder:text-zinc-400 shadow-inner shadow-white/60 focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-zinc-200`}
    />
  );
}

function ThemeWorkbenchPreview({ previewCss }: { previewCss: string }) {
  return (
    <div className="theme-live-preview theme-preview-scope relative overflow-hidden rounded-[24px] border border-zinc-100 bg-zinc-50 shadow-sm">
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
              <div className="text-sm font-semibold text-zinc-900">{THEME_PANEL_TEXT.previewTitle}</div>
              <div className="text-[11px] text-zinc-500">{THEME_PANEL_TEXT.previewSubtitle}</div>
            </div>
          </div>
          <div className="h-8 w-8 rounded-full bg-zinc-100" />
        </div>

        <div className="flex-1 space-y-4 overflow-hidden px-4 py-4">
          <div className="flex justify-start">
            <div className="chat-bubble message-bubble bot-bubble relative max-w-[82%] rounded-[20px] border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 shadow-sm">
              <PreviewAnchors />
              {THEME_PANEL_TEXT.previewMainCard}
            </div>
          </div>
          <div className="chat-message-image ml-auto w-[72%] overflow-hidden rounded-[20px] border border-zinc-300 bg-white shadow-sm">
            <div className="h-24 bg-[linear-gradient(135deg,#fce7f3_0%,#fff7ed_40%,#dbeafe_100%)]" />
            <div className="px-3 py-2 text-xs text-zinc-500">{THEME_PANEL_TEXT.previewImage}</div>
          </div>
          <div className="flex justify-end">
            <div className="chat-bubble message-bubble user-bubble relative max-w-[70%] rounded-[20px] border border-zinc-300 bg-[#fdf3f8] px-4 py-3 text-sm text-zinc-800 shadow-sm">
              <PreviewAnchors />
              {THEME_PANEL_TEXT.previewAccentCard}
            </div>
          </div>
        </div>

        <div className="chat-session-footer border-t border-zinc-200/60 bg-white/88 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-zinc-100" />
            <div className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-400 shadow-sm">
              {THEME_PANEL_TEXT.previewFooter}
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
    <div className="theme-live-preview theme-preview-scope relative overflow-hidden rounded-[24px] border border-zinc-100 bg-zinc-50 p-4 shadow-sm">
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
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">{THEME_PANEL_TEXT.rootVariablesMain}</div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
              {THEME_PANEL_TEXT.rootVariablesSub}
            </div>
          </div>
        )}

        {activeTargetId === 'pageBackground' && (
          <div className="rounded-[22px] border border-zinc-100 bg-white/80 p-5 shadow-sm">
            {THEME_PANEL_TEXT.pageBackground}
          </div>
        )}

        {activeTargetId === 'baseTypography' && (
          <div className="space-y-3 rounded-[22px] border border-zinc-100 bg-white p-4 shadow-sm">
            <div className="text-xl font-semibold">{THEME_PANEL_TEXT.baseTypographyTitle}</div>
            <div className="text-sm leading-7">{THEME_PANEL_TEXT.baseTypographySub}</div>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              value={THEME_PANEL_TEXT.inputPreview}
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
    .map((css) => buildThemeWorkbenchPreviewCss(css))
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
        description="这里写的是整套主题的主样式入口。支持完整 CSS、伪元素、动画和整段选择器，可覆盖页面结构、卡片、输入栏等主题区域。"
        icon={<Type size={16} className="text-zinc-900" />}
      >
        <CodeEditor
          value={settings.globalCss || ''}
          onChange={(nextValue) => setSettings({ ...settings, globalCss: nextValue })}
          placeholder={':root {\n  --theme-accent: #f7dce6;\n  --theme-radius: 22px;\n}\n\nbody {\n  color: #4e4a4d;\n  background: linear-gradient(180deg, #fffafc 0%, #f7f5ff 100%);\n}\n\n.chat-session-header {\n  background: rgba(255,255,255,0.78);\n  backdrop-filter: blur(18px);\n}'}
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
  const availableScopeGroups = THEME_SCOPE_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((itemId) => !disabledThemeScopeTargetIds.has(itemId)),
    }))
    .filter((group) => group.items.length > 0);
  const availableScopeTargetIds = availableScopeGroups.flatMap((group) => group.items);
  const fallbackScopeTargetId = availableScopeTargetIds[0] || 'rootVariables';
  const [activeScopeTargetId, setActiveScopeTargetId] = useState<ThemeScopeTargetId>(fallbackScopeTargetId);
  const resolvedActiveScopeTargetId = availableScopeTargetIds.includes(activeScopeTargetId)
    ? activeScopeTargetId
    : fallbackScopeTargetId;
  const activeScopeTarget = THEME_SCOPE_TARGETS[resolvedActiveScopeTargetId];
  const activeScopeCss = settings.themeScopedCss?.[resolvedActiveScopeTargetId] || '';

  const updateScopedCss = (targetId: ThemeScopeTargetId, value: string) => {
    const nextScopedCss = { ...sanitizeThemeScopedCss(settings.themeScopedCss) };
    if (value.trim()) {
      nextScopedCss[targetId] = value;
    } else {
      delete nextScopedCss[targetId];
    }
    setSettings({ ...settings, themeScopedCss: nextScopedCss });
  };

  const activePreviewCss = [settings.globalCss || '', buildThemeScopedCss({ [resolvedActiveScopeTargetId]: activeScopeCss })]
    .filter(Boolean)
    .map((css) => buildThemeWorkbenchPreviewCss(css))
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
        description="局部美化按分组放在工作台里，不再全部挤在一块。可以分别编辑顶栏、底部栏、卡片和特殊消息块。"
        icon={<Type size={16} className="text-zinc-900" />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {availableScopeGroups.map((group) => (
            <div key={group.title} className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-sm font-bold text-zinc-900">{group.title}</div>
              <div className="mt-1 text-xs leading-6 text-zinc-500">{group.description}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.items.map((itemId) => {
                  const target = THEME_SCOPE_TARGETS[itemId];
                  const isActive = resolvedActiveScopeTargetId === itemId;
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
          onChange={(nextValue) => updateScopedCss(resolvedActiveScopeTargetId, nextValue)}
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
    () => Object.values(sanitizeThemeScopedCss(settings.themeScopedCss)).filter((value) => value.trim()).length,
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
              ? sanitizeThemeScopedCss(nextTheme.themeScopedCss as Record<string, string>)
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
