import type { ChatMessage } from '../../types';
import { parseUploadedAssetRef } from '../../features/persistence/persistentAssetRef';

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
  { label: '亲亲', patterns: [/亲亲/u, /么么/u, /啵啵/u, /kisskiss/i, /smooch/i] },
  { label: '求安慰', patterns: [/安慰/u, /哄我/u, /抱紧/u, /求抱抱/u, /comfort/i] },
  { label: '求关注', patterns: [/理我/u, /看看我/u, /在吗/u, /attention/i, /notice me/i] },
  { label: '期待', patterns: [/期待/u, /等你/u, /想见/u, /looking[\s-]?forward/i, /cant wait/i] },
  { label: '得意', patterns: [/得意/u, /骄傲/u, /神气/u, /proud/i, /showoff/i] },
  { label: '认错', patterns: [/认错/u, /道歉/u, /对不起/u, /sorry/i, /apolog/i] },
  { label: '安慰', patterns: [/安慰你/u, /摸摸/u, /别难过/u, /there there/i, /patpat/i] },
  { label: '鼓励', patterns: [/加油/u, /鼓励/u, /你可以/u, /fighting/i, /cheer up/i] },
  { label: '犯困', patterns: [/晚安/u, /困困/u, /睡觉/u, /good night/i, /sleepy/i] },
  { label: '懵', patterns: [/懵/u, /呆住/u, /傻眼/u, /blank/i, /stunned/i] },
  { label: '冷漠', patterns: [/冷漠/u, /冷淡/u, /哦/u, /ok then/i, /whatever/i] },
  { label: '耍赖', patterns: [/耍赖/u, /不管/u, /就要/u, /赖着/u] },
  { label: '阴阳怪气', patterns: [/阴阳怪气/u, /呵呵/u, /哟/u, /sarcas/i] },
  { label: '害怕', patterns: [/害怕/u, /怕怕/u, /吓死/u, /scared/i, /afraid/i] },
  { label: '庆祝', patterns: [/庆祝/u, /撒花/u, /过年/u, /celebrat/i, /hooray/i] },
];

const STICKER_SOURCE_TOKEN_SPLIT = /[^a-z0-9\u4e00-\u9fa5]+/iu;

function normalizeStickerSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return '';

  try {
    return decodeURIComponent(trimmed).toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function extractSourceTokens(source?: string): string[] {
  if (!source || source.startsWith('data:')) return [];

  const assetRef = parseUploadedAssetRef(source);
  const normalized = normalizeStickerSource(assetRef?.fileName || source);
  if (!normalized) return [];

  return normalized
    .split(STICKER_SOURCE_TOKEN_SPLIT)
    .map(token => token.trim())
    .filter(Boolean);
}

function inferFromSource(source?: string): string | undefined {
  const assetRef = parseUploadedAssetRef(source);
  const normalized = source ? normalizeStickerSource(assetRef?.fileName || source) : '';
  const tokens = extractSourceTokens(source);
  if (!normalized && tokens.length === 0) return undefined;

  for (const entry of STICKER_LABEL_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized) || tokens.some(token => pattern.test(token)))) {
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

  return label
    ? `[sent a sticker; read any visible text on it; infer the emotional intent mainly from expression, pose, exaggeration, and visual mood; hint: ${label}]`
    : '[sent a sticker; read any visible text on it; infer the emotional intent mainly from expression, pose, exaggeration, and visual mood]';
}
