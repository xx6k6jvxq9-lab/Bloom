import { loadJsonRecord, saveJsonRecord } from '../persistence/browserJsonStore';
import { loadJson, saveJson } from '../persistence/localConfigStore';
import { STORAGE_KEYS } from '../persistence/storageKeys';

const MAX_CONVERSATION_MESSAGES = 24;

export type WechatConversationRole = 'user' | 'assistant';

export type WechatConversationMessage = {
  id: string;
  role: WechatConversationRole;
  text: string;
  timestamp: number;
  sourceMessageId?: string;
};

export type WechatConversationRecord = {
  conversationId: string;
  characterId: string;
  messages: WechatConversationMessage[];
  updatedAt: number;
};

export type WechatConversationState = Record<string, WechatConversationRecord>;

function isWechatConversationRole(value: unknown): value is WechatConversationRole {
  return value === 'user' || value === 'assistant';
}

function sanitizeConversationMessage(value: unknown): WechatConversationMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Partial<WechatConversationMessage>;
  if (
    typeof input.id !== 'string'
    || !isWechatConversationRole(input.role)
    || typeof input.text !== 'string'
    || typeof input.timestamp !== 'number'
  ) {
    return null;
  }

  return {
    id: input.id,
    role: input.role,
    text: input.text.trim(),
    timestamp: input.timestamp,
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : undefined,
  };
}

function sanitizeConversationRecord(value: unknown): WechatConversationRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Partial<WechatConversationRecord>;
  if (
    typeof input.conversationId !== 'string'
    || typeof input.characterId !== 'string'
    || !Array.isArray(input.messages)
  ) {
    return null;
  }

  const messages = input.messages
    .map((message) => sanitizeConversationMessage(message))
    .filter((message): message is WechatConversationMessage => !!message)
    .slice(-MAX_CONVERSATION_MESSAGES);

  return {
    conversationId: input.conversationId,
    characterId: input.characterId,
    messages,
    updatedAt: typeof input.updatedAt === 'number'
      ? input.updatedAt
      : messages[messages.length - 1]?.timestamp ?? Date.now(),
  };
}

function hydrateConversationState(source: unknown): WechatConversationState {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {};
  }

  return Object.entries(source as Record<string, unknown>).reduce<WechatConversationState>((acc, [key, value]) => {
    const record = sanitizeConversationRecord(value);
    if (record) {
      acc[key] = record;
    }
    return acc;
  }, {});
}

export function loadWechatConversationState(): WechatConversationState {
  return hydrateConversationState(loadJson<unknown>(STORAGE_KEYS.wechatConversationState, {}));
}

export async function loadPreferredWechatConversationState(): Promise<WechatConversationState> {
  const localState = loadWechatConversationState();

  try {
    const persisted = await loadJsonRecord<unknown>(STORAGE_KEYS.wechatConversationState);
    if (persisted) {
      const indexedDbState = hydrateConversationState(persisted);
      if (JSON.stringify(indexedDbState) !== JSON.stringify(localState)) {
        saveJson(STORAGE_KEYS.wechatConversationState, indexedDbState);
      }
      return indexedDbState;
    }
  } catch (error) {
    console.error('[wechatConversationStore] Failed to load conversation state from IndexedDB', error);
  }

  return localState;
}

export function saveWechatConversationState(state: WechatConversationState): Promise<void> {
  saveJson(STORAGE_KEYS.wechatConversationState, state);

  return saveJsonRecord(STORAGE_KEYS.wechatConversationState, state).catch((error) => {
    console.error('[wechatConversationStore] Failed to persist conversation state into IndexedDB', error);
  });
}

export function getWechatConversationRecord(conversationId: string): WechatConversationRecord | null {
  return loadWechatConversationState()[conversationId] ?? null;
}

export async function appendWechatConversationMessage(input: {
  conversationId: string;
  characterId: string;
  message: WechatConversationMessage;
}): Promise<WechatConversationRecord> {
  const current = loadWechatConversationState();
  const existing = current[input.conversationId];
  const nextRecord: WechatConversationRecord = {
    conversationId: input.conversationId,
    characterId: input.characterId,
    messages: [...(existing?.messages ?? []), input.message].slice(-MAX_CONVERSATION_MESSAGES),
    updatedAt: input.message.timestamp,
  };

  const nextState: WechatConversationState = {
    ...current,
    [input.conversationId]: nextRecord,
  };
  await saveWechatConversationState(nextState);
  return nextRecord;
}
