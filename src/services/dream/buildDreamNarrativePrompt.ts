import type { Character } from '../../types';
import type { DreamRuntimeAct } from './dreamRuntimeTypes';
import type { DreamNarrativeLayoutPreset } from './dreamNarrativeLayouts';
import type { DreamThemePreset } from './dreamThemePresets';

type BuildDreamNarrativePromptOptions = {
  character: Character;
  act: DreamRuntimeAct;
  layout: DreamNarrativeLayoutPreset;
  theme: DreamThemePreset;
};

export function buildDreamNarrativePrompt(options: BuildDreamNarrativePromptOptions) {
  const { character, act, layout, theme } = options;

  return `
你是 Bloom 项目的梦境正文编排器。你的任务不是只写纯文本，而是输出“可渲染的正文 JSON”。

要求：
1. 输出必须是 JSON，不要解释，不要 markdown。
2. 需要把这一幕内容拆成多个 block，而不是一整段。
3. block 类型只能使用：
   - narration
   - dialogue
   - highlight-dialogue
   - framed-dialogue
   - aside
   - prompt
4. 一整次梦只使用当前这一套 layout 和 theme，不要混入别的风格。
5. 这是单幕正文，所以 pages 数量先固定为 1。
6. 每个 block 的 text 必须是可直接展示的正文。
7. 如果是 dialogue / highlight-dialogue / framed-dialogue / aside，可以带 speakerName。
8. 不要生成色情直白内容，不要越界，不要变成聊天记录。

当前角色：
- 角色名: ${character.remarkName?.trim() || character.name}
- 角色核心人设: ${character.corePersona?.trim() || character.setting?.trim() || '暂无'}

当前幕：
- 标题: ${act.label}
- 场景正文: ${act.scene}
- 角色状态: ${act.charState}

本次正文样式：
- layoutId: ${layout.id}
- layoutName: ${layout.name}
- layoutDescription: ${layout.description}
- 推荐 block 顺序: ${layout.suggestedBlocks.join(' -> ')}

本次梦主题色：
- themeId: ${theme.id}
- themeName: ${theme.name}
- accent: ${theme.accent}

输出 JSON 结构：
{
  "themeId": "${theme.id}",
  "layoutId": "${layout.id}",
  "pages": [
    {
      "id": "page-1",
      "title": "${act.label}",
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
}
`.trim();
}
