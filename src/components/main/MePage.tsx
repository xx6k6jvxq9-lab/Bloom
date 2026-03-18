
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Pencil, Link2, Upload, RefreshCw, ChevronRight, 
  Ghost, Users, Settings, Database, Download, 
  Heart, Palette, Image as ImageIcon, Trash2, Plus, X, Check,
  MessageSquare, Star, Share2, FileJson, Layers, UserRound, Book, Compass,
  UserPlus, Phone, Banknote, Calendar, Mic
} from 'lucide-react';
import { Mask, FavoriteMessage, VisualSettings, UserProfileExtended, WorldBookEntry } from '../../types';
import { usePersistentFieldActions } from '../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { extractImageUrls, showInAppConfirm } from '../../utils';

type MePageProps = {
  userProfile: UserProfileExtended;
  setUserProfile: (p: UserProfileExtended) => void;
  masks: Mask[];
  setMasks: (m: Mask[]) => void;
  favorites: FavoriteMessage[];
  visualSettings: VisualSettings;
  setVisualSettings: (s: VisualSettings) => void;
  chatHistory: any;
  characters: any[];
  moments?: any[];
  collectedDates?: any[];
  worldBooks?: WorldBookEntry[];
  setWorldBooks?: (wb: WorldBookEntry[]) => void;
  onAddCharacter?: (char: any) => void;
  onDeleteCharacter?: (id: string) => void;
  onUpdateCharacter?: (char: any) => void;
  appData?: any;
  setAppData?: any;
  settings?: any;
  setSettings?: (s: any) => void;
  onSectionChange?: (section: 'main' | 'masks' | 'data' | 'visual' | 'favorites' | 'worldbooks' | 'characters') => void;
};

export function MePage({ 
  userProfile, 
  setUserProfile, 
  masks, 
  setMasks, 
  favorites, 
  visualSettings, 
  setVisualSettings,
  chatHistory,
  characters,
  moments = [],
  collectedDates = [],
  worldBooks = [],
  setWorldBooks,
  onAddCharacter,
  onDeleteCharacter,
  onUpdateCharacter,
  appData,
  setAppData,
  settings,
  setSettings,
  onSectionChange,
}: MePageProps) {
  const [activeSection, setActiveSection] = useState<'main' | 'masks' | 'data' | 'visual' | 'favorites' | 'worldbooks' | 'characters'>('main');
  const [editingProfile, setEditingProfile] = useState(false);

  const { globalBackground } = visualSettings;
  const { resolvedUrl: resolvedGlobalBackgroundUrl } = useResolvedPersistentValue(globalBackground);
  const { resolvedUrl: resolvedUserAvatarUrl } = useResolvedPersistentValue(userProfile.avatar);
  const bgStyle = resolvedGlobalBackgroundUrl ? { backgroundColor: `rgba(255, 255, 255, 0.85)` } : { backgroundColor: 'white' };
  const containerBgStyle = resolvedGlobalBackgroundUrl ? { backgroundColor: 'transparent' } : { backgroundColor: '#fafafa' };

  useEffect(() => {
    onSectionChange?.(activeSection);
  }, [activeSection, onSectionChange]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative" style={containerBgStyle}>
      {resolvedGlobalBackgroundUrl && <img src={resolvedGlobalBackgroundUrl} className="absolute inset-0 w-full h-full object-cover -z-10" alt="Background" />}
      {activeSection === 'main' && (
          <div 
            className="flex-1 overflow-y-auto pb-24"
          >
            {/* Profile Header */}
            <div className="px-6 pt-8 pb-6 rounded-b-[32px] shadow-sm border-b border-zinc-100 backdrop-blur-sm" style={bgStyle}>
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full border-4 border-zinc-50 overflow-hidden shadow-md">
                    {resolvedUserAvatarUrl ? (
                      <img src={resolvedUserAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-zinc-100" />
                    )}
                  </div>
                  <button 
                    onClick={() => setEditingProfile(true)}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm active:scale-90 transition-transform"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                <h2 className="mt-3 text-[18px] font-bold text-zinc-900">{userProfile.name}</h2>
                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">ID: {userProfile.id}</p>
                <p className="mt-1.5 text-[12px] text-zinc-500 text-center px-8 line-clamp-2">
                  {userProfile.bio || '还没有简介...'}
                </p>
              </div>
            </div>

            {/* Menu Sections */}
            <div className="px-4 mt-6 space-y-4">
              {/* Core: Masks */}
              <div className="rounded-3xl p-1 shadow-sm border border-zinc-100 backdrop-blur-sm" style={bgStyle}>
                <MenuButton 
                  icon={<Ghost className="text-zinc-900" size={20} />} 
                  label="身份面具 (Masks)" 
                  subLabel={masks.length > 0 ? `当前有 ${masks.length} 个面具` : '创建你的多重身份'}
                  onClick={() => setActiveSection('masks')}
                />
              </div>

              {/* Character Management */}
              <div className="rounded-3xl p-1 shadow-sm border border-zinc-100 backdrop-blur-sm" style={bgStyle}>
                <MenuButton 
                  icon={<Users className="text-zinc-900" size={20} />} 
                  label="角色管理" 
                  subLabel={`管理 ${characters.length} 个角色`}
                  onClick={() => setActiveSection('characters')}
                />
              </div>

              {/* Data & Favorites */}
              <div className="rounded-3xl p-1 shadow-sm border border-zinc-100 divide-y divide-zinc-50/50 backdrop-blur-sm" style={bgStyle}>
                <MenuButton 
                  icon={<Database className="text-zinc-900" size={20} />} 
                  label="聊天数据备份" 
                  onClick={() => setActiveSection('data')}
                />
                <MenuButton 
                  icon={<Heart className="text-zinc-900" size={20} />} 
                  label="我的收藏" 
                  subLabel={`${favorites.length + moments.filter(m => m.isCollected).length} 条内容`}
                  onClick={() => setActiveSection('favorites')}
                />
              </div>


            </div>
          </div>
        )}



        {activeSection === 'characters' && (
          <CharacterManager 
            characters={characters}
            onDelete={onDeleteCharacter}
            onBack={() => setActiveSection('main')}
            globalBackground={globalBackground}
          />
        )}

        {activeSection === 'masks' && (
          <MaskManager 
            masks={masks} 
            setMasks={setMasks} 
            onBack={() => setActiveSection('main')} 
            characters={characters}
            globalBackground={globalBackground}
          />
        )}

        {activeSection === 'data' && (
          <DataManager 
            onBack={() => setActiveSection('main')} 
            chatHistory={chatHistory}
            characters={characters}
            favorites={favorites}
            masks={masks}
            worldBooks={worldBooks}
            moments={moments}
            userProfile={userProfile}
            globalBackground={globalBackground}
            appData={appData}
          />
        )}

        {activeSection === 'favorites' && (
          <FavoritesManager 
            favorites={favorites} 
            moments={moments}
            collectedDates={collectedDates}
            characters={characters}
            onBack={() => setActiveSection('main')} 
            globalBackground={globalBackground}
          />
        )}

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {editingProfile && (
          <ProfileEditModal 
            userProfile={userProfile} 
            setUserProfile={setUserProfile} 
            onClose={() => setEditingProfile(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ResolvedMeAvatar({
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

function ResolvedMeImage({
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



function CharacterManager({ characters, onDelete, onBack, globalBackground }: { characters: any[], onDelete?: (id: string) => void, onBack: () => void, globalBackground?: string }) {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (await showInAppConfirm(`确定要删除选中的 ${selectedIds.length} 个角色吗？`)) {
      selectedIds.forEach(id => onDelete?.(id));
      setIsBatchMode(false);
      setSelectedIds([]);
    }
  };

  return (
    <div 
      className={`absolute inset-0 flex flex-col z-[100] ${globalBackground ? 'bg-transparent' : 'bg-zinc-50'}`}
    >
      <div className={`pt-12 pb-4 px-4 border-b flex items-center justify-between backdrop-blur-md ${
        globalBackground ? 'bg-white/30 border-white/20' : 'bg-white border-zinc-100'
      }`}>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400"><X size={24} /></button>
          <h3 className="text-[17px] font-bold">角色管理</h3>
        </div>
        <button 
          onClick={() => {
            setIsBatchMode(!isBatchMode);
            setSelectedIds([]);
          }} 
          className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${isBatchMode ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
        >
          {isBatchMode ? '取消批量' : '批量操作'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {characters.length === 0 && (
          <div className="py-20 text-center text-zinc-300">
            <Users size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-[14px]">还没有添加角色</p>
          </div>
        )}
        {characters.map(char => (
          <div 
            key={char.id} 
            onClick={() => isBatchMode && toggleSelect(char.id)}
            className={`rounded-2xl p-3 flex items-center gap-3 transition-all relative overflow-hidden backdrop-blur-sm ${
              isBatchMode && selectedIds.includes(char.id) 
                ? 'bg-zinc-100 border border-zinc-200' 
                : (globalBackground ? 'bg-white/50 border border-white/30' : 'bg-white border border-zinc-100')
            }`}
          >
            <ResolvedMeAvatar value={char.avatar} alt={char.name} className="w-12 h-12 rounded-full object-cover bg-zinc-100 shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-bold text-zinc-900 truncate">{char.name}</h4>
              <p className="text-[12px] text-zinc-500 truncate">{char.openingRemark}</p>
            </div>
            
            {isBatchMode ? (
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${selectedIds.includes(char.id) ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-200 bg-white'}`}>
                {selectedIds.includes(char.id) && <Check size={14} strokeWidth={3} />}
              </div>
            ) : (
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  if (await showInAppConfirm(`确定要删除角色 "${char.name}" 吗？`)) {
                    onDelete?.(char.id);
                  }
                }}
                className="p-2 text-zinc-400 hover:text-red-500 active:bg-zinc-100 rounded-full transition-colors"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isBatchMode && selectedIds.length > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white border-t border-zinc-100 p-4 pb-8 flex items-center justify-center"
        >
          <button 
            onClick={handleBatchDelete}
            className="w-full max-w-[200px] flex items-center justify-center gap-2 py-3 text-red-600 bg-red-50 active:bg-red-100 rounded-2xl transition-colors font-bold"
          >
            <Trash2 size={20} />
            <span>删除选中 ({selectedIds.length})</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}

function MenuButton({ icon, label, subLabel, onClick }: { icon: React.ReactNode, label: string, subLabel?: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 active:bg-zinc-50 transition-colors rounded-2xl"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[15px] font-semibold text-zinc-800">{label}</span>
          {subLabel && <span className="text-[11px] text-zinc-400">{subLabel}</span>}
        </div>
      </div>
      <ChevronRight size={18} className="text-zinc-300" />
    </button>
  );
}

// --- Sub-components ---

function ProfileEditModal({ userProfile, setUserProfile, onClose }: { userProfile: UserProfileExtended, setUserProfile: (p: UserProfileExtended) => void, onClose: () => void }) {
  const [tempProfile, setTempProfile] = useState(userProfile);
  const [tempUrl, setTempUrl] = useState('');
  const { setRemoteUrl, setUploadedFile } = usePersistentFieldActions();
  const { resolvedUrl: resolvedTempAvatarUrl } = useResolvedPersistentValue(tempProfile.avatar);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-[360px] bg-white rounded-t-[40px] p-6 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-6" />
        <h3 className="text-[18px] font-bold text-center mb-6">编辑个人资料</h3>
        
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            {resolvedTempAvatarUrl ? (
              <img src={resolvedTempAvatarUrl} className="w-20 h-20 rounded-full border-2 border-zinc-100 object-cover" alt="Avatar" />
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-zinc-100 bg-zinc-50" />
            )}
            <div className="flex gap-2 w-full">
              <input 
                type="text" 
                placeholder="支持链接、Markdown或HTML图片"
                value={tempUrl}
                onChange={e => setTempUrl(e.target.value)}
                className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-[12px] outline-none"
              />
              <button 
                onClick={async () => { 
                  if(tempUrl) {
                    const finalUrl = await setRemoteUrl(extractImageUrls(tempUrl)[0] || tempUrl.trim());
                    setTempProfile({...tempProfile, avatar: finalUrl}); 
                  }
                  setTempUrl(''); 
                }}
                className="bg-zinc-900 text-white px-3 py-2 rounded-xl text-[12px]"
              >
                确认
              </button>
              <label className="bg-zinc-100 text-zinc-600 px-3 py-2 rounded-xl text-[12px] cursor-pointer">
                上传
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  if(file) {
                    const persistedValue = await setUploadedFile(file);
                    setTempProfile({...tempProfile, avatar: persistedValue});
                    e.currentTarget.value = '';
                  }
                }} />
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] text-zinc-400 ml-1">昵称</label>
            <input 
              type="text" 
              value={tempProfile.name}
              onChange={e => setTempProfile({...tempProfile, name: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] text-zinc-400 ml-1">个人 ID</label>
            <input 
              type="text" 
              value={tempProfile.id}
              onChange={e => setTempProfile({...tempProfile, id: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] text-zinc-400 ml-1">一句话简介</label>
            <textarea 
              value={tempProfile.bio}
              onChange={e => setTempProfile({...tempProfile, bio: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-blue-500 min-h-[80px] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl bg-zinc-100 text-zinc-600 font-bold text-[15px]"
            >
              取消
            </button>
            <button 
              onClick={() => { setUserProfile(tempProfile); onClose(); }}
              className="flex-1 py-3.5 rounded-2xl bg-zinc-900 text-white font-bold text-[15px]"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MaskManager({ masks, setMasks, onBack, characters, globalBackground }: { masks: Mask[], setMasks: (m: Mask[]) => void, onBack: () => void, characters: any[], globalBackground?: string }) {
  const [editingMask, setEditingMask] = useState<Mask | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedMaskIds, setSelectedMaskIds] = useState<string[]>([]);
  const [showBatchSyncModal, setShowBatchSyncModal] = useState(false);

  const handleAdd = () => {
    const newMask: Mask = {
      id: Date.now().toString(),
      name: '新面具',
      personality: '',
      occupation: '',
      relationship: '',
      worldBackground: '',
      isActive: false,
      linkedCharacters: []
    };
    setEditingMask(newMask);
  };

  const handleSave = (mask: Mask) => {
    if (masks.find(m => m.id === mask.id)) {
      setMasks(masks.map(m => m.id === mask.id ? mask : m));
    } else {
      setMasks([...masks, mask]);
    }
    setEditingMask(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedMaskIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchActivate = (active: boolean) => {
    setMasks(masks.map(m => selectedMaskIds.includes(m.id) ? { ...m, isActive: active } : m));
    setIsBatchMode(false);
    setSelectedMaskIds([]);
  };

  const handleBatchDelete = async () => {
    if (await showInAppConfirm(`确定要删除选中的 ${selectedMaskIds.length} 个面具吗？`)) {
      setMasks(masks.filter(m => !selectedMaskIds.includes(m.id)));
      setIsBatchMode(false);
      setSelectedMaskIds([]);
    }
  };

  const handleBatchSync = (characterIds: string[]) => {
    setMasks(masks.map(m => {
      if (selectedMaskIds.includes(m.id)) {
        // Merge or replace? Usually sync means setting these characters to use this mask.
        // But one character can only have one mask linked in the current logic (masks.find in App.tsx).
        // So we should probably replace.
        return { ...m, linkedCharacters: characterIds };
      }
      return m;
    }));
    setShowBatchSyncModal(false);
    setIsBatchMode(false);
    setSelectedMaskIds([]);
  };

  return (
    <div 
      className={`absolute inset-0 flex flex-col z-[100] ${globalBackground ? 'bg-transparent' : 'bg-zinc-50'}`}
    >
      <div className={`pt-12 pb-4 px-4 border-b flex items-center justify-between backdrop-blur-md ${
        globalBackground ? 'bg-white/30 border-white/20' : 'bg-white border-zinc-100'
      }`}>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400"><X size={24} /></button>
          <h3 className="text-[17px] font-bold">身份面具管理</h3>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => {
              setIsBatchMode(!isBatchMode);
              setSelectedMaskIds([]);
            }} 
            className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${isBatchMode ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
          >
            {isBatchMode ? '取消批量' : '批量操作'}
          </button>
          {!isBatchMode && (
            <button onClick={handleAdd} className="p-2 text-blue-500"><Plus size={24} /></button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {masks.length === 0 && (
          <div className="py-20 text-center text-zinc-300">
            <Ghost size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-[14px]">还没有创建面具</p>
          </div>
        )}
        {masks.map(mask => (
          <div 
            key={mask.id} 
            onClick={() => isBatchMode && toggleSelect(mask.id)}
            className={`rounded-3xl p-5 shadow-sm border transition-all relative overflow-hidden backdrop-blur-sm ${
              isBatchMode && selectedMaskIds.includes(mask.id) 
                ? 'border-blue-500 ring-1 ring-blue-500/20' 
                : (globalBackground ? 'border-white/30' : 'border-zinc-100')
            } ${globalBackground ? 'bg-white/50' : 'bg-white'}`}
          >
            {isBatchMode && (
              <div className="absolute top-4 right-4 z-10">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedMaskIds.includes(mask.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-zinc-200 bg-white'}`}>
                  {selectedMaskIds.includes(mask.id) && <Check size={14} strokeWidth={3} />}
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-[16px] font-bold text-zinc-900">{mask.name}</h4>
                <p className="text-[12px] text-zinc-400">{mask.occupation || '职业未知'}</p>
              </div>
              {!isBatchMode && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingMask(mask); }}
                    className="p-2 text-zinc-400 hover:text-blue-500"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setMasks(masks.filter(m => m.id !== mask.id)); }}
                    className="p-2 text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[13px] text-zinc-600 line-clamp-2"><span className="font-medium">性格：</span>{mask.personality || '未设置'}</p>
              <p className="text-[13px] text-zinc-600"><span className="font-medium">关系：</span>{mask.relationship || '未设置'}</p>
              {mask.worldBackground && (
                <p className="text-[13px] text-zinc-600 line-clamp-2"><span className="font-medium">世界观：</span>{mask.worldBackground}</p>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">已同步 {mask.linkedCharacters.length} 个角色</span>
              {!isBatchMode && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setMasks(masks.map(m => m.id === mask.id ? { ...m, isActive: !m.isActive } : m)); }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors active:scale-95 ${mask.isActive ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-400'}`}
                >
                  {mask.isActive ? '当前激活' : '未激活'}
                </button>
              )}
              {isBatchMode && (
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${mask.isActive ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-400'}`}>
                  {mask.isActive ? '当前激活' : '未激活'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isBatchMode && selectedMaskIds.length > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white border-t border-zinc-100 p-4 pb-8 flex items-center justify-around gap-2"
        >
          <button 
            onClick={() => handleBatchActivate(true)}
            className="flex-1 flex flex-col items-center gap-1 py-2 text-green-600 active:bg-green-50 rounded-2xl transition-colors"
          >
            <Check size={20} />
            <span className="text-[10px] font-bold">批量激活</span>
          </button>
          <button 
            onClick={() => handleBatchActivate(false)}
            className="flex-1 flex flex-col items-center gap-1 py-2 text-zinc-500 active:bg-zinc-50 rounded-2xl transition-colors"
          >
            <X size={20} />
            <span className="text-[10px] font-bold">批量取消</span>
          </button>
          <button 
            onClick={() => setShowBatchSyncModal(true)}
            className="flex-1 flex flex-col items-center gap-1 py-2 text-blue-600 active:bg-blue-50 rounded-2xl transition-colors"
          >
            <RefreshCw size={20} />
            <span className="text-[10px] font-bold">批量同步</span>
          </button>
          <button 
            onClick={handleBatchDelete}
            className="flex-1 flex flex-col items-center gap-1 py-2 text-red-600 active:bg-red-50 rounded-2xl transition-colors"
          >
            <Trash2 size={20} />
            <span className="text-[10px] font-bold">批量删除</span>
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {editingMask && (
          <MaskEditModal 
            mask={editingMask} 
            onSave={handleSave} 
            onClose={() => setEditingMask(null)} 
            characters={characters}
          />
        )}
        {showBatchSyncModal && (
          <BatchSyncModal 
            characters={characters}
            onSync={handleBatchSync}
            onClose={() => setShowBatchSyncModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BatchSyncModal({ characters, onSync, onClose }: { characters: any[], onSync: (ids: string[]) => void, onClose: () => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-[300px] bg-white rounded-[32px] p-6"
      >
        <h3 className="text-[18px] font-bold mb-4">批量同步到角色</h3>
        <p className="text-[12px] text-zinc-400 mb-4">选中的面具将同步到以下角色：</p>
        
        <div className="space-y-2 max-h-[200px] overflow-y-auto mb-6 pr-2">
          {characters.map(char => (
            <button 
              key={char.id}
              onClick={() => {
                setSelectedIds(prev => 
                  prev.includes(char.id) ? prev.filter(id => id !== char.id) : [...prev, char.id]
                );
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-colors ${selectedIds.includes(char.id) ? 'bg-blue-50 border-blue-200' : 'bg-zinc-50 border-zinc-100'}`}
            >
              <div className="flex items-center gap-2">
                <ResolvedMeAvatar value={char.avatar} alt={char.name} className="w-7 h-7 rounded-full object-cover" />
                <span className="text-[13px] font-medium">{char.name}</span>
              </div>
              {selectedIds.includes(char.id) && <Check size={16} className="text-blue-500" />}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-100 text-zinc-600 text-[14px] font-bold">取消</button>
          <button 
            onClick={() => onSync(selectedIds)} 
            disabled={selectedIds.length === 0}
            className="flex-1 py-3 rounded-xl bg-blue-500 text-white text-[14px] font-bold disabled:opacity-50"
          >
            确定同步
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MaskEditModal({ mask, onSave, onClose, characters }: { mask: Mask, onSave: (m: Mask) => void, onClose: () => void, characters: any[] }) {
  const [temp, setTemp] = useState(mask);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-[320px] bg-white rounded-[32px] p-6 max-h-[80vh] overflow-y-auto"
      >
        <h3 className="text-[18px] font-bold mb-6">编辑面具</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[12px] text-zinc-400 ml-1">面具名称</label>
            <input 
              type="text" 
              value={temp.name}
              onChange={e => setTemp({...temp, name: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 text-[14px] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-zinc-400 ml-1">职业</label>
            <input 
              type="text" 
              value={temp.occupation}
              onChange={e => setTemp({...temp, occupation: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 text-[14px] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-zinc-400 ml-1">性格描述</label>
            <textarea 
              value={temp.personality}
              onChange={e => setTemp({...temp, personality: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 text-[14px] outline-none min-h-[60px] resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-zinc-400 ml-1">与 AI 的关系</label>
            <input 
              type="text" 
              value={temp.relationship}
              onChange={e => setTemp({...temp, relationship: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 text-[14px] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-zinc-400 ml-1">世界观背景</label>
            <textarea 
              value={temp.worldBackground}
              onChange={e => setTemp({...temp, worldBackground: e.target.value})}
              placeholder="描述当前面具所处的世界背景、时代、规则等..."
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 text-[14px] outline-none min-h-[80px] resize-none"
            />
          </div>

          <div className="pt-2">
            <label className="text-[12px] text-zinc-400 ml-1 mb-2 block">同步到角色</label>
            <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2">
              {characters.map(char => (
                <button 
                  key={char.id}
                  onClick={() => {
                    const linked = temp.linkedCharacters.includes(char.id)
                      ? temp.linkedCharacters.filter(id => id !== char.id)
                      : [...temp.linkedCharacters, char.id];
                    setTemp({...temp, linkedCharacters: linked});
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg border transition-colors ${temp.linkedCharacters.includes(char.id) ? 'bg-blue-50 border-blue-200' : 'bg-zinc-50 border-zinc-100'}`}
                >
                  <div className="flex items-center gap-2">
                    <ResolvedMeAvatar value={char.avatar} alt={char.name} className="w-6 h-6 rounded-full" />
                    <span className="text-[12px]">{char.name}</span>
                  </div>
                  {temp.linkedCharacters.includes(char.id) && <Check size={14} className="text-blue-500" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-100 text-zinc-600 text-[14px] font-bold">取消</button>
            <button onClick={() => onSave(temp)} className="flex-1 py-3 rounded-xl bg-blue-500 text-white text-[14px] font-bold">保存</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DataManager({ 
  onBack, 
  chatHistory, 
  characters, 
  favorites, 
  masks,
  worldBooks,
  moments,
  userProfile,
  globalBackground, 
  appData
}: { 
  onBack: () => void, 
  chatHistory: any, 
  characters: any[], 
  favorites: any[], 
  masks: any[],
  worldBooks: any[],
  moments: any[],
  userProfile: any,
  globalBackground?: string, 
  appData?: any
}) {
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  const modules = [
    { id: 'chatHistory', label: '聊天记录', desc: `${Object.keys(chatHistory || {}).length} 个对话`, icon: <MessageSquare size={20} />, data: chatHistory },
    { id: 'characters', label: '角色数据', desc: `${characters?.length || 0} 个角色`, icon: <Users size={20} />, data: characters },
    { id: 'masks', label: '身份面具', desc: `${masks?.length || 0} 个面具`, icon: <Ghost size={20} />, data: masks },
    { id: 'worldBooks', label: '世界书', desc: `${worldBooks?.length || 0} 条设定`, icon: <Book size={20} />, data: worldBooks },
    { id: 'favorites', label: '收藏消息', desc: `${favorites?.length || 0} 条收藏`, icon: <Heart size={20} />, data: favorites },
    { id: 'moments', label: '朋友圈', desc: `${moments?.length || 0} 条动态`, icon: <Compass size={20} />, data: moments },
    { id: 'callHistory', label: '通话记录', desc: `${appData?.callHistory?.length || 0} 条记录`, icon: <Phone size={20} />, data: appData?.callHistory },
    { id: 'userProfile', label: '个人资料', desc: '头像与昵称', icon: <UserRound size={20} />, data: userProfile },
  ];

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
    a.download = `chat_data_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('备份导出成功！');
  };

  const toggleModule = (id: string) => {
    setSelectedModules(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className={`absolute inset-0 flex flex-col z-[100] ${globalBackground ? 'bg-transparent' : 'bg-zinc-50'}`}>
      <div className={`pt-12 pb-4 px-4 border-b flex items-center justify-between backdrop-blur-md ${globalBackground ? 'bg-white/30 border-white/20' : 'bg-white border-zinc-100'}`}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:bg-black/5 rounded-full transition-colors"><X size={24} /></button>
          <h3 className="text-[17px] font-bold">聊天数据备份</h3>
        </div>
        <button 
          onClick={handleExportSelected}
          disabled={selectedModules.length === 0}
          className="text-[14px] font-bold text-blue-500 disabled:opacity-50 px-2"
        >
          导出 ({selectedModules.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[14px] font-bold text-zinc-900">选择备份内容</h4>
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
          </div>

          <div className="space-y-2">
            {modules.map(mod => (
              <button
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all active:scale-[0.99] ${
                  selectedModules.includes(mod.id)
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                    : globalBackground ? 'bg-white/50 border-white/30 text-zinc-700' : 'bg-white border-zinc-100 text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedModules.includes(mod.id) ? 'bg-white/20' : 'bg-zinc-50'
                  }`}>
                    {mod.icon}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[15px] font-bold">{mod.label}</span>
                    <span className={`text-[12px] ${selectedModules.includes(mod.id) ? 'text-zinc-400' : 'text-zinc-400'}`}>
                      {mod.desc}
                    </span>
                  </div>
                </div>
                
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedModules.includes(mod.id) ? 'bg-white border-white' : 'border-zinc-200 bg-transparent'
                }`}>
                  {selectedModules.includes(mod.id) && <Check size={14} className="text-zinc-900" strokeWidth={3} />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
          <p className="text-[11px] text-amber-700 leading-relaxed">
            提示：此页面仅提供聊天相关数据的导出备份。如需全量备份或数据恢复，请前往“自定义中心 - 数据管理”。
          </p>
        </div>
      </div>
    </div>
  );
}

function BackupItem({ title, desc, onClick, globalBackground }: { title: string, desc: string, onClick: () => void, globalBackground?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full p-4 rounded-2xl border shadow-sm flex items-center justify-between active:scale-[0.98] transition-all hover:shadow-md mb-2 last:mb-0 ${
        globalBackground ? 'bg-white/80 border-white/20 backdrop-blur-md' : 'bg-white border-zinc-100'
      }`}
    >
      <div className="text-left">
        <p className="text-[14px] font-bold text-zinc-800">{title}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p>
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 ${
        globalBackground ? 'bg-black/5' : 'bg-zinc-50'
      }`}>
        <Download size={14} />
      </div>
    </button>
  );
}

function FavoritesManager({ favorites, moments, collectedDates, characters, onBack, globalBackground }: { favorites: FavoriteMessage[], moments?: any[], collectedDates?: any[], characters?: any[], onBack: () => void, globalBackground?: string }) {
  const [activeCategory, setActiveCategory] = useState('全部');
  const collectedMoments = (moments || []).filter(m => m.isCollected);
  
  const categories = ['全部', '约会', '通话', '聊天', '动态'];

  const filteredFavorites = (activeCategory === '全部' || activeCategory === '聊天' || activeCategory === '通话') 
    ? (activeCategory === '全部' 
        ? favorites 
        : favorites.filter(f => f.category === activeCategory || (activeCategory === '聊天' && !f.category)))
    : [];
    
  const filteredMoments = (activeCategory === '全部' || activeCategory === '动态')
    ? collectedMoments
    : [];

  const filteredDates = (activeCategory === '全部' || activeCategory === '约会')
    ? (collectedDates || [])
    : [];

  return (
    <div 
      className={`absolute inset-0 flex flex-col z-[100] ${globalBackground ? 'bg-transparent' : 'bg-zinc-50'}`}
    >
      <div className={`pt-12 pb-4 px-4 border-b flex items-center gap-3 backdrop-blur-md ${
        globalBackground ? 'bg-white/30 border-white/20' : 'bg-white border-zinc-100'
      }`}>
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-400"><X size={24} /></button>
        <h3 className="text-[17px] font-bold">我的收藏</h3>
      </div>

      <div className={`px-4 py-3 flex gap-2 overflow-x-auto shrink-0 no-scrollbar backdrop-blur-md ${
        globalBackground ? 'bg-white/30 border-b border-white/20' : 'bg-white border-b border-zinc-50'
      }`}>
        {categories.map(c => (
          <button 
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-200 ${
              activeCategory === c 
                ? 'bg-zinc-900 text-white shadow-md scale-105' 
                : 'bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-400'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredFavorites.length === 0 && filteredMoments.length === 0 && filteredDates.length === 0 && (
          <div className="py-20 text-center text-zinc-300">
            <Heart size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-[14px]">收藏夹空空如也</p>
          </div>
        )}
        
        {/* Render Dates */}
        {filteredDates.map(date => {
          const char = characters?.find(c => c.id === date.characterId) || { name: '未知角色' };
          return (
            <div key={date.id} className={`rounded-2xl p-4 shadow-sm border space-y-2 backdrop-blur-sm ${
              globalBackground ? 'bg-white/50 border-white/30' : 'bg-white border-zinc-100'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">约会 · {char.name}</span>
                <span className="text-[10px] text-zinc-400">{new Date(date.timestamp).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-zinc-500 italic">
                <span>📍 {date.location}</span>
                <span>•</span>
                <span>{date.scenario}</span>
              </div>
              <p className="text-[14px] text-zinc-700 leading-relaxed line-clamp-3">
                {date.messages[date.messages.length - 1]?.text || '开启了一场浪漫约会...'}
              </p>
            </div>
          );
        })}

        {/* Render Moments */}
        {filteredMoments.map(moment => {
          const author = moment.authorId === 'user' 
            ? { name: '我' } 
            : characters?.find(c => c.id === moment.authorId) || { name: '未知用户' };
            
          return (
            <div key={moment.id} className={`rounded-2xl p-4 shadow-sm border space-y-2 backdrop-blur-sm ${
              globalBackground ? 'bg-white/50 border-white/30' : 'bg-white border-zinc-100'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">动态 · {author.name}</span>
                <span className="text-[10px] text-zinc-400">{new Date(moment.timestamp).toLocaleDateString()}</span>
              </div>
              <p className="text-[14px] text-zinc-700 leading-relaxed whitespace-pre-wrap">{moment.content}</p>
              {moment.images && moment.images.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                  {moment.images.map((img: string, i: number) => (
                    <ResolvedMeImage
                      key={i}
                      value={img}
                      alt={`moment-${moment.id}-${i}`}
                      className="h-16 w-16 object-cover rounded-lg border border-zinc-100 shrink-0"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Render Chat Favorites */}
        {filteredFavorites.map(fav => (
          <div key={fav.id} className={`rounded-2xl p-4 shadow-sm border space-y-2 backdrop-blur-sm ${
            globalBackground ? 'bg-white/50 border-white/30' : 'bg-white border-zinc-100'
          }`}>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                {fav.category === '通话' ? '通话' : '聊天'} · {fav.characterName}
              </span>
              <span className="text-[10px] text-zinc-400">{new Date(fav.timestamp).toLocaleDateString()}</span>
            </div>
            <p className="text-[14px] text-zinc-700 leading-relaxed">{fav.text}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button className="p-1.5 text-zinc-300 hover:text-zinc-900"><Share2 size={14} /></button>
              <button className="p-1.5 text-zinc-300 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorldBookManager({ 
  worldBooks, 
  characters,
  setWorldBooks, 
  onBack, 
  globalBackground,
  onAddCharacter
}: { 
  worldBooks: WorldBookEntry[], 
  characters: any[],
  setWorldBooks: (wb: WorldBookEntry[]) => void, 
  onBack: () => void, 
  globalBackground?: string,
  onAddCharacter?: (char: any) => void
}) {
  const [activeCategory, setActiveCategory] = useState('全部');
  const [showAdd, setShowAdd] = useState(false);
  const [editForm, setEditForm] = useState<Partial<WorldBookEntry>>({
    title: '',
    content: '',
    category: '世界设定',
    isActive: true,
    isGlobal: true,
    characterIds: []
  });

  const categories = ['全部', '世界设定', '角色设定', '自己设定', '热梗知识', '其他'];
  const filtered = activeCategory === '全部' ? worldBooks : worldBooks.filter(wb => wb.category === activeCategory);

  const handleSave = () => {
    if (!editForm.title || !editForm.content) return alert('请填写标题和内容');
    
    const newEntry: WorldBookEntry = {
      id: editForm.id || Date.now().toString(),
      title: editForm.title,
      content: editForm.content,
      category: editForm.category as any,
      isActive: editForm.isActive ?? true,
      isGlobal: editForm.isGlobal ?? true,
      characterIds: editForm.characterIds || []
    };

    if (editForm.id) {
      setWorldBooks(worldBooks.map(wb => wb.id === editForm.id ? newEntry : wb));
    } else {
      setWorldBooks([newEntry, ...worldBooks]);
    }
    setShowAdd(false);
    setEditForm({ title: '', content: '', category: '世界设定', isActive: true, isGlobal: true, characterIds: [] });
  };

  const handleDelete = async (id: string) => {
    if (await showInAppConfirm('确定要删除这条设定吗？')) {
      setWorldBooks(worldBooks.filter(wb => wb.id !== id));
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          // Basic validation
          const validEntries = parsed.filter(item => item.title && item.content).map(item => ({
            id: item.id || Date.now().toString() + Math.random(),
            title: item.title,
            content: item.content,
            category: item.category || '其他',
            isActive: item.isActive ?? true,
            isGlobal: item.isGlobal ?? true,
            characterIds: item.characterIds || []
          }));
          setWorldBooks([...validEntries, ...worldBooks]);
          alert(`成功导入 ${validEntries.length} 条设定`);
        } else {
          alert('文件格式不正确，需要是包含设定的 JSON 数组');
        }
      } catch (err) {
        alert('解析文件失败，请确保是有效的 JSON 文件');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className={`absolute inset-0 flex flex-col z-[100] ${globalBackground ? 'bg-transparent' : 'bg-zinc-50'}`}>
      {showAdd ? (
        <div className={`flex-1 flex flex-col ${globalBackground ? 'bg-white/80 backdrop-blur-2xl' : 'bg-white'}`}>
          <div className={`pt-12 pb-4 px-4 border-b flex items-center justify-between ${globalBackground ? 'border-white/20' : 'border-zinc-100'}`}>
            <button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:bg-black/5 px-2 py-1 rounded-lg transition-colors">取消</button>
            <span className="font-bold text-[17px]">{editForm.id ? '编辑设定' : '添加设定'}</span>
            <button onClick={handleSave} className="text-blue-500 font-bold hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">保存</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">标题</label>
              <input 
                type="text" 
                value={editForm.title}
                onChange={e => setEditForm({...editForm, title: e.target.value})}
                placeholder="例如：霍格沃茨魔法学校"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-[15px] outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">分类</label>
              <select 
                value={editForm.category}
                onChange={e => setEditForm({...editForm, category: e.target.value as any})}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-[15px] outline-none focus:border-blue-500 appearance-none"
              >
                {categories.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">设定内容</label>
              <textarea 
                value={editForm.content}
                onChange={e => setEditForm({...editForm, content: e.target.value})}
                placeholder="详细描述这个设定..."
                className="w-full h-40 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-[15px] outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <div>
                <div className="text-[14px] font-bold text-zinc-800">全局生效</div>
                <div className="text-[11px] text-zinc-500">开启后，所有角色都能读取此设定</div>
              </div>
              <button 
                onClick={() => setEditForm({...editForm, isGlobal: !editForm.isGlobal})}
                className={`w-12 h-6 rounded-full transition-colors relative ${editForm.isGlobal ? 'bg-blue-500' : 'bg-zinc-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${editForm.isGlobal ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {!editForm.isGlobal && (
              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500">选择角色 (可多选)</label>
                <div className="max-h-40 overflow-y-auto bg-zinc-50 border border-zinc-100 rounded-xl p-2 space-y-1">
                  {characters.map(char => (
                    <div key={char.id} className="flex items-center justify-between p-2 hover:bg-zinc-100 rounded-lg">
                      <div className="flex items-center gap-2">
                        <ResolvedMeAvatar value={char.avatar} alt={char.name} className="w-8 h-8 rounded-full object-cover" />
                        <span className="text-[14px] font-medium text-zinc-800">{char.name}</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={editForm.characterIds?.includes(char.id)}
                        onChange={e => {
                          const checked = e.target.checked;
                          const charId = char.id;
                          setEditForm(prev => {
                            const currentIds = prev.characterIds || [];
                            if (checked) {
                              return { ...prev, characterIds: [...currentIds, charId] };
                            } else {
                              return { ...prev, characterIds: currentIds.filter(id => id !== charId) };
                            }
                          });
                        }}
                        className="w-5 h-5 rounded text-blue-500 focus:ring-blue-500/50 border-zinc-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <div>
                <div className="text-[14px] font-bold text-zinc-800">启用状态</div>
                <div className="text-[11px] text-zinc-500">关闭后，此设定将暂时失效</div>
              </div>
              <button 
                onClick={() => setEditForm({...editForm, isActive: !editForm.isActive})}
                className={`w-12 h-6 rounded-full transition-colors relative ${editForm.isActive ? 'bg-zinc-900' : 'bg-zinc-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${editForm.isActive ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`pt-12 pb-4 px-4 border-b flex items-center justify-between backdrop-blur-2xl ${
            globalBackground ? 'bg-white/70 border-white/20' : 'bg-white border-zinc-100'
          }`}>
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:bg-black/5 rounded-full transition-colors"><X size={24} /></button>
              <h3 className="text-[17px] font-bold">世界书</h3>
            </div>
            <div className="flex items-center gap-2">
              <label className="p-2 text-zinc-600 hover:bg-black/5 rounded-full cursor-pointer transition-colors">
                <Upload size={20} />
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
              <button onClick={() => { setEditForm({ title: '', content: '', category: '世界设定', isActive: true, isGlobal: true, characterIds: [] }); setShowAdd(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors">
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className={`px-4 py-3 flex gap-2 overflow-x-auto shrink-0 no-scrollbar backdrop-blur-2xl ${
            globalBackground ? 'bg-white/70 border-b border-white/20' : 'bg-white border-b border-zinc-50'
          }`}>
            {categories.map(c => (
              <button 
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${activeCategory === c ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filtered.length === 0 && (
              <div className="py-20 text-center text-zinc-300">
                <Book size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-[14px]">暂无设定，点击右上角添加或导入</p>
              </div>
            )}
            {filtered.map(wb => (
              <div key={wb.id} className={`rounded-2xl p-4 shadow-sm border backdrop-blur-xl transition-all active:scale-[0.98] ${
                globalBackground ? 'bg-white/60 border-white/30 hover:bg-white/70' : 'bg-white border-zinc-100 hover:bg-zinc-50'
              } ${!wb.isActive ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-[15px] text-zinc-900 flex items-center gap-2">
                      {wb.title}
                      {!wb.isActive && <span className="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded font-normal">未启动</span>}
                    </h4>
                    <div className="flex gap-1.5 mt-1">
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded border border-zinc-200">{wb.category}</span>
                      {wb.isGlobal && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">全局</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setWorldBooks(worldBooks.map(item => item.id === wb.id ? { ...item, isActive: !item.isActive } : item))}
                      className={`p-1.5 rounded-lg transition-colors ${wb.isActive ? 'text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-zinc-100'}`}
                      title={wb.isActive ? "点击停用" : "点击启用"}
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={() => { setEditForm(wb); setShowAdd(true); }}
                      className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(wb.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-[13px] text-zinc-600 leading-relaxed line-clamp-3">{wb.content}</p>
                
                {wb.category === '角色设定' && onAddCharacter && (
                  <button 
                    onClick={async () => {
                      if (await showInAppConfirm(`要将 "${wb.title}" 添加到聊天列表吗？`)) {
                        onAddCharacter({
                          name: wb.title,
                          setting: wb.content,
                          avatar: `https://picsum.photos/seed/${wb.id}/200`,
                          gender: 'other',
                          openingRemark: '你好！'
                        });
                        alert('已添加至通讯录！');
                      }
                    }}
                    className="mt-3 w-full py-2 bg-zinc-100 text-zinc-900 rounded-xl text-[12px] font-bold border border-zinc-200 hover:bg-zinc-200 transition-colors"
                  >
                    添加为聊天角色
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
