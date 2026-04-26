import type { WechatBindSession, WechatBindingsOverview, WechatIncomingBridgeMessage, WechatRoleBinding } from "./types";
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

export async function createWechatBindSessionRequest(characterId: string): Promise<WechatBindSession> {
  try {
    return await readJson<WechatBindSession>(
      await fetch("/api/wechat/bind-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      }),
    );
  } catch {
    return createWechatBindSession(characterId);
  }
}

export async function getWechatBindSessionByCharacterIdRequest(characterId: string): Promise<WechatBindSession | null> {
  try {
    const payload = await readJson<{ session: WechatBindSession | null }>(
      await fetch(`/api/wechat/bind-session/by-character/${encodeURIComponent(characterId)}`),
    );
    return payload.session;
  } catch {
    await loadPreferredWechatBindSessions();
    return getWechatBindSessionByCharacterId(characterId);
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

export async function getWechatBindingByCharacterIdRequest(characterId: string): Promise<WechatRoleBinding | null> {
  try {
    const payload = await readJson<{ binding: WechatRoleBinding | null }>(
      await fetch(`/api/wechat/binding/by-character/${encodeURIComponent(characterId)}`),
    );
    return payload.binding;
  } catch {
    await loadPreferredWechatRoleBindings();
    return getWechatBindingByCharacterId(characterId);
  }
}

export async function markWechatBindSessionBoundRequest(
  token: string,
  payload: {
    conversationId: string;
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

export async function disableWechatBindingByCharacterIdRequest(characterId: string): Promise<WechatRoleBinding | null> {
  try {
    const payload = await readJson<{ binding: WechatRoleBinding | null }>(
      await fetch(`/api/wechat/binding/by-character/${encodeURIComponent(characterId)}/disable`, {
        method: "POST",
      }),
    );
    return payload.binding;
  } catch {
    return disableWechatBindingByCharacterId(characterId);
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
