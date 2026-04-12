import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import type { MemoryContextInput } from '../character/memoryContext';
import { MOMENTS_SCENARIO_PROMPT } from '../scenarios/moments';

export type BuildMomentsPromptOptions = {
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: MemoryContextInput;
  postContext?: {
    signature?: string;
    relationship?: string;
    maxLength?: number;
    allowImages?: boolean;
    styleHints?: string[];
    triggerReason?: string;
  };
  sections?: string[];
};

function buildMomentsMemorySection(memoryContext: MemoryContextInput = {}): string {
  const lines = [
    '## 动态记忆与生活语境',
    '动态允许吃到角色的人设、短期余波和长期记忆，但不要只围着用户转。',
    '优先把这些上下文转译成角色自己的公开状态、生活切片、观察、兴趣或心情，而不是一段写给用户的私聊外溢。',
    memoryContext.shortTermSummary?.trim()
      ? `近期余波：${memoryContext.shortTermSummary.trim()}`
      : '',
    memoryContext.longTermMemoryProfile?.trim()
      ? `长期印象：${memoryContext.longTermMemoryProfile.trim()}`
      : '',
    memoryContext.perceptionPrompt?.trim()
      ? `当前生活底色：${memoryContext.perceptionPrompt.trim()}`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function buildPostContextSection(postContext: BuildMomentsPromptOptions['postContext'] = {}): string {
  const lines = [
    '## 动态发布约束',
    postContext.triggerReason ? `触发语义：${postContext.triggerReason}` : '',
    postContext.signature ? `角色签名：${postContext.signature}` : '',
    postContext.relationship ? `当前公开语境：${postContext.relationship}` : '',
    `建议长度：${postContext.maxLength ?? 50} 字以内`,
    `配图提及：${postContext.allowImages ? '可以自然提到照片、截图、配图，但不要强依赖' : '默认不要刻意提配图'}`,
    postContext.styleHints?.length ? `风格提示：${postContext.styleHints.join('；')}` : '',
    '表达倾向：更像角色自己发出的状态，而不是写给用户的一段回复。',
    '输出要求：直接给出可发布正文，不要写过渡句、解释句、任务句。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildMomentsPrompt(options: BuildMomentsPromptOptions = {}): string {
  const sections = [
    EXISTENCE_PROMPT,
    buildCharacterCoreSection(options.characterCore ?? {}),
    buildMomentsMemorySection(options.memoryContext ?? {}),
    MOMENTS_SCENARIO_PROMPT,
    buildPostContextSection(options.postContext),
    OUTPUT_RULES_PROMPT,
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
