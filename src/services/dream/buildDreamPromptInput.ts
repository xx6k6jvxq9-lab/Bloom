import type { Mask, WorldBookEntry } from '../../types';
import { dreamTagGroups } from '../../components/dream/dreamContent';
import type { DreamTagCategory } from '../../components/dream/types';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { sortWorldBooksByPriority } from '../world-book/worldBookMeta';
import type { GenerateDreamScenarioOptions } from './dreamRuntimeTypes';
import { resolveDreamSelection } from './resolveDreamSelection';

function resolveActiveMask(characterId: string, masks: Mask[]) {
  return masks.find((mask) => mask.isActive && mask.linkedCharacters.includes(characterId)) ?? null;
}

function resolveActiveWorldBooks(characterId: string, worldBooks: WorldBookEntry[], activeIds?: string[]) {
  return sortWorldBooksByPriority(
    worldBooks.filter(
      (entry) =>
        (entry.isActive && (entry.isGlobal || entry.characterIds?.includes(characterId))) ||
        activeIds?.includes(entry.id),
    ),
  );
}

function buildDomainRule(domainId: GenerateDreamScenarioOptions['selection']['domainId']) {
  switch (domainId) {
    case 'crowd':
      return '众生梦：强调外部世界、第三方势力、公共事件感、场面推进和夜城/群像结构。选项应更偏站队、追查、介入、试探。';
    case 'threshold':
      return '歧境梦：强调现实轻微失真、熟悉中的异常、错位感与规则偏移。选项应偏确认异常、维持表面、接近真相、进入裂缝。';
    case 'shared':
      return '同梦域：强调双人共同在场、关系拉扯、陪伴与共振。选项应偏并肩、靠近、试探、一起进入下一层。';
    case 'rift':
      return '心隙梦：强调进入角色内层、黑盒感、秘密、执念和不可说。选项应偏碰秘密、保留沉默、逼近真意、看见裂缝。';
    default:
      return '梦域规则：围绕当前梦域的叙事职责生成，不要写成普通聊天场景。';
  }
}

function resolveTagLabels(category: DreamTagCategory, ids: string[]) {
  const group = dreamTagGroups.find((item) => item.category === category);
  if (!group) return [];
  return group.options.filter((option) => ids.includes(option.id)).map((option) => option.label);
}

function buildTagCategoryContext(selectedTags: Record<DreamTagCategory, string[]>) {
  const background = [
    ...resolveTagLabels('world', selectedTags.world ?? []),
    ...resolveTagLabels('genre', selectedTags.genre ?? []),
    ...resolveTagLabels('climate', selectedTags.climate ?? []),
    ...resolveTagLabels('camp', selectedTags.camp ?? []),
    ...resolveTagLabels('faction', selectedTags.faction ?? []),
  ];
  const identities = [
    ...resolveTagLabels('identity', selectedTags.identity ?? []),
    ...resolveTagLabels('participants', selectedTags.participants ?? []),
  ];
  const relationships = [
    ...resolveTagLabels('tension', selectedTags.tension ?? []),
    ...resolveTagLabels('lead', selectedTags.lead ?? []),
  ];
  const drives = [
    ...resolveTagLabels('drive', selectedTags.drive ?? []),
    ...resolveTagLabels('interaction', selectedTags.interaction ?? []),
    ...resolveTagLabels('intensity', selectedTags.intensity ?? []),
  ];
  const moods = [
    ...resolveTagLabels('mood', selectedTags.mood ?? []),
    ...resolveTagLabels('ending', selectedTags.ending ?? []),
  ];

  return {
    background,
    identities,
    relationships,
    drives,
    moods,
  };
}

export function buildDreamPromptInput(options: GenerateDreamScenarioOptions) {
  const activeMask = resolveActiveMask(options.character.id, options.masks);
  const activeWorldBooks = resolveActiveWorldBooks(options.character.id, options.worldBooks, options.character.activeWorldBookIds);
  const characterContext = buildCharacterContext({
    character: options.character,
    activeMask,
    activeWorldBooks,
  });
  const memoryLayers = buildResolvedMemoryLayers(options.character);
  const resolvedSelection = resolveDreamSelection(
    options.selection,
    `${options.character.id}-${options.selection.domainId}-${options.selection.depth}-${options.selection.entryMode}`,
  );
  const tagCategoryContext = buildTagCategoryContext(resolvedSelection.selectedTags);

  return {
    resolvedSelection,
    domainRule: buildDomainRule(resolvedSelection.domainId),
    characterContext,
    memoryLayers,
    tagCategoryContext,
    worldBookPrompt: characterContext.worldBookPrompt || '未提供',
    maskPrompt: characterContext.maskPrompt || '未提供',
  };
}
