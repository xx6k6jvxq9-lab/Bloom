import type { Character, CharacterOpenLoopEntry, DateSession } from '../../types';
import type {
  RelationshipResidueItem,
  SceneResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import {
  buildSceneSettlementResult,
  dedupeSettlementItemsBySummary,
  type SceneSettlementResult,
} from '../memory/sceneSettlement';
import {
  createRelationshipResidueItem,
  createTaskResidueItemFromText,
  createTopicAnchorItemFromText,
  normalizeSettlementText,
  summarizeSettlementText,
} from '../memory/sceneSettlementItems';
import type { SceneProgressMemoryRecordDraft } from '../memory/memoryRecordTypes';
import {
  buildDatingSceneProgress,
  buildDatingSceneProgressSummary,
  type DatingSceneProgress,
} from './buildDatingSceneProgress';

type DatingEndedSettlementResult = SceneSettlementResult;

const TASK_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完)/;

function getLatestNarrativeSnippet(session: DateSession): string {
  const segments = session.generatedContent?.narrative?.segments || [];
  return normalizeSettlementText(segments.map((segment) => segment.text).join(' '));
}

function getRecentSessionTexts(session: DateSession): string[] {
  return (session.messages || [])
    .slice(-10)
    .map((message) => normalizeSettlementText(message.text))
    .filter(Boolean);
}

function buildRelationshipResidue(session: DateSession): RelationshipResidueItem[] {
  const narrativeSnippet = summarizeSettlementText(getLatestNarrativeSnippet(session), 96);
  const mood = normalizeSettlementText(session.generatedContent?.status?.mood || session.mood);
  const baseSummary = narrativeSnippet
    ? `刚结束的约会留下了一点关系余波：${narrativeSnippet}`
    : mood
      ? `刚结束的约会还带着一点关系余波，整体氛围偏向：${mood}`
      : '';

  const item = createRelationshipResidueItem({
    summary: baseSummary,
    sourceScene: 'dating',
    timestamp: session.endedAt || Date.now(),
    decay: 'medium',
  });

  return item ? [item] : [];
}

function buildSceneResidue(
  session: DateSession,
  sceneProgressSummary: string,
): SceneResidueItem[] {
  if (!sceneProgressSummary) {
    return [];
  }

  return [{
    type: 'scene_residue',
    summary: `这场约会推进到的阶段：${sceneProgressSummary}`,
    sourceScene: 'dating',
    timestamp: session.endedAt || Date.now(),
    decay: 'medium',
    visibility: 'cross_scene_readable',
  }];
}

function buildSceneProgressRecords(
  progress: DatingSceneProgress,
  summary: string,
): SceneProgressMemoryRecordDraft[] {
  if (!summary) {
    return [];
  }

  return [{
    summary: `这场约会推进到的阶段：${summary}`,
    stageLabel: progress.stageLabel,
    ...(progress.currentBeat ? { currentBeat: progress.currentBeat } : {}),
    ...(progress.currentSignature ? { currentSignature: progress.currentSignature } : {}),
    ...(progress.previousSignature ? { previousSignature: progress.previousSignature } : {}),
    repeatedSignature: progress.repeatedSignature,
    completedActions: progress.completedActions,
    bannedRepeatActions: progress.bannedRepeatActions,
    ...(progress.unresolvedTension ? { unresolvedTension: progress.unresolvedTension } : {}),
    nextStepOptions: progress.nextStepOptions,
    visibility: 'cross_scene_readable',
    stability: 'situational',
    decayHint: 'medium',
  }];
}

function buildTopicAnchors(session: DateSession): TopicAnchorItem[] {
  const timestamp = session.endedAt || Date.now();
  return dedupeSettlementItemsBySummary(
    getRecentSessionTexts(session)
      .map((text) => createTopicAnchorItemFromText({
        content: text,
        summaryPrefix: '这场约会里刚碰过的话题或旧梗：',
        maxChars: 80,
        sourceScene: 'dating',
        timestamp,
      }))
      .filter((item): item is TopicAnchorItem => item !== null)
      .slice(-2),
  );
}

function buildTaskResidue(session: DateSession): TaskResidueItem[] {
  const timestamp = session.endedAt || Date.now();
  return dedupeSettlementItemsBySummary(
    getRecentSessionTexts(session)
      .filter((text) => TASK_MARKERS.test(text))
      .map((text) => createTaskResidueItemFromText({
        content: text,
        summaryPrefix: '这场约会里还可能算数的约定或待办：',
        maxChars: 80,
        sourceScene: 'dating',
        timestamp,
        decay: 'medium',
      }))
      .filter((item): item is TaskResidueItem => item !== null)
      .slice(-2),
  );
}

export function buildDatingEndedSettlement(
  character: Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'presenceState' | 'sharedState'>,
  session: DateSession,
): DatingEndedSettlementResult {
  const now = session.endedAt || Date.now();
  const sceneProgress = buildDatingSceneProgress(session);
  const sceneProgressSummary = buildDatingSceneProgressSummary(sceneProgress);
  const relationshipResidue = dedupeSettlementItemsBySummary(buildRelationshipResidue(session));
  const sceneResidue = dedupeSettlementItemsBySummary(buildSceneResidue(session, sceneProgressSummary));
  const topicAnchors = buildTopicAnchors(session);
  const taskResidue = buildTaskResidue(session);
  const sceneProgressRecords = buildSceneProgressRecords(sceneProgress, sceneProgressSummary);

  return buildSceneSettlementResult({
    character,
    sourceScene: 'dating',
    timestamp: now,
    snapshotLimit: 8,
    items: {
      relationshipResidue,
      sceneResidue,
      topicAnchors,
      taskResidue,
    },
    openLoop: {
      idPrefix: 'dating',
      taskResumeHint: '这是约会结束后仍可能算数的约定或待办，只有当前相关时再恢复。',
      topicResumeHint: '这是约会里刚碰过的话题锚点，只有当前真的碰到时再带回。',
      limit: 8,
    },
    sharedState: {
      publicSummaries: relationshipResidue.map((item) => item.summary),
      privateSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...sceneResidue.map((item) => item.summary),
        ...topicAnchors.map((item) => item.summary),
        ...taskResidue.map((item) => item.summary),
      ],
    },
    sceneProgressRecords,
  });
}
