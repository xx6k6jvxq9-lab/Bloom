import type {
  CoupleSpaceInitiativeCadence,
  CoupleSpaceInitiativeRuntimeRule,
  CoupleSpaceInitiativeSettings,
} from '../../../../types';

function createPublishingActionSettings(
  cadence: CoupleSpaceInitiativeCadence = 'off',
) {
  return {
    enabled: cadence !== 'off',
    cadence,
  };
}

export function createDefaultCoupleSpaceInitiativeSettings(): CoupleSpaceInitiativeSettings {
  return {
    publishing: {
      dailyPost: createPublishingActionSettings('off'),
      loveLetter: createPublishingActionSettings('off'),
      messageBoard: createPublishingActionSettings('off'),
    },
    memo: {
      writeCoNote: {
        enabled: false,
        opportunityLevel: 'low',
        evidenceLevel: 'light',
        defaultCommitMode: 'draft',
      },
    },
    recording: {
      createLedgerEntry: {
        enabled: false,
        evidenceLevel: 'explicit',
        defaultCommitMode: 'confirm',
      },
    },
    interaction: {
      replyLoveLetter: {
        enabled: false,
        opportunityLevel: 'off',
      },
      replyDailyComment: {
        enabled: false,
        opportunityLevel: 'off',
      },
      replyMessageBoard: {
        enabled: false,
        opportunityLevel: 'off',
      },
      reactToExistingPost: {
        enabled: false,
        opportunityLevel: 'off',
      },
    },
  };
}

export function normalizeCoupleSpaceInitiativeSettings(
  settings: Partial<CoupleSpaceInitiativeSettings> | null | undefined,
): CoupleSpaceInitiativeSettings {
  const defaults = createDefaultCoupleSpaceInitiativeSettings();

  return {
    ...defaults,
    ...settings,
    publishing: {
      ...defaults.publishing,
      ...settings?.publishing,
      dailyPost: {
        ...defaults.publishing.dailyPost,
        ...settings?.publishing?.dailyPost,
      },
      loveLetter: {
        ...defaults.publishing.loveLetter,
        ...settings?.publishing?.loveLetter,
      },
      messageBoard: {
        ...defaults.publishing.messageBoard,
        ...settings?.publishing?.messageBoard,
      },
    },
    memo: {
      ...defaults.memo,
      ...settings?.memo,
      writeCoNote: {
        ...defaults.memo.writeCoNote,
        ...settings?.memo?.writeCoNote,
      },
    },
    recording: {
      ...defaults.recording,
      ...settings?.recording,
      createLedgerEntry: {
        ...defaults.recording.createLedgerEntry,
        ...settings?.recording?.createLedgerEntry,
      },
    },
    interaction: {
      ...defaults.interaction,
      ...settings?.interaction,
      replyLoveLetter: {
        ...defaults.interaction.replyLoveLetter,
        ...settings?.interaction?.replyLoveLetter,
      },
      replyDailyComment: {
        ...defaults.interaction.replyDailyComment,
        ...settings?.interaction?.replyDailyComment,
      },
      replyMessageBoard: {
        ...defaults.interaction.replyMessageBoard,
        ...settings?.interaction?.replyMessageBoard,
      },
      reactToExistingPost: {
        ...defaults.interaction.reactToExistingPost,
        ...settings?.interaction?.reactToExistingPost,
      },
    },
  };
}

export function hasEnabledCoupleSpaceInitiatives(
  settings: Partial<CoupleSpaceInitiativeSettings> | null | undefined,
): boolean {
  const normalized = normalizeCoupleSpaceInitiativeSettings(settings);

  return (
    normalized.publishing.dailyPost.enabled ||
    normalized.publishing.loveLetter.enabled ||
    normalized.publishing.messageBoard.enabled ||
    normalized.memo.writeCoNote.enabled ||
    normalized.recording.createLedgerEntry.enabled ||
    normalized.interaction.replyLoveLetter.enabled ||
    normalized.interaction.replyDailyComment.enabled ||
    normalized.interaction.replyMessageBoard.enabled ||
    normalized.interaction.reactToExistingPost.enabled
  );
}

export function canTriggerCoupleSpaceInitiative(
  rule: CoupleSpaceInitiativeRuntimeRule | null | undefined,
  now = Date.now(),
): boolean {
  if (!rule?.enabled) return false;

  if (
    (rule.cadence && rule.cadence === 'off') ||
    (rule.opportunityLevel && rule.opportunityLevel === 'off')
  ) {
    return false;
  }

  if (!rule.cooldownHours || rule.cooldownHours <= 0) {
    return true;
  }

  if (!rule.lastTriggeredAt) {
    return true;
  }

  const cooldownMs = rule.cooldownHours * 60 * 60 * 1000;
  return now - rule.lastTriggeredAt >= cooldownMs;
}

export function getCoupleSpaceInitiativeNextAvailableAt(
  rule: CoupleSpaceInitiativeRuntimeRule | null | undefined,
): number | null {
  if (!rule?.enabled || !rule.lastTriggeredAt || !rule.cooldownHours || rule.cooldownHours <= 0) {
    return null;
  }

  return rule.lastTriggeredAt + rule.cooldownHours * 60 * 60 * 1000;
}
