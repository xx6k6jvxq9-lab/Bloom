import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import type { GenerateDreamScenarioOptions } from './dreamRuntimeTypes';

export function buildDreamScenarioPrompt(options: GenerateDreamScenarioOptions) {
  const { character, selection } = options;
  const domain = resolveDreamDomainDisplay(selection.domainId);
  const depthLabel = selection.depth === 'deep' ? '深梦' : '浅梦';
  const actCount = selection.depth === 'deep' ? 4 : 3;
  const tagSummary = buildDreamTagSummary(selection.selectedTags);

  return `
你是 Bloom 项目的梦境剧情生成器。你要为“梦境 App”生成一局可交互梦局。

重要约束：
1. 输出必须是 JSON，不要写解释，不要写 markdown 代码块。
2. 这是一局“分页面展示”的梦境，所以剧情要分成 ${actCount} 幕。
3. 每一幕的 3 个系统选项，必须和当幕剧情同步生成，不能复用固定题库。
4. 系统选项只给“大体方向”，不要替用户把动作写得过死。
5. 第 4 个选项不需要生成具体内容，固定预留给“用户自定义描述”。
6. 气质要像梦局，不像普通聊天，不像游戏系统说明。
7. 每幕 choice 的 direction 要彼此明显不同。
8. choice.title 2-6 个字，detail 12-28 个字，reactionHint 12-30 个字。
9. scene 是这一幕正式展示的梦境正文，charState 是角色此刻状态提示。
10. endingInput 不直接写最终梦尾摘录，只写给结局生成器的结构化输入。
11. aftermathInput 不直接写最终聊天文案，只写轻回流方向。

角色信息：
- 角色名: ${character.remarkName?.trim() || character.name}
- 角色签名: ${character.signature?.trim() || '暂无'}
- 角色核心人设: ${character.corePersona?.trim() || character.setting?.trim() || '暂无'}
- 表达风格: ${character.expressionStyle?.trim() || '未提供'}
- 边界与禁区: ${character.boundaryPack?.trim() || '未提供'}
- 扩展设定: ${character.extendedLore?.trim() || '未提供'}

入梦配置：
- 入梦方式: ${selection.entryMode}
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
      "scene": "这一幕正式剧情",
      "charState": "角色此刻状态",
      "choices": [
        {
          "id": "act-1-choice-1",
          "title": "短标题",
          "direction": "这个选项的大体方向",
          "detail": "给用户的轻提示",
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
