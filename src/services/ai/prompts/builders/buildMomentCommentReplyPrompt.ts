import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import { buildLongTermMemoryContextSection, MemoryContextInput } from '../character/memoryContext';
import { MOMENT_COMMENT_REPLY_SCENARIO_PROMPT } from '../scenarios/momentCommentReply';

export type BuildMomentCommentReplyPromptOptions = {
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: MemoryContextInput;
  momentContext?: {
    momentContent: string;
    momentTone?: string;
    momentIntent?: string;
    signature?: string;
    relationship?: string;
    commentType?: string;
    userComment: string;
    recentCommentReplies?: string[];
    maxLength?: number;
    replyStyleHints?: string[];
    semanticAnchor?: string;
    actionLabel?: string;
    timeHint?: string;
    focusHint?: string;
    joinReasonHint?: string;
    replyTargetName?: string;
  };
  sections?: string[];
};

function buildMomentContextSection(momentContext?: BuildMomentCommentReplyPromptOptions['momentContext']): string {
  if (!momentContext) return '';

  return [
    '## 当前评论区上下文',
    `动态正文: ${momentContext.momentContent}`,
    momentContext.momentTone ? `动态当时的语气/状态: ${momentContext.momentTone}` : '',
    momentContext.momentIntent ? `这条动态更像是在: ${momentContext.momentIntent}` : '',
    momentContext.signature ? `角色签名: ${momentContext.signature}` : '',
    momentContext.relationship ? `关系提醒: ${momentContext.relationship}` : '',
    momentContext.semanticAnchor ? `这层楼的主语义: ${momentContext.semanticAnchor}` : '',
    momentContext.actionLabel ? `这句回复的动作意图: ${momentContext.actionLabel}` : '',
    momentContext.timeHint ? `时间感提醒: ${momentContext.timeHint}` : '',
    momentContext.focusHint ? `楼层聚焦提醒: ${momentContext.focusHint}` : '',
    momentContext.joinReasonHint ? `你这次为什么适合接这句: ${momentContext.joinReasonHint}` : '',
    momentContext.replyTargetName ? `你当前主要在接: ${momentContext.replyTargetName}` : '',
    momentContext.commentType ? `当前评论类型判断: ${momentContext.commentType}` : '',
    `当前要回应的评论: ${momentContext.userComment}`,
    `建议长度: ${momentContext.maxLength ?? 30} 字以内`,
    momentContext.recentCommentReplies?.length
      ? ['最近几条评论/回复（避免重复句型）:', ...momentContext.recentCommentReplies.map((item, index) => `${index + 1}. ${item}`)].join('\n')
      : '',
    momentContext.replyStyleHints?.length
      ? `评论区风格约束: ${momentContext.replyStyleHints.join('；')}`
      : '',
  ].filter(Boolean).join('\n');
}

export function buildMomentCommentReplyPrompt(options: BuildMomentCommentReplyPromptOptions = {}): string {
  const sections = [
    EXISTENCE_PROMPT,
    buildCharacterCoreSection(options.characterCore ?? {}),
    buildLongTermMemoryContextSection(options.memoryContext ?? {}),
    MOMENT_COMMENT_REPLY_SCENARIO_PROMPT,
    buildMomentContextSection(options.momentContext),
    OUTPUT_RULES_PROMPT,
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
