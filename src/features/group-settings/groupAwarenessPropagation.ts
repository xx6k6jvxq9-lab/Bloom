import type { Character, ChatGroup, ChatMessage, MomentItem } from '../../types';
import { buildGroupAwarenessEntry, getGroupAwarenessEntry, getGroupAwarenessMode, upsertGroupAwarenessEntry } from './groupAwareness';

function normalizePropagationText(text: string | undefined): string {
  return (text || '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .trim();
}

function isUnsafeAutoPropagationGroupName(groupName: string): boolean {
  const trimmed = groupName.trim();
  if (!trimmed) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.length < 2) return true;
  return false;
}

function textContainsGroupName(text: string, groupName: string): boolean {
  const normalizedText = normalizePropagationText(text);
  const normalizedGroupName = groupName.trim();
  if (!normalizedText || isUnsafeAutoPropagationGroupName(normalizedGroupName)) {
    return false;
  }

  const hasAsciiWord = /^[a-z0-9 _-]+$/i.test(normalizedGroupName);
  if (hasAsciiWord) {
    const escaped = normalizedGroupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(normalizedText);
  }

  return normalizedText.includes(normalizedGroupName);
}

export function getMentionedGroupIdsFromText(text: string, chatGroups: ChatGroup[]): string[] {
  const normalizedText = normalizePropagationText(text);
  if (!normalizedText) {
    return [];
  }

  return chatGroups
    .filter((group) => textContainsGroupName(normalizedText, group.name))
    .map((group) => group.id);
}

export function buildDirectChatMentionAwarenessForCharacter(params: {
  characterId: string;
  history: ChatMessage[];
  chatGroups: ChatGroup[];
  now?: number;
}): Array<{ groupId: string; awarenessEntries: ChatGroup['awarenessEntries'] }> {
  const now = params.now ?? Date.now();
  const recentMessages = params.history
    .filter((message) => !message.isSystem && !message.isRecalled)
    .slice(-16);

  if (recentMessages.length === 0) {
    return [];
  }

  const combinedText = recentMessages
    .map((message) => normalizePropagationText(message.text))
    .filter(Boolean)
    .join('\n');

  const mentionedGroupIds = new Set(getMentionedGroupIdsFromText(combinedText, params.chatGroups));
  if (mentionedGroupIds.size === 0) {
    return [];
  }

  return params.chatGroups.flatMap((group) => {
    if (!mentionedGroupIds.has(group.id)) {
      return [];
    }

    if ((group.memberIds || []).includes(params.characterId)) {
      return [];
    }

    if (getGroupAwarenessEntry(group, params.characterId)) {
      return [];
    }

    return [{
      groupId: group.id,
      awarenessEntries: upsertGroupAwarenessEntry(group, buildGroupAwarenessEntry({
        memberId: params.characterId,
        source: 'direct_chat_mention',
        knownAt: now,
      })),
    }];
  });
}

function getMomentExposureAudienceIds(params: {
  moment: MomentItem;
  characters: Character[];
}): string[] {
  if (params.moment.visibilityScope === 'contacts') {
    return params.characters
      .filter((character) => character.id !== params.moment.authorId && character.friendshipStatus === 'friends')
      .map((character) => character.id);
  }

  return params.characters
    .filter((character) => character.id !== params.moment.authorId)
    .map((character) => character.id);
}

export function buildMomentExposureAwarenessPatches(params: {
  moment: Pick<MomentItem, 'authorId' | 'content' | 'visibilityScope'>;
  characters: Character[];
  chatGroups: ChatGroup[];
  now?: number;
}): Array<{ groupId: string; awarenessEntries: ChatGroup['awarenessEntries'] }> {
  const now = params.now ?? Date.now();
  const normalizedText = normalizePropagationText(params.moment.content);
  if (!normalizedText) {
    return [];
  }

  const mentionedGroupIds = new Set(getMentionedGroupIdsFromText(normalizedText, params.chatGroups));
  if (mentionedGroupIds.size === 0) {
    return [];
  }

  const audienceIds = getMomentExposureAudienceIds({
    moment: params.moment as MomentItem,
    characters: params.characters,
  });

  return params.chatGroups.flatMap((group) => {
    if (!mentionedGroupIds.has(group.id)) {
      return [];
    }

    let awarenessEntries = group.awarenessEntries;
    let changed = false;

    audienceIds.forEach((characterId) => {
      if ((group.memberIds || []).includes(characterId)) {
        return;
      }

      if (getGroupAwarenessMode(group) === 'public' || getGroupAwarenessEntry({ awarenessEntries }, characterId)) {
        return;
      }

      awarenessEntries = upsertGroupAwarenessEntry(
        { awarenessEntries },
        buildGroupAwarenessEntry({
          memberId: characterId,
          source: 'moment_exposure',
          knownAt: now,
        }),
      );
      changed = true;
    });

    return changed ? [{ groupId: group.id, awarenessEntries }] : [];
  });
}
