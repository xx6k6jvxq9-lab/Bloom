import { buildDreamPersonaGuardrails, buildDreamPromptInput, buildDreamTagWorldBookGuardrails } from './buildDreamPromptInput';
import { buildDreamVariation } from './buildDreamVariation';
import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import type { GenerateDreamScenarioOptions } from './dreamRuntimeTypes';

function resolveExpectedActs(options: GenerateDreamScenarioOptions) {
  return options.selection.depth === 'deep' ? 4 : 4;
}

function buildCompactScenarioSchema(expectedActs: number) {
  return `{
  "coverTitle": "2-6 Chinese characters",
  "coverSubtitle": "16-36 Chinese characters",
  "confirmHint": "30-80 Chinese characters",
  "storyFrame": {
    "worldTitle": "",
    "worldSummary": "",
    "userDreamIdentity": "",
    "characterDreamIdentity": "",
    "dreamRelationship": "",
    "openingNode": "",
    "storyObjective": "",
    "coreConflict": "",
    "realityAnchor": "",
    "timeNode": "",
    "currentCrisis": "",
    "forbiddenRule": "",
    "immediateGoal": ""
  },
  "acts": [
    {
      "id": "act-1",
      "label": "第一幕",
      "sceneParagraphs": [
        "Paragraph 1",
        "Paragraph 2",
        "Paragraph 3",
        "Paragraph 4",
        "Paragraph 5"
      ],
      "charState": "Character state",
      "choices": [
        {
          "id": "act-1-choice-1",
          "title": "Choice title",
          "direction": "Choice direction",
          "detail": "Concrete action and consequence",
          "reactionHint": "Immediate character reaction",
          "storyPush": "How it pushes the main line",
          "emotion": "One short emotion word"
        },
        {
          "id": "act-1-choice-2",
          "title": "Choice title",
          "direction": "Choice direction",
          "detail": "Concrete action and consequence",
          "reactionHint": "Immediate character reaction",
          "storyPush": "How it pushes the main line",
          "emotion": "One short emotion word"
        },
        {
          "id": "act-1-choice-3",
          "title": "Choice title",
          "direction": "Choice direction",
          "detail": "Concrete action and consequence",
          "reactionHint": "Immediate character reaction",
          "storyPush": "How it pushes the main line",
          "emotion": "One short emotion word"
        }
      ],
      "progression": {
        "consequence": "",
        "plotAdvance": "",
        "tensionShift": ""
      }
    }
  ],
  "endingInput": {
    "titlePoolKey": "",
    "endingDirection": "",
    "keyActionSummary": ""
  },
  "aftermathInput": {
    "relationshipShift": "",
    "toneDrift": "",
    "messagePreviewDirection": ""
  }
}

acts must have exactly ${expectedActs} items.`;
}

export function buildDreamScenarioCompactPrompt(
  options: GenerateDreamScenarioOptions,
  seed: string,
  mode: 'light' | 'woven-draft',
) {
  const promptInput = buildDreamPromptInput(options);
  const {
    characterContext,
    memoryLayers,
    resolvedSelection,
    domainRule,
    worldBookPrompt,
    worldBookConflictSummary,
    personaFloorSummary,
    supplementNoteSummary,
    maskPrompt,
    tagCategoryContext,
    variationTone,
  } = promptInput;
  const personaGuardrails = buildDreamPersonaGuardrails(characterContext);
  const worldBookGuardrails = buildDreamTagWorldBookGuardrails();
  const domain = resolveDreamDomainDisplay(resolvedSelection.domainId);
  const tagSummary = buildDreamTagSummary(resolvedSelection.selectedTags, resolvedSelection.customTags);
  const variation = buildDreamVariation(seed, variationTone);
  const expectedActs = resolveExpectedActs(options);
  const modeSummary =
    mode === 'light'
      ? 'Light mode: prioritize parse stability and compact structure.'
      : 'Woven mode draft: prioritize strong content that can be refined in a second pass.';

  return `
You are the Bloom dream scenario generator.
Write vivid Chinese prose, but output JSON only.

Mode:
${modeSummary}

Hard rules:
1. Output exactly one JSON object. No markdown. No code fences. No explanations.
2. Follow the schema exactly. Do not output scene, narrative, pages, blocks, summaryNotes, or any extra keys.
3. acts must have exactly ${expectedActs} items.
4. Each act must have 5-8 sceneParagraphs. Each paragraph must be a complete Chinese paragraph, not a fragment.
5. sceneParagraphs together must form the full act scene. Do not write decorative one-line fragments only.
6. Each act must have exactly 3 choices with non-empty title, direction, detail, reactionHint, storyPush, and emotion.
7. If a storyFrame field is not needed, return an empty string instead of inventing extra lore.
8. Keep the selected tags as hard constraints. Do not narrate the tag names directly inside the prose.
9. Keep the character persona, tone, boundaries, and emotional reaction logic consistent with the brief.
10. Every act must move the same dream forward through action, dialogue, pressure, hesitation, and consequence.
11. Do not repeat the same content in multiple fields. The real prose body belongs only inside sceneParagraphs.
12. Use Chinese for all user-facing prose and field values.

Quality rules:
- Open with something already happening now.
- Let world details matter through concrete action instead of explanation dumps.
- Keep relationship movement visible through response, distance, interruption, care, restraint, or risk.
- At least one short exchange with subtext should appear in each act.
- Let choices differ in both plot direction and relationship temperature.
- Avoid empty dream cliches and generic abstract filler.

Persona guardrails:
${personaGuardrails}

Persona floor:
${personaFloorSummary}

World-book conflict policy:
${worldBookGuardrails}

Current dream domain:
- name: ${domain.name}
- subtitle: ${domain.subtitle || 'n/a'}
- description: ${domain.description || 'n/a'}
- domain rule: ${domainRule}

Variation pack:
- openingImage: ${variation.openingImage}
- triggerEvent: ${variation.triggerEvent}
- hiddenHook: ${variation.hiddenHook}
- pressureSource: ${variation.pressureSource}
- emotionalCurrent: ${variation.emotionalCurrent}

Character baseline:
- name: ${options.character.remarkName?.trim() || options.character.name}
- corePersona: ${characterContext.corePersona || 'n/a'}
- expressionStyle: ${characterContext.expressionStyle || 'n/a'}
- boundaryPack: ${characterContext.boundaryPack || 'n/a'}
- extendedLore: ${characterContext.extendedLore || 'n/a'}
- maskContext: ${maskPrompt}

World-book context:
- conflictTrim: ${worldBookConflictSummary}
- compatibleDetails: ${worldBookPrompt}

Memory:
- shortTerm: ${memoryLayers.shortTermSummary || 'n/a'}
- longTerm: ${memoryLayers.longTermMemoryProfile || 'n/a'}

Dream selection:
- entryMode: ${resolvedSelection.entryMode}
- depth: ${resolvedSelection.depth}
- supplementNote: ${supplementNoteSummary}

Tag summary:
${tagSummary || 'n/a'}

Tag mapping:
- background: ${tagCategoryContext.background.join(' / ') || 'n/a'}
- identity: ${tagCategoryContext.identities.join(' / ') || 'n/a'}
- relationship: ${tagCategoryContext.relationships.join(' / ') || 'n/a'}
- drive: ${tagCategoryContext.drives.join(' / ') || 'n/a'}
- mood: ${tagCategoryContext.moods.join(' / ') || 'n/a'}

Schema:
${buildCompactScenarioSchema(expectedActs)}
`.trim();
}

export function buildDreamScenarioCompactRepairPrompt(args: {
  options: GenerateDreamScenarioOptions;
  seed: string;
  draftSource: string;
  issues: string[];
}) {
  const promptInput = buildDreamPromptInput(args.options);
  const {
    characterContext,
    resolvedSelection,
    domainRule,
    personaFloorSummary,
    supplementNoteSummary,
    tagCategoryContext,
  } = promptInput;
  const personaGuardrails = buildDreamPersonaGuardrails(characterContext);
  const domain = resolveDreamDomainDisplay(resolvedSelection.domainId);
  const tagSummary = buildDreamTagSummary(resolvedSelection.selectedTags, resolvedSelection.customTags);
  const expectedActs = resolveExpectedActs(args.options);
  const issueList = args.issues.length > 0
    ? args.issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')
    : '1. Tighten the structure and return the exact compact schema.';

  return `
You are the Bloom dream scenario repairer.
Return JSON only.

Task:
Repair or restitch the draft into the exact compact schema for the app.
Preserve the same dream, act order, emotional direction, and Chinese prose whenever possible.

Hard rules:
1. Output exactly one JSON object. No markdown. No explanations.
2. acts must have exactly ${expectedActs} items.
3. Every act must have 5-8 sceneParagraphs and exactly 3 choices.
4. Do not output scene, narrative, pages, or blocks.
5. If a field is missing, fill it minimally but coherently.
6. If the draft is malformed, use the surviving content plus the original brief to rebuild a valid compact JSON.
7. Keep the selected tags, character persona, and dream relationship logic intact.

Problems to fix:
${issueList}

Original brief:
- character: ${args.options.character.remarkName?.trim() || args.options.character.name}
- domain: ${domain.name}
- domainRule: ${domainRule}
- depth: ${resolvedSelection.depth}
- supplementNote: ${supplementNoteSummary}
- tagSummary:
${tagSummary || 'n/a'}
- backgroundTags: ${tagCategoryContext.background.join(' / ') || 'n/a'}
- identityTags: ${tagCategoryContext.identities.join(' / ') || 'n/a'}
- relationshipTags: ${tagCategoryContext.relationships.join(' / ') || 'n/a'}
- driveTags: ${tagCategoryContext.drives.join(' / ') || 'n/a'}
- moodTags: ${tagCategoryContext.moods.join(' / ') || 'n/a'}

Persona guardrails:
${personaGuardrails}

Persona floor:
${personaFloorSummary}

Draft source:
${args.draftSource.slice(0, 16000)}

Schema:
${buildCompactScenarioSchema(expectedActs)}
`.trim();
}
