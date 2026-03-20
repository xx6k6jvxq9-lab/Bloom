import type { FriendRequest } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function hydrateFriendRequests(
  source: FriendRequest[] | null | undefined,
  fallback: FriendRequest[],
): FriendRequest[] {
  return Array.isArray(source) ? source : fallback;
}

export function loadPersistedFriendRequests(fallback: FriendRequest[]): FriendRequest[] {
  const persisted = loadJson<FriendRequest[] | null>(STORAGE_KEYS.friendRequests, null);
  return hydrateFriendRequests(persisted, fallback);
}

export function persistFriendRequests(data: FriendRequest[]): void {
  saveJson(STORAGE_KEYS.friendRequests, data);
}

export function clearPersistedFriendRequests(): void {
  removeStoredJson(STORAGE_KEYS.friendRequests);
}
