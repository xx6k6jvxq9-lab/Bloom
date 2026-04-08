import type { ChatMessage } from '../../types';

const STICKER_LABEL_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: '生气', patterns: [/生气/u, /炸毛/u, /angry/i, /mad/i, /furious/i] },
  { label: '委屈', patterns: [/委屈/u, /可怜/u, /委委屈屈/u, /sad/i, /upset/i] },
  { label: '大哭', patterns: [/大哭/u, /爆哭/u, /痛哭/u, /cry/i, /sob/i, /tears?/i] },
  { label: '无语', patterns: [/无语/u, /翻白眼/u, /白眼/u, /嫌弃/u, /eye[\s-]?roll/i, /speechless/i] },
  { label: '害羞', patterns: [/害羞/u, /脸红/u, /羞/u, /shy/i, /blush/i] },
  { label: '撒娇', patterns: [/撒娇/u, /装乖/u, /娇/u, /clingy/i, /coquet/i] },
  { label: '贴贴', patterns: [/贴贴/u, /抱抱/u, /蹭蹭/u, /hug/i, /cuddle/i] },
  { label: '开心', patterns: [/开心/u, /高兴/u, /快乐/u, /happy/i, /yay/i, /smile/i] },
  { label: '偷笑', patterns: [/偷笑/u, /憋笑/u, /坏笑/u, /snicker/i, /smirk/i] },
  { label: '疑惑', patterns: [/疑惑/u, /问号/u, /不解/u, /confused/i, /huh/i, /what/i] },
  { label: '震惊', patterns: [/震惊/u, /震撼/u, /惊讶/u, /shock/i, /surpris/i, /wow/i] },
  { label: '困倦', patterns: [/困/u, /睡/u, /瞌睡/u, /sleep/i, /tired/i, /yawn/i] },
  { label: '撒欢', patterns: [/打滚/u, /摆烂/u, /发疯/u, /crazy/i, /wild/i] },
  { label: '可爱卖萌', patterns: [/可爱/u, /呆呆/u, /卖萌/u, /萌/u, /cute/i, /adorable/i] },
  { label: '喜欢', patterns: [/喜欢/u, /爱你/u, /爱心/u, /kiss/i, /love/i, /heart/i] },
  { label: '吃醋', patterns: [/吃醋/u, /酸/u, /醋/u, /jealous/i] },
];

function normalizeStickerSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return '';

  try {
    return decodeURIComponent(trimmed).toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function inferFromSource(source?: string): string | undefined {
  if (!source) return undefined;
  if (source.startsWith('data:')) return undefined;

  const normalized = normalizeStickerSource(source);
  if (!normalized) return undefined;

  for (const entry of STICKER_LABEL_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.label;
    }
  }

  return undefined;
}

function inferFromText(text?: string): string | undefined {
  const normalized = text?.replace(/^\[(?:sticker|image|表情包|图片)\]\s*/i, '').trim();
  if (!normalized) return undefined;

  for (const entry of STICKER_LABEL_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.label;
    }
  }

  return normalized.length <= 12 ? normalized : undefined;
}

export function inferStickerSemanticLabel(source?: string, fallbackText?: string): string | undefined {
  return inferFromText(fallbackText) || inferFromSource(source);
}

export function describeStickerMessageForPrompt(message: Pick<ChatMessage, 'imageUrl' | 'text' | 'stickerLabel'>): string {
  const label = message.stickerLabel?.trim()
    || inferStickerSemanticLabel(message.imageUrl, message.text)
    || '';

  return label ? `[sent a sticker: ${label}]` : '[sent a sticker]';
}
