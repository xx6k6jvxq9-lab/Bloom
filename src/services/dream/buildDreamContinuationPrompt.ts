import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import { buildDreamPersonaGuardrails, buildDreamPromptInput } from './buildDreamPromptInput';
import { buildActBeatSummary, buildDreamMemorySummary, compactSummaryText } from './dreamRuntimeSummaries';
import type { GenerateDreamContinuationOptions } from './dreamRuntimeTypes';

function buildPastActSummary(options: GenerateDreamContinuationOptions) {
  return options.scenario.acts
    .slice(Math.max(0, options.actIndex - 2), options.actIndex + 1)
    .map((act) => act.beatSummary || buildActBeatSummary(act))
    .join('\n\n');
}

function buildDecisionTrailSummary(options: GenerateDreamContinuationOptions) {
  const committedTrail = options.scenario.decisionTrail.map((record, index) => (
    [
      `${index + 1}. ${record.actLabel}`,
      `- choice: ${compactSummaryText(record.title, 18) || 'n/a'}`,
      `- direction: ${compactSummaryText(record.direction, 24) || 'n/a'}`,
      `- storyPush: ${compactSummaryText(record.storyPush, 30) || 'n/a'}`,
      `- source: ${record.fromCustom ? 'custom-input' : 'preset-choice'}`,
    ].join('\n')
  ));

  const currentActLabel = options.scenario.acts[options.actIndex]?.label || `Act ${options.actIndex + 1}`;
  const pendingRecord =
    options.mode === 'custom'
      ? [
          `${committedTrail.length + 1}. ${currentActLabel}`,
          '- choice: custom-input',
          `- direction: ${compactSummaryText(options.userInput?.trim(), 30) || 'n/a'}`,
          `- storyPush: pending-current-generation`,
          '- source: custom-input',
        ].join('\n')
      : options.selectedChoice
        ? [
            `${committedTrail.length + 1}. ${currentActLabel}`,
            `- choice: ${compactSummaryText(options.selectedChoice.title, 18) || 'n/a'}`,
            `- direction: ${compactSummaryText(options.selectedChoice.direction, 24) || 'n/a'}`,
            `- storyPush: ${compactSummaryText(options.selectedChoice.storyPush, 30) || 'n/a'}`,
            `- source: ${options.selectedChoice.fromCustom ? 'custom-input' : 'preset-choice'}`,
          ].join('\n')
        : '';

  return [...committedTrail, pendingRecord].filter(Boolean).join('\n\n') || 'No previous user choices recorded.';
}

export function buildDreamContinuationPrompt(options: GenerateDreamContinuationOptions) {
  const promptInput = buildDreamPromptInput(options);
  const { characterContext, resolvedSelection, domainRule, tagCategoryContext } = promptInput;
  const personaGuardrails = buildDreamPersonaGuardrails(characterContext);
  const currentAct = options.scenario.acts[options.actIndex];
  const domain = resolveDreamDomainDisplay(resolvedSelection.domainId);
  const tagSummary = buildDreamTagSummary(resolvedSelection.selectedTags);
  const memorySummary = options.scenario.memorySummary || buildDreamMemorySummary(options.scenario);
  const pastActs = buildPastActSummary(options);
  const decisionTrail = buildDecisionTrailSummary(options);
  const novelQualityRules = [
    'Novel quality target: broad Chinese web-serial readability with Jinjiang-style emotional clarity, but do not imitate any specific living author.',
    'The selected choice must become the seed of the next scene: begin from what the user just did, then let the character react naturally.',
    'Continue with a natural 1500-1800 Chinese character novel scene built from action, object, dialogue, hesitation, pressure, and emotional subtext. Do not reset, summarize, or write only atmosphere.',
    'Let new information and relationship movement emerge from the scene instead of announcing them as required beats.',
    'Only user-selected tags are hard constraints. If a tag category is empty, treat it as creative freedom and do not invent a hidden default tag for that category.',
    'Continue translating tags into behavior, objects, address terms, boundaries, power distance, timing, hesitation, and concrete choices. Do not name the tag as an explanation inside the prose.',
    'Open the next act from the direct after-effect of the chosen action. Do not jump to a distant summary or restart the room from zero.',
    'In the first paragraph of the new act, make the chosen action physically land in the scene: someone answers it, resists it, leans into it, hides from it, or pays a price for it.',
    'Do not spend more than two consecutive sentences purely explaining worldbuilding. If a setting term appears, make it change what the characters can do right now.',
    'Each act should contain at least one short exchange with subtext and one visible action that changes the emotional temperature or practical situation.',
    'Build chemistry through response, not slogans. Let characters interrupt, dodge, test, provoke, comfort, or misread each other in ways that create pull.',
    'For relationship tags such as age-gap, childhood friends, crush, rivals, caregiver, landlord-tenant, superior-subordinate, or contract partners, show the feeling through care, familiarity, teasing, restraint, practical help, address, room distance, and small exceptions. Do not write direct tag explanations.',
    'Use micro-actions and silence with purpose: a delayed answer, a hand not withdrawn in time, a lowered voice, a gaze avoiding the wound, an object being held too tightly.',
    'Do not resolve the emotional tension too neatly. Preserve some asymmetry, restraint, embarrassment, suspicion, or unfinished feeling so the act invites the next choice.',
    'Keep cause and effect visible: the user action lands, the character reacts, the scene shifts, and a new dilemma appears.',
    'Avoid empty dream cliches and repeated abstract words such as fate, echo, crack, aftertaste, destined, silence, and quiet air unless tied to a concrete action.',
    'Avoid overused visceral romance phrases such as writing feelings into bones/blood or destiny into the body. Prefer specific gestures, exact objects, interrupted dialogue, and practical choices.',
    'Avoid melodramatic stock idioms such as eyes splitting with rage, heart being torn apart, soul shaking, blood boiling, or grief piercing the body. Replace them with concrete behavior: a missed breath, a hand going still, a forced smile, a sentence cut off, or an object gripped too tightly.',
    'Dialogue should be short but information-rich, with Jinjiang/web-novel emotional clarity. Character emotion should be shown through behavior and decisions.',
    'The next three choices should feel like three real emotional continuations from what just happened, not three generic branch labels.',
    'narrative.pages[0].blocks must cover the full scene content in 8-12 blocks. Do not compress the scene into a short summary.',
    'Treat narrative blocks as a formatted split of the full scene, not as extra decorative excerpts. The sum of block text should be close to scene length.',
    'Special blocks are wrappers around real plot paragraphs or dialogue turns. They must not replace the scene with short aesthetic fragments.',
    'Each generated act should use exactly 2 non-narration narrative blocks that fit the existing layout. Keep most blocks novel-like narration; do not turn every paragraph into a bubble or design card.',
    'progression fields are internal summaries only. Do not let the scene read like it is fulfilling progression requirements.',
    'For deep-end, finalAct should naturally press on an existing object, promise, secret, conflict, or relationship debt. It must not become a generic ending summary.',
  ].join('\n');

  const modeInstruction =
    options.mode === 'custom'
      ? `User picked the custom input path. The custom input is: ${options.userInput?.trim() || 'n/a'}. First generate the immediate reaction to this custom action, then generate the next act. The next act must directly honor the user input and MUST contain exactly 3 valid generated choices with non-empty title, direction, detail, reactionHint, storyPush, and emotion fields.`
      : options.mode === 'deeper'
        ? `This is a deep-dream continuation. The user did NOT end the dream. The latest choice is: ${options.selectedChoice?.title || 'n/a'}. First generate the immediate reaction to that choice, then generate exactly 5 new continuous acts in nextActs. These 5 acts must continue the same dream, keep room for another continuation, and must not secretly end the story. EVERY generated act MUST contain exactly 3 valid generated choices. Do not return 1 choice. Do not return 2 choices. Do not leave placeholder labels.`
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
    "scene": "1500-1800字完整剧情",
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
      "scene": "1500-1800字完整剧情",
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
        },
        {
          "id": "next-choice-2",
          "title": "短标题",
          "direction": "方向",
          "detail": "动作/走向描述",
          "reactionHint": "角色即时反应",
          "storyPush": "如何推进主线",
          "emotion": "情绪词"
        },
        {
          "id": "next-choice-3",
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
    "scene": "1500-1800字完整剧情",
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
      },
      {
        "id": "next-choice-2",
        "title": "短标题",
        "direction": "方向",
        "detail": "动作/走向描述",
        "reactionHint": "角色即时反应",
        "storyPush": "如何推进主线",
        "emotion": "情绪词"
      },
      {
        "id": "next-choice-3",
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
7. Every non-ending generated act must contain exactly 3 generated choices.
8. Do not narrate selected tag names as labels. Make the tag felt through scene behavior and consequences.
9. Output JSON only.

Novel prose and plot quality rules:
${novelQualityRules}

Persona guardrails:
${personaGuardrails}

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
- userDreamIdentity: ${options.scenario.storyFrame.userDreamIdentity}
- characterDreamIdentity: ${options.scenario.storyFrame.characterDreamIdentity}
- dreamRelationship: ${options.scenario.storyFrame.dreamRelationship}
- storyObjective: ${options.scenario.storyFrame.storyObjective}
- coreConflict: ${options.scenario.storyFrame.coreConflict}

Memory summary:
${memorySummary}

Recent act beat summary:
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
