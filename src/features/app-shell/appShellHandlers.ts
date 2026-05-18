import { startTransition } from 'react';
import type { Character } from '../../types';
import { preloadAppScreen } from './lazyApps';

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
  | 'mall'
  | 'group-chat-session';

export type AppTab = 'chat' | 'contacts' | 'moments' | 'me';

type CreateAppShellHandlersParams = {
  handleUpsertCharacter: (character: Character) => void;
  openCoupleSpaceApp: () => void;
  openForumApp: (postId?: string | null) => void;
  setActiveApp: (app: AppScreen) => void;
  setActiveTab: (tab: AppTab) => void;
  setSelectedCharacterId: (characterId: string) => void;
};

let latestNavigationToken = 0;

type NavigateToAppOptions = {
  awaitPreload?: boolean;
};

export async function navigateToAppWithTransition(
  app: AppScreen,
  setActiveApp: (app: AppScreen) => void,
  options: NavigateToAppOptions = {},
) {
  const { awaitPreload = false } = options;
  const navigationToken = ++latestNavigationToken;
  const preloadTask = preloadAppScreen(app);

  if (!awaitPreload) {
    startTransition(() => {
      setActiveApp(app);
    });

    if (preloadTask) {
      void preloadTask.catch((error) => {
        console.warn('[app-shell] Background preload failed during navigation', error);
      });
    }

    return;
  }

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
  openCoupleSpaceApp,
  openForumApp,
  setActiveApp,
  setActiveTab,
  setSelectedCharacterId,
}: CreateAppShellHandlersParams) => ({
  handleOpenChat(characterId: string) {
    setSelectedCharacterId(characterId);
    void navigateToAppWithTransition('chat-session', setActiveApp, { awaitPreload: true });
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
    if (app === 'couple-space') {
      openCoupleSpaceApp();
      return;
    }
    navigateToAppWithTransition(app, setActiveApp);
    if (app === 'chat') {
      setActiveTab('chat');
    }
  },
});
