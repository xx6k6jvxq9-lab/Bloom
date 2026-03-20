import type {
  AppSettings,
  CallRecord,
  Character,
  ChatHistory,
  DateSession,
  FavoriteMessage,
  Mask,
  PerceptionSettings,
  VisualSettings,
  WalletData,
  WorldBookEntry,
} from '../../types';
import type { DatingRecordsData } from '../persistence/datingRecordsStore';
import { usePersistedCallHistoryBridge } from '../persistence/usePersistedCallHistoryBridge';
import { usePersistedDatingRecordsBridge } from '../persistence/usePersistedDatingRecordsBridge';
import { ChatSessionScreen } from './ChatSessionScreen';

type DirectChatSessionContainerProps = {
  character: Character;
  chatHistory: ChatHistory;
  setChatHistory: (chatHistory: ChatHistory) => void;
  updateCharacter: (character: Character) => void;
  settings: AppSettings;
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
  onViewForumPost?: (postId: string) => void;
  callHistory: CallRecord[];
  setCallHistory: (callHistory: CallRecord[]) => void;
  savedDates: DateSession[];
  collectedDates: DateSession[];
  setDatingRecords: (data: DatingRecordsData) => void;
  walletData?: WalletData;
  setWalletData: (data: WalletData) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; images?: string[] }) => void;
  onOpenCharacterMoments?: () => void;
  onStatusBarVisibilityChange?: (visible: boolean) => void;
};

export function DirectChatSessionContainer({
  character,
  chatHistory,
  setChatHistory,
  updateCharacter,
  settings,
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
  onViewForumPost,
  callHistory,
  setCallHistory,
  savedDates,
  collectedDates,
  setDatingRecords,
  walletData,
  setWalletData,
  onPublishMoment,
  onOpenCharacterMoments,
  onStatusBarVisibilityChange,
}: DirectChatSessionContainerProps) {
  usePersistedCallHistoryBridge(callHistory, setCallHistory);
  usePersistedDatingRecordsBridge(savedDates, collectedDates, setDatingRecords);

  const history = chatHistory[character.id] || [];
  const savedDatesForCharacter = savedDates.filter(session => session.characterId === character.id);

  return (
    <ChatSessionScreen
      key="chat-session"
      character={character}
      history={history}
      setHistory={(newHistory) => {
        setChatHistory({
          ...chatHistory,
          [character.id]: newHistory,
        });
        updateCharacter({
          ...character,
          lastMessage: newHistory[newHistory.length - 1]?.text || character.openingRemark,
          lastTime: Date.now(),
        });
      }}
      onUpdateCharacter={updateCharacter}
      worldBook={worldBook}
      perception={perception}
      settings={settings}
      onBack={onBack}
      userAvatar={userAvatar}
      userName={userName}
      masks={masks}
      favorites={favorites}
      setFavorites={setFavorites}
      visualSettings={visualSettings}
      onUpdateVisualSettings={setVisualSettings}
      groups={groups}
      onViewForumPost={onViewForumPost}
      callHistory={callHistory}
      onAddCallRecord={(record) => {
        setCallHistory([record, ...callHistory]);
      }}
      onDeleteCallRecord={(recordId) => {
        setCallHistory(callHistory.filter(record => record.id !== recordId));
      }}
      onSaveDate={(session) => {
        setDatingRecords({
          savedDates: [
            ...savedDates.filter(item => item.characterId !== session.characterId),
            session,
          ],
          collectedDates,
        });
      }}
      onCollectDate={(session) => {
        setDatingRecords({
          savedDates,
          collectedDates: [...collectedDates, session],
        });
      }}
      savedDates={savedDatesForCharacter}
      walletData={walletData}
      onUpdateWalletData={setWalletData}
      onPublishMoment={onPublishMoment}
      onOpenCharacterMoments={onOpenCharacterMoments}
      onStatusBarVisibilityChange={onStatusBarVisibilityChange}
    />
  );
}
