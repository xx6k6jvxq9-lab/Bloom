export const DATING_BACKGROUND_EVENT = 'dating:background-generation';

export type DatingBackgroundCompletedDetail = {
  kind: 'completed';
  characterId: string;
  characterName: string;
  characterAvatar?: string;
  scenario: string;
};

export function dispatchDatingBackgroundCompleted(detail: DatingBackgroundCompletedDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DatingBackgroundCompletedDetail>(DATING_BACKGROUND_EVENT, { detail }));
}
