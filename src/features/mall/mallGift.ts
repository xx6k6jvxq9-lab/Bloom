import type { Character, MallCatalogItem, MallGiftFeedbackSnapshot } from '../../types';

type MallGiftFeedbackInput = {
  item: MallCatalogItem;
  character: Pick<Character, 'id' | 'name' | 'remarkName'>;
  timestamp?: number;
};

function hashText(text: string): number {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function getCharacterDisplayName(character: Pick<Character, 'name' | 'remarkName'>): string {
  return character.remarkName?.trim() || character.name || 'TA';
}

export function supportsMallGift(item: Pick<MallCatalogItem, 'destinationKinds'>): boolean {
  return item.destinationKinds.includes('gift');
}

function buildAcceptedGiftSummary(
  variant: number,
  characterName: string,
  item: MallCatalogItem,
  liked: boolean,
): string {
  if (!liked) {
    return `${characterName} 把「${item.title}」收下了，只是反应没有那么外露，看得出来更偏谨慎。`;
  }

  switch (variant) {
    case 0:
      return `${characterName} 先是愣了一下，最后还是把「${item.title}」接了过去，说这份心意比东西本身更让人记住。`;
    case 1:
      return `${characterName} 嘴上先说了句“你怎么突然买这个”，但还是把「${item.title}」收下了，明显没有打算退回来。`;
    case 2:
      return `${characterName} 接得很直接，说「${item.title}」比想象中更合心意，收下之后会慢慢用起来。`;
    default:
      return `${characterName} 收得有点安静，只低声说「${item.title}」很适合现在的日常，但没有把它推开。`;
  }
}

export function buildMallGiftFeedback(input: MallGiftFeedbackInput): MallGiftFeedbackSnapshot {
  const timestamp = input.timestamp ?? Date.now();
  const characterName = getCharacterDisplayName(input.character);
  const seed = hashText(`${input.character.id}:${input.item.id}:${input.item.category}`);
  const accepted = input.item.sensitivity === 'restricted' ? seed % 3 !== 0 : true;
  const liked = accepted && (
    seed % 5 !== 0
    || !!input.item.isDisplayable
    || !!input.item.isWearable
    || input.item.tags.includes('礼物')
  );
  const willMentionAgain = accepted && (liked
    ? (seed % 2 === 0 || !!input.item.isWearable || !!input.item.isDisplayable)
    : seed % 4 === 0);
  const placeIntoSharedSpace = accepted
    && liked
    && input.item.destinationKinds.includes('shared_space')
    && (!!input.item.isDisplayable || seed % 3 === 0);

  const summary = accepted
    ? buildAcceptedGiftSummary(seed % 4, characterName, input.item, liked)
    : `${characterName} 看了看「${input.item.title}」，最后还是没有收下，只说现在不太适合把这类东西放到你们之间。`;

  const followups = accepted
    ? [
        willMentionAgain ? '这件事后面大概率还会被 TA 再提起。' : '这次更像是安静地把礼物留下来了。',
        placeIntoSharedSpace ? '如果你愿意，后面它也很适合放进共同空间。' : '',
      ].filter(Boolean)
    : [];

  return {
    summary: [summary, ...followups].join(' '),
    accepted,
    liked,
    willMentionAgain,
    placeIntoSharedSpace,
    generatedAt: timestamp,
  };
}
