import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { FORUM_SCENARIO_PROMPT } from '../scenarios/forum';
import type { ForumChannel } from '../../../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS, getForumWorldTheme } from '../../../../features/forum-domain/constants';

export type BuildForumReplyPromptOptions = {
  channel: ForumChannel;
  threadTitle?: string;
  threadBody: string;
  floorContext?: string[];
  replyCount?: number;
  styleHints?: string[];
};

function buildForumReplyTaskSection(options: BuildForumReplyPromptOptions): string {
  const theme = getForumWorldTheme(options.channel);
  const lines = [
    '## 回帖任务',
    `目标世界门：${FORUM_CHANNEL_LABELS[options.channel]}`,
    options.threadTitle?.trim() ? `帖子标题：${options.threadTitle.trim()}` : '',
    `帖子正文：${options.threadBody.trim()}`,
    theme ? `世界语气关键词：${theme.toneKeywords.join('、')}` : '',
    theme ? `世界关系逻辑：${theme.coreConflicts.join('、')}` : '',
    options.floorContext?.length ? `已有楼层参考：${options.floorContext.join(' | ')}` : '',
    options.styleHints?.length ? `补充风格提示：${options.styleHints.join('、')}` : '',
    `生成数量：${options.replyCount ?? 3} 条`,
    '输出要求：生成多条短回帖，每条都像不同网友说的话。',
    '回复要短、碎、有网感；允许判断、吐槽、围观、插楼。',
    '不要让每条回复一个腔调，不要写成长段分析。',
    '每条单独换行输出，不加序号，不加解释。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildForumReplyPrompt(options: BuildForumReplyPromptOptions): string {
  const sections = [
    EXISTENCE_PROMPT,
    FORUM_SCENARIO_PROMPT,
    buildForumReplyTaskSection(options),
    OUTPUT_RULES_PROMPT,
  ].filter(Boolean);

  return sections.join('\n\n');
}
