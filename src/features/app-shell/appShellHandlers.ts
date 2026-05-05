import { startTransition } from 'react';
import type { Character } from '../../types';
import { preloadPanelForApp } from './lazyPanels';

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
  openForumApp: (postId?: string | null) => void;
  setActiveApp: (app: AppScreen) => void;
  setActiveTab: (tab: AppTab) => void;
  setSelectedCharacterId: (characterId: string) => void;
};

let latestNavigationToken = 0;

export async function navigateToAppWithTransition(
  app: AppScreen,
  setActiveApp: (app: AppScreen) => void,
) {
  const navigationToken = ++latestNavigationToken;
  const preloadTask = preloadPanelForApp(app);

  if (preloadTask) {
    try {
      await preloadTask;
    } catch (error) {
      console.warn('[app-shell] Panel preload before navigation failed', error);
    }
  }

  if (navigationToken !== latestNavigationToken) {
    return;
  }

  startTransition(() => {
    setActiveApp(app);
  });
}

export const createAppShellHandlers = ({
  handleUpsertCharacter,
  openForumApp,
  setActiveApp,
  setActiveTab,
  setSelectedCharacterId,
}: CreateAppShellHandlersParams) => ({
  handleOpenChat(characterId: string) {
    setSelectedCharacterId(characterId);
    navigateToAppWithTransition('chat-session', setActiveApp);
  },

  handleAddCharacter(character: Character) {
    handleUpsertCharacter(character);
    navigateToAppWithTransition('chat', setActiveApp);
    setActiveTab('chat');
  },

  handleOpenApp(app: AppScreen) {
    if (app === 'forum') {
      openForumApp();
      return;
    }
    navigateToAppWithTransition(app, setActiveApp);
    if (app === 'chat') {
      setActiveTab('chat');
    }
  },
});
