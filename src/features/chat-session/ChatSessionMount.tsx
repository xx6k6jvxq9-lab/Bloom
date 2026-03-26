import type {
  AppSettings,
  CallRecord,
  ChatGroup,
  ChatHistory,
  Character,
  DateSession,
  FavoriteMessage,
  Mask,
  PerceptionSettings,
  VisualSettings,
  WalletData,
  WorldBookEntry,
} from '../../types';
import type { DatingRecordsData } from '../persistence/datingRecordsStore';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { ChatSessionPersistenceBridge } from './ChatSessionPersistenceBridge';
import { DirectChatSessionContainer } from './DirectChatSessionContainer';
import { GroupChatSessionContainer } from './GroupChatSessionContainer';

type ChatSessionMountProps = {
  activeApp: string;
  selectedCharacterId?: string | null;
  selectedGroupId?: string | null;
  characters: Character[];
  chatGroups: ChatGroup[];
  setChatGroups: (chatGroups: ChatGroup[]) => void;
  chatHistory: ChatHistory;
  setChatHistory: (chatHistory: ChatHistory) => void;
  settings: AppSettings;
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
  onPublishMoment?: (moment: { authorId: string; content: string; images?: string[] }) => void;
  onOpenCharacterMoments?: () => void;
  onStatusBarVisibilityChange?: (visible: boolean) => void;
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
}: ChatSessionMountProps) {
  const { getCharacterById } = createCharacterDirectory({ characters });
  const selectedCharacter = getCharacterById(selectedCharacterId);
  const selectedGroup = selectedGroupId
    ? chatGroups.find(group => group.id === selectedGroupId) || null
    : null;

  return (
    <>
      <ChatSessionPersistenceBridge
        directHistory={chatHistory}
        chatGroups={chatGroups}
        setChatData={({ directHistory, chatGroups: nextChatGroups }) => {
          setChatHistory(directHistory);
          setChatGroups(nextChatGroups);
        }}
      />

      {activeApp === 'chat-session' && selectedCharacter && (
        <DirectChatSessionContainer
          character={selectedCharacter}
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          updateCharacter={updateCharacter}
          patchCharacter={patchCharacter}
          worldBook={worldBook}
          perception={perception}
          settings={settings}
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
        />
      )}

      {activeApp === 'group-chat-session' && selectedGroup && (
        <GroupChatSessionContainer
          group={selectedGroup}
          characters={characters}
          chatGroups={chatGroups}
          setChatGroups={setChatGroups}
          onBack={onBackToChat}
          userAvatar={userAvatar}
          userName={userName}
          settings={settings}
        />
      )}
    </>
  );
}
