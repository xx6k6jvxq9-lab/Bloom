import type { AppSettings, MallCatalogItem } from '../../types';
import type { MallHomeMode } from '../../components/mall/MallApp/MallViewData';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { generateTextFromMessagesWithConfig } from '../../services/ai/runtimeClient';

export type MallGeneratedShelfPlan = {
  title: string;
  description: string;
  itemIds: string[];
  categoryHint?: string | null;
};

export type MallSearchIntentPlan = {
  normalizedQuery: string;
  categoryHint?: string | null;
  modeHint?: MallHomeMode | null;
};

type MallShelfPromptInput = {
  mode: MallHomeMode;
  userName: string;
  companionName?: string | null;
  catalog: MallCatalogItem[];
  wishlistTitles?: string[];
  recentSearches?: string[];
  recentViewedTitles?: string[];
};

function sanitizeJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return '';
  }

  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace >= firstBrace) {
    return withoutFence.slice(firstBrace, lastBrace + 1);
  }

  return withoutFence;
}

function parseMallJson<T>(rawText: string): T {
  return JSON.parse(sanitizeJsonText(rawText)) as T;
}

function buildCatalogSummary(catalog: MallCatalogItem[]) {
  return catalog
    .map((item) => [
      `id=${item.id}`,
      `title=${item.title}`,
      `category=${item.category}`,
      `price=${item.price}`,
      `destinations=${item.destinationKinds.join('/')}`,
      `tags=${item.tags.join('/')}`,
      `scenes=${(item.sceneTags || []).join('/')}`,
      `blurb=${item.copy.cardBlurb}`,
    ].join(' | '))
    .join('\n');
}

export function buildMallShelfPlanPrompt(input: MallShelfPromptInput): string {
  const modeTextMap: Record<MallHomeMode, string> = {
    self: '自己买',
    gift: '送给TA',
    companion: '一起逛',
    private: '私密专区',
  };

  return [
    '你是 Bloom 商城的受控货架规划器。',
    '你的任务不是生成新商品，而是只能从给定 catalog 中挑选最适合当前模式的一批商品。',
    '禁止编造不存在的商品 id，禁止输出 catalog 之外的商品。',
    '请只返回一个 JSON 对象，不要附带解释。',
    'JSON 结构必须固定为：',
    '{"title":"货架标题","description":"货架说明","itemIds":["商品id1","商品id2"],"categoryHint":"可选类目或 null"}',
    'itemIds 最多 6 个，最少 3 个；如果模式下合适商品较少，可以少于 6 个但不能为空。',
    `当前模式：${modeTextMap[input.mode]}`,
    input.userName ? `用户名字：${input.userName}` : '',
    input.companionName ? `相关角色：${input.companionName}` : '',
    input.wishlistTitles && input.wishlistTitles.length > 0 ? `愿望单偏好：${input.wishlistTitles.join(' / ')}` : '',
    input.recentSearches && input.recentSearches.length > 0 ? `最近搜索：${input.recentSearches.join(' / ')}` : '',
    input.recentViewedTitles && input.recentViewedTitles.length > 0 ? `最近看过：${input.recentViewedTitles.join(' / ')}` : '',
    '',
    'catalog:',
    buildCatalogSummary(input.catalog),
  ].filter(Boolean).join('\n');
}

type MallShelfPlanGenerationInput = MallShelfPromptInput & {
  settings: AppSettings;
};

export async function generateMallShelfPlan(
  input: MallShelfPlanGenerationInput,
): Promise<MallGeneratedShelfPlan> {
  const activeConfig = resolveSceneTextApiConfig({
    settings: input.settings,
    scene: 'default',
  }).runtimeConfig;

  if (!activeConfig?.apiKey?.trim()) {
    throw new Error('还没有可用的模型配置。');
  }

  const responseText = await generateTextFromMessagesWithConfig({
    activeConfig,
    traceLabel: 'mall:shelf-plan',
    messages: [
      {
        role: 'user',
        content: buildMallShelfPlanPrompt(input),
      },
    ],
    temperature: 0.45,
    maxOutputTokens: 400,
  });

  const parsed = parseMallJson<MallGeneratedShelfPlan>(responseText);
  const validIds = new Set(input.catalog.map((item) => item.id));
  const itemIds = (Array.isArray(parsed.itemIds) ? parsed.itemIds : [])
    .filter((itemId): itemId is string => typeof itemId === 'string' && validIds.has(itemId))
    .slice(0, 6);

  if (itemIds.length === 0) {
    throw new Error('这次没有拿到可用的推荐结果。');
  }

  return {
    title: typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : '本轮推荐',
    description: typeof parsed.description === 'string' && parsed.description.trim()
      ? parsed.description.trim()
      : '从现有商品里挑出的一批更适合现在的货架。',
    itemIds,
    categoryHint: typeof parsed.categoryHint === 'string' && parsed.categoryHint.trim()
      ? parsed.categoryHint.trim()
      : null,
  };
}

type MallSearchIntentPromptInput = {
  settings: AppSettings;
  query: string;
  categories: string[];
};

export function buildMallSearchIntentPrompt(input: {
  query: string;
  categories: string[];
}): string {
  return [
    '你是 Bloom 商城的搜索意图解析器。',
    '请根据用户搜索词判断它更像在找什么，并且只返回一个 JSON 对象，不要附带解释。',
    'JSON 结构固定为：',
    '{"normalizedQuery":"整理后的搜索词","categoryHint":"类目或 null","modeHint":"self/gift/companion/private 或 null"}',
    `可用类目：${input.categories.join(' / ')}`,
    `用户搜索词：${input.query}`,
  ].join('\n');
}

export async function parseMallSearchIntent(
  input: MallSearchIntentPromptInput,
): Promise<MallSearchIntentPlan> {
  const activeConfig = resolveSceneTextApiConfig({
    settings: input.settings,
    scene: 'default',
  }).runtimeConfig;

  if (!activeConfig?.apiKey?.trim()) {
    throw new Error('还没有可用的模型配置。');
  }

  const responseText = await generateTextFromMessagesWithConfig({
    activeConfig,
    traceLabel: 'mall:search-intent',
    messages: [
      {
        role: 'user',
        content: buildMallSearchIntentPrompt({
          query: input.query,
          categories: input.categories,
        }),
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 220,
  });

  const parsed = parseMallJson<MallSearchIntentPlan>(responseText);
  const validModeSet = new Set<MallHomeMode>(['self', 'gift', 'companion', 'private']);

  return {
    normalizedQuery: typeof parsed.normalizedQuery === 'string' && parsed.normalizedQuery.trim()
      ? parsed.normalizedQuery.trim()
      : input.query.trim(),
    categoryHint: typeof parsed.categoryHint === 'string' && input.categories.includes(parsed.categoryHint.trim())
      ? parsed.categoryHint.trim()
      : null,
    modeHint: parsed.modeHint && validModeSet.has(parsed.modeHint)
      ? parsed.modeHint
      : null,
  };
}
