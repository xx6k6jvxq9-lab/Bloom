import type { Character, ChatGroup, ChatHistory, ChatMessage, WorldBookEntry } from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildDirectFactTraceRecords } from '../relationship-context/buildDirectFactTraceRecords';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';
import { buildGroupWorldBookPrompt } from '../../features/group-world-book/buildGroupWorldBookPrompt';

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
    temporalContext?: string;
    groupSceneHint?: string;
    backgroundSummary?: string;
    memberRelationshipState?: string;
    currentScene?: string;
    publicFacts?: string;
    worldBookPrompt?: string;
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
  activeWorldBooks?: WorldBookEntry[];
  temporalContext?: string;
};

type GroupMemberFamiliarity = 'strangers' | 'aware' | 'familiar';

const FAMILIARITY_ORDER: Record<GroupMemberFamiliarity, number> = {
  strangers: 0,
  aware: 1,
  familiar: 2,
};

function getGroupStageLabel(stage: GroupChatSceneInput['groupStage']): string {
  if (stage === 'warming') return '半熟群';
  if (stage === 'familiar') return '已熟群';
  return '新群';
}

function getSeedMap(group: ChatGroup | undefined) {
  const seedMap = new Map<string, GroupMemberFamiliarity>();
  (group?.memberRelationSeeds || []).forEach((seed) => {
    seedMap.set(`${seed.sourceMemberId}::${seed.targetMemberId}`, seed.familiarity);
  });
  return seedMap;
}

function getFamiliarityLabel(value: GroupMemberFamiliarity): string {
  if (value === 'familiar') return '\u5df2\u7ecf\u6bd4\u8f83\u719f';
  if (value === 'aware') return '\u77e5\u9053\u5bf9\u65b9\uff0c\u4f46\u8fd8\u4e0d\u7b97\u719f';
  return '\u57fa\u672c\u4e0d\u719f';
}

function pickHigherFamiliarity(
  left: GroupMemberFamiliarity,
  right: GroupMemberFamiliarity,
): GroupMemberFamiliarity {
  return FAMILIARITY_ORDER[left] >= FAMILIARITY_ORDER[right] ? left : right;
}

function hasAuthorAliasMatch(
  authorLabel: string | undefined,
  member: Character,
): boolean {
  const normalizedAuthor = authorLabel?.trim().toLowerCase();
  if (!normalizedAuthor) {
    return false;
  }

  const aliases = [member.name, member.remarkName]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => !!value);

  return aliases.includes(normalizedAuthor);
}

function deriveHistoryFamiliarity(
  speaker: Character,
  target: Character,
  history: ChatMessage[],
): GroupMemberFamiliarity | null {
  const recentMessages = history
    .filter((message) => !message.isSystem)
    .filter((message) => message.role === 'model' && !!message.senderCharacterId)
    .slice(-24);

  const speakerMessages = recentMessages.filter((message) => message.senderCharacterId === speaker.id);
  const targetMessages = recentMessages.filter((message) => message.senderCharacterId === target.id);

  if (speakerMessages.length === 0 || targetMessages.length === 0) {
    return null;
  }

  let interactionScore = 1;
  let alternatingTurns = 0;

  for (let index = 1; index < recentMessages.length; index += 1) {
    const previousSender = recentMessages[index - 1]?.senderCharacterId;
    const currentSender = recentMessages[index]?.senderCharacterId;
    const pairMatches = (
      (previousSender === speaker.id && currentSender === target.id)
      || (previousSender === target.id && currentSender === speaker.id)
    );

    if (pairMatches) {
      alternatingTurns += 1;
    }
  }

  if (alternatingTurns >= 1) {
    interactionScore += 1;
  }

  const directReplyCount = recentMessages.filter((message) => {
    if (message.senderCharacterId !== speaker.id && message.senderCharacterId !== target.id) {
      return false;
    }

    const counterpart = message.senderCharacterId === speaker.id ? target : speaker;
    return hasAuthorAliasMatch(message.replyTo?.authorLabel, counterpart);
  }).length;

  if (directReplyCount >= 1) {
    interactionScore += 1;
  }

  if (speakerMessages.length >= 2 && targetMessages.length >= 2) {
    interactionScore += 1;
  }

  return interactionScore >= 3 ? 'familiar' : 'aware';
}

function getEffectiveSeedMap(
  speaker: Character,
  members: Character[],
  group: ChatGroup | undefined,
  history: ChatMessage[],
) {
  const seedMap = getSeedMap(group);

  members
    .filter((member) => member.id !== speaker.id)
    .forEach((member) => {
      const key = `${speaker.id}::${member.id}`;
      const seededFamiliarity = seedMap.get(key) || 'strangers';
      const derivedFamiliarity = deriveHistoryFamiliarity(speaker, member, history);
      if (!derivedFamiliarity) {
        return;
      }

      seedMap.set(key, pickHigherFamiliarity(seededFamiliarity, derivedFamiliarity));
    });

  return seedMap;
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
  history: ChatMessage[] = [],
): string[] {
  const seedMap = getEffectiveSeedMap(speaker, members, group, history);

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
  history: ChatMessage[] = [],
): string {
  const seedMap = getEffectiveSeedMap(speaker, members, group, history);
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
    activeWorldBooks: options.activeWorldBooks,
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
    relationshipSummary: buildRelationshipSummary(options.speaker, options.members, groupStage, options.group, options.history),
    peerAwareness: buildPeerAwareness(options.speaker, options.members, options.group, options.history),
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
      temporalContext: options.temporalContext?.trim() || undefined,
      groupSceneHint: characterContext.sceneHints?.groupChat,
      backgroundSummary: options.group?.backgroundSummary?.trim() || undefined,
      memberRelationshipState,
      currentScene: options.group?.currentScene?.trim() || undefined,
      publicFacts: options.group?.publicFacts?.trim() || undefined,
      worldBookPrompt: buildGroupWorldBookPrompt(options.activeWorldBooks),
      expressionStyle: characterContext.expressionStyle,
      boundaryPack: characterContext.boundaryPack,
      publicAcquaintanceSummary: sceneScopedSignals.publicAcquaintanceSummary,
      sharedRecentRelationshipSummary: sceneScopedSignals.sharedRecentRelationshipSummary,
    },
    historyTranscript: buildHistoryTranscript(options.history, options.userName),
  };
}
