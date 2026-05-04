import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import type { Character, ApiConfig, Mask, WorldBookEntry } from '../../types';
import type { DreamAftermathOutput, DreamSelection, DreamRuntimeScenario } from './dreamRuntimeTypes';
import { buildDreamPersonaGuardrails, buildDreamPromptInput } from './buildDreamPromptInput';
import { parseJsonResponse } from './dreamRuntimeNormalize';
import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import { buildAftermathFocusSummary, compactSummaryText } from './dreamRuntimeSummaries';

type GenerateDreamAftermathOptions = {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBooks: WorldBookEntry[];
  selection: DreamSelection;
  scenario: DreamRuntimeScenario;
  userName: string;
};

type RawAftermathOutput = Partial<DreamAftermathOutput>;

function previewDreamRawResponse(raw: string) {
  return raw.replace(/\s+/g, ' ').slice(0, 280);
}

function buildAftermathPrompt(options: GenerateDreamAftermathOptions) {
  const { scenario, selection, character, userName } = options;
  const promptInput = buildDreamPromptInput(options);
  const { characterContext } = promptInput;
  const personaGuardrails = buildDreamPersonaGuardrails(characterContext);
  const domain = resolveDreamDomainDisplay(selection.domainId);
  const tagSummary = buildDreamTagSummary(selection.selectedTags);
  const aftermathFocusSummary = buildAftermathFocusSummary(scenario);

  return `
你是 Bloom 梦境 App 的余响生成器。你的任务是根据这整场梦和它的结局，生成“醒来之后还留下了什么”。

输出目标：
1. summary：40-80 字，概括梦后留下的关系回响或心绪残响。
2. detail：45-100 字，更具体地说明这种余波如何轻微影响现实里的语气、距离感或停顿感。
3. previewMessages：两条次日聊天预览，每条 12-32 字，要像现实里真的会发出来的话。

硬规则：
1. 必须承接结局和最近几幕的推进。
2. 只能做轻微关系漂移和现实语气偏移，不能把梦中临时身份直接写回现实。
3. previewMessages 要像聊天，不要写成系统说明。
4. 语气要克制，不要大起大落。
5. 只输出 JSON，不要输出 markdown。

Persona guardrails:
${personaGuardrails}

Current dream info:
- domain: ${domain.name}
- depth: ${scenario.depth}
- worldTitle: ${compactSummaryText(scenario.storyFrame.worldTitle, 32) || 'n/a'}
- dreamRelationship: ${compactSummaryText(scenario.storyFrame.dreamRelationship, 36) || 'n/a'}
- relationshipShiftHint: ${compactSummaryText(scenario.aftermathInput.relationshipShift, 32) || 'n/a'}
- toneDriftHint: ${compactSummaryText(scenario.aftermathInput.toneDrift, 32) || 'n/a'}
- messagePreviewHint: ${compactSummaryText(scenario.aftermathInput.messagePreviewDirection, 32) || 'n/a'}
- endingTitle: ${compactSummaryText(scenario.endingOutput?.title || scenario.storyFrame.worldTitle || scenario.coverTitle, 32) || 'n/a'}
- characterName: ${character.remarkName?.trim() || character.name}
- userName: ${userName.trim() || '你'}

标签摘要：${compactSummaryText(tagSummary, 120) || 'n/a'}

余响摘要：${aftermathFocusSummary || 'n/a'}

输出 JSON：
{
  "summary": "40-80字",
  "detail": "45-100字",
  "previewMessages": [
    "第一条聊天预览",
    "第二条聊天预览"
  ]
}
`.trim();
}

export async function generateDreamAftermath(options: GenerateDreamAftermathOptions): Promise<DreamAftermathOutput> {
  const prompt = buildAftermathPrompt(options);
  console.info('[dream][aftermath] model:start', {
    scenarioId: options.scenario.id,
    depth: options.selection.depth,
    hasEndingOutput: Boolean(options.scenario.endingOutput),
  });
  const raw = await generateTextFromMessagesWithConfig({
    activeConfig: options.activeConfig,
    messages: [
      {
        role: 'system',
        content: '你是一个严格输出 JSON 的梦后余响生成器。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.82,
    maxOutputTokens: 900,
    timeoutMs: 22000,
  });
  console.info('[dream][aftermath] model:raw', {
    scenarioId: options.scenario.id,
    preview: previewDreamRawResponse(raw),
    rawLength: raw.length,
  });

  const parsed = parseJsonResponse<RawAftermathOutput>(raw);
  console.info('[dream][aftermath] model:parsed', {
    scenarioId: options.scenario.id,
    keys: Object.keys(parsed || {}),
  });
  const summary = parsed.summary?.trim() || options.scenario.aftermathInput.relationshipShift || '这场梦会在醒来后留下轻微的关系回响。';
  const detail = parsed.detail?.trim() || options.scenario.aftermathInput.toneDrift || options.scenario.aftermathInput.messagePreviewDirection || '明日的聊天语气会沿着这场梦发生偏移。';
  const previewCandidates = (parsed.previewMessages || [])
    .map((message) => message?.trim() || '')
    .filter(Boolean)
    .slice(0, 2);

  const previewMessages: [string, string] = [
    previewCandidates[0] || options.scenario.aftermathInput.messagePreviewDirection || '我还记得昨晚梦里的那一段。',
    previewCandidates[1] || options.scenario.storyFrame.openingNode || '你醒来之后，会先想起哪个瞬间？',
  ];

  return {
    summary,
    detail,
    previewMessages,
  };
}
