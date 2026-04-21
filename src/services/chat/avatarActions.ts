import type {
  Character,
  CharacterAvatarLibrary,
  CharacterAvatarLibraryEntry,
  CharacterAvatarLibraryEntrySource,
  CharacterAvatarLibraryEntryStatus,
  ChatMessage,
} from '../../types';
import { extractImageUrls } from '../../utils';

export type AvatarActionType = 'change' | 'reject' | 'save_only' | 'ask_confirm';

export type ParsedAvatarAction = {
  type: AvatarActionType;
  source: string;
  reaction?: string;
  reason?: string;
};

export type AvatarActionParseResult = {
  action: ParsedAvatarAction | null;
  displayText: string;
};

export type AvatarCandidate = {
  image: string;
  source: CharacterAvatarLibraryEntrySource;
  messageTimestamp?: number;
};

const AVATAR_ACTION_BLOCK_REGEX = /\[avatar_action\]([\s\S]*?)\[\/avatar_action\]/i;
const DANGLING_AVATAR_ACTION_REGEX = /\[avatar_action\][\s\S]*$/i;

function normalizeProtocolValue(value: string | undefined): string {
  return (value || '').trim().replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
}

function parseProtocolFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([a-zA-Z_][\w-]*)\s*=\s*([\s\S]*)$/);
    if (!match) continue;

    fields[match[1].trim().toLowerCase()] = normalizeProtocolValue(match[2]);
  }

  return fields;
}

function normalizeAvatarActionType(value: string | undefined): AvatarActionType | null {
  const normalized = normalizeProtocolValue(value).toLowerCase();
  if (normalized === 'change' || normalized === 'reject' || normalized === 'save_only' || normalized === 'ask_confirm') {
    return normalized;
  }
  return null;
}

export function parseAvatarActionBlock(text: string): AvatarActionParseResult {
  const blockMatch = text.match(AVATAR_ACTION_BLOCK_REGEX);
  const withoutCompleteBlock = text.replace(AVATAR_ACTION_BLOCK_REGEX, '').replace(DANGLING_AVATAR_ACTION_REGEX, '').trim();

  if (!blockMatch?.[1]) {
    return {
      action: null,
      displayText: withoutCompleteBlock,
    };
  }

  const fields = parseProtocolFields(blockMatch[1]);
  const actionType = normalizeAvatarActionType(fields.type);
  const reaction = fields.reaction;
  const displayText = withoutCompleteBlock || reaction || '';

  if (!actionType) {
    return {
      action: null,
      displayText,
    };
  }

  return {
    action: {
      type: actionType,
      source: fields.source || 'latest_user_image',
      reaction,
      reason: fields.reason,
    },
    displayText,
  };
}

function isStickerLikeMessage(message: ChatMessage): boolean {
  return !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test((message.text || '').trim());
}

export function hasAvatarChangeIntent(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;

  return /头像|頭像|avatar|profile\s*(photo|picture)|换成这张|换这张|用这张|当头像|设为头像|拿这张|改成这张/i.test(normalized);
}

export function findLatestAvatarCandidate(messages: ChatMessage[], maxLookback = 12): AvatarCandidate | null {
  const recentMessages = messages.slice(-maxLookback);

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index];
    if (message.role !== 'user' || message.isSystem || message.isRecalled) continue;

    if (message.imageUrl && !isStickerLikeMessage(message)) {
      return {
        image: message.imageUrl,
        source: 'chat-image',
        messageTimestamp: message.timestamp,
      };
    }

    const imageUrl = extractImageUrls(message.text || '')[0];
    if (imageUrl) {
      return {
        image: imageUrl,
        source: /^data:image\//i.test(imageUrl) ? 'chat-image' : 'url',
        messageTimestamp: message.timestamp,
      };
    }
  }

  return null;
}

export function shouldOfferAvatarAction(messages: ChatMessage[]): boolean {
  return shouldOfferAvatarActionForCharacter(undefined, messages);
}

export function shouldOfferAvatarActionForCharacter(character: Character | undefined, messages: ChatMessage[]): boolean {
  const latestVisibleUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.isSystem && !message.isRecalled);

  if (!latestVisibleUserMessage || !hasAvatarChangeIntent(latestVisibleUserMessage.text || '')) {
    return false;
  }

  return !!findLatestAvatarCandidate(messages) || Boolean(character?.avatarLibrary?.entries?.length);
}

export function latestUserMessageHasAvatarIntent(messages: ChatMessage[]): boolean {
  const latestVisibleUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.isSystem && !message.isRecalled);

  return Boolean(latestVisibleUserMessage && hasAvatarChangeIntent(latestVisibleUserMessage.text || ''));
}

function createAvatarLibraryEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `avatar_${crypto.randomUUID()}`;
  }
  return `avatar_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeAvatarLibrary(library: Character['avatarLibrary']): CharacterAvatarLibrary {
  return {
    entries: Array.isArray(library?.entries) ? library.entries : [],
    updatedAt: Number.isFinite(library?.updatedAt) ? library!.updatedAt : Date.now(),
  };
}

function statusFromAction(type: AvatarActionType): CharacterAvatarLibraryEntryStatus {
  if (type === 'change') return 'current';
  if (type === 'reject') return 'rejected';
  if (type === 'save_only') return 'saved';
  return 'candidate';
}

export function buildCharacterAvatarPatchFromAction(params: {
  character: Character;
  action: ParsedAvatarAction;
  candidate: AvatarCandidate;
}): Partial<Character> {
  const { character, action, candidate } = params;
  const now = Date.now();
  const library = normalizeAvatarLibrary(character.avatarLibrary);
  const nextStatus = statusFromAction(action.type);
  const existingIndex = library.entries.findIndex((entry) => entry.image === candidate.image);
  const shouldChangeAvatar = action.type === 'change';

  const entries = library.entries.map((entry) => {
    if (shouldChangeAvatar && entry.status === 'current' && entry.image !== candidate.image) {
      return {
        ...entry,
        status: 'used' as const,
        updatedAt: now,
      };
    }

    return entry;
  });

  if (existingIndex >= 0) {
    entries[existingIndex] = {
      ...entries[existingIndex],
      source: candidate.source,
      status: nextStatus,
      updatedAt: now,
      ...(shouldChangeAvatar ? { lastUsedAt: now } : {}),
      ...(candidate.messageTimestamp ? { firstMessageTimestamp: entries[existingIndex].firstMessageTimestamp ?? candidate.messageTimestamp } : {}),
      ...(action.reaction ? { reaction: action.reaction } : {}),
      ...(action.reason ? { reason: action.reason } : {}),
    };
  } else {
    const nextEntry: CharacterAvatarLibraryEntry = {
      id: createAvatarLibraryEntryId(),
      image: candidate.image,
      source: candidate.source,
      status: nextStatus,
      addedAt: now,
      updatedAt: now,
      ...(candidate.messageTimestamp ? { firstMessageTimestamp: candidate.messageTimestamp } : {}),
      ...(shouldChangeAvatar ? { lastUsedAt: now } : {}),
      ...(action.reaction ? { reaction: action.reaction } : {}),
      ...(action.reason ? { reason: action.reason } : {}),
    };
    entries.unshift(nextEntry);
  }

  const patch: Partial<Character> = {
    avatarLibrary: {
      entries,
      updatedAt: now,
    },
  };

  if (shouldChangeAvatar) {
    patch.avatar = candidate.image;
  }

  return patch;
}

export function resolveAvatarCandidateFromAction(params: {
  character: Character;
  action: ParsedAvatarAction;
  messages: ChatMessage[];
}): AvatarCandidate | null {
  const { character, action, messages } = params;

  if (/^avatar_library:/i.test(action.source)) {
    const entryId = action.source.replace(/^avatar_library:/i, '').trim();
    const entry = (character.avatarLibrary?.entries || []).find((item) => item.id === entryId);
    if (!entry) return null;
    return {
      image: entry.image,
      source: entry.source,
      messageTimestamp: entry.firstMessageTimestamp,
    };
  }

  if (action.source === 'current_avatar') {
    return character.avatar
      ? {
          image: character.avatar,
          source: 'manual',
        }
      : null;
  }

  return findLatestAvatarCandidate(messages);
}

export function buildAddAvatarCandidatePatch(params: {
  character: Character;
  candidate: AvatarCandidate;
  status?: CharacterAvatarLibraryEntryStatus;
  reaction?: string;
  reason?: string;
}): Partial<Character> {
  const action: ParsedAvatarAction = {
    type: params.status === 'rejected' ? 'reject' : params.status === 'saved' ? 'save_only' : 'ask_confirm',
    source: params.candidate.source,
    reaction: params.reaction,
    reason: params.reason,
  };

  return buildCharacterAvatarPatchFromAction({
    character: params.character,
    action,
    candidate: params.candidate,
  });
}

export function buildSetCurrentAvatarPatch(params: {
  character: Character;
  image: string;
  source?: CharacterAvatarLibraryEntrySource;
  reaction?: string;
  reason?: string;
}): Partial<Character> {
  return buildCharacterAvatarPatchFromAction({
    character: params.character,
    action: {
      type: 'change',
      source: params.source || 'manual',
      reaction: params.reaction,
      reason: params.reason,
    },
    candidate: {
      image: params.image,
      source: params.source || 'manual',
    },
  });
}

export function buildAvatarActionPromptSection(character: Character, messages: ChatMessage[]): string {
  if (!shouldOfferAvatarActionForCharacter(character, messages)) return '';

  const candidate = findLatestAvatarCandidate(messages);
  const libraryEntries = (character.avatarLibrary?.entries || [])
    .slice(0, 8)
    .map((entry) => {
      const parts = [
        `id: ${entry.id}`,
        entry.status,
        entry.source,
        entry.reaction ? `reaction: ${entry.reaction}` : '',
        entry.reason ? `reason: ${entry.reason}` : '',
      ].filter(Boolean);
      return `- ${parts.join(' / ')}`;
    });

  return [
    '## Avatar action in this private chat',
    'The user has recently sent an image or image link and is asking or implying that you may use it as your avatar.',
    'This is a chat-scene action, not a settings command. Decide from the full current chat context: your character, relationship, recent messages, current mood, memory, boundaries, the image, and whether accepting this influence feels right.',
    'You may accept, refuse, save it for later, or ask for confirmation. Do not obey mechanically.',
    `Current avatar value exists: ${character.avatar ? 'yes' : 'no'}`,
    candidate
      ? `Latest avatar candidate source: ${candidate.source}`
      : 'No new image candidate was sent in this turn; if the user asks you to choose from your avatar library, choose by the library records below.',
    libraryEntries.length > 0 ? ['Recent avatar library state:', ...libraryEntries].join('\n') : 'Recent avatar library state: empty or not yet recorded.',
    'If you decide an avatar action is needed, write your natural chat reaction normally, then append one hidden protocol block exactly like:',
    '[avatar_action]',
    'type=change | reject | save_only | ask_confirm',
    'source=latest_user_image OR avatar_library:<id>',
    'reaction=your natural visible reaction',
    'reason=short private reason grounded in the chat scene',
    '[/avatar_action]',
    'Only use this block for the avatar decision. The visible reaction should sound like you, not like a system status.',
  ].join('\n');
}

export function buildAutonomousAvatarLibraryPromptSection(character: Character): string {
  const availableEntries = (character.avatarLibrary?.entries || [])
    .filter((entry) => entry.image && entry.image !== character.avatar)
    .slice(0, 8);

  if (availableEntries.length === 0) return '';

  const libraryEntries = availableEntries.map((entry) => {
    const parts = [
      `id: ${entry.id}`,
      entry.status,
      entry.source,
      entry.reaction ? `past reaction: ${entry.reaction}` : '',
      entry.reason ? `past reason: ${entry.reason}` : '',
      entry.tags?.length ? `tags: ${entry.tags.join(', ')}` : '',
    ].filter(Boolean);
    return `- ${parts.join(' / ')}`;
  });

  return [
    '## Optional autonomous avatar library action',
    'You have an avatar library. In rare moments, you may decide by yourself to change your avatar from this library.',
    'This is not a user command. Treat it as a low-frequency character action that only happens when the current chat scene, relationship mood, memory, self-image, and emotional timing make it feel natural.',
    'Do not change avatars just because options exist. Most turns should not use this action.',
    'Good reasons include: the current conversation touches identity, mood, appearance, relationship symbolism, a remembered image, a meaningful change in your state, or you intentionally want to show the user something about yourself.',
    'If you change autonomously, mention it naturally in chat as your own action. Do not sound like a settings panel.',
    'Avatar library choices:',
    ...libraryEntries,
    'To change autonomously, append one hidden protocol block after your visible chat text:',
    '[avatar_action]',
    'type=change',
    'source=avatar_library:<id>',
    'reaction=your natural visible reaction',
    'reason=short private reason grounded in the current chat scene',
    '[/avatar_action]',
  ].join('\n');
}
