import type { UserProfileExtended } from '../../types';

export type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export type UserProfile = UserProfileExtended;

export type CoupleSpaceUpdateToast = {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  moduleLabel: string;
};

export type MomentPublishToast = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  preview: string;
};
