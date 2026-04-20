import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import type { Character, ApiConfig, Mask, WorldBookEntry } from '../../types';
import type { DreamAftermathOutput, DreamRuntimeScenario, DreamSelection } from './dreamRuntimeTypes';
import { parseJsonResponse } from './dreamRuntimeNormalize';
import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';

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

function buildActsSummary(scenario: DreamRuntimeScenario) {
  return scenario.acts
    .map((act, index) => [
      `${index + 1}. ${act.label}`,
      `- scene: ${act.scene.slice(0, 180) || 'n/a'}`,
      `- consequence: ${act.progression.consequence || 'n/a'}`,
      `- plotAdvance: ${act.progression.plotAdvance || 'n/a'}`,
      `- tensionShift: ${act.progression.tensionShift || 'n/a'}`,
    ].join('\n'))
    .join('\n\n');
}

function buildDecisionSummary(scenario: DreamRuntimeScenario, userName: string) {
  return scenario.decisionTrail
    .map((record, index) => [
      `${index + 1}. ${record.actLabel}`,
      `- ${(userName || '用户').trim()} choice: ${record.title}`,
      `- direction: ${record.direction || 'n/a'}`,
      `- detail: ${record.detail || 'n/a'}`,
      `- storyPush: ${record.storyPush || 'n/a'}`,
      `- emotion: ${record.emotion || 'n/a'}`,
    ].join('\n'))
    .join('\n\n');
}

function buildAftermathPrompt(options: GenerateDreamAftermathOptions) {
  const { scenario, selection, character, userName } = options;
  const domain = resolveDreamDomainDisplay(selection.domainId);
  const tagSummary = buildDreamTagSummary(selection.selectedTags);
  const actSummary = buildActsSummary(scenario);
  const decisionSummary = buildDecisionSummary(scenario, userName);

  return `
你是 Bloom 梦境 App 的余响生成器。你的任务是根据这一整场梦与它的结局，生成“醒来之后还留下了什么”。

余响页需要：
1. summary：40-90 字，概括梦后留下的关系回响或心绪残响。
2. detail：50-120 字，更具体地说明这种余波如何轻微影响现实里的语气、距离感或停顿感。
3. previewMessages：两条次日聊天预览，每条 12-38 字，要像现实里真的会发出来的话。

硬规则：
1. 必须承接整局剧情、选择轨迹和已经生成出的结局。
2. 只能做“轻微关系漂移”和“现实语气偏移”，不能把梦中临时身份直接写回现实。
3. previewMessages 要像聊天，不要写成系统说明。
4. 语气要克制，像梦醒后的回流，不要大起大落。
5. 只输出 JSON，不要输出 markdown。

当前梦信息：
- domain: ${domain.name}
- depth: ${scenario.depth}
- worldTitle: ${scenario.storyFrame.worldTitle}
- dreamRelationship: ${scenario.storyFrame.dreamRelationship}
- endingDirection: ${scenario.endingInput.endingDirection || 'n/a'}
- relationshipShiftHint: ${scenario.aftermathInput.relationshipShift || 'n/a'}
- toneDriftHint: ${scenario.aftermathInput.toneDrift || 'n/a'}
- messagePreviewHint: ${scenario.aftermathInput.messagePreviewDirection || 'n/a'}
- endingTitle: ${scenario.endingOutput?.title || scenario.storyFrame.worldTitle || scenario.coverTitle}
- endingBody: ${scenario.endingOutput?.body || scenario.endingInput.keyActionSummary || 'n/a'}
- endingExcerpt: ${scenario.endingOutput?.excerpt || 'n/a'}
- characterName: ${character.remarkName?.trim() || character.name}
- userName: ${userName.trim() || '你'}

标签摘要：
${tagSummary || 'n/a'}

整局剧情摘要：
${actSummary}

整局选择轨迹：
${decisionSummary || 'n/a'}

输出 JSON：
{
  "summary": "40-90字",
  "detail": "50-120字",
  "previewMessages": [
    "第一条聊天预览",
    "第二条聊天预览"
  ]
}
`.trim();
}

export async function generateDreamAftermath(options: GenerateDreamAftermathOptions): Promise<DreamAftermathOutput> {
  const prompt = buildAftermathPrompt(options);
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
    temperature: 0.9,
    maxOutputTokens: 1800,
  });

  const parsed = parseJsonResponse<RawAftermathOutput>(raw);
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
