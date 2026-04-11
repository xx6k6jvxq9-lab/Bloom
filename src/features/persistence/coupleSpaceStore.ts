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
    initiativeDrafts: [],
    initiativeRuntime: {},
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
    initiativeDrafts: Array.isArray(source?.initiativeDrafts)
      ? source.initiativeDrafts
      : fallback.initiativeDrafts,
    initiativeRuntime: source?.initiativeRuntime ?? fallback.initiativeRuntime,
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

export function resolveCoupleSpaceState(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
): CoupleSpaceState {
  return state ?? projectCoupleSpaceStateFromCurrentSpace(currentSpace ?? createDefaultCoupleSpaceData());
}

export function resolveCurrentCoupleSpace(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
): CoupleSpaceData {
  const resolvedState = resolveCoupleSpaceState(state, currentSpace);
  const currentPartnerId = resolvedState.currentPartnerId ?? currentSpace?.partnerId ?? null;

  return getCurrentCoupleSpaceData(
    resolvedState,
    currentSpace ?? createDefaultCoupleSpaceData({ partnerId: currentPartnerId }),
  );
}

function hydratePartnerSpace(
  partnerId: string | null,
  spacesByPartnerId: Record<string, CoupleSpaceData>,
  fallbackSpace: CoupleSpaceData | null | undefined,
  updates: Partial<CoupleSpaceData> | CoupleSpaceData | null | undefined,
): CoupleSpaceData {
  if (!partnerId) {
    return {
      ...createDefaultCoupleSpaceData({ partnerId: null }),
      ...(fallbackSpace || {}),
      ...(updates || {}),
      partnerId: null,
    };
  }

  const baseSpace = getCurrentCoupleSpaceData(
    {
      currentPartnerId: partnerId,
      spacesByPartnerId,
    },
    createDefaultCoupleSpaceData({
      ...(fallbackSpace || {}),
      partnerId,
    }),
  );

  return {
    ...baseSpace,
    ...(updates || {}),
    partnerId,
  };
}

export function updateCurrentCoupleSpaceState(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
  updates: Partial<CoupleSpaceData> | ((prev: CoupleSpaceData) => Partial<CoupleSpaceData> | CoupleSpaceData),
): { coupleSpaceState: CoupleSpaceState; coupleSpace: CoupleSpaceData } {
  const resolvedState = resolveCoupleSpaceState(state, currentSpace);
  const currentPartnerId = resolvedState.currentPartnerId ?? currentSpace?.partnerId ?? null;
  const prevCurrentSpace = resolveCurrentCoupleSpace(resolvedState, currentSpace);
  const nextPatch = typeof updates === 'function' ? updates(prevCurrentSpace) : updates;
  const nextCurrentSpace = hydratePartnerSpace(
    currentPartnerId,
    resolvedState.spacesByPartnerId,
    currentSpace,
    nextPatch,
  );
  const nextSpaces = currentPartnerId
    ? {
        ...resolvedState.spacesByPartnerId,
        [currentPartnerId]: nextCurrentSpace,
      }
    : { ...resolvedState.spacesByPartnerId };

  return {
    coupleSpaceState: {
      currentPartnerId,
      spacesByPartnerId: nextSpaces,
    },
    coupleSpace: nextCurrentSpace,
  };
}

export function updatePartnerCoupleSpaceState(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
  partnerId: string,
  updates: Partial<CoupleSpaceData> | ((prev: CoupleSpaceData) => Partial<CoupleSpaceData> | CoupleSpaceData),
): { coupleSpaceState: CoupleSpaceState; coupleSpace: CoupleSpaceData } {
  const resolvedState = resolveCoupleSpaceState(state, currentSpace);
  const nextSpaces = { ...(resolvedState.spacesByPartnerId || {}) };
  const prevPartnerSpace = getCurrentCoupleSpaceData(
    {
      currentPartnerId: partnerId,
      spacesByPartnerId: nextSpaces,
    },
    createDefaultCoupleSpaceData({
      ...(currentSpace || {}),
      partnerId,
    }),
  );
  const nextPatch = typeof updates === 'function' ? updates(prevPartnerSpace) : updates;
  const nextPartnerSpace = hydratePartnerSpace(partnerId, nextSpaces, currentSpace, nextPatch);
  nextSpaces[partnerId] = nextPartnerSpace;

  const currentPartnerId = resolvedState.currentPartnerId ?? currentSpace?.partnerId ?? null;
  return {
    coupleSpaceState: {
      currentPartnerId,
      spacesByPartnerId: nextSpaces,
    },
    coupleSpace: currentPartnerId
      ? getCurrentCoupleSpaceData(
          {
            currentPartnerId,
            spacesByPartnerId: nextSpaces,
          },
          currentSpace ?? createDefaultCoupleSpaceData({ partnerId: currentPartnerId }),
        )
      : (currentSpace ?? createDefaultCoupleSpaceData()),
  };
}

export function switchCurrentCoupleSpaceState(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
  partnerId: string,
): { coupleSpaceState: CoupleSpaceState; coupleSpace: CoupleSpaceData } {
  const resolvedState = resolveCoupleSpaceState(state, currentSpace);
  const nextSpaces = { ...(resolvedState.spacesByPartnerId || {}) };
  const nextCurrentSpace = getCurrentCoupleSpaceData(
    {
      currentPartnerId: partnerId,
      spacesByPartnerId: nextSpaces,
    },
    createDefaultCoupleSpaceData({
      ...(currentSpace || {}),
      partnerId,
    }),
  );
  const nextState = {
    currentPartnerId: partnerId,
    spacesByPartnerId: nextSpaces,
  };

  return {
    coupleSpaceState: nextState,
    coupleSpace: nextCurrentSpace,
  };
}

export function deletePartnerCoupleSpaceState(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
  partnerId: string,
): { coupleSpaceState: CoupleSpaceState; coupleSpace: CoupleSpaceData } {
  const resolvedState = resolveCoupleSpaceState(state, currentSpace);
  const nextSpaces = { ...(resolvedState.spacesByPartnerId || {}) };
  delete nextSpaces[partnerId];

  const remainingPartnerIds = Object.keys(nextSpaces);
  const nextCurrentPartnerId = resolvedState.currentPartnerId === partnerId
    ? (remainingPartnerIds[0] ?? null)
    : resolvedState.currentPartnerId;
  const nextState = {
    currentPartnerId: nextCurrentPartnerId,
    spacesByPartnerId: nextSpaces,
  };

  return {
    coupleSpaceState: nextState,
    coupleSpace: getCurrentCoupleSpaceData(
      nextState,
      createDefaultCoupleSpaceData({ partnerId: nextCurrentPartnerId }),
    ),
  };
}

export function acceptCoupleSpaceInviteState(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
  partnerId: string,
): { coupleSpaceState: CoupleSpaceState; coupleSpace: CoupleSpaceData } {
  const resolvedState = resolveCoupleSpaceState(state, currentSpace);
  const existingSpace = resolvedState.spacesByPartnerId[partnerId];
  const acceptedSpace = existingSpace ?? createDefaultCoupleSpaceData({
    partnerId,
    anniversaryDate: Date.now(),
  });
  const nextState = {
    currentPartnerId: partnerId,
    spacesByPartnerId: {
      ...resolvedState.spacesByPartnerId,
      [partnerId]: {
        ...acceptedSpace,
        partnerId,
      },
    },
  };

  return {
    coupleSpaceState: nextState,
    coupleSpace: getCurrentCoupleSpaceData(nextState, acceptedSpace),
  };
}

export function buildPersistableCoupleSpacePayload(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
): { coupleSpaceState: CoupleSpaceState; coupleSpace: CoupleSpaceData } {
  const baseCoupleSpaceState = resolveCoupleSpaceState(state, currentSpace);
  const currentSpaceProjection = projectCoupleSpaceStateFromCurrentSpace(currentSpace);
  const coupleSpaceState = {
    currentPartnerId:
      currentSpaceProjection.currentPartnerId ?? baseCoupleSpaceState.currentPartnerId,
    spacesByPartnerId: {
      ...baseCoupleSpaceState.spacesByPartnerId,
      ...currentSpaceProjection.spacesByPartnerId,
    },
  };

  return {
    coupleSpaceState,
    coupleSpace: resolveCurrentCoupleSpace(coupleSpaceState, currentSpace),
  };
}

export function hydratePersistedCoupleSpacePayload(
  source: Partial<CoupleSpaceState> | Partial<CoupleSpaceData> | null | undefined,
): { coupleSpaceState: CoupleSpaceState; coupleSpace: CoupleSpaceData } {
  const coupleSpaceState = hydrateCoupleSpaceState(source, createDefaultCoupleSpaceState());
  return {
    coupleSpaceState,
    coupleSpace: getCurrentCoupleSpaceData(coupleSpaceState, createDefaultCoupleSpaceData()),
  };
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
  return (
    'partnerId' in value ||
    'coNotes' in value ||
    'loveLetters' in value ||
    'messageBoard' in value ||
    'initiativeDrafts' in value ||
    'initiativeRuntime' in value
  );
}
