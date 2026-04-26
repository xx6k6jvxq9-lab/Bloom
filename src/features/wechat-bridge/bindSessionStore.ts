import { loadJsonRecord, saveJsonRecord } from '../persistence/browserJsonStore';
import { loadJson, saveJson } from '../persistence/localConfigStore';
import { STORAGE_KEYS } from '../persistence/storageKeys';
import type { WechatBindSession, WechatRoleBinding } from './types';
import { upsertWechatRoleBinding } from './bindingsStore';

const BIND_SESSION_LIFETIME_MS = 1000 * 60 * 10;
const OPENCLAW_CONNECT_URL_STORAGE_KEY = 'bloom_openclaw_wechat_connect_url';

function createToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `wxbind_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeSessions(sessions: WechatBindSession[]): WechatBindSession[] {
  const now = Date.now();
  return sessions.map((session) => {
    if (session.status === 'pending' && session.expiresAt <= now) {
      return {
        ...session,
        status: 'expired',
      };
    }
    return session;
  });
}

function buildBloomBindCallbackUrl(baseOrigin: string, token: string, characterId: string, bloomUserId: string): string {
  return `${baseOrigin}/wechat/bind?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(characterId)}&bloomUserId=${encodeURIComponent(bloomUserId)}`;
}

function resolveConfiguredOpenClawConnectUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const runtimeConfig = (window as Window & {
    __BLOOM_OPENCLAW_WECHAT_CONNECT_URL__?: unknown;
  }).__BLOOM_OPENCLAW_WECHAT_CONNECT_URL__;
  if (typeof runtimeConfig === 'string' && runtimeConfig.trim()) {
    return runtimeConfig.trim();
  }

  const stored = loadJson<string | null>(OPENCLAW_CONNECT_URL_STORAGE_KEY, null);
  return typeof stored === 'string' && stored.trim() ? stored.trim() : null;
}

function buildWechatConnectUrl(params: {
  appOrigin: string;
  token: string;
  bloomUserId: string;
  characterId: string;
}): { qrText: string; bindCallbackUrl: string; openClawConnectUrl?: string } {
  const bindCallbackUrl = buildBloomBindCallbackUrl(params.appOrigin, params.token, params.characterId, params.bloomUserId);
  const configuredConnectUrl = resolveConfiguredOpenClawConnectUrl();

  if (!configuredConnectUrl) {
    return {
      qrText: bindCallbackUrl,
      bindCallbackUrl,
    };
  }

  try {
    const url = new URL(configuredConnectUrl);
    url.searchParams.set('token', params.token);
    url.searchParams.set('bloomUserId', params.bloomUserId);
    url.searchParams.set('characterId', params.characterId);
    url.searchParams.set('callbackUrl', bindCallbackUrl);
    return {
      qrText: url.toString(),
      bindCallbackUrl,
      openClawConnectUrl: configuredConnectUrl,
    };
  } catch (error) {
    console.error('[bindSessionStore] Invalid OpenClaw connect URL configuration, falling back to Bloom bind page', error);
    return {
      qrText: bindCallbackUrl,
      bindCallbackUrl,
    };
  }
}

export function loadWechatBindSessions(): WechatBindSession[] {
  const sessions = loadJson<WechatBindSession[]>(STORAGE_KEYS.wechatBindSessions, []);
  const normalized = normalizeSessions(sessions);
  if (normalized.length !== sessions.length || normalized.some((item, index) => item.status !== sessions[index]?.status)) {
    saveWechatBindSessions(normalized);
  }
  return normalized.sort((left, right) => right.createdAt - left.createdAt);
}

export async function loadPreferredWechatBindSessions(): Promise<WechatBindSession[]> {
  const localSessions = loadWechatBindSessions();

  try {
    const persisted = await loadJsonRecord<WechatBindSession[]>(STORAGE_KEYS.wechatBindSessions);
    if (Array.isArray(persisted)) {
      const normalizedSessions = normalizeSessions(persisted).sort((left, right) => right.createdAt - left.createdAt);
      if (JSON.stringify(localSessions) !== JSON.stringify(normalizedSessions)) {
        saveJson(STORAGE_KEYS.wechatBindSessions, normalizedSessions);
      }
      return normalizedSessions;
    }
  } catch (error) {
    console.error('[bindSessionStore] Failed to load WeChat bind sessions from IndexedDB', error);
  }

  return localSessions;
}

export function saveWechatBindSessions(sessions: WechatBindSession[]): void {
  const normalizedSessions = normalizeSessions(sessions);
  saveJson(STORAGE_KEYS.wechatBindSessions, normalizedSessions);
  void saveJsonRecord(STORAGE_KEYS.wechatBindSessions, normalizedSessions).catch((error) => {
    console.error('[bindSessionStore] Failed to persist WeChat bind sessions into IndexedDB', error);
  });
}

export function createWechatBindSession(params: {
  characterId: string;
  bloomUserId: string;
  characterName?: string;
  characterAvatarUrl?: string;
  appOrigin?: string;
}): WechatBindSession {
  const bindTaskId = createToken();
  const token = createToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + BIND_SESSION_LIFETIME_MS;
  const baseOrigin = params.appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid');
  const connectTarget = buildWechatConnectUrl({
    appOrigin: baseOrigin,
    token,
    bloomUserId: params.bloomUserId,
    characterId: params.characterId,
  });
  const session: WechatBindSession = {
    bindTaskId,
    token,
    channel: 'wechat-clawbot',
    bloomUserId: params.bloomUserId,
    characterId: params.characterId,
    characterName: params.characterName,
    characterAvatarUrl: params.characterAvatarUrl,
    qrText: connectTarget.qrText,
    bindCallbackUrl: connectTarget.bindCallbackUrl,
    openClawConnectUrl: connectTarget.openClawConnectUrl,
    status: 'pending',
    createdAt,
    expiresAt,
  };
  saveWechatBindSessions([
    session,
    ...loadWechatBindSessions().filter(
      (item) => !(item.characterId === params.characterId && item.bloomUserId === params.bloomUserId),
    ),
  ]);
  return session;
}

export function getWechatBindSessionByCharacterId(characterId: string, bloomUserId?: string): WechatBindSession | null {
  return loadWechatBindSessions().find(
    (session) => session.characterId === characterId && (!bloomUserId || session.bloomUserId === bloomUserId),
  ) || null;
}

export function getWechatBindSessionByToken(token: string): WechatBindSession | null {
  return loadWechatBindSessions().find((session) => session.token === token) || null;
}

export function markWechatBindSessionBound(
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
): WechatBindSession | null {
  const sessions = loadWechatBindSessions();
  const target = sessions.find((session) => session.token === token);
  if (!target) return null;

  const resolvedConversationId = payload.conversationId?.trim()
    || payload.channelPeerId?.trim()
    || payload.wechatIdentity?.trim();
  if (!resolvedConversationId) {
    return null;
  }

  const updatedSession: WechatBindSession = {
    ...target,
    status: 'bound',
    connectedAt: Date.now(),
    wechatIdentity: payload.wechatIdentity?.trim() || target.wechatIdentity,
    channelAccountId: payload.channelAccountId?.trim() || target.channelAccountId,
    channelPeerId: payload.channelPeerId?.trim() || target.channelPeerId,
    openClawPairingId: payload.openClawPairingId?.trim() || target.openClawPairingId,
    boundConversationId: resolvedConversationId,
    boundDisplayName: payload.displayName,
  };

  const nextSessions = sessions.map((session) => (session.token === token ? updatedSession : session));
  saveWechatBindSessions(nextSessions);

  const binding: WechatRoleBinding = {
    id: `wxbind_${target.bloomUserId}_${target.characterId}`,
    channel: 'wechat-clawbot',
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
  upsertWechatRoleBinding(binding);
  return updatedSession;
}
