
export type Mask = {
  id: string;
  name: string;
  personality: string;
  occupation: string;
  relationship: string;
  worldBackground: string; // New field
  isActive: boolean;
  linkedCharacters: string[]; // IDs of characters that use this mask
};

export type FavoriteMessage = {
  id: string;
  characterId: string;
  characterName: string;
  text: string;
  timestamp: number;
  category: string;
};

export type WidgetType = 'calendar' | 'anniversary' | 'time' | 'music' | 'weather' | 'blank' | 'profile-card';

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  style?: string;
  page?: number;
  slotId?: string;
  x?: number;
  y?: number;
  w: number;
  h: number;
  background: string; // URL or color
  title?: string;
  date?: string; // For anniversary
  borderRadius?: number;
  opacity?: number;
  bannerUrl?: string;
  avatarUrl?: string;
  profileName?: string;
  handle?: string;
  bio?: string;
  location?: string;
  material?: 'default' | 'frosted' | 'dark';
};

export type DesktopIconConfig = {
  id: string; // app id like 'chat', 'settings', etc.
  page?: number;
  iconUrl?: string;
  borderRadius?: number;
  slotId?: string;
  x?: number;
  y?: number;
};

export type NavBarConfig = {
  show: boolean;
  style: 'default' | 'glass' | 'minimal';
  shape: 'pill' | 'rectangle' | 'circle' | 'square';
  showMultipleAvatars: boolean;
  page?: number;
  slotId?: string;
  offsetX?: number;
  offsetY?: number;
  backgroundImage?: string;
  selectedCharacterId?: string;
  statusBarPlacement: 'top' | 'bottom' | 'hidden';
  customCss?: string;
};

export type ChatCustomization = {
  background?: string;
  avatarSize: number;
  avatarBorderRadius: number;
  avatarBorderColor: string;
  avatarBorderWidth: number;
  avatarFrameUrl?: string;
  messageBorderRadius: number;
  messageBackgroundColorUser: string;
  messageBackgroundColorModel: string;
  messageBackgroundImageUrl?: string;
  messageSpacing: number;
  bubbleStyleCss?: string;
  modelBubbleStyleCss?: string;
  userBubbleStyleCss?: string;
  headerStyle?: 'default' | 'glass' | 'solid' | 'transparent';
  footerStyle?: 'default' | 'glass' | 'solid' | 'transparent';
  uiScale?: number;
  fontSize?: number;
};

export type DynamicsCustomization = {
  background: string;
  cardStyle: 'flat' | 'glass' | 'neumorphism';
  cardBorderRadius: number;
  cardOpacity: number;
  customCss?: string;
};

export type DesktopCustomization = {
  iconSize: number;
  iconBorderRadius: number;
  gridColumns: number;
  gridGap: number;
  dockSlotId?: string;
  topWidgetRow?: number;
  appOrder?: string[];
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
};

export type ThemeFontAsset = {
  id: string;
  name: string;
  source: string;
  format?: string;
};

export type ThemeTypographySettings = {
  importedFonts?: ThemeFontAsset[];
  selectedFontId?: string;
  fontPriority?: 'css-only' | 'imported-first' | 'lock-imported';
  textColor?: string;
  previewText?: string;
};

export type VisualSettings = {
  globalBackground: string;
  chatOpacity: number;
  momentsBackground?: string;
  themeScopedCss?: Record<string, string>;
  themeTypography?: ThemeTypographySettings;
  // New settings
  desktopIcons: DesktopIconConfig[];
  widgets: WidgetConfig[];
  navBar: NavBarConfig;
  desktop: DesktopCustomization;
  chat: ChatCustomization;
  dynamics: DynamicsCustomization;
  globalCss: string; // For real-time CSS injection
  
  // Properties required by BeautifyManager
  desktopIconSize?: number;
  desktopCornerRadius?: number;
  desktopShadowDepth?: number;
  desktopContentScale?: number;
  desktopBgMask?: number;
  desktopPadding?: number;
  topBarAlign?: 'left' | 'center' | 'right';
  topBarOpacity?: number;
  topBarBlur?: number;
  tabBarCapsuleMode?: boolean;
  tabBarHideLabels?: boolean;
  chatAvatarRounding?: number;
  chatAvatarBorderWidth?: number;
  chatAvatarGlow?: boolean;
  chatBubbleSpacing?: number;
  chatBubbleBorderWidth?: number;
  chatBubbleBlur?: number;
  chatBubbleGradient?: boolean;
  chatBubbleRadius?: { tl: number; tr: number; br: number; bl: number };
  customCSS?: string;
  desktopWallpaper?: string;
  cardBgMask?: number;
  desktopCards?: any[];
  cardCornerRadius?: number;
  cardShadowDepth?: number;
  cardPadding?: number;
  cardContentScale?: number;
  tabBarStyle?: string;
  avatarRounding?: number;
  avatarBorderWidth?: number;
  avatarGlow?: boolean;
  bubbleCornerRadii?: { tl: number; tr: number; br: number; bl: number };
  bubbleBorderWidth?: number;
  bubbleGlassmorphism?: number;
  bubbleSpacing?: number;
  snapshots?: any[];
  innerIconSize?: number;
  innerIconRounding?: number;
  innerIconColor?: string;
};

export type CardLayout = {
  id: string;
  type: string;
  name?: string;
  size?: { w: number; h: number };
  position?: { x: number; y: number };
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export type ThemeSnapshot = {
  id: string;
  name: string;
  settings: VisualSettings;
  timestamp: number;
};

export type UserProfileExtended = {
  name: string;
  avatar: string;
  id: string;
  bio: string;
  mood: string;
};

export type WorldBookEntry = {
  id: string;
  title: string;
  content: string;
  category: string;
  priorityLevel?: 'low' | 'normal' | 'high' | 'critical';
  isActive: boolean;
  isGlobal: boolean;
  characterIds?: string[];
};

export type CoNote = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
  isCompleted: boolean;
  isArchived?: boolean;
  replyToNoteId?: string;
  replyToAuthorId?: string;
  replyToAuthorName?: string;
};

export type LedgerEntry = {
  id: string;
  payerId: string;
  amount: number;
  description: string;
  timestamp: number;
};

export type LoveLetterComment = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
};

export type LoveLetter = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
  comments: LoveLetterComment[];
  isArchived?: boolean;
  isPinned?: boolean;
};

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  authorId: string;
};

export type CalendarMoodStampId =
  | 'missing_you'
  | 'clingy'
  | 'happy'
  | 'expecting'
  | 'quiet'
  | 'sulky'
  | 'flutter'
  | 'softened';

export type CalendarMoodStamp = {
  id: string;
  date: string; // YYYY-MM-DD
  actorId: 'user' | 'partner';
  mood: CalendarMoodStampId;
  createdAt: number;
};

export type HeartCapsuleCategory =
  | 'relationship_shift'
  | 'async_dual_rule'
  | 'truth_variant';

export type HeartCapsuleDrawSource = 'self' | 'partner';

export type HeartCapsuleMachineHistoryEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  drawnAt: number;
  drawnBy: HeartCapsuleDrawSource;
  capsuleId: string;
  capsuleName: string;
  capsuleCategory: HeartCapsuleCategory;
  summary: string;
  selectedQuestion?: string | null;
  roundCompletedAt?: number | null;
  openingText?: string | null;
  userAnswer?: string | null;
  resultReply?: string | null;
  hiddenThought?: string | null;
  partnerAnswerGuess?: string | null;
  ruleGuess?: string | null;
};

export type HeartCapsuleTodayDraw = HeartCapsuleMachineHistoryEntry & {
  revealedAt?: number | null;
};

export type HeartCapsuleMachineState = {
  todayDraw: HeartCapsuleTodayDraw | null;
  history: HeartCapsuleMachineHistoryEntry[];
};

export type CouplePostComment = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
  replyToCommentId?: string;
  replyToAuthorId?: string;
  replyToAuthorName?: string;
};

export type CouplePost = {
  id: string;
  authorId: string;
  content: string;
  images?: string[];
  timestamp: number;
  likes: string[];
  comments: CouplePostComment[];
  isArchived?: boolean;
  isPinned?: boolean;
};

export type Anniversary = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  isCountdown: boolean;
};

export type MessageBoardEntry = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
  isArchived?: boolean;
  isPinned?: boolean;
};

export type CoupleSpaceInitiativeCadence = 'off' | 'low' | 'medium' | 'high';

export type CoupleSpaceOpportunityLevel = 'off' | 'low' | 'medium' | 'high';

export type CoupleSpaceInitiativeGroup =
  | 'publishing'
  | 'memo'
  | 'recording'
  | 'interaction';

export type CoupleSpaceCommitMode = 'auto' | 'draft' | 'confirm';

export type CoupleSpaceEvidenceLevel = 'none' | 'light' | 'explicit';

export type CoupleSpaceInitiativeSource =
  | 'cadence_window'
  | 'recent_interaction'
  | 'reply_opportunity'
  | 'light_evidence'
  | 'explicit_evidence'
  | 'manual_check';

export type CoupleSpaceInitiativeActionType =
  | 'post_couple_daily'
  | 'write_love_letter'
  | 'post_message_board_entry'
  | 'write_co_note'
  | 'create_ledger_entry'
  | 'reply_love_letter'
  | 'reply_daily_comment'
  | 'reply_message_board'
  | 'react_to_existing_post';

export type CoupleSpaceInitiativeDraftActionType = Extract<
  CoupleSpaceInitiativeActionType,
  'write_love_letter' | 'write_co_note'
>;

export type CoupleSpaceInitiativeDraftEntry = {
  id: string;
  actionType: CoupleSpaceInitiativeDraftActionType;
  content: string;
  createdAt: number;
  source: 'manual_check' | 'auto_check';
};

export type CoupleSpacePublishingActionSettings = {
  enabled: boolean;
  cadence: CoupleSpaceInitiativeCadence;
};

export type CoupleSpacePublishingSettings = {
  dailyPost: CoupleSpacePublishingActionSettings;
  loveLetter: CoupleSpacePublishingActionSettings;
  messageBoard: CoupleSpacePublishingActionSettings;
};

export type CoupleSpaceMemoSettings = {
  writeCoNote: {
    enabled: boolean;
    opportunityLevel: CoupleSpaceOpportunityLevel;
    evidenceLevel: Extract<CoupleSpaceEvidenceLevel, 'light'>;
    defaultCommitMode: Extract<CoupleSpaceCommitMode, 'auto' | 'draft'>;
  };
};

export type CoupleSpaceRecordingSettings = {
  createLedgerEntry: {
    enabled: boolean;
    evidenceLevel: Extract<CoupleSpaceEvidenceLevel, 'explicit'>;
    defaultCommitMode: Extract<CoupleSpaceCommitMode, 'confirm'>;
  };
};

export type CoupleSpaceInteractionSettings = {
  replyLoveLetter: {
    enabled: boolean;
    opportunityLevel: CoupleSpaceOpportunityLevel;
  };
  replyDailyComment: {
    enabled: boolean;
    opportunityLevel: CoupleSpaceOpportunityLevel;
  };
  replyMessageBoard: {
    enabled: boolean;
    opportunityLevel: CoupleSpaceOpportunityLevel;
  };
  reactToExistingPost: {
    enabled: boolean;
    opportunityLevel: CoupleSpaceOpportunityLevel;
  };
};

export type CoupleSpaceInitiativeSettings = {
  publishing: CoupleSpacePublishingSettings;
  memo: CoupleSpaceMemoSettings;
  recording: CoupleSpaceRecordingSettings;
  interaction: CoupleSpaceInteractionSettings;
};

export type CoupleSpaceInitiativeRuntimeRule = {
  actionType: CoupleSpaceInitiativeActionType;
  group: CoupleSpaceInitiativeGroup;
  enabled: boolean;
  commitMode: CoupleSpaceCommitMode;
  evidenceLevel: CoupleSpaceEvidenceLevel;
  cadence?: CoupleSpaceInitiativeCadence;
  opportunityLevel?: CoupleSpaceOpportunityLevel;
  cooldownHours?: number;
  lastTriggeredAt: number | null;
  lastDraftedAt: number | null;
  lastCommittedAt: number | null;
};

export type CoupleSpaceInitiativeRuntimeRecord = Pick<
  CoupleSpaceInitiativeRuntimeRule,
  'lastTriggeredAt' | 'lastDraftedAt' | 'lastCommittedAt'
>;

export type CoupleSpaceInitiativeRuntimeState = {
  rules: Record<CoupleSpaceInitiativeActionType, CoupleSpaceInitiativeRuntimeRule>;
};

export type CoupleSpaceInitiativeCandidate = {
  actionType: CoupleSpaceInitiativeActionType;
  group: CoupleSpaceInitiativeGroup;
  commitMode: CoupleSpaceCommitMode;
  source: CoupleSpaceInitiativeSource;
  reason?: string;
  evidenceSummary?: string;
};

export type MemoryLibraryKind = 'short-term' | 'long-term';

export type MemoryLibrarySource = 'auto' | 'manual';

export type MemoryLibraryEntry = {
  id: string;
  kind: MemoryLibraryKind;
  source: MemoryLibrarySource;
  content: string;
  createdAt: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  charCount: number;
};

export type CharacterAvatarLibraryEntryStatus =
  | 'current'
  | 'candidate'
  | 'saved'
  | 'rejected'
  | 'used';

export type CharacterAvatarLibraryEntrySource =
  | 'upload'
  | 'url'
  | 'chat-image'
  | 'manual'
  | 'character-choice';

export type CharacterAvatarLibraryEntry = {
  id: string;
  image: string;
  source: CharacterAvatarLibraryEntrySource;
  status: CharacterAvatarLibraryEntryStatus;
  addedAt: number;
  updatedAt: number;
  firstMessageTimestamp?: number;
  lastUsedAt?: number;
  reaction?: string;
  reason?: string;
  label?: string;
  tags?: string[];
};

export type CharacterAvatarLibrary = {
  entries: CharacterAvatarLibraryEntry[];
  updatedAt: number;
};

export type Character = {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  avatar: string;
  setting: string;
  corePersona?: string;
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  sceneHints?: Record<string, string>;
  remarkName?: string;
  signature?: string;
  openingRemark: string;
  lastMessage?: string;
  lastTime?: number;
  // 聊天设置
  isMuted?: boolean;
  isPinned?: boolean;
  memoryLimit?: number;
  background?: string;
  bubbleColor?: string;
  bubbleImage?: string;
  userBubbleColor?: string;
  userBubbleImage?: string;
  worldBook?: string;
  activeWorldBookIds?: string[];
  globalMemory?: string;
  autoSummaryEnabled?: boolean;
  summaryInterval?: number;
  autoLongTermMinShortTermEntries?: number;
  autoLongTermMinDaySpan?: number;
  memorySummary?: string;
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
  memoryLibraryEntries?: MemoryLibraryEntry[];
  avatarLibrary?: CharacterAvatarLibrary;
  stickers?: string[];
  maskId?: string; // Linked mask ID
  groupId?: string; // Group ID for contacts
  motto?: string;
  bubbleStyleCss?: string;
  userBubbleStyleCss?: string;
  showTokenCount?: boolean;
  minReplies?: number;
  maxReplies?: number;
  autoReplyEnabled?: boolean;
  actionDescriptionEnabled?: boolean;
  characterActionDescriptionEnabled?: boolean;
  postFrequency?: 'low' | 'medium' | 'high' | 'none';
  autoTranslate?: boolean;
  replyLanguageMode?: 'follow-user' | 'chinese-with-native-flavor' | 'native-first' | 'fixed';
  nativeLanguage?: string;
  fixedReplyLanguage?: string;
  showTime?: boolean;
};

import type { FactTraceRecord } from './services/relationship-context/factTypes';
import type { RelationshipWaveRecord } from './services/relationship-context/types';

export type SharedPostSnapshot = {
  id: string;
  title: string;
  content: string;
  images?: string[];
  authorName: string;
  authorAvatar: string;
};

export type GroupPollOption = {
  id: string;
  text: string;
  voterIds: string[];
};

export type GroupPollCard = {
  kind: 'poll';
  title: string;
  createdBy: string;
  createdAt: number;
  status: 'active' | 'completed';
  options: GroupPollOption[];
};

export type GroupRelayEntry = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
};

export type GroupRelayCard = {
  kind: 'relay';
  topic: string;
  createdBy: string;
  createdAt: number;
  status: 'active' | 'completed';
  entries: GroupRelayEntry[];
};

export type GroupTaskEntry = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
};

export type GroupTaskCard = {
  kind: 'task';
  prompt: string;
  createdBy: string;
  createdAt: number;
  participantIds: string[];
  rounds: number;
  status: 'active' | 'completed';
  entries: GroupTaskEntry[];
};

export type ChatMessage = {
  role: 'user' | 'model';
  text: string;
  source?: 'app' | 'wechat';
  channel?: 'app' | 'wechat-clawbot';
  channelConversationId?: string;
  translation?: string;
  timestamp: number;
  senderCharacterId?: string;
  isPending?: boolean;
  isRecalled?: boolean;
  isEdited?: boolean;
  isFavorited?: boolean;
  transferStatus?: 'pending' | 'received' | 'rejected';
  transferId?: string;
  transferCardId?: string;
  transferDisplayLabel?: string;
  transferTargetLabel?: string;
  isSystem?: boolean;
  needsReply?: boolean;
  sharedPost?: SharedPostSnapshot;
  replyTo?: {
    text: string;
    role: 'user' | 'model';
    timestamp: number;
    authorLabel: string;
    preview: string;
  };
  imageUrl?: string;
  audioUrl?: string;
  audioMimeType?: string;
  audioTranscript?: string;
  stickerLabel?: string;
  isVoiceCall?: boolean;
  duration?: number; // For voice call duration
  location?: { name: string; address?: string; isVirtual?: boolean };
  isInnerVoice?: boolean;
  groupPollCard?: GroupPollCard;
  groupRelayCard?: GroupRelayCard;
  groupTaskCard?: GroupTaskCard;
};

export type ChatHistory = {
  [characterId: string]: ChatMessage[];
};

export type GroupTopicState = {
  anchor: string;
  startedBy: 'user' | 'character';
  startedById?: string;
  lastSpeaker: 'user' | 'character';
  lastSpeakerId?: string;
  lastSpeakerName?: string;
  lastBeat?: string;
  replyTargetLabel?: string;
  replyTargetRole?: 'user' | 'model';
  startedAt: number;
  lastUpdatedAt: number;
  heat: 'low' | 'medium' | 'high';
  phase: 'opening' | 'active' | 'cooling' | 'closing';
};

export type GroupLongTermMemory = {
  atmosphere?: string;
  recurringDynamics?: string;
  sharedHistory?: string;
  memberRoles?: Record<string, string>;
};

export type MomentComment = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
  replyToCommentId?: string;
  replyToAuthorId?: string;
  replyToAuthorName?: string;
};

export type MomentImageCard = {
  title: string;
  description: string;
  theme: 'polaroid' | 'film' | 'note' | 'poster';
  layout?: 'card' | 'described-photo' | 'inner-voice';
  overlayText?: string;
};

export type MomentSourceChatMessageRef = {
  characterId: string;
  timestamp: number;
};

export type MomentItem = {
  id: string;
  authorId: string;
  content: string;
  images?: string[];
  imageCard?: MomentImageCard;
  sourceChatMessage?: MomentSourceChatMessageRef;
  timestamp: number;
  likes: number;
  likedBy?: string[];
  isLiked?: boolean;
  isCollected?: boolean;
  comments: MomentComment[];
};

export type PerceptionSettings = {
  enabled: boolean;
  dateTime: { enabled: boolean; value: string };
  location: { enabled: boolean; value: string };
  weather: { enabled: boolean; value: string };
  temperature: { enabled: boolean; value: string };
  climate: { enabled: boolean; value: string };
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  url: string;
  duration: number;
};

export type Playlist = {
  id: string;
  name: string;
  cover: string;
  songs: Song[];
  type: 'user' | 'character' | 'collaborative';
  authorId?: string;
  collaboratorId?: string;
};

export type MusicData = {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  playlists: Playlist[];
  likedSongs: string[]; // Song IDs
  collectedSongs: string[]; // Song IDs
  history: string[]; // Song IDs
  recentlyPlayed: string[]; // Song IDs
  togetherWith: string | null; // Character ID
  togetherStartTime: number | null;
  chatHistory: ChatMessage[];
  queue: Song[];
  neteaseAccount?: {
    uid: string;
    profileUrl: string;
    linkedAt: number;
  } | null;
};

export type CoupleSpaceData = {
  partnerId: string | null; // ID of the AI character
  anniversaryDate: number | null; // timestamp
  backgroundUrl: string | null;
  userAvatarFrame?: string | null;
  partnerAvatarFrame?: string | null;
  loveLetterEnvelopeBg?: string | null;
  loveLetterEnvelopeColor?: string | null;
  loveLetterPaperTexture?: 'default' | 'vintage' | 'grid' | 'floral';
  loveLetterPaperBg?: string | null;
  calendarBg?: string | null;
  coNotes: CoNote[];
  ledger: LedgerEntry[];
  loveLetters: LoveLetter[];
  calendarEvents: CalendarEvent[];
  moodStamps?: CalendarMoodStamp[];
  heartCapsuleMachine?: HeartCapsuleMachineState;
  posts?: CouplePost[];
  anniversaries?: Anniversary[];
  messageBoard?: MessageBoardEntry[];
  initiativeDrafts?: CoupleSpaceInitiativeDraftEntry[];
  initiativeRuntime?: Partial<
    Record<CoupleSpaceInitiativeActionType, CoupleSpaceInitiativeRuntimeRecord>
  >;
  addedPartnerIds?: string[];
  perception?: PerceptionSettings;
  initiativeSettings?: CoupleSpaceInitiativeSettings;
};

export type CoupleSpaceState = {
  currentPartnerId: string | null;
  spacesByPartnerId: Record<string, CoupleSpaceData>;
};


export type ForumComment = {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  timestamp: number;
  likes: string[]; // User IDs
  replyToId?: string; // For nested replies
  rootCommentId?: string; // To group threads
};

export type ForumPost = {
  id: string;
  authorId: string;
  title: string;
  content: string; // Summary or full content
  images?: string[];
  category: string; // New field
  timestamp: number;
  viewCount: number;
  likes: string[]; // User IDs
  collections: string[]; // User IDs
  comments: ForumComment[];
  isReported?: boolean;
};

export type ForumNotification = {
  id: string;
  userId: string;
  type: 'reply' | 'like_post' | 'like_comment';
  sourceUserId: string;
  postId: string;
  commentId?: string;
  timestamp: number;
  read: boolean;
};

export type ForumData = {
  posts: ForumPost[];
  notifications: ForumNotification[];
  followedUsers?: string[];
};

export type FriendRequest = {
  id: string;
  fromUserId: string; // Virtual ID
  fromUserName: string;
  fromUserAvatar: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
  message?: string;
};

export type ChatGroup = {
  id: string;
  name: string;
  avatar?: string;
  groupBackground?: string;
  headerStyle?: 'default' | 'glass' | 'solid' | 'transparent';
  headerOpacity?: number;
  footerStyle?: 'default' | 'glass' | 'solid' | 'transparent';
  footerOpacity?: number;
  memberIds: string[]; // Character IDs
  groupNickname?: string;
  groupNotice?: string;
  groupRemark?: string;
  backgroundSummary?: string;
  memberRelationshipState?: 'close' | 'semi' | 'distant' | 'mixed';
  memberRelationshipNote?: string;
  currentScene?: string;
  publicFacts?: string;
  activeWorldBookIds?: string[];
  allowDirectMemoryInterop?: boolean;
  allowDirectMemoryInteropConfigured?: boolean;
  adminIds?: string[];
  memberBadges?: Array<{
    memberId: string;
    label: string;
    color: string;
  }>;
  memberBubbleColors?: Array<{
    memberId: string;
    color: string;
  }>;
  muteNotifications?: boolean;
  pinChat?: boolean;
  manualReplyEnabled?: boolean;
  groupStage?: 'new' | 'warming' | 'familiar';
  memberRelationSeeds?: Array<{
    sourceMemberId: string;
    targetMemberId: string;
    familiarity: 'strangers' | 'aware' | 'familiar';
  }>;
  creatorId: string; // User ID
  createdAt: number;
  lastMessage?: string;
  lastTime?: number;
  history?: ChatMessage[];
  topicState?: GroupTopicState;
  groupShortTermSummary?: string;
  groupMemberPerspectiveSummaries?: Record<string, string>;
  groupLongTermMemory?: GroupLongTermMemory;
  relationshipWaves?: RelationshipWaveRecord[];
  factTraces?: FactTraceRecord[];
};

export type CallRecord = {
  id: string;
  characterId: string;
  timestamp: number;
  duration: number;
  text: string;
  tokens?: number;
};

export type DatingGeneratedContent = {
  background: {
    source: 'character-avatar' | 'url' | 'local-upload';
    image: string;
    atmosphere: string;
    focus: string;
  };
  narrative: {
    title: string;
    subtitle?: string;
    segments: {
      type: 'narration' | 'dialogue';
      text: string;
    }[];
  };
  status: {
    location: string;
    time: string;
    mood: string;
    innerThought: string;
  };
  playlist: {
    title: string;
    artist: string;
    note?: string;
  }[];
};

export type DateMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  kind?: 'user' | 'scene';
  generatedContent?: DatingGeneratedContent;
  pending?: boolean;
};

export type DateSession = {
  id: string;
  characterId: string;
  location: string;
  scenario: string;
  mood: string;
  backgroundScene: string;
  backgroundImage?: string;
  backgroundSource?: 'character-avatar' | 'url' | 'local-upload';
  generatedContent?: DatingGeneratedContent;
  messages: DateMessage[];
  timestamp: number;
  status?: 'active' | 'ended';
  endedAt?: number;
};

export type ApiConfig = {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
};

export type AppSettings = {
  activeConfigId: string;
  configs: ApiConfig[];
  sharedStickers?: string[];
  visualSettings?: VisualSettings;
  showChatTimeDividers?: boolean;
  showChatMessageTime?: boolean;
};

export type WalletCard = {
  id: string;
  type: string;
  bankName: string;
  cardType: string;
  number: string;
  balance: number;
  color: string;
  textColor: string;
  iconColor: string;
  theme: string;
  icon: string;
};

export type WalletTransaction = {
  id: string;
  title: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  icon: string;
  category: string;
  cardId: string;
};

export type WalletData = {
  balance?: number;
  yuebaoBalance?: number;
  yuebaoInterest?: number;
  familyCards?: { id: string; characterId: string; limit: number; spent: number }[];
  paymentPassword?: string;
  cards: WalletCard[];
  transactions: WalletTransaction[];
};

export type AppDataExtended = {
  characters: Character[];
  masks: Mask[];
  favorites: FavoriteMessage[];
  visualSettings: VisualSettings;
  userProfile: UserProfileExtended;
  worldBooks: WorldBookEntry[];
  musicData?: MusicData;
  forumData?: ForumData;
  friendRequests?: FriendRequest[];
  chatGroups?: ChatGroup[];
  walletData?: WalletData;
};

export type AppData = {
  characters: Character[];
  chatHistory: ChatHistory;
  userProfile: UserProfileExtended;
  masks: Mask[];
  favorites: FavoriteMessage[];
  visualSettings: VisualSettings;
  groups: string[];
  moments: MomentItem[];
  worldBooks: WorldBookEntry[];
  coupleSpace?: CoupleSpaceData;
  coupleSpaceState?: CoupleSpaceState;
  friendRequests?: FriendRequest[];
  chatGroups?: ChatGroup[];
  callHistory?: CallRecord[];
  savedDates?: DateSession[];
  collectedDates?: DateSession[];
  musicData?: MusicData;
  walletData?: WalletData;
  forumData?: ForumData;
};
