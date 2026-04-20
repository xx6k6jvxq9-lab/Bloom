import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import { buildDreamPromptInput } from './buildDreamPromptInput';
import type { GenerateDreamContinuationOptions } from './dreamRuntimeTypes';

function buildPastActSummary(options: GenerateDreamContinuationOptions) {
  return options.scenario.acts
    .slice(0, options.actIndex + 1)
    .map((act) => [
      act.label,
      `- scene: ${act.scene.slice(0, 200) || 'n/a'}`,
      `- charState: ${act.charState || 'n/a'}`,
      `- plotAdvance: ${act.progression.plotAdvance || 'n/a'}`,
      `- tensionShift: ${act.progression.tensionShift || 'n/a'}`,
      `- consequence: ${act.progression.consequence || 'n/a'}`,
    ].join('\n'))
    .join('\n\n');
}

function buildDecisionTrailSummary(options: GenerateDreamContinuationOptions) {
  const committedTrail = options.scenario.decisionTrail.map((record, index) => (
    [
      `${index + 1}. ${record.actLabel}`,
      `- choice: ${record.title}`,
      `- direction: ${record.direction || 'n/a'}`,
      `- detail: ${record.detail || 'n/a'}`,
      `- reaction: ${record.reaction || 'n/a'}`,
      `- storyPush: ${record.storyPush || 'n/a'}`,
      `- emotion: ${record.emotion || 'n/a'}`,
      `- source: ${record.fromCustom ? 'custom-input' : 'preset-choice'}`,
    ].join('\n')
  ));

  const currentActLabel = options.scenario.acts[options.actIndex]?.label || `Act ${options.actIndex + 1}`;
  const pendingRecord =
    options.mode === 'custom'
      ? [
          `${committedTrail.length + 1}. ${currentActLabel}`,
          '- choice: custom-input',
          `- direction: ${options.userInput?.trim() || 'n/a'}`,
          `- detail: ${options.userInput?.trim() || 'n/a'}`,
          '- reaction: pending-current-generation',
          '- storyPush: pending-current-generation',
          '- emotion: pending-current-generation',
          '- source: custom-input',
        ].join('\n')
      : options.selectedChoice
        ? [
            `${committedTrail.length + 1}. ${currentActLabel}`,
            `- choice: ${options.selectedChoice.title}`,
            `- direction: ${options.selectedChoice.direction || 'n/a'}`,
            `- detail: ${options.selectedChoice.detail || 'n/a'}`,
            `- reaction: ${options.selectedChoice.reaction || options.selectedChoice.reactionHint || 'n/a'}`,
            `- storyPush: ${options.selectedChoice.storyPush || 'n/a'}`,
            `- emotion: ${options.selectedChoice.emotion || 'n/a'}`,
            `- source: ${options.selectedChoice.fromCustom ? 'custom-input' : 'preset-choice'}`,
          ].join('\n')
        : '';

  return [...committedTrail, pendingRecord].filter(Boolean).join('\n\n') || 'No previous user choices recorded.';
}

export function buildDreamContinuationPrompt(options: GenerateDreamContinuationOptions) {
  const promptInput = buildDreamPromptInput(options);
  const { resolvedSelection, domainRule, tagCategoryContext } = promptInput;
  const currentAct = options.scenario.acts[options.actIndex];
  const domain = resolveDreamDomainDisplay(resolvedSelection.domainId);
  const tagSummary = buildDreamTagSummary(resolvedSelection.selectedTags);
  const pastActs = buildPastActSummary(options);
  const decisionTrail = buildDecisionTrailSummary(options);

  const modeInstruction =
    options.mode === 'custom'
      ? `User picked the custom input path. The custom input is: ${options.userInput?.trim() || 'n/a'}. First generate the immediate reaction to this custom action, then generate the next act. The next act must directly honor the user input.`
      : options.mode === 'deeper'
        ? `This is a deep-dream continuation. The user did NOT end the dream. The latest choice is: ${options.selectedChoice?.title || 'n/a'}. First generate the immediate reaction to that choice, then generate exactly 5 new continuous acts in nextActs. These 5 acts must continue the same dream, keep room for another continuation, and must not secretly end the story.`
        : `This is the deep-dream ending path. The user clicked end dream. Generate one finalAct that naturally continues from the existing acts, pushes the story to the threshold of the ending, and does NOT open a new storyline. Then output endingInput and aftermathInput. finalAct must only serve as the last act before the ending.`;

  const outputSchema =
    options.mode === 'deep-end'
      ? `{
  "reactionText": "optional",
  "emotion": "optional",
  "storyPush": "optional",
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
    "choices": [
      {
        "id": "enter-ending",
        "title": "进入结局",
        "direction": "收束至终局",
        "detail": "这一幕之后只进入结局，不再给普通三选一。",
        "reactionHint": "可留空",
        "storyPush": "主线被推到结局门口",
        "emotion": "终响"
      }
    ],
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
      : options.mode === 'deeper'
        ? `{
  "reactionText": "150-260字的即时反应与推进",
  "emotion": "一个简短情绪词",
  "storyPush": "这一轮之后主线会被推向哪里",
  "nextActs": [
    {
      "id": "next-act-1",
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
          "detail": "动作/走向描述",
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
  ]
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
        "detail": "动作/走向描述",
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
You are the Bloom dream continuation generator.
Continue the SAME dream runtime. Do not restart the story. Do not change world logic, dream identities, relationship logic, layout, or theme.

Hard rules:
1. Dream identity has priority over real identity.
2. Dream relationship has priority over real relationship.
3. Keep the same presentation: themeId=${options.scenario.presentation.themeId}, layoutId=${options.scenario.presentation.layoutId}.
4. Respect the user's selected tags as structural constraints, not just mood decoration.
5. If mode is deeper, generate 5 continuous acts and keep continuation space.
6. If mode is deep-end, generate one real final act before the ending, not a summary and not a new branch.
7. Output JSON only.

Current domain: ${domain.name}
Domain rule: ${domainRule}
Tag summary: ${tagSummary || 'n/a'}

Tag mapping:
- background: ${tagCategoryContext.background.join(' / ') || 'n/a'}
- identity: ${tagCategoryContext.identities.join(' / ') || 'n/a'}
- relationship: ${tagCategoryContext.relationships.join(' / ') || 'n/a'}
- drive: ${tagCategoryContext.drives.join(' / ') || 'n/a'}
- mood: ${tagCategoryContext.moods.join(' / ') || 'n/a'}

Story frame:
- worldTitle: ${options.scenario.storyFrame.worldTitle}
- worldSummary: ${options.scenario.storyFrame.worldSummary}
- userDreamIdentity: ${options.scenario.storyFrame.userDreamIdentity}
- characterDreamIdentity: ${options.scenario.storyFrame.characterDreamIdentity}
- dreamRelationship: ${options.scenario.storyFrame.dreamRelationship}
- openingNode: ${options.scenario.storyFrame.openingNode}
- timeNode: ${options.scenario.storyFrame.timeNode || 'n/a'}
- currentCrisis: ${options.scenario.storyFrame.currentCrisis || 'n/a'}
- forbiddenRule: ${options.scenario.storyFrame.forbiddenRule || 'n/a'}
- immediateGoal: ${options.scenario.storyFrame.immediateGoal || 'n/a'}
- storyObjective: ${options.scenario.storyFrame.storyObjective}
- coreConflict: ${options.scenario.storyFrame.coreConflict}

Past act summary:
${pastActs}

Recorded user choice trail:
${decisionTrail}

Current act:
- label: ${currentAct.label}
- scene: ${currentAct.scene}
- charState: ${currentAct.charState}

Task:
${modeInstruction}

Output JSON schema:
${outputSchema}
`.trim();
}
