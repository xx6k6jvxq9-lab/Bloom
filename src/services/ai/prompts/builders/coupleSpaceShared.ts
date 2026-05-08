import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { buildCharacterCoreSection, buildUserMaskContextSection } from '../character/characterCore';
import { buildLongTermMemoryContextSection } from '../character/memoryContext';
import { COUPLE_SPACE_BASE_PROMPT } from '../scenarios/coupleSpace';
import type {
  CoupleSpaceCharacterProfile,
  CoupleSpacePromptCommonInput,
  CoupleSpaceRecentContext,
  CoupleSpaceRelationshipContext,
} from '../coupleSpace/types';

function buildCharacterProfileSection(profile: CoupleSpaceCharacterProfile = {}): string {
  const lines = [
    '## 情侣空间中的角色表达侧写',
    profile.characterName ? `角色名: ${profile.characterName}` : '',
    profile.signature ? `角色签名: ${profile.signature}` : '',
    profile.personaSummary ? `人设摘要: ${profile.personaSummary}` : '',
    profile.traits?.length ? `性格特征: ${profile.traits.join('、')}` : '',
    profile.speakingStyle ? `说话习惯: ${profile.speakingStyle}` : '',
    profile.initiativeStyle ? `主动程度/主动方式: ${profile.initiativeStyle}` : '',
    '硬约束提醒: 不要把所有角色写成统一甜宠、统一恋爱文案生成器。',
  ].filter(Boolean);

  return lines.join('\n');
}

function buildRelationshipContextSection(context: CoupleSpaceRelationshipContext = {}): string {
  const lines = [
    '## 用户与角色的关系上下文',
    context.userName ? `用户名: ${context.userName}` : '',
    context.relationshipStage ? `关系阶段: ${context.relationshipStage}` : '',
    context.relationshipSummary ? `关系摘要: ${context.relationshipSummary}` : '',
    context.sharedContextSummary ? `共同经历/共同关系摘要: ${context.sharedContextSummary}` : '',
    context.intimacyBoundary ? `亲密边界提醒: ${context.intimacyBoundary}` : '',
    '硬约束提醒: 情侣空间内容必须围绕“我和用户”的关系痕迹，不要脱离 user 单独抒情。',
  ].filter(Boolean);

  return lines.join('\n');
}

function formatTypedResidueLines<T extends { summary: string }>(
  title: string,
  items: T[] | undefined,
  usageNote: string,
): string {
  const typedItems = (items || [])
    .map((item) => item.summary.trim())
    .filter(Boolean);
  if (typedItems.length === 0) {
    return '';
  }

  return [
    title,
    usageNote,
    ...typedItems.map((summary) => `- ${summary}`),
  ].join('\n');
}

function buildGenerationContextSection(context: CoupleSpacePromptCommonInput): string {
  const recentContext: CoupleSpaceRecentContext = context.recentContext ?? {};
  const lines = [
    '## 当前生成上下文',
    `触发模式: ${context.mode ?? 'passive'}`,
    context.actionType ? `未来兼容动作类型: ${context.actionType}` : '',
    recentContext.currentSubScene ? `情侣空间子场景: ${recentContext.currentSubScene}` : '',
    recentContext.occasion ? `特殊契机 / occasion: ${recentContext.occasion}` : '',
    recentContext.triggerReason ? `触发原因 / reason: ${recentContext.triggerReason}` : '',
    recentContext.publicAcquaintanceSummary ? `公开认识与跨场景连续性: ${recentContext.publicAcquaintanceSummary}` : '',
    formatTypedResidueLines(
      '## Typed Relationship Residue',
      recentContext.relationshipResidue,
      '这些是别的场景留下、但在情侣空间里仍会影响亲密感和关系底色的共享余波。只把它们当成关系连续性，不要误写成当前情侣空间里刚发生的新动作。',
    ),
    formatTypedResidueLines(
      '## Typed Topic Anchors',
      recentContext.topicAnchors,
      '这些是跨场景留下的话题锚点。只有当前情侣空间内容真的碰到时才可轻量带回，不要无缘无故翻旧梗。',
    ),
    formatTypedResidueLines(
      '## Typed Task Residue',
      recentContext.taskResidue,
      '这些是跨场景仍可能算数的待办或约定。只有当前情侣空间语境真的相关时再恢复。',
    ),
    recentContext.sharedRecentRelationshipSummary ? `跨场景共享关系余波: ${recentContext.sharedRecentRelationshipSummary}` : '',
    recentContext.recentCoupleSpaceSummary ? `最近情侣空间摘要: ${recentContext.recentCoupleSpaceSummary}` : '',
    recentContext.recentRelatedContentSummary ? `最近相关内容摘要: ${recentContext.recentRelatedContentSummary}` : '',
    recentContext.recentSharedMomentsSummary ? `最近共同经历摘要: ${recentContext.recentSharedMomentsSummary}` : '',
    'TODO: 后续把“是否该主动生成、何时生成、先生成什么”收口到独立调度层；当前 builder 只负责内容生成约束。',
  ].filter(Boolean);

  return lines.join('\n');
}

type ComposeCoupleSpacePromptOptions = {
  common: CoupleSpacePromptCommonInput;
  taskSections: string[];
};

/**
 * Keep couple-space prompt assembly side-effect free.
 * Builders should only describe sections and leave orchestration to future layers.
 */
export function composeCoupleSpacePrompt({
  common,
  taskSections,
}: ComposeCoupleSpacePromptOptions): string {
  const sections = [
    buildCharacterCoreSection(common.characterCore ?? {}),
    buildUserMaskContextSection(common.characterCore ?? {}),
    buildLongTermMemoryContextSection(common.memoryContext ?? {}),
    buildCharacterProfileSection(common.characterProfile),
    buildRelationshipContextSection(common.relationshipContext),
    COUPLE_SPACE_BASE_PROMPT,
    buildGenerationContextSection(common),
    ...taskSections,
    OUTPUT_RULES_PROMPT,
    ...(common.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}
