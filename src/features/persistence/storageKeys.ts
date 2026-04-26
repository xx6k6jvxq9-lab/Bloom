export const STORAGE_KEYS = {
  appData: 'ai_phone_app_data',
  settings: 'ai_phone_settings',
  migrationMeta: 'persistence:migration-meta',
  characters: 'persistence:characters',
  visualSettings: 'persistence:visual-settings',
  userProfile: 'persistence:user-profile',
  moments: 'persistence:moments',
  forumData: 'persistence:forum-data',
  coupleSpace: 'persistence:couple-space',
  chatOrganization: 'persistence:chat-organization',
  meData: 'persistence:me-data',
  musicData: 'persistence:music-data',
  walletData: 'persistence:wallet-data',
  friendRequests: 'persistence:friend-requests',
  callHistory: 'persistence:call-history',
  datingRecords: 'persistence:dating-records',
  chatHistory: 'persistence:chat-history',
  wechatRoleBindings: 'persistence:wechat-role-bindings',
  wechatBindSessions: 'persistence:wechat-bind-sessions',
} as const;

export const PERSISTENCE_DB_NAME = 'app-persistence-db';
export const PERSISTENCE_DB_VERSION = 2;
export const PERSISTENCE_ASSETS_STORE = 'assets';
export const PERSISTENCE_JSON_STORE = 'json';
