import { useCallback, useEffect } from 'react';
import type {
  AppSettings,
  CallRecord,
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  CoupleSpaceData,
  DateSession,
  FavoriteMessage,
  FriendRequest,
  Mask,
  PerceptionSettings,
  VisualSettings,
  WalletData,
  WorldBookEntry,
} from '../../types';
import type { DatingRecordsData } from '../persistence/datingRecordsStore';
import { areChatMemorySnapshotsEqual, createChatMemorySnapshot } from '../../services/memory/chatMemoryTimeline';
import { buildActiveDatingSharedState } from '../../services/dating/buildDatingSharedState';
import { formatChatMessagePreview, formatMessagePreview } from '../app-shell/formatMessagePreview';
import { ChatSessionScreen } from './ChatSessionScreen';

type DirectChatSessionContainerProps = {
  character: Character;
  characters: Character[];
  isActive: boolean;
  onRuntimeBusyChange?: (characterId: string, busy: boolean) => void;
  chatHistory: ChatHistory;
  setChatHistory: (chatHistory: ChatHistory) => void;
  chatGroups: ChatGroup[];
  updateCharacter: (character: Character) => void;
  patchCharacter: (characterId: string, patch: Partial<Character>) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  onBack: () => void;
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
  coupleSpace?: CoupleSpaceData;
  isCoupleSpaceDismissed?: boolean;
  onViewForumPost?: (postId: string) => void;
  callHistory: CallRecord[];
  setCallHistory: (callHistory: CallRecord[]) => void;
  savedDates: DateSession[];
  collectedDates: DateSession[];
  datingResumeSignal?: number;
  setDatingRecords: (data: DatingRecordsData) => void;
  walletData?: WalletData;
  setWalletData: (data: WalletData) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; translation?: string; images?: string[]; imageCard?: import('../../types').MomentImageCard; isCollected?: boolean; sourceChatMessage?: { characterId: string; timestamp: number } }) => void;
  onOpenCharacterMoments?: () => void;
  onOpenCharacterProfile?: (characterId: string) => void;
  onStatusBarVisibilityChange?: (visible: boolean) => void;
  onAcceptCoupleSpaceInvite?: (characterId: string) => void;
  friendRequests?: FriendRequest[];
};

export function DirectChatSessionContainer({
  character,
  characters,
  isActive,
  onRuntimeBusyChange,
  chatHistory,
  setChatHistory,
  chatGroups,
  updateCharacter,
  patchCharacter,
  settings,
  setSettings,
  onBack,
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
  coupleSpace,
  isCoupleSpaceDismissed,
  onViewForumPost,
  callHistory,
  setCallHistory,
  savedDates,
  collectedDates,
  datingResumeSignal,
  setDatingRecords,
  walletData,
  setWalletData,
  onPublishMoment,
  onOpenCharacterMoments,
  onOpenCharacterProfile,
  onStatusBarVisibilityChange,
  onAcceptCoupleSpaceInvite,
  friendRequests = [],
}: DirectChatSessionContainerProps) {
  const history = chatHistory[character.id] || [];
  const savedDatesForCharacter = savedDates.filter(session => session.characterId === character.id);
  const handleRuntimeBusyChange = useCallback((busy: boolean) => {
    onRuntimeBusyChange?.(character.id, busy);
  }, [character.id, onRuntimeBusyChange]);
  const findLatestPreviewableMessage = (messages: ChatMessage[]) => [...messages]
    .reverse()
    .find((message) => !message.isSystem && !message.isRecalled) || null;
  const latestPreviewableMessage = findLatestPreviewableMessage(history);

  useEffect(() => {
    let lastMessageIndex = -1;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (!history[index]?.isSystem) {
        lastMessageIndex = index;
        break;
      }
    }
    if (lastMessageIndex < 0) {
      return;
    }
    const lastMessage = history[lastMessageIndex];

    const nextSnapshot = createChatMemorySnapshot(character);
    if (areChatMemorySnapshotsEqual(lastMessage.memorySnapshot, nextSnapshot)) {
      return;
    }

    const nextHistory = [...history];
    nextHistory[lastMessageIndex] = {
      ...lastMessage,
      memorySnapshot: nextSnapshot,
    };

    setChatHistory({
      ...chatHistory,
      [character.id]: nextHistory,
    });
  }, [
    character,
    chatHistory,
    history,
    setChatHistory,
  ]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const latestTimestamp = latestPreviewableMessage?.timestamp;
    if (!latestTimestamp || latestTimestamp === character.lastViewedMessageTimestamp) {
      return;
    }

    patchCharacter(character.id, {
      lastViewedMessageTimestamp: latestTimestamp,
    });
  }, [
    character.id,
    character.lastViewedMessageTimestamp,
    isActive,
    latestPreviewableMessage?.timestamp,
    patchCharacter,
  ]);

  return (
    <ChatSessionScreen
      key="chat-session"
      character={character}
      characters={characters}
      history={history}
      setHistory={(newHistory) => {
        setChatHistory({
          ...chatHistory,
          [character.id]: newHistory,
        });
        const latestPreviewableMessage = findLatestPreviewableMessage(newHistory);
        patchCharacter(character.id, {
          lastMessage: latestPreviewableMessage
            ? formatChatMessagePreview(latestPreviewableMessage)
            : formatMessagePreview(character.openingRemark),
          lastTime: latestPreviewableMessage?.timestamp ?? character.lastTime,
          ...(isActive && latestPreviewableMessage?.timestamp
            ? { lastViewedMessageTimestamp: latestPreviewableMessage.timestamp }
            : {}),
        });
      }}
      onUpdateCharacter={updateCharacter}
      onPatchCharacter={(patch) => patchCharacter(character.id, patch)}
      worldBook={worldBook}
      perception={perception}
      coupleSpace={coupleSpace}
      isCoupleSpaceDismissed={isCoupleSpaceDismissed}
      settings={settings}
      onUpdateSettings={setSettings}
      onBack={onBack}
      userAvatar={userAvatar}
      userName={userName}
      masks={masks}
      favorites={favorites}
      setFavorites={setFavorites}
      visualSettings={visualSettings}
      onUpdateVisualSettings={setVisualSettings}
      groups={groups}
      chatGroups={chatGroups}
      directChatHistory={chatHistory}
      onViewForumPost={onViewForumPost}
      callHistory={callHistory}
      onAddCallRecord={(record) => {
        setCallHistory([record, ...callHistory]);
      }}
      onDeleteCallRecord={(recordId) => {
        setCallHistory(callHistory.filter(record => record.id !== recordId));
      }}
      onSaveDate={(session) => {
        const nextSavedDates = [
          ...savedDates.filter(
            item => !(item.characterId === session.characterId && (item.status || 'active') === 'active'),
          ),
          session,
        ];
        setDatingRecords({
          savedDates: nextSavedDates,
          collectedDates,
        });
        patchCharacter(character.id, {
          activeDatingState: (session.status || 'active') === 'active'
            ? buildActiveDatingSharedState(session)
            : undefined,
        });
      }}
      onCollectDate={(session) => {
        setDatingRecords({
          savedDates,
          collectedDates: [...collectedDates, session],
        });
      }}
      savedDates={savedDatesForCharacter}
      datingResumeSignal={datingResumeSignal}
      walletData={walletData}
      onUpdateWalletData={setWalletData}
      onPublishMoment={onPublishMoment}
      onOpenCharacterMoments={onOpenCharacterMoments}
      onOpenCharacterProfile={() => onOpenCharacterProfile?.(character.id)}
      onStatusBarVisibilityChange={onStatusBarVisibilityChange}
      onAcceptCoupleSpaceInvite={onAcceptCoupleSpaceInvite}
      onRuntimeBusyChange={handleRuntimeBusyChange}
      friendRequests={friendRequests}
    />
  );
}
