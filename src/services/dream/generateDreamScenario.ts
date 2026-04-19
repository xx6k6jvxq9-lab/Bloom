import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildDreamPromptInput } from './buildDreamPromptInput';
import { buildDreamScenarioPrompt } from './buildDreamScenarioPrompt';
import { buildPresentation, computeShallowActCount, parseJsonResponse, toAct, type RawScenario } from './dreamRuntimeNormalize';
import type { DreamRuntimeScenario, GenerateDreamScenarioOptions } from './dreamRuntimeTypes';

export async function generateDreamScenario(options: GenerateDreamScenarioOptions): Promise<DreamRuntimeScenario> {
  const promptInput = buildDreamPromptInput(options);
  const seed = `${options.character.id}-${promptInput.resolvedSelection.domainId}-${promptInput.resolvedSelection.depth}-${promptInput.resolvedSelection.entryMode}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const prompt = buildDreamScenarioPrompt(options, seed);
  const expectedActs =
    promptInput.resolvedSelection.depth === 'deep'
      ? 4
      : computeShallowActCount(`${options.character.id}-${promptInput.resolvedSelection.domainId}-${promptInput.resolvedSelection.entryMode}`);
  const presentation = buildPresentation(seed);

  const raw = await generateTextFromMessagesWithConfig({
    activeConfig: options.activeConfig,
    messages: [
      {
        role: 'system',
        content: '你是一个严格输出 JSON 的梦境剧情生成器。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.98,
    maxOutputTokens: 7800,
  });

  const parsed = parseJsonResponse<RawScenario>(raw);
  const normalizedActs = Array.from({ length: expectedActs }, (_, index) => toAct(parsed.acts?.[index] || {}, index, presentation));

  return {
    id: `dream-${promptInput.resolvedSelection.domainId}-${promptInput.resolvedSelection.depth}-${Date.now()}`,
    coverTitle: parsed.coverTitle?.trim() || '今夜',
    coverSubtitle: parsed.coverSubtitle?.trim() || '',
    confirmHint: parsed.confirmHint?.trim() || '',
    depth: promptInput.resolvedSelection.depth,
    entryMode: promptInput.resolvedSelection.entryMode,
    domainId: promptInput.resolvedSelection.domainId,
    storyFrame: {
      worldTitle: parsed.storyFrame?.worldTitle?.trim() || '',
      worldSummary: parsed.storyFrame?.worldSummary?.trim() || '',
      userDreamIdentity: parsed.storyFrame?.userDreamIdentity?.trim() || '',
      characterDreamIdentity: parsed.storyFrame?.characterDreamIdentity?.trim() || '',
      dreamRelationship: parsed.storyFrame?.dreamRelationship?.trim() || '',
      openingNode: parsed.storyFrame?.openingNode?.trim() || '',
      storyObjective: parsed.storyFrame?.storyObjective?.trim() || '',
      coreConflict: parsed.storyFrame?.coreConflict?.trim() || '',
      realityAnchor: parsed.storyFrame?.realityAnchor?.trim() || '',
      timeNode: parsed.storyFrame?.timeNode?.trim() || '',
      currentCrisis: parsed.storyFrame?.currentCrisis?.trim() || '',
      forbiddenRule: parsed.storyFrame?.forbiddenRule?.trim() || '',
      immediateGoal: parsed.storyFrame?.immediateGoal?.trim() || '',
    },
    presentation,
    acts: normalizedActs,
    endingInput: {
      titlePoolKey: parsed.endingInput?.titlePoolKey?.trim() || 'default',
      endingDirection: parsed.endingInput?.endingDirection?.trim() || '',
      keyActionSummary: parsed.endingInput?.keyActionSummary?.trim() || '',
    },
    aftermathInput: {
      relationshipShift: parsed.aftermathInput?.relationshipShift?.trim() || '',
      toneDrift: parsed.aftermathInput?.toneDrift?.trim() || '',
      messagePreviewDirection: parsed.aftermathInput?.messagePreviewDirection?.trim() || '',
    },
  };
}
