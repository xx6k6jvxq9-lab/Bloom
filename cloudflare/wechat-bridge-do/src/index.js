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

function tryParseUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
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
    wechatIdentity: pickFirstString(
      root.wechatIdentity,
      root.wechatId,
      root.senderId,
      event?.wechatIdentity,
      event?.wechatId,
      event?.senderId,
      sender?.id,
      sender?.wechatId,
      sender?.identity,
      sender?.senderId,
      message?.senderId,
      message?.fromUser,
    ),
    channelAccountId: pickFirstString(
      root.channelAccountId,
      root.accountId,
      event?.channelAccountId,
      event?.accountId,
      chat?.accountId,
      message?.accountId,
    ),
    channelPeerId: pickFirstString(
      root.channelPeerId,
      root.peerId,
      event?.channelPeerId,
      event?.peerId,
      chat?.peerId,
      message?.peerId,
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

function resolveOpenClawConnectPayload(input, requestUrl) {
  const root = asRecord(input) ?? {};
  const event = asRecord(root.event);
  const message = asRecord(root.message) ?? asRecord(root.msg);
  const sender = asRecord(root.sender) ?? asRecord(message?.sender) ?? asRecord(event?.sender);
  const chat = asRecord(root.chat) ?? asRecord(event?.chat) ?? asRecord(message?.chat);
  const callbackUrl = pickFirstString(
    root.callbackUrl,
    root.bindCallbackUrl,
    event?.callbackUrl,
    event?.bindCallbackUrl,
    message?.callbackUrl,
  );
  const parsedCallbackUrl = tryParseUrl(callbackUrl);
  const parsedRequestUrl = tryParseUrl(requestUrl);

  return {
    token: pickFirstString(
      root.token,
      root.bindToken,
      root.state,
      event?.token,
      event?.bindToken,
      event?.state,
      message?.token,
      parsedRequestUrl?.searchParams.get("token"),
      parsedRequestUrl?.searchParams.get("bindToken"),
      parsedCallbackUrl?.searchParams.get("token"),
      parsedCallbackUrl?.searchParams.get("bindToken"),
    ),
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
    wechatIdentity: pickFirstString(
      root.wechatIdentity,
      root.wechatId,
      root.senderId,
      event?.wechatIdentity,
      event?.wechatId,
      event?.senderId,
      sender?.id,
      sender?.wechatId,
      sender?.identity,
      sender?.senderId,
      message?.senderId,
      message?.fromUser,
    ),
    channelAccountId: pickFirstString(
      root.channelAccountId,
      root.accountId,
      event?.channelAccountId,
      event?.accountId,
      chat?.accountId,
      message?.accountId,
    ),
    channelPeerId: pickFirstString(
      root.channelPeerId,
      root.peerId,
      event?.channelPeerId,
      event?.peerId,
      chat?.peerId,
      message?.peerId,
    ),
    openClawPairingId: pickFirstString(
      root.openClawPairingId,
      root.pairingId,
      event?.openClawPairingId,
      event?.pairingId,
      message?.pairingId,
    ),
    displayName: pickFirstString(
      root.displayName,
      root.nickname,
      sender?.displayName,
      sender?.nickname,
      sender?.name,
      sender?.remark,
      message?.senderDisplayName,
      event?.senderDisplayName,
    ),
    avatarUrl: pickFirstString(
      root.avatarUrl,
      root.avatar,
      root.headImgUrl,
      sender?.avatarUrl,
      sender?.avatar,
      sender?.headImgUrl,
      message?.avatarUrl,
      event?.avatarUrl,
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

function buildBloomBindCallbackUrl(appOrigin, token, characterId, bloomUserId) {
  return `${String(appOrigin).replace(/\/$/, "")}/wechat/bind?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(characterId)}&bloomUserId=${encodeURIComponent(bloomUserId)}`;
}

function buildWechatConnectUrl(env, payload) {
  const bindCallbackUrl = buildBloomBindCallbackUrl(
    payload.appOrigin,
    payload.token,
    payload.characterId,
    payload.bloomUserId,
  );
  const configuredConnectUrl = typeof env?.OPENCLAW_WECHAT_CONNECT_URL === "string"
    ? env.OPENCLAW_WECHAT_CONNECT_URL.trim()
    : "";

  if (!configuredConnectUrl) {
    return {
      qrText: bindCallbackUrl,
      bindCallbackUrl,
    };
  }

  try {
    const url = new URL(configuredConnectUrl);
    url.searchParams.set("token", payload.token);
    url.searchParams.set("bloomUserId", payload.bloomUserId);
    url.searchParams.set("characterId", payload.characterId);
    url.searchParams.set("callbackUrl", bindCallbackUrl);
    return {
      qrText: url.toString(),
      bindCallbackUrl,
      openClawConnectUrl: configuredConnectUrl,
    };
  } catch (error) {
    console.error("Invalid OPENCLAW_WECHAT_CONNECT_URL, falling back to Bloom bind page.", error);
    return {
      qrText: bindCallbackUrl,
      bindCallbackUrl,
    };
  }
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

export class WechatBridgeDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.cache = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "POST" && pathname === "/api/wechat/bind-session") {
      return this.handleCreateBindSession(request);
    }

    if (request.method === "GET" && pathname.startsWith("/api/wechat/bind-session/by-character/")) {
      return this.handleGetBindSessionByCharacter(pathname, request);
    }

    if (request.method === "GET" && pathname.startsWith("/api/wechat/bind-session/")) {
      return this.handleGetBindSessionByToken(pathname);
    }

    if (
      request.method === "POST"
      && pathname.startsWith("/api/wechat/bind-session/")
      && (pathname.endsWith("/bind") || pathname.endsWith("/connect"))
    ) {
      return this.handleBindSession(pathname, request);
    }

    if (request.method === "GET" && pathname.startsWith("/api/wechat/binding/by-character/")) {
      return this.handleGetBindingByCharacter(pathname, request);
    }

    if (request.method === "POST" && pathname.startsWith("/api/wechat/binding/by-character/") && pathname.endsWith("/disable")) {
      return this.handleDisableBinding(pathname, request);
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

    if (request.method === "POST" && pathname === "/api/wechat/openclaw/connect-callback") {
      return this.handleOpenClawConnectCallback(request);
    }

    if (request.method === "POST" && pathname === "/api/wechat/messages/pull") {
      return this.handlePullMessages();
    }

    if (request.method === "POST" && pathname === "/api/wechat/messages/outgoing") {
      return this.handleEnqueueOutgoingMessage(request);
    }

    if (request.method === "POST" && pathname === "/api/wechat/messages/outgoing/pull") {
      return this.handlePullOutgoingMessages();
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
      pendingOutgoingMessages: Array.isArray(state.pendingOutgoingMessages) ? state.pendingOutgoingMessages : [],
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
    const bloomUserId = String(body?.bloomUserId || "").trim();
    if (!characterId) {
      return badRequest("Missing characterId");
    }
    if (!bloomUserId) {
      return badRequest("Missing bloomUserId");
    }

    const state = await this.readState();
    const bindTaskId = createToken();
    const token = createToken();
    const createdAt = Date.now();
    const expiresAt = createdAt + BIND_SESSION_LIFETIME_MS;
    const appOrigin = new URL(request.url).origin;
    const connectTarget = buildWechatConnectUrl(this.env, {
      appOrigin,
      token,
      bloomUserId,
      characterId,
    });
    const session = {
      bindTaskId,
      token,
      channel: "wechat-clawbot",
      bloomUserId,
      characterId,
      characterName: typeof body?.characterName === "string" ? body.characterName.trim() : undefined,
      characterAvatarUrl: typeof body?.characterAvatarUrl === "string" ? body.characterAvatarUrl.trim() : undefined,
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
        (item) => !(item.characterId === characterId && item.bloomUserId === bloomUserId),
      ),
    ];
    await this.writeState(state);
    return json(session);
  }

  async handleGetBindSessionByCharacter(pathname, request) {
    const characterId = decodeURIComponent(pathname.split("/").pop() || "").trim();
    const bloomUserId = new URL(request.url).searchParams.get("bloomUserId")?.trim();
    const state = await this.readState();
    const sessions = normalizeSessions(state.sessions);
    const session = sessions.find(
      (item) => item.characterId === characterId && (!bloomUserId || item.bloomUserId === bloomUserId),
    ) || null;
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
    const conversationId = pickFirstString(body?.conversationId, body?.channelPeerId, body?.wechatIdentity);
    if (!conversationId) {
      return badRequest("Missing conversationId or WeChat identity");
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
      connectedAt: Date.now(),
      wechatIdentity: pickFirstString(body?.wechatIdentity, target.wechatIdentity),
      channelAccountId: pickFirstString(body?.channelAccountId, target.channelAccountId),
      channelPeerId: pickFirstString(body?.channelPeerId, target.channelPeerId),
      openClawPairingId: pickFirstString(body?.openClawPairingId, target.openClawPairingId),
      boundConversationId: conversationId,
      boundDisplayName: typeof body?.displayName === "string" ? body.displayName.trim() : undefined,
    };

    const binding = {
      id: `wxbind_${target.bloomUserId}_${target.characterId}`,
      channel: "wechat-clawbot",
      conversationId,
      bloomUserId: target.bloomUserId,
      characterId: target.characterId,
      enabled: true,
      wechatIdentity: pickFirstString(body?.wechatIdentity),
      channelAccountId: pickFirstString(body?.channelAccountId),
      channelPeerId: pickFirstString(body?.channelPeerId),
      openClawPairingId: pickFirstString(body?.openClawPairingId),
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
          !(item.bloomUserId === binding.bloomUserId && item.characterId === binding.characterId) &&
          item.conversationId !== binding.conversationId,
      ),
    ];

    await this.writeState(state);
    return json({ session, binding });
  }

  async handleGetBindingByCharacter(pathname, request) {
    const parts = pathname.split("/");
    const characterId = decodeURIComponent(parts[parts.length - 1] || "").trim();
    const bloomUserId = new URL(request.url).searchParams.get("bloomUserId")?.trim();
    const state = await this.readState();
    const binding = state.bindings.find(
      (item) => item.characterId === characterId && (!bloomUserId || item.bloomUserId === bloomUserId) && item.enabled,
    ) || null;
    return json({ binding });
  }

  async handleDisableBinding(pathname, request) {
    const parts = pathname.split("/");
    const characterId = decodeURIComponent(parts[parts.length - 2] || "").trim();
    const bloomUserId = new URL(request.url).searchParams.get("bloomUserId")?.trim();
    const state = await this.readState();
    const target = state.bindings.find(
      (item) => item.characterId === characterId && (!bloomUserId || item.bloomUserId === bloomUserId) && item.enabled,
    );
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
    const wechatIdentity = String(body?.wechatIdentity || "").trim();
    const channelPeerId = String(body?.channelPeerId || "").trim();
    const text = String(body?.text || "").trim();
    if ((!conversationId && !wechatIdentity && !channelPeerId) || !text) {
      return badRequest("Missing WeChat identity or text");
    }

    const state = await this.readState();
    const resolvedConversationId = conversationId || channelPeerId || wechatIdentity;
    const binding = state.bindings.find((item) => {
      if (!item.enabled) {
        return false;
      }
      return (
        (!!conversationId && item.conversationId === conversationId)
        || (!!wechatIdentity && item.wechatIdentity === wechatIdentity)
        || (!!channelPeerId && item.channelPeerId === channelPeerId)
        || (typeof body?.channelAccountId === "string" && body.channelAccountId.trim() && item.channelAccountId === body.channelAccountId.trim())
      );
    });
    if (!binding) {
      return json({ error: "No enabled binding for this WeChat identity" }, { status: 404 });
    }

    const message = {
      id: createToken(),
      channel: "wechat-clawbot",
      characterId: binding.characterId,
      conversationId: resolvedConversationId,
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
    if ((!payload.conversationId && !payload.wechatIdentity && !payload.channelPeerId) || !payload.text) {
      return badRequest("Unable to resolve WeChat identity or text from callback payload", {
        resolved: payload,
      });
    }

    const state = await this.readState();
    const resolvedConversationId = payload.conversationId || payload.channelPeerId || payload.wechatIdentity;
    const binding = state.bindings.find((item) => {
      if (!item.enabled) {
        return false;
      }
      return (
        (!!payload.conversationId && item.conversationId === payload.conversationId)
        || (!!payload.wechatIdentity && item.wechatIdentity === payload.wechatIdentity)
        || (!!payload.channelPeerId && item.channelPeerId === payload.channelPeerId)
        || (!!payload.channelAccountId && item.channelAccountId === payload.channelAccountId)
      );
    });
    if (!binding) {
      return json(
        {
          accepted: false,
          reason: "No enabled binding for this WeChat identity",
          resolved: payload,
        },
        { status: 202 },
      );
    }

    const message = {
      id: createToken(),
      channel: "wechat-clawbot",
      characterId: binding.characterId,
      conversationId: resolvedConversationId,
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

  async handleOpenClawConnectCallback(request) {
    const body = await this.readJsonBody(request);
    const payload = resolveOpenClawConnectPayload(body, request.url);
    if (!payload.token) {
      return badRequest("Missing bind token in OpenClaw callback", { resolved: payload });
    }
    if (!payload.conversationId && !payload.wechatIdentity && !payload.channelPeerId) {
      return badRequest("Missing WeChat identity in OpenClaw callback", { resolved: payload });
    }

    const pathname = `/api/wechat/bind-session/${encodeURIComponent(payload.token)}/connect`;
    const syntheticRequest = new Request(`https://worker.invalid${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return this.handleBindSession(pathname, syntheticRequest);
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

  async handleEnqueueOutgoingMessage(request) {
    const body = await this.readJsonBody(request);
    const conversationId = String(body?.conversationId || "").trim();
    const characterId = String(body?.characterId || "").trim();
    const text = String(body?.text || "").trim();
    if (!conversationId || !characterId || !text) {
      return badRequest("Missing conversationId, characterId or text");
    }

    const state = await this.readState();
    const binding = state.bindings.find(
      (item) =>
        item.conversationId === conversationId
        && item.characterId === characterId
        && item.enabled,
    );
    if (!binding) {
      return json({ error: "No enabled binding for this conversationId and characterId" }, { status: 404 });
    }

    const message = {
      id: createToken(),
      channel: "wechat-clawbot",
      characterId,
      conversationId,
      text,
      createdAt: Date.now(),
      replyToMessageId: typeof body?.replyToMessageId === "string" ? body.replyToMessageId.trim() : undefined,
      characterName: typeof body?.characterName === "string" ? body.characterName.trim() : undefined,
      avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : undefined,
    };

    state.pendingOutgoingMessages = [...state.pendingOutgoingMessages, message];
    await this.writeState(state);
    return json({ message });
  }

  async handlePullOutgoingMessages() {
    const state = await this.readState();
    const messages = [...state.pendingOutgoingMessages].sort((left, right) => left.createdAt - right.createdAt);
    if (!messages.length) {
      return json({ messages });
    }

    state.pendingOutgoingMessages = [];
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
