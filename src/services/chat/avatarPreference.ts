import type {
  CharacterAvatarLibraryEntry,
  CharacterAvatarPreferenceAffinity,
  CharacterAvatarPreferenceLearnedFrom,
  CharacterAvatarPreferenceProfile,
  CharacterAvatarPreferenceSelfFit,
  Character,
} from '../../types';
import type { ParsedAvatarAction } from './avatarActions';

const AFFINITY_RANK: Record<CharacterAvatarPreferenceAffinity, number> = {
  avoid: 0,
  neutral: 1,
  like: 2,
  love: 3,
};

export function mergeAvatarPreferenceProfile(
  current: CharacterAvatarPreferenceProfile | undefined,
  patch: CharacterAvatarPreferenceProfile | undefined,
): CharacterAvatarPreferenceProfile | undefined {
  if (!current && !patch) {
    return undefined;
  }

  const next = {
    ...(current || {}),
    ...(patch || {}),
    ...(patch?.moodTags ? { moodTags: [...new Set(patch.moodTags.filter(Boolean))] } : {}),
    ...(patch?.sceneTags ? { sceneTags: [...new Set(patch.sceneTags.filter(Boolean))] } : {}),
  };

  return Object.keys(next).length > 0 ? next : undefined;
}

export function buildUpdateAvatarEntryPreferencePatch(params: {
  character: Character;
  entryId: string;
  updates: {
    affinity?: CharacterAvatarPreferenceAffinity | null;
    selfFit?: CharacterAvatarPreferenceSelfFit | null;
    note?: string | null;
    moodTags?: string[] | null;
    sceneTags?: string[] | null;
    learnedFrom?: CharacterAvatarPreferenceLearnedFrom | null;
  };
}): Partial<Character> {
  const now = Date.now();
  const entries = (params.character.avatarLibrary?.entries || []).map((entry) => {
    if (entry.id !== params.entryId) {
      return entry;
    }

    const nextPreference: CharacterAvatarPreferenceProfile = {
      ...(entry.preference || {}),
      updatedAt: now,
    };

    if ('affinity' in params.updates) {
      if (params.updates.affinity) {
        nextPreference.affinity = params.updates.affinity;
      } else {
        delete nextPreference.affinity;
      }
    }

    if ('selfFit' in params.updates) {
      if (params.updates.selfFit) {
        nextPreference.selfFit = params.updates.selfFit;
      } else {
        delete nextPreference.selfFit;
      }
    }

    if ('note' in params.updates) {
      const normalized = params.updates.note?.trim();
      if (normalized) {
        nextPreference.note = normalized;
      } else {
        delete nextPreference.note;
      }
    }

    if ('moodTags' in params.updates) {
      const nextTags = (params.updates.moodTags || []).map((tag) => tag.trim()).filter(Boolean);
      if (nextTags.length > 0) {
        nextPreference.moodTags = [...new Set(nextTags)];
      } else {
        delete nextPreference.moodTags;
      }
    }

    if ('sceneTags' in params.updates) {
      const nextTags = (params.updates.sceneTags || []).map((tag) => tag.trim()).filter(Boolean);
      if (nextTags.length > 0) {
        nextPreference.sceneTags = [...new Set(nextTags)];
      } else {
        delete nextPreference.sceneTags;
      }
    }

    if ('learnedFrom' in params.updates) {
      if (params.updates.learnedFrom) {
        nextPreference.learnedFrom = params.updates.learnedFrom;
      } else {
        delete nextPreference.learnedFrom;
      }
    } else {
      nextPreference.learnedFrom = 'manual';
    }

    if (
      !nextPreference.affinity
      && !nextPreference.selfFit
      && !nextPreference.note
      && !(nextPreference.moodTags?.length)
      && !(nextPreference.sceneTags?.length)
      && !nextPreference.learnedFrom
    ) {
      return {
        ...entry,
        preference: undefined,
        updatedAt: now,
      };
    }

    return {
      ...entry,
      preference: nextPreference,
      updatedAt: now,
    };
  });

  return {
    avatarLibrary: entries.length > 0
      ? {
          entries,
          updatedAt: now,
        }
      : undefined,
  };
}

function chooseStrongerAffinity(
  left: CharacterAvatarPreferenceAffinity | undefined,
  right: CharacterAvatarPreferenceAffinity | undefined,
): CharacterAvatarPreferenceAffinity | undefined {
  if (!left) return right;
  if (!right) return left;
  return AFFINITY_RANK[right] >= AFFINITY_RANK[left] ? right : left;
}

function inferPreferencePatchFromAction(params: {
  entry: CharacterAvatarLibraryEntry;
  action: ParsedAvatarAction;
  now: number;
}): CharacterAvatarPreferenceProfile | undefined {
  const { entry, action, now } = params;
  const current = entry.preference;

  if (/^avatar_library:/i.test(action.source)) {
    if (action.type === 'change') {
      const affinity = (entry.characterChoiceCount || 0) >= 1 ? 'love' : 'like';
      return mergeAvatarPreferenceProfile(current, {
        affinity: chooseStrongerAffinity(current?.affinity, affinity),
        selfFit: current?.selfFit || 'high',
        note: action.reason || current?.note,
        learnedFrom: 'character',
        updatedAt: now,
      });
    }

    if (action.type === 'reject') {
      return mergeAvatarPreferenceProfile(current, {
        affinity: 'avoid',
        note: action.reason || current?.note,
        learnedFrom: 'character',
        updatedAt: now,
      });
    }
  }

  if (action.source === 'latest_user_image') {
    if (action.type === 'change') {
      return mergeAvatarPreferenceProfile(current, {
        affinity: chooseStrongerAffinity(current?.affinity, 'like'),
        selfFit: current?.selfFit || 'high',
        note: action.reason || current?.note,
        learnedFrom: 'character',
        updatedAt: now,
      });
    }

    if (action.type === 'save_only') {
      return mergeAvatarPreferenceProfile(current, {
        affinity: chooseStrongerAffinity(current?.affinity, 'neutral'),
        selfFit: current?.selfFit || 'medium',
        note: action.reason || current?.note,
        learnedFrom: 'history',
        updatedAt: now,
      });
    }

    if (action.type === 'reject') {
      return mergeAvatarPreferenceProfile(current, {
        affinity: 'avoid',
        selfFit: current?.selfFit || 'low',
        note: action.reason || current?.note,
        learnedFrom: 'character',
        updatedAt: now,
      });
    }
  }

  return current;
}

export function enrichAvatarEntryAfterCharacterAction(params: {
  entry: CharacterAvatarLibraryEntry;
  action: ParsedAvatarAction;
  now: number;
}): CharacterAvatarLibraryEntry {
  const { entry, action, now } = params;
  const preference = inferPreferencePatchFromAction({
    entry,
    action,
    now,
  });
  const isCharacterLibraryChange = /^avatar_library:/i.test(action.source) && action.type === 'change';

  return {
    ...entry,
    ...(preference ? { preference } : {}),
    ...(isCharacterLibraryChange
      ? {
          characterChoiceCount: (entry.characterChoiceCount || 0) + 1,
          lastCharacterChoiceAt: now,
        }
      : {}),
  };
}

function affinityScore(value: CharacterAvatarPreferenceAffinity | undefined) {
  switch (value) {
    case 'love':
      return 5;
    case 'like':
      return 3;
    case 'neutral':
      return 1;
    case 'avoid':
      return -6;
    default:
      return 0;
  }
}

function selfFitScore(value: CharacterAvatarPreferenceSelfFit | undefined) {
  switch (value) {
    case 'high':
      return 4;
    case 'medium':
      return 2;
    case 'low':
      return -2;
    default:
      return 0;
  }
}

function learnedFromScore(value: CharacterAvatarPreferenceLearnedFrom | undefined) {
  switch (value) {
    case 'character':
      return 2;
    case 'history':
      return 1;
    case 'user':
    case 'manual':
    default:
      return 0;
  }
}

function matchTagScore(tags: string[] | undefined, haystack: string) {
  if (!tags?.length || !haystack.trim()) {
    return 0;
  }

  return tags.reduce((score, tag) => (
    tag && haystack.includes(tag.toLowerCase()) ? score + 1 : score
  ), 0);
}

export function scoreAvatarEntryForCharacter(params: {
  entry: CharacterAvatarLibraryEntry;
  character: Character;
  latestUserText?: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
  trigger: 'user_request' | 'autonomous';
  now?: number;
}): number {
  const { entry, trigger } = params;
  const now = params.now ?? Date.now();
  const combinedText = [
    params.latestUserText,
    params.shortTermSummary,
    params.sharedRecentRelationshipSummary,
    entry.reaction,
    entry.reason,
    entry.preference?.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  score += affinityScore(entry.preference?.affinity);
  score += selfFitScore(entry.preference?.selfFit);
  score += learnedFromScore(entry.preference?.learnedFrom);
  score += Math.min(entry.characterChoiceCount || 0, 3);
  score += matchTagScore(entry.preference?.moodTags, combinedText);
  score += matchTagScore(entry.preference?.sceneTags, combinedText);

  if (entry.status === 'saved' || entry.status === 'used') {
    score += 1;
  }
  if (entry.status === 'rejected') {
    score -= 5;
  }
  if (entry.status === 'current') {
    score -= 8;
  }

  if (entry.lastCharacterChoiceAt && now - entry.lastCharacterChoiceAt < 12 * 60 * 60 * 1000) {
    score += trigger === 'autonomous' ? -3 : 0;
  }

  if (entry.lastUsedAt && now - entry.lastUsedAt < 6 * 60 * 60 * 1000) {
    score += trigger === 'autonomous' ? -2 : 0;
  }

  if (trigger === 'autonomous' && !entry.preference?.affinity && !entry.characterChoiceCount) {
    score -= 2;
  }

  return score;
}

export function pickPreferredAvatarLibraryEntry(params: {
  character: Character;
  latestUserText?: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
  trigger: 'user_request' | 'autonomous';
  now?: number;
}) {
  const now = params.now ?? Date.now();
  const scoredEntries = (params.character.avatarLibrary?.entries || [])
    .filter((entry) => entry.image && entry.image !== params.character.avatar)
    .map((entry) => ({
      entry,
      score: scoreAvatarEntryForCharacter({
        entry,
        character: params.character,
        latestUserText: params.latestUserText,
        shortTermSummary: params.shortTermSummary,
        sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
        trigger: params.trigger,
        now,
      }),
    }))
    .sort((left, right) => right.score - left.score || right.entry.updatedAt - left.entry.updatedAt);

  return {
    best: scoredEntries[0] || null,
    entries: scoredEntries,
  };
}
