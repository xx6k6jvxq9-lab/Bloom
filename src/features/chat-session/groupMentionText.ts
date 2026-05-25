import type { Character } from '../../types';

export type GroupMentionPart =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; text: string; memberId: string };

type MentionAliasEntry = {
  memberId: string;
  alias: string;
  normalizedAlias: string;
};

const MENTION_BOUNDARY_REGEX = /[\s,，。！？!?:：;；、)\]】>"'“”‘’]/u;

function isMentionBoundaryChar(char: string | undefined): boolean {
  return !char || MENTION_BOUNDARY_REGEX.test(char);
}

function buildMentionAliasEntries(members: Character[]): MentionAliasEntry[] {
  const seenKeys = new Set<string>();
  const entries: MentionAliasEntry[] = [];

  members.forEach((member) => {
    const aliases = [member.remarkName?.trim(), member.name?.trim()]
      .filter((value): value is string => !!value);

    aliases.forEach((alias) => {
      const normalizedAlias = alias.toLowerCase();
      const dedupeKey = `${member.id}::${normalizedAlias}`;
      if (seenKeys.has(dedupeKey)) {
        return;
      }

      seenKeys.add(dedupeKey);
      entries.push({
        memberId: member.id,
        alias,
        normalizedAlias,
      });
    });
  });

  return entries.sort((left, right) => right.alias.length - left.alias.length);
}

export function tokenizeGroupTextMentions(text: string, members: Character[]): GroupMentionPart[] {
  if (!text) {
    return [];
  }

  const aliasEntries = buildMentionAliasEntries(members);
  if (aliasEntries.length === 0 || !text.includes('@')) {
    return [{ kind: 'text', text }];
  }

  const parts: GroupMentionPart[] = [];
  let segmentStart = 0;
  let searchIndex = 0;

  while (searchIndex < text.length) {
    const atIndex = text.indexOf('@', searchIndex);
    if (atIndex < 0) {
      break;
    }

    const candidateStart = atIndex + 1;
    const matchedAlias = aliasEntries.find((entry) => {
      const candidateText = text.slice(candidateStart, candidateStart + entry.alias.length);
      if (candidateText.toLowerCase() !== entry.normalizedAlias) {
        return false;
      }

      const nextChar = text.charAt(candidateStart + entry.alias.length);
      return isMentionBoundaryChar(nextChar);
    }) || null;

    if (!matchedAlias) {
      searchIndex = atIndex + 1;
      continue;
    }

    if (atIndex > segmentStart) {
      parts.push({
        kind: 'text',
        text: text.slice(segmentStart, atIndex),
      });
    }

    const mentionEnd = candidateStart + matchedAlias.alias.length;
    parts.push({
      kind: 'mention',
      text: text.slice(atIndex, mentionEnd),
      memberId: matchedAlias.memberId,
    });

    segmentStart = mentionEnd;
    searchIndex = mentionEnd;
  }

  if (segmentStart < text.length) {
    parts.push({
      kind: 'text',
      text: text.slice(segmentStart),
    });
  }

  return parts.length > 0 ? parts : [{ kind: 'text', text }];
}
