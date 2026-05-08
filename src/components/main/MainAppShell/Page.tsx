import React, { useEffect, useState } from 'react';
import { BellOff, ChevronLeft, Compass, MessageSquare, Pin, Plus, User, UserPlus2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppData, Character, AppSettings, ChatGroup } from '../../../types';
import { MePage } from '../MePage';
import { GroupChatManagerPage } from '../GroupChatManagerPage';
import { ContactsApp, AddFriendModal, GroupManagementModal, NavTab } from '../ContactsShell/Page';
import { DEFAULT_WHITE_AVATAR, showInAppConfirm } from '../../../utils';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { saveCharacters } from '../../../features/persistence/charactersStore';
import { patchCharacterById, removeCharacterById, upsertCharacter, updateCharacterById } from '../../../features/character-domain/characterMutations';
import { getThemeSelectedFontStack } from '../../../features/theme/themeTypography';
import { KeyboardAwareScreen } from '../../../features/app-shell/KeyboardAwareScreen';
import { formatChatMessagePreview } from '../../../features/app-shell/formatMessagePreview';
import { buildCharacterContext } from '../../../services/relationship-context/buildCharacterContext';

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
  const tabOrder: Array<'chat' | 'contacts' | 'moments' | 'me'> = ['chat', 'contacts', 'moments', 'me'];

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [showChatQuickActions, setShowChatQuickActions] = useState(false);
  const [showGroupChatCreator, setShowGroupChatCreator] = useState(false);
  const [meSection, setMeSection] = useState<'main' | 'masks' | 'data' | 'visual' | 'favorites' | 'date-records' | 'worldbooks' | 'characters'>('main');
  const swipeStateRef = React.useRef<{
    startX: number;
    startY: number;
    deltaX: number;
    deltaY: number;
    active: boolean;
    lockedAxis: 'x' | 'y' | null;
  }>({
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    active: false,
    lockedAxis: null,
  });
  const appFontFamily = getThemeSelectedFontStack(appData.visualSettings?.themeTypography);
  const findLatestPreviewableMessage = (messages: AppData['chatHistory'][string] | undefined) => [...(messages || [])]
    .reverse()
    .find((message) => !message.isSystem && !message.isRecalled) || null;
  const sortedChatEntries = [
    ...(appData.chatGroups || []).map((group) => {
      const latestPreviewableMessage = findLatestPreviewableMessage(group.history);
      return {
        kind: 'group' as const,
        id: group.id,
        pinned: !!group.pinChat,
        lastTime: latestPreviewableMessage?.timestamp || group.lastTime || 0,
        previewText: latestPreviewableMessage
          ? formatChatMessagePreview(latestPreviewableMessage)
          : formatMessagePreview(group.lastMessage) || '',
        group,
      };
    }),
    ...appData.characters.map((character) => {
      const latestPreviewableMessage = findLatestPreviewableMessage(appData.chatHistory?.[character.id]);
      return {
        kind: 'direct' as const,
        id: character.id,
        pinned: !!character.isPinned,
        lastTime: latestPreviewableMessage?.timestamp || character.lastTime || 0,
        previewText: latestPreviewableMessage
          ? formatChatMessagePreview(latestPreviewableMessage)
          : formatMessagePreview(character.lastMessage) || formatMessagePreview(character.openingRemark) || '',
        character,
      };
    }),
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

  const isSwipeNavigationEnabled = !(activeTab === 'me' && meSection !== 'main');

  const updateTabByOffset = (offset: -1 | 1) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= tabOrder.length) return;
    setActiveTab(tabOrder[nextIndex]);
  };

  const shouldIgnoreSwipeTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('input, textarea, select, button, a, [data-swipe-ignore="true"]'));
  };

  const resetSwipeState = () => {
    swipeStateRef.current = {
      startX: 0,
      startY: 0,
      deltaX: 0,
      deltaY: 0,
      active: false,
      lockedAxis: null,
    };
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isSwipeNavigationEnabled || shouldIgnoreSwipeTarget(event.target)) {
      resetSwipeState();
      return;
    }

    const touch = event.touches[0];
    swipeStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      active: true,
      lockedAxis: null,
    };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const state = swipeStateRef.current;
    if (!state.active) return;

    const touch = event.touches[0];
    state.deltaX = touch.clientX - state.startX;
    state.deltaY = touch.clientY - state.startY;

    if (!state.lockedAxis) {
      const absX = Math.abs(state.deltaX);
      const absY = Math.abs(state.deltaY);
      if (absX < 10 && absY < 10) return;
      state.lockedAxis = absX > absY ? 'x' : 'y';
    }

    if (state.lockedAxis === 'x') {
      event.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    const state = swipeStateRef.current;
    if (!state.active) return;

    const absX = Math.abs(state.deltaX);
    const absY = Math.abs(state.deltaY);
    if (state.lockedAxis === 'x' && absX > 56 && absX > absY * 1.2) {
      updateTabByOffset(state.deltaX < 0 ? 1 : -1);
    }

    resetSwipeState();
  };

  const header = !(activeTab === 'me' && meSection !== 'main') ? (
    <div className="relative z-10 flex min-h-[64px] shrink-0 items-center justify-between border-b border-zinc-100 bg-white px-4 pb-3 pt-12 backdrop-blur-md">
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
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900 transition-transform hover:bg-zinc-200 active:scale-90"
          >
            <Plus size={20} />
          </button>
        )}
        {activeTab === 'contacts' && (
          <button
            onClick={() => setShowAddFriend(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900 transition-transform hover:bg-zinc-200 active:scale-90"
          >
            <UserPlus2 size={18} />
          </button>
        )}
      </div>
    </div>
  ) : null;

  const footer = !(activeTab === 'me' && meSection !== 'main') ? (
    <div className="flex min-h-[44px] w-full items-center justify-around px-3">
      <NavTab icon={<MessageSquare size={24} />} label="聊天" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
      <NavTab icon={<Users size={24} />} label="通讯录" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} />
      <NavTab icon={<Compass size={24} />} label="动态" active={activeTab === 'moments'} onClick={() => setActiveTab('moments')} />
      <NavTab icon={<User size={24} />} label="我的" active={activeTab === 'me'} onClick={() => setActiveTab('me')} />
    </div>
  ) : null;

  return (
    <KeyboardAwareScreen
      className="absolute inset-0 flex flex-col bg-zinc-50"
      style={appFontFamily ? { fontFamily: appFontFamily } : undefined}
      header={header}
      bodyClassName="flex-1 min-h-0 overflow-hidden flex flex-col touch-pan-y"
      bodyProps={{
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchEnd,
      }}
      footer={footer}
      footerClassName="app-bottom-tabbar absolute bottom-0 left-0 right-0 z-20 border-t border-zinc-100 bg-white/96 backdrop-blur-xl"
      footerStyle={{ paddingBottom: 'var(--app-safe-area-bottom-tab, var(--app-safe-area-bottom-ui, 0px))' }}
    >
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
          <div data-swipe-ignore="true" className="flex-1 overflow-y-auto px-4 pb-[calc(var(--app-safe-area-bottom-tab,0px)+2.75rem)] pt-4 space-y-3">
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
                          {entry.lastTime ? new Date(entry.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className="text-[13px] text-zinc-500 truncate flex-1">{entry.previewText || '暂无消息'}</p>
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
                        {entry.lastTime ? new Date(entry.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-[13px] text-zinc-500 truncate flex-1">{entry.previewText || formatMessagePreview(char.openingRemark)}</p>
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
            setFavorites={(favorites) => setAppData(prev => ({ ...prev, favorites }))}
            visualSettings={appData.visualSettings}
            setVisualSettings={(s) => setAppData(prev => ({ ...prev, visualSettings: s }))}
            chatHistory={appData.chatHistory}
            characters={appData.characters}
            moments={appData.moments}
            savedDates={appData.savedDates || []}
            collectedDates={appData.collectedDates || []}
            worldBooks={appData.worldBooks || []}
            setWorldBooks={(wb) => setAppData(prev => ({ ...prev, worldBooks: wb }))}
            onAddCharacter={(char) => {
              const newChar: Character = {
                id: Date.now().toString(),
                ...char,
                lastTime: Date.now()
              };
              setAppData(prev => {
                const nextCharacters = upsertCharacter(prev.characters, newChar);
                void saveCharacters(nextCharacters);
                return {
                  ...prev,
                  characters: nextCharacters
                };
              });
            }}
            onDeleteCharacter={(id) => {
              setAppData(prev => {
                const nextCharacters = removeCharacterById(prev.characters, id);
                void saveCharacters(nextCharacters);
                return {
                  ...prev,
                  characters: nextCharacters
                };
              });
            }}
            onUpdateCharacter={(char) => {
              setAppData(prev => {
                const nextCharacters = updateCharacterById(prev.characters, char.id, () => char);
                void saveCharacters(nextCharacters);
                return {
                  ...prev,
                  characters: nextCharacters
                };
              });
            }}
            onSectionChange={setMeSection}
          />
        )}

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
                allowDirectMemoryInterop: true,
                adminIds: [],
                memberBadges: [],
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
                  corePersona: char.corePersona || buildCharacterContext({ character: char as Character }).corePersona || `你是一个新添加的 AI 好友，名字叫 ${char.name}。`,
                  openingRemark: char.openingRemark || `你好，很高兴认识你，我是 ${char.name}。`,
                  lastMessage: char.openingRemark || `你好，很高兴认识你，我是 ${char.name}。`,
                  lastTime: Date.now(),
                };
                setAppData(prev => {
                  const nextCharacters = upsertCharacter(prev.characters, newChar);
                  void saveCharacters(nextCharacters);
                  return {
                    ...prev,
                    characters: nextCharacters
                  };
                });
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
    </KeyboardAwareScreen>
  );
}

