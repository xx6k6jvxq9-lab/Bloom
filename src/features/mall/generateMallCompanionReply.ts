import type {
  AppSettings,
  Character,
  MallCatalogItem,
} from '../../types';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { generateTextWithConfig } from '../../services/ai/runtimeClient';
import { buildDirectPersonaGuide } from '../../services/ai/prompts/character/buildDirectPersonaGuide';

type GenerateMallCompanionReplyInput = {
  settings: AppSettings;
  character: Character;
  item: MallCatalogItem;
  userName: string;
};

function formatMallItemSummary(item: MallCatalogItem) {
  return [
    `商品标题：${item.title}`,
    item.subtitle ? `副标题：${item.subtitle}` : '',
    `分类：${item.category}${item.subCategory ? ` / ${item.subCategory}` : ''}`,
    `价格：¥${item.price.toFixed(2)}`,
    item.tags.length ? `标签：${item.tags.join(' / ')}` : '',
    item.sceneTags?.length ? `适合场景：${item.sceneTags.join(' / ')}` : '',
    item.styleTags?.length ? `风格：${item.styleTags.join(' / ')}` : '',
    `短描述：${item.copy.cardBlurb}`,
    item.copy.recommendationReason ? `推荐理由：${item.copy.recommendationReason}` : '',
  ].filter(Boolean).join('\n');
}

export function buildMallCompanionReplyPrompt(input: GenerateMallCompanionReplyInput): string {
  const displayName = input.character.remarkName?.trim() || input.character.name;
  const personaGuide = buildDirectPersonaGuide({
    corePersona: input.character.corePersona || input.character.setting,
    expressionStyle: input.character.expressionStyle,
    boundaryPack: input.character.boundaryPack,
    extendedLore: input.character.extendedLore,
    signature: input.character.signature,
    openingRemark: input.character.openingRemark,
  });

  return [
    `你现在是 ${displayName}。`,
    '你不在正式聊天里，也不需要跳转场景。',
    '这是 Bloom 商城商品详情页右下角的悬浮问答窗，用户刚点了“问问TA”。',
    '请直接用角色本人语气回复，不要旁白，不要分析框架，不要自称 AI，不要说“去聊天里说”。',
    '只输出 1 到 3 句短消息，语气自然，像即时回了一下。',
    '回复里必须自然包含这三层判断：',
    '1. 你喜不喜欢这个商品',
    '2. 这个商品适不适合用户',
    '3. 这个商品适不适合现在买',
    '不要用列表、标题、编号、引号解释，也不要写动作描写。',
    `用户名字：${input.userName || '用户'}`,
    '',
    personaGuide,
    '',
    formatMallItemSummary(input.item),
    '',
    `用户问的是：我看到「${input.item.title}」，你觉得适合我吗？现在买合适吗？`,
    '现在直接给出角色回复，只输出回复正文。',
  ].filter(Boolean).join('\n');
}

export async function generateMallCompanionReply(
  input: GenerateMallCompanionReplyInput,
): Promise<string> {
  const activeConfig = resolveSceneTextApiConfig({
    settings: input.settings,
    scene: 'default',
  }).runtimeConfig;

  if (!activeConfig?.apiKey?.trim()) {
    throw new Error('还没有可用的模型配置。');
  }

  const rawReply = await generateTextWithConfig({
    activeConfig,
    prompt: buildMallCompanionReplyPrompt(input),
    temperature: 0.85,
    maxOutputTokens: 140,
  });

  const reply = rawReply.trim();
  if (!reply) {
    throw new Error('这次没有拿到有效回复，请再问一次。');
  }

  return reply;
}
