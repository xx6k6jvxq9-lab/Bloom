import type { Character, GroupOfflineRound, GroupOfflineSession } from '../../types';
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
import type { SceneProgressMemoryRecordDraft } from '../memory/memoryRecordTypes';
import {
  createRelationshipResidueItem,
  createTaskResidueItemFromText,
  createTopicAnchorItemFromText,
  normalizeSettlementText,
  summarizeSettlementText,
} from '../memory/sceneSettlementItems';

type GroupOfflineSharedSettlementResult = SceneSettlementResult;

const TASK_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完|一起|记得|要去|要做)/;

function normalizeGenerationMode(mode: GroupOfflineSession['generationMode']): 'blocks' | 'ensemble' {
  return mode === 'ensemble' || mode === 'group' ? 'ensemble' : 'blocks';
}

function getRecentRounds(session: GroupOfflineSession): GroupOfflineRound[] {
  return (session.generatedContent?.rounds || []).slice(-3);
}

function getCharacterRoundEntries(session: GroupOfflineSession, characterId: string) {
  return getRecentRounds(session)
    .map((round) => ({
      round,
      entry: round.characterEntries.find((item) => item.characterId === characterId) || null,
    }))
    .filter((item) => !!item.entry)
    .map((item) => ({
      round: item.round,
      entry: item.entry!,
    }));
}

function buildCharacterOfflineSummary(session: GroupOfflineSession, character: Character): string {
  const recentEntries = getCharacterRoundEntries(session, character.id);
  const latestEntry = recentEntries[recentEntries.length - 1];
  const location = normalizeSettlementText(session.location);
  const activity = normalizeSettlementText(session.customActivityType || session.activityType);

  const snippets = [
    latestEntry?.entry.target?.label
      ? `${character.name}这场里主要把注意力放在了${latestEntry.entry.target.label}身上。`
      : '',
    ...recentEntries.slice(-2).map(({ entry }) => summarizeSettlementText(entry.text, 60)),
  ].filter(Boolean);

  if (snippets.length === 0) {
    return `${character.name}刚结束了一场${activity || '群线下'}，场上的余温还没有完全散掉。`;
  }

  return `${character.name}刚在${location || '线下现场'}结束了一场${activity || '群线下'}：${snippets.join('；')}`;
}

function buildRelationshipResidue(
  session: GroupOfflineSession,
  character: Character,
): RelationshipResidueItem[] {
  const now = session.endedAt || Date.now();
  const summary = buildCharacterOfflineSummary(session, character);
  const item = createRelationshipResidueItem({
    summary: `群线下结束后留下的关系余波：${summarizeSettlementText(summary, 96)}`,
    sourceScene: 'group_offline',
    timestamp: now,
    decay: 'medium',
  });

  return item ? [item] : [];
}

function buildSceneResidue(
  session: GroupOfflineSession,
  character: Character,
): SceneResidueItem[] {
  const latestRound = (session.generatedContent?.rounds || []).slice(-1)[0];
  const location = normalizeSettlementText(session.location);
  const activity = normalizeSettlementText(session.customActivityType || session.activityType);
  const sceneSummary = summarizeSettlementText(
    latestRound?.sceneText
      || `${character.name}在${location || '线下现场'}结束了${activity || '群线下'}的当前推进。`,
    96,
  );
  if (!sceneSummary) return [];

  return [{
    type: 'scene_residue',
    summary: `群线下推进到的阶段：${sceneSummary}`,
    sourceScene: 'group_offline',
    timestamp: session.endedAt || Date.now(),
    decay: 'medium',
    visibility: 'cross_scene_readable',
  }];
}

function buildTopicAnchors(
  session: GroupOfflineSession,
  character: Character,
): TopicAnchorItem[] {
  const now = session.endedAt || Date.now();
  const entryTexts = getCharacterRoundEntries(session, character.id)
    .map(({ round, entry }) => [
      round.userMessageText || '',
      entry.highlightText || '',
      entry.text,
    ].filter(Boolean).join(' '))
    .filter(Boolean);

  return dedupeSettlementItemsBySummary(
    entryTexts
      .map((text) => createTopicAnchorItemFromText({
        content: text,
        summaryPrefix: '群线下里刚碰过的话题或没说透的点：',
        maxChars: 80,
        sourceScene: 'group_offline',
        timestamp: now,
      }))
      .filter((item): item is TopicAnchorItem => item !== null)
      .slice(-2),
  );
}

function buildTaskResidue(
  session: GroupOfflineSession,
  character: Character,
): TaskResidueItem[] {
  const now = session.endedAt || Date.now();
  const candidateTexts = getCharacterRoundEntries(session, character.id)
    .flatMap(({ round, entry }) => [
      round.userMessageText || '',
      entry.text,
      entry.notebook || '',
    ])
    .map((text) => normalizeSettlementText(text))
    .filter((text) => text && TASK_MARKERS.test(text));

  return dedupeSettlementItemsBySummary(
    candidateTexts
      .map((text) => createTaskResidueItemFromText({
        content: text,
        summaryPrefix: '群线下结束后还可能算数的约定或待办：',
        maxChars: 80,
        sourceScene: 'group_offline',
        timestamp: now,
        decay: 'medium',
      }))
      .filter((item): item is TaskResidueItem => item !== null)
      .slice(-2),
  );
}

function buildSceneProgressRecords(
  session: GroupOfflineSession,
  character: Character,
): SceneProgressMemoryRecordDraft[] {
  const rounds = session.generatedContent?.rounds || [];
  if (rounds.length === 0) {
    return [];
  }

  const latestRound = rounds[rounds.length - 1];
  const stageLabel = normalizeGenerationMode(session.generationMode) === 'ensemble'
    ? '群线下同场推进阶段'
    : '群线下分块推进阶段';
  const latestCharacterEntry = latestRound.characterEntries.find((entry) => entry.characterId === character.id);
  const currentSignature = normalizeGenerationMode(session.generationMode) === 'ensemble'
    ? '多人同场 / 群像推进'
    : '分块推进 / 角色轮次';

  return [{
    summary: `群线下推进到${stageLabel}：${summarizeSettlementText(
      latestCharacterEntry?.text || latestRound.sceneText || `${character.name}完成了这一场群线下的收尾。`,
      88,
    )}`,
    stageLabel,
    currentBeat: latestRound.sceneText
      ? summarizeSettlementText(latestRound.sceneText, 80)
      : `${character.name}在群线下最后一轮留下了新的公开余波。`,
    currentSignature,
    completedActions: [
      normalizeGenerationMode(session.generationMode) === 'ensemble'
        ? '群线下完成了一轮同场推进'
        : '群线下完成了一轮角色分块推进',
    ],
    unresolvedTension: '这场线下已经结束，但回到群聊后的余波和关系变化还会继续发酵。',
    nextStepOptions: [
      '把线下余波延续到回群后的公开消息',
      '在下次群线下或单聊里继续承接这场关系变化',
    ],
    visibility: 'cross_scene_readable',
    stability: 'situational',
    decayHint: 'medium',
  }];
}

export function buildGroupOfflineSharedSettlement(
  character: Pick<Character, 'id' | 'name' | 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'presenceState' | 'sharedState'>,
  session: GroupOfflineSession,
): GroupOfflineSharedSettlementResult {
  const relationshipResidue = dedupeSettlementItemsBySummary(buildRelationshipResidue(session, character as Character));
  const sceneResidue = dedupeSettlementItemsBySummary(buildSceneResidue(session, character as Character));
  const topicAnchors = buildTopicAnchors(session, character as Character);
  const taskResidue = buildTaskResidue(session, character as Character);
  const sceneProgressRecords = buildSceneProgressRecords(session, character as Character);

  return buildSceneSettlementResult({
    character,
    sourceScene: 'group_offline',
    timestamp: session.endedAt || Date.now(),
    snapshotLimit: 10,
    items: {
      relationshipResidue,
      sceneResidue,
      topicAnchors,
      taskResidue,
    },
    openLoop: {
      idPrefix: 'group-offline',
      taskResumeHint: '这是群线下结束后仍可能算数的约定或待办，只有当前相关时再恢复。',
      topicResumeHint: '这是群线下里刚碰过的话题锚点，只有当前真的碰到时再带回。',
      limit: 10,
    },
    sharedState: {
      publicSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...sceneResidue.map((item) => item.summary),
      ],
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
