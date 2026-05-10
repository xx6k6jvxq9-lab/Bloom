import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Clapperboard, Headphones, Heart, Sparkles, Star } from 'lucide-react';
import { createPortal } from 'react-dom';

import type { WidgetConfig } from '../../types';
import { usePersistentFieldActions } from '../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';

const KAWAII_WIDGET_TYPES = ['kawaii-launcher', 'kawaii-scrapbook'] as const;
const FLOATING_KAWAII_WIDGET_TYPES: readonly string[] = [];

type KawaiiDesktopWidgetType = (typeof KAWAII_WIDGET_TYPES)[number];

function resolveDirectImageUrl(value?: string) {
  if (!value) return '';
  if (value.startsWith('data:') || value.includes('://')) return value;
  return '';
}

function clampToRange(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function getPopupViewportBounds() {
  if (typeof window === 'undefined') {
    return {
      left: 12,
      top: 12,
      right: 332,
      bottom: 652,
    };
  }

  const fallbackBounds = {
    left: 12,
    top: 12,
    right: window.innerWidth - 12,
    bottom: window.innerHeight - 12,
  };

  const phoneContainer = document.getElementById('phone-container');
  const rect = phoneContainer?.getBoundingClientRect();

  if (!rect) {
    return fallbackBounds;
  }

  return {
    left: rect.left + 12,
    top: rect.top + 12,
    right: rect.right - 12,
    bottom: rect.bottom - 12,
  };
}

export function shouldShowKawaiiLauncherPlate(widget: WidgetConfig) {
  if (widget.type !== 'kawaii-launcher') {
    return true;
  }

  const background = (widget.background || '').trim().toLowerCase();
  const opacity = widget.opacity ?? 1;
  const isWhiteLike = background === '' || background === '#ffffff' || background === '#fff' || background === 'white';

  if (isWhiteLike && opacity < 0.98) {
    return false;
  }

  return true;
}

export function shouldShowKawaiiScrapbookPlate(widget: WidgetConfig) {
  if (widget.type !== 'kawaii-scrapbook') {
    return true;
  }

  const background = (widget.background || '').trim().toLowerCase();
  const opacity = widget.opacity ?? 1;
  const isWhiteLike = background === '' || background === '#ffffff' || background === '#fff' || background === 'white';

  if (isWhiteLike && opacity < 0.98) {
    return false;
  }

  return true;
}

function useWidgetImage(value?: string) {
  const { resolvedUrl } = useResolvedPersistentValue(value || '');
  return resolvedUrl || resolveDirectImageUrl(value);
}

function ImageFallback({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-50 text-zinc-400 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

function normalizeLauncherPillColor(color?: string) {
  if (!color) return '#e0ddd9';
  return color;
}

function resolveWidgetSurfaceColor(color: string | undefined, fallback: string) {
  const normalized = color?.trim();
  return normalized || fallback;
}

function getReadableTextColor(backgroundColor: string) {
  const normalized = backgroundColor.trim();
  const shortHexMatch = normalized.match(/^#([0-9a-fA-F]{3})$/);
  const longHexMatch = normalized.match(/^#([0-9a-fA-F]{6})$/);

  if (!shortHexMatch && !longHexMatch) {
    return '#5b5b5b';
  }

  const hex = shortHexMatch
    ? shortHexMatch[1].split('').map(char => `${char}${char}`).join('')
    : longHexMatch![1];
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance < 160 ? '#f7f7f7' : '#5b5b5b';
}

function getAdaptiveTextColor(color: string | undefined, fallback: string) {
  const normalized = color?.trim();
  if (!normalized || !normalized.startsWith('#')) {
    return fallback;
  }

  return getReadableTextColor(normalized);
}

function CircularPhotoFrame({
  src,
  alt,
  size,
}: {
  src?: string;
  alt: string;
  size: number | string;
}) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full border-[3px] border-white/90 bg-white/85 shadow-[0_6px_16px_rgba(15,23,42,0.1)]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <ImageFallback className="h-full w-full" />
      )}
    </div>
  );
}

function RoundedPhotoFrame({
  src,
  alt,
  className,
  imageClassName,
  emptyHint,
}: {
  src?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  emptyHint?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-white/90 ${className ?? ''}`}>
      {src ? (
        <img src={src} alt={alt} className={`h-full w-full object-cover ${imageClassName ?? ''}`} draggable={false} />
      ) : (
        <>
          <ImageFallback className={`h-full w-full ${imageClassName ?? ''}`} />
          {emptyHint ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[11px] font-medium leading-4 text-zinc-400">
              {emptyHint}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function InlineEditableText({
  value,
  onChange,
  className,
  inputClassName,
  multiline = false,
  placeholder = '',
  clampLines,
  style,
  inputStyle,
  tag: Tag = 'span',
}: {
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  placeholder?: string;
  clampLines?: number;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
  tag?: 'span' | 'p';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  const commit = () => {
    if (!onChange) return;
    onChange(draft.trim());
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing && onChange) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as any}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onClick={event => event.stopPropagation()}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
          rows={3}
          className={inputClassName || className}
          style={inputStyle}
        />
      );
    }

    return (
      <input
        ref={inputRef as any}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        className={inputClassName || className}
        style={inputStyle}
      />
    );
  }

  return (
    <Tag
      className={className}
      style={{
        ...(clampLines ? { display: '-webkit-box', WebkitLineClamp: clampLines, WebkitBoxOrient: 'vertical' } : {}),
        ...style,
      }}
      onClick={event => {
        if (!onChange) return;
        event.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
    >
      {value || placeholder}
    </Tag>
  );
}

function DirectImagePicker({
  value,
  onChange,
  children,
  title,
  className,
}: {
  value: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const bounds = getPopupViewportBounds();
      const gap = 12;
      const availableWidth = Math.max(180, bounds.right - bounds.left);
      const availableHeight = Math.max(176, bounds.bottom - bounds.top);
      const panelWidth = Math.min(264, availableWidth);
      const maxHeight = Math.min(248, availableHeight);
      const estimatedHeight = Math.min(panelRef.current?.offsetHeight ?? 208, maxHeight);
      const left = clampToRange(
        rect.left + rect.width / 2 - panelWidth / 2,
        bounds.left,
        Math.max(bounds.left, bounds.right - panelWidth),
      );
      const belowTop = rect.bottom + gap;
      const aboveTop = rect.top - estimatedHeight - gap;
      const preferredTop =
        belowTop + estimatedHeight <= bounds.bottom || aboveTop < bounds.top
          ? belowTop
          : aboveTop;
      const top = clampToRange(
        preferredTop,
        bounds.top,
        Math.max(bounds.top, bounds.bottom - estimatedHeight),
      );

      setPanelStyle({
        position: 'fixed',
        top,
        left,
        width: panelWidth,
        maxHeight,
        overflowY: 'auto',
        zIndex: 6000,
      });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  const commit = async () => {
    if (!onChange) return;
    const nextValue = draft.trim() ? await setRemoteUrl(draft.trim()) : await clearValue();
    onChange(nextValue);
    setOpen(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onChange) return;

    try {
      const nextValue = await setUploadedFile(file);
      onChange(nextValue);
      setDraft(nextValue);
      setOpen(false);
    } catch (error) {
      console.error('Direct image upload failed:', error);
    }

    event.target.value = '';
  };

  return (
    <div
      ref={triggerRef}
      className={className || 'cursor-pointer'}
      onClick={event => {
        if (!onChange) return;
        event.stopPropagation();
        setOpen(true);
      }}
    >
      {children}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="rounded-[20px] border border-white/80 bg-white/96 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
              onClick={event => event.stopPropagation()}
            >
              <p className="mb-3 text-center text-[12px] font-semibold text-zinc-800">{title}</p>
              <label className="mb-2 flex cursor-pointer items-center justify-center rounded-2xl border border-[#d9e6f7] bg-[#eef5ff] px-3 py-2 text-[12px] font-medium text-[#4b6788] transition-colors hover:bg-[#e7f1ff]">
                直接上传
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              <input
                type="text"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commit();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setOpen(false);
                  }
                }}
                placeholder="粘贴图片链接"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-800 outline-none focus:border-zinc-400"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-medium text-zinc-600"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void commit();
                  }}
                  className="flex-1 rounded-2xl border border-[#d9e6f7] bg-[#eef5ff] px-3 py-2 text-[12px] font-medium text-[#4b6788]"
                >
                  保存
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function LauncherPill({
  icon,
  label,
  onLabelChange,
  compact,
  color,
}: {
  icon: ReactNode;
  label: string;
  onLabelChange?: (value: string) => void;
  compact: boolean;
  color?: string;
}) {
  const pillColor = normalizeLauncherPillColor(color);
  const textColor = getReadableTextColor(pillColor);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(label);
    }
  }, [editing, label]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    onLabelChange?.(draft.trim());
    setEditing(false);
  };

  return (
    <div
      className="flex min-w-0 cursor-text items-center rounded-full"
      onClick={event => {
        if (!onLabelChange) return;
        event.stopPropagation();
        setEditing(true);
      }}
      style={{
        gap: compact ? 6 : 'clamp(5px, 1.9vw, 8px)',
        minHeight: compact ? 34 : 'clamp(32px, 7.2vw, 40px)',
        minWidth: compact ? 96 : 'clamp(82px, 23vw, 112px)',
        padding: compact ? '0 12px' : '0 clamp(10px, 3vw, 14px)',
        backgroundColor: pillColor,
        color: textColor,
      }}
    >
      <span className="shrink-0" style={{ color: textColor }}>{icon}</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onClick={event => event.stopPropagation()}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(label);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-full border border-black/10 bg-white/85 px-2 py-1 text-[13px] font-medium outline-none"
          style={{ color: '#5b5b5b' }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-left font-medium" style={{ color: textColor }}>
          {label || '点这里改字'}
        </span>
      )}
    </div>
  );
}

function KawaiiLauncherWidget({
  widget,
  onWidgetChange,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
}) {
  const compact = widget.h <= 1 || widget.w <= 3;
  const avatarSrc = useWidgetImage(widget.avatarUrl);
  const backgroundSrc = useWidgetImage(widget.background);
  const backgroundOpacity = widget.opacity ?? 1;
  const showBasePlate = shouldShowKawaiiLauncherPlate(widget);
  const iconSize = compact ? 14 : 16;
  const avatarSize = compact ? 66 : 'clamp(72px, 21vw, 92px)';
  const panelGap = compact ? 8 : 'clamp(6px, 2.2vw, 10px)';
  const panelPaddingX = compact ? '12px' : 'clamp(10px, 3.4vw, 14px)';
  const panelPaddingY = compact ? '10px' : 'clamp(10px, 2.8vw, 13px)';
  const centerColumn = compact ? '66px' : 'clamp(72px, 21vw, 92px)';
  const launcherStackGap = compact ? '8px' : 'clamp(7px, 2.2vw, 10px)';
  const captionFontSize = compact ? '10px' : 'clamp(10px, 2.4vw, 11px)';
  const labels = [
    widget.item1Label || '',
    widget.item2Label || '',
    widget.item3Label || '',
    widget.item4Label || '',
  ];
  const colors = [
    widget.item1Color,
    widget.item2Color,
    widget.item3Color,
    widget.item4Color,
  ];
  const caption = widget.bio || '';

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
      {showBasePlate ? (
        backgroundSrc ? (
        <img
          src={backgroundSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: backgroundOpacity }}
          draggable={false}
        />
        ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: widget.background || '#ffffff',
            opacity: backgroundOpacity,
          }}
        />
        )
      ) : null}
      <div
        className="relative flex h-full flex-col justify-center"
        style={{ padding: `${panelPaddingY} ${panelPaddingX}` }}
      >
        <div
          className="grid min-h-0 flex-1 items-center"
          style={{ gridTemplateColumns: `minmax(0,1fr) ${centerColumn} minmax(0,1fr)`, gap: panelGap }}
        >
          <div className="flex min-w-0 flex-col" style={{ gap: launcherStackGap }}>
            <LauncherPill
              icon={<Headphones size={iconSize} strokeWidth={1.8} />}
              label={labels[0]}
              compact={compact}
              color={colors[0]}
              onLabelChange={onWidgetChange ? value => onWidgetChange({ item1Label: value }) : undefined}
            />
            <LauncherPill
              icon={<Heart size={iconSize} strokeWidth={1.8} />}
              label={labels[1]}
              compact={compact}
              color={colors[1]}
              onLabelChange={onWidgetChange ? value => onWidgetChange({ item2Label: value }) : undefined}
            />
          </div>

          <DirectImagePicker
            value={widget.avatarUrl || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ avatarUrl: value }) : undefined}
            title="设置中心头像"
          >
            <div className="shrink-0">
              <CircularPhotoFrame src={avatarSrc} alt="" size={avatarSize} />
            </div>
          </DirectImagePicker>

          <div className="flex min-w-0 flex-col" style={{ gap: launcherStackGap }}>
            <LauncherPill
              icon={<Clapperboard size={iconSize} strokeWidth={1.8} />}
              label={labels[2]}
              compact={compact}
              color={colors[2]}
              onLabelChange={onWidgetChange ? value => onWidgetChange({ item3Label: value }) : undefined}
            />
            <LauncherPill
              icon={<Sparkles size={iconSize} strokeWidth={1.8} />}
              label={labels[3]}
              compact={compact}
              color={colors[3]}
              onLabelChange={onWidgetChange ? value => onWidgetChange({ item4Label: value }) : undefined}
            />
          </div>
        </div>

        {widget.h > 1 ? (
          <InlineEditableText
            value={caption}
            onChange={onWidgetChange ? value => onWidgetChange({ bio: value }) : undefined}
            tag="p"
            className="mt-3 min-h-[14px] truncate text-center font-medium tracking-[0.08em] text-zinc-400"
            inputClassName="mt-3 w-full rounded-xl border border-black/10 bg-white/85 px-2 py-1 text-center font-medium tracking-[0.08em] text-zinc-500 outline-none"
            style={{ fontSize: captionFontSize }}
            inputStyle={{ fontSize: captionFontSize }}
            placeholder="点这里写一句话"
          />
        ) : null}
      </div>
    </div>
  );
}

function ScrapbookBinding({ compact }: { compact: boolean }) {
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-around border-r border-white/55 bg-[rgba(224,216,208,0.56)]"
      style={{ width: compact ? 18 : 'clamp(18px, 4.5vw, 22px)', padding: compact ? '8px 0' : 'clamp(8px, 2.2vw, 10px) 0' }}
    >
      {Array.from({ length: compact ? 4 : 6 }, (_, index) => (
        <span
          key={index}
          className="rounded-full border border-zinc-400/55 bg-white/80"
          style={{ width: compact ? 8 : 'clamp(8px, 2vw, 10px)', height: compact ? 8 : 'clamp(8px, 2vw, 10px)' }}
        />
      ))}
    </div>
  );
}

function KawaiiScrapbookCompact({
  widget,
  onWidgetChange,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
}) {
  const avatarSrc = useWidgetImage(widget.avatarUrl);
  const photoSrc = useWidgetImage(widget.photoUrl);
  const backgroundSrc = useWidgetImage(widget.background);
  const backgroundOpacity = widget.opacity ?? 1;
  const showBasePlate = shouldShowKawaiiScrapbookPlate(widget);
  const topLeftColor = resolveWidgetSurfaceColor(widget.item1Color, 'rgba(247,226,231,0.42)');
  const topRightColor = resolveWidgetSurfaceColor(widget.item2Color, 'rgba(255,255,255,0.96)');
  const noteColor = resolveWidgetSurfaceColor(widget.item4Color, 'rgba(251,233,237,0.46)');
  const topLeftTextColor = getAdaptiveTextColor(widget.item1Color, '#706d73');
  const noteTextColor = getAdaptiveTextColor(widget.item4Color, '#7b7580');

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-[inherit]">
      {showBasePlate ? (
        backgroundSrc ? (
          <img
            src={backgroundSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: backgroundOpacity }}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: widget.background || '#ffffff',
              opacity: backgroundOpacity,
            }}
          />
        )
      ) : null}
      <ScrapbookBinding compact />
      <div
        className="relative grid min-w-0 flex-1 grid-cols-[1.15fr_0.95fr_1.2fr]"
        style={{ gap: 'clamp(8px, 2.4vw, 10px)', padding: 'clamp(8px, 2.6vw, 10px)' }}
      >
        <div
          className="rounded-[16px]"
          style={{
            backgroundColor: topLeftColor,
            padding: 'clamp(8px, 2.6vw, 10px) clamp(10px, 3vw, 12px)',
          }}
        >
          <DirectImagePicker
            value={widget.avatarUrl || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ avatarUrl: value }) : undefined}
            title="设置头像"
          >
            <div className="inline-flex">
              <CircularPhotoFrame src={avatarSrc} alt="" size="clamp(30px, 8vw, 36px)" />
            </div>
          </DirectImagePicker>
          <InlineEditableText
            value={widget.title || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ title: value }) : undefined}
            className="mt-2 min-h-[14px] truncate font-semibold"
            inputClassName="mt-2 w-full rounded-xl border border-black/10 bg-white/85 px-2 py-1 font-semibold text-zinc-700 outline-none"
            style={{ fontSize: 'clamp(11px, 2.8vw, 12px)', color: topLeftTextColor }}
            inputStyle={{ fontSize: 'clamp(11px, 2.8vw, 12px)' }}
            placeholder="点这里写标题"
          />
        </div>

        <DirectImagePicker
          value={widget.photoUrl || ''}
          onChange={onWidgetChange ? value => onWidgetChange({ photoUrl: value }) : undefined}
          title="设置主照片"
          className="block"
        >
          <div
            className="h-full rounded-[16px] p-1 shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
            style={{ backgroundColor: topRightColor }}
          >
            <RoundedPhotoFrame
              src={photoSrc}
              alt=""
              className="h-full rounded-[12px]"
              emptyHint="点这里上传图片"
            />
          </div>
        </DirectImagePicker>

        <div
          className="rounded-[16px]"
          style={{
            backgroundColor: noteColor,
            padding: 'clamp(8px, 2.6vw, 10px) clamp(10px, 3vw, 12px)',
          }}
        >
          <InlineEditableText
            value={widget.note || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ note: value }) : undefined}
            tag="p"
            multiline
            clampLines={3}
            className="min-h-[48px] overflow-hidden"
            inputClassName="w-full resize-none rounded-xl border border-black/10 bg-white/85 px-2 py-1 text-zinc-500 outline-none"
            style={{ fontSize: 'clamp(10px, 2.5vw, 11px)', lineHeight: '1.4', color: noteTextColor }}
            inputStyle={{ fontSize: 'clamp(10px, 2.5vw, 11px)', lineHeight: '1.4' }}
            placeholder="点这里写便签"
          />
        </div>
      </div>
    </div>
  );
}

function KawaiiScrapbookWidget({
  widget,
  onWidgetChange,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
}) {
  if (widget.h <= 1) {
    return <KawaiiScrapbookCompact widget={widget} onWidgetChange={onWidgetChange} />;
  }

  const avatarSrc = useWidgetImage(widget.avatarUrl);
  const photoSrc = useWidgetImage(widget.photoUrl);
  const secondaryPhotoSrc = useWidgetImage(widget.secondaryPhotoUrl);
  const backgroundSrc = useWidgetImage(widget.background);
  const backgroundOpacity = widget.opacity ?? 1;
  const showBasePlate = shouldShowKawaiiScrapbookPlate(widget);
  const topLeftColor = resolveWidgetSurfaceColor(widget.item1Color, 'rgba(247,226,231,0.42)');
  const topRightColor = resolveWidgetSurfaceColor(widget.item2Color, 'rgba(255,255,255,0.96)');
  const bottomLeftColor = resolveWidgetSurfaceColor(widget.item3Color, 'rgba(244,241,236,0.8)');
  const bottomRightColor = resolveWidgetSurfaceColor(widget.item4Color, 'rgba(251,233,237,0.46)');
  const topLeftTextColor = getAdaptiveTextColor(widget.item1Color, '#706d73');
  const topLeftSubTextColor = topLeftTextColor === '#f7f7f7' ? 'rgba(255,255,255,0.82)' : '#7f7982';
  const bottomRightTextColor = getAdaptiveTextColor(widget.item4Color, '#7b7580');
  const bottomLeftStarColor =
    getAdaptiveTextColor(widget.item3Color, '#d4d4d8') === '#f7f7f7'
      ? 'rgba(255,255,255,0.74)'
      : '#d4d4d8';

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-[inherit]">
      {showBasePlate ? (
        backgroundSrc ? (
          <img
            src={backgroundSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: backgroundOpacity }}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: widget.background || '#ffffff',
              opacity: backgroundOpacity,
            }}
          />
        )
      ) : null}
      <ScrapbookBinding compact={false} />

      <div
        className="relative grid min-h-0 flex-1 grid-cols-2"
        style={{
          gridTemplateRows: 'minmax(0, 1fr) minmax(0, 0.78fr)',
          gap: 'clamp(8px, 2.8vw, 10px)',
          padding: 'clamp(8px, 3vw, 10px)',
        }}
      >
        <div
          className="min-h-0 rounded-[18px]"
          style={{ backgroundColor: topLeftColor, padding: 'clamp(10px, 3.1vw, 12px)' }}
        >
          <DirectImagePicker
            value={widget.avatarUrl || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ avatarUrl: value }) : undefined}
            title="设置头像"
          >
            <div className="inline-flex">
              <CircularPhotoFrame src={avatarSrc} alt="" size="clamp(62px, 18vw, 74px)" />
            </div>
          </DirectImagePicker>
          <InlineEditableText
            value={widget.title || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ title: value }) : undefined}
            className="mt-2 min-h-[16px] truncate font-semibold"
            inputClassName="mt-2 w-full rounded-xl border border-black/10 bg-white/85 px-2 py-1 font-semibold text-zinc-700 outline-none"
            style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: topLeftTextColor }}
            inputStyle={{ fontSize: 'clamp(12px, 3vw, 13px)' }}
            placeholder="点这里写标题"
          />
          <InlineEditableText
            value={widget.bio || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ bio: value }) : undefined}
            tag="p"
            multiline
            clampLines={3}
            className="mt-1 min-h-[40px] overflow-hidden"
            inputClassName="mt-1 w-full resize-none rounded-xl border border-black/10 bg-white/85 px-2 py-1 text-zinc-500 outline-none"
            style={{ fontSize: 'clamp(10px, 2.5vw, 11px)', lineHeight: '1.42', color: topLeftSubTextColor }}
            inputStyle={{ fontSize: 'clamp(10px, 2.5vw, 11px)', lineHeight: '1.42' }}
            placeholder="点这里写简介"
          />
        </div>

        <div
          className="relative rounded-[20px] shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
          style={{
            backgroundColor: topRightColor,
            transform: 'rotate(2deg)',
            padding: 'clamp(8px, 2.4vw, 10px)',
          }}
        >
          <DirectImagePicker
            value={widget.photoUrl || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ photoUrl: value }) : undefined}
            className="absolute inset-0 z-10 block cursor-pointer"
            title="设置主照片"
          >
            <div className="h-full w-full" />
          </DirectImagePicker>
          <DirectImagePicker
            value={widget.photoUrl || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ photoUrl: value }) : undefined}
            className="block h-full w-full cursor-pointer"
            title="设置主照片"
          >
            <RoundedPhotoFrame
              src={photoSrc}
              alt=""
              className="h-full w-full rounded-[14px] bg-[#ececec]"
              imageClassName="grayscale-[0.15]"
              emptyHint="点这里上传图片"
            />
          </DirectImagePicker>
        </div>

        <div
          className="grid min-h-0 items-center rounded-[18px]"
          style={{
            gridTemplateColumns: 'minmax(0, 0.72fr) minmax(0, 0.28fr)',
            gap: 'clamp(8px, 2.4vw, 12px)',
            backgroundColor: bottomLeftColor,
            padding: 'clamp(10px, 3vw, 12px)',
          }}
        >
          <DirectImagePicker
            value={widget.secondaryPhotoUrl || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ secondaryPhotoUrl: value }) : undefined}
            title="设置小照片"
            className="block w-full max-w-[86px] cursor-pointer"
          >
            <RoundedPhotoFrame
              src={secondaryPhotoSrc}
              alt=""
              className="aspect-square w-full rounded-[20px]"
              emptyHint="点这里上传小图"
            />
          </DirectImagePicker>
          <div className="flex min-w-0 items-center justify-center gap-1" style={{ color: bottomLeftStarColor }}>
            <Star size={12} fill="currentColor" />
            <Star size={12} fill="currentColor" />
            <Star size={12} fill="currentColor" />
          </div>
        </div>

        <div
          className="min-h-0 rounded-[18px]"
          style={{ backgroundColor: bottomRightColor, padding: 'clamp(10px, 3vw, 12px)' }}
        >
          <InlineEditableText
            value={widget.note || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ note: value }) : undefined}
            tag="p"
            multiline
            clampLines={4}
            className="min-h-[56px] overflow-hidden"
            inputClassName="w-full resize-none rounded-xl border border-black/10 bg-white/85 px-2 py-1 text-zinc-500 outline-none"
            style={{ fontSize: 'clamp(10px, 2.5vw, 11px)', lineHeight: '1.42', color: bottomRightTextColor }}
            inputStyle={{ fontSize: 'clamp(10px, 2.5vw, 11px)', lineHeight: '1.42' }}
            placeholder="点这里写便签"
          />
        </div>
      </div>
    </div>
  );
}

export function isKawaiiDesktopWidgetType(type: WidgetConfig['type']): type is KawaiiDesktopWidgetType {
  return KAWAII_WIDGET_TYPES.includes(type as KawaiiDesktopWidgetType);
}

export function isFloatingKawaiiDesktopWidgetType(type: WidgetConfig['type']) {
  return FLOATING_KAWAII_WIDGET_TYPES.includes(type as string);
}

export function KawaiiDesktopWidgetContent({
  widget,
  onWidgetChange,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
}) {
  switch (widget.type) {
    case 'kawaii-launcher':
      return <KawaiiLauncherWidget widget={widget} onWidgetChange={onWidgetChange} />;
    case 'kawaii-scrapbook':
      return <KawaiiScrapbookWidget widget={widget} onWidgetChange={onWidgetChange} />;
    default:
      return null;
  }
}
