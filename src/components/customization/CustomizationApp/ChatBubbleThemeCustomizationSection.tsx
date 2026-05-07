import { Upload } from 'lucide-react';
import { useState } from 'react';
import type { VisualSettings } from '../../../types';
import {
  buildScopedBubbleThemeCss,
  buildScopedBubbleVariantCss,
  hasBubbleThemeCss,
  parseBubbleStyleCss,
} from '../../../features/chat-session/bubbleStyleCss';
import { usePersistentFieldActions } from '../../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { CHAT_THEME_TARGET_GROUPS } from './chatThemeCustomizationTargets';

function clampBubbleScale(value: number): number {
  return Math.min(1.3, Math.max(0.8, value));
}

function PreviewAnchors() {
  return (
    <>
      <span aria-hidden="true" className="corner bubble-corner tl pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner tr pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner bl pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner br pointer-events-none absolute" />
      <span aria-hidden="true" className="sticker-skull bubble-sticker-skull pointer-events-none absolute" />
      <span aria-hidden="true" className="bubble-charm pointer-events-none absolute">
        <span aria-hidden="true" className="bubble-charm-string pointer-events-none absolute" />
        <span aria-hidden="true" className="bubble-charm-body pointer-events-none absolute">
          <span aria-hidden="true" className="bubble-charm-core pointer-events-none absolute" />
        </span>
      </span>
    </>
  );
}

function CodeEditor({
  value,
  onChange,
  placeholder,
  heightClass = 'h-48',
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
      onInput={(event) => onChange((event.target as HTMLTextAreaElement).value)}
      placeholder={placeholder}
      spellCheck="false"
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      className={`${heightClass} w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-[13px] leading-6 text-zinc-800 caret-zinc-900 outline-none transition-colors placeholder:text-zinc-400 shadow-inner shadow-white/60 focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-zinc-200`}
    />
  );
}

function ImportStyleButton({
  onImport,
  label = '导入样式',
}: {
  onImport: (content: string) => void;
  label?: string;
}) {
  return (
    <label className="shrink-0 cursor-pointer rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200">
      {label}
      <input
        type="file"
        className="hidden"
        accept=".css,.txt"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            onImport(String(reader.result || ''));
            event.target.value = '';
          };
          reader.readAsText(file, 'utf-8');
        }}
      />
    </label>
  );
}

function PersistentImageUploadControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const { resolvedUrl, loading, error } = useResolvedPersistentValue(localValue);
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();

  const handleConfirm = async () => {
    const nextValue = localValue.trim() ? await setRemoteUrl(localValue) : await clearValue();
    setLocalValue(nextValue);
    onChange(nextValue);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      {(resolvedUrl || loading) && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
          {resolvedUrl ? (
            <img src={resolvedUrl} alt={label} className="h-28 w-full object-cover" />
          ) : (
            <div className="flex h-28 w-full items-center justify-center text-xs text-zinc-400">正在加载预览...</div>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600">
          资源解析失败，刷新后如果资源仍存在会自动恢复。
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder="支持链接、Markdown 或 HTML 图片"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-zinc-900 focus:outline-none"
        />
        <label className="flex cursor-pointer items-center justify-center whitespace-nowrap rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200">
          <Upload size={14} className="mr-1" /> 上传
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const nextValue = await setUploadedFile(file);
                setLocalValue(nextValue);
                onChange(nextValue);
              }
              e.target.value = '';
            }}
          />
        </label>
        <button
          onClick={() => void handleConfirm()}
          className="whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          确认
        </button>
      </div>
    </div>
  );
}

export function ChatBubbleThemeCustomizationSection({
  settings,
  setSettings,
}: {
  settings: VisualSettings;
  setSettings: (settings: VisualSettings) => void;
}) {
  const [mainTab, setMainTab] = useState<'global' | 'local' | 'targets'>('global');
  const [localTab, setLocalTab] = useState<'model' | 'user'>('model');
  const { resolvedUrl: resolvedChatBubbleBackgroundUrl } = useResolvedPersistentValue(settings.chat?.messageBackgroundImageUrl || '');
  const previewBubbleScale = clampBubbleScale(settings.chat?.bubbleScale ?? 1);
  const previewBubblePaddingX = 16 * previewBubbleScale;
  const previewBubblePaddingY = 8 * previewBubbleScale;
  const previewUserBubbleMaxWidth = `min(${Math.min(92, 70 + (previewBubbleScale - 1) * 18)}%, ${18 * previewBubbleScale}rem)`;
  const previewModelBubbleMaxWidth = `min(${Math.min(96, 82 + (previewBubbleScale - 1) * 18)}%, ${24 * previewBubbleScale}rem)`;

  const previewBubbleThemeCss = buildScopedBubbleThemeCss(settings.chat?.bubbleStyleCss, '.bubble-theme-preview');
  const previewModelBubbleThemeCss = buildScopedBubbleVariantCss(settings.chat?.modelBubbleStyleCss, '.bubble-theme-preview', '.bot-bubble');
  const previewUserBubbleThemeCss = buildScopedBubbleVariantCss(settings.chat?.userBubbleStyleCss, '.bubble-theme-preview', '.user-bubble');
  const previewHasThemeCss = hasBubbleThemeCss(settings.chat?.bubbleStyleCss);
  const previewHasModelThemeCss = hasBubbleThemeCss(settings.chat?.modelBubbleStyleCss);
  const previewHasUserThemeCss = hasBubbleThemeCss(settings.chat?.userBubbleStyleCss);
  const previewCommonBubbleStyle = parseBubbleStyleCss(settings.chat?.bubbleStyleCss);
  const previewModelBubbleStyle = {
    ...previewCommonBubbleStyle,
    ...parseBubbleStyleCss(settings.chat?.modelBubbleStyleCss),
  };
  const previewUserBubbleStyle = {
    ...previewCommonBubbleStyle,
    ...parseBubbleStyleCss(settings.chat?.userBubbleStyleCss),
  };

  return (
    <div className="space-y-4 rounded-[24px] border border-zinc-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-zinc-800">消息气泡设置</h3>

      <div className="bubble-theme-preview space-y-2 rounded-xl bg-zinc-50 p-4">
        {(previewBubbleThemeCss || previewModelBubbleThemeCss || previewUserBubbleThemeCss) && (
          <style>{[previewBubbleThemeCss, previewModelBubbleThemeCss, previewUserBubbleThemeCss].filter(Boolean).join('\n\n')}</style>
        )}
        <div className="flex justify-end">
          <div
            style={{
              ...(previewHasThemeCss
                ? {}
                : {
                    borderRadius: settings.chat.messageBorderRadius,
                    ...(previewHasUserThemeCss ? {} : { backgroundColor: settings.chat.messageBackgroundColorUser }),
                  }),
              ...previewUserBubbleStyle,
              paddingInline: `${previewBubblePaddingX}px`,
              paddingBlock: `${previewBubblePaddingY}px`,
              maxWidth: previewUserBubbleMaxWidth,
            }}
            className="chat-bubble message-bubble user-bubble right chat-bubble-right relative px-4 py-2 text-sm text-white"
          >
            <PreviewAnchors />
            你好！
          </div>
        </div>
        <div className="flex justify-start" style={{ marginTop: settings.chat.messageSpacing }}>
          <div
            style={{
              ...(previewHasThemeCss
                ? {}
                : {
                    borderRadius: settings.chat.messageBorderRadius,
                    ...(previewHasModelThemeCss
                      ? {}
                      : {
                          backgroundColor: settings.chat.messageBackgroundColorModel,
                          backgroundImage: resolvedChatBubbleBackgroundUrl ? `url(${resolvedChatBubbleBackgroundUrl})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }),
                  }),
              ...previewModelBubbleStyle,
              paddingInline: `${previewBubblePaddingX}px`,
              paddingBlock: `${previewBubblePaddingY}px`,
              maxWidth: previewModelBubbleMaxWidth,
            }}
            className="chat-bubble message-bubble bot-bubble left chat-bubble-left relative border border-zinc-200 px-4 py-2 text-sm text-zinc-800"
          >
            <PreviewAnchors />
            你好，有什么可以帮你的吗？
          </div>
        </div>
      </div>

      <PersistentImageUploadControl
        label="气泡背景图片"
        value={settings.chat.messageBackgroundImageUrl || ''}
        onChange={(val) => setSettings({ ...settings, chat: { ...settings.chat, messageBackgroundImageUrl: val } })}
      />

      <div className="space-y-2">
        <label className="flex justify-between text-xs font-bold text-zinc-500">
          <span>圆角</span>
          <span>{settings.chat.messageBorderRadius}px</span>
        </label>
        <input
          type="range"
          min="0"
          max="32"
          value={settings.chat.messageBorderRadius}
          onChange={(e) => setSettings({ ...settings, chat: { ...settings.chat, messageBorderRadius: Number(e.target.value) } })}
          className="w-full accent-zinc-900"
        />
      </div>

      <div className="space-y-2">
        <label className="flex justify-between text-xs font-bold text-zinc-500">
          <span>间距</span>
          <span>{settings.chat.messageSpacing}px</span>
        </label>
        <input
          type="range"
          min="4"
          max="32"
          value={settings.chat.messageSpacing}
          onChange={(e) => setSettings({ ...settings, chat: { ...settings.chat, messageSpacing: Number(e.target.value) } })}
          className="w-full accent-zinc-900"
        />
      </div>

      <div className="space-y-2">
        <label className="flex justify-between text-xs font-bold text-zinc-500">
          <span>大小</span>
          <span>{(previewBubbleScale * 100).toFixed(0)}%</span>
        </label>
        <input
          type="range"
          min="0.8"
          max="1.3"
          step="0.01"
          value={previewBubbleScale}
          onChange={(e) => setSettings({
            ...settings,
            chat: {
              ...settings.chat,
              bubbleScale: clampBubbleScale(parseFloat(e.target.value)),
            },
          })}
          className="w-full accent-zinc-900"
        />
      </div>

      <div className="space-y-3">
        <div className="inline-flex rounded-2xl bg-zinc-100 p-1">
          {[
            { key: 'global', label: '全局气泡' },
            { key: 'local', label: '局部气泡' },
            { key: 'targets', label: '识别对象' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setMainTab(item.key as 'global' | 'local' | 'targets')}
              className={`rounded-2xl border px-4 py-2 text-[13px] font-medium transition-colors ${
                mainTab === item.key
                  ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                  : 'border-transparent text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mainTab === 'global' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-500">全局气泡 CSS</label>
                <p className="mt-1 text-xs text-zinc-500">只作用于消息气泡及其内部元素，不影响整个聊天主题。支持 `.chat-bubble`、`.message-bubble`、`.corner`、`.sticker-skull`、`.bubble-charm` 和左右气泡选择器。</p>
              </div>
              <ImportStyleButton
                label="导入气泡"
                onImport={(content) => setSettings({ ...settings, chat: { ...settings.chat, bubbleStyleCss: content } })}
              />
            </div>
            <CodeEditor
              value={settings.chat.bubbleStyleCss || ''}
              onChange={(nextValue) => setSettings({ ...settings, chat: { ...settings.chat, bubbleStyleCss: nextValue } })}
              placeholder={'/* 只作用于气泡及气泡内容 */\n.chat-bubble,\n.message-bubble,\n.user-bubble,\n.bot-bubble {\n  position: relative;\n  border-radius: 22px;\n}\n\n.corner,\n.bubble-charm {\n  opacity: 1;\n}'}
              heightClass="h-64"
            />
          </div>
        )}

        {mainTab === 'local' && (
          <div className="space-y-3">
            <div className="inline-flex rounded-2xl bg-zinc-100 p-1">
              {[
                { key: 'model', label: '对方气泡' },
                { key: 'user', label: '用户气泡' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setLocalTab(item.key as 'model' | 'user')}
                  className={`rounded-2xl border px-4 py-2 text-[13px] font-medium transition-colors ${
                    localTab === item.key
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                      : 'border-transparent text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {localTab === 'model' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-500">对方气泡 CSS</label>
                    <p className="text-xs text-zinc-500">支持完整 CSS 和整段选择器，可覆盖消息气泡、图片消息、转账卡片等样式。</p>
                  </div>
                  <ImportStyleButton
                    onImport={(content) => setSettings({ ...settings, chat: { ...settings.chat, modelBubbleStyleCss: content } })}
                  />
                </div>
                <CodeEditor
                  value={settings.chat.modelBubbleStyleCss || ''}
                  onChange={(nextValue) => setSettings({ ...settings, chat: { ...settings.chat, modelBubbleStyleCss: nextValue } })}
                  placeholder={'.bot-bubble,\n.message-bubble.bot-bubble {\n  border: 2px solid #7d7a7c;\n  background: #f7edf1;\n}\n\n.chat-transfer-card,\n.chat-message-image {\n  border: 2px solid #7d7a7c;\n}'}
                  heightClass="h-56"
                />
              </div>
            )}

            {localTab === 'user' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-500">用户气泡 CSS</label>
                    <p className="text-xs text-zinc-500">支持完整 CSS 和整段选择器，可覆盖自己发出的气泡、图片消息、转账卡片等样式。</p>
                  </div>
                  <ImportStyleButton
                    onImport={(content) => setSettings({ ...settings, chat: { ...settings.chat, userBubbleStyleCss: content } })}
                  />
                </div>
                <CodeEditor
                  value={settings.chat.userBubbleStyleCss || ''}
                  onChange={(nextValue) => setSettings({ ...settings, chat: { ...settings.chat, userBubbleStyleCss: nextValue } })}
                  placeholder={'.user-bubble,\n.message-bubble.user-bubble {\n  border: 2px solid #7d7a7c;\n  background: #f7edf1;\n}\n\n.chat-transfer-card,\n.chat-message-image {\n  border-radius: 18px;\n}'}
                  heightClass="h-56"
                />
              </div>
            )}
          </div>
        )}

        {mainTab === 'targets' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">这里列的是当前已接入或正在规划接入的主题识别对象，后续可以按这些对象继续扩展样式命中范围。</p>
            {CHAT_THEME_TARGET_GROUPS.map((group) => (
              <div key={group.key} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="text-sm font-semibold text-zinc-900">{group.title}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span key={item} className="rounded-full bg-white px-3 py-1 text-[12px] text-zinc-600 shadow-sm ring-1 ring-zinc-100">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
