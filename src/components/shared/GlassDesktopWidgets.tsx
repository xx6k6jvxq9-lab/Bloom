import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  Heart,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Upload,
} from 'lucide-react';

import type { WidgetConfig } from '../../types';
import { usePersistentFieldActions } from '../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';

const GLASS_WIDGET_TYPES = [
  'glass-duo-card',
  'glass-vinyl-player',
  'glass-polaroid-strip',
  'glass-recent-grid',
] as const;

type GlassDesktopWidgetType = (typeof GLASS_WIDGET_TYPES)[number];

function resolveDirectAssetUrl(value?: string) {
  if (!value) return '';
  if (value.startsWith('data:') || value.includes('://')) return value;
  return '';
}

function useWidgetAsset(value?: string) {
  const { resolvedUrl } = useResolvedPersistentValue(value || '');
  return resolvedUrl || resolveDirectAssetUrl(value);
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

function normalizeImages(images: string[] | undefined, count: number) {
  return Array.from({ length: count }, (_, index) => images?.[index] || '');
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function InlineEditableText({
  value,
  onChange,
  className,
  inputClassName,
  multiline = false,
  placeholder = '',
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
      style={style}
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

function AssetPicker({
  value,
  onChange,
  accept,
  title,
  placeholder,
  kind = 'image',
  className,
  children,
}: {
  value: string;
  onChange?: (value: string) => void;
  accept: string;
  title: string;
  placeholder: string;
  kind?: 'image' | 'audio';
  className?: string;
  children: ReactNode;
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
      const panelWidth = Math.min(268, availableWidth);
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
        zIndex: 6100,
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

    if (!draft.trim()) {
      const nextValue = await clearValue();
      onChange(nextValue);
      setOpen(false);
      return;
    }

    const nextValue =
      kind === 'image'
        ? await setRemoteUrl(draft.trim())
        : draft.trim();
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
      console.error('Widget asset upload failed:', error);
    }

    event.target.value = '';
  };

  return (
    <div
      ref={triggerRef}
      className={className || (onChange ? 'cursor-pointer' : undefined)}
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
              className="rounded-[20px] border border-white/85 bg-white/96 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
              onClick={event => event.stopPropagation()}
            >
              <p className="mb-3 text-center text-[12px] font-semibold text-zinc-800">{title}</p>
              <label className="mb-2 flex cursor-pointer items-center justify-center rounded-2xl border border-[#d9e6f7] bg-[#eef5ff] px-3 py-2 text-[12px] font-medium text-[#4b6788] transition-colors hover:bg-[#e7f1ff]">
                <Upload size={14} className="mr-1.5" />
                直接上传
                <input type="file" accept={accept} className="hidden" onChange={handleFileChange} />
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
                placeholder={placeholder}
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

function ImageTile({
  src,
  hint,
  className,
  imageClassName,
}: {
  src?: string;
  hint: string;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-white/55 ${className ?? ''}`}>
      {src ? (
        <img src={src} alt="" className={`h-full w-full object-cover ${imageClassName ?? ''}`} draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/80 via-zinc-100/80 to-zinc-200/80 px-3 text-center text-[11px] font-medium leading-4 text-zinc-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function AvatarCircle({
  src,
  hint,
  sizeClassName,
}: {
  src?: string;
  hint: string;
  sizeClassName: string;
}) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border-[2px] border-white/90 bg-white/72 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${sizeClassName}`}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="px-3 text-center text-[11px] font-medium leading-4 text-zinc-400">{hint}</div>
      )}
    </div>
  );
}

function GlassShell({
  widget,
  children,
}: {
  widget: WidgetConfig;
  children: ReactNode;
}) {
  const backgroundSrc = useWidgetAsset(widget.background);
  const plateOpacity = clampToRange(widget.opacity ?? 0.18, 0, 1);
  const backgroundColor =
    widget.background && !widget.background.includes('://') && !widget.background.startsWith('data:')
      ? widget.background
      : '#ffffff';
  const mediaOpacity = backgroundSrc ? plateOpacity : plateOpacity * 0.55;
  const shellFillOpacity = clampToRange(plateOpacity * 0.92, 0, 0.82);
  const shellBorderOpacity = clampToRange(plateOpacity * 2.2, 0, 0.72);
  const shellHighlightOpacity = clampToRange(plateOpacity * 1.3, 0, 0.42);
  const shellShadowOpacity = clampToRange(plateOpacity * 0.18, 0, 0.14);
  const hasVisiblePlate = plateOpacity > 0.01;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
      {hasVisiblePlate ? (
        backgroundSrc ? (
          <img
            src={backgroundSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: mediaOpacity }}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor,
              opacity: mediaOpacity,
            }}
          />
        )
      ) : null}
      {hasVisiblePlate ? (
        <div
          className="absolute inset-0 rounded-[inherit]"
          style={{
            backgroundColor: `rgba(255,255,255,${shellFillOpacity})`,
            border: `1px solid rgba(255,255,255,${shellBorderOpacity})`,
            boxShadow: `0 14px 28px rgba(148,163,184,${shellShadowOpacity}), inset 0 1px 0 rgba(255,255,255,${shellHighlightOpacity})`,
          }}
        />
      ) : null}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}

function GlassDuoCard({
  widget,
  onWidgetChange,
  isPreview = false,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
  isPreview?: boolean;
}) {
  const leftAvatar = useWidgetAsset(widget.avatarUrl);
  const rightAvatar = useWidgetAsset(widget.secondaryAvatarUrl);
  const previewMode = isPreview;

  return (
    <GlassShell widget={widget}>
      <div
        className="flex h-full flex-col"
        style={{
          padding: previewMode ? '8px 10px 8px' : 'clamp(16px,4vw,20px) clamp(18px,4.8vw,26px)',
        }}
      >
        <div
          className="flex min-h-0 flex-1 items-center justify-around"
          style={{ gap: previewMode ? 8 : 'clamp(14px,4vw,28px)' }}
        >
          {[
            {
              avatar: leftAvatar,
              field: 'avatarUrl' as const,
              label: widget.line1Text || '',
              labelField: 'line1Text' as const,
            },
            {
              avatar: rightAvatar,
              field: 'secondaryAvatarUrl' as const,
              label: widget.line2Text || '',
              labelField: 'line2Text' as const,
            },
          ].map((item, index) => (
            <div key={index} className="flex min-w-0 flex-col items-center" style={{ gap: previewMode ? 5 : 12 }}>
              <AssetPicker
                value={widget[item.field] || ''}
                onChange={onWidgetChange ? value => onWidgetChange({ [item.field]: value } as Partial<WidgetConfig>) : undefined}
                accept="image/*"
                kind="image"
                title={index === 0 ? '设置左侧头像' : '设置右侧头像'}
                placeholder="粘贴图片链接"
                className="block"
              >
                <AvatarCircle
                  src={item.avatar}
                  hint="点这里上传头像"
                  sizeClassName={
                    previewMode
                      ? 'h-[40px] w-[40px]'
                      : 'h-[clamp(94px,24vw,112px)] w-[clamp(94px,24vw,112px)]'
                  }
                />
              </AssetPicker>
              <InlineEditableText
                value={item.label}
                onChange={onWidgetChange ? value => onWidgetChange({ [item.labelField]: value } as Partial<WidgetConfig>) : undefined}
                className={previewMode ? 'max-w-[4.25rem] truncate text-center text-[8px] font-medium text-zinc-700' : 'max-w-[9rem] truncate text-center text-[14px] font-medium text-zinc-700'}
                inputClassName={previewMode ? 'w-full rounded-xl border border-black/10 bg-white/80 px-1.5 py-0.5 text-center text-[8px] font-medium text-zinc-700 outline-none' : 'w-full rounded-xl border border-black/10 bg-white/80 px-2 py-1 text-center text-[14px] font-medium text-zinc-700 outline-none'}
                placeholder="点这里写名字"
              />
            </div>
          ))}
        </div>
        <div className="mx-2 h-px bg-white/45" style={{ marginTop: previewMode ? 6 : 12 }} />
        <InlineEditableText
          value={widget.bio || ''}
          onChange={onWidgetChange ? value => onWidgetChange({ bio: value }) : undefined}
          tag="p"
          className={previewMode ? 'mt-1.5 min-h-[10px] truncate text-center text-[7px] tracking-[0.05em] text-zinc-500' : 'mt-4 min-h-[16px] text-center text-[12px] tracking-[0.08em] text-zinc-500'}
          inputClassName={previewMode ? 'w-full rounded-xl border border-black/10 bg-white/80 px-1.5 py-0.5 text-center text-[7px] tracking-[0.05em] text-zinc-600 outline-none' : 'w-full rounded-xl border border-black/10 bg-white/80 px-2 py-1 text-center text-[12px] tracking-[0.08em] text-zinc-600 outline-none'}
          placeholder="点这里写底部文案"
        />
      </div>
    </GlassShell>
  );
}

function GlassVinylPlayer({
  widget,
  onWidgetChange,
  isPreview = false,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
  isPreview?: boolean;
}) {
  const leftPhoto = useWidgetAsset(widget.photoUrl);
  const rightPhoto = useWidgetAsset(widget.secondaryPhotoUrl);
  const audioSrc = useWidgetAsset(widget.audioUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncDuration = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
    };
    const syncTime = () => {
      const nextTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setCurrentTime(nextTime);
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (nextDuration > 0) {
        setDuration(nextDuration);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    syncDuration();
    syncTime();

    return () => {
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
  }, [widget.audioUrl]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const previewMode = isPreview;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        console.error('Audio playback failed:', error);
      }
      return;
    }

    audio.pause();
  };

  const jumpBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    const nextTime = clampToRange(audio.currentTime + seconds, 0, duration || audio.duration || 0);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audioSrc || duration <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clampToRange((event.clientX - rect.left) / rect.width, 0, 1);
    const nextTime = ratio * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <GlassShell widget={widget}>
      <audio ref={audioRef} src={audioSrc || undefined} preload="metadata" />
      <div
        className="flex h-full flex-col"
        style={{ padding: previewMode ? '8px 9px 8px' : 'clamp(16px,4vw,18px) clamp(16px,4vw,20px)' }}
      >
        <div className="flex min-h-0 flex-1" style={{ gap: previewMode ? 8 : 'clamp(10px,3vw,16px)' }}>
          <div className="flex min-w-0 flex-col" style={{ flexBasis: previewMode ? '42%' : '45%' }}>
            <InlineEditableText
              value={widget.note || ''}
              onChange={onWidgetChange ? value => onWidgetChange({ note: value }) : undefined}
              className={previewMode ? 'inline-flex max-w-full self-start rounded-full border border-white/65 bg-white/45 px-2 py-0.5 text-[7px] font-medium text-zinc-700' : 'inline-flex max-w-full self-start rounded-full border border-white/65 bg-white/45 px-3 py-1 text-[11px] font-medium text-zinc-700'}
              inputClassName={previewMode ? 'w-full rounded-full border border-black/10 bg-white/85 px-2 py-0.5 text-[7px] font-medium text-zinc-700 outline-none' : 'w-full rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-medium text-zinc-700 outline-none'}
              placeholder="点这里写气泡文案"
            />

            <div className="relative" style={{ marginTop: previewMode ? 8 : 16, height: previewMode ? 50 : 'clamp(118px,30vw,142px)' }}>
              {[
                { src: leftPhoto, field: 'photoUrl' as const, rotate: -7, offsetX: 0, offsetY: 10 },
                { src: rightPhoto, field: 'secondaryPhotoUrl' as const, rotate: 5, offsetX: 26, offsetY: 22 },
              ].map((item, index) => (
                <AssetPicker
                  key={item.field}
                  value={widget[item.field] || ''}
                  onChange={onWidgetChange ? value => onWidgetChange({ [item.field]: value } as Partial<WidgetConfig>) : undefined}
                  accept="image/*"
                  kind="image"
                  title={index === 0 ? '设置左侧相片' : '设置右侧相片'}
                  placeholder="粘贴图片链接"
                  className="absolute block"
                >
                  <div
                    className="rounded-[8px] bg-white/92 px-[6px] pt-[6px] shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
                    style={{
                      width: previewMode ? 34 : 'clamp(86px,23vw,102px)',
                      paddingBottom: previewMode ? 8 : 18,
                      left: previewMode ? index * 10 : item.offsetX,
                      top: previewMode ? index * 4 : item.offsetY,
                      transform: `rotate(${item.rotate}deg)`,
                    }}
                  >
                    <ImageTile src={item.src} hint="点这里上传图片" className={previewMode ? 'h-[28px] rounded-[4px] bg-zinc-200' : 'h-[clamp(78px,21vw,94px)] rounded-[4px] bg-zinc-200'} />
                  </div>
                </AssetPicker>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
            <AssetPicker
              value={widget.audioUrl || ''}
              onChange={onWidgetChange ? value => onWidgetChange({ audioUrl: value }) : undefined}
              accept="audio/*"
              kind="audio"
              title="设置音频"
              placeholder="粘贴音频链接"
              className="block"
            >
              <div className={`relative flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_50%,#1f1f24_0%,#0d0d10_42%,#16181f_100%)] shadow-[0_14px_28px_rgba(15,23,42,0.28)] ${previewMode ? 'h-[48px] w-[48px]' : 'h-[clamp(112px,29vw,126px)] w-[clamp(112px,29vw,126px)]'}`}>
                {Array.from({ length: 7 }, (_, index) => (
                  <div
                    key={index}
                    className={`absolute rounded-full border border-white/6 ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}
                    style={{
                      width: `${40 + index * 10}%`,
                      height: `${40 + index * 10}%`,
                    }}
                  />
                ))}
                <div className={`absolute inset-0 rounded-full ${isPlaying ? 'animate-[spin_4.2s_linear_infinite]' : ''}`}>
                  {[
                    { left: '50%', top: '20%', size: previewMode ? 6 : 12 },
                    { left: '32%', top: '58%', size: previewMode ? 5 : 10 },
                    { left: '66%', top: '64%', size: previewMode ? 4 : 8 },
                    { left: '40%', top: '34%', size: previewMode ? 5 : 9 },
                  ].map((star, index) => (
                    <span
                      key={index}
                      className="absolute text-white/25"
                      style={{
                        left: star.left,
                        top: star.top,
                        transform: 'translate(-50%, -50%)',
                        fontSize: star.size,
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <div className={`absolute origin-top-right ${previewMode ? 'h-[26px] w-[16px] -right-[2px] top-[-2px]' : 'h-[60px] w-[34px] -right-[6px] top-[-4px]'}`}>
                  <div
                    className={`absolute top-0 rounded-full bg-gradient-to-b from-white/80 to-white/35 transition-transform duration-500 ${previewMode ? 'right-1 h-[22px] w-[2px]' : 'right-2 h-[50px] w-[4px]'}`}
                    style={{ transform: isPlaying ? 'rotate(14deg)' : 'rotate(4deg)', transformOrigin: 'top center' }}
                  />
                  <div className={`absolute bottom-0 right-0 rounded-full bg-white/55 ${previewMode ? 'h-[4px] w-[4px]' : 'h-[10px] w-[10px]'}`} />
                </div>
                <div className={`rounded-full border border-white/10 bg-black/80 shadow-inner ${previewMode ? 'h-[8px] w-[8px]' : 'h-[18px] w-[18px]'}`} />
              </div>
            </AssetPicker>

            <InlineEditableText
              value={widget.title || ''}
              onChange={onWidgetChange ? value => onWidgetChange({ title: value }) : undefined}
              tag="p"
              className={previewMode ? 'mt-1.5 max-w-full truncate text-center text-[8px] font-semibold text-zinc-800' : 'mt-3 max-w-full truncate text-center text-[15px] font-semibold text-zinc-800'}
              inputClassName={previewMode ? 'w-full rounded-xl border border-black/10 bg-white/85 px-1.5 py-0.5 text-center text-[8px] font-semibold text-zinc-800 outline-none' : 'w-full rounded-xl border border-black/10 bg-white/85 px-2 py-1 text-center text-[15px] font-semibold text-zinc-800 outline-none'}
              placeholder="点这里写歌名"
            />
            <InlineEditableText
              value={widget.bio || ''}
              onChange={onWidgetChange ? value => onWidgetChange({ bio: value }) : undefined}
              tag="p"
              className={previewMode ? 'mt-0.5 max-w-full truncate text-center text-[6px] font-medium tracking-[0.04em] text-zinc-500' : 'mt-1 max-w-full truncate text-center text-[11px] font-medium tracking-[0.08em] text-zinc-500'}
              inputClassName={previewMode ? 'w-full rounded-xl border border-black/10 bg-white/85 px-1.5 py-0.5 text-center text-[6px] font-medium tracking-[0.04em] text-zinc-500 outline-none' : 'w-full rounded-xl border border-black/10 bg-white/85 px-2 py-1 text-center text-[11px] font-medium tracking-[0.08em] text-zinc-500 outline-none'}
              placeholder="点这里写歌手"
            />
            <p className={previewMode ? 'hidden' : 'mt-2 text-center text-[10px] text-zinc-400'}>
              {audioSrc ? '点唱片可更换音频' : '点唱片上传音频或粘贴链接'}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className={`flex items-center gap-2 ${previewMode ? 'mb-1.5' : 'mb-3'}`}>
            <span className={previewMode ? 'w-5 shrink-0 text-[6px] font-medium text-zinc-500' : 'w-8 shrink-0 text-[10px] font-medium text-zinc-500'}>{formatTime(currentTime)}</span>
            <div
              className={`relative flex-1 rounded-full ${audioSrc ? 'cursor-pointer bg-zinc-300/70' : 'bg-zinc-200/70'} ${previewMode ? 'h-[3px]' : 'h-[4px]'}`}
              onClick={handleSeek}
            >
              <div
                className="h-full rounded-full bg-zinc-700/75 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.18)] ${previewMode ? 'h-[6px] w-[6px]' : 'h-[10px] w-[10px]'}`}
                style={{ left: `calc(${progress}% - ${previewMode ? 3 : 5}px)` }}
              />
            </div>
            <span className={previewMode ? 'w-5 shrink-0 text-right text-[6px] font-medium text-zinc-500' : 'w-8 shrink-0 text-right text-[10px] font-medium text-zinc-500'}>{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-center" style={{ gap: previewMode ? 8 : 16 }}>
            <button
              type="button"
              onClick={() => jumpBy(-10)}
              disabled={!audioSrc}
              className={`flex items-center justify-center rounded-full border border-white/65 bg-white/45 text-zinc-700 shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition-transform active:scale-95 disabled:opacity-40 ${previewMode ? 'h-6 w-6' : 'h-9 w-9'}`}
            >
              <SkipBack size={previewMode ? 10 : 16} />
            </button>
            <button
              type="button"
              onClick={togglePlayback}
              disabled={!audioSrc}
              className={`flex items-center justify-center rounded-full border border-white/75 bg-white text-zinc-800 shadow-[0_10px_24px_rgba(15,23,42,0.12)] transition-transform active:scale-95 disabled:opacity-40 ${previewMode ? 'h-7 w-7' : 'h-12 w-12'}`}
            >
              {isPlaying ? <Pause size={previewMode ? 11 : 20} className="fill-current" /> : <Play size={previewMode ? 11 : 20} className="ml-0.5 fill-current" />}
            </button>
            <button
              type="button"
              onClick={() => jumpBy(10)}
              disabled={!audioSrc}
              className={`flex items-center justify-center rounded-full border border-white/65 bg-white/45 text-zinc-700 shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition-transform active:scale-95 disabled:opacity-40 ${previewMode ? 'h-6 w-6' : 'h-9 w-9'}`}
            >
              <SkipForward size={previewMode ? 10 : 16} />
            </button>
          </div>
        </div>
      </div>
    </GlassShell>
  );
}

function GlassPolaroidStrip({
  widget,
  onWidgetChange,
  isPreview = false,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
  isPreview?: boolean;
}) {
  const photos = [
    { src: useWidgetAsset(widget.avatarUrl), field: 'avatarUrl' as const, rotate: -6 },
    { src: useWidgetAsset(widget.photoUrl), field: 'photoUrl' as const, rotate: 0 },
    { src: useWidgetAsset(widget.secondaryPhotoUrl), field: 'secondaryPhotoUrl' as const, rotate: 5 },
  ];

  return (
    <GlassShell widget={widget}>
      <div
        className="flex h-full items-center justify-center"
        style={{
          gap: isPreview ? 8 : 'clamp(12px,3vw,18px)',
          padding: isPreview ? '8px 10px' : 'clamp(14px,3.2vw,18px) clamp(18px,4.2vw,28px)',
        }}
      >
        {photos.map((item, index) => (
          <AssetPicker
            key={item.field}
            value={widget[item.field] || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ [item.field]: value } as Partial<WidgetConfig>) : undefined}
            accept="image/*"
            kind="image"
            title={`设置第 ${index + 1} 张拍立得`}
            placeholder="粘贴图片链接"
            className="block min-w-0 flex-1"
          >
            <div
              className="relative mx-auto rounded-[7px] bg-white/96 px-[8px] pb-[24px] pt-[8px] shadow-[0_12px_20px_rgba(15,23,42,0.1)]"
              style={{
                transform: `rotate(${item.rotate}deg)`,
                width: isPreview
                  ? index === 1
                    ? 34
                    : 32
                  : index === 1
                    ? 'clamp(108px, 27vw, 124px)'
                    : 'clamp(102px, 26vw, 118px)',
                paddingBottom: isPreview ? 8 : 24,
                paddingTop: isPreview ? 4 : 8,
                paddingLeft: isPreview ? 4 : 8,
                paddingRight: isPreview ? 4 : 8,
              }}
            >
              <ImageTile
                src={item.src}
                hint="点这里上传图片"
                className={isPreview ? 'aspect-[0.82/1] rounded-[2px] bg-zinc-200' : 'aspect-[0.82/1] rounded-[3px] bg-zinc-200'}
              />
              {index === 2 ? (
                <Heart size={isPreview ? 9 : 18} className={isPreview ? 'absolute right-1.5 top-1.5 text-zinc-700/72' : 'absolute right-3 top-3 text-zinc-700/72'} />
              ) : null}
            </div>
          </AssetPicker>
        ))}
      </div>
    </GlassShell>
  );
}

function GlassRecentGrid({
  widget,
  onWidgetChange,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
}) {
  const images = useMemo(() => normalizeImages(widget.images, 6), [widget.images]);
  const image0 = useWidgetAsset(images[0]);
  const image1 = useWidgetAsset(images[1]);
  const image2 = useWidgetAsset(images[2]);
  const image3 = useWidgetAsset(images[3]);
  const image4 = useWidgetAsset(images[4]);
  const image5 = useWidgetAsset(images[5]);
  const resolvedImages = [image0, image1, image2, image3, image4, image5];

  const updateImageAtIndex = (index: number, value: string) => {
    const nextImages = [...images];
    nextImages[index] = value;
    onWidgetChange?.({ images: nextImages });
  };

  return (
    <GlassShell widget={widget}>
      <div className="flex h-full min-h-0 flex-col px-[clamp(4px,1vw,6px)] pb-[clamp(4px,1vw,6px)] pt-[clamp(10px,2.5vw,14px)]">
        <div className="flex items-center justify-between gap-3 px-[clamp(10px,2.8vw,14px)] pb-[clamp(8px,2vw,10px)]">
          <InlineEditableText
            value={widget.title || ''}
            onChange={onWidgetChange ? value => onWidgetChange({ title: value }) : undefined}
            tag="p"
            className="min-w-0 truncate text-[14px] font-semibold text-zinc-800"
            inputClassName="min-w-0 rounded-xl border border-black/10 bg-white/85 px-2 py-1 text-[14px] font-semibold text-zinc-800 outline-none"
            placeholder="点这里写标题"
          />
          <div className="flex shrink-0 items-center gap-1 text-zinc-500">
            <InlineEditableText
              value={widget.note || ''}
              onChange={onWidgetChange ? value => onWidgetChange({ note: value }) : undefined}
              className="max-w-[7rem] truncate text-[11px] font-medium text-zinc-500"
              inputClassName="w-[7rem] rounded-xl border border-black/10 bg-white/85 px-2 py-1 text-[11px] font-medium text-zinc-500 outline-none"
              placeholder="点这里写右侧文案"
            />
            <ChevronRight size={12} />
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 grid-cols-3 overflow-hidden rounded-[22px] border border-white/45 bg-white/50"
          style={{ gridTemplateRows: 'repeat(2, minmax(0, 1fr))', gap: '1px' }}
        >
          {resolvedImages.map((image, index) => (
            <AssetPicker
              key={index}
              value={images[index]}
              onChange={onWidgetChange ? value => updateImageAtIndex(index, value) : undefined}
              accept="image/*"
              kind="image"
              title={`设置第 ${index + 1} 张图片`}
              placeholder="粘贴图片链接"
              className="block h-full min-h-0"
            >
              <div className="relative h-full w-full overflow-hidden bg-white/26">
                <ImageTile
                  src={image}
                  hint="点这里上传图片"
                  className="h-full w-full bg-zinc-200/88"
                />
                <Heart size={16} className="absolute bottom-2 left-2 text-white drop-shadow-[0_2px_6px_rgba(15,23,42,0.35)]" />
              </div>
            </AssetPicker>
          ))}
        </div>
      </div>
    </GlassShell>
  );
}

export function isGlassDesktopWidgetType(type: WidgetConfig['type']): type is GlassDesktopWidgetType {
  return GLASS_WIDGET_TYPES.includes(type as GlassDesktopWidgetType);
}

export function GlassDesktopWidgetContent({
  widget,
  onWidgetChange,
  isPreview = false,
}: {
  widget: WidgetConfig;
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void;
  isPreview?: boolean;
}) {
  switch (widget.type) {
    case 'glass-duo-card':
      return <GlassDuoCard widget={widget} onWidgetChange={onWidgetChange} isPreview={isPreview} />;
    case 'glass-vinyl-player':
      return <GlassVinylPlayer widget={widget} onWidgetChange={onWidgetChange} isPreview={isPreview} />;
    case 'glass-polaroid-strip':
      return <GlassPolaroidStrip widget={widget} onWidgetChange={onWidgetChange} isPreview={isPreview} />;
    case 'glass-recent-grid':
      return <GlassRecentGrid widget={widget} onWidgetChange={onWidgetChange} />;
    default:
      return null;
  }
}
