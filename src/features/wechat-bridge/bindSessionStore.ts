import { loadJsonRecord, saveJsonRecord } from '../persistence/browserJsonStore';
import { loadJson, saveJson } from '../persistence/localConfigStore';
import { STORAGE_KEYS } from '../persistence/storageKeys';
import type { WechatBindSession, WechatRoleBinding } from './types';
import { upsertWechatRoleBinding } from './bindingsStore';

const BIND_SESSION_LIFETIME_MS = 1000 * 60 * 10;

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

export function createWechatBindSession(characterId: string, appOrigin?: string): WechatBindSession {
  const token = createToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + BIND_SESSION_LIFETIME_MS;
  const baseOrigin = appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid');
  const qrText = `${baseOrigin}/wechat/bind?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(characterId)}`;
  const session: WechatBindSession = {
    token,
    channel: 'wechat-clawbot',
    characterId,
    qrText,
    status: 'pending',
    createdAt,
    expiresAt,
  };
  saveWechatBindSessions([session, ...loadWechatBindSessions().filter((item) => item.characterId !== characterId)]);
  return session;
}

export function getWechatBindSessionByCharacterId(characterId: string): WechatBindSession | null {
  return loadWechatBindSessions().find((session) => session.characterId === characterId) || null;
}

export function getWechatBindSessionByToken(token: string): WechatBindSession | null {
  return loadWechatBindSessions().find((session) => session.token === token) || null;
}

export function markWechatBindSessionBound(
  token: string,
  payload: {
    conversationId: string;
    displayName?: string;
    avatarUrl?: string;
  },
): WechatBindSession | null {
  const sessions = loadWechatBindSessions();
  const target = sessions.find((session) => session.token === token);
  if (!target) return null;

  const updatedSession: WechatBindSession = {
    ...target,
    status: 'bound',
    boundConversationId: payload.conversationId,
    boundDisplayName: payload.displayName,
  };

  const nextSessions = sessions.map((session) => (session.token === token ? updatedSession : session));
  saveWechatBindSessions(nextSessions);

  const binding: WechatRoleBinding = {
    id: `wxbind_${target.characterId}`,
    channel: 'wechat-clawbot',
    conversationId: payload.conversationId,
    characterId: target.characterId,
    enabled: true,
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl,
    createdAt: target.createdAt,
    updatedAt: Date.now(),
  };
  upsertWechatRoleBinding(binding);
  return updatedSession;
}
