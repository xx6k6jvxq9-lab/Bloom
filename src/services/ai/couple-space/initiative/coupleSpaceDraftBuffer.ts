import type {
  CoNote,
  CoupleSpaceData,
  CoupleSpaceInitiativeDraftActionType,
  CoupleSpaceInitiativeDraftEntry,
  LoveLetter,
} from '../../../../types';

type CreateDraftEntryInput = {
  actionType: CoupleSpaceInitiativeDraftActionType;
  content: string;
  createdAt?: number;
  source: 'manual_check' | 'auto_check';
};

export function getCoupleSpaceDraftLabel(
  actionType: CoupleSpaceInitiativeDraftActionType,
): string {
  return actionType === 'write_love_letter' ? '情书草稿' : '互记草稿';
}

export function createCoupleSpaceInitiativeDraftEntry(
  input: CreateDraftEntryInput,
): CoupleSpaceInitiativeDraftEntry {
  const createdAt = input.createdAt ?? Date.now();
  return {
    id: `${input.actionType}_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
    actionType: input.actionType,
    content: input.content.trim(),
    createdAt,
    source: input.source,
  };
}

export function appendCoupleSpaceInitiativeDraft(
  coupleSpace: CoupleSpaceData,
  draft: CoupleSpaceInitiativeDraftEntry,
): CoupleSpaceData {
  const existingDrafts = coupleSpace.initiativeDrafts ?? [];
  const duplicate = existingDrafts.some(
    (item) => item.actionType === draft.actionType && item.content.trim() === draft.content.trim(),
  );

  if (duplicate) {
    return coupleSpace;
  }

  return {
    ...coupleSpace,
    initiativeDrafts: [draft, ...existingDrafts],
  };
}

export function removeCoupleSpaceInitiativeDraft(
  coupleSpace: CoupleSpaceData,
  draftId: string,
): CoupleSpaceData {
  return {
    ...coupleSpace,
    initiativeDrafts: (coupleSpace.initiativeDrafts ?? []).filter((draft) => draft.id !== draftId),
  };
}

export function publishCoupleSpaceInitiativeDraft(
  coupleSpace: CoupleSpaceData,
  draftId: string,
  authorId: string,
  now?: number,
): CoupleSpaceData {
  const draft = (coupleSpace.initiativeDrafts ?? []).find((item) => item.id === draftId);
  if (!draft) {
    return coupleSpace;
  }

  const publishedAt = now ?? Date.now();
  const nextSpaceWithoutDraft = removeCoupleSpaceInitiativeDraft(coupleSpace, draftId);

  if (draft.actionType === 'write_love_letter') {
    const nextLetter: LoveLetter = {
      id: `${draft.id}_published`,
      authorId,
      content: draft.content,
      timestamp: publishedAt,
      comments: [],
    };

    return {
      ...nextSpaceWithoutDraft,
      loveLetters: [nextLetter, ...(nextSpaceWithoutDraft.loveLetters ?? [])],
    };
  }

  const nextNote: CoNote = {
    id: `${draft.id}_published`,
    authorId,
    content: draft.content,
    timestamp: publishedAt,
    isCompleted: false,
  };

  return {
    ...nextSpaceWithoutDraft,
    coNotes: [nextNote, ...(nextSpaceWithoutDraft.coNotes ?? [])],
  };
}
