import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import { buildDreamPromptInput } from './buildDreamPromptInput';
import type { GenerateDreamScenarioOptions } from './dreamRuntimeTypes';

function computeShallowActCount(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % 2 === 0 ? 4 : 5;
}

export function buildDreamScenarioPrompt(options: GenerateDreamScenarioOptions) {
  const promptInput = buildDreamPromptInput(options);
  const { characterContext, memoryLayers, resolvedSelection, domainRule, worldBookPrompt, maskPrompt } = promptInput;
  const domain = resolveDreamDomainDisplay(resolvedSelection.domainId);
  const depthLabel = resolvedSelection.depth === 'deep' ? '深梦' : '浅梦';
  const actCount =
    resolvedSelection.depth === 'deep'
      ? 4
      : computeShallowActCount(`${options.character.id}-${resolvedSelection.domainId}-${resolvedSelection.entryMode}`);
  const tagSummary = buildDreamTagSummary(resolvedSelection.selectedTags);

  return `
你是 Bloom 项目的梦境剧情生成器。你要为“梦境 App”生成一局可交互梦局。

重要约束：
1. 输出必须是 JSON，不要写解释，不要写 markdown 代码块。
2. 浅梦必须生成 ${actCount} 幕，并且在这 ${actCount} 幕里完成“开头-中段推进-收束前一幕”的完整短篇结构。
3. 深梦当前先输出 4 幕展开段，但要写出“仍可继续下沉”的延展感，不要像已经被硬性写死。
4. 每一幕 scene 必须是 800-1000 字的完整正文，不要只写几句概述。
5. 每一幕的 3 个系统选项，必须和当幕剧情同步生成，不能复用固定题库。
6. 选项下方 detail 不是系统说明，而是“这个选择会怎样把剧情往下推”的动作/走向描写。
7. 系统选项只给大方向，不要替用户把动作写死到不可继续发挥。
8. 第 4 个选项不需要生成具体内容，固定预留给“用户自定义描述”。
9. 气质要像梦局，不像普通聊天，不像游戏系统说明。
10. 每幕 choice 的 direction 要彼此明显不同。
11. choice.title 2-6 个字，detail 18-40 个字，reactionHint 18-40 个字。
12. scene 是这一幕正式展示的梦境正文，charState 是角色此刻状态提示。
13. endingInput 不直接写最终梦尾摘录，只写给结局生成器的结构化输入。
14. aftermathInput 不直接写最终聊天文案，只写轻回流方向。
15. 梦内关系可以重新定义，但现实关系只作为熟悉度、语气连续性、情感底色参考，不要把梦内设定直接当成现实事实。

当前梦域生成规则：
${domainRule}

角色信息：
- 角色名: ${options.character.remarkName?.trim() || options.character.name}
- 角色签名: ${options.character.signature?.trim() || '暂无'}
- 角色核心人设: ${characterContext.corePersona || options.character.setting?.trim() || '暂无'}
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

输出 JSON 结构：
{
  "coverTitle": "2-4字",
  "coverSubtitle": "16-36字",
  "confirmHint": "30-80字",
  "acts": [
    {
      "id": "act-1",
      "label": "第一幕",
      "scene": "800-1000字这一幕正式剧情",
      "charState": "角色此刻状态",
      "choices": [
        {
          "id": "act-1-choice-1",
          "title": "短标题",
          "direction": "这个选项的大体方向",
          "detail": "这一选项会如何推动剧情的动作描写",
          "reactionHint": "角色可能出现的反应方向",
          "emotion": "一个简短情绪词"
        }
      ]
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
- 不要生成 custom-input 选项，那是前端固定追加的。
  `.trim();
}
