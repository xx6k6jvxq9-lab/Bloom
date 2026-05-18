import type {
  Character,
  ChatGroup,
  CollectedGroupOfflineSessionRecord,
  GroupOfflineSession,
} from '../../types';
import { sanitizeGroupOfflineSession } from './persistenceSanitizers';

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function summarizeText(value: string | null | undefined, maxChars = 96): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized.length > maxChars
    ? `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`
    : normalized;
}

export function isGroupOfflineSessionCollectable(session: Pick<GroupOfflineSession, 'generatedContent'>): boolean {
  const latestRound = (session.generatedContent?.rounds || []).slice(-1)[0];
  const pageType = latestRound?.pageEpisode?.pageType;
  return pageType !== 'custom_html' && pageType !== 'micro_app';
}

function resolveParticipantLabels(session: GroupOfflineSession, members: Character[]): string[] {
  const labels = session.participants
    .map((participant) => members.find((member) => member.id === participant.characterId))
    .filter((member): member is Character => !!member)
    .map((member) => member.remarkName?.trim() || member.name)
    .filter(Boolean);

  if (labels.length > 0) {
    return labels;
  }

  return (session.generatedContent?.card.participantLabels || []).map((label) => normalizeText(label)).filter(Boolean);
}

function resolveSummaryLines(session: GroupOfflineSession): string[] {
  const summaryLines = (session.summaryCard?.lines || [])
    .map((line) => summarizeText(line, 72))
    .filter(Boolean)
    .slice(0, 2);
  if (summaryLines.length > 0) {
    return summaryLines;
  }

  const latestRound = (session.generatedContent?.rounds || []).slice(-1)[0];
  const fallbackLines = [
    latestRound?.sceneText,
    latestRound?.characterEntries?.[0]?.text,
    session.generatedContent?.intro,
  ]
    .map((line) => summarizeText(line, 72))
    .filter(Boolean)
    .slice(0, 2);

  return fallbackLines;
}

export function buildCollectedGroupOfflineSessionRecord(input: {
  session: GroupOfflineSession;
  group: Pick<ChatGroup, 'id' | 'name' | 'groupRemark'>;
  members: Character[];
}): CollectedGroupOfflineSessionRecord {
  const { session, group, members } = input;
  return {
    sessionId: session.id,
    groupId: group.id,
    groupName: normalizeText(group.groupRemark) || group.name,
    title: normalizeText(session.customActivityType) || session.activityType,
    mode: session.mode,
    status: session.status,
    locationLabel: session.location,
    timeLabel: session.timeLabel,
    weatherLabel: normalizeText(session.weatherLabel) || undefined,
    participantLabels: resolveParticipantLabels(session, members),
    objectiveLabel: normalizeText(session.generatedContent?.card.objectiveLabel) || undefined,
    roundLabel: normalizeText(session.generatedContent?.card.roundLabel) || undefined,
    summaryLines: resolveSummaryLines(session),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    endedAt: typeof session.endedAt === 'number' ? session.endedAt : undefined,
    sessionSnapshot: {
      ...session,
      isCollected: true,
    },
  };
}

export function upsertCollectedGroupOfflineSessionRecord(
  records: CollectedGroupOfflineSessionRecord[] | undefined,
  record: CollectedGroupOfflineSessionRecord,
): CollectedGroupOfflineSessionRecord[] {
  const nextRecords = (records || []).filter((item) => item.sessionId !== record.sessionId);
  return [record, ...nextRecords].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function removeCollectedGroupOfflineSessionRecord(
  records: CollectedGroupOfflineSessionRecord[] | undefined,
  sessionId: string,
): CollectedGroupOfflineSessionRecord[] {
  return (records || []).filter((item) => item.sessionId !== sessionId);
}

export function sanitizeCollectedGroupOfflineSessionRecords(
  value: CollectedGroupOfflineSessionRecord[] | undefined,
): CollectedGroupOfflineSessionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const recordBySessionId = new Map<string, CollectedGroupOfflineSessionRecord>();
  value.forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    const sessionId = normalizeText(candidate.sessionId);
    const groupId = normalizeText(candidate.groupId);
    const title = normalizeText(candidate.title);
    if (!sessionId || !groupId || !title) {
      return;
    }

    const normalizedRecord: CollectedGroupOfflineSessionRecord = {
      sessionId,
      groupId,
      groupName: normalizeText(candidate.groupName) || '群聊',
      title,
      mode: candidate.mode === 'scenario' || candidate.mode === 'random' ? candidate.mode : 'daily',
      status: candidate.status === 'ended' ? 'ended' : 'active',
      locationLabel: normalizeText(candidate.locationLabel) || '',
      timeLabel: normalizeText(candidate.timeLabel) || '',
      weatherLabel: normalizeText(candidate.weatherLabel) || undefined,
      participantLabels: Array.isArray(candidate.participantLabels)
        ? candidate.participantLabels.map((label) => normalizeText(label)).filter(Boolean)
        : [],
      objectiveLabel: normalizeText(candidate.objectiveLabel) || undefined,
      roundLabel: normalizeText(candidate.roundLabel) || undefined,
      summaryLines: Array.isArray(candidate.summaryLines)
        ? candidate.summaryLines.map((line) => summarizeText(line, 72)).filter(Boolean).slice(0, 2)
        : [],
      createdAt: typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : Date.now(),
      updatedAt: typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : Date.now(),
      endedAt: typeof candidate.endedAt === 'number' && Number.isFinite(candidate.endedAt)
        ? candidate.endedAt
        : undefined,
      sessionSnapshot: sanitizeGroupOfflineSession(candidate.sessionSnapshot),
    };

    const previous = recordBySessionId.get(sessionId);
    if (!previous || previous.updatedAt <= normalizedRecord.updatedAt) {
      recordBySessionId.set(sessionId, normalizedRecord);
    }
  });

  return Array.from(recordBySessionId.values()).sort((left, right) => right.updatedAt - left.updatedAt);
}
