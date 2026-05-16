
import type { ForumThreadType } from './features/forum-domain/types';
import type { ForumChannel } from './features/forum-domain/types';
import type { CharacterSharedContextSnapshot } from './services/relationship-context/types';

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

export type WidgetType =
  | 'calendar'
  | 'anniversary'
  | 'time'
  | 'floating-time'
  | 'music'
  | 'weather'
  | 'blank'
  | 'profile-card'
  | 'kawaii-launcher'
  | 'kawaii-couple-pills'
  | 'kawaii-scrapbook'
  | 'glass-duo-card'
  | 'glass-vinyl-player'
  | 'glass-polaroid-strip'
  | 'glass-recent-grid';

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
  secondaryAvatarUrl?: string;
  photoUrl?: string;
  secondaryPhotoUrl?: string;
  audioUrl?: string;
  images?: string[];
  note?: string;
  line1Text?: string;
  line2Text?: string;
  item1Label?: string;
  item2Label?: string;
  item3Label?: string;
  item4Label?: string;
  item1Color?: string;
  item2Color?: string;
  item3Color?: string;
  item4Color?: string;
  showDate?: boolean;
  showLunar?: boolean;
  showOutline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  datePosition?: 'top' | 'bottom';
  timeWeight?: number;
  timeColor?: string;
  dateColor?: string;
};

export type DesktopIconConfig = {
  id: string; // app id like 'chat', 'settings', etc.
  page?: number;
  iconUrl?: string;
  iconPreviewUrl?: string;
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
  avatar?: string;
  mood?: string;
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
  avatarFrameCss?: string;
  modelAvatarFrameCss?: string;
  userAvatarFrameCss?: string;
  messageBorderRadius: number;
  messageBackgroundColorUser: string;
  messageBackgroundColorModel: string;
  messageBackgroundImageUrl?: string;
  messageSpacing: number;
  bubbleScale?: number;
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
  backgroundMode?: 'fullscreen' | 'header';
  cardStyle: 'flat' | 'glass' | 'neumorphism';
  cardBorderRadius: number;
  cardOpacity: number;
  profileNameColor?: string;
  profileNameFontFamily?: string;
  profileMoodColor?: string;
  profileMoodFontFamily?: string;
  customCss?: string;
};

export type DesktopCustomization = {
  iconSize: number;
  iconBorderRadius: number;
  gridColumns: number;
  gridGap: number;
  dockBackgroundImage?: string;
  dockBackgroundPreviewUrl?: string;
  dockTintColor?: string;
  dockTintOpacity?: number;
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
  globalBackgroundPreviewUrl?: string;
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
  pinMode?: 'none' | 'always';
  summary?: string;
  mustReadFacts?: string[];
  keywords?: string[];
  fingerprint?: string;
  chunkCache?: {
    id: string;
    label: string;
    content: string;
    keywords?: string[];
  }[];
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

export type CharacterOpenLoopKind = 'scene' | 'relationship' | 'task' | 'topic' | 'unknown';

export type CharacterOpenLoopStatus = 'active' | 'waiting_user' | 'dormant' | 'resolved';

export type CharacterOpenLoopEntry = {
  id: string;
  kind: CharacterOpenLoopKind;
  status: CharacterOpenLoopStatus;
  content: string;
  source: 'short_term_summary' | 'recent_history' | 'manual';
  createdAt: number;
  lastTouchedAt: number;
  updatedAt: number;
  resumeHint?: string;
};

export type CharacterPresenceState = {
  lastSeenAt: number;
  availability: 'live' | 'recent' | 'returning' | 'away';
  recentLifeBeat?: string;
  resumeTone?: 'natural_continue' | 'soft_return' | 'fresh_reentry';
  updatedAt: number;
};

export type CharacterSharedState = {
  updatedAt: number;
  sourceScene: 'direct_chat' | 'group_chat' | 'dating' | 'music_together' | 'couple_space' | 'forum' | 'moments';
  availability: CharacterPresenceState['availability'];
  resumeTone?: CharacterPresenceState['resumeTone'];
  currentActivity?: string;
  attentionNote?: string;
  publicCarryover?: string;
  privateCarryover?: string;
};

export type CharacterActiveDatingState = {
  sessionId: string;
  startedAt: number;
  updatedAt: number;
  status: 'active';
  summary: string;
  relationshipResidue?: string;
  sceneProgressSummary?: string;
  boundaryNote?: string;
};

export type ChatMemorySnapshot = {
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
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

export type CharacterPublicThreadPeerHint = {
  targetCharacterId: string;
  familiarity: 'stranger' | 'aware' | 'familiar';
  interactionStyle?: 'guarded' | 'neutral' | 'banter' | 'warm';
  allowBanter?: boolean;
  allowIntimateTone?: boolean;
  allowOwnershipTone?: boolean;
  momentInteractionPolicy?: 'observe_only' | 'allow_interaction' | 'block';
  source?: 'manual' | 'moment_growth';
  note?: string;
  updatedAt?: number;
};

export type CharacterMomentPrivateCarryoverLevel = 'none' | 'light' | 'medium' | 'high';
export type CharacterFriendshipStatus = 'friends' | 'none';

export type Character = {
  id: string;
  numericId?: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  avatar: string;
  // Legacy-compatible longform setting field. Active runtime paths should prefer corePersona.
  setting: string;
  corePersona?: string;
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  sceneHints?: Record<string, string>;
  publicThreadPeerHints?: CharacterPublicThreadPeerHint[];
  remarkName?: string;
  signature?: string;
  openingRemark: string;
  lastMessage?: string;
  lastTime?: number;
  lastViewedMessageTimestamp?: number;
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
  // Deprecated compatibility field. Keep only for migration / fallback compatibility.
  memorySummary?: string;
  // Compatibility field. The records-first runtime may still mirror into this field,
  // but new logic should prefer memoryRecords-derived short-term state.
  shortTermSummary?: string;
  // Compatibility field. The records-first runtime may still mirror into this field,
  // but new logic should prefer memoryRecords-derived long-term state.
  longTermMemoryProfile?: string;
  // Deprecated compatibility field. New memory flows should persist into memoryRecords.
  memoryLibraryEntries?: MemoryLibraryEntry[];
  // Compatibility field. Primary open-loop reconstruction should come from memoryRecords.
  openLoopRegistry?: CharacterOpenLoopEntry[];
  presenceState?: CharacterPresenceState;
  // Compatibility field. New shared-state reads should treat this as a cached projection,
  // not the first-choice source when records can rebuild a fresher state.
  sharedState?: CharacterSharedState;
  activeDatingState?: CharacterActiveDatingState;
  // Compatibility field. Keep as a snapshot bridge / fallback layer while runtime reads
  // continue moving toward records-first scene signals.
  sharedContextSnapshots?: CharacterSharedContextSnapshot[];
  avatarLibrary?: CharacterAvatarLibrary;
  stickers?: string[];
  stickerMetadata?: Record<string, StickerMetadata>;
  maskId?: string; // Linked mask ID
  groupId?: string; // Group ID for contacts
  friendshipStatus?: CharacterFriendshipStatus;
  blockedByUser?: boolean;
  blockedByCharacter?: boolean;
  relationshipStatusUpdatedAt?: number;
  motto?: string;
  bubbleStyleCss?: string;
  userBubbleStyleCss?: string;
  avatarFrameCss?: string;
  userAvatarFrameCss?: string;
  showTokenCount?: boolean;
  minReplies?: number;
  maxReplies?: number;
  autoReplyEnabled?: boolean;
  actionDescriptionEnabled?: boolean;
  characterActionDescriptionEnabled?: boolean;
  postFrequency?: 'low' | 'medium' | 'high' | 'none';
  momentPrivateCarryoverLevel?: CharacterMomentPrivateCarryoverLevel;
  allowPrivateMomentCarryover?: boolean;
  autoTranslate?: boolean;
  replyLanguageMode?: 'follow-user' | 'chinese-with-native-flavor' | 'native-first' | 'fixed';
  nativeLanguage?: string;
  fixedReplyLanguage?: string;
  showTime?: boolean;
  voiceProfile?: CharacterVoiceProfile;
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

export type GroupOfflineMode = 'daily' | 'scenario' | 'random';
export type GroupOfflineGenerationMode = 'blocks' | 'ensemble' | 'single' | 'pair' | 'group';
export type GroupOfflineRoundDispatchMode = 'recommend' | 'random' | 'manual' | 'continue';
export type GroupOfflineStylePresetId = 'jjwxc' | 'haitang' | 'yanyan' | 'fanqie' | 'qidian';

export type GroupOfflineParticipantPresence =
  | 'arrived'
  | 'en_route'
  | 'late'
  | 'left'
  | 'added_midway'
  | 'pending';

export type GroupOfflineParticipant = {
  characterId: string;
  joinedAt: number;
  presence: GroupOfflineParticipantPresence;
  isTemporary?: boolean;
  note?: string;
};

export type GroupOfflineTargetRef = {
  type: 'user' | 'character' | 'group' | 'scene';
  label: string;
  characterId?: string;
};

export type GroupOfflineStatusField = {
  key: string;
  label: string;
  value: string;
};

export type GroupOfflineSoundtrack = {
  title: string;
  artist: string;
  note: string;
};

export type GroupOfflineParticipantSoundtrack = {
  characterId: string;
  characterName: string;
  title: string;
  artist: string;
  note: string;
};

export type GroupOfflineAftereffectItem = {
  sourceLabel: string;
  actionText: string;
  residueText: string;
};

export type GroupOfflineAftereffects = {
  searches: string[];
  items: GroupOfflineAftereffectItem[];
};

export type GroupOfflineMemoryPanel = {
  shortTerm: string[];
  longTerm: string[];
};

export type GroupOfflineSceneLine = {
  id: string;
  speakerId?: string;
  speakerLabel?: string;
  target?: GroupOfflineTargetRef;
  text: string;
  highlightText?: string;
};

export type GroupOfflineCharacterBlock = {
  characterId: string;
  summary: string;
  target?: GroupOfflineTargetRef;
  statusFields: GroupOfflineStatusField[];
};

export type GroupOfflineRoundCharacterEntry = {
  characterId: string;
  speakerLabel: string;
  target?: GroupOfflineTargetRef;
  text: string;
  highlightText?: string;
  recommendedSong?: GroupOfflineSoundtrack;
  statusFields: GroupOfflineStatusField[];
  notebook?: string;
  aftereffects?: GroupOfflineAftereffects;
  memoryPanel?: GroupOfflineMemoryPanel;
  lastOperation?: 'generated' | 'retried' | 'polished' | 'edited';
};

export type GroupOfflineRoundRuntimeProjectionSnapshot = {
  userName: string;
  groupName: string;
  groupSummary: {
    groupShortTermSummary?: string;
    groupLongTermAtmosphere?: string;
    groupRecurringDynamics?: string;
    groupSharedHistory?: string;
    backgroundSummary?: string;
    memberRelationshipState?: string;
    currentScene?: string;
    publicFacts?: string;
  };
  characters: Array<{
    identity: {
      characterId: string;
      name: string;
      displayName: string;
      remarkName?: string;
      avatar?: string;
      avatarCandidates: string[];
      signature?: string;
      openingRemark?: string;
    };
    persona: {
      corePersona?: string;
      expressionStyle?: string;
      boundaryPack?: string;
      extendedLore?: string;
      sceneHint?: string;
      worldBookPrompt?: string;
    };
    memory: {
      shortTermSummary?: string;
      longTermMemoryProfile?: string;
      sharedCharacterStatePrompt?: string;
    };
    userRelation: {
      relationshipSummary?: string;
      publicAcquaintanceSummary?: string;
      sharedRecentRelationshipSummary?: string;
      relationshipTensionSummary?: string;
    };
    peerRelations: Array<{
      peerCharacterId: string;
      peerName: string;
      familiarityLabel?: string;
      interactionStyleLabel?: string;
      summary: string;
    }>;
    groupState: {
      groupShortTermSummary?: string;
      groupMemberPerspectiveSummary?: string;
      groupLongTermAtmosphere?: string;
      groupRecurringDynamics?: string;
      groupSharedHistory?: string;
      speakerLongTermGroupRole?: string;
      backgroundSummary?: string;
      memberRelationshipState?: string;
      currentScene?: string;
      publicFacts?: string;
      topicStatePrompt?: string;
    };
    relationshipContextSummary?: string;
  }>;
};

export type GroupOfflineRoundPlanSnapshot = {
  generationMode: 'blocks' | 'ensemble';
  dispatchMode?: GroupOfflineRoundDispatchMode;
  selectedCharacterIds: string[];
  summary: string;
  characterSteps: Array<{
    characterId: string;
    speakerLabel: string;
    target: GroupOfflineTargetRef;
  }>;
};

export type GroupOfflineRound = {
  id: string;
  title?: string;
  sceneText?: string;
  characterEntries: GroupOfflineRoundCharacterEntry[];
  generationMode?: GroupOfflineGenerationMode;
  dispatchMode?: GroupOfflineRoundDispatchMode;
  selectedCharacterIds?: string[];
  userMessageText?: string;
  runtimeProjectionSnapshot?: GroupOfflineRoundRuntimeProjectionSnapshot;
  plannerSnapshot?: GroupOfflineRoundPlanSnapshot;
};

export type GroupOfflineEndingVoice = {
  characterId: string;
  characterName: string;
  text: string;
};

export type GroupOfflineGeneratedContent = {
  card: {
    timeLabel: string;
    locationLabel: string;
    weatherLabel: string;
    participantLabels: string[];
    objectiveLabel?: string;
    roundLabel?: string;
  };
  intro: string;
  soundtrack?: GroupOfflineSoundtrack;
  participantSoundtracks?: GroupOfflineParticipantSoundtrack[];
  lines: GroupOfflineSceneLine[];
  characterBlocks: GroupOfflineCharacterBlock[];
  rounds?: GroupOfflineRound[];
  endingVoices?: GroupOfflineEndingVoice[];
};

export type GroupOfflineLiveMessage = {
  id: string;
  role: 'user' | 'system';
  text: string;
  targetLabel?: string;
  timestamp: number;
};

export type GroupOfflineCard = {
  kind: 'offline';
  sessionId: string;
  title: string;
  createdBy: string;
  createdAt: number;
  mode: GroupOfflineMode;
  status: 'active' | 'ended';
  locationLabel: string;
  timeLabel: string;
  weatherLabel?: string;
  participantLabels: string[];
  objectiveLabel?: string;
  roundLabel?: string;
  summaryLines?: string[];
  soundtrack?: GroupOfflineSoundtrack;
};

export type GroupOfflineSession = {
  id: string;
  groupId: string;
  mode: GroupOfflineMode;
  generationMode?: GroupOfflineGenerationMode;
  activityType: string;
  customActivityType?: string;
  location: string;
  scenePrompt?: string;
  timeLabel: string;
  weatherLabel: string;
  vibe: string;
  highlightColor?: string;
  bodyTextColor?: string;
  selectedWorldBookIds?: string[];
  worldBookHint?: string;
  backgroundImage?: string;
  backgroundSource?: 'group-background' | 'url' | 'local-upload';
  narrativePerspective?: DateNarrativePerspective;
  writingPreset?: DateWritingPreset;
  writingReference?: DateWritingReference;
  dialogueFormat?: DateDialogueFormat;
  descriptionDensity?: DateDescriptionDensity;
  writingStyleCustom?: string;
  maxGeneratedChars?: number;
  participants: GroupOfflineParticipant[];
  createdAt: number;
  updatedAt: number;
  currentRound: number;
  roundLimit?: number;
  generatedContent?: GroupOfflineGeneratedContent;
  messages: GroupOfflineLiveMessage[];
  isSaved?: boolean;
  isCollected?: boolean;
  summaryCard?: {
    title: string;
    lines: string[];
  };
  status: 'active' | 'ended';
  endedAt?: number;
};

export type ChatMessageContentType =
  | 'text'
  | 'game-card'
  | 'game-card-error'
  | 'inner-voice'
  | 'transfer'
  | 'couple-space-invite'
  | 'couple-space-invite-accepted';

export type LightInteractionMessageMeta = {
  type: 'poke';
  scene: 'direct' | 'group';
  interactionId: string;
  step: 'system' | 'assistant' | 'counter' | 'spectator';
  actorRole: 'user' | 'character';
  actorLabel: string;
  targetLabel: string;
  mood?: string;
  streak?: number;
  descriptors?: string[];
  nextActions?: string[];
  counterActionType?: 'none' | 'poke_back';
};

export type ChatMessage = {
  role: 'user' | 'model';
  text: string;
  contentType?: ChatMessageContentType;
  source?: 'app';
  channel?: 'app';
  channelConversationId?: string;
  translation?: string;
  timestamp: number;
  senderCharacterId?: string;
  isPending?: boolean;
  deliveryStatus?: 'normal' | 'failed_blocked';
  deliveryErrorText?: string;
  deliveryFailureReason?: 'blocked_by_character';
  isRecalled?: boolean;
  isEdited?: boolean;
  isFavorited?: boolean;
  transferStatus?: 'pending' | 'received' | 'rejected';
  transferId?: string;
  transferCardId?: string;
  transferDisplayLabel?: string;
  transferTargetLabel?: string;
  transferSettledAt?: number;
  isSystem?: boolean;
  systemTone?: 'default' | 'danger';
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
  groupOfflineCard?: GroupOfflineCard;
  memorySnapshot?: ChatMemorySnapshot;
  lightInteractionMeta?: LightInteractionMessageMeta;
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
  translatedOverlayText?: string;
  frameCaptions?: string[];
  translatedFrameCaptions?: string[];
};

export type MomentSourceChatMessageRef = {
  characterId: string;
  timestamp: number;
};

export type MomentSourceImageRef = {
  source: 'recent_chat_image';
  characterId: string;
  messageTimestamp?: number;
  imageUrl?: string;
};

export type MomentVisibilityScope = 'contacts' | 'known_network' | 'forum_mirror';

export type MomentItem = {
  id: string;
  authorId: string;
  visibilityScope?: MomentVisibilityScope;
  content: string;
  translation?: string;
  images?: string[];
  imageCard?: MomentImageCard;
  sourceChatMessage?: MomentSourceChatMessageRef;
  sourceImage?: MomentSourceImageRef;
  timestamp: number;
  likes: number;
  likedBy?: string[];
  isLiked?: boolean;
  isCollected?: boolean;
  isPinned?: boolean;
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
  songLibrary?: Song[]; // Persisted song snapshots used to resolve liked/collected/history across reloads.
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
  sharedPerception?: PerceptionSettings;
  dismissedPartnerIds?: string[];
};


export type ForumComment = {
  id: string;
  postId: string;
  authorId: string;
  authorIdentity?: 'self' | 'anonymous' | 'character';
  authorMaskId?: string;
  ownerUserId?: string;
  authorCharacterId?: string;
  content: string;
  timestamp: number;
  likes: string[]; // User IDs
  replyToId?: string; // For nested replies
  rootCommentId?: string; // To group threads
  isAiGenerated?: boolean;
};

export type ForumPost = {
  id: string;
  authorId: string;
  authorIdentity?: 'self' | 'anonymous' | 'character';
  authorMaskId?: string;
  ownerUserId?: string;
  authorCharacterId?: string;
  board?: 'public' | 'spectator';
  title: string;
  content: string; // Summary or full content
  images?: string[];
  category: string; // New field
  threadType?: ForumThreadType;
  contentTier?: import('./features/forum-domain/types').ForumContentTier;
  discourseAxis?: string;
  timestamp: number;
  viewCount: number;
  likes: string[]; // User IDs
  collections: string[]; // User IDs
  comments: ForumComment[];
  isReported?: boolean;
  source?: 'seed' | 'generated' | 'user';
  aiDetailExpanded?: boolean;
  aiLastExpandedAt?: number;
  aiLastReplyAt?: number;
  hotScore?: number;
  hotState?: 'none' | 'warm' | 'hot';
  hotContinuationCount?: number;
  lastHotContinuationAt?: number;
  lastHotContinuationSource?: 'feed_refresh' | 'detail_refresh';
  poll?: {
    options: Array<{
      id: string;
      text: string;
      voterIds: string[];
    }>;
  };
};

export type ForumNotification = {
  id: string;
  userId: string;
  type: 'reply_to_post' | 'reply_to_comment' | 'like_post' | 'like_comment' | 'follow' | 'friend_request';
  sourceUserId: string;
  postId: string;
  commentId?: string;
  timestamp: number;
  read: boolean;
};

export type ForumTempChatMessage = {
  id: string;
  role: 'user' | 'npc';
  text: string;
  timestamp: number;
  readAt?: number;
};

export type ForumTempChatPendingReply = {
  userMessageId: string;
  userText: string;
  readAt: number;
  replyAt?: number;
  behavior: 'instant' | 'delayed' | 'ghost';
  status: 'waiting' | 'typing' | 'ghosted';
  previewText?: string;
  relatedPostId?: string | null;
};

export type ForumTempChatSession = {
  authorId: string;
  createdAt: number;
  updatedAt: number;
  messages: ForumTempChatMessage[];
  sessionOrigin?: 'user_opened' | 'npc_auto';
  canAddFriend?: boolean;
  addedAsFriend?: boolean;
  pendingReply?: ForumTempChatPendingReply;
  viewerLastSeenAt?: number;
  completedExchangeRounds?: number;
  meaningfulReplyCount?: number;
  proactiveNpcTurnCount?: number;
  friendRequestState?: 'none' | 'ready' | 'sent' | 'accepted' | 'rejected';
  friendRequestSentAt?: number;
  lastGhostedAt?: number;
  convertedFriendId?: string;
};

export type ForumRuntimeAuthorProfile = {
  id: string;
  numericId?: string;
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  homeChannel?: ForumChannel;
  boardScope?: 'public' | 'spectator';
  persona?: string;
  speakingStyle?: string;
  preferredMove?: string;
  origin?: 'character' | 'npc' | 'seed' | 'custom';
  aliasVersion?: number;
  manuallyEdited?: boolean;
  generationMode?: 'ai' | 'fallback' | 'manual';
  aiGeneratedAt?: number;
  aiLastAttemptAt?: number;
  aiLastFailedAt?: number;
};

export type ForumComposerDraft = {
  title: string;
  content: string;
  images: string[];
  identity: 'self' | 'mask' | 'anonymous';
  maskId?: string;
  channel: string;
  threadType?: ForumThreadType | 'auto';
  board?: 'public' | 'spectator';
  updatedAt: number;
};

export type ForumSpectatorTargetRole = 'primary' | 'secondary' | 'equal';
export type ForumSpectatorObjectMode = 'user_with_characters' | 'single_character';

export type ForumSpectatorUserSlot = {
  mode: 'self' | 'mask';
  maskId?: string;
};

export type ForumSpectatorTargetCharacter = {
  characterId: string;
  role: ForumSpectatorTargetRole;
};

export type ForumSpectatorTargetPreset = {
  id: string;
  label: string;
  objectMode?: ForumSpectatorObjectMode;
  topicHint?: string;
  userSlot: ForumSpectatorUserSlot;
  userNameSource?: 'user' | 'forum';
  targetCharacters: ForumSpectatorTargetCharacter[];
  threadTypes?: ForumThreadType[];
  angles?: Array<'observation' | 'romance' | 'sighting' | 'danger' | 'fiction' | 'rumor' | 'vote' | 'contrast' | 'hardmouth' | 'protective' | 'occupy' | 'jealousy' | 'essay' | 'analysis' | 'melodrama' | 'rps' | 'bet' | 'breakup' | 'misread' | 'shipwar' | 'backstory' | 'forbidden' | 'adult' | 'enemy'>;
  relationshipSummary?: string;
  worldShell?: 'campus' | 'workplace' | 'xianmen' | 'entertainment' | 'manor' | 'starnet' | 'weird' | 'esports' | 'showbiz' | 'haoMen' | 'apocalypse' | 'agency';
};

export type ForumSpectatorSettings = {
  subjectName: string;
  relationshipSummary: string;
  objectMode?: ForumSpectatorObjectMode;
  topicHint?: string;
  mode?: 'random' | 'configured';
  threadTypes?: ForumThreadType[];
  tone?: '嘴碎路人' | '深夜不睡' | '嗑疯了' | '拉扯党' | '缺德乐子人' | '正经考据' | '半真半假' | '代餐文学' | '押注开盘' | '冷脸上头' | '阴暗乱嗑' | '买冷股的' | '见证文学' | '背德发作' | '宿敌特供';
  worldShell?: 'campus' | 'workplace' | 'xianmen' | 'entertainment' | 'manor' | 'starnet' | 'weird' | 'esports' | 'showbiz' | 'haoMen' | 'apocalypse' | 'agency';
  angles?: Array<'observation' | 'romance' | 'sighting' | 'danger' | 'fiction' | 'rumor' | 'vote' | 'contrast' | 'hardmouth' | 'protective' | 'occupy' | 'jealousy' | 'essay' | 'analysis' | 'melodrama' | 'rps' | 'bet' | 'breakup' | 'misread' | 'shipwar' | 'backstory' | 'forbidden' | 'adult' | 'enemy'>;
  autoGenerate: boolean;
  selectedCharacterIds: string[];
  userSlot?: ForumSpectatorUserSlot;
  userNameSource?: 'user' | 'forum';
  targetCharacters?: ForumSpectatorTargetCharacter[];
  targetPresets?: ForumSpectatorTargetPreset[];
  defaultThreadTypePool?: ForumThreadType[];
  cluePool?: string[];
};

export type ForumWorldBookUsageScope =
  | 'public_open'
  | 'spectator_open'
  | 'hot_followup'
  | 'detail_refresh'
  | 'ai_reply'
  | 'character_post';

export type ForumMaskUsageScope =
  | 'spectator_open'
  | 'detail_refresh'
  | 'ai_reply'
  | 'character_post';

export type ForumGlobalSettings = {
  worldBook: {
    enabled: boolean;
    strength: 'light' | 'medium' | 'strong';
    selectedIds: string[];
    selectedCategories: string[];
    scopes: Record<ForumWorldBookUsageScope, boolean>;
  };
  mask: {
    enabled: boolean;
    useActiveMaskOnly: boolean;
    selectedIds: string[];
    scopes: Record<ForumMaskUsageScope, boolean>;
  };
  social: {
    allowNpcTempChat: boolean;
    allowNpcFriendRequest: boolean;
  };
};

export type ForumData = {
  posts: ForumPost[];
  notifications: ForumNotification[];
  followedUsers?: string[];
  followerMap?: Record<string, string[]>;
  tempChats?: Record<string, ForumTempChatSession>;
  pinnedChatAuthorIds?: string[];
  pinnedPostIds?: string[];
  runtimeAuthorProfiles?: Record<string, ForumRuntimeAuthorProfile>;
  composerDraft?: ForumComposerDraft | null;
  spectatorSettings?: ForumSpectatorSettings;
  globalSettings?: ForumGlobalSettings;
};

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'superseded';
export type FriendRequestDirection = 'incoming' | 'outgoing';
export type FriendRequestInitiator = 'user' | 'character' | 'forum';
export type FriendRequestKind = 'friend' | 'reconnect' | 'relationship_event';
export type RelationshipRoundStatus = 'active' | 'resolved' | 'abandoned';

export type FriendRequest = {
  id: string;
  fromUserId: string; // Virtual ID
  fromUserName: string;
  fromUserAvatar: string;
  status: FriendRequestStatus;
  timestamp: number;
  message?: string;
  sourceScene?: 'forum' | 'manual' | 'relationship';
  direction?: FriendRequestDirection;
  initiator?: FriendRequestInitiator;
  requestKind?: FriendRequestKind;
  characterId?: string;
  threadId?: string;
  relationshipRoundId?: string;
  relationshipRoundNo?: number;
  relationshipRoundStatus?: RelationshipRoundStatus;
  relationshipRoundResolvedAt?: number;
  attemptNo?: number;
  releaseAt?: number;
  isUnread?: boolean;
  unreadAt?: number;
  supersededById?: string;
  isRelationshipEvent?: boolean;
  eventKind?:
    | 'user_blocked_character'
    | 'user_unblocked_character'
    | 'character_counter_blocked'
    | 'character_warned_user_from_chat'
    | 'character_blocked_user_from_chat';
  resolutionMessage?: string;
  userDecisionNote?: string;
  responseText?: string;
  lastUpdatedAt?: number;
  sourcePostId?: string;
  sourceTempChatAuthorId?: string;
  forumHandle?: string;
  forumBio?: string;
  forumPersona?: string;
  autoResolveAt?: number;
  autoResolveKind?: 'forum_outgoing_request';
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
  dutyAdminAssignment?: {
    memberId: string;
    grantedById: string;
    grantedAt: number;
    expiresAt: number;
  };
  temporaryPermissionGrants?: Array<{
    id: string;
    memberId: string;
    grantedById: string;
    permission: 'managed_group_feature';
    grantedAt: number;
    expiresAt: number;
    remainingUses: number;
  }>;
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
  voiceRepliesEnabled?: boolean;
  voiceReplyMemberIds?: string[];
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
  lastViewedMessageTimestamp?: number;
  history?: ChatMessage[];
  topicState?: GroupTopicState;
  groupShortTermSummary?: string;
  groupMemberPerspectiveSummaries?: Record<string, string>;
  groupLongTermMemory?: GroupLongTermMemory;
  relationshipWaves?: RelationshipWaveRecord[];
  factTraces?: FactTraceRecord[];
  activeOfflineSession?: GroupOfflineSession | null;
};

export type CallRecord = {
  id: string;
  characterId: string;
  timestamp: number;
  duration: number;
  text: string;
  tokens?: number;
};

export type DatingPageEpisodeType = 'wechat_chat' | 'feed_post' | 'document_page' | 'micro_app' | 'custom_html';
export type DatingPageEpisodeStatusBarMode = 'auto' | 'hidden' | 'custom';
export type DatingPageEpisodeCanonMode = 'side_story' | 'mainline';
export type DatingMemoryWritebackPolicy = 'allow' | 'block';
export type DatingPageEpisodePlatform =
  | 'wechat'
  | 'moments'
  | 'weibo'
  | 'xiaohongshu'
  | 'netease'
  | 'survey'
  | 'campus'
  | 'generic';

export type DatingPageEpisodeStatusBar = {
  mode?: DatingPageEpisodeStatusBarMode;
  time?: string;
  carrier?: string;
  network?: string;
  battery?: number;
};

export type DatingPageEpisodeChatMessage = {
  id?: string;
  sender: 'user' | 'character' | 'system';
  kind?: 'text' | 'timestamp' | 'system' | 'transfer';
  text?: string;
  timestampLabel?: string;
  amountLabel?: string;
  note?: string;
};

export type DatingPageEpisodeFeedComment = {
  id?: string;
  authorName: string;
  authorRole?: 'character' | 'user' | 'other';
  text: string;
  badge?: string;
};

export type DatingPageEpisodeFeedItem = {
  id?: string;
  authorName: string;
  authorBadge?: string;
  handle?: string;
  bio?: string;
  headline?: string;
  sourceLabel?: string;
  timestampLabel?: string;
  locationLabel?: string;
  topics?: string[];
  body: string;
  followerCountLabel?: string;
  followingCountLabel?: string;
  postCountLabel?: string;
  likeCountLabel?: string;
  commentCountLabel?: string;
  repostCountLabel?: string;
  comments: DatingPageEpisodeFeedComment[];
};

export type DatingPageEpisodeFeed = DatingPageEpisodeFeedItem & {
  items?: DatingPageEpisodeFeedItem[];
};

export type DatingPageEpisodeDocumentSection = {
  heading?: string;
  body: string;
};

export type DatingPageEpisodeDocument = {
  title: string;
  subtitle?: string;
  intro?: string;
  sections: DatingPageEpisodeDocumentSection[];
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
};

export type DatingPageEpisode = {
  pageType: DatingPageEpisodeType;
  platform?: DatingPageEpisodePlatform;
  title: string;
  subtitle?: string;
  caption?: string;
  canonMode?: DatingPageEpisodeCanonMode;
  statusBar?: DatingPageEpisodeStatusBar;
  htmlDocument?: string;
  chat?: {
    headerTitle: string;
    headerSubtitle?: string;
    inputPlaceholder?: string;
    messages: DatingPageEpisodeChatMessage[];
  };
  feed?: DatingPageEpisodeFeed;
  document?: DatingPageEpisodeDocument;
};

export type DatingGeneratedContent = {
  mode?: 'scene' | 'page_episode';
  appliedDirectorInstruction?: string;
  memoryWritebackPolicy?: DatingMemoryWritebackPolicy;
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
  pageEpisode?: DatingPageEpisode;
};

export type DateMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  kind?: 'user' | 'scene';
  generatedContent?: DatingGeneratedContent;
  pending?: boolean;
  isEdited?: boolean;
};

export type DateNarrativePerspective = 'default' | 'first' | 'second' | 'third';

export type DateWritingPreset =
  | 'default'
  | 'novel'
  | 'cinematic'
  | 'tender'
  | 'restrained'
  | 'casual'
  | 'tension';

export type DateWritingReference =
  | 'none'
  | 'jjwxc'
  | 'zhihu'
  | 'taiwan-romance'
  | 'youth-ache'
  | 'urban-mature'
  | 'light-novel';

export type DateDialogueFormat = 'default' | 'quoted' | 'plain';

export type DateDescriptionDensity = 'default' | 'light' | 'medium' | 'heavy';

export type DateAccentColorMode = 'character' | 'random' | 'custom';
export type DateRelationshipStageOverride = 'auto' | 'careful' | 'growing' | 'intimate';

export type DateSession = {
  id: string;
  characterId: string;
  location: string;
  scenario: string;
  mood: string;
  narrativePerspective?: DateNarrativePerspective;
  writingPreset?: DateWritingPreset;
  writingReference?: DateWritingReference;
  dialogueFormat?: DateDialogueFormat;
  descriptionDensity?: DateDescriptionDensity;
  writingStyleCustom?: string;
  relationshipStageOverride?: DateRelationshipStageOverride;
  allowAdultIntimacy?: boolean;
  highlightTextColor?: string;
  bodyTextColor?: string;
  directorInstruction?: string;
  accentColorMode?: DateAccentColorMode;
  accentColor?: string;
  backgroundScene: string;
  backgroundImage?: string;
  backgroundSource?: 'character-avatar' | 'url' | 'local-upload';
  generatedContent?: DatingGeneratedContent;
  messages: DateMessage[];
  isSaved?: boolean;
  pendingRoundRetry?: {
    mode: 'start' | 'continue';
    session: DateSession;
  } | null;
  pendingRoundError?: string;
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

export type ApiCenterProvider = 'gemini' | 'openai-compatible' | 'custom';

export type AiProviderConfig = {
  provider: ApiCenterProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
};

export type TextCallConfig = {
  enabled: boolean;
  config: AiProviderConfig;
};

export type SingleChatCallConfig = {
  id: string;
  enabled: boolean;
  name?: string;
  roleScope: {
    mode: 'all' | 'include' | 'exclude';
    characterIds?: string[];
  };
  config: AiProviderConfig;
  priority: number;
};

export type VoiceCallConfig = {
  enabled: boolean;
  tts?: {
    enabled: boolean;
    config: AiProviderConfig;
    defaultVoiceId?: string;
    defaultSampleAssetId?: string;
    defaultSampleName?: string;
    supportsVoiceClone?: boolean;
    voiceLibraryRecords?: SavedTtsVoiceRecord[];
  };
};

export type SavedTtsVoiceRecord = {
  voiceId: string;
  voiceName: string;
  source: 'voice_cloning' | 'voice_generation';
  previewAudioUrl?: string;
  createdAt: number;
  updatedAt: number;
};

export type CharacterVoiceProfile = {
  enabled: boolean;
  mode: 'default' | 'library' | 'voiceId' | 'cloned';
  voiceId?: string;
  voiceName?: string;
  voiceSource?: 'system' | 'voice_cloning' | 'voice_generation';
  sampleAssetId?: string;
  sampleName?: string;
  autoPlay?: boolean;
  replyMode?: 'text' | 'mixed' | 'voice';
  replyFrequency?: 'low' | 'medium' | 'high';
};

export type StickerMetadata = {
  label?: string;
  aliases?: string[];
  traits?: string[];
  category?: string;
  caption?: string;
  ocrText?: string;
};

export type ApiCenterConfig = {
  defaultTextCall: TextCallConfig;
  singleChatCalls: SingleChatCallConfig[];
  groupChatCall?: TextCallConfig;
  forumCall?: TextCallConfig;
  datingCall?: TextCallConfig;
  voiceCall?: VoiceCallConfig;
};

export type AppSettings = {
  activeConfigId: string;
  configs: ApiConfig[];
  apiCenterConfig?: ApiCenterConfig;
  sharedStickers?: string[];
  sharedStickerMetadata?: Record<string, StickerMetadata>;
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
  perception?: PerceptionSettings;
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
  perception?: PerceptionSettings;
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
