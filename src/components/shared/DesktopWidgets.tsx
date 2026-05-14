import React, { useEffect, useRef, useState } from 'react';
import { Clock, Calendar, Heart, Music, Play, SkipForward, SkipBack, Pause, RefreshCw, Cloud, Sun, CloudRain, Wind, Navigation, ImagePlus, MapPin } from 'lucide-react';
import { WidgetConfig, MusicData } from '../../types';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { usePersistentFieldActions } from '../../features/persistence/usePersistentFieldActions';
import {
  KawaiiDesktopWidgetContent,
  isFloatingKawaiiDesktopWidgetType,
  isKawaiiDesktopWidgetType,
  shouldShowKawaiiLauncherPlate,
  shouldShowKawaiiScrapbookPlate,
} from './KawaiiDesktopWidgets';
import {
  GlassDesktopWidgetContent,
  isGlassDesktopWidgetType,
} from './GlassDesktopWidgets';

const FLOATING_TIME_FONT_FAMILY = '"SF Pro Display", "SF Pro Text", "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function clampFloatingTimeWeight(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 700;
  }

  return Math.min(900, Math.max(200, Math.round(value / 100) * 100));
}

function formatFloatingTimeSolarDate(date: Date) {
  return date
    .toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
    .replace('星期', '周')
    .replace(/\s+/g, '');
}

function formatFloatingTimeLunarDate(date: Date) {
  try {
    const formatted = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
    return formatted.replace(/^\d+/, '').trim();
  } catch {
    return '';
  }
}

function buildFloatingTimeDateLine(date: Date, showLunar: boolean) {
  const solar = formatFloatingTimeSolarDate(date);
  const lunar = showLunar ? formatFloatingTimeLunarDate(date) : '';
  return lunar ? `${solar} · ${lunar}` : solar;
}

export function DesktopWidget({
  widget,
  isPreview = false,
  musicData,
  setMusicData,
  onWidgetChange,
  onRequestEdit,
}: {
  widget: WidgetConfig,
  isPreview?: boolean,
  musicData?: MusicData,
  setMusicData?: React.Dispatch<React.SetStateAction<MusicData>>,
  onWidgetChange?: (updates: Partial<WidgetConfig>) => void,
  onRequestEdit?: () => void,
}) {
  const [time, setTime] = useState(new Date());
  const [weatherData, setWeatherData] = useState<{ temp: number, max: number, min: number, code: number } | null>(null);
  const [editingField, setEditingField] = useState<'profileName' | 'handle' | 'bio' | 'location' | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [imageMenuTarget, setImageMenuTarget] = useState<'bannerUrl' | 'avatarUrl' | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const setMusicDataRef = useRef(setMusicData);

  const isPlaying = musicData?.isPlaying || false;
  const progress = musicData?.progress || 0;
  const shouldFetchWeather = widget.type === 'weather' && !isPreview;

  useEffect(() => {
    setMusicDataRef.current = setMusicData;
  }, [setMusicData]);

  const setIsPlaying = (playing: boolean) => {
    const applyMusicData = setMusicDataRef.current;
    if (applyMusicData) {
      applyMusicData(prev => {
        return {
          ...prev,
          isPlaying: playing
        };
      });
    }
  };

  useEffect(() => {
    if (!shouldFetchWeather) {
      return;
    }

    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
        );
        if (!res.ok) {
          if (res.status === 429) {
            setWeatherData(null);
            return;
          }
          throw new Error(`Weather request failed with status ${res.status}`);
        }
        const data = await res.json();
        const current = data.current ?? data.current_weather ?? null;
        const daily = data.daily ?? null;
        const temp = typeof current?.temperature_2m === 'number'
          ? current.temperature_2m
          : typeof current?.temperature === 'number'
            ? current.temperature
            : null;
        const code = typeof current?.weather_code === 'number'
          ? current.weather_code
          : typeof current?.weathercode === 'number'
            ? current.weathercode
            : null;
        const max = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
        const min = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min[0] : null;

        if (temp === null || code === null || typeof max !== 'number' || typeof min !== 'number') {
          throw new Error('Weather response missing required fields');
        }

        setWeatherData({
          temp: Math.round(temp),
          max: Math.round(max),
          min: Math.round(min),
          code,
        });
      } catch (err) {
        console.error('Weather fetch error:', err);
        setWeatherData(null);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(31.36, 113.14) // Fallback to a default location if denied
      );
    } else {
      fetchWeather(31.36, 113.14);
    }
  }, [shouldFetchWeather]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      const applyMusicData = setMusicDataRef.current;
      if (isPlaying && applyMusicData) {
        applyMusicData(prev => ({
          ...prev,
          progress: (prev.progress + 1) % 100
        }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const profileName = widget.profileName || '自定义';
  const profileHandle = widget.handle || '自定义';
  const profileBio = widget.bio || '自定义';
  const profileLocation = widget.location || '自定义';
  const bannerUrl = widget.bannerUrl || '';
  const avatarUrl = widget.avatarUrl || '';
  const isFloatingKawaiiWidget = isFloatingKawaiiDesktopWidgetType(widget.type);
  const backgroundValue =
    isFloatingKawaiiWidget && widget.background === '#f4efe8'
      ? 'transparent'
      : widget.background;
  const { resolvedUrl: resolvedBannerUrl } = useResolvedPersistentValue(bannerUrl);
  const { resolvedUrl: resolvedAvatarUrl } = useResolvedPersistentValue(avatarUrl);
  const { setRemoteUrl, setUploadedFile } = usePersistentFieldActions();
  const commitField = () => {
    if (!editingField) return;
    onWidgetChange?.({ [editingField]: draftValue.trim() || '自定义' } as Partial<WidgetConfig>);
    setEditingField(null);
    setDraftValue('');
  };

  const startEditing = (field: 'profileName' | 'handle' | 'bio' | 'location', value: string) => {
    if (!onWidgetChange) return;
    setEditingField(field);
    setDraftValue(value === '自定义' ? '' : value);
  };

  const handleImageFile = async (event: React.ChangeEvent<HTMLInputElement>, target: 'bannerUrl' | 'avatarUrl') => {
    const file = event.target.files?.[0];
    if (!file || !onWidgetChange) return;
    try {
      const nextValue = await setUploadedFile(file);
      onWidgetChange({ [target]: nextValue } as Partial<WidgetConfig>);
    } catch (error) {
      console.error('Profile card image upload failed:', error);
    }
    event.target.value = '';
    setImageMenuTarget(null);
    setImageUrlDraft('');
  };

  const openImageMenu = (target: 'bannerUrl' | 'avatarUrl', currentValue: string) => {
    if (!onWidgetChange) return;
    setImageMenuTarget(target);
    setImageUrlDraft(currentValue);
  };

  const applyImageUrl = async () => {
    if (!imageMenuTarget || !onWidgetChange) return;
    const nextValue = await setRemoteUrl(imageUrlDraft.trim());
    onWidgetChange({ [imageMenuTarget]: nextValue } as Partial<WidgetConfig>);
    setImageMenuTarget(null);
    setImageUrlDraft('');
  };

  const renderEditableText = (
    field: 'profileName' | 'handle' | 'bio' | 'location',
    value: string,
    className: string,
    multiline = false,
  ) => {
    if (editingField === field) {
      if (multiline) {
        return (
          <textarea
            autoFocus
            value={draftValue}
            onChange={e => setDraftValue(e.target.value)}
            onBlur={commitField}
            className={`${className} resize-none rounded-xl border border-black/10 bg-white/80 px-2 py-1 outline-none`}
            rows={2}
          />
        );
      }

      return (
        <input
          autoFocus
          value={draftValue}
          onChange={e => setDraftValue(e.target.value)}
          onBlur={commitField}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitField();
            }
          }}
          className={`${className} rounded-xl border border-black/10 bg-white/80 px-2 py-1 outline-none`}
        />
      );
    }

    return (
      <button type="button" onClick={() => startEditing(field, value)} className={`${className} text-left transition-opacity hover:opacity-80`}>
        {value || '自定义'}
      </button>
    );
  };

  const getWidgetContent = () => {
    if (!widget) return null;
    const isLightBg = widget.background === '#ffffff' || widget.background === '#fff';
    const textColor = isLightBg ? 'text-zinc-800' : 'text-white';
    const subTextColor = isLightBg ? 'text-zinc-500' : 'text-white/60';
    const iconColor = isLightBg ? 'text-zinc-400' : 'text-white/40';

    // Scale factors based on widget size (base is 2x2)
    const scale = Math.min(widget.w || 2, widget.h || 2) / 2;
    const padding = Math.max(8, 16 * scale);

    const widgetType = (widget as { type?: string }).type;

    switch (widgetType) {
      case 'kawaii-launcher':
      case 'kawaii-couple-pills':
      case 'kawaii-scrapbook':
        return <KawaiiDesktopWidgetContent widget={widget} onWidgetChange={onWidgetChange} />;
      case 'glass-duo-card':
      case 'glass-vinyl-player':
      case 'glass-polaroid-strip':
      case 'glass-recent-grid':
        return <GlassDesktopWidgetContent widget={widget} onWidgetChange={onWidgetChange} isPreview={isPreview} />;
      case 'time':
        if (widget.style === 'minimal') {
          return (
            <div className={`flex flex-col items-center justify-center h-full ${textColor}`} style={{ padding }}>
              <span className="font-bold font-mono tracking-tighter" style={{ fontSize: `${48 * scale}px` }}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          );
        }
        return (
          <div className={`flex flex-col items-center justify-center h-full ${textColor}`} style={{ padding }}>
            <div className="flex items-baseline gap-1">
              <span className="font-bold font-mono tracking-tight leading-none" style={{ fontSize: `${36 * scale}px` }}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {widget.w >= 2 && (
                <span className={`font-mono ${subTextColor} animate-pulse`} style={{ fontSize: `${18 * scale}px` }}>
                  :{time.getSeconds().toString().padStart(2, '0')}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-2 mt-2 ${subTextColor} font-medium uppercase tracking-wider`} style={{ fontSize: `${Math.max(10, 12 * scale)}px` }}>
              <Calendar size={12 * scale} />
              <span>
                {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        );
      case 'floating-time': {
        const showDate = widget.showDate !== false;
        const showLunar = widget.showLunar !== false;
        const showOutline = widget.showOutline !== false;
        const datePosition = widget.datePosition === 'bottom' ? 'bottom' : 'top';
        const textAlign = widget.textAlign === 'left' || widget.textAlign === 'right' ? widget.textAlign : 'center';
        const justifyContent = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
        const alignClass = textAlign === 'left'
          ? 'items-start text-left'
          : textAlign === 'right'
            ? 'items-end text-right'
            : 'items-center text-center';
        const compactRow = (widget.h || 2) <= 1;
        const wideRow = (widget.w || 2) >= 4;
        const heroScaleBase = compactRow ? scale * 0.88 : scale * 0.98;
        const heroScale = Math.max(0.62, Math.min(1.18, heroScaleBase * (wideRow ? 0.92 : 1)));
        const timeFontSize = Math.max(compactRow ? 48 : 54, Math.round((compactRow ? 88 : 96) * heroScale));
        const dateFontSize = Math.max(compactRow ? 10 : 12, Math.round((compactRow ? 12.5 : 14.5) * heroScale));
        const timeWeight = clampFloatingTimeWeight(widget.timeWeight);
        const timeColor = widget.timeColor?.trim() || '#6f7892';
        const dateColor = widget.dateColor?.trim() || '#7c8499';
        const dateLine = buildFloatingTimeDateLine(time, showLunar);
        const timeLabel = time.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const outlinePaddingY = Math.max(compactRow ? 8 : 10, Math.round((compactRow ? 10 : 13) * heroScale));
        const outlinePaddingX = Math.max(compactRow ? 10 : 14, Math.round((compactRow ? 14 : 18) * heroScale));

        return (
          <div
            className={`flex h-full w-full flex-col justify-center ${alignClass}`}
            style={{ padding: `${Math.max(6, 10 * heroScale)}px ${Math.max(8, 14 * heroScale)}px` }}
          >
            {showDate && datePosition === 'top' ? (
              <div
                className="mb-2.5 font-semibold tracking-[0.02em]"
                style={{
                  color: dateColor,
                  fontSize: `${dateFontSize}px`,
                  lineHeight: 1.2,
                  fontFamily: FLOATING_TIME_FONT_FAMILY,
                }}
              >
                {dateLine}
              </div>
            ) : null}

            <div className="flex w-full" style={{ justifyContent }}>
              <div
                className={showOutline ? 'rounded-[28px]' : undefined}
                style={showOutline ? {
                  border: `1.5px solid ${dateColor}`,
                  padding: `${outlinePaddingY}px ${outlinePaddingX}px`,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                } : undefined}
              >
                <span
                  className="block tabular-nums"
                  style={{
                    color: timeColor,
                    fontFamily: FLOATING_TIME_FONT_FAMILY,
                    fontSize: `${timeFontSize}px`,
                    fontWeight: timeWeight,
                    lineHeight: 0.86,
                    letterSpacing: `${Math.min(-1.5, -0.045 * timeFontSize)}px`,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {timeLabel}
                </span>
              </div>
            </div>

            {showDate && datePosition === 'bottom' ? (
              <div
                className="mt-2.5 font-semibold tracking-[0.02em]"
                style={{
                  color: dateColor,
                  fontSize: `${dateFontSize}px`,
                  lineHeight: 1.2,
                  fontFamily: FLOATING_TIME_FONT_FAMILY,
                }}
              >
                {dateLine}
              </div>
            ) : null}
          </div>
        );
      }
      case 'calendar':
        if (widget.style === 'list') {
          return (
            <div className={`flex flex-col h-full ${textColor}`} style={{ padding }}>
              <span className={`font-bold uppercase tracking-widest ${subTextColor} mb-2`} style={{ fontSize: `${Math.max(10, 12 * scale)}px` }}>
                {time.toLocaleDateString([], { month: 'short', year: 'numeric' })}
              </span>
              <div className="space-y-1">
                {[0, 1, 2].map(i => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  return (
                    <div key={i} className="flex items-center justify-between border-b border-white/10 pb-1">
                      <span className="text-[10px] opacity-60">{d.toLocaleDateString([], { weekday: 'short' })}</span>
                      <span className="text-xs font-bold">{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
        return (
          <div className={`flex flex-col h-full ${textColor}`} style={{ padding }}>
            <div className="flex justify-between items-start">
              <span className={`font-bold uppercase tracking-widest ${subTextColor}`} style={{ fontSize: `${Math.max(9, 11 * scale)}px` }}>
                {time.toLocaleDateString([], { month: 'long' })}
              </span>
              <span className={`font-bold ${isLightBg ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900'} rounded-md`} style={{ fontSize: `${Math.max(9, 11 * scale)}px`, padding: `${2 * scale}px ${6 * scale}px` }}>
                {time.toLocaleDateString([], { weekday: 'short' })}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="font-black tracking-tighter leading-none" style={{ fontSize: `${60 * scale}px` }}>
                {time.getDate()}
              </span>
            </div>
            <div className={`flex gap-1 justify-center ${subTextColor}`}>
               <div className="w-1 h-1 rounded-full bg-current opacity-50" />
               <div className="w-1 h-1 rounded-full bg-current opacity-30" />
            </div>
          </div>
        );
      case 'anniversary':
        const targetDate = widget.date ? new Date(widget.date) : new Date();
        const diffTime = Math.abs(time.getTime() - targetDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return (
          <div className={`flex flex-col items-center justify-center h-full ${textColor}`} style={{ padding }}>
            <span className={`font-bold ${subTextColor} mb-1`} style={{ fontSize: `${Math.max(10, 12 * scale)}px` }}>{widget.title || '纪念日'}</span>
            <div className="flex items-baseline gap-1">
              <span className="font-black" style={{ fontSize: `${30 * scale}px` }}>{diffDays}</span>
              <span className={`font-medium ${subTextColor}`} style={{ fontSize: `${Math.max(10, 12 * scale)}px` }}>Days</span>
            </div>
          </div>
        );
      case 'weather':
        const getWeatherInfo = (code: number) => {
          if (code === 0) return { label: '晴', icon: <Sun size={20 * scale} className={isLightBg ? "text-zinc-900" : "text-white"} /> };
          if (code <= 3) return { label: '多云', icon: <Cloud size={20 * scale} className={isLightBg ? "text-zinc-600" : "text-white/80"} /> };
          if (code >= 51 && code <= 67) return { label: '小雨', icon: <CloudRain size={20 * scale} className="text-zinc-500" /> };
          if (code >= 80) return { label: '阵雨', icon: <CloudRain size={20 * scale} className="text-zinc-500" /> };
          return { label: '多云', icon: <Cloud size={20 * scale} className={isLightBg ? "text-zinc-600" : "text-white/80"} /> };
        };

        const weather = weatherData || { temp: 11, max: 12, min: 9, code: 2 };
        const info = getWeatherInfo(weather.code);

        return (
          <div className={`flex flex-col h-full ${textColor}`} style={{ padding }}>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-start gap-1">
                <span className="font-light tracking-tighter" style={{ fontSize: `${48 * scale}px` }}>{weather.temp}</span>
                <span className="mt-2 font-light" style={{ fontSize: `${24 * scale}px` }}>°</span>
              </div>
              <div className="flex items-center gap-2 mt-[-4px]">
                {info.icon}
                <span style={{ fontSize: `${Math.max(12, 16 * scale)}px` }} className="font-medium">{info.label}</span>
              </div>
            </div>
            <div className="flex gap-3 opacity-80 font-medium" style={{ fontSize: `${Math.max(10, 14 * scale)}px` }}>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[10px] opacity-60">最高</span>
                <span>{weather.max}°</span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[10px] opacity-60">最低</span>
                <span>{weather.min}°</span>
              </div>
            </div>
          </div>
        );
      case 'profile-card':
        {
          const imageButtonEnabled = Boolean(onWidgetChange);

          return (
            <div className="relative flex h-full flex-col overflow-hidden rounded-[inherit] bg-white">
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageFile(e, 'bannerUrl')} />
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageFile(e, 'avatarUrl')} />

              <button
                type="button"
                onClick={() => openImageMenu('bannerUrl', bannerUrl)}
                className="group relative block h-1/2 w-full overflow-hidden text-left"
              >
                {resolvedBannerUrl ? (
                  <img src={resolvedBannerUrl} alt="banner" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-rose-200 via-pink-100 to-orange-100" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10" />
                {imageButtonEnabled && (
                  <div className="absolute right-3 top-3 rounded-full bg-white/30 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1">
                      <ImagePlus size={12} />
                      更换封面
                    </span>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => openImageMenu('avatarUrl', avatarUrl)}
                className="absolute left-1/2 top-1/2 z-10 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[4px] border-white bg-zinc-100"
              >
                {resolvedAvatarUrl ? (
                  <img src={resolvedAvatarUrl} alt="avatar" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-100 to-rose-100 text-zinc-400">
                    <ImagePlus size={22} />
                  </div>
                )}
              </button>

              <div className="flex flex-1 flex-col items-center justify-center px-4 pb-3 pt-11 text-center text-zinc-900">
                {renderEditableText('profileName', profileName, 'max-w-full truncate text-center text-[15px] font-black text-zinc-900')}
                {renderEditableText('handle', profileHandle, 'mt-1 max-w-full truncate text-center text-[10px] font-medium text-zinc-400')}
                {renderEditableText('bio', profileBio, 'mt-2 w-full px-2 text-center text-[11px] font-medium leading-4 text-zinc-700', true)}
                <div className="mt-2 inline-flex max-w-full items-center justify-center gap-1.5 text-[10px] font-medium text-zinc-500">
                  <MapPin size={13} />
                  {renderEditableText('location', profileLocation, 'max-w-[140px] truncate text-center text-[10px] font-medium text-zinc-500')}
                </div>
              </div>

              {imageMenuTarget && imageButtonEnabled && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/12 px-3" onClick={() => setImageMenuTarget(null)}>
                  <div
                    className="w-full max-w-[240px] rounded-[22px] border border-white/70 bg-white/92 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="mb-3 text-center text-[13px] font-semibold text-zinc-800">
                      {imageMenuTarget === 'bannerUrl' ? '设置背景图片' : '设置头像图片'}
                    </p>
                    <label className="mb-3 flex cursor-pointer items-center justify-center rounded-2xl border border-[#d9e6f7] bg-[#eef5ff] px-3 py-2.5 text-[12px] font-medium text-[#4b6788] transition-colors hover:bg-[#e7f1ff]">
                      直接上传
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleImageFile(e, imageMenuTarget)}
                      />
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={imageUrlDraft}
                        onChange={e => setImageUrlDraft(e.target.value)}
                        placeholder="粘贴 jpg/png/webp/gif/svg 链接"
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-800 outline-none focus:border-zinc-400"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setImageMenuTarget(null)}
                          className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-medium text-zinc-600"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={applyImageUrl}
                          className="flex-1 rounded-2xl border border-[#d9e6f7] bg-[#eef5ff] px-3 py-2 text-[12px] font-medium text-[#4b6788]"
                        >
                          链接上传
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }
      case 'music':
        return null;
        if (widget.style === 'bar') {
          return (
            <div 
              className={`flex items-center h-full rounded-full px-4 gap-4 ${textColor} relative overflow-hidden border border-white/20 shadow-sm`}
              style={{ 
                backgroundColor: isLightBg ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(25px)',
              }}
            >
              {/* Vinyl Record for Bar Style */}
              <div className={`w-10 h-10 rounded-full bg-zinc-950 border-2 border-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}>
                <div className="w-[45%] h-[45%] rounded-full overflow-hidden border border-black/40">
                  <img 
                    src="https://picsum.photos/seed/music/100" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold truncate tracking-tight">old fashioned christmas</div>
                <div className="text-[10px] opacity-60 truncate font-medium">Lyn Lapid</div>
              </div>

              <div className="flex items-center gap-4 pr-1">
                <SkipBack size={16} className="fill-current cursor-pointer opacity-60 hover:opacity-100 transition-opacity" />
                <button onClick={() => {
                  console.log('Pause button clicked, current isPlaying:', isPlaying);
                  setIsPlaying(!isPlaying);
                }} className="hover:scale-110 transition-transform active:scale-95">
                  {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-0.5" />}
                </button>
                <SkipForward size={16} className="fill-current cursor-pointer opacity-60 hover:opacity-100 transition-opacity" />
                <Heart size={16} className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity" />
              </div>
            </div>
          );
        }
        if (widget.style === 'glass') {
          const albumArt = "https://picsum.photos/seed/music/200";
          // Scale record size more aggressively for smaller widgets
          const recordSize = Math.min(120, 80 * scale);
          return (
            <div 
              className={`flex flex-col h-full rounded-[32px] p-3 shadow-2xl relative overflow-hidden ${textColor}`}
              style={{ 
                backgroundColor: isLightBg ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              {/* Main Content Area */}
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 min-h-0">
                {/* Vinyl Record */}
                <div 
                  style={{ width: recordSize, height: recordSize }}
                  className={`rounded-full bg-zinc-950 border-[3px] border-zinc-900/50 shadow-2xl flex items-center justify-center relative flex-shrink-0 ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}
                >
                  {/* Vinyl Grooves */}
                  <div className="absolute inset-0 rounded-full border border-white/5 opacity-20" />
                  <div className="absolute inset-2 rounded-full border border-white/5 opacity-20" />
                  
                  {/* Album Art Center */}
                  <div className="w-[45%] h-[45%] rounded-full overflow-hidden border-2 border-black/40 shadow-inner">
                    <img src={albumArt} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>

                <div className="text-center w-full px-1 mt-2">
                  <div className="font-bold tracking-tight truncate drop-shadow-md" style={{ fontSize: `${Math.max(11, 14 * scale)}px` }}>old fashioned christmas</div>
                  <div className="opacity-70 font-medium truncate" style={{ fontSize: `${Math.max(8, 10 * scale)}px` }}>Lyn Lapid 林·拉皮德</div>
                </div>
              </div>

              {/* Bottom Controls - Fixed at bottom */}
              <div className="flex items-center justify-center gap-6 py-1 relative z-10 mt-auto">
                <Heart size={Math.max(14, 18 * scale)} className="opacity-90 hover:scale-110 transition-transform cursor-pointer" />
                <button onClick={() => setIsPlaying(!isPlaying)} className="hover:scale-110 transition-transform active:scale-90">
                  {isPlaying ? <Pause size={Math.max(20, 24 * scale)} className="fill-current" /> : <Play size={Math.max(20, 24 * scale)} className="fill-current ml-1" />}
                </button>
                <SkipForward size={Math.max(16, 20 * scale)} className="fill-current cursor-pointer hover:scale-110 transition-transform opacity-90" />
              </div>
            </div>
          );
        }
        return (
          <div className={`flex flex-col justify-between h-full ${textColor}`} style={{ padding }}>
            <div className="flex items-center gap-3">
              {/* Vinyl Record / Album Art */}
              <div className="relative group">
                <div 
                  className={`rounded-full shadow-lg relative overflow-hidden flex items-center justify-center bg-zinc-900 border-4 border-zinc-800/50 ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}
                  style={{ width: `${56 * scale}px`, height: `${56 * scale}px` }}
                >
                  {/* Vinyl Grooves */}
                  <div className="absolute inset-0 rounded-full border border-white/5 opacity-20" />
                  <div className="absolute inset-2 rounded-full border border-white/5 opacity-20" />
                  
                  {/* Album Cover Center */}
                  <div className="w-1/2 h-1/2 rounded-full overflow-hidden relative z-10 border border-black/20">
                    <img 
                      src="https://picsum.photos/seed/music/200" 
                      alt="Album" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
                {/* Stylus / Needle (Visual only) */}
                <div 
                  className={`absolute -top-1 -right-1 w-1 h-6 bg-zinc-400 rounded-full origin-top transition-transform duration-500 ${isPlaying ? 'rotate-[25deg]' : 'rotate-0'}`}
                  style={{ width: `${2 * scale}px`, height: `${12 * scale}px` }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold truncate leading-tight" style={{ fontSize: `${Math.max(12, 15 * scale)}px` }}>
                  晴天 (Sunny Day)
                </div>
                <div className={`truncate mt-0.5 font-medium ${subTextColor}`} style={{ fontSize: `${Math.max(9, 11 * scale)}px` }}>
                  周杰伦 (Jay Chou)
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {/* Progress Bar - NetEase Red */}
              <div className="space-y-1">
                <div className={`h-1 w-full ${isLightBg ? 'bg-zinc-100' : 'bg-white/10'} rounded-full overflow-hidden`}>
                  <div 
                    className="h-full bg-zinc-900 rounded-full transition-all duration-1000 ease-linear shadow-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] opacity-40 font-mono">
                  <span>01:24</span>
                  <span>04:30</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center px-1">
                <SkipBack size={18 * scale} className={`${subTextColor} hover:text-zinc-900 transition-colors cursor-pointer active:scale-90`} />
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm transition-all hover:scale-105 hover:bg-zinc-200 active:scale-95`}
                  style={{ width: `${36 * scale}px`, height: `${36 * scale}px` }}
                >
                  {isPlaying ? <Pause size={16 * scale} className="fill-current" /> : <Play size={16 * scale} className="fill-current ml-0.5" />}
                </button>
                <SkipForward size={18 * scale} className={`${subTextColor} hover:text-zinc-900 transition-colors cursor-pointer active:scale-90`} />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const { resolvedUrl: resolvedBackgroundUrl } = useResolvedPersistentValue(backgroundValue);
  const isImageBackground = !!resolvedBackgroundUrl;
  const isLightBg = backgroundValue === '#ffffff' || backgroundValue === '#fff';
  const fallbackBackgroundColor =
    backgroundValue && !backgroundValue.includes('://') && !backgroundValue.startsWith('data:')
      ? backgroundValue
      : '#ffffff';
  const isFloatingTimeWidget = widget.type === 'floating-time';
  const isFloatingWidget = isFloatingKawaiiWidget || isFloatingTimeWidget;
  const shouldApplyImageOverlay = widget.type !== 'blank' && !isKawaiiDesktopWidgetType(widget.type) && !isFloatingTimeWidget;
  const canRequestEdit = Boolean(onRequestEdit && !isPreview && widget.type !== 'profile-card');
  const launcherOwnsOpacity = widget.type === 'kawaii-launcher';
  const launcherOwnsBackground = widget.type === 'kawaii-launcher';
  const scrapbookOwnsOpacity = widget.type === 'kawaii-scrapbook';
  const scrapbookOwnsBackground = widget.type === 'kawaii-scrapbook';
  const glassOwnsChrome = isGlassDesktopWidgetType(widget.type);
  const hideLauncherChrome = widget.type === 'kawaii-launcher' && !shouldShowKawaiiLauncherPlate(widget);
  const hideScrapbookChrome = widget.type === 'kawaii-scrapbook' && !shouldShowKawaiiScrapbookPlate(widget);
  const hideKawaiiChrome = hideLauncherChrome || hideScrapbookChrome || glassOwnsChrome;
  const kawaiiOwnsOpacity = launcherOwnsOpacity || scrapbookOwnsOpacity;
  const kawaiiOwnsBackground = launcherOwnsBackground || scrapbookOwnsBackground;
  const widgetOwnsOpacity = kawaiiOwnsOpacity || glassOwnsChrome || isFloatingTimeWidget;
  const widgetOwnsBackground = kawaiiOwnsBackground || glassOwnsChrome || isFloatingTimeWidget;

  return (
    <div 
      className={`relative w-full h-full transition-all ${isFloatingWidget || hideKawaiiChrome ? 'overflow-visible border-transparent shadow-none' : 'overflow-hidden shadow-sm border border-black/5'} ${!isPreview && !isFloatingWidget && !hideKawaiiChrome ? 'hover:shadow-md' : ''} ${canRequestEdit ? 'cursor-pointer active:scale-[0.99]' : ''}`}
      onClick={() => {
        if (canRequestEdit) {
          onRequestEdit?.();
        }
      }}
      style={{
        borderRadius: isFloatingWidget ? 0 : widget.borderRadius !== undefined ? widget.borderRadius : 24,
        opacity: widgetOwnsOpacity ? 1 : widget.opacity !== undefined ? widget.opacity : 1,
        aspectRatio: isPreview ? `${widget.w}/${widget.h}` : undefined,
        backgroundColor: widgetOwnsBackground || hideKawaiiChrome ? 'transparent' : isImageBackground ? undefined : fallbackBackgroundColor,
      }}
    >
      {isImageBackground && !widgetOwnsBackground && (
        <>
          <img 
            src={resolvedBackgroundUrl || undefined} 
            alt="widget-bg" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-110"
            draggable={false}
          />
          {shouldApplyImageOverlay && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />}
        </>
      )}
      <div className="absolute inset-0 z-10">
        {getWidgetContent()}
      </div>
    </div>
  );
}
