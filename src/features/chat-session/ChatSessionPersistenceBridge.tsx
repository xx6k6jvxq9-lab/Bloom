import type { ChatGroup, ChatHistory } from '../../types';
import { useChatSessionPersistenceBridge } from './useChatSessionPersistenceBridge';

type ChatSessionPersistenceBridgeProps = {
  directHistory: ChatHistory;
  chatGroups: ChatGroup[];
  setChatData: (data: { directHistory: ChatHistory; chatGroups: ChatGroup[] }) => void;
};

export function ChatSessionPersistenceBridge({
  directHistory,
  chatGroups,
  setChatData,
}: ChatSessionPersistenceBridgeProps) {
  useChatSessionPersistenceBridge(directHistory, chatGroups, setChatData);
  return null;
}
