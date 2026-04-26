import { promises as fs } from "fs";
import path from "path";

export type WechatBridgeChannel = "wechat-clawbot";
export type WechatBindingStatus = "pending" | "bound" | "expired" | "disabled";

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

type WechatBridgeState = {
  sessions: WechatBindSession[];
  bindings: WechatRoleBinding[];
  pendingMessages: WechatIncomingBridgeMessage[];
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

const STORE_PATH = path.resolve(process.cwd(), ".codex-wechat-bridge.json");
const BIND_SESSION_LIFETIME_MS = 1000 * 60 * 10;

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

export async function createWechatBindSession(characterId: string, appOrigin: string): Promise<WechatBindSession> {
  const state = await readState();
  const token = createToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + BIND_SESSION_LIFETIME_MS;
  const qrText = `${appOrigin.replace(/\/$/, "")}/wechat/bind?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(characterId)}`;
  const session: WechatBindSession = {
    token,
    channel: "wechat-clawbot",
    characterId,
    qrText,
    status: "pending",
    createdAt,
    expiresAt,
  };

  state.sessions = [
    session,
    ...normalizeSessions(state.sessions).filter((item) => item.characterId !== characterId),
  ];
  await writeState(state);
  return session;
}

export async function getWechatBindSessionByCharacterId(characterId: string): Promise<WechatBindSession | null> {
  const state = await readState();
  const sessions = normalizeSessions(state.sessions);
  const target = sessions.find((session) => session.characterId === characterId) || null;
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

export async function getWechatBindingByCharacterId(characterId: string): Promise<WechatRoleBinding | null> {
  const state = await readState();
  return state.bindings.find((binding) => binding.characterId === characterId && binding.enabled) || null;
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
    conversationId: string;
    displayName?: string;
    avatarUrl?: string;
  },
): Promise<{ session: WechatBindSession; binding: WechatRoleBinding } | null> {
  const state = await readState();
  const sessions = normalizeSessions(state.sessions);
  const target = sessions.find((session) => session.token === token);
  if (!target) return null;

  const session: WechatBindSession = {
    ...target,
    status: "bound",
    boundConversationId: payload.conversationId,
    boundDisplayName: payload.displayName,
  };

  const binding: WechatRoleBinding = {
    id: `wxbind_${target.characterId}`,
    channel: "wechat-clawbot",
    conversationId: payload.conversationId,
    characterId: target.characterId,
    enabled: true,
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl,
    createdAt: target.createdAt,
    updatedAt: Date.now(),
  };

  state.sessions = sessions.map((item) => (item.token === token ? session : item));
  state.bindings = [
    binding,
    ...state.bindings.filter(
      (item) => item.id !== binding.id && item.characterId !== binding.characterId && item.conversationId !== binding.conversationId,
    ),
  ];
  await writeState(state);
  return { session, binding };
}

export async function disableWechatBindingByCharacterId(characterId: string): Promise<WechatRoleBinding | null> {
  const state = await readState();
  const target = state.bindings.find((binding) => binding.characterId === characterId && binding.enabled);
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
  conversationId: string;
  text: string;
  senderDisplayName?: string;
}): Promise<WechatIncomingBridgeMessage | null> {
  const state = await readState();
  const binding = state.bindings.find((item) => item.conversationId === payload.conversationId && item.enabled);
  if (!binding) return null;

  const message: WechatIncomingBridgeMessage = {
    id: createToken(),
    channel: "wechat-clawbot",
    characterId: binding.characterId,
    conversationId: payload.conversationId,
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
