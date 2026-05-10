import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildDreamScenarioCompactPrompt, buildDreamScenarioCompactRepairPrompt } from './buildDreamScenarioCompactPrompt';
import { parseCompactDreamScenarioResult } from './dreamScenarioCompactRuntime';
import type { DreamRuntimeScenario, GenerateDreamScenarioOptions } from './dreamRuntimeTypes';

function buildDreamScenarioSeed(options: GenerateDreamScenarioOptions) {
  return `${options.character.id}-${options.selection.domainId}-${options.selection.depth}-${options.selection.entryMode}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function resolveCompactExpectedActs(options: GenerateDreamScenarioOptions) {
  return options.selection.depth === 'deep' ? 4 : 4;
}

async function requestCompactScenario(options: GenerateDreamScenarioOptions, prompt: string, maxOutputTokens: number) {
  return generateTextFromMessagesWithConfig({
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
    temperature: 0.94,
    maxOutputTokens,
  });
}

function logCompactScenarioValidation(label: string, result: ReturnType<typeof parseCompactDreamScenarioResult>) {
  console.info(label, {
    isValid: result.isValid,
    hasRuntimeScenario: Boolean(result.runtimeScenario),
    issueCount: result.issues.length,
    repairIssueCount: result.repairIssueCount,
    qualityIssueCount: result.qualityIssueCount,
    issues: result.issues.slice(0, 6),
  });
}

export async function generateDreamScenario(options: GenerateDreamScenarioOptions): Promise<DreamRuntimeScenario> {
  const seed = buildDreamScenarioSeed(options);
  const expectedActs = resolveCompactExpectedActs(options);
  const generationMode = options.generationMode || 'light';

  const draftRaw = await requestCompactScenario(
    options,
    buildDreamScenarioCompactPrompt(options, seed, generationMode === 'woven' ? 'woven-draft' : 'light'),
    generationMode === 'woven' ? 14000 : 12000,
  );

  const draftResult = parseCompactDreamScenarioResult({
    raw: draftRaw,
    selection: options.selection,
    expectedActs,
    seed,
    depth: options.selection.depth,
    entryMode: options.selection.entryMode,
    domainId: options.selection.domainId,
  });
  logCompactScenarioValidation('[dream][scenario] compact:draft', draftResult);

  if (generationMode === 'light') {
    if (draftResult.runtimeScenario) {
      return draftResult.runtimeScenario;
    }

    throw new Error(
      draftResult.issues[0]
      || '轻入梦已生成内容，但结构整理失败。',
    );
  }

  if (draftResult.runtimeScenario && !draftResult.needsRepair) {
    return draftResult.runtimeScenario;
  }

  const repairedRaw = await requestCompactScenario(
    options,
    buildDreamScenarioCompactRepairPrompt({
      options,
      seed,
      draftSource: draftRaw,
      issues: draftResult.issues,
    }),
    14000,
  );

  const repairedResult = parseCompactDreamScenarioResult({
    raw: repairedRaw,
    selection: options.selection,
    expectedActs,
    seed,
    depth: options.selection.depth,
    entryMode: options.selection.entryMode,
    domainId: options.selection.domainId,
  });
  logCompactScenarioValidation('[dream][scenario] compact:repair', repairedResult);

  if (repairedResult.runtimeScenario && (!repairedResult.needsRepair || !draftResult.runtimeScenario)) {
    return repairedResult.runtimeScenario;
  }

  if (draftResult.runtimeScenario) {
    return draftResult.runtimeScenario;
  }

  throw new Error(
    repairedResult.issues[0]
    || draftResult.issues[0]
    || '织成篇结构整理失败。',
  );
}
