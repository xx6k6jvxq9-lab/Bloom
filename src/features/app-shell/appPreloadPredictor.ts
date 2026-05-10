import type { AppScreen } from './appShellHandlers';

const APP_TRANSITION_SESSION_KEY = 'bloom:app-transition-counts';

const DEFAULT_NEXT_APP_PREDICTIONS: Record<AppScreen, AppScreen[]> = {
  home: ['dream', 'couple-space', 'music', 'settings'],
  chat: ['chat-session', 'character-profile', 'character-moments', 'settings'],
  settings: ['worldbook', 'chat', 'home'],
  'chat-session': ['character-profile', 'dream', 'forum', 'chat'],
  'group-chat-session': ['forum', 'chat', 'settings'],
  'add-character': ['chat', 'character-profile', 'home'],
  dream: ['chat', 'worldbook', 'home'],
  'character-profile': ['chat-session', 'character-moments', 'chat'],
  'character-moments': ['chat-session', 'chat', 'home'],
  worldbook: ['chat', 'settings', 'home'],
  monitor: ['home', 'chat'],
  customization: ['settings', 'home', 'worldbook'],
  'couple-space': ['perception', 'chat', 'home'],
  perception: ['couple-space', 'chat', 'home'],
  music: ['chat', 'forum', 'home'],
  forum: ['chat-session', 'chat', 'home'],
  wallet: ['chat', 'home', 'settings'],
};

type TransitionCounts = Partial<Record<AppScreen, Partial<Record<AppScreen, number>>>>;

function readTransitionCounts(): TransitionCounts {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return {};
  }

  try {
    const raw = sessionStorage.getItem(APP_TRANSITION_SESSION_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as TransitionCounts;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTransitionCounts(counts: TransitionCounts) {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(APP_TRANSITION_SESSION_KEY, JSON.stringify(counts));
  } catch {
    // Ignore sessionStorage failures; prediction is best-effort only.
  }
}

export function recordAppTransition(fromApp: AppScreen, toApp: AppScreen) {
  if (!fromApp || !toApp || fromApp === toApp) {
    return;
  }

  const currentCounts = readTransitionCounts();
  const nextCountsForSource = {
    ...(currentCounts[fromApp] || {}),
    [toApp]: ((currentCounts[fromApp]?.[toApp] || 0) + 1),
  };

  writeTransitionCounts({
    ...currentCounts,
    [fromApp]: nextCountsForSource,
  });
}

export function getPredictedNextApps(fromApp: AppScreen, limit = 3): AppScreen[] {
  const learnedCounts = readTransitionCounts()[fromApp] || {};
  const learnedTargets = Object.entries(learnedCounts)
    .sort((left, right) => (right[1] || 0) - (left[1] || 0))
    .map(([app]) => app as AppScreen);
  const fallbackTargets = DEFAULT_NEXT_APP_PREDICTIONS[fromApp] || [];

  return Array.from(new Set([...learnedTargets, ...fallbackTargets]))
    .filter((app) => app !== fromApp)
    .slice(0, limit);
}
