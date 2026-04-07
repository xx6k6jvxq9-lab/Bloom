import type { GroupRelationshipOption } from './types';

export const GROUP_SETTINGS_SECTIONS = {
  basicInfoTitle: '群资料',
  membersTitle: '群成员',
  profileTitle: '群资料',
  chatPreferencesTitle: '聊天设置',
  dangerTitle: '群操作',
} as const;

export const GROUP_RELATIONSHIP_OPTIONS: Array<{ value: GroupRelationshipOption; label: string }> = [
  { value: 'close', label: '都很熟' },
  { value: 'semi', label: '半熟' },
  { value: 'distant', label: '大多不熟' },
  { value: 'mixed', label: '混合' },
];

export const GROUP_SETTINGS_PLACEHOLDERS = {
  groupName: '未设置',
  groupNickname: '未设置',
  groupNotice: '未设置',
  groupRemark: '未设置',
  backgroundSummary: '未设置',
  memberRelationshipNote: '补充说明',
  currentScene: '未设置',
  publicFacts: '未设置',
} as const;
