import React, { useState, useEffect, useRef } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VisualSettings, UserProfileExtended, MusicData } from '../../../types';
import { DesktopWidget } from '../../shared/DesktopWidgets';

type UserProfile = UserProfileExtended;

type AppData = {
  visualSettings?: {
    globalBackground?: string;
  };
  musicData?: MusicData;
  [key: string]: any;
};

export function HomeScreen({ 
  onOpenApp, 
  userProfile, 
  setUserProfile,
  visualSettings,
  setVisualSettings,
  appData,
  setAppData
}: { 
  onOpenApp: (app: 'chat' | 'settings' | 'sms' | 'worldbook' | 'monitor' | 'customization' | 'couple-space' | 'perception' | 'music' | 'forum' | 'wallet') => void; 
  userProfile: UserProfile;
  setUserProfile: (p: UserProfile) => void;
  visualSettings: VisualSettings;
  setVisualSettings: (s: VisualSettings) => void;
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  key?: string;
}) {
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  // Font settings
  const fontFamily = visualSettings?.desktop?.fontFamily;
  const fontSize = visualSettings?.desktop?.fontSize ?? 12;
  const fontColor = visualSettings?.desktop?.fontColor ?? '#ffffff';
  const fontWeight = visualSettings?.desktop?.fontWeight ?? 'normal';

  const fontStyle: React.CSSProperties = {
    fontFamily: fontFamily === 'Mono' ? 'monospace' : fontFamily === 'Serif' ? 'serif' : fontFamily === 'Cursive' ? 'cursive' : fontFamily === 'Inter' ? 'sans-serif' : undefined,
    fontSize: `${fontSize}px`,
    color: fontColor,
    fontWeight: fontWeight === 'bold' ? 'bold' : fontWeight === 'lighter' ? 'lighter' : 'normal',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
  };
  const [showMoodMenu, setShowMoodMenu] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const [appOrder] = useState<string[]>(() => {
    const order = visualSettings?.desktop?.appOrder || ['chat', 'settings', 'worldbook', 'monitor', 'couple-space', 'perception', 'music'];
    const filteredOrder = order.filter(id => id !== 'wallet');
    if (!filteredOrder.includes('perception')) {
      filteredOrder.push('perception');
    }
    if (!filteredOrder.includes('music')) {
      filteredOrder.push('music');
    }
    if (!filteredOrder.includes('forum')) {
      filteredOrder.push('forum');
    }
    return filteredOrder;
  });

  useEffect(() => {
    if (JSON.stringify(appOrder) !== JSON.stringify(visualSettings?.desktop?.appOrder)) {
      setVisualSettings({
        ...visualSettings,
        desktop: {
          ...visualSettings.desktop,
          appOrder
        }
      });
    }
  }, [appOrder]);
  
  const apps = React.useMemo(() => [
    { id: 'chat', name: '聊天', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => onOpenApp('chat') },
    { id: 'settings', name: 'API 中心', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => onOpenApp('settings') },
    { id: 'worldbook', name: '世界书', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => onOpenApp('worldbook') },
    { id: 'monitor', name: '监控功能', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => onOpenApp('monitor') },
    { id: 'couple-space', name: '情侣空间', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => onOpenApp('couple-space') },
    { id: 'perception', name: '感知', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => onOpenApp('perception') },
    { id: 'music', name: '音乐', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => {
      onOpenApp('music');
      setAppData(prev => ({
        ...prev,
        musicData: {
          ...prev.musicData!,
          isPlaying: !prev.musicData?.isPlaying
        }
      }));
    } },
    { id: 'forum', name: '论坛', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => onOpenApp('forum') },
    { id: 'wallet', name: '钱包', icon: "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg", onClick: () => onOpenApp('wallet') },
  ], [setAppData, onOpenApp]);
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const moodOptions = [
    '(≧▽≦)',
    '(๑˃̵ᴗ˂̵)و',
    "(●'◡'●)",
    '(´▽｀)',
    'ヽ(✿ﾟ▽ﾟ)ノ',
    '(≧∇≦)ﾉ',
    '(๑•̀ㅂ•́)و✧',
    '٩(ˊᗜˋ*)و',
    '(^▽^)',
    '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
    '(｡♥‿♥｡)',
    '(ฅ´ωฅ)',
    '(｡･ω･｡)',
    '(=^･ω･^=)',
    '(๑• . •๑)',
    '(づ｡◕‿‿◕｡)づ',
    'ʕ•ᴥ•ʔ',
    '(❁´◡❁)',
    '(〃ω〃)',
    '(⁄ ⁄•⁄ω⁄•⁄ ⁄)',
    '(/ω＼)',
    '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)',
    '(,,•́ . •̀,,)',
    '(〃▽〃)',
    '(⁄ ⁄•⁄▽⁄•⁄ ⁄)',
    '(｡ﾉω＼｡)',
    '(｡ì _ í｡)',
    '(；′⌒)',
    '(╥﹏╥)',
    '(｡•́︿•̀｡)',
    '(っ˘̩╭╮˘̩)っ',
    '(ಥ﹏ಥ)',
    '(இ﹏இ｡)',
    '(｡•́︵•̀｡)',
    '(ノ_<。)',
    '(๑¯ω¯๑)',
    '(╯°□°）╯︵ ┻━┻',
    '(｡•ˇ‸ˇ•｡)',
    '(╬ Ò﹏Ó)',
    '(｀Д´*)',
    '(•̀へ •́ ╮)',
    '(◣◢)',
    '٩(╬ʘ益ʘ╬)۶',
    '(¬¬)',
    '(－‸ლ)',
    '(￣￣)',
    'Σ(ﾟдﾟ;)',
    '(⊙_⊙)',
    '(ﾟДﾟ≡ﾟДﾟ)',
    '∑(O_O；)',
    'Σ(っ °Д °;)っ',
    '(；ﾟДﾟ)',
    '(ʘ言ʘ╬)',
    '(☉｡☉)!',
    '(；一_一)',
    '(￣o￣) . z Z',
    '(～﹃～)~zZ',
    '(－ω－) zzZ',
    '(∪｡∪)｡｡｡zzz',
    '(´-ωก`)',
    '(。-ω-)zzz',
    '(｡･ω･)ﾉﾞ',
    '(๑´ㅂ๑)',
    '(ฅ>ω<*ฅ)',
    '(づ￣ 3￣)づ',
    '(๑´•.̫ • ๑)',
    '(●´ω｀●)',
    '(♡˙︶˙♡)',
    '(´,,•ω•,,)',
    '(눈_눈)',
    '(￢_￢)',
    '(ーー;)',
    '(￣▽￣;)'
  ];
  const defaultMood = '(≧▽≦)';
  const currentMood = moodOptions.includes(userProfile.mood || '') ? userProfile.mood : defaultMood;

  useEffect(() => {
    if (!userProfile.mood || !moodOptions.includes(userProfile.mood)) {
      setUserProfile({ ...userProfile, mood: defaultMood });
    }
  }, [setUserProfile, userProfile]);
  const navBarShapeClass = visualSettings?.navBar?.shape === 'rectangle' ? 'rounded-2xl' : visualSettings?.navBar?.shape === 'circle' ? 'rounded-[40px]' : 'rounded-full';

  return (
    <div className="absolute inset-0">
      <img 
        src={appData.visualSettings?.globalBackground || "https://c-ssl.duitang.com/uploads/blog/202403/28/N5Sj9BL7FP0mDy6.png"} 
        alt="Wallpaper" 
        className="absolute inset-0 w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
      
      <div className="relative pt-16 px-4 z-60 flex flex-col gap-8">
        {/* Profile Bar */}
        {visualSettings?.navBar?.show && (
          <div className={`relative z-60 bg-white/20 backdrop-blur-md border border-white/30 px-6 py-3 flex items-center justify-between ${navBarShapeClass} ${
            visualSettings.navBar.style === 'glass' ? 'bg-white/10 backdrop-blur-xl border-white/20' : 
            visualSettings.navBar.style === 'minimal' ? 'bg-transparent border-none backdrop-blur-none' : ''
          }`}>
            {/* Left: Time & Date */}
            <div className="flex flex-col items-start min-w-[80px]">
              <span className="text-white text-[18px] font-bold leading-tight">{timeStr}</span>
              <span className="text-white/80 text-[10px] font-medium">{dateStr}</span>
            </div>

            {/* Middle: Avatar & Name */}
            <div className="flex flex-col items-center relative">
              <button 
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                className="w-20 h-20 -mt-10 rounded-full border-2 border-white/50 overflow-hidden active:scale-90 transition-transform"
              >
                <img src={userProfile.avatar} alt="User" className="w-full h-full object-cover" />
              </button>
              <span className="text-white text-[12px] font-bold mt-1">{userProfile.name}</span>

              {/* Avatar Menu */}
              <AnimatePresence>
                {showAvatarMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute top-14 left-1/2 -translate-x-1/2 w-48 bg-white rounded-2xl shadow-xl p-3 z-50 border border-zinc-100"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400 ml-1">修改名称</label>
                        <input 
                          type="text" 
                          placeholder="输入名称..."
                          value={userProfile.name}
                          onChange={e => setUserProfile({ ...userProfile, name: e.target.value })}
                          className="text-[11px] bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="h-[1px] bg-zinc-100" />
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400 ml-1">更换头像</label>
                        <input 
                          type="text" 
                          placeholder="粘贴图片链接..."
                          value={tempUrl}
                          onChange={e => setTempUrl(e.target.value)}
                          className="text-[11px] bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-1">
                          <button 
                            onClick={() => {
                              if (tempUrl) setUserProfile({ ...userProfile, avatar: tempUrl });
                              setShowAvatarMenu(false);
                              setTempUrl('');
                            }}
                            className="flex-1 text-[11px] bg-blue-500 text-white rounded-lg py-1.5 font-medium active:opacity-80"
                          >
                            确认链接
                          </button>
                          <label className="flex-1 text-[11px] bg-zinc-100 text-zinc-600 rounded-lg py-1.5 font-medium active:opacity-80 text-center cursor-pointer">
                            上传图片
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setUserProfile({ ...userProfile, avatar: reader.result as string });
                                    setShowAvatarMenu(false);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="h-[1px] bg-zinc-100" />
                      <button 
                        onClick={() => {
                          setUserProfile({ ...userProfile, avatar: `https://picsum.photos/seed/${Math.random()}/200` });
                          setShowAvatarMenu(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50 rounded-lg flex items-center gap-2"
                      >
                        <RefreshCw size={12} /> 随机头像
                      </button>
                      <button 
                        onClick={() => {
                          setUserProfile({ ...userProfile, avatar: 'https://picsum.photos/seed/user/200' });
                          setShowAvatarMenu(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2"
                      >
                        <Trash2 size={12} /> 重置头像
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Mood */}
            <div className="relative min-w-[80px] flex justify-end">
              <button 
                onClick={() => setShowMoodMenu(!showMoodMenu)}
                className="flex items-center justify-end active:opacity-70 text-[0] [&>span:first-child]:hidden"
              >
                <span className="text-white/60 text-[9px] font-bold uppercase tracking-wider">今日心情</span>
                <span className="text-white text-[16px] font-medium">{currentMood}</span>
              </button>

              {/* Mood Menu */}
              <AnimatePresence>
                {showMoodMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute top-12 right-0 w-56 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-xl p-2 z-50 border border-zinc-100 grid grid-cols-1 gap-1"
                  >
                    {moodOptions.map(m => (
                      <button
                        key={m}
                        onClick={() => {
                          setUserProfile({ ...userProfile, mood: m });
                          setShowMoodMenu(false);
                        }}
                        className="text-[13px] py-2 px-2 text-left whitespace-nowrap hover:bg-zinc-50 rounded-lg transition-colors"
                      >
                        {m}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

      </div>

        {/* Widgets and App Icons Layer - Absolute Positioned */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          {visualSettings?.widgets && visualSettings.widgets.map((widget, index) => {
             // Default positioning logic for new widgets if x/y are undefined
             // We'll place them in a grid-like manner at the top
             
             // If x/y are undefined (newly added), calculate a default position
             const defaultX = 24 + (index % 2) * 170;
             const defaultY = 160 + Math.floor(index / 2) * 170; // Increased to 160 to avoid header overlap
             
             // Use nullish coalescing operator to allow 0 as a valid position
             const x = widget.x ?? defaultX;
             const y = widget.y ?? defaultY;

             return (
               <DraggableWidget
                 key={widget.id}
                 widget={widget}
                 x={x}
                 y={y}
                 appData={appData}
                 setAppData={setAppData}
                 onPositionChange={(newX, newY) => {
                   const currentWidgets = visualSettings.widgets || [];
                   const existingIndex = currentWidgets.findIndex(w => w.id === widget.id);
                   let newWidgets;
                   
                   if (existingIndex >= 0) {
                     newWidgets = [...currentWidgets];
                     newWidgets[existingIndex] = { ...newWidgets[existingIndex], x: newX, y: newY };
                   } else {
                     // Should not happen for existing widgets
                     newWidgets = currentWidgets;
                   }
                   
                   setVisualSettings({
                     ...visualSettings,
                     widgets: newWidgets
                   });
                 }}
               />
             );
          })}

          {appOrder.map((appId, index) => {
            const app = apps.find(a => a.id === appId);
            if (!app) return null;
            
            const iconConfig = visualSettings.desktopIcons?.find(i => i.id === appId);
            const iconSize = visualSettings?.desktop?.iconSize ?? 56;
            const gap = visualSettings?.desktop?.gridGap ?? 16;
            const cols = visualSettings?.desktop?.gridColumns ?? 4;
            
            // Calculate default position if not set
            // We'll place them in a grid starting below the header area
            const defaultStartY = 200; 
            const col = index % cols;
            const row = Math.floor(index / cols);
            const defaultX = 24 + col * (iconSize + gap + 20); // 24 is padding-left
            const defaultY = defaultStartY + row * (iconSize + gap + 30);

            const x = iconConfig?.x ?? defaultX;
            const y = iconConfig?.y ?? defaultY;

            return (
              <DraggableAppIcon
                key={app.id}
                app={app}
                x={x}
                y={y}
                visualSettings={visualSettings}
                onPositionChange={(newX, newY) => {
                  const currentIcons = visualSettings.desktopIcons || [];
                  const existingIndex = currentIcons.findIndex(i => i.id === appId);
                  let newIcons;
                  
                  if (existingIndex >= 0) {
                    newIcons = [...currentIcons];
                    newIcons[existingIndex] = { ...newIcons[existingIndex], x: newX, y: newY };
                  } else {
                    newIcons = [...currentIcons, { id: appId, x: newX, y: newY }];
                  }
                  
                  setVisualSettings({
                    ...visualSettings,
                    desktopIcons: newIcons
                  });
                }}
              />
            );
          })}
        </div>

      {/* Bottom Dock */}
      <div className="absolute bottom-6 left-4 right-4 z-50">
        <div className="bg-white/25 backdrop-blur-2xl border border-white/30 rounded-[40px] px-4 py-4 flex items-center justify-around shadow-2xl">
          <button 
            onClick={() => onOpenApp('wallet')}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          >
            <div 
              className="overflow-hidden shadow-sm relative"
              style={{
                width: visualSettings?.desktop?.iconSize ?? 56,
                height: visualSettings?.desktop?.iconSize ?? 56,
                borderRadius: visualSettings?.desktop?.iconBorderRadius ?? 14
              }}
            >
              <img 
                src={visualSettings?.desktopIcons?.find(i => i.id === 'wallet')?.iconUrl || "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg"} 
                className="absolute inset-0 w-full h-full object-cover" 
                alt="钱包" 
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-bold drop-shadow-sm" style={fontStyle}>钱包</span>
          </button>

          <button 
            onClick={() => onOpenApp('sms')}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          >
            <div 
              className="overflow-hidden shadow-sm relative"
              style={{
                width: visualSettings?.desktop?.iconSize ?? 56,
                height: visualSettings?.desktop?.iconSize ?? 56,
                borderRadius: visualSettings?.desktop?.iconBorderRadius ?? 14
              }}
            >
              <img 
                src={visualSettings?.desktopIcons?.find(i => i.id === 'sms')?.iconUrl || "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg"} 
                className="absolute inset-0 w-full h-full object-cover" 
                alt="短信" 
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-bold drop-shadow-sm" style={fontStyle}>短信</span>
          </button>

          <button 
            onClick={() => onOpenApp('customization')}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          >
            <div 
              className="overflow-hidden shadow-sm relative"
              style={{
                width: visualSettings?.desktop?.iconSize ?? 56,
                height: visualSettings?.desktop?.iconSize ?? 56,
                borderRadius: visualSettings?.desktop?.iconBorderRadius ?? 14
              }}
            >
              <img 
                src={visualSettings?.desktopIcons?.find(i => i.id === 'customization')?.iconUrl || "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg"} 
                className="absolute inset-0 w-full h-full object-cover" 
                alt="自定义" 
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-bold drop-shadow-sm" style={fontStyle}>自定义</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DraggableWidget({ widget, x, y, onPositionChange, appData, setAppData }: { 
  widget: any, 
  x: number, 
  y: number, 
  onPositionChange: (x: number, y: number) => void,
  appData: AppData,
  setAppData: React.Dispatch<React.SetStateAction<AppData>>,
  key?: string
}) {
  const isDragging = useRef(false);
  
  const width = (widget.w || 2) * 80 + ((widget.w || 2) - 1) * 16;
  const height = (widget.h || 2) * 80 + ((widget.h || 2) - 1) * 16;

  return (
    <motion.div
      initial={{ x, y }}
      animate={{ x, y }}
      drag
      dragMomentum={false}
      onDragStart={() => {
        isDragging.current = true;
      }}
      onDragEnd={(_, info) => {
        setTimeout(() => {
          isDragging.current = false;
        }, 50);
        onPositionChange(x + info.offset.x, y + info.offset.y);
      }}
      className="absolute pointer-events-auto touch-none"
      style={{
        width,
        height,
        left: 0,
        top: 0,
      }}
      whileDrag={{ scale: 1.02, zIndex: 100, cursor: 'grabbing' }}
    >
      <DesktopWidget
        widget={widget}
        musicData={appData.musicData}
        setMusicData={(setterOrValue) =>
          setAppData(prev => {
            const prevMusicData = prev.musicData!;
            const nextMusicData =
              typeof setterOrValue === 'function'
                ? (setterOrValue as (value: MusicData) => MusicData)(prevMusicData)
                : setterOrValue;
            return { ...prev, musicData: nextMusicData };
          })
        }
      />
    </motion.div>
  );
}

function DraggableAppIcon({ app, x, y, visualSettings, onPositionChange }: { 
  app: { id: string, name: string, icon: string, onClick: () => void }, 
  x: number, 
  y: number, 
  visualSettings: VisualSettings,
  onPositionChange: (x: number, y: number) => void,
  key?: string
}) {
  const isDragging = useRef(false);

  return (
    <motion.div
      initial={{ x, y }}
      animate={{ x, y }}
      drag
      dragMomentum={false}
      onDragStart={() => {
        isDragging.current = true;
      }}
      onDragEnd={(_, info) => {
        // Use a small timeout to ensure the click handler sees the drag state
        setTimeout(() => {
          isDragging.current = false;
        }, 50);
        onPositionChange(x + info.offset.x, y + info.offset.y);
      }}
      className="absolute pointer-events-auto touch-none"
      style={{ left: 0, top: 0 }}
      whileDrag={{ scale: 1.1, zIndex: 100, cursor: 'grabbing' }}
      whileTap={{ scale: 0.95 }}
    >
      <div onClick={(e) => {
        if (isDragging.current) {
          e.stopPropagation();
          return;
        }
        app.onClick();
      }}>
        <AppIcon 
          id={app.id} 
          name={app.name} 
          icon={app.icon} 
          onClick={() => {}} // Pass empty onClick to AppIcon as we handle it in wrapper
          visualSettings={visualSettings} 
        />
      </div>
    </motion.div>
  );
}

function AppIcon({ id, name, icon, onClick, visualSettings, iconSize }: { id: string; name: string; icon?: string; onClick: () => void; visualSettings?: VisualSettings; iconSize?: number }) {
  const customIcon = visualSettings?.desktopIcons?.find(i => i.id === id)?.iconUrl;
  const finalIcon = customIcon || icon || "https://c-ssl.duitang.com/uploads/blog/202205/25/20220525011506_45659.jpeg";
  const finalIconSize = iconSize ?? visualSettings?.desktop?.iconSize ?? 56;

  // Font settings
  const fontFamily = visualSettings?.desktop?.fontFamily;
  const fontSize = visualSettings?.desktop?.fontSize ?? 12;
  const fontColor = visualSettings?.desktop?.fontColor ?? '#ffffff';
  const fontWeight = visualSettings?.desktop?.fontWeight ?? 'normal';

  const fontStyle: React.CSSProperties = {
    fontFamily: fontFamily === 'Mono' ? 'monospace' : fontFamily === 'Serif' ? 'serif' : fontFamily === 'Cursive' ? 'cursive' : fontFamily === 'Inter' ? 'sans-serif' : undefined,
    fontSize: `${fontSize}px`,
    color: fontColor,
    fontWeight: fontWeight === 'bold' ? 'bold' : fontWeight === 'lighter' ? 'lighter' : 'normal',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
  };

  return (
    <div className="flex flex-col items-center gap-1.5 cursor-pointer group transition-transform active:scale-95" onClick={onClick}>
      <div 
        className="overflow-hidden shadow-md relative"
        style={{
          width: finalIconSize,
          height: finalIconSize,
          borderRadius: visualSettings?.desktop?.iconBorderRadius ?? 14
        }}
      >
        <img 
          src={finalIcon} 
          className="absolute inset-0 w-full h-full object-cover" 
          alt={name} 
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </div>
      <span 
        className="font-medium drop-shadow-md tracking-wide"
        style={fontStyle}
      >
        {name}
      </span>
    </div>
  );
}

