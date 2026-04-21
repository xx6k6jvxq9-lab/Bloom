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
  const narrativeQualityRules = [
    'Preserve the original scene event, conflict, and turning point. Do not rewrite it into vague lyrical fragments.',
    'Each block should keep concrete actions, objects, dialogue, and consequence visible.',
    'Return 8-12 blocks and cover the full scene text. Do not shorten a 1500-character scene into a 300-character display summary.',
    'Use a readable short-novel rhythm: action, reaction, dialogue, pressure, turn.',
    'Avoid making every block an atmosphere line. At least half of the blocks should move the event or relationship forward.',
    'Keep adjacent blocks causally connected so the scene reads like one continuous passage, not isolated pretty sentences.',
    'Trim redundant setting explanation. Prioritize what the characters are doing, noticing, hiding, and risking right now.',
    'When shaping dialogue blocks, preserve conversational turns and subtext. Do not flatten flirtation, awkwardness, protectiveness, suspicion, or restraint into generic statements.',
    'Keep micro-actions attached to feeling: glances, pauses, breath, hand movement, posture change, fingers on fabric or skin, and voice dropping lower should stay visible when present in the scene.',
    'Do not over-highlight every emotional line. Let ordinary narration carry tension too, so the scene still feels like a novel passage rather than a quote wall.',
    'Do not add new plot branches that were not present in the scene. This step is layout and prose shaping, not a new generation pass.',
  ].join('\n');

  return `
Narrative block quality rules:
${narrativeQualityRules}

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
   - strikethrough
   - annotation
   - verdict
   - redacted
   - echo-line
4. 一整次梦只使用当前这一套 layout 和 theme，不要混入别的风格。
5. 这是单幕正文，所以 pages 数量固定为 1。
6. 每个 block 的 text 必须是可直接展示的正文。
7. 如果是 dialogue / highlight-dialogue / framed-dialogue / aside，可以带 speakerName。
8. 不要生成越界内容，不要变成聊天记录。

当前角色：
- 角色名：${character.remarkName?.trim() || character.name}
- 角色核心人设：${character.corePersona?.trim() || character.setting?.trim() || '暂无'}

当前幕：
- 标题：${act.label}
- 场景正文：${act.scene}
- 角色状态：${act.charState}

本次正文样式：
- layoutId: ${layout.id}
- layoutName: ${layout.name}
- layoutDescription: ${layout.description}
- 推荐 block 顺序：${layout.suggestedBlocks.join(' -> ')}

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
