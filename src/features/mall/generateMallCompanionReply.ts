import type {
  AppSettings,
  Character,
  MallCatalogItem,
} from '../../types';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { streamTextWithConfig } from '../../services/ai/runtimeClient';
import { buildDirectPersonaGuide } from '../../services/ai/prompts/character/buildDirectPersonaGuide';

type GenerateMallCompanionReplyInput = {
  settings: AppSettings;
  character: Character;
  item: MallCatalogItem;
  userName: string;
  onProgress?: (text: string) => void;
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
    `商品短描述：${item.copy.cardBlurb}`,
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
    '这是 Bloom 商城商品详情页右下角的悬浮问答窗，用户刚点了“问问TA”。',
    '这里不是正式聊天页，也不要把用户往聊天里带。',
    '用户现在只是想听你对这个商品的看法。',
    '请直接用角色本人语气回复，不要旁白，不要分析框架，不要自称 AI。',
    '请输出 2 到 4 条短消息。',
    '每条消息单独占一行，不要编号，不要项目符号，不要引号。',
    '每条尽量短一点，像聊天里一条一条发出来，不要写成长段。',
    '你的看法里要自然覆盖这些点：',
    '1. 你对这个商品喜不喜欢',
    '2. 你觉得它适不适合用户',
    '3. 你觉得现在买合不合适',
    '',
    `用户名字：${input.userName || '用户'}`,
    personaGuide,
    '',
    formatMallItemSummary(input.item),
    '',
    `用户问的是：我看到「${input.item.title}」，你觉得适合我吗？现在买合适吗？`,
    '现在直接给出角色回复正文，只输出这些短消息本身。',
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

  let rawReply = '';

  await streamTextWithConfig({
    activeConfig,
    traceLabel: 'mall:companion-reply',
    messages: [
      {
        role: 'user',
        content: buildMallCompanionReplyPrompt(input),
      },
    ],
    temperature: 0.85,
    onTextChunk: (chunkText) => {
      rawReply += chunkText;
      input.onProgress?.(rawReply.trimStart());
    },
  });

  const reply = rawReply.trim();
  if (!reply) {
    throw new Error('这次没有拿到有效回复，请再问一次。');
  }

  return reply;
}
