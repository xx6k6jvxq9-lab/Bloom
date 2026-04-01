import type { CharacterCoreSectionsInput } from '../character/characterCore';
import type { MemoryContextInput } from '../character/memoryContext';

/**
 * 预留给未来“char 主动行为调度层”的轻量动作类型。
 * 当前先只用于 prompt builder 的输入建模，不在页面组件里直接调度。
 */
export type CoupleSpaceInitiativeActionType =
  | 'write_love_letter'
  | 'post_message_board_entry'
  | 'post_couple_daily'
  | 'write_co_note'
  | 'create_ledger_entry'
  | 'reply_love_letter'
  | 'reply_daily_comment'
  | 'reply_message_board'
  | 'react_to_existing_post';

/**
 * active:
 * - 未来由角色主动行为调度层触发
 * passive:
 * - 当前多用于用户触发后，角色被动回应
 */
export type CoupleSpacePromptMode = 'active' | 'passive';

/**
 * 情侣空间当前不接 perception prompt。
 * 这里显式裁掉 perception 字段，避免未来又把感知页语义混进来。
 */
export type CoupleSpaceMemoryContextInput = Pick<MemoryContextInput, 'memorySummary'>;

export type CoupleSpaceCharacterProfile = {
  characterName?: string;
  signature?: string;
  personaSummary?: string;
  traits?: string[];
  speakingStyle?: string;
  initiativeStyle?: string;
};

export type CoupleSpaceRelationshipContext = {
  userName?: string;
  relationshipStage?: string;
  relationshipSummary?: string;
  sharedContextSummary?: string;
  intimacyBoundary?: string;
};

export type CoupleSpaceRecentContext = {
  currentSubScene?: string;
  recentCoupleSpaceSummary?: string;
  recentRelatedContentSummary?: string;
  recentSharedMomentsSummary?: string;
  occasion?: string;
  triggerReason?: string;
};

export type CoupleSpacePromptCommonInput = {
  mode?: CoupleSpacePromptMode;
  actionType?: CoupleSpaceInitiativeActionType;
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: CoupleSpaceMemoryContextInput;
  characterProfile?: CoupleSpaceCharacterProfile;
  relationshipContext?: CoupleSpaceRelationshipContext;
  recentContext?: CoupleSpaceRecentContext;
  sections?: string[];
};
