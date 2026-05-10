import type { Character } from '../../types';
import { rebuildSharedStateFromCharacter } from '../../services/relationship-context/buildSharedCharacterState';

export function clearCoupleSpaceCharacterMemory(character: Character): Character {
  const remainingSharedContextSnapshots = (character.sharedContextSnapshots || []).filter(
    (snapshot) => snapshot.sourceScene !== 'couple_space',
  );

  const rebuiltSharedState = remainingSharedContextSnapshots.length > 0
    ? rebuildSharedStateFromCharacter({
        character: {
          sharedState: undefined,
          presenceState: character.presenceState,
          shortTermSummary: undefined,
          sharedContextSnapshots: remainingSharedContextSnapshots,
        },
        sourceScene:
          character.sharedState?.sourceScene && character.sharedState.sourceScene !== 'couple_space'
            ? character.sharedState.sourceScene
            : undefined,
      })
    : undefined;

  return {
    ...character,
    shortTermSummary: undefined,
    openLoopRegistry: undefined,
    sharedState: rebuiltSharedState,
    sharedContextSnapshots: remainingSharedContextSnapshots,
  };
}
