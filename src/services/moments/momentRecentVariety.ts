import type { MomentItem } from '../../types';
import type { MomentPostShape } from './postBlueprints';

export type RecentMomentLengthBand = 'short' | 'medium' | 'long';
export type RecentMomentVibe =
  | 'carryover'
  | 'complaint'
  | 'abstract'
  | 'cheerful'
  | 'music'
  | 'diary'
  | 'life_fragment';

export type RecentMomentSnapshot = {
  preview: string;
  openingKey: string;
  lengthBand: RecentMomentLengthBand;
  vibe: RecentMomentVibe;
  imageLike: boolean;
  paragraphCount: number;
};

export type RecentMomentVarietyProfile = {
  items: RecentMomentSnapshot[];
  latest?: RecentMomentSnapshot;
  longStreak: number;
  visualStreak: number;
  latestVibeStreak: number;
  latestOpeningRepeatCount: number;
  dominantVibes: RecentMomentVibe[];
};

export type RecentMomentShapeHints = {
  forceTextOnly?: boolean;
  allowedShapes: MomentPostShape[];
  blockedShapes?: MomentPostShape[];
};

const CARRYOVER_VIBE_REGEX = /吃醋|偏心|护短|立场|主权|嘴硬|回温|被记住|被安抚|不展开|余波|某个人/i;
const COMPLAINT_VIBE_REGEX = /烦|累|无语|崩|火大|火气|忙|加班|收工|电量|麻烦|困|闹心/i;
const ABSTRACT_VIBE_REGEX = /抽象|发疯|恍惚|漂浮|回音|怪|空空|失重|像被|没完全登录|风吹散/i;
const CHEERFUL_VIBE_REGEX = /开心|顺利|好耶|满足|庆祝|治愈|不错|过得不错|亮一点/i;
const MUSIC_VIBE_REGEX = /bgm|音乐|耳机|歌单|那首歌|歌\b/i;
const DIARY_VIBE_REGEX = /夜里|记一笔|记录|备忘录|慢慢整理|今天一整天|后来|留给今晚/i;

const LONG_FORM_SHAPES: MomentPostShape[] = ['multi_paragraph', 'journal_note'];
const VISUAL_FORWARD_SHAPES: MomentPostShape[] = ['photo_dump', 'music_diary'];

function normalizeText(value: string | undefined) {
  return (value || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countParagraphs(value: string) {
  const normalized = value.replace(/\r/g, '').trim();
  if (!normalized) {
    return 0;
  }

  return normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
}

function classifyLengthBand(value: string, paragraphCount: number): RecentMomentLengthBand {
  if (value.length >= 120 || paragraphCount >= 3) {
    return 'long';
  }

  if (value.length <= 78 && paragraphCount <= 1) {
    return 'short';
  }

  return 'medium';
}

function classifyVibe(value: string, paragraphCount: number): RecentMomentVibe {
  if (CARRYOVER_VIBE_REGEX.test(value)) {
    return 'carryover';
  }
  if (COMPLAINT_VIBE_REGEX.test(value)) {
    return 'complaint';
  }
  if (ABSTRACT_VIBE_REGEX.test(value)) {
    return 'abstract';
  }
  if (CHEERFUL_VIBE_REGEX.test(value)) {
    return 'cheerful';
  }
  if (MUSIC_VIBE_REGEX.test(value)) {
    return 'music';
  }
  if (paragraphCount >= 3 || DIARY_VIBE_REGEX.test(value)) {
    return 'diary';
  }

  return 'life_fragment';
}

function buildOpeningKey(value: string) {
  return value
    .replace(/^[\s"'“”‘’「」『』\[\]()【】,.，。！？!?;；:：-]+/g, '')
    .replace(/\s+/g, '')
    .slice(0, 8);
}

function countLeadingMatches<T>(items: T[], predicate: (item: T) => boolean) {
  let count = 0;
  for (const item of items) {
    if (!predicate(item)) {
      break;
    }
    count += 1;
  }
  return count;
}

function uniqueInOrder<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const unique: T[] = [];

  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    unique.push(item);
  }

  return unique;
}

export function getRecentMomentVibeLabel(vibe: RecentMomentVibe) {
  switch (vibe) {
    case 'carryover':
      return '关系余波';
    case 'complaint':
      return '小吐槽';
    case 'abstract':
      return '抽象片段';
    case 'cheerful':
      return '积极分享';
    case 'music':
      return '配乐/氛围';
    case 'diary':
      return '分段记录';
    case 'life_fragment':
    default:
      return '生活碎片';
  }
}

export function analyzeRecentMomentVariety(recentMoments: MomentItem[] = []): RecentMomentVarietyProfile {
  const items = recentMoments
    .slice(0, 3)
    .map((moment) => {
      const normalized = normalizeText(moment.content);
      const paragraphCount = countParagraphs(moment.content);
      return {
        preview: normalized.slice(0, 48),
        openingKey: buildOpeningKey(normalized),
        lengthBand: classifyLengthBand(normalized, paragraphCount),
        vibe: classifyVibe(normalized, paragraphCount),
        imageLike: Boolean(moment.imageCard || (moment.images && moment.images.length > 0)),
        paragraphCount,
      } satisfies RecentMomentSnapshot;
    })
    .filter((item) => item.preview.length > 0);

  const latest = items[0];
  const longStreak = countLeadingMatches(items, (item) => item.lengthBand === 'long');
  const visualStreak = countLeadingMatches(items, (item) => item.imageLike);
  const latestVibeStreak = latest
    ? countLeadingMatches(items, (item) => item.vibe === latest.vibe)
    : 0;
  const latestOpeningRepeatCount = latest?.openingKey
    ? items.filter((item) => item.openingKey === latest.openingKey).length
    : 0;

  const vibeCounts = items.reduce((accumulator, item) => {
    accumulator[item.vibe] = (accumulator[item.vibe] || 0) + 1;
    return accumulator;
  }, {} as Partial<Record<RecentMomentVibe, number>>);

  const dominantVibes = Object.entries(vibeCounts)
    .filter((entry): entry is [RecentMomentVibe, number] => entry[1] >= 2)
    .sort((left, right) => right[1] - left[1])
    .map((entry) => entry[0]);

  return {
    items,
    latest,
    longStreak,
    visualStreak,
    latestVibeStreak,
    latestOpeningRepeatCount,
    dominantVibes,
  };
}

export function buildRecentMomentVarietyPromptLines(profile: RecentMomentVarietyProfile) {
  if (profile.items.length === 0) {
    return [];
  }

  const lines = [
    `最近动态预览：${profile.items.map((item) => `「${item.preview}」`).join('；')}`,
    '本次不要重复最近动态的开头、长度、段落结构或同一类生活事件。',
  ];

  if (profile.longStreak >= 2) {
    lines.push('最近连续两条都偏长，这次优先短一点、轻一点，不要再写成长分段。');
  } else if (profile.longStreak >= 1) {
    lines.push('上一条已经偏长，这次优先短一点、轻一点，除非当前状态强烈要求长文。');
  }

  if (profile.visualStreak >= 2) {
    lines.push('最近连续两条都偏图文/相册感，这次优先纯文字，不要再写成图集配文。');
  }

  if (profile.latestOpeningRepeatCount >= 2) {
    lines.push('最近几条动态的开头很像，这次换一个新的切入口，不要再用相同开头。');
  }

  if (profile.latest && profile.latestVibeStreak >= 2) {
    lines.push(`最近连续两条都偏${getRecentMomentVibeLabel(profile.latest.vibe)}，这次换一种公开表达。`);
  }

  return uniqueInOrder(lines);
}

export function buildRecentMomentShapeHints(options: {
  baseAllowedShapes: MomentPostShape[];
  recentVariety: RecentMomentVarietyProfile;
  preferTextOnly?: boolean;
}): RecentMomentShapeHints {
  const blockedShapes = new Set<MomentPostShape>();
  let forceTextOnly = Boolean(options.preferTextOnly);

  if (options.recentVariety.longStreak >= 1) {
    for (const shape of LONG_FORM_SHAPES) {
      blockedShapes.add(shape);
    }
  }

  if (options.recentVariety.longStreak >= 2) {
    forceTextOnly = true;
  }

  if (options.recentVariety.visualStreak >= 2) {
    forceTextOnly = true;
    for (const shape of VISUAL_FORWARD_SHAPES) {
      blockedShapes.add(shape);
    }
  }

  if (options.recentVariety.latest?.vibe === 'music' && options.recentVariety.latestVibeStreak >= 2) {
    blockedShapes.add('music_diary');
  }

  if (options.recentVariety.latest?.vibe === 'diary' && options.recentVariety.latestVibeStreak >= 2) {
    for (const shape of LONG_FORM_SHAPES) {
      blockedShapes.add(shape);
    }
  }

  let allowedShapes = uniqueInOrder(
    options.baseAllowedShapes.filter((shape) => !blockedShapes.has(shape)),
  );

  if (forceTextOnly) {
    allowedShapes = allowedShapes.filter((shape) => !VISUAL_FORWARD_SHAPES.includes(shape));
  }

  if (allowedShapes.length === 0) {
    allowedShapes = ['short_status'];
  }

  return {
    ...(forceTextOnly ? { forceTextOnly: true } : {}),
    allowedShapes,
    ...(blockedShapes.size > 0 ? { blockedShapes: [...blockedShapes] } : {}),
  };
}
