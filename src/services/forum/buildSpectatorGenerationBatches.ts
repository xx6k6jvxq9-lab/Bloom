import type { Character, ForumSpectatorSettings, ForumSpectatorTargetCharacter } from '../../types';
import type { ForumThreadType } from '../../features/forum-domain/types';
import { normalizeSpectatorTargetCharacters } from '../../features/forum-domain/spectatorBoard';

type SpectatorGenerationBatch = {
  settings: ForumSpectatorSettings;
  selectedCharacters: Character[];
  count: number;
};

const SINGLE_ROLE_WEIGHTS: Record<ForumSpectatorTargetCharacter['role'], number> = {
  primary: 4,
  secondary: 2,
  equal: 3,
};

function buildSingleCharacterSettings(
  settings: ForumSpectatorSettings,
  character: Character,
  threadTypes: ForumThreadType[],
): ForumSpectatorSettings {
  return {
    ...settings,
    subjectName: character.name,
    objectMode: 'single_character',
    selectedCharacterIds: [character.id],
    targetCharacters: [{ characterId: character.id, role: 'equal' }],
    threadTypes,
  };
}

function distributeCountsByWeight(items: Array<{ id: string; weight: number }>, total: number) {
  if (!items.length || total <= 0) return new Map<string, number>();
  const result = new Map<string, number>();
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  items.forEach((item) => {
    result.set(item.id, Math.max(1, Math.floor((item.weight / totalWeight) * total)));
  });

  let assigned = Array.from(result.values()).reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  while (assigned > total && items.length > 0) {
    const item = items[cursor % items.length];
    const current = result.get(item.id) || 0;
    if (current > 1) {
      result.set(item.id, current - 1);
      assigned -= 1;
    }
    cursor += 1;
    if (cursor > 200) break;
  }

  cursor = 0;
  while (assigned < total && items.length > 0) {
    const item = items[cursor % items.length];
    result.set(item.id, (result.get(item.id) || 0) + 1);
    assigned += 1;
    cursor += 1;
    if (cursor > 200) break;
  }

  return result;
}

export function buildSpectatorGenerationBatches(input: {
  settings: ForumSpectatorSettings;
  selectedCharacters: Character[];
  totalCount: number;
}): SpectatorGenerationBatch[] {
  const { settings, selectedCharacters, totalCount } = input;
  const objectMode = settings.objectMode || 'user_with_characters';

  if (objectMode !== 'single_character' || selectedCharacters.length <= 1) {
    return [{
      settings,
      selectedCharacters,
      count: totalCount,
    }];
  }

  const normalizedTargets = normalizeSpectatorTargetCharacters(settings);
  const targetRoleById = new Map(normalizedTargets.map((target) => [target.characterId, target.role] as const));
  const voteAllowed = !settings.threadTypes?.length || settings.threadTypes.includes('vote');
  const voteBatchCount = voteAllowed && selectedCharacters.length > 1 ? Math.min(2, Math.max(1, totalCount - selectedCharacters.length)) : 0;
  const individualCount = Math.max(1, totalCount - voteBatchCount);
  const nonVoteThreadTypes = (settings.threadTypes || []).filter((threadType) => threadType !== 'vote');

  const weightedCharacters = selectedCharacters.map((character) => ({
    id: character.id,
    weight: SINGLE_ROLE_WEIGHTS[targetRoleById.get(character.id) || 'equal'],
  }));
  const counts = distributeCountsByWeight(weightedCharacters, individualCount);

  const batches: SpectatorGenerationBatch[] = selectedCharacters.map((character) => ({
    settings: buildSingleCharacterSettings(settings, character, nonVoteThreadTypes),
    selectedCharacters: [character],
    count: counts.get(character.id) || 1,
  }));

  if (voteBatchCount > 0) {
    batches.unshift({
      settings: {
        ...settings,
        objectMode: 'user_with_characters',
        threadTypes: ['vote'],
      },
      selectedCharacters,
      count: voteBatchCount,
    });
  }

  return batches.filter((batch) => batch.count > 0);
}
