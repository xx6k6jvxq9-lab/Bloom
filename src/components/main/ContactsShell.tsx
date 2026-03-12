import React, { useState } from 'react';
import { ChevronLeft, MessageSquare, MoreVertical, Pin, RefreshCw, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, ChatGroup, FriendRequest } from '../../types';
import { NewFriendsPage } from '../NewFriendsPage';
import { GroupChatManagerPage } from '../GroupChatManagerPage';

type AppData = {
  characters: Character[];
  groups: string[];
  friendRequests?: FriendRequest[];
  chatGroups?: ChatGroup[];
  [key: string]: any;
};

export function ContactsApp({ 
  appData, 
  setAppData,
  onOpenChat, 
  onOpenProfile,
  onAddFriend,
  onManageGroups
}: { 
  appData: AppData; 
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  onOpenChat: (id: string) => void; 
  onOpenProfile: (id: string) => void;
  onAddFriend: () => void;
  onManageGroups: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'new-friends' | 'group-manager'>('list');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { characters, groups } = appData;

  // Sort characters by name
  const sortedCharacters = [...characters].sort((a, b) => {
    const res = a.name.localeCompare(b.name, 'zh-Hans-CN');
    return sortOrder === 'asc' ? res : -res;
  });

  // Filter by search query
  const filteredCharacters = sortedCharacters.filter(char => 
    char.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupMembers = selectedGroup 
    ? characters.filter(c => c.groupId === selectedGroup || (selectedGroup === '星标' && c.isPinned))
    : [];

  if (view === 'new-friends') {
    return (
      <NewFriendsPage 
        requests={appData.friendRequests || []}
        onAccept={(id) => {
          setAppData(prev => {
            const req = prev.friendRequests?.find(r => r.id === id);
            if (!req) return prev;
            
            // Create new character from request
            const newChar: Character = {
              id: req.fromUserId,
              name: req.fromUserName,
              avatar: req.fromUserAvatar,
              gender: 'other',
              setting: '你的新朋友',
              openingRemark: '你好！很高兴认识你。',
              lastTime: Date.now(),
              groupId: '朋友'
            };

            return {
              ...prev,
              characters: [...prev.characters, newChar],
              friendRequests: prev.friendRequests?.map(r => r.id === id ? { ...r, status: 'accepted' } : r)
            };
          });
        }}
        onReject={(id) => {
          setAppData(prev => ({
            ...prev,
            friendRequests: prev.friendRequests?.map(r => r.id === id ? { ...r, status: 'rejected' } : r)
          }));
        }}
        onAddById={(id) => {
          // Mock adding by ID
          const newReq: FriendRequest = {
            id: Date.now().toString(),
            fromUserId: id,
            fromUserName: `用户 ${id.slice(0, 4)}`,
            fromUserAvatar: `https://picsum.photos/seed/${id}/200`,
            status: 'pending',
            timestamp: Date.now(),
            message: '通过虚拟ID查找添加'
          };
          setAppData(prev => ({
            ...prev,
            friendRequests: [newReq, ...(prev.friendRequests || [])]
          }));
          alert('已发送好友申请 (模拟)');
        }}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'group-manager') {
    return (
      <GroupChatManagerPage 
        groups={appData.chatGroups || []}
        characters={appData.characters}
        onCreateGroup={(name, memberIds) => {
          const newGroup: ChatGroup = {
            id: Date.now().toString(),
            name,
            memberIds,
            creatorId: 'user',
            createdAt: Date.now()
          };
          setAppData(prev => ({
            ...prev,
            chatGroups: [newGroup, ...(prev.chatGroups || [])]
          }));
        }}
        onDeleteGroup={(id) => {
          setAppData(prev => ({
            ...prev,
            chatGroups: prev.chatGroups?.filter(g => g.id !== id)
          }));
        }}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search Bar */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input 
            type="text"
            placeholder="搜索"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full border-none rounded-xl py-2 pl-10 pr-4 text-[14px] outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm border bg-white border-zinc-100"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Top Items */}
        <div className="px-4 space-y-3 mt-2">
          <button 
            onClick={() => setView('new-friends')}
            className="w-full flex items-center gap-3 p-4 active:bg-white/50 transition-colors backdrop-blur-md rounded-2xl border shadow-sm bg-white border-zinc-100"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
              <UserPlus size={20} />
            </div>
            <div className="flex-1 text-left">
              <span className="text-[15px] font-medium text-zinc-800">新的朋友</span>
            </div>
            {(appData.friendRequests?.filter(r => r.status === 'pending').length || 0) > 0 && (
              <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {appData.friendRequests?.filter(r => r.status === 'pending').length}
              </div>
            )}
          </button>
          <button 
            onClick={() => setView('group-manager')}
            className="w-full flex items-center gap-3 p-4 active:bg-white/50 transition-colors backdrop-blur-md rounded-2xl border shadow-sm bg-white border-zinc-100"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
              <Users size={20} />
            </div>
            <div className="flex-1 text-left">
              <span className="text-[15px] font-medium text-zinc-800">群聊管理</span>
            </div>
          </button>
        </div>

        {/* Groups Horizontal Scroll */}
        <div className="mt-6">
          <div className="px-5 mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider">我的分组</h2>
            <button 
              onClick={onManageGroups}
              className="text-[11px] text-blue-500 font-medium active:opacity-60"
            >
              管理分组
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 no-scrollbar pb-2">
            {groups.map(group => (
              <button 
                key={group}
                onClick={() => setSelectedGroup(selectedGroup === group ? null : group)}
                className={`flex-shrink-0 w-[110px] h-[90px] rounded-[24px] border shadow-sm p-3.5 flex flex-col justify-between active:scale-95 transition-all ${
                  selectedGroup === group 
                    ? 'border-blue-500 bg-blue-50/80 ring-4 ring-blue-500/5' 
                    : 'bg-white border-zinc-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedGroup === group ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-zinc-100 text-zinc-500'}`}>
                  <Users size={16} />
                </div>
                <div className="text-left">
                  <p className={`text-[13px] font-bold truncate ${selectedGroup === group ? 'text-blue-600' : 'text-zinc-800'}`}>{group}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {group === '星标' 
                      ? characters.filter(c => c.isPinned).length 
                      : characters.filter(c => c.groupId === group).length} 位成员
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Group Members Horizontal Cards (if selected) */}
        <AnimatePresence>
          {selectedGroup && groupMembers.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="px-5 mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-bold text-blue-500 uppercase tracking-wider">{selectedGroup} 成员</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto px-4 no-scrollbar pb-4">
                {groupMembers.map(char => (
                  <div 
                    key={char.id}
                    onClick={() => onOpenProfile(char.id)}
                    className="flex-shrink-0 w-[100px] rounded-2xl border shadow-sm p-3 flex flex-col items-center gap-2 active:scale-95 transition-transform cursor-pointer bg-white border-zinc-100"
                  >
                    <img src={char.avatar} alt={char.name} className="w-12 h-12 rounded-full object-cover bg-zinc-100" />
                    <span className="text-[12px] font-bold text-zinc-800 truncate w-full text-center">{char.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sorted Contacts List */}
        <div className="mt-6">
          <div className="px-5 mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider">全部</h2>
            <button 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100/80 backdrop-blur-sm rounded-md active:bg-zinc-200 transition-colors"
            >
              <span className="text-[10px] text-zinc-500 font-medium">姓名 (拼音) {sortOrder === 'asc' ? '升序' : '降序'}</span>
              <RefreshCw size={10} className={`text-zinc-400 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
            </button>
          </div>
          <div 
            className="rounded-t-[32px] overflow-hidden border-t border-zinc-100 shadow-sm bg-white"
          >
            <div className="divide-y divide-zinc-200/20">
              {filteredCharacters.map(char => (
                <div 
                  key={char.id}
                  onClick={() => onOpenProfile(char.id)}
                  className="flex items-center gap-3 p-4 active:bg-white/50 transition-colors cursor-pointer"
                >
                <img 
                  src={char.avatar} 
                  alt={char.name} 
                  className="w-10 h-10 rounded-full object-cover bg-zinc-100 shrink-0" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile(char.id);
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-zinc-900 truncate">{char.name}</h3>
                  <p className="text-[11px] text-zinc-400 truncate">{char.setting.slice(0, 30)}...</p>
                </div>
              </div>
            ))}
            {filteredCharacters.length === 0 && (
              <div className="py-12 text-center text-zinc-300">
                <p className="text-[14px]">未找到联系人</p>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CharacterProfile({ 
  character, 
  onBack, 
  onChat,
  onAddFriend,
  isFriend,
  groups,
  onUpdateGroup,
  onTogglePin
}: { 
  character: Character; 
  onBack: () => void; 
  onChat: () => void;
  onAddFriend: () => void;
  isFriend: boolean;
  groups: string[];
  onUpdateGroup: (groupId: string | undefined) => void;
  onTogglePin?: () => void;
}) {
  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-white flex flex-col z-[80]"
    >
      {/* Header */}
      <div className="pt-10 pb-3 px-4 flex items-center justify-between shrink-0 border-b border-zinc-50">
        <button onClick={onBack} className="p-1 -ml-1 text-zinc-600 active:text-zinc-800">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-bold text-zinc-900">详细资料</h1>
        <button className="p-1 text-zinc-400">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50">
        {/* Profile Info Card */}
        <div className="bg-white p-6 flex items-center gap-4 mb-3">
          <img src={character.avatar} alt={character.name} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-bold text-zinc-900 truncate">{character.name}</h2>
            <p className="text-[13px] text-zinc-400 mt-0.5">ID: {character.id}</p>
          </div>
        </div>

        {/* Details List */}
        <div className="space-y-3">
          <div className="bg-white divide-y divide-zinc-50">
            <div className="px-4 py-4 flex items-center justify-between">
              <span className="text-[15px] text-zinc-800">性别</span>
              <span className="text-[15px] text-zinc-400">{character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '其他'}</span>
            </div>
            <div className="px-4 py-4 flex items-center justify-between">
              <span className="text-[15px] text-zinc-800">置顶聊天</span>
              <button 
                onClick={onTogglePin}
                className={`w-10 h-5.5 rounded-full transition-colors relative ${character.isPinned ? 'bg-zinc-900' : 'bg-zinc-200'}`}
              >
                <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.isPinned ? 'translate-x-4.5' : ''}`} />
              </button>
            </div>
            <div className="px-4 py-4">
              <p className="text-[15px] text-zinc-800 mb-1">个性签名</p>
              <p className="text-[14px] text-zinc-400 leading-relaxed">{character.setting.slice(0, 100)}...</p>
            </div>
          </div>

          {isFriend && (
            <div className="bg-white px-4 py-4">
              <p className="text-[15px] text-zinc-800 mb-3">分组设置</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onUpdateGroup(undefined)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${!character.groupId ? 'bg-blue-500 border-blue-500 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                >
                  无分组
                </button>
                {groups.map(g => (
                  <button
                    key={g}
                    onClick={() => onUpdateGroup(g)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${character.groupId === g ? 'bg-blue-500 border-blue-500 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 px-4 space-y-3 pb-10">
          <button 
            onClick={onChat}
            className="w-full bg-white text-blue-500 py-4 rounded-2xl font-bold text-[16px] active:bg-zinc-50 transition-colors border border-zinc-100 flex items-center justify-center gap-2"
          >
            <MessageSquare size={20} />
            主动加你 (发消息)
          </button>
          {!isFriend && (
            <button 
              onClick={onAddFriend}
              className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold text-[16px] active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <UserPlus size={20} />
              添加好友
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function AddFriendModal({ 
  onClose, 
  onAdd 
}: { 
  onClose: () => void; 
  onAdd: (char: any) => void;
}) {
  const [query, setQuery] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-x-4 top-24 bg-white rounded-[32px] shadow-2xl z-[100] p-6 border border-zinc-100"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[18px] font-bold text-zinc-900">添加 AI 好友</h2>
        <button onClick={onClose} className="p-1 text-zinc-400 active:text-zinc-600">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input 
            type="text"
            placeholder="输入姓名或 ID"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-100 rounded-xl py-3 pl-10 pr-4 text-[14px] outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button 
          onClick={() => {
            if (query.trim()) {
              onAdd({
                name: query,
                id: query,
                gender: 'other',
                avatar: `https://picsum.photos/seed/${query}/200`,
                setting: `你是一个新添加的 AI 好友，名字叫 ${query}。`,
                openingRemark: `你好！很高兴认识你，我是 ${query}。`,
              });
              setQuery('');
            }
          }}
          className="w-full bg-blue-500 text-white py-3.5 rounded-xl font-bold text-[15px] active:opacity-80 transition-opacity"
        >
          搜索并添加
        </button>
      </div>
    </motion.div>
  );
}

export function GroupManagementModal({ 
  groups, 
  onAdd, 
  onDelete, 
  onClose 
}: { 
  groups: string[]; 
  onAdd: (name: string) => void; 
  onDelete: (name: string) => void; 
  onClose: () => void;
}) {
  const [newGroup, setNewGroup] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-x-4 top-24 bg-white rounded-[32px] shadow-2xl z-[100] p-6 border border-zinc-100"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[18px] font-bold text-zinc-900">管理分组</h2>
        <button onClick={onClose} className="p-1 text-zinc-400 active:text-zinc-600">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input 
            type="text"
            placeholder="新分组名称"
            value={newGroup}
            onChange={e => setNewGroup(e.target.value)}
            className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-[14px] outline-none focus:border-blue-500"
          />
          <button 
            onClick={() => {
              if (newGroup.trim()) {
                onAdd(newGroup);
                setNewGroup('');
              }
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-[14px] active:opacity-80"
          >
            添加
          </button>
        </div>

        <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
          {groups.filter(g => g !== '星标').map(group => (
            <div key={group} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
              <span className="text-[14px] text-zinc-800 font-medium">{group}</span>
              <button 
                onClick={() => onDelete(group)}
                className="text-red-500 p-1 active:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}


export function NavTab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-zinc-900' : 'text-zinc-400'}`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

