import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import type { Character, ApiConfig, Mask, WorldBookEntry } from '../../types';
import type { DreamEndingOutput, DreamRuntimeScenario, DreamSelection } from './dreamRuntimeTypes';
import { buildDreamPersonaGuardrails, buildDreamPromptInput } from './buildDreamPromptInput';
import { parseJsonResponse } from './dreamRuntimeNormalize';
import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import { buildEndingFocusSummary, compactSummaryText } from './dreamRuntimeSummaries';

type GenerateDreamEndingOptions = {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBooks: WorldBookEntry[];
  selection: DreamSelection;
  scenario: DreamRuntimeScenario;
  userName: string;
};

type RawEndingOutput = Partial<DreamEndingOutput>;

function previewDreamRawResponse(raw: string) {
  return raw.replace(/\s+/g, ' ').slice(0, 280);
}

const endingStyleExamples = [
  '冬天会周而复始，该重逢的人会再重逢，所以不必总惦记遗憾，而要学会等待。',
  '他转过身去，看着远处那盏亮着灯的船，让沉默替他们把最后一句话说完。',
  '日出未必意味着光明，但当我们仍然醒着时，破晓就已经开始了。',
];

function buildEndingPrompt(options: GenerateDreamEndingOptions) {
  const { scenario, selection, character, userName } = options;
  const promptInput = buildDreamPromptInput(options);
  const { characterContext } = promptInput;
  const personaGuardrails = buildDreamPersonaGuardrails(characterContext);
  const domain = resolveDreamDomainDisplay(selection.domainId);
  const tagSummary = buildDreamTagSummary(selection.selectedTags);
  const endingFocusSummary = buildEndingFocusSummary(scenario);

  return `
你是 Bloom 梦境 App 的结局生成器。你的任务不是总结剧情，而是为这整场梦写出真正的结尾页文案。
你只需要学习这些样例的“结尾摘句感”，不要复用原句：
${endingStyleExamples.map((example, index) => `${index + 1}. ${example}`).join('\n')}

输出目标：
1. title：2-6 字，像结局名，不像系统标签。
2. body：80-140 字，承接前文，把这场梦收住。
3. excerpt：28-72 字，适合单独摘出来读，要有结尾摘句感。
4. chapter：2-8 字，像这一局梦的篇名。

硬规则：
1. 必须承接整局剧情、最近几幕推进、用户选择和关系变化。
2. 不能写成“你获得了某结局”“本局结束”这种系统提示。
3. 不要重新解释世界观，不要鸡汤化。
4. 可以留白，但必须有收束感和余波感。
5. 只输出 JSON，不要输出 markdown。

Persona guardrails:
${personaGuardrails}

Current dream info:
- domain: ${domain.name}
- depth: ${scenario.depth}
- coverTitle: ${compactSummaryText(scenario.coverTitle, 32) || 'n/a'}
- worldTitle: ${compactSummaryText(scenario.storyFrame.worldTitle, 32) || 'n/a'}
- userDreamIdentity: ${compactSummaryText(scenario.storyFrame.userDreamIdentity, 36) || 'n/a'}
- characterDreamIdentity: ${compactSummaryText(scenario.storyFrame.characterDreamIdentity, 36) || 'n/a'}
- dreamRelationship: ${compactSummaryText(scenario.storyFrame.dreamRelationship, 40) || 'n/a'}
- storyObjective: ${compactSummaryText(scenario.storyFrame.storyObjective, 52) || 'n/a'}
- coreConflict: ${compactSummaryText(scenario.storyFrame.coreConflict, 52) || 'n/a'}
- endingDirection: ${compactSummaryText(scenario.endingInput.endingDirection, 40) || 'n/a'}
- keyActionSummary: ${compactSummaryText(scenario.endingInput.keyActionSummary, 96) || 'n/a'}
- characterName: ${character.remarkName?.trim() || character.name}
- userName: ${userName.trim() || '你'}

标签摘要：${compactSummaryText(tagSummary, 140) || 'n/a'}

结局摘要：${endingFocusSummary || 'n/a'}

输出 JSON：
{
  "title": "2-6字标题",
  "body": "80-140字正文",
  "excerpt": "28-72字摘句",
  "chapter": "2-8字篇名"
}
`.trim();
}

export async function generateDreamEnding(options: GenerateDreamEndingOptions): Promise<DreamEndingOutput> {
  const prompt = buildEndingPrompt(options);
  console.info('[dream][ending] model:start', {
    scenarioId: options.scenario.id,
    depth: options.selection.depth,
    endingDirection: options.scenario.endingInput.endingDirection || '',
  });
  const raw = await generateTextFromMessagesWithConfig({
    activeConfig: options.activeConfig,
    messages: [
      {
        role: 'system',
        content: '你是一个严格输出 JSON 的梦境结局生成器。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.82,
    maxOutputTokens: 1100,
    timeoutMs: 35000,
  });
  console.info('[dream][ending] model:raw', {
    scenarioId: options.scenario.id,
    preview: previewDreamRawResponse(raw),
    rawLength: raw.length,
  });

  const parsed = parseJsonResponse<RawEndingOutput>(raw);
  console.info('[dream][ending] model:parsed', {
    scenarioId: options.scenario.id,
    keys: Object.keys(parsed || {}),
  });
  const title = parsed.title?.trim() || options.scenario.storyFrame.worldTitle || options.scenario.coverTitle || '今夜';
  const body =
    parsed.body?.trim()
    || options.scenario.endingInput.keyActionSummary
    || `${options.scenario.storyFrame.coreConflict || '这场梦'}终于在天亮前有了落点。`;
  const excerpt = parsed.excerpt?.trim() || body;
  const rawChapter = parsed.chapter?.trim() || options.scenario.endingInput.endingDirection || options.scenario.storyFrame.dreamRelationship || '梦局未竟';
  const chapter = rawChapter.replace(/^《|》$/g, '').trim() || '梦局未竟';

  return {
    title,
    body,
    excerpt,
    chapter: `《${chapter}》`,
  };
}
