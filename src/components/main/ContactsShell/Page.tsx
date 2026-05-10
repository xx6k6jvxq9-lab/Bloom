import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Heart, MessageSquare, MoreVertical, PencilLine, RefreshCw, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppData, AppSettings, Character, ChatGroup, ForumData, FriendRequest, MomentComment, MomentItem } from '../../../types';
import { useKeyboardSafeViewport } from '../../../features/app-shell/useKeyboardSafeViewport';
import { NewFriendsPage } from '../NewFriendsPage';
import { GroupChatManagerPage } from '../GroupChatManagerPage';
import { DEFAULT_WHITE_AVATAR, showInAppConfirm } from '../../../utils';
import { patchChatHistoryRecords } from '../../../features/persistence/chatHistoryStore';
import { persistChatOrganization } from '../../../features/persistence/chatOrganizationStore';
import { saveCharacters } from '../../../features/persistence/charactersStore';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { createCharacterDirectory } from '../../../features/character-domain/useCharacterDirectory';
import { runMomentCommentReplySequence } from '../../../services/moments/commentOrchestrator';
import { resolveSceneTextApiConfig } from '../../../services/ai/apiCenter/resolveSceneApiConfig';
import { buildCharacterContext } from '../../../services/relationship-context/buildCharacterContext';
import { createEmptyForumTempChatSession, markForumFriendRequestResolved } from '../../../services/forum/forumTempChatState';
import { bridgeForumFriendToFormalChat } from '../../../services/forum/forumFriendBridge';
import { buildForumSharedSettlement } from '../../../services/forum/buildForumSharedSettlement';
import { DEFAULT_FORUM_GLOBAL_SETTINGS } from '../../../services/forum/forumGlobalSettings';
import { hydrateForumData } from '../../../features/persistence/forumDataStore';
import {
  looksLikeStructuredCardText,
  sanitizePreviewText,
} from '../../../features/app-shell/formatMessagePreview';
import {
  buildCharacterIncomingRequestResolution,
  canChatWithCharacter,
  createCharacterRelationshipMessage,
  createRelationshipSystemMessage,
  getCharacterBlockState,
  getCharacterFriendshipStatus,
  getCharacterRelationshipStatusText,
  getFriendRequestCharacterId,
  getFriendRequestStatusLabel,
  getLatestCharacterRequest,
  getPendingCharacterRequest,
  isIncomingFriendRequest,
  resolveFriendRequestDirection,
  supersedePendingCharacterRequests,
} from '../../../features/contacts/contactRelationship';
import { generateRelationshipEventReply } from '../../../features/contacts/generateRelationshipEventReply';

const EMPTY_CONTACTS_FORUM_DATA: ForumData = {
  posts: [],
  notifications: [],
  tempChats: {},
  globalSettings: DEFAULT_FORUM_GLOBAL_SETTINGS,
};

const CONTACT_REMARK_NAME_LIMIT = 32;

function resolveCharacterCardSource(character: Pick<Character, 'openingRemark' | 'signature' | 'corePersona' | 'setting'>): string {
  const characterContext = buildCharacterContext({ character: character as Character });
  const candidates = [
    character.openingRemark,
    character.signature,
    characterContext.corePersona,
  ];

  const structured = candidates.find((value) => looksLikeStructuredCardText(value));
  if (structured?.trim()) {
    return structured.trim();
  }

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function ResolvedContactsAvatar({
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

function ResolvedContactsImage({
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

function applyForumFriendAcceptanceSettlement(
  characters: Character[],
  input: {
    characterId: string;
    actorName: string;
    content: string;
    timestamp: number;
  },
) {
  return characters.map((character) => {
    if (!character || character.id !== input.characterId) {
      return character;
    }

    const settlement = buildForumSharedSettlement(character, {
      kind: 'friend_request_accepted',
      actorName: input.actorName,
      content: input.content,
      timestamp: input.timestamp,
    });

    return {
      ...character,
      sharedContextSnapshots: settlement.sharedContextSnapshots,
      shortTermSummary: settlement.shortTermSummary,
      openLoopRegistry: settlement.openLoopRegistry,
      sharedState: settlement.sharedState,
    };
  });
}

function CharacterCardPreviewPage({
  title,
  rawContent,
  previewContent,
  mode,
  onChangeMode,
  onBack,
}: {
  title: string;
  rawContent: string;
  previewContent: string;
  mode: 'preview' | 'raw';
  onChangeMode: (mode: 'preview' | 'raw') => void;
  onBack: () => void;
}) {
  const contactsSheetTopInset = 'calc(env(safe-area-inset-top, 0px) + 8px)';
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 z-[90] flex flex-col bg-white"
    >
      <div
        className="pb-2.5 px-3.5 flex items-center justify-between shrink-0 border-b border-zinc-50"
        style={{ paddingTop: contactsSheetTopInset }}
      >
        <button onClick={onBack} className="p-1 -ml-1 text-zinc-600 active:text-zinc-800">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[16px] font-bold text-zinc-900">角色卡预览</h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-4">
        <h2 className="text-[18px] font-bold text-zinc-900">{title}</h2>
        <p className="mt-1 text-[11px] text-zinc-400">预览只做显示清洗，不会改动你导入的原始内容。</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onChangeMode('preview')}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              mode === 'preview'
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-zinc-200 bg-zinc-50 text-zinc-500'
            }`}
          >
            预览
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('raw')}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              mode === 'raw'
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-zinc-200 bg-zinc-50 text-zinc-500'
            }`}
          >
            原文
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {mode === 'preview' ? (
          <div className="whitespace-pre-wrap break-words rounded-2xl bg-zinc-50 p-4 text-[13px] leading-6 text-zinc-700">
            {previewContent || '暂无可显示的角色卡预览。'}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-zinc-50 p-4 text-[12px] leading-6 text-zinc-700">
            {rawContent || '暂无原始内容。'}
          </pre>
        )}
      </div>
    </motion.div>
  );
}

export function ContactsApp({ 
  appData, 
  setAppData,
  onOpenChat, 
  onOpenProfile,
  onAddFriend,
  onManageGroups,
  settings,
}: { 
  appData: AppData; 
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  onOpenChat: (id: string) => void; 
  onOpenProfile: (id: string) => void;
  onAddFriend: () => void;
  onManageGroups: () => void;
  settings: AppSettings;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'new-friends' | 'group-manager'>('list');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { characters, groups } = appData;
  const friendRequests = appData.friendRequests || [];

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
  const pendingIncomingFriendRequestCount = friendRequests.filter((request) => (
    request.status === 'pending' && isIncomingFriendRequest(request)
  )).length;

  const appendRelationshipMessages = (
    currentHistory: AppData['chatHistory'],
    characterId: string,
    messages: ReturnType<typeof createRelationshipSystemMessage>[],
  ) => ({
    ...currentHistory,
    [characterId]: [...(currentHistory[characterId] || []), ...messages],
  });

  const queueRelationshipRequestReaction = (params: {
    requestId: string;
    characterId: string;
    accepted: boolean;
  }) => {
    const targetCharacter = appData.characters.find((character) => character.id === params.characterId);
    if (!targetCharacter) {
      return;
    }

    const historySnapshot = appData.chatHistory[params.characterId] || [];

    void (async () => {
      const generated = await generateRelationshipEventReply({
        settings,
        character: targetCharacter,
        allCharacters: appData.characters,
        userName: appData.userProfile.name,
        history: historySnapshot,
        directChatHistory: appData.chatHistory,
        chatGroups: appData.chatGroups || [],
        masks: appData.masks,
        worldBook: appData.worldBooks || [],
        perception: appData.perception,
        coupleSpace: appData.coupleSpace,
        event: {
          kind: params.accepted ? 'user_accepted_character_request' : 'user_rejected_character_request',
        },
      });

      setAppData((prev) => {
        const currentCharacter = prev.characters.find((character) => character.id === params.characterId);
        const currentRequest = (prev.friendRequests || []).find((request) => request.id === params.requestId);
        if (!currentCharacter || !currentRequest || currentRequest.status !== (params.accepted ? 'accepted' : 'rejected')) {
          return prev;
        }

        const reactionText = generated?.reactionText?.trim() || buildCharacterIncomingRequestResolution(currentCharacter, params.accepted);
        return {
          ...prev,
          chatHistory: appendRelationshipMessages(prev.chatHistory, params.characterId, [
            createCharacterRelationshipMessage(params.characterId, reactionText, Date.now()),
          ]),
        };
      });
    })();
  };

  const handleAcceptFriendRequest = (id: string) => {
    const initialRequest = friendRequests.find((request) => request.id === id);
    setAppData(prev => {
      const req = prev.friendRequests?.find(r => r.id === id);
      if (!req) return prev;

      if (req.sourceScene === 'forum') {
        const currentForumData = hydrateForumData(prev.forumData, EMPTY_CONTACTS_FORUM_DATA);
        const currentTempChats = currentForumData.tempChats || {};
        const requestAuthorId = req.sourceTempChatAuthorId || req.fromUserId;
        const bridged = bridgeForumFriendToFormalChat({
          appData: prev as any,
          author: {
            id: req.fromUserId,
            name: req.fromUserName,
            avatar: req.fromUserAvatar,
            handle: req.forumHandle,
            bio: req.forumBio,
            persona: req.forumPersona,
          },
          session: currentTempChats[requestAuthorId],
        });

        const newChar: Character = {
          id: req.fromUserId,
          name: req.fromUserName,
          avatar: req.fromUserAvatar,
          gender: 'other',
          setting: '你的新朋友',
          corePersona: '你的新朋友',
          openingRemark: '你好！很高兴认识你。',
          lastTime: Date.now(),
          groupId: '朋友',
          friendshipStatus: 'friends' as const,
          blockedByUser: false,
          blockedByCharacter: false,
          relationshipStatusUpdatedAt: Date.now(),
        };

        const acceptedCharacters = bridged?.nextCharacters || [...prev.characters, newChar];
        const nextCharacters = applyForumFriendAcceptanceSettlement(acceptedCharacters, {
          characterId: req.fromUserId,
          actorName: req.fromUserName,
          content: req.message || '论坛里的来往正式往前走了一步。',
          timestamp: Date.now(),
        });
        void saveCharacters(nextCharacters);
        const nextTempChats = {
          ...currentTempChats,
          [requestAuthorId]: bridged?.nextTempSession || markForumFriendRequestResolved(
            currentTempChats[requestAuthorId] || createEmptyForumTempChatSession(requestAuthorId),
            'accepted',
          ),
        };

        return {
          ...prev,
          characters: nextCharacters,
          chatHistory: bridged?.nextChatHistory || prev.chatHistory,
          friendRequests: prev.friendRequests?.map(r => r.id === id ? {
            ...r,
            status: 'accepted',
            resolutionMessage: '你已通过这条好友申请',
            lastUpdatedAt: Date.now(),
          } : r),
          forumData: {
            ...currentForumData,
            tempChats: nextTempChats,
          },
        };
      }

      const characterId = getFriendRequestCharacterId(req);
      if (!characterId) {
        return {
          ...prev,
          friendRequests: prev.friendRequests?.map(r => r.id === id ? {
            ...r,
            status: 'accepted',
            resolutionMessage: '你已通过这条好友申请',
            lastUpdatedAt: Date.now(),
          } : r),
        };
      }

      const timestamp = Date.now();
      const targetCharacter = prev.characters.find((character) => character.id === characterId);
      const nextCharacters = prev.characters.map((character) => (
        character.id === characterId
          ? {
              ...character,
              friendshipStatus: 'friends' as const,
              blockedByUser: false,
              blockedByCharacter: false,
              relationshipStatusUpdatedAt: timestamp,
            }
          : character
      ));
      const nextFriendRequests = (prev.friendRequests || []).map((request) => {
        if (getFriendRequestCharacterId(request) !== characterId || request.status !== 'pending') {
          return request;
        }
        if (request.id === id) {
          return {
            ...request,
            status: 'accepted' as const,
            resolutionMessage: '你已通过这条好友申请',
            lastUpdatedAt: timestamp,
          };
        }
        return {
          ...request,
          status: 'superseded' as const,
          resolutionMessage: '关系已恢复，旧申请自动归档',
          lastUpdatedAt: timestamp,
        };
      });
      const nextHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
        createRelationshipSystemMessage(`你通过了 ${targetCharacter?.remarkName?.trim() || targetCharacter?.name || '对方'} 的好友申请。`, timestamp),
      ]);

      void saveCharacters(nextCharacters);
      return {
        ...prev,
        characters: nextCharacters,
        chatHistory: nextHistory,
        friendRequests: nextFriendRequests,
      };
    });

    if (initialRequest?.sourceScene !== 'forum') {
      const characterId = getFriendRequestCharacterId(initialRequest);
      if (characterId) {
        queueRelationshipRequestReaction({
          requestId: id,
          characterId,
          accepted: true,
        });
      }
    }
  };

  const handleRejectFriendRequest = (id: string) => {
    const initialRequest = friendRequests.find((request) => request.id === id);
    setAppData(prev => {
      const req = prev.friendRequests?.find(r => r.id === id);
      if (!req) {
        return {
          ...prev,
          friendRequests: prev.friendRequests?.map(r => r.id === id ? { ...r, status: 'rejected' } : r)
        };
      }

      if (req.sourceScene === 'forum') {
        const currentForumData = hydrateForumData(prev.forumData, EMPTY_CONTACTS_FORUM_DATA);
        const currentTempChats = currentForumData.tempChats || {};
        const requestAuthorId = req.sourceTempChatAuthorId || req.fromUserId;

        return {
          ...prev,
          friendRequests: prev.friendRequests?.map(r => r.id === id ? {
            ...r,
            status: 'rejected',
            resolutionMessage: '你拒绝了这条好友申请',
            lastUpdatedAt: Date.now(),
          } : r),
          forumData: {
            ...currentForumData,
            tempChats: {
              ...currentTempChats,
              [requestAuthorId]: markForumFriendRequestResolved(
                currentTempChats[requestAuthorId] || createEmptyForumTempChatSession(requestAuthorId),
                'rejected',
              ),
            },
          },
        };
      }

      const characterId = getFriendRequestCharacterId(req);
      if (!characterId) {
        return {
          ...prev,
          friendRequests: prev.friendRequests?.map(r => r.id === id ? {
            ...r,
            status: 'rejected',
            resolutionMessage: '你拒绝了这条好友申请',
            lastUpdatedAt: Date.now(),
          } : r),
        };
      }

      const timestamp = Date.now();
      const targetCharacter = prev.characters.find((character) => character.id === characterId);
      const nextHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
        createRelationshipSystemMessage(`你拒绝了 ${targetCharacter?.remarkName?.trim() || targetCharacter?.name || '对方'} 的好友申请。`, timestamp),
      ]);

      return {
        ...prev,
        chatHistory: nextHistory,
        friendRequests: prev.friendRequests?.map(r => r.id === id ? {
          ...r,
          status: 'rejected',
          resolutionMessage: '你拒绝了这条好友申请',
          lastUpdatedAt: timestamp,
        } : r),
      };
    });

    if (initialRequest?.sourceScene !== 'forum') {
      const characterId = getFriendRequestCharacterId(initialRequest);
      if (characterId) {
        queueRelationshipRequestReaction({
          requestId: id,
          characterId,
          accepted: false,
        });
      }
    }
  };

  if (view === 'new-friends') {
    return (
      <NewFriendsPage 
        requests={friendRequests}
        onAccept={handleAcceptFriendRequest}
        onReject={handleRejectFriendRequest}
        onAddById={(id) => {
          // Mock adding by ID
          const newReq: FriendRequest = {
            id: Date.now().toString(),
            fromUserId: id,
            fromUserName: `用户 ${id.slice(0, 4)}`,
            fromUserAvatar: `https://picsum.photos/seed/${id}/200`,
            status: 'pending',
            timestamp: Date.now(),
            message: '通过虚拟ID查找添加',
            direction: 'outgoing',
            initiator: 'user',
            requestKind: 'friend',
            sourceScene: 'manual',
            lastUpdatedAt: Date.now(),
          };
          setAppData(prev => ({
            ...prev,
            friendRequests: [newReq, ...(prev.friendRequests || [])]
          }));
          alert('已发送好友申请（模拟）');
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
            createdAt: Date.now()
          };
          setAppData(prev => ({
            ...prev,
            chatGroups: [newGroup, ...(prev.chatGroups || [])],
          }));
        }}
        onDeleteGroup={(id) => {
          const nextChatGroups = (appData.chatGroups || []).filter((group) => group.id !== id);

          persistChatOrganization({
            groups: appData.groups,
            chatGroups: nextChatGroups,
          });
          patchChatHistoryRecords((current) => {
            const nextGroupSessions = { ...current.groupSessions };
            delete nextGroupSessions[id];

            return {
              ...current,
              groupSessions: nextGroupSessions,
            };
          });
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

      <div
        data-swipe-ignore="true"
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--app-safe-area-bottom-tab, 0px) + 2.75rem)' }}
      >
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
            {pendingIncomingFriendRequestCount > 0 && (
              <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendingIncomingFriendRequestCount}
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
                {groupMembers.map(char => {
                  const displayName = char.remarkName?.trim() || char.name;

                  return (
                    <div 
                      key={char.id}
                      onClick={() => onOpenProfile(char.id)}
                      className="flex-shrink-0 w-[100px] rounded-2xl border shadow-sm p-3 flex flex-col items-center gap-2 active:scale-95 transition-transform cursor-pointer bg-white border-zinc-100"
                    >
                      <ResolvedContactsAvatar value={char.avatar} alt={displayName} className="w-12 h-12 rounded-full object-cover bg-zinc-100" />
                      <span className="text-[12px] font-bold text-zinc-800 truncate w-full text-center">{displayName}</span>
                    </div>
                  );
                })}
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
              <span className="text-[10px] text-zinc-500 font-medium">姓名（拼音）{sortOrder === 'asc' ? '升序' : '降序'}</span>
              <RefreshCw size={10} className={`text-zinc-400 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
            </button>
          </div>
          <div 
            className="rounded-t-[32px] overflow-hidden border-t border-zinc-100 shadow-sm bg-white"
          >
            <div className="divide-y divide-zinc-200/20">
              {filteredCharacters.map(char => {
                const displayName = char.remarkName?.trim() || char.name;
                const listPreview = sanitizePreviewText(char.signature)
                  || sanitizePreviewText(char.openingRemark)
                  || sanitizePreviewText(buildCharacterContext({ character: char }).corePersona)
                  || '这个角色还没有简介。';

                return (
                  <div 
                    key={char.id}
                    onClick={() => onOpenProfile(char.id)}
                    className="flex items-center gap-3 p-4 active:bg-white/50 transition-colors cursor-pointer"
                  >
                  <button
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfile(char.id);
                    }}
                  >
                    <ResolvedContactsAvatar 
                      value={char.avatar} 
                      alt={displayName} 
                      className="w-10 h-10 rounded-full object-cover bg-zinc-100 shrink-0" 
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-zinc-900 truncate">{displayName}</h3>
                    <p className="mt-0.5 text-[12px] text-zinc-400 truncate">{listPreview}</p>
                  </div>
                </div>
              );
            })}
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
  onOpenMoments,
  groups,
  friendRequests,
  onUpdateGroup,
  onTogglePin,
  onUpdateRemark,
  onDeleteCharacter,
  onToggleBlock,
  onSubmitFriendRequest
}: { 
  character: Character; 
  onBack: () => void; 
  onChat: () => void;
  onOpenMoments: () => void;
  groups: string[];
  friendRequests: FriendRequest[];
  onUpdateGroup: (groupId: string | undefined) => void;
  onTogglePin?: () => void;
  onUpdateRemark?: (remarkName: string | undefined) => void;
  onDeleteCharacter?: () => void;
  onToggleBlock?: () => void;
  onSubmitFriendRequest?: (message: string) => void;
}) {
  const contactsHeaderTopInset = 'calc(env(safe-area-inset-top, 0px) + 8px)';
  const [showRawCardPreview, setShowRawCardPreview] = useState(false);
  const [cardPreviewMode, setCardPreviewMode] = useState<'preview' | 'raw'>('preview');
  const [showManagementSheet, setShowManagementSheet] = useState(false);
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const displayName = character.remarkName?.trim() || character.name;
  const currentRemarkName = character.remarkName?.trim() || '';
  const rawCardContent = resolveCharacterCardSource(character);
  const previewCardContent = sanitizePreviewText(rawCardContent);
  const fallbackSignature = sanitizePreviewText(character.openingRemark)
    || sanitizePreviewText(character.corePersona)
    || `${(character.corePersona?.trim() || '').slice(0, 36)}${(character.corePersona?.trim() || '').length > 36 ? '...' : ''}`;
  const profileSignature = sanitizePreviewText(character.signature) || fallbackSignature;
  const hasRawCardPreview = rawCardContent.length > 0;
  const [pendingRemarkName, setPendingRemarkName] = useState(currentRemarkName);
  const [requestMessage, setRequestMessage] = useState('');
  const isFriend = getCharacterFriendshipStatus(character) === 'friends';
  const blockState = getCharacterBlockState(character);
  const canChat = canChatWithCharacter(character);
  const relationshipStatusText = getCharacterRelationshipStatusText(character, friendRequests);
  const pendingIncomingRequest = getPendingCharacterRequest(friendRequests, character.id, 'incoming');
  const pendingOutgoingRequest = getPendingCharacterRequest(friendRequests, character.id, 'outgoing');
  const latestRequest = getLatestCharacterRequest(friendRequests, character.id);

  const requestButtonLabel = isFriend
    ? '拉黑'
    : blockState === 'user'
      ? '解除拉黑'
      : pendingOutgoingRequest
        ? '再次申请'
        : '申请添加';
  const requestButtonIcon = isFriend || blockState === 'user'
    ? <X size={18} />
    : <UserPlus size={18} />;
  const requestSheetPlaceholder = blockState === 'character' || blockState === 'mutual'
    ? '例如：这次我想认真把你加回来，不会再随手把你推开。'
    : '例如：你好，想把你加回来，之后继续好好聊。';

  useEffect(() => {
    setPendingRemarkName(currentRemarkName);
  }, [character.id, currentRemarkName]);

  const closeManagementSheet = () => {
    setShowManagementSheet(false);
    setIsEditingRemark(false);
    setPendingRemarkName(currentRemarkName);
  };

  const closeRequestSheet = () => {
    setShowRequestSheet(false);
    setRequestMessage('');
  };

  const handleCopyId = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(character.id);
        alert('角色 ID 已复制');
      } else {
        alert(`角色 ID：${character.id}`);
      }
    } catch {
      alert(`角色 ID：${character.id}`);
    }
    closeManagementSheet();
  };

  const handleSaveRemark = () => {
    onUpdateRemark?.(pendingRemarkName.trim() || undefined);
    closeManagementSheet();
  };

  const handleDeleteCharacter = async () => {
    if (!onDeleteCharacter) return;
    if (!(await showInAppConfirm(`确定要删除角色“${displayName}”吗？删除后不会保留这条关系。`))) {
      return;
    }
    closeManagementSheet();
    onDeleteCharacter();
  };

  const handlePrimaryRelationshipAction = async () => {
    if (isFriend || blockState === 'user') {
      if (isFriend && !(await showInAppConfirm(`确定要拉黑“${displayName}”吗？拉黑后需要重新申请才能恢复聊天。`))) {
        return;
      }
      onToggleBlock?.();
      return;
    }

    setRequestMessage(
      blockState === 'character' || blockState === 'mutual'
        ? '这次我想认真把你加回来。'
        : '想把你加回来，之后继续好好聊。',
    );
    setShowRequestSheet(true);
  };

  const handleSubmitFriendRequest = () => {
    onSubmitFriendRequest?.(requestMessage.trim());
    closeRequestSheet();
  };

  if (showRawCardPreview) {
    return (
      <CharacterCardPreviewPage
        title={displayName}
        rawContent={rawCardContent}
        previewContent={previewCardContent}
        mode={cardPreviewMode}
        onChangeMode={setCardPreviewMode}
        onBack={() => setShowRawCardPreview(false)}
      />
    );
  }

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-white flex flex-col z-[80]"
    >
      {/* Header */}
      <div
        className="pb-2.5 px-3.5 flex items-center justify-between shrink-0 border-b border-zinc-50"
        style={{ paddingTop: contactsHeaderTopInset }}
      >
        <button onClick={onBack} className="p-1 -ml-1 text-zinc-600 active:text-zinc-800">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[16px] font-bold text-zinc-900">详细资料</h1>
        <button
          type="button"
          onClick={() => setShowManagementSheet(true)}
          className="p-1 text-zinc-400 active:text-zinc-700"
        >
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50">
        {/* Profile Info Card */}
        <div className="bg-white px-4 py-4 flex items-center gap-3 mb-2.5">
          <ResolvedContactsAvatar value={character.avatar} alt={displayName} className="w-14 h-14 rounded-xl object-cover shadow-sm" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-bold text-zinc-900 truncate">{displayName}</h2>
            <p className="text-[12px] text-zinc-400 mt-0.5">ID: {character.id}</p>
            <p className="mt-1 text-[11px] text-zinc-500">{relationshipStatusText}</p>
          </div>
        </div>

        {/* Details List */}
        <div className="space-y-2.5">
          <div className="bg-white divide-y divide-zinc-50">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-[14px] text-zinc-800">性别</span>
              <span className="text-[14px] text-zinc-400">{character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '其他'}</span>
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-[14px] text-zinc-800">置顶聊天</span>
              <button 
                onClick={onTogglePin}
                className={`w-10 h-5.5 rounded-full transition-colors relative ${character.isPinned ? 'bg-zinc-900' : 'bg-zinc-200'}`}
              >
                <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.isPinned ? 'translate-x-4.5' : ''}`} />
              </button>
            </div>
            <button
              onClick={onOpenMoments}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-zinc-50 transition-colors"
            >
              <span className="text-[14px] text-zinc-800">角色动态主页</span>
              <ChevronRight size={16} className="text-zinc-400" />
            </button>
            <div className="px-4 py-3.5">
              <p className="text-[14px] text-zinc-800 mb-1">个性签名</p>
              <p className="text-[13px] text-zinc-400 leading-relaxed">{profileSignature}</p>
              {hasRawCardPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setCardPreviewMode('preview');
                    setShowRawCardPreview(true);
                  }}
                  className="mt-2 text-[12px] font-medium text-zinc-500 underline-offset-2 active:opacity-70"
                >
                  查看角色卡预览
                </button>
              )}
            </div>
          </div>

          {isFriend && (
            <div className="bg-white px-4 py-3.5">
              <p className="text-[14px] text-zinc-800 mb-2.5">分组设置</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onUpdateGroup(undefined)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${!character.groupId ? 'bg-zinc-100 border-zinc-200 text-zinc-800 shadow-sm' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                >
                  无分组
                </button>
                {groups.map(g => (
                  <button
                    key={g}
                    onClick={() => onUpdateGroup(g)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${character.groupId === g ? 'bg-zinc-100 border-zinc-200 text-zinc-800 shadow-sm' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 px-4 space-y-2.5 pb-7">
          {!!pendingIncomingRequest && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-[12px] leading-5 text-amber-900">
              <div className="font-medium">新的朋友里有一条来自 {displayName} 的申请。</div>
              <div className="mt-1 text-amber-700">{pendingIncomingRequest.message || '等你去处理这条好友申请。'}</div>
            </div>
          )}
          {!pendingIncomingRequest && !!latestRequest?.resolutionMessage && !isFriend && (
            <div className="rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-[12px] leading-5 text-zinc-500">
              {latestRequest.resolutionMessage}
            </div>
          )}
          <button
            onClick={() => void handlePrimaryRelationshipAction()}
            className={`w-full py-3.5 rounded-2xl font-bold text-[15px] transition-all border flex items-center justify-center gap-2 ${
              isFriend
                ? 'bg-red-50 text-red-500 border-red-100 active:bg-red-100'
                : blockState === 'user'
                  ? 'bg-zinc-100 text-zinc-800 border-zinc-200 active:bg-zinc-200'
                  : 'bg-white text-zinc-700 border-zinc-200 active:bg-zinc-50'
            }`}
          >
            {requestButtonIcon}
            {requestButtonLabel}
          </button>
          <button 
            onClick={onChat}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-[15px] font-bold shadow-sm transition-transform active:scale-[0.98] ${
              canChat
                ? 'border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <MessageSquare size={18} />
            聊天
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showRequestSheet && (
          <>
            <motion.button
              type="button"
              aria-label="关闭申请面板"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeRequestSheet}
              className="absolute inset-0 z-10 bg-black/20"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
            >
              <div className="rounded-[28px] border border-zinc-100 bg-white p-4 shadow-2xl">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200" />
                <p className="text-[16px] font-bold text-zinc-900">发送好友申请</p>
                <p className="mt-1 text-[12px] text-zinc-400">给 {displayName} 留一句附言，像微信那样递过去。</p>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value.slice(0, 120))}
                  placeholder={requestSheetPlaceholder}
                  className="mt-4 min-h-[128px] w-full resize-none rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white"
                />
                <div className="mt-2 text-right text-[11px] text-zinc-400">{requestMessage.length}/120</div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={closeRequestSheet}
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white py-3 text-[14px] font-medium text-zinc-600 active:bg-zinc-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitFriendRequest}
                    disabled={!requestMessage.trim()}
                    className={`flex-1 rounded-2xl border py-3 text-[14px] font-semibold ${
                      requestMessage.trim()
                        ? 'border-zinc-200 bg-zinc-100 text-zinc-900 active:bg-zinc-200'
                        : 'border-zinc-100 bg-zinc-50 text-zinc-300'
                    }`}
                  >
                    发送申请
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManagementSheet && (
          <>
            <motion.button
              type="button"
              aria-label="关闭管理菜单"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeManagementSheet}
              className="absolute inset-0 z-10 bg-black/20"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
            >
              <div className="rounded-[28px] border border-zinc-100 bg-white p-3 shadow-2xl">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200" />
                <div className="px-2 pb-2">
                  <p className="text-[15px] font-bold text-zinc-900">联系人管理</p>
                  <p className="mt-1 text-[12px] text-zinc-400">{displayName}</p>
                </div>

                {isEditingRemark ? (
                  <div className="px-2 pb-2">
                    <label className="text-[12px] font-medium text-zinc-500">备注名</label>
                    <input
                      type="text"
                      value={pendingRemarkName}
                      onChange={(e) => setPendingRemarkName(e.target.value.slice(0, CONTACT_REMARK_NAME_LIMIT))}
                      placeholder="例如：阿白、学长、小周"
                      autoFocus
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveRemark();
                        }
                      }}
                    />
                    <div className="mt-2 text-right text-[11px] text-zinc-400">
                      {pendingRemarkName.length}/{CONTACT_REMARK_NAME_LIMIT}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingRemark(false);
                          setPendingRemarkName(currentRemarkName);
                        }}
                        className="flex-1 rounded-2xl border border-zinc-200 bg-white py-3 text-[14px] font-medium text-zinc-600 active:bg-zinc-50"
                      >
                        返回
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveRemark}
                        className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-100 py-3 text-[14px] font-semibold text-zinc-900 active:bg-zinc-200"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {onUpdateRemark && (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingRemarkName(currentRemarkName);
                          setIsEditingRemark(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left active:bg-zinc-100"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm">
                          <PencilLine size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-zinc-900">设置备注</p>
                          <p className="mt-0.5 truncate text-[12px] text-zinc-400">
                            {currentRemarkName || '未设置'}
                          </p>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleCopyId()}
                      className="flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left active:bg-zinc-100"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm">
                        <Copy size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-zinc-900">复制角色 ID</p>
                        <p className="mt-0.5 truncate text-[12px] text-zinc-400">{character.id}</p>
                      </div>
                    </button>

                    {onDeleteCharacter && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteCharacter()}
                        className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3 text-left active:bg-red-100"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-red-500 shadow-sm">
                          <Trash2 size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-red-500">删除角色</p>
                          <p className="mt-0.5 text-[12px] text-red-300">会把这个角色和关联申请一起移除</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type CharacterMoment = {
  id: string;
  authorId: string;
  content: string;
  images?: string[];
  timestamp: number;
  likes: number;
  likedBy?: string[];
  isLiked?: boolean;
  comments: MomentComment[];
};

export function CharacterMomentsProfile({
  character,
  appData,
  setAppData,
  settings,
  moments,
  onBack,
}: {
  character: Character;
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  settings: AppSettings;
  moments: CharacterMoment[];
  onBack: () => void;
}) {
  const characterMomentsHeaderTopPadding = 'calc(env(safe-area-inset-top, 0px) + 12px)';
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{
    momentId: string;
    commentId: string;
    authorId: string;
    authorName: string;
  } | null>(null);
  const displayName = character.remarkName?.trim() || character.name;
  const { userProfile, characters } = appData;
  const { getCharacterById, getCharacterDisplayName } = createCharacterDirectory({ characters });
  const ownMoments = moments
    .filter(moment => moment.authorId === character.id)
    .sort((a, b) => b.timestamp - a.timestamp);
  const profileSummary = sanitizePreviewText(character.signature)
    || sanitizePreviewText(character.motto)
    || sanitizePreviewText(character.openingRemark)
    || '这个角色还没有写下动态签名。';
  const heroGradient = character.gender === 'female'
    ? 'from-zinc-200 via-rose-200 to-zinc-500'
    : character.gender === 'male'
      ? 'from-zinc-200 via-sky-200 to-zinc-500'
      : 'from-zinc-200 via-zinc-400 to-zinc-600';
  const activeConfig = useMemo(
    () => resolveSceneTextApiConfig({
      settings,
      scene: 'forum',
    }).runtimeConfig,
    [settings],
  );

  const resolveMomentAuthor = (authorId: string): Character | typeof userProfile | undefined => {
    if (authorId === 'user') return userProfile;
    return getCharacterById(authorId) || undefined;
  };

  const handleLike = (momentId: string) => {
    setAppData((prev) => ({
      ...prev,
      moments: (prev.moments || []).map((moment: MomentItem) => {
        if (moment.id !== momentId) return moment;
        const likedBy = moment.likedBy || [];
        const isLiked = likedBy.includes('user');
        const nextLikedBy = isLiked ? likedBy.filter((id) => id !== 'user') : [...likedBy, 'user'];
        return {
          ...moment,
          likedBy: nextLikedBy,
          likes: nextLikedBy.length,
          isLiked: !isLiked,
        };
      }),
    }));
  };

  const appendCommentToMoment = (momentId: string, comment: MomentComment) => {
    setAppData((prev) => ({
      ...prev,
      moments: (prev.moments || []).map((moment: MomentItem) =>
        moment.id === momentId ? { ...moment, comments: [...moment.comments, comment] } : moment,
      ),
    }));
  };

  const toggleCommentComposer = (momentId: string, nextReplyTarget: typeof replyTarget) => {
    const isSameMoment = commentingOn === momentId;
    const currentTargetId = replyTarget?.momentId === momentId ? replyTarget.commentId : null;
    const nextTargetId = nextReplyTarget?.momentId === momentId ? nextReplyTarget.commentId : null;
    const isSameReplyTarget = currentTargetId === nextTargetId;

    if (isSameMoment && isSameReplyTarget) {
      setCommentingOn(null);
      setReplyTarget(null);
      setCommentText('');
      return;
    }

    setCommentingOn(momentId);
    setReplyTarget(nextReplyTarget);
  };

  const handleComment = async (momentId: string) => {
    if (!commentText.trim()) return;

    const activeReplyTarget = replyTarget?.momentId === momentId ? replyTarget : null;
    const userComment: MomentComment = {
      id: Date.now().toString(),
      authorId: 'user',
      content: commentText.trim(),
      timestamp: Date.now(),
      replyToCommentId: activeReplyTarget?.commentId,
      replyToAuthorId: activeReplyTarget?.authorId,
      replyToAuthorName: activeReplyTarget?.authorName,
    };

    appendCommentToMoment(momentId, userComment);
    setCommentingOn(null);
    setCommentText('');
    setReplyTarget(null);

    const moment = (appData.moments || []).find((item: MomentItem) => item.id === momentId);
    if (!moment || !activeConfig) return;

    void runMomentCommentReplySequence({
      activeConfig,
      moment,
      characters,
      chatGroups: appData.chatGroups || [],
      userName: userProfile.name,
      triggerComment: userComment,
      appendComment: (comment) => appendCommentToMoment(momentId, comment),
    });
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-zinc-50 flex flex-col z-[80]"
    >
      <div
        className="min-h-[64px] pb-3 px-4 bg-white/30 backdrop-blur-md border-b border-white/20 flex items-center gap-3 shrink-0"
        style={{ paddingTop: characterMomentsHeaderTopPadding }}
      >
        <button onClick={onBack} className="p-1 -ml-1 text-zinc-600 active:text-zinc-800">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-bold text-zinc-900 flex-1 text-center mr-8">动态</h1>
      </div>

      <div
        className="relative flex-1 overflow-y-auto bg-zinc-50"
        style={{ paddingBottom: 'calc(var(--app-safe-area-bottom-tab, 0px) + 2.75rem)' }}
      >
        <div className="relative pb-4">
          <div className="h-40 relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${heroGradient}`} />
          </div>

          <div className="px-5 relative -mt-10 flex items-end gap-3 justify-start z-10">
            <div className="relative flex-1 min-w-0 flex flex-col gap-1">
              <div className="absolute inset-0 bg-black/5 rounded-2xl blur-sm transform translate-y-1" />
              <ResolvedContactsAvatar value={character.avatar} alt={displayName} className="w-20 h-20 rounded-2xl border-[3px] border-white object-cover bg-white shadow-md relative z-10" />
            </div>
            <div className="mb-1.5 flex-1 text-left">
              <div className="flex items-center justify-start gap-2">
                <h2 className="text-[20px] font-bold text-zinc-900">{displayName}</h2>
                <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-[10px] font-medium rounded-full">
                  {character.gender === 'female' ? '她的动态' : character.gender === 'male' ? '他的动态' : '角色动态'}
                </span>
              </div>
              <p className="text-[13px] text-zinc-500 mt-0.5">{profileSummary}</p>
            </div>
          </div>
        </div>

        <div className="bg-transparent px-0 pt-4 space-y-4">
          {ownMoments.length === 0 ? (
            <div className="mx-4 py-10 text-center text-zinc-400">
              <p className="text-[14px]">这个角色还没有发布动态</p>
            </div>
          ) : (
            ownMoments.map(moment => (
              <div
                key={moment.id}
                className="p-4 mx-4 backdrop-blur-md border border-white/50 shadow-sm flex gap-3 transition-colors bg-white/90"
                style={{ borderRadius: 24 }}
              >
                <ResolvedContactsAvatar value={character.avatar} alt={displayName} className="w-10 h-10 rounded-full object-cover border border-zinc-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-[15px] text-zinc-900">{displayName}</h3>
                    <span className="text-[12px] text-zinc-400">
                      {new Date(moment.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[15px] text-zinc-800 mt-1 whitespace-pre-wrap leading-relaxed">{moment.content}</p>
                  {moment.images && moment.images.length > 0 && (
                    <div className={`grid gap-1.5 mt-3 ${moment.images.length === 1 ? 'grid-cols-1 w-2/3' : 'grid-cols-3'}`}>
                      {moment.images.slice(0, 6).map((image, index) => (
                        <ResolvedContactsImage
                          key={`${moment.id}-${index}`}
                          value={image}
                          alt={`moment-${moment.id}-${index}`}
                          className="w-full aspect-square object-cover rounded-xl border border-zinc-100"
                        />
                      ))}
                    </div>
                  )}
                  <div className="bg-zinc-50 rounded-2xl p-3 mt-3">
                    <div className="flex items-center gap-3 text-[13px] text-zinc-600 font-medium">
                      <button
                        onClick={() => handleLike(moment.id)}
                        className="flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-white"
                      >
                        <Heart
                          size={13}
                          className={(moment.likedBy?.includes('user') || moment.isLiked) ? 'fill-red-500 text-red-500' : 'text-zinc-500'}
                        />
                        <span>点赞 {moment.likes}</span>
                      </button>
                      <button
                        onClick={() => {
                          toggleCommentComposer(moment.id, null);
                        }}
                        className="flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-white"
                      >
                        <MessageSquare size={13} className="text-zinc-500" />
                        <span>评论 {moment.comments.length}</span>
                      </button>
                    </div>
                    {moment.comments.length > 0 && (
                      <div className="mt-2 border-t border-zinc-200/70 pt-2">
                        {moment.comments.map((comment) => {
                          const commentAuthor = resolveMomentAuthor(comment.authorId);
                          if (!commentAuthor) return null;

                          return (
                            <button
                              key={comment.id}
                              type="button"
                              onClick={() => {
                                toggleCommentComposer(moment.id, {
                                  momentId: moment.id,
                                  commentId: comment.id,
                                  authorId: comment.authorId,
                                  authorName: commentAuthor.name,
                                });
                              }}
                              className="mt-1 block w-full rounded-lg px-1 py-1 text-left text-[13px] leading-relaxed transition-colors hover:bg-white/80"
                            >
                              <span className="font-bold text-zinc-900">
                                {comment.authorId === 'user' ? userProfile.name : getCharacterDisplayName(comment.authorId)}
                              </span>
                              {comment.replyToAuthorName ? (
                                <>
                                  <span className="mx-1 text-zinc-500">回复</span>
                                  <span className="font-bold text-zinc-700">{comment.replyToAuthorName}</span>
                                  <span className="text-zinc-500">：</span>
                                </>
                              ) : (
                                <span className="text-zinc-500">：</span>
                              )}
                              <span className="text-zinc-700">{comment.content}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {commentingOn === moment.id && (
                      <div className="mt-3 flex w-full min-w-0 items-center gap-2">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder={replyTarget?.momentId === moment.id ? `回复 ${replyTarget.authorName}` : '发一条评论'}
                          className="min-w-0 w-full flex-1 rounded-full border border-transparent bg-white px-4 py-2 text-[13px] outline-none transition-all focus:border-zinc-900/20"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleComment(moment.id);
                          }}
                        />
                        <button
                          onClick={() => void handleComment(moment.id)}
                          className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-bold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-100"
                        >
                          发送
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
  });

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-x-4 max-h-[calc(100svh-8rem)] overflow-y-auto bg-white rounded-[32px] shadow-2xl z-[100] p-6 border border-zinc-100"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
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
                avatar: DEFAULT_WHITE_AVATAR,
                setting: `你是一个新添加的 AI 好友，名字叫 ${query}。`,
                corePersona: `你是一个新添加的 AI 好友，名字叫 ${query}。`,
                openingRemark: `你好！很高兴认识你，我是 ${query}。`,
              });
              setQuery('');
            }
          }}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-100 py-3.5 text-[15px] font-bold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-200 active:opacity-80"
        >
          添加
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [newGroup, setNewGroup] = useState('');
  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
  });

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-x-4 max-h-[calc(100svh-8rem)] overflow-y-auto bg-white rounded-[32px] shadow-2xl z-[100] p-6 border border-zinc-100"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
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
            className="rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-[14px] font-bold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-200 active:opacity-80"
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
      className={`flex flex-col items-center gap-0.5 transition-colors ${active ? 'text-zinc-900' : 'text-zinc-400'}`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}


