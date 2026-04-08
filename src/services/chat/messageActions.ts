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

export const getMessageActionText = (message: ChatMessage): string => {
  const { mainText, translation } = getLegacyTranslationParts(message.text || '');
  const normalizedMainText = sanitizePipeMarkers(mainText, '\n');
  const normalizedTranslation = sanitizePipeMarkers(message.translation?.trim() || translation, '\n');
  const sharedPostSummary = getSharedPostSummary(message);
  const isStickerMessage = !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test((message.text || '').trim());
  const normalizedVisualText = normalizedMainText.replace(/^\[(?:sticker|image|表情包|图片)\]\s*/i, '').trim();

  const content = [
    normalizedVisualText,
    !normalizedVisualText && isStickerMessage ? '[表情包]' : '',
    !normalizedVisualText && !isStickerMessage && message.imageUrl ? '[图片]' : '',
    !normalizedMainText && message.location ? `[位置分享] ${message.location.name}` : '',
    !normalizedMainText && message.isVoiceCall ? '[语音通话]' : '',
    !normalizedMainText && sharedPostSummary ? sharedPostSummary : '',
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
  if (/(开心|高兴|愉快|太好了|真棒|哈哈|笑死)/.test(recentText)) return '开心';
  if (/(困|想睡|熬夜|累|没精神)/.test(recentText)) return '困';
  if (/(烦|烦躁|崩溃|受不了|压力)/.test(recentText)) return '烦躁';
  if (/(无语|离谱|服了|？？|无奈)/.test(recentText)) return '无语';
  if (/(低落|难受|沮丧|emo|低气压)/.test(recentText)) return '低气压';
  return '平静';
};

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
    subtitle: `当前心情：${mood}`,
    mood,
    isTyping,
  };
};

export const getChatLayoutConfig = (): ChatLayoutConfig => ({
  headerPaddingClass: 'pt-4 pb-2 px-4',
  messageListClass: 'flex-1 overflow-y-auto px-3 py-3 space-y-3',
  inputContainerClass: 'relative z-10 px-3 pt-2 border-t backdrop-blur-md flex flex-col gap-1.5',
  inputContainerStyle: { paddingBottom: '0.9rem' },
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

