import type {
  AssistantReplyEnvelope,
  AssistantReplyEnvelopeItem,
  Character,
  CharacterAvatarLibrary,
  CharacterAvatarLibraryEntry,
  CharacterAvatarLibraryEntrySource,
  CharacterAvatarLibraryEntryStatus,
  ChatMessage,
} from '../../types';
import {
  normalizeStructuredAssistantReplyToLegacyFormat,
  parseStructuredAssistantReplyEnvelope,
  serializeStructuredAssistantReplyEnvelope,
} from '../ai/assistantReplyEnvelope';
import { extractImageUrls } from '../../utils';
import { enrichAvatarEntryAfterCharacterAction } from './avatarPreference';

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

export type AvatarActionPayloadParseResult = AvatarActionParseResult & {
  structuredDisplayText: string | null;
};

export type AvatarCandidate = {
  image: string;
  source: CharacterAvatarLibraryEntrySource;
  messageTimestamp?: number;
};

const AVATAR_ACTION_BLOCK_REGEX = /\[avatar_action\]([\s\S]*?)\[\/avatar_action\]/i;
const DANGLING_AVATAR_ACTION_REGEX = /\[avatar_action\][\s\S]*$/i;
const AVATAR_FOLLOW_UP_SELECTION_PHRASES = new Set([
  '就这个',
  '就这张',
  '就那个',
  '就那张',
  '这个',
  '这张',
  '那个',
  '那张',
  '这个呢',
  '这张呢',
  '那个呢',
  '那张呢',
  '这个吧',
  '这张吧',
  '那个吧',
  '那张吧',
]);
const AVATAR_PREVIOUS_IMAGE_REFERENCE_REGEX = /上一张|前一张|刚才那张|刚刚那张|前面那张|上一条图|前面那条图/u;
const AVATAR_LAST_IMAGE_REFERENCE_REGEX = /最后一张|最后那张|最后那个|最后一条图/u;
const AVATAR_REVERSE_IMAGE_REFERENCE_REGEX = /倒数第?\s*([一二两三四五六七八九十\d]+)\s*张/u;
const AVATAR_ORDINAL_IMAGE_REFERENCE_REGEX = /第\s*([一二两三四五六七八九十\d]+)\s*张/u;
const AVATAR_APPEARANCE_REFERENCE_REGEX = /像你|像不像|看起来|样子|长相|外形|形象|气质|头像感|适合你/u;

function normalizeProtocolValue(value: string | undefined): string {
  return (value || '').trim().replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
}

function parseProtocolFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const normalizedBody = body.trim();
  if (!normalizedBody) {
    return fields;
  }

  const inlineFieldPattern = /([a-zA-Z_][\w-]*)\s*=\s*([\s\S]*?)(?=\s+[a-zA-Z_][\w-]*\s*=|$)/g;
  let match: RegExpExecArray | null = null;

  while ((match = inlineFieldPattern.exec(normalizedBody)) !== null) {
    const key = match[1]?.trim().toLowerCase();
    const value = normalizeProtocolValue(match[2]);
    if (!key || !value) {
      continue;
    }

    fields[key] = value;
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

function normalizeStructuredAvatarDisplayEnvelope(envelope: AssistantReplyEnvelope): AssistantReplyEnvelope | null {
  const items: AssistantReplyEnvelopeItem[] = envelope.items.flatMap<AssistantReplyEnvelopeItem>((item) => {
    if (item.kind !== 'text') {
      return [item];
    }

    const nextText = item.text.trim();
    if (!nextText) {
      return [];
    }

    return [{
      ...item,
      text: nextText,
    }];
  });

  return items.length > 0 ? { items } : null;
}

export function parseAvatarActionPayload(text: string): AvatarActionPayloadParseResult {
  const envelope = parseStructuredAssistantReplyEnvelope(text);
  if (!envelope) {
    const parsed = parseAvatarActionBlock(text);
    return {
      ...parsed,
      structuredDisplayText: null,
    };
  }

  let action: ParsedAvatarAction | null = null;
  const nextEnvelope = normalizeStructuredAvatarDisplayEnvelope({
    items: envelope.items.map<AssistantReplyEnvelopeItem>((item) => {
      if (item.kind !== 'text') {
        return item;
      }

      const parsed = parseAvatarActionBlock(item.text);
      if (!action && parsed.action) {
        action = parsed.action;
      }

      return {
        ...item,
        text: parsed.displayText,
      };
    }),
  });

  const structuredDisplayText = nextEnvelope
    ? serializeStructuredAssistantReplyEnvelope(nextEnvelope)
    : '';

  return {
    action,
    displayText: structuredDisplayText
      ? normalizeStructuredAssistantReplyToLegacyFormat(structuredDisplayText)
      : '',
    structuredDisplayText,
  };
}

function isStickerLikeMessage(message: ChatMessage): boolean {
  return !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test((message.text || '').trim());
}

export function getLatestVisibleUserMessage(messages: ChatMessage[]): ChatMessage | null {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.isSystem && !message.isRecalled) || null;
}

function normalizeAvatarIntentText(text: string): string {
  return text.trim().replace(/[，,。！？!?、~～\s]+$/gu, '');
}

function parseAvatarReferenceNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (/^\d+$/u.test(normalized)) {
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  if (normalized === '十') {
    return 10;
  }

  const numeralMap: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (normalized.startsWith('十')) {
    const unit = numeralMap[normalized.slice(1)] || 0;
    return 10 + unit;
  }

  if (normalized.endsWith('十')) {
    const tens = numeralMap[normalized.slice(0, -1)] || 0;
    return tens > 0 ? tens * 10 : null;
  }

  const tenIndex = normalized.indexOf('十');
  if (tenIndex > 0) {
    const tens = numeralMap[normalized.slice(0, tenIndex)] || 0;
    const units = numeralMap[normalized.slice(tenIndex + 1)] || 0;
    return tens > 0 ? tens * 10 + units : null;
  }

  return numeralMap[normalized] || null;
}

export function hasAvatarCandidateReferenceIntent(text: string): boolean {
  const normalized = normalizeAvatarIntentText(text);
  if (!normalized) return false;

  return AVATAR_PREVIOUS_IMAGE_REFERENCE_REGEX.test(normalized)
    || AVATAR_LAST_IMAGE_REFERENCE_REGEX.test(normalized)
    || AVATAR_REVERSE_IMAGE_REFERENCE_REGEX.test(normalized)
    || AVATAR_ORDINAL_IMAGE_REFERENCE_REGEX.test(normalized);
}

export function hasAvatarFollowUpIntent(text: string): boolean {
  const normalized = normalizeAvatarIntentText(text);
  if (!normalized) return false;

  if (AVATAR_FOLLOW_UP_SELECTION_PHRASES.has(normalized)) {
    return true;
  }

  return /^(?:换成|用)(?:这|那)(?:个|张)$/u.test(normalized)
    || /^(?:这|那)(?:个|张)好像你$/u.test(normalized)
    || /^(?:像你)(?:这|那)(?:个|张)$/u.test(normalized);
}

export function hasAvatarAppearanceReference(text: string): boolean {
  return AVATAR_APPEARANCE_REFERENCE_REGEX.test(normalizeAvatarIntentText(text));
}

export function findAvatarCandidateInMessage(message: ChatMessage): AvatarCandidate | null {
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

  return null;
}

export function hasAvatarChangeIntent(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;

  return /头像|頭像|avatar|profile\s*(photo|picture)|换成这张|换这张|用这张|当头像|设为头像|拿这张|改成这张/i.test(normalized);
}

export function findLatestAvatarCandidate(messages: ChatMessage[], maxLookback = 12): AvatarCandidate | null {
  return findRecentAvatarCandidates(messages, maxLookback)[0] || null;
}

export function findRecentAvatarCandidates(messages: ChatMessage[], maxLookback = 12): AvatarCandidate[] {
  const recentMessages = messages.slice(-maxLookback);
  const candidates: AvatarCandidate[] = [];

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index];
    if (message.role !== 'user' || message.isSystem || message.isRecalled) continue;

    const candidate = findAvatarCandidateInMessage(message);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function resolveAvatarCandidateReferenceIndex(text: string, candidateCount: number): number | null {
  if (candidateCount <= 0) {
    return null;
  }

  const normalized = normalizeAvatarIntentText(text);
  if (!normalized) {
    return null;
  }

  if (AVATAR_PREVIOUS_IMAGE_REFERENCE_REGEX.test(normalized)) {
    return Math.min(1, candidateCount - 1);
  }

  if (AVATAR_LAST_IMAGE_REFERENCE_REGEX.test(normalized)) {
    return 0;
  }

  const reverseMatch = normalized.match(AVATAR_REVERSE_IMAGE_REFERENCE_REGEX);
  if (reverseMatch?.[1]) {
    const reverseOrdinal = parseAvatarReferenceNumber(reverseMatch[1]);
    if (reverseOrdinal && reverseOrdinal <= candidateCount) {
      return reverseOrdinal - 1;
    }
  }

  const ordinalMatch = normalized.match(AVATAR_ORDINAL_IMAGE_REFERENCE_REGEX);
  if (ordinalMatch?.[1]) {
    const ordinal = parseAvatarReferenceNumber(ordinalMatch[1]);
    if (ordinal && ordinal <= candidateCount) {
      return candidateCount - ordinal;
    }
  }

  return null;
}

export function resolveLatestAvatarCandidateForUserTurn(messages: ChatMessage[], maxLookback = 12): AvatarCandidate | null {
  const latestVisibleUserMessage = getLatestVisibleUserMessage(messages);
  if (!latestVisibleUserMessage) {
    return null;
  }

  const directCandidate = findAvatarCandidateInMessage(latestVisibleUserMessage);
  if (directCandidate) {
    return directCandidate;
  }

  const recentCandidates = findRecentAvatarCandidates(messages, maxLookback);
  if (recentCandidates.length === 0) {
    return null;
  }

  const normalizedText = normalizeAvatarIntentText(latestVisibleUserMessage.text || '');
  if (!normalizedText) {
    return null;
  }

  const referencedIndex = resolveAvatarCandidateReferenceIndex(normalizedText, recentCandidates.length);
  if (referencedIndex !== null) {
    return recentCandidates[referencedIndex] || null;
  }

  if (
    hasAvatarChangeIntent(normalizedText)
    || hasAvatarFollowUpIntent(normalizedText)
    || hasAvatarAppearanceReference(normalizedText)
  ) {
    return recentCandidates[0] || null;
  }

  return null;
}

export function shouldOfferAvatarAction(messages: ChatMessage[]): boolean {
  return shouldOfferAvatarActionForCharacter(undefined, messages);
}

export function shouldOfferAvatarActionForCharacter(character: Character | undefined, messages: ChatMessage[]): boolean {
  const latestVisibleUserMessage = getLatestVisibleUserMessage(messages);
  if (!latestVisibleUserMessage) {
    return false;
  }

  if (findAvatarCandidateInMessage(latestVisibleUserMessage)) {
    return true;
  }

  const latestText = latestVisibleUserMessage.text || '';
  const hasExplicitIntent = hasAvatarChangeIntent(latestText);
  const hasFollowUpIntent = hasAvatarFollowUpIntent(latestText);
  const hasAppearanceReference = hasAvatarAppearanceReference(latestText);
  const hasCandidateReferenceIntent = hasAvatarCandidateReferenceIntent(latestText);
  if (!hasExplicitIntent && !hasFollowUpIntent && !hasAppearanceReference && !hasCandidateReferenceIntent) {
    return false;
  }

  const hasRecentCandidate = !!resolveLatestAvatarCandidateForUserTurn(messages);
  if (hasRecentCandidate) {
    return true;
  }

  return hasExplicitIntent && Boolean(character?.avatarLibrary?.entries?.length);
}

export function latestUserMessageHasAvatarIntent(messages: ChatMessage[]): boolean {
  const latestVisibleUserMessage = getLatestVisibleUserMessage(messages);
  if (!latestVisibleUserMessage) {
    return false;
  }

  if (findAvatarCandidateInMessage(latestVisibleUserMessage)) {
    return true;
  }

  const latestText = latestVisibleUserMessage.text || '';
  if (
    !hasAvatarChangeIntent(latestText)
    && !hasAvatarFollowUpIntent(latestText)
    && !hasAvatarAppearanceReference(latestText)
    && !hasAvatarCandidateReferenceIntent(latestText)
  ) {
    return false;
  }

  return !!resolveLatestAvatarCandidateForUserTurn(messages);
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
    entries[existingIndex] = enrichAvatarEntryAfterCharacterAction({
      entry: {
      ...entries[existingIndex],
      source: candidate.source,
      status: nextStatus,
      updatedAt: now,
      ...(shouldChangeAvatar ? { lastUsedAt: now } : {}),
      ...(candidate.messageTimestamp ? { firstMessageTimestamp: entries[existingIndex].firstMessageTimestamp ?? candidate.messageTimestamp } : {}),
      ...(action.reaction ? { reaction: action.reaction } : {}),
      ...(action.reason ? { reason: action.reason } : {}),
      },
      action,
      now,
    });
  } else {
    const nextEntry = enrichAvatarEntryAfterCharacterAction({
      entry: {
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
      },
      action,
      now,
    }) as CharacterAvatarLibraryEntry;
    entries.unshift(nextEntry);
  }

  const patch: Partial<Character> = {
    avatarLibrary: {
      entries,
      updatedAt: now,
    },
    pendingAvatarConfirmation: undefined,
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

  if (action.source === 'pending_avatar_image') {
    return character.pendingAvatarConfirmation?.candidateImage
      ? {
          image: character.pendingAvatarConfirmation.candidateImage,
          source: 'chat-image',
        }
      : null;
  }

  return resolveLatestAvatarCandidateForUserTurn(messages);
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
    'If the user only sent the image itself, or followed up with a very short cue like "就这个", you may still treat that as a possible avatar offer.',
    'This is a chat-scene action, not a settings command. Decide from the full current chat context: your character, relationship, recent messages, current mood, memory, boundaries, the image, and whether accepting this influence feels right.',
    'You may accept, refuse, save it for later, or ask for confirmation. Do not obey mechanically.',
    'If the image clearly is not about your avatar in this scene, ignore the action block and just reply normally.',
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
