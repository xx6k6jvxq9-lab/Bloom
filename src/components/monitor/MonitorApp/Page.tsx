import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Activity, 
  Book, 
  Calendar, 
  Smartphone, 
  Home, 
  Users, 
  Heart, 
  Package,
  Eye,
  Zap,
  Target,
  Shield,
  Clock,
  MapPin,
  Plus,
  Trash2,
  X,
  Search,
  Filter,
  Menu
} from 'lucide-react';
import { showInAppConfirm } from '../../../utils';
import { PhoneInterface } from '../PhoneInterface';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';

type Character = {
  id: string;
  name: string;
  avatar: string;
  setting: string;
  corePersona?: string;
  category?: string;
};

import { VisualSettings } from '../../../types';

function ResolvedMonitorAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className={className} />;
}

type MonitorAppProps = {
  characters: Character[];
  onBack: () => void;
  visualSettings?: VisualSettings;
};

type MonitorData = {
  diary: string[];
  schedule: { time: string; task: string; status: 'completed' | 'ongoing' | 'pending' }[];
  phone: { 
    app: string; 
    lastUsed: string; 
    notification?: string;
    content?: any;
  }[];
  room: { location: string; temperature: string; humidity: string; status: string };
  dynamics: { person: string; action: string; time: string }[];
  health: { heartRate: number; mood: string; energy: number };
  inventory: string[];
};

export function MonitorApp({ characters: initialCharacters, onBack, visualSettings }: MonitorAppProps) {
  const { resolvedUrl: resolvedDynamicsBackgroundUrl } = useResolvedPersistentValue(visualSettings?.dynamics?.background);
  const [localCharacters, setLocalCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem('monitor_characters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with initialCharacters to get latest avatar/name/setting
        return parsed.map((p: any) => {
          const found = initialCharacters.find(c => c.id === p.id);
          return found ? { ...found, category: p.category || '其他' } : null;
        }).filter(Boolean); // Remove nulls if any
      } catch (e) {
        return initialCharacters;
      }
    }
    return initialCharacters;
  });

  useEffect(() => {
    localStorage.setItem('monitor_characters', JSON.stringify(localCharacters.map(c => ({ id: c.id, category: c.category }))));
  }, [localCharacters]);

  useEffect(() => {
    setLocalCharacters(prev => 
      prev.map(c => {
        const found = initialCharacters.find(ic => ic.id === c.id);
        return found ? { ...found, category: c.category } : null;
      }).filter(Boolean) as Character[]
    );
  }, [initialCharacters]);

  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'diary' | 'schedule' | 'phone' | 'room' | 'dynamics' | 'health' | 'inventory'>('overview');
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [showAddModal, setShowAddModal] = useState(false);
  const [charToAdd, setCharToAdd] = useState<Character | null>(null);
  const [categoryToAdd, setCategoryToAdd] = useState<string>('主要角色');
  const [selectedDiaryEntry, setSelectedDiaryEntry] = useState<string | null>(null);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<MonitorData['schedule'][0] | null>(null);
  const [selectedDynamicsItem, setSelectedDynamicsItem] = useState<MonitorData['dynamics'][0] | null>(null);
  const [selectedPhoneApp, setSelectedPhoneApp] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const categories = ['全部', '主要角色', '次要角色', '其他'];
  const addCategories = ['主要角色', '次要角色', '其他'];

  const filteredCharacters = localCharacters.filter(char => 
    selectedCategory === '全部' || char.category === selectedCategory
  );

  const availableToAdd = initialCharacters.filter(c => !localCharacters.find(lc => lc.id === c.id));

  const selectedChar = localCharacters.find(c => c.id === selectedCharId);

  const handleDeleteChar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (await showInAppConfirm('确定要删除这个监控对象吗？')) {
      setLocalCharacters(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleAddExistingChar = () => {
    if (!charToAdd) return;
    setLocalCharacters(prev => [...prev, { ...charToAdd, category: categoryToAdd }]);
    setShowAddModal(false);
    setCharToAdd(null);
    setCategoryToAdd('主要角色');
  };

  useEffect(() => {
    if (selectedCharId) {
      setIsScanning(true);
      const timer = setTimeout(() => {
        setMonitorData({
          diary: [
            "今天感觉有点累，但是看到夕阳的时候心情好多了。🌅",
            "那个新开的咖啡店味道不错，下次可以再去。☕️",
            "总觉得有人在看着我，是错觉吗？👀",
            "计划下周去海边走走，放松一下心情。🌊"
          ],
          schedule: [
            { time: "08:00", task: "晨间慢跑", status: 'completed' },
            { time: "10:00", task: "处理工作邮件", status: 'completed' },
            { time: "14:00", task: "与朋友聚会", status: 'ongoing' },
            { time: "19:00", task: "阅读新书", status: 'pending' },
            { time: "21:30", task: "晚间冥想", status: 'pending' }
          ],
          phone: [
            { 
              app: "微信", 
              lastUsed: "2分钟前", 
              notification: "收到一条新消息",
              content: [
                { sender: "阿强", text: "晚上一起吃饭吗？", time: "14:30" },
                { sender: "苏梦", text: "那个方案我发你邮箱了。", time: "12:15" },
                { sender: "妈妈", text: "记得多喝热水。", time: "09:00" }
              ]
            },
            { 
              app: "网易云音乐", 
              lastUsed: "正在运行", 
              notification: "正在播放：City of Stars",
              content: { song: "City of Stars", artist: "Ryan Gosling", album: "La La Land" }
            },
            { 
              app: "小红书", 
              lastUsed: "15分钟前", 
              notification: "你的动态有3个新赞",
              content: [
                { title: "今日穿搭分享", likes: 128, comments: 12 },
                { title: "海边落日合集", likes: 256, comments: 45 }
              ]
            },
            { app: "备忘录", lastUsed: "1小时前", content: ["买牛奶", "交房租", "预约牙医"] }
          ],
          room: {
            location: "温馨卧室",
            temperature: "24°C",
            humidity: "45%",
            status: "光线柔和，香薰运行中"
          },
          dynamics: [
            { person: "阿强", action: "点赞了朋友圈", time: "10分钟前" },
            { person: "苏梦", action: "发来语音通话", time: "30分钟前" },
            { person: "陈雨", action: "分享了一首歌", time: "1小时前" }
          ],
          health: {
            heartRate: 72,
            mood: "平静愉悦",
            energy: 85
          },
          inventory: ["手机", "钥匙", "钱包", "降噪耳机", "一颗薄荷糖", "随身手账本"]
        });
        setIsScanning(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [selectedCharId]);

  if (!selectedCharId) {
    return (
      <div className="absolute inset-0 bg-zinc-50 text-zinc-900 flex flex-col font-sans">
        <div className="p-6 flex items-center justify-between bg-white border-b border-zinc-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <ChevronLeft size={24} className="text-zinc-600" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">监控中心</h1>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-900 shadow-sm transition-all hover:bg-zinc-200 active:scale-95"
          >
            <Plus size={18} />
            添加对象
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Category Filter */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 rounded-full border text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  selectedCategory === cat 
                    ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm' 
                    : 'border-zinc-100 bg-white text-zinc-400 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mb-2">监控对象列表 / TARGETS</p>
              <div className="h-1 w-12 bg-zinc-900 rounded-full" />
            </div>
            <span className="text-[10px] font-black text-zinc-300 uppercase">{filteredCharacters.length} 个对象</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredCharacters.map(char => (
                <motion.div
                  key={char.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative"
                >
                  <div
                    onClick={() => setSelectedCharId(char.id)}
                    role="button"
                    tabIndex={0}
                    className="w-full bg-white border border-zinc-100 rounded-[32px] p-5 shadow-sm hover:shadow-xl hover:border-zinc-300 transition-all active:scale-95 flex flex-col items-center text-center gap-4 relative overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-3 right-3 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleDeleteChar(e, char.id)}
                        className="p-2.5 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-zinc-900 hover:text-white transition-all active:scale-90"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="relative">
                      <ResolvedMonitorAvatar value={char.avatar} alt={char.name} className="w-24 h-24 rounded-[28px] object-cover shadow-inner ring-4 ring-zinc-50" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-zinc-900 border-4 border-white rounded-full" />
                    </div>
                    
                    <div>
                      <p className="text-[16px] font-black text-zinc-900 tracking-tight">{char.name}</p>
                      <p className="text-[11px] text-zinc-400 mt-1 font-medium line-clamp-1 px-2">{char.corePersona || ''}</p>
                    </div>
                    
                    <div className="mt-2 w-full py-2 bg-zinc-50 rounded-2xl text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:bg-zinc-900 group-hover:text-white transition-all">
                      进入监控
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredCharacters.length === 0 && (
              <div className="col-span-2 py-20 text-center">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                  <Search size={32} />
                </div>
                <p className="text-zinc-400 font-bold">该分类下暂无监控对象</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Character Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl border border-zinc-100 overflow-hidden flex flex-col max-h-[80%]"
              >
                <div className="p-6 border-b border-zinc-50 flex justify-between items-center">
                  <h3 className="text-lg font-black text-zinc-900">选择监控对象</h3>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X size={20} className="text-zinc-400" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {availableToAdd.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">选择角色</label>
                        {availableToAdd.map(char => (
                          <button
                            key={char.id}
                            onClick={() => setCharToAdd(char)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group border ${
                              charToAdd?.id === char.id 
                                ? 'bg-zinc-50 border-zinc-900 shadow-md' 
                                : 'bg-zinc-50 border-transparent hover:border-zinc-300'
                            }`}
                          >
                            <ResolvedMonitorAvatar value={char.avatar} alt={char.name} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                            <div className="flex-1">
                              <p className="font-bold text-zinc-900 text-sm">{char.name}</p>
                              <p className="text-[10px] text-zinc-400 line-clamp-1">{char.corePersona || ''}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors shadow-sm ${
                              charToAdd?.id === char.id ? 'bg-zinc-100 text-zinc-900' : 'bg-white text-zinc-300'
                            }`}>
                              <Shield size={10} />
                            </div>
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">所属分类</label>
                        <div className="flex gap-2">
                          {addCategories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => setCategoryToAdd(cat)}
                              className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                                categoryToAdd === cat 
                                  ? 'border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm' 
                                  : 'bg-zinc-50 text-zinc-400 border border-zinc-100 hover:border-zinc-300'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={handleAddExistingChar}
                        disabled={!charToAdd}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-100 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-900 shadow-sm transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-50 disabled:shadow-none"
                      >
                        确认添加
                      </button>
                    </>
                  ) : (
                    <div className="py-12 flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300 mb-4">
                        <Users size={32} />
                      </div>
                      <p className="text-zinc-500 font-bold">所有已创建的对象都在监控列表中</p>
                      <p className="text-[11px] text-zinc-400 mt-1">请先在主页创建新的角色</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-zinc-50 text-zinc-900 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-center justify-between bg-white border-b border-zinc-100 z-20 shadow-sm relative">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCharId(null)} className="p-1.5 hover:bg-zinc-100 rounded-xl transition-colors">
            <ChevronLeft size={18} className="text-zinc-600" />
          </button>
          <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="p-1.5 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600">
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-3 ml-2">
            <ResolvedMonitorAvatar value={selectedChar?.avatar} alt={selectedChar?.name || 'character'} className="w-7 h-7 rounded-lg object-cover" />
            <div>
              <h2 className="text-xs font-bold text-zinc-800">{selectedChar?.name}</h2>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
            <Shield size={14} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Left Sidebar Navigation - Collapsible */}
        <AnimatePresence initial={false}>
          {isSidebarVisible && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 56, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white border-r border-zinc-100 flex flex-col items-center py-4 gap-4 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 overflow-hidden shrink-0 h-full"
            >
              <div className="w-14 flex flex-col items-center gap-4">
                <SideNavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={16} />} label="概览" />
                <SideNavButton active={activeTab === 'diary'} onClick={() => setActiveTab('diary')} icon={<Book size={16} />} label="日记" />
                <SideNavButton active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} icon={<Calendar size={16} />} label="行程" />
                <SideNavButton active={activeTab === 'phone'} onClick={() => setActiveTab('phone')} icon={<Smartphone size={16} />} label="手机" />
                <SideNavButton active={activeTab === 'room'} onClick={() => setActiveTab('room')} icon={<Home size={16} />} label="房间" />
                <SideNavButton active={activeTab === 'dynamics'} onClick={() => setActiveTab('dynamics')} icon={<Users size={16} />} label="动态" />
                <SideNavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={16} />} label="物品" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto p-4 w-full">
          {isScanning ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-xs text-zinc-400 font-medium animate-pulse">正在加密传输数据...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Status Card */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 shadow-inner">
                            <Heart size={20} className="animate-pulse" />
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">实时状态 / STATUS</p>
                            <p className="text-base font-bold text-zinc-900">{monitorData?.health.mood}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">心率 / HR</p>
                          <p className="text-lg font-black text-zinc-900 tabular-nums">{monitorData?.health.heartRate}<span className="text-[10px] ml-1 font-bold">BPM</span></p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">
                            <span>能量储备 / ENERGY</span>
                            <span className="text-zinc-900">{monitorData?.health.energy}%</span>
                          </div>
                          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${monitorData?.health.energy}%` }}
                              className="h-full bg-zinc-800 rounded-full" 
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">
                            <span>心理压力 / STRESS</span>
                            <span className="text-zinc-700">12%</span>
                          </div>
                          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: '12%' }}
                              className="h-full bg-zinc-600 rounded-full" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100 group hover:border-zinc-300 transition-colors">
                        <div className="flex items-center gap-2 text-zinc-900 mb-2">
                          <div className="p-1.5 bg-zinc-100 rounded-lg">
                            <MapPin size={14} />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider">位置 / LOCATION</span>
                        </div>
                        <p className="text-sm font-bold text-zinc-900">{monitorData?.room.location}</p>
                        <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{monitorData?.room.status}</p>
                      </div>

                      <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100 group hover:border-zinc-300 transition-colors">
                        <div className="flex items-center gap-2 text-zinc-900 mb-2">
                          <div className="p-1.5 bg-zinc-100 rounded-lg">
                            <Clock size={14} />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider">行程 / ACTIVITY</span>
                        </div>
                        <p className="text-sm font-bold text-zinc-900 truncate">
                          {monitorData?.schedule.find(s => s.status === 'ongoing')?.task || '休息中'}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1">预计结束: 16:30</p>
                      </div>
                    </div>

                    <div className="bg-zinc-900 rounded-xl p-4 shadow-lg shadow-zinc-900/10 text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Zap size={48} />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap size={12} className="text-zinc-400" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-300">实时动态追踪 / LIVE FEED</span>
                        </div>
                        <p className="text-xs font-medium leading-relaxed">
                          <span className="font-black text-white">{monitorData?.dynamics[0].person}</span>
                          <span className="mx-1 opacity-80">{monitorData?.dynamics[0].action}</span>
                          <span className="text-[9px] opacity-60 ml-2 font-bold">{monitorData?.dynamics[0].time}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl p-2 border border-zinc-100 text-center">
                        <p className="text-[8px] text-zinc-400 font-bold uppercase mb-0.5">步数</p>
                        <p className="text-xs font-black text-zinc-800">8,432</p>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-zinc-100 text-center">
                        <p className="text-[8px] text-zinc-400 font-bold uppercase mb-0.5">睡眠</p>
                        <p className="text-xs font-black text-zinc-800">7.5h</p>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-zinc-100 text-center">
                        <p className="text-[8px] text-zinc-400 font-bold uppercase mb-0.5">水分</p>
                        <p className="text-xs font-black text-zinc-800">1.2L</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'diary' && (
                  <div className="space-y-4">
                    <div className="px-1 flex items-center justify-between">
                      <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">私密日志 / PRIVATE DIARY</h3>
                      <div className="px-2 py-0.5 bg-zinc-100 text-zinc-900 rounded-full text-[8px] font-black uppercase">已加密</div>
                    </div>
                    <div className="space-y-3 relative before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-px before:bg-zinc-100">
                      {monitorData?.diary.map((entry, i) => (
                        <div key={i} className="relative pl-8">
                          <div className="absolute left-0 top-1 w-8 h-8 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-zinc-900 ring-4 ring-zinc-100 z-10" />
                          </div>
                          <button 
                            onClick={() => setSelectedDiaryEntry(entry)}
                            className="w-full text-left bg-white rounded-xl p-4 shadow-sm border border-zinc-100 hover:border-zinc-300 hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-bold text-zinc-300 uppercase">ENTRY #{monitorData.diary.length - i}</span>
                              <span className="text-[9px] text-zinc-400">今天 14:2{i}</span>
                            </div>
                            <p className="text-xs leading-relaxed text-zinc-700 font-medium italic line-clamp-2">"{entry}"</p>
                            <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-zinc-900 uppercase tracking-wider">
                              <span>点击查看详情</span>
                              <ChevronLeft size={10} className="rotate-180" />
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'schedule' && (
                  <div className="space-y-4">
                    <div className="px-1">
                      <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">日程安排 / TIMELINE</h3>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                      {monitorData?.schedule.map((item, i) => (
                        <button 
                          key={i} 
                          onClick={() => setSelectedScheduleItem(item)}
                          className="w-full text-left flex items-start gap-3 p-4 border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors group"
                        >
                          <div className="flex flex-col items-center pt-1">
                            <span className="text-[10px] font-black text-zinc-900 tabular-nums">{item.time}</span>
                            <div className={`w-1 h-1 rounded-full mt-2 ${item.status === 'ongoing' ? 'bg-zinc-900 animate-ping' : 'bg-zinc-200'}`} />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-bold ${item.status === 'ongoing' ? 'text-zinc-900' : 'text-zinc-800'}`}>{item.task}</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              {item.status === 'completed' ? '已于定点完成' : item.status === 'ongoing' ? '正在执行中' : '等待触发'}
                            </p>
                          </div>
                          <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                            item.status === 'completed' ? 'bg-zinc-100 text-zinc-900' :
                            item.status === 'ongoing' ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20' :
                            'bg-zinc-100 text-zinc-400'
                          }`}>
                            {item.status === 'completed' ? 'DONE' : item.status === 'ongoing' ? 'LIVE' : 'WAIT'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'phone' && (
                  <div className="h-full">
                    <PhoneInterface phoneData={monitorData?.phone || []} onBack={() => setActiveTab('overview')} />
                  </div>
                )}

                {activeTab === 'room' && (
                  <div className="space-y-4">
                    <div className="px-1">
                      <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">环境监测 / ENVIRONMENT</h3>
                    </div>
                    <div className="aspect-[16/10] bg-zinc-100 rounded-3xl relative overflow-hidden shadow-inner group border border-zinc-200">
                      <img src="https://picsum.photos/seed/modern-room/800/500" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                      
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 px-2.5 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                        <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">LIVE CAMERA 01</span>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                        <div>
                          <p className="text-white text-base font-black tracking-tight drop-shadow-lg">{monitorData?.room.location}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="px-1.5 py-0.5 bg-zinc-900 rounded text-[8px] font-black text-white uppercase">安全</div>
                            <p className="text-white/80 text-[10px] font-medium drop-shadow-md">{monitorData?.room.status}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                            <Target size={16} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 flex flex-col items-center text-center">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 mb-2">
                          <Zap size={16} />
                        </div>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">温度 / TEMP</p>
                        <p className="text-xl font-black text-zinc-900 tabular-nums">{monitorData?.room.temperature}</p>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 flex flex-col items-center text-center">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 mb-2">
                          <Activity size={16} />
                        </div>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">湿度 / HUMID</p>
                        <p className="text-xl font-black text-zinc-900 tabular-nums">{monitorData?.room.humidity}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'dynamics' && (
                  <div 
                    className="space-y-4 p-4 rounded-3xl transition-all duration-300"
                    style={{
                      backgroundImage: resolvedDynamicsBackgroundUrl ? `url(${resolvedDynamicsBackgroundUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="px-1">
                      <h3 className={`text-[10px] font-bold uppercase tracking-widest ${visualSettings?.dynamics?.background ? 'text-white drop-shadow-md' : 'text-zinc-400'}`}>社交动态 / INTERACTIONS</h3>
                    </div>
                    <div className="space-y-3">
                      {monitorData?.dynamics.map((d, i) => (
                        <button 
                          key={i} 
                          onClick={() => setSelectedDynamicsItem(d)}
                          className={`w-full text-left p-4 shadow-sm border flex items-center gap-4 group transition-all ${
                            resolvedDynamicsBackgroundUrl 
                              ? 'backdrop-blur-sm border-white/20 hover:bg-white' 
                              : 'bg-white border-zinc-100 hover:border-zinc-300'
                          }`}
                          style={{
                            borderRadius: visualSettings?.dynamics?.cardBorderRadius ?? 24,
                            backgroundColor: resolvedDynamicsBackgroundUrl 
                              ? `rgba(255, 255, 255, ${visualSettings.dynamics.cardOpacity ?? 0.9})`
                              : undefined
                          }}
                        >
                          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                            <Users size={16} strokeWidth={2.5} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-zinc-800 leading-tight">
                              <span className="font-black text-zinc-900">{d.person}</span>
                              <span className="text-zinc-500 mx-1.5 font-medium">{d.action}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] text-zinc-300 font-black uppercase tracking-widest">{d.time}</span>
                              <div className="w-1 h-1 rounded-full bg-zinc-200" />
                              <span className="text-[9px] text-zinc-400 font-bold">来源: 移动端</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'inventory' && (
                  <div className="space-y-4">
                    <div className="px-1 flex items-center justify-between">
                      <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">随身物品 / INVENTORY</h3>
                      <span className="text-[9px] font-black text-zinc-300 uppercase">{monitorData?.inventory.length} ITEMS</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {monitorData?.inventory.map((item, i) => (
                        <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-zinc-100 flex items-center gap-3 group hover:bg-zinc-50 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 shadow-inner group-hover:bg-white transition-colors">
                            <Package size={16} strokeWidth={1.5} />
                          </div>
                          <span className="text-xs font-bold text-zinc-800">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-4 bg-zinc-100/50 rounded-2xl border border-dashed border-zinc-200 text-center">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">扫描完成 · 未发现违禁品</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Diary Detail Modal */}
      <AnimatePresence>
        {selectedDiaryEntry && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden flex flex-col max-h-[80%]"
            >
              <div className="p-4 border-b border-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Book size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">日志详情 / DIARY DETAIL</h3>
                    <p className="text-[9px] text-zinc-400 font-bold">已通过 256-BIT 加密同步</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDiaryEntry(null)}
                  className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={18} className="text-zinc-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-px flex-1 bg-zinc-100" />
                  <span className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.3em]">CONTENT</span>
                  <div className="h-px flex-1 bg-zinc-100" />
                </div>
                <p className="text-base leading-relaxed text-zinc-800 font-medium italic text-center">
                  "{selectedDiaryEntry}"
                </p>
                <div className="mt-8 pt-6 border-t border-zinc-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ResolvedMonitorAvatar value={selectedChar?.avatar} alt={selectedChar?.name || 'character'} className="w-5 h-5 rounded-full object-cover" />
                    <span className="text-[9px] font-bold text-zinc-500">{selectedChar?.name} 的私密记录</span>
                  </div>
                  <span className="text-[9px] font-black text-zinc-300">2026.02.26</span>
                </div>
              </div>
              <div className="p-4 bg-zinc-50/50">
                <button 
                  onClick={() => setSelectedDiaryEntry(null)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-100 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-900 shadow-sm transition-all hover:bg-zinc-200 active:scale-95"
                >
                  确认并关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Detail Modal */}
      <AnimatePresence>
        {selectedScheduleItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden flex flex-col max-h-[80%]"
            >
              <div className="p-4 border-b border-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">日程详情 / SCHEDULE</h3>
                    <p className="text-[9px] text-zinc-400 font-bold">同步自个人日历</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedScheduleItem(null)}
                  className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={18} className="text-zinc-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="text-4xl font-black text-zinc-900 leading-none mb-2">{selectedScheduleItem.time}</div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    selectedScheduleItem.status === 'completed' ? 'bg-zinc-100 text-zinc-900' :
                    selectedScheduleItem.status === 'ongoing' ? 'bg-zinc-900 text-white' :
                    'bg-zinc-100 text-zinc-400'
                  }`}>
                    {selectedScheduleItem.status === 'completed' ? '已完成' : selectedScheduleItem.status === 'ongoing' ? '进行中' : '未开始'}
                  </div>
                </div>
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
                  <p className="text-base font-bold text-zinc-800">{selectedScheduleItem.task}</p>
                </div>
              </div>
              <div className="p-4 bg-zinc-50/50">
                <button 
                  onClick={() => setSelectedScheduleItem(null)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-100 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-900 shadow-sm transition-all hover:bg-zinc-200 active:scale-95"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamics Detail Modal */}
      <AnimatePresence>
        {selectedDynamicsItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden flex flex-col max-h-[80%]"
            >
              <div className="p-4 border-b border-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">动态详情 / INTERACTION</h3>
                    <p className="text-[9px] text-zinc-400 font-bold">社交网络监测</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDynamicsItem(null)}
                  className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={18} className="text-zinc-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 text-xl font-black">
                    {selectedDynamicsItem.person[0]}
                  </div>
                  <div>
                    <p className="text-lg font-black text-zinc-900">{selectedDynamicsItem.person}</p>
                    <p className="text-xs text-zinc-500 font-medium">相关联系人</p>
                  </div>
                </div>
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="text-base font-bold text-zinc-800 mb-1">{selectedDynamicsItem.action}</p>
                  <p className="text-xs text-zinc-400 font-medium">{selectedDynamicsItem.time}</p>
                </div>
              </div>
              <div className="p-4 bg-zinc-50/50">
                <button 
                  onClick={() => setSelectedDynamicsItem(null)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-100 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-900 shadow-sm transition-all hover:bg-zinc-200 active:scale-95"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Phone App Content Modal */}
      <AnimatePresence>
        {selectedPhoneApp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-[320px] h-[640px] rounded-[48px] shadow-2xl border-[8px] border-zinc-900 overflow-hidden flex flex-col relative"
            >
              {/* Phone Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-2xl z-20" />
              
              {/* App Header */}
              <div className="pt-10 pb-4 px-6 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-zinc-800">
                    <Smartphone size={16} />
                  </div>
                  <span className="text-sm font-black text-zinc-900">{selectedPhoneApp}</span>
                </div>
                <button 
                  onClick={() => setSelectedPhoneApp(null)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <X size={18} className="text-zinc-400" />
                </button>
              </div>

              {/* App Content Simulation */}
              <div className="flex-1 overflow-y-auto bg-white">
                {selectedPhoneApp === '微信' && (
                  <div className="p-4 space-y-4">
                    {monitorData?.phone.find(p => p.app === '微信')?.content.map((chat: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 hover:bg-zinc-50 rounded-2xl transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                          <Users size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-zinc-900">{chat.sender}</span>
                            <span className="text-[10px] text-zinc-400">{chat.time}</span>
                          </div>
                          <p className="text-xs text-zinc-500 line-clamp-1">{chat.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedPhoneApp === '网易云音乐' && (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-48 h-48 rounded-full bg-zinc-900 shadow-2xl mb-8 animate-[spin_10s_linear_infinite] flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 border-4 border-zinc-700" />
                    </div>
                    <h3 className="text-lg font-black text-zinc-900 mb-1">{monitorData?.phone.find(p => p.app === '网易云音乐')?.content.song}</h3>
                    <p className="text-sm text-zinc-400 font-bold">{monitorData?.phone.find(p => p.app === '网易云音乐')?.content.artist}</p>
                    <div className="mt-12 flex items-center gap-8 text-zinc-900">
                      <div className="w-2 h-2 rounded-full bg-zinc-200" />
                      <div className="w-4 h-4 rounded-full bg-zinc-900" />
                      <div className="w-2 h-2 rounded-full bg-zinc-200" />
                    </div>
                  </div>
                )}
                {selectedPhoneApp === '小红书' && (
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {monitorData?.phone.find(p => p.app === '小红书')?.content.map((post: any, i: number) => (
                      <div key={i} className="bg-zinc-50 rounded-xl overflow-hidden shadow-sm">
                        <div className="aspect-[3/4] bg-zinc-200" />
                        <div className="p-2">
                          <p className="text-[10px] font-bold text-zinc-800 line-clamp-1 mb-1">{post.title}</p>
                          <div className="flex items-center gap-1 text-[8px] text-zinc-400">
                            <Heart size={8} />
                            <span>{post.likes}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedPhoneApp === '备忘录' && (
                  <div className="p-6 space-y-4">
                    {monitorData?.phone.find(p => p.app === '备忘录')?.content.map((note: string, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-3 border-b border-zinc-50">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        <span className="text-xs font-medium text-zinc-700">{note}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone Home Bar */}
              <div className="h-8 flex items-center justify-center pb-2">
                <div className="w-24 h-1 bg-zinc-200 rounded-full" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SideNavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all relative group w-full py-1`}
    >
      <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-zinc-100 text-zinc-900 shadow-sm scale-110' : 'bg-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'}`}>
        {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 16, strokeWidth: active ? 2.5 : 2 })}
      </div>
      <span className={`text-[8px] font-black transition-colors duration-300 ${active ? 'text-zinc-900' : 'text-zinc-300'} uppercase tracking-tighter whitespace-nowrap`}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="activeIndicator"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-zinc-900 rounded-l-full"
        />
      )}
    </button>
  );
}
