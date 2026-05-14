import type { Character, StickerMetadata } from '../../types';
import { inferStickerSemanticLabel } from './stickerSemantics';
import {
  buildStickerMetadataSemanticText,
  getStickerMetadata,
  resolveStickerMetadataLabel,
} from './stickerMetadata';

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
  recentStickerRefs?: string[];
  recentStickerLabels?: string[];
  lastOwnMessageWasSticker?: boolean;
  stickerMetadataMap?: Record<string, StickerMetadata>;
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
  semanticText: string;
  score: number;
  blocked: boolean;
  index: number;
};

type RankedStickerCandidate = PickedSticker & {
  semanticText: string;
  score: number;
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

function normalizeStickerUsageValue(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function isLowInformationStickerCue(cueText: string, cueLabel?: string): boolean {
  const normalizedText = normalizeStickerUsageValue(cueText);
  if (!normalizedText) {
    return true;
  }

  if (/^[.…~!！?？,，。、、_\-=\s]+$/u.test(normalizedText)) {
    return true;
  }

  if (new Set([
    'sticker',
    'image',
    'emoji',
    'meme',
    '表情包',
    '表情',
    '图片',
    '图',
    '嗯',
    '哈',
    '哈哈',
    '呵',
    '额',
    '呃',
  ]).has(normalizedText)) {
    return true;
  }

  if (cueLabel && normalizeStickerUsageValue(cueLabel) !== normalizedText) {
    return false;
  }

  return false;
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
  void label;
  void stickerTraits;
  void personaTraits;
  void sceneSignals;
  // Do not hard-block sticker types based on persona or scene stereotypes.
  // The model should be free to decide the beat; the system only helps map
  // that beat onto a real sticker and avoid low-signal repetition.
  return false;

  /*
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
  */
}

function scoreStickerForContext(
  semanticText: string,
  label: string,
  context: AssistantStickerContext | undefined,
  index: number,
  stickerRef: string,
): { score: number; blocked: boolean } {
  const personaTraits = inferPersonaTraits(context);
  const sceneSignals = inferSceneSignals(context);
  const stickerTraits = inferStickerTraits(semanticText);
  const metadata = getStickerMetadata(context?.stickerMetadataMap, stickerRef);
  const category = metadata?.category?.trim().toLowerCase() || '';
  const normalizedStickerRef = normalizeStickerUsageValue(stickerRef);
  const normalizedStickerLabel = normalizeStickerUsageValue(label);
  const recentStickerRefs = (context?.recentStickerRefs || [])
    .map((value) => normalizeStickerUsageValue(value))
    .filter(Boolean);
  const recentStickerLabels = (context?.recentStickerLabels || [])
    .map((value) => normalizeStickerUsageValue(value))
    .filter(Boolean);
  const recentStickerCategories = (context?.recentStickerRefs || [])
    .slice(0, 4)
    .map((value) => getStickerMetadata(context?.stickerMetadataMap, value)?.category?.trim().toLowerCase() || '')
    .filter(Boolean);
  let score = 12 - (index * 0.02);

  if (label) {
    score += 2;
  }

  if (metadata?.label?.trim()) score += 1.2;
  if ((metadata?.aliases || []).length > 0) score += 0.9;
  if ((metadata?.traits || []).length > 0) score += 0.9;

  const recentRefIndex = normalizedStickerRef
    ? recentStickerRefs.indexOf(normalizedStickerRef)
    : -1;
  if (recentRefIndex === 0) {
    score -= 16;
  } else if (recentRefIndex > 0 && recentRefIndex < 4) {
    score -= 10 - recentRefIndex;
  }

  const recentLabelIndex = normalizedStickerLabel
    ? recentStickerLabels.indexOf(normalizedStickerLabel)
    : -1;
  if (recentLabelIndex === 0) {
    score -= 8;
  } else if (recentLabelIndex > 0 && recentLabelIndex < 3) {
    score -= 5 - recentLabelIndex;
  }

  if (category) {
    const recentCategoryIndex = recentStickerCategories.indexOf(category);
    if (recentCategoryIndex === 0) {
      score -= 4.5;
    } else if (recentCategoryIndex > 0 && recentCategoryIndex < 3) {
      score -= 2.5 - (recentCategoryIndex * 0.5);
    }
  }

  if (context?.lastOwnMessageWasSticker) {
    if (recentRefIndex === 0) {
      score -= 6;
    }
    if (recentLabelIndex === 0) {
      score -= 3;
    }
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
  }

  if (personaTraits.reserved >= 2) {
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
  }

  if (sceneSignals.comfortNeeded) {
    if (stickerTraits.has('comfort') || stickerTraits.has('sad') || stickerTraits.has('apology')) {
      score += 4;
    }
    if (stickerTraits.has('affection')) {
      score += 2;
    }
  }

  if (sceneSignals.conflict) {
    if (stickerTraits.has('apology') || stickerTraits.has('comfort') || stickerTraits.has('sad')) {
      score += 3;
    }
    if (stickerTraits.has('angry')) {
      score += personaTraits.sharp >= 2 ? 2 : 0.5;
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
    if (stickerTraits.has('comfort') || stickerTraits.has('apology')) {
      score += 1;
    }
  }

  if (sceneSignals.publicScene) {
    if (stickerTraits.has('comfort') || stickerTraits.has('cheerful')) {
      score += 1;
    }
  }

  if (sceneSignals.lowEnergy) {
    if (stickerTraits.has('sleepy')) {
      score += 4;
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
    blocked: shouldTreatAsHardMismatch(semanticText, stickerTraits, personaTraits, sceneSignals),
  };
}

function fallbackLabel(
  sticker: string,
  metadataMap?: Record<string, StickerMetadata>,
  cueText?: string,
): string {
  return resolveStickerMetadataLabel(metadataMap, sticker)
    || inferStickerSemanticLabel(sticker, cueText)?.trim()
    || cueText?.trim()
    || 'sticker';
}

function formatStickerPromptDescriptor(candidate: RankedStickerCandidate): string {
  const semanticParts = candidate.semanticText
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const extras = semanticParts
    .filter((item) => item !== candidate.label)
    .slice(0, 4);

  return extras.length > 0
    ? `${candidate.label} (${extras.join(' / ')})`
    : candidate.label;
}

export function resolveAssistantStickerCandidates(
  availableStickers: string[],
  context?: AssistantStickerContext,
): RankedStickerCandidate[] {
  const stickerCandidates = normalizeStickerPool(availableStickers);
  if (stickerCandidates.length === 0) {
    return [];
  }

  const scoredCandidates: StickerCandidate[] = stickerCandidates.map((sticker, index) => {
    const label = fallbackLabel(sticker, context?.stickerMetadataMap);
    const semanticText = buildStickerMetadataSemanticText(
      context?.stickerMetadataMap,
      sticker,
      label,
    ) || label;
    const { score, blocked } = scoreStickerForContext(semanticText, label, context, index, sticker);
    return {
      sticker,
      label,
      semanticText,
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
    .map(({ sticker, label, semanticText, score }) => ({
      sticker,
      label,
      semanticText,
      score,
    }));
}

function maybeRotateWithinSameLabelCluster(
  rankedMatches: Array<{
    candidate: RankedStickerCandidate;
    index: number;
    label: string;
    totalScore: number;
  }>,
  chosen: {
    candidate: RankedStickerCandidate;
    index: number;
    label: string;
    totalScore: number;
  } | undefined,
  recentStickerCooldownRefs: Set<string>,
) {
  if (!chosen) {
    return chosen;
  }

  const normalizedChosenLabel = normalizeStickerUsageValue(chosen.label);
  const normalizedChosenRef = normalizeStickerUsageValue(chosen.candidate.sticker);
  const sibling = rankedMatches.find((entry) => (
    entry !== chosen
    && normalizeStickerUsageValue(entry.label) === normalizedChosenLabel
    && normalizeStickerUsageValue(entry.candidate.sticker) !== normalizedChosenRef
    && !recentStickerCooldownRefs.has(normalizeStickerUsageValue(entry.candidate.sticker))
  ));

  return sibling || chosen;
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
  const cueLabel = inferStickerSemanticLabel(undefined, cueText)?.trim().toLowerCase() || '';
  const lowInformationCue = isLowInformationStickerCue(cueText, cueLabel);
  const immediatePreviousStickerRef = normalizeStickerUsageValue(context?.recentStickerRefs?.[0]);
  const recentStickerCooldownRefs = new Set(
    (context?.recentStickerRefs || [])
      .slice(0, 4)
      .map((value) => normalizeStickerUsageValue(value))
      .filter(Boolean),
  );

  if (context?.lastOwnMessageWasSticker && lowInformationCue) {
    return null;
  }

  if (!normalizedCueText) {
    const fallbackSticker = stickerCandidates.find((candidate) => (
      !recentStickerCooldownRefs.has(normalizeStickerUsageValue(candidate.sticker))
    )) || stickerCandidates[0];

    if (
      recentStickerCooldownRefs.has(normalizeStickerUsageValue(fallbackSticker.sticker))
    ) {
      return null;
    }

    return {
      sticker: fallbackSticker.sticker,
      label: fallbackSticker.label || fallbackLabel(fallbackSticker.sticker, context?.stickerMetadataMap),
    };
  }

  const rankedMatches = stickerCandidates
    .map((candidate, index) => {
      const stickerLabel = candidate.label?.trim() || fallbackLabel(candidate.sticker, context?.stickerMetadataMap, cueText);
      const searchText = buildStickerMetadataSemanticText(
        context?.stickerMetadataMap,
        candidate.sticker,
        stickerLabel,
      ) || stickerLabel;
      const normalizedSearchText = searchText.toLowerCase();
      const cueScore = scoreStickerMatch(normalizedCueText, cueLabel, normalizedSearchText);
      return {
        candidate,
        index,
        label: stickerLabel || cueText.trim(),
        totalScore: candidate.score + cueScore,
      };
    })
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }
      return left.index - right.index;
    });

  let chosen = rankedMatches[0];
  if (
    chosen
    && recentStickerCooldownRefs.has(normalizeStickerUsageValue(chosen.candidate.sticker))
  ) {
    const alternative = rankedMatches.find((entry) => (
      !recentStickerCooldownRefs.has(normalizeStickerUsageValue(entry.candidate.sticker))
    ));

    if (alternative) {
      chosen = alternative;
    }
  }

  chosen = maybeRotateWithinSameLabelCluster(rankedMatches, chosen, recentStickerCooldownRefs);

  if (
    chosen
    && !recentStickerCooldownRefs.has(normalizeStickerUsageValue(chosen.candidate.sticker))
    && !(lowInformationCue
      && immediatePreviousStickerRef
      && normalizeStickerUsageValue(chosen.candidate.sticker) === immediatePreviousStickerRef)
  ) {
    return {
      sticker: chosen.candidate.sticker,
      label: chosen.label,
    };
  }

  const fallbackSticker = stickerCandidates.find((candidate) => (
    !recentStickerCooldownRefs.has(normalizeStickerUsageValue(candidate.sticker))
  )) || stickerCandidates[hashCueText(normalizedCueText) % stickerCandidates.length];

  if (
    recentStickerCooldownRefs.has(normalizeStickerUsageValue(fallbackSticker.sticker))
  ) {
    return null;
  }

  return {
    sticker: fallbackSticker.sticker,
    label: fallbackSticker.label || fallbackLabel(fallbackSticker.sticker, context?.stickerMetadataMap, cueText),
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
  const descriptors = Array.from(new Set(
    candidates
      .map((candidate) => formatStickerPromptDescriptor(candidate))
      .filter(Boolean),
  ));

  if (descriptors.length === 0) {
    return '';
  }

  const characterVibe = buildCharacterStickerVibe(context);
  const sceneTilt = buildSceneStickerTilt(context);
  const recentStickerLabels = Array.from(new Set(
    (context?.recentStickerLabels || [])
      .map((label) => label?.trim())
      .filter((label): label is string => !!label),
  )).slice(0, 2);

  return [
    '## Available stickers',
    'Use a sticker when it helps the character express the current beat more naturally.',
    characterVibe ? `Character sticker vibe: ${characterVibe}` : '',
    sceneTilt ? `Scene tilt right now: ${sceneTilt}` : '',
    context?.lastOwnMessageWasSticker
      ? 'Your last visible message was already a sticker. Do not immediately send another one unless it clearly adds a new beat.'
      : '',
    recentStickerLabels.length > 0
      ? `Recently used sticker moods: ${recentStickerLabels.join(' / ')}. Avoid repeating the same sticker mood back-to-back unless the moment truly calls for it.`
      : '',
    `Available sticker meanings for this turn: ${descriptors.join(' / ')}`,
    candidates[0]?.score >= 18
      ? 'At least one sticker mood matches this turn very well. For a short emotional beat, using exactly one fitting sticker is a good option.'
      : '',
    'Do not self-censor based on a rigid persona rule. If a sticker genuinely matches the beat, you may use it.',
    'To send a sticker, output a separate line exactly like: [sticker] meaning',
    'You may send only a sticker for a tiny emotional reaction, or send text first and then a sticker on the next line.',
    'Use stickers naturally. Do not force them every turn, but do not be overly shy about using one when it clearly fits better than extra words.',
  ]
    .filter(Boolean)
    .join('\n');
}
