export const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';

  const trimmedText = text.trim();
  if (trimmedText === '[COUPLE_SPACE_INVITE]') {
    return '[情侣空间邀请]';
  }
  if (trimmedText === '[COUPLE_SPACE_INVITE_ACCEPTED]') {
    return '[情侣空间已建立]';
  }
  if (/^\[transfer\]/i.test(trimmedText) || /^TRANSFER\|/i.test(trimmedText) || /^\[转账\s*[\d.]+\]/.test(trimmedText)) {
    return '[转账卡片]';
  }
  if (text.startsWith('[notice]')) {
    return text.replace(/^\[notice\]\s*/i, '').trim();
  }
  if (text.startsWith('[audio]')) {
    return '[语音]';
  }
  if (text.startsWith('[image]')) {
    return '[图片]';
  }
  if (text.startsWith('[sticker]')) {
    return '[表情包]';
  }
  if (text.startsWith('[group-poll]')) {
    return '[群投票]';
  }
  if (text.startsWith('[group-relay]')) {
    return '[群接龙]';
  }
  if (text.startsWith('[group-task]')) {
    return '[群小任务]';
  }
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }

  return text;
};
