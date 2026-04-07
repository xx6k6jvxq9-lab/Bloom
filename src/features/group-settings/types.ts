import type { ChatGroup, Character } from '../../types';

export type GroupRelationshipOption = NonNullable<ChatGroup['memberRelationshipState']>;

export type GroupSettingsFormState = {
  name: string;
  avatar?: string;
  groupNickname: string;
  groupNotice: string;
  groupRemark: string;
  backgroundSummary: string;
  memberRelationshipState?: GroupRelationshipOption;
  memberRelationshipNote: string;
  currentScene: string;
  publicFacts: string;
  allowDirectMemoryInterop: boolean;
  muteNotifications: boolean;
  pinChat: boolean;
};

export type GroupSettingsPatch = Pick<
  ChatGroup,
  | 'name'
  | 'avatar'
  | 'groupNickname'
  | 'groupNotice'
  | 'groupRemark'
  | 'backgroundSummary'
  | 'memberRelationshipState'
  | 'memberRelationshipNote'
  | 'currentScene'
  | 'publicFacts'
  | 'allowDirectMemoryInterop'
  | 'allowDirectMemoryInteropConfigured'
  | 'muteNotifications'
  | 'pinChat'
>;

export type GroupSettingsMemberSummary = Pick<Character, 'id' | 'name' | 'remarkName' | 'avatar'>;
