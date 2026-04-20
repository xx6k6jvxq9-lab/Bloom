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
  `冬天会周而复始，该相逢的人会再相逢。所以，我们不必总惦记遗憾，而是要学会期待。`,
  `我在她的眼睛里读到，我们原可以在一起白头偕老，永远幸福。`,
  `你追求的憧憬虽然到了手，却在到手的一刻那间，改变了面目。`,
  `为了让一切有个了结，为了使我不感到那么孤独，我还是希望我被处决的那天有很多人来观看。`,
  `他转过身去，眼睛看着远处那艘漂亮的远洋船，让他们有时间镇定一下，他等待着。`,
  `日出未必意味着光明，太阳也无非是一颗晨星而已，只有在我们醒着时，才是真正的破晓。`,
];

function buildActsSummary(scenario: DreamRuntimeScenario) {
  return scenario.acts
    .map((act, index) => [
      `${index + 1}. ${act.label}`,
      `- scene: ${act.scene.slice(0, 220) || 'n/a'}`,
      `- charState: ${act.charState || 'n/a'}`,
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
      `- ${userName || '用户'} choice: ${record.title}`,
      `- direction: ${record.direction || 'n/a'}`,
      `- detail: ${record.detail || 'n/a'}`,
      `- reaction: ${record.reaction || 'n/a'}`,
      `- storyPush: ${record.storyPush || 'n/a'}`,
      `- emotion: ${record.emotion || 'n/a'}`,
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
你是 Bloom 梦境 App 的终局结尾生成器。
你的任务不是总结剧情，而是为这一整场梦生成真正的结局页文案。

你必须学习的不是案例内容本身，而是这些案例的“结尾摘录感”：
${endingStyleExamples.map((example, index) => `${index + 1}. ${example}`).join('\n')}

结局页目标：
1. 标题：2-4 个字，像结局名，不像系统标签。
2. 正文收束 body：90-180 字，真正承接前文，把这场梦收住。
3. 梦尾摘录 excerpt：35-90 字，要有“文学作品结尾摘录感”，适合单独截图。
4. 篇名 chapter：2-8 个字，像这一局梦的篇名，不要直接抄标签。

硬规则：
1. 必须承接整局 act、用户选择、自定义输入、关系推进和主线变化。
2. 不能写成“你获得了某结局”“本局结束”这种系统提示。
3. 不能把剧情重新解释一遍，也不能鸡汤化。
4. 允许留白，但要有收束感、驻留感、余波感。
5. 输出 JSON，不要输出 markdown。

当前梦信息：
- domain: ${domain.name}
- depth: ${scenario.depth}
- coverTitle: ${scenario.coverTitle}
- worldTitle: ${scenario.storyFrame.worldTitle}
- worldSummary: ${scenario.storyFrame.worldSummary}
- userDreamIdentity: ${scenario.storyFrame.userDreamIdentity}
- characterDreamIdentity: ${scenario.storyFrame.characterDreamIdentity}
- dreamRelationship: ${scenario.storyFrame.dreamRelationship}
- storyObjective: ${scenario.storyFrame.storyObjective}
- coreConflict: ${scenario.storyFrame.coreConflict}
- endingDirection: ${scenario.endingInput.endingDirection || 'n/a'}
- keyActionSummary: ${scenario.endingInput.keyActionSummary || 'n/a'}
- characterName: ${character.remarkName?.trim() || character.name}
- userName: ${userName.trim() || '你'}

标签摘要：
${tagSummary || 'n/a'}

整局剧情摘要：
${actSummary}

整局选择轨迹：
${decisionSummary || 'n/a'}

输出 JSON 结构：
{
  "title": "2-4字结局名",
  "body": "90-180字收束正文",
  "excerpt": "35-90字梦尾摘录",
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
    temperature: 0.92,
    maxOutputTokens: 2600,
  });

  const parsed = parseJsonResponse<RawEndingOutput>(raw);
  const title = parsed.title?.trim() || options.scenario.storyFrame.worldTitle || options.scenario.coverTitle || '今夜';
  const body = parsed.body?.trim() || options.scenario.endingInput.keyActionSummary || `${options.scenario.storyFrame.coreConflict || '这场梦'}终于在天亮前有了落点。`;
  const excerpt = parsed.excerpt?.trim() || body;
  const chapter = parsed.chapter?.trim() || options.scenario.endingInput.endingDirection || options.scenario.storyFrame.dreamRelationship || '梦局未竟';

  return {
    title,
    body,
    excerpt,
    chapter: `《${chapter.replace(/^《|》$/g, '')}》`,
  };
}
