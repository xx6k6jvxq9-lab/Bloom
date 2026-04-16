import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Monitor, MessageSquare, Palette, Database, Image as ImageIcon, Layout, Type, Upload, Download, Trash2, Plus, X, Cloud, Users, Layers, UserPlus, Phone, User, Heart, Ghost, Book, Compass, Share2, Calendar, Star, Settings, Mic, Banknote, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VisualSettings, WidgetConfig, DesktopIconConfig, type ThemeFontAsset } from '../../../types';
import { DesktopWidget } from '../../shared/DesktopWidgets';
import { extractSingleImageUrl, showInAppConfirm } from '../../../utils';
import { usePersistentFieldActions } from '../../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { useResolvedThemeTypographyCss } from '../../../features/theme/useResolvedThemeTypographyCss';
import { getThemeImportedFontFamily, getThemeSelectedFontStack, resolveThemeFontPriority } from '../../../features/theme/themeTypography';
import { ChatBubbleThemeCustomizationSection } from './ChatBubbleThemeCustomizationSection';
import { ThemeCustomizationSection } from './ThemeCustomizationSection';

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
  const [desktopSubTab, setDesktopSubTab] = useState<'wallpaper' | 'icons' | 'layout' | 'widgets' | 'navbar' | 'font'>('wallpaper');
  const [chatSubTab, setChatSubTab] = useState<'avatar' | 'bubble' | 'background' | 'interface' | 'dynamics'>('avatar');
  return (
    <div className="absolute inset-0 bg-zinc-50 text-zinc-900 flex flex-col font-sans z-50">
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
      <div className="flex-1 overflow-hidden flex flex-col">
        <div
          className="flex-1 overflow-y-auto p-4 space-y-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
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
    </div>
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
}: {
  label: string,
  value: string,
  onChange: (val: string) => void,
}) {
  const [localValue, setLocalValue] = useState(value);
  const { resolvedUrl, loading, error } = useResolvedPersistentValue(localValue);
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleConfirm = async () => {
    const nextValue = localValue.trim() ? await setRemoteUrl(localValue) : await clearValue();
    setLocalValue(nextValue);
    onChange(nextValue);
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
                  const nextValue = await setUploadedFile(file);
                  setLocalValue(nextValue);
                  onChange(nextValue);
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
          {widget.type === 'calendar' && <Layout size={20} />}
          {widget.type === 'time' && <Monitor size={20} />}
          {widget.type === 'anniversary' && <Palette size={20} />}
          {widget.type === 'weather' && <Cloud size={20} />}
          {widget.type === 'profile-card' && <User size={20} />}
          {widget.type === 'blank' && <Layout size={20} />}
        </>
      )}
    </div>
  );
}

function PersistentSquareThumbnail({ value, alt }: { value?: string; alt: string }) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return null;
  }

  return <img src={resolvedUrl} className="w-full h-full object-cover" alt={alt} />;
}

// --- Desktop Settings ---
function DesktopSettings({ settings, setSettings, subTab, setSubTab }: any) {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const { setUploadedFile } = usePersistentFieldActions();
  const { resolvedUrl: resolvedWallpaperUrl } = useResolvedPersistentValue(settings.globalBackground);
  const { resolvedUrl: resolvedNavBarBackgroundUrl } = useResolvedPersistentValue(settings.navBar?.backgroundImage || '');
  const typography = settings.themeTypography || {};
  const effectiveFontPriority = resolveThemeFontPriority(typography);
  const importedFonts: ThemeFontAsset[] = typography.importedFonts || [];
  const { resolvedFonts } = useResolvedThemeTypographyCss(typography);
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
    () => (settings.widgets || []).filter((widget: WidgetConfig) => widget.type !== 'music'),
    [settings.widgets]
  );
  const widgetTemplates: Array<{ type: WidgetConfig['type']; label: string; icon: React.ReactNode; create: () => WidgetConfig }> = [
    {
      type: 'profile-card',
      label: '资料卡片',
      icon: <User size={18} />,
      create: () => ({
        id: Date.now().toString(),
        type: 'profile-card',
        w: 4,
        h: 2,
        background: '#ffffff',
        profileName: '自定义',
        handle: '自定义',
        bio: '自定义',
        location: '自定义',
        material: 'default'
      }),
    },
    {
      type: 'calendar',
      label: '日历组件',
      icon: <Calendar size={18} />,
      create: () => ({
        id: Date.now().toString(),
        type: 'calendar',
        w: 2,
        h: 2,
        background: '#ffffff',
        style: 'default',
      }),
    },
    {
      type: 'time',
      label: '时间组件',
      icon: <Monitor size={18} />,
      create: () => ({
        id: Date.now().toString(),
        type: 'time',
        w: 2,
        h: 2,
        background: '#ffffff',
        style: 'default',
      }),
    },
    {
      type: 'anniversary',
      label: '纪念日组件',
      icon: <Heart size={18} />,
      create: () => ({
        id: Date.now().toString(),
        type: 'anniversary',
        w: 2,
        h: 2,
        background: '#ffffff',
        title: '纪念日',
        date: new Date().toISOString().slice(0, 10),
      }),
    },
    {
      type: 'weather',
      label: '天气组件',
      icon: <Cloud size={18} />,
      create: () => ({
        id: Date.now().toString(),
        type: 'weather',
        w: 2,
        h: 2,
        background: '#ffffff',
      }),
    },
    {
      type: 'blank',
      label: '空白卡片',
      icon: <Layout size={18} />,
      create: () => ({
        id: Date.now().toString(),
        type: 'blank',
        w: 2,
        h: 2,
        background: '#ffffff',
      }),
    },
  ];

  const updateTypography = (patch: Partial<VisualSettings['themeTypography']>) =>
    setSettings({
      ...settings,
      themeTypography: {
        ...typography,
        ...patch,
      },
    });

  const addWidgetByType = (type: WidgetConfig['type']) => {
    const template = widgetTemplates.find(item => item.type === type);
    if (!template) return;
    const newWidget = template.create();
    setSettings({ ...settings, widgets: [...(settings.widgets || []), newWidget] });
    setEditingWidgetId(newWidget.id);
    setShowWidgetPicker(false);
  };

  const apps = [
    { id: 'chat', name: '聊天', icon: 'MessageSquare' },
    { id: 'settings', name: 'API 中心', icon: 'Settings' },
    { id: 'worldbook', name: '世界书', icon: 'Book' },
    { id: 'monitor', name: '监控功能', icon: 'Activity' },
    { id: 'sms', name: '短信', icon: 'MessageCircle' },
    { id: 'customization', name: '自定义', icon: 'Settings2' },
    { id: 'couple-space', name: '情侣空间', icon: 'Heart' },
    { id: 'perception', name: '感知', icon: 'Eye' },
    { id: 'music', name: '音乐', icon: 'Music' },
    { id: 'forum', name: '论坛', icon: 'MessageCircle' },
    { id: 'wallet', name: '钱包', icon: 'Wallet' },
  ];

  const handleIconUpdate = (appId: string, url: string) => {
    const currentIcons = settings.desktopIcons || [];
    const existingIndex = currentIcons.findIndex((i: any) => i.id === appId);
    
    let newIcons;
    if (existingIndex >= 0) {
      newIcons = [...currentIcons];
      newIcons[existingIndex] = { ...newIcons[existingIndex], iconUrl: url };
    } else {
      newIcons = [...currentIcons, { id: appId, iconUrl: url }];
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
        {['wallpaper', 'icons', 'layout', 'widgets', 'navbar', 'font'].map(tab => (
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
            {resolvedWallpaperUrl ? (
              <img src={resolvedWallpaperUrl} className="w-full h-full object-cover" alt="Wallpaper" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">无壁纸</div>
            )}
          </div>
          <PersistentImageUploadControl 
            label="壁纸图片" 
            value={settings.globalBackground} 
            onChange={(val) => setSettings({ ...settings, globalBackground: val })} 
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
                      <PersistentSquareThumbnail value={settings.desktopIcons.find((i: any) => i.id === app.id).iconUrl} alt={`${app.name} icon`} />
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
                  onChange={(val) => handleIconUpdate(selectedAppId, val)} 
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
                          {widget.type === 'calendar' ? '日历组件' : widget.type === 'time' ? '时间组件' : widget.type === 'anniversary' ? '纪念日组件' : widget.type === 'weather' ? '天气组件' : widget.type === 'profile-card' ? '资料卡片' : '空白卡片'}
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

                      <div className="grid grid-cols-2 gap-3">
                        {widget.type !== 'profile-card' && (
                          <>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-500">组件类型</label>
                              <select 
                                value={widget.type}
                                onChange={(e) => handleWidgetUpdate(widget.id, { type: e.target.value as any })}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                              >
                                <option value="calendar">日历</option>
                                <option value="time">时间</option>
                                <option value="anniversary">纪念日</option>
                                <option value="music">音乐</option>
                                <option value="weather">天气</option>
                                <option value="profile-card">资料卡片</option>
                                <option value="blank">空白卡片</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-500">组件样式</label>
                              <select 
                                value={widget.style || 'default'}
                                onChange={(e) => handleWidgetUpdate(widget.id, { style: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs"
                              >
                                <option value="default">默认样式</option>
                                {widget.type === 'time' && (
                                  <option value="minimal">极简数字</option>
                                )}
                                {widget.type === 'calendar' && (
                                  <option value="list">日程列表</option>
                                )}
                              </select>
                            </div>
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

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            支持直接粘贴图片链接、Markdown 图片、HTML 图片地址，也支持直接上传本地图片。
          </p>
        </div>
      )}

      {subTab === 'font' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800">字体设置</h3>
          {resolvedFonts.length > 0 ? (
            <style>
              {resolvedFonts
                .map(
                  font => `@font-face {
  font-family: "${font.familyName}";
  src: url("${font.resolvedUrl}");
  font-display: swap;
}`,
                )
                .join('\n\n')}
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

// --- Chat Settings ---
function ChatSettings({ settings, setSettings, subTab, setSubTab }: any) {
  const { resolvedUrl: resolvedGlobalWallpaperUrl } = useResolvedPersistentValue(settings.globalBackground || '');
  const { resolvedUrl: resolvedDynamicsBackgroundUrl } = useResolvedPersistentValue(settings.dynamics?.background || '');
  const { resolvedUrl: resolvedChatAvatarFrameUrl } = useResolvedPersistentValue(settings.chat?.avatarFrameUrl || '');
  const { resolvedUrl: resolvedChatBubbleBackgroundUrl } = useResolvedPersistentValue(settings.chat?.messageBackgroundImageUrl || '');
  const { resolvedUrl: resolvedChatBackgroundUrl } = useResolvedPersistentValue(settings.chat?.background || '');
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
          <div className="flex justify-center py-4 relative">
            <div className="relative">
              <div 
                style={{ 
                  width: settings.chat.avatarSize, 
                  height: settings.chat.avatarSize, 
                  borderRadius: settings.chat.avatarBorderRadius,
                  borderWidth: settings.chat.avatarBorderWidth,
                  borderColor: settings.chat.avatarBorderColor,
                  borderStyle: 'solid'
                }} 
                className="bg-zinc-100 flex items-center justify-center overflow-hidden relative z-10"
              >
                <img src="https://picsum.photos/seed/preview/100" className="w-full h-full object-cover" />
              </div>
              {resolvedChatAvatarFrameUrl && (
                <img 
                  src={resolvedChatAvatarFrameUrl} 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
                  style={{ width: settings.chat.avatarSize * 1.4, height: settings.chat.avatarSize * 1.4 }}
                />
              )}
            </div>
          </div>
          
          <PersistentImageUploadControl 
            label="头像框图片" 
            value={settings.chat.avatarFrameUrl || ''} 
            onChange={(val) => setSettings({ ...settings, chat: { ...settings.chat, avatarFrameUrl: val } })} 
          />

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
        <ChatBubbleThemeCustomizationSection settings={settings} setSettings={setSettings} />
      )}

      {subTab === 'background' && (
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-zinc-100 space-y-4">
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
            <div className="w-48 aspect-[3/4] bg-white rounded-2xl overflow-hidden shadow-sm relative">
              {/* Background */}
               <div className="absolute inset-0 bg-zinc-200">
                 {resolvedGlobalWallpaperUrl && <img src={resolvedGlobalWallpaperUrl} className="w-full h-full object-cover opacity-50" alt="Wallpaper" />}
               </div>
               
               {/* Card Preview */}
               <div className="absolute inset-4 flex flex-col justify-end">
                 <div 
                   className="p-3 backdrop-blur-sm overflow-hidden"
                   style={{ 
                     backgroundColor: settings.dynamics?.background ? 'transparent' : 'rgba(255,255,255,0.9)',
                     borderRadius: settings.dynamics?.cardBorderRadius ?? 24,
                     opacity: settings.dynamics?.cardOpacity ?? 0.9
                   }}
                 >
                   {resolvedDynamicsBackgroundUrl && <img src={resolvedDynamicsBackgroundUrl} className="absolute inset-0 w-full h-full object-cover -z-10" alt="Dynamics Background" />}
                   {!settings.dynamics?.background && (
                     <div className="flex items-center gap-2 mb-2">
                       <div className="w-6 h-6 rounded-full bg-zinc-200"></div>
                       <div className="h-2 w-12 bg-zinc-200 rounded-full"></div>
                     </div>
                   )}
                   <div className="h-2 w-full bg-zinc-100/50 rounded-full mb-1"></div>
                   <div className="h-2 w-2/3 bg-zinc-100/50 rounded-full"></div>
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

  const getModuleSizeBytes = (data: any): number => {
    if (data == null) return 0;
    try {
      const json = JSON.stringify(data);
      return new TextEncoder().encode(json).length;
    } catch {
      return 0;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  };

  const totalDataBytes = modules.reduce((sum, mod) => sum + getModuleSizeBytes(mod.data), 0);
  const totalModuleCount = modules.length;

  const handleExportSelected = () => {
    if (selectedModules.length === 0) {
      alert('请先选择要备份的功能');
      return;
    }

    const exportData: any = {};
    selectedModules.forEach(id => {
      const mod = modules.find(m => m.id === id);
      if (mod) {
        exportData[id] = mod.data;
      }
    });

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_partial_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('备份导出成功！');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (await showInAppConfirm('导入备份将覆盖当前对应功能的数据，确定继续吗？')) {
          let newAppData = { ...appData };
          let newSettings = { ...settings };
          let updatedCount = 0;

          const keys = Object.keys(parsed);
          
          if (parsed.characters && parsed.chatHistory && parsed.userProfile) {
             if (setAppData) setAppData(parsed);
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
            if (setAppData) setAppData(newAppData);
          }

          alert(`成功导入 ${updatedCount} 个功能的数据！手机设置已恢复。`);
        }
      } catch (err) {
        alert('解析备份文件失败，请确保是有效的 JSON 文件');
      } finally {
        setIsImporting(false);
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
            <span className="text-[11px] text-zinc-400">{formatBytes(getModuleSizeBytes(mod.data))}</span>
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
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="text-[12px] text-zinc-500">总数据统计</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[22px] font-bold text-zinc-900">{formatBytes(totalDataBytes)}</span>
            <span className="text-[12px] text-zinc-500">总占用 / {totalModuleCount} 个模块</span>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => {
              const allIds = modules.map(m => m.id);
              setSelectedModules(allIds);
              setTimeout(() => {
                const exportData: any = {};
                allIds.forEach(id => {
                  const mod = modules.find(m => m.id === id);
                  if (mod) exportData[id] = mod.data;
                });
                const dataStr = JSON.stringify(exportData, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `full_backup_${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                alert('全量备份导出成功！');
              }, 100);
            }}
            className="flex flex-col items-center gap-2 rounded-3xl border border-zinc-200 bg-zinc-100 p-4 text-zinc-900 shadow-sm transition-transform hover:bg-zinc-200 active:scale-95"
          >
            <Database size={24} />
            <span className="text-[14px] font-bold">全量备份</span>
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
                onClick={handleExportSelected}
                disabled={selectedModules.length === 0}
                className="text-[12px] font-bold text-zinc-900 disabled:opacity-40"
              >
                导出选中 ({selectedModules.length})
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


