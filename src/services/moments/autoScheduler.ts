import type { Character, MomentItem } from '../../types';

export type AutoMomentSchedulerTrigger = 'moments_open' | 'manual_refresh' | 'app_foreground';

export type AutoMomentPlanEntry = {
  characterId: string;
  requestText: string;
  extraPromptSections: string[];
};

type AutoMomentCandidate = {
  character: Character;
  score: number;
  signalCount: number;
  cooldownRatio: number;
  hoursSinceLatestMoment: number;
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
  | 'life_album'
  | 'tiny_complaint'
  | 'night_journal'
  | 'positive_share'
  | 'abstract_fragment'
  | 'music_diary'
  | 'soft_afterglow'
  | 'public_claim';

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

function getCharacterStateText(character: Character) {
  return [
    character.signature,
    character.corePersona,
    character.expressionStyle,
    character.sharedState?.currentActivity,
    character.sharedState?.publicCarryover,
    character.sharedState?.attentionNote,
    character.presenceState?.recentLifeBeat,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function pickPlannerIntent(character: Character, trigger: AutoMomentSchedulerTrigger, seed: string): PlannerIntent {
  const stateText = getCharacterStateText(character);

  if (character.sharedState?.publicCarryover?.trim()) {
    if (/护短|占有|吃醋|张扬|强势|嘴硬|别扭/.test(stateText)) {
      return 'public_claim';
    }
    return 'soft_afterglow';
  }

  if (/bgm|音乐|耳机|歌|歌单/.test(stateText)) {
    return 'music_diary';
  }
  if (/加班|工位|开会|上班|收工|报表|消息|电量/.test(stateText)) {
    return 'tiny_complaint';
  }
  if (/开心|顺利|轻松|满足|庆祝|治愈|好耶/.test(stateText)) {
    return 'positive_share';
  }
  if (/夜|晚|回家|路上|散步|失眠|风|街灯|路灯/.test(stateText)) {
    return 'night_journal';
  }
  if (/抽象|发疯|恍惚|怪|空空|漂浮/.test(stateText)) {
    return 'abstract_fragment';
  }
  if (/安静|慢热|记录|想很多|写字|小作文|文艺/.test(stateText)) {
    return 'night_journal';
  }

  const defaultIntents: PlannerIntent[] = trigger === 'manual_refresh'
    ? ['life_album', 'positive_share', 'tiny_complaint']
    : ['life_album', 'night_journal', 'tiny_complaint'];

  return pickByHash(defaultIntents, seed);
}

function buildIntentPlan(character: Character, intent: PlannerIntent): AutoMomentPlanEntry {
  const sharedState = character.sharedState;
  const presenceState = character.presenceState;
  const baseSections = [
    sharedState?.currentActivity?.trim() ? `当前生活状态：${sharedState.currentActivity.trim()}` : '',
    presenceState?.recentLifeBeat?.trim() ? `最近生活节奏：${presenceState.recentLifeBeat.trim()}` : '',
    sharedState?.publicCarryover?.trim() ? `公开可见余波：${sharedState.publicCarryover.trim()}` : '',
    '写得像真实朋友圈，不要过度工整，不要写成统一模板。',
    '允许长短不一、允许分段、允许碎碎念，也允许只写一两句。',
  ].filter(Boolean);

  switch (intent) {
    case 'tiny_complaint':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=生活里的小吐槽；形态=碎碎念或两三段短文；主题=今天的消耗、上班感、收工后的回落。',
        extraPromptSections: baseSections,
      };
    case 'night_journal':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=夜里记录；形态=分段长文或电子日记；主题=今天的情绪、路上、夜风、回家后的心事整理。',
        extraPromptSections: baseSections,
      };
    case 'positive_share':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=积极分享；形态=图文配文或分段短文；主题=今天几件小开心、小顺利、小满足。',
        extraPromptSections: baseSections,
      };
    case 'abstract_fragment':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=抽象片段；形态=分段短文或怪一点的碎片记录；主题=今天奇怪的念头、恍惚、空掉、又慢慢回来的感觉。',
        extraPromptSections: baseSections,
      };
    case 'music_diary':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=配乐日记；形态=相册/BGM 配文；主题=耳机里那首歌、路上、照片和今天的小片段。',
        extraPromptSections: baseSections,
      };
    case 'soft_afterglow':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=关系余波；形态=公开动态里带一点让人自己对号入座的关系余味；主题=回温、被记住、被安抚、心情松下来一点。',
        extraPromptSections: baseSections,
      };
    case 'public_claim':
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=公开偏爱/轻微站位；形态=分段短文或图文配文；主题=护短、偏心、立场明显，但仍然像公开动态而不是私聊宣言。',
        extraPromptSections: baseSections,
      };
    case 'life_album':
    default:
      return {
        characterId: character.id,
        requestText: '自主发动态：日常补算；意图=生活碎片；形态=图集配文、短状态或分段记录；主题=今天普通但值得记住的小事。',
        extraPromptSections: baseSections,
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

  const signalCount = [
    character.sharedState?.currentActivity,
    character.sharedState?.publicCarryover,
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
  };
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

  return selectedCandidates.map(({ character }) => {
    const intent = pickPlannerIntent(
      character,
      trigger,
      `${character.id}:${character.sharedState?.currentActivity || ''}:${character.sharedState?.publicCarryover || ''}:${character.presenceState?.recentLifeBeat || ''}`,
    );
    return buildIntentPlan(character, intent);
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
