import { loadJsonRecord, saveJsonRecord } from '../persistence/browserJsonStore';
import { loadJson, saveJson } from '../persistence/localConfigStore';
import { STORAGE_KEYS } from '../persistence/storageKeys';
import type { WechatRoleBinding } from './types';

function sortBindings(bindings: WechatRoleBinding[]): WechatRoleBinding[] {
  return [...bindings].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function loadWechatRoleBindings(): WechatRoleBinding[] {
  return sortBindings(
    loadJson<WechatRoleBinding[]>(STORAGE_KEYS.wechatRoleBindings, []).filter(
      (binding) => binding && typeof binding.characterId === 'string' && typeof binding.conversationId === 'string',
    ),
  );
}

export async function loadPreferredWechatRoleBindings(): Promise<WechatRoleBinding[]> {
  const localBindings = loadWechatRoleBindings();

  try {
    const persisted = await loadJsonRecord<WechatRoleBinding[]>(STORAGE_KEYS.wechatRoleBindings);
    if (Array.isArray(persisted)) {
      const normalizedBindings = sortBindings(
        persisted.filter(
          (binding) => binding && typeof binding.characterId === 'string' && typeof binding.conversationId === 'string',
        ),
      );
      if (JSON.stringify(localBindings) !== JSON.stringify(normalizedBindings)) {
        saveJson(STORAGE_KEYS.wechatRoleBindings, normalizedBindings);
      }
      return normalizedBindings;
    }
  } catch (error) {
    console.error('[bindingsStore] Failed to load WeChat role bindings from IndexedDB', error);
  }

  return localBindings;
}

export function saveWechatRoleBindings(bindings: WechatRoleBinding[]): void {
  const normalizedBindings = sortBindings(bindings);
  saveJson(STORAGE_KEYS.wechatRoleBindings, normalizedBindings);
  void saveJsonRecord(STORAGE_KEYS.wechatRoleBindings, normalizedBindings).catch((error) => {
    console.error('[bindingsStore] Failed to persist WeChat role bindings into IndexedDB', error);
  });
}

export function getWechatBindingByCharacterId(characterId: string): WechatRoleBinding | null {
  return loadWechatRoleBindings().find((binding) => binding.characterId === characterId && binding.enabled) || null;
}

export function getWechatBindingByConversationId(conversationId: string): WechatRoleBinding | null {
  return loadWechatRoleBindings().find((binding) => binding.conversationId === conversationId && binding.enabled) || null;
}

export function upsertWechatRoleBinding(binding: WechatRoleBinding): WechatRoleBinding[] {
  const currentBindings = loadWechatRoleBindings().filter(
    (item) => item.id !== binding.id && item.characterId !== binding.characterId && item.conversationId !== binding.conversationId,
  );
  const nextBindings = [binding, ...currentBindings];
  saveWechatRoleBindings(nextBindings);
  return nextBindings;
}

export function disableWechatBinding(bindingId: string): WechatRoleBinding[] {
  const nextBindings = loadWechatRoleBindings().map((binding) =>
    binding.id === bindingId
      ? {
          ...binding,
          enabled: false,
          updatedAt: Date.now(),
        }
      : binding,
  );
  saveWechatRoleBindings(nextBindings);
  return nextBindings;
}

export function disableWechatBindingByCharacterId(characterId: string): WechatRoleBinding | null {
  const target = loadWechatRoleBindings().find((binding) => binding.characterId === characterId && binding.enabled);
  if (!target) {
    return null;
  }

  const [updatedBinding] = disableWechatBinding(target.id).filter((binding) => binding.id === target.id);
  return updatedBinding || null;
}

export function getWechatBindingsOverview() {
  const bindings = loadWechatRoleBindings();
  return {
    enabledCount: bindings.filter((binding) => binding.enabled).length,
    bindings,
  };
}
