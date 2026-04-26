import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppData } from '../../types';
import { acceptCoupleSpaceInviteState, updateCurrentCoupleSpaceState } from './coupleSpaceStore';

type UseCoupleSpaceStateActionsResult = {
  handleAcceptCoupleSpaceInvite: (partnerId: string) => void;
  handleUpdateCurrentCoupleSpace: (updates: any) => void;
};

export function useCoupleSpaceStateActions(
  setAppData: Dispatch<SetStateAction<AppData>>,
): UseCoupleSpaceStateActionsResult {
  const handleUpdateCurrentCoupleSpace = useCallback((updates: any) => {
    setAppData((prev) => {
      const { coupleSpaceState, coupleSpace } = updateCurrentCoupleSpaceState(
        prev.coupleSpaceState,
        prev.coupleSpace,
        updates,
      );
      return {
        ...prev,
        coupleSpaceState,
        coupleSpace,
      };
    });
  }, [setAppData]);

  const handleAcceptCoupleSpaceInvite = useCallback((partnerId: string) => {
    setAppData((prev) => {
      const { coupleSpaceState, coupleSpace } = acceptCoupleSpaceInviteState(
        prev.coupleSpaceState,
        prev.coupleSpace,
        partnerId,
      );
      return {
        ...prev,
        coupleSpaceState,
        coupleSpace,
      };
    });
  }, [setAppData]);

  return {
    handleAcceptCoupleSpaceInvite,
    handleUpdateCurrentCoupleSpace,
  };
}
