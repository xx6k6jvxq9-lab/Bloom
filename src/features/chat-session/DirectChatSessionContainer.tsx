import type {
  AppSettings,
  CallRecord,
  Character,
  ChatGroup,
  ChatHistory,
  CoupleSpaceData,
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
  onViewForumPost?: (postId: string) => void;
  callHistory: CallRecord[];
  setCallHistory: (callHistory: CallRecord[]) => void;
  savedDates: DateSession[];
  collectedDates: DateSession[];
  setDatingRecords: (data: DatingRecordsData) => void;
  walletData?: WalletData;
  setWalletData: (data: WalletData) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; images?: string[]; imageCard?: import('../../types').MomentImageCard }) => void;
  onOpenCharacterMoments?: () => void;
  onStatusBarVisibilityChange?: (visible: boolean) => void;
  onAcceptCoupleSpaceInvite?: (characterId: string) => void;
};

export function DirectChatSessionContainer({
  character,
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
  onAcceptCoupleSpaceInvite,
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
        patchCharacter(character.id, {
          lastMessage: newHistory[newHistory.length - 1]?.text || character.openingRemark,
          lastTime: Date.now(),
        });
      }}
      onUpdateCharacter={updateCharacter}
      onPatchCharacter={(patch) => patchCharacter(character.id, patch)}
      worldBook={worldBook}
      perception={perception}
      coupleSpace={coupleSpace}
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
      onAcceptCoupleSpaceInvite={onAcceptCoupleSpaceInvite}
    />
  );
}
