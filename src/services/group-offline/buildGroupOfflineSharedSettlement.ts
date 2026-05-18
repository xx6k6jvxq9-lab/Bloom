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
import {
  buildGroupOfflineWritebackPlan,
  type GroupOfflineWritebackPlan,
} from './groupOfflineWritebackPlan';

type GroupOfflineSharedSettlementResult = SceneSettlementResult;

const TASK_MARKERS = /(promise|plan|handle|finish|next time|remember|follow up|\u7ea6\u5b9a|\u786e\u8ba4|\u5904\u7406|\u5b8c\u6210|\u5b89\u6392|\u8ba1\u5212|\u4e0b\u6b21|\u8bb0\u5f97|\u8981\u53bb|\u8981\u505a)/i;

function getRecentRounds(session: GroupOfflineSession): GroupOfflineRound[] {
  return (session.generatedContent?.rounds || []).slice(-3);
}

function getCharacterRoundEntries(session: GroupOfflineSession, characterId: string) {
  return getRecentRounds(session)
    .map((round) => ({
      round,
      entry: round.characterEntries.find((item) => item.characterId === characterId) || null,
    }))
    .filter((item): item is { round: GroupOfflineRound; entry: NonNullable<typeof item.entry> } => !!item.entry);
}

function buildCharacterOfflineSummary(
  session: GroupOfflineSession,
  character: Character,
  writebackPlan: GroupOfflineWritebackPlan,
): string {
  const recentEntries = getCharacterRoundEntries(session, character.id);
  const latestEntry = recentEntries[recentEntries.length - 1]?.entry;
  const evidence = writebackPlan.participantEvidenceByCharacterId[character.id];
  const activity = normalizeSettlementText(session.customActivityType || session.activityType) || '群线下';
  const location = normalizeSettlementText(session.location) || '现场';
  const carryoverSeed = evidence?.latestLongTerm
    || evidence?.latestShortTerm[0]
    || evidence?.latestEntryText
    || summarizeSettlementText(latestEntry?.text, 88);

  const parts = [
    `刚结束的${activity}（${location}）`,
    carryoverSeed,
    evidence?.latestTargetLabel ? `注意力还留在${evidence.latestTargetLabel}身上` : '',
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join('；');
  }

  return `${character.name}刚从${activity}里出来，余温还没散。`;
}

function buildRelationshipResidue(
  session: GroupOfflineSession,
  character: Character,
  writebackPlan: GroupOfflineWritebackPlan,
): RelationshipResidueItem[] {
  const now = session.endedAt || Date.now();
  const summary = buildCharacterOfflineSummary(session, character, writebackPlan);
  const item = createRelationshipResidueItem({
    summary: summarizeSettlementText(summary, 96),
    sourceScene: 'group_offline',
    timestamp: now,
    decay: 'medium',
  });

  return item ? [item] : [];
}

function buildSceneResidue(
  session: GroupOfflineSession,
  character: Character,
  writebackPlan: GroupOfflineWritebackPlan,
): SceneResidueItem[] {
  const latestRound = (session.generatedContent?.rounds || []).slice(-1)[0];
  const fallback = `${character.name} finished the latest group offline beat.`;
  const sceneSummary = summarizeSettlementText(
    writebackPlan.sharedEventSummary || latestRound?.sceneText || fallback,
    96,
  );
  if (!sceneSummary) return [];

  return [{
    type: 'scene_residue',
    summary: sceneSummary,
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
        summaryPrefix: '群线下里刚碰过的话头：',
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
        summaryPrefix: '群线下结束后还挂着的后续：',
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
  writebackPlan: GroupOfflineWritebackPlan,
): SceneProgressMemoryRecordDraft[] {
  const rounds = session.generatedContent?.rounds || [];
  if (rounds.length === 0) {
    return [];
  }

  const latestRound = rounds[rounds.length - 1];
  const evidence = writebackPlan.participantEvidenceByCharacterId[character.id];
  const latestCharacterEntry = latestRound.characterEntries.find((entry) => entry.characterId === character.id);
  const stageLabel = '群线下收尾阶段';
  const currentSignature = '分块推进 / 散场收口';
  const summarySeed = evidence?.preferredCarryoverText
    || latestCharacterEntry?.text
    || latestRound.sceneText
    || `${character.name}把这场线下的最后一口气收住了。`;

  return [{
    summary: `群线下推进到${stageLabel}：${summarizeSettlementText(summarySeed, 88)}`,
    stageLabel,
    currentBeat: latestRound.sceneText
      ? summarizeSettlementText(latestRound.sceneText, 80)
      : `${character.name}带着还没散掉的余波离开了现场。`,
    currentSignature,
    completedActions: [
      '把这场群线下的收尾推进完了一轮。',
    ],
    unresolvedTension: '场子已经散了，但公开余波和关系变化还会继续发酵。',
    nextStepOptions: [
      '让这场余波继续出现在后续群消息里。',
      '把没说完的话带进后面的群聊线下或单聊里。',
    ],
    visibility: 'cross_scene_readable',
    stability: 'situational',
    decayHint: 'medium',
  }];
}

export function buildGroupOfflineSharedSettlement(
  character: Pick<Character, 'id' | 'name' | 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'presenceState' | 'sharedState'>,
  session: GroupOfflineSession,
  options?: {
    writebackPlan?: GroupOfflineWritebackPlan;
  },
): GroupOfflineSharedSettlementResult {
  const writebackPlan = options?.writebackPlan || buildGroupOfflineWritebackPlan(session, [{ id: character.id }]);
  const relationshipResidue = dedupeSettlementItemsBySummary(
    buildRelationshipResidue(session, character as Character, writebackPlan),
  );
  const sceneResidue = dedupeSettlementItemsBySummary(
    buildSceneResidue(session, character as Character, writebackPlan),
  );
  const topicAnchors = buildTopicAnchors(session, character as Character);
  const taskResidue = buildTaskResidue(session, character as Character);
  const sceneProgressRecords = buildSceneProgressRecords(session, character as Character, writebackPlan);

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
      taskResumeHint: '只有当前对话真的碰到这条没收完的后续时，才把它重新带回来。',
      topicResumeHint: '只有群里自然又回到这个话头时，才把它重新接上。',
      limit: 10,
      enabled: false,
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
