import { useEffect, useRef } from 'react';
import type { Character } from '../../types';
import { loadCharacters, saveCharacters } from './charactersStore';

type UsePersistedCharactersBridgeOptions = {
  hydrate?: (source: Character[] | null | undefined, fallback: Character[]) => Character[];
};

function serializeCharacters(characters: Character[]): string {
  return JSON.stringify(characters);
}

export function usePersistedCharactersBridge(
  characters: Character[],
  setCharacters: (value: Character[]) => void,
  options: UsePersistedCharactersBridgeOptions = {},
): void {
  const setCharactersRef = useRef(setCharacters);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialCharactersRef = useRef(characters);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setCharactersRef.current = setCharacters;
  }, [setCharacters]);

  useEffect(() => {
    const persisted = loadCharacters(initialCharactersRef.current);
    const hydrated = options.hydrate
      ? options.hydrate(persisted, initialCharactersRef.current)
      : persisted;
    const currentSerialized = serializeCharacters(initialCharactersRef.current);
    const hydratedSerialized = serializeCharacters(hydrated);

    hydrationTargetRef.current = hydratedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== hydratedSerialized) {
      skipUntilHydratedRef.current = true;
      setCharactersRef.current(hydrated);
      return;
    }

    hasHydratedRef.current = true;
  }, [options.hydrate]);

  useEffect(() => {
    const serialized = serializeCharacters(characters);

    if (skipUntilHydratedRef.current) {
      if (serialized === hydrationTargetRef.current) {
        skipUntilHydratedRef.current = false;
        hasHydratedRef.current = true;
        lastPersistedRef.current = serialized;
      }
      return;
    }

    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
    }

    if (lastPersistedRef.current === serialized) {
      return;
    }

    saveCharacters(characters);
    lastPersistedRef.current = serialized;
  }, [characters]);
}
