import type { CoupleSpaceInitiativeCandidate } from '../../../../types';
import type { runCoupleSpaceInitiativeCandidate } from './runCoupleSpaceInitiativeCandidate';

type CoupleSpaceInitiativeRunResult = Awaited<ReturnType<typeof runCoupleSpaceInitiativeCandidate>>;

export type CoupleSpaceInitiativeArtifactPreview = {
  kind: 'draft' | 'confirmation';
  title: string;
  content: string;
  note?: string;
} | null;

function getActionLabel(actionType: CoupleSpaceInitiativeCandidate['actionType'] | null | undefined): string {
  switch (actionType) {
    case 'post_couple_daily':
      return '情侣日常';
    case 'post_message_board_entry':
      return '留言板内容';
    case 'write_love_letter':
      return '情书草稿';
    case 'write_co_note':
      return '互记草稿';
    case 'reply_message_board':
      return '留言板回复';
    case 'react_to_existing_post':
      return '动态评论';
    case 'reply_daily_comment':
      return '评论回复';
    case 'reply_love_letter':
      return '情书回复';
    case 'create_ledger_entry':
      return '账本待确认记录';
    default:
      return '主动内容';
  }
}

export function buildExecutionBoundaryAwareStatusText(
  candidate: CoupleSpaceInitiativeCandidate,
  runResult: CoupleSpaceInitiativeRunResult,
): string {
  const label = getActionLabel(candidate.actionType);
  const boundaryChannel = 'executionBoundary' in runResult ? runResult.executionBoundary.channel : null;
  const sinkStatus = 'sinkStatus' in runResult ? runResult.sinkStatus : undefined;

  if (runResult.executorStatus !== 'accepted') {
    return `这次选中了${label}，但没有继续执行：${runResult.reason}`;
  }

  if (boundaryChannel === 'direct_write') {
    if (sinkStatus === 'applied') {
      return `这次已经成功生成并写入${label}。`;
    }

    if (sinkStatus === 'rejected' || sinkStatus === 'unsupported') {
      return `这次选中了${label}，但直写通路还没有成功接住：${runResult.reason}`;
    }
  }

  if (boundaryChannel === 'draft_buffer') {
    if ('draftContent' in runResult && runResult.draftContent) {
      return `这次已经生成${label}，当前先作为草稿保留，还没有直接写入。`;
    }

    if (sinkStatus === 'rejected' || sinkStatus === 'unsupported') {
      return `这次选中了${label}，但草稿通路还没有成功接住：${runResult.reason}`;
    }
  }

  if (boundaryChannel === 'confirmation_queue') {
    if ('confirmationSummary' in runResult && runResult.confirmationSummary) {
      return `这次已经生成${label}，当前进入待确认状态，还没有直接写入正式记录。`;
    }

    if (sinkStatus === 'rejected' || sinkStatus === 'unsupported') {
      return `这次选中了${label}，但确认通路还没有成功接住：${runResult.reason}`;
    }
  }

  return `这次选中了${label}：${runResult.reason}`;
}

export function buildExecutionBoundaryAwareArtifactPreview(
  candidate: CoupleSpaceInitiativeCandidate,
  runResult: CoupleSpaceInitiativeRunResult,
): CoupleSpaceInitiativeArtifactPreview {
  const label = getActionLabel(candidate.actionType);
  const boundaryChannel = 'executionBoundary' in runResult ? runResult.executionBoundary.channel : null;

  if (boundaryChannel === 'draft_buffer' && 'draftContent' in runResult && runResult.draftContent) {
    return {
      kind: 'draft',
      title: `${label}已生成草稿`,
      content: runResult.draftContent,
      note: '这次先保留为草稿，还没有直接写入情侣空间。',
    };
  }

  if (
    boundaryChannel === 'confirmation_queue' &&
    'confirmationSummary' in runResult &&
    runResult.confirmationSummary
  ) {
    return {
      kind: 'confirmation',
      title: `${label}已生成待确认内容`,
      content: runResult.confirmationSummary,
      note: '这次进入待确认状态，还没有直接写入正式记录。',
    };
  }

  return null;
}
