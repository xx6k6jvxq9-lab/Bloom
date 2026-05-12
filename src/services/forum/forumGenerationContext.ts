import type {
  ForumGlobalSettings,
  ForumMaskUsageScope,
  ForumSpectatorSettings,
  ForumWorldBookUsageScope,
  Mask,
  WorldBookEntry,
} from '../../types';
import { normalizeWorldBookCategory, sortWorldBooksByPriority } from '../world-book/worldBookMeta';
import { buildBudgetedWorldBookPrompt } from '../world-book/worldBookBudget';

type ResolveForumGenerationContextInput = {
  globalSettings?: ForumGlobalSettings | null;
  worldBooks?: WorldBookEntry[] | null;
  masks?: Mask[] | null;
  worldBookScope?: ForumWorldBookUsageScope;
  maskScope?: ForumMaskUsageScope;
  spectatorSettings?: ForumSpectatorSettings | null;
  worldBookQuery?: string;
  worldBookRecentText?: string[];
};

type ResolvedForumGenerationContext = {
  activeWorldBooks: WorldBookEntry[];
  activeMasks: Mask[];
  worldBookPromptBlock: string;
  maskPromptBlock: string;
};

function filterActiveWorldBooks(worldBooks: WorldBookEntry[]) {
  return worldBooks.filter((item) => item && item.isActive && item.content?.trim());
}

function resolveScopedWorldBooks(
  worldBooks: WorldBookEntry[],
  settings: ForumGlobalSettings | null | undefined,
  scope?: ForumWorldBookUsageScope,
) {
  if (!settings?.worldBook?.enabled) return [] as WorldBookEntry[];
  if (scope && !settings.worldBook.scopes[scope]) return [] as WorldBookEntry[];

  const activeWorldBooks = filterActiveWorldBooks(worldBooks);
  const selectedIds = new Set(settings.worldBook.selectedIds || []);
  const selectedCategories = new Set((settings.worldBook.selectedCategories || []).map(normalizeWorldBookCategory));
  const hasIdFilter = selectedIds.size > 0;
  const hasCategoryFilter = selectedCategories.size > 0;

  const filtered = activeWorldBooks.filter((item) => {
    if (!hasIdFilter && !hasCategoryFilter) return true;
    if (hasIdFilter && selectedIds.has(item.id)) return true;
    if (hasCategoryFilter && selectedCategories.has(normalizeWorldBookCategory(item.category))) return true;
    return false;
  });

  const strength = settings.worldBook.strength || 'light';
  const limit = strength === 'strong' ? 6 : strength === 'medium' ? 4 : 2;
  return sortWorldBooksByPriority(filtered).slice(0, limit);
}

function resolveScopedMasks(
  masks: Mask[],
  settings: ForumGlobalSettings | null | undefined,
  scope?: ForumMaskUsageScope,
  spectatorSettings?: ForumSpectatorSettings | null,
) {
  if (!settings?.mask?.enabled) return [] as Mask[];
  if (scope && !settings.mask.scopes[scope]) return [] as Mask[];

  const preferredMaskId = spectatorSettings?.userSlot?.mode === 'mask'
    ? spectatorSettings.userSlot.maskId
    : undefined;
  const selectedIds = new Set(settings.mask.selectedIds || []);
  const activeMasks = masks.filter((item) => item && item.name?.trim());

  if (preferredMaskId) {
    const preferred = activeMasks.find((item) => item.id === preferredMaskId);
    if (preferred) {
      const globallyAllowed = settings.mask.useActiveMaskOnly
        ? preferred.isActive
        : selectedIds.size === 0 || selectedIds.has(preferred.id);
      if (globallyAllowed) {
        return [preferred];
      }
    }
  }

  if (settings.mask.useActiveMaskOnly) {
    return activeMasks.filter((item) => item.isActive).slice(0, 2);
  }

  const explicitlySelected = selectedIds.size > 0
    ? activeMasks.filter((item) => selectedIds.has(item.id))
    : activeMasks;
  return explicitlySelected.slice(0, 2);
}

function buildWorldBookPromptBlock(
  worldBooks: WorldBookEntry[],
  query?: string,
  recentText?: string[],
) {
  const prompt = buildBudgetedWorldBookPrompt(worldBooks, 'group', {
    query,
    recentText,
  });

  if (!prompt) return '';

  return [
    '## 论坛世界书上下文',
    '以下是这条论坛生成链路允许读取的世界书内容。它们用于补充长期稳定设定、规则、关系和语境，只能自然融进帖子、回帖或楼层互动，不要写成说明书。',
    prompt,
  ].join('\n');
}

function buildMaskPromptBlock(
  masks: Mask[],
  spectatorSettings?: ForumSpectatorSettings | null,
) {
  if (!masks.length) return '';

  const lines = [
    '## 用户身份面具上下文',
    '以下面具信息只影响“论坛里的人会怎么理解用户、怎么误读用户、怎么给用户贴印象”，不能改写角色本体。',
  ];

  if (spectatorSettings?.userSlot?.mode === 'mask') {
    lines.push('本次镜间/围观链路明确要求按面具身份理解用户。');
  }

  masks.forEach((mask, index) => {
    lines.push(
      `${index + 1}. ${mask.name}｜性格=${mask.personality || '未写'}｜职业=${mask.occupation || '未写'}｜关系感=${mask.relationship || '未写'}｜世界背景=${mask.worldBackground || '未写'}`,
    );
  });

  lines.push('如果这条链路需要讨论用户，请优先体现这些外显身份滤镜对围观语气的影响。');
  return lines.join('\n');
}

export function resolveForumGenerationContext(
  input: ResolveForumGenerationContextInput,
): ResolvedForumGenerationContext {
  const activeWorldBooks = resolveScopedWorldBooks(
    input.worldBooks || [],
    input.globalSettings,
    input.worldBookScope,
  );
  const activeMasks = resolveScopedMasks(
    input.masks || [],
    input.globalSettings,
    input.maskScope,
    input.spectatorSettings,
  );

  return {
    activeWorldBooks,
    activeMasks,
    worldBookPromptBlock: buildWorldBookPromptBlock(
      activeWorldBooks,
      input.worldBookQuery,
      input.worldBookRecentText,
    ),
    maskPromptBlock: buildMaskPromptBlock(activeMasks, input.spectatorSettings),
  };
}
