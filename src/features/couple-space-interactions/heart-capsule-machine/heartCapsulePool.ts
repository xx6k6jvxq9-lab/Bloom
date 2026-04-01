import type { HeartCapsule } from './types';
import { ASYNC_DUAL_RULE_CAPSULES } from './asyncDualRuleCapsules';
import { RELATIONSHIP_SHIFT_CAPSULES } from './relationshipShiftCapsules';
import { TRUTH_VARIANT_CAPSULES } from './truthVariantCapsules';

export const HEART_CAPSULE_POOL: HeartCapsule[] = [
  ...RELATIONSHIP_SHIFT_CAPSULES,
  ...ASYNC_DUAL_RULE_CAPSULES,
  ...TRUTH_VARIANT_CAPSULES,
];
