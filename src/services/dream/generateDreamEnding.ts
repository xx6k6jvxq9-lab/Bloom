import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import type { Character, ApiConfig, Mask, WorldBookEntry } from '../../types';
import type { DreamEndingOutput, DreamRuntimeScenario, DreamSelection } from './dreamRuntimeTypes';
import { parseJsonResponse } from './dreamRuntimeNormalize';
import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';

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

const endingStyleExamples = [
  '冬天会周而复始，该重逢的人会再重逢，所以不必总惦记遗憾，而要学会等待。',
  '他转过身去，看着远处那艘亮着灯的船，让沉默替他们把最后一句话说完。',
  '日出未必意味着光明，但当我们仍然醒着时，破晓就已经开始了。',
];

function compactText(text: string | undefined, maxLength: number) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'n/a';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function buildActsSummary(scenario: DreamRuntimeScenario) {
  return scenario.acts
    .slice(-4)
    .map((act, index, arr) => [
      `${scenario.acts.length - arr.length + index + 1}. ${act.label}`,
      `- scene: ${compactText(act.scene, 120)}`,
      `- consequence: ${compactText(act.progression.consequence, 72)}`,
      `- plotAdvance: ${compactText(act.progression.plotAdvance, 72)}`,
    ].join('\n'))
    .join('\n\n');
}

function buildDecisionSummary(scenario: DreamRuntimeScenario, userName: string) {
  return scenario.decisionTrail
    .slice(-4)
    .map((record, index, arr) => [
      `${scenario.decisionTrail.length - arr.length + index + 1}. ${record.actLabel}`,
      `- ${(userName || '用户').trim()} choice: ${compactText(record.title, 36)}`,
      `- direction: ${compactText(record.direction, 48)}`,
      `- detail: ${compactText(record.detail, 64)}`,
      `- storyPush: ${compactText(record.storyPush, 64)}`,
    ].join('\n'))
    .join('\n\n');
}

function buildEndingPrompt(options: GenerateDreamEndingOptions) {
  const { scenario, selection, character, userName } = options;
  const domain = resolveDreamDomainDisplay(selection.domainId);
  const tagSummary = buildDreamTagSummary(selection.selectedTags);
  const actSummary = buildActsSummary(scenario);
  const decisionSummary = buildDecisionSummary(scenario, userName);

  return `
你是 Bloom 梦境 App 的结局生成器。你的任务不是总结剧情，而是为这一整场梦写出真正的结尾页文案。

你只需要学习这些样例的“结尾摘录感”，不要复用原句：
${endingStyleExamples.map((example, index) => `${index + 1}. ${example}`).join('\n')}

输出目标：
1. title：2-6 字，像结局名，不像系统标签。
2. body：80-140 字，承接前文，把这场梦收住。
3. excerpt：28-72 字，适合单独截出来读，要有结尾摘录感。
4. chapter：2-8 字，像这一局梦的篇名。

硬规则：
1. 必须承接整局剧情、最近几幕推进、用户选择和关系变化。
2. 不能写成“你获得了某结局”“本局结束”这种系统提示。
3. 不要重新解释世界观，不要鸡汤化。
4. 可以留白，但必须有收束感和余波感。
5. 只输出 JSON，不要输出 markdown。

当前梦信息：
- domain: ${domain.name}
- depth: ${scenario.depth}
- coverTitle: ${compactText(scenario.coverTitle, 32)}
- worldTitle: ${compactText(scenario.storyFrame.worldTitle, 32)}
- userDreamIdentity: ${compactText(scenario.storyFrame.userDreamIdentity, 36)}
- characterDreamIdentity: ${compactText(scenario.storyFrame.characterDreamIdentity, 36)}
- dreamRelationship: ${compactText(scenario.storyFrame.dreamRelationship, 40)}
- storyObjective: ${compactText(scenario.storyFrame.storyObjective, 52)}
- coreConflict: ${compactText(scenario.storyFrame.coreConflict, 52)}
- endingDirection: ${compactText(scenario.endingInput.endingDirection, 40)}
- keyActionSummary: ${compactText(scenario.endingInput.keyActionSummary, 96)}
- characterName: ${character.remarkName?.trim() || character.name}
- userName: ${userName.trim() || '你'}

标签摘要：
${compactText(tagSummary, 180)}

最近剧情摘要：
${actSummary || 'n/a'}

最近选择轨迹：
${decisionSummary || 'n/a'}

输出 JSON：
{
  "title": "2-6字标题",
  "body": "80-140字正文",
  "excerpt": "28-72字摘录",
  "chapter": "2-8字篇名"
}
`.trim();
}

export async function generateDreamEnding(options: GenerateDreamEndingOptions): Promise<DreamEndingOutput> {
  const prompt = buildEndingPrompt(options);
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
  });

  const parsed = parseJsonResponse<RawEndingOutput>(raw);
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
