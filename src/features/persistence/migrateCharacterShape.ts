import type {
  CharacterActiveDatingState,
  Character,
  CharacterAvatarLibraryEntry,
  CharacterOpenLoopEntry,
  CharacterPublicThreadPeerHint,
  CharacterPresenceState,
  CharacterSharedState,
  MemoryLibraryEntry,
} from '../../types';
import { resolveCharacterCorePersonaCompat, resolveCharacterLongTermMemoryCompat } from '../../services/character/characterCompat';
import { normalizeMemoryLibraryEntries } from '../../services/memory/memoryLibrary';
import { applyAutoStickerMetadata, normalizeStickerMetadataMap } from '../../services/chat/stickerMetadata';
import {
  getCharacterNumericId,
  normalizeCharactersWithNumericIds,
} from '../../services/social-id/stableNumericId';
import type { CharacterSharedContextSnapshot } from '../../services/relationship-context/types';
import { CHARACTER_SCHEMA_VERSION } from './schemaVersions';

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeSceneHints(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, hint]) => [key, normalizeOptionalText(hint)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizePublicThreadPeerHints(value: unknown): CharacterPublicThreadPeerHint[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const entries = value
    .map((item): CharacterPublicThreadPeerHint | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const targetCharacterId = normalizeOptionalText(record.targetCharacterId);
      if (!targetCharacterId) {
        return null;
      }

      const familiarity = record.familiarity === 'aware'
        || record.familiarity === 'familiar'
        ? record.familiarity
        : 'stranger';
      const interactionStyle = record.interactionStyle === 'guarded'
        || record.interactionStyle === 'neutral'
        || record.interactionStyle === 'banter'
        || record.interactionStyle === 'warm'
        ? record.interactionStyle
        : undefined;
      const updatedAt = Number.isFinite(record.updatedAt) ? Math.max(0, Math.floor(record.updatedAt as number)) : undefined;

      return {
        targetCharacterId,
        familiarity,
        ...(interactionStyle ? { interactionStyle } : {}),
        ...(typeof record.allowBanter === 'boolean' ? { allowBanter: record.allowBanter } : {}),
        ...(typeof record.allowIntimateTone === 'boolean' ? { allowIntimateTone: record.allowIntimateTone } : {}),
        ...(typeof record.allowOwnershipTone === 'boolean' ? { allowOwnershipTone: record.allowOwnershipTone } : {}),
        ...(normalizeOptionalText(record.note) ? { note: normalizeOptionalText(record.note) } : {}),
        ...(typeof updatedAt === 'number' ? { updatedAt } : {}),
      };
    })
    .filter((entry): entry is CharacterPublicThreadPeerHint => Boolean(entry));

  return entries.length > 0 ? entries : undefined;
}

function normalizeAvatarLibraryEntries(value: unknown): CharacterAvatarLibraryEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const entries = value
    .map((entry): CharacterAvatarLibraryEntry | null => {
      if (!entry || typeof entry !== 'object') return null;

      const record = entry as Record<string, unknown>;
      const image = normalizeOptionalText(record.image);
      if (!image) return null;

      const source = record.source === 'upload'
        || record.source === 'url'
        || record.source === 'chat-image'
        || record.source === 'manual'
        || record.source === 'character-choice'
        ? record.source
        : 'manual';
      const status = record.status === 'current'
        || record.status === 'candidate'
        || record.status === 'saved'
        || record.status === 'rejected'
        || record.status === 'used'
        ? record.status
        : 'candidate';
      const addedAt = Number.isFinite(record.addedAt) ? Math.max(0, Math.floor(record.addedAt as number)) : Date.now();
      const updatedAt = Number.isFinite(record.updatedAt) ? Math.max(0, Math.floor(record.updatedAt as number)) : addedAt;

      return {
        id: normalizeOptionalText(record.id) || `avatar-library-${addedAt}-${Math.random().toString(16).slice(2)}`,
        image,
        source,
        status,
        addedAt,
        updatedAt,
        ...(Number.isFinite(record.firstMessageTimestamp)
          ? { firstMessageTimestamp: Math.max(0, Math.floor(record.firstMessageTimestamp as number)) }
          : {}),
        ...(Number.isFinite(record.lastUsedAt)
          ? { lastUsedAt: Math.max(0, Math.floor(record.lastUsedAt as number)) }
          : {}),
        ...(normalizeOptionalText(record.reaction) ? { reaction: normalizeOptionalText(record.reaction) } : {}),
        ...(normalizeOptionalText(record.reason) ? { reason: normalizeOptionalText(record.reason) } : {}),
        ...(normalizeOptionalText(record.label) ? { label: normalizeOptionalText(record.label) } : {}),
        ...(Array.isArray(record.tags)
          ? { tags: record.tags.map(normalizeOptionalText).filter((tag): tag is string => Boolean(tag)) }
          : {}),
      };
    })
    .filter((entry): entry is CharacterAvatarLibraryEntry => Boolean(entry));

  return entries.length > 0 ? entries : undefined;
}

function normalizeReplyLanguageMode(value: unknown): Character['replyLanguageMode'] {
  return value === 'chinese-with-native-flavor'
    || value === 'native-first'
    || value === 'fixed'
    ? value
    : 'follow-user';
}

function normalizeOpenLoopRegistry(value: unknown): CharacterOpenLoopEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const entries = value
    .map((item): CharacterOpenLoopEntry | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const content = normalizeOptionalText(record.content);
      if (!content) return null;

      const kind = record.kind === 'scene'
        || record.kind === 'relationship'
        || record.kind === 'task'
        ? record.kind
        : 'unknown';
      const status = record.status === 'active'
        || record.status === 'waiting_user'
        || record.status === 'dormant'
        || record.status === 'resolved'
        ? record.status
        : 'waiting_user';
      const source = record.source === 'short_term_summary'
        || record.source === 'recent_history'
        || record.source === 'manual'
        ? record.source
        : 'manual';
      const createdAt = Number.isFinite(record.createdAt) ? Math.max(0, Math.floor(record.createdAt as number)) : Date.now();
      const lastTouchedAt = Number.isFinite(record.lastTouchedAt) ? Math.max(0, Math.floor(record.lastTouchedAt as number)) : createdAt;
      const updatedAt = Number.isFinite(record.updatedAt) ? Math.max(0, Math.floor(record.updatedAt as number)) : lastTouchedAt;

      return {
        id: normalizeOptionalText(record.id) || `open-loop-${createdAt}-${Math.random().toString(16).slice(2)}`,
        kind,
        status,
        source,
        content,
        createdAt,
        lastTouchedAt,
        updatedAt,
        ...(normalizeOptionalText(record.resumeHint) ? { resumeHint: normalizeOptionalText(record.resumeHint) } : {}),
      };
    })
    .filter((entry): entry is CharacterOpenLoopEntry => Boolean(entry));

  return entries.length > 0 ? entries : undefined;
}

function normalizePresenceState(value: unknown): CharacterPresenceState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const lastSeenAt = Number.isFinite(record.lastSeenAt) ? Math.max(0, Math.floor(record.lastSeenAt as number)) : null;
  const updatedAt = Number.isFinite(record.updatedAt) ? Math.max(0, Math.floor(record.updatedAt as number)) : lastSeenAt;
  if (lastSeenAt == null || updatedAt == null) {
    return undefined;
  }

  return {
    lastSeenAt,
    availability: record.availability === 'live'
      || record.availability === 'recent'
      || record.availability === 'returning'
      ? record.availability
      : 'away',
    updatedAt,
    ...(normalizeOptionalText(record.recentLifeBeat) ? { recentLifeBeat: normalizeOptionalText(record.recentLifeBeat) } : {}),
    ...(record.resumeTone === 'natural_continue'
      || record.resumeTone === 'soft_return'
      || record.resumeTone === 'fresh_reentry'
      ? { resumeTone: record.resumeTone }
      : {}),
  };
}

function normalizeSharedState(value: unknown): CharacterSharedState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const updatedAt = Number.isFinite(record.updatedAt) ? Math.max(0, Math.floor(record.updatedAt as number)) : null;
  if (updatedAt == null) {
    return undefined;
  }

  return {
    updatedAt,
    sourceScene:
      record.sourceScene === 'direct_chat'
      || record.sourceScene === 'group_chat'
      || record.sourceScene === 'dating'
      || record.sourceScene === 'music_together'
      || record.sourceScene === 'couple_space'
      || record.sourceScene === 'forum'
      || record.sourceScene === 'moments'
        ? record.sourceScene
        : 'direct_chat',
    availability: record.availability === 'live'
      || record.availability === 'recent'
      || record.availability === 'returning'
      ? record.availability
      : 'away',
    ...(record.resumeTone === 'natural_continue'
      || record.resumeTone === 'soft_return'
      || record.resumeTone === 'fresh_reentry'
      ? { resumeTone: record.resumeTone }
      : {}),
    ...(normalizeOptionalText(record.currentActivity) ? { currentActivity: normalizeOptionalText(record.currentActivity) } : {}),
    ...(normalizeOptionalText(record.attentionNote) ? { attentionNote: normalizeOptionalText(record.attentionNote) } : {}),
    ...(normalizeOptionalText(record.publicCarryover) ? { publicCarryover: normalizeOptionalText(record.publicCarryover) } : {}),
    ...(normalizeOptionalText(record.privateCarryover) ? { privateCarryover: normalizeOptionalText(record.privateCarryover) } : {}),
  };
}

function normalizeActiveDatingState(value: unknown): CharacterActiveDatingState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const sessionId = normalizeOptionalText(record.sessionId);
  const summary = normalizeOptionalText(record.summary);
  const startedAt = Number.isFinite(record.startedAt) ? Math.max(0, Math.floor(record.startedAt as number)) : null;
  const updatedAt = Number.isFinite(record.updatedAt) ? Math.max(0, Math.floor(record.updatedAt as number)) : startedAt;
  if (!sessionId || !summary || startedAt == null || updatedAt == null) {
    return undefined;
  }

  return {
    sessionId,
    summary,
    startedAt,
    updatedAt,
    status: 'active',
    ...(normalizeOptionalText(record.relationshipResidue)
      ? { relationshipResidue: normalizeOptionalText(record.relationshipResidue) }
      : {}),
    ...(normalizeOptionalText(record.sceneProgressSummary)
      ? { sceneProgressSummary: normalizeOptionalText(record.sceneProgressSummary) }
      : {}),
    ...(normalizeOptionalText(record.boundaryNote)
      ? { boundaryNote: normalizeOptionalText(record.boundaryNote) }
      : {}),
  };
}

function normalizeSharedContextSnapshots(value: unknown): CharacterSharedContextSnapshot[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const normalizeTypedItems = <T extends { summary: string; timestamp: number }>(
    items: unknown,
    expectedType: 'relationship_residue' | 'scene_residue' | 'topic_anchor' | 'task_residue',
  ): T[] | undefined => {
    if (!Array.isArray(items)) return undefined;

    const normalized = items
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        const summary = normalizeOptionalText(record.summary);
        const timestamp = Number.isFinite(record.timestamp) ? Math.max(0, Math.floor(record.timestamp as number)) : null;
        if (!summary || timestamp == null) {
          return null;
        }

        return {
          type: record.type === expectedType ? record.type : expectedType,
          summary,
          sourceScene:
            record.sourceScene === 'direct_chat'
            || record.sourceScene === 'group_chat'
            || record.sourceScene === 'dating'
            || record.sourceScene === 'music_together'
            || record.sourceScene === 'couple_space'
            || record.sourceScene === 'moments'
              ? record.sourceScene
              : 'dating',
          timestamp,
          decay: record.decay === 'stable' || record.decay === 'medium' ? record.decay : 'short',
          visibility:
            record.visibility === 'private'
            || record.visibility === 'group_public'
            || record.visibility === 'cross_scene_readable'
              ? record.visibility
              : 'cross_scene_readable',
        } as unknown as T;
      })
      .filter((entry): entry is T => Boolean(entry));

    return normalized.length > 0 ? normalized : undefined;
  };

  const snapshots = value
    .map((item): CharacterSharedContextSnapshot | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const settledAt = Number.isFinite(record.settledAt) ? Math.max(0, Math.floor(record.settledAt as number)) : null;
      if (settledAt == null) {
        return null;
      }

      const sourceScene =
        record.sourceScene === 'direct_chat'
        || record.sourceScene === 'group_chat'
        || record.sourceScene === 'dating'
        || record.sourceScene === 'music_together'
        || record.sourceScene === 'couple_space'
        || record.sourceScene === 'moments'
          ? record.sourceScene
          : 'dating';

      return {
        sourceScene,
        settledAt,
        ...(normalizeTypedItems(record.relationshipResidue, 'relationship_residue')
          ? { relationshipResidue: normalizeTypedItems(record.relationshipResidue, 'relationship_residue') }
          : {}),
        ...(normalizeTypedItems(record.sceneResidue, 'scene_residue')
          ? { sceneResidue: normalizeTypedItems(record.sceneResidue, 'scene_residue') }
          : {}),
        ...(normalizeTypedItems(record.topicAnchors, 'topic_anchor')
          ? { topicAnchors: normalizeTypedItems(record.topicAnchors, 'topic_anchor') }
          : {}),
        ...(normalizeTypedItems(record.taskResidue, 'task_residue')
          ? { taskResidue: normalizeTypedItems(record.taskResidue, 'task_residue') }
          : {}),
      };
    })
    .filter((entry): entry is CharacterSharedContextSnapshot => Boolean(entry));

  return snapshots.length > 0 ? snapshots : undefined;
}

function createLegacyShortTermMemoryEntry(character: Character, content: string): MemoryLibraryEntry {
  const createdAt = Number.isFinite(character.lastTime) ? Math.max(0, Math.floor(character.lastTime as number)) : Date.now();
  const date = new Date(createdAt);

  return {
    id: `memory-short-term-legacy-${character.id}`,
    kind: 'short-term',
    source: 'auto',
    content,
    createdAt,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    charCount: content.length,
  };
}

export function migrateCharacterShape(character: Character): Character {
  const corePersona = resolveCharacterCorePersonaCompat(character);
  const expressionStyle = normalizeOptionalText(character.expressionStyle);
  const boundaryPack = normalizeOptionalText(character.boundaryPack);
  const extendedLore = normalizeOptionalText(character.extendedLore);
  const longTermMemoryProfile = resolveCharacterLongTermMemoryCompat(character);
  const shortTermSummary = normalizeOptionalText(character.shortTermSummary);
  const sceneHints = normalizeSceneHints(character.sceneHints);
  const publicThreadPeerHints = normalizePublicThreadPeerHints(character.publicThreadPeerHints);
  const replyLanguageMode = normalizeReplyLanguageMode(character.replyLanguageMode);
  const nativeLanguage = normalizeOptionalText(character.nativeLanguage);
  const fixedReplyLanguage = normalizeOptionalText(character.fixedReplyLanguage);
  const momentPrivateCarryoverLevel = character.momentPrivateCarryoverLevel === 'light'
    || character.momentPrivateCarryoverLevel === 'medium'
    || character.momentPrivateCarryoverLevel === 'high'
    || character.momentPrivateCarryoverLevel === 'none'
    ? character.momentPrivateCarryoverLevel
    : typeof character.allowPrivateMomentCarryover === 'boolean'
      ? character.allowPrivateMomentCarryover ? 'light' : 'none'
      : undefined;
  const allowPrivateMomentCarryover = typeof character.allowPrivateMomentCarryover === 'boolean'
    ? character.allowPrivateMomentCarryover
    : undefined;
  const friendshipStatus = character.friendshipStatus === 'none' ? 'none' : 'friends';
  const blockedByUser = character.blockedByUser === true;
  const blockedByCharacter = character.blockedByCharacter === true;
  const relationshipStatusUpdatedAt = Number.isFinite(character.relationshipStatusUpdatedAt)
    ? Math.max(0, Math.floor(character.relationshipStatusUpdatedAt as number))
    : undefined;
  const avatarLibraryEntries = normalizeAvatarLibraryEntries(character.avatarLibrary?.entries);
  const openLoopRegistry = normalizeOpenLoopRegistry(character.openLoopRegistry);
  const presenceState = normalizePresenceState(character.presenceState);
  const sharedState = normalizeSharedState(character.sharedState);
  const activeDatingState = normalizeActiveDatingState(character.activeDatingState);
  const sharedContextSnapshots = normalizeSharedContextSnapshots(character.sharedContextSnapshots);
  const stickerMetadata = applyAutoStickerMetadata(
    character.stickers || [],
    normalizeStickerMetadataMap(character.stickerMetadata, character.stickers),
  ).metadataMap;
  let memoryLibraryEntries = normalizeMemoryLibraryEntries(character.memoryLibraryEntries);
  if (
    shortTermSummary &&
    !(memoryLibraryEntries ?? []).some((entry) => entry.kind === 'short-term')
  ) {
    memoryLibraryEntries = [
      createLegacyShortTermMemoryEntry(character, shortTermSummary),
      ...(memoryLibraryEntries ?? []),
    ].sort((left, right) => right.createdAt - left.createdAt);
  }

  return {
    ...character,
    numericId: getCharacterNumericId(character),
    corePersona,
    expressionStyle,
    boundaryPack,
    extendedLore,
    sceneHints,
    publicThreadPeerHints,
    replyLanguageMode,
    nativeLanguage,
    fixedReplyLanguage,
    ...(momentPrivateCarryoverLevel ? { momentPrivateCarryoverLevel } : {}),
    ...(typeof allowPrivateMomentCarryover === 'boolean' ? { allowPrivateMomentCarryover } : {}),
    friendshipStatus,
    blockedByUser,
    blockedByCharacter,
    relationshipStatusUpdatedAt,
    shortTermSummary,
    longTermMemoryProfile,
    memoryLibraryEntries,
    openLoopRegistry,
    presenceState,
    sharedState,
    activeDatingState,
    sharedContextSnapshots,
    stickerMetadata,
    avatarLibrary: avatarLibraryEntries
      ? {
          entries: avatarLibraryEntries,
          updatedAt: Number.isFinite(character.avatarLibrary?.updatedAt)
            ? Math.max(0, Math.floor(character.avatarLibrary!.updatedAt as number))
            : Math.max(...avatarLibraryEntries.map((entry) => entry.updatedAt)),
        }
      : undefined,
  };
}

export function migrateCharacterShapes(characters: Character[] | null | undefined): Character[] {
  if (!Array.isArray(characters)) return [];
  return normalizeCharactersWithNumericIds(characters.map(migrateCharacterShape));
}

export function getCharacterSchemaVersion(): number {
  return CHARACTER_SCHEMA_VERSION;
}
