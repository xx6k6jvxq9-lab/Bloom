import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import type { MemoryContextInput } from '../character/memoryContext';
import { MOMENTS_SCENARIO_PROMPT } from '../scenarios/moments';

export type BuildMomentsPromptOptions = {
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: MemoryContextInput;
  liveContext?: {
    temporalContext?: string;
    recentConversationLines?: string[];
    recentMomentLines?: string[];
  };
  postContext?: {
    signature?: string;
    relationship?: string;
    maxLength?: number;
    allowImages?: boolean;
    styleHints?: string[];
    triggerReason?: string;
    factBoundaryLines?: string[];
  };
  sections?: string[];
};

function buildMomentsMemorySection(memoryContext: MemoryContextInput = {}): string {
  const lines = [
    '## 动态记忆与生活语境',
    '动态可以吃到角色的人设、短期余波和长期记忆，但不要默认围着用户转。',
    '优先把这些上下文翻译成角色自己的公开状态、生活碎片、观察、兴趣、身体感受或当下情绪，不要写成私聊外溢。',
    'Use the shared character context as public-life context, not as private dialogue residue.',
    'If something relates to the user, translate it into public-facing aftertaste, tease, stance, jealousy, flirtation, or hint.',
    memoryContext.sharedCharacterStatePrompt?.trim()
      ? `公开生活状态：${memoryContext.sharedCharacterStatePrompt.trim()}`
      : '',
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

function buildLiveContextSection(liveContext: BuildMomentsPromptOptions['liveContext'] = {}): string {
  const recentConversationLines = (liveContext.recentConversationLines || []).filter(Boolean);
  const recentMomentLines = (liveContext.recentMomentLines || []).filter(Boolean);
  const hasLiveContext = !!liveContext.temporalContext?.trim()
    || recentConversationLines.length > 0
    || recentMomentLines.length > 0;

  if (!hasLiveContext) {
    return '';
  }

  const lines = [
    '## 本轮动态的活体上下文',
    liveContext.temporalContext?.trim() ? `当前时间约束：${liveContext.temporalContext.trim()}` : '',
    recentConversationLines.length > 0 ? '最近聊天片段（只能转译成公开可见的生活状态、事件余波或情绪，不要照抄私聊原话）：' : '',
    ...recentConversationLines.map((line) => `- ${line}`),
    recentMomentLines.length > 0 ? '最近动态去重提醒：' : '',
    ...recentMomentLines.map((line) => `- ${line}`),
    '如果这些上下文不够支撑一条真实动态，就不要硬编一个看起来正确但实际空泛的句子。',
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
    `配图提及：${postContext.allowImages ? '可以自然提到照片、截图、相册、配图，但不要强依赖。' : '默认不要刻意提配图。'}`,
    postContext.styleHints?.length ? `风格提示：${postContext.styleHints.join('；')}` : '',
    'Real-world anchor requirement: every post should land on at least one concrete anchor such as place, object, weather, body state, clothing, food, work detail, visible scene, pet, mirror, room, gym, desk, street, or store.',
    'If this post leans toward photo / multi-photo vibes, write like a real caption after real photos, not like an image-description card or a poster title block.',
    'If this post is directly about the user, keep it publicly legible: hint, tease, flirt, stake a claim, be jealous, be petty, or let the line land on them without turning into direct second-person chat.',
    'Allow more than one motive: life sharing, complaint, work note, hot-take, abstract joke, flirtation, jealousy, public preference, food post, outfit post, workout post, long reflection.',
    '表达目标：像角色自己会发出去的公开动态，而不是写给用户的一段聊天回复。',
    '输出要求：只给出可发布正文，不要标题、解释、任务说明或附注。',
  ].filter(Boolean);

  return lines.join('\n');
}

function buildFactBoundarySection(postContext: BuildMomentsPromptOptions['postContext'] = {}): string {
  const lines = postContext.factBoundaryLines?.filter(Boolean) || [];
  if (lines.length === 0) {
    return '';
  }

  return [
    '## 事实边界与受控扩写',
    ...lines,
  ].join('\n');
}

export function buildMomentsPrompt(options: BuildMomentsPromptOptions = {}): string {
  const sections = [
    EXISTENCE_PROMPT,
    buildCharacterCoreSection(options.characterCore ?? {}),
    buildMomentsMemorySection(options.memoryContext ?? {}),
    buildLiveContextSection(options.liveContext),
    MOMENTS_SCENARIO_PROMPT,
    buildPostContextSection(options.postContext),
    buildFactBoundarySection(options.postContext),
    OUTPUT_RULES_PROMPT,
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
