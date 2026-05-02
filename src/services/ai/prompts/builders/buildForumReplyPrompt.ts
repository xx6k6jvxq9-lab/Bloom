import { FORUM_SCENARIO_PROMPT } from '../scenarios/forum';
import type { ForumChannel, ForumContentTier } from '../../../../features/forum-domain/types';
import { FORUM_CHANNEL_LABELS, getForumWorldTheme } from '../../../../features/forum-domain/constants';

export type ForumReplyParticipantHint = {
  displayName: string;
  persona?: string;
  speakingStyle?: string;
  preferredMove?: string;
  roleTag?: 'op' | 'character' | 'familiar' | 'regular' | 'seed';
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
  userIdentityMode?: 'self' | 'anonymous';
  userMaskName?: string;
  userNewCommentFloor?: number;
  userReplyTargetFloor?: number;
  userReplyTargetAuthorName?: string;
  userReplyTargetContent?: string;
  replyMode?: 'mixed' | 'independent_only' | 'threaded_only';
  threadContentTier?: ForumContentTier;
  discourseAxis?: string;
  replyRoleHints?: string[];
  originalPosterDisplayName?: string;
  originalPosterRecentReplyCount?: number;
  mustIncludeOriginalPosterReply?: boolean;
  extraContextSections?: string[];
};

function buildReplyModeGuidance(mode: BuildForumReplyPromptOptions['replyMode']): string[] {
  if (mode === 'independent_only') {
    return [
      '本轮以独立评论为主，不要全部写成楼中楼。',
      '这些评论要像新进楼围观的人顺手接一句，而不是整齐答题。',
    ];
  }

  if (mode === 'threaded_only') {
    return [
      '本轮全部写成楼中楼，必须明确接某一层，不要回到主楼泛泛总结。',
      '如果给了用户刚发的新评论，至少一半回复要直接围着那条评论往下接。',
    ];
  }

  return [
    '本轮使用混合模式，独立评论和楼中楼都要有。',
    '如果给了用户刚发的新评论，至少要有一到两条直接接住那条评论。',
  ];
}

function getRoleLabel(roleTag: ForumReplyParticipantHint['roleTag']) {
  switch (roleTag) {
    case 'op':
      return '楼主';
    case 'character':
      return '角色号';
    case 'familiar':
      return '熟脸网友';
    case 'seed':
      return '路过网友';
    default:
      return '网友';
  }
}

function buildParticipantSection(options: BuildForumReplyPromptOptions): string {
  if (!options.participants?.length) return '';

  return [
    '## 本轮可能出场的人',
    ...options.participants.map((participant) => {
      const parts = [
        participant.displayName,
        `身份：${getRoleLabel(participant.roleTag)}`,
        participant.persona?.trim() ? `人设：${participant.persona.trim()}` : '',
        participant.speakingStyle?.trim() ? `说话口气：${participant.speakingStyle.trim()}` : '',
        participant.preferredMove?.trim() ? `常见出手：${participant.preferredMove.trim()}` : '',
      ].filter(Boolean);
      return `- ${parts.join('；')}`;
    }),
    '优先让不同人说出不同味道，不要把所有回复写成同一口气。',
  ].join('\n');
}

function buildOriginalPosterSection(options: BuildForumReplyPromptOptions): string {
  if (!options.originalPosterDisplayName?.trim()) return '';

  return [
    '## 楼主参与规则',
    `楼主是：${options.originalPosterDisplayName.trim()}`,
    typeof options.originalPosterRecentReplyCount === 'number'
      ? `楼主最近几层里已经出现过 ${options.originalPosterRecentReplyCount} 次`
      : '',
    options.mustIncludeOriginalPosterReply
      ? '本轮至少要有一条回复明确由楼主发出，而且楼主那条要像在接楼里某层、补后续、回追问或顺势承认一点，不要重复主楼。'
      : '如果楼主出场，也要像真楼主在接评论区，不要只是换个马甲重复主楼内容。',
    '楼主可以嘴硬、补一句、补细节、改口一点、回某个网友，但不要每次都长篇解释。',
  ].filter(Boolean).join('\n');
}

function buildUserCommentTargetSection(options: BuildForumReplyPromptOptions): string {
  if (!options.userNewComment?.trim()) return '';

  const commentSectionTitle = options.userIdentityMode === 'anonymous'
    ? '## 本轮优先接住的匿名新评论'
    : '## 本轮优先接住的用户新评论';

  return [
    commentSectionTitle,
    options.userNewCommentFloor ? `目标楼层：${options.userNewCommentFloor}L` : '',
    options.userNewCommentAuthorName?.trim() ? `发言人：${options.userNewCommentAuthorName.trim()}` : '',
    options.userIdentityMode === 'self'
      ? options.userMaskName?.trim()
        ? `这层是用户本人以面具身份“${options.userMaskName.trim()}”公开下场。网友可以按这个外显身份理解她和角色的关系，但不要越过公开可见的信息。`
        : '这层是用户本人公开下场。网友可以按公开已有关系语境去理解她和角色。'
      : options.userIdentityMode === 'anonymous'
        ? '这层来自匿名用户。不要默认认出她是谁，不要把匿名发言写成本人认领、官宣、认证、亲口承认，也不要把这层直接当作关系盖章。只能把它当成匿名楼层意见去接。'
        : '',
    `评论内容：${options.userNewComment.trim()}`,
    options.userReplyTargetFloor
      ? `用户这句正在接：${options.userReplyTargetFloor}L ${options.userReplyTargetAuthorName || ''}`.trim()
      : '',
    options.userReplyTargetContent?.trim() ? `用户接的那层内容：${options.userReplyTargetContent.trim()}` : '',
    options.userIdentityMode === 'anonymous'
      ? '第一条回复必须把这层当成匿名楼层意见来接，不要写“本人下场”“终于认领”“这不就是亲口承认”。'
      : '第一条回复必须直接接住这条用户新评论，不要先绕回主楼总结。',
    options.userReplyTargetFloor
      ? '如果用户这句是在接某个网友，第一条回复优先让被接的那层作者本人出来接；其他网友再顺着补充、站队或拱火。'
      : '',
    options.userReplyTargetFloor
      ? '如果用户本身是在回别人，第一条回复也要顺着这条对话往下接，不要突然跳回主楼视角。'
      : '',
    options.userIdentityMode === 'anonymous'
      ? '匿名情况下，可以写“匿名楼也这么觉得”“这层说得挺狠”“别急着按头认领”，但不要写成当事人亲自下场。'
      : '',
  ].filter(Boolean).join('\n');
}

function buildTaskSection(options: BuildForumReplyPromptOptions): string {
  const theme = getForumWorldTheme(options.channel);
  const modeGuidance = buildReplyModeGuidance(options.replyMode);

  return [
    '## 回帖任务',
    `目标频道：${FORUM_CHANNEL_LABELS[options.channel]}`,
    options.threadTitle?.trim() ? `帖子标题：${options.threadTitle.trim()}` : '',
    `帖子正文：${options.threadBody.trim()}`,
    theme ? `频道语气关键词：${theme.toneKeywords.join('、')}` : '',
    theme ? `频道核心冲突：${theme.coreConflicts.join('、')}` : '',
    options.threadContentTier ? `帖子层级：${options.threadContentTier}` : '',
    options.discourseAxis?.trim() ? `评论区发酵轴：${options.discourseAxis.trim()}` : '',
    options.floorContext?.length ? `已有楼层参考：${options.floorContext.join(' | ')}` : '',
    buildOriginalPosterSection(options),
    buildUserCommentTargetSection(options),
    options.styleHints?.length ? `补充风格提示：${options.styleHints.join('；')}` : '',
    options.replyRoleHints?.length ? `本轮尽量覆盖这些功能位：${options.replyRoleHints.join('、')}` : '',
    `生成数量：${options.replyCount ?? 3} 条`,
    ...modeGuidance,
    '回复必须像论坛现场，不要像标准答案。',
    '同一轮里至少自然拆出两到三种功能，比如点破、补刀、顺梗、站队、认真分析、楼主补一句。',
    '允许短句、反问、顺手补刀、接梗、阴阳、看热闹，但不要所有人都一个口气。',
    '同一轮里不要出现两条同义回复，不要两个人都只是在说“这楼还会继续长”“先蹲一个后续”“别删”这种同味话。',
    '优先让不同人各自咬住不同点：有人接人，有人拆人，有人护短，有人补细节，有人跟楼上某一句。',
    options.threadContentTier === 'highlight'
      ? '如果这是高光楼，至少要有一条回复像一句能把整栋楼定性的定义句，而且这句应该容易被后面接住或复读。'
      : '',
    options.threadContentTier === 'ferment'
      ? '如果这是发酵楼，要明显有站队和反站队，不要所有人都温和中立。'
      : '',
    options.threadContentTier === 'fragment'
      ? '如果这是片段楼，优先写接余味、接画面、顺手补一句，不要开分析大会。'
      : '',
    '不同网友要像不同人，不要都像一个模型换头像。',
    '回复别人时，要真像在接那一层的话，而不是重说主楼。',
    '单条回复尽量控制在一到三句内。',
    '输出格式必须逐行输出，每行一条，只能用下面两种格式之一：',
    '独立评论 | 显示名 | 内容',
    '回复 3L @某某 | 显示名 | 内容',
    '第一列只能写“独立评论”或“回复 X L @某某”这种目标，不要写别的标签。',
    '第二列只写显示名，不要加身份说明。',
    '第三列只写评论正文，不要写解释。',
    '不要编号，不要额外说明。',
  ].filter(Boolean).join('\n');
}

export function buildForumReplyPrompt(options: BuildForumReplyPromptOptions): string {
  return [
    FORUM_SCENARIO_PROMPT,
    ...(options.extraContextSections || []),
    buildParticipantSection(options),
    buildTaskSection(options),
  ].filter(Boolean).join('\n\n');
}
