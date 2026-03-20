import type { ChatGroup, ChatHistory } from '../../types';
import { usePersistedChatHistoryBridge } from '../persistence/usePersistedChatHistoryBridge';

export function useChatSessionPersistenceBridge(
  directHistory: ChatHistory,
  chatGroups: ChatGroup[],
  setChatData: (data: { directHistory: ChatHistory; chatGroups: ChatGroup[] }) => void,
): void {
  usePersistedChatHistoryBridge(directHistory, chatGroups, setChatData);
}
