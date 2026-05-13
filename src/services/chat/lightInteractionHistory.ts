import type { ChatMessage, LightInteractionMessageMeta } from '../../types';
import { getMessageMainText } from '../../utils';

const DIRECT_POKE_STREAK_WINDOW_MS = 8 * 60 * 1000;
const POKE_SYSTEM_LINE_REGEX = /拍了拍/u;

export type DirectPokeRecentState = {
  recentSystemLines: string[];
  recentDescriptors: string[];
  latestMood?: string;
  latestNextActions?: string[];
  latestCounterActionType?: LightInteractionMessageMeta['counterActionType'];
  upcomingStreak: number;
};

function isScenePokeMessage(message: ChatMessage, scene: LightInteractionMessageMeta['scene']): boolean {
  return (
    (
      message.lightInteractionMeta?.type === 'poke'
      && message.lightInteractionMeta.scene === scene
    )
    || (!!message.isSystem && POKE_SYSTEM_LINE_REGEX.test(getMessageMainText(message)))
  );
}

function extractFallbackDescriptor(systemLine: string): string[] {
  const trimmed = systemLine.trim();
  if (!trimmed) {
    return [];
  }

  const matched = trimmed.match(/拍了拍(.+?)的[^的]+$/u);
  const descriptor = matched?.[1]?.trim().replace(/^的/u, '').trim();
  return descriptor ? [descriptor] : [];
}

function collectRecentPokeState(
  messages: ChatMessage[],
  scene: LightInteractionMessageMeta['scene'],
  options?: {
    systemLineLimit?: number;
    descriptorLimit?: number;
    allowLegacySystemFallback?: boolean;
  },
): DirectPokeRecentState {
  const systemLineLimit = options?.systemLineLimit ?? 5;
  const descriptorLimit = options?.descriptorLimit ?? 8;
  const allowLegacySystemFallback = options?.allowLegacySystemFallback ?? false;
  const pokeMessages = messages.filter((message) => (
    message.lightInteractionMeta
      ? isScenePokeMessage(message, scene)
      : allowLegacySystemFallback && !!message.isSystem && POKE_SYSTEM_LINE_REGEX.test(getMessageMainText(message))
  ));
  const recentSystemLines = pokeMessages
    .filter((message) => (
      message.lightInteractionMeta?.step === 'system'
      || (allowLegacySystemFallback && !message.lightInteractionMeta && !!message.isSystem)
    ))
    .slice(-systemLineLimit)
    .map((message) => getMessageMainText(message).trim())
    .filter(Boolean);

  const descriptorSeen = new Set<string>();
  const recentDescriptors: string[] = [];
  for (let index = pokeMessages.length - 1; index >= 0; index -= 1) {
    const currentMessage = pokeMessages[index];
    const descriptors = pokeMessages[index]?.lightInteractionMeta?.descriptors || (
      currentMessage?.isSystem
        ? extractFallbackDescriptor(getMessageMainText(currentMessage))
        : []
    );
    for (const descriptor of descriptors) {
      const normalized = descriptor.trim();
      if (!normalized) {
        continue;
      }

      const dedupeKey = normalized.toLowerCase();
      if (descriptorSeen.has(dedupeKey)) {
        continue;
      }

      descriptorSeen.add(dedupeKey);
      recentDescriptors.push(normalized);
      if (recentDescriptors.length >= descriptorLimit) {
        break;
      }
    }

    if (recentDescriptors.length >= descriptorLimit) {
      break;
    }
  }

  const latestPokeMessage = pokeMessages[pokeMessages.length - 1];
  const latestMeta = latestPokeMessage?.lightInteractionMeta;
  const latestTimestamp = latestPokeMessage?.timestamp ?? 0;
  const latestMood = latestMeta?.mood;
  const latestNextActions = latestMeta?.nextActions?.slice(0, 3);
  const latestCounterActionType = latestMeta?.counterActionType;

  let upcomingStreak = 1;
  if (latestTimestamp > 0 && Date.now() - latestTimestamp <= DIRECT_POKE_STREAK_WINDOW_MS) {
    if (latestMeta?.streak) {
      upcomingStreak = Math.max(1, latestMeta.streak + 1);
    } else {
      let streak = 0;
      for (let index = pokeMessages.length - 1; index >= 0; index -= 1) {
        const candidate = pokeMessages[index];
        if (!candidate || latestTimestamp - candidate.timestamp > DIRECT_POKE_STREAK_WINDOW_MS) {
          break;
        }
        if (candidate.isSystem) {
          streak += 1;
        }
      }
      upcomingStreak = Math.max(1, streak + 1);
    }
  }

  return {
    recentSystemLines,
    recentDescriptors,
    latestMood,
    latestNextActions: latestNextActions && latestNextActions.length > 0 ? latestNextActions : undefined,
    latestCounterActionType,
    upcomingStreak,
  };
}

export function isDirectPokeMessage(message: ChatMessage): boolean {
  return isScenePokeMessage(message, 'direct');
}

export function collectRecentDirectPokeState(
  messages: ChatMessage[],
  options?: {
    systemLineLimit?: number;
    descriptorLimit?: number;
  },
): DirectPokeRecentState {
  return collectRecentPokeState(messages, 'direct', {
    ...options,
    allowLegacySystemFallback: true,
  });
}

export function collectRecentGroupPokeState(
  messages: ChatMessage[],
  options?: {
    systemLineLimit?: number;
    descriptorLimit?: number;
  },
): DirectPokeRecentState {
  return collectRecentPokeState(messages, 'group', {
    ...options,
    allowLegacySystemFallback: false,
  });
}
