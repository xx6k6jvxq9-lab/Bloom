const HTML_BLOCK_TAG_REGEX = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_LINEBREAK_TAG_REGEX = /<(br|\/p|\/div|\/li|\/summary|\/h[1-6])\b[^>]*>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const MARKDOWN_FENCE_REGEX = /```[a-zA-Z0-9_-]*|```/g;
const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
};

export const looksLikeStructuredCardText = (text: string | undefined): boolean => {
  if (!text) return false;
  return /<\/?[a-z][\w-]*\b[^>]*>/i.test(text) || /```[a-zA-Z0-9_-]*/.test(text);
};

export const sanitizePreviewText = (text: string | undefined): string => {
  if (!text) return '';

  const normalized = text
    .replace(HTML_BLOCK_TAG_REGEX, ' ')
    .replace(HTML_LINEBREAK_TAG_REGEX, '\n')
    .replace(HTML_TAG_REGEX, ' ')
    .replace(MARKDOWN_FENCE_REGEX, ' ');

  const decoded = normalized.replace(/&(nbsp|lt|gt|amp|quot|#39);/g, (entity) => HTML_ENTITY_MAP[entity] || entity);
  return decoded
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};

export const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';

  const trimmedText = text.trim();
  if (trimmedText === '[COUPLE_SPACE_INVITE]') {
    return '[鎯呬荆绌洪棿閭€璇穄';
  }
  if (trimmedText === '[COUPLE_SPACE_INVITE_ACCEPTED]') {
    return '[鎯呬荆绌洪棿宸插缓绔媇';
  }
  if (/^\[transfer\]/i.test(trimmedText) || /^TRANSFER\|/i.test(trimmedText) || /^\[杞处\s*[\d.]+\]/.test(trimmedText)) {
    return '[杞处鍗＄墖]';
  }
  if (text.startsWith('[notice]')) {
    return sanitizePreviewText(text.replace(/^\[notice\]\s*/i, '').trim());
  }
  if (text.startsWith('[audio]')) {
    return '[璇煶]';
  }
  if (text.startsWith('[image]')) {
    return '[鍥剧墖]';
  }
  if (text.startsWith('[sticker]')) {
    return '[琛ㄦ儏鍖匽';
  }
  if (text.startsWith('[group-poll]')) {
    return '[缇ゆ姇绁╙';
  }
  if (text.startsWith('[group-relay]')) {
    return '[缇ゆ帴榫橾';
  }
  if (text.startsWith('[group-task]')) {
    return '[缇ゅ皬浠诲姟]';
  }
  if (text.startsWith('[GAME_CARD]')) {
    return '[娓告垙鍗＄墖]';
  }

  return sanitizePreviewText(text);
};
