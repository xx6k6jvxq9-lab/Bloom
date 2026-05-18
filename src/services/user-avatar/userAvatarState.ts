import type {
  RelationshipAvatarBinding,
  RelationshipAvatarScene,
  UserAvatarLibrary,
  UserAvatarLibraryEntry,
  UserProfileExtended,
} from '../../types';

const EMPTY_USER_AVATAR_LIBRARY: UserAvatarLibrary = {
  entries: [],
  updatedAt: 0,
};

export const RELATIONSHIP_AVATAR_SCENE_ORDER: RelationshipAvatarScene[] = [
  'direct_chat',
  'dating',
  'couple_space',
  'music_together',
];

export const RELATIONSHIP_AVATAR_SCENE_LABELS: Record<RelationshipAvatarScene, string> = {
  direct_chat: '单聊',
  dating: '约会',
  couple_space: '情侣空间',
  music_together: '一起听歌',
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTagList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const nextTags = value
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return nextTags.length > 0 ? [...new Set(nextTags)] : undefined;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : fallback;
}

export function normalizeUserAvatarLibraryEntry(
  source: Partial<UserAvatarLibraryEntry> | null | undefined,
  fallbackUpdatedAt = Date.now(),
): UserAvatarLibraryEntry | null {
  const image = normalizeText(source?.image);
  if (!image) {
    return null;
  }

  const addedAt = normalizeTimestamp(source?.addedAt, fallbackUpdatedAt);
  const updatedAt = normalizeTimestamp(source?.updatedAt, addedAt);
  const id = normalizeText(source?.id) || `user_avatar_${updatedAt}_${Math.random().toString(16).slice(2, 8)}`;
  const label = normalizeText(source?.label);
  const note = normalizeText(source?.note);

  return {
    id,
    image,
    source: source?.source || 'manual',
    addedAt,
    updatedAt,
    ...(label ? { label } : {}),
    ...(note ? { note } : {}),
    ...(normalizeTagList(source?.tags) ? { tags: normalizeTagList(source?.tags) } : {}),
  };
}

export function normalizeUserAvatarLibrary(
  library: Partial<UserAvatarLibrary> | null | undefined,
): UserAvatarLibrary {
  const entries = Array.isArray(library?.entries)
    ? library.entries
        .map((entry) => normalizeUserAvatarLibraryEntry(entry))
        .filter((entry): entry is UserAvatarLibraryEntry => !!entry)
    : [];

  const updatedAt = entries.reduce(
    (maxValue, entry) => Math.max(maxValue, entry.updatedAt),
    normalizeTimestamp(library?.updatedAt, 0),
  );

  return {
    entries,
    updatedAt,
  };
}

function normalizeSceneIds(value: unknown): RelationshipAvatarScene[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const nextScenes = value.filter(
    (scene): scene is RelationshipAvatarScene => (
      scene === 'direct_chat'
      || scene === 'dating'
      || scene === 'couple_space'
      || scene === 'music_together'
    ),
  );

  return nextScenes.length > 0 ? [...new Set(nextScenes)] : undefined;
}

export function resolveEffectiveRelationshipAvatarScenes(
  binding: RelationshipAvatarBinding | null | undefined,
): RelationshipAvatarScene[] {
  if (!binding) {
    return [];
  }

  if (!binding.sceneIds?.length) {
    return [...RELATIONSHIP_AVATAR_SCENE_ORDER];
  }

  // Backward-compatible behavior:
  // earlier bindings were stored as direct_chat-only, but the product later
  // upgraded them to relationship-wide avatar preferences.
  if (binding.sceneIds.length === 1 && binding.sceneIds[0] === 'direct_chat') {
    return [...RELATIONSHIP_AVATAR_SCENE_ORDER];
  }

  return RELATIONSHIP_AVATAR_SCENE_ORDER.filter((scene) => binding.sceneIds?.includes(scene));
}

export function normalizeRelationshipAvatarBinding(
  source: Partial<RelationshipAvatarBinding> | null | undefined,
): RelationshipAvatarBinding | null {
  const characterId = normalizeText(source?.characterId);
  const userAvatarEntryId = normalizeText(source?.userAvatarEntryId);
  if (!characterId || !userAvatarEntryId) {
    return null;
  }

  const characterAvatarEntryId = normalizeText(source?.characterAvatarEntryId);

  return {
    characterId,
    userAvatarEntryId,
    ...(characterAvatarEntryId ? { characterAvatarEntryId } : {}),
    ...(normalizeSceneIds(source?.sceneIds) ? { sceneIds: normalizeSceneIds(source?.sceneIds) } : {}),
    updatedAt: normalizeTimestamp(source?.updatedAt, Date.now()),
  };
}

export function normalizeRelationshipAvatarBindings(
  bindings: RelationshipAvatarBinding[] | null | undefined,
): RelationshipAvatarBinding[] {
  if (!Array.isArray(bindings)) {
    return [];
  }

  const bindingByCharacterId = new Map<string, RelationshipAvatarBinding>();
  bindings.forEach((binding) => {
    const normalized = normalizeRelationshipAvatarBinding(binding);
    if (!normalized) {
      return;
    }

    const previous = bindingByCharacterId.get(normalized.characterId);
    if (!previous || normalized.updatedAt >= previous.updatedAt) {
      bindingByCharacterId.set(normalized.characterId, normalized);
    }
  });

  return [...bindingByCharacterId.values()].sort((left, right) => left.characterId.localeCompare(right.characterId));
}

function createUserAvatarLibraryEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `user_avatar_${crypto.randomUUID()}`;
  }

  return `user_avatar_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function createUserAvatarLibraryEntry(params: {
  image: string;
  source: UserAvatarLibraryEntry['source'];
  label?: string;
  note?: string;
  tags?: string[];
  now?: number;
}): UserAvatarLibraryEntry {
  const now = params.now ?? Date.now();
  const image = params.image.trim();

  return {
    id: createUserAvatarLibraryEntryId(),
    image,
    source: params.source,
    addedAt: now,
    updatedAt: now,
    ...(normalizeText(params.label) ? { label: normalizeText(params.label) } : {}),
    ...(normalizeText(params.note) ? { note: normalizeText(params.note) } : {}),
    ...(normalizeTagList(params.tags) ? { tags: normalizeTagList(params.tags) } : {}),
  };
}

export function upsertUserAvatarLibraryEntry(params: {
  library: UserAvatarLibrary | null | undefined;
  entry: UserAvatarLibraryEntry;
}): UserAvatarLibrary {
  const normalizedLibrary = normalizeUserAvatarLibrary(params.library);
  const existingIndex = normalizedLibrary.entries.findIndex((entry) => (
    entry.id === params.entry.id
    || entry.image === params.entry.image
  ));
  const updatedAt = Math.max(Date.now(), params.entry.updatedAt);
  const existingEntry = existingIndex >= 0 ? normalizedLibrary.entries[existingIndex] : null;
  const nextEntry = {
    ...params.entry,
    id: existingEntry?.id || params.entry.id,
    addedAt: existingEntry?.addedAt || params.entry.addedAt,
    updatedAt,
  };

  if (existingIndex < 0) {
    return {
      entries: [nextEntry, ...normalizedLibrary.entries],
      updatedAt,
    };
  }

  const nextEntries = [...normalizedLibrary.entries];
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    ...nextEntry,
  };

  return {
    entries: nextEntries,
    updatedAt,
  };
}

export function updateUserAvatarLibraryEntry(params: {
  library: UserAvatarLibrary | null | undefined;
  entryId: string;
  updates: {
    label?: string | null;
    note?: string | null;
    tags?: string[] | null;
  };
}): UserAvatarLibrary {
  const normalizedLibrary = normalizeUserAvatarLibrary(params.library);
  const updatedAt = Date.now();
  const nextEntries = normalizedLibrary.entries.map((entry) => {
    if (entry.id !== params.entryId) {
      return entry;
    }

    const nextLabel = 'label' in params.updates ? normalizeText(params.updates.label) : entry.label;
    const nextNote = 'note' in params.updates ? normalizeText(params.updates.note) : entry.note;
    const nextTags = 'tags' in params.updates ? normalizeTagList(params.updates.tags) : entry.tags;

    return {
      ...entry,
      ...(nextLabel ? { label: nextLabel } : { label: undefined }),
      ...(nextNote ? { note: nextNote } : { note: undefined }),
      ...(nextTags?.length ? { tags: nextTags } : { tags: undefined }),
      updatedAt,
    };
  });

  return {
    entries: nextEntries,
    updatedAt,
  };
}

export function removeUserAvatarLibraryEntry(
  library: UserAvatarLibrary | null | undefined,
  entryId: string,
): UserAvatarLibrary | undefined {
  const normalizedLibrary = normalizeUserAvatarLibrary(library);
  const nextEntries = normalizedLibrary.entries.filter((entry) => entry.id !== entryId);

  if (nextEntries.length === 0) {
    return undefined;
  }

  return {
    entries: nextEntries,
    updatedAt: Date.now(),
  };
}

export function upsertRelationshipAvatarBinding(params: {
  bindings: RelationshipAvatarBinding[] | null | undefined;
  binding: RelationshipAvatarBinding;
}): RelationshipAvatarBinding[] {
  const nextBinding = normalizeRelationshipAvatarBinding(params.binding);
  if (!nextBinding) {
    return normalizeRelationshipAvatarBindings(params.bindings);
  }

  const normalizedBindings = normalizeRelationshipAvatarBindings(params.bindings);
  const nextBindings = normalizedBindings.filter((binding) => binding.characterId !== nextBinding.characterId);
  nextBindings.push(nextBinding);
  return nextBindings.sort((left, right) => left.characterId.localeCompare(right.characterId));
}

export function removeRelationshipAvatarBinding(
  bindings: RelationshipAvatarBinding[] | null | undefined,
  characterId: string,
): RelationshipAvatarBinding[] {
  return normalizeRelationshipAvatarBindings(bindings).filter((binding) => binding.characterId !== characterId);
}

export function countRelationshipBindingsForUserAvatarEntry(
  bindings: RelationshipAvatarBinding[] | null | undefined,
  entryId: string,
): number {
  return normalizeRelationshipAvatarBindings(bindings).filter((binding) => binding.userAvatarEntryId === entryId).length;
}

export function pruneRelationshipAvatarBindings(params: {
  bindings: RelationshipAvatarBinding[] | null | undefined;
  library: UserAvatarLibrary | null | undefined;
}): RelationshipAvatarBinding[] {
  const normalizedBindings = normalizeRelationshipAvatarBindings(params.bindings);
  const validEntryIds = new Set(normalizeUserAvatarLibrary(params.library).entries.map((entry) => entry.id));

  return normalizedBindings.filter((binding) => validEntryIds.has(binding.userAvatarEntryId));
}

export function bindingMatchesScene(
  binding: RelationshipAvatarBinding,
  scene: RelationshipAvatarScene | undefined,
): boolean {
  if (!scene || !binding.sceneIds?.length) {
    return true;
  }

  return binding.sceneIds.includes(scene);
}

function findRelationshipAvatarBinding(params: {
  bindings: RelationshipAvatarBinding[];
  characterId: string;
  scene?: RelationshipAvatarScene;
}): RelationshipAvatarBinding | null {
  const exactMatch = params.bindings.find((binding) => (
    binding.characterId === params.characterId
    && bindingMatchesScene(binding, params.scene)
  )) || null;
  if (exactMatch) {
    return exactMatch;
  }

  // Backward-compatible fallback:
  // early V1 bindings were stored as direct_chat-only even though the product
  // later started reusing the same "relationship avatar" across dating,
  // couple-space, and music-together.
  return params.bindings.find((binding) => binding.characterId === params.characterId) || null;
}

export function resolveUserAvatarForScene(params: {
  userProfile: UserProfileExtended;
  userAvatarLibrary?: UserAvatarLibrary | null;
  relationshipAvatarBindings?: RelationshipAvatarBinding[] | null;
  characterId?: string | null;
  scene?: RelationshipAvatarScene;
}) {
  const normalizedLibrary = normalizeUserAvatarLibrary(params.userAvatarLibrary);
  const normalizedBindings = normalizeRelationshipAvatarBindings(params.relationshipAvatarBindings);
  const defaultAvatar = normalizeText(params.userProfile.avatar);

  if (!params.characterId) {
    return {
      avatar: defaultAvatar,
      source: 'default' as const,
      entry: null,
      binding: null,
    };
  }

  const activeBinding = findRelationshipAvatarBinding({
    bindings: normalizedBindings,
    characterId: params.characterId,
    scene: params.scene,
  });

  if (!activeBinding) {
    return {
      avatar: defaultAvatar,
      source: 'default' as const,
      entry: null,
      binding: null,
    };
  }

  const entry = normalizedLibrary.entries.find((item) => item.id === activeBinding.userAvatarEntryId) || null;
  if (!entry?.image) {
    return {
      avatar: defaultAvatar,
      source: 'default' as const,
      entry: null,
      binding: activeBinding,
    };
  }

  return {
    avatar: entry.image,
    source: 'relationship_binding' as const,
    entry,
    binding: activeBinding,
  };
}

export function getEmptyUserAvatarLibrary(): UserAvatarLibrary {
  return EMPTY_USER_AVATAR_LIBRARY;
}
