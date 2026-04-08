import type { Character, ChatGroup, ChatHistory, ChatMessage } from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildDirectFactTraceRecords } from '../relationship-context/buildDirectFactTraceRecords';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';

export type GroupChatSceneInput = {
  speakerName: string;
  speakerCorePersona: string;
  speakerSignature?: string;
  userName: string;
  memberNames: string[];
  mode: 'reply' | 'invited' | 'opening';
  groupStage: 'new' | 'warming' | 'familiar';
  relationshipSummary: string;
  peerAwareness: string[];
  groupBehaviorGuide?: string;
  roleInstruction: string;
  mentionInstruction?: string;
  recentContext?: {
    shortTermSummary?: string;
    longTermMemoryProfile?: string;
    groupSceneHint?: string;
    backgroundSummary?: string;
    memberRelationshipState?: string;
    currentScene?: string;
    publicFacts?: string;
    expressionStyle?: string;
    boundaryPack?: string;
    publicAcquaintanceSummary?: string;
    sharedRecentRelationshipSummary?: string;
  };
  historyTranscript: string;
};

type BuildGroupChatSceneInputOptions = {
  speaker: Character;
  members: Character[];
  group?: ChatGroup;
  userName: string;
  history: ChatMessage[];
  mode?: 'reply' | 'invited' | 'opening';
  directChatHistory?: ChatHistory;
};

function getGroupStageLabel(stage: GroupChatSceneInput['groupStage']): string {
  if (stage === 'warming') return '半熟群';
  if (stage === 'familiar') return '已熟群';
  return '新群';
}

function getSeedMap(group: ChatGroup | undefined) {
  const seedMap = new Map<string, 'strangers' | 'aware' | 'familiar'>();
  (group?.memberRelationSeeds || []).forEach((seed) => {
    seedMap.set(`${seed.sourceMemberId}::${seed.targetMemberId}`, seed.familiarity);
  });
  return seedMap;
}

function getFamiliarityLabel(value: 'strangers' | 'aware' | 'familiar'): string {
  if (value === 'familiar') return '已经比较熟';
  if (value === 'aware') return '知道对方，但还不算熟';
  return '基本不熟';
}

function getMemberRelationshipStateLabel(value: ChatGroup['memberRelationshipState'] | undefined): string | undefined {
  if (value === 'close') return '成员之间整体偏熟、偏亲近';
  if (value === 'semi') return '成员之间半熟，有来有回但未完全放开';
  if (value === 'distant') return '成员之间偏生疏，互动相对克制';
  if (value === 'mixed') return '成员之间熟悉度不一致，有人熟有人还生疏';
  return undefined;
}

function buildPeerAwareness(
  speaker: Character,
  members: Character[],
  group?: ChatGroup,
): string[] {
  const seedMap = getSeedMap(group);

  return members
    .filter((member) => member.id !== speaker.id)
    .map((member) => {
      const familiarity = seedMap.get(`${speaker.id}::${member.id}`) || 'strangers';
      return `${member.name}：${getFamiliarityLabel(familiarity)}`;
    });
}

function buildRelationshipSummary(
  speaker: Character,
  members: Character[],
  groupStage: GroupChatSceneInput['groupStage'],
  group?: ChatGroup,
): string {
  const seedMap = getSeedMap(group);
  const peerLines = members
    .filter((member) => member.id !== speaker.id)
    .map((member) => {
      const familiarity = seedMap.get(`${speaker.id}::${member.id}`) || 'strangers';
      return `${speaker.name} 对 ${member.name}：${getFamiliarityLabel(familiarity)}`;
    });

  return [`当前群阶段：${getGroupStageLabel(groupStage)}`, ...peerLines].join('\n');
}

function buildGroupBehaviorGuide(group?: ChatGroup): string | undefined {
  const guideLines: string[] = [];

  if (group?.backgroundSummary?.trim()) {
    guideLines.push('把群背景当作氛围底板，不要逐句复述设定。');
  }

  if (group?.memberRelationshipState || group?.memberRelationshipNote?.trim()) {
    guideLines.push('成员关系状态主要用于控制亲疏、语气和插话尺度，不要把关系说明直接说出来。');
  }

  if (group?.currentScene?.trim()) {
    guideLines.push('当前场景只用来决定这句群聊像不像正在那个场景里发生，不要把场景卡片重新讲一遍。');
  }

  if (group?.publicFacts?.trim()) {
    guideLines.push('群公开事实可以自然引用，但只在真的相关时轻量带出，避免像资料播报。');
  }

  return guideLines.length > 0 ? guideLines.join('\n') : undefined;
}

function buildHistoryTranscript(history: ChatMessage[], userName: string): string {
  return history
    .map((message) => {
      if (message.role === 'user') {
        return `${userName}: ${message.text}`;
      }

      return message.text;
    })
    .join('\n');
}

export function buildGroupChatSceneInput(
  options: BuildGroupChatSceneInputOptions,
): GroupChatSceneInput {
  const mode = options.mode ?? 'reply';
  const groupStage = options.group?.groupStage ?? 'new';
  const characterContext = buildCharacterContext({
    character: options.speaker,
  });
  const relationshipProjection = buildRelationshipProjection({
    character: options.speaker,
    userName: options.userName,
    directMessages: options.directChatHistory?.[options.speaker.id] || [],
    groupMessages: options.history,
    groupRelationshipWaves: options.group?.relationshipWaves || [],
    factTraces: [
      ...(options.group?.factTraces || []),
      ...buildDirectFactTraceRecords({
        characterId: options.speaker.id,
        messages: options.directChatHistory?.[options.speaker.id] || [],
      }),
    ],
  });
  const { characterScopedMemory, sceneScopedSignals } = relationshipProjection;
  const memberRelationshipState = [
    getMemberRelationshipStateLabel(options.group?.memberRelationshipState),
    options.group?.memberRelationshipNote?.trim() || '',
  ].filter(Boolean).join('；') || undefined;

  return {
    speakerName: options.speaker.name,
    speakerCorePersona: characterContext.corePersona ?? '',
    speakerSignature: options.speaker.signature?.trim() || undefined,
    userName: options.userName,
    memberNames: options.members.map((member) => member.name),
    mode,
    groupStage,
    relationshipSummary: buildRelationshipSummary(options.speaker, options.members, groupStage, options.group),
    peerAwareness: buildPeerAwareness(options.speaker, options.members, options.group),
    groupBehaviorGuide: buildGroupBehaviorGuide(options.group),
    roleInstruction:
      mode === 'opening'
        ? 'Please send a natural opening message for this group chat.'
        : mode === 'invited'
          ? 'You were just @mentioned or invited to speak. Please reply to the conversation.'
          : 'Please reply to the conversation in the group chat context.',
    mentionInstruction:
      mode === 'reply'
        ? 'If you want to invite another character to speak, you can @mention them (e.g., "@Name").'
        : undefined,
    recentContext: {
      shortTermSummary: characterScopedMemory.shortTermSummary,
      longTermMemoryProfile: characterScopedMemory.longTermMemoryProfile,
      groupSceneHint: characterContext.sceneHints?.groupChat,
      backgroundSummary: options.group?.backgroundSummary?.trim() || undefined,
      memberRelationshipState,
      currentScene: options.group?.currentScene?.trim() || undefined,
      publicFacts: options.group?.publicFacts?.trim() || undefined,
      expressionStyle: characterContext.expressionStyle,
      boundaryPack: characterContext.boundaryPack,
      publicAcquaintanceSummary: sceneScopedSignals.publicAcquaintanceSummary,
      sharedRecentRelationshipSummary: sceneScopedSignals.sharedRecentRelationshipSummary,
    },
    historyTranscript: buildHistoryTranscript(options.history, options.userName),
  };
}
