import type { Character, ForumRuntimeAuthorProfile } from '../../types';

const STABLE_NUMERIC_ID_REGEX = /^[1-9]\d{7}$/;
const STABLE_NUMERIC_ID_MIN = 10_000_000;
const STABLE_NUMERIC_ID_SPAN = 90_000_000;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildNumericIdCandidate(entityId: string, salt = 0): string {
  const hash = hashString(`${entityId}:${salt}`);
  return String(STABLE_NUMERIC_ID_MIN + (hash % STABLE_NUMERIC_ID_SPAN));
}

function claimUniqueNumericId(
  entityId: string,
  currentNumericId: string | null | undefined,
  usedIds: Set<string>,
): string {
  const preferredId = typeof currentNumericId === 'string' ? currentNumericId.trim() : '';
  if (isStableNumericId(preferredId) && !usedIds.has(preferredId)) {
    usedIds.add(preferredId);
    return preferredId;
  }

  let salt = 0;
  let candidate = buildNumericIdCandidate(entityId, salt);
  while (usedIds.has(candidate)) {
    salt += 1;
    candidate = buildNumericIdCandidate(entityId, salt);
  }
  usedIds.add(candidate);
  return candidate;
}

export function isStableNumericId(value: unknown): value is string {
  return typeof value === 'string' && STABLE_NUMERIC_ID_REGEX.test(value.trim());
}

export function resolveStableNumericId(entityId: string, currentNumericId?: string | null): string {
  const normalizedCurrentId = typeof currentNumericId === 'string' ? currentNumericId.trim() : '';
  return isStableNumericId(normalizedCurrentId)
    ? normalizedCurrentId
    : buildNumericIdCandidate(entityId, 0);
}

export function getCharacterNumericId(character: Pick<Character, 'id' | 'numericId'>): string {
  return resolveStableNumericId(character.id, character.numericId);
}

export function normalizeCharactersWithNumericIds(
  characters: Character[] | null | undefined,
): Character[] {
  if (!Array.isArray(characters)) {
    return [];
  }

  const usedIds = new Set<string>();
  return characters.map((character) => ({
    ...character,
    numericId: claimUniqueNumericId(character.id, character.numericId, usedIds),
  }));
}

export function getForumRuntimeAuthorNumericId(
  profile: Pick<ForumRuntimeAuthorProfile, 'id' | 'numericId'>,
): string {
  return resolveStableNumericId(profile.id, profile.numericId);
}

export function normalizeForumRuntimeAuthorProfiles(
  runtimeAuthorProfiles: Record<string, ForumRuntimeAuthorProfile> | null | undefined,
  linkedCharacters: Array<Pick<Character, 'id' | 'numericId'>> = [],
): Record<string, ForumRuntimeAuthorProfile> {
  if (!runtimeAuthorProfiles || typeof runtimeAuthorProfiles !== 'object') {
    return {};
  }

  const linkedNumericIds = new Map<string, string>();
  const usedIds = new Set<string>();

  linkedCharacters.forEach((character) => {
    const numericId = getCharacterNumericId(character);
    linkedNumericIds.set(character.id, numericId);
    usedIds.add(numericId);
  });

  return Object.fromEntries(
    Object.entries(runtimeAuthorProfiles).map(([profileId, profile]) => {
      const linkedNumericId = linkedNumericIds.get(profile.id);
      const numericId = linkedNumericId || claimUniqueNumericId(profile.id, profile.numericId, usedIds);
      return [
        profileId,
        {
          ...profile,
          numericId,
        },
      ];
    }),
  );
}
