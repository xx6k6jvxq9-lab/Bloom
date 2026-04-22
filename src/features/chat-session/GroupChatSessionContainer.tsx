import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Character, ChatGroup, ChatHistory, FavoriteMessage, PerceptionSettings, WorldBookEntry } from '../../types';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { deriveGroupShortTermSummaryFromHistory } from '../../services/group-chat/groupShortTermMemory';
import { deriveGroupTopicStateFromHistory } from '../../services/group-chat/topicState';
import { GroupChatSessionScreen } from './GroupChatSessionScreen';

type GroupChatSessionContainerProps = {
  group: ChatGroup;
  characters: Character[];
  chatGroups: ChatGroup[];
  setChatGroups: Dispatch<SetStateAction<ChatGroup[]>>;
  directChatHistory: ChatHistory;
  favorites: FavoriteMessage[];
  setFavorites: (favorites: FavoriteMessage[]) => void;
  settings: AppSettings;
  worldBooks: WorldBookEntry[];
  perception?: PerceptionSettings;
  onBack: () => void;
  userAvatar: string;
  userName: string;
};

export function GroupChatSessionContainer({
  group,
  characters,
  chatGroups,
  setChatGroups,
  directChatHistory,
  favorites,
  setFavorites,
  settings,
  worldBooks,
  perception,
  onBack,
  userAvatar,
  userName,
}: GroupChatSessionContainerProps) {
  const { getGroupMembers } = createCharacterDirectory({ characters });
  const history = group.history || [];
  const members = getGroupMembers(group);
  const inviteableCharacters = characters.filter((character) => !group.memberIds.includes(character.id));
  const availableCustomStickers = Array.from(
    new Set([
      ...(settings.sharedStickers || []),
      ...characters.flatMap((character) => character.stickers || []),
    ].filter((sticker): sticker is string => typeof sticker === 'string' && sticker.trim().length > 0)
      .map((sticker) => sticker.trim())),
  );

  return (
    <GroupChatSessionScreen
      group={group}
      members={members}
      availableCustomStickers={availableCustomStickers}
      history={history}
      favorites={favorites}
      setFavorites={setFavorites}
      setHistory={(newHistory) => {
        setChatGroups((prevGroups) =>
          prevGroups.map((item) => {
            if (item.id !== group.id) {
              return item;
            }

            const resolvedHistory = typeof newHistory === 'function'
              ? newHistory(item.history || [])
              : newHistory;
            const topicState = deriveGroupTopicStateFromHistory({
              previous: item.topicState,
              previousHistory: item.history || [],
              nextHistory: resolvedHistory,
            });

            return {
              ...item,
              history: resolvedHistory,
              topicState,
              groupShortTermSummary: deriveGroupShortTermSummaryFromHistory({
                topicState,
                nextHistory: resolvedHistory,
              }),
              lastMessage: resolvedHistory[resolvedHistory.length - 1]?.text || '',
              lastTime: resolvedHistory.length > 0
                ? resolvedHistory[resolvedHistory.length - 1].timestamp
                : (item.lastTime || Date.now()),
            };
          }),
        );
      }}
      onUpdateGroup={(patch) => {
        setChatGroups((prevGroups) =>
          prevGroups.map((item) => (item.id === group.id ? { ...item, ...patch } : item)),
        );
      }}
      onClearHistory={() => {
        setChatGroups((prevGroups) =>
          prevGroups.map(item => (item.id === group.id
            ? {
                ...item,
                history: [],
                topicState: undefined,
                groupShortTermSummary: undefined,
                lastMessage: '',
                lastTime: item.lastTime || Date.now(),
              }
            : item)),
        );
      }}
      onLeaveGroup={() => {
        setChatGroups((prevGroups) => prevGroups.filter((item) => item.id !== group.id));
        onBack();
      }}
      onBack={onBack}
      userAvatar={userAvatar}
      userName={userName}
      settings={settings}
      worldBooks={worldBooks}
      perception={perception}
      directChatHistory={directChatHistory}
      inviteableCharacters={inviteableCharacters}
    />
  );
}
