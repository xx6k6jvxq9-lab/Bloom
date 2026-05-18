import type {
  Character,
  GroupOfflineEndingVoice,
  GroupOfflineRound,
  GroupOfflineRoundCharacterEntry,
  GroupOfflineSession,
} from '../../types';

export type GroupOfflineEndingPayload = {
  summaryLines: string[];
  endingVoices: GroupOfflineEndingVoice[];
};

type EndingInteractionSeed = {
  member: Character;
  round: GroupOfflineRound;
  entry: GroupOfflineRoundCharacterEntry;
  kind: 'user_target' | 'user_mentioned';
};

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDialogueCore(value: string | undefined): string {
  return normalizeText(value).replace(/^[“"'「『]+|[”"'」』]+$/gu, '').trim();
}

function buildCharacterAliases(member: Character): string[] {
  return [member.name, member.remarkName?.trim()]
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function textMentionsMember(text: string | undefined, member: Character): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return buildCharacterAliases(member).some((alias) => alias && normalized.includes(alias));
}

function buildVariantSeed(value: string): number {
  let total = 0;
  for (const [index, char] of Array.from(value).entries()) {
    total += char.charCodeAt(0) * (index + 17);
  }
  return total;
}

function pickVariant(memberId: string, variants: string[]): string {
  if (variants.length === 0) return '';
  return variants[Math.abs(buildVariantSeed(memberId)) % variants.length];
}

function summarizeText(value: string | undefined, max = 48): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function buildSummaryLines(session: GroupOfflineSession): string[] {
  const rounds = session.generatedContent?.rounds || [];
  const latestRound = rounds[rounds.length - 1];
  const activityLabel = session.customActivityType?.trim() || session.activityType;
  const leadSummary = normalizeText(latestRound?.sceneText)
    || normalizeText(session.generatedContent?.intro)
    || normalizeText(session.scenePrompt)
    || `${activityLabel}先收在这里了。`;
  const condensedSummary = summarizeText(leadSummary, 48);

  return [
    `${activityLabel}先收在这里了。`,
    condensedSummary,
  ].filter(Boolean);
}

function findEndingInteractionSeed(
  session: GroupOfflineSession,
  member: Character,
): EndingInteractionSeed | null {
  const rounds = session.generatedContent?.rounds || [];
  let mentionedCandidate: EndingInteractionSeed | null = null;

  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    const round = rounds[index];
    const entry = round.characterEntries.find((item) => item.characterId === member.id);
    if (!entry) continue;

    if (entry.target?.type === 'user') {
      return {
        member,
        round,
        entry,
        kind: 'user_target',
      };
    }

    if (!mentionedCandidate && textMentionsMember(round.userMessageText, member)) {
      mentionedCandidate = {
        member,
        round,
        entry,
        kind: 'user_mentioned',
      };
    }
  }

  return mentionedCandidate;
}

function buildEndingVoiceText(seed: EndingInteractionSeed): string {
  const quote = summarizeText(normalizeDialogueCore(seed.entry.highlightText), 18);

  if (seed.kind === 'user_target') {
    if (quote) {
      return pickVariant(seed.member.id, [
        `你刚才那句「${quote}」我先记着，回去再跟我说完。`,
        `刚才接到一半那句「${quote}」别就这么算了，回去继续。`,
      ]);
    }

    return pickVariant(seed.member.id, [
      '刚才你没说完的那句，回去继续。',
      '刚才接到一半那句，你回去再跟我说清楚。',
    ]);
  }

  if (quote) {
    return pickVariant(seed.member.id, [
      `刚才我都点到你了，那句「${quote}」你别想带过去。`,
      `既然刚才都点到你了，「${quote}」这句你回去再说完。`,
    ]);
  }

  return pickVariant(seed.member.id, [
    '刚才我都点你了，别装没听见，回去继续。',
    '刚才都叫到你了，这句你回去别躲。',
  ]);
}

export function buildUserAnchoredGroupOfflineEndingVoices(
  session: GroupOfflineSession,
  members: Character[],
): GroupOfflineEndingVoice[] {
  const memberMap = new Map(members.map((member) => [member.id, member]));

  return session.participants
    .map((participant) => memberMap.get(participant.characterId))
    .filter((member): member is Character => !!member)
    .map((member) => {
      const seed = findEndingInteractionSeed(session, member);
      if (!seed) {
        return null;
      }

      return {
        characterId: member.id,
        characterName: member.remarkName?.trim() || member.name,
        text: buildEndingVoiceText(seed),
      } satisfies GroupOfflineEndingVoice;
    })
    .filter((voice): voice is GroupOfflineEndingVoice => !!voice && !!normalizeText(voice.text));
}

export function buildDerivedGroupOfflineEndingPayload(
  session: GroupOfflineSession,
  members: Character[],
): GroupOfflineEndingPayload {
  return {
    summaryLines: buildSummaryLines(session),
    endingVoices: buildUserAnchoredGroupOfflineEndingVoices(session, members),
  };
}
