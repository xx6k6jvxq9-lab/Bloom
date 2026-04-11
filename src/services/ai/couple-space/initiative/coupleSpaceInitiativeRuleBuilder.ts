import type {
  CoupleSpaceCommitMode,
  CoupleSpaceInitiativeActionType,
  CoupleSpaceInitiativeCadence,
  CoupleSpaceInitiativeGroup,
  CoupleSpaceInitiativeRuntimeRecord,
  CoupleSpaceInitiativeRuntimeRule,
  CoupleSpaceInitiativeRuntimeState,
  CoupleSpaceInitiativeSettings,
  CoupleSpaceOpportunityLevel,
} from '../../../../types';
import { normalizeCoupleSpaceInitiativeSettings } from './coupleSpaceTriggerPolicy';

function cadenceToCooldownHours(cadence: CoupleSpaceInitiativeCadence): number | undefined {
  switch (cadence) {
    case 'high':
      return 12;
    case 'medium':
      return 24;
    case 'low':
      return 72;
    default:
      return undefined;
  }
}

function opportunityToCooldownHours(level: CoupleSpaceOpportunityLevel): number | undefined {
  switch (level) {
    case 'high':
      return 6;
    case 'medium':
      return 12;
    case 'low':
      return 24;
    default:
      return undefined;
  }
}

function createRule(
  actionType: CoupleSpaceInitiativeActionType,
  group: CoupleSpaceInitiativeGroup,
  config: {
    enabled: boolean;
    commitMode: CoupleSpaceCommitMode;
    cadence?: CoupleSpaceInitiativeCadence;
    opportunityLevel?: CoupleSpaceOpportunityLevel;
    evidenceLevel: 'none' | 'light' | 'explicit';
  },
  runtimeRecord?: CoupleSpaceInitiativeRuntimeRecord | null,
): CoupleSpaceInitiativeRuntimeRule {
  return {
    actionType,
    group,
    enabled: config.enabled,
    commitMode: config.commitMode,
    evidenceLevel: config.evidenceLevel,
    cadence: config.cadence,
    opportunityLevel: config.opportunityLevel,
    cooldownHours: config.cadence
      ? cadenceToCooldownHours(config.cadence)
      : config.opportunityLevel
        ? opportunityToCooldownHours(config.opportunityLevel)
        : undefined,
    lastTriggeredAt: runtimeRecord?.lastTriggeredAt ?? null,
    lastDraftedAt: runtimeRecord?.lastDraftedAt ?? null,
    lastCommittedAt: runtimeRecord?.lastCommittedAt ?? null,
  };
}

export function buildCoupleSpaceInitiativeRuntimeState(
  settings: CoupleSpaceInitiativeSettings | null | undefined,
  runtimeRecords?: Partial<
    Record<CoupleSpaceInitiativeActionType, CoupleSpaceInitiativeRuntimeRecord>
  > | null,
): CoupleSpaceInitiativeRuntimeState {
  const safeSettings = normalizeCoupleSpaceInitiativeSettings(settings);
  const getRecord = (actionType: CoupleSpaceInitiativeActionType) =>
    runtimeRecords?.[actionType] ?? null;

  return {
    rules: {
      post_couple_daily: createRule('post_couple_daily', 'publishing', {
        enabled: safeSettings.publishing.dailyPost.enabled,
        cadence: safeSettings.publishing.dailyPost.cadence,
        commitMode: 'auto',
        evidenceLevel: 'none',
      }, getRecord('post_couple_daily')),
      write_love_letter: createRule('write_love_letter', 'publishing', {
        enabled: safeSettings.publishing.loveLetter.enabled,
        cadence: safeSettings.publishing.loveLetter.cadence,
        commitMode: 'draft',
        evidenceLevel: 'none',
      }, getRecord('write_love_letter')),
      post_message_board_entry: createRule('post_message_board_entry', 'publishing', {
        enabled: safeSettings.publishing.messageBoard.enabled,
        cadence: safeSettings.publishing.messageBoard.cadence,
        commitMode: 'auto',
        evidenceLevel: 'none',
      }, getRecord('post_message_board_entry')),
      write_co_note: createRule('write_co_note', 'memo', {
        enabled: safeSettings.memo.writeCoNote.enabled,
        opportunityLevel: safeSettings.memo.writeCoNote.opportunityLevel,
        commitMode: safeSettings.memo.writeCoNote.defaultCommitMode,
        evidenceLevel: safeSettings.memo.writeCoNote.evidenceLevel,
      }, getRecord('write_co_note')),
      create_ledger_entry: createRule('create_ledger_entry', 'recording', {
        enabled: safeSettings.recording.createLedgerEntry.enabled,
        commitMode: safeSettings.recording.createLedgerEntry.defaultCommitMode,
        evidenceLevel: safeSettings.recording.createLedgerEntry.evidenceLevel,
      }, getRecord('create_ledger_entry')),
      reply_love_letter: createRule('reply_love_letter', 'interaction', {
        enabled: safeSettings.interaction.replyLoveLetter.enabled,
        opportunityLevel: safeSettings.interaction.replyLoveLetter.opportunityLevel,
        commitMode: 'auto',
        evidenceLevel: 'none',
      }, getRecord('reply_love_letter')),
      reply_daily_comment: createRule('reply_daily_comment', 'interaction', {
        enabled: safeSettings.interaction.replyDailyComment.enabled,
        opportunityLevel: safeSettings.interaction.replyDailyComment.opportunityLevel,
        commitMode: 'auto',
        evidenceLevel: 'none',
      }, getRecord('reply_daily_comment')),
      reply_message_board: createRule('reply_message_board', 'interaction', {
        enabled: safeSettings.interaction.replyMessageBoard.enabled,
        opportunityLevel: safeSettings.interaction.replyMessageBoard.opportunityLevel,
        commitMode: 'auto',
        evidenceLevel: 'none',
      }, getRecord('reply_message_board')),
      react_to_existing_post: createRule('react_to_existing_post', 'interaction', {
        enabled: safeSettings.interaction.reactToExistingPost.enabled,
        opportunityLevel: safeSettings.interaction.reactToExistingPost.opportunityLevel,
        commitMode: 'auto',
        evidenceLevel: 'none',
      }, getRecord('react_to_existing_post')),
    },
  };
}
