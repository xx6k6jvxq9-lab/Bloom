function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function badRequest(message, extra = {}) {
  return json({ error: message, ...extra }, { status: 400 });
}

function notFound() {
  return new Response("Not Found", { status: 404 });
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

function resolveWebhookMessagePayload(input) {
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

function createToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wxbind_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const STORE_KEY = "state";
const BIND_SESSION_LIFETIME_MS = 1000 * 60 * 10;

function getEmptyState() {
  return {
    sessions: [],
    bindings: [],
    pendingMessages: [],
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

export class WechatBridgeDurableObject {
  constructor(state) {
    this.state = state;
    this.cache = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "POST" && pathname === "/api/wechat/bind-session") {
      return this.handleCreateBindSession(request);
    }

    if (request.method === "GET" && pathname.startsWith("/api/wechat/bind-session/by-character/")) {
      return this.handleGetBindSessionByCharacter(pathname);
    }

    if (request.method === "GET" && pathname.startsWith("/api/wechat/bind-session/")) {
      return this.handleGetBindSessionByToken(pathname);
    }

    if (request.method === "POST" && pathname.startsWith("/api/wechat/bind-session/") && pathname.endsWith("/bind")) {
      return this.handleBindSession(pathname, request);
    }

    if (request.method === "GET" && pathname.startsWith("/api/wechat/binding/by-character/")) {
      return this.handleGetBindingByCharacter(pathname);
    }

    if (request.method === "POST" && pathname.startsWith("/api/wechat/binding/by-character/") && pathname.endsWith("/disable")) {
      return this.handleDisableBinding(pathname);
    }

    if (request.method === "GET" && pathname === "/api/wechat/bindings") {
      return this.handleGetBindingsOverview();
    }

    if (request.method === "POST" && pathname === "/api/wechat/messages") {
      return this.handleEnqueueMessage(request);
    }

    if (request.method === "POST" && pathname === "/api/wechat/clawbot/callback") {
      return this.handleClawbotCallback(request);
    }

    if (request.method === "POST" && pathname === "/api/wechat/messages/pull") {
      return this.handlePullMessages();
    }

    if (request.method === "GET" && pathname === "/health") {
      return json({ status: "ok", service: "wechat-bridge-do" });
    }

    return notFound();
  }

  async readState() {
    if (this.cache) {
      return this.cache;
    }

    const state = (await this.state.storage.get(STORE_KEY)) || getEmptyState();
    this.cache = {
      sessions: Array.isArray(state.sessions) ? state.sessions : [],
      bindings: Array.isArray(state.bindings) ? state.bindings : [],
      pendingMessages: Array.isArray(state.pendingMessages) ? state.pendingMessages : [],
    };
    return this.cache;
  }

  async writeState(state) {
    this.cache = state;
    await this.state.storage.put(STORE_KEY, state);
  }

  async readJsonBody(request) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  async handleCreateBindSession(request) {
    const body = await this.readJsonBody(request);
    const characterId = String(body?.characterId || "").trim();
    if (!characterId) {
      return badRequest("Missing characterId");
    }

    const state = await this.readState();
    const token = createToken();
    const createdAt = Date.now();
    const expiresAt = createdAt + BIND_SESSION_LIFETIME_MS;
    const appOrigin = new URL(request.url).origin;
    const qrText = `${appOrigin.replace(/\/$/, "")}/wechat/bind?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(characterId)}`;
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
    await this.writeState(state);
    return json(session);
  }

  async handleGetBindSessionByCharacter(pathname) {
    const characterId = decodeURIComponent(pathname.split("/").pop() || "").trim();
    const state = await this.readState();
    const sessions = normalizeSessions(state.sessions);
    const session = sessions.find((item) => item.characterId === characterId) || null;
    if (JSON.stringify(sessions) !== JSON.stringify(state.sessions)) {
      state.sessions = sessions;
      await this.writeState(state);
    }
    return json({ session });
  }

  async handleGetBindSessionByToken(pathname) {
    const token = decodeURIComponent(pathname.split("/").pop() || "").trim();
    const state = await this.readState();
    const sessions = normalizeSessions(state.sessions);
    const session = sessions.find((item) => item.token === token) || null;
    if (JSON.stringify(sessions) !== JSON.stringify(state.sessions)) {
      state.sessions = sessions;
      await this.writeState(state);
    }
    return json({ session });
  }

  async handleBindSession(pathname, request) {
    const segments = pathname.split("/");
    const token = decodeURIComponent(segments[segments.length - 2] || "").trim();
    const body = await this.readJsonBody(request);
    const conversationId = String(body?.conversationId || "").trim();
    if (!conversationId) {
      return badRequest("Missing conversationId");
    }

    const state = await this.readState();
    const sessions = normalizeSessions(state.sessions);
    const target = sessions.find((item) => item.token === token);
    if (!target) {
      return json({ error: "Bind session not found" }, { status: 404 });
    }

    const session = {
      ...target,
      status: "bound",
      boundConversationId: conversationId,
      boundDisplayName: typeof body?.displayName === "string" ? body.displayName.trim() : undefined,
    };

    const binding = {
      id: `wxbind_${target.characterId}`,
      channel: "wechat-clawbot",
      conversationId,
      characterId: target.characterId,
      enabled: true,
      displayName: typeof body?.displayName === "string" ? body.displayName.trim() : undefined,
      avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : undefined,
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

    await this.writeState(state);
    return json({ session, binding });
  }

  async handleGetBindingByCharacter(pathname) {
    const parts = pathname.split("/");
    const characterId = decodeURIComponent(parts[parts.length - 1] || "").trim();
    const state = await this.readState();
    const binding = state.bindings.find((item) => item.characterId === characterId && item.enabled) || null;
    return json({ binding });
  }

  async handleDisableBinding(pathname) {
    const parts = pathname.split("/");
    const characterId = decodeURIComponent(parts[parts.length - 2] || "").trim();
    const state = await this.readState();
    const target = state.bindings.find((item) => item.characterId === characterId && item.enabled);
    if (!target) {
      return json({ binding: null });
    }

    const binding = {
      ...target,
      enabled: false,
      updatedAt: Date.now(),
    };

    state.bindings = state.bindings.map((item) => (item.id === target.id ? binding : item));
    await this.writeState(state);
    return json({ binding });
  }

  async handleGetBindingsOverview() {
    const state = await this.readState();
    const bindings = state.bindings.filter((item) => item.enabled);
    return json({
      enabledCount: bindings.length,
      bindings,
    });
  }

  async handleEnqueueMessage(request) {
    const body = await this.readJsonBody(request);
    const conversationId = String(body?.conversationId || "").trim();
    const text = String(body?.text || "").trim();
    if (!conversationId || !text) {
      return badRequest("Missing conversationId or text");
    }

    const state = await this.readState();
    const binding = state.bindings.find((item) => item.conversationId === conversationId && item.enabled);
    if (!binding) {
      return json({ error: "No enabled binding for this conversationId" }, { status: 404 });
    }

    const message = {
      id: createToken(),
      channel: "wechat-clawbot",
      characterId: binding.characterId,
      conversationId,
      text,
      senderDisplayName: typeof body?.senderDisplayName === "string" ? body.senderDisplayName.trim() : undefined,
      createdAt: Date.now(),
    };

    state.pendingMessages = [...state.pendingMessages, message];
    await this.writeState(state);
    return json({ message });
  }

  async handleClawbotCallback(request) {
    const body = await this.readJsonBody(request);
    const payload = resolveWebhookMessagePayload(body);
    if (!payload.conversationId || !payload.text) {
      return badRequest("Unable to resolve conversationId or text from callback payload", {
        resolved: payload,
      });
    }

    const state = await this.readState();
    const binding = state.bindings.find((item) => item.conversationId === payload.conversationId && item.enabled);
    if (!binding) {
      return json(
        {
          accepted: false,
          reason: "No enabled binding for this conversationId",
          resolved: payload,
        },
        { status: 202 },
      );
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
    await this.writeState(state);
    return json({
      accepted: true,
      message,
    });
  }

  async handlePullMessages() {
    const state = await this.readState();
    const messages = [...state.pendingMessages].sort((left, right) => left.createdAt - right.createdAt);
    if (!messages.length) {
      return json({ messages });
    }

    state.pendingMessages = [];
    await this.writeState(state);
    return json({ messages });
  }
}

export default {
  async fetch() {
    return json({
      status: "ok",
      service: "bloom-wechat-bridge-do",
    });
  },
};
