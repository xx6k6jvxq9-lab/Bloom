import type { Character, GroupOfflineEndingVoice, GroupOfflineSession } from '../../types';
import {
  buildGroupOfflineWritebackPlan,
  type GroupOfflineWritebackPlan,
} from './groupOfflineWritebackPlan';

export type GroupOfflineEndingPayload = {
  summaryLines: string[];
  endingVoices: GroupOfflineEndingVoice[];
};

export type GroupOfflineEndingReactionKind =
  | 'user_followup'
  | 'pair_aftertaste'
  | 'lingering_aftertaste'
  | 'group_aftertaste';

export type GroupOfflineEndingReactionCue = {
  characterId: string;
  characterName: string;
  kind: GroupOfflineEndingReactionKind;
  preferredCarryoverText?: string;
  targetLabel?: string;
  highlightText?: string;
  evidenceSummary: string;
};

export type GroupOfflineEndingReactionPlan = {
  sharedEventSummary?: string;
  summaryLines: string[];
  cues: GroupOfflineEndingReactionCue[];
  isSpecialDirectiveSession: boolean;
};

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function summarizeText(value: string | undefined, max = 48): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized.length > max
    ? `${normalized.slice(0, Math.max(0, max - 3)).trim()}...`
    : normalized;
}

function buildSummaryLines(
  session: GroupOfflineSession,
  writebackPlan: GroupOfflineWritebackPlan,
): string[] {
  const activityLabel = normalizeText(session.customActivityType || session.activityType) || '这场群线下';
  const sharedEventSummary = summarizeText(writebackPlan.sharedEventSummary, 64);
  const locationLine = normalizeText(session.location)
    ? `${activityLabel}先收在${normalizeText(session.location)}。`
    : `${activityLabel}先收在这里。`;

  return [
    locationLine,
    sharedEventSummary,
  ].filter(Boolean);
}

function buildCueEvidenceSummary(parts: Array<string | undefined>): string {
  return parts
    .map((part) => summarizeText(part, 56))
    .filter(Boolean)
    .join('；');
}

function resolveReactionKind(input: {
  latestTargetType?: 'user' | 'character' | 'group' | 'scene';
  latestTargetLabel?: string;
  highlightText?: string;
  preferredCarryoverText?: string;
}): GroupOfflineEndingReactionKind {
  if (input.latestTargetType === 'user') {
    return 'user_followup';
  }
  if (input.latestTargetType === 'character' && input.latestTargetLabel) {
    return 'pair_aftertaste';
  }
  if (input.highlightText || input.preferredCarryoverText) {
    return 'lingering_aftertaste';
  }
  return 'group_aftertaste';
}

export function buildGroupOfflineEndingReactionPlan(
  session: GroupOfflineSession,
  members: Character[],
  options?: {
    writebackPlan?: GroupOfflineWritebackPlan;
  },
): GroupOfflineEndingReactionPlan {
  const writebackPlan = options?.writebackPlan || buildGroupOfflineWritebackPlan(session, members);
  const memberMap = new Map(members.map((member) => [member.id, member]));
  const cues = session.participants
    .map((participant) => {
      const member = memberMap.get(participant.characterId);
      if (!member) {
        return null;
      }

      const evidence = writebackPlan.participantEvidenceByCharacterId[member.id];
      const kind = resolveReactionKind({
        latestTargetType: evidence?.latestTargetType,
        latestTargetLabel: evidence?.latestTargetLabel,
        highlightText: evidence?.latestHighlightText,
        preferredCarryoverText: evidence?.preferredCarryoverText,
      });
      const evidenceSummary = buildCueEvidenceSummary([
        evidence?.preferredCarryoverText,
        evidence?.latestHighlightText ? `刚才那句：${evidence.latestHighlightText}` : undefined,
        evidence?.latestTargetLabel ? `当前还盯着：${evidence.latestTargetLabel}` : undefined,
      ]) || '这场留下的余波还没散。';

      return {
        characterId: member.id,
        characterName: member.remarkName?.trim() || member.name,
        kind,
        ...(evidence?.preferredCarryoverText ? { preferredCarryoverText: evidence.preferredCarryoverText } : {}),
        ...(evidence?.latestTargetLabel ? { targetLabel: evidence.latestTargetLabel } : {}),
        ...(evidence?.latestHighlightText ? { highlightText: evidence.latestHighlightText } : {}),
        evidenceSummary,
      } satisfies GroupOfflineEndingReactionCue;
    })
    .filter((cue): cue is GroupOfflineEndingReactionCue => !!cue);

  return {
    sharedEventSummary: writebackPlan.sharedEventSummary,
    summaryLines: buildSummaryLines(session, writebackPlan),
    cues,
    isSpecialDirectiveSession: writebackPlan.isSpecialDirectiveSession,
  };
}

function buildEndingVoiceText(cue: GroupOfflineEndingReactionCue): string {
  switch (cue.kind) {
    case 'user_followup':
      if (cue.highlightText) {
        return `我回群了。刚才那句“${cue.highlightText}”我还记着，先别让我就这么放掉。`;
      }
      return cue.preferredCarryoverText
        ? '我先回群说一声，刚才那点后话我还没翻篇，先让我记着。'
        : '我先回群说一声，刚才那点后话我还没翻篇。';
    case 'pair_aftertaste':
      if (cue.targetLabel && cue.highlightText) {
        return `@${cue.targetLabel} 刚才那句“${cue.highlightText}”我还记着，你别装已经翻篇了。`;
      }
      return cue.targetLabel
        ? `@${cue.targetLabel} 刚才那点话头先别散，我还挂着。`
        : '刚才那点话头先别散，我还挂着。';
    case 'lingering_aftertaste':
      if (cue.highlightText) {
        return `我回来了。刚才那句“${cue.highlightText}”还在那儿挂着，先别急着压下去。`;
      }
      return cue.preferredCarryoverText
        ? '我回群了。刚才那点余温还没散，先别急着翻篇。'
        : '我回群了。刚才那点余温还没散。';
    case 'group_aftertaste':
    default:
      return cue.preferredCarryoverText
        ? '我先回来了。场子表面散了，但后劲还在。'
        : '我回群了。场子是散了，气还没完全落下去。';
  }
}

export function buildUserAnchoredGroupOfflineEndingVoices(
  session: GroupOfflineSession,
  members: Character[],
): GroupOfflineEndingVoice[] {
  const reactionPlan = buildGroupOfflineEndingReactionPlan(session, members);

  return reactionPlan.cues
    .map((cue) => ({
      characterId: cue.characterId,
      characterName: cue.characterName,
      text: buildEndingVoiceText(cue),
    }))
    .filter((voice) => !!normalizeText(voice.text));
}

export function buildDerivedGroupOfflineEndingPayload(
  session: GroupOfflineSession,
  members: Character[],
): GroupOfflineEndingPayload {
  const reactionPlan = buildGroupOfflineEndingReactionPlan(session, members);
  return {
    summaryLines: reactionPlan.summaryLines,
    endingVoices: reactionPlan.cues.map((cue) => ({
      characterId: cue.characterId,
      characterName: cue.characterName,
      text: buildEndingVoiceText(cue),
    })),
  };
}
