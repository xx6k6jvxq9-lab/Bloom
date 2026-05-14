import type { MomentItem, MomentVisibilityScope } from '../../types';

const MOMENT_VISIBILITY_SCOPE_SET = new Set<MomentVisibilityScope>([
  'contacts',
  'known_network',
  'forum_mirror',
]);

export function isMomentVisibilityScope(value: unknown): value is MomentVisibilityScope {
  return typeof value === 'string' && MOMENT_VISIBILITY_SCOPE_SET.has(value as MomentVisibilityScope);
}

export function getDefaultMomentVisibilityScope(authorId: string): MomentVisibilityScope {
  return authorId === 'user' ? 'contacts' : 'known_network';
}

export function resolveMomentVisibilityScope(
  moment: Pick<MomentItem, 'authorId' | 'visibilityScope'>,
): MomentVisibilityScope {
  return isMomentVisibilityScope(moment.visibilityScope)
    ? moment.visibilityScope
    : getDefaultMomentVisibilityScope(moment.authorId);
}
