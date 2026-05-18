import type { Character, ChatGroup, MomentComment, MomentItem } from '../../types';
import { applyBidirectionalPublicThreadPeerHint } from './publicThreadPeerHintMutations';
import { getCharacterPublicThreadProfile } from './publicThreadPolicy';

type PairInteractionKind = 'top_level_comment' | 'direct_reply';

type PairInteraction = {
  leftCharacterId: string;
  rightCharacterId: string;
  kind: PairInteractionKind;
};

function createPairKey(leftCharacterId: string, rightCharacterId: string) {
  return [leftCharacterId, rightCharacterId].sort().join('::');
}

function getPairInteractionCandidates(moment: MomentItem, comment: MomentComment): PairInteraction[] {
  if (comment.authorId === 'user') {
    return [];
  }

  const pairs: PairInteraction[] = [];

  if (!comment.replyToAuthorId && moment.authorId !== 'user' && comment.authorId !== moment.authorId) {
    pairs.push({
      leftCharacterId: moment.authorId,
      rightCharacterId: comment.authorId,
      kind: 'top_level_comment',
    });
  }

  if (
    comment.replyToAuthorId
    && comment.replyToAuthorId !== 'user'
    && comment.replyToAuthorId !== comment.authorId
  ) {
    pairs.push({
      leftCharacterId: comment.authorId,
      rightCharacterId: comment.replyToAuthorId,
      kind: 'direct_reply',
    });
  }

  const deduped = new Map<string, PairInteraction>();
  for (const pair of pairs) {
    deduped.set(createPairKey(pair.leftCharacterId, pair.rightCharacterId), pair);
  }
  return Array.from(deduped.values());
}

function getPairStats(moment: MomentItem, leftCharacterId: string, rightCharacterId: string) {
  const pairAuthorIds = new Set([leftCharacterId, rightCharacterId]);
  const pairComments = (moment.comments || []).filter((comment) => pairAuthorIds.has(comment.authorId));
  const distinctAuthors = new Set(pairComments.map((comment) => comment.authorId)).size;
  const directReplyCount = pairComments.filter((comment) => (
    typeof comment.replyToAuthorId === 'string'
    && pairAuthorIds.has(comment.replyToAuthorId)
    && comment.replyToAuthorId !== comment.authorId
  )).length;

  return {
    pairCommentCount: pairComments.length,
    distinctAuthors,
    directReplyCount,
  };
}

function hasManualPeerHint(left: Character, right: Character) {
  const leftHint = left.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === right.id) || null;
  const rightHint = right.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === left.id) || null;
  return [leftHint, rightHint].some((hint) => hint && hint.source !== 'moment_growth');
}

function resolveNextFamiliarity(params: {
  currentFamiliarity: 'stranger' | 'aware' | 'familiar';
  stats: ReturnType<typeof getPairStats>;
  kind: PairInteractionKind;
}) {
  const { currentFamiliarity, stats, kind } = params;
  if (currentFamiliarity === 'familiar') {
    return null;
  }

  if (currentFamiliarity === 'aware') {
    if (stats.directReplyCount >= 1 || stats.pairCommentCount >= 3) {
      return 'familiar' as const;
    }
    return null;
  }

  if (stats.directReplyCount >= 2 || (kind === 'direct_reply' && stats.pairCommentCount >= 3 && stats.distinctAuthors >= 2)) {
    return 'familiar' as const;
  }

  if (kind === 'top_level_comment' || kind === 'direct_reply') {
    return 'aware' as const;
  }

  return null;
}

function resolveMomentGrowthPatch(params: {
  currentProfile: ReturnType<typeof getCharacterPublicThreadProfile>;
  stats: ReturnType<typeof getPairStats>;
  kind: PairInteractionKind;
  nextFamiliarity: 'stranger' | 'aware' | 'familiar' | null;
}) {
  const { currentProfile, stats, kind, nextFamiliarity } = params;
  const targetFamiliarity = nextFamiliarity || currentProfile.familiarity;
  const patch: Parameters<typeof applyBidirectionalPublicThreadPeerHint>[3] = {
    familiarity: targetFamiliarity,
  };

  const canUnlockLightBanter = (
    targetFamiliarity === 'familiar'
    && (stats.directReplyCount >= 1 || kind === 'direct_reply')
  );

  if (canUnlockLightBanter) {
    if (!currentProfile.allowBanter) {
      patch.allowBanter = true;
    }
    if (currentProfile.interactionStyle !== 'banter') {
      patch.interactionStyle = 'banter';
    }
  }

  const changed = (
    patch.familiarity !== currentProfile.familiarity
    || patch.allowBanter !== undefined
    || patch.interactionStyle !== undefined
  );

  return changed ? patch : null;
}

export function applyMomentInteractionGrowth(params: {
  characters: Character[];
  moment: MomentItem;
  newComment: MomentComment;
  chatGroups?: ChatGroup[];
}) {
  const { characters, moment, newComment, chatGroups = [] } = params;
  const pairInteractions = getPairInteractionCandidates(moment, newComment);
  if (pairInteractions.length === 0) {
    return characters;
  }

  let nextCharacters = characters;

  for (const pairInteraction of pairInteractions) {
    const left = nextCharacters.find((character) => character.id === pairInteraction.leftCharacterId) || null;
    const right = nextCharacters.find((character) => character.id === pairInteraction.rightCharacterId) || null;
    if (!left || !right) {
      continue;
    }

    if (hasManualPeerHint(left, right)) {
      continue;
    }

    const currentProfile = getCharacterPublicThreadProfile(left, right, chatGroups);
    const stats = getPairStats(moment, left.id, right.id);
    const nextFamiliarity = resolveNextFamiliarity({
      currentFamiliarity: currentProfile.familiarity,
      stats,
      kind: pairInteraction.kind,
    });

    const growthPatch = resolveMomentGrowthPatch({
      currentProfile,
      stats,
      kind: pairInteraction.kind,
      nextFamiliarity,
    });

    if (!growthPatch) {
      continue;
    }

    nextCharacters = applyBidirectionalPublicThreadPeerHint(
      nextCharacters,
      left.id,
      right.id,
      {
        ...growthPatch,
        source: 'moment_growth',
      },
    );
  }

  return nextCharacters;
}
