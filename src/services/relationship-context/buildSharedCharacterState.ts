import type { Character, CharacterPresenceState } from '../../types';
import { buildSceneSignalsFromRecords } from '../memory/sceneSignalRecords';
import type { CharacterTemporalState } from '../relationship-time/buildCharacterTemporalState';
import type {
  RelationshipResidueItem,
  SceneResidueItem,
  SceneScopedSignals,
  TaskResidueItem,
  TopicAnchorItem,
  TypedContextVisibility,
} from './types';

type SharedCharacterStatePrompt = {
  directPrompt: string;
  groupPrompt: string;
};

type BuildSharedCharacterStateInput = {
  character: Pick<Character, 'name'>;
  temporalState: CharacterTemporalState;
  sceneScopedSignals: SceneScopedSignals;
};

type TypedStateItem =
  | RelationshipResidueItem
  | SceneResidueItem
  | TaskResidueItem
  | TopicAnchorItem;

const PUBLIC_VISIBILITY: TypedContextVisibility[] = ['group_public', 'cross_scene_readable'];
const PRIVATE_VISIBILITY: TypedContextVisibility[] = ['private'];

function compactLine(value: string | undefined, maxLength = 88): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trim()}...`
    : normalized;
}

function collectVisibleSummaries(
  items: TypedStateItem[] | undefined,
  visibilities: TypedContextVisibility[],
  maxItems: number,
): string[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const allowed = new Set(visibilities);
  const seen = new Set<string>();
  const summaries: string[] = [];

  for (const item of items) {
    if (!allowed.has(item.visibility)) {
      continue;
    }

    const summary = compactLine(item.summary);
    if (!summary) {
      continue;
    }

    const key = summary.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    summaries.push(summary);
    if (summaries.length >= maxItems) {
      break;
    }
  }

  return summaries;
}

function resolveVisibleSummaries(
  primaryItems: TypedStateItem[] | undefined,
  fallbackItems: TypedStateItem[] | undefined,
  visibilities: TypedContextVisibility[],
  maxItems: number,
): string[] {
  const primarySummaries = collectVisibleSummaries(primaryItems, visibilities, maxItems);
  return primarySummaries.length > 0
    ? primarySummaries
    : collectVisibleSummaries(fallbackItems, visibilities, maxItems);
}

function mergeSummaryParts(parts: Array<string | undefined>, maxItems: number): string {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const part of parts) {
    const normalized = compactLine(part);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(normalized);
    if (merged.length >= maxItems) {
      break;
    }
  }

  return merged.join('；');
}

function getAvailabilityLabel(value: CharacterTemporalState['interactionGapState']['continuityMode']) {
  if (value === 'continuous_scene') return '正在同一轮聊天里';
  if (value === 'same_day_resume') return '同一天里重新接上';
  return '隔了一段时间后重新出现';
}

function getEnergyLabel(value: CharacterTemporalState['energyState']) {
  if (value === 'high') return '精力偏高';
  if (value === 'steady') return '状态平稳';
  if (value === 'sleepy') return '有点困';
  return '精力偏低';
}

function getSocialLabel(value: CharacterTemporalState['socialState']) {
  if (value === 'open') return '更愿意接触人';
  if (value === 'reserved') return '会收着一点';
  if (value === 'avoidant') return '更想躲开社交';
  return '社交状态中性';
}

function getAttentionLabel(value: CharacterTemporalState['attentionState']) {
  if (value === 'focused') return '注意力比较在这边';
  if (value === 'split') return '注意力有点分散';
  if (value === 'resting') return '像半休息半回应';
  return '注意力有点飘';
}

function getPullLabel(value: CharacterTemporalState['relationshipPull']) {
  if (value === 'high') return '对你牵引很强';
  if (value === 'medium') return '对你有明显牵引';
  return '对你牵引偏低';
}

export function buildSharedCharacterState(
  input: BuildSharedCharacterStateInput,
): SharedCharacterStatePrompt {
  const publicResidue = collectVisibleSummaries(input.sceneScopedSignals.relationshipResidue, PUBLIC_VISIBILITY, 2);
  const publicTasks = collectVisibleSummaries(input.sceneScopedSignals.taskResidue, PUBLIC_VISIBILITY, 1);
  const publicTopics = collectVisibleSummaries(input.sceneScopedSignals.topicAnchors, PUBLIC_VISIBILITY, 1);
  const privateResidue = collectVisibleSummaries(input.sceneScopedSignals.relationshipResidue, PRIVATE_VISIBILITY, 2);
  const privateTasks = collectVisibleSummaries(input.sceneScopedSignals.taskResidue, PRIVATE_VISIBILITY, 1);
  const privateTopics = collectVisibleSummaries(input.sceneScopedSignals.topicAnchors, PRIVATE_VISIBILITY, 1);

  const publicCarryover = mergeSummaryParts([
    input.sceneScopedSignals.publicAcquaintanceSummary,
    ...publicResidue,
    ...publicTasks,
    ...publicTopics,
  ], 3);
  const privateCarryover = mergeSummaryParts([
    input.sceneScopedSignals.sharedRecentRelationshipSummary,
    ...privateResidue,
    ...privateTasks,
    ...privateTopics,
  ], 3);

  const directPrompt = [
    '## 统一角色状态',
    '[说明] 单聊和群聊里的这个角色是同一个人。先按当前共享状态说话，再决定这轮单聊怎么接。',
    `[当前状态] ${compactLine(input.temporalState.presenceCue.currentActivity, 96)}`,
    `[开口方式] ${compactLine(input.temporalState.presenceCue.attentionNote, 72)}`,
    `[共享状态标签] ${getAvailabilityLabel(input.temporalState.continuityMode)}；${getEnergyLabel(input.temporalState.energyState)}；${getSocialLabel(input.temporalState.socialState)}；${getAttentionLabel(input.temporalState.attentionState)}；${getPullLabel(input.temporalState.relationshipPull)}`,
    publicCarryover ? `[公开可见余波] ${publicCarryover}` : '',
    privateCarryover ? `[你和${input.character.name}之间的私下余波] ${privateCarryover}` : `[私下余波] ${compactLine(input.temporalState.presenceCue.lifeResidue, 96)}`,
    '[边界] 让群聊、单聊、其他场景共同影响这个人的状态，但不要把别的场景原话机械复述到当前单聊里。',
  ].filter(Boolean).join('\n');

  const groupPrompt = [
    '## 统一角色状态',
    '[说明] 群聊和单聊共享同一个角色状态，但群聊只能使用公开可见的那部分变化。',
    `[当前状态] ${compactLine(input.temporalState.presenceCue.currentActivity, 96)}`,
    `[群聊开口方式] ${compactLine(input.temporalState.presenceCue.attentionNote, 72)}`,
    `[公开状态标签] ${getAvailabilityLabel(input.temporalState.continuityMode)}；${getEnergyLabel(input.temporalState.energyState)}；${getSocialLabel(input.temporalState.socialState)}；${getAttentionLabel(input.temporalState.attentionState)}`,
    publicCarryover ? `[群里能感觉到的余波] ${publicCarryover}` : '',
    '[边界] 只让这些公开状态影响群里的活跃度、语气和是否接话；不要把私聊原话、私密细节或只有你们两个人知道的事直接搬到群里。',
  ].filter(Boolean).join('\n');

  return {
    directPrompt,
    groupPrompt,
  };
}

export function buildPersistedSharedCharacterState(input: {
  character: Pick<Character, 'shortTermSummary'>;
  temporalState: CharacterTemporalState;
  sceneScopedSignals: SceneScopedSignals;
  sourceScene: Character['sharedState'] extends { sourceScene: infer T } ? T : never;
  updatedAt?: number;
}) {
  const availability: NonNullable<Character['sharedState']>['availability'] = input.temporalState.continuityMode === 'continuous_scene'
    ? 'live'
    : input.temporalState.continuityMode === 'same_day_resume'
      ? 'recent'
      : 'away';

  const publicResidue = collectVisibleSummaries(input.sceneScopedSignals.relationshipResidue, PUBLIC_VISIBILITY, 2);
  const publicTasks = collectVisibleSummaries(input.sceneScopedSignals.taskResidue, PUBLIC_VISIBILITY, 1);
  const publicTopics = collectVisibleSummaries(input.sceneScopedSignals.topicAnchors, PUBLIC_VISIBILITY, 1);
  const privateResidue = collectVisibleSummaries(input.sceneScopedSignals.relationshipResidue, PRIVATE_VISIBILITY, 2);
  const privateTasks = collectVisibleSummaries(input.sceneScopedSignals.taskResidue, PRIVATE_VISIBILITY, 1);
  const privateTopics = collectVisibleSummaries(input.sceneScopedSignals.topicAnchors, PRIVATE_VISIBILITY, 1);

  return {
    updatedAt: input.updatedAt ?? input.temporalState.temporalFacts.nowTimestamp,
    sourceScene: input.sourceScene,
    availability,
    resumeTone: input.temporalState.presenceCue.resumeStyle,
    currentActivity: compactLine(input.temporalState.presenceCue.currentActivity, 96) || undefined,
    attentionNote: compactLine(input.temporalState.presenceCue.attentionNote, 72) || undefined,
    publicCarryover: mergeSummaryParts([
      input.sceneScopedSignals.publicAcquaintanceSummary,
      ...publicResidue,
      ...publicTasks,
      ...publicTopics,
    ], 3) || undefined,
    privateCarryover: mergeSummaryParts([
      input.character.shortTermSummary,
      input.sceneScopedSignals.sharedRecentRelationshipSummary,
      ...privateResidue,
      ...privateTasks,
      ...privateTopics,
    ], 3) || undefined,
  };
}

function getPresenceLifeBeat(presenceState: CharacterPresenceState | undefined): string {
  return compactLine(presenceState?.recentLifeBeat, 96) || '这个人此刻仍带着自己的生活节奏，不是每个窗口都像重开成另一个人。';
}

function getPresenceResumeTone(presenceState: CharacterPresenceState | undefined): string {
  if (presenceState?.resumeTone === 'natural_continue') return '更像自然延续';
  if (presenceState?.resumeTone === 'soft_return') return '更像轻量回线';
  if (presenceState?.resumeTone === 'fresh_reentry') return '更像隔段重新出现';
  return '当前像在自己的生活节奏里重新露面';
}

export function buildSharedStateWritePatch(input: {
  character: Pick<Character, 'sharedState' | 'presenceState' | 'shortTermSummary'>;
  sourceScene: NonNullable<Character['sharedState']>['sourceScene'];
  updatedAt?: number;
  publicSummaries?: string[];
  privateSummaries?: string[];
  shortTermSummaryOverride?: string;
  replacePublicCarryover?: boolean;
  replacePrivateCarryover?: boolean;
  currentActivity?: string;
  attentionNote?: string;
  availability?: NonNullable<Character['sharedState']>['availability'];
  resumeTone?: NonNullable<Character['sharedState']>['resumeTone'];
}) {
  const existing = input.character.sharedState;
  const currentActivity = compactLine(input.currentActivity, 96)
    || existing?.currentActivity
    || getPresenceLifeBeat(input.character.presenceState);
  const attentionNote = compactLine(input.attentionNote, 72)
    || existing?.attentionNote
    || getPresenceResumeTone(input.character.presenceState);
  const publicCarryover = mergeSummaryParts([
    ...(!input.replacePublicCarryover && existing?.publicCarryover ? [existing.publicCarryover] : []),
    ...((input.publicSummaries || []).map((summary) => compactLine(summary, 96)).filter(Boolean)),
  ], 3);
  const shortTermSummarySeed = input.shortTermSummaryOverride !== undefined
    ? input.shortTermSummaryOverride
    : input.character.shortTermSummary;
  const privateCarryover = mergeSummaryParts([
    ...(!input.replacePrivateCarryover && existing?.privateCarryover ? [existing.privateCarryover] : []),
    ...(shortTermSummarySeed ? [shortTermSummarySeed] : []),
    ...((input.privateSummaries || []).map((summary) => compactLine(summary, 96)).filter(Boolean)),
  ], 3);

  return {
    updatedAt: input.updatedAt ?? Date.now(),
    sourceScene: input.sourceScene,
    availability: input.availability || existing?.availability || input.character.presenceState?.availability || 'away',
    resumeTone: input.resumeTone || existing?.resumeTone || input.character.presenceState?.resumeTone,
    currentActivity: currentActivity || undefined,
    attentionNote: attentionNote || undefined,
    publicCarryover: publicCarryover || undefined,
    privateCarryover: privateCarryover || undefined,
  };
}

export function rebuildSharedStateFromCharacter(input: {
  character: Pick<Character, 'id' | 'sharedState' | 'presenceState' | 'shortTermSummary' | 'sharedContextSnapshots'>;
  updatedAt?: number;
  sourceScene?: NonNullable<Character['sharedState']>['sourceScene'];
}) {
  const snapshots = input.character.sharedContextSnapshots || [];
  const recordSignals = buildSceneSignalsFromRecords({
    characterId: input.character.id,
  });
  const snapshotRelationshipResidue = snapshots.flatMap((snapshot) => snapshot.relationshipResidue || []);
  const snapshotTaskResidue = snapshots.flatMap((snapshot) => snapshot.taskResidue || []);
  const snapshotTopicAnchors = snapshots.flatMap((snapshot) => snapshot.topicAnchors || []);
  const publicResidue = resolveVisibleSummaries(
    recordSignals.relationshipResidue,
    snapshotRelationshipResidue,
    PUBLIC_VISIBILITY,
    2,
  );
  const publicTasks = resolveVisibleSummaries(
    recordSignals.taskResidue,
    snapshotTaskResidue,
    PUBLIC_VISIBILITY,
    1,
  );
  const publicTopics = resolveVisibleSummaries(
    recordSignals.topicAnchors,
    snapshotTopicAnchors,
    PUBLIC_VISIBILITY,
    1,
  );
  const privateResidue = resolveVisibleSummaries(
    recordSignals.relationshipResidue,
    snapshotRelationshipResidue,
    PRIVATE_VISIBILITY,
    2,
  );
  const privateTasks = resolveVisibleSummaries(
    recordSignals.taskResidue,
    snapshotTaskResidue,
    PRIVATE_VISIBILITY,
    1,
  );
  const privateTopics = resolveVisibleSummaries(
    recordSignals.topicAnchors,
    snapshotTopicAnchors,
    PRIVATE_VISIBILITY,
    1,
  );
  const publicSummaries = [...publicResidue, ...publicTasks, ...publicTopics];
  const privateSummaries = [...privateResidue, ...privateTasks, ...privateTopics];
  const hasRecordDerivedCarryover = recordSignals.summaryLines.length > 0;

  return buildSharedStateWritePatch({
    character: input.character,
    sourceScene: input.sourceScene || input.character.sharedState?.sourceScene || 'direct_chat',
    updatedAt: input.updatedAt,
    publicSummaries,
    privateSummaries,
    shortTermSummaryOverride: hasRecordDerivedCarryover ? '' : input.character.shortTermSummary,
    replacePublicCarryover: publicSummaries.length > 0,
    replacePrivateCarryover: privateSummaries.length > 0 || hasRecordDerivedCarryover,
  });
}

export function buildSharedCharacterStateFromCharacter(input: {
  character: Pick<Character, 'id' | 'name' | 'presenceState' | 'sharedState' | 'shortTermSummary' | 'sharedContextSnapshots'>;
}): SharedCharacterStatePrompt {
  const resolvedSharedState = input.character.sharedState
    ? rebuildSharedStateFromCharacter({
        character: input.character,
        sourceScene: input.character.sharedState.sourceScene,
      })
    : undefined;

  if (input.character.sharedState) {
    return {
      directPrompt: [
        '[统一角色状态] 这是同一个角色在不同场景里的共享状态，不要把别的场景原话照搬进来。',
        resolvedSharedState?.currentActivity ? `[当前生活底色] ${resolvedSharedState.currentActivity}` : '',
        resolvedSharedState?.attentionNote ? `[开口方式] ${resolvedSharedState.attentionNote}` : '',
        resolvedSharedState?.privateCarryover ? `[私下余波] ${resolvedSharedState.privateCarryover}` : '',
      ].filter(Boolean).join('\n'),
      groupPrompt: [
        '[统一角色状态] 群聊、动态、论坛都只应读到公开可见的那部分角色状态。',
        resolvedSharedState?.currentActivity ? `[当前生活底色] ${resolvedSharedState.currentActivity}` : '',
        resolvedSharedState?.attentionNote ? `[公开出场方式] ${resolvedSharedState.attentionNote}` : '',
        resolvedSharedState?.publicCarryover ? `[公开可见余波] ${resolvedSharedState.publicCarryover}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  const recordSignals = buildSceneSignalsFromRecords({
    characterId: input.character.id,
  });
  const snapshotRelationshipResidue = input.character.sharedContextSnapshots?.flatMap((snapshot) => snapshot.relationshipResidue || []) || [];
  const snapshotTaskResidue = input.character.sharedContextSnapshots?.flatMap((snapshot) => snapshot.taskResidue || []) || [];
  const publicResidue = resolveVisibleSummaries(
    recordSignals.relationshipResidue,
    snapshotRelationshipResidue,
    PUBLIC_VISIBILITY,
    2,
  );
  const publicTasks = resolveVisibleSummaries(
    recordSignals.taskResidue,
    snapshotTaskResidue,
    PUBLIC_VISIBILITY,
    1,
  );
  const privateResidue = resolveVisibleSummaries(
    recordSignals.relationshipResidue,
    snapshotRelationshipResidue,
    PRIVATE_VISIBILITY,
    2,
  );
  const privateTasks = resolveVisibleSummaries(
    recordSignals.taskResidue,
    snapshotTaskResidue,
    PRIVATE_VISIBILITY,
    1,
  );
  const shortTermFallbackLines = recordSignals.summaryLines.length > 0
    ? recordSignals.summaryLines
    : (input.character.shortTermSummary ? [input.character.shortTermSummary] : []);

  const publicCarryover = mergeSummaryParts([
    ...publicResidue,
    ...publicTasks,
  ], 3);
  const privateCarryover = mergeSummaryParts([
    ...shortTermFallbackLines,
    ...privateResidue,
    ...privateTasks,
  ], 3);

  const directPrompt = [
    '[统一角色状态] 这是同一个角色在不同场景里的共享状态，不要把别的场景原话照搬进来。',
    `[当前生活底色] ${getPresenceLifeBeat(input.character.presenceState)}`,
    `[重新出现方式] ${getPresenceResumeTone(input.character.presenceState)}`,
    privateCarryover ? `[私下余波] ${privateCarryover}` : '',
  ].filter(Boolean).join('\n');

  const groupPrompt = [
    '[统一角色状态] 群聊、动态、论坛都只应读到公开可见的那部分角色状态。',
    `[当前生活底色] ${getPresenceLifeBeat(input.character.presenceState)}`,
    `[公开出场方式] ${getPresenceResumeTone(input.character.presenceState)}`,
    publicCarryover ? `[公开可见余波] ${publicCarryover}` : '',
  ].filter(Boolean).join('\n');

  return {
    directPrompt,
    groupPrompt,
  };
}
