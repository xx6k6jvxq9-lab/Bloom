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
      return '众生梦：只表示叙事镜头更关注外部场域、旁人存在和公共空间里的关系变化。它不自带夜城、第三方势力、规则、追查或危险设定；具体世界必须由用户选择的标签决定。';
    case 'threshold':
      return '歧境梦：强调现实轻微失真、熟悉中的异常、错位感与规则偏移。选项偏确认异常、维持表面、靠近真相、进入裂缝。';
    case 'shared':
      return '同梦域：只表示叙事镜头更关注两个人共同在场、一起经历、一起反应和关系互相牵动。它不自带共振机制、梦境规则或下一层设定；具体世界必须由用户选择的标签决定。';
    case 'rift':
      return '心隙梦：只表示叙事镜头更关注角色心里没说出口的情绪、偏爱、犹豫和真实反应。它不自带裂缝、创伤、执念或危险设定；具体世界必须由用户选择的标签决定。';
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

function resolveVariationTone(selectedTags: Record<DreamTagCategory, string[]>) {
  const groundedTags = new Set([
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
    'variety-show',
    'dating-show',
    'broadcast-station',
    'landlord-tenant',
    'shop-owner-regular',
    'neighbors-upstairs',
    'temporary-roommates',
    'roommates',
    'same-desk',
    'club-partners',
    'project-teammates',
    'caregiver',
  ]);
  const heightenedTags = new Set([
    'rules',
    'folk-horror',
    'crime-suspense',
    'closed-mystery',
    'infinite',
    'game-world',
    'apocalypse',
    'time-loop',
    'parallel-world',
    'system-mission',
    'seven-rules',
    'one-night-countdown',
    'forced-live-stream',
  ]);
  const selectedIds = Object.values(selectedTags).flat();
  const hasGrounded = selectedIds.some((id) => groundedTags.has(id));
  const hasHeightened = selectedIds.some((id) => heightenedTags.has(id));
  return hasGrounded && !hasHeightened ? 'grounded' : 'heightened';
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
    variationTone: resolveVariationTone(resolvedSelection.selectedTags),
    characterContext,
    memoryLayers,
    tagCategoryContext,
    worldBookPrompt: characterContext.worldBookPrompt || '未提供',
    maskPrompt: characterContext.maskPrompt || '未提供',
  };
}
