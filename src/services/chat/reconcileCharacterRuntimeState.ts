import type {
  Character,
  CharacterOpenLoopEntry,
  CharacterOpenLoopStatus,
  CharacterPresenceState,
  ChatMessage,
} from '../../types';
import { getMessageMainText } from '../../utils';
import { buildRuntimeOpenLoopRegistry } from './buildOpenLoopRegistry';
import { buildResolvedOpenLoopRegistry } from '../memory/buildResolvedOpenLoopRegistry';

type ContinuityMode = 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';

type ReconcileCharacterRuntimeStateInput = {
  character: Pick<Character, 'id' | 'openLoopRegistry' | 'presenceState' | 'shortTermSummary'>;
  history: ChatMessage[];
  continuityMode: ContinuityMode;
  nowTimestamp: number;
  shortTermSummary?: string;
  latestUserText?: string;
  latestAssistantText?: string;
};

const SOFT_CLOSE_MARKERS = /(没事了|算了|先这样|就这样吧|晚点再说|下次再说|回头再说|说开了|好了|行了|解决了|忙完了|已经到了|已经进来了|已经吃上了)/;
const SCENE_LOOP_MARKERS = /(门口|楼下|车里|路上|电梯里|刚到|马上到|快到了|过来|过去|来找|端着|腾不开手|刚煮|煮了粉|站在|坐在|等在|还在)/;
const RELATIONSHIP_LOOP_MARKERS = /(和好|别扭|冷战|吵架|误会|吃醋|心软|想你|想见|喜欢|暧昧|关系|靠近|疏远|不高兴|委屈|生气|没说开|没聊开)/;
const TASK_LOOP_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完)/;
const TOPIC_LOOP_MARKERS = /(薯条|梗|笑死|又来了|老样子|经典|还是那个|你又提|每次都|又开始了|这回合|老梗|惯例)/;

function normalizeText(text: string | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeKey(kind: CharacterOpenLoopEntry['kind'], content: string): string {
  return `${kind}:${normalizeText(content).slice(0, 48)}`;
}

function resolveSceneLoopStatusByAge(ageMinutes: number, continuityMode: ContinuityMode): CharacterOpenLoopStatus {
  if (continuityMode === 'continuous_scene' && ageMinutes <= 45) {
    return 'active';
  }
  if (ageMinutes <= 12 * 60) {
    return 'waiting_user';
  }
  if (ageMinutes <= 3 * 24 * 60) {
    return 'dormant';
  }
  return 'resolved';
}

function resolveRelationshipLoopStatusByAge(ageMinutes: number): CharacterOpenLoopStatus {
  if (ageMinutes <= 6 * 60) {
    return 'active';
  }
  if (ageMinutes <= 3 * 24 * 60) {
    return 'waiting_user';
  }
  if (ageMinutes <= 14 * 24 * 60) {
    return 'dormant';
  }
  return 'resolved';
}

function resolveTaskLoopStatusByAge(ageMinutes: number): CharacterOpenLoopStatus {
  if (ageMinutes <= 2 * 60) {
    return 'active';
  }
  if (ageMinutes <= 7 * 24 * 60) {
    return 'waiting_user';
  }
  if (ageMinutes <= 30 * 24 * 60) {
    return 'dormant';
  }
  return 'resolved';
}

function resolveTopicLoopStatusByAge(ageMinutes: number): CharacterOpenLoopStatus {
  if (ageMinutes <= 12 * 60) {
    return 'waiting_user';
  }
  if (ageMinutes <= 3 * 24 * 60) {
    return 'dormant';
  }
  return 'resolved';
}

function resolveStatusByAge(
  entry: Pick<CharacterOpenLoopEntry, 'kind'>,
  ageMinutes: number,
  continuityMode: ContinuityMode,
): CharacterOpenLoopStatus {
  if (entry.kind === 'scene') return resolveSceneLoopStatusByAge(ageMinutes, continuityMode);
  if (entry.kind === 'relationship') return resolveRelationshipLoopStatusByAge(ageMinutes);
  if (entry.kind === 'task') return resolveTaskLoopStatusByAge(ageMinutes);
  if (entry.kind === 'topic') return resolveTopicLoopStatusByAge(ageMinutes);
  if (ageMinutes <= 24 * 60) return 'waiting_user';
  if (ageMinutes <= 7 * 24 * 60) return 'dormant';
  return 'resolved';
}

function deriveAvailability(
  continuityMode: ContinuityMode,
  minutesSinceLastMessage: number | null,
): CharacterPresenceState['availability'] {
  if (continuityMode === 'continuous_scene') return 'live';
  if (continuityMode === 'same_day_resume') return 'recent';
  if (minutesSinceLastMessage !== null && minutesSinceLastMessage <= 24 * 60) return 'returning';
  return 'away';
}

function deriveRecentLifeBeat(
  continuityMode: ContinuityMode,
  minutesSinceLastMessage: number | null,
): string {
  if (continuityMode === 'continuous_scene') {
    return '仍在同一段聊天节奏里。';
  }
  if (continuityMode === 'same_day_resume') {
    return '这段时间回到了自己的节奏，现在重新看见消息。';
  }
  if (minutesSinceLastMessage !== null && minutesSinceLastMessage >= 24 * 60) {
    return '这几天有自己的生活流逝，现在是重新上线。';
  }
  return '刚从自己的生活节奏里回到聊天这边。';
}

function classifyContentKind(content: string): CharacterOpenLoopEntry['kind'] {
  if (SCENE_LOOP_MARKERS.test(content)) return 'scene';
  if (RELATIONSHIP_LOOP_MARKERS.test(content)) return 'relationship';
  if (TASK_LOOP_MARKERS.test(content)) return 'task';
  if (TOPIC_LOOP_MARKERS.test(content)) return 'topic';
  return 'unknown';
}

function contentOverlapScore(left: string, right: string): number {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return 1;
  }

  const tokens = normalizedLeft.split(/[，。！？,.!?\s]+/).filter(Boolean);
  const hits = tokens.filter((token) => token.length >= 2 && normalizedRight.includes(token)).length;
  return hits >= 2 ? 0.8 : hits === 1 ? 0.4 : 0;
}

function shouldReactivateEntry(entry: CharacterOpenLoopEntry, latestUserText: string): boolean {
  if (!latestUserText) {
    return false;
  }
  if (contentOverlapScore(entry.content, latestUserText) >= 0.8) {
    return true;
  }

  if (entry.kind === 'scene' && SCENE_LOOP_MARKERS.test(latestUserText)) {
    return true;
  }
  if (entry.kind === 'relationship' && RELATIONSHIP_LOOP_MARKERS.test(latestUserText)) {
    return true;
  }
  if (entry.kind === 'task' && TASK_LOOP_MARKERS.test(latestUserText)) {
    return true;
  }
  if (entry.kind === 'topic') {
    if (contentOverlapScore(entry.content, latestUserText) >= 0.8) {
      return true;
    }
    if (TOPIC_LOOP_MARKERS.test(latestUserText)) {
      return true;
    }
  }

  return false;
}

function shouldResolveEntry(entry: CharacterOpenLoopEntry, latestAssistantText: string): boolean {
  if (!latestAssistantText) {
    return false;
  }
  if (SOFT_CLOSE_MARKERS.test(latestAssistantText) && contentOverlapScore(entry.content, latestAssistantText) >= 0.4) {
    return true;
  }

  if (entry.kind === 'scene' && /(已经到了|进来了|到家了|吃上了|放下了|忙完了)/.test(latestAssistantText)) {
    return true;
  }
  if (entry.kind === 'relationship' && /(没事了|说开了|和好了|不生气了)/.test(latestAssistantText)) {
    return true;
  }
  if (entry.kind === 'task' && /(已经处理了|办完了|确认了|安排好了)/.test(latestAssistantText)) {
    return true;
  }
  if (entry.kind === 'topic' && /(不提这个了|这个梗先放过|别玩这个了|都过去了|翻篇了)/.test(latestAssistantText)) {
    return true;
  }

  return false;
}

export function reconcileCharacterRuntimeState(
  input: ReconcileCharacterRuntimeStateInput,
): Pick<Character, 'openLoopRegistry' | 'presenceState'> {
  const baseSummary = input.shortTermSummary ?? input.character.shortTermSummary;
  const runtimeRegistry = buildRuntimeOpenLoopRegistry({
    shortTermSummary: baseSummary,
    recentMessages: input.history,
  });
  const latestUserText = normalizeText(input.latestUserText);
  const latestAssistantText = normalizeText(input.latestAssistantText);
  const existingEntries = buildResolvedOpenLoopRegistry(input.character);
  const mergedMap = new Map<string, CharacterOpenLoopEntry>();

  for (const entry of existingEntries) {
    const ageMinutes = Math.max(0, Math.floor((input.nowTimestamp - entry.lastTouchedAt) / 60000));
    let nextStatus = resolveStatusByAge(entry, ageMinutes, input.continuityMode);

    if (shouldReactivateEntry(entry, latestUserText)) {
      nextStatus = entry.kind === 'scene' && input.continuityMode !== 'continuous_scene'
        ? 'waiting_user'
        : entry.kind === 'topic'
          ? 'waiting_user'
        : 'active';
    }

    if (shouldResolveEntry(entry, latestAssistantText)) {
      nextStatus = 'resolved';
    }

    if (nextStatus === 'resolved') {
      continue;
    }

    mergedMap.set(normalizeKey(entry.kind, entry.content), {
      ...entry,
      status: nextStatus,
      lastTouchedAt: shouldReactivateEntry(entry, latestUserText) ? input.nowTimestamp : entry.lastTouchedAt,
      updatedAt: input.nowTimestamp,
    });
  }

  for (const entry of runtimeRegistry) {
    const key = normalizeKey(entry.kind, entry.content);
    const existing = mergedMap.get(key);
    const detectedKind = entry.kind === 'unknown' ? classifyContentKind(entry.content) : entry.kind;
    const status = detectedKind === 'scene' && input.continuityMode !== 'continuous_scene'
      ? (entry.status === 'active' ? 'waiting_user' : entry.status)
      : detectedKind === 'topic'
        ? (entry.status === 'active' ? 'waiting_user' : entry.status)
        : entry.status;

    mergedMap.set(key, {
      id: existing?.id || `open-loop-${input.nowTimestamp}-${mergedMap.size + 1}`,
      kind: detectedKind,
      status,
      content: entry.content,
      source: entry.source,
      createdAt: existing?.createdAt || entry.lastTouchedAt || input.nowTimestamp,
      lastTouchedAt: entry.lastTouchedAt || existing?.lastTouchedAt || input.nowTimestamp,
      updatedAt: input.nowTimestamp,
      resumeHint: entry.resumeHint,
    });
  }

  const openLoopRegistry = [...mergedMap.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 8);

  const latestVisibleMessage = [...input.history]
    .reverse()
    .find((message) => !message.isSystem && (message.text || message.audioUrl || message.imageUrl));
  const minutesSinceLastMessage = latestVisibleMessage
    ? Math.max(0, Math.floor((input.nowTimestamp - latestVisibleMessage.timestamp) / 60000))
    : null;

  const presenceState: CharacterPresenceState = {
    lastSeenAt: input.nowTimestamp,
    availability: deriveAvailability(input.continuityMode, minutesSinceLastMessage),
    recentLifeBeat: deriveRecentLifeBeat(input.continuityMode, minutesSinceLastMessage),
    resumeTone: input.continuityMode === 'continuous_scene'
      ? 'natural_continue'
      : input.continuityMode === 'same_day_resume'
        ? 'soft_return'
        : 'fresh_reentry',
    updatedAt: input.nowTimestamp,
  };

  return {
    openLoopRegistry,
    presenceState,
  };
}
