import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { FORUM_SCENARIO_PROMPT } from '../scenarios/forum';
import type { ForumChannel } from '../../../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS, getForumWorldTheme } from '../../../../features/forum-domain/constants';

export type ForumReplyParticipantHint = {
  displayName: string;
  persona?: string;
  speakingStyle?: string;
  preferredMove?: string;
};

export type BuildForumReplyPromptOptions = {
  channel: ForumChannel;
  threadTitle?: string;
  threadBody: string;
  floorContext?: string[];
  replyCount?: number;
  styleHints?: string[];
  participants?: ForumReplyParticipantHint[];
  userNewComment?: string;
  userNewCommentAuthorName?: string;
  userNewCommentFloor?: number;
  replyMode?: 'mixed' | 'independent_only' | 'threaded_only';
};

function buildReplyModeGuidance(mode: BuildForumReplyPromptOptions['replyMode']): string[] {
  if (mode === 'independent_only') {
    return [
      '本轮全部生成独立评论，不要写成楼中楼回复。',
      '每条都像新进来围观的网友在主楼下接一句话。',
    ];
  }

  if (mode === 'threaded_only') {
    return [
      '本轮全部生成楼中楼回复，必须明确接某一层，不要全都写成独立评论。',
      '如果提供了用户刚发的新评论，至少一半回复要直接围着那条用户评论展开。',
    ];
  }

  return [
    '本轮使用混合模式：独立评论和楼中楼回复都要有。',
    '如果提供了用户刚发的新评论，至少要有一到两条回复直接接这条用户评论。',
  ];
}

function buildParticipantSection(options: BuildForumReplyPromptOptions): string {
  if (!options.participants?.length) return '';

  return [
    '## 本轮可能出场的网友',
    ...options.participants.map((participant) => {
      const parts = [
        participant.displayName,
        participant.persona?.trim() ? `人设：${participant.persona.trim()}` : '',
        participant.speakingStyle?.trim() ? `说话方式：${participant.speakingStyle.trim()}` : '',
        participant.preferredMove?.trim() ? `更常见动作：${participant.preferredMove.trim()}` : '',
      ].filter(Boolean);
      return `- ${parts.join('；')}`;
    }),
    '优先让回帖像这些人会说的话，而不是随机路人统一开口。',
  ].join('\n');
}

function buildTaskSection(options: BuildForumReplyPromptOptions): string {
  const theme = getForumWorldTheme(options.channel);
  const modeGuidance = buildReplyModeGuidance(options.replyMode);
  const userCommentTarget = options.userNewComment?.trim()
    ? [
        '## 本轮优先接住的用户新评论',
        options.userNewCommentFloor ? `目标楼层：${options.userNewCommentFloor}L` : '',
        options.userNewCommentAuthorName?.trim() ? `发言人：${options.userNewCommentAuthorName.trim()}` : '',
        `评论内容：${options.userNewComment.trim()}`,
        '第一条回帖必须直接接这条用户新评论，不要先去总结主楼，也不要先绕去接别人的话。',
        options.userNewCommentFloor
          ? `如果你要写楼中楼，第一条优先写成“回复 ${options.userNewCommentFloor}L @某某 | 显示名 | 内容”。`
          : '如果你要写楼中楼，第一条优先直接回复这条用户新评论。',
      ].filter(Boolean).join('\n')
    : '';
  const lines = [
    '## 回帖任务',
    `目标频道：${FORUM_CHANNEL_LABELS[options.channel]}`,
    options.threadTitle?.trim() ? `帖子标题：${options.threadTitle.trim()}` : '',
    `帖子正文：${options.threadBody.trim()}`,
    theme ? `频道语气关键词：${theme.toneKeywords.join('、')}` : '',
    theme ? `频道关系冲突：${theme.coreConflicts.join('、')}` : '',
    options.floorContext?.length ? `已有楼层参考：${options.floorContext.join(' | ')}` : '',
    userCommentTarget,
    options.styleHints?.length ? `补充风格提示：${options.styleHints.join('、')}` : '',
    `生成数量：${options.replyCount ?? 3} 条`,
    ...modeGuidance,
    '回帖必须像论坛现场，不要像标准答案。',
    '同一轮回帖不要全站同一个立场，至少自然分成两到三种气氛，比如护短、看戏、怀疑、补刀、顺着嗑。',
    '允许短句、反问、补刀、接梗、护短、阴阳怪气，但不要所有人都一个语气。',
    '如果有“用户刚发的新评论”，优先理解那句话真正关心的点，再围绕那个点回应，不要只抓表面词重复。',
    '不要把每条都写成长分析，论坛回帖允许只抓一个点。',
    '回复别人的时候，要真的像在接那一层的话，而不是重新复述主楼。',
    '不要所有回复都只盯着同一层，也不要所有人都很礼貌完整。',
    '单条回帖尽量控制在一到三句内。',
    options.userNewComment?.trim()
      ? '如果本轮有一条回复最应该被用户先看到，那条就应该是直接接用户最新评论的那条。'
      : '',
    '输出格式必须逐行输出，每行一条，只能用下面两种格式之一：',
    '独立评论 | 显示名 | 内容',
    '回复 3L @某某 | 显示名 | 内容',
    '第一列只能写“独立评论”或“回复 X L @某某”这种回复目标，不要写别的标签。',
    '第二列只写显示名，不要把身份说明塞进去。',
    '第三列只写评论正文，不要写解释。',
    '不要编号，不要额外说明。',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildForumReplyPrompt(options: BuildForumReplyPromptOptions): string {
  return [
    FORUM_SCENARIO_PROMPT,
    buildParticipantSection(options),
    buildTaskSection(options),
    OUTPUT_RULES_PROMPT,
  ].filter(Boolean).join('\n\n');
}
