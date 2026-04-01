export type CoupleSpaceInitiativeAutoCheckGateState = {
  lastCheckedAt: number | null;
  lastPartnerId: string | null;
};

export type CoupleSpaceInitiativeAutoCheckGateInput = {
  now?: number;
  partnerId?: string | null;
  minIntervalMs?: number;
  previousState?: CoupleSpaceInitiativeAutoCheckGateState | null;
};

export type CoupleSpaceInitiativeAutoCheckGateResult = {
  allowed: boolean;
  reason: string;
  nextState: CoupleSpaceInitiativeAutoCheckGateState;
  nextAllowedAt: number | null;
};

const DEFAULT_AUTO_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Thin gate for product-side auto checks.
 *
 * Purpose:
 * - avoid repeated whole-pipeline auto checks during quick page/view churn
 * - provide one small reusable throttle boundary above the existing initiative rules
 *
 * Non-goals:
 * - not a scheduler
 * - not a candidate selector
 * - not a per-action cooldown replacement
 */
export function evaluateCoupleSpaceInitiativeAutoCheckGate(
  input: CoupleSpaceInitiativeAutoCheckGateInput,
): CoupleSpaceInitiativeAutoCheckGateResult {
  const now = input.now ?? Date.now();
  const partnerId = input.partnerId ?? null;
  const minIntervalMs = input.minIntervalMs ?? DEFAULT_AUTO_CHECK_INTERVAL_MS;
  const previousState = input.previousState ?? {
    lastCheckedAt: null,
    lastPartnerId: null,
  };

  if (!partnerId) {
    return {
      allowed: false,
      reason: 'Auto check is blocked because no active couple-space partner is selected.',
      nextState: previousState,
      nextAllowedAt: null,
    };
  }

  if (!previousState.lastCheckedAt || previousState.lastPartnerId !== partnerId) {
    return {
      allowed: true,
      reason:
        previousState.lastPartnerId !== partnerId && previousState.lastPartnerId
          ? 'Auto check is allowed because the active couple-space partner changed.'
          : 'Auto check is allowed because there is no previous auto-check record yet.',
      nextState: {
        lastCheckedAt: now,
        lastPartnerId: partnerId,
      },
      nextAllowedAt: now + minIntervalMs,
    };
  }

  const elapsed = now - previousState.lastCheckedAt;
  if (elapsed < minIntervalMs) {
    return {
      allowed: false,
      reason: 'Auto check is temporarily gated to avoid repeated runs during a short interval.',
      nextState: previousState,
      nextAllowedAt: previousState.lastCheckedAt + minIntervalMs,
    };
  }

  return {
    allowed: true,
    reason: 'Auto check is allowed because the minimum gate interval has elapsed.',
    nextState: {
      lastCheckedAt: now,
      lastPartnerId: partnerId,
    },
    nextAllowedAt: now + minIntervalMs,
  };
}
