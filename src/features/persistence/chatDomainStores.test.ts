import assert from 'node:assert/strict';
import test from 'node:test';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import {
  hydrateChatOrganization,
  loadPreferredChatOrganization,
  persistChatOrganization,
  type ChatOrganizationData,
} from './chatOrganizationStore';
import {
  hydrateFriendRequests,
  loadPreferredFriendRequests,
  persistFriendRequests,
} from './friendRequestsStore';
import { STORAGE_KEYS } from './storageKeys';
import {
  clearPersistenceKeys,
  fakeLocalStorage,
  installPersistenceTestEnvironment,
} from './testPersistenceHarness';
import type { ChatGroup, FriendRequest } from '../../types';

type PersistedFriendRequestsValue =
  | FriendRequest[]
  | {
      items: FriendRequest[];
      updatedAt?: number;
    };

function buildFriendRequest(id: string, message: string): FriendRequest {
  return {
    id,
    fromUserId: `char-${id}`,
    fromUserName: `Role ${id}`,
    fromUserAvatar: '',
    status: 'pending',
    timestamp: Number(id.replace(/\D+/g, '')) || Date.now(),
    message,
  };
}

function buildChatGroup(id: string, name: string): ChatGroup {
  return {
    id,
    name,
    memberIds: ['char-a'],
    creatorId: 'user',
    createdAt: 100,
  };
}

async function clearChatDomainState() {
  await clearPersistenceKeys([STORAGE_KEYS.friendRequests, STORAGE_KEYS.chatOrganization]);
  fakeLocalStorage.removeItem(STORAGE_KEYS.friendRequests);
  fakeLocalStorage.removeItem(STORAGE_KEYS.chatOrganization);
  await removeJsonRecord(STORAGE_KEYS.friendRequests).catch(() => undefined);
  await removeJsonRecord(STORAGE_KEYS.chatOrganization).catch(() => undefined);
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  await clearChatDomainState();
});

test('loadPreferredFriendRequests migrates legacy localStorage data into IndexedDB', async () => {
  const legacyRequests = [buildFriendRequest('req-1', 'legacy request')];
  fakeLocalStorage.setItem(STORAGE_KEYS.friendRequests, JSON.stringify(legacyRequests));

  const hydrated = await loadPreferredFriendRequests([]);
  const persisted = await loadJsonRecord<PersistedFriendRequestsValue>(STORAGE_KEYS.friendRequests);
  const persistedItems = hydrateFriendRequests(persisted ?? null, []);

  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0]?.message, 'legacy request');
  assert.equal(persistedItems[0]?.message, 'legacy request');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.friendRequests), null);
});

test('persistFriendRequests only keeps IndexedDB as the source of truth', async () => {
  const nextRequests = [buildFriendRequest('req-2', 'idb only')];

  await persistFriendRequests(nextRequests);

  const persisted = await loadJsonRecord<PersistedFriendRequestsValue>(STORAGE_KEYS.friendRequests);
  const persistedItems = hydrateFriendRequests(persisted ?? null, []);

  assert.equal(persistedItems[0]?.message, 'idb only');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.friendRequests), null);
});

test('loadPreferredFriendRequests prefers newer local snapshots over stale IndexedDB data', async () => {
  const futureTimestamp = Date.now() + 10_000;
  const indexedDbRequests = {
    items: [buildFriendRequest('req-3', 'older idb')],
    updatedAt: 300,
  };
  const newerLocalRequests = {
    items: [buildFriendRequest('req-4', 'newer local')],
    updatedAt: futureTimestamp,
  };

  await saveJsonRecord(STORAGE_KEYS.friendRequests, indexedDbRequests);
  fakeLocalStorage.setItem(STORAGE_KEYS.friendRequests, JSON.stringify(newerLocalRequests));

  const hydrated = await loadPreferredFriendRequests([]);
  const persisted = await loadJsonRecord<PersistedFriendRequestsValue>(STORAGE_KEYS.friendRequests);
  const persistedItems = hydrateFriendRequests(persisted ?? null, []);

  assert.equal(hydrated[0]?.message, 'newer local');
  assert.equal(persistedItems[0]?.message, 'newer local');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.friendRequests), null);
});

test('loadPreferredChatOrganization migrates legacy localStorage data into IndexedDB', async () => {
  const legacyOrganization: ChatOrganizationData = {
    groups: ['Default', 'Friends'],
    chatGroups: [buildChatGroup('group-1', 'legacy group')],
  };
  fakeLocalStorage.setItem(STORAGE_KEYS.chatOrganization, JSON.stringify(legacyOrganization));

  const hydrated = await loadPreferredChatOrganization({
    groups: [],
    chatGroups: [],
  });
  const persisted = await loadJsonRecord<ChatOrganizationData>(STORAGE_KEYS.chatOrganization);

  assert.equal(hydrateChatOrganization(hydrated, { groups: [], chatGroups: [] }).chatGroups[0]?.name, 'legacy group');
  assert.equal(persisted?.chatGroups[0]?.name, 'legacy group');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatOrganization), null);
});

test('persistChatOrganization only keeps IndexedDB as the source of truth', async () => {
  const nextOrganization: ChatOrganizationData = {
    groups: ['Default', 'Groups'],
    chatGroups: [buildChatGroup('group-2', 'idb only')],
  };

  await persistChatOrganization(nextOrganization);

  const persisted = await loadJsonRecord<ChatOrganizationData>(STORAGE_KEYS.chatOrganization);

  assert.equal(persisted?.chatGroups[0]?.name, 'idb only');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatOrganization), null);
});

test('loadPreferredChatOrganization prefers newer local snapshots over stale IndexedDB data', async () => {
  const futureTimestamp = Date.now() + 10_000;
  const indexedDbOrganization: ChatOrganizationData = {
    updatedAt: 510,
    groups: ['Default'],
    chatGroups: [buildChatGroup('group-3', 'older idb')],
  };
  const newerLocalOrganization: ChatOrganizationData = {
    updatedAt: futureTimestamp,
    groups: ['Default', 'Friends'],
    chatGroups: [buildChatGroup('group-4', 'newer local')],
  };

  await saveJsonRecord(STORAGE_KEYS.chatOrganization, indexedDbOrganization);
  fakeLocalStorage.setItem(STORAGE_KEYS.chatOrganization, JSON.stringify(newerLocalOrganization));

  const hydrated = await loadPreferredChatOrganization({ groups: [], chatGroups: [] });
  const persisted = await loadJsonRecord<ChatOrganizationData>(STORAGE_KEYS.chatOrganization);

  assert.equal(hydrated.chatGroups[0]?.name, 'newer local');
  assert.equal(persisted?.chatGroups[0]?.name, 'newer local');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatOrganization), null);
});
