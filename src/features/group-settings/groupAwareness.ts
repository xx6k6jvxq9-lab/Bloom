import type { ChatGroup, GroupAwarenessEntry, GroupAwarenessMode, GroupAwarenessSource } from '../../types';

export const GROUP_JOIN_REQUEST_REJECTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type GroupAwarenessSanitizeOptions = {
  validCharacterIds: string[];
};

function getAwarenessEntries(group: Pick<ChatGroup, 'awarenessEntries'>): GroupAwarenessEntry[] {
  return Array.isArray(group.awarenessEntries) ? group.awarenessEntries : [];
}

export function getGroupAwarenessMode(group: Pick<ChatGroup, 'awarenessMode'> | null | undefined): GroupAwarenessMode {
  return group?.awarenessMode === 'public' ? 'public' : 'private';
}

export function getGroupAwarenessSourceLabel(source: GroupAwarenessSource | undefined): string {
  switch (source) {
    case 'direct_invite':
      return '被直接邀请';
    case 'direct_chat_mention':
      return '私聊提及';
    case 'manual_reveal':
      return '手动告知';
    case 'moment_exposure':
      return '动态曝光';
    case 'approved_join_request':
      return '通过申请';
    case 'former_member':
      return '曾在群里';
    case 'public_group':
      return '公开群';
    default:
      return '已知情';
  }
}

export function sanitizeGroupAwarenessEntries(
  entries: unknown,
  options: GroupAwarenessSanitizeOptions,
): GroupAwarenessEntry[] | undefined {
  if (!Array.isArray(entries)) {
    return undefined;
  }

  const validCharacterIds = new Set(options.validCharacterIds);
  const seenMemberIds = new Set<string>();

  const sanitizedEntries = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const memberId = typeof (entry as { memberId?: unknown }).memberId === 'string'
        ? (entry as { memberId: string }).memberId.trim()
        : '';
      const knownAt = (entry as { knownAt?: unknown }).knownAt;
      const source = (entry as { source?: unknown }).source;
      const joinRequestCooldownUntil = (entry as { joinRequestCooldownUntil?: unknown }).joinRequestCooldownUntil;

      if (
        !memberId
        || seenMemberIds.has(memberId)
        || !validCharacterIds.has(memberId)
        || typeof knownAt !== 'number'
        || !Number.isFinite(knownAt)
        || knownAt <= 0
        || (
          source !== 'direct_invite'
          && source !== 'direct_chat_mention'
          && source !== 'manual_reveal'
          && source !== 'moment_exposure'
          && source !== 'approved_join_request'
          && source !== 'former_member'
          && source !== 'public_group'
        )
      ) {
        return null;
      }

      seenMemberIds.add(memberId);

      const normalizedSource = source as GroupAwarenessSource;
      const nextEntry: GroupAwarenessEntry = {
        memberId,
        knownAt,
        source: normalizedSource,
        ...(typeof joinRequestCooldownUntil === 'number' && Number.isFinite(joinRequestCooldownUntil) && joinRequestCooldownUntil > 0
          ? { joinRequestCooldownUntil }
          : {}),
      };

      return nextEntry;
    })
    .filter((entry): entry is GroupAwarenessEntry => !!entry);

  return sanitizedEntries.length > 0 ? sanitizedEntries : undefined;
}

export function getGroupAwarenessEntry(
  group: Pick<ChatGroup, 'awarenessEntries'>,
  memberId: string,
): GroupAwarenessEntry | undefined {
  return getAwarenessEntries(group).find((entry) => entry.memberId === memberId);
}

export function doesCharacterKnowGroup(
  group: Pick<ChatGroup, 'memberIds' | 'awarenessMode' | 'awarenessEntries'>,
  memberId: string,
): boolean {
  if ((group.memberIds || []).includes(memberId)) {
    return true;
  }

  if (getGroupAwarenessMode(group) === 'public') {
    return true;
  }

  return !!getGroupAwarenessEntry(group, memberId);
}

export function canCharacterRequestToJoinGroup(
  group: Pick<ChatGroup, 'memberIds' | 'awarenessMode' | 'awarenessEntries'>,
  memberId: string,
  now = Date.now(),
): boolean {
  if ((group.memberIds || []).includes(memberId)) {
    return false;
  }

  if (!doesCharacterKnowGroup(group, memberId)) {
    return false;
  }

  const awarenessEntry = getGroupAwarenessEntry(group, memberId);
  if (awarenessEntry?.joinRequestCooldownUntil && awarenessEntry.joinRequestCooldownUntil > now) {
    return false;
  }

  return true;
}

export function upsertGroupAwarenessEntry(
  group: Pick<ChatGroup, 'awarenessEntries'>,
  entry: GroupAwarenessEntry,
): GroupAwarenessEntry[] {
  const currentEntries = getAwarenessEntries(group);
  const nextEntries = currentEntries.filter((item) => item.memberId !== entry.memberId);
  return [...nextEntries, entry];
}

export function buildGroupAwarenessEntry(params: {
  memberId: string;
  source: GroupAwarenessSource;
  knownAt?: number;
  joinRequestCooldownUntil?: number;
}): GroupAwarenessEntry {
  return {
    memberId: params.memberId,
    source: params.source,
    knownAt: params.knownAt ?? Date.now(),
    ...(typeof params.joinRequestCooldownUntil === 'number'
      ? { joinRequestCooldownUntil: params.joinRequestCooldownUntil }
      : {}),
  };
}

export function buildRevealGroupPatch(
  group: Pick<ChatGroup, 'awarenessEntries'>,
  memberId: string,
  source: GroupAwarenessSource = 'manual_reveal',
  now = Date.now(),
): Pick<Partial<ChatGroup>, 'awarenessEntries'> {
  return {
    awarenessEntries: upsertGroupAwarenessEntry(group, buildGroupAwarenessEntry({
      memberId,
      source,
      knownAt: now,
    })),
  };
}

export function buildJoinRequestCooldownPatch(
  group: Pick<ChatGroup, 'awarenessEntries' | 'awarenessMode'>,
  memberId: string,
  now = Date.now(),
): Pick<Partial<ChatGroup>, 'awarenessEntries'> {
  const currentEntry = getGroupAwarenessEntry(group, memberId);

  return {
    awarenessEntries: upsertGroupAwarenessEntry(group, buildGroupAwarenessEntry({
      memberId,
      source: currentEntry?.source || (getGroupAwarenessMode(group) === 'public' ? 'public_group' : 'manual_reveal'),
      knownAt: currentEntry?.knownAt || now,
      joinRequestCooldownUntil: now + GROUP_JOIN_REQUEST_REJECTION_COOLDOWN_MS,
    })),
  };
}

export function buildRejectedJoinRequestCooldownPatch(
  group: Pick<ChatGroup, 'awarenessEntries' | 'awarenessMode'>,
  memberId: string,
  now = Date.now(),
): Pick<Partial<ChatGroup>, 'awarenessEntries'> {
  return buildJoinRequestCooldownPatch(group, memberId, now);
}
