import { useEffect, useRef } from 'react';
import type { WalletData } from '../../types';
import { loadPersistedWalletData, persistWalletData } from './walletDataStore';

function serializeWalletData(data: WalletData): string {
  return JSON.stringify(data);
}

export function usePersistedWalletDataBridge(
  walletData: WalletData,
  setWalletData: (data: WalletData) => void,
): void {
  const setWalletDataRef = useRef(setWalletData);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef(walletData);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setWalletDataRef.current = setWalletData;
  }, [setWalletData]);

  useEffect(() => {
    const hydrated = loadPersistedWalletData(initialDataRef.current);
    const currentSerialized = serializeWalletData(initialDataRef.current);
    const hydratedSerialized = serializeWalletData(hydrated);

    hydrationTargetRef.current = hydratedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== hydratedSerialized) {
      skipUntilHydratedRef.current = true;
      setWalletDataRef.current(hydrated);
      return;
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const serialized = serializeWalletData(walletData);

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

    persistWalletData(walletData);
    lastPersistedRef.current = serialized;
  }, [walletData]);
}
