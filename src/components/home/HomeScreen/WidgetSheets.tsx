import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Trash2, Upload, X } from 'lucide-react';

import type { WidgetConfig } from '../../../types';
import { DesktopWidget } from '../../shared/DesktopWidgets';
import {
  SUPPORTED_DESKTOP_WIDGET_TEMPLATES,
  getDesktopWidgetStyleOptions,
  getDesktopWidgetTypeLabel,
  isSupportedDesktopWidgetType,
  type SupportedDesktopWidgetType,
} from '../../shared/desktopWidgetCatalog';
import { usePersistentFieldActions } from '../../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';

function getPickerPreviewSize(widget: WidgetConfig) {
  if (widget.type === 'kawaii-launcher') {
    return 144;
  }

  if (widget.type === 'glass-vinyl-player' || widget.type === 'glass-recent-grid') {
    return 148;
  }

  if (widget.type === 'glass-duo-card' || widget.type === 'glass-polaroid-strip') {
    return 136;
  }

  if (widget.type === 'kawaii-scrapbook' || widget.type === 'profile-card') {
    return 136;
  }

  if (widget.type === 'floating-time') {
    return 144;
  }

  if (widget.type === 'calendar' || widget.type === 'time' || widget.type === 'anniversary' || widget.type === 'weather') {
    return 104;
  }

  return 100;
}

function resolveQuickPreviewUrl(value: string, resolvedUrl?: string) {
  if (resolvedUrl) return resolvedUrl;
  if (!value) return '';
  if (value.startsWith('data:') || value.includes('://')) return value;
  return '';
}

function normalizeWidgetImages(images: string[] | undefined, count: number) {
  return Array.from({ length: count }, (_, index) => images?.[index] || '');
}

function PersistentImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const { resolvedUrl } = useResolvedPersistentValue(draftValue);
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();
  const previewUrl = resolveQuickPreviewUrl(draftValue, resolvedUrl);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commitValue = async () => {
    const nextValue = draftValue.trim() ? await setRemoteUrl(draftValue) : await clearValue();
    setDraftValue(nextValue);
    onChange(nextValue);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
          <img src={previewUrl} alt={label} className="h-20 w-full object-cover" />
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          value={draftValue}
          onChange={event => setDraftValue(event.target.value)}
          placeholder="支持图片链接或上传"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-zinc-900"
        />
        <label className="flex cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200">
          <Upload size={14} className="mr-1" />
          上传
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async event => {
              const file = event.target.files?.[0];
              if (!file) return;

              try {
                const nextValue = await setUploadedFile(file);
                setDraftValue(nextValue);
                onChange(nextValue);
              } catch (error) {
                alert(error instanceof Error ? `上传失败: ${error.message}` : '上传失败，请稍后重试。');
              }

              event.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            void commitValue();
          }}
          className="whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          确认
        </button>
      </div>
    </div>
  );
}

function PersistentAssetField({
  label,
  value,
  onChange,
  accept,
  placeholder,
  kind = 'image',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accept: string;
  placeholder: string;
  kind?: 'image' | 'audio';
}) {
  const [draftValue, setDraftValue] = useState(value);
  const { resolvedUrl } = useResolvedPersistentValue(kind === 'image' ? draftValue : '');
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();
  const previewUrl = kind === 'image' ? resolveQuickPreviewUrl(draftValue, resolvedUrl) : '';

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commitValue = async () => {
    const trimmed = draftValue.trim();
    const nextValue = trimmed
      ? kind === 'image'
        ? await setRemoteUrl(trimmed)
        : trimmed
      : await clearValue();
    setDraftValue(nextValue);
    onChange(nextValue);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500">{label}</label>
      {kind === 'image' && previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
          <img src={previewUrl} alt={label} className="h-20 w-full object-cover" />
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
          value={draftValue}
          onChange={event => setDraftValue(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-zinc-900"
        />
        <label className="flex cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200">
          <Upload size={14} className="mr-1" />
          上传
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={async event => {
              const file = event.target.files?.[0];
              if (!file) return;

              try {
                const nextValue = await setUploadedFile(file);
                setDraftValue(nextValue);
                onChange(nextValue);
              } catch (error) {
                alert(error instanceof Error ? `上传失败: ${error.message}` : '上传失败，请稍后重试。');
              }

              event.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            void commitValue();
          }}
          className="whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          确认
        </button>
      </div>
    </div>
  );
}

function WidgetTextField({
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
          className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-zinc-900"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-zinc-900"
        />
      )}
    </div>
  );
}

function WidgetColorField({
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
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-zinc-900"
          placeholder="#e0ddd9"
        />
      </div>
    </div>
  );
}

function WidgetToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[18px] border border-zinc-200 bg-white px-3 py-2.5">
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

function KawaiiWidgetEditorFields({
  widget,
  onChange,
}: {
  widget: WidgetConfig;
  onChange: (updates: Partial<WidgetConfig>) => void;
}) {
  switch (widget.type) {
    case 'kawaii-launcher':
      return (
        <>
          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <PersistentImageField
              label="中心头像"
              value={widget.avatarUrl || ''}
              onChange={value => onChange({ avatarUrl: value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField label="左上标签" value={widget.item1Label || ''} onChange={value => onChange({ item1Label: value })} />
            <WidgetTextField label="左下标签" value={widget.item2Label || ''} onChange={value => onChange({ item2Label: value })} />
            <WidgetTextField label="右上标签" value={widget.item3Label || ''} onChange={value => onChange({ item3Label: value })} />
            <WidgetTextField label="右下标签" value={widget.item4Label || ''} onChange={value => onChange({ item4Label: value })} />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetColorField label="左上颜色" value={widget.item1Color || '#e0ddd9'} onChange={value => onChange({ item1Color: value })} />
            <WidgetColorField label="左下颜色" value={widget.item2Color || '#e0ddd9'} onChange={value => onChange({ item2Color: value })} />
            <WidgetColorField label="右上颜色" value={widget.item3Color || '#e0ddd9'} onChange={value => onChange({ item3Color: value })} />
            <WidgetColorField label="右下颜色" value={widget.item4Color || '#e0ddd9'} onChange={value => onChange({ item4Color: value })} />
          </div>

          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField
              label="底部文案"
              value={widget.bio || ''}
              onChange={value => onChange({ bio: value })}
              placeholder="例如：猫ちゃんがいない日は雨季。"
            />
          </div>
        </>
      );
    case 'kawaii-scrapbook':
      return (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <PersistentImageField
              label="头像"
              value={widget.avatarUrl || ''}
              onChange={value => onChange({ avatarUrl: value })}
            />
            <PersistentImageField
              label="主照片"
              value={widget.photoUrl || ''}
              onChange={value => onChange({ photoUrl: value })}
            />
          </div>

          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <PersistentImageField
              label="小照片"
              value={widget.secondaryPhotoUrl || ''}
              onChange={value => onChange({ secondaryPhotoUrl: value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField label="标题" value={widget.title || ''} onChange={value => onChange({ title: value })} />
            <WidgetTextField label="简介" value={widget.bio || ''} onChange={value => onChange({ bio: value })} />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetColorField label="左上底色" value={widget.item1Color || '#f3e7eb'} onChange={value => onChange({ item1Color: value })} />
            <WidgetColorField label="右上底色" value={widget.item2Color || '#ffffff'} onChange={value => onChange({ item2Color: value })} />
            <WidgetColorField label="左下底色" value={widget.item3Color || '#efede7'} onChange={value => onChange({ item3Color: value })} />
            <WidgetColorField label="右下底色" value={widget.item4Color || '#f7ecef'} onChange={value => onChange({ item4Color: value })} />
          </div>

          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField
              label="便签文案"
              value={widget.note || ''}
              onChange={value => onChange({ note: value })}
              multiline
            />
          </div>
        </>
      );
    case 'glass-duo-card':
      return (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <PersistentImageField
              label="左侧头像"
              value={widget.avatarUrl || ''}
              onChange={value => onChange({ avatarUrl: value })}
            />
            <PersistentImageField
              label="右侧头像"
              value={widget.secondaryAvatarUrl || ''}
              onChange={value => onChange({ secondaryAvatarUrl: value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField label="左侧文案" value={widget.line1Text || ''} onChange={value => onChange({ line1Text: value })} />
            <WidgetTextField label="右侧文案" value={widget.line2Text || ''} onChange={value => onChange({ line2Text: value })} />
          </div>
          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField label="底部文案" value={widget.bio || ''} onChange={value => onChange({ bio: value })} />
          </div>
        </>
      );
    case 'glass-vinyl-player':
      return (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <PersistentImageField
              label="左侧相片"
              value={widget.photoUrl || ''}
              onChange={value => onChange({ photoUrl: value })}
            />
            <PersistentImageField
              label="右侧相片"
              value={widget.secondaryPhotoUrl || ''}
              onChange={value => onChange({ secondaryPhotoUrl: value })}
            />
          </div>
          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <PersistentAssetField
              label="音频资源"
              value={widget.audioUrl || ''}
              onChange={value => onChange({ audioUrl: value })}
              accept="audio/*"
              kind="audio"
              placeholder="支持音频链接或上传"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField label="歌名" value={widget.title || ''} onChange={value => onChange({ title: value })} />
            <WidgetTextField label="歌手" value={widget.bio || ''} onChange={value => onChange({ bio: value })} />
          </div>
          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField label="气泡文案" value={widget.note || ''} onChange={value => onChange({ note: value })} />
          </div>
        </>
      );
    case 'glass-polaroid-strip':
      return (
        <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
          <PersistentImageField
            label="左侧拍立得"
            value={widget.avatarUrl || ''}
            onChange={value => onChange({ avatarUrl: value })}
          />
          <PersistentImageField
            label="中间拍立得"
            value={widget.photoUrl || ''}
            onChange={value => onChange({ photoUrl: value })}
          />
          <PersistentImageField
            label="右侧拍立得"
            value={widget.secondaryPhotoUrl || ''}
            onChange={value => onChange({ secondaryPhotoUrl: value })}
          />
        </div>
      );
    case 'glass-recent-grid':
      return (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetTextField label="左侧标题" value={widget.title || ''} onChange={value => onChange({ title: value })} />
            <WidgetTextField label="右侧文案" value={widget.note || ''} onChange={value => onChange({ note: value })} />
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            {normalizeWidgetImages(widget.images, 6).map((image, index) => (
              <PersistentImageField
                key={index}
                label={`图片 ${index + 1}`}
                value={image}
                onChange={value => {
                  const nextImages = normalizeWidgetImages(widget.images, 6);
                  nextImages[index] = value;
                  onChange({ images: nextImages });
                }}
              />
            ))}
          </div>
        </>
      );
    case 'floating-time':
      return (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetColorField
              label="时间颜色"
              value={widget.timeColor || '#6f7892'}
              onChange={value => onChange({ timeColor: value })}
            />
            <WidgetColorField
              label="日期颜色"
              value={widget.dateColor || '#7c8499'}
              onChange={value => onChange({ dateColor: value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <div className="space-y-2">
              <label className="flex justify-between text-xs font-bold text-zinc-500">
                <span>时间粗细</span>
                <span>{widget.timeWeight ?? 700}</span>
              </label>
              <input
                type="range"
                min="200"
                max="900"
                step="100"
                value={widget.timeWeight ?? 700}
                onChange={event => onChange({ timeWeight: Number(event.target.value) })}
                className="w-full accent-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">摆放位置</label>
              <select
                value={widget.textAlign || 'center'}
                onChange={event => onChange({ textAlign: event.target.value as WidgetConfig['textAlign'] })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs"
              >
                <option value="left">居左</option>
                <option value="center">居中</option>
                <option value="right">居右</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">日期位置</label>
              <select
                value={widget.datePosition || 'top'}
                onChange={event => onChange({ datePosition: event.target.value as WidgetConfig['datePosition'] })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs"
              >
                  <option value="top">上方</option>
                  <option value="bottom">下方</option>
                </select>
              </div>
            <WidgetToggleField
              label="显示描边框"
              checked={widget.showOutline !== false}
              onChange={checked => onChange({ showOutline: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
            <WidgetToggleField
              label="显示日期"
              checked={widget.showDate !== false}
              onChange={checked => onChange({ showDate: checked })}
            />
            <WidgetToggleField
              label="显示农历"
              checked={widget.showLunar !== false}
              onChange={checked => onChange({ showLunar: checked })}
            />
          </div>
        </>
      );
    default:
      return null;
  }
}

export function HomeWidgetPickerSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (type: SupportedDesktopWidgetType) => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <div
          className="absolute inset-0 z-[340] flex items-end bg-black/18 backdrop-blur-[2px]"
          data-home-widget-overlay="true"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="flex max-h-[74%] w-full flex-col rounded-t-[28px] border-t border-white/50 bg-white/94 px-4 pb-4 pt-3 shadow-[0_-18px_48px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
            style={{ paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 16px)' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-200" />
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black text-zinc-900">添加小组件</p>
                <p className="mt-0.5 text-[11px] leading-5 text-zinc-500">直接看卡片样式，点一下就会放到当前页空位。面板支持上下滑动。</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-1">
              <div className="grid grid-cols-2 gap-3">
                {SUPPORTED_DESKTOP_WIDGET_TEMPLATES.map(template => {
                  const previewWidget = template.create();
                  const previewWidth = getPickerPreviewSize(previewWidget);
                  const previewHeight = (previewWidth / Math.max(previewWidget.w, 1)) * Math.max(previewWidget.h, 1);
                  return (
                    <div
                      key={template.type}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(template.type)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect(template.type);
                        }
                      }}
                      className="rounded-[22px] border border-zinc-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:bg-zinc-50"
                    >
                      <div
                        className="mb-3 flex items-center justify-center"
                        style={{ minHeight: previewWidget.type === 'profile-card' ? 100 : 112 }}
                      >
                        <div
                          className="overflow-hidden shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                          style={{ width: previewWidth, height: previewHeight, borderRadius: previewWidget.borderRadius ?? 24 }}
                        >
                          <DesktopWidget widget={previewWidget} isPreview />
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                          {template.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-zinc-900">{template.label}</p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            默认尺寸 {template.size.w} x {template.size.h}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function HomeWidgetEditorSheet({
  widget,
  open,
  desktopColumns,
  onClose,
  onChange,
  onDelete,
}: {
  widget: WidgetConfig | null;
  open: boolean;
  desktopColumns: number;
  onClose: () => void;
  onChange: (updates: Partial<WidgetConfig>) => void;
  onDelete: () => Promise<void> | void;
}) {
  const widgetType = widget?.type;
  const styleOptions = useMemo(
    () => getDesktopWidgetStyleOptions(widgetType ?? 'blank'),
    [widgetType],
  );
  const previewWidth =
    widget?.type === 'glass-vinyl-player' || widget?.type === 'glass-recent-grid'
      ? 156
      : widget && widget.w >= 4
        ? 144
        : 120;

  return (
    <AnimatePresence>
      {open && widget ? (
        <div
          className="absolute inset-0 z-[341] flex items-end bg-black/22 backdrop-blur-[2px]"
          data-home-widget-overlay="true"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="flex max-h-[74%] w-full flex-col rounded-t-[28px] border-t border-white/55 bg-white/95 shadow-[0_-18px_48px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
            style={{ paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 12px)' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="shrink-0 px-4 pt-3">
              <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-zinc-200" />
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-zinc-900">{getDesktopWidgetTypeLabel(widget.type)}</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-zinc-500">这是快捷编辑层，适合改样式、尺寸和背景。</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <div className="space-y-3">
                <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/90 px-3 py-3">
                  <div
                    className="grid items-center gap-3"
                    style={{ gridTemplateColumns: `minmax(0, ${previewWidth}px) minmax(0, 1fr)` }}
                  >
                    <div
                      className="mx-auto overflow-hidden rounded-[24px] shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                      style={{ width: previewWidth, height: (previewWidth / Math.max(widget.w, 1)) * Math.max(widget.h, 1) }}
                    >
                      <DesktopWidget widget={widget} isPreview />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-600">
                        {getDesktopWidgetTypeLabel(widget.type)}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.12em] text-zinc-400">W</span>
                          <span className="mt-1 block text-sm font-bold text-zinc-900">{widget.w}</span>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.12em] text-zinc-400">H</span>
                          <span className="mt-1 block text-sm font-bold text-zinc-900">{widget.h}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {widget.type === 'profile-card' ? (
                  <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-zinc-900">资料卡片支持桌面直接编辑</p>
                    <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">
                      回到桌面后直接点封面、头像、名字、签名和定位，就能原地改图和改文字。
                    </p>
                  </div>
                ) : null}

                {widget.type !== 'profile-card' ? (
                  <div className={`grid gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3 ${styleOptions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500">组件类型</label>
                      <select
                        value={isSupportedDesktopWidgetType(widget.type) ? widget.type : 'blank'}
                        onChange={event => {
                          const nextType = event.target.value as SupportedDesktopWidgetType;
                          if (!isSupportedDesktopWidgetType(nextType)) return;
                          onChange({ type: nextType, style: getDesktopWidgetStyleOptions(nextType)[0]?.value || 'default' });
                        }}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs"
                      >
                        {SUPPORTED_DESKTOP_WIDGET_TEMPLATES.map(template => (
                          <option key={template.type} value={template.type}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {styleOptions.length > 1 ? (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500">组件样式</label>
                        <select
                          value={widget.style || styleOptions[0]?.value || 'default'}
                          onChange={event => onChange({ style: event.target.value })}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs"
                        >
                          {styleOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {widget.type === 'anniversary' ? (
                  <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500">标题</label>
                      <input
                        type="text"
                        value={widget.title || ''}
                        onChange={event => onChange({ title: event.target.value })}
                        placeholder="例如：在一起"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500">日期</label>
                      <input
                        type="date"
                        value={widget.date || ''}
                        onChange={event => onChange({ date: event.target.value })}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900"
                      />
                    </div>
                  </div>
                ) : null}

                <KawaiiWidgetEditorFields widget={widget} onChange={onChange} />

                <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
                  <div className="space-y-2">
                    <label className="flex justify-between text-xs font-bold text-zinc-500">
                      <span>宽度</span>
                      <span>{widget.w}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={Math.max(1, desktopColumns)}
                      value={widget.w}
                      onChange={event => onChange({ w: Number(event.target.value) })}
                      className="w-full accent-zinc-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex justify-between text-xs font-bold text-zinc-500">
                      <span>高度</span>
                      <span>{widget.h}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      value={widget.h}
                      onChange={event => onChange({ h: Number(event.target.value) })}
                      className="w-full accent-zinc-900"
                    />
                  </div>
                </div>

                {widget.type !== 'floating-time' ? (
                  <>
                    <div className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
                      <PersistentImageField
                        label="背景图片"
                        value={widget.background}
                        onChange={value => onChange({ background: value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-3 py-3">
                      <div className="space-y-2">
                        <label className="flex justify-between text-xs font-bold text-zinc-500">
                          <span>圆角</span>
                          <span>{widget.borderRadius ?? 24}px</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={widget.borderRadius ?? 24}
                          onChange={event => onChange({ borderRadius: Number(event.target.value) })}
                          className="w-full accent-zinc-900"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex justify-between text-xs font-bold text-zinc-500">
                          <span>不透明度</span>
                          <span>{Math.round((widget.opacity ?? 1) * 100)}%</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={widget.opacity ?? 1}
                          onChange={event => onChange({ opacity: Number(event.target.value) })}
                          className="w-full accent-zinc-900"
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="sticky bottom-0 flex gap-3 bg-white/88 pt-1 backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
                  >
                    完成
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onDelete();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function HomeWidgetQuickEntryButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-4 z-[120] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-white/24 text-white shadow-[0_10px_28px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-transform active:scale-95"
      data-home-widget-overlay="true"
      aria-label="添加小组件"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
    >
      <Plus size={18} />
    </button>
  );
}
