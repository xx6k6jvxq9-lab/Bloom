import type {
  Character,
  GroupOfflineMemoryWritebackPolicy,
  GroupOfflineRound,
  GroupOfflineRoundCharacterEntry,
  GroupOfflineSession,
} from '../../types';
import { compileSpecialDirective } from '../special-directives/compileSpecialDirective';

export type GroupOfflineParticipantWritebackEvidence = {
  characterId: string;
  latestLongTerm?: string;
  latestShortTerm: string[];
  latestTargetType?: GroupOfflineRoundCharacterEntry['target']['type'];
  latestTargetCharacterId?: string;
  latestTargetLabel?: string;
  latestHighlightText?: string;
  latestEntryText?: string;
  preferredCarryoverText?: string;
};

export type GroupOfflineWritebackPlan = {
  memoryWritebackPolicy: GroupOfflineMemoryWritebackPolicy;
  shouldWriteMemoryBack: boolean;
  isSpecialDirectiveSession: boolean;
  sharedEventSummary?: string;
  participantEvidenceByCharacterId: Record<string, GroupOfflineParticipantWritebackEvidence>;
};

function normalizeText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function summarizeText(value: string | null | undefined, maxChars = 96): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized.length > maxChars
    ? `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`
    : normalized;
}

function getLatestMemoryLine(lines: string[] | undefined): string | undefined {
  if (!Array.isArray(lines) || lines.length === 0) {
    return undefined;
  }

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeText(lines[index]);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function getCharacterRoundEntries(session: GroupOfflineSession, characterId: string) {
  return (session.generatedContent?.rounds || [])
    .map((round) => ({
      round,
      entry: round.characterEntries.find((item) => item.characterId === characterId) || null,
    }))
    .filter((item): item is { round: GroupOfflineRound; entry: GroupOfflineRoundCharacterEntry } => !!item.entry);
}

function buildSharedEventSummary(session: GroupOfflineSession): string | undefined {
  const summaryLines = (session.summaryCard?.lines || [])
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .slice(0, 2);
  if (summaryLines.length > 0) {
    return summaryLines.join(' ');
  }

  const latestRound = (session.generatedContent?.rounds || []).slice(-1)[0];
  const fallback = latestRound?.sceneText || session.generatedContent?.intro || session.scenePrompt;
  return summarizeText(fallback, 120) || undefined;
}

function resolveDirectiveMemoryWritebackPolicy(
  directiveText: string | null | undefined,
): GroupOfflineMemoryWritebackPolicy | undefined {
  return compileSpecialDirective(directiveText?.trim())
    ? 'block'
    : undefined;
}

export function resolveGroupOfflineMemoryWritebackPolicy(
  session: Pick<GroupOfflineSession, 'memoryWritebackPolicy' | 'directorInstruction'>,
): GroupOfflineMemoryWritebackPolicy {
  const directivePolicy = resolveDirectiveMemoryWritebackPolicy(session.directorInstruction);
  if (directivePolicy) {
    return directivePolicy;
  }

  if (session.memoryWritebackPolicy === 'block') {
    return 'block';
  }

  if (session.memoryWritebackPolicy === 'allow') {
    return 'allow';
  }

  return 'allow';
}

export function shouldWriteGroupOfflineMemoryBack(
  session: Pick<GroupOfflineSession, 'memoryWritebackPolicy' | 'directorInstruction'>,
): boolean {
  return resolveGroupOfflineMemoryWritebackPolicy(session) === 'allow';
}

export function buildGroupOfflineParticipantWritebackEvidence(
  session: GroupOfflineSession,
  characterId: string,
): GroupOfflineParticipantWritebackEvidence {
  const entries = getCharacterRoundEntries(session, characterId);
  const latestEntry = entries[entries.length - 1]?.entry;
  const latestShortTerm: string[] = [];
  let latestLongTerm: string | undefined;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const memoryPanel = entries[index]?.entry.memoryPanel;
    const shortTermLine = getLatestMemoryLine(memoryPanel?.shortTerm);
    if (shortTermLine && !latestShortTerm.includes(shortTermLine) && latestShortTerm.length < 3) {
      latestShortTerm.push(shortTermLine);
    }

    if (!latestLongTerm) {
      latestLongTerm = getLatestMemoryLine(memoryPanel?.longTerm);
    }

    if (latestLongTerm && latestShortTerm.length >= 3) {
      break;
    }
  }

  const latestTargetLabel = normalizeText(latestEntry?.target?.label) || undefined;
  const latestTargetCharacterId = normalizeText(latestEntry?.target?.characterId) || undefined;
  const latestTargetType = latestEntry?.target?.type;
  const latestHighlightText = summarizeText(latestEntry?.highlightText, 48) || undefined;
  const latestEntryText = summarizeText(latestEntry?.text, 88) || undefined;
  const preferredCarryoverText = latestLongTerm
    || latestShortTerm[0]
    || latestEntryText;

  return {
    characterId,
    ...(latestLongTerm ? { latestLongTerm } : {}),
    latestShortTerm,
    ...(latestTargetType ? { latestTargetType } : {}),
    ...(latestTargetCharacterId ? { latestTargetCharacterId } : {}),
    ...(latestTargetLabel ? { latestTargetLabel } : {}),
    ...(latestHighlightText ? { latestHighlightText } : {}),
    ...(latestEntryText ? { latestEntryText } : {}),
    ...(preferredCarryoverText ? { preferredCarryoverText } : {}),
  };
}

export function buildGroupOfflineWritebackPlan(
  session: GroupOfflineSession,
  members?: Array<Pick<Character, 'id'>>,
): GroupOfflineWritebackPlan {
  const participantIds = members?.map((member) => member.id)
    || session.participants.map((participant) => participant.characterId);
  const uniqueParticipantIds = Array.from(new Set(
    participantIds.filter((participantId): participantId is string => (
      typeof participantId === 'string' && participantId.trim().length > 0
    )),
  ));
  const memoryWritebackPolicy = resolveGroupOfflineMemoryWritebackPolicy(session);
  const isSpecialDirectiveSession = memoryWritebackPolicy === 'block';

  return {
    memoryWritebackPolicy,
    shouldWriteMemoryBack: memoryWritebackPolicy === 'allow',
    isSpecialDirectiveSession,
    sharedEventSummary: buildSharedEventSummary(session),
    participantEvidenceByCharacterId: Object.fromEntries(
      uniqueParticipantIds.map((characterId) => [
        characterId,
        buildGroupOfflineParticipantWritebackEvidence(session, characterId),
      ]),
    ),
  };
}
