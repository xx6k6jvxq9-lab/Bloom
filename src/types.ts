
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
  headerStyle?: 'default' | 'glass' | 'solid' | 'transparent';
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

export type VisualSettings = {
  globalBackground: string;
  chatOpacity: number;
  momentsBackground?: string;
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
  category: '世界设定' | '角色设定' | '自己设定' | '热梗知识' | '其他';
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
};

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  authorId: string;
};

export type CouplePostComment = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
};

export type CouplePost = {
  id: string;
  authorId: string;
  content: string;
  images?: string[];
  timestamp: number;
  likes: string[];
  comments: CouplePostComment[];
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
};

export type Character = {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  avatar: string;
  setting: string;
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
  memorySummary?: string;
  stickers?: string[];
  maskId?: string; // Linked mask ID
  groupId?: string; // Group ID for contacts
  motto?: string;
  bubbleStyleCss?: string;
  showTokenCount?: boolean;
  minReplies?: number;
  maxReplies?: number;
  postFrequency?: 'low' | 'medium' | 'high' | 'none';
  autoTranslate?: boolean;
  showTime?: boolean;
};

export type SharedPostSnapshot = {
  id: string;
  title: string;
  content: string;
  images?: string[];
  authorName: string;
  authorAvatar: string;
};

export type ChatMessage = {
  role: 'user' | 'model';
  text: string;
  translation?: string;
  timestamp: number;
  isRecalled?: boolean;
  isFavorited?: boolean;
  transferStatus?: 'pending' | 'received';
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
  isVoiceCall?: boolean;
  duration?: number; // For voice call duration
  location?: { name: string; address?: string; isVirtual?: boolean };
  isInnerVoice?: boolean;
};

export type ChatHistory = {
  [characterId: string]: ChatMessage[];
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
  posts?: CouplePost[];
  anniversaries?: Anniversary[];
  messageBoard?: MessageBoardEntry[];
  addedPartnerIds?: string[];
  perception?: PerceptionSettings;
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
  memberIds: string[]; // Character IDs
  creatorId: string; // User ID
  createdAt: number;
  lastMessage?: string;
  lastTime?: number;
  history?: ChatMessage[];
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
