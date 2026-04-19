import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import { buildDreamPromptInput } from './buildDreamPromptInput';
import type { GenerateDreamContinuationOptions } from './dreamRuntimeTypes';

function buildPastActSummary(options: GenerateDreamContinuationOptions) {
  return options.scenario.acts
    .slice(0, options.actIndex + 1)
    .map((act, index) => {
      const choice =
        index === options.actIndex && options.selectedChoice
          ? `\n- 本幕用户选择: ${options.selectedChoice.title} / ${options.selectedChoice.direction}`
          : '';
      return [
        `${act.label}`,
        `- 场景: ${act.scene.slice(0, 160)}`,
        `- 角色状态: ${act.charState || '未写明'}`,
        `- 主线推进: ${act.progression.plotAdvance || '未写明'}`,
        `- 张力变化: ${act.progression.tensionShift || '未写明'}`,
        choice,
      ].join('\n');
    })
    .join('\n\n');
}

export function buildDreamContinuationPrompt(options: GenerateDreamContinuationOptions) {
  const promptInput = buildDreamPromptInput(options);
  const { resolvedSelection, domainRule, tagCategoryContext } = promptInput;
  const currentAct = options.scenario.acts[options.actIndex];
  const domain = resolveDreamDomainDisplay(resolvedSelection.domainId);
  const tagSummary = buildDreamTagSummary(resolvedSelection.selectedTags);
  const pastActs = buildPastActSummary(options);

  const modeInstruction =
    options.mode === 'custom'
      ? `用户选择了第 4 个“自定义描述”，用户输入是：${options.userInput?.trim() || '未提供'}。
请先生成这一输入带来的即时反应，再生成下一幕。下一幕要承接用户输入，不要无视它。`
      : options.mode === 'deeper'
        ? `当前是深梦，用户没有结束做梦，而是继续往下沉。当前用户刚做出的选择是：${options.selectedChoice?.title || '未提供'}。
请生成承接这一选择的即时反应，并再生成下一幕，保持还能继续下沉。`
        : `当前是深梦，用户点击了“结束做梦”。
请生成一幕“最后一幕”，这一幕必须承接前文，把主线推到可进入结局的位置，然后一并输出 endingInput 和 aftermathInput。`;

  const outputSchema =
    options.mode === 'deep-end'
      ? `{
  "reactionText": "可留空",
  "emotion": "可留空",
  "storyPush": "可留空",
  "finalAct": {
    "id": "final-act",
    "label": "最后一幕",
    "scene": "800-1000字完整剧情",
    "charState": "角色此刻状态",
    "narrative": {
      "themeId": "${options.scenario.presentation.themeId}",
      "layoutId": "${options.scenario.presentation.layoutId}",
      "pages": [
        {
          "id": "page-1",
          "title": "最后一幕",
          "blocks": []
        }
      ]
    },
    "choices": [],
    "progression": {
      "consequence": "这一幕造成的变化",
      "plotAdvance": "主线已被推到结局门口",
      "tensionShift": "张力最终偏移"
    }
  },
  "endingInput": {
    "titlePoolKey": "方向键",
    "endingDirection": "结局倾向",
    "keyActionSummary": "结局关键动作摘要"
  },
  "aftermathInput": {
    "relationshipShift": "关系余波",
    "toneDrift": "语气漂移",
    "messagePreviewDirection": "次日聊天预览方向"
  }
}`
      : `{
  "reactionText": "150-260字的即时反应与推进",
  "emotion": "一个简短情绪词",
  "storyPush": "这一轮之后主线会被推向哪里",
  "nextAct": {
    "id": "next-act",
    "label": "下一幕",
    "scene": "800-1000字完整剧情",
    "charState": "角色此刻状态",
    "narrative": {
      "themeId": "${options.scenario.presentation.themeId}",
      "layoutId": "${options.scenario.presentation.layoutId}",
      "pages": [
        {
          "id": "page-1",
          "title": "下一幕",
          "blocks": []
        }
      ]
    },
    "choices": [
      {
        "id": "next-choice-1",
        "title": "短标题",
        "direction": "方向",
        "detail": "动作/走向描写",
        "reactionHint": "角色即时反应",
        "storyPush": "如何推进主线",
        "emotion": "情绪词"
      }
    ],
    "progression": {
      "consequence": "这一幕造成的变化",
      "plotAdvance": "主线被推进到哪里",
      "tensionShift": "张力变化"
    }
  }
}`;

  return `
你是 Bloom 项目的梦境续写生成器。你的任务是承接已经发生的梦局内容，继续往下生成，而不是重开一局。

总规则：
1. 必须承接前文，不要跳戏，不要换世界，不要忘记已经确定的梦中新身份、关系和主线。
2. 一整局梦只使用当前这一套 layout 和 theme，不要改格式。
3. 用户勾选过的标签必须继续生效。
4. 如果是深梦继续下沉，不要偷偷收尾。
5. 如果是深梦结束做梦，最后一幕必须自然承接前文，再进入结局，不要凭空冒出结局。
6. 输出必须是 JSON，不要解释。

当前梦域：${domain.name}
梦域规则：${domainRule}
标签摘要：
${tagSummary || '未提供'}

标签分类：
- 背景层：${tagCategoryContext.background.join(' / ') || '未提供'}
- 身份层：${tagCategoryContext.identities.join(' / ') || '未提供'}
- 关系层：${tagCategoryContext.relationships.join(' / ') || '未提供'}
- 驱动层：${tagCategoryContext.drives.join(' / ') || '未提供'}
- 氛围层：${tagCategoryContext.moods.join(' / ') || '未提供'}

当前梦世界框架：
- 世界标题：${options.scenario.storyFrame.worldTitle}
- 世界摘要：${options.scenario.storyFrame.worldSummary}
- 用户梦中身份：${options.scenario.storyFrame.userDreamIdentity}
- 角色梦中身份：${options.scenario.storyFrame.characterDreamIdentity}
- 梦内关系：${options.scenario.storyFrame.dreamRelationship}
- 开场节点：${options.scenario.storyFrame.openingNode}
- 时间节点：${options.scenario.storyFrame.timeNode || '未写明'}
- 当前危机：${options.scenario.storyFrame.currentCrisis || '未写明'}
- 禁忌或规则：${options.scenario.storyFrame.forbiddenRule || '未写明'}
- 立即目标：${options.scenario.storyFrame.immediateGoal || '未写明'}
- 主线目标：${options.scenario.storyFrame.storyObjective}
- 核心冲突：${options.scenario.storyFrame.coreConflict}

已发生的剧情摘要：
${pastActs}

当前所处幕：
- 标题：${currentAct.label}
- 正文：${currentAct.scene}
- 角色状态：${currentAct.charState}

当前固定展示格式：
- themeId: ${options.scenario.presentation.themeId}
- layoutId: ${options.scenario.presentation.layoutId}

本次任务：
${modeInstruction}

输出 JSON 结构：
${outputSchema}
`.trim();
}
