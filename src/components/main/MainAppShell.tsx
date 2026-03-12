import React, { useState } from 'react';
import { BellOff, ChevronLeft, Compass, MessageSquare, Pin, Plus, User, UserPlus2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, AppSettings } from '../../types';
import { MePage } from '../MePage';
import { ContactsApp, AddFriendModal, GroupManagementModal, NavTab } from './ContactsShell';

type AppData = {
  chatGroups?: any[];
  characters: Character[];
  groups: string[];
  userProfile: any;
  masks: any[];
  favorites: any[];
  visualSettings: any;
  chatHistory: any;
  moments: any[];
  collectedDates?: any[];
  worldBooks?: any[];
  [key: string]: any;
};

export function MainApp({ 
  activeTab, 
  setActiveTab, 
  appData, 
  setAppData,
  onOpenChat, 
  onOpenGroupChat,
  onOpenProfile,
  onAddCharacter,
  onBack,
  settings,
  MomentsAppComponent,
  formatMessagePreview
}: { 
  activeTab: 'chat' | 'contacts' | 'moments' | 'me';
  setActiveTab: (tab: 'chat' | 'contacts' | 'moments' | 'me') => void;
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  onOpenChat: (id: string) => void;
  onOpenGroupChat: (id: string) => void;
  onOpenProfile: (id: string) => void;
  onAddCharacter: () => void;
  onBack: () => void;
  key?: string;
  settings: AppSettings;
  MomentsAppComponent: React.ComponentType<{ appData: AppData; setAppData: React.Dispatch<React.SetStateAction<AppData>>; settings: AppSettings }>;
  formatMessagePreview: (text: string | undefined) => string;
}) {
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showManageGroups, setShowManageGroups] = useState(false);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col bg-zinc-50"
    >
      {/* Header */}
      <div 
        className="relative z-10 pt-10 pb-3 px-4 flex justify-between items-center shrink-0 backdrop-blur-md border-b bg-white border-zinc-100"
      >
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-zinc-900">
            {activeTab === 'chat' && '聊天'}
            {activeTab === 'contacts' && '通讯录'}
            {activeTab === 'moments' && '动态'}
            {activeTab === 'me' && '我的'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'chat' && (
            <button 
              onClick={onAddCharacter}
              className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <Plus size={20} />
            </button>
          )}
          {activeTab === 'contacts' && (
            <button 
              onClick={() => setShowAddFriend(true)}
              className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <UserPlus2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'chat' && (
          <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">
            {/* Groups */}
            {appData.chatGroups?.map(group => (
              <div 
                key={group.id}
                onClick={() => onOpenGroupChat(group.id)}
                className="flex items-center gap-3 p-4 transition-colors cursor-pointer backdrop-blur-md rounded-2xl border shadow-sm bg-white border-zinc-100"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
                  <Users size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="text-[15px] font-semibold text-zinc-900 truncate">{group.name}</h3>
                    <span className="text-[11px] text-zinc-400">
                      {group.lastTime ? new Date(group.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-[13px] text-zinc-500 truncate flex-1">{formatMessagePreview(group.lastMessage) || '暂无消息'}</p>
                  </div>
                </div>
              </div>
            ))}

            {appData.characters.length === 0 && (appData.chatGroups?.length || 0) === 0 && (
              <div className="p-12 text-center text-zinc-300 space-y-3">
                <Users size={48} className="mx-auto opacity-20" />
                <p className="text-[14px]">还没有角色，点击右上角添加</p>
              </div>
            )}
            {[...appData.characters]
              .sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return (b.lastTime || 0) - (a.lastTime || 0);
              })
              .map(char => (
              <div 
                key={char.id}
                onClick={() => onOpenChat(char.id)}
                className="flex items-center gap-3 p-4 transition-colors cursor-pointer backdrop-blur-md rounded-2xl border shadow-sm"
                style={{
                  backgroundColor: char.isPinned ? '#f4f4f5' : 'white',
                  borderColor: '#e4e4e7'
                }}
              >
                <img 
                  src={char.avatar} 
                  alt={char.name} 
                  className="w-12 h-12 rounded-full object-cover bg-zinc-100 shrink-0" 
                  onClick={(e) => {
                    // In chat list, clicking avatar could also open profile
                    // e.stopPropagation();
                    // onOpenProfile(char.id);
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="text-[15px] font-semibold text-zinc-900 truncate">{char.name}</h3>
                    <span className="text-[11px] text-zinc-400">
                      {char.lastTime ? new Date(char.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-[13px] text-zinc-500 truncate flex-1">{formatMessagePreview(char.lastMessage) || formatMessagePreview(char.openingRemark)}</p>
                    <div className="flex items-center gap-1">
                      {char.isMuted && <BellOff size={12} className="text-zinc-400" />}
                      {char.isPinned && <Pin size={12} className="text-zinc-400 fill-zinc-400" />}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'contacts' && (
          <ContactsApp 
            appData={appData} 
            setAppData={setAppData}
            onOpenChat={onOpenChat} 
            onOpenProfile={onOpenProfile}
            onAddFriend={() => setShowAddFriend(true)}
            onManageGroups={() => setShowManageGroups(true)}
          />
        )}

        {activeTab === 'moments' && (
          <MomentsAppComponent 
            appData={appData}
            setAppData={setAppData}
            settings={settings}
          />
        )}

        {activeTab === 'me' && (
          <MePage 
            appData={appData}
            setAppData={setAppData}
            userProfile={appData.userProfile}
            setUserProfile={(p) => setAppData(prev => ({ ...prev, userProfile: p }))}
            masks={appData.masks}
            setMasks={(m) => setAppData(prev => ({ ...prev, masks: m }))}
            favorites={appData.favorites}
            visualSettings={appData.visualSettings}
            setVisualSettings={(s) => setAppData(prev => ({ ...prev, visualSettings: s }))}
            chatHistory={appData.chatHistory}
            characters={appData.characters}
            moments={appData.moments}
            collectedDates={appData.collectedDates || []}
            worldBooks={appData.worldBooks || []}
            setWorldBooks={(wb) => setAppData(prev => ({ ...prev, worldBooks: wb }))}
            onAddCharacter={(char) => {
              const newChar: Character = {
                id: Date.now().toString(),
                ...char,
                lastTime: Date.now()
              };
              setAppData(prev => ({
                ...prev,
                characters: [newChar, ...prev.characters]
              }));
            }}
            onDeleteCharacter={(id) => {
              setAppData(prev => ({
                ...prev,
                characters: prev.characters.filter(c => c.id !== id)
              }));
            }}
            onUpdateCharacter={(char) => {
              setAppData(prev => ({
                ...prev,
                characters: prev.characters.map(c => c.id === char.id ? char : c)
              }));
            }}
          />
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddFriend && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddFriend(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-[90]"
            />
            <AddFriendModal 
              onClose={() => setShowAddFriend(false)}
              onAdd={(char) => {
                // Logic to add a new AI character
                const newChar: Character = {
                  id: char.id || Date.now().toString(),
                  name: char.name,
                  gender: char.gender || 'other',
                  avatar: char.avatar || `https://picsum.photos/seed/${char.id || Date.now()}/200`,
                  setting: char.setting || `你是一个新添加的 AI 好友，名字叫 ${char.name}。`,
                  openingRemark: char.openingRemark || `你好！很高兴认识你，我是 ${char.name}。`,
                  lastMessage: char.openingRemark || `你好！很高兴认识你，我是 ${char.name}。`,
                  lastTime: Date.now(),
                };
                setAppData(prev => ({
                  ...prev,
                  characters: [newChar, ...prev.characters]
                }));
                setShowAddFriend(false);
                alert('已添加新好友');
              }}
            />
          </>
        )}

        {showManageGroups && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManageGroups(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-[90]"
            />
            <GroupManagementModal 
              groups={appData.groups}
              onAdd={(name) => {
                if (appData.groups.includes(name)) return alert('分组已存在');
                setAppData(prev => ({
                  ...prev,
                  groups: [...prev.groups, name]
                }));
              }}
              onDelete={(name) => {
                if (confirm(`确定要删除分组 "${name}" 吗？`)) {
                  setAppData(prev => ({
                    ...prev,
                    groups: prev.groups.filter(g => g !== name),
                    characters: prev.characters.map(c => c.groupId === name ? { ...c, groupId: undefined } : c)
                  }));
                }
              }}
              onClose={() => setShowManageGroups(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[84px] rounded-t-[32px] shadow-[0_-5px_20px_rgba(0,0,0,0.03)] flex items-center justify-around px-4 pb-4 z-20 backdrop-blur-md border-t bg-white border-zinc-100"
      >
        <NavTab icon={<MessageSquare size={24} />} label="聊天" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
        <NavTab icon={<Users size={24} />} label="通讯录" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} />
        <NavTab icon={<Compass size={24} />} label="动态" active={activeTab === 'moments'} onClick={() => setActiveTab('moments')} />
        <NavTab icon={<User size={24} />} label="我的" active={activeTab === 'me'} onClick={() => setActiveTab('me')} />
      </div>
    </motion.div>
  );
}

