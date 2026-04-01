import type { HeartCapsuleCategory, HeartCapsuleDrawSource } from '../../../types';

export type HeartCapsuleRarity = 'common' | 'rare' | 'special';

export type HeartCapsuleBase = {
  id: string;
  name: string;
  category: HeartCapsuleCategory;
  summary: string;
  rarity: HeartCapsuleRarity;
  suggestedDraw: HeartCapsuleDrawSource | 'either';
  vibeTags: string[];
};

export type RelationshipShiftCapsule = HeartCapsuleBase & {
  category: 'relationship_shift';
  relationshipTitle: string;
  relationshipDescription: string;
};

export type AsyncDualRuleCapsule = HeartCapsuleBase & {
  category: 'async_dual_rule';
  userTask: string;
  partnerVisibleTask: string;
  partnerHiddenTask: string;
  roundGoal: string;
  revealText: string;
  scenarioPool: string[];
};

export type TruthVariantCapsule = HeartCapsuleBase & {
  category: 'truth_variant';
  answerRule: string;
  feeling: string;
  questionPool: string[];
};

export type HeartCapsule =
  | RelationshipShiftCapsule
  | AsyncDualRuleCapsule
  | TruthVariantCapsule;
