import type { AppSettings, Character, ChatGroup } from '../../types';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { GroupChatSessionScreen } from './GroupChatSessionScreen';

type GroupChatSessionContainerProps = {
  group: ChatGroup;
  characters: Character[];
  chatGroups: ChatGroup[];
  setChatGroups: (chatGroups: ChatGroup[]) => void;
  settings: AppSettings;
  onBack: () => void;
  userAvatar: string;
  userName: string;
};

export function GroupChatSessionContainer({
  group,
  characters,
  chatGroups,
  setChatGroups,
  settings,
  onBack,
  userAvatar,
  userName,
}: GroupChatSessionContainerProps) {
  const { getGroupMembers } = createCharacterDirectory({ characters });
  const history = group.history || [];
  const members = getGroupMembers(group);

  return (
    <GroupChatSessionScreen
      group={group}
      members={members}
      history={history}
      setHistory={(newHistory) => {
        setChatGroups(
          chatGroups.map(item => item.id === group.id
            ? {
                ...item,
                history: newHistory,
                lastMessage: newHistory[newHistory.length - 1]?.text,
                lastTime: Date.now(),
              }
            : item)
        );
      }}
      onBack={onBack}
      userAvatar={userAvatar}
      userName={userName}
      settings={settings}
    />
  );
}
