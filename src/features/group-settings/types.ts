import type { ChatGroup, Character } from '../../types';
import type { GroupMemberRole } from './groupRoles';

export type GroupRelationshipOption = NonNullable<ChatGroup['memberRelationshipState']>;

export type GroupSettingsFormState = {
  name: string;
  avatar?: string;
  groupBackground: string;
  headerStyle: NonNullable<ChatGroup['headerStyle']>;
  headerOpacity: number;
  footerStyle: NonNullable<ChatGroup['footerStyle']>;
  footerOpacity: number;
  groupNickname: string;
  groupNotice: string;
  groupRemark: string;
  backgroundSummary: string;
  memberRelationshipState?: GroupRelationshipOption;
  memberRelationshipNote: string;
  currentScene: string;
  publicFacts: string;
  awarenessMode: NonNullable<ChatGroup['awarenessMode']>;
  activeWorldBookIds: string[];
  allowDirectMemoryInterop: boolean;
  muteNotifications: boolean;
  pinChat: boolean;
  manualReplyEnabled: boolean;
  voiceRepliesEnabled: boolean;
  voiceReplyMemberIds: string[];
};

export type GroupSettingsPatch = Pick<
  ChatGroup,
  | 'name'
  | 'avatar'
  | 'groupBackground'
  | 'headerStyle'
  | 'headerOpacity'
  | 'footerStyle'
  | 'footerOpacity'
  | 'groupNickname'
  | 'groupNotice'
  | 'groupRemark'
  | 'backgroundSummary'
  | 'memberRelationshipState'
  | 'memberRelationshipNote'
  | 'currentScene'
  | 'publicFacts'
  | 'awarenessMode'
  | 'activeWorldBookIds'
  | 'allowDirectMemoryInterop'
  | 'allowDirectMemoryInteropConfigured'
  | 'muteNotifications'
  | 'pinChat'
  | 'manualReplyEnabled'
  | 'voiceRepliesEnabled'
  | 'voiceReplyMemberIds'
>;

export type GroupSettingsMemberSummary = Pick<Character, 'id' | 'name' | 'remarkName' | 'avatar'> & {
  role: GroupMemberRole;
  badgeLabel?: string;
  badgeColor?: string;
  bubbleColor?: string;
  voiceEnabled?: boolean;
  isDutyAdmin?: boolean;
  dutyAdminExpiresAt?: number;
  hasTemporaryManagedFeatureGrant?: boolean;
  temporaryManagedFeatureGrantExpiresAt?: number;
  temporaryManagedFeatureGrantRemainingUses?: number;
  knowsGroup?: boolean;
  groupAwarenessSource?: ChatGroup['awarenessEntries'] extends Array<infer T>
    ? T extends { source?: infer S }
      ? S
      : never
    : never;
  joinRequestCooldownUntil?: number;
  nominationCooldownUntil?: number;
  isMuted?: boolean;
  mutedAt?: number;
  muteExpiresAt?: number;
};
