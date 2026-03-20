import type { CoupleSpaceData } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function hydrateCoupleSpace(
  source: Partial<CoupleSpaceData> | null | undefined,
  fallback: CoupleSpaceData,
): CoupleSpaceData {
  return {
    partnerId: source?.partnerId ?? fallback.partnerId,
    anniversaryDate: source?.anniversaryDate ?? fallback.anniversaryDate,
    backgroundUrl: source?.backgroundUrl ?? fallback.backgroundUrl,
    userAvatarFrame: source?.userAvatarFrame ?? fallback.userAvatarFrame,
    partnerAvatarFrame: source?.partnerAvatarFrame ?? fallback.partnerAvatarFrame,
    loveLetterEnvelopeBg: source?.loveLetterEnvelopeBg ?? fallback.loveLetterEnvelopeBg,
    loveLetterEnvelopeColor: source?.loveLetterEnvelopeColor ?? fallback.loveLetterEnvelopeColor,
    loveLetterPaperTexture: source?.loveLetterPaperTexture ?? fallback.loveLetterPaperTexture,
    loveLetterPaperBg: source?.loveLetterPaperBg ?? fallback.loveLetterPaperBg,
    calendarBg: source?.calendarBg ?? fallback.calendarBg,
    coNotes: Array.isArray(source?.coNotes) ? source!.coNotes : fallback.coNotes,
    ledger: Array.isArray(source?.ledger) ? source!.ledger : fallback.ledger,
    loveLetters: Array.isArray(source?.loveLetters) ? source!.loveLetters : fallback.loveLetters,
    calendarEvents: Array.isArray(source?.calendarEvents) ? source!.calendarEvents : fallback.calendarEvents,
    posts: Array.isArray(source?.posts) ? source!.posts : fallback.posts,
    anniversaries: Array.isArray(source?.anniversaries) ? source!.anniversaries : fallback.anniversaries,
    messageBoard: Array.isArray(source?.messageBoard) ? source!.messageBoard : fallback.messageBoard,
    addedPartnerIds: Array.isArray(source?.addedPartnerIds) ? source!.addedPartnerIds : fallback.addedPartnerIds,
    perception: source?.perception ?? fallback.perception,
  };
}

export function loadPersistedCoupleSpace(fallback: CoupleSpaceData): CoupleSpaceData {
  const persisted = loadJson<Partial<CoupleSpaceData> | null>(STORAGE_KEYS.coupleSpace, null);
  return hydrateCoupleSpace(persisted ? { ...fallback, ...persisted } : fallback, fallback);
}

export function persistCoupleSpace(data: CoupleSpaceData): void {
  saveJson(STORAGE_KEYS.coupleSpace, data);
}

export function clearPersistedCoupleSpace(): void {
  removeStoredJson(STORAGE_KEYS.coupleSpace);
}
