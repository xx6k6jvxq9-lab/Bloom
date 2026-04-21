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
      return '众生梦：强调外部世界、第三方势力、公共事件、群像结构和夜城流动感。选项更偏站队、追查、介入、试探。';
    case 'threshold':
      return '歧境梦：强调现实轻微失真、熟悉中的异常、错位感与规则偏移。选项偏确认异常、维持表面、靠近真相、进入裂缝。';
    case 'shared':
      return '同梦域：强调双人共同在场、关系拉扯、陪伴、试探与共振。选项偏并肩、靠近、互试、一起进入下一层。';
    case 'rift':
      return '心隙梦：强调进入角色内层、秘密、执念、无法直说的裂缝。选项偏触碰秘密、保留沉默、逼近真意、看见裂口。';
    default:
      return '围绕当前梦域的叙事职责生成，不要写成普通聊天场景。';
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

function buildStoryFrameGuidance(selectedTags: Record<DreamTagCategory, string[]>) {
  const groundedGenres = new Set([
    'modern-romance',
    'healing-life',
    'urban-life',
    'campus-youth',
    'small-town',
    'workplace',
    'food-business',
    'travel-diary',
    'family-daily',
    'marriage-life',
    'broadcast-station',
    'museum-mystery',
    'library-fantasy',
  ]);
  const heightenedGenres = new Set([
    'rules',
    'immortal',
    'stellar-academy',
    'court-power',
    'magic-academy',
    'folk-horror',
    'cyberpunk',
    'ancient-romance',
    'inner-house',
    'jianghu',
    'sect-life',
    'xuanhuan',
    'western-fantasy',
    'fairy-tale-dark',
    'monster-romance',
    'urban-fantasy',
    'spiritual-revival',
    'crime-suspense',
    'closed-mystery',
    'infinite',
    'game-world',
    'apocalypse',
    'safe-house',
    'stellar-drift',
    'steampunk',
    'pirate-port',
    'dragon-kingdom',
    'witch-town',
    'vampire-city',
    'beastman-tribe',
    'spirit-world',
    'underworld-office',
    'time-loop',
    'parallel-world',
    'dream-therapy',
    'body-swap',
    'book-transmigration',
    'rebirth-line',
    'system-mission',
  ]);
  const groundedDrives = new Set([
    'care-for-cat',
    'borrowed-coat',
    'birthday-plan',
    'cook-late-dinner',
    'move-house-together',
    'fix-broken-light',
    'class-duty',
    'club-recruit',
    'sports-partner',
    'graduation-photo',
    'library-wrong-book',
    'exam-eve',
    'overtime-dawn',
    'business-trip',
    'meeting-rescue',
    'project-switch',
    'family-dinner',
    'relative-misunderstands',
    'variety-mission',
    'heart-date-card',
    'stage-pairing',
    'inherited-shop',
    'night-duty',
    'joint-investigation',
    'business-revival',
    'save-closing-store',
    'bring-ta-home',
    'find-missing-song',
    'deliver-final-letter',
  ]);

  const groundedScore =
    (selectedTags.genre ?? []).filter((id) => groundedGenres.has(id)).length
    + (selectedTags.drive ?? []).filter((id) => groundedDrives.has(id)).length;
  const heightenedScore =
    (selectedTags.genre ?? []).filter((id) => heightenedGenres.has(id)).length
    + (selectedTags.faction?.length ?? 0)
    + (selectedTags.camp?.length ?? 0);

  if (groundedScore > 0 && heightenedScore === 0) {
    return 'This is a grounded or daily-life dream. Keep storyFrame lightweight and close to the selected tags. Do not invent extra distorted physics, dream-stability mechanics, public rules, countdown systems, hidden world lore, or grand danger unless a selected tag directly demands them. storyFrame.currentCrisis, forbiddenRule, realityAnchor, and timeNode may be left empty. worldSummary should stay concrete and everyday.';
  }

  return 'Only include storyFrame fields that are truly needed by the selected tags and the immediate opening scene. Leave unnecessary fields empty instead of fabricating extra setting.';
}

function buildCustomModeDiscipline(selectedTags: Record<DreamTagCategory, string[]>) {
  const selectedCategories = Object.entries(selectedTags)
    .filter(([, ids]) => ids.length > 0)
    .map(([category]) => category as DreamTagCategory);

  if (selectedCategories.length === 0) {
    return '';
  }

  const selectedList = selectedCategories.join(', ');
  const backgroundSelected = selectedCategories.some((category) => ['world', 'genre', 'climate', 'camp', 'faction'].includes(category));
  const identitySelected = selectedCategories.some((category) => ['identity', 'participants'].includes(category));
  const relationshipSelected = selectedCategories.some((category) => ['tension', 'lead'].includes(category));
  const driveSelected = selectedCategories.some((category) => ['drive', 'interaction', 'intensity'].includes(category));

  const allowedFields = [
    backgroundSelected ? 'worldTitle/worldSummary' : null,
    identitySelected ? 'userDreamIdentity/characterDreamIdentity' : null,
    relationshipSelected ? 'dreamRelationship' : null,
    driveSelected ? 'openingNode/storyObjective/immediateGoal' : null,
  ].filter(Boolean).join(', ');

  return `Custom mode strict boundary: the user selected only these tag categories: ${selectedList}. Do not invent content from any unselected category. Do not auto-add rules, countdowns, forbidden laws, hidden factions, secret identities, supernatural mechanics, memory-sharing systems, dream stability systems, prophecy, trials, or extra lore unless the selected tags explicitly require them. This applies to scene, acts, choices, progression, endingInput, aftermathInput, and storyFrame. In storyFrame, only fill fields that belong to the selected categories. Allowed storyFrame fields for this request: ${allowedFields || 'none'}. All other storyFrame fields must be empty strings. The scene must stay inside the user's selected world/relationship/event instead of explaining why the dream world works.`;
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
    storyFrameGuidance: buildStoryFrameGuidance(resolvedSelection.selectedTags),
    customModeDiscipline:
      resolvedSelection.entryMode === 'custom'
        ? buildCustomModeDiscipline(resolvedSelection.selectedTags)
        : '',
    characterContext,
    memoryLayers,
    tagCategoryContext,
    worldBookPrompt: characterContext.worldBookPrompt || '未提供',
    maskPrompt: characterContext.maskPrompt || '未提供',
  };
}
