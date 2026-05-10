import type {
  Character,
  CharacterPublicThreadPeerHint,
  ChatGroup,
  ChatMessage,
  MomentItem,
} from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';

export type PublicThreadRelationLevel = 'stranger' | 'aware' | 'familiar' | 'sensitive';
export type PublicThreadFamiliarity = 'stranger' | 'aware' | 'familiar';
export type PublicThreadUserOverlap = 'none' | 'shared_attention' | 'shared_claim';

export type PublicThreadRelationProfile = {
  familiarity: PublicThreadFamiliarity;
  userOverlap: PublicThreadUserOverlap;
  hasSharedGroup: boolean;
  hasDirectReplyHistory: boolean;
  sharedGroupStage?: ChatGroup['groupStage'];
  interactionStyle: 'guarded' | 'neutral' | 'banter' | 'warm';
  allowBanter: boolean;
  allowIntimateTone: boolean;
  allowOwnershipTone: boolean;
  note?: string;
  source: 'explicit' | 'inferred';
};

const USER_DIRECTED_MOMENT_REGEX = /你|你别|你又|给你|回来|回家|睡觉|顶嘴|记得|别到时候|别熬|听见没|少吃|多喝|先去|别闹|喊我|陪我|某人|下课|不想分开|带走|领走|拐走|变小|揣进怀里/i;
const ROMANTIC_SIGNAL_REGEX = /想|陪|等你|梦里|惦记|想你|回来|看得到|不想分开|抱走|带走|领走|拐走|揣进怀里|变小/i;
const INTIMATE_USER_SHADOW_REGEX = /某人|不想分开|带走|领走|拐走|抱走|揣进怀里|变小|收到人了|乖乖等着|归我|我来收|我带回去/i;

const RELATION_PATTERNS = {
  romantic: [/男朋友/i, /女朋友/i, /恋人/i, /伴侣/i, /老婆/i, /老公/i, /未婚夫/i, /未婚妻/i, /对象/i],
  family: [/家人/i, /亲人/i, /姐姐/i, /妹妹/i, /哥哥/i, /弟弟/i, /妈妈/i, /爸爸/i, /母亲/i, /父亲/i],
  protective: [/护着你/i, /照顾你/i, /守着你/i, /保护你/i, /偏心/i, /管你/i],
  close: [/喜欢你/i, /青梅/i, /竹马/i, /发小/i, /宝贝/i, /朋友/i],
};

type GroupRelationSeed = ChatGroup['memberRelationSeeds'] extends Array<infer T> ? T : never;

function getCharacterText(character: Character) {
  const characterContext = buildCharacterContext({ character });
  return [
    characterContext.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
  ]
    .filter(Boolean)
    .join('\n');
}

function getCharacterRelationSignalsToUser(character: Character) {
  const sourceText = getCharacterText(character);
  return {
    romantic: RELATION_PATTERNS.romantic.some((pattern) => pattern.test(sourceText)),
    family: RELATION_PATTERNS.family.some((pattern) => pattern.test(sourceText)),
    protective: RELATION_PATTERNS.protective.some((pattern) => pattern.test(sourceText)),
    close: RELATION_PATTERNS.close.some((pattern) => pattern.test(sourceText)),
  };
}

function getCharacterUserRelationStrength(character: Character) {
  const signals = getCharacterRelationSignalsToUser(character);
  return Object.values(signals).filter(Boolean).length;
}

function getExplicitPeerHint(
  source: Character,
  targetCharacterId: string,
): CharacterPublicThreadPeerHint | null {
  return source.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === targetCharacterId) || null;
}

function mergeExplicitPeerHints(
  leftHint: CharacterPublicThreadPeerHint | null,
  rightHint: CharacterPublicThreadPeerHint | null,
) {
  if (!leftHint && !rightHint) {
    return null;
  }

  const familiarityOrder: Record<CharacterPublicThreadPeerHint['familiarity'], number> = {
    stranger: 0,
    aware: 1,
    familiar: 2,
  };
  const leftFamiliarity = leftHint?.familiarity || 'stranger';
  const rightFamiliarity = rightHint?.familiarity || 'stranger';
  const familiarity = familiarityOrder[leftFamiliarity] <= familiarityOrder[rightFamiliarity]
    ? leftFamiliarity
    : rightFamiliarity;

  const interactionStyleOrder: Record<NonNullable<CharacterPublicThreadPeerHint['interactionStyle']>, number> = {
    guarded: 0,
    neutral: 1,
    banter: 2,
    warm: 3,
  };
  const leftInteractionStyle = leftHint?.interactionStyle;
  const rightInteractionStyle = rightHint?.interactionStyle;
  const interactionStyle = leftInteractionStyle && rightInteractionStyle
    ? (interactionStyleOrder[leftInteractionStyle] <= interactionStyleOrder[rightInteractionStyle]
      ? leftInteractionStyle
      : rightInteractionStyle)
    : leftInteractionStyle
      || rightInteractionStyle
      || (familiarity === 'familiar' ? 'neutral' : 'guarded');

  const mergeBoolean = (
    leftValue: boolean | undefined,
    rightValue: boolean | undefined,
  ) => {
    if (leftValue === false || rightValue === false) return false;
    if (leftValue === true || rightValue === true) return true;
    return undefined;
  };

  return {
    familiarity,
    interactionStyle,
    allowBanter: mergeBoolean(leftHint?.allowBanter, rightHint?.allowBanter),
    allowIntimateTone: mergeBoolean(leftHint?.allowIntimateTone, rightHint?.allowIntimateTone),
    allowOwnershipTone: mergeBoolean(leftHint?.allowOwnershipTone, rightHint?.allowOwnershipTone),
    note: [leftHint?.note, rightHint?.note].filter(Boolean).join('；') || undefined,
  };
}

function getSeedFamiliarityScore(seedValue: 'strangers' | 'aware' | 'familiar') {
  switch (seedValue) {
    case 'familiar':
      return 2;
    case 'aware':
      return 1;
    case 'strangers':
    default:
      return 0;
  }
}

function pickHigherFamiliarity(
  left: PublicThreadFamiliarity,
  right: PublicThreadFamiliarity,
): PublicThreadFamiliarity {
  const order: Record<PublicThreadFamiliarity, number> = {
    stranger: 0,
    aware: 1,
    familiar: 2,
  };
  return order[left] >= order[right] ? left : right;
}

function normalizeAuthorLabel(value: string | undefined) {
  return (value || '').trim().toLowerCase();
}

function hasAuthorAliasMatch(authorLabel: string | undefined, member: Character) {
  const normalizedAuthor = normalizeAuthorLabel(authorLabel);
  if (!normalizedAuthor) {
    return false;
  }

  const aliases = [member.name, member.remarkName]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  return aliases.includes(normalizedAuthor);
}

function deriveHistoryFamiliarity(
  left: Character,
  right: Character,
  history: ChatMessage[] = [],
): { familiarity: PublicThreadFamiliarity; hasDirectReplyHistory: boolean } | null {
  const recentMessages = history
    .filter((message) => !message.isSystem)
    .filter((message) => message.role === 'model' && !!message.senderCharacterId)
    .slice(-36);

  const leftMessages = recentMessages.filter((message) => message.senderCharacterId === left.id);
  const rightMessages = recentMessages.filter((message) => message.senderCharacterId === right.id);
  if (leftMessages.length === 0 || rightMessages.length === 0) {
    return null;
  }

  let alternatingTurns = 0;
  for (let index = 1; index < recentMessages.length; index += 1) {
    const previousSender = recentMessages[index - 1]?.senderCharacterId;
    const currentSender = recentMessages[index]?.senderCharacterId;
    if (
      (previousSender === left.id && currentSender === right.id)
      || (previousSender === right.id && currentSender === left.id)
    ) {
      alternatingTurns += 1;
    }
  }

  const directReplyCount = recentMessages.filter((message) => {
    if (message.senderCharacterId !== left.id && message.senderCharacterId !== right.id) {
      return false;
    }

    const counterpart = message.senderCharacterId === left.id ? right : left;
    return hasAuthorAliasMatch(message.replyTo?.authorLabel, counterpart);
  }).length;

  if (directReplyCount >= 2 || (alternatingTurns >= 2 && leftMessages.length >= 2 && rightMessages.length >= 2)) {
    return {
      familiarity: 'familiar',
      hasDirectReplyHistory: directReplyCount >= 1,
    };
  }

  if (directReplyCount >= 1 || alternatingTurns >= 1 || (leftMessages.length >= 2 && rightMessages.length >= 2)) {
    return {
      familiarity: 'aware',
      hasDirectReplyHistory: directReplyCount >= 1,
    };
  }

  return null;
}

function getSharedGroups(left: Character, right: Character, chatGroups: ChatGroup[] = []) {
  return chatGroups.filter((group) => (
    Array.isArray(group.memberIds)
    && group.memberIds.includes(left.id)
    && group.memberIds.includes(right.id)
  ));
}

function deriveSeedFamiliarity(
  left: Character,
  right: Character,
  chatGroups: ChatGroup[] = [],
): PublicThreadFamiliarity | null {
  const sharedGroups = getSharedGroups(left, right, chatGroups);
  if (sharedGroups.length === 0) {
    return null;
  }

  let strongestScore = 0;
  for (const group of sharedGroups) {
    for (const seed of group.memberRelationSeeds || []) {
      const isPair =
        (seed.sourceMemberId === left.id && seed.targetMemberId === right.id)
        || (seed.sourceMemberId === right.id && seed.targetMemberId === left.id);
      if (!isPair) continue;
      strongestScore = Math.max(strongestScore, getSeedFamiliarityScore(seed.familiarity));
    }
  }

  if (strongestScore >= 2) return 'familiar';
  if (strongestScore >= 1) return 'aware';
  return null;
}

function deriveSharedGroupFallbackFamiliarity(
  left: Character,
  right: Character,
  chatGroups: ChatGroup[] = [],
): { familiarity: PublicThreadFamiliarity; stage?: ChatGroup['groupStage'] } | null {
  const sharedGroups = getSharedGroups(left, right, chatGroups);
  if (sharedGroups.length === 0) {
    return null;
  }

  const hasFamiliarStage = sharedGroups.some((group) => group.groupStage === 'familiar');
  const hasWarmingStage = sharedGroups.some((group) => group.groupStage === 'warming');
  const hasCloseMembers = sharedGroups.some((group) => group.memberRelationshipState === 'close');
  const hasSemiOrMixedMembers = sharedGroups.some((group) => group.memberRelationshipState === 'semi' || group.memberRelationshipState === 'mixed');

  if (hasCloseMembers && hasFamiliarStage) {
    return { familiarity: 'familiar', stage: 'familiar' };
  }
  if (hasFamiliarStage || hasWarmingStage || hasSemiOrMixedMembers) {
    return { familiarity: 'aware', stage: hasFamiliarStage ? 'familiar' : hasWarmingStage ? 'warming' : 'new' };
  }

  return { familiarity: 'stranger', stage: sharedGroups[0]?.groupStage };
}

function deriveUserOverlap(left: Character, right: Character): PublicThreadUserOverlap {
  const leftSignals = getCharacterRelationSignalsToUser(left);
  const rightSignals = getCharacterRelationSignalsToUser(right);

  const leftClaim = leftSignals.romantic || leftSignals.protective;
  const rightClaim = rightSignals.romantic || rightSignals.protective;
  if (leftClaim && rightClaim) {
    return 'shared_claim';
  }

  const leftAttention = leftClaim || leftSignals.close || leftSignals.family;
  const rightAttention = rightClaim || rightSignals.close || rightSignals.family;
  if (leftAttention && rightAttention) {
    return 'shared_attention';
  }

  return 'none';
}

export function getCharacterPublicThreadProfile(
  left: Character,
  right: Character,
  chatGroups: ChatGroup[] = [],
): PublicThreadRelationProfile {
  if (left.id === right.id) {
    return {
      familiarity: 'familiar',
      userOverlap: 'none',
      hasSharedGroup: false,
      hasDirectReplyHistory: false,
      interactionStyle: 'warm',
      allowBanter: true,
      allowIntimateTone: true,
      allowOwnershipTone: true,
      note: undefined,
      source: 'inferred',
    };
  }

  const explicitPairHint = mergeExplicitPeerHints(
    getExplicitPeerHint(left, right.id),
    getExplicitPeerHint(right, left.id),
  );
  const sharedGroups = getSharedGroups(left, right, chatGroups);
  let familiarity: PublicThreadFamiliarity = 'stranger';
  let hasDirectReplyHistory = false;
  let sharedGroupStage: ChatGroup['groupStage'] | undefined;

  if (explicitPairHint) {
    familiarity = explicitPairHint.familiarity;
  }

  if (!explicitPairHint) {
    const seededFamiliarity = deriveSeedFamiliarity(left, right, chatGroups);
    if (seededFamiliarity) {
      familiarity = pickHigherFamiliarity(familiarity, seededFamiliarity);
    }

    for (const group of sharedGroups) {
      const historyDerived = deriveHistoryFamiliarity(left, right, group.history || []);
      if (historyDerived) {
        familiarity = pickHigherFamiliarity(familiarity, historyDerived.familiarity);
        hasDirectReplyHistory = hasDirectReplyHistory || historyDerived.hasDirectReplyHistory;
      }
    }

    const fallbackFamiliarity = deriveSharedGroupFallbackFamiliarity(left, right, chatGroups);
    if (fallbackFamiliarity) {
      familiarity = pickHigherFamiliarity(familiarity, fallbackFamiliarity.familiarity);
      sharedGroupStage = fallbackFamiliarity.stage;
    }
  } else {
    for (const group of sharedGroups) {
      const historyDerived = deriveHistoryFamiliarity(left, right, group.history || []);
      if (historyDerived) {
        hasDirectReplyHistory = hasDirectReplyHistory || historyDerived.hasDirectReplyHistory;
      }
      if (!sharedGroupStage && (group.groupStage === 'familiar' || group.groupStage === 'warming')) {
        sharedGroupStage = group.groupStage;
      }
    }
  }

  return {
    familiarity,
    userOverlap: deriveUserOverlap(left, right),
    hasSharedGroup: sharedGroups.length > 0,
    hasDirectReplyHistory,
    sharedGroupStage,
    interactionStyle: explicitPairHint?.interactionStyle || (
      familiarity === 'familiar'
        ? hasDirectReplyHistory
          ? 'banter'
          : 'neutral'
        : familiarity === 'aware'
          ? 'neutral'
          : 'guarded'
    ),
    allowBanter: explicitPairHint?.allowBanter ?? (familiarity === 'familiar' && hasDirectReplyHistory),
    allowIntimateTone: explicitPairHint?.allowIntimateTone ?? false,
    allowOwnershipTone: explicitPairHint?.allowOwnershipTone ?? false,
    note: explicitPairHint?.note,
    source: explicitPairHint ? 'explicit' : 'inferred',
  };
}

export function inferCharacterPublicThreadRelation(
  left: Character,
  right: Character,
  chatGroups: ChatGroup[] = [],
): PublicThreadRelationLevel {
  const profile = getCharacterPublicThreadProfile(left, right, chatGroups);

  if (profile.familiarity === 'familiar' && profile.userOverlap === 'shared_claim') {
    return 'sensitive';
  }
  if (profile.familiarity === 'familiar') {
    return 'familiar';
  }
  if (profile.familiarity === 'aware') {
    return 'aware';
  }
  return 'stranger';
}

export function isLikelyUserDirectedMoment(options: {
  momentContent: string;
  author: Character | null;
}) {
  const { momentContent, author } = options;
  const text = momentContent.trim();
  if (!text || !author) {
    return false;
  }

  const relationStrength = getCharacterUserRelationStrength(author);
  if (relationStrength <= 0) {
    return false;
  }

  return USER_DIRECTED_MOMENT_REGEX.test(text)
    || (relationStrength >= 1 && ROMANTIC_SIGNAL_REGEX.test(text));
}

export function isIntimateUserShadowMoment(options: {
  momentContent: string;
  author: Character | null;
}) {
  const { momentContent, author } = options;
  const text = momentContent.trim();
  if (!text || !author) {
    return false;
  }

  const relationStrength = getCharacterUserRelationStrength(author);
  if (relationStrength <= 0) {
    return false;
  }

  return INTIMATE_USER_SHADOW_REGEX.test(text)
    || (ROMANTIC_SIGNAL_REGEX.test(text) && /某人|不想分开|带走|领走|拐走|下课|变小|揣进怀里/i.test(text));
}

export function shouldSuppressAutoCommentsForMoment(
  moment: MomentItem,
  characters: Character[],
  _chatGroups: ChatGroup[] = [],
) {
  if (moment.authorId === 'user') {
    return false;
  }

  const author = characters.find((character) => character.id === moment.authorId) || null;
  if (!author) {
    return false;
  }

  return isIntimateUserShadowMoment({
    momentContent: moment.content,
    author,
  });
}

export function hasOwnershipClaimRisk(text: string) {
  return /领走|带走|抱走|拐走|收到人了|乖乖等着|我的人|归我|我来收|我带回去|会领走|锁走/i.test(text);
}
