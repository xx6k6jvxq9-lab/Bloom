import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';
import { createDefaultCoupleSpaceInitiativeSettings } from '../../services/ai/couple-space/initiative/coupleSpaceTriggerPolicy';
import type { CoupleSpaceData, CoupleSpaceState, PerceptionSettings } from '../../types';

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
    dismissedPartnerIds: [],
  };
}

function normalizePartnerId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function uniquePartnerIds(values: Array<unknown>): string[] {
  const seen = new Set<string>();
  const partnerIds: string[] = [];
  for (const value of values) {
    const partnerId = normalizePartnerId(value);
    if (!partnerId || seen.has(partnerId)) {
      continue;
    }
    seen.add(partnerId);
    partnerIds.push(partnerId);
  }
  return partnerIds;
}

function collectKnownPartnerIds(
  state: CoupleSpaceState | null | undefined,
  currentSpace?: CoupleSpaceData | null | undefined,
): string[] {
  const statePartnerIds = Object.keys(state?.spacesByPartnerId ?? {});
  const stateCurrentPartnerId = normalizePartnerId(state?.currentPartnerId);

  if (statePartnerIds.length > 0 || stateCurrentPartnerId) {
    return uniquePartnerIds([
      stateCurrentPartnerId,
      ...statePartnerIds,
    ]);
  }

  return uniquePartnerIds([
    currentSpace?.partnerId,
    ...(currentSpace?.addedPartnerIds ?? []),
  ]);
}

function syncLegacyAddedPartnerIdsInSpace(
  space: CoupleSpaceData,
  partnerIds: string[],
): CoupleSpaceData {
  const normalizedPartnerIds = partnerIds.length > 0
    ? partnerIds
    : uniquePartnerIds([
        ...(space.addedPartnerIds ?? []),
        space.partnerId,
      ]);
  const existingPartnerIds = space.addedPartnerIds ?? [];

  if (
    existingPartnerIds.length === normalizedPartnerIds.length
    && existingPartnerIds.every((partnerId, index) => partnerId === normalizedPartnerIds[index])
  ) {
    return space;
  }

  return {
    ...space,
    addedPartnerIds: normalizedPartnerIds,
  };
}

function syncLegacyAddedPartnerIdsInState(
  state: CoupleSpaceState,
): CoupleSpaceState {
  const partnerIds = collectKnownPartnerIds(state);
  const normalizedDismissedPartnerIds = uniquePartnerIds(state.dismissedPartnerIds ?? []);
  if (partnerIds.length === 0) {
    return {
      ...state,
      dismissedPartnerIds: normalizedDismissedPartnerIds,
    };
  }

  const openPartnerIdSet = new Set(partnerIds);
  const dismissedPartnerIds = normalizedDismissedPartnerIds.filter((partnerId) => !openPartnerIdSet.has(partnerId));

  const nextSpaces = partnerIds.reduce<Record<string, CoupleSpaceData>>((acc, partnerId) => {
    const existingSpace = state.spacesByPartnerId[partnerId];
    const hydratedSpace = hydrateCoupleSpace(
      existingSpace ?? { partnerId },
      createDefaultCoupleSpaceData({ partnerId }),
    );
    acc[partnerId] = syncLegacyAddedPartnerIdsInSpace(hydratedSpace, partnerIds);
    return acc;
  }, {});

  const nextCurrentPartnerId = normalizePartnerId(state.currentPartnerId) ?? partnerIds[0] ?? null;

  return {
    ...state,
    currentPartnerId: nextCurrentPartnerId,
    spacesByPartnerId: nextSpaces,
    dismissedPartnerIds,
  };
}

function readSharedPerception(
  source: Partial<CoupleSpaceState> | null | undefined,
): PerceptionSettings | undefined {
  return source?.sharedPerception;
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
    const legacyPartnerIds = uniquePartnerIds([
      source.partnerId,
      ...(Array.isArray(source.addedPartnerIds) ? source.addedPartnerIds : []),
      fallback.currentPartnerId,
    ]);
    const legacyPartnerId = legacyPartnerIds[0] ?? null;
    if (!legacyPartnerId) {
      return {
        ...createDefaultCoupleSpaceState(null),
        sharedPerception: source.perception ?? fallback.sharedPerception,
      };
    }

    return syncLegacyAddedPartnerIdsInState({
      currentPartnerId: legacyPartnerId,
      spacesByPartnerId: legacyPartnerIds.reduce<Record<string, CoupleSpaceData>>((acc, partnerId) => {
        acc[partnerId] = hydrateCoupleSpace(
          partnerId === legacyPartnerId
            ? source
            : {
                partnerId,
                addedPartnerIds: legacyPartnerIds,
              },
          createDefaultCoupleSpaceData({
            partnerId,
            addedPartnerIds: legacyPartnerIds,
          }),
        );
        return acc;
      }, {}),
      sharedPerception: fallback.sharedPerception,
      dismissedPartnerIds: fallback.dismissedPartnerIds,
    });
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
  const sharedPerception =
    readSharedPerception(source as Partial<CoupleSpaceState> | null | undefined)
    ?? fallback.sharedPerception;
  const dismissedPartnerIds = Array.isArray((source as Partial<CoupleSpaceState> | null | undefined)?.dismissedPartnerIds)
    ? (source as Partial<CoupleSpaceState>).dismissedPartnerIds
    : (fallback.dismissedPartnerIds ?? []);
  return {
    ...syncLegacyAddedPartnerIdsInState({
      currentPartnerId,
      spacesByPartnerId: hydratedSpaces,
      sharedPerception,
      dismissedPartnerIds,
    }),
    sharedPerception,
  };
}

export function getCurrentCoupleSpaceData(
  state: CoupleSpaceState | null | undefined,
  fallback?: CoupleSpaceData,
): CoupleSpaceData {
  const baseFallback = fallback ?? createDefaultCoupleSpaceData();
  const currentPartnerId = state?.currentPartnerId ?? baseFallback.partnerId ?? null;
  const knownPartnerIds = collectKnownPartnerIds(state, baseFallback);

  if (!currentPartnerId) {
    return syncLegacyAddedPartnerIdsInSpace(createDefaultCoupleSpaceData({
      ...baseFallback,
      partnerId: null,
      perception: state?.sharedPerception ?? baseFallback.perception,
    }), knownPartnerIds);
  }

  const currentSpace = hydrateCoupleSpace(
    state?.spacesByPartnerId?.[currentPartnerId] ?? { partnerId: currentPartnerId },
    createDefaultCoupleSpaceData({
      ...baseFallback,
      partnerId: currentPartnerId,
      perception: state?.sharedPerception ?? baseFallback.perception,
    }),
  );

  const nextCurrentSpace = state?.sharedPerception
    ? {
        ...currentSpace,
        perception: state.sharedPerception,
      }
    : currentSpace;

  return syncLegacyAddedPartnerIdsInSpace(nextCurrentSpace, knownPartnerIds);
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

export function getPartnerCoupleSpaceData(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
  partnerId: string,
): CoupleSpaceData {
  const resolvedState = resolveCoupleSpaceState(state, currentSpace);
  const sharedPerception = resolvedState.sharedPerception ?? currentSpace?.perception;
  const existingSpace = resolvedState.spacesByPartnerId?.[partnerId];
  if (!existingSpace) {
    return createDefaultCoupleSpaceData({
      partnerId: null,
      perception: sharedPerception,
      addedPartnerIds: collectKnownPartnerIds(resolvedState, currentSpace),
    });
  }

  const partnerFallback = currentSpace?.partnerId === partnerId
    ? (currentSpace ?? createDefaultCoupleSpaceData({ partnerId, perception: sharedPerception }))
    : createDefaultCoupleSpaceData({ partnerId, perception: sharedPerception });

  return getCurrentCoupleSpaceData(
    {
      currentPartnerId: partnerId,
      spacesByPartnerId: resolvedState.spacesByPartnerId,
      sharedPerception: resolvedState.sharedPerception,
      dismissedPartnerIds: resolvedState.dismissedPartnerIds,
    },
    partnerFallback,
  );
}

export function isPartnerCoupleSpaceDismissed(
  state: CoupleSpaceState | null | undefined,
  currentSpace: CoupleSpaceData | null | undefined,
  partnerId: string,
): boolean {
  const resolvedState = resolveCoupleSpaceState(state, currentSpace);
  return (resolvedState.dismissedPartnerIds ?? []).includes(partnerId);
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
  const shouldUpdateSharedPerception =
    Boolean(nextPatch)
    && typeof nextPatch === 'object'
    && 'perception' in nextPatch;

  const nextState = syncLegacyAddedPartnerIdsInState({
      currentPartnerId,
      spacesByPartnerId: nextSpaces,
      sharedPerception: shouldUpdateSharedPerception
        ? nextCurrentSpace.perception
        : (
            currentPartnerId
              ? resolvedState.sharedPerception
              : (nextCurrentSpace.perception ?? resolvedState.sharedPerception)
          ),
      dismissedPartnerIds: resolvedState.dismissedPartnerIds,
    });

  return {
    coupleSpaceState: nextState,
    coupleSpace: getCurrentCoupleSpaceData(nextState, nextCurrentSpace),
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
  const nextState = syncLegacyAddedPartnerIdsInState({
    currentPartnerId,
    spacesByPartnerId: nextSpaces,
    sharedPerception: resolvedState.sharedPerception,
    dismissedPartnerIds: resolvedState.dismissedPartnerIds,
  });

  return {
    coupleSpaceState: nextState,
    coupleSpace: currentPartnerId
      ? getCurrentCoupleSpaceData(
          nextState,
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
      sharedPerception: resolvedState.sharedPerception,
    },
    createDefaultCoupleSpaceData({
      ...(currentSpace || {}),
      partnerId,
    }),
  );
  const nextState = syncLegacyAddedPartnerIdsInState({
    currentPartnerId: partnerId,
    spacesByPartnerId: nextSpaces,
    sharedPerception: resolvedState.sharedPerception,
    dismissedPartnerIds: resolvedState.dismissedPartnerIds,
  });

  return {
    coupleSpaceState: nextState,
    coupleSpace: getCurrentCoupleSpaceData(nextState, nextCurrentSpace),
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
  const nextDismissedPartnerIds = uniquePartnerIds([
    ...(resolvedState.dismissedPartnerIds ?? []),
    partnerId,
  ]);
  const nextState = syncLegacyAddedPartnerIdsInState({
    currentPartnerId: nextCurrentPartnerId,
    spacesByPartnerId: nextSpaces,
    sharedPerception: resolvedState.sharedPerception,
    dismissedPartnerIds: nextDismissedPartnerIds,
  });

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
  const nextState = syncLegacyAddedPartnerIdsInState({
    currentPartnerId: partnerId,
    spacesByPartnerId: {
      ...resolvedState.spacesByPartnerId,
      [partnerId]: {
        ...acceptedSpace,
        partnerId,
      },
    },
    sharedPerception: resolvedState.sharedPerception,
    dismissedPartnerIds: (resolvedState.dismissedPartnerIds ?? []).filter((id) => id !== partnerId),
  });

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
  const coupleSpaceState = syncLegacyAddedPartnerIdsInState({
    currentPartnerId:
      currentSpaceProjection.currentPartnerId ?? baseCoupleSpaceState.currentPartnerId,
    spacesByPartnerId: {
      ...baseCoupleSpaceState.spacesByPartnerId,
      ...currentSpaceProjection.spacesByPartnerId,
    },
    sharedPerception:
      currentSpaceProjection.sharedPerception
      ?? baseCoupleSpaceState.sharedPerception,
    dismissedPartnerIds: baseCoupleSpaceState.dismissedPartnerIds,
  });

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
  const partnerIds = collectKnownPartnerIds(undefined, currentSpace);
  const partnerId = normalizePartnerId(currentSpace?.partnerId) ?? partnerIds[0] ?? null;
  if (!partnerId || !currentSpace) {
    return {
      ...createDefaultCoupleSpaceState(null),
      sharedPerception: currentSpace?.perception,
    };
  }

  return syncLegacyAddedPartnerIdsInState({
    currentPartnerId: partnerId,
    spacesByPartnerId: partnerIds.reduce<Record<string, CoupleSpaceData>>((acc, nextPartnerId) => {
      acc[nextPartnerId] = hydrateCoupleSpace(
        nextPartnerId === partnerId
          ? currentSpace
          : {
              partnerId: nextPartnerId,
              addedPartnerIds: partnerIds,
            },
        createDefaultCoupleSpaceData({
          partnerId: nextPartnerId,
          addedPartnerIds: partnerIds,
        }),
      );
      return acc;
    }, {}),
    sharedPerception: undefined,
    dismissedPartnerIds: [],
  });
}

export function loadPersistedCoupleSpace(fallback: CoupleSpaceData): CoupleSpaceData {
  const persisted = loadJson<Partial<CoupleSpaceData> | Partial<CoupleSpaceState> | null>(STORAGE_KEYS.coupleSpace, null);
  const state = hydrateCoupleSpaceState(persisted, createDefaultCoupleSpaceState(fallback.partnerId ?? null));
  return getCurrentCoupleSpaceData(state, fallback);
}

export function persistCoupleSpace(
  data: CoupleSpaceData,
  state?: CoupleSpaceState | null,
): void {
  saveJson(STORAGE_KEYS.coupleSpace, state ?? projectCoupleSpaceStateFromCurrentSpace(data));
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
    'perception' in value ||
    'coNotes' in value ||
    'loveLetters' in value ||
    'messageBoard' in value ||
    'addedPartnerIds' in value ||
    'initiativeDrafts' in value ||
    'initiativeRuntime' in value
  );
}
