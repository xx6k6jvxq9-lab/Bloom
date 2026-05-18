import type {
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  GroupOfflineSession,
  PerceptionSettings,
  WorldBookEntry,
} from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildLongTermMemoryProfile } from '../memory/buildLongTermMemoryProfile';
import { buildShortTermSummary } from '../memory/buildShortTermSummary';
import { buildGroupChatSceneInput } from '../scene-inputs/buildGroupChatSceneInput';
import type {
  GroupOfflineCharacterRuntimeProjection,
  GroupOfflineProjectionGroupState,
  GroupOfflineProjectionPeerRelation,
  GroupOfflineRuntimeProjection,
} from './types';

type BuildGroupOfflineRuntimeProjectionInput = {
  session: GroupOfflineSession;
  group: ChatGroup;
  members: Character[];
  userName: string;
  history: ChatMessage[];
  directChatHistory?: ChatHistory;
  activeWorldBooks?: WorldBookEntry[];
  perception?: PerceptionSettings;
};

const AVATAR_STATUS_RANK: Record<string, number> = {
  current: 0,
  saved: 1,
  candidate: 2,
  used: 3,
  rejected: 4,
};

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildMemberAliases(member: Character): string[] {
  return [member.name, member.remarkName?.trim()]
    .map((value) => normalizeOptionalText(value))
    .filter((value): value is string => !!value);
}

function sanitizeOffstageContextText(
  value: string | null | undefined,
  offstageAliases: string[],
): string | undefined {
  const normalized = normalizeOptionalText(value);
  if (!normalized || offstageAliases.length === 0) return normalized;

  const lines = normalized
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !offstageAliases.some((alias) => alias && line.includes(alias)));

  return lines.length > 0 ? lines.join('\n') : undefined;
}

function resolveAvatarCandidates(member: Character): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (value: string | null | undefined) => {
    const normalized = normalizeOptionalText(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };

  push(member.avatar);
  [...(member.avatarLibrary?.entries || [])]
    .sort((left, right) => {
      const statusDelta = (AVATAR_STATUS_RANK[left.status] ?? 99) - (AVATAR_STATUS_RANK[right.status] ?? 99);
      if (statusDelta !== 0) return statusDelta;
      return (right.updatedAt || 0) - (left.updatedAt || 0);
    })
    .forEach((entry) => push(entry.image));
  return result;
}

function getPairSeedFamiliarity(group: ChatGroup, leftId: string, rightId: string): 'strangers' | 'aware' | 'familiar' | undefined {
  const direct = (group.memberRelationSeeds || []).find((seed) => seed.sourceMemberId === leftId && seed.targetMemberId === rightId);
  const reverse = (group.memberRelationSeeds || []).find((seed) => seed.sourceMemberId === rightId && seed.targetMemberId === leftId);
  const candidates = [direct?.familiarity, reverse?.familiarity].filter(Boolean) as Array<'strangers' | 'aware' | 'familiar'>;
  if (candidates.includes('familiar')) return 'familiar';
  if (candidates.includes('aware')) return 'aware';
  if (candidates.includes('strangers')) return 'strangers';
  return undefined;
}

function getPairHintFamiliarity(left: Character, right: Character): 'stranger' | 'aware' | 'familiar' | undefined {
  const direct = left.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === right.id)?.familiarity;
  const reverse = right.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === left.id)?.familiarity;
  const candidates = [direct, reverse].filter(Boolean) as Array<'stranger' | 'aware' | 'familiar'>;
  if (candidates.includes('familiar')) return 'familiar';
  if (candidates.includes('aware')) return 'aware';
  if (candidates.includes('stranger')) return 'stranger';
  return undefined;
}

function getPairInteractionStyle(left: Character, right: Character): string | undefined {
  const direct = normalizeOptionalText(left.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === right.id)?.interactionStyle);
  const reverse = normalizeOptionalText(right.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === left.id)?.interactionStyle);
  return direct || reverse;
}

function getRecentPairInteractionLabel(history: ChatMessage[], leftId: string, rightId: string): string | undefined {
  const recentMessages = history
    .filter((message) => !message.isSystem && message.role === 'model' && !!message.senderCharacterId)
    .slice(-24);
  const pairMessages = recentMessages.filter((message) => message.senderCharacterId === leftId || message.senderCharacterId === rightId);
  if (pairMessages.length === 0) return undefined;

  let alternatingTurns = 0;
  for (let index = 1; index < pairMessages.length; index += 1) {
    const previousSender = pairMessages[index - 1]?.senderCharacterId;
    const currentSender = pairMessages[index]?.senderCharacterId;
    if (
      (previousSender === leftId && currentSender === rightId)
      || (previousSender === rightId && currentSender === leftId)
    ) {
      alternatingTurns += 1;
    }
  }

  if (alternatingTurns >= 4) return '最近接话很密，彼此会顺手对上。';
  if (alternatingTurns >= 2) return '最近有明显对接和来回。';
  if (pairMessages.length >= 2) return '最近同场里已经会互相搭到话头。';
  return '最近有同场露面，但互动还不算多。';
}

function buildPeerRelationProjection(input: {
  actor: Character;
  peer: Character;
  group: ChatGroup;
  history: ChatMessage[];
}): GroupOfflineProjectionPeerRelation {
  const seedFamiliarity = getPairSeedFamiliarity(input.group, input.actor.id, input.peer.id);
  const hintFamiliarity = getPairHintFamiliarity(input.actor, input.peer);
  const interactionStyle = getPairInteractionStyle(input.actor, input.peer);
  const recentInteraction = getRecentPairInteractionLabel(input.history, input.actor.id, input.peer.id);

  const familiarityLabel = seedFamiliarity === 'familiar'
    ? '群里已经偏熟'
    : seedFamiliarity === 'aware'
      ? '群里知道彼此'
      : seedFamiliarity === 'strangers'
        ? '群里还偏生'
        : hintFamiliarity === 'familiar'
          ? '公开层已经熟'
          : hintFamiliarity === 'aware'
            ? '公开层知道彼此'
            : hintFamiliarity === 'stranger'
              ? '公开层仍偏生'
              : undefined;

  const interactionStyleLabel = interactionStyle === 'warm'
    ? '互动偏热'
    : interactionStyle === 'banter'
      ? '互动偏打趣'
      : interactionStyle === 'guarded'
        ? '互动偏收着'
        : interactionStyle === 'neutral'
          ? '互动偏中性'
          : undefined;

  const summary = [
    familiarityLabel ? `熟悉度：${familiarityLabel}` : '',
    interactionStyleLabel ? `公开互动：${interactionStyleLabel}` : '',
    recentInteraction ? `最近同场：${recentInteraction}` : '',
  ].filter(Boolean).join('\n');

  return {
    peerCharacterId: input.peer.id,
    peerName: input.peer.remarkName?.trim() || input.peer.name,
    familiarityLabel,
    interactionStyleLabel,
    summary: summary || '当前没有稳定明示关系，但同场时仍会被彼此的位置和气氛影响。',
  };
}

function buildGroupStateProjection(sceneInput: ReturnType<typeof buildGroupChatSceneInput>): GroupOfflineProjectionGroupState {
  return {
    groupShortTermSummary: normalizeOptionalText(sceneInput.recentContext?.groupShortTermSummary),
    groupMemberPerspectiveSummary: normalizeOptionalText(sceneInput.recentContext?.groupMemberPerspectiveSummary),
    groupLongTermAtmosphere: normalizeOptionalText(sceneInput.recentContext?.groupLongTermAtmosphere),
    groupRecurringDynamics: normalizeOptionalText(sceneInput.recentContext?.groupRecurringDynamics),
    groupSharedHistory: normalizeOptionalText(sceneInput.recentContext?.groupSharedHistory),
    speakerLongTermGroupRole: normalizeOptionalText(sceneInput.recentContext?.speakerLongTermGroupRole),
    backgroundSummary: normalizeOptionalText(sceneInput.recentContext?.backgroundSummary),
    memberRelationshipState: normalizeOptionalText(sceneInput.recentContext?.memberRelationshipState),
    currentScene: normalizeOptionalText(sceneInput.recentContext?.currentScene),
    publicFacts: normalizeOptionalText(sceneInput.recentContext?.publicFacts),
    topicStatePrompt: normalizeOptionalText(sceneInput.recentContext?.topicStatePrompt),
  };
}

function buildRelationshipContextSummary(input: {
  sceneInput: ReturnType<typeof buildGroupChatSceneInput>;
  peerRelations: GroupOfflineProjectionPeerRelation[];
}): string | undefined {
  const lines = [
    normalizeOptionalText(input.sceneInput.relationshipSummary),
    normalizeOptionalText(input.sceneInput.recentContext?.shortTermSummary)
      ? `近期状态：${normalizeOptionalText(input.sceneInput.recentContext?.shortTermSummary)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.longTermMemoryProfile)
      ? `长期记忆画像：${normalizeOptionalText(input.sceneInput.recentContext?.longTermMemoryProfile)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.sharedCharacterStatePrompt)
      ? `当前共享状态：\n${normalizeOptionalText(input.sceneInput.recentContext?.sharedCharacterStatePrompt)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.publicAcquaintanceSummary)
      ? `公开关系：${normalizeOptionalText(input.sceneInput.recentContext?.publicAcquaintanceSummary)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.sharedRecentRelationshipSummary)
      ? `跨场景关系余波：${normalizeOptionalText(input.sceneInput.recentContext?.sharedRecentRelationshipSummary)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.groupMemberPerspectiveSummary)
      ? `当前角色私下视角：${normalizeOptionalText(input.sceneInput.recentContext?.groupMemberPerspectiveSummary)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.relationshipTensionSummary)
      ? `同场关系张力：${normalizeOptionalText(input.sceneInput.recentContext?.relationshipTensionSummary)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.groupLongTermAtmosphere)
      ? `群长期氛围：${normalizeOptionalText(input.sceneInput.recentContext?.groupLongTermAtmosphere)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.groupRecurringDynamics)
      ? `群固定互动惯性：${normalizeOptionalText(input.sceneInput.recentContext?.groupRecurringDynamics)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.speakerLongTermGroupRole)
      ? `群内长期位置：${normalizeOptionalText(input.sceneInput.recentContext?.speakerLongTermGroupRole)}`
      : '',
    normalizeOptionalText(input.sceneInput.recentContext?.groupSharedHistory)
      ? `群共同经历：${normalizeOptionalText(input.sceneInput.recentContext?.groupSharedHistory)}`
      : '',
    input.peerRelations.length > 0
      ? ['本场其他角色关系：', ...input.peerRelations.map((relation) => `- ${relation.peerName}：${relation.summary.replace(/\n/g, '；')}`)].join('\n')
      : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : undefined;
}

function extractGroupOfflineRecallText(message: Pick<ChatMessage, 'text'>): string {
  return normalizeOptionalText(message.text) || '';
}

export function buildGroupOfflineRuntimeProjection(
  input: BuildGroupOfflineRuntimeProjectionInput,
): GroupOfflineRuntimeProjection {
  const participantIds = new Set(input.session.participants.map((participant) => participant.characterId));
  const sceneMembers = input.members.filter((member) => participantIds.has(member.id));
  const offstageAliases = input.members
    .filter((member) => !participantIds.has(member.id))
    .flatMap((member) => buildMemberAliases(member));
  const runtimeHistory = [
    ...input.history,
    ...input.session.messages
      .filter((message) => message.role === 'user' && !!extractGroupOfflineRecallText(message))
      .map((message) => ({
        role: 'user' as const,
        text: message.text,
        timestamp: message.timestamp,
      })),
  ];

  const characters: GroupOfflineCharacterRuntimeProjection[] = sceneMembers.map((member) => {
    const sceneInput = buildGroupChatSceneInput({
      speaker: member,
      members: sceneMembers,
      group: input.group,
      history: runtimeHistory,
      userName: input.userName,
      directChatHistory: input.directChatHistory,
      activeWorldBooks: input.activeWorldBooks,
      perception: input.perception,
    });
    const characterContext = buildCharacterContext({
      character: member,
      activeWorldBooks: input.activeWorldBooks,
    });
    const peerRelations = sceneMembers
      .filter((peer) => peer.id !== member.id)
      .map((peer) => buildPeerRelationProjection({
        actor: member,
        peer,
        group: input.group,
        history: runtimeHistory,
      }));

    return {
      identity: {
        characterId: member.id,
        name: member.name,
        displayName: member.remarkName?.trim() || member.name,
        remarkName: normalizeOptionalText(member.remarkName),
        avatar: resolveAvatarCandidates(member)[0],
        avatarCandidates: resolveAvatarCandidates(member),
        signature: normalizeOptionalText(member.signature),
        openingRemark: normalizeOptionalText(member.openingRemark),
      },
      persona: {
        corePersona: normalizeOptionalText(characterContext.corePersona),
        expressionStyle: normalizeOptionalText(characterContext.expressionStyle),
        boundaryPack: normalizeOptionalText(characterContext.boundaryPack),
        extendedLore: normalizeOptionalText(characterContext.extendedLore),
        sceneHint: normalizeOptionalText(
          sanitizeOffstageContextText(
            characterContext.sceneHints?.groupOffline
            || characterContext.sceneHints?.groupChat
            || characterContext.sceneHints?.chat,
            offstageAliases,
          ),
        ),
        worldBookPrompt: sanitizeOffstageContextText(sceneInput.recentContext?.worldBookPrompt || characterContext.worldBookPrompt, offstageAliases),
      },
      memory: {
        shortTermSummary: sanitizeOffstageContextText(sceneInput.recentContext?.shortTermSummary || buildShortTermSummary(member), offstageAliases),
        longTermMemoryProfile: sanitizeOffstageContextText(sceneInput.recentContext?.longTermMemoryProfile || buildLongTermMemoryProfile(member), offstageAliases),
        sharedCharacterStatePrompt: sanitizeOffstageContextText(sceneInput.recentContext?.sharedCharacterStatePrompt, offstageAliases),
      },
      userRelation: {
        relationshipSummary: sanitizeOffstageContextText(sceneInput.relationshipSummary, offstageAliases),
        publicAcquaintanceSummary: sanitizeOffstageContextText(sceneInput.recentContext?.publicAcquaintanceSummary, offstageAliases),
        sharedRecentRelationshipSummary: sanitizeOffstageContextText(sceneInput.recentContext?.sharedRecentRelationshipSummary, offstageAliases),
        relationshipTensionSummary: sanitizeOffstageContextText(sceneInput.recentContext?.relationshipTensionSummary, offstageAliases),
      },
      peerRelations,
      groupState: {
        groupShortTermSummary: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).groupShortTermSummary, offstageAliases),
        groupMemberPerspectiveSummary: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).groupMemberPerspectiveSummary, offstageAliases),
        groupLongTermAtmosphere: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).groupLongTermAtmosphere, offstageAliases),
        groupRecurringDynamics: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).groupRecurringDynamics, offstageAliases),
        groupSharedHistory: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).groupSharedHistory, offstageAliases),
        speakerLongTermGroupRole: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).speakerLongTermGroupRole, offstageAliases),
        backgroundSummary: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).backgroundSummary, offstageAliases),
        memberRelationshipState: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).memberRelationshipState, offstageAliases),
        currentScene: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).currentScene, offstageAliases),
        publicFacts: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).publicFacts, offstageAliases),
        topicStatePrompt: sanitizeOffstageContextText(buildGroupStateProjection(sceneInput).topicStatePrompt, offstageAliases),
      },
      relationshipContextSummary: buildRelationshipContextSummary({
        sceneInput: {
          ...sceneInput,
          relationshipSummary: sanitizeOffstageContextText(sceneInput.relationshipSummary, offstageAliases) || '',
          recentContext: sceneInput.recentContext ? {
            ...sceneInput.recentContext,
            shortTermSummary: sanitizeOffstageContextText(sceneInput.recentContext.shortTermSummary, offstageAliases),
            longTermMemoryProfile: sanitizeOffstageContextText(sceneInput.recentContext.longTermMemoryProfile, offstageAliases),
            sharedCharacterStatePrompt: sanitizeOffstageContextText(sceneInput.recentContext.sharedCharacterStatePrompt, offstageAliases),
            publicAcquaintanceSummary: sanitizeOffstageContextText(sceneInput.recentContext.publicAcquaintanceSummary, offstageAliases),
            sharedRecentRelationshipSummary: sanitizeOffstageContextText(sceneInput.recentContext.sharedRecentRelationshipSummary, offstageAliases),
            groupMemberPerspectiveSummary: sanitizeOffstageContextText(sceneInput.recentContext.groupMemberPerspectiveSummary, offstageAliases),
            relationshipTensionSummary: sanitizeOffstageContextText(sceneInput.recentContext.relationshipTensionSummary, offstageAliases),
            groupLongTermAtmosphere: sanitizeOffstageContextText(sceneInput.recentContext.groupLongTermAtmosphere, offstageAliases),
            groupRecurringDynamics: sanitizeOffstageContextText(sceneInput.recentContext.groupRecurringDynamics, offstageAliases),
            speakerLongTermGroupRole: sanitizeOffstageContextText(sceneInput.recentContext.speakerLongTermGroupRole, offstageAliases),
            groupSharedHistory: sanitizeOffstageContextText(sceneInput.recentContext.groupSharedHistory, offstageAliases),
          } : sceneInput.recentContext,
        },
        peerRelations,
      }),
    };
  });

  return {
    session: {
      id: input.session.id,
      groupId: input.session.groupId,
      mode: input.session.mode,
      generationMode: 'blocks',
      activityType: input.session.activityType,
      customActivityType: input.session.customActivityType,
      location: input.session.location,
      timeLabel: input.session.timeLabel,
      weatherLabel: input.session.weatherLabel,
      vibe: input.session.vibe,
      currentRound: input.session.currentRound,
    },
    userName: input.userName,
    groupName: input.group.groupNickname?.trim() || input.group.name,
    generatedAt: Date.now(),
    groupSummary: {
      groupShortTermSummary: sanitizeOffstageContextText(input.group.groupShortTermSummary, offstageAliases),
      groupLongTermAtmosphere: sanitizeOffstageContextText(input.group.groupLongTermMemory?.atmosphere, offstageAliases),
      groupRecurringDynamics: sanitizeOffstageContextText(input.group.groupLongTermMemory?.recurringDynamics, offstageAliases),
      groupSharedHistory: sanitizeOffstageContextText(input.group.groupLongTermMemory?.sharedHistory, offstageAliases),
      backgroundSummary: sanitizeOffstageContextText(input.group.backgroundSummary, offstageAliases),
      memberRelationshipState: sanitizeOffstageContextText(input.group.memberRelationshipNote, offstageAliases),
      currentScene: sanitizeOffstageContextText(input.group.currentScene, offstageAliases),
      publicFacts: sanitizeOffstageContextText(input.group.publicFacts, offstageAliases),
    },
    characters,
  };
}
