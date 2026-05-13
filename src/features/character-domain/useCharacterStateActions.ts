import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppData, Character } from '../../types';
import { isCharacterChatPreviewPatch } from '../persistence/characterChatPreview';
import { saveCharacters } from '../persistence/charactersStore';
import { patchCharacterById, updateCharacterById, upsertCharacter } from './characterMutations';

type UseCharacterStateActionsResult = {
  handleMergeCharacter: (updatedCharacter: Character) => void;
  handlePatchCharacterById: (characterId: string, patch: Partial<Character>) => void;
  handleUpsertCharacter: (character: Character) => void;
};

export function useCharacterStateActions(
  setAppData: Dispatch<SetStateAction<AppData>>,
): UseCharacterStateActionsResult {
  const handlePatchCharacterById = useCallback((characterId: string, patch: Partial<Character>) => {
    const shouldPersistCharacters = !isCharacterChatPreviewPatch(patch);
    setAppData((prev) => {
      const nextCharacters = patchCharacterById(prev.characters, characterId, patch);
      if (shouldPersistCharacters) {
        void saveCharacters(nextCharacters);
      }
      return {
        ...prev,
        characters: nextCharacters,
      };
    });
  }, [setAppData]);

  const handleMergeCharacter = useCallback((updatedCharacter: Character) => {
    setAppData((prev) => {
      const nextCharacters = updateCharacterById(prev.characters, updatedCharacter.id, (character) => ({
        ...character,
        ...updatedCharacter,
      }));
      void saveCharacters(nextCharacters);
      return {
        ...prev,
        characters: nextCharacters,
      };
    });
  }, [setAppData]);

  const handleUpsertCharacter = useCallback((character: Character) => {
    setAppData((prev) => {
      const nextCharacters = upsertCharacter(prev.characters, character);
      void saveCharacters(nextCharacters);
      return {
        ...prev,
        characters: nextCharacters,
      };
    });
  }, [setAppData]);

  return {
    handleMergeCharacter,
    handlePatchCharacterById,
    handleUpsertCharacter,
  };
}
