import type { ForumData } from '../../types';
import { normalizeForumGlobalSettings } from '../../services/forum/forumGlobalSettings';
import { normalizeForumRuntimeAuthorProfiles } from '../../services/social-id/stableNumericId';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function hydrateForumData(
  source: Partial<ForumData> | null | undefined,
  fallback: ForumData,
): ForumData {
  const runtimeAuthorProfiles = normalizeForumRuntimeAuthorProfiles(
    source?.runtimeAuthorProfiles && typeof source.runtimeAuthorProfiles === 'object'
      ? source.runtimeAuthorProfiles
      : fallback.runtimeAuthorProfiles,
  );

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
    pinnedChatAuthorIds: Array.isArray(source?.pinnedChatAuthorIds) ? source!.pinnedChatAuthorIds : fallback.pinnedChatAuthorIds,
    pinnedPostIds: Array.isArray(source?.pinnedPostIds) ? source!.pinnedPostIds : fallback.pinnedPostIds,
    runtimeAuthorProfiles,
    composerDraft: source?.composerDraft && typeof source.composerDraft === 'object'
      ? source.composerDraft
      : fallback.composerDraft,
    spectatorSettings: source?.spectatorSettings && typeof source.spectatorSettings === 'object'
      ? source.spectatorSettings
      : fallback.spectatorSettings,
    globalSettings: normalizeForumGlobalSettings(
      source?.globalSettings && typeof source.globalSettings === 'object'
        ? source.globalSettings
        : fallback.globalSettings,
    ),
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
