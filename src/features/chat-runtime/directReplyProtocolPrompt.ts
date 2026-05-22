import type { Character } from '../../types';

export function getStructuredReplyTextLanguageLabel(
  character: Pick<Character, 'replyLanguageMode' | 'nativeLanguage' | 'fixedReplyLanguage'>,
): string {
  if (character.replyLanguageMode === 'fixed') {
    return character.fixedReplyLanguage?.trim() || character.nativeLanguage?.trim() || '角色设定语言';
  }

  if (character.replyLanguageMode === 'native-first') {
    return character.nativeLanguage?.trim() || '角色母语';
  }

  if (character.replyLanguageMode === 'chinese-with-native-flavor') {
    return '自然中文';
  }

  return '当前聊天主语言';
}

export function buildStructuredAssistantReplyPrompt(params: {
  character: Pick<Character, 'replyLanguageMode' | 'nativeLanguage' | 'fixedReplyLanguage'>;
  structuredReplyToken: string;
  requireInlineTranslation?: boolean;
}): string {
  const targetLanguage = getStructuredReplyTextLanguageLabel(params.character);
  const requireInlineTranslation = !!params.requireInlineTranslation;

  return [
    '## 统一回复协议',
    `如果本轮需要输出任何可显示内容，优先只输出一个可机读协议，格式固定为：${params.structuredReplyToken} {"items":[...]}`,
    requireInlineTranslation
      ? `普通正文 item 的格式固定为：{"kind":"text","text":"${targetLanguage} 正文","translation":"对应的简体中文"}。`
      : `普通正文 item 的格式固定为：{"kind":"text","text":"${targetLanguage} 正文"}。`,
    'items 的顺序就是最终显示顺序；如果本轮需要多个聊天气泡，就写多个 text item，不要把多段正文硬塞进一个字段里。',
    requireInlineTranslation
      ? `text 必须是角色真正会发出的 ${targetLanguage} 正文；translation 必须是与该 text 严格对应的简体中文。`
      : `text 必须是角色真正会发出的 ${targetLanguage} 正文；当前这轮不要追加 translation 字段，也不要附带任何额外译文。`,
    '如果需要 [reply: ...]、[recall] 或 [sticker] 这类轻量 cue，把 cue 写在 text 字段里，不要额外解释。',
    requireInlineTranslation
      ? '如果需要 GAME_CARD，使用：{"kind":"game_card","payload":{...},"translation":"对应简体中文"}。game_card 是整轮唯一主体，不要再混入普通 text、transfer 或额外说明。'
      : '如果需要 GAME_CARD，使用：{"kind":"game_card","payload":{...}}。game_card 是整轮唯一主体，不要再混入普通 text、transfer 或额外说明。',
    '如果需要转账，使用：{"kind":"transfer","amount":"88.00"}。金额只保留数字和小数点，不要再写旧的 TRANSFER|...|... 变体。',
    '如果需要情侣空间事件 token，使用：{"kind":"token","name":"COUPLE_SPACE_INVITE_ACCEPTED"}。',
    '不要输出 Markdown 代码块，不要输出解释、注释、语言标签或额外字段。',
    requireInlineTranslation
      ? '只要本轮存在普通正文 text item，就必须给每个 text item 填 translation，不要改回旧的 ---TRANSLATION--- 写法。'
      : '当前这轮不要输出 translation 字段，不要追加 ---TRANSLATION---，也不要把正文再翻成其他语言。',
  ].join('\n');
}
