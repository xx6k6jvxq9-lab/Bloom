import type { AppData } from '../../types';
import {
  DEFAULT_DESKTOP_WALLPAPER,
  DEFAULT_HOME_ICONS,
  DEFAULT_HOME_WIDGETS,
  DEFAULT_NAV_BAR_BACKGROUND,
  DEFAULT_ZHOU_JIBAI_AVATAR,
} from './defaultAppConstants';
import { DEFAULT_CHARACTERS } from './defaultCharacters';
import { DEFAULT_USER } from './defaultSettings';
import { DEFAULT_MOMENTS, sanitizePersistedCharacters as sanitizePersistedCharactersFromStore } from '../persistence/appDataSanitizers';
import { createDefaultCoupleSpaceData, createDefaultCoupleSpaceState } from '../persistence/coupleSpaceStore';

export function createDefaultAppData(): AppData {
  return {
    characters: sanitizePersistedCharactersFromStore(
      DEFAULT_CHARACTERS,
      DEFAULT_CHARACTERS,
      DEFAULT_ZHOU_JIBAI_AVATAR,
    ),
    chatHistory: {},
    userProfile: DEFAULT_USER,
    masks: [],
    favorites: [],
    friendRequests: [],
    chatGroups: [],
    callHistory: [],
    visualSettings: {
      globalBackground: DEFAULT_DESKTOP_WALLPAPER,
      chatOpacity: 1,
      themeTypography: {
        importedFonts: [],
        selectedFontId: '',
        fontPriority: 'lock-imported',
        textColor: '#18181b',
        previewText: '晚风轻轻吹过，气泡、标题和正文都应该有自己的气质。',
      },
      desktopIcons: DEFAULT_HOME_ICONS,
      widgets: DEFAULT_HOME_WIDGETS,
      navBar: {
        show: true,
        style: 'default',
        shape: 'pill',
        showMultipleAvatars: false,
        backgroundImage: DEFAULT_NAV_BAR_BACKGROUND,
        statusBarPlacement: 'top',
      },
      desktop: {
        iconSize: 56,
        iconBorderRadius: 14,
        gridColumns: 4,
        gridGap: 16,
      },
      chat: {
        background: '',
        avatarSize: 40,
        avatarBorderRadius: 20,
        avatarBorderColor: '#e4e4e7',
        avatarBorderWidth: 0,
        messageBorderRadius: 16,
        messageBackgroundColorUser: '#3b82f6',
        messageBackgroundColorModel: '#ffffff',
        messageSpacing: 16,
      },
      dynamics: {
        background: '',
        cardStyle: 'flat',
        cardBorderRadius: 24,
        cardOpacity: 1,
      },
      globalCss: '',
      themeScopedCss: {},
    },
    groups: ['家人', '朋友', '同事', '星标'],
    moments: DEFAULT_MOMENTS,
    worldBooks: [],
    coupleSpace: createDefaultCoupleSpaceData(),
    coupleSpaceState: createDefaultCoupleSpaceState(),
    musicData: {
      currentSong: null,
      isPlaying: false,
      progress: 0,
      volume: 80,
      playlists: [],
      likedSongs: [],
      collectedSongs: [],
      history: [],
      recentlyPlayed: [],
      togetherWith: null,
      togetherStartTime: null,
      chatHistory: [],
      queue: [],
    },
  };
}
