import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { buildCharacterCoreSection, type CharacterCoreSectionsInput } from '../character/characterCore';
import type { MemoryContextInput } from '../character/memoryContext';
import { FORUM_SCENARIO_PROMPT } from '../scenarios/forum';
import type { ForumChannel, ForumThreadType } from '../../../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS, FORUM_THREAD_TYPE_LABELS, getForumWorldTheme } from '../../../../features/forum-domain/constants';

export type BuildForumThreadPromptOptions = {
  task?: 'generate_thread' | 'rewrite_same_topic';
  channel: ForumChannel;
  threadType?: ForumThreadType;
  userSeed: string;
  titleHint?: string;
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: MemoryContextInput;
  sections?: string[];
};

function buildForumMemorySection(memoryContext: MemoryContextInput = {}): string {
  const lines = [
    '## 论坛语境参考',
    memoryContext.shortTermSummary?.trim()
      ? `近期关系余波：${memoryContext.shortTermSummary.trim()}`
      : '',
    memoryContext.longTermMemoryProfile?.trim()
      ? `长期印象参考：${memoryContext.longTermMemoryProfile.trim()}`
      : '',
    memoryContext.perceptionPrompt?.trim()
      ? `当前生活底色：${memoryContext.perceptionPrompt.trim()}`
      : '',
    '这些信息只用于帮助你理解发帖时的情绪和关系语境，不要把它们写成解释句。',
  ].filter(Boolean);

  return lines.join('\n');
}

function buildForumTaskSection(options: BuildForumThreadPromptOptions): string {
  const theme = getForumWorldTheme(options.channel);
  const lines = [
    '## 发帖任务',
    `任务类型：${options.task === 'rewrite_same_topic' ? '同题多世界改写' : '论坛发帖生成'}`,
    `目标世界门：${FORUM_CHANNEL_LABELS[options.channel]}`,
    `帖子类型：${FORUM_THREAD_TYPE_LABELS[options.threadType ?? 'normal']}`,
    options.titleHint?.trim() ? `标题提示：${options.titleHint.trim()}` : '',
    `用户原始想法：${options.userSeed.trim()}`,
    theme ? `该世界核心矛盾：${theme.coreConflicts.join('、')}` : '',
    theme ? `该世界语气关键词：${theme.toneKeywords.join('、')}` : '',
    theme?.exampleTopics?.length ? `该世界参考话题：${theme.exampleTopics.join('；')}` : '',
    '输出目标：给出一条可以直接发布的论坛帖子。',
    '如果适合有标题，就先给标题再给正文；如果更像树洞短帖，也可以只给正文。',
    '不要写解释，不要写分析，不要写“建议发布为”。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildForumThreadPrompt(options: BuildForumThreadPromptOptions): string {
  const sections = [
    EXISTENCE_PROMPT,
    buildCharacterCoreSection(options.characterCore ?? {}),
    buildForumMemorySection(options.memoryContext ?? {}),
    FORUM_SCENARIO_PROMPT,
    buildForumTaskSection(options),
    OUTPUT_RULES_PROMPT,
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
