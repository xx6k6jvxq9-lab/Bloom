export type WechatBridgeChannel = 'wechat-clawbot';

export type WechatBindingStatus = 'pending' | 'bound' | 'expired' | 'disabled';

export type WechatRoleBinding = {
  id: string;
  channel: WechatBridgeChannel;
  conversationId: string;
  characterId: string;
  enabled: boolean;
  displayName?: string;
  avatarUrl?: string;
  createdAt: number;
  updatedAt: number;
};

export type WechatBindSession = {
  token: string;
  channel: WechatBridgeChannel;
  characterId: string;
  qrText: string;
  status: WechatBindingStatus;
  createdAt: number;
  expiresAt: number;
  boundConversationId?: string;
  boundDisplayName?: string;
};

export type WechatIncomingMessage = {
  channel: WechatBridgeChannel;
  conversationId: string;
  text: string;
  senderDisplayName?: string;
  timestamp: number;
};

export type WechatIncomingBridgeMessage = {
  id: string;
  channel: WechatBridgeChannel;
  characterId: string;
  conversationId: string;
  text: string;
  senderDisplayName?: string;
  createdAt: number;
};

export type WechatBindingsOverview = {
  enabledCount: number;
  bindings: WechatRoleBinding[];
};
