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

export type RelationshipRequestToast = {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string;
  preview: string;
};

export type DatingGenerationToast = {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string;
  preview: string;
};

export type DreamGenerationToast = {
  id: string;
  roleId: string;
  roleName: string;
  roleAvatar?: string;
  title: string;
  preview: string;
};
