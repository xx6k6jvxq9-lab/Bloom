import { Character } from '../../types';

type MomentCommentLike = {
  authorId: string;
  content: string;
  replyToAuthorName?: string;
};

type MomentLike = {
  authorId: string;
  content: string;
  timestamp: number;
  comments: MomentCommentLike[];
};

export type RecentMomentContext = {
  recentMessages?: Array<{ role: 'user' | 'model'; text: string; timestamp?: number }>;
  recentMomentPublishedAt?: number | null;
  now?: number;
};

export type AutoMomentTriggerResult = {
  shouldPublish: boolean;
  reason?: string;
};

const POST_FREQUENCY_COOLDOWN_MS = {
  none: Number.POSITIVE_INFINITY,
  low: 18 * 60 * 60 * 1000,
  medium: 8 * 60 * 60 * 1000,
  high: 3 * 60 * 60 * 1000,
} as const;

const POST_FREQUENCY_TRIGGER_CHANCE = {
  none: 0,
  low: 0.2,
  medium: 0.45,
  high: 0.7,
} as const;

const DIRECT_MOMENT_COMMAND_PATTERNS = [
  /^发(?:条|个|一条)?(?:动态|状态|朋友圈|说说)$/,
  /^(?:写|生成)(?:条|个|一条|一个)?(?:动态|状态|朋友圈|说说)(?:吧|呀)?$/,
  /^帮我(?:发|写|生成)(?:条|个|一条|一个)?(?:动态|状态|朋友圈|说说)(?:吧|呀)?$/,
  /^更新(?:个|一下)?状态$/,
  /^发个日常$/,
  /^来(?:条|个|一条|一个)?(?:动态|状态|朋友圈|说说)(?:吧|呀)?$/,
  /^整(?:条|个|一个)?(?:动态|状态|朋友圈|说说)(?:吧|呀)?$/,
  /^po一条$/,
  /^发一po$/,
  /^挂个状态$/,
  /^丢条动态$/,
];

const FOLLOW_UP_MOMENT_COMMAND_PATTERNS = [
  /^再发一条(?:动态|状态|朋友圈|说说)?$/,
  /^再写(?:条|个|一条|一个)?(?:动态|状态|朋友圈|说说)?$/,
  /^再生成(?:条|个|一条|一个)?(?:动态|状态|朋友圈|说说)?$/,
  /^再来一条(?:动态|状态|朋友圈|说说)?$/,
  /^再来一个(?:动态|状态|朋友圈|说说)?$/,
  /^再发个(?:动态|状态|朋友圈|说说)?$/,
  /^再整一个(?:动态|状态|朋友圈|说说)?$/,
  /^再整条(?:动态|状态|朋友圈|说说)?$/,
  /^再来个(?:动态|状态|朋友圈|说说)?$/,
  /^换一个$/,
  /^换一条$/,
  /^下一个$/,
  /^再换一个$/,
  /^继续发$/,
  /^再来$/,
  /^继续$/,
  /^再整点$/,
];

const EMOTION_KEYWORDS = /累|烦|委屈|崩|想哭|释然|开心|难受|上头|无语|烦死|心累|破防|松一口气/;
const CLOSING_KEYWORDS = /先这样|晚点再说|我去忙了|我先忙|先不说了|睡了|回头聊|改天聊|先撤|先走了/;
const EVENT_KEYWORDS = /加班|下班|到家|失眠|吵架|和好|考试|出门|回家|淋雨|发烧|开会|收工|通宵/;
const CASUAL_CHAT_KEYWORDS = /吃了吗|在吗|哈哈|嘿嘿|天气|干嘛|忙吗|继续说|换个话题/;

function normalizeCommandText(text: string) {
  return text
    .trim()
    .replace(/[。！？!?,，、\s]+$/g, '')
    .replace(/\s+/g, '');
}

export function isDirectMomentPublishCommand(text: string) {
  const normalized = normalizeCommandText(text);
  if (!normalized) return false;
  return DIRECT_MOMENT_COMMAND_PATTERNS.some(pattern => pattern.test(normalized));
}

function hasRecentMomentContext(context?: RecentMomentContext) {
  if (!context) return false;

  const now = context.now ?? Date.now();
  if (context.recentMomentPublishedAt && now - context.recentMomentPublishedAt <= 10 * 60 * 1000) {
    return true;
  }

  const recentMessages = context.recentMessages ?? [];
  return recentMessages
    .slice(-6)
    .some(message => message.role === 'user' && isDirectMomentPublishCommand(message.text));
}

export function isFollowupMomentPublishCommand(text: string, context?: RecentMomentContext) {
  const normalized = normalizeCommandText(text);
  if (!normalized) return false;
  if (!FOLLOW_UP_MOMENT_COMMAND_PATTERNS.some(pattern => pattern.test(normalized))) {
    return false;
  }
  return hasRecentMomentContext(context);
}

export function shouldTriggerMomentPublishFromChat(text: string, context?: RecentMomentContext) {
  return isDirectMomentPublishCommand(text) || isFollowupMomentPublishCommand(text, context);
}

export function shouldAutoPublishMomentFromChat(options: {
  character: Character;
  userText: string;
  assistantText: string;
  context?: RecentMomentContext;
}): AutoMomentTriggerResult {
  const { character, userText, assistantText, context } = options;
  const frequency = character.postFrequency || 'medium';
  const now = context?.now ?? Date.now();
  const recentMessages = context?.recentMessages ?? [];

  if (frequency === 'none') {
    return { shouldPublish: false, reason: 'post-frequency-none' };
  }

  if (context?.recentMomentPublishedAt && now - context.recentMomentPublishedAt < POST_FREQUENCY_COOLDOWN_MS[frequency]) {
    return { shouldPublish: false, reason: 'moment-cooldown' };
  }

  const conversationWindow = [...recentMessages, { role: 'user' as const, text: userText }, { role: 'model' as const, text: assistantText }];
  const recentText = conversationWindow.map(message => message.text).join('\n');
  const effectiveTurns = conversationWindow.filter(message => message.text.trim()).length;

  if (effectiveTurns < 4) {
    return { shouldPublish: false, reason: 'conversation-too-short' };
  }

  if (CASUAL_CHAT_KEYWORDS.test(userText) && !EMOTION_KEYWORDS.test(recentText) && !EVENT_KEYWORDS.test(recentText)) {
    return { shouldPublish: false, reason: 'casual-chat' };
  }

  const hasEmotion = EMOTION_KEYWORDS.test(recentText);
  const hasClosing = CLOSING_KEYWORDS.test(userText) || CLOSING_KEYWORDS.test(assistantText);
  const hasEvent = EVENT_KEYWORDS.test(recentText);

  if (hasEmotion && hasClosing) {
    return { shouldPublish: true, reason: 'emotion-and-closing' };
  }
  if (hasEmotion && effectiveTurns >= 6) {
    return { shouldPublish: true, reason: 'emotion-after-long-chat' };
  }
  if (hasEvent && hasClosing) {
    return { shouldPublish: true, reason: 'event-and-closing' };
  }
  if (hasClosing && effectiveTurns >= 8) {
    return { shouldPublish: true, reason: 'long-chat-closing' };
  }

  return { shouldPublish: false, reason: 'no-auto-trigger' };
}

export function getCharacterLatestMomentTimestamp(characterId: string, moments: MomentLike[] = []) {
  return moments
    .filter(moment => moment.authorId === characterId)
    .reduce((latest, moment) => Math.max(latest, moment.timestamp), 0);
}

export function inferMomentTone(content: string) {
  const text = content.trim();
  if (!text) return '随手发的一条短动态';
  if (/[哈哈呵嘿]|开心|耶|好耶|好开心|笑死/.test(text)) return '轻松、带点开心或调侃';
  if (/累|困|烦|无语|崩溃|服了|离谱|头大/.test(text)) return '有点疲惫、吐槽或情绪外露';
  if (/想|好想|想要|求推荐|有没有|谁懂|怎么/.test(text)) return '带一点分享欲或轻微互动感';
  if (/晚霞|天气|风|太阳|下雨|今天|刚刚|路上|到家/.test(text)) return '偏生活记录、即时感受';
  return '像角色当下顺手发的一句状态';
}

export function inferMomentIntent(content: string) {
  const text = content.trim();
  if (!text) return '记录一下当下状态';
  if (/求推荐|有没有|谁懂|怎么/.test(text)) return '抛一个轻话头，看看有没有人接话';
  if (/哈哈|笑死|无语|服了|离谱/.test(text)) return '顺手吐槽或分享当下情绪';
  if (/今天|刚刚|到家|路上|晚霞|天气/.test(text)) return '记录近况或眼前片段';
  return '分享一下当下的心情或近况';
}

export function classifyMomentCommentType(comment: string) {
  const text = comment.trim();
  if (!text) return '无意义搭话 / 测试词';
  if ((/^(1+|2+|3+|哈+|啊+|哦+|嗯+|欸+|诶+)$/u.test(text) || text.length <= 2) && text.length <= 4) {
    return '无意义搭话 / 测试词';
  }
  if (/傻|蠢|废|滚|有病|弱智|垃圾|蠢货|傻子/.test(text)) {
    return '冒犯 / 骂人';
  }
  if (/怎么|咋办|怎么办|能不能|帮我|求|有办法|怎么做|如何/.test(text)) {
    return '求助 / 认真问';
  }
  if (/笑死|哈哈|嘴硬|装|又来|还挺|是吧|乐|逗|绷不住/.test(text)) {
    return '调侃 / 接梗';
  }
  if (/不行|不好|困|累|烦|别测|没意思|无语|离谱|崩/.test(text)) {
    return '吐槽';
  }
  return '普通评论';
}

export function getRecentMomentReplyContext(moment: MomentLike, characters: Character[], userName: string) {
  return [...moment.comments]
    .slice(-4)
    .map(comment => {
      const authorName = comment.authorId === 'user'
        ? userName
        : (characters.find(c => c.id === comment.authorId)?.name || '未知角色');
      const replyPrefix = comment.replyToAuthorName ? ` 回复 ${comment.replyToAuthorName}` : '';
      return `${authorName}${replyPrefix}: ${comment.content}`;
    });
}

export function pickMomentAuthor(characters: Character[] = [], moments: MomentLike[] = []) {
  const now = Date.now();
  const eligibleCharacters = characters.filter(character => {
    const frequency = character.postFrequency || 'medium';
    if (frequency === 'none') return false;

    const lastPostedAt = getCharacterLatestMomentTimestamp(character.id, moments);
    const cooldown = POST_FREQUENCY_COOLDOWN_MS[frequency];
    return lastPostedAt === 0 || now - lastPostedAt >= cooldown;
  });

  if (eligibleCharacters.length === 0) return null;

  const picked = eligibleCharacters[Math.floor(Math.random() * eligibleCharacters.length)];
  const frequency = picked.postFrequency || 'medium';

  return Math.random() <= POST_FREQUENCY_TRIGGER_CHANCE[frequency] ? picked : null;
}
