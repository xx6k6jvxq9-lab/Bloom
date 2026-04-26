const STORE_KEY = "wechat-bridge-state";
const BIND_SESSION_LIFETIME_MS = 1000 * 60 * 10;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function badRequest(message, extra = {}) {
  return json({ error: message, ...extra }, { status: 400 });
}

export function serverError(message, error) {
  console.error(message, error);
  return json({ error: message }, { status: 500 });
}

export function getWechatBridgeKv(env) {
  return env?.WECHAT_BRIDGE_KV || null;
}

function ensureKv(env) {
  const kv = getWechatBridgeKv(env);
  if (!kv) {
    throw new Error(
      "Missing Cloudflare KV binding WECHAT_BRIDGE_KV. Create a KV namespace and bind it to this Pages project.",
    );
  }
  return kv;
}

function createToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wxbind_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getEmptyState() {
  return {
    sessions: [],
    bindings: [],
    pendingMessages: [],
    pendingOutgoingMessages: [],
  };
}

function normalizeSessions(sessions) {
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

export async function readWechatBridgeState(env) {
  const kv = ensureKv(env);
  const raw = await kv.get(STORE_KEY);
  if (!raw) {
    return getEmptyState();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      bindings: Array.isArray(parsed.bindings) ? parsed.bindings : [],
      pendingMessages: Array.isArray(parsed.pendingMessages) ? parsed.pendingMessages : [],
      pendingOutgoingMessages: Array.isArray(parsed.pendingOutgoingMessages) ? parsed.pendingOutgoingMessages : [],
    };
  } catch (error) {
    console.error("Failed to parse WECHAT_BRIDGE_KV state, resetting to empty state.", error);
    return getEmptyState();
  }
}

export async function writeWechatBridgeState(env, state) {
  const kv = ensureKv(env);
  await kv.put(STORE_KEY, JSON.stringify(state));
}

export async function createWechatBindSession(env, characterId, appOrigin) {
  const state = await readWechatBridgeState(env);
  const token = createToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + BIND_SESSION_LIFETIME_MS;
  const qrText = `${String(appOrigin).replace(/\/$/, "")}/wechat/bind?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(characterId)}`;

  const session = {
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
  await writeWechatBridgeState(env, state);
  return session;
}

export async function getWechatBindSessionByCharacterId(env, characterId) {
  const state = await readWechatBridgeState(env);
  const sessions = normalizeSessions(state.sessions);
  const target = sessions.find((session) => session.characterId === characterId) || null;
  if (JSON.stringify(sessions) !== JSON.stringify(state.sessions)) {
    state.sessions = sessions;
    await writeWechatBridgeState(env, state);
  }
  return target;
}

export async function getWechatBindSessionByToken(env, token) {
  const state = await readWechatBridgeState(env);
  const sessions = normalizeSessions(state.sessions);
  const target = sessions.find((session) => session.token === token) || null;
  if (JSON.stringify(sessions) !== JSON.stringify(state.sessions)) {
    state.sessions = sessions;
    await writeWechatBridgeState(env, state);
  }
  return target;
}

export async function getWechatBindingByCharacterId(env, characterId) {
  const state = await readWechatBridgeState(env);
  return state.bindings.find((binding) => binding.characterId === characterId && binding.enabled) || null;
}

export async function getWechatBindingsOverview(env) {
  const state = await readWechatBridgeState(env);
  const bindings = state.bindings.filter((binding) => binding.enabled);
  return {
    enabledCount: bindings.length,
    bindings,
  };
}

export async function markWechatBindSessionBound(env, token, payload) {
  const state = await readWechatBridgeState(env);
  const sessions = normalizeSessions(state.sessions);
  const target = sessions.find((session) => session.token === token);
  if (!target) {
    return null;
  }

  const session = {
    ...target,
    status: "bound",
    boundConversationId: payload.conversationId,
    boundDisplayName: payload.displayName,
  };

  const binding = {
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
      (item) =>
        item.id !== binding.id &&
        item.characterId !== binding.characterId &&
        item.conversationId !== binding.conversationId,
    ),
  ];

  await writeWechatBridgeState(env, state);
  return { session, binding };
}

export async function disableWechatBindingByCharacterId(env, characterId) {
  const state = await readWechatBridgeState(env);
  const target = state.bindings.find((binding) => binding.characterId === characterId && binding.enabled);
  if (!target) {
    return null;
  }

  const nextBinding = {
    ...target,
    enabled: false,
    updatedAt: Date.now(),
  };

  state.bindings = state.bindings.map((binding) => (binding.id === target.id ? nextBinding : binding));
  await writeWechatBridgeState(env, state);
  return nextBinding;
}

export async function enqueueWechatIncomingMessage(env, payload) {
  const state = await readWechatBridgeState(env);
  const binding = state.bindings.find((item) => item.conversationId === payload.conversationId && item.enabled);
  if (!binding) {
    return null;
  }

  const message = {
    id: createToken(),
    channel: "wechat-clawbot",
    characterId: binding.characterId,
    conversationId: payload.conversationId,
    text: payload.text,
    senderDisplayName: payload.senderDisplayName,
    createdAt: Date.now(),
  };

  state.pendingMessages = [...state.pendingMessages, message];
  await writeWechatBridgeState(env, state);
  return message;
}

export async function pullWechatIncomingMessages(env) {
  const state = await readWechatBridgeState(env);
  const messages = [...state.pendingMessages].sort((left, right) => left.createdAt - right.createdAt);
  if (!messages.length) {
    return messages;
  }

  state.pendingMessages = [];
  await writeWechatBridgeState(env, state);
  return messages;
}

export async function enqueueWechatOutgoingMessage(env, payload) {
  const state = await readWechatBridgeState(env);
  const binding = state.bindings.find(
    (item) =>
      item.conversationId === payload.conversationId
      && item.characterId === payload.characterId
      && item.enabled,
  );
  if (!binding) {
    return null;
  }

  const message = {
    id: createToken(),
    channel: "wechat-clawbot",
    characterId: payload.characterId,
    conversationId: payload.conversationId,
    text: payload.text,
    createdAt: Date.now(),
    replyToMessageId: payload.replyToMessageId,
    characterName: payload.characterName,
    avatarUrl: payload.avatarUrl,
  };

  state.pendingOutgoingMessages = [...state.pendingOutgoingMessages, message];
  await writeWechatBridgeState(env, state);
  return message;
}

export async function pullWechatOutgoingMessages(env) {
  const state = await readWechatBridgeState(env);
  const messages = [...state.pendingOutgoingMessages].sort((left, right) => left.createdAt - right.createdAt);
  if (!messages.length) {
    return messages;
  }

  state.pendingOutgoingMessages = [];
  await writeWechatBridgeState(env, state);
  return messages;
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function resolveWebhookMessagePayload(input) {
  const root = asRecord(input) ?? {};
  const event = asRecord(root.event);
  const message = asRecord(root.message) ?? asRecord(root.msg);
  const sender = asRecord(root.sender) ?? asRecord(message?.sender) ?? asRecord(event?.sender);
  const chat = asRecord(root.chat) ?? asRecord(event?.chat) ?? asRecord(message?.chat);

  return {
    conversationId: pickFirstString(
      root.conversationId,
      root.chatId,
      root.sessionId,
      root.roomId,
      root.talker,
      event?.conversationId,
      event?.chatId,
      event?.sessionId,
      event?.roomId,
      event?.talker,
      chat?.id,
      chat?.conversationId,
      chat?.chatId,
      message?.conversationId,
      message?.chatId,
      message?.sessionId,
      message?.talker,
      message?.from,
    ),
    text: pickFirstString(
      root.text,
      root.content,
      root.messageText,
      message?.text,
      message?.content,
      message?.message,
      event?.text,
      event?.content,
    ),
    senderDisplayName: pickFirstString(
      root.senderDisplayName,
      root.nickname,
      sender?.displayName,
      sender?.nickname,
      sender?.name,
      sender?.remark,
      message?.senderDisplayName,
      event?.senderDisplayName,
    ),
  };
}

export function getAppOrigin(request) {
  return new URL(request.url).origin;
}

export async function readRequestJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export { json };
