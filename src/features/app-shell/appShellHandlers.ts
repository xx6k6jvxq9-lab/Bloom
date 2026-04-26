import type { Character } from '../../types';

export type AppScreen =
  | 'home'
  | 'chat'
  | 'settings'
  | 'chat-session'
  | 'add-character'
  | 'dream'
  | 'character-profile'
  | 'character-moments'
  | 'worldbook'
  | 'monitor'
  | 'customization'
  | 'couple-space'
  | 'perception'
  | 'music'
  | 'forum'
  | 'wallet'
  | 'group-chat-session';

export type AppTab = 'chat' | 'contacts' | 'moments' | 'me';

type CreateAppShellHandlersParams = {
  handleUpsertCharacter: (character: Character) => void;
  setActiveApp: (app: AppScreen) => void;
  setActiveTab: (tab: AppTab) => void;
  setSelectedCharacterId: (characterId: string) => void;
};

export const createAppShellHandlers = ({
  handleUpsertCharacter,
  setActiveApp,
  setActiveTab,
  setSelectedCharacterId,
}: CreateAppShellHandlersParams) => ({
  handleOpenChat(characterId: string) {
    setSelectedCharacterId(characterId);
    setActiveApp('chat-session');
  },

  handleAddCharacter(character: Character) {
    handleUpsertCharacter(character);
    setActiveApp('chat');
    setActiveTab('chat');
  },

  handleOpenApp(app: AppScreen) {
    setActiveApp(app);
    if (app === 'chat') {
      setActiveTab('chat');
    }
  },
});
