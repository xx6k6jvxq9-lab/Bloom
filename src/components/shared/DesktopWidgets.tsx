import React, { useState, useEffect, useRef } from 'react';
import { Clock, Calendar, Heart, Music, Play, SkipForward, SkipBack, Pause, RefreshCw, Cloud, Sun, CloudRain, Wind, Navigation } from 'lucide-react';
import { WidgetConfig, MusicData } from '../../types';

export function DesktopWidget({ widget, isPreview = false, musicData, setMusicData }: { widget: WidgetConfig, isPreview?: boolean, musicData?: MusicData, setMusicData?: React.Dispatch<React.SetStateAction<MusicData>> }) {
  const [time, setTime] = useState(new Date());
  const [weatherData, setWeatherData] = useState<{ temp: number, max: number, min: number, code: number } | null>(null);

  const isPlaying = musicData?.isPlaying || false;
  const progress = musicData?.progress || 0;

  const setIsPlaying = (playing: boolean) => {
    console.log('setIsPlaying called with:', playing);
    if (setMusicData) {
      setMusicData(prev => {
        console.log('setMusicData updater called, prev:', prev);
        return {
          ...prev,
          isPlaying: playing
        };
      });
    }
  };

  useEffect(() => {
    if (widget.type === 'weather') {
      const fetchWeather = async (lat: number, lon: number) => {
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
          const data = await res.json();
          setWeatherData({
            temp: Math.round(data.current_weather.temperature),
            max: Math.round(data.daily.temperature_2m_max[0]),
            min: Math.round(data.daily.temperature_2m_min[0]),
            code: data.current_weather.weathercode
          });
        } catch (err) {
          console.error('Weather fetch error:', err);
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
    }
  }, [widget.type]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      if (isPlaying && setMusicData) {
        setMusicData(prev => ({
          ...prev,
          progress: (prev.progress + 1) % 100
        }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying, setMusicData]);

  const getWidgetContent = () => {
    if (!widget) return null;
    const isLightBg = widget.background === '#ffffff' || widget.background === '#fff';
    const textColor = isLightBg ? 'text-zinc-800' : 'text-white';
    const subTextColor = isLightBg ? 'text-zinc-500' : 'text-white/60';
    const iconColor = isLightBg ? 'text-zinc-400' : 'text-white/40';

    // Scale factors based on widget size (base is 2x2)
    const scale = Math.min(widget.w || 2, widget.h || 2) / 2;
    const padding = Math.max(8, 16 * scale);

    switch (widget.type) {
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
      case 'music':
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
                  className={`rounded-full bg-zinc-900 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-zinc-500/20`}
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

  if (!widget) return null;

  const isImageBackground = widget.background?.startsWith('http') || widget.background?.startsWith('data:image');
  const isLightBg = widget.background === '#ffffff' || widget.background === '#fff';

  return (
    <div 
      className={`relative overflow-hidden shadow-sm border border-black/5 transition-all w-full h-full ${isPreview ? '' : 'hover:shadow-md'}`}
      style={{
        borderRadius: widget.borderRadius !== undefined ? widget.borderRadius : 24,
        opacity: widget.opacity !== undefined ? widget.opacity : 1,
        aspectRatio: isPreview ? `${widget.w}/${widget.h}` : undefined,
        backgroundColor: isImageBackground ? undefined : (widget.background || '#ffffff'),
      }}
    >
      {isImageBackground && (
        <>
          <img 
            src={widget.background} 
            alt="widget-bg" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-110"
            draggable={false}
          />
          {widget.type !== 'blank' && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />}
        </>
      )}
      <div className="absolute inset-0 z-10">
        {getWidgetContent()}
      </div>
    </div>
  );
}
