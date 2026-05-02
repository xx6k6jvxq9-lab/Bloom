import type {
  AppSettings,
  CallRecord,
  ChatGroup,
  ChatHistory,
  Character,
  CoupleSpaceData,
  DateSession,
  FavoriteMessage,
  Mask,
  PerceptionSettings,
  VisualSettings,
  WalletData,
  WorldBookEntry,
} from '../../types';
import type { Dispatch, SetStateAction } from 'react';
import type { DatingRecordsData } from '../persistence/datingRecordsStore';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
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
  setChatHistory: (chatHistory: ChatHistory) => void;
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
  coupleSpace?: CoupleSpaceData;
  callHistory: CallRecord[];
  setCallHistory: (callHistory: CallRecord[]) => void;
  savedDates: DateSession[];
  collectedDates: DateSession[];
  setDatingRecords: (data: DatingRecordsData) => void;
  walletData?: WalletData;
  setWalletData: (data: WalletData) => void;
  updateCharacter: (updatedCharacter: Character) => void;
  patchCharacter: (characterId: string, patch: Partial<Character>) => void;
  onBackToChat: () => void;
  onViewForumPost?: (postId: string) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; images?: string[]; imageCard?: import('../../types').MomentImageCard; isCollected?: boolean; sourceChatMessage?: { characterId: string; timestamp: number } }) => void;
  onOpenCharacterMoments?: () => void;
  onStatusBarVisibilityChange?: (visible: boolean) => void;
  onAcceptCoupleSpaceInvite?: (characterId: string) => void;
};

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
  coupleSpace,
  callHistory,
  setCallHistory,
  savedDates,
  collectedDates,
  setDatingRecords,
  walletData,
  setWalletData,
  updateCharacter,
  patchCharacter,
  onBackToChat,
  onViewForumPost,
  onPublishMoment,
  onOpenCharacterMoments,
  onStatusBarVisibilityChange,
  onAcceptCoupleSpaceInvite,
}: ChatSessionMountProps) {
  const { getCharacterById } = createCharacterDirectory({ characters });
  const selectedCharacter = getCharacterById(selectedCharacterId);
  const selectedGroup = selectedGroupId
    ? chatGroups.find(group => group.id === selectedGroupId) || null
    : null;

  return (
    <>
      {activeApp === 'chat-session' && selectedCharacter && (
        <DirectChatSessionContainer
          character={selectedCharacter}
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          chatGroups={chatGroups}
          updateCharacter={updateCharacter}
          patchCharacter={patchCharacter}
          worldBook={worldBook}
          perception={perception}
          coupleSpace={coupleSpace}
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
          setDatingRecords={setDatingRecords}
          walletData={walletData}
          setWalletData={setWalletData}
          onPublishMoment={onPublishMoment}
          onOpenCharacterMoments={onOpenCharacterMoments}
          onStatusBarVisibilityChange={onStatusBarVisibilityChange}
          onAcceptCoupleSpaceInvite={onAcceptCoupleSpaceInvite}
        />
      )}

      {activeApp === 'group-chat-session' && selectedGroup && (
        <GroupChatSessionContainer
          key={selectedGroup.id}
          group={selectedGroup}
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
        />
      )}
    </>
  );
}
