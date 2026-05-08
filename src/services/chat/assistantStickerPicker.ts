import type { Character } from '../../types';
import { inferStickerSemanticLabel } from './stickerSemantics';

type PickedSticker = {
  sticker: string;
  label: string;
};

export type AssistantStickerContext = {
  character?: Pick<Character, 'name' | 'setting' | 'corePersona' | 'expressionStyle' | 'boundaryPack' | 'signature'>;
  scene?: 'direct' | 'group';
  latestUserText?: string;
  recentTexts?: string[];
  sceneHints?: string[];
};

type PersonaTrait = 'gentle' | 'reserved' | 'playful' | 'sharp' | 'affectionate' | 'steady';
type StickerTrait =
  | 'comfort'
  | 'affection'
  | 'cheerful'
  | 'playful'
  | 'sad'
  | 'angry'
  | 'sarcastic'
  | 'shy'
  | 'surprised'
  | 'sleepy'
  | 'apology'
  | 'cool';

type StickerCandidate = PickedSticker & {
  score: number;
  blocked: boolean;
  index: number;
};

function hashCueText(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function normalizeCueText(text: string): string {
  return text.trim().toLowerCase();
}

const PERSONA_TRAIT_PATTERNS: Array<{ trait: PersonaTrait; weight: number; patterns: RegExp[] }> = [
  {
    trait: 'gentle',
    weight: 3,
    patterns: [/温和/u, /温柔/u, /柔和/u, /体贴/u, /耐心/u, /治愈/u, /包容/u, /礼貌/u, /安抚/u, /轻声/u],
  },
  {
    trait: 'reserved',
    weight: 2,
    patterns: [/高冷/u, /冷淡/u, /寡言/u, /克制/u, /疏离/u, /慢热/u, /安静/u, /话少/u, /沉静/u],
  },
  {
    trait: 'playful',
    weight: 2,
    patterns: [/活泼/u, /元气/u, /调皮/u, /搞怪/u, /爱闹/u, /有趣/u, /碎嘴/u, /闹腾/u, /爱玩/u],
  },
  {
    trait: 'sharp',
    weight: 2,
    patterns: [/毒舌/u, /刻薄/u, /强势/u, /腹黑/u, /讽刺/u, /尖锐/u, /凌厉/u, /不好惹/u],
  },
  {
    trait: 'affectionate',
    weight: 2,
    patterns: [/黏人/u, /撒娇/u, /暧昧/u, /亲密/u, /爱吃醋/u, /爱闹别扭/u, /爱贴贴/u, /爱哄/u],
  },
  {
    trait: 'steady',
    weight: 2,
    patterns: [/成熟/u, /稳重/u, /可靠/u, /理性/u, /沉稳/u, /冷静/u, /有分寸/u],
  },
];

const STICKER_TRAIT_PATTERNS: Array<{ trait: StickerTrait; patterns: RegExp[] }> = [
  { trait: 'comfort', patterns: [/安抚/u, /安慰/u, /抱抱/u, /patpat/i, /comfort/i, /there there/i] },
  { trait: 'affection', patterns: [/贴贴/u, /亲亲/u, /喜欢/u, /爱心/u, /kiss/i, /love/i, /heart/i, /clingy/i, /cuddle/i] },
  { trait: 'cheerful', patterns: [/开心/u, /高兴/u, /庆祝/u, /鼓励/u, /加油/u, /happy/i, /yay/i, /celebrat/i, /cheer/i] },
  { trait: 'playful', patterns: [/偷笑/u, /打滚/u, /发疯/u, /得意/u, /可爱/u, /卖萌/u, /smirk/i, /cute/i, /crazy/i] },
  { trait: 'sad', patterns: [/委屈/u, /大哭/u, /哭/u, /求安慰/u, /sad/i, /cry/i, /sob/i, /tears?/i] },
  { trait: 'angry', patterns: [/生气/u, /吃醋/u, /气/u, /angry/i, /mad/i, /jealous/i] },
  { trait: 'sarcastic', patterns: [/无语/u, /阴阳怪气/u, /冷淡/u, /冷漠/u, /speechless/i, /sarcas/i, /eye[\s-]?roll/i, /whatever/i] },
  { trait: 'shy', patterns: [/害羞/u, /脸红/u, /shy/i, /blush/i] },
  { trait: 'surprised', patterns: [/疑惑/u, /震惊/u, /惊/u, /confused/i, /shock/i, /surpris/i, /wow/i] },
  { trait: 'sleepy', patterns: [/困/u, /晚安/u, /睡/u, /sleep/i, /tired/i, /yawn/i] },
  { trait: 'apology', patterns: [/认错/u, /道歉/u, /对不起/u, /sorry/i, /apolog/i] },
  { trait: 'cool', patterns: [/冷淡/u, /冷漠/u, /高冷/u, /疏离/u, /cool/i] },
];

const COMFORT_SIGNAL_PATTERNS = [/难过/u, /低落/u, /委屈/u, /想哭/u, /安慰/u, /抱抱/u, /哄我/u, /不舒服/u, /好累/u, /emo/i];
const CONFLICT_SIGNAL_PATTERNS = [/生气/u, /吵/u, /冷战/u, /误会/u, /别理/u, /过分/u, /不高兴/u, /吃醋/u, /闹别扭/u];
const ROMANTIC_SIGNAL_PATTERNS = [/喜欢/u, /想你/u, /抱抱/u, /亲/u, /贴贴/u, /想见/u, /暧昧/u, /心动/u, /恋爱/u];
const SERIOUS_SIGNAL_PATTERNS = [/工作/u, /学习/u, /作业/u, /考试/u, /开会/u, /任务/u, /安排/u, /确认/u, /处理/u, /计划/u];
const LOW_ENERGY_SIGNAL_PATTERNS = [/困/u, /睡/u, /晚安/u, /深夜/u, /熬夜/u, /累/u, /没精神/u];
const CELEBRATION_SIGNAL_PATTERNS = [/生日/u, /庆祝/u, /恭喜/u, /成功/u, /赢/u, /好耶/u, /开心/u, /节日/u];

function normalizeStickerPool(stickers: string[]): string[] {
  return Array.from(new Set(
    stickers
      .filter((sticker): sticker is string => typeof sticker === 'string' && sticker.trim().length > 0)
      .map((sticker) => sticker.trim()),
  ));
}

function buildPersonaSourceText(character?: AssistantStickerContext['character']): string {
  if (!character) {
    return '';
  }

  return [
    character.corePersona,
    character.setting,
    character.expressionStyle,
    character.boundaryPack,
    character.signature,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .toLowerCase();
}

function buildSceneSignalText(context?: AssistantStickerContext): string {
  if (!context) {
    return '';
  }

  return [
    context.latestUserText,
    ...(context.recentTexts || []),
    ...(context.sceneHints || []),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .toLowerCase();
}

function inferPersonaTraits(context?: AssistantStickerContext): Record<PersonaTrait, number> {
  const sourceText = buildPersonaSourceText(context?.character);
  const traits: Record<PersonaTrait, number> = {
    gentle: 0,
    reserved: 0,
    playful: 0,
    sharp: 0,
    affectionate: 0,
    steady: 0,
  };

  if (!sourceText) {
    return traits;
  }

  PERSONA_TRAIT_PATTERNS.forEach(({ trait, weight, patterns }) => {
    if (patterns.some((pattern) => pattern.test(sourceText))) {
      traits[trait] += weight;
    }
  });

  return traits;
}

function inferStickerTraits(label: string): Set<StickerTrait> {
  const normalizedLabel = label.trim().toLowerCase();
  const traits = new Set<StickerTrait>();

  if (!normalizedLabel) {
    return traits;
  }

  STICKER_TRAIT_PATTERNS.forEach(({ trait, patterns }) => {
    if (patterns.some((pattern) => pattern.test(normalizedLabel))) {
      traits.add(trait);
    }
  });

  return traits;
}

function inferSceneSignals(context?: AssistantStickerContext) {
  const signalText = buildSceneSignalText(context);

  return {
    comfortNeeded: COMFORT_SIGNAL_PATTERNS.some((pattern) => pattern.test(signalText)),
    conflict: CONFLICT_SIGNAL_PATTERNS.some((pattern) => pattern.test(signalText)),
    romantic: ROMANTIC_SIGNAL_PATTERNS.some((pattern) => pattern.test(signalText)),
    serious: SERIOUS_SIGNAL_PATTERNS.some((pattern) => pattern.test(signalText)),
    lowEnergy: LOW_ENERGY_SIGNAL_PATTERNS.some((pattern) => pattern.test(signalText)),
    celebration: CELEBRATION_SIGNAL_PATTERNS.some((pattern) => pattern.test(signalText)),
    publicScene: context?.scene === 'group',
  };
}

function scoreStickerMatch(cueText: string, cueLabel: string, stickerLabel: string): number {
  if (!stickerLabel) return 0;
  if (cueLabel && stickerLabel === cueLabel) return 100;
  if (cueText && stickerLabel && cueText.includes(stickerLabel)) return 80;
  if (cueText && stickerLabel && stickerLabel.includes(cueText)) return 70;
  return 0;
}

function shouldTreatAsHardMismatch(
  label: string,
  stickerTraits: Set<StickerTrait>,
  personaTraits: Record<PersonaTrait, number>,
  sceneSignals: ReturnType<typeof inferSceneSignals>,
): boolean {
  const normalizedLabel = label.trim().toLowerCase();
  const feelsTooMean = normalizedLabel.includes('阴阳怪气')
    || normalizedLabel.includes('冷漠')
    || normalizedLabel.includes('冷淡');

  if (
    feelsTooMean
    && personaTraits.gentle >= 3
    && !sceneSignals.conflict
    && !sceneSignals.serious
  ) {
    return true;
  }

  if (
    stickerTraits.has('sarcastic')
    && personaTraits.gentle >= 4
    && !sceneSignals.conflict
  ) {
    return true;
  }

  return false;
}

function scoreStickerForContext(
  label: string,
  context: AssistantStickerContext | undefined,
  index: number,
): { score: number; blocked: boolean } {
  const personaTraits = inferPersonaTraits(context);
  const sceneSignals = inferSceneSignals(context);
  const stickerTraits = inferStickerTraits(label);
  let score = 12 - (index * 0.02);

  if (label) {
    score += 2;
  }

  if (personaTraits.gentle >= 3) {
    if (
      stickerTraits.has('comfort')
      || stickerTraits.has('affection')
      || stickerTraits.has('cheerful')
      || stickerTraits.has('shy')
      || stickerTraits.has('sad')
      || stickerTraits.has('apology')
      || stickerTraits.has('sleepy')
    ) {
      score += 4;
    }
    if (stickerTraits.has('sarcastic')) {
      score -= 7;
    }
    if (stickerTraits.has('angry')) {
      score -= 2;
    }
  }

  if (personaTraits.reserved >= 2) {
    if (stickerTraits.has('affection') || stickerTraits.has('playful') || stickerTraits.has('cheerful')) {
      score -= 2.5;
    }
    if (stickerTraits.has('cool') || stickerTraits.has('sleepy') || stickerTraits.has('surprised')) {
      score += 1.5;
    }
  }

  if (personaTraits.playful >= 2) {
    if (stickerTraits.has('playful') || stickerTraits.has('cheerful') || stickerTraits.has('surprised')) {
      score += 3;
    }
  }

  if (personaTraits.affectionate >= 2) {
    if (stickerTraits.has('affection') || stickerTraits.has('comfort') || stickerTraits.has('shy')) {
      score += 3;
    }
  }

  if (personaTraits.sharp >= 2) {
    if (stickerTraits.has('sarcastic') || stickerTraits.has('angry') || stickerTraits.has('playful')) {
      score += 2;
    }
  }

  if (personaTraits.steady >= 2) {
    if (stickerTraits.has('comfort') || stickerTraits.has('apology') || stickerTraits.has('cheerful')) {
      score += 2;
    }
    if (stickerTraits.has('playful') || stickerTraits.has('angry')) {
      score -= 1;
    }
  }

  if (sceneSignals.comfortNeeded) {
    if (stickerTraits.has('comfort') || stickerTraits.has('sad') || stickerTraits.has('apology')) {
      score += 4;
    }
    if (stickerTraits.has('affection')) {
      score += 2;
    }
    if (stickerTraits.has('sarcastic')) {
      score -= 8;
    }
    if (stickerTraits.has('playful')) {
      score -= 2;
    }
  }

  if (sceneSignals.conflict) {
    if (stickerTraits.has('apology') || stickerTraits.has('comfort') || stickerTraits.has('sad')) {
      score += 3;
    }
    if (stickerTraits.has('angry')) {
      score += personaTraits.sharp >= 2 ? 2 : 0.5;
    }
    if (stickerTraits.has('sarcastic') && personaTraits.gentle >= 3) {
      score -= 3;
    }
  }

  if (sceneSignals.romantic) {
    if (stickerTraits.has('affection') || stickerTraits.has('shy')) {
      score += 4;
    }
    if (stickerTraits.has('comfort')) {
      score += 1.5;
    }
  }

  if (sceneSignals.serious) {
    if (stickerTraits.has('playful') || stickerTraits.has('affection') || stickerTraits.has('cheerful')) {
      score -= 3;
    }
    if (stickerTraits.has('comfort') || stickerTraits.has('apology')) {
      score += 1;
    }
  }

  if (sceneSignals.publicScene) {
    if (stickerTraits.has('affection')) {
      score -= 2.5;
    }
    if (stickerTraits.has('sarcastic')) {
      score -= 2;
    }
    if (stickerTraits.has('comfort') || stickerTraits.has('cheerful')) {
      score += 1;
    }
  }

  if (sceneSignals.lowEnergy) {
    if (stickerTraits.has('sleepy')) {
      score += 4;
    }
    if (stickerTraits.has('playful') || stickerTraits.has('cheerful')) {
      score -= 2;
    }
  }

  if (sceneSignals.celebration) {
    if (stickerTraits.has('cheerful')) {
      score += 4;
    }
    if (stickerTraits.has('playful')) {
      score += 2;
    }
  }

  return {
    score,
    blocked: shouldTreatAsHardMismatch(label, stickerTraits, personaTraits, sceneSignals),
  };
}

function fallbackLabel(sticker: string, cueText?: string): string {
  return inferStickerSemanticLabel(sticker, cueText)?.trim()
    || cueText?.trim()
    || 'sticker';
}

export function resolveAssistantStickerCandidates(
  availableStickers: string[],
  context?: AssistantStickerContext,
): Array<PickedSticker & { score: number }> {
  const stickerCandidates = normalizeStickerPool(availableStickers);
  if (stickerCandidates.length === 0) {
    return [];
  }

  const scoredCandidates: StickerCandidate[] = stickerCandidates.map((sticker, index) => {
    const label = fallbackLabel(sticker);
    const { score, blocked } = scoreStickerForContext(label, context, index);
    return {
      sticker,
      label,
      score,
      blocked,
      index,
    };
  });

  const unblockedCandidates = scoredCandidates.filter((candidate) => !candidate.blocked);
  const effectiveCandidates = unblockedCandidates.length > 0 ? unblockedCandidates : scoredCandidates;

  return effectiveCandidates
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    })
    .slice(0, Math.min(8, effectiveCandidates.length))
    .map(({ sticker, label, score }) => ({
      sticker,
      label,
      score,
    }));
}

export function pickAssistantSticker(
  cueText: string,
  availableStickers: string[],
  context?: AssistantStickerContext,
): PickedSticker | null {
  const stickerCandidates = resolveAssistantStickerCandidates(availableStickers, context);
  if (stickerCandidates.length === 0) {
    return null;
  }

  const normalizedCueText = normalizeCueText(cueText);
  if (!normalizedCueText) {
    const fallbackSticker = stickerCandidates[0];
    return {
      sticker: fallbackSticker.sticker,
      label: fallbackSticker.label || fallbackLabel(fallbackSticker.sticker),
    };
  }

  const cueLabel = inferStickerSemanticLabel(undefined, cueText)?.trim().toLowerCase() || '';
  let bestMatch: PickedSticker | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of stickerCandidates) {
    const stickerLabel = candidate.label?.trim() || fallbackLabel(candidate.sticker, cueText);
    const normalizedStickerLabel = stickerLabel.toLowerCase();
    const cueScore = scoreStickerMatch(normalizedCueText, cueLabel, normalizedStickerLabel);
    const totalScore = candidate.score + cueScore;
    if (totalScore <= bestScore) continue;
    bestScore = totalScore;
    bestMatch = {
      sticker: candidate.sticker,
      label: stickerLabel || cueText.trim(),
    };
  }

  if (bestMatch) {
    return bestMatch;
  }

  const fallbackSticker = stickerCandidates[hashCueText(normalizedCueText) % stickerCandidates.length];
  return {
    sticker: fallbackSticker.sticker,
    label: fallbackSticker.label || fallbackLabel(fallbackSticker.sticker, cueText),
  };
}

function buildCharacterStickerVibe(context?: AssistantStickerContext): string {
  const personaTraits = inferPersonaTraits(context);
  const vibes: string[] = [];

  if (personaTraits.gentle >= 3) vibes.push('gentle');
  if (personaTraits.steady >= 2) vibes.push('steady');
  if (personaTraits.reserved >= 2) vibes.push('restrained');
  if (personaTraits.playful >= 2) vibes.push('playful');
  if (personaTraits.affectionate >= 2) vibes.push('softly affectionate');
  if (personaTraits.sharp >= 2) vibes.push('a little sharp');

  return vibes.join(', ');
}

function buildSceneStickerTilt(context?: AssistantStickerContext): string {
  const sceneSignals = inferSceneSignals(context);
  const tilts: string[] = [];

  if (sceneSignals.publicScene) tilts.push('public group tone');
  if (sceneSignals.comfortNeeded) tilts.push('comfort');
  if (sceneSignals.conflict) tilts.push('repair or tension');
  if (sceneSignals.romantic) tilts.push('romantic');
  if (sceneSignals.serious) tilts.push('serious');
  if (sceneSignals.lowEnergy) tilts.push('low-energy');
  if (sceneSignals.celebration) tilts.push('celebration');

  return tilts.join(', ');
}

export function buildAssistantStickerPromptSection(
  availableStickers: string[],
  context?: AssistantStickerContext,
): string {
  const candidates = resolveAssistantStickerCandidates(availableStickers, context);
  const labels = Array.from(new Set(
    candidates
      .map((candidate) => candidate.label?.trim())
      .filter((label): label is string => !!label),
  ));

  if (labels.length === 0) {
    return '';
  }

  const characterVibe = buildCharacterStickerVibe(context);
  const sceneTilt = buildSceneStickerTilt(context);

  return [
    '## Available stickers',
    'Only use a sticker if it still feels like this character and fits the current moment.',
    characterVibe ? `Character sticker vibe: ${characterVibe}` : '',
    sceneTilt ? `Scene tilt right now: ${sceneTilt}` : '',
    `Available sticker meanings for this turn: ${labels.join(' / ')}`,
    'To send a sticker, output a separate line exactly like: [sticker] meaning',
    'You may send only a sticker for a tiny emotional reaction, or send text first and then a sticker on the next line.',
    'Use stickers naturally. Skip the sticker if the moment needs clarity or none of the available stickers fit.',
  ]
    .filter(Boolean)
    .join('\n');
}
