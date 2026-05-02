export type ForumChannel =
  | 'junction'
  | 'present'
  | 'oldDynasty'
  | 'xianmen'
  | 'otherworld'
  | 'starSea'
  | 'weird'
  | 'cyber'
  | 'apocalypse'
  | 'underworld'
  | 'dragonPalace'
  | 'infiniteTower'
  | 'godCourt'
  | 'dreamStation'
  | 'bookCity'
  | 'beastPlain';

export type ForumThreadType =
  | 'normal'
  | 'gossip'
  | 'help'
  | 'rift'
  | 'sameTopic'
  | 'sighting'
  | 'timeline'
  | 'essay'
  | 'vote'
  | 'commission'
  | 'reversal'
  | 'ownerUpdate';

export type ForumContentTier =
  | 'baseline'
  | 'ferment'
  | 'highlight'
  | 'fragment';

export type ForumLifecycleStage =
  | 'new'
  | 'initialReplies'
  | 'ownerUpdated'
  | 'heated'
  | 'reversal'
  | 'closed';

export type ForumAuthorType = 'user' | 'anonymous' | 'forumNpc' | 'owner';

export type ForumNpcTier = 'passerby' | 'resident' | 'developable';

export type ForumRelationshipStage =
  | 'stranger'
  | 'seen'
  | 'interacted'
  | 'dm'
  | 'friend'
  | 'groupMember';

export type ForumRevealState =
  | 'nickname_only'
  | 'name_hint'
  | 'real_name_revealed';

export type ForumUserIdentityType =
  | 'anonymous'
  | 'momo'
  | 'channelMask'
  | 'custom';

export type ForumStats = {
  likes: number;
  favorites: number;
  comments: number;
  views: number;
};

export type ForumCommentV2 = {
  id: string;
  threadId: string;
  parentId?: string;
  floor: number;
  authorType: ForumAuthorType;
  authorId?: string;
  authorDisplayName: string;
  authorRole?: string;
  body: string;
  likes: number;
  isHighlighted?: boolean;
  isOwnerReply?: boolean;
  createdAt: number;
};

export type ForumThreadV2 = {
  id: string;
  title: string;
  body: string;
  channel: ForumChannel;
  threadType: ForumThreadType;
  contentTier?: ForumContentTier;
  discourseAxis?: string;
  authorType: Extract<ForumAuthorType, 'user' | 'anonymous' | 'forumNpc'>;
  authorId?: string;
  authorDisplayName: string;
  userMaskId?: string;
  tags: string[];
  comments: ForumCommentV2[];
  lifecycleStage: ForumLifecycleStage;
  stats: ForumStats;
  source: 'seed' | 'generated' | 'user' | 'cached';
  createdAt: number;
  updatedAt: number;
};

export type ForumNpcProfile = {
  id: string;
  nickname: string;
  handle?: string;
  realName?: string;
  homeChannel: ForumChannel;
  visibleChannels: ForumChannel[];
  avatar?: string;
  signature?: string;
  npcTier: ForumNpcTier;
  personaTags: string[];
  speakingStyle: string;
  revealState: ForumRevealState;
  relationshipStage: ForumRelationshipStage;
  firstMetThreadId?: string;
  sharedThreadIds: string[];
  sourceCommentIds: string[];
};

export type ForumUserIdentity = {
  id: string;
  channel: ForumChannel;
  displayName: string;
  identityType: ForumUserIdentityType;
  description?: string;
  createdAt: number;
};

export type ForumWorldTheme = {
  channel: ForumChannel;
  label: string;
  coreConflicts: string[];
  toneKeywords: string[];
  exampleTopics: string[];
};
