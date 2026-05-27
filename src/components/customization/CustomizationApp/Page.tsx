import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Monitor, MessageSquare, Palette, Database, Image as ImageIcon, Layout, Type, Upload, Download, Trash2, Plus, X, Cloud, Users, Layers, UserPlus, Phone, User, Heart, Ghost, Book, Compass, Share2, Calendar, Star, Settings, Mic, Banknote, Check, RefreshCw, Moon } from 'lucide-react';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VisualSettings, WidgetConfig, DesktopIconConfig, type ThemeFontAsset, type Character } from '../../../types';
import { DesktopWidget } from '../../shared/DesktopWidgets';
import { extractSingleImageUrl, showInAppConfirm } from '../../../utils';
import { usePersistentFieldActions } from '../../../features/persistence/usePersistentFieldActions';
import { getDisplayableAssetValue, getPreviewAssetValue } from '../../../features/persistence/persistentAssetRef';
import {
  createImagePreviewDataUrl,
  createImagePreviewDataUrlFromFile,
  resolveValueToDisplayUrl,
  type ImagePreviewOptions,
} from '../../../features/persistence/persistentAssetService';
import { KeyboardAwareScreen } from '../../../features/app-shell/KeyboardAwareScreen';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { useResolvedThemeTypographyCss } from '../../../features/theme/useResolvedThemeTypographyCss';
import { getThemeImportedFontFamily, getThemeSelectedFontStack, resolveThemeFontPriority } from '../../../features/theme/themeTypography';
import {
  type BackupRestoreProgress,
  isFullBackupArchive,
  isModularBackupAssetsArchive,
  isModularBackupArchive,
  isModularBackupDataArchive,
  isSingleFileModularBackupBundle,
  restoreModularBackupAssetsArchive,
  restoreModularBackupDataArchive,
  restoreModularBackupArchive,
  restoreFullBackupArchive,
  restoreSingleFileModularBackupBundle,
} from '../../../features/persistence/backupArchive';
import { saveJsonRecord } from '../../../features/persistence/browserJsonStore';
import {
  downloadBlobFile,
  downloadJsonFile,
  estimateBackupModuleSizes,
  formatBytes,
  waitForNextPaint,
} from '../../../features/persistence/backupUiHelpers';
import { runBackupImportJob } from '../../../features/persistence/backupImportWorkerClient';
import { runBackupExportJob } from '../../../features/persistence/backupExportWorkerClient';
import { buildPersistableCoupleSpacePayload } from '../../../features/persistence/coupleSpaceStore';
import { persistFriendRequests } from '../../../features/persistence/friendRequestsStore';
import {
  clearLegacyCompatibilityCopy,
  evaluateMigrationStatus,
  LEGACY_CLEANUP_SUCCESS_THRESHOLD,
  loadMigrationMeta,
  type MigrationCheckResult,
} from '../../../features/persistence/migrationStatusStore';
import { syncLocalStorageJsonValue } from '../../../features/persistence/localConfigStore';
import {
  createDefaultPerceptionSettings,
  hydratePerceptionSettings,
} from '../../../features/persistence/perceptionStore';
import {
  buildPersistableNonChatAppDataSnapshot,
  persistNonChatAppDataSnapshot,
} from '../../../features/persistence/persistNonChatAppDataSnapshot';
import {
  buildCharacterMemoryRecord,
  stripCharacterMemoryFromCharacters,
} from '../../../features/persistence/characterMemoryStore';
import { buildMemoryRecordDataFromChatHistory } from '../../../services/memory/buildMemoryRecordData';
import { mergeLegacyCharacterMemoryRecordIntoMemoryRecordData } from '../../../services/memory/memoryRecordSnapshots';
import { persistSettings } from '../../../features/persistence/settingsStore';
import { STORAGE_KEYS } from '../../../features/persistence/storageKeys';
import {
  extractDirectFactTraces,
  extractDirectRelationshipWaves,
  extractDirectSessionMetadata,
  extractGroupSessions,
} from '../../../features/persistence/chatHistoryStore';
import { persistChatOrganization } from '../../../features/persistence/chatOrganizationStore';
import { ChatBubbleThemeCustomizationSection } from './ChatBubbleThemeCustomizationSection';
import { ThemeCustomizationSection } from './ThemeCustomizationSection';
import { AvatarFrame } from '../../chat/AvatarFrame';
import { resolveMusicTogetherBackground } from '../../../features/music-together/resolveMusicTogetherBackground';
import {
  createDesktopWidgetFromType,
  getDesktopWidgetStyleOptions,
  getDesktopWidgetTypeLabel,
  isLegacyMusicWidget,
  SUPPORTED_DESKTOP_WIDGET_TEMPLATES,
  type SupportedDesktopWidgetType,
} from '../../shared/desktopWidgetCatalog';
import {
  AVATAR_FRAME_THEME_TARGETS,
  buildScopedAvatarFrameThemeCss,
} from '../../../features/chat-session/avatarFrameStyleCss';
import {
  buildScopedBubbleThemeCss,
  buildScopedBubbleVariantCss,
  hasBubbleThemeCss,
  parseBubbleStyleCss,
} from '../../../features/chat-session/bubbleStyleCss';

const DESKTOP_ICON_ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
]);
const MAX_DESKTOP_ICON_FILE_SIZE = 5 * 1024 * 1024;
const DESKTOP_ICON_PREVIEW_OPTIONS: ImagePreviewOptions = {
  maxWidth: 96,
  maxHeight: 96,
  mimeType: 'image/png',
};
const WALLPAPER_PREVIEW_OPTIONS: ImagePreviewOptions = {
  maxWidth: 240,
  maxHeight: 426,
  mimeType: 'image/png',
};

type PersistentImageChangeMeta = {
  previewUrl?: string;
};

function validateDesktopIconFile(file: File): Promise<void> {
  const normalizedType = (file.type || '').toLowerCase();

  if (!DESKTOP_ICON_ACCEPTED_IMAGE_TYPES.has(normalizedType)) {
    return Promise.reject(new Error('桌面图标仅支持 PNG、JPG、WEBP、GIF 或 BMP 图片。'));
  }

  if (file.size > MAX_DESKTOP_ICON_FILE_SIZE) {
    return Promise.reject(new Error('桌面图标图片不能超过 5MB。'));
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if ((image.naturalWidth || 0) < 1 || (image.naturalHeight || 0) < 1) {
        reject(new Error('图片尺寸无效，不能作为桌面图标。'));
        return;
      }
      resolve();
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('这张图片当前无法被浏览器正常解码，换成 PNG 或 JPG 试试。'));
    };

    image.src = objectUrl;
  });
}

type CustomizationAppProps = {
  visualSettings: VisualSettings;
  setVisualSettings: (settings: VisualSettings) => void;
  onBack: () => void;
  onResetData: () => void;
  onExportData: () => void;
  onImportData: (data: string) => void;
  appData: any;
  setAppData: (data: any) => void;
  settings: any;
  setSettings: (settings: any) => void;
};

export function CustomizationApp({
  visualSettings,
  setVisualSettings,
  onBack,
  onResetData,
  onExportData,
  onImportData,
  appData,
  setAppData,
  settings,
  setSettings
}: CustomizationAppProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'desktop' | 'chat' | 'theme' | 'data'>('home');
  const [desktopSubTab, setDesktopSubTab] = useState<'wallpaper' | 'icons' | 'layout' | 'dock' | 'widgets' | 'navbar' | 'font'>('wallpaper');
  const [chatSubTab, setChatSubTab] = useState<'avatar' | 'bubble' | 'background' | 'interface' | 'dynamics'>('avatar');
  return (
    <KeyboardAwareScreen
      className="absolute inset-0 bg-zinc-50 text-zinc-900 flex flex-col font-sans z-50"
      bodyClassName="flex-1 min-h-0 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-zinc-100 bg-white px-4 pb-4 shadow-sm relative z-10"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => activeTab === 'home' ? onBack() : setActiveTab('home')} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
            <ChevronLeft size={24} className="text-zinc-600" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">
            {activeTab === 'home' ? '自定义中心' : 
             activeTab === 'desktop' ? '桌面自定义' :
             activeTab === 'chat' ? '聊天自定义' :
             activeTab === 'theme' ? '主题自定义' : '数据管理'}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6"
          style={{ paddingBottom: "calc(var(--app-safe-area-bottom-ui, 0px) + 16px)" }}
        >
          {activeTab === 'home' && (
            <div className="grid grid-cols-2 gap-4">
              <CategoryCard 
                icon={<Monitor size={28} />} 
                title="桌面" 
                description="壁纸、图标、布局" 
                onClick={() => setActiveTab('desktop')} 
              />
              <CategoryCard 
                icon={<MessageSquare size={28} />} 
                title="聊天" 
                description="气泡、头像、动态" 
                onClick={() => setActiveTab('chat')} 
              />
              <CategoryCard 
                icon={<Palette size={28} />} 
                title="主题" 
                description="全局样式、CSS" 
                onClick={() => setActiveTab('theme')} 
              />
              <CategoryCard 
                icon={<Database size={28} />} 
                title="数据" 
                description="导入、导出、重置" 
                onClick={() => setActiveTab('data')} 
              />
            </div>
          )}
          {activeTab === 'desktop' && (
            <DesktopSettings 
              settings={visualSettings} 
              setSettings={setVisualSettings} 
              subTab={desktopSubTab} 
              setSubTab={setDesktopSubTab} 
            />
          )}
          {activeTab === 'chat' && (
            <ChatSettings 
              settings={visualSettings} 
              setSettings={setVisualSettings} 
              subTab={chatSubTab} 
              setSubTab={setChatSubTab} 
              appData={appData}
              setAppData={setAppData}
            />
          )}
          {activeTab === 'theme' && (
            <ThemeCustomizationSection settings={visualSettings} setSettings={setVisualSettings} />
          )}
          {activeTab === 'data' && (
            <DataSettings 
              onReset={onResetData} 
              appData={appData} 
              setAppData={setAppData}
              settings={settings}
              setSettings={setSettings}
            />
          )}
        </div>
      </div>
    </KeyboardAwareScreen>
  );
}

function CategoryCard({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className="relative overflow-hidden bg-white p-6 rounded-[28px] shadow-sm border border-zinc-100 flex flex-col items-start gap-2 active:scale-95 transition-all hover:shadow-md hover:border-zinc-200 group text-left w-full"
    >
      <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform duration-300 shadow-md">
        {icon}
      </div>
      <div>
        <h3 className="text-[17px] font-bold text-zinc-900 tracking-tight">{title}</h3>
        <p className="text-[12px] text-zinc-500 mt-1 font-medium leading-relaxed">{description}</p>
      </div>
      <div className="absolute top-6 right-6 text-zinc-300 group-hover:translate-x-1 group-hover:text-zinc-900 transition-all">
        <ChevronRight size={20} />
      </div>
    </button>
  );
}

function resolveInstantPreviewUrl(value: string | null | undefined, previewUrl?: string | null) {
  return getPreviewAssetValue(previewUrl) || getDisplayableAssetValue(value, null);
}

function ImageUploadControl({
  label,
  value,
  onChange,
}: {
  label: string,
  value: string,
  onChange: (val: string) => void,
}) {
  const [localValue, setLocalValue] = useState(value);
  const { resolvedUrl, loading } = useResolvedPersistentValue(localValue);
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleConfirm = async () => {
    const finalUrl = localValue.trim() ? await setRemoteUrl(localValue) : await clearValue();
    setLocalValue(finalUrl);
    onChange(finalUrl);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      {(resolvedUrl || loading) && (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50">
          {resolvedUrl ? (
            <img src={resolvedUrl} alt={label} className="w-full h-28 object-cover" />
          ) : (
            <div className="w-full h-28 flex items-center justify-center text-xs text-zinc-400">正在加载预览...</div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <input 
          type="text" 
          value={localValue} 
          onChange={e => setLocalValue(e.target.value)} 
          placeholder="支持链接、Markdown或HTML图片" 
          className="flex-1 min-w-0 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-zinc-900"
        />
        <label className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-medium cursor-pointer transition-colors flex items-center justify-center whitespace-nowrap">
          <Upload size={14} className="mr-1" /> 上传
          <input type="file" accept="image/*,video/*" className="hidden" onChange={async e => {
            const file = e.target.files?.[0];
            if (file) {
              const persistedValue = await setUploadedFile(file);
              setLocalValue(persistedValue);
              onChange(persistedValue);
            }
            e.target.value = '';
          }} />
        </label>
        <button 
          onClick={handleConfirm}
          className="whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          确认
        </button>
      </div>
    </div>
  );
}

function PersistentImageUploadControl({
  label,
  value,
  onChange,
  previewUrl,
  fileValidator,
  previewOptions,
}: {
  label: string,
  value: string,
  onChange: (val: string, meta?: PersistentImageChangeMeta) => void,
  previewUrl?: string,
  fileValidator?: (file: File) => Promise<void>,
  previewOptions?: ImagePreviewOptions,
}) {
  const [localValue, setLocalValue] = useState(value);
  const { resolvedUrl, loading, error } = useResolvedPersistentValue(localValue);
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();
  const previewDisplayUrl = resolvedUrl || resolveInstantPreviewUrl(localValue, previewUrl);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleConfirm = async () => {
    const nextValue = localValue.trim() ? await setRemoteUrl(localValue) : await clearValue();
    let nextPreviewUrl = nextValue
      ? resolveInstantPreviewUrl(nextValue, previewUrl) || ''
      : '';
    if (!nextPreviewUrl && nextValue) {
      try {
        const resolvedAssetUrl = await resolveValueToDisplayUrl(nextValue);
        if (resolvedAssetUrl) {
          const previewResponse = await fetch(resolvedAssetUrl);
          const previewBlob = await previewResponse.blob();
          nextPreviewUrl = await createImagePreviewDataUrl(previewBlob, previewOptions);
        }
      } catch {
        nextPreviewUrl = '';
      }
    }
    setLocalValue(nextValue);
    onChange(nextValue, { previewUrl: nextPreviewUrl });
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      {(previewDisplayUrl || loading) && (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50">
          {previewDisplayUrl ? (
            <img src={previewDisplayUrl} alt={label} className="w-full h-28 object-cover" />
          ) : (
            <div className="w-full h-28 flex items-center justify-center text-xs text-zinc-400">正在加载预览...</div>
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
          onChange={e => setLocalValue(e.target.value)}
          placeholder="支持链接、Markdown或HTML图片"
          className="flex-1 min-w-0 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-zinc-900"
        />
        <label className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-medium cursor-pointer transition-colors flex items-center justify-center whitespace-nowrap">
          <Upload size={14} className="mr-1" /> 上传
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  if (fileValidator) {
                    await fileValidator(file);
                  }
                  const nextValue = await setUploadedFile(file);
                  let nextPreviewUrl = '';
                  try {
                    nextPreviewUrl = await createImagePreviewDataUrlFromFile(file, previewOptions);
                  } catch {
                    nextPreviewUrl = '';
                  }
                  setLocalValue(nextValue);
                  onChange(nextValue, { previewUrl: nextPreviewUrl });
                } catch (uploadError) {
                  alert(uploadError instanceof Error ? `上传失败: ${uploadError.message}` : '上传失败，请稍后重试。');
                }
              }
              e.target.value = '';
            }}
          />
        </label>
        <button
          onClick={() => {
            void handleConfirm();
          }}
          className="whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          确认
        </button>
      </div>
    </div>
  );
}

function WidgetListThumbnail({ widget }: { widget: WidgetConfig }) {
  const { resolvedUrl } = useResolvedPersistentValue(widget.background);

  return (
    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-zinc-900 overflow-hidden">
      {resolvedUrl ? (
        <img src={resolvedUrl} className="w-full h-full object-cover" alt="Widget background" />
      ) : (
        <>
          {widget.type === 'kawaii-launcher' && <User size={20} />}
          {widget.type === 'kawaii-scrapbook' && <Layout size={20} />}
          {widget.type === 'glass-duo-card' && <Users size={20} />}
          {widget.type === 'glass-vinyl-player' && <Mic size={20} />}
          {widget.type === 'glass-polaroid-strip' && <ImageIcon size={20} />}
          {widget.type === 'glass-recent-grid' && <Layout size={20} />}
          {widget.type === 'calendar' && <Layout size={20} />}
          {widget.type === 'time' && <Monitor size={20} />}
          {widget.type === 'floating-time' && <Monitor size={20} />}
          {widget.type === 'anniversary' && <Palette size={20} />}
          {widget.type === 'weather' && <Cloud size={20} />}
          {widget.type === 'profile-card' && <User size={20} />}
          {widget.type === 'blank' && <Layout size={20} />}
        </>
      )}
    </div>
  );
}

function PersistentAssetUploadControl({
  label,
  value,
  onChange,
  accept,
  placeholder,
  kind = 'image',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  accept: string;
  placeholder: string;
  kind?: 'image' | 'audio';
}) {
  const [localValue, setLocalValue] = useState(value);
  const { resolvedUrl } = useResolvedPersistentValue(kind === 'image' ? localValue : '');
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();
  const previewDisplayUrl = kind === 'image' ? resolvedUrl || resolveInstantPreviewUrl(localValue, '') : '';

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleConfirm = async () => {
    const trimmed = localValue.trim();
    const nextValue = trimmed
      ? kind === 'image'
        ? await setRemoteUrl(localValue)
        : trimmed
      : await clearValue();
    setLocalValue(nextValue);
    onChange(nextValue);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      {kind === 'image' && previewDisplayUrl ? (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50">
          <img src={previewDisplayUrl} alt={label} className="w-full h-28 object-cover" />
        </div>
      ) : null}
      {kind === 'audio' && value ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
          已设置音频资源
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-zinc-900"
        />
        <label className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-medium cursor-pointer transition-colors flex items-center justify-center whitespace-nowrap">
          <Upload size={14} className="mr-1" /> 上传
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const persistedValue = await setUploadedFile(file);
                setLocalValue(persistedValue);
                onChange(persistedValue);
              } catch (error) {
                alert(error instanceof Error ? `上传失败: ${error.message}` : '上传失败，请稍后重试。');
              }
              e.target.value = '';
            }}
          />
        </label>
        <button
          onClick={() => {
            void handleConfirm();
          }}
          className="whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          确认
        </button>
      </div>
    </div>
  );
}

function WidgetTextInput({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900"
        />
      )}
    </div>
  );
}

function WidgetColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#e0ddd9'}
          onChange={event => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1"
        />
        <input
          type="text"
          value={value || '#e0ddd9'}
          onChange={event => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900"
          placeholder="#e0ddd9"
        />
      </div>
    </div>
  );
}

function WidgetToggleInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-3">
      <span className="text-xs font-bold text-zinc-500">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="h-4 w-4 accent-zinc-900"
      />
    </label>
  );
}

type FontFamilySuggestion = {
  label: string;
  value: string;
};

function resolveColorInputValue(value: string | undefined, fallback: string): string {
  const normalizedValue = value?.trim() || '';
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalizedValue) ? normalizedValue : fallback;
}

function OptionalColorInput({
  label,
  value,
  onChange,
  fallback,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  fallback: string;
}) {
  const hasCustomValue = Boolean(value?.trim());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold text-zinc-500">{label}</label>
        {hasCustomValue ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-600"
          >
            跟随默认
          </button>
        ) : (
          <span className="text-[11px] text-zinc-400">留空跟随默认</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={resolveColorInputValue(value, fallback)}
          onChange={event => onChange(event.target.value)}
          className="h-11 w-14 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1"
        />
        <input
          type="text"
          value={value || ''}
          onChange={event => onChange(event.target.value)}
          placeholder={`留空跟随默认（${fallback}）`}
          className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[13px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </div>
    </div>
  );
}

function OptionalFontFamilyInput({
  label,
  value,
  onChange,
  listId,
  suggestions,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  listId: string;
  suggestions: FontFamilySuggestion[];
}) {
  const hasCustomValue = Boolean(value?.trim());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold text-zinc-500">{label}</label>
        {hasCustomValue ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-600"
          >
            跟随全局
          </button>
        ) : (
          <span className="text-[11px] text-zinc-400">留空跟随全局字体</span>
        )}
      </div>
      <input
        list={listId}
        type="text"
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        placeholder='留空跟随全局字体，或输入 CSS font-family'
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[13px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
      />
      {suggestions.length > 0 ? (
        <datalist id={listId}>
          {suggestions.map((option) => (
            <option key={`${option.label}-${option.value}`} value={option.value} label={option.label} />
          ))}
        </datalist>
      ) : null}
      <p className="text-[11px] leading-relaxed text-zinc-400">
        支持直接输入任意 CSS font-family，也可以点输入框后从建议里选现成字体。
      </p>
    </div>
  );
}

function buildOptionalTextStyle(
  color?: string | null,
  fontFamily?: string | null,
): React.CSSProperties | undefined {
  const nextStyle: React.CSSProperties = {};
  const normalizedColor = color?.trim();
  const normalizedFontFamily = fontFamily?.trim();

  if (normalizedColor) {
    nextStyle.color = normalizedColor;
  }

  if (normalizedFontFamily) {
    nextStyle.fontFamily = normalizedFontFamily;
  }

  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
}

function KawaiiWidgetCustomizationFields({
  widget,
  onUpdate,
}: {
  widget: WidgetConfig;
  onUpdate: (updates: Partial<WidgetConfig>) => void;
}) {
  switch (widget.type) {
    case 'kawaii-launcher':
      return (
        <>
          <PersistentImageUploadControl
            label="中心头像"
            value={widget.avatarUrl || ''}
            onChange={value => onUpdate({ avatarUrl: value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <WidgetTextInput label="左上标签" value={widget.item1Label || ''} onChange={value => onUpdate({ item1Label: value })} />
            <WidgetTextInput label="左下标签" value={widget.item2Label || ''} onChange={value => onUpdate({ item2Label: value })} />
            <WidgetTextInput label="右上标签" value={widget.item3Label || ''} onChange={value => onUpdate({ item3Label: value })} />
            <WidgetTextInput label="右下标签" value={widget.item4Label || ''} onChange={value => onUpdate({ item4Label: value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <WidgetColorInput label="左上颜色" value={widget.item1Color || '#e0ddd9'} onChange={value => onUpdate({ item1Color: value })} />
            <WidgetColorInput label="左下颜色" value={widget.item2Color || '#e0ddd9'} onChange={value => onUpdate({ item2Color: value })} />
            <WidgetColorInput label="右上颜色" value={widget.item3Color || '#e0ddd9'} onChange={value => onUpdate({ item3Color: value })} />
            <WidgetColorInput label="右下颜色" value={widget.item4Color || '#e0ddd9'} onChange={value => onUpdate({ item4Color: value })} />
          </div>

          <WidgetTextInput
            label="底部文案"
            value={widget.bio || ''}
            onChange={value => onUpdate({ bio: value })}
            placeholder="例如：猫ちゃんがいない日は雨季。"
          />
        </>
      );
    case 'kawaii-scrapbook':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <PersistentImageUploadControl
              label="头像"
              value={widget.avatarUrl || ''}
              onChange={value => onUpdate({ avatarUrl: value })}
            />
            <PersistentImageUploadControl
              label="主照片"
              value={widget.photoUrl || ''}
              onChange={value => onUpdate({ photoUrl: value })}
            />
          </div>

          <PersistentImageUploadControl
            label="小照片"
            value={widget.secondaryPhotoUrl || ''}
            onChange={value => onUpdate({ secondaryPhotoUrl: value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <WidgetTextInput label="标题" value={widget.title || ''} onChange={value => onUpdate({ title: value })} />
            <WidgetTextInput label="简介" value={widget.bio || ''} onChange={value => onUpdate({ bio: value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <WidgetColorInput label="左上底色" value={widget.item1Color || '#f3e7eb'} onChange={value => onUpdate({ item1Color: value })} />
            <WidgetColorInput label="右上底色" value={widget.item2Color || '#ffffff'} onChange={value => onUpdate({ item2Color: value })} />
            <WidgetColorInput label="左下底色" value={widget.item3Color || '#efede7'} onChange={value => onUpdate({ item3Color: value })} />
            <WidgetColorInput label="右下底色" value={widget.item4Color || '#f7ecef'} onChange={value => onUpdate({ item4Color: value })} />
          </div>

          <WidgetTextInput
            label="便签文案"
            value={widget.note || ''}
            onChange={value => onUpdate({ note: value })}
            multiline
          />
        </>
      );
    case 'glass-duo-card':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <PersistentImageUploadControl
              label="左侧头像"
              value={widget.avatarUrl || ''}
              onChange={value => onUpdate({ avatarUrl: value })}
            />
            <PersistentImageUploadControl
              label="右侧头像"
              value={widget.secondaryAvatarUrl || ''}
              onChange={value => onUpdate({ secondaryAvatarUrl: value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <WidgetTextInput label="左侧文案" value={widget.line1Text || ''} onChange={value => onUpdate({ line1Text: value })} />
            <WidgetTextInput label="右侧文案" value={widget.line2Text || ''} onChange={value => onUpdate({ line2Text: value })} />
          </div>
          <WidgetTextInput
            label="底部文案"
            value={widget.bio || ''}
            onChange={value => onUpdate({ bio: value })}
          />
        </>
      );
    case 'glass-vinyl-player':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <PersistentImageUploadControl
              label="左侧相片"
              value={widget.photoUrl || ''}
              onChange={value => onUpdate({ photoUrl: value })}
            />
            <PersistentImageUploadControl
              label="右侧相片"
              value={widget.secondaryPhotoUrl || ''}
              onChange={value => onUpdate({ secondaryPhotoUrl: value })}
            />
          </div>
          <PersistentAssetUploadControl
            label="音频资源"
            value={widget.audioUrl || ''}
            onChange={value => onUpdate({ audioUrl: value })}
            accept="audio/*"
            kind="audio"
            placeholder="支持音频链接或上传"
          />
          <div className="grid grid-cols-2 gap-3">
            <WidgetTextInput label="歌名" value={widget.title || ''} onChange={value => onUpdate({ title: value })} />
            <WidgetTextInput label="歌手" value={widget.bio || ''} onChange={value => onUpdate({ bio: value })} />
          </div>
          <WidgetTextInput
            label="气泡文案"
            value={widget.note || ''}
            onChange={value => onUpdate({ note: value })}
          />
        </>
      );
    case 'glass-polaroid-strip':
      return (
        <div className="grid grid-cols-2 gap-3">
          <PersistentImageUploadControl
            label="左侧拍立得"
            value={widget.avatarUrl || ''}
            onChange={value => onUpdate({ avatarUrl: value })}
          />
          <PersistentImageUploadControl
            label="中间拍立得"
            value={widget.photoUrl || ''}
            onChange={value => onUpdate({ photoUrl: value })}
          />
          <PersistentImageUploadControl
            label="右侧拍立得"
            value={widget.secondaryPhotoUrl || ''}
            onChange={value => onUpdate({ secondaryPhotoUrl: value })}
          />
        </div>
      );
    case 'glass-recent-grid':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <WidgetTextInput label="左侧标题" value={widget.title || ''} onChange={value => onUpdate({ title: value })} />
            <WidgetTextInput label="右侧文案" value={widget.note || ''} onChange={value => onUpdate({ note: value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }, (_, index) => {
              const images = Array.from({ length: 6 }, (__unused, imageIndex) => widget.images?.[imageIndex] || '');
              return (
                <PersistentImageUploadControl
                  key={index}
                  label={`图片 ${index + 1}`}
                  value={images[index]}
                  onChange={value => {
                    const nextImages = [...images];
                    nextImages[index] = value;
                    onUpdate({ images: nextImages });
                  }}
                />
              );
            })}
          </div>
        </>
      );
    case 'floating-time':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <WidgetColorInput
              label="时间颜色"
              value={widget.timeColor || '#6f7892'}
              onChange={value => onUpdate({ timeColor: value })}
            />
            <WidgetColorInput
              label="日期颜色"
              value={widget.dateColor || '#7c8499'}
              onChange={value => onUpdate({ dateColor: value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 flex justify-between">
                <span>时间粗细</span>
                <span>{widget.timeWeight ?? 700}</span>
              </label>
              <input
                type="range"
                min="200"
                max="900"
                step="100"
                value={widget.timeWeight ?? 700}
                onChange={event => onUpdate({ timeWeight: Number(event.target.value) })}
                className="w-full accent-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">摆放位置</label>
              <select
                value={widget.textAlign || 'center'}
                onChange={event => onUpdate({ textAlign: event.target.value as WidgetConfig['textAlign'] })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
              >
                <option value="left">居左</option>
                <option value="center">居中</option>
                <option value="right">居右</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">日期位置</label>
              <select
                value={widget.datePosition || 'top'}
                onChange={event => onUpdate({ datePosition: event.target.value as WidgetConfig['datePosition'] })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
              >
                <option value="top">上方</option>
                <option value="bottom">下方</option>
              </select>
            </div>

            <WidgetToggleInput
              label="显示描边框"
              checked={widget.showOutline !== false}
              onChange={checked => onUpdate({ showOutline: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <WidgetToggleInput
              label="显示日期"
              checked={widget.showDate !== false}
              onChange={checked => onUpdate({ showDate: checked })}
            />
            <WidgetToggleInput
              label="显示农历"
              checked={widget.showLunar !== false}
              onChange={checked => onUpdate({ showLunar: checked })}
            />
          </div>
        </>
      );
    default:
      return null;
  }
}

function PersistentSquareThumbnail({ value, previewUrl, alt }: { value?: string; previewUrl?: string; alt: string }) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const displayUrl = resolvedUrl || resolveInstantPreviewUrl(value, previewUrl);

  if (!displayUrl) {
    return null;
  }

  return <img src={displayUrl} className="w-full h-full object-cover" alt={alt} />;
}

// --- Desktop Settings ---
function DesktopSettings({ settings, setSettings, subTab, setSubTab }: any) {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const { setUploadedFile } = usePersistentFieldActions();
  const { resolvedUrl: resolvedWallpaperUrl } = useResolvedPersistentValue(settings.globalBackground);
  const { resolvedUrl: resolvedDockBackgroundUrl } = useResolvedPersistentValue(settings.desktop?.dockBackgroundImage || '');
  const { resolvedUrl: resolvedNavBarBackgroundUrl } = useResolvedPersistentValue(settings.navBar?.backgroundImage || '');
  const { resolvedUrl: resolvedNavBarAvatarUrl } = useResolvedPersistentValue(settings.navBar?.avatar || '');
  const wallpaperDisplayUrl = resolvedWallpaperUrl || resolveInstantPreviewUrl(settings.globalBackground, settings.globalBackgroundPreviewUrl);
  const dockBackgroundDisplayUrl =
    resolvedDockBackgroundUrl
    || resolveInstantPreviewUrl(settings.desktop?.dockBackgroundImage, settings.desktop?.dockBackgroundPreviewUrl);
  const typography = settings.themeTypography || {};
  const effectiveFontPriority = resolveThemeFontPriority(typography);
  const importedFonts: ThemeFontAsset[] = typography.importedFonts || [];
  const { resolvedFonts } = useResolvedThemeTypographyCss(typography);
  const selectedResolvedFont = resolvedFonts.find((font) => font.id === typography.selectedFontId);
  const previewFontFamily =
    typography.selectedFontId && effectiveFontPriority !== 'css-only'
      ? `"${getThemeImportedFontFamily(typography.selectedFontId)}"`
      : settings.desktop?.fontFamily === 'Mono'
        ? 'monospace'
        : settings.desktop?.fontFamily === 'Serif'
          ? 'serif'
        : settings.desktop?.fontFamily === 'Cursive'
          ? 'cursive'
          : 'sans-serif';
  const previewText =
    typography.previewText || '桌面字体预览 你好，Bloom\nBloom Font Preview 123 ABC abc';
  const visibleWidgets = useMemo(
    () => (settings.widgets || []).filter((widget: WidgetConfig) => !isLegacyMusicWidget(widget)),
    [settings.widgets]
  );
  const widgetTemplates = SUPPORTED_DESKTOP_WIDGET_TEMPLATES;

  const updateTypography = (patch: Partial<VisualSettings['themeTypography']>) =>
    setSettings({
      ...settings,
      themeTypography: {
        ...typography,
        ...patch,
      },
    });
  const addWidgetByType = (type: SupportedDesktopWidgetType) => {
    const newWidget = createDesktopWidgetFromType(type);
    if (!newWidget) return;
    setSettings({ ...settings, widgets: [...(settings.widgets || []), newWidget] });
    setEditingWidgetId(newWidget.id);
    setShowWidgetPicker(false);
  };

  const apps = [
    { id: 'chat', name: '聊天', icon: 'MessageSquare' },
    { id: 'settings', name: 'API 中心', icon: 'Settings' },
    { id: 'worldbook', name: '世界书', icon: 'Book' },
    { id: 'monitor', name: '监控功能', icon: 'Activity' },
    { id: 'couple-space', name: '情侣空间', icon: 'Heart' },
    { id: 'perception', name: '感知', icon: 'Eye' },
    { id: 'music', name: '音乐', icon: 'Music' },
    { id: 'forum', name: '界隙', icon: 'MessageCircle' },
    { id: 'mall', name: '商城', icon: 'ShoppingBag' },
    { id: 'wallet', name: '钱包', icon: 'Wallet' },
    { id: 'dream', name: '梦境', icon: 'Moon' },
    { id: 'customization', name: '自定义', icon: 'Settings2' },
  ];

  const handleIconUpdate = (appId: string, url: string, previewUrl = '') => {
    const currentIcons = settings.desktopIcons || [];
    const existingIndex = currentIcons.findIndex((i: any) => i.id === appId);
    
    let newIcons;
    if (existingIndex >= 0) {
      newIcons = [...currentIcons];
      newIcons[existingIndex] = {
        ...newIcons[existingIndex],
        iconUrl: url,
        iconPreviewUrl: previewUrl,
      };
    } else {
      newIcons = [...currentIcons, { id: appId, iconUrl: url, iconPreviewUrl: previewUrl }];
    }
    setSettings({ ...settings, desktopIcons: newIcons });
  };

  const handleWidgetUpdate = (widgetId: string, updates: Partial<WidgetConfig>) => {
    setSettings({
      ...settings,
      widgets: (settings.widgets || []).map((w: WidgetConfig) =>
        w.id === widgetId ? { ...w, ...updates } : w
      )
    });
  };

  useEffect(() => {
    if ((settings.widgets || []).length === visibleWidgets.length) {
      return;
    }

    setSettings({
      ...settings,
      widgets: visibleWidgets,
    });
  }, [settings, setSettings, visibleWidgets]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['wallpaper', 'icons', 'layout', 'dock', 'widgets', 'navbar', 'font'].map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              subTab === tab ? 'border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm' : 'bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            {tab === 'wallpaper' && '壁纸'}
            {tab === 'icons' && '图标'}
            {tab === 'layout' && '摆放'}
            {tab === 'dock' && 'Dock'}
            {tab === 'widgets' && '小卡片'}
            {tab === 'navbar' && '导航栏'}
            {tab === 'font' && '字体'}
          </button>
        ))}
      </div>

      {subTab === 'wallpaper' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">全局壁纸设置</h3>
          <div className="aspect-[9/16] w-32 mx-auto bg-zinc-100 rounded-2xl overflow-hidden border-4 border-zinc-800 relative shadow-lg">
            {wallpaperDisplayUrl ? (
              <img src={wallpaperDisplayUrl} className="w-full h-full object-cover" alt="Wallpaper" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">无壁纸</div>
            )}
          </div>
          <PersistentImageUploadControl 
            label="壁纸图片" 
            value={settings.globalBackground} 
            previewUrl={settings.globalBackgroundPreviewUrl || ''}
            previewOptions={WALLPAPER_PREVIEW_OPTIONS}
            onChange={(val, meta) => setSettings({
              ...settings,
              globalBackground: val,
              globalBackgroundPreviewUrl: meta?.previewUrl || '',
            })} 
          />
          <p className="text-xs text-zinc-400 text-center">支持输入图片/视频链接或上传本地文件</p>
        </div>
      )}

      {subTab === 'icons' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">图标设置</h3>
          
          {/* Global Settings */}
          <div className="space-y-4 border-b border-zinc-100 pb-4">
            <div className="flex justify-center py-4">
              <div 
                style={{ 
                  width: settings.desktop?.iconSize ?? 56, 
                  height: settings.desktop?.iconSize ?? 56, 
                  borderRadius: settings.desktop?.iconBorderRadius ?? 14
                }} 
                className="bg-zinc-900 flex items-center justify-center overflow-hidden shadow-sm transition-all"
              >
                <MessageSquare size={(settings.desktop?.iconSize ?? 56) * 0.5} className="text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 flex justify-between">
                <span>大小</span>
                <span>{settings.desktop?.iconSize ?? 56}px</span>
              </label>
              <input type="range" min="40" max="80" value={settings.desktop?.iconSize ?? 56} onChange={e => setSettings({...settings, desktop: {...settings.desktop, iconSize: Number(e.target.value)}})} className="w-full accent-zinc-900" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 flex justify-between">
                <span>圆角</span>
                <span>{settings.desktop?.iconBorderRadius ?? 14}px</span>
              </label>
              <input type="range" min="0" max="40" value={settings.desktop?.iconBorderRadius ?? 14} onChange={e => setSettings({...settings, desktop: {...settings.desktop, iconBorderRadius: Number(e.target.value)}})} className="w-full accent-zinc-900" />
            </div>
          </div>

          {/* Individual Icon Settings */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-500">自定义应用图标</h4>
            <div className="grid grid-cols-4 gap-2">
              {apps.map(app => (
                <button
                  key={app.id}
                  onClick={() => setSelectedAppId(selectedAppId === app.id ? null : app.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    selectedAppId === app.id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:bg-zinc-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-200 overflow-hidden">
                    {settings.desktopIcons?.find((i: any) => i.id === app.id)?.iconUrl ? (
                      <PersistentSquareThumbnail
                        value={settings.desktopIcons.find((i: any) => i.id === app.id).iconUrl}
                        previewUrl={settings.desktopIcons.find((i: any) => i.id === app.id).iconPreviewUrl}
                        alt={`${app.name} icon`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 text-[10px]">{app.name[0]}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-600 truncate w-full text-center">{app.name}</span>
                </button>
              ))}
            </div>

            {selectedAppId && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-700">编辑 {apps.find(a => a.id === selectedAppId)?.name} 图标</span>
                  <button onClick={() => setSelectedAppId(null)} className="p-1 hover:bg-zinc-200 rounded-full"><X size={14} /></button>
                </div>
                <PersistentImageUploadControl 
                  label="图标图片" 
                  value={settings.desktopIcons?.find((i: any) => i.id === selectedAppId)?.iconUrl || ''} 
                  previewUrl={settings.desktopIcons?.find((i: any) => i.id === selectedAppId)?.iconPreviewUrl || ''}
                  previewOptions={DESKTOP_ICON_PREVIEW_OPTIONS}
                  onChange={(val, meta) => handleIconUpdate(selectedAppId, val, meta?.previewUrl || '')}
                  fileValidator={validateDesktopIconFile}
                />
              </motion.div>
            )}
          </div>
        </div>
      )}

      {subTab === 'layout' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">桌面摆放</h3>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>列数</span>
              <span>{settings.desktop?.gridColumns ?? 4}列</span>
            </label>
            <input type="range" min="3" max="6" value={settings.desktop?.gridColumns ?? 4} onChange={e => setSettings({...settings, desktop: {...settings.desktop, gridColumns: Number(e.target.value)}})} className="w-full accent-zinc-900" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>间距</span>
              <span>{settings.desktop?.gridGap ?? 16}px</span>
            </label>
            <input type="range" min="8" max="32" value={settings.desktop?.gridGap ?? 16} onChange={e => setSettings({...settings, desktop: {...settings.desktop, gridGap: Number(e.target.value)}})} className="w-full accent-zinc-900" />
          </div>
        </div>
      )}

      {subTab === 'dock' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">底部 Dock</h3>

          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
            <div className="mx-auto flex w-full max-w-[280px] flex-col items-center gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Preview</div>
              <div className="relative w-full">
                <div className="absolute inset-x-4 bottom-[-8px] h-6 rounded-b-[22px] border border-white/20 border-t-0 bg-white/25 blur-[0.2px]" />
                <div className="relative flex min-h-[88px] items-center justify-around overflow-hidden rounded-[28px] border border-white/35 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.12)] backdrop-blur-[28px]">
                  {dockBackgroundDisplayUrl ? (
                    <img
                      src={dockBackgroundDisplayUrl}
                      alt="Dock background preview"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: settings.desktop?.dockTintColor || '#f8fafc',
                      opacity: settings.desktop?.dockTintOpacity ?? 0.18,
                    }}
                  />
                  {['钱包', '梦境', '自定义'].map((label, index) => (
                    <div key={label} className="relative z-10 flex flex-col items-center gap-1">
                      <div
                        className="h-12 w-12 overflow-hidden rounded-[16px] bg-white shadow-[0_6px_14px_rgba(15,23,42,0.12)]"
                        style={{ borderRadius: settings.desktop?.iconBorderRadius ?? 14 }}
                      >
                        {index === 0 ? <Banknote size={24} className="m-auto mt-3 text-zinc-700" /> : index === 1 ? <Moon size={24} className="m-auto mt-3 text-zinc-700" /> : <Settings size={24} className="m-auto mt-3 text-zinc-700" />}
                      </div>
                      <span className="text-[11px] font-medium text-zinc-700">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <PersistentImageUploadControl
            label="Dock 背景图"
            value={settings.desktop?.dockBackgroundImage || ''}
            previewUrl={settings.desktop?.dockBackgroundPreviewUrl || ''}
            previewOptions={WALLPAPER_PREVIEW_OPTIONS}
            onChange={(val, meta) =>
              setSettings({
                ...settings,
                desktop: {
                  ...settings.desktop,
                  dockBackgroundImage: val,
                  dockBackgroundPreviewUrl: meta?.previewUrl || '',
                },
              })
            }
          />

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">Dock 叠加颜色</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.desktop?.dockTintColor || '#f8fafc'}
                onChange={e => setSettings({ ...settings, desktop: { ...settings.desktop, dockTintColor: e.target.value } })}
                className="h-11 w-14 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1"
              />
              <input
                type="text"
                value={settings.desktop?.dockTintColor || '#f8fafc'}
                onChange={e => setSettings({ ...settings, desktop: { ...settings.desktop, dockTintColor: e.target.value } })}
                placeholder="#f8fafc"
                className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[13px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>Dock 颜色透明度</span>
              <span>{Math.round((settings.desktop?.dockTintOpacity ?? 0.18) * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="0.75"
              step="0.05"
              value={settings.desktop?.dockTintOpacity ?? 0.18}
              onChange={e => setSettings({ ...settings, desktop: { ...settings.desktop, dockTintOpacity: Number(e.target.value) } })}
              className="w-full accent-zinc-900"
            />
          </div>

          <p className="text-[11px] leading-5 text-zinc-400">
            可以给底部 Dock 单独上传背景图，再叠加一层颜色做出更接近 iOS 或更个性化的效果。
          </p>
        </div>
      )}

      {subTab === 'widgets' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-800">小卡片组件</h3>
            <button 
              onClick={() => setShowWidgetPicker(prev => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              <Plus size={16} />
            </button>
          </div>

          {showWidgetPicker && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
            >
              {widgetTemplates.map(item => (
                <button
                  key={item.type}
                  onClick={() => addWidgetByType(item.type)}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </motion.div>
          )}
          
          {visibleWidgets.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-3 border-2 border-dashed border-zinc-100 rounded-2xl">
              <Layout size={32} className="text-zinc-300" />
              <p className="text-xs font-medium">暂无小卡片组件</p>
              <p className="text-[10px] text-zinc-400">点击右上角添加日历、时间等组件</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleWidgets.map((widget: WidgetConfig) => {
                if (!widget) return null;
                return (
                <div key={widget.id} className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setEditingWidgetId(editingWidgetId === widget.id ? null : widget.id)}>
                      <WidgetListThumbnail widget={widget} />
                      <div>
                        <p className="text-sm font-bold text-zinc-800">
                          {getDesktopWidgetTypeLabel(widget.type)}
                        </p>
                        <p className="text-[10px] text-zinc-500">尺寸: {widget.w}x{widget.h}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSettings({
                          ...settings,
                          widgets: settings.widgets.filter((w: WidgetConfig) => w.id !== widget.id)
                        });
                      }}
                      className="p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {editingWidgetId === widget.id && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-3 ml-4"
                    >
                      {/* Preview */}
                      <div className="flex justify-center py-2 bg-zinc-200/50 rounded-lg">
                        <div style={{ width: 160, height: (160 / widget.w) * widget.h }}>
                          <DesktopWidget widget={widget} isPreview={true} onWidgetChange={(updates) => handleWidgetUpdate(widget.id, updates)} />
                        </div>
                      </div>

                      <div className={`grid gap-3 ${getDesktopWidgetStyleOptions(widget.type).length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {widget.type !== 'profile-card' && (
                          <>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-500">组件类型</label>
                              <select 
                                value={widget.type}
                                onChange={(e) => {
                                  const nextType = e.target.value as SupportedDesktopWidgetType;
                                  handleWidgetUpdate(widget.id, {
                                    type: nextType,
                                    style: getDesktopWidgetStyleOptions(nextType)[0]?.value || 'default',
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                              >
                                {widgetTemplates.map(item => (
                                  <option key={item.type} value={item.type}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {getDesktopWidgetStyleOptions(widget.type).length > 1 && (
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500">组件样式</label>
                                <select 
                                  value={widget.style || getDesktopWidgetStyleOptions(widget.type)[0]?.value || 'default'}
                                  onChange={(e) => handleWidgetUpdate(widget.id, { style: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                                >
                                  {getDesktopWidgetStyleOptions(widget.type).map(option => (
                                    <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            )}
                          </>
                        )}
                      </div>

                      {widget.type === 'profile-card' && (
                        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-center">
                          <p className="text-sm font-semibold text-zinc-800">资料卡片默认 4x2</p>
                          <p className="mt-2 text-xs leading-5 text-zinc-500">
                            封面、头像、名字、昵称、签名、定位请直接回到手机主页点击该资料卡片修改，尺寸仍可在这里继续调整。
                          </p>
                        </div>
                      )}

                      {widget.type === 'anniversary' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500">标题</label>
                            <input 
                              type="text" 
                              value={widget.title || ''} 
                              onChange={(e) => handleWidgetUpdate(widget.id, { title: e.target.value })}
                              placeholder="例如: 在一起"
                              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500">日期</label>
                            <input 
                              type="date" 
                              value={widget.date || ''} 
                              onChange={(e) => handleWidgetUpdate(widget.id, { date: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      )}

                      <KawaiiWidgetCustomizationFields
                        widget={widget}
                        onUpdate={updates => handleWidgetUpdate(widget.id, updates)}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 flex justify-between">
                            <span>宽度 (W)</span>
                            <span>{widget.w}</span>
                          </label>
                          <input 
                            type="range" 
                            min="1" 
                            max="6" 
                            value={widget.w} 
                            onChange={(e) => handleWidgetUpdate(widget.id, { w: Number(e.target.value) })}
                            className="w-full accent-zinc-900"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 flex justify-between">
                            <span>高度 (H)</span>
                            <span>{widget.h}</span>
                          </label>
                          <input 
                            type="range" 
                            min="1" 
                            max="6" 
                            value={widget.h} 
                            onChange={(e) => handleWidgetUpdate(widget.id, { h: Number(e.target.value) })}
                            className="w-full accent-zinc-900"
                          />
                        </div>
                      </div>

                      {widget.type !== 'floating-time' && (
                        <>
                          <PersistentImageUploadControl
                            label="背景图片 (URL或上传)"
                            value={widget.background}
                            onChange={(val) => handleWidgetUpdate(widget.id, { background: val })}
                          />

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-500 flex justify-between">
                                <span>圆角</span>
                                <span>{widget.borderRadius !== undefined ? widget.borderRadius : 24}px</span>
                              </label>
                              <input 
                                type="range" 
                                min="0" 
                                max="40" 
                                value={widget.borderRadius !== undefined ? widget.borderRadius : 24} 
                                onChange={e => handleWidgetUpdate(widget.id, { borderRadius: Number(e.target.value) })} 
                                className="w-full accent-zinc-900" 
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-500 flex justify-between">
                                <span>不透明度</span>
                                <span>{widget.opacity !== undefined ? Math.round(widget.opacity * 100) : 100}%</span>
                              </label>
                              <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={widget.opacity !== undefined ? widget.opacity : 1} 
                                onChange={e => handleWidgetUpdate(widget.id, { opacity: Number(e.target.value) })} 
                                className="w-full accent-zinc-900" 
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <button
                        onClick={() => setEditingWidgetId(null)}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-100 py-2.5 text-xs font-bold text-zinc-900 shadow-sm transition-all hover:bg-zinc-200 active:scale-95"
                      >
                        确认添加 / 保存修改
                      </button>
                    </motion.div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'navbar' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">导航栏自定义</h3>
          <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50 h-28">
            {resolvedNavBarBackgroundUrl ? (
              <img src={resolvedNavBarBackgroundUrl} className="w-full h-full object-cover" alt="导航栏背景图" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">无背景图</div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-500">显示导航栏</label>
            <input
              type="checkbox"
              checked={settings.navBar.show}
              onChange={e => setSettings({ ...settings, navBar: { ...settings.navBar, show: e.target.checked } })}
              className="w-5 h-5 accent-zinc-900"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500">样式</label>
            <select
              value={settings.navBar.style}
              onChange={e => setSettings({ ...settings, navBar: { ...settings.navBar, style: e.target.value } })}
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
            >
              <option value="default">默认 (Glass)</option>
              <option value="glass">强力毛玻璃 (iOS Style)</option>
              <option value="minimal">极简 (无背景)</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500">形状</label>
            <select
              value={settings.navBar.shape}
              onChange={e => setSettings({ ...settings, navBar: { ...settings.navBar, shape: e.target.value } })}
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
            >
              <option value="pill">胶囊 (Pill)</option>
              <option value="rectangle">矩形 (Rectangle)</option>
              <option value="circle">圆形 (Circle)</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-500">显示多个头像</label>
            <input
              type="checkbox"
              checked={settings.navBar.showMultipleAvatars}
              onChange={e => setSettings({ ...settings, navBar: { ...settings.navBar, showMultipleAvatars: e.target.checked } })}
              className="w-5 h-5 accent-zinc-900"
            />
          </div>

          <PersistentImageUploadControl
            label="导航栏背景图"
            value={settings.navBar.backgroundImage || ''}
            onChange={(val) =>
              setSettings({
                ...settings,
                navBar: {
                  ...settings.navBar,
                  backgroundImage: val,
                },
              })
            }
          />

          <PersistentImageUploadControl
            label="导航栏专属头像"
            value={settings.navBar.avatar || ''}
            previewUrl={resolvedNavBarAvatarUrl || undefined}
            onChange={(val) =>
              setSettings({
                ...settings,
                navBar: {
                  ...settings.navBar,
                  avatar: val,
                },
              })
            }
          />

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">导航栏专属颜文字</label>
            <input
              type="text"
              value={settings.navBar.mood || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  navBar: {
                    ...settings.navBar,
                    mood: e.target.value,
                  },
                })
              }
              placeholder="留空则跟随主页颜文字"
              maxLength={24}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            导航栏头像和颜文字现在可以单独设置；留空时会继续跟随主页资料。
          </p>
        </div>
      )}

      {subTab === 'font' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">字体设置</h3>
          {selectedResolvedFont ? (
            <style>
              {`@font-face {
  font-family: "${selectedResolvedFont.familyName}";
  src: url("${selectedResolvedFont.resolvedUrl}");
  font-display: swap;
}`}
            </style>
          ) : null}

          <div className="rounded-[20px] border border-zinc-100 bg-zinc-50/80 p-4">
            <div className="text-[12px] font-bold text-zinc-500">字体预览</div>
            <div
              className="mt-3 rounded-[18px] border border-zinc-200 bg-white px-4 py-4 shadow-sm whitespace-pre-wrap"
              style={{
                fontFamily: previewFontFamily,
                fontSize: `${settings.desktop?.fontSize ?? 12}px`,
                color: settings.desktop?.fontColor ?? '#18181b',
                fontWeight:
                  (settings.desktop?.fontWeight || 'normal') === 'bold'
                    ? 'bold'
                    : (settings.desktop?.fontWeight || 'normal') === 'lighter'
                      ? 'lighter'
                      : 'normal',
              }}
            >
              {previewText}
            </div>
            <textarea
              value={previewText}
              onChange={e => updateTypography({ previewText: e.target.value })}
              placeholder="输入你想拿来预览这套字体的示例文字..."
              className="mt-3 min-h-[88px] w-full resize-y rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-[13px] text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">字体样式</label>
            <div className="grid grid-cols-2 gap-2">
              {['Inter', 'Serif', 'Mono', 'Cursive'].map(font => (
                <button
                  key={font}
                  onClick={() => setSettings({ ...settings, desktop: { ...settings.desktop, fontFamily: font } })}
                  className={`px-3 py-2 rounded-xl text-xs border ${
                    settings.desktop?.fontFamily === font
                      ? 'bg-zinc-100 border-zinc-900 text-zinc-900'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                  }`}
                  style={{ fontFamily: font === 'Mono' ? 'monospace' : font === 'Serif' ? 'serif' : font === 'Cursive' ? 'cursive' : 'sans-serif' }}
                >
                  {font}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-bold text-zinc-500">导入字体</label>
              <label className="cursor-pointer rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200">
                上传字体
                <input
                  type="file"
                  className="hidden"
                  accept=".ttf,.otf,.woff,.woff2,.ttc"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const source = await setUploadedFile(file);
                    const nextFont: ThemeFontAsset = {
                      id: `font-${Date.now()}`,
                      name: file.name.replace(/\.[^.]+$/, ''),
                      source,
                      format: file.name.split('.').pop()?.toLowerCase(),
                    };
                    updateTypography({
                      importedFonts: [...importedFonts, nextFont],
                      selectedFontId: nextFont.id,
                      fontPriority: typography.fontPriority || 'lock-imported',
                    });
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {importedFonts.length > 0 ? (
              <div className="space-y-2">
                {importedFonts.map(font => {
                  const isSelected = typography.selectedFontId === font.id;
                  return (
                    <div
                      key={font.id}
                      className={`flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3 ${
                        isSelected ? 'border-zinc-300 bg-zinc-100' : 'border-zinc-200 bg-zinc-50'
                      }`}
                    >
                      <button
                        onClick={() =>
                          updateTypography({
                            selectedFontId: font.id,
                            fontPriority: typography.fontPriority || 'lock-imported',
                          })
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <div
                          className="truncate text-[14px] font-semibold text-zinc-900"
                          style={{ fontFamily: `"${getThemeImportedFontFamily(font.id)}", sans-serif` }}
                        >
                          {font.name}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {font.format?.toUpperCase() || 'FONT'}
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          updateTypography({
                            importedFonts: importedFonts.filter(item => item.id !== font.id),
                            selectedFontId: typography.selectedFontId === font.id ? '' : typography.selectedFontId,
                          })
                        }
                        className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-rose-500 transition-colors hover:bg-rose-50"
                      >
                        删除
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 text-[12px] text-zinc-500">
                还没有导入字体。支持 `ttf / otf / woff / woff2 / ttc`。
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">字体优先级</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'css-only', label: '只用基础字', helper: '保留页面与 CSS 原有字体逻辑' },
                { value: 'imported-first', label: '导入优先', helper: '优先使用导入字体，但不强锁' },
                { value: 'lock-imported', label: '锁定导入', helper: '导入字体优先，不让样式覆盖' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => updateTypography({ fontPriority: option.value as 'css-only' | 'imported-first' | 'lock-imported' })}
                  className={`rounded-[18px] border px-3 py-3 text-left transition-all ${
                    effectiveFontPriority === option.value
                      ? 'border-zinc-300 bg-zinc-100 text-zinc-900 shadow-sm'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  }`}
                >
                  <div className="text-[12px] font-semibold">{option.label}</div>
                  <div className="mt-1 text-[11px] leading-5 text-zinc-500">{option.helper}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>字体大小</span>
              <span>{settings.desktop?.fontSize ?? 12}px</span>
            </label>
            <input
              type="range"
              min="10"
              max="20"
              value={settings.desktop?.fontSize ?? 12}
              onChange={e => setSettings({ ...settings, desktop: { ...settings.desktop, fontSize: Number(e.target.value) } })}
              className="w-full accent-zinc-900"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">字体颜色</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.desktop?.fontColor ?? '#18181b'}
                onChange={e => setSettings({ ...settings, desktop: { ...settings.desktop, fontColor: e.target.value } })}
                className="h-11 w-14 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1"
              />
              <input
                type="text"
                value={settings.desktop?.fontColor ?? '#18181b'}
                onChange={e => setSettings({ ...settings, desktop: { ...settings.desktop, fontColor: e.target.value } })}
                placeholder="#18181b"
                className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[13px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">字体粗细</label>
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              {['normal', 'bold', 'lighter'].map(weight => (
                <button
                  key={weight}
                  onClick={() => setSettings({ ...settings, desktop: { ...settings.desktop, fontWeight: weight } })}
                  className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
                    (settings.desktop?.fontWeight || 'normal') === weight
                      ? 'bg-white shadow-sm text-zinc-900 font-bold'
                      : 'text-zinc-500'
                  }`}
                >
                  {weight === 'normal' ? '标准' : weight === 'bold' ? '加粗' : '细体'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
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
  label = '导入 CSS',
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

function CharacterSelect({
  characters,
  selectedCharacterId,
  onChange,
  label = '选择角色',
}: {
  characters: Character[];
  selectedCharacterId: string;
  onChange: (nextValue: string) => void;
  label?: string;
}) {
  if (!characters.length) {
    return (
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-[12px] text-zinc-500">
        暂无可配置角色。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      <select
        value={selectedCharacterId}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
      >
        {characters.map((character) => (
          <option key={character.id} value={character.id}>
            {character.remarkName?.trim() || character.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ExpandableCard({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-zinc-50"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-800">{title}</div>
          {description ? <div className="mt-1 text-xs leading-5 text-zinc-500">{description}</div> : null}
        </div>
        <ChevronRight
          size={18}
          className={`shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open ? <div className="border-t border-zinc-100 px-4 py-4">{children}</div> : null}
    </div>
  );
}

function BubblePreviewAnchors() {
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute left-[-6px] top-[-6px] h-3 w-3 rounded-[4px] border border-zinc-400 bg-white" />
      <span aria-hidden="true" className="pointer-events-none absolute right-[-6px] top-[-6px] h-3 w-3 rounded-[4px] border border-zinc-400 bg-white" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-[-6px] left-[-6px] h-3 w-3 rounded-[4px] border border-zinc-400 bg-white" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-[-6px] right-[-6px] h-3 w-3 rounded-[4px] border border-zinc-400 bg-white" />
      <span aria-hidden="true" className="bubble-charm pointer-events-none absolute">
        <span aria-hidden="true" className="bubble-charm-string pointer-events-none absolute" />
        <span aria-hidden="true" className="bubble-charm-body pointer-events-none absolute">
          <span aria-hidden="true" className="bubble-charm-core pointer-events-none absolute" />
        </span>
      </span>
    </>
  );
}

function CharacterBubblePreview({
  settings,
  selectedCharacter,
}: {
  settings: VisualSettings;
  selectedCharacter: Character | null;
}) {
  const { resolvedUrl: resolvedCharacterBubbleImageUrl } = useResolvedPersistentValue(selectedCharacter?.bubbleImage || '');
  const { resolvedUrl: resolvedUserBubbleImageUrl } = useResolvedPersistentValue(selectedCharacter?.userBubbleImage || '');
  const previewBubbleScale = Math.min(1.3, Math.max(0.8, settings.chat?.bubbleScale ?? 1));
  const previewBubblePaddingX = 16 * previewBubbleScale;
  const previewBubblePaddingY = 8 * previewBubbleScale;
  const previewUserBubbleMaxWidth = `min(${Math.min(92, 70 + (previewBubbleScale - 1) * 18)}%, ${18 * previewBubbleScale}rem)`;
  const previewModelBubbleMaxWidth = `min(${Math.min(96, 82 + (previewBubbleScale - 1) * 18)}%, ${24 * previewBubbleScale}rem)`;

  const previewBubbleThemeCss = buildScopedBubbleThemeCss(settings.chat?.bubbleStyleCss, '.character-bubble-preview');
  const previewModelBubbleThemeCss = buildScopedBubbleVariantCss(settings.chat?.modelBubbleStyleCss, '.character-bubble-preview', '.bot-bubble');
  const previewUserBubbleThemeCss = buildScopedBubbleVariantCss(settings.chat?.userBubbleStyleCss, '.character-bubble-preview', '.user-bubble');
  const previewCharacterBubbleThemeCss = hasBubbleThemeCss(selectedCharacter?.bubbleStyleCss)
    ? buildScopedBubbleThemeCss(selectedCharacter?.bubbleStyleCss, '.character-bubble-preview')
    : buildScopedBubbleVariantCss(selectedCharacter?.bubbleStyleCss, '.character-bubble-preview', '.bot-bubble');
  const previewCharacterUserBubbleThemeCss = hasBubbleThemeCss(selectedCharacter?.userBubbleStyleCss)
    ? buildScopedBubbleThemeCss(selectedCharacter?.userBubbleStyleCss, '.character-bubble-preview')
    : buildScopedBubbleVariantCss(selectedCharacter?.userBubbleStyleCss, '.character-bubble-preview', '.user-bubble');

  const previewHasThemeCss = hasBubbleThemeCss(settings.chat?.bubbleStyleCss);
  const previewHasModelThemeCss = hasBubbleThemeCss(settings.chat?.modelBubbleStyleCss);
  const previewHasUserThemeCss = hasBubbleThemeCss(settings.chat?.userBubbleStyleCss);
  const previewHasCharacterThemeCss = hasBubbleThemeCss(selectedCharacter?.bubbleStyleCss);
  const previewHasCharacterUserThemeCss = hasBubbleThemeCss(selectedCharacter?.userBubbleStyleCss);

  const previewCommonBubbleStyle = parseBubbleStyleCss(settings.chat?.bubbleStyleCss);
  const previewModelBubbleStyle = {
    ...previewCommonBubbleStyle,
    ...parseBubbleStyleCss(settings.chat?.modelBubbleStyleCss),
    ...parseBubbleStyleCss(selectedCharacter?.bubbleStyleCss),
  };
  const previewUserBubbleStyle = {
    ...previewCommonBubbleStyle,
    ...parseBubbleStyleCss(settings.chat?.userBubbleStyleCss),
    ...parseBubbleStyleCss(selectedCharacter?.userBubbleStyleCss),
  };

  return (
    <div className="character-bubble-preview space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
      {(previewBubbleThemeCss
        || previewModelBubbleThemeCss
        || previewUserBubbleThemeCss
        || previewCharacterBubbleThemeCss
        || previewCharacterUserBubbleThemeCss) ? (
        <style>{[
          previewBubbleThemeCss,
          previewModelBubbleThemeCss,
          previewUserBubbleThemeCss,
          previewCharacterBubbleThemeCss,
          previewCharacterUserBubbleThemeCss,
        ].filter(Boolean).join('\n\n')}</style>
      ) : null}
      <div className="text-[11px] text-zinc-500">当前选中角色的实际预览</div>
      <div className="flex justify-start">
        <div
          style={{
            ...(previewHasThemeCss
              ? {}
              : {
                  borderRadius: settings.chat.messageBorderRadius,
                  ...(previewHasModelThemeCss || previewHasCharacterThemeCss ? {} : { backgroundColor: settings.chat.messageBackgroundColorModel }),
                }),
            ...(!previewHasThemeCss && !previewHasModelThemeCss && !previewHasCharacterThemeCss && selectedCharacter?.bubbleImage
              ? {
                  backgroundImage: `url(${getDisplayableAssetValue(selectedCharacter?.bubbleImage, resolvedCharacterBubbleImageUrl)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : !previewHasThemeCss && !previewHasModelThemeCss && !previewHasCharacterThemeCss && selectedCharacter?.bubbleColor
              ? {
                  backgroundColor: selectedCharacter.bubbleColor,
                  borderColor: selectedCharacter.bubbleColor,
                }
              : {}),
            ...previewModelBubbleStyle,
            paddingInline: `${previewBubblePaddingX}px`,
            paddingBlock: `${previewBubblePaddingY}px`,
            maxWidth: previewModelBubbleMaxWidth,
          }}
          className="chat-bubble message-bubble bot-bubble left chat-bubble-left relative border border-zinc-200 px-4 py-2 text-sm text-zinc-800"
        >
          <BubblePreviewAnchors />
          {selectedCharacter?.remarkName?.trim() || selectedCharacter?.name || '角色'} 的气泡预览
        </div>
      </div>
      <div className="flex justify-end">
        <div
          style={{
            ...(previewHasThemeCss
              ? {}
              : {
                  borderRadius: settings.chat.messageBorderRadius,
                  ...(previewHasUserThemeCss || previewHasCharacterUserThemeCss ? {} : { backgroundColor: settings.chat.messageBackgroundColorUser }),
                }),
            ...(!previewHasThemeCss && !previewHasUserThemeCss && !previewHasCharacterUserThemeCss && selectedCharacter?.userBubbleImage
              ? {
                  backgroundImage: `url(${getDisplayableAssetValue(selectedCharacter?.userBubbleImage, resolvedUserBubbleImageUrl)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : !previewHasThemeCss && !previewHasUserThemeCss && !previewHasCharacterUserThemeCss && selectedCharacter?.userBubbleColor
              ? {
                  backgroundColor: selectedCharacter.userBubbleColor,
                  borderColor: selectedCharacter.userBubbleColor,
                }
              : {}),
            ...previewUserBubbleStyle,
            paddingInline: `${previewBubblePaddingX}px`,
            paddingBlock: `${previewBubblePaddingY}px`,
            maxWidth: previewUserBubbleMaxWidth,
          }}
          className="chat-bubble message-bubble user-bubble right chat-bubble-right relative px-4 py-2 text-sm text-white"
        >
          <BubblePreviewAnchors />
          你和 {selectedCharacter?.remarkName?.trim() || selectedCharacter?.name || '角色'} 对话时的用户气泡
        </div>
      </div>
    </div>
  );
}

// --- Chat Settings ---
function ChatSettings({ settings, setSettings, subTab, setSubTab, appData, setAppData }: any) {
  const characters = Array.isArray(appData?.characters) ? appData.characters : [];
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(() => characters[0]?.id || '');
  const selectedCharacter = useMemo(
    () => characters.find((character: Character) => character.id === selectedCharacterId) || null,
    [characters, selectedCharacterId],
  );
  const typography = settings.themeTypography || {};
  const importedFonts: ThemeFontAsset[] = typography.importedFonts || [];
  const { resolvedFonts } = useResolvedThemeTypographyCss(typography);
  const selectedResolvedFont = resolvedFonts.find((font) => font.id === typography.selectedFontId);
  const { resolvedUrl: resolvedGlobalWallpaperUrl } = useResolvedPersistentValue(settings.globalBackground || '');
  const { resolvedUrl: resolvedDynamicsBackgroundUrl } = useResolvedPersistentValue(settings.dynamics?.background || '');
  const dynamicsBackgroundMode = settings.dynamics?.backgroundMode ?? 'fullscreen';
  const { resolvedUrl: resolvedChatBubbleBackgroundUrl } = useResolvedPersistentValue(settings.chat?.messageBackgroundImageUrl || '');
  const { resolvedUrl: resolvedChatBackgroundUrl } = useResolvedPersistentValue(settings.chat?.background || '');
  const { resolvedUrl: resolvedMusicTogetherBackgroundUrl } = useResolvedPersistentValue(settings.chat?.musicTogetherBackground || '');
  const activeMusicTogetherBackground = resolveMusicTogetherBackground({
    musicTogetherBackground: settings.chat?.musicTogetherBackground,
    resolvedMusicTogetherBackgroundUrl,
    globalBackground: settings.chat?.background,
    resolvedGlobalBackgroundUrl: resolvedChatBackgroundUrl,
  });
  const { resolvedUrl: resolvedSelectedCharacterAvatarUrl } = useResolvedPersistentValue(selectedCharacter?.avatar || '');
  const { resolvedUrl: resolvedSelectedUserAvatarUrl } = useResolvedPersistentValue(appData?.userProfile?.avatar || '');
  const previewAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(settings.chat?.avatarFrameCss, '.avatar-frame-preview-theme');
  const previewModelAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(settings.chat?.modelAvatarFrameCss, '.avatar-frame-preview-model');
  const previewUserAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(settings.chat?.userAvatarFrameCss, '.avatar-frame-preview-user');
  const previewCharacterAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(selectedCharacter?.avatarFrameCss, '.avatar-frame-preview-model');
  const previewCharacterUserAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(selectedCharacter?.userAvatarFrameCss, '.avatar-frame-preview-user');
  const dynamicsFontSuggestions = useMemo<FontFamilySuggestion[]>(() => {
    const presetOptions: FontFamilySuggestion[] = [
      { label: '系统无衬线', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
      { label: '中文衬线', value: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' },
      { label: '楷体', value: '"KaiTi", "STKaiti", "Kaiti SC", serif' },
      { label: '等宽', value: '"SFMono-Regular", "Consolas", "Liberation Mono", monospace' },
    ];
    const importedOptions = importedFonts.map((font) => ({
      label: `已导入 · ${font.name}`,
      value: `"${getThemeImportedFontFamily(font.id)}", "PingFang SC", "Microsoft YaHei", sans-serif`,
    }));

    const seenValues = new Set<string>();
    return [...importedOptions, ...presetOptions].filter((option) => {
      if (seenValues.has(option.value)) {
        return false;
      }
      seenValues.add(option.value);
      return true;
    });
  }, [importedFonts]);
  const dynamicsNamePreviewStyle = buildOptionalTextStyle(
    settings.dynamics?.profileNameColor,
    settings.dynamics?.profileNameFontFamily,
  );
  const dynamicsMoodPreviewStyle = buildOptionalTextStyle(
    settings.dynamics?.profileMoodColor,
    settings.dynamics?.profileMoodFontFamily,
  );
  const dynamicsFontFollowHint = getThemeSelectedFontStack(typography)
    ? `留空时会跟随全局主题字体：${selectedResolvedFont?.name || '已导入字体'}。`
    : '留空时会沿用页面当前默认字体，不会单独新开一套。';

  useEffect(() => {
    if (!characters.length) {
      if (selectedCharacterId) {
        setSelectedCharacterId('');
      }
      return;
    }

    if (!characters.some((character: Character) => character.id === selectedCharacterId)) {
      setSelectedCharacterId(characters[0]?.id || '');
    }
  }, [characters, selectedCharacterId]);

  const patchSelectedCharacter = (patch: Partial<Character>) => {
    if (!selectedCharacter || typeof setAppData !== 'function') {
      return;
    }

    setAppData({
      ...appData,
      characters: characters.map((character: Character) => (
        character.id === selectedCharacter.id
          ? { ...character, ...patch }
          : character
      )),
    });
  };
  const resetSelectedCharacterRoleBubble = () => {
    patchSelectedCharacter({
      bubbleStyleCss: '',
      bubbleColor: undefined,
      bubbleImage: undefined,
    });
  };
  const resetSelectedCharacterUserBubble = () => {
    patchSelectedCharacter({
      userBubbleStyleCss: '',
      userBubbleColor: undefined,
      userBubbleImage: undefined,
    });
  };
  const headerStyles = [
    { value: 'default', label: '默认' },
    { value: 'glass', label: '毛玻璃' },
    { value: 'solid', label: '纯色' },
    { value: 'transparent', label: '透明' }
  ];
  const footerStyles = [
    { value: 'default', label: '默认' },
    { value: 'glass', label: '毛玻璃' },
    { value: 'solid', label: '纯色' },
    { value: 'transparent', label: '透明' }
  ];
  const updateDynamics = (patch: Partial<VisualSettings['dynamics']>) =>
    setSettings({
      ...settings,
      dynamics: {
        ...settings.dynamics,
        ...patch,
      },
    });
  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['avatar', 'bubble', 'background', 'interface', 'dynamics'].map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              subTab === tab ? 'border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm' : 'bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            {tab === 'avatar' && '头像微调'}
            {tab === 'bubble' && '消息边框'}
            {tab === 'background' && '聊天背景'}
            {tab === 'interface' && '界面显示'}
            {tab === 'dynamics' && '动态页面'}
          </button>
        ))}
      </div>

      {subTab === 'avatar' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">头像设置</h3>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <CharacterSelect
              characters={characters}
              selectedCharacterId={selectedCharacterId}
              onChange={setSelectedCharacterId}
              label="当前预览角色"
            />
          </div>
          <div className="flex justify-center py-4 relative">
            {(previewAvatarFrameThemeCss
              || previewModelAvatarFrameThemeCss
              || previewUserAvatarFrameThemeCss
              || previewCharacterAvatarFrameThemeCss
              || previewCharacterUserAvatarFrameThemeCss) ? (
              <style>{[
                previewAvatarFrameThemeCss,
                previewModelAvatarFrameThemeCss,
                previewUserAvatarFrameThemeCss,
                previewCharacterAvatarFrameThemeCss,
                previewCharacterUserAvatarFrameThemeCss,
              ].filter(Boolean).join('\n\n')}</style>
            ) : null}
            <div className="flex items-center justify-center gap-10">
              <div className="flex flex-col items-center gap-2">
                <AvatarFrame
                  src={getDisplayableAssetValue(selectedCharacter?.avatar, resolvedSelectedCharacterAvatarUrl) || 'https://picsum.photos/seed/model-preview/100'}
                  alt="角色头像框预览"
                  size={settings.chat.avatarSize}
                  borderRadius={settings.chat.avatarBorderRadius}
                  borderWidth={settings.chat.avatarBorderWidth}
                  borderColor={settings.chat.avatarBorderColor}
                  scopeClassName="avatar-frame-preview-theme avatar-frame-preview-model"
                />
                <span className="text-[11px] text-zinc-500">角色</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <AvatarFrame
                  src={getDisplayableAssetValue(appData?.userProfile?.avatar, resolvedSelectedUserAvatarUrl) || 'https://picsum.photos/seed/user-preview/100'}
                  alt="用户头像框预览"
                  size={settings.chat.avatarSize}
                  borderRadius={settings.chat.avatarBorderRadius}
                  borderWidth={settings.chat.avatarBorderWidth}
                  borderColor={settings.chat.avatarBorderColor}
                  scopeClassName="avatar-frame-preview-theme avatar-frame-preview-user"
                />
                <span className="text-[11px] text-zinc-500">用户</span>
              </div>
            </div>
          </div>

          <ExpandableCard
            title="公共头像框 CSS"
            description="角色和用户都会先应用这层基础样式。"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-xs leading-5 text-zinc-500">
                  下面的“角色头像框 CSS”和“用户头像框 CSS”会在它上面继续覆盖。
                </div>
                <ImportStyleButton
                  onImport={(content) => setSettings({ ...settings, chat: { ...settings.chat, avatarFrameCss: content } })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_FRAME_THEME_TARGETS.map((target) => (
                  <span key={target} className="rounded-full bg-white px-3 py-1 text-[11px] text-zinc-600 shadow-sm ring-1 ring-zinc-100">
                    {target}
                  </span>
                ))}
              </div>
              <CodeEditor
                value={settings.chat.avatarFrameCss || ''}
                onChange={(nextValue) => setSettings({ ...settings, chat: { ...settings.chat, avatarFrameCss: nextValue } })}
                placeholder={'.avatar-frame-shell {\n  padding: 12%;\n  border-radius: calc(var(--avatar-frame-radius) + 8px);\n  background: linear-gradient(180deg, #f7fbef 0%, #edf6e2 100%);\n}\n\n.avatar-frame-media {\n  border-radius: 999px;\n  box-shadow: 0 0 0 3px rgba(255,255,255,0.92), 0 0 0 6px rgba(185,212,163,0.92);\n}'}
                heightClass="h-64"
              />
              <div className="text-[11px] leading-5 text-zinc-500">
                直接写 `padding: 12%; background: ...;` 也可以，系统会自动把它包到 `.avatar-frame-shell` 上。
              </div>
              {settings.chat.avatarFrameCss?.trim() && (
                <button
                  onClick={() => setSettings({ ...settings, chat: { ...settings.chat, avatarFrameCss: '' } })}
                  className="text-[12px] font-medium text-rose-500"
                >
                  清除公共头像框 CSS
                </button>
              )}
            </div>
          </ExpandableCard>

          <ExpandableCard
            title="全局角色/用户头像框"
            description="分别控制所有聊天里的角色头像框和用户头像框。"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-zinc-800">角色头像框 CSS</div>
                    <p className="text-xs leading-5 text-zinc-500">
                      只作用在所有聊天里的角色头像，不会碰用户头像。
                    </p>
                  </div>
                  <ImportStyleButton
                    onImport={(content) => setSettings({ ...settings, chat: { ...settings.chat, modelAvatarFrameCss: content } })}
                  />
                </div>
                <CodeEditor
                  value={settings.chat.modelAvatarFrameCss || ''}
                  onChange={(nextValue) => setSettings({ ...settings, chat: { ...settings.chat, modelAvatarFrameCss: nextValue } })}
                  placeholder={'.avatar-frame-shell {\n  background: linear-gradient(180deg, #f7fbef 0%, #edf6e2 100%);\n}\n\n.avatar-frame-clover {\n  display: block;\n}'}
                  heightClass="h-44"
                />
                {settings.chat.modelAvatarFrameCss?.trim() && (
                  <button
                    onClick={() => setSettings({ ...settings, chat: { ...settings.chat, modelAvatarFrameCss: '' } })}
                    className="text-[12px] font-medium text-rose-500"
                  >
                    清除角色头像框 CSS
                  </button>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-zinc-800">用户头像框 CSS</div>
                    <p className="text-xs leading-5 text-zinc-500">
                      只作用在所有聊天里的用户头像，不会碰角色头像。
                    </p>
                  </div>
                  <ImportStyleButton
                    onImport={(content) => setSettings({ ...settings, chat: { ...settings.chat, userAvatarFrameCss: content } })}
                  />
                </div>
                <CodeEditor
                  value={settings.chat.userAvatarFrameCss || ''}
                  onChange={(nextValue) => setSettings({ ...settings, chat: { ...settings.chat, userAvatarFrameCss: nextValue } })}
                  placeholder={'.avatar-frame-shell {\n  background: linear-gradient(180deg, #fff6f7 0%, #ffe9f0 100%);\n}\n\n.avatar-frame-heart {\n  display: block;\n}'}
                  heightClass="h-44"
                />
                {settings.chat.userAvatarFrameCss?.trim() && (
                  <button
                    onClick={() => setSettings({ ...settings, chat: { ...settings.chat, userAvatarFrameCss: '' } })}
                    className="text-[12px] font-medium text-rose-500"
                  >
                    清除用户头像框 CSS
                  </button>
                )}
              </div>
            </div>
          </ExpandableCard>

          <ExpandableCard
            title="当前角色专属头像框"
            description="切换角色后编辑该角色自己的头像框，单聊和群聊都会读。"
          >
            <div className="space-y-3">
              <CharacterSelect
                characters={characters}
                selectedCharacterId={selectedCharacterId}
                onChange={setSelectedCharacterId}
              />
              {selectedCharacter && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-zinc-800">{selectedCharacter.remarkName?.trim() || selectedCharacter.name} 角色头像框</div>
                        <p className="text-xs leading-5 text-zinc-500">覆盖这个角色自己的头像框。</p>
                      </div>
                      <ImportStyleButton onImport={(content) => patchSelectedCharacter({ avatarFrameCss: content })} />
                    </div>
                    <CodeEditor
                      value={selectedCharacter.avatarFrameCss || ''}
                      onChange={(nextValue) => patchSelectedCharacter({ avatarFrameCss: nextValue })}
                      placeholder={'.avatar-frame-shell {\n  background: linear-gradient(180deg, #f7fbef 0%, #edf6e2 100%);\n}'}
                      heightClass="h-44"
                    />
                    {selectedCharacter.avatarFrameCss?.trim() && (
                      <button
                        onClick={() => patchSelectedCharacter({ avatarFrameCss: '' })}
                        className="text-[12px] font-medium text-rose-500"
                      >
                        清除该角色头像框 CSS
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-zinc-800">{selectedCharacter.remarkName?.trim() || selectedCharacter.name} 对话里的用户头像框</div>
                        <p className="text-xs leading-5 text-zinc-500">只影响你和这个角色单聊时的用户头像框，不会影响别的角色。</p>
                      </div>
                      <ImportStyleButton onImport={(content) => patchSelectedCharacter({ userAvatarFrameCss: content })} />
                    </div>
                    <CodeEditor
                      value={selectedCharacter.userAvatarFrameCss || ''}
                      onChange={(nextValue) => patchSelectedCharacter({ userAvatarFrameCss: nextValue })}
                      placeholder={'.avatar-frame-shell {\n  background: linear-gradient(180deg, #fff6f7 0%, #ffe9f0 100%);\n}'}
                      heightClass="h-44"
                    />
                    {selectedCharacter.userAvatarFrameCss?.trim() && (
                      <button
                        onClick={() => patchSelectedCharacter({ userAvatarFrameCss: '' })}
                        className="text-[12px] font-medium text-rose-500"
                      >
                        清除该角色用户头像框 CSS
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ExpandableCard>

          <div className="text-[11px] leading-5 text-zinc-500">
            A 角色和 B 角色的专属头像框现在都可以直接在这里切换角色后编辑，不需要再去聊天设置页。
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>大小</span>
              <span>{settings.chat.avatarSize}px</span>
            </label>
            <input type="range" min="20" max="80" value={settings.chat.avatarSize} onChange={e => setSettings({...settings, chat: {...settings.chat, avatarSize: Number(e.target.value)}})} className="w-full accent-zinc-900" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>圆角</span>
              <span>{settings.chat.avatarBorderRadius}px</span>
            </label>
            <input type="range" min="0" max="40" value={settings.chat.avatarBorderRadius} onChange={e => setSettings({...settings, chat: {...settings.chat, avatarBorderRadius: Number(e.target.value)}})} className="w-full accent-zinc-900" />
          </div>
        </div>
      )}

      {subTab === 'bubble' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-zinc-100 bg-white p-5 shadow-sm">
            <CharacterSelect
              characters={characters}
              selectedCharacterId={selectedCharacterId}
              onChange={setSelectedCharacterId}
              label="当前预览角色"
            />
          </div>
          <ExpandableCard
            title="全局主题气泡"
            description="默认折叠。展开后编辑全局消息边框、角色/用户气泡和目标对象样式。"
          >
            <ChatBubbleThemeCustomizationSection settings={settings} setSettings={setSettings} />
          </ExpandableCard>

          <ExpandableCard
            title="当前角色专属气泡"
            description="切换角色后编辑该角色自己的气泡。恢复后会自动回退到全局主题气泡。"
          >
            <div className="space-y-4">
              <CharacterSelect
                characters={characters}
                selectedCharacterId={selectedCharacterId}
                onChange={setSelectedCharacterId}
              />

              {selectedCharacter ? <CharacterBubblePreview settings={settings} selectedCharacter={selectedCharacter} /> : null}

              {selectedCharacter && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                    <div className="text-sm font-semibold text-zinc-800">{selectedCharacter.remarkName?.trim() || selectedCharacter.name} 角色气泡</div>
                    <div className="text-[12px] leading-5 text-zinc-500">
                      设置后优先使用这个角色自己的气泡；恢复后自动回退到主题页里的全局角色气泡。
                    </div>
                    <PersistentImageUploadControl
                      label="角色气泡图片"
                      value={selectedCharacter.bubbleImage || ''}
                      onChange={(val) => patchSelectedCharacter({ bubbleImage: val || undefined })}
                    />
                    <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white px-3 py-3">
                      <span className="text-[13px] text-zinc-600">角色气泡颜色</span>
                      <div className="flex items-center gap-3">
                        {selectedCharacter.bubbleColor && (
                          <button
                            onClick={() => patchSelectedCharacter({ bubbleColor: undefined })}
                            className="text-[12px] font-medium text-amber-600"
                          >
                            清除颜色
                          </button>
                        )}
                        <input
                          type="color"
                          value={selectedCharacter.bubbleColor || '#ffffff'}
                          onChange={(e) => patchSelectedCharacter({ bubbleColor: e.target.value })}
                          className="h-7 w-7 cursor-pointer rounded overflow-hidden border-none bg-transparent p-0"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-medium text-zinc-700">角色气泡 CSS</div>
                          <div className="text-[12px] text-zinc-500">只覆盖这个角色发出的气泡，单聊和群聊都会读。</div>
                        </div>
                        <ImportStyleButton onImport={(content) => patchSelectedCharacter({ bubbleStyleCss: content })} />
                      </div>
                      <CodeEditor
                        value={selectedCharacter.bubbleStyleCss || ''}
                        onChange={(nextValue) => patchSelectedCharacter({ bubbleStyleCss: nextValue })}
                        placeholder={'border-radius: 24px;\nbox-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);\nborder: 1px solid rgba(255, 255, 255, 0.65);'}
                        heightClass="h-44"
                      />
                      {selectedCharacter.bubbleStyleCss?.trim() && (
                        <button
                          onClick={() => patchSelectedCharacter({ bubbleStyleCss: '' })}
                          className="text-[12px] font-medium text-rose-500"
                        >
                          清除该角色气泡 CSS
                        </button>
                      )}
                      {(selectedCharacter.bubbleStyleCss?.trim() || selectedCharacter.bubbleColor || selectedCharacter.bubbleImage) && (
                        <button
                          onClick={resetSelectedCharacterRoleBubble}
                          className="text-[12px] font-medium text-zinc-500"
                        >
                          恢复主题气泡
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                    <div className="text-sm font-semibold text-zinc-800">你和 {selectedCharacter.remarkName?.trim() || selectedCharacter.name} 对话时的用户气泡</div>
                    <div className="text-[12px] leading-5 text-zinc-500">
                      设置后优先使用这个角色单聊里的用户气泡；恢复后自动回退到主题页里的全局用户气泡。
                    </div>
                    <PersistentImageUploadControl
                      label="用户气泡图片"
                      value={selectedCharacter.userBubbleImage || ''}
                      onChange={(val) => patchSelectedCharacter({ userBubbleImage: val || undefined })}
                    />
                    <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white px-3 py-3">
                      <span className="text-[13px] text-zinc-600">用户气泡颜色</span>
                      <div className="flex items-center gap-3">
                        {selectedCharacter.userBubbleColor && (
                          <button
                            onClick={() => patchSelectedCharacter({ userBubbleColor: undefined })}
                            className="text-[12px] font-medium text-amber-600"
                          >
                            清除颜色
                          </button>
                        )}
                        <input
                          type="color"
                          value={selectedCharacter.userBubbleColor || '#3b82f6'}
                          onChange={(e) => patchSelectedCharacter({ userBubbleColor: e.target.value })}
                          className="h-7 w-7 cursor-pointer rounded overflow-hidden border-none bg-transparent p-0"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-medium text-zinc-700">用户气泡 CSS</div>
                          <div className="text-[12px] text-zinc-500">只覆盖你和这个角色单聊时自己发出的气泡，不影响别的角色。</div>
                        </div>
                        <ImportStyleButton onImport={(content) => patchSelectedCharacter({ userBubbleStyleCss: content })} />
                      </div>
                      <CodeEditor
                        value={selectedCharacter.userBubbleStyleCss || ''}
                        onChange={(nextValue) => patchSelectedCharacter({ userBubbleStyleCss: nextValue })}
                        placeholder={'border-radius: 24px;\nbox-shadow: 0 12px 30px rgba(59, 130, 246, 0.18);\nborder: 1px solid rgba(255, 255, 255, 0.35);'}
                        heightClass="h-44"
                      />
                      {selectedCharacter.userBubbleStyleCss?.trim() && (
                        <button
                          onClick={() => patchSelectedCharacter({ userBubbleStyleCss: '' })}
                          className="text-[12px] font-medium text-rose-500"
                        >
                          清除该角色用户气泡 CSS
                        </button>
                      )}
                      {(selectedCharacter.userBubbleStyleCss?.trim() || selectedCharacter.userBubbleColor || selectedCharacter.userBubbleImage) && (
                        <button
                          onClick={resetSelectedCharacterUserBubble}
                          className="text-[12px] font-medium text-zinc-500"
                        >
                          恢复主题气泡
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ExpandableCard>
        </div>
      )}

      {subTab === 'background' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-800">全局聊天壁纸</h3>
            <div className="aspect-[9/16] w-32 mx-auto bg-zinc-100 rounded-2xl overflow-hidden border-4 border-zinc-800 relative shadow-lg">
              {resolvedChatBackgroundUrl ? (
                <img src={resolvedChatBackgroundUrl} className="w-full h-full object-cover" alt="Wallpaper" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">无壁纸</div>
              )}
            </div>
            <PersistentImageUploadControl 
              label="壁纸图片" 
              value={settings.chat.background || ''} 
              onChange={(val) => setSettings({ ...settings, chat: { ...settings.chat, background: val } })} 
            />
            <p className="text-xs text-zinc-400 text-center">设置所有聊天界面的默认背景壁纸。如果角色设置了专属壁纸，将优先显示专属壁纸。</p>
          </div>

          <div className="space-y-4 border-t border-zinc-100 pt-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-zinc-800">一起听聊天壁纸</h4>
              <p className="text-xs leading-5 text-zinc-500">
                只作用在“一起听聊天”界面；留空时会跟随上面的全局聊天壁纸。
              </p>
            </div>
            <div className="aspect-[9/16] w-32 mx-auto bg-zinc-100 rounded-2xl overflow-hidden border-4 border-zinc-800 relative shadow-lg">
              {activeMusicTogetherBackground ? (
                <img src={activeMusicTogetherBackground} className="w-full h-full object-cover" alt="Music together wallpaper" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  未设置壁纸
                </div>
              )}
            </div>
            <PersistentImageUploadControl
              label="一起听壁纸图片"
              value={settings.chat.musicTogetherBackground || ''}
              onChange={(val) => setSettings({
                ...settings,
                chat: {
                  ...settings.chat,
                  musicTogetherBackground: val,
                },
              })}
            />
            <p className="text-xs text-zinc-400 text-center">
              {settings.chat.musicTogetherBackground?.trim()
                ? '现在只会改动一起听聊天背景，不会影响普通单聊。'
                : '当前未单独设置时，会直接沿用全局聊天壁纸。'}
            </p>
          </div>
          
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>聊天气泡透明度</span>
              <span>{Math.round((settings.chatOpacity ?? 1) * 100)}%</span>
            </label>
            <input 
              type="range" 
              min="0" max="1" step="0.1" 
              value={settings.chatOpacity ?? 1}
              onChange={(e) => setSettings({ ...settings, chatOpacity: parseFloat(e.target.value) })}
              className="w-full accent-zinc-900"
            />
          </div>
        </div>
      )}

      {subTab === 'interface' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">界面显示</h3>
          
          {/* Interface Preview */}
          <div className="bg-zinc-100 rounded-2xl p-4 flex justify-center overflow-hidden">
            <div 
              className="w-48 h-64 bg-white shadow-sm overflow-hidden relative flex flex-col origin-top"
              style={{ 
                borderRadius: 24,
                transform: `scale(${settings.chat?.uiScale ?? 1})`,
                transformOrigin: 'top center',
                marginBottom: (settings.chat?.uiScale ?? 1) > 1 ? (settings.chat?.uiScale - 1) * 256 : 0
              }}
            >
              {/* Mock Header */}
              <div className={`h-12 flex items-center px-3 gap-2 shrink-0 z-10 ${
                (settings.chat?.headerStyle || 'default') === 'glass' ? 'bg-white/80 backdrop-blur-md border-b border-zinc-100/50' :
                (settings.chat?.headerStyle || 'default') === 'solid' ? 'bg-zinc-100' :
                (settings.chat?.headerStyle || 'default') === 'transparent' ? 'bg-transparent' :
                'bg-white border-b border-zinc-100'
              }`}>
                <div className="w-6 h-6 rounded-full bg-zinc-200"></div>
                <div className="h-3 w-16 bg-zinc-200 rounded-full"></div>
              </div>
              
              {/* Mock Body */}
              <div className="flex-1 bg-zinc-50 p-3 space-y-3 overflow-hidden">
                <div className="flex gap-2">
                   <div className="w-6 h-6 rounded-full bg-zinc-200 shrink-0"></div>
                   <div 
                     className="bg-white p-2 rounded-2xl rounded-tl-none shadow-sm text-zinc-600"
                     style={{ fontSize: settings.chat?.fontSize ?? 14 }}
                   >
                     预览字体大小
                   </div>
                </div>
                <div className="flex gap-2 flex-row-reverse">
                   <div 
                     className="rounded-2xl rounded-tr-none border border-zinc-200 bg-zinc-100 p-2 text-zinc-900 shadow-sm"
                     style={{ fontSize: settings.chat?.fontSize ?? 14 }}
                   >
                     界面缩放预览
                   </div>
                </div>
              </div>

              <div className={`h-14 flex items-center gap-2 px-3 shrink-0 ${
                (settings.chat?.footerStyle || 'default') === 'glass' ? 'bg-white/80 backdrop-blur-md border-t border-zinc-100/50' :
                (settings.chat?.footerStyle || 'default') === 'solid' ? 'bg-zinc-100 border-t border-zinc-200' :
                (settings.chat?.footerStyle || 'default') === 'transparent' ? 'bg-transparent border-t border-transparent' :
                'bg-white border-t border-zinc-100'
              }`}>
                <div className="w-8 h-8 rounded-full bg-zinc-200 shrink-0" />
                <div className={`flex-1 h-9 rounded-full border ${
                  (settings.chat?.footerStyle || 'default') === 'transparent'
                    ? 'bg-white/70 border-white/40'
                    : (settings.chat?.footerStyle || 'default') === 'glass'
                      ? 'bg-white/80 border-white/50'
                      : (settings.chat?.footerStyle || 'default') === 'solid'
                        ? 'bg-white border-zinc-200'
                        : 'bg-zinc-50 border-zinc-100'
                }`} />
                <div className="w-8 h-8 rounded-full bg-zinc-200 shrink-0" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500">聊天导航栏样式</label>
            <div className="grid grid-cols-2 gap-2">
              {headerStyles.map(style => (
                <button
                  key={style.value}
                  onClick={() => setSettings({ 
                    ...settings, 
                    chat: { ...settings.chat, headerStyle: style.value as any } 
                  })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                    (settings.chat?.headerStyle || 'default') === style.value 
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm' 
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500">底部栏样式</label>
            <div className="grid grid-cols-2 gap-2">
              {footerStyles.map(style => (
                <button
                  key={style.value}
                  onClick={() => setSettings({
                    ...settings,
                    chat: { ...settings.chat, footerStyle: style.value as any }
                  })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                    (settings.chat?.footerStyle || 'default') === style.value
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>界面缩放</span>
              <span>{((settings.chat?.uiScale ?? 1) * 100).toFixed(0)}%</span>
            </label>
            <input 
              type="range" 
              min="0.8" 
              max="1.2" 
              step="0.05" 
              value={settings.chat?.uiScale ?? 1}
              onChange={(e) => setSettings({
                ...settings,
                chat: { ...settings.chat, uiScale: parseFloat(e.target.value) }
              })}
              className="w-full accent-zinc-900"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>文字大小</span>
              <span>{settings.chat?.fontSize ?? 14}px</span>
            </label>
            <input 
              type="range" 
              min="12" 
              max="20" 
              step="1" 
              value={settings.chat?.fontSize ?? 14}
              onChange={(e) => setSettings({
                ...settings,
                chat: { ...settings.chat, fontSize: parseInt(e.target.value) }
              })}
              className="w-full accent-zinc-900"
            />
          </div>
        </div>
      )}

      {subTab === 'dynamics' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">动态页面设置</h3>
          
          {/* Dynamics Preview */}
          <div className="bg-zinc-100 rounded-2xl p-4 flex justify-center">
            <div className="relative w-48 aspect-[3/4] overflow-hidden rounded-2xl bg-[#f7f7f8] shadow-sm">
              <div className="absolute inset-0 bg-zinc-100">
                {resolvedGlobalWallpaperUrl && !resolvedDynamicsBackgroundUrl && (
                  <img src={resolvedGlobalWallpaperUrl} className="w-full h-full object-cover opacity-25" alt="Wallpaper" />
                )}
                {dynamicsBackgroundMode === 'fullscreen' && resolvedDynamicsBackgroundUrl && (
                  <img src={resolvedDynamicsBackgroundUrl} className="w-full h-full object-cover" alt="Dynamics Background" />
                )}
              </div>

              <div className="absolute inset-x-0 top-0 h-[42%] overflow-hidden">
                {dynamicsBackgroundMode === 'header' && resolvedDynamicsBackgroundUrl ? (
                  <img src={resolvedDynamicsBackgroundUrl} className="w-full h-full object-cover" alt="Dynamics Header Background" />
                ) : !resolvedDynamicsBackgroundUrl ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600" />
                ) : null}
              </div>

              <div className="absolute right-3 top-3 flex gap-2">
                <div className="h-8 w-8 rounded-full border border-white/30 bg-white/30 backdrop-blur-sm" />
                <div className="h-8 w-8 rounded-full border border-white/30 bg-white/30 backdrop-blur-sm" />
              </div>

              <div className="absolute left-4 right-4 top-[31%] z-10 flex items-end gap-2">
                <div className="h-12 w-12 shrink-0 rounded-2xl border-2 border-white bg-zinc-200 shadow-sm">
                  {resolvedSelectedUserAvatarUrl ? (
                    <img src={resolvedSelectedUserAvatarUrl} className="h-full w-full rounded-[14px] object-cover" alt="User Avatar" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[11px] font-bold text-zinc-900" style={dynamicsNamePreviewStyle}>
                      {appData?.userProfile?.name || 'AI 用户'}
                    </div>
                    <span
                      className="max-w-[72px] truncate rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-zinc-600 shadow-sm"
                      style={dynamicsMoodPreviewStyle}
                    >
                      {(appData?.userProfile?.mood || '(^_^)').slice(0, 18)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-20 rounded-full bg-white/80" />
                </div>
              </div>

              <div className="absolute inset-x-4 bottom-4 top-[50%]">
                <div
                  className="relative h-full overflow-hidden p-3 backdrop-blur-sm"
                  style={{
                    backgroundColor: `rgba(255,255,255,${settings.dynamics?.cardOpacity ?? 0.9})`,
                    borderRadius: settings.dynamics?.cardBorderRadius ?? 24,
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-zinc-200" />
                    <div className="h-2 w-12 rounded-full bg-zinc-200" />
                  </div>
                  <div className="mb-1 h-2 w-full rounded-full bg-zinc-100/80" />
                  <div className="h-2 w-2/3 rounded-full bg-zinc-100/80" />
                </div>
              </div>
            </div>
          </div>

          <PersistentImageUploadControl 
            label="背景图片" 
            value={settings.dynamics?.background || ''} 
            onChange={(val) => setSettings({ 
              ...settings, 
              dynamics: { ...settings.dynamics, background: val },
              momentsBackground: val 
            })} 
          />
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-[12px] leading-relaxed text-zinc-500">
            资料头里的名字和颜文字默认跟随全局主题字体；只有下面填了颜色或字体，才会只覆盖动态页这一块。
            <div className="mt-1 text-[11px] text-zinc-400">{dynamicsFontFollowHint}</div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">背景范围</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettings({
                  ...settings,
                  dynamics: { ...settings.dynamics, backgroundMode: 'fullscreen' }
                })}
                className={`rounded-2xl border px-3 py-2 text-sm font-medium transition-colors ${
                  dynamicsBackgroundMode === 'fullscreen'
                    ? 'border-zinc-300 bg-zinc-100 text-zinc-800 shadow-sm'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                全屏
              </button>
              <button
                type="button"
                onClick={() => setSettings({
                  ...settings,
                  dynamics: { ...settings.dynamics, backgroundMode: 'header' }
                })}
                className={`rounded-2xl border px-3 py-2 text-sm font-medium transition-colors ${
                  dynamicsBackgroundMode === 'header'
                    ? 'border-zinc-300 bg-zinc-100 text-zinc-800 shadow-sm'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                顶部半屏
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              全屏会铺满整个动态页，顶部半屏只替换上方封面区域。
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>卡片圆角</span>
              <span>{settings.dynamics?.cardBorderRadius ?? 24}px</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="40" 
              value={settings.dynamics?.cardBorderRadius ?? 24} 
              onChange={e => setSettings({
                ...settings, 
                dynamics: { ...settings.dynamics, cardBorderRadius: Number(e.target.value) }
              })} 
              className="w-full accent-zinc-900" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 flex justify-between">
              <span>卡片透明度</span>
              <span>{((settings.dynamics?.cardOpacity ?? 0.9) * 100).toFixed(0)}%</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={settings.dynamics?.cardOpacity ?? 0.9} 
              onChange={e => setSettings({
                ...settings, 
                dynamics: { ...settings.dynamics, cardOpacity: Number(e.target.value) }
              })} 
              className="w-full accent-zinc-900" 
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-3 rounded-[20px] border border-zinc-100 bg-zinc-50/70 p-4">
              <div>
                <div className="text-[13px] font-bold text-zinc-800">名字样式</div>
                <div className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                  对应动态页里颜文字左边这行名字。
                </div>
              </div>
              <OptionalColorInput
                label="名字颜色"
                value={settings.dynamics?.profileNameColor}
                onChange={(value) => updateDynamics({ profileNameColor: value })}
                fallback="#18181b"
              />
              <OptionalFontFamilyInput
                label="名字字体"
                value={settings.dynamics?.profileNameFontFamily}
                onChange={(value) => updateDynamics({ profileNameFontFamily: value })}
                listId="dynamics-name-font-family-options"
                suggestions={dynamicsFontSuggestions}
              />
            </div>

            <div className="space-y-3 rounded-[20px] border border-zinc-100 bg-zinc-50/70 p-4">
              <div>
                <div className="text-[13px] font-bold text-zinc-800">颜文字样式</div>
                <div className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                  留空时会继续跟随外面的全局字体和默认颜色。
                </div>
              </div>
              <OptionalColorInput
                label="颜文字颜色"
                value={settings.dynamics?.profileMoodColor}
                onChange={(value) => updateDynamics({ profileMoodColor: value })}
                fallback="#52525b"
              />
              <OptionalFontFamilyInput
                label="颜文字字体"
                value={settings.dynamics?.profileMoodFontFamily}
                onChange={(value) => updateDynamics({ profileMoodFontFamily: value })}
                listId="dynamics-mood-font-family-options"
                suggestions={dynamicsFontSuggestions}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Data Settings ---
function DataSettings({ onReset, appData, setAppData, settings, setSettings }: any) {
  const [activeTab, setActiveTab] = useState<'chat' | 'profile' | 'world' | 'apps'>('chat');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressText, setImportProgressText] = useState('');
  const [isExportingFull, setIsExportingFull] = useState(false);
  const [isExportingSelected, setIsExportingSelected] = useState(false);
  const [isExportingSplit, setIsExportingSplit] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');
  const [isEstimatingSizes, setIsEstimatingSizes] = useState(false);
  const [moduleSizeBytes, setModuleSizeBytes] = useState<Record<string, number>>({});
  const [assetBytes, setAssetBytes] = useState(0);
  const [migrationInfo, setMigrationInfo] = useState<MigrationCheckResult | null>(() => {
    const meta = loadMigrationMeta();
    return {
      ...meta,
      indexedDbKeyCount: 0,
      criticalKeyCount: 5,
      importRecommended: meta.status === 'failed',
      hasLegacyPayload: false,
      hasLegacyCompatibilityCopy: false,
      canSafelyCleanupLegacy: false,
    };
  });
  const [isCheckingMigration, setIsCheckingMigration] = useState(false);

  const modules = [
    { id: 'characters', label: '角色配置', icon: <Users size={20} />, category: 'chat', data: appData?.characters },
    { id: 'chatHistory', label: '聊天记录', icon: <MessageSquare size={20} />, category: 'chat', data: appData?.chatHistory },
    { id: 'groups', label: '分组信息', icon: <Layers size={20} />, category: 'chat', data: appData?.groups },
    { id: 'chatGroups', label: '群聊数据', icon: <Users size={20} />, category: 'chat', data: appData?.chatGroups },
    { id: 'friendRequests', label: '好友申请', icon: <UserPlus size={20} />, category: 'chat', data: appData?.friendRequests },
    { id: 'callHistory', label: '通话记录', icon: <Phone size={20} />, category: 'chat', data: appData?.callHistory },
    
    { id: 'userProfile', label: '个人资料', icon: <User size={20} />, category: 'profile', data: appData?.userProfile },
    { id: 'favorites', label: '收藏消息', icon: <Heart size={20} />, category: 'profile', data: appData?.favorites },
    { id: 'masks', label: '身份面具', icon: <Ghost size={20} />, category: 'profile', data: appData?.masks },
    { id: 'coupleSpace', label: '情侣空间', icon: <Heart size={20} className="text-rose-500" />, category: 'profile', data: appData?.coupleSpace },
    
    { id: 'worldBooks', label: '世界书', icon: <Book size={20} />, category: 'world', data: appData?.worldBooks },
    { id: 'moments', label: '朋友圈', icon: <Compass size={20} />, category: 'world', data: appData?.moments },
    { id: 'forumData', label: '论坛数据', icon: <Share2 size={20} />, category: 'world', data: appData?.forumData },
    { id: 'savedDates', label: '约会记录', icon: <Calendar size={20} />, category: 'world', data: appData?.savedDates },
    { id: 'collectedDates', label: '收藏约会', icon: <Star size={20} />, category: 'world', data: appData?.collectedDates },
    
    { id: 'visualSettings', label: '视觉设置', icon: <Palette size={20} />, category: 'apps', data: appData?.visualSettings },
    { id: 'settings', label: '手机设置', icon: <Settings size={20} />, category: 'apps', data: settings },
    { id: 'musicData', label: '音乐数据', icon: <Mic size={20} />, category: 'apps', data: appData?.musicData },
    { id: 'walletData', label: '钱包数据', icon: <Banknote size={20} />, category: 'apps', data: appData?.walletData },
  ];

  const sizeEstimateFallbacks = useMemo(() => ({
    settings,
    characters: appData?.characters,
    chatHistory: appData?.chatHistory,
    groups: appData?.groups,
    chatGroups: appData?.chatGroups,
    friendRequests: appData?.friendRequests,
    callHistory: appData?.callHistory,
    userProfile: appData?.userProfile,
    favorites: appData?.favorites,
    masks: appData?.masks,
    coupleSpace: appData?.coupleSpaceState ?? appData?.coupleSpace,
    worldBooks: appData?.worldBooks,
    moments: appData?.moments,
    forumData: appData?.forumData,
    savedDates: appData?.savedDates,
    collectedDates: appData?.collectedDates,
    visualSettings: appData?.visualSettings,
    musicData: appData?.musicData,
    walletData: appData?.walletData,
  }), [appData, settings]);

  const totalDataBytes = modules.reduce((sum, mod) => sum + (moduleSizeBytes[mod.id] ?? 0), 0);
  const totalModuleCount = modules.length;
  const isRunningBackupExport = isExportingFull || isExportingSplit;

  const flushLatestBackupState = async () => {
    setExportProgressText('正在同步最新数据...');
    const pendingWrites: Promise<unknown>[] = [
      persistSettings(settings),
    ];

    if (appData) {
      const snapshot = buildPersistableNonChatAppDataSnapshot(appData, appData);
      pendingWrites.push(
        persistNonChatAppDataSnapshot(snapshot),
        persistChatOrganization({
          groups: appData.groups ?? [],
          chatGroups: appData.chatGroups ?? [],
        }),
        persistFriendRequests(appData.friendRequests ?? []),
      );
    }

    await Promise.all(pendingWrites);
    await waitForNextPaint();
  };

  const handleExportFull = async () => {
    try {
      setIsExportingFull(true);
      await flushLatestBackupState();
      const result = await runBackupExportJob({
        appData,
        mode: 'full',
        onProgress: setExportProgressText,
        settings,
      });
      result.files.forEach((file) => {
        downloadBlobFile(file.blob, file.fileName);
      });
      alert(`全量备份导出成功！已生成 ${result.files.length} 个备份文件，共包含 ${result.assetCount} 个本地资源。`);
    } catch (error) {
      console.error('Failed to export full backup archive', error);
      alert('全量备份导出失败，请稍后重试。');
    } finally {
      setIsExportingFull(false);
      setExportProgressText('');
    }
  };

  const handleExportSplit = async () => {
    try {
      setIsExportingSplit(true);
      await flushLatestBackupState();
      const result = await runBackupExportJob({
        appData,
        mode: 'split',
        onProgress: setExportProgressText,
        settings,
      });
      result.files.forEach((file) => {
        downloadBlobFile(file.blob, file.fileName);
      });
      alert(
        result.assetCount > 0
          ? `单文件备份导出成功！已生成 1 个备份文件，内部已按主数据和资源分段保存，共包含 ${result.assetCount} 个本地资源。恢复时直接导入这个文件即可。`
          : '单文件备份导出成功！已生成 1 个备份文件。当前没有需要额外分段保存的本地资源。',
      );
    } catch (error) {
      console.error('Failed to export split backup archive', error);
      alert('单文件备份导出失败，请稍后重试。');
    } finally {
      setIsExportingSplit(false);
      setExportProgressText('');
    }
  };

  const handleExportSelected = async () => {
    if (selectedModules.length === 0) {
      alert('请先选择要备份的功能');
      return;
    }

    try {
      setIsExportingSelected(true);

      const exportData: Record<string, unknown> = {};
      selectedModules.forEach(id => {
        const mod = modules.find(m => m.id === id);
        if (mod) {
          exportData[id] = mod.data;
        }
      });

      await downloadJsonFile(exportData, `backup_partial_${Date.now()}.json`);
      alert('备份导出成功！');
    } catch (error) {
      console.error('Failed to export selected backup modules', error);
      alert('选中内容导出失败，请稍后重试。');
    } finally {
      setIsExportingSelected(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const runEstimate = async () => {
      setIsEstimatingSizes(true);

      try {
        const nextEstimate = await estimateBackupModuleSizes(sizeEstimateFallbacks);
        if (cancelled) {
          return;
        }

        setModuleSizeBytes(nextEstimate.moduleBytes);
        setAssetBytes(nextEstimate.assetBytes);
      } catch (error) {
        console.error('[CustomizationApp] Failed to estimate backup size', error);
        if (!cancelled) {
          setModuleSizeBytes({});
          setAssetBytes(0);
        }
      } finally {
        if (!cancelled) {
          setIsEstimatingSizes(false);
        }
      }
    };

    void runEstimate();

    return () => {
      cancelled = true;
    };
  }, [sizeEstimateFallbacks]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = await showInAppConfirm('导入备份将覆盖当前对应功能的数据，确定继续吗？');
    if (!confirmed) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    setImportProgressText('正在读取备份文件...');

    try {
      const workerResult = await runBackupImportJob({
        file,
        onProgress: setImportProgressText,
      });

      if (workerResult.kind === 'single-file') {
        alert(
          workerResult.assetCount > 0
            ? `单文件备份恢复成功！已恢复主数据和 ${workerResult.assetCount} 个本地资源，页面将重新加载。`
            : '单文件备份恢复成功！当前备份没有额外资源包，页面将重新加载。',
        );
        window.location.reload();
        return;
      }

      if (workerResult.kind === 'data-archive') {
        const nextStepText = workerResult.assetCount > 0
          ? `主数据包恢复成功！这份备份还有 ${workerResult.assetCount} 个本地资源，请继续导入对应的 assets 包。页面将先重新加载。`
          : '主数据包恢复成功！当前备份没有额外资源包，页面将重新加载。';
        alert(nextStepText);
        window.location.reload();
        return;
      }

      if (workerResult.kind === 'assets-archive') {
        alert(`资源包恢复成功！已恢复 ${workerResult.assetCount} 个本地资源，页面将重新加载。`);
        window.location.reload();
        return;
      }

      if (workerResult.kind === 'modular-archive') {
        alert(`模块化备份恢复成功！已按批恢复 ${workerResult.assetCount} 个本地资源，页面将重新加载。`);
        window.location.reload();
        return;
      }

      if (workerResult.kind === 'full-archive') {
        alert(`完整备份恢复成功！已按批恢复 ${workerResult.assetCount} 个本地资源，页面将重新加载。`);
        window.location.reload();
        return;
      }
    } catch (error) {
      console.error('[CustomizationApp] Failed to restore imported backup in worker', error);
      alert('备份文件已读取成功，但后台恢复失败了。当前更像是浏览器本地存储环境异常，不是 JSON 文件本身无效。');
      setIsImporting(false);
      setImportProgressText('');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      let parsed: any;
      try {
        const content = event.target?.result as string;
        parsed = JSON.parse(content);
      } catch (error) {
        alert('解析备份文件失败，请确保文件内容是有效的 JSON。');
        setIsImporting(false);
        setImportProgressText('');
        e.target.value = '';
        return;
      }

      try {
        const handleArchiveRestoreProgress = (progress: BackupRestoreProgress) => {
          setImportProgressText(progress.message);
        };

        const writeImportedRecord = async (key: string, value: unknown) => {
          syncLocalStorageJsonValue(key, value);
          await saveJsonRecord(key, value).catch((error) => {
            console.error(`[CustomizationApp] Failed to mirror imported key "${key}" into IndexedDB`, error);
          });
        };

        const normalizeImportedAppData = (source: any) => {
          const normalized = { ...source };
          const directHistory = normalized.chatHistory && typeof normalized.chatHistory === 'object'
            ? normalized.chatHistory
            : {};
          const chatGroups = Array.isArray(normalized.chatGroups) ? normalized.chatGroups : [];
          const groups = Array.isArray(normalized.groups) ? normalized.groups : [];
          const { coupleSpaceState, coupleSpace } = buildPersistableCoupleSpacePayload(
            normalized.coupleSpaceState,
            normalized.coupleSpace,
          );
          const perception = hydratePerceptionSettings(
            normalized.perception
              ?? normalized.coupleSpaceState?.sharedPerception
              ?? normalized.coupleSpace?.perception,
            createDefaultPerceptionSettings(),
          );

          return {
            ...normalized,
            chatHistory: directHistory,
            chatGroups,
            groups,
            perception,
            coupleSpaceState: {
              ...coupleSpaceState,
              sharedPerception: perception,
            },
            coupleSpace,
          };
        };

        const shouldWriteLegacyAppDataCompat = (source: unknown) => {
          if (!source || typeof source !== 'object' || Array.isArray(source)) {
            return false;
          }

          const candidate = source as Record<string, unknown>;
          return (
            Array.isArray(candidate.characters)
            && candidate.chatHistory != null
            && candidate.userProfile != null
          );
        };

        const persistImportedSnapshot = async (nextAppData: any, nextSettings: any, source: any) => {
          const normalizedAppData = normalizeImportedAppData(nextAppData);
          const importedCharacters = Array.isArray(normalizedAppData.characters)
            ? normalizedAppData.characters
            : [];
          const persistedChatHistory = {
            directHistory: normalizedAppData.chatHistory ?? {},
            directSessionMetadata: extractDirectSessionMetadata(importedCharacters, normalizedAppData.chatHistory ?? {}),
            directRelationshipWaves: extractDirectRelationshipWaves(normalizedAppData.chatHistory ?? {}),
            directFactTraces: extractDirectFactTraces(normalizedAppData.chatHistory ?? {}),
            groupSessions: extractGroupSessions(normalizedAppData.chatGroups ?? []),
          };
          const characterMemory = buildCharacterMemoryRecord(importedCharacters);
          const memoryRecords = mergeLegacyCharacterMemoryRecordIntoMemoryRecordData(
            buildMemoryRecordDataFromChatHistory(persistedChatHistory),
            characterMemory,
          );

          const writes: Promise<void>[] = [
            writeImportedRecord(STORAGE_KEYS.settings, nextSettings),
            writeImportedRecord(STORAGE_KEYS.characters, stripCharacterMemoryFromCharacters(importedCharacters)),
            writeImportedRecord(STORAGE_KEYS.characterMemory, {}),
            writeImportedRecord(STORAGE_KEYS.memoryRecords, memoryRecords),
            writeImportedRecord(STORAGE_KEYS.chatHistory, persistedChatHistory),
            writeImportedRecord(STORAGE_KEYS.chatOrganization, {
              groups: normalizedAppData.groups ?? [],
              chatGroups: normalizedAppData.chatGroups ?? [],
            }),
            writeImportedRecord(STORAGE_KEYS.perception, normalizedAppData.perception ?? {}),
            writeImportedRecord(STORAGE_KEYS.userProfile, normalizedAppData.userProfile ?? {}),
            writeImportedRecord(STORAGE_KEYS.meData, {
              masks: normalizedAppData.masks ?? [],
              favorites: normalizedAppData.favorites ?? [],
              worldBooks: normalizedAppData.worldBooks ?? [],
              userAvatarLibrary: normalizedAppData.userAvatarLibrary ?? { entries: [], updatedAt: 0 },
              relationshipAvatarBindings: normalizedAppData.relationshipAvatarBindings ?? [],
            }),
            writeImportedRecord(STORAGE_KEYS.moments, normalizedAppData.moments ?? []),
            writeImportedRecord(STORAGE_KEYS.friendRequests, normalizedAppData.friendRequests ?? []),
            writeImportedRecord(STORAGE_KEYS.callHistory, normalizedAppData.callHistory ?? []),
            writeImportedRecord(STORAGE_KEYS.datingRecords, {
              savedDates: normalizedAppData.savedDates ?? [],
              collectedDates: normalizedAppData.collectedDates ?? [],
            }),
            writeImportedRecord(STORAGE_KEYS.visualSettings, normalizedAppData.visualSettings ?? {}),
            writeImportedRecord(STORAGE_KEYS.forumData, normalizedAppData.forumData ?? {}),
            writeImportedRecord(STORAGE_KEYS.coupleSpace, normalizedAppData.coupleSpaceState ?? {}),
            writeImportedRecord(STORAGE_KEYS.musicData, normalizedAppData.musicData ?? {}),
            writeImportedRecord(STORAGE_KEYS.walletData, normalizedAppData.walletData ?? {}),
          ];

          if (source && typeof source === 'object') {
            const sourceRecord = source as Record<string, unknown>;
            if (Array.isArray(sourceRecord[STORAGE_KEYS.wechatRoleBindings])) {
              writes.push(writeImportedRecord(
                STORAGE_KEYS.wechatRoleBindings,
                sourceRecord[STORAGE_KEYS.wechatRoleBindings],
              ));
            }
            if (Array.isArray(sourceRecord[STORAGE_KEYS.wechatBindSessions])) {
              writes.push(writeImportedRecord(
                STORAGE_KEYS.wechatBindSessions,
                sourceRecord[STORAGE_KEYS.wechatBindSessions],
              ));
            }
          }

          if (shouldWriteLegacyAppDataCompat(source)) {
            syncLocalStorageJsonValue(STORAGE_KEYS.appData, normalizedAppData);
          }

          if (source && typeof source === 'object' && 'settings' in source) {
            syncLocalStorageJsonValue(STORAGE_KEYS.settings, nextSettings);
          }

          await Promise.all(writes);
        };
        
        if (confirmed) {
          if (isModularBackupDataArchive(parsed)) {
            setImportProgressText('正在按批恢复主数据包...');
            await restoreModularBackupDataArchive(parsed, { onProgress: handleArchiveRestoreProgress });
            const nextStepText = parsed.assetCount > 0
              ? `主数据包恢复成功！这份备份还有 ${parsed.assetCount} 个本地资源，请继续导入对应的 assets 包。页面将先重新加载。`
              : '主数据包恢复成功！当前备份没有额外资源包，页面将重新加载。';
            alert(nextStepText);
            window.location.reload();
            return;
          }

          if (isSingleFileModularBackupBundle(parsed)) {
            setImportProgressText('正在恢复单文件备份...');
            await restoreSingleFileModularBackupBundle(parsed, { onProgress: handleArchiveRestoreProgress });
            const assetCount = parsed.assetsArchive?.assets.length ?? 0;
            alert(
              assetCount > 0
                ? `单文件备份恢复成功！已恢复主数据和 ${assetCount} 个本地资源，页面将重新加载。`
                : '单文件备份恢复成功！当前备份没有额外资源包，页面将重新加载。',
            );
            window.location.reload();
            return;
          }

          if (isModularBackupAssetsArchive(parsed)) {
            setImportProgressText('正在分批恢复资源包...');
            await restoreModularBackupAssetsArchive(parsed, { onProgress: handleArchiveRestoreProgress });
            alert(`资源包恢复成功！已恢复 ${parsed.assets.length} 个本地资源，页面将重新加载。`);
            window.location.reload();
            return;
          }

          if (isModularBackupArchive(parsed)) {
            setImportProgressText('正在按批恢复模块化备份...');
            await restoreModularBackupArchive(parsed, { onProgress: handleArchiveRestoreProgress });
            alert(`模块化备份恢复成功！已按批恢复 ${parsed.assets.length} 个本地资源，页面将重新加载。`);
            window.location.reload();
            return;
          }

          if (isFullBackupArchive(parsed)) {
            setImportProgressText('正在按批恢复完整备份...');
            await restoreFullBackupArchive(parsed, { onProgress: handleArchiveRestoreProgress });
            alert(`完整备份恢复成功！已按批恢复 ${parsed.assets.length} 个本地资源，页面将重新加载。`);
            window.location.reload();
            return;
          }

          let newAppData = { ...appData };
          let newSettings = { ...settings };
          let updatedCount = 0;

          const keys = Object.keys(parsed);
          
          if (parsed.characters && parsed.chatHistory && parsed.userProfile) {
             const normalizedImportedAppData = normalizeImportedAppData(parsed);
             if (setAppData) setAppData(normalizedImportedAppData);
             setImportProgressText('正在写入导入数据...');
             await persistImportedSnapshot(normalizedImportedAppData, settings, parsed);
             updatedCount = keys.length;
          } else {
            keys.forEach(key => {
              if (key === 'settings' && setSettings) {
                newSettings = parsed[key];
                setSettings(newSettings);
                updatedCount++;
              } else if (key in newAppData) {
                newAppData[key] = parsed[key];
                updatedCount++;
              }
            });
            const normalizedImportedAppData = normalizeImportedAppData(newAppData);
            if (setAppData) setAppData(normalizedImportedAppData);
            setImportProgressText('正在写入导入数据...');
            await persistImportedSnapshot(normalizedImportedAppData, newSettings, parsed);
          }

          alert(`成功导入 ${updatedCount} 个功能的数据！手机设置已恢复。`);
        }
      } catch (error) {
        console.error('[CustomizationApp] Failed to restore imported backup', error);
        alert('备份文件已读取成功，但恢复数据时失败了。当前更像是浏览器本地存储环境异常，不是 JSON 文件本身无效。');
      } finally {
        setIsImporting(false);
        setImportProgressText('');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleModule = (id: string) => {
    setSelectedModules(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    let cancelled = false;

    const runCheck = async () => {
      setIsCheckingMigration(true);
      try {
        const result = await evaluateMigrationStatus();
        if (!cancelled) {
          setMigrationInfo(result);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingMigration(false);
        }
      }
    };

    void runCheck();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRecheckMigration = async () => {
    setIsCheckingMigration(true);
    try {
      const result = await evaluateMigrationStatus();
      setMigrationInfo(result);
    } finally {
      setIsCheckingMigration(false);
    }
  };

  const handleClearLegacyCompatibility = async () => {
    if (!migrationInfo?.canSafelyCleanupLegacy || migrationInfo.legacyCleanupCompleted) {
      return;
    }

    const confirmed = await showInAppConfirm(
      '这只会清理旧 ai_phone_app_data 兼容副本，不会删除 IndexedDB 主数据。建议先完成一次完整备份。确定继续吗？',
    );
    if (!confirmed) {
      return;
    }

    clearLegacyCompatibilityCopy();
    const result = await evaluateMigrationStatus();
    setMigrationInfo(result);
    alert('旧兼容副本已清理完成。当前主数据仍保存在 IndexedDB 中。');
  };

  const migrationPresentation = (() => {
    switch (migrationInfo?.status) {
      case 'success':
        if (migrationInfo.hasLegacyCompatibilityCopy && !migrationInfo.legacyCleanupCompleted) {
          return {
            badge: '兼容期',
            title: '新存储已经稳定，旧整包仅保留兼容副本',
            description: '当前主读主写已经在 IndexedDB，旧 ai_phone_app_data 只作为兼容副本保留，不再参与主链路。',
            tone: 'emerald',
          } as const;
        }
        return {
          badge: '已迁移',
          title: '核心数据已接入新存储',
          description: '聊天记录、角色资料和设置等关键数据已经通过校验，可以继续正常使用。',
          tone: 'emerald',
        } as const;
      case 'failed':
        return {
          badge: '需处理',
          title: '新存储中的关键数据还不完整',
          description: '建议立即导入你之前备份的数据，作为这次迁移的兜底恢复。',
          tone: 'amber',
        } as const;
      case 'in_progress':
        return {
          badge: '待完成',
          title: '检测到旧数据，迁移还没完全落稳',
          description: '当前仍有数据依赖旧存储，建议先保留旧数据并立即备份。',
          tone: 'sky',
        } as const;
      default:
        return {
          badge: '未开始',
          title: '还没有检测到新存储中的关键数据',
          description: '建议先做一次完整备份，后续我们再继续接迁移流程。',
          tone: 'zinc',
        } as const;
    }
  })();

  const migrationCardClassName = {
    emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    sky: 'border-sky-200 bg-sky-50',
    zinc: 'border-zinc-200 bg-zinc-50',
  }[migrationPresentation.tone];

  const migrationBadgeClassName = {
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    sky: 'bg-sky-100 text-sky-700',
    zinc: 'bg-zinc-200 text-zinc-700',
  }[migrationPresentation.tone];

  const formatDateTime = (timestamp: number | null | undefined): string => {
    if (!timestamp) {
      return '暂无';
    }

    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTabContent = () => {
    const filteredModules = modules.filter(m => m.category === activeTab);
    return (
      <div className="grid grid-cols-2 gap-3">
        {filteredModules.map(mod => (
          <button
            key={mod.id}
            onClick={() => toggleModule(mod.id)}
            className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all relative ${
              selectedModules.includes(mod.id)
                ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-md scale-[1.02]'
                : 'bg-white border-zinc-100 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selectedModules.includes(mod.id) ? 'bg-white/20' : 'bg-zinc-50'
            }`}>
              {mod.icon}
            </div>
            <span className="text-[13px] font-bold">{mod.label}</span>
            <span className="text-[11px] text-zinc-400">
              {typeof moduleSizeBytes[mod.id] === 'number' ? formatBytes(moduleSizeBytes[mod.id]) : '估算中...'}
            </span>
            {selectedModules.includes(mod.id) && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center text-zinc-900">
                <Check size={12} strokeWidth={4} />
              </div>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
        <h3 className="text-sm font-bold text-zinc-800">数据管理</h3>
        <p className="text-xs text-zinc-500">管理所有应用数据，支持分类导出备份和导入恢复。</p>
        <div className={`rounded-2xl border p-4 space-y-3 ${migrationCardClassName}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] text-zinc-500">数据迁移状态</div>
              <div className="mt-1 text-[16px] font-bold text-zinc-900">{migrationPresentation.title}</div>
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${migrationBadgeClassName}`}>
              {migrationPresentation.badge}
            </span>
          </div>
          <p className="text-[12px] leading-5 text-zinc-600">{migrationPresentation.description}</p>
          <div className="grid grid-cols-2 gap-3 text-[12px] text-zinc-600">
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <div className="text-zinc-500">关键模块校验</div>
              <div className="mt-1 font-bold text-zinc-900">
                {migrationInfo?.indexedDbKeyCount ?? 0} / {migrationInfo?.criticalKeyCount ?? 5}
              </div>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <div className="text-zinc-500">最近校验时间</div>
              <div className="mt-1 font-bold text-zinc-900">{formatDateTime(migrationInfo?.lastVerifiedAt)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[12px] text-zinc-600">
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <div className="text-zinc-500">稳定启动次数</div>
              <div className="mt-1 font-bold text-zinc-900">
                {migrationInfo?.successfulLaunchCount ?? 0} / {LEGACY_CLEANUP_SUCCESS_THRESHOLD}
              </div>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <div className="text-zinc-500">旧整包状态</div>
              <div className="mt-1 font-bold text-zinc-900">
                {migrationInfo?.legacyCleanupCompleted
                  ? '已完成清理'
                  : migrationInfo?.hasLegacyCompatibilityCopy
                    ? '兼容副本保留中'
                    : migrationInfo?.hasLegacyPayload
                      ? '检测到旧数据'
                      : '未检测到旧整包'}
              </div>
            </div>
          </div>
          {migrationInfo?.status === 'success' && migrationInfo.hasLegacyCompatibilityCopy && !migrationInfo.legacyCleanupCompleted ? (
            <div className="rounded-xl bg-white/70 px-3 py-2 text-[12px] text-zinc-700">
              现在已经是 IndexedDB 主链路。旧整包仍保留在浏览器里，只是为了兼容老备份和过渡恢复，不会再覆盖新数据。
            </div>
          ) : null}
          {migrationInfo?.canSafelyCleanupLegacy && !migrationInfo.legacyCleanupCompleted ? (
            <div className="rounded-xl bg-white/70 px-3 py-2 text-[12px] text-zinc-700">
              已连续稳定启动 {migrationInfo.successfulLaunchCount} 次，后续可以考虑正式下线旧整包兼容副本。
            </div>
          ) : null}
          {migrationInfo?.lastError ? (
            <div className="rounded-xl bg-white/70 px-3 py-2 text-[12px] text-zinc-700">
              {migrationInfo.lastError}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleExportFull()}
              disabled={isExportingFull}
              className="rounded-xl bg-white px-4 py-2 text-[12px] font-bold text-zinc-900 shadow-sm disabled:opacity-60"
            >
              立即备份
            </button>
            <button
              onClick={() => void handleRecheckMigration()}
              disabled={isCheckingMigration}
              className="rounded-xl border border-white/80 bg-white/40 px-4 py-2 text-[12px] font-bold text-zinc-700 disabled:opacity-60"
            >
              {isCheckingMigration ? '检测中...' : migrationInfo?.importRecommended ? '重新检测迁移状态' : '校验迁移状态'}
            </button>
            {migrationInfo?.canSafelyCleanupLegacy && !migrationInfo.legacyCleanupCompleted ? (
              <button
                onClick={() => void handleClearLegacyCompatibility()}
                className="rounded-xl border border-white/80 bg-white/40 px-4 py-2 text-[12px] font-bold text-zinc-700"
              >
                清理旧兼容副本
              </button>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="text-[12px] text-zinc-500">总数据统计</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[22px] font-bold text-zinc-900">
              {isEstimatingSizes ? '估算中...' : formatBytes(totalDataBytes)}
            </span>
            <span className="text-[12px] text-zinc-500">
              {isEstimatingSizes ? `正在后台统计 ${totalModuleCount} 个模块` : `总占用 / ${totalModuleCount} 个模块`}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {isEstimatingSizes
              ? '本地资源会一起后台估算，不会在打开页面时同步扫完整包。'
              : assetBytes > 0
                ? `本地资源约 ${formatBytes(assetBytes)}，全量备份时会一起导出。`
                : '当前没有额外本地资源需要一起打包。'}
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => void handleExportFull()}
            disabled={isRunningBackupExport}
            className="flex flex-col items-center gap-2 rounded-3xl border border-zinc-200 bg-zinc-100 p-4 text-zinc-900 shadow-sm transition-transform hover:bg-zinc-200 active:scale-95"
          >
            {isExportingFull ? <RefreshCw size={24} className="animate-spin" /> : <Database size={24} />}
            <span className="text-[14px] font-bold">全量备份</span>
          </button>
          <button 
            onClick={() => void handleExportSplit()}
            disabled={isRunningBackupExport}
            className="flex flex-col items-center gap-2 rounded-3xl border border-zinc-200 bg-zinc-100 p-4 text-zinc-900 shadow-sm transition-transform hover:bg-zinc-200 active:scale-95"
          >
            {isExportingSplit ? <RefreshCw size={24} className="animate-spin" /> : <Layers size={24} />}
            <span className="text-[14px] font-bold">单文件备份</span>
          </button>
          <button 
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = (e: any) => handleImport(e);
              input.click();
            }}
            className="flex flex-col items-center gap-2 rounded-3xl border border-zinc-200 bg-zinc-100 p-4 text-zinc-900 shadow-sm transition-transform hover:bg-zinc-200 active:scale-95"
          >
            <RefreshCw size={24} className={isImporting ? 'animate-spin' : ''} />
            <span className="text-[14px] font-bold">导入恢复</span>
          </button>
        </div>
        {isImporting && importProgressText ? (
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-[12px] text-zinc-600">
            {importProgressText}
          </div>
        ) : null}
        {exportProgressText ? (
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-[12px] text-zinc-600">
            {exportProgressText}
          </div>
        ) : null}

        {/* Module Selection Section */}
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[14px] font-bold text-zinc-900">功能选择备份</h4>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if (selectedModules.length === modules.length) {
                    setSelectedModules([]);
                  } else {
                    setSelectedModules(modules.map(m => m.id));
                  }
                }}
                className="text-[12px] font-bold text-zinc-500"
              >
                {selectedModules.length === modules.length ? '取消全选' : '全选'}
              </button>
              <button 
                onClick={() => void handleExportSelected()}
                disabled={selectedModules.length === 0 || isExportingSelected || isRunningBackupExport}
                className="text-[12px] font-bold text-zinc-900 disabled:opacity-40"
              >
                {isExportingSelected ? '导出中...' : `导出选中 (${selectedModules.length})`}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {[
              { id: 'chat', label: '聊天' },
              { id: 'profile', label: '个人' },
              { id: 'world', label: '世界' },
              { id: 'apps', label: '设置' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2 rounded-full text-[12px] font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm' 
                    : 'bg-white border border-zinc-200 text-zinc-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid Content */}
          <div className="min-h-[200px]">
            {renderTabContent()}
          </div>
        </div>
      </div>

      <div className="bg-rose-50 p-5 rounded-[24px] border border-rose-100 space-y-4">
        <h3 className="text-sm font-bold text-rose-800">危险区域</h3>
        <p className="text-xs text-rose-600/80">此操作将删除所有本地数据并恢复默认设置，不可逆转。</p>
        <button 
          onClick={async () => {
            if (await showInAppConfirm('确定要清除所有数据吗？此操作不可恢复！')) {
              onReset();
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors"
        >
          <Trash2 size={16} /> 清除所有数据
        </button>
      </div>
    </div>
  );
}


