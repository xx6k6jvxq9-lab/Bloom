import type { Character, MomentItem } from '../../types';
import { rebuildSharedStateFromCharacter } from '../relationship-context/buildSharedCharacterState';
import { MOMENT_POST_SHAPES, type MomentPostShape } from './postBlueprints';
import {
  analyzeRecentMomentVariety,
  buildRecentMomentShapeHints,
  buildRecentMomentVarietyPromptLines,
  type RecentMomentVarietyProfile,
} from './momentRecentVariety';

export type AutoMomentSchedulerTrigger = 'moments_open' | 'manual_refresh' | 'app_foreground';

export type AutoMomentPlanEntry = {
  characterId: string;
  requestText: string;
  extraPromptSections: string[];
  generationHints?: {
    forceTextOnly?: boolean;
    allowedShapes?: MomentPostShape[];
    blockedShapes?: MomentPostShape[];
  };
};

type AutoMomentCandidate = {
  character: Character;
  score: number;
  signalCount: number;
  cooldownRatio: number;
  hoursSinceLatestMoment: number;
  latestMomentAt: number;
};

type FrequencyConfig = {
  cooldownMs: number;
  dailyCap: number;
};

const LAST_CHECK_STORAGE_KEY = 'bloom:moments:auto-last-check-at:v1';

const FREQUENCY_CONFIG: Record<NonNullable<Character['postFrequency']>, FrequencyConfig> = {
  none: {
    cooldownMs: Number.POSITIVE_INFINITY,
    dailyCap: 0,
  },
  low: {
    cooldownMs: 18 * 60 * 60 * 1000,
    dailyCap: 1,
  },
  medium: {
    cooldownMs: 8 * 60 * 60 * 1000,
    dailyCap: 2,
  },
  high: {
    cooldownMs: 3 * 60 * 60 * 1000,
    dailyCap: 4,
  },
};

type PlannerIntent =
  | 'micro_status'
  | 'life_album'
  | 'object_caption'
  | 'tiny_complaint'
  | 'night_journal'
  | 'positive_share'
  | 'abstract_fragment'
  | 'music_diary'
  | 'soft_afterglow'
  | 'public_claim';

const PLANNER_INTENTS: PlannerIntent[] = [
  'micro_status',
  'life_album',
  'object_caption',
  'tiny_complaint',
  'night_journal',
  'positive_share',
  'abstract_fragment',
  'music_diary',
  'soft_afterglow',
  'public_claim',
];

function hashString(input: string) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = ((value << 5) - value + input.charCodeAt(index)) | 0;
  }
  return Math.abs(value);
}

function pickByHash<T>(items: T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

function getFrequencyConfig(character: Character) {
  return FREQUENCY_CONFIG[character.postFrequency || 'medium'];
}

function getCharacterLatestMomentTimestamp(characterId: string, moments: MomentItem[] = []) {
  return moments
    .filter((moment) => moment.authorId === characterId)
    .reduce((latest, moment) => Math.max(latest, moment.timestamp), 0);
}

function getCharacterRecentMomentCount(characterId: string, moments: MomentItem[] = [], now: number) {
  return moments.filter((moment) => moment.authorId === characterId && now - moment.timestamp <= 24 * 60 * 60 * 1000).length;
}

function getEffectiveSharedState(character: Character) {
  return rebuildSharedStateFromCharacter({
    character,
  });
}

function getCharacterStateText(character: Character) {
  const effectiveSharedState = getEffectiveSharedState(character);
  return [
    character.signature,
    character.corePersona,
    character.expressionStyle,
    effectiveSharedState.currentActivity,
    effectiveSharedState.publicCarryover,
    effectiveSharedState.attentionNote,
    character.presenceState?.recentLifeBeat,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function pickPlannerIntent(seed: string): PlannerIntent {
  return pickByHash(PLANNER_INTENTS, seed);
}

function hasWorkCue(character: Character) {
  return /实习|工作|上班|下班|加班|工位|公司|办公室|开会|报表|同事|老板|客户/.test(getCharacterStateText(character));
}

function buildIntentGenerationHints(
  recentVariety: RecentMomentVarietyProfile,
  options: { preferTextOnly?: boolean } = {},
) {
  return buildRecentMomentShapeHints({
    baseAllowedShapes: MOMENT_POST_SHAPES,
    recentVariety,
    preferTextOnly: options.preferTextOnly,
  });
}

function buildIntentPlan(
  character: Character,
  intent: PlannerIntent,
  options: { recentMoments?: MomentItem[] } = {},
): AutoMomentPlanEntry {
  const sharedState = getEffectiveSharedState(character);
  const presenceState = character.presenceState;
  const workCue = hasWorkCue(character);
  const recentVariety = analyzeRecentMomentVariety(options.recentMoments || []);
  const generationHints = buildIntentGenerationHints(recentVariety);
  const baseSections = [
    sharedState?.currentActivity?.trim() ? `当前生活状态：${sharedState.currentActivity.trim()}` : '',
    presenceState?.recentLifeBeat?.trim() ? `最近生活节奏：${presenceState.recentLifeBeat.trim()}` : '',
    sharedState?.publicCarryover?.trim() ? `公开可见余波：${sharedState.publicCarryover.trim()}` : '',
    ...buildRecentMomentVarietyPromptLines(recentVariety),
    '写得像真实朋友圈，不要过度工整，不要写成统一模板。',
    '允许长短不一、允许分段、允许碎碎念，也允许只写一两句。',
    '没有在角色设定、当前生活状态或公开余波里明确出现的事实，不要临时新造室友、同事、老板、同学、家人、宿舍、固定工作地点或宠物。',
    '如果当前生活状态很泛，就选低风险锚点：手机、房间角落、窗外天气、桌面、耳机、手边饮料、路灯、镜子。不要为了真实感硬加一条新社会关系。',
  ].filter(Boolean);

  switch (intent) {
    case 'micro_status':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=轻状态；形态=由本次均衡形态抽签决定；主题=此刻一个具体物件、天气、身体状态或刚冒出来的小念头。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'object_caption':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=生活物件配文；形态=由本次均衡形态抽签决定；主题=手边看得见的一个东西、光线、屏幕、饮料、衣服、桌面或镜子。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'tiny_complaint':
      return {
        characterId: character.id,
        requestText: workCue
          ? '自主发动态：日常补算；意图=生活里的小吐槽；形态=由本次均衡形态抽签决定；主题=今天的消耗、工作/实习里的小卡顿、收住之后的回落。'
          : '自主发动态：日常补算；意图=生活里的小吐槽；形态=由本次均衡形态抽签决定；主题=今天的消耗、消息太多、电量太低、路上小麻烦、手边东西不顺。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'night_journal':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=夜间记录；形态=由本次均衡形态抽签决定；主题=夜里的一个具体画面、路灯、窗外、手机屏幕、风或突然安静下来的状态。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'positive_share':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=积极分享；形态=由本次均衡形态抽签决定；主题=今天几件小开心、小顺利、小满足。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'abstract_fragment':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=抽象片段；形态=由本次均衡形态抽签决定；主题=今天奇怪的念头、恍惚、空掉、又慢慢回来的感觉。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'music_diary':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=配乐日记；形态=由本次均衡形态抽签决定；主题=耳机里那首歌、路上、照片和今天的小片段。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'soft_afterglow':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=关系余波；形态=由本次均衡形态抽签决定；主题=回温、被记住、被安抚、心情松下来一点。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'public_claim':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=公开偏爱/轻微站位；形态=由本次均衡形态抽签决定；主题=护短、偏心、立场明显，但仍然像公开动态而不是私聊宣言。',
        extraPromptSections: baseSections,
        generationHints,
      };
    case 'life_album':
    default:
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=生活碎片；形态=由本次均衡形态抽签决定；主题=今天普通但值得记住的小事。',
        extraPromptSections: baseSections,
        generationHints,
      };
  }
}

function getGlobalRunCap(trigger: AutoMomentSchedulerTrigger, elapsedSinceCheckMs: number) {
  if (trigger === 'manual_refresh') {
    return elapsedSinceCheckMs >= 12 * 60 * 60 * 1000 ? 3 : 2;
  }
  if (elapsedSinceCheckMs >= 18 * 60 * 60 * 1000) {
    return 3;
  }
  if (elapsedSinceCheckMs >= 6 * 60 * 60 * 1000) {
    return 2;
  }
  return 1;
}

function buildAutoMomentCandidate(options: {
  character: Character;
  moments: MomentItem[];
  now: number;
  elapsedSinceCheckMs: number;
}): AutoMomentCandidate | null {
  const { character, moments, now, elapsedSinceCheckMs } = options;
  const config = getFrequencyConfig(character);
  if (config.dailyCap <= 0 || !Number.isFinite(config.cooldownMs)) {
    return null;
  }

  const latestMomentAt = getCharacterLatestMomentTimestamp(character.id, moments);
  const recentCount = getCharacterRecentMomentCount(character.id, moments, now);
  if (recentCount >= config.dailyCap) {
    return null;
  }

  const hoursSinceLatestMoment = latestMomentAt > 0
    ? (now - latestMomentAt) / (1000 * 60 * 60)
    : 24;
  const cooldownRatio = latestMomentAt > 0
    ? (now - latestMomentAt) / config.cooldownMs
    : 2.2;
  const effectiveSharedState = getEffectiveSharedState(character);

  const signalCount = [
    effectiveSharedState.currentActivity,
    effectiveSharedState.publicCarryover,
    character.presenceState?.recentLifeBeat,
  ].filter((value) => (value?.trim() || '').length > 0).length;

  const score = cooldownRatio
    + Math.min(elapsedSinceCheckMs / (4 * 60 * 60 * 1000), 1.6)
    + signalCount * 0.18
    + (character.postFrequency === 'high' ? 0.35 : character.postFrequency === 'low' ? -0.12 : 0.08)
    + (hoursSinceLatestMoment >= 24 ? 0.35 : 0);

  return {
    character,
    score,
    signalCount,
    cooldownRatio,
    hoursSinceLatestMoment,
    latestMomentAt,
  };
}

function getRecentMomentsByAuthor(characterId: string, moments: MomentItem[] = []) {
  return moments
    .filter((moment) => moment.authorId === characterId)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 3);
}

export function buildAutoMomentPlan(options: {
  characters: Character[];
  moments: MomentItem[];
  now: number;
  lastCheckedAt?: number | null;
  trigger: AutoMomentSchedulerTrigger;
}) {
  const { characters, moments, now, lastCheckedAt, trigger } = options;
  const elapsedSinceCheckMs = lastCheckedAt ? Math.max(0, now - lastCheckedAt) : 8 * 60 * 60 * 1000;
  const globalRunCap = getGlobalRunCap(trigger, elapsedSinceCheckMs);

  const baseCandidates = characters
    .map((character) => buildAutoMomentCandidate({
      character,
      moments,
      now,
      elapsedSinceCheckMs,
    }))
    .filter((item): item is AutoMomentCandidate => Boolean(item));

  const scoredCandidates = baseCandidates
    .filter((item) => item.cooldownRatio >= 1)
    .filter((item) => item.score >= (trigger === 'app_foreground' ? 1.85 : 1.65))
    .sort((left, right) => right.score - left.score)
    .slice(0, globalRunCap);

  const manualRefreshFallback = trigger === 'manual_refresh' && scoredCandidates.length === 0
    ? baseCandidates
      .sort((left, right) => right.score - left.score)
      .slice(0, 1)
    : [];

  const selectedCandidates = scoredCandidates.length > 0
    ? scoredCandidates
    : manualRefreshFallback;

  return selectedCandidates.map(({ character, latestMomentAt }) => {
    const recentMoments = getRecentMomentsByAuthor(character.id, moments);
    const effectiveSharedState = getEffectiveSharedState(character);
    const intent = pickPlannerIntent(
      `${character.id}:${trigger}:${effectiveSharedState.currentActivity || ''}:${effectiveSharedState.publicCarryover || ''}:${character.presenceState?.recentLifeBeat || ''}:${latestMomentAt}:${recentMoments.length}`,
    );
    return buildIntentPlan(character, intent, { recentMoments });
  });
}

export function loadLastAutoMomentCheckAt() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LAST_CHECK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastAutoMomentCheckAt(timestamp: number) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LAST_CHECK_STORAGE_KEY, String(timestamp));
  } catch {
    // ignore persistence errors for scheduler bookkeeping
  }
}
