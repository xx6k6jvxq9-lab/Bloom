import React, { useEffect, useState } from 'react';
import { BellOff, ChevronLeft, Compass, MessageSquare, Pin, Plus, User, UserPlus2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppData, Character, AppSettings, ChatGroup } from '../../../types';
import { MePage } from '../MePage';
import { GroupChatManagerPage } from '../GroupChatManagerPage';
import { ContactsApp, AddFriendModal, GroupManagementModal, NavTab } from '../ContactsShell/Page';
import { DEFAULT_WHITE_AVATAR, showInAppConfirm } from '../../../utils';
import { usePersistedChatOrganizationBridge } from '../../../features/persistence/usePersistedChatOrganizationBridge';
import { usePersistedFriendRequestsBridge } from '../../../features/persistence/usePersistedFriendRequestsBridge';
import { usePersistedMeDataBridge } from '../../../features/persistence/usePersistedMeDataBridge';
import { usePersistedMomentsBridge } from '../../../features/persistence/usePersistedMomentsBridge';
import { usePersistedUserProfileBridge } from '../../../features/persistence/usePersistedUserProfileBridge';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { patchCharacterById, removeCharacterById, upsertCharacter, updateCharacterById } from '../../../features/character-domain/characterMutations';

function ResolvedMainShellAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [resolvedUrl, value]);

  if (!resolvedUrl || hasError) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className={className} onError={() => setHasError(true)} />;
}

function ResolvedGroupListAvatar({
  group,
  members,
}: {
  group: ChatGroup;
  members: Character[];
}) {
  const visibleMembers = members.slice(0, 4);

  if (group.avatar) {
    return (
      <ResolvedMainShellAvatar
        value={group.avatar}
        alt={group.name}
        className="w-12 h-12 rounded-xl object-cover bg-zinc-100 shrink-0"
      />
    );
  }

  if (visibleMembers.length === 0) {
    return (
      <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
        <Users size={24} />
      </div>
    );
  }

  if (visibleMembers.length === 1) {
    return (
      <ResolvedMainShellAvatar
        value={visibleMembers[0].avatar}
        alt={group.name}
        className="w-12 h-12 rounded-xl object-cover bg-zinc-100 shrink-0"
      />
    );
  }

  return (
    <div className="grid w-12 h-12 shrink-0 grid-cols-2 overflow-hidden rounded-xl bg-zinc-100 p-0.5">
      {visibleMembers.map((member) => (
        <ResolvedMainShellAvatar
          key={member.id}
          value={member.avatar}
          alt={member.name}
          className="w-full h-full object-cover bg-zinc-100"
        />
      ))}
    </div>
  );
}

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
  usePersistedUserProfileBridge(
    appData.userProfile,
    (profile) => setAppData(prev => ({ ...prev, userProfile: profile })),
  );
  usePersistedMomentsBridge(
    appData.moments,
    (moments) => setAppData(prev => ({ ...prev, moments })),
  );
  usePersistedChatOrganizationBridge(
    appData.groups,
    appData.chatGroups || [],
    ({ groups }) =>
      setAppData(prev => ({
        ...prev,
        groups,
      })),
  );
  usePersistedMeDataBridge(
    appData.masks,
    appData.favorites,
    appData.worldBooks || [],
    ({ masks, favorites, worldBooks }) =>
      setAppData(prev => ({
        ...prev,
        masks,
        favorites,
        worldBooks,
      })),
  );
  usePersistedFriendRequestsBridge(
    appData.friendRequests || [],
    (friendRequests) =>
      setAppData(prev => ({
        ...prev,
        friendRequests,
      })),
  );

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [showChatQuickActions, setShowChatQuickActions] = useState(false);
  const [showGroupChatCreator, setShowGroupChatCreator] = useState(false);
  const [meSection, setMeSection] = useState<'main' | 'masks' | 'data' | 'visual' | 'favorites' | 'worldbooks' | 'characters'>('main');
  const sortedChatEntries = [
    ...(appData.chatGroups || []).map((group) => ({
      kind: 'group' as const,
      id: group.id,
      pinned: !!group.pinChat,
      lastTime: group.lastTime || 0,
      group,
    })),
    ...appData.characters.map((character) => ({
      kind: 'direct' as const,
      id: character.id,
      pinned: !!character.isPinned,
      lastTime: character.lastTime || 0,
      character,
    })),
  ].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.lastTime - a.lastTime;
  });

  useEffect(() => {
    if (activeTab !== 'me') {
      setMeSection('main');
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'chat') {
      setShowChatQuickActions(false);
    }
  }, [activeTab]);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col bg-zinc-50"
    >
      {/* Header */}
      {!(activeTab === 'me' && meSection !== 'main') && (
      <div 
        className="relative z-10 min-h-[64px] pt-12 pb-3 px-4 flex justify-between items-center shrink-0 backdrop-blur-md border-b bg-white border-zinc-100"
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
              onClick={() => setShowChatQuickActions((prev) => !prev)}
              className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <Plus size={20} />
            </button>
          )}
          {activeTab === 'contacts' && (
            <button 
              onClick={() => setShowAddFriend(true)}
              className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <UserPlus2 size={18} />
            </button>
          )}
        </div>
      </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <AnimatePresence>
          {activeTab === 'chat' && showChatQuickActions && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowChatQuickActions(false)}
                className="absolute inset-0 z-[70] bg-black/5"
              />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                className="absolute right-4 top-[74px] z-[75] w-[168px] overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-2xl"
              >
                <button
                  onClick={() => {
                    setShowChatQuickActions(false);
                    onAddCharacter();
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                >
                  <span>创建角色</span>
                  <UserPlus2 size={16} className="text-zinc-400" />
                </button>
                <button
                  onClick={() => {
                    setShowChatQuickActions(false);
                    setShowGroupChatCreator(true);
                  }}
                  className="flex w-full items-center justify-between border-t border-zinc-100 px-4 py-3 text-left text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                >
                  <span>发起群聊</span>
                  <Users size={16} className="text-zinc-400" />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {activeTab === 'chat' && (
          <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">
            {appData.characters.length === 0 && (appData.chatGroups?.length || 0) === 0 && (
              <div className="p-12 text-center text-zinc-300 space-y-3">
                <Users size={48} className="mx-auto opacity-20" />
                <p className="text-[14px]">还没有角色，点击右上角添加</p>
              </div>
            )}
            {sortedChatEntries.map((entry) => {
              if (entry.kind === 'group') {
                const group = entry.group;
                const displayName = group.groupRemark?.trim() || group.name;

                return (
                  <div
                    key={group.id}
                    onClick={() => onOpenGroupChat(group.id)}
                    className="flex items-center gap-3 p-4 transition-colors cursor-pointer backdrop-blur-md rounded-2xl border shadow-sm"
                    style={{
                      backgroundColor: group.pinChat ? '#f4f4f5' : 'white',
                      borderColor: '#e4e4e7',
                    }}
                  >
                    <ResolvedGroupListAvatar
                      group={group}
                      members={appData.characters.filter((character) => group.memberIds.includes(character.id))}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className="text-[15px] font-semibold text-zinc-900 truncate">{displayName}</h3>
                        <span className="text-[11px] text-zinc-400">
                          {group.lastTime ? new Date(group.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className="text-[13px] text-zinc-500 truncate flex-1">{formatMessagePreview(group.lastMessage) || '暂无消息'}</p>
                        <div className="flex items-center gap-1">
                          {group.muteNotifications && <BellOff size={12} className="text-zinc-400" />}
                          {group.pinChat && <Pin size={12} className="text-zinc-400 fill-zinc-400" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              const char = entry.character;
              const displayName = char.remarkName?.trim() || char.name;

              return (
                <div
                  key={char.id}
                  onClick={() => onOpenChat(char.id)}
                  className="flex items-center gap-3 p-4 transition-colors cursor-pointer backdrop-blur-md rounded-2xl border shadow-sm"
                  style={{
                    backgroundColor: char.isPinned ? '#f4f4f5' : 'white',
                    borderColor: '#e4e4e7',
                  }}
                >
                  <ResolvedMainShellAvatar
                    value={char.avatar}
                    alt={displayName}
                    className="w-12 h-12 rounded-full object-cover bg-zinc-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="text-[15px] font-semibold text-zinc-900 truncate">{displayName}</h3>
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
              );
            })}
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
                characters: upsertCharacter(prev.characters, newChar)
              }));
            }}
            onDeleteCharacter={(id) => {
              setAppData(prev => ({
                ...prev,
                characters: removeCharacterById(prev.characters, id)
              }));
            }}
            onUpdateCharacter={(char) => {
              setAppData(prev => ({
                ...prev,
                characters: updateCharacterById(prev.characters, char.id, () => char)
              }));
            }}
            onSectionChange={setMeSection}
          />
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showGroupChatCreator && (
          <GroupChatManagerPage
            groups={appData.chatGroups || []}
            characters={appData.characters}
            onCreateGroup={(name, memberIds) => {
              const normalizedName = name.trim();
              const normalizedMemberIds = Array.from(new Set(memberIds));
              const memberRelationSeeds = normalizedMemberIds.flatMap((sourceMemberId, sourceIndex) =>
                normalizedMemberIds
                  .filter((_, targetIndex) => targetIndex !== sourceIndex)
                  .map((targetMemberId) => ({
                    sourceMemberId,
                    targetMemberId,
                    familiarity: 'strangers' as const,
                  })),
              );

              const newGroup: ChatGroup = {
                id: Date.now().toString(),
                name: normalizedName,
                memberIds: normalizedMemberIds,
                groupStage: 'new',
                memberRelationSeeds,
                creatorId: 'user',
                createdAt: Date.now(),
              };

              setAppData((prev) => ({
                ...prev,
                chatGroups: [newGroup, ...(prev.chatGroups || [])],
              }));
              setShowGroupChatCreator(false);
            }}
            onDeleteGroup={(id) => {
              setAppData((prev) => ({
                ...prev,
                chatGroups: prev.chatGroups?.filter((group) => group.id !== id),
              }));
            }}
            onBack={() => setShowGroupChatCreator(false)}
          />
        )}
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
                  avatar: char.avatar || DEFAULT_WHITE_AVATAR,
                  setting: char.setting || `你是一个新添加的 AI 好友，名字叫 ${char.name}。`,
                  openingRemark: char.openingRemark || `你好，很高兴认识你，我是 ${char.name}。`,
                  lastMessage: char.openingRemark || `你好，很高兴认识你，我是 ${char.name}。`,
                  lastTime: Date.now(),
                };
                setAppData(prev => ({
                  ...prev,
                  characters: upsertCharacter(prev.characters, newChar)
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
              onDelete={async (name) => {
                if (await showInAppConfirm(`确定要删除分组“${name}”吗？`)) {
                  setAppData(prev => ({
                    ...prev,
                    groups: prev.groups.filter(g => g !== name),
                    characters: prev.characters.map(c => (
                      c.groupId === name
                        ? { ...c, groupId: undefined }
                        : c
                    ))
                  }));
                }
              }}
              onClose={() => setShowManageGroups(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      {!(activeTab === 'me' && meSection !== 'main') && (
      <div 
        className="absolute bottom-0 left-0 right-0 h-[84px] rounded-t-[32px] shadow-[0_-5px_20px_rgba(0,0,0,0.03)] flex items-center justify-around px-4 pb-4 z-20 backdrop-blur-md border-t bg-white border-zinc-100"
      >
        <NavTab icon={<MessageSquare size={24} />} label="聊天" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
        <NavTab icon={<Users size={24} />} label="通讯录" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} />
        <NavTab icon={<Compass size={24} />} label="动态" active={activeTab === 'moments'} onClick={() => setActiveTab('moments')} />
        <NavTab icon={<User size={24} />} label="我的" active={activeTab === 'me'} onClick={() => setActiveTab('me')} />
      </div>
      )}
    </motion.div>
  );
}

