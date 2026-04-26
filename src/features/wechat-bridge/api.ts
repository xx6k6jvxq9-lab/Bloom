import type {
  WechatBindSession,
  WechatBindingsOverview,
  WechatIncomingBridgeMessage,
  WechatOutgoingBridgeMessage,
  WechatRoleBinding,
} from "./types";
import {
  disableWechatBindingByCharacterId,
  getWechatBindingByCharacterId,
  getWechatBindingsOverview,
  loadPreferredWechatRoleBindings,
  upsertWechatRoleBinding,
} from "./bindingsStore";
import {
  createWechatBindSession,
  getWechatBindSessionByCharacterId,
  getWechatBindSessionByToken,
  loadPreferredWechatBindSessions,
  markWechatBindSessionBound,
} from "./bindSessionStore";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function createWechatBindSessionRequest(payload: {
  characterId: string;
  bloomUserId: string;
  characterName?: string;
  characterAvatarUrl?: string;
}): Promise<WechatBindSession> {
  try {
    return await readJson<WechatBindSession>(
      await fetch("/api/wechat/bind-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  } catch {
    return createWechatBindSession(payload);
  }
}

export async function getWechatBindSessionByCharacterIdRequest(
  characterId: string,
  bloomUserId?: string,
): Promise<WechatBindSession | null> {
  try {
    const search = new URLSearchParams();
    if (bloomUserId?.trim()) {
      search.set("bloomUserId", bloomUserId.trim());
    }
    const payload = await readJson<{ session: WechatBindSession | null }>(
      await fetch(
        `/api/wechat/bind-session/by-character/${encodeURIComponent(characterId)}${search.size ? `?${search.toString()}` : ""}`,
      ),
    );
    return payload.session;
  } catch {
    await loadPreferredWechatBindSessions();
    return getWechatBindSessionByCharacterId(characterId, bloomUserId);
  }
}

export async function getWechatBindSessionByTokenRequest(token: string): Promise<WechatBindSession | null> {
  try {
    const payload = await readJson<{ session: WechatBindSession | null }>(
      await fetch(`/api/wechat/bind-session/${encodeURIComponent(token)}`),
    );
    return payload.session;
  } catch {
    await loadPreferredWechatBindSessions();
    return getWechatBindSessionByToken(token);
  }
}

export async function getWechatBindingByCharacterIdRequest(
  characterId: string,
  bloomUserId?: string,
): Promise<WechatRoleBinding | null> {
  try {
    const search = new URLSearchParams();
    if (bloomUserId?.trim()) {
      search.set("bloomUserId", bloomUserId.trim());
    }
    const payload = await readJson<{ binding: WechatRoleBinding | null }>(
      await fetch(
        `/api/wechat/binding/by-character/${encodeURIComponent(characterId)}${search.size ? `?${search.toString()}` : ""}`,
      ),
    );
    return payload.binding;
  } catch {
    await loadPreferredWechatRoleBindings();
    return getWechatBindingByCharacterId(characterId, bloomUserId);
  }
}

export async function markWechatBindSessionBoundRequest(
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
): Promise<{ session: WechatBindSession; binding: WechatRoleBinding }> {
  try {
    return await readJson<{ session: WechatBindSession; binding: WechatRoleBinding }>(
      await fetch(`/api/wechat/bind-session/${encodeURIComponent(token)}/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  } catch {
    const session = markWechatBindSessionBound(token, payload);
    const resolvedSession = session ?? getWechatBindSessionByToken(token);
    if (!resolvedSession) {
      throw new Error("Bind session not found");
    }
    const binding = getWechatBindingByCharacterId(resolvedSession.characterId);
    if (!binding) {
      throw new Error("Binding was not created");
    }
    return { session: resolvedSession, binding };
  }
}

export async function disableWechatBindingByCharacterIdRequest(
  characterId: string,
  bloomUserId?: string,
): Promise<WechatRoleBinding | null> {
  try {
    const search = new URLSearchParams();
    if (bloomUserId?.trim()) {
      search.set("bloomUserId", bloomUserId.trim());
    }
    const payload = await readJson<{ binding: WechatRoleBinding | null }>(
      await fetch(`/api/wechat/binding/by-character/${encodeURIComponent(characterId)}/disable${search.size ? `?${search.toString()}` : ""}`, {
        method: "POST",
      }),
    );
    return payload.binding;
  } catch {
    return disableWechatBindingByCharacterId(characterId, bloomUserId);
  }
}

export async function pullWechatIncomingMessagesRequest(): Promise<WechatIncomingBridgeMessage[]> {
  try {
    const payload = await readJson<{ messages: WechatIncomingBridgeMessage[] }>(
      await fetch("/api/wechat/messages/pull", {
        method: "POST",
      }),
    );
    return payload.messages;
  } catch {
    return [];
  }
}

export async function enqueueWechatOutgoingMessageRequest(payload: {
  conversationId: string;
  characterId: string;
  text: string;
  replyToMessageId?: string;
  characterName?: string;
  avatarUrl?: string;
}): Promise<WechatOutgoingBridgeMessage> {
  return readJson<{ message: WechatOutgoingBridgeMessage }>(
    await fetch('/api/wechat/messages/outgoing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  ).then((response) => response.message);
}

export async function getWechatBindingsOverviewRequest(): Promise<WechatBindingsOverview> {
  try {
    return await readJson<WechatBindingsOverview>(
      await fetch("/api/wechat/bindings"),
    );
  } catch {
    await Promise.all([
      loadPreferredWechatRoleBindings(),
      loadPreferredWechatBindSessions(),
    ]);
    return getWechatBindingsOverview();
  }
}
