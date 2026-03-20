import type { WalletData } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function hydrateWalletData(source: Partial<WalletData> | null | undefined, fallback: WalletData): WalletData {
  return {
    balance: source?.balance ?? fallback.balance,
    yuebaoBalance: source?.yuebaoBalance ?? fallback.yuebaoBalance,
    yuebaoInterest: source?.yuebaoInterest ?? fallback.yuebaoInterest,
    familyCards: Array.isArray(source?.familyCards) ? source!.familyCards : fallback.familyCards,
    paymentPassword: source?.paymentPassword ?? fallback.paymentPassword,
    cards: Array.isArray(source?.cards) ? source!.cards : fallback.cards,
    transactions: Array.isArray(source?.transactions) ? source!.transactions : fallback.transactions,
  };
}

export function loadPersistedWalletData(fallback: WalletData): WalletData {
  const persisted = loadJson<Partial<WalletData> | null>(STORAGE_KEYS.walletData, null);
  return hydrateWalletData(persisted ? { ...fallback, ...persisted } : fallback, fallback);
}

export function persistWalletData(data: WalletData): void {
  saveJson(STORAGE_KEYS.walletData, data);
}

export function clearPersistedWalletData(): void {
  removeStoredJson(STORAGE_KEYS.walletData);
}
