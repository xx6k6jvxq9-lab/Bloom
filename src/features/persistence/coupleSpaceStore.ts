import type { CoupleSpaceData, CoupleSpaceState } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';
import { createDefaultCoupleSpaceInitiativeSettings } from '../../services/ai/couple-space/initiative/coupleSpaceTriggerPolicy';

export function createDefaultCoupleSpaceData(
  overrides: Partial<CoupleSpaceData> = {},
): CoupleSpaceData {
  return {
    partnerId: null,
    anniversaryDate: null,
    backgroundUrl: null,
    coNotes: [],
    ledger: [],
    loveLetters: [],
    calendarEvents: [],
    moodStamps: [],
    heartCapsuleMachine: {
      todayDraw: null,
      history: [],
    },
    posts: [],
    anniversaries: [],
    messageBoard: [],
    addedPartnerIds: [],
    loveLetterEnvelopeColor: '#f6d9e4',
    loveLetterPaperTexture: 'default',
    initiativeSettings: createDefaultCoupleSpaceInitiativeSettings(),
    ...overrides,
  };
}

export function createDefaultCoupleSpaceState(
  currentPartnerId: string | null = null,
): CoupleSpaceState {
  return {
    currentPartnerId,
    spacesByPartnerId: {},
  };
}

export function hydrateCoupleSpace(
  source: Partial<CoupleSpaceData> | null | undefined,
  fallback: CoupleSpaceData,
): CoupleSpaceData {
  const defaultInitiativeSettings = createDefaultCoupleSpaceInitiativeSettings();
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
    coNotes: Array.isArray(source?.coNotes) ? source.coNotes : fallback.coNotes,
    ledger: Array.isArray(source?.ledger) ? source.ledger : fallback.ledger,
    loveLetters: Array.isArray(source?.loveLetters) ? source.loveLetters : fallback.loveLetters,
    calendarEvents: Array.isArray(source?.calendarEvents) ? source.calendarEvents : fallback.calendarEvents,
    moodStamps: Array.isArray(source?.moodStamps) ? source.moodStamps : fallback.moodStamps,
    heartCapsuleMachine: {
      todayDraw: source?.heartCapsuleMachine?.todayDraw ?? fallback.heartCapsuleMachine?.todayDraw ?? null,
      history: Array.isArray(source?.heartCapsuleMachine?.history)
        ? source.heartCapsuleMachine.history
        : (fallback.heartCapsuleMachine?.history ?? []),
    },
    posts: Array.isArray(source?.posts) ? source.posts : fallback.posts,
    anniversaries: Array.isArray(source?.anniversaries) ? source.anniversaries : fallback.anniversaries,
    messageBoard: Array.isArray(source?.messageBoard) ? source.messageBoard : fallback.messageBoard,
    addedPartnerIds: Array.isArray(source?.addedPartnerIds) ? source.addedPartnerIds : fallback.addedPartnerIds,
    perception: source?.perception ?? fallback.perception,
    initiativeSettings: {
      ...defaultInitiativeSettings,
      ...fallback.initiativeSettings,
      ...source?.initiativeSettings,
      publishing: {
        ...defaultInitiativeSettings.publishing,
        ...fallback.initiativeSettings?.publishing,
        ...source?.initiativeSettings?.publishing,
        dailyPost: {
          ...defaultInitiativeSettings.publishing.dailyPost,
          ...fallback.initiativeSettings?.publishing?.dailyPost,
          ...source?.initiativeSettings?.publishing?.dailyPost,
        },
        loveLetter: {
          ...defaultInitiativeSettings.publishing.loveLetter,
          ...fallback.initiativeSettings?.publishing?.loveLetter,
          ...source?.initiativeSettings?.publishing?.loveLetter,
        },
        messageBoard: {
          ...defaultInitiativeSettings.publishing.messageBoard,
          ...fallback.initiativeSettings?.publishing?.messageBoard,
          ...source?.initiativeSettings?.publishing?.messageBoard,
        },
      },
      memo: {
        ...defaultInitiativeSettings.memo,
        ...fallback.initiativeSettings?.memo,
        ...source?.initiativeSettings?.memo,
        writeCoNote: {
          ...defaultInitiativeSettings.memo.writeCoNote,
          ...fallback.initiativeSettings?.memo?.writeCoNote,
          ...source?.initiativeSettings?.memo?.writeCoNote,
        },
      },
      recording: {
        ...defaultInitiativeSettings.recording,
        ...fallback.initiativeSettings?.recording,
        ...source?.initiativeSettings?.recording,
        createLedgerEntry: {
          ...defaultInitiativeSettings.recording.createLedgerEntry,
          ...fallback.initiativeSettings?.recording?.createLedgerEntry,
          ...source?.initiativeSettings?.recording?.createLedgerEntry,
        },
      },
      interaction: {
        ...defaultInitiativeSettings.interaction,
        ...fallback.initiativeSettings?.interaction,
        ...source?.initiativeSettings?.interaction,
        replyLoveLetter: {
          ...defaultInitiativeSettings.interaction.replyLoveLetter,
          ...fallback.initiativeSettings?.interaction?.replyLoveLetter,
          ...source?.initiativeSettings?.interaction?.replyLoveLetter,
        },
        replyDailyComment: {
          ...defaultInitiativeSettings.interaction.replyDailyComment,
          ...fallback.initiativeSettings?.interaction?.replyDailyComment,
          ...source?.initiativeSettings?.interaction?.replyDailyComment,
        },
        replyMessageBoard: {
          ...defaultInitiativeSettings.interaction.replyMessageBoard,
          ...fallback.initiativeSettings?.interaction?.replyMessageBoard,
          ...source?.initiativeSettings?.interaction?.replyMessageBoard,
        },
        reactToExistingPost: {
          ...defaultInitiativeSettings.interaction.reactToExistingPost,
          ...fallback.initiativeSettings?.interaction?.reactToExistingPost,
          ...source?.initiativeSettings?.interaction?.reactToExistingPost,
        },
      },
    },
  };
}

export function hydrateCoupleSpaceState(
  source: Partial<CoupleSpaceState> | Partial<CoupleSpaceData> | null | undefined,
  fallback: CoupleSpaceState,
): CoupleSpaceState {
  if (looksLikeLegacyCoupleSpace(source)) {
    const legacyPartnerId = source.partnerId ?? fallback.currentPartnerId;
    if (!legacyPartnerId) {
      return createDefaultCoupleSpaceState(null);
    }

    return {
      currentPartnerId: legacyPartnerId,
      spacesByPartnerId: {
        [legacyPartnerId]: hydrateCoupleSpace(source, createDefaultCoupleSpaceData({ partnerId: legacyPartnerId })),
      },
    };
  }

  const rawSpaces = source?.spacesByPartnerId ?? fallback.spacesByPartnerId ?? {};
  const hydratedSpaces = Object.entries(rawSpaces).reduce<Record<string, CoupleSpaceData>>((acc, [partnerId, space]) => {
    acc[partnerId] = hydrateCoupleSpace(
      space,
      createDefaultCoupleSpaceData({ partnerId }),
    );
    return acc;
  }, {});

  const currentPartnerId = source?.currentPartnerId ?? fallback.currentPartnerId;
  return {
    currentPartnerId,
    spacesByPartnerId: hydratedSpaces,
  };
}

export function getCurrentCoupleSpaceData(
  state: CoupleSpaceState | null | undefined,
  fallback?: CoupleSpaceData,
): CoupleSpaceData {
  const baseFallback = fallback ?? createDefaultCoupleSpaceData();
  const currentPartnerId = state?.currentPartnerId ?? baseFallback.partnerId ?? null;

  if (!currentPartnerId) {
    return createDefaultCoupleSpaceData({
      ...baseFallback,
      partnerId: null,
    });
  }

  return hydrateCoupleSpace(
    state?.spacesByPartnerId?.[currentPartnerId] ?? { partnerId: currentPartnerId },
    createDefaultCoupleSpaceData({
      ...baseFallback,
      partnerId: currentPartnerId,
    }),
  );
}

/**
 * Phase 1 keeps app runtime behavior backward-compatible by projecting the
 * currently edited single-space view back into a per-partner container shape.
 * Later phases can replace this with true per-partner page reads/writes.
 */
export function projectCoupleSpaceStateFromCurrentSpace(
  currentSpace: CoupleSpaceData | null | undefined,
): CoupleSpaceState {
  const partnerId = currentSpace?.partnerId ?? null;
  if (!partnerId || !currentSpace) {
    return createDefaultCoupleSpaceState(null);
  }

  return {
    currentPartnerId: partnerId,
    spacesByPartnerId: {
      [partnerId]: hydrateCoupleSpace(
        currentSpace,
        createDefaultCoupleSpaceData({ partnerId }),
      ),
    },
  };
}

export function loadPersistedCoupleSpace(fallback: CoupleSpaceData): CoupleSpaceData {
  const persisted = loadJson<Partial<CoupleSpaceData> | Partial<CoupleSpaceState> | null>(STORAGE_KEYS.coupleSpace, null);
  const state = hydrateCoupleSpaceState(persisted, createDefaultCoupleSpaceState(fallback.partnerId ?? null));
  return getCurrentCoupleSpaceData(state, fallback);
}

export function persistCoupleSpace(data: CoupleSpaceData): void {
  saveJson(STORAGE_KEYS.coupleSpace, projectCoupleSpaceStateFromCurrentSpace(data));
}

export function clearPersistedCoupleSpace(): void {
  removeStoredJson(STORAGE_KEYS.coupleSpace);
}

function looksLikeLegacyCoupleSpace(
  value: Partial<CoupleSpaceState> | Partial<CoupleSpaceData> | null | undefined,
): value is Partial<CoupleSpaceData> {
  if (!value) return false;
  return 'partnerId' in value || 'coNotes' in value || 'loveLetters' in value || 'messageBoard' in value;
}
