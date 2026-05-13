import type { FriendRequest } from '../../types';
import { loadJsonRecordEnvelope, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

type PersistedFriendRequestsRecord = {
  items: FriendRequest[];
  updatedAt?: number;
};

function resolvePersistedFriendRequests(
  source: PersistedFriendRequestsRecord | FriendRequest[] | null | undefined,
): FriendRequest[] | null {
  if (Array.isArray(source)) {
    return source;
  }

  return Array.isArray(source?.items) ? source.items : null;
}

function resolveFriendRequestsUpdatedAt(
  source: PersistedFriendRequestsRecord | FriendRequest[] | null | undefined,
  fallbackUpdatedAt = 0,
): number {
  const explicitUpdatedAt = typeof source === 'object' && source && !Array.isArray(source)
    && typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt)
    ? source.updatedAt
    : 0;
  const items = resolvePersistedFriendRequests(source) || [];
  const latestRequestTimestamp = items.reduce((latestTimestamp, request) => (
    Math.max(
      latestTimestamp,
      typeof request.timestamp === 'number' && Number.isFinite(request.timestamp) ? request.timestamp : 0,
      typeof request.unreadAt === 'number' && Number.isFinite(request.unreadAt) ? request.unreadAt : 0,
      typeof request.relationshipRoundResolvedAt === 'number' && Number.isFinite(request.relationshipRoundResolvedAt)
        ? request.relationshipRoundResolvedAt
        : 0,
    )
  ), 0);

  return Math.max(explicitUpdatedAt, latestRequestTimestamp, Number.isFinite(fallbackUpdatedAt) ? fallbackUpdatedAt : 0);
}

function buildPersistedFriendRequestsRecord(
  items: FriendRequest[],
  updatedAt = Date.now(),
): PersistedFriendRequestsRecord {
  return {
    items,
    updatedAt,
  };
}

export function hydrateFriendRequests(
  source: PersistedFriendRequestsRecord | FriendRequest[] | null | undefined,
  fallback: FriendRequest[],
): FriendRequest[] {
  const resolved = resolvePersistedFriendRequests(source);
  return Array.isArray(resolved) ? resolved : fallback;
}

export function loadPersistedFriendRequests(fallback: FriendRequest[]): FriendRequest[] {
  return hydrateFriendRequests(
    loadJson<PersistedFriendRequestsRecord | FriendRequest[] | null>(STORAGE_KEYS.friendRequests, null),
    fallback,
  );
}

export async function loadPreferredFriendRequests(fallback: FriendRequest[]): Promise<FriendRequest[]> {
  const legacyLocalValue = loadJson<PersistedFriendRequestsRecord | FriendRequest[] | null>(
    STORAGE_KEYS.friendRequests,
    null,
  );

  try {
    const persistedEnvelope = await loadJsonRecordEnvelope<PersistedFriendRequestsRecord | FriendRequest[]>(
      STORAGE_KEYS.friendRequests,
    );
    const indexedDbUpdatedAt = resolveFriendRequestsUpdatedAt(
      persistedEnvelope.value,
      persistedEnvelope.updatedAt ?? 0,
    );
    const localUpdatedAt = resolveFriendRequestsUpdatedAt(legacyLocalValue, 0);
    const shouldPreferIndexedDb = !!resolvePersistedFriendRequests(persistedEnvelope.value) && (
      !legacyLocalValue || indexedDbUpdatedAt >= localUpdatedAt
    );

    if (shouldPreferIndexedDb) {
      removeStoredJson(STORAGE_KEYS.friendRequests);
      return hydrateFriendRequests(persistedEnvelope.value, fallback);
    }
  } catch (error) {
    console.error('[friendRequestsStore] Failed to load friend requests from IndexedDB', error);
  }

  if (legacyLocalValue) {
    const migratedValue = hydrateFriendRequests(legacyLocalValue, fallback);

    try {
      await saveJsonRecord(STORAGE_KEYS.friendRequests, buildPersistedFriendRequestsRecord(migratedValue));
      removeStoredJson(STORAGE_KEYS.friendRequests);
    } catch (error) {
      console.error('[friendRequestsStore] Failed to migrate legacy local friend requests into IndexedDB', error);
    }

    return migratedValue;
  }

  return fallback;
}

export async function persistFriendRequests(data: FriendRequest[]): Promise<void> {
  removeStoredJson(STORAGE_KEYS.friendRequests);

  try {
    await saveJsonRecord(STORAGE_KEYS.friendRequests, buildPersistedFriendRequestsRecord(data));
  } catch (error) {
    console.error('[friendRequestsStore] Failed to persist friend requests into IndexedDB', error);
  }
}

export function clearPersistedFriendRequests(): void {
  removeStoredJson(STORAGE_KEYS.friendRequests);
  void removeJsonRecord(STORAGE_KEYS.friendRequests).catch((error) => {
    console.error('[friendRequestsStore] Failed to remove friend requests from IndexedDB', error);
  });
}
