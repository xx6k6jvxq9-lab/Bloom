export type WechatBridgeChannel = 'wechat-clawbot';

export type WechatBindingStatus = 'pending' | 'bound' | 'expired' | 'disabled';

export type WechatRoleBinding = {
  id: string;
  channel: WechatBridgeChannel;
  conversationId: string;
  bloomUserId: string;
  characterId: string;
  enabled: boolean;
  wechatIdentity?: string;
  channelAccountId?: string;
  channelPeerId?: string;
  openClawPairingId?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: number;
  updatedAt: number;
};

export type WechatBindSession = {
  bindTaskId: string;
  token: string;
  channel: WechatBridgeChannel;
  bloomUserId: string;
  characterId: string;
  characterName?: string;
  characterAvatarUrl?: string;
  qrText: string;
  bindCallbackUrl?: string;
  openClawConnectUrl?: string;
  status: WechatBindingStatus;
  createdAt: number;
  expiresAt: number;
  connectedAt?: number;
  wechatIdentity?: string;
  channelAccountId?: string;
  channelPeerId?: string;
  openClawPairingId?: string;
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

export type WechatOutgoingBridgeMessage = {
  id: string;
  channel: WechatBridgeChannel;
  characterId: string;
  conversationId: string;
  text: string;
  createdAt: number;
  replyToMessageId?: string;
  characterName?: string;
  avatarUrl?: string;
};

export type WechatBindingsOverview = {
  enabledCount: number;
  bindings: WechatRoleBinding[];
};
