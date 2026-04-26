import { promises as fs } from "fs";
import path from "path";

export type WechatBridgeChannel = "wechat-clawbot";
export type WechatBindingStatus = "pending" | "bound" | "expired" | "disabled";

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

type WechatBridgeState = {
  sessions: WechatBindSession[];
  bindings: WechatRoleBinding[];
  pendingMessages: WechatIncomingBridgeMessage[];
  pendingOutgoingMessages: WechatOutgoingBridgeMessage[];
};

export type WechatBindingsOverview = {
  enabledCount: number;
  bindings: WechatRoleBinding[];
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

const STORE_PATH = path.resolve(process.cwd(), ".codex-wechat-bridge.json");
const BIND_SESSION_LIFETIME_MS = 1000 * 60 * 10;

function buildBloomBindCallbackUrl(appOrigin: string, token: string, characterId: string, bloomUserId: string): string {
  return `${appOrigin.replace(/\/$/, "")}/wechat/bind?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(characterId)}&bloomUserId=${encodeURIComponent(bloomUserId)}`;
}

function buildWechatConnectUrl(payload: {
  appOrigin: string;
  token: string;
  bloomUserId: string;
  characterId: string;
}): { qrText: string; bindCallbackUrl: string; openClawConnectUrl?: string } {
  const bindCallbackUrl = buildBloomBindCallbackUrl(
    payload.appOrigin,
    payload.token,
    payload.characterId,
    payload.bloomUserId,
  );
  const configuredConnectUrl = process.env.OPENCLAW_WECHAT_CONNECT_URL?.trim() || '';

  if (!configuredConnectUrl) {
    return {
      qrText: bindCallbackUrl,
      bindCallbackUrl,
    };
  }

  try {
    const url = new URL(configuredConnectUrl);
    url.searchParams.set('token', payload.token);
    url.searchParams.set('bloomUserId', payload.bloomUserId);
    url.searchParams.set('characterId', payload.characterId);
    url.searchParams.set('callbackUrl', bindCallbackUrl);
    return {
      qrText: url.toString(),
      bindCallbackUrl,
      openClawConnectUrl: configuredConnectUrl,
    };
  } catch (error) {
    console.error('[wechatBridgeStore] Invalid OPENCLAW_WECHAT_CONNECT_URL, falling back to Bloom bind page', error);
    return {
      qrText: bindCallbackUrl,
      bindCallbackUrl,
    };
  }
}

function createToken() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `wxbind_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getEmptyState(): WechatBridgeState {
  return {
    sessions: [],
    bindings: [],
    pendingMessages: [],
    pendingOutgoingMessages: [],
  };
}

async function readState(): Promise<WechatBridgeState> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<WechatBridgeState>;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      bindings: Array.isArray(parsed.bindings) ? parsed.bindings : [],
      pendingMessages: Array.isArray(parsed.pendingMessages) ? parsed.pendingMessages : [],
      pendingOutgoingMessages: Array.isArray(parsed.pendingOutgoingMessages) ? parsed.pendingOutgoingMessages : [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return getEmptyState();
    }
    throw error;
  }
}

async function writeState(state: WechatBridgeState): Promise<void> {
  await fs.writeFile(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function normalizeSessions(sessions: WechatBindSession[]): WechatBindSession[] {
  const now = Date.now();
  return sessions.map((session) => {
    if (session.status === "pending" && session.expiresAt <= now) {
      return {
        ...session,
        status: "expired",
      };
    }
    return session;
  });
}

export async function createWechatBindSession(params: {
  characterId: string;
  bloomUserId: string;
  characterName?: string;
  characterAvatarUrl?: string;
  appOrigin: string;
}): Promise<WechatBindSession> {
  const state = await readState();
  const bindTaskId = createToken();
  const token = createToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + BIND_SESSION_LIFETIME_MS;
  const connectTarget = buildWechatConnectUrl({
    appOrigin: params.appOrigin,
    token,
    bloomUserId: params.bloomUserId,
    characterId: params.characterId,
  });
  const session: WechatBindSession = {
    bindTaskId,
    token,
    channel: "wechat-clawbot",
    bloomUserId: params.bloomUserId,
    characterId: params.characterId,
    characterName: params.characterName,
    characterAvatarUrl: params.characterAvatarUrl,
    qrText: connectTarget.qrText,
    bindCallbackUrl: connectTarget.bindCallbackUrl,
    openClawConnectUrl: connectTarget.openClawConnectUrl,
    status: "pending",
    createdAt,
    expiresAt,
  };

  state.sessions = [
    session,
    ...normalizeSessions(state.sessions).filter(
      (item) => !(item.characterId === params.characterId && item.bloomUserId === params.bloomUserId),
    ),
  ];
  await writeState(state);
  return session;
}

export async function getWechatBindSessionByCharacterId(
  characterId: string,
  bloomUserId?: string,
): Promise<WechatBindSession | null> {
  const state = await readState();
  const sessions = normalizeSessions(state.sessions);
  const target = sessions.find(
    (session) => session.characterId === characterId && (!bloomUserId || session.bloomUserId === bloomUserId),
  ) || null;
  if (JSON.stringify(sessions) !== JSON.stringify(state.sessions)) {
    state.sessions = sessions;
    await writeState(state);
  }
  return target;
}

export async function getWechatBindSessionByToken(token: string): Promise<WechatBindSession | null> {
  const state = await readState();
  const sessions = normalizeSessions(state.sessions);
  const target = sessions.find((session) => session.token === token) || null;
  if (JSON.stringify(sessions) !== JSON.stringify(state.sessions)) {
    state.sessions = sessions;
    await writeState(state);
  }
  return target;
}

export async function getWechatBindingByCharacterId(characterId: string, bloomUserId?: string): Promise<WechatRoleBinding | null> {
  const state = await readState();
  return state.bindings.find(
    (binding) => binding.characterId === characterId && (!bloomUserId || binding.bloomUserId === bloomUserId) && binding.enabled,
  ) || null;
}

export async function getWechatBindingsOverview(): Promise<WechatBindingsOverview> {
  const state = await readState();
  const bindings = state.bindings.filter((binding) => binding.enabled);
  return {
    enabledCount: bindings.length,
    bindings,
  };
}

export async function markWechatBindSessionBound(
  token: string,
  payload: {
    conversationId?: string;
    wechatIdentity?: string;
    channelAccountId?: string;
    channelPeerId?: string;
    openClawPairingId?: string;
    displayName?: string;
    avatarUrl?: string;
  },
): Promise<{ session: WechatBindSession; binding: WechatRoleBinding } | null> {
  const state = await readState();
  const sessions = normalizeSessions(state.sessions);
  const target = sessions.find((session) => session.token === token);
  if (!target) return null;

  const resolvedConversationId = payload.conversationId?.trim()
    || payload.channelPeerId?.trim()
    || payload.wechatIdentity?.trim();
  if (!resolvedConversationId) {
    return null;
  }

  const session: WechatBindSession = {
    ...target,
    status: "bound",
    connectedAt: Date.now(),
    wechatIdentity: payload.wechatIdentity?.trim() || target.wechatIdentity,
    channelAccountId: payload.channelAccountId?.trim() || target.channelAccountId,
    channelPeerId: payload.channelPeerId?.trim() || target.channelPeerId,
    openClawPairingId: payload.openClawPairingId?.trim() || target.openClawPairingId,
    boundConversationId: resolvedConversationId,
    boundDisplayName: payload.displayName,
  };

  const binding: WechatRoleBinding = {
    id: `wxbind_${target.bloomUserId}_${target.characterId}`,
    channel: "wechat-clawbot",
    conversationId: resolvedConversationId,
    bloomUserId: target.bloomUserId,
    characterId: target.characterId,
    enabled: true,
    wechatIdentity: payload.wechatIdentity?.trim(),
    channelAccountId: payload.channelAccountId?.trim(),
    channelPeerId: payload.channelPeerId?.trim(),
    openClawPairingId: payload.openClawPairingId?.trim(),
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl,
    createdAt: target.createdAt,
    updatedAt: Date.now(),
  };

  state.sessions = sessions.map((item) => (item.token === token ? session : item));
  state.bindings = [
    binding,
    ...state.bindings.filter(
      (item) =>
        item.id !== binding.id
        && !(item.bloomUserId === binding.bloomUserId && item.characterId === binding.characterId)
        && item.conversationId !== binding.conversationId,
    ),
  ];
  await writeState(state);
  return { session, binding };
}

export async function disableWechatBindingByCharacterId(characterId: string, bloomUserId?: string): Promise<WechatRoleBinding | null> {
  const state = await readState();
  const target = state.bindings.find(
    (binding) => binding.characterId === characterId && (!bloomUserId || binding.bloomUserId === bloomUserId) && binding.enabled,
  );
  if (!target) return null;

  const nextBinding: WechatRoleBinding = {
    ...target,
    enabled: false,
    updatedAt: Date.now(),
  };

  state.bindings = state.bindings.map((binding) => (binding.id === target.id ? nextBinding : binding));
  await writeState(state);
  return nextBinding;
}

export async function enqueueWechatIncomingMessage(payload: {
  conversationId?: string;
  wechatIdentity?: string;
  channelPeerId?: string;
  channelAccountId?: string;
  text: string;
  senderDisplayName?: string;
}): Promise<WechatIncomingBridgeMessage | null> {
  const state = await readState();
  const resolvedConversationId = payload.conversationId?.trim()
    || payload.channelPeerId?.trim()
    || payload.wechatIdentity?.trim();
  const binding = state.bindings.find((item) => {
    if (!item.enabled) return false;
    return (
      (!!payload.conversationId?.trim() && item.conversationId === payload.conversationId.trim())
      || (!!payload.wechatIdentity?.trim() && item.wechatIdentity === payload.wechatIdentity.trim())
      || (!!payload.channelPeerId?.trim() && item.channelPeerId === payload.channelPeerId.trim())
      || (!!payload.channelAccountId?.trim() && item.channelAccountId === payload.channelAccountId.trim())
    );
  });
  if (!binding) return null;
  if (!resolvedConversationId) return null;

  const message: WechatIncomingBridgeMessage = {
    id: createToken(),
    channel: "wechat-clawbot",
    characterId: binding.characterId,
    conversationId: resolvedConversationId,
    text: payload.text,
    senderDisplayName: payload.senderDisplayName,
    createdAt: Date.now(),
  };

  state.pendingMessages = [...state.pendingMessages, message];
  await writeState(state);
  return message;
}

export async function pullWechatIncomingMessages(): Promise<WechatIncomingBridgeMessage[]> {
  const state = await readState();
  const messages = [...state.pendingMessages].sort((left, right) => left.createdAt - right.createdAt);
  if (!messages.length) {
    return messages;
  }
  state.pendingMessages = [];
  await writeState(state);
  return messages;
}

export async function enqueueWechatOutgoingMessage(payload: {
  conversationId: string;
  characterId: string;
  text: string;
  replyToMessageId?: string;
  characterName?: string;
  avatarUrl?: string;
}): Promise<WechatOutgoingBridgeMessage | null> {
  const state = await readState();
  const binding = state.bindings.find(
    (item) =>
      item.conversationId === payload.conversationId
      && item.characterId === payload.characterId
      && item.enabled,
  );
  if (!binding) return null;

  const message: WechatOutgoingBridgeMessage = {
    id: createToken(),
    channel: 'wechat-clawbot',
    characterId: payload.characterId,
    conversationId: payload.conversationId,
    text: payload.text,
    createdAt: Date.now(),
    replyToMessageId: payload.replyToMessageId,
    characterName: payload.characterName,
    avatarUrl: payload.avatarUrl,
  };

  state.pendingOutgoingMessages = [...state.pendingOutgoingMessages, message];
  await writeState(state);
  return message;
}

export async function pullWechatOutgoingMessages(): Promise<WechatOutgoingBridgeMessage[]> {
  const state = await readState();
  const messages = [...state.pendingOutgoingMessages].sort((left, right) => left.createdAt - right.createdAt);
  if (!messages.length) {
    return messages;
  }

  state.pendingOutgoingMessages = [];
  await writeState(state);
  return messages;
}
