import type {
  CoupleSpaceInitiativeCandidate,
  CoupleSpaceInitiativeRuntimeRule,
  CoupleSpaceInitiativeRuntimeState,
  CoupleSpaceInitiativeSettings,
  CoupleSpaceInitiativeSource,
} from '../../../../types';
import type { CoupleSpaceInitiativeNormalizedContext } from './coupleSpaceInitiativeSignalCollector';
import { buildCoupleSpaceInitiativeRuntimeState } from './coupleSpaceInitiativeRuleBuilder';
import { canTriggerCoupleSpaceInitiative } from './coupleSpaceTriggerPolicy';

export type CoupleSpaceInitiativeRunnerContext = CoupleSpaceInitiativeNormalizedContext;

export type CoupleSpaceInitiativeCheckResult = {
  checkedAt: number;
  runtimeState: CoupleSpaceInitiativeRuntimeState;
  candidates: CoupleSpaceInitiativeCandidate[];
};

function createEmptyNormalizedContext(): CoupleSpaceInitiativeNormalizedContext {
  return {
    replyOpportunities: {},
  };
}

function withSource(
  defaultSource: CoupleSpaceInitiativeSource,
  context: CoupleSpaceInitiativeNormalizedContext,
): CoupleSpaceInitiativeSource {
  return context.triggerSource === 'manual_check' ? 'manual_check' : defaultSource;
}

function buildCandidate(
  rule: CoupleSpaceInitiativeRuntimeRule,
  source: CoupleSpaceInitiativeSource,
  reason: string,
  evidenceSummary?: string,
): CoupleSpaceInitiativeCandidate {
  return {
    actionType: rule.actionType,
    group: rule.group,
    commitMode: rule.commitMode,
    source,
    reason,
    evidenceSummary,
  };
}

function collectPublishingCandidates(
  runtimeState: CoupleSpaceInitiativeRuntimeState,
  context: CoupleSpaceInitiativeRunnerContext,
  now: number,
): CoupleSpaceInitiativeCandidate[] {
  const publishingOrder: Array<keyof CoupleSpaceInitiativeRuntimeState['rules']> = [
    'post_couple_daily',
    'post_message_board_entry',
    'write_love_letter',
  ];

  return publishingOrder.flatMap((actionType) => {
    const rule = runtimeState.rules[actionType];
    if (!canTriggerCoupleSpaceInitiative(rule, now)) {
      return [];
    }

    return [
      buildCandidate(
        rule,
        withSource('cadence_window', context),
        `Publishing action is enabled and has entered its ${rule.cadence ?? 'configured'} cadence window.`,
        context.recentInteraction?.summary,
      ),
    ];
  });
}

function collectMemoCandidates(
  runtimeState: CoupleSpaceInitiativeRuntimeState,
  context: CoupleSpaceInitiativeRunnerContext,
  now: number,
): CoupleSpaceInitiativeCandidate[] {
  const rule = runtimeState.rules.write_co_note;
  if (!rule.enabled || rule.opportunityLevel === 'off') {
    return [];
  }

  if (!context.memoLightEvidence) {
    return [];
  }

  if (!canTriggerCoupleSpaceInitiative(rule, now)) {
    return [];
  }

  return [
    buildCandidate(
      rule,
      withSource('light_evidence', context),
      `Memo action is enabled and found light evidence under ${rule.opportunityLevel ?? 'configured'} opportunity settings.`,
      context.memoLightEvidence.summary,
    ),
  ];
}

function collectRecordingCandidates(
  runtimeState: CoupleSpaceInitiativeRuntimeState,
  context: CoupleSpaceInitiativeRunnerContext,
  now: number,
): CoupleSpaceInitiativeCandidate[] {
  const rule = runtimeState.rules.create_ledger_entry;
  if (!rule.enabled) {
    return [];
  }

  if (!context.recordingExplicitEvidence) {
    return [];
  }

  if (!canTriggerCoupleSpaceInitiative(rule, now)) {
    return [];
  }

  return [
    buildCandidate(
      rule,
      withSource('explicit_evidence', context),
      'Recording action found explicit evidence and should stay in confirm mode before commit.',
      context.recordingExplicitEvidence.summary,
    ),
  ];
}

function collectInteractionCandidates(
  runtimeState: CoupleSpaceInitiativeRuntimeState,
  context: CoupleSpaceInitiativeRunnerContext,
  now: number,
): CoupleSpaceInitiativeCandidate[] {
  const interactionSpecs: Array<{
    actionType: keyof CoupleSpaceInitiativeRuntimeState['rules'];
    summary?: string;
    source: CoupleSpaceInitiativeSource;
    reason: (rule: CoupleSpaceInitiativeRuntimeRule) => string;
  }> = [
    {
      actionType: 'reply_love_letter',
      summary: context.replyOpportunities.loveLetter?.summary,
      source: 'reply_opportunity',
      reason: (rule) =>
        `Interaction action is enabled and a love-letter reply opportunity is available under ${rule.opportunityLevel ?? 'configured'} opportunity settings.`,
    },
    {
      actionType: 'reply_daily_comment',
      summary: context.replyOpportunities.dailyComment?.summary,
      source: 'reply_opportunity',
      reason: (rule) =>
        `Interaction action is enabled and a daily-comment reply opportunity is available under ${rule.opportunityLevel ?? 'configured'} opportunity settings.`,
    },
    {
      actionType: 'reply_message_board',
      summary: context.replyOpportunities.messageBoard?.summary,
      source: 'reply_opportunity',
      reason: (rule) =>
        `Interaction action is enabled and a message-board reply opportunity is available under ${rule.opportunityLevel ?? 'configured'} opportunity settings.`,
    },
    {
      actionType: 'react_to_existing_post',
      summary: context.postReactionOpportunity?.summary,
      source: 'recent_interaction',
      reason: (rule) =>
        `Interaction action is enabled and recent interaction suggests a post reaction under ${rule.opportunityLevel ?? 'configured'} opportunity settings.`,
    },
  ];

  return interactionSpecs.flatMap(({ actionType, summary, source, reason }) => {
    const rule = runtimeState.rules[actionType];
    if (!rule.enabled || rule.opportunityLevel === 'off' || !summary) {
      return [];
    }

    if (!canTriggerCoupleSpaceInitiative(rule, now)) {
      return [];
    }

    return [buildCandidate(rule, withSource(source, context), reason(rule), summary)];
  });
}

export function collectCoupleSpaceInitiativeCandidates(
  settings: CoupleSpaceInitiativeSettings | null | undefined,
  context: CoupleSpaceInitiativeRunnerContext = createEmptyNormalizedContext(),
  now = Date.now(),
): CoupleSpaceInitiativeCheckResult {
  const runtimeState = buildCoupleSpaceInitiativeRuntimeState(settings);

  const candidates = [
    ...collectPublishingCandidates(runtimeState, context, now),
    ...collectMemoCandidates(runtimeState, context, now),
    ...collectRecordingCandidates(runtimeState, context, now),
    ...collectInteractionCandidates(runtimeState, context, now),
  ];

  return {
    checkedAt: now,
    runtimeState,
    candidates,
  };
}

export function pickNextCoupleSpaceInitiative(
  settings: CoupleSpaceInitiativeSettings | null | undefined,
  context: CoupleSpaceInitiativeRunnerContext = createEmptyNormalizedContext(),
  now = Date.now(),
): CoupleSpaceInitiativeCandidate | null {
  return collectCoupleSpaceInitiativeCandidates(settings, context, now).candidates[0] ?? null;
}
