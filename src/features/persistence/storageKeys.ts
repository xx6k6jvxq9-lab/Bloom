export const STORAGE_KEYS = {
  appData: 'ai_phone_app_data',
  settings: 'ai_phone_settings',
  migrationMeta: 'persistence:migration-meta',
  characters: 'persistence:characters',
  characterMemory: 'persistence:character-memory',
  memoryRecords: 'persistence:memory-records',
  visualSettings: 'persistence:visual-settings',
  perception: 'persistence:perception',
  userProfile: 'persistence:user-profile',
  moments: 'persistence:moments',
  forumData: 'persistence:forum-data',
  coupleSpace: 'persistence:couple-space',
  chatOrganization: 'persistence:chat-organization',
  meData: 'persistence:me-data',
  musicData: 'persistence:music-data',
  mallData: 'persistence:mall-data',
  walletData: 'persistence:wallet-data',
  friendRequests: 'persistence:friend-requests',
  callHistory: 'persistence:call-history',
  datingRecords: 'persistence:dating-records',
  chatHistory: 'persistence:chat-history',
  wechatRoleBindings: 'persistence:wechat-role-bindings',
  wechatBindSessions: 'persistence:wechat-bind-sessions',
  wechatConversationState: 'persistence:wechat-conversation-state',
} as const;

export const PERSISTENCE_DB_NAME = 'app-persistence-db';
export const PERSISTENCE_DB_VERSION = 5;
export const PERSISTENCE_ASSETS_STORE = 'assets';
export const PERSISTENCE_JSON_STORE = 'json';
