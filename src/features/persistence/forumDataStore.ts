import type { ForumData } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function hydrateForumData(
  source: Partial<ForumData> | null | undefined,
  fallback: ForumData,
): ForumData {
  return {
    posts: Array.isArray(source?.posts) ? source!.posts : fallback.posts,
    notifications: Array.isArray(source?.notifications) ? source!.notifications : fallback.notifications,
    followedUsers: Array.isArray(source?.followedUsers) ? source!.followedUsers : fallback.followedUsers,
    followerMap: source?.followerMap && typeof source.followerMap === 'object'
      ? source.followerMap
      : fallback.followerMap,
    tempChats: source?.tempChats && typeof source.tempChats === 'object'
      ? source.tempChats
      : fallback.tempChats,
    runtimeAuthorProfiles: source?.runtimeAuthorProfiles && typeof source.runtimeAuthorProfiles === 'object'
      ? source.runtimeAuthorProfiles
      : fallback.runtimeAuthorProfiles,
    composerDraft: source?.composerDraft && typeof source.composerDraft === 'object'
      ? source.composerDraft
      : fallback.composerDraft,
    spectatorSettings: source?.spectatorSettings && typeof source.spectatorSettings === 'object'
      ? source.spectatorSettings
      : fallback.spectatorSettings,
  };
}

export function loadPersistedForumData(fallback: ForumData): ForumData {
  const persisted = loadJson<Partial<ForumData> | null>(STORAGE_KEYS.forumData, null);
  return hydrateForumData(persisted ? { ...fallback, ...persisted } : fallback, fallback);
}

export function persistForumData(data: ForumData): void {
  saveJson(STORAGE_KEYS.forumData, data);
}

export function clearPersistedForumData(): void {
  removeStoredJson(STORAGE_KEYS.forumData);
}
