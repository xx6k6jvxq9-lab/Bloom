import type { Character, ChatMessage, FavoriteMessage } from '../../types';
import { getLegacyTranslationParts, sanitizePipeMarkers } from './messageText';

export type CopyMessageResult = {
  ok: boolean;
  method: 'clipboard' | 'execCommand' | null;
  message: string;
};

export type ToggleFavoriteResult = {
  favorites: FavoriteMessage[];
  updatedMessage: ChatMessage;
  isFavorited: boolean;
};

export type QuotePayloadOptions = {
  userLabel: string;
  modelLabel: string;
};

export type ShareActionResult = {
  ok: boolean;
  status: 'ready';
  payload: {
    summary: string;
    sourceTimestamp: number;
    preview: string;
  };
};

export type ContextMenuPosition = {
  x: number;
  y: number;
  index: number;
};

export type ChatHeaderState = {
  title: string;
  subtitle: string;
  mood: string;
  isTyping: boolean;
};

export type ChatLayoutConfig = {
  headerPaddingClass: string;
  messageListClass: string;
  inputContainerClass: string;
  inputContainerStyle: { paddingBottom: string };
  textBubbleMaxWidthClass: string;
};

type MenuPositionOptions = {
  containerRect?: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null;
  clickX: number;
  clickY: number;
  index: number;
  menuWidth?: number;
  menuHeight?: number;
  margin?: number;
};

const getSharedPostSummary = (message: ChatMessage): string => {
  if (!message.sharedPost) {
    return '';
  }

  const title = message.sharedPost.title?.trim();
  const content = message.sharedPost.content?.trim();
  const authorName = message.sharedPost.authorName?.trim();
  const summaryParts = [
    title ? `标题：${title}` : '',
    content ? `内容：${content}` : '',
    authorName ? `作者：${authorName}` : '',
  ].filter(Boolean);

  return summaryParts.length > 0 ? `[分享动态]\n${summaryParts.join('\n')}` : '[分享动态]';
};

const getSharedMallItemSummary = (message: ChatMessage): string => {
  if (!message.sharedMallItem) {
    return '';
  }

  const title = message.sharedMallItem.title?.trim();
  const subtitle = message.sharedMallItem.subtitle?.trim();
  const blurb = message.sharedMallItem.blurb?.trim();
  const price = Number.isFinite(message.sharedMallItem.price)
    ? `价格：¥${message.sharedMallItem.price.toFixed(2)}`
    : '';
  const summaryParts = [
    title ? `商品：${title}` : '',
    subtitle ? `副标题：${subtitle}` : '',
    price,
    blurb ? `简介：${blurb}` : '',
  ].filter(Boolean);

  return summaryParts.length > 0 ? `[分享商品]\n${summaryParts.join('\n')}` : '[分享商品]';
};

export const getMessageActionText = (message: ChatMessage): string => {
  const { mainText, translation } = getLegacyTranslationParts(message.text || '');
  const normalizedMainText = sanitizePipeMarkers(mainText, '\n');
  const normalizedTranslation = sanitizePipeMarkers(message.translation?.trim() || translation, '\n');
  const sharedPostSummary = getSharedPostSummary(message);
  const sharedMallItemSummary = getSharedMallItemSummary(message);
  const isStickerMessage = !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test((message.text || '').trim());
  const normalizedVisualText = normalizedMainText.replace(/^\[(?:sticker|image|表情包|图片)\]\s*/i, '').trim();

  const content = [
    normalizedVisualText,
    !normalizedVisualText && isStickerMessage ? '[表情包]' : '',
    !normalizedVisualText && !isStickerMessage && message.imageUrl ? '[图片]' : '',
    !normalizedMainText && message.location ? `[位置分享] ${message.location.name}` : '',
    !normalizedMainText && message.isVoiceCall ? '[语音通话]' : '',
    sharedPostSummary,
    sharedMallItemSummary,
  ].filter(Boolean).join('\n');

  if (normalizedTranslation && normalizedTranslation !== normalizedMainText) {
    return [content || '[消息]', `翻译：${normalizedTranslation}`].filter(Boolean).join('\n');
  }

  return content || '[消息]';
};

export const getReplyPreviewText = (message: Pick<ChatMessage, 'replyTo'> | ChatMessage): string => {
  const source = 'replyTo' in message && message.replyTo
    ? (message.replyTo.text || message.replyTo.preview)
    : getMessageActionText(message as ChatMessage);
  return source.replace(/\r?\n+/g, ' ').replace(/[ \t]{2,}/g, ' ').trim().slice(0, 240) || '[消息]';
};

export const createQuoteReplyPayload = (
  message: ChatMessage,
  options: QuotePayloadOptions
): Pick<ChatMessage, 'replyTo'>['replyTo'] => ({
  text: getMessageActionText(message),
  role: message.role,
  timestamp: message.timestamp,
  authorLabel: message.role === 'user' ? options.userLabel : options.modelLabel,
  preview: getReplyPreviewText(message),
});

export const createForwardText = (message: ChatMessage): string => getMessageActionText(message);

export const createShareText = (message: ChatMessage): string => `【聊天分享】\n${getMessageActionText(message)}`;

export const createShareAction = (message: ChatMessage): ShareActionResult => ({
  ok: true,
  status: 'ready',
  payload: {
    summary: createShareText(message),
    sourceTimestamp: message.timestamp,
    preview: getReplyPreviewText(message),
  },
});

export const getContextMenuPosition = ({
  containerRect,
  clickX,
  clickY,
  index,
  menuWidth = 360,
  menuHeight = 60,
  margin = 10,
}: MenuPositionOptions): ContextMenuPosition => {
  if (!containerRect) {
    return {
      x: Math.max(margin, clickX - menuWidth / 2),
      y: Math.max(margin, clickY + 12),
      index,
    };
  }

  const relativeX = clickX - containerRect.left;
  const relativeY = clickY - containerRect.top;
  const maxX = Math.max(margin, containerRect.width - menuWidth - margin);
  const maxY = Math.max(margin, containerRect.height - menuHeight - margin);
  const preferredX = relativeX - menuWidth / 2;
  const preferredY =
    relativeY + menuHeight + margin > containerRect.height
      ? relativeY - menuHeight - margin
      : relativeY + 12;

  return {
    x: Math.min(Math.max(preferredX, margin), maxX),
    y: Math.min(Math.max(preferredY, margin), maxY),
    index,
  };
};

const deriveMoodFromRecentText = (recentText: string): string => {
  if (!recentText) return '平静';
  if (/(哭|想哭|泪|眼泪|呜呜|呜…|呜呜呜|哭了|哭哭|委屈死)/.test(recentText)) return '哭泣';
  if (/(难受|低落|沮丧|emo|低气压|失落|心口闷|提不起劲)/.test(recentText)) return '难过';
  if (/(委屈|委屈死了|你凶我|好过分|不理你了|鼻子酸)/.test(recentText)) return '委屈';
  if (/(讨厌|烦你|别碰我|离我远点|不想理|反感|恶心|厌烦)/.test(recentText)) return '讨厌';
  if (/(生气|火大|气死|火气|别惹我|烦躁|崩溃|受不了|压力)/.test(recentText)) return '生气';
  if (/(吃醋|醋|酸了|看别人|陪别人|不高兴了)/.test(recentText)) return '吃醋';
  if (/(想你|想见你|好想|想抱|想黏|舍不得|别走)/.test(recentText)) return '想念';
  if (/(黏着|陪我|别挂|多聊会|再待一会|不准走|抱抱我)/.test(recentText)) return '黏人';
  if (/(喜欢你|暧昧|靠近你|脸热|心跳|撩|凑近|想亲|耳朵热)/.test(recentText)) return '暧昧';
  if (/(害羞|脸红|别这么说|你别看我|不许笑|耳根热)/.test(recentText)) return '害羞';
  if (/(期待|等你|想见|马上就|终于要|盼着)/.test(recentText)) return '期待';
  if (/(嘴硬|才没有|谁在乎|随便你|我才不|懒得理你)/.test(recentText)) return '嘴硬';
  if (/(无语|离谱|服了|？？|无奈|你真行|拿你没办法)/.test(recentText)) return '无语';
  if (/(心软|算了|还是给你|先不跟你计较|拿你没办法)/.test(recentText)) return '心软';
  if (/(紧张|慌|别这样|心里一紧|手心冒汗)/.test(recentText)) return '紧张';
  if (/(困|想睡|熬夜|累|没精神|眼皮打架)/.test(recentText)) return '困';
  if (/(放松|舒服|慢慢来|松口气|安心|安静待着)/.test(recentText)) return '放松';
  if (/(迷糊|没睡醒|发懵|脑子转不动|反应慢半拍)/.test(recentText)) return '迷糊';
  if (/(高兴|开心|愉快|太好了|真棒|哈哈|笑死|有意思)/.test(recentText)) return '开心';
  return '平静';
};

const HEADER_KAOMOJI_BY_MOOD: Record<string, string[]> = {
  暧昧: [
    '(*/ω＼*)',
    '(⁄ ⁄•⁄ω⁄•⁄ ⁄)',
    '(｡ﾉω＼｡)',
    '(〃▽〃)',
    '(〃ω〃)',
    '(*/。＼)',
    '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)',
    '(っ˘з(˘⌣˘ )',
    '(♡-_-♡)',
    '(๑♡⌓♡๑)',
  ],
  讨厌: [
    '(¬▂¬)',
    '(¬_¬")',
    '(￢_￢;)',
    '( `ε´ )',
    '(눈_눈)',
    '(；¬д¬)',
    '(¬､¬)',
    '( ˘•ω•˘ )',
    '(¬_¬ )',
    '( －з)',
  ],
  难过: [
    '(╥_╥)',
    '(；ω；)',
    '(｡•́︿•̀｡)',
    '(っ- ‸ -ς)',
    '(ಥ﹏ಥ)',
    '(｡╯︵╰｡)',
    '(｡•́︿•̀｡)',
    '(´；ω；`)',
    '(ノ_<。)',
    '(இ﹏இ`｡)',
  ],
  哭泣: [
    '(T_T)',
    '(；д；)',
    '(╥﹏╥)',
    '(っ °Д °;)っ',
    '(｡•́︿•̀｡)｡ﾟ',
    '(´；д；`)',
    '(ಥ_ಥ)',
    '(;﹏;)',
    '(｡T ω T｡)',
    '(╯︵╰,)',
  ],
  委屈: [
    '(｡•́︿•̀｡)',
    '(｡•́ - •̀｡)',
    '(｡•́︿•̀｡)♡',
    '(っ- ‸ -ς)',
    '(•́︿•̀)',
    '(｡•́_•̀｡)',
    '( ´•̥̥̥ω•̥̥̥` )',
    '(｡•́︿•̀｡)ゞ',
    '(´ . .̫ . `)',
    '(╥﹏╥)',
  ],
  开心: [
    '(๑˃ᴗ˂)ﻭ',
    '(*^ω^*)',
    '(≧▽≦)',
    '(๑•̀ㅂ•́)و',
    '(●\'◡\'●)',
    '(ﾉ´ヮ`)ﾉ*: ･ﾟ',
    '(≧∇≦)ﾉ',
    '(*´▽`*)',
    '(๑¯◡¯๑)',
    '(´▽`ʃ♡ƪ)',
  ],
  生气: [
    '(#｀-_ゝ-)',
    '( `´ )',
    '(#￣︿￣)',
    '(-""-;)',
    '(；￣Д￣)',
    '( ` ω ´ )',
    '(＃＞＜)',
    '(￣^￣)ゞ',
    '(╯`□′)╯',
    '(▼へ▼メ)',
  ],
  吃醋: [
    '(￢￢)',
    '(¬_¬")',
    '(｡•́︿•̀｡)',
    '(￣^￣)',
    '( ˘•ω•˘ )',
    '(¬､¬)',
    '(눈_눈)',
    '( ´•︵•` )',
    '(⇀‸↼‶)',
    '(￣へ￣)',
  ],
  害羞: [
    '(⁄ ⁄•⁄ω⁄•⁄ ⁄)',
    '(〃ω〃)',
    '(〃▽〃)',
    '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)',
    '(*/ω＼*)',
    '(⁄ ⁄•⁄-⁄•⁄ ⁄)',
    '(๑˃̵ᴗ˂̵)و',
    '(〃∀〃)',
    '(*/▽＼*)',
    '(๑´ლ`๑)',
  ],
  想念: [
    '(っ˘̩╭╮˘̩)っ',
    '(｡•́︿•̀｡)',
    '(´ . .̫ . `)',
    '(つω`｡)',
    '(っ˘ω˘ς )',
    '(｡•́︿•̀｡)♡',
    '( ´•ω•̥` )',
    '(っ◞‸◟ c)',
    '(｡•́ωก̀｡)',
    '(っ´ω`c)',
  ],
  黏人: [
    '(っ´ω`c)',
    '(っ˘ڡ˘ς)',
    '(づ｡◕‿‿◕｡)づ',
    '(っ´▽`)っ',
    '(つ≧▽≦)つ',
    '(っ˘з(˘⌣˘ )',
    '(づ￣ ³￣)づ',
    '(っ˘ω˘ς )',
    '(っ´∀｀)っ',
    '(つ✧ω✧)つ',
  ],
  期待: [
    '(✧ω✧)',
    '(☆▽☆)',
    '(๑•̀ㅂ•́)و✧',
    '( ✧Д✧)',
    '(☆ω☆)',
    '(•̀ᴗ•́)و ̑̑',
    '(☆▽☆)ノ',
    '(✯◡✯)',
    '(☼◡☼)',
    '(๑˃ᴗ˂)ﻭ',
  ],
  放松: [
    '( ˘ω˘ )',
    '(￣▽￣)',
    '(´▽｀)',
    '(◍•ᴗ•◍)',
    '( ´ ▽ ` )',
    '( ᵕᴗᵕ )',
    '(˘⌣˘)',
    '(´｡• ᵕ •｡`)',
    '(๑¯◡¯๑)',
    '(﹡ˆᴗˆ﹡)',
  ],
  迷糊: [
    '(⊙_☉)',
    '(・_・ヾ',
    '(°ー°〃)',
    '(￣ω￣;)',
    '(・_・;)',
    '(⊙_⊙;)',
    '(・ε・｀)',
    '(°ロ°) !',
    '(°◇°;)',
    '(・・ ) ?',
  ],
  紧张: [
    '(;・∀・)',
    '(；ﾞﾟ\'ωﾟ\'):',
    '(°ロ°) !',
    '(⊙_⊙;)',
    '(・・;)ゞ',
    '(；￣Д￣)',
    '(◎_◎;)',
    '(・_・;)',
    '(°ー°〃)',
    '(；・ω・)',
  ],
  嘴硬: [
    '( ¬_¬)',
    '(￣^￣)',
    '(｀へ´)',
    '( ˘•ω•˘ )',
    '(¬_¬ )',
    '(￣へ￣)',
    '( `д´ )',
    '(・`ω´・)',
    '(￣ヘ￣)',
    '(￢_￢)',
  ],
  困: [
    '(_ _).｡o○',
    '(￣o￣) . z Z',
    '(∪｡∪)｡｡｡zzz',
    '(－_－) zzZ',
    '(つω-`。)',
    '(￣ρ￣)..zzZZ',
    '(｡-ω-)zzz',
    '(-.-)Zzz...',
    '(￣﹃￣)',
    '(＊´ω｀＊)',
  ],
  无语: [
    '(ー_ー゛)',
    '(¬_¬)',
    '(￣_,￣ )',
    '(・_・;)',
    '(￢_￢)',
    '(¬¬")',
    '(ーー;)',
    '(゜-゜)',
    '(・へ・)',
    '¯\\_(ツ)_/¯',
  ],
  心软: [
    '(˶ᵔ ᵕ ᵔ˶)',
    '(´｡• ᵕ •｡`)',
    '(ृ´͈ ᵕ `͈ ृ )',
    '(◍•ᴗ•◍)',
    '(｡･ω･｡)',
    '(˘⌣˘)',
    '(๑¯◡¯๑)',
    '(´▽`ʃ♡ƪ)',
    '( ˘ ³˘)♥',
    '(˵¯͒〰¯͒˵)',
  ],
  平静: [
    '( ˘ω˘ )',
    '(•‿•)',
    '( ᵕᴗᵕ )',
    '(◍•ᴗ•◍)',
    '(˶ᵔ ᵕ ᵔ˶)',
    '(•̀ᴗ•́)و ̑̑',
    '( ´ ▽ ` )',
    '(ृ´͈ ᵕ `͈ ृ )',
    '(˵¯͒〰¯͒˵)',
    '(•ㅅ•)',
  ],
};

function getStableIndex(seedText: string, length: number): number {
  if (length <= 0) {
    return 0;
  }

  let hash = 0;
  for (const char of seedText) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash % length;
}

function getHeaderKaomoji(mood: string, recentText: string): string {
  const pool = HEADER_KAOMOJI_BY_MOOD[mood] || HEADER_KAOMOJI_BY_MOOD.平静;
  return pool[getStableIndex(`${mood}:${recentText}`, pool.length)] || HEADER_KAOMOJI_BY_MOOD.平静[0];
}

export const getChatHeaderState = (
  character: Pick<Character, 'name' | 'remarkName' | 'signature' | 'openingRemark'>,
  history: ChatMessage[],
  isLoading: boolean
): ChatHeaderState => {
  const recentModelText = [...history].reverse().find(message => message.role === 'model' && !message.isSystem)?.text
    || character.signature
    || character.openingRemark
    || '';
  const mood = deriveMoodFromRecentText(recentModelText);
  const isTyping = isLoading;
  const displayName = character.remarkName?.trim() || character.name;
  return {
    title: isTyping ? '正在输入...' : displayName,
    subtitle: getHeaderKaomoji(mood, recentModelText),
    mood,
    isTyping,
  };
};

export const getChatLayoutConfig = (): ChatLayoutConfig => ({
  headerPaddingClass: 'pt-4 pb-2 px-4',
  messageListClass: 'flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] touch-pan-y px-3 py-3 space-y-3',
  inputContainerClass: 'relative z-10 px-3 pt-2 border-t backdrop-blur-md flex flex-col gap-1.5',
  inputContainerStyle: { paddingBottom: 'var(--app-safe-area-bottom-ui, 0px)' },
  textBubbleMaxWidthClass: 'max-w-[88%]',
});

export const getLatestModelReplyTimestamp = (history: ChatMessage[]): number | null => {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role === 'model' && !message.isSystem) {
      return message.timestamp;
    }
  }
  return null;
};

export const getUserReadStatusLabel = (
  message: ChatMessage,
  latestModelReplyTimestamp: number | null
): string => {
  if (message.role !== 'user') return '';
  if (message.deliveryStatus === 'failed_blocked') {
    return message.deliveryErrorText?.trim() || '发送失败';
  }
  if (latestModelReplyTimestamp === null) return '';
  return latestModelReplyTimestamp > message.timestamp ? '已读' : '';
};

const copyTextWithExecCommand = (text: string): boolean => {
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};

export const copyTextContent = async (text: string): Promise<CopyMessageResult> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return {
        ok: true,
        method: 'clipboard',
        message: '复制成功',
      };
    }
  } catch {
    // Fall through to execCommand fallback.
  }

  try {
    if (copyTextWithExecCommand(text)) {
      return {
        ok: true,
        method: 'execCommand',
        message: '复制成功',
      };
    }
  } catch {
    // Fall through to final failure result.
  }

  return {
    ok: false,
    method: null,
    message: '复制失败，请手动复制消息内容。',
  };
};

export const toggleFavoriteMessage = (
  message: ChatMessage,
  favorites: FavoriteMessage[],
  character: Pick<Character, 'id' | 'name'>
): ToggleFavoriteResult => {
  const isAlreadyFavorited = favorites.some(
    favorite => favorite.timestamp === message.timestamp && favorite.characterId === character.id
  );

  const nextFavorites = isAlreadyFavorited
    ? favorites.filter(
        favorite => !(favorite.timestamp === message.timestamp && favorite.characterId === character.id)
      )
    : [
        ...favorites,
        {
          id: Date.now().toString(),
          characterId: character.id,
          characterName: character.name,
          text: getMessageActionText(message),
          timestamp: message.timestamp,
          category: '聊天',
        },
      ];

  return {
    favorites: nextFavorites,
    updatedMessage: {
      ...message,
      isFavorited: !isAlreadyFavorited,
    },
    isFavorited: !isAlreadyFavorited,
  };
};

export const deleteMessageAtIndex = (history: ChatMessage[], index: number): ChatMessage[] =>
  history.filter((_, messageIndex) => messageIndex !== index);

export const deleteMessagesByIndexes = (
  history: ChatMessage[],
  selectedIndexes: Iterable<number>
): ChatMessage[] => {
  const selectedSet = selectedIndexes instanceof Set ? selectedIndexes : new Set(selectedIndexes);
  return history.filter((_, index) => !selectedSet.has(index));
};

export const copyMessageText = async (message: ChatMessage): Promise<CopyMessageResult> => {
  return copyTextContent(getMessageActionText(message));
};

