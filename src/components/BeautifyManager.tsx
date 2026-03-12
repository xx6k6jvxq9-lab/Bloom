import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ChevronLeft, Image as ImageIcon, Layout, MessageCircle, 
  Code, Database, History, Download, Upload, Trash2, 
  Plus, Palette, Settings, Monitor, Smartphone, Sliders,
  Type, Square, Layers, Eye, Save, RotateCcw, LayoutGrid
} from 'lucide-react';
import { VisualSettings } from '../types';

type BeautifySection = 'desktop' | 'chat' | 'advanced' | 'data' | 'innerIcon';

export function BeautifyManager({
  visualSettings,
  setVisualSettings,
  onBack,
  globalBackground
}: {
  visualSettings: VisualSettings;
  setVisualSettings: (vs: VisualSettings) => void;
  onBack: () => void;
  globalBackground?: string;
}) {
  const [activeSection, setActiveSection] = useState<BeautifySection>('desktop');
  const [history, setHistory] = useState<VisualSettings[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  // Save to history when settings change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      setHistory(prev => {
        if (prev.length > 0 && JSON.stringify(prev[prev.length - 1]) === JSON.stringify(visualSettings)) return prev;
        return [...prev.slice(-19), visualSettings];
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [visualSettings]);

  const handleReset = () => {
    if (confirm('确定要重置所有美化设置吗？')) {
      // We'll define a default in App.tsx and pass it or just reset to a hardcoded one here
      // For now, let's assume we have a way to reset
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(visualSettings, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `theme_${Date.now()}.json`;
    link.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setVisualSettings({ ...visualSettings, ...parsed });
        alert('导入成功');
      } catch (err) {
        alert('导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`absolute inset-0 flex flex-col z-[150] ${globalBackground ? 'bg-transparent' : 'bg-zinc-50'}`}>
      {/* Header */}
      <div className={`pt-12 pb-4 px-4 border-b flex items-center justify-between backdrop-blur-2xl ${
        globalBackground ? 'bg-white/70 border-white/20' : 'bg-white border-zinc-100'
      }`}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:bg-black/5 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h3 className="text-[17px] font-bold">美化自定义</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowPreview(!showPreview)} 
            className={`p-2 rounded-full transition-colors ${showPreview ? 'text-blue-500 bg-blue-50' : 'text-zinc-400 hover:bg-black/5'}`}
          >
            <Eye size={20} />
          </button>
          <button onClick={handleExport} className="p-2 text-zinc-400 hover:bg-black/5 rounded-full transition-colors">
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={`px-4 py-3 flex gap-2 overflow-x-auto shrink-0 no-scrollbar backdrop-blur-2xl border-b ${
        globalBackground ? 'bg-white/70 border-white/20' : 'bg-white border-zinc-50'
      }`}>
        {[
          { id: 'desktop', label: '桌面设置', icon: Monitor },
          { id: 'chat', label: '聊天美化', icon: MessageCircle },
          { id: 'innerIcon', label: '功能图标', icon: LayoutGrid },
          { id: 'advanced', label: '高级主题', icon: Code },
          { id: 'data', label: '数据管理', icon: Database },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveSection(tab.id as BeautifySection)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all ${
              activeSection === tab.id 
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-zinc-100/50 text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {activeSection === 'desktop' && (
          <DesktopSettings visualSettings={visualSettings} setVisualSettings={setVisualSettings} />
        )}
        {activeSection === 'chat' && (
          <ChatBeautifySettings visualSettings={visualSettings} setVisualSettings={setVisualSettings} />
        )}
        {activeSection === 'innerIcon' && (
          <InnerIconSettings visualSettings={visualSettings} setVisualSettings={setVisualSettings} />
        )}
        {activeSection === 'advanced' && (
          <AdvancedThemeSettings visualSettings={visualSettings} setVisualSettings={setVisualSettings} />
        )}
        {activeSection === 'data' && (
          <DataManagementSettings 
            visualSettings={visualSettings} 
            setVisualSettings={setVisualSettings} 
            history={history}
            onImport={handleImport}
          />
        )}
      </div>

      {/* Floating Preview Window */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-24 right-4 w-40 aspect-[9/16] bg-white rounded-3xl shadow-2xl border-4 border-zinc-900 overflow-hidden z-[200] pointer-events-none"
          >
            <PreviewContent visualSettings={visualSettings} section={activeSection} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DesktopSettings({ visualSettings, setVisualSettings }: { visualSettings: VisualSettings, setVisualSettings: (vs: VisualSettings) => void }) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h4 className="text-[14px] font-bold text-zinc-400 px-1 flex items-center gap-2">
          <Layout size={16} /> 桌面布局与壁纸
        </h4>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-zinc-100 space-y-4 shadow-sm">
          <div className="space-y-2">
            <label className="text-[12px] text-zinc-500">桌面壁纸 (URL/Base64)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={visualSettings.globalBackground}
                onChange={e => setVisualSettings({ ...visualSettings, globalBackground: e.target.value })}
                className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                placeholder="粘贴壁纸链接..."
              />
              <label className="p-2 bg-zinc-100 rounded-xl cursor-pointer hover:bg-zinc-200 transition-colors">
                <Upload size={18} className="text-zinc-500" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setVisualSettings({ ...visualSettings, globalBackground: reader.result as string });
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">图标大小 ({visualSettings.desktopIconSize}px)</label>
              <input 
                type="range" min="40" max="80" step="1"
                value={visualSettings.desktopIconSize}
                onChange={e => setVisualSettings({ ...visualSettings, desktopIconSize: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">圆角半径 ({visualSettings.desktopCornerRadius}px)</label>
              <input 
                type="range" min="0" max="60" step="1"
                value={visualSettings.desktopCornerRadius}
                onChange={e => setVisualSettings({ ...visualSettings, desktopCornerRadius: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">阴影深度 ({visualSettings.desktopShadowDepth}px)</label>
              <input 
                type="range" min="0" max="20" step="1"
                value={visualSettings.desktopShadowDepth}
                onChange={e => setVisualSettings({ ...visualSettings, desktopShadowDepth: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">内容缩放 ({Math.round(visualSettings.desktopContentScale * 100)}%)</label>
              <input 
                type="range" min="0.5" max="1.5" step="0.05"
                value={visualSettings.desktopContentScale}
                onChange={e => setVisualSettings({ ...visualSettings, desktopContentScale: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] text-zinc-500">背景遮罩透明度 ({Math.round(visualSettings.desktopBgMask * 100)}%)</label>
            <input 
              type="range" min="0" max="0.8" step="0.01"
              value={visualSettings.desktopBgMask}
              onChange={e => setVisualSettings({ ...visualSettings, desktopBgMask: parseFloat(e.target.value) })}
              className="w-full accent-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] text-zinc-500">内边距 (Padding: {visualSettings.desktopPadding})</label>
            <input 
              type="text" 
              value={visualSettings.desktopPadding}
              onChange={e => setVisualSettings({ ...visualSettings, desktopPadding: e.target.value })}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-blue-500"
              placeholder="例如: 16px 24px"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-[14px] font-bold text-zinc-400 px-1 flex items-center gap-2">
          <Smartphone size={16} /> 沉浸式顶栏与底栏
        </h4>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-zinc-100 space-y-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">对齐方式</label>
              <select 
                value={visualSettings.topBarAlign}
                onChange={e => setVisualSettings({ ...visualSettings, topBarAlign: e.target.value as any })}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-[13px] outline-none"
              >
                <option value="left">居左</option>
                <option value="center">居中</option>
                <option value="right">居右</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">顶栏透明度 ({Math.round(visualSettings.topBarOpacity * 100)}%)</label>
              <input 
                type="range" min="0" max="1" step="0.01"
                value={visualSettings.topBarOpacity}
                onChange={e => setVisualSettings({ ...visualSettings, topBarOpacity: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[12px] text-zinc-500">毛玻璃强度 ({visualSettings.topBarBlur}px)</label>
            <input 
              type="range" min="0" max="40" step="1"
              value={visualSettings.topBarBlur}
              onChange={e => setVisualSettings({ ...visualSettings, topBarBlur: parseInt(e.target.value) })}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
            <span className="text-[13px] text-zinc-700">底栏悬浮胶囊模式</span>
            <button 
              onClick={() => setVisualSettings({ ...visualSettings, tabBarCapsuleMode: !visualSettings.tabBarCapsuleMode })}
              className={`w-12 h-6 rounded-full transition-all relative ${visualSettings.tabBarCapsuleMode ? 'bg-blue-500' : 'bg-zinc-200'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${visualSettings.tabBarCapsuleMode ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-zinc-700">隐藏标签文字</span>
            <button 
              onClick={() => setVisualSettings({ ...visualSettings, tabBarHideLabels: !visualSettings.tabBarHideLabels })}
              className={`w-12 h-6 rounded-full transition-all relative ${visualSettings.tabBarHideLabels ? 'bg-blue-500' : 'bg-zinc-200'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${visualSettings.tabBarHideLabels ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChatBeautifySettings({ visualSettings, setVisualSettings }: { visualSettings: VisualSettings, setVisualSettings: (vs: VisualSettings) => void }) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h4 className="text-[14px] font-bold text-zinc-400 px-1 flex items-center gap-2">
          <Smartphone size={16} /> 头像与气泡
        </h4>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-zinc-100 space-y-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">头像圆角 ({visualSettings.chatAvatarRounding})</label>
              <input 
                type="text"
                value={visualSettings.chatAvatarRounding}
                onChange={e => setVisualSettings({ ...visualSettings, chatAvatarRounding: e.target.value })}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-[13px] outline-none"
                placeholder="例如: 50% 或 12px"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">头像边框 ({visualSettings.chatAvatarBorderWidth}pt)</label>
              <input 
                type="range" min="0" max="5" step="0.5"
                value={visualSettings.chatAvatarBorderWidth}
                onChange={e => setVisualSettings({ ...visualSettings, chatAvatarBorderWidth: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
            <span className="text-[13px] text-zinc-700">头像发光特效</span>
            <button 
              onClick={() => setVisualSettings({ ...visualSettings, chatAvatarGlow: !visualSettings.chatAvatarGlow })}
              className={`w-12 h-6 rounded-full transition-all relative ${visualSettings.chatAvatarGlow ? 'bg-blue-500' : 'bg-zinc-200'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${visualSettings.chatAvatarGlow ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-50">
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">气泡间距 ({visualSettings.chatBubbleSpacing}px)</label>
              <input 
                type="range" min="4" max="32" step="1"
                value={visualSettings.chatBubbleSpacing}
                onChange={e => setVisualSettings({ ...visualSettings, chatBubbleSpacing: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">气泡边框 ({visualSettings.chatBubbleBorderWidth}px)</label>
              <input 
                type="range" min="0" max="5" step="1"
                value={visualSettings.chatBubbleBorderWidth}
                onChange={e => setVisualSettings({ ...visualSettings, chatBubbleBorderWidth: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-50">
            <div className="space-y-2">
              <label className="text-[12px] text-zinc-500">气泡模糊 ({visualSettings.chatBubbleBlur}px)</label>
              <input 
                type="range" min="0" max="20" step="1"
                value={visualSettings.chatBubbleBlur}
                onChange={e => setVisualSettings({ ...visualSettings, chatBubbleBlur: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
            <div className="flex flex-col justify-center gap-1">
              <span className="text-[12px] text-zinc-500">气泡渐变</span>
              <button 
                onClick={() => setVisualSettings({ ...visualSettings, chatBubbleGradient: !visualSettings.chatBubbleGradient })}
                className={`w-12 h-6 rounded-full transition-all relative ${visualSettings.chatBubbleGradient ? 'bg-blue-500' : 'bg-zinc-200'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${visualSettings.chatBubbleGradient ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          </div>
          
          <div className="space-y-3 pt-2 border-t border-zinc-50">
            <label className="text-[12px] text-zinc-500">气泡圆角 (TL, TR, BL, BR)</label>
            <div className="grid grid-cols-4 gap-2">
              {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
                <div key={corner} className="space-y-1">
                  <input 
                    type="text"
                    value={visualSettings.chatBubbleRadius[corner]}
                    onChange={e => setVisualSettings({
                      ...visualSettings,
                      chatBubbleRadius: { ...visualSettings.chatBubbleRadius, [corner]: e.target.value }
                    })}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-1 py-1 text-[11px] text-center outline-none focus:border-blue-500"
                  />
                  <div className="text-[9px] text-zinc-400 text-center uppercase">{corner}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InnerIconSettings({ visualSettings, setVisualSettings }: { visualSettings: VisualSettings, setVisualSettings: (vs: VisualSettings) => void }) {
  const handleChange = (key: keyof VisualSettings, value: any) => {
    setVisualSettings({ ...visualSettings, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
        <h3 className="text-[14px] font-medium text-zinc-800 mb-4 flex items-center gap-2">
          <LayoutGrid size={16} className="text-blue-500" />
          功能图标样式
        </h3>
        
        <div className="space-y-5">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[13px] text-zinc-600">图标大小</label>
              <span className="text-[12px] text-zinc-400">{visualSettings.innerIconSize || 24}px</span>
            </div>
            <input 
              type="range" 
              min="16" max="48" step="1"
              value={visualSettings.innerIconSize || 24}
              onChange={(e) => handleChange('innerIconSize', parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[13px] text-zinc-600">图标圆角</label>
              <span className="text-[12px] text-zinc-400">{visualSettings.innerIconRounding || 0}px</span>
            </div>
            <input 
              type="range" 
              min="0" max="24" step="1"
              value={visualSettings.innerIconRounding || 0}
              onChange={(e) => handleChange('innerIconRounding', parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          <div>
            <label className="text-[13px] text-zinc-600 block mb-2">图标颜色</label>
            <div className="flex items-center gap-3">
              <input 
                type="color" 
                value={visualSettings.innerIconColor || '#000000'}
                onChange={(e) => handleChange('innerIconColor', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
              <input 
                type="text" 
                value={visualSettings.innerIconColor || ''}
                onChange={(e) => handleChange('innerIconColor', e.target.value)}
                placeholder="默认颜色"
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                onClick={() => handleChange('innerIconColor', undefined)}
                className="px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-xl text-[12px] hover:bg-zinc-200"
              >
                重置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedThemeSettings({ visualSettings, setVisualSettings }: { visualSettings: VisualSettings, setVisualSettings: (vs: VisualSettings) => void }) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h4 className="text-[14px] font-bold text-zinc-400 px-1 flex items-center gap-2">
          <Code size={16} /> CSS 实时注入
        </h4>
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-2 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-zinc-500 font-mono">custom.css</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Live</span>
          </div>
          <textarea 
            value={visualSettings.customCSS}
            onChange={e => setVisualSettings({ ...visualSettings, customCSS: e.target.value })}
            placeholder="/* 在这里输入自定义 CSS 代码... */\n.message-bubble {\n  box-shadow: 0 4px 12px rgba(0,0,0,0.1);\n}"
            className="w-full h-64 bg-transparent text-zinc-300 font-mono text-[12px] outline-none resize-none leading-relaxed"
          />
        </div>
        <p className="text-[11px] text-zinc-400 px-2 italic">提示：修改将实时应用到全局组件。</p>
      </section>
    </div>
  );
}

function DataManagementSettings({ 
  visualSettings, 
  setVisualSettings, 
  history,
  onImport
}: { 
  visualSettings: VisualSettings, 
  setVisualSettings: (vs: VisualSettings) => void,
  history: VisualSettings[],
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h4 className="text-[14px] font-bold text-zinc-400 px-1 flex items-center gap-2">
          <History size={16} /> 配置快照 (最近 20 条)
        </h4>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
          {history.length === 0 ? (
            <div className="p-8 text-center text-zinc-300 text-[13px]">暂无修改历史</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {history.slice().reverse().map((snap, i) => (
                <button 
                  key={i}
                  onClick={() => setVisualSettings(snap)}
                  className="w-full flex items-center justify-between p-3 hover:bg-zinc-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400">
                      <RotateCcw size={14} />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-zinc-800">快照 #{history.length - i}</div>
                      <div className="text-[10px] text-zinc-400">点击回滚到此状态</div>
                    </div>
                  </div>
                  <ChevronLeft size={14} className="text-zinc-300 rotate-180" />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-[14px] font-bold text-zinc-400 px-1 flex items-center gap-2">
          <Database size={16} /> 原始 JSON 数据
        </h4>
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-xl">
          <textarea 
            value={JSON.stringify(visualSettings, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                setVisualSettings(parsed);
              } catch (err) {}
            }}
            className="w-full h-48 bg-transparent text-emerald-400 font-mono text-[11px] outline-none resize-none leading-relaxed"
          />
        </div>
      </section>
    </div>
  );
}

function PreviewContent({ visualSettings, section }: { visualSettings: VisualSettings, section: BeautifySection }) {
  return (
    <div className="w-full h-full relative bg-zinc-100 overflow-hidden">
      {/* Background */}
      <img src={visualSettings.globalBackground || 'https://picsum.photos/seed/bg/400/800'} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/10" />

      {/* Top Bar Preview */}
      <div 
        className="absolute top-0 left-0 right-0 h-6 flex items-center px-2 z-10"
        style={{ 
          backgroundColor: `rgba(255, 255, 255, ${visualSettings.topBarOpacity})`,
          backdropFilter: `blur(${visualSettings.topBarBlur}px)`
        }}
      >
        <div className="w-full flex justify-center">
          <div className="w-8 h-1 bg-zinc-400/50 rounded-full" />
        </div>
      </div>

      {/* Content Preview based on section */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-4">
        {section === 'desktop' && (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div 
                key={i}
                className="flex flex-col items-center gap-1"
              >
                <div 
                  className="bg-white/20 backdrop-blur-md border border-white/30 shadow-lg"
                  style={{ 
                    width: visualSettings.desktopIconSize / 2,
                    height: visualSettings.desktopIconSize / 2,
                    borderRadius: visualSettings.desktopCornerRadius / 2
                  }}
                />
                <div className="w-6 h-1 bg-white/50 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {section === 'chat' && (
          <div className="w-full space-y-2">
            <div className="flex gap-2 items-start">
              <div 
                className="bg-white/50 shrink-0"
                style={{ 
                  width: 16, height: 16, 
                  borderRadius: visualSettings.chatAvatarRounding 
                }}
              />
              <div 
                className="bg-white/80 p-2 text-[8px] max-w-[70%]"
                style={{ 
                  borderRadius: `${visualSettings.chatBubbleRadius.tl} ${visualSettings.chatBubbleRadius.tr} ${visualSettings.chatBubbleRadius.br} ${visualSettings.chatBubbleRadius.bl}`
                }}
              >
                Hello!
              </div>
            </div>
            <div className="flex gap-2 items-start flex-row-reverse">
              <div 
                className="bg-blue-500/50 shrink-0"
                style={{ 
                  width: 16, height: 16, 
                  borderRadius: visualSettings.chatAvatarRounding 
                }}
              />
              <div 
                className="bg-blue-500 text-white p-2 text-[8px] max-w-[70%]"
                style={{ 
                  borderRadius: `${visualSettings.chatBubbleRadius.tr} ${visualSettings.chatBubbleRadius.tr} ${visualSettings.chatBubbleRadius.bl} ${visualSettings.chatBubbleRadius.br}`
                }}
              >
                Hi there!
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar Preview */}
      <div className="absolute bottom-2 left-2 right-2 h-8 flex items-center justify-around px-2">
        <div 
          className={`w-full h-full flex items-center justify-around ${visualSettings.tabBarCapsuleMode ? 'rounded-full bg-white/20 backdrop-blur-xl border border-white/30' : ''}`}
        >
          {[1, 2, 3].map(i => (
            <div key={i} className="w-4 h-4 rounded-full bg-white/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
