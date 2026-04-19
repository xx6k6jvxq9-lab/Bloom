import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import { buildDreamPromptInput } from './buildDreamPromptInput';
import { resolveDreamPresentation } from './resolveDreamPresentation';
import type { GenerateDreamScenarioOptions } from './dreamRuntimeTypes';

function computeShallowActCount(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % 2 === 0 ? 4 : 5;
}

export function buildDreamScenarioPrompt(options: GenerateDreamScenarioOptions) {
  const promptInput = buildDreamPromptInput(options);
  const { characterContext, memoryLayers, resolvedSelection, domainRule, worldBookPrompt, maskPrompt, tagCategoryContext } = promptInput;
  const domain = resolveDreamDomainDisplay(resolvedSelection.domainId);
  const depthLabel = resolvedSelection.depth === 'deep' ? '深梦' : '浅梦';
  const actCount =
    resolvedSelection.depth === 'deep'
      ? 4
      : computeShallowActCount(`${options.character.id}-${resolvedSelection.domainId}-${resolvedSelection.entryMode}`);
  const tagSummary = buildDreamTagSummary(resolvedSelection.selectedTags);
  const presentation = resolveDreamPresentation(
    `${options.character.id}-${resolvedSelection.domainId}-${resolvedSelection.depth}-${resolvedSelection.entryMode}`,
  );

  return `
你是 Bloom 项目的梦境剧情生成器。你要为“梦境 App”生成一局结构清晰、逻辑完整、可渲染的梦中小故事。

核心原则：
1. 这是一场“梦开启的新小世界”，不是现实聊天的延长版。
2. 先由标签决定梦世界，再由角色气质决定人物表现。
3. 现实语境只保留：角色核心性格、表达风格、边界、情感熟悉度、记忆底色。
4. 现实中的原职业、原身份、原关系称谓，不要直接搬进梦里，除非与本局标签高度一致。
5. 如果标签定义了敌对、禁忌、旧情、阵营、身份等，本局必须优先遵从标签。
6. 梦开场必须先带入一个明确背景包：什么世界、什么关系、什么节点、要面对什么冲突。
7. 每一幕都必须推动同一条主线，不要只写暧昧氛围，不要写得逻辑松散。

重要约束：
1. 输出必须是 JSON，不要写解释，不要写 markdown 代码块。
2. 浅梦必须生成 ${actCount} 幕，并且在这 ${actCount} 幕里完成“开头-推进-转折/加压-收束前一幕”的完整短篇结构。
3. 深梦当前先输出 4 幕展开段，但仍要保留“还可继续下沉”的空间。
4. 每一幕 scene 必须是 800-1000 字的完整剧情正文。
5. 每一幕 narrative.pages[0].blocks 必须把正文拆成 4-7 个 block，而不是一整段。
6. block.type 只能使用 narration / dialogue / highlight-dialogue / framed-dialogue / aside / prompt。
7. 每一幕的 3 个系统选项必须与当幕剧情同步生成，彼此方向明显不同。
8. choice.detail 必须是动作/走向描写，不是系统提示。
9. choice.reactionHint 是角色对该选择的直接反应。
10. choice.storyPush 是该选择如何把主线继续往下推进。
11. reactionHint 和 storyPush 都要具体，不要空泛。
12. 第 4 个选项不要生成，前端会固定追加“自定义描述”。
13. endingInput 和 aftermathInput 仍然只写结构化方向，不要写最终成品文案。

当前梦域规则：
${domainRule}

本次角色现实底色：
- 角色名: ${options.character.remarkName?.trim() || options.character.name}
- 核心人设: ${characterContext.corePersona || options.character.setting?.trim() || '暂无'}
- 表达风格: ${characterContext.expressionStyle || '未提供'}
- 边界与禁区: ${characterContext.boundaryPack || '未提供'}
- 扩展设定: ${characterContext.extendedLore || '未提供'}
- Mask 语境: ${maskPrompt}
- WorldBook 语境: ${worldBookPrompt}
- 短期记忆: ${memoryLayers.shortTermSummary || '暂无'}
- 长期记忆: ${memoryLayers.longTermMemoryProfile || '暂无'}

入梦配置：
- 入梦方式: ${resolvedSelection.entryMode}
- 梦域: ${domain.name}
- 梦域副标题: ${domain.subtitle || '未提供'}
- 梦域描述: ${domain.description || '未提供'}
- 梦型: ${depthLabel}

标签摘要：
${tagSummary || '未选择标签'}

标签分类读取：
- 背景层（世界/题材/场景/阵营/NPC）：${tagCategoryContext.background.join(' / ') || '未提供'}
- 身份层（梦中新身份/参与人数）：${tagCategoryContext.identities.join(' / ') || '未提供'}
- 关系层（关系张力/主导权）：${tagCategoryContext.relationships.join(' / ') || '未提供'}
- 驱动层（剧情怎么推进/互动方式/互动强度）：${tagCategoryContext.drives.join(' / ') || '未提供'}
- 氛围层（情绪底色/结局倾向）：${tagCategoryContext.moods.join(' / ') || '未提供'}

分类使用规则：
1. 背景层必须决定这局梦是什么世界、什么环境、是否有阵营或第三方势力。
2. 身份层必须决定用户和角色在梦中的新身份，优先级高于现实原身份。
3. 关系层必须决定梦内关系，优先级高于现实关系称谓。
4. 驱动层必须决定主线目标、推进方式和每幕选项的方向差异。
5. 氛围层必须决定正文质感、台词气味和结局走向。
6. 用户勾选过的标签必须都被读到，不能只挑其中一两个。

本局展示风格：
- layoutId: ${presentation.layout.id}
- layoutName: ${presentation.layout.name}
- layoutDescription: ${presentation.layout.description}
- themeId: ${presentation.theme.id}
- themeName: ${presentation.theme.name}
- accent: ${presentation.theme.accent}

输出 JSON 结构：
{
  "coverTitle": "2-4字",
  "coverSubtitle": "16-36字",
  "confirmHint": "30-80字",
  "storyFrame": {
    "worldTitle": "本局梦世界标题",
    "worldSummary": "本局是什么世界、什么质感、什么规则",
    "userDreamIdentity": "用户在梦里的身份",
    "characterDreamIdentity": "角色在梦里的身份",
    "dreamRelationship": "本局梦内关系",
    "openingNode": "故事开始时所处节点",
    "storyObjective": "这局梦的主线目标",
    "coreConflict": "这局梦的核心冲突",
    "realityAnchor": "这场梦和现实底色之间保留下来的唯一锚点"
  },
  "acts": [
    {
      "id": "act-1",
      "label": "第一幕",
      "scene": "800-1000字完整剧情",
      "charState": "角色此刻状态",
      "narrative": {
        "themeId": "${presentation.theme.id}",
        "layoutId": "${presentation.layout.id}",
        "pages": [
          {
            "id": "page-1",
            "title": "第一幕",
            "blocks": [
              {
                "id": "block-1",
                "type": "narration",
                "text": "正文",
                "speakerName": "可选",
                "emphasis": "low|medium|high",
                "align": "left|center|right"
              }
            ]
          }
        ]
      },
      "choices": [
        {
          "id": "act-1-choice-1",
          "title": "短标题",
          "direction": "这个选项的大体方向",
          "detail": "这一选项会如何推动剧情的动作描写",
          "reactionHint": "角色的即时反应",
          "storyPush": "这次选择将主线推向哪里",
          "emotion": "一个简短情绪词"
        }
      ],
      "progression": {
        "consequence": "这一幕结束后已经发生了什么变化",
        "plotAdvance": "主线现在被推进到了哪里",
        "tensionShift": "关系/冲突张力发生了什么偏移"
      }
    }
  ],
  "endingInput": {
    "titlePoolKey": "用于结局标题池的方向键",
    "endingDirection": "结局倾向描述",
    "keyActionSummary": "本局关键动作摘要"
  },
  "aftermathInput": {
    "relationshipShift": "轻微关系变化",
    "toneDrift": "语气漂移方向",
    "messagePreviewDirection": "明日聊天预览方向"
  }
}

注意：
- acts 数量必须正好是 ${actCount}。
- 每幕 choices 必须正好是 3 个。
- 每幕 narrative.pages 数量固定为 1。
- 每幕 narrative.pages[0].blocks 数量为 4 到 7 个。
- 同一局梦里世界观、身份、关系、主线目标要始终一致，不要跳脱。
  `.trim();
}
