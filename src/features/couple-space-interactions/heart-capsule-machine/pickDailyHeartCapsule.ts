import type {
  HeartCapsuleDrawSource,
  HeartCapsuleMachineHistoryEntry,
  HeartCapsuleTodayDraw,
} from '../../../types';
import { HEART_CAPSULE_POOL } from './heartCapsulePool';
import type { HeartCapsule } from './types';

type PickDailyHeartCapsuleOptions = {
  date: string;
  drawnBy: HeartCapsuleDrawSource;
  history?: HeartCapsuleMachineHistoryEntry[];
  now?: number;
};

type PickDailyHeartCapsuleResult = {
  capsule: HeartCapsule;
  draw: HeartCapsuleTodayDraw;
};

const CATEGORY_WEIGHTS = [
  'relationship_shift',
  'relationship_shift',
  'relationship_shift',
  'relationship_shift',
  'truth_variant',
  'truth_variant',
  'truth_variant',
  'async_dual_rule',
  'async_dual_rule',
] as const;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickDailyHeartCapsule({
  date,
  drawnBy,
  history = [],
  now = Date.now(),
}: PickDailyHeartCapsuleOptions): PickDailyHeartCapsuleResult {
  const recentCategory = history[0]?.capsuleCategory ?? null;
  const weightedCategory = pickRandom(CATEGORY_WEIGHTS);

  const category =
    recentCategory && recentCategory === weightedCategory
      ? pickRandom(CATEGORY_WEIGHTS.filter((entry) => entry !== recentCategory))
      : weightedCategory;

  const recentIds = new Set(history.slice(0, 8).map((entry) => entry.capsuleId));
  const categoryPool = HEART_CAPSULE_POOL.filter((capsule) => capsule.category === category);
  const preferredPool = categoryPool.filter((capsule) => !recentIds.has(capsule.id));
  const basePool = preferredPool.length ? preferredPool : categoryPool;
  const drawSourcePool = basePool.filter(
    (capsule) => capsule.suggestedDraw === drawnBy || capsule.suggestedDraw === 'either',
  );
  const finalPool = drawSourcePool.length ? drawSourcePool : basePool;

  const capsule = pickRandom(finalPool);
  const selectedQuestion =
    capsule.category === 'truth_variant'
      ? pickRandom(capsule.questionPool)
      : capsule.category === 'async_dual_rule'
        ? pickRandom(capsule.scenarioPool)
        : null;

  return {
    capsule,
    draw: {
      id: `heart-capsule-${now}`,
      date,
      drawnAt: now,
      drawnBy,
      capsuleId: capsule.id,
      capsuleName: capsule.name,
      capsuleCategory: capsule.category,
      summary: capsule.summary,
      selectedQuestion,
      revealedAt: null,
    },
  };
}
