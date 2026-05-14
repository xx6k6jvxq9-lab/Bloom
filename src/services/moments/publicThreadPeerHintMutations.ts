import type { Character, CharacterPublicThreadPeerHint } from '../../types';

export type PublicThreadPeerHintPatch = Partial<CharacterPublicThreadPeerHint> & {
  familiarity?: CharacterPublicThreadPeerHint['familiarity'];
};

export function upsertCharacterPublicThreadPeerHint(
  character: Character,
  targetCharacterId: string,
  updates: PublicThreadPeerHintPatch,
): CharacterPublicThreadPeerHint[] | undefined {
  const currentHints = character.publicThreadPeerHints || [];
  const existing = currentHints.find((hint) => hint.targetCharacterId === targetCharacterId);
  const nextHint: CharacterPublicThreadPeerHint = {
    targetCharacterId,
    familiarity: updates.familiarity || existing?.familiarity || 'stranger',
    ...(updates.interactionStyle !== undefined
      ? { interactionStyle: updates.interactionStyle }
      : existing?.interactionStyle
        ? { interactionStyle: existing.interactionStyle }
        : {}),
    ...(updates.allowBanter !== undefined
      ? { allowBanter: updates.allowBanter }
      : existing && 'allowBanter' in existing
        ? { allowBanter: existing.allowBanter }
        : {}),
    ...(updates.allowIntimateTone !== undefined
      ? { allowIntimateTone: updates.allowIntimateTone }
      : existing && 'allowIntimateTone' in existing
        ? { allowIntimateTone: existing.allowIntimateTone }
        : {}),
    ...(updates.allowOwnershipTone !== undefined
      ? { allowOwnershipTone: updates.allowOwnershipTone }
      : existing && 'allowOwnershipTone' in existing
        ? { allowOwnershipTone: existing.allowOwnershipTone }
        : {}),
    ...(updates.momentInteractionPolicy !== undefined
      ? { momentInteractionPolicy: updates.momentInteractionPolicy }
      : existing?.momentInteractionPolicy
        ? { momentInteractionPolicy: existing.momentInteractionPolicy }
        : {}),
    ...(updates.source !== undefined
      ? { source: updates.source }
      : { source: 'manual' as const }),
    ...(updates.note !== undefined
      ? (updates.note.trim() ? { note: updates.note.trim() } : {})
      : existing?.note
        ? { note: existing.note }
        : {}),
    updatedAt: Date.now(),
  };

  const shouldPersist = (
    nextHint.familiarity !== 'stranger'
    || nextHint.interactionStyle !== undefined
    || typeof nextHint.allowBanter === 'boolean'
    || typeof nextHint.allowIntimateTone === 'boolean'
    || typeof nextHint.allowOwnershipTone === 'boolean'
    || nextHint.momentInteractionPolicy !== undefined
    || !!nextHint.note
  );

  const filtered = currentHints.filter((hint) => hint.targetCharacterId !== targetCharacterId);
  return shouldPersist
    ? [...filtered, nextHint]
    : filtered.length > 0 ? filtered : undefined;
}

export function applyBidirectionalPublicThreadPeerHint(
  characters: Character[],
  leftCharacterId: string,
  rightCharacterId: string,
  updates: PublicThreadPeerHintPatch,
) {
  return characters.map((character) => {
    if (character.id === leftCharacterId) {
      return {
        ...character,
        publicThreadPeerHints: upsertCharacterPublicThreadPeerHint(character, rightCharacterId, updates),
      };
    }
    if (character.id === rightCharacterId) {
      return {
        ...character,
        publicThreadPeerHints: upsertCharacterPublicThreadPeerHint(character, leftCharacterId, updates),
      };
    }
    return character;
  });
}
