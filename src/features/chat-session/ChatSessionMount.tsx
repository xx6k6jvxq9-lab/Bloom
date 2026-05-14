import type {
  AppSettings,
  CallRecord,
  ChatGroup,
  ChatHistory,
  Character,
  CoupleSpaceData,
  CoupleSpaceState,
  DateSession,
  FavoriteMessage,
  FriendRequest,
  Mask,
  PerceptionSettings,
  VisualSettings,
  WalletData,
  WorldBookEntry,
} from '../../types';
import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DatingRecordsData } from '../persistence/datingRecordsStore';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { getPartnerCoupleSpaceData, isPartnerCoupleSpaceDismissed } from '../persistence/coupleSpaceStore';
import { DirectChatSessionContainer } from './DirectChatSessionContainer';
import { GroupChatSessionContainer } from './GroupChatSessionContainer';

type ChatSessionMountProps = {
  activeApp: string;
  selectedCharacterId?: string | null;
  selectedGroupId?: string | null;
  characters: Character[];
  chatGroups: ChatGroup[];
  setChatGroups: Dispatch<SetStateAction<ChatGroup[]>>;
  chatHistory: ChatHistory;
  setChatHistory: Dispatch<SetStateAction<ChatHistory>>;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  userAvatar: string;
  userName: string;
  masks: Mask[];
  favorites: FavoriteMessage[];
  setFavorites: (favorites: FavoriteMessage[]) => void;
  visualSettings: VisualSettings;
  setVisualSettings: (settings: VisualSettings) => void;
  groups: string[];
  worldBook?: WorldBookEntry[];
  perception?: PerceptionSettings;
  coupleSpaceState?: CoupleSpaceState;
  coupleSpace?: CoupleSpaceData;
  callHistory: CallRecord[];
  setCallHistory: (callHistory: CallRecord[]) => void;
  savedDates: DateSession[];
  collectedDates: DateSession[];
  datingResumeSignal?: number;
  setDatingRecords: (data: DatingRecordsData) => void;
  walletData?: WalletData;
  setWalletData: (data: WalletData) => void;
  updateCharacter: (updatedCharacter: Character) => void;
  patchCharacter: (characterId: string, patch: Partial<Character>) => void;
  setFriendRequests: Dispatch<SetStateAction<FriendRequest[]>>;
  onToggleCharacterBlock?: (characterId: string) => void;
  onBackToChat: () => void;
  onViewForumPost?: (postId: string) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; translation?: string; images?: string[]; sourceImage?: import('../../types').MomentSourceImageRef; imageCard?: import('../../types').MomentImageCard; isCollected?: boolean; sourceChatMessage?: { characterId: string; timestamp: number } }) => void;
  onOpenCharacterMoments?: () => void;
  onOpenCharacterProfile?: (characterId: string) => void;
  onStatusBarVisibilityChange?: (visible: boolean) => void;
  onAcceptCoupleSpaceInvite?: (characterId: string) => void;
  friendRequests?: FriendRequest[];
};

const RETAINED_DIRECT_SESSION_LIMIT = 2;
const RETAINED_GROUP_SESSION_LIMIT = 1;

function getInitialDirectSessionIds(activeApp: string, selectedCharacterId?: string | null): string[] {
  return activeApp === 'chat-session' && selectedCharacterId ? [selectedCharacterId] : [];
}

function getInitialGroupSessionIds(activeApp: string, selectedGroupId?: string | null): string[] {
  return activeApp === 'group-chat-session' && selectedGroupId ? [selectedGroupId] : [];
}

function appendRecentId(currentIds: string[], nextId: string | null | undefined, limit: number): string[] {
  if (!nextId) {
    return currentIds;
  }

  const nextIds = [nextId, ...currentIds.filter((id) => id !== nextId)].slice(0, limit);
  if (nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index])) {
    return currentIds;
  }

  return nextIds;
}

function appendUniqueId(currentIds: string[], nextId: string | null | undefined): string[] {
  if (!nextId) {
    return currentIds;
  }

  return currentIds.includes(nextId) ? currentIds : [...currentIds, nextId];
}

function removeId(currentIds: string[], targetId: string): string[] {
  if (!currentIds.includes(targetId)) {
    return currentIds;
  }

  return currentIds.filter((id) => id !== targetId);
}

function filterIds(
  currentIds: string[],
  predicate: (id: string) => boolean,
): string[] {
  const nextIds = currentIds.filter(predicate);
  if (nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index])) {
    return currentIds;
  }
  return nextIds;
}

export function ChatSessionMount({
  activeApp,
  selectedCharacterId,
  selectedGroupId,
  characters,
  chatGroups,
  setChatGroups,
  chatHistory,
  setChatHistory,
  settings,
  setSettings,
  userAvatar,
  userName,
  masks,
  favorites,
  setFavorites,
  visualSettings,
  setVisualSettings,
  groups,
  worldBook = [],
  perception,
  coupleSpaceState,
  coupleSpace,
  callHistory,
  setCallHistory,
  savedDates,
  collectedDates,
  datingResumeSignal,
  setDatingRecords,
  walletData,
  setWalletData,
  updateCharacter,
  patchCharacter,
  setFriendRequests,
  onToggleCharacterBlock,
  onBackToChat,
  onViewForumPost,
  onPublishMoment,
  onOpenCharacterMoments,
  onOpenCharacterProfile,
  onStatusBarVisibilityChange,
  onAcceptCoupleSpaceInvite,
  friendRequests = [],
}: ChatSessionMountProps) {
  const { getCharacterById } = createCharacterDirectory({ characters });
  const [mountedDirectCharacterIds, setMountedDirectCharacterIds] = useState<string[]>(() => (
    getInitialDirectSessionIds(activeApp, selectedCharacterId)
  ));
  const [mountedGroupIds, setMountedGroupIds] = useState<string[]>(() => (
    getInitialGroupSessionIds(activeApp, selectedGroupId)
  ));
  const [busyDirectCharacterIds, setBusyDirectCharacterIds] = useState<string[]>([]);
  const [busyGroupIds, setBusyGroupIds] = useState<string[]>([]);
  const [retainedDirectCharacterIds, setRetainedDirectCharacterIds] = useState<string[]>(() => (
    getInitialDirectSessionIds(activeApp, selectedCharacterId)
  ));
  const [retainedGroupIds, setRetainedGroupIds] = useState<string[]>(() => (
    getInitialGroupSessionIds(activeApp, selectedGroupId)
  ));

  useEffect(() => {
    if (activeApp === 'chat-session' && selectedCharacterId) {
      setMountedDirectCharacterIds((currentIds) => appendUniqueId(currentIds, selectedCharacterId));
      setRetainedDirectCharacterIds((currentIds) => appendRecentId(currentIds, selectedCharacterId, RETAINED_DIRECT_SESSION_LIMIT));
    }
  }, [activeApp, selectedCharacterId]);

  useEffect(() => {
    if (activeApp === 'group-chat-session' && selectedGroupId) {
      setMountedGroupIds((currentIds) => appendUniqueId(currentIds, selectedGroupId));
      setRetainedGroupIds((currentIds) => appendRecentId(currentIds, selectedGroupId, RETAINED_GROUP_SESSION_LIMIT));
    }
  }, [activeApp, selectedGroupId]);

  useEffect(() => {
    const validCharacterIds = new Set(characters.map((character) => character.id));
    setMountedDirectCharacterIds((currentIds) => filterIds(currentIds, (id) => validCharacterIds.has(id)));
    setBusyDirectCharacterIds((currentIds) => filterIds(currentIds, (id) => validCharacterIds.has(id)));
    setRetainedDirectCharacterIds((currentIds) => filterIds(currentIds, (id) => validCharacterIds.has(id)));
  }, [characters]);

  useEffect(() => {
    const validGroupIds = new Set(chatGroups.map((group) => group.id));
    setMountedGroupIds((currentIds) => filterIds(currentIds, (id) => validGroupIds.has(id)));
    setBusyGroupIds((currentIds) => filterIds(currentIds, (id) => validGroupIds.has(id)));
    setRetainedGroupIds((currentIds) => filterIds(currentIds, (id) => validGroupIds.has(id)));
  }, [chatGroups]);

  const handleDirectRuntimeBusyChange = useCallback((characterId: string, busy: boolean) => {
    setBusyDirectCharacterIds((currentIds) => (
      busy ? appendUniqueId(currentIds, characterId) : removeId(currentIds, characterId)
    ));
    setMountedDirectCharacterIds((currentIds) => {
      const isActive = activeApp === 'chat-session' && selectedCharacterId === characterId;
      if (busy || isActive) {
        return appendUniqueId(currentIds, characterId);
      }
      return removeId(currentIds, characterId);
    });
  }, [activeApp, selectedCharacterId]);

  const handleGroupRuntimeBusyChange = useCallback((groupId: string, busy: boolean) => {
    setBusyGroupIds((currentIds) => (
      busy ? appendUniqueId(currentIds, groupId) : removeId(currentIds, groupId)
    ));
    setMountedGroupIds((currentIds) => {
      const isActive = activeApp === 'group-chat-session' && selectedGroupId === groupId;
      if (busy || isActive) {
        return appendUniqueId(currentIds, groupId);
      }
      return removeId(currentIds, groupId);
    });
  }, [activeApp, selectedGroupId]);

  useEffect(() => {
    setMountedDirectCharacterIds((currentIds) => filterIds(currentIds, (id) => {
      if (busyDirectCharacterIds.includes(id)) {
        return true;
      }

      if (retainedDirectCharacterIds.includes(id)) {
        return true;
      }

      return activeApp === 'chat-session' && selectedCharacterId === id;
    }));
  }, [activeApp, selectedCharacterId, busyDirectCharacterIds, retainedDirectCharacterIds]);

  useEffect(() => {
    setMountedGroupIds((currentIds) => filterIds(currentIds, (id) => {
      if (busyGroupIds.includes(id)) {
        return true;
      }

      if (retainedGroupIds.includes(id)) {
        return true;
      }

      return activeApp === 'group-chat-session' && selectedGroupId === id;
    }));
  }, [activeApp, selectedGroupId, busyGroupIds, retainedGroupIds]);

  return (
    <>
      {mountedDirectCharacterIds.map((characterId) => {
        const mountedCharacter = getCharacterById(characterId);
        if (!mountedCharacter) {
          return null;
        }

        const isDirectActive = activeApp === 'chat-session' && selectedCharacterId === characterId;
        const isDirectBusy = busyDirectCharacterIds.includes(characterId);
        const characterCoupleSpace = getPartnerCoupleSpaceData(
          coupleSpaceState,
          coupleSpace,
          characterId,
        );
        const isCoupleSpaceDismissed = isPartnerCoupleSpaceDismissed(
          coupleSpaceState,
          coupleSpace,
          characterId,
        );

        return (
          <div
            key={`direct-session-${characterId}`}
            className={`absolute inset-0 ${isDirectActive ? 'z-[40] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
            aria-hidden={isDirectActive ? undefined : true}
          >
            <DirectChatSessionContainer
              character={mountedCharacter}
              characters={characters}
              isActive={isDirectActive}
              onRuntimeBusyChange={handleDirectRuntimeBusyChange}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              chatGroups={chatGroups}
              updateCharacter={updateCharacter}
              patchCharacter={patchCharacter}
              onToggleCharacterBlock={onToggleCharacterBlock}
              worldBook={worldBook}
              perception={perception}
              coupleSpace={characterCoupleSpace}
              isCoupleSpaceDismissed={isCoupleSpaceDismissed}
              settings={settings}
              setSettings={setSettings}
              onBack={onBackToChat}
              userAvatar={userAvatar}
              userName={userName}
              masks={masks}
              favorites={favorites}
              setFavorites={setFavorites}
              visualSettings={visualSettings}
              setVisualSettings={setVisualSettings}
              groups={groups}
              onViewForumPost={onViewForumPost}
              callHistory={callHistory}
              setCallHistory={setCallHistory}
              savedDates={savedDates}
              collectedDates={collectedDates}
              datingResumeSignal={datingResumeSignal}
              setDatingRecords={setDatingRecords}
              walletData={walletData}
              setWalletData={setWalletData}
              onPublishMoment={onPublishMoment}
              onOpenCharacterMoments={onOpenCharacterMoments}
              onOpenCharacterProfile={onOpenCharacterProfile}
              onStatusBarVisibilityChange={onStatusBarVisibilityChange}
              onAcceptCoupleSpaceInvite={onAcceptCoupleSpaceInvite}
              friendRequests={friendRequests}
              setFriendRequests={setFriendRequests}
              suspendHeavyRendering={!isDirectActive && !isDirectBusy}
            />
          </div>
        );
      })}

      {mountedGroupIds.map((groupId) => {
        const mountedGroup = chatGroups.find((group) => group.id === groupId) || null;
        if (!mountedGroup) {
          return null;
        }

        const isGroupActive = activeApp === 'group-chat-session' && selectedGroupId === groupId;
        const isGroupBusy = busyGroupIds.includes(groupId);

        return (
          <div
            key={`group-session-${groupId}`}
            className={`absolute inset-0 ${isGroupActive ? 'z-[40] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
            aria-hidden={isGroupActive ? undefined : true}
          >
            <GroupChatSessionContainer
              group={mountedGroup}
              isActive={isGroupActive}
              onRuntimeBusyChange={handleGroupRuntimeBusyChange}
              characters={characters}
              chatGroups={chatGroups}
              setChatGroups={setChatGroups}
              patchCharacter={patchCharacter}
              favorites={favorites}
              setFavorites={setFavorites}
              onBack={onBackToChat}
              userAvatar={userAvatar}
              userName={userName}
              settings={settings}
              worldBooks={worldBook}
              perception={perception}
              directChatHistory={chatHistory}
              suspendHeavyRendering={!isGroupActive && !isGroupBusy}
            />
          </div>
        );
      })}
    </>
  );
}
