import type { Character, ChatGroup, ChatHistory, ChatMessage, PerceptionSettings, WorldBookEntry } from '../../types';
import { buildGroupWorldBookPrompt } from '../../features/group-world-book/buildGroupWorldBookPrompt';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildDirectFactTraceRecords } from '../relationship-context/buildDirectFactTraceRecords';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';
import { buildCharacterTemporalState } from '../relationship-time/buildCharacterTemporalState';

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
    relationshipAwareness?: string;
    groupRoleAwareness?: string;
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
  perception?: PerceptionSettings;
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
  if (value === 'familiar') return '已经比较熟';
  if (value === 'aware') return '知道对方，但还不算熟';
  return '基本不熟';
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

function getAwarenessSourceLabel(params: {
  seeded: GroupMemberFamiliarity | undefined;
  effective: GroupMemberFamiliarity;
}): string {
  if (params.seeded && params.seeded !== 'strangers') {
    return '这段认识在进群前就已经存在';
  }

  if (params.effective !== 'strangers') {
    return '这段熟悉感更多是进群后慢慢形成的';
  }

  return '目前还没有明显熟悉基础';
}

function buildRelationshipAwareness(
  speaker: Character,
  members: Character[],
  group?: ChatGroup,
  history: ChatMessage[] = [],
): string | undefined {
  const rawSeedMap = getSeedMap(group);
  const effectiveSeedMap = getEffectiveSeedMap(speaker, members, group, history);
  const lines = members
    .filter((member) => member.id !== speaker.id)
    .map((member) => {
      const key = `${speaker.id}::${member.id}`;
      const effective = effectiveSeedMap.get(key) || 'strangers';
      const seeded = rawSeedMap.get(key);
      return `${member.name}：${getFamiliarityLabel(effective)}；${getAwarenessSourceLabel({
        seeded,
        effective,
      })}`;
    });

  return lines.length > 0
    ? [
        '你进群时会自然带着对成员关系的判断，但这只是关系意识，不是硬规则。',
        ...lines,
      ].join('\n')
    : undefined;
}

function buildGroupRoleAwareness(
  speaker: Character,
  members: Character[],
  group?: ChatGroup,
  history: ChatMessage[] = [],
): string | undefined {
  const effectiveSeedMap = getEffectiveSeedMap(speaker, members, group, history);
  const recentMessages = history
    .filter((message) => !message.isSystem)
    .filter((message) => message.role === 'model' && !!message.senderCharacterId)
    .slice(-24);
  const speakerRecentCount = recentMessages.filter((message) => message.senderCharacterId === speaker.id).length;
  const familiarCount = members
    .filter((member) => member.id !== speaker.id)
    .filter((member) => (effectiveSeedMap.get(`${speaker.id}::${member.id}`) || 'strangers') === 'familiar')
    .length;
  const awareCount = members
    .filter((member) => member.id !== speaker.id)
    .filter((member) => {
      const familiarity = effectiveSeedMap.get(`${speaker.id}::${member.id}`) || 'strangers';
      return familiarity === 'aware';
    })
    .length;

  let position = '在这个群里你更像还在观察气氛的人';
  if (group?.groupStage === 'familiar' && familiarCount >= 2) {
    position = '在这个群里你更像已经融进去的熟人局成员';
  } else if (speakerRecentCount >= 4 && (familiarCount >= 1 || awareCount >= 2)) {
    position = '在这个群里你更像会自然接话、已经有存在感的人';
  } else if (group?.groupStage === 'warming' || awareCount >= 1) {
    position = '在这个群里你更像半熟状态下会看人和气氛开口的人';
  }

  return `${position}。这只是在场位置感，不是强制要求；最后仍然按你自己的人设和当下气氛说话。`;
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
    guideLines.push('当前场景只用于决定这句群聊像不像正在那个场景里发生，不要把场景卡片重新讲一遍。');
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

function formatGroupTemporalStatePrompt(
  state: ReturnType<typeof buildCharacterTemporalState>,
  baseTemporalContext?: string,
): string {
  const timePeriodLabelMap: Record<typeof state.temporalFacts.timePeriod, string> = {
    late_night: '深夜',
    early_morning: '清晨',
    morning: '上午',
    noon: '中午',
    afternoon: '下午',
    evening: '晚上',
  };
  const topicActionLabelMap: Record<typeof state.topicHeatState.suggestedTopicAction, string> = {
    continue: '继续承接',
    soften: '放缓一点',
    shift: '自然转场',
    close: '可以收束',
  };
  const momentumLabelMap: Record<typeof state.sceneMomentum, string> = {
    continue: '继续',
    soften: '放缓',
    shift: '转场',
    close: '收束',
  };
  const energyLabelMap: Record<typeof state.energyState, string> = {
    high: '高',
    steady: '稳定',
    low: '偏低',
    sleepy: '困倦',
  };
  const socialLabelMap: Record<typeof state.socialState, string> = {
    open: '开放',
    neutral: '中性',
    reserved: '收着一点',
    avoidant: '回避',
  };
  const attentionLabelMap: Record<typeof state.attentionState, string> = {
    focused: '集中',
    split: '分散',
    drifting: '游离',
    resting: '休息中',
  };
  const pullLabelMap: Record<typeof state.relationshipPull, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  const topicActionGuideMap: Record<typeof state.topicHeatState.suggestedTopicAction, string> = {
    continue: '当前群里这个点还能自然接，但仍然只接最 relevant 的一小步，不要抢着把话说满。',
    soften: '当前群里这个点已经有点过热了，优先收一收力度，别一直围着同一个点追打。',
    shift: '当前群里可以自然转去更贴近此刻气氛的新点，不要死咬旧点不放。',
    close: '当前群里这个点可以先收束，允许停顿、留白，或者把空间让给别人。',
  };

  return [
    baseTemporalContext?.trim() || '',
    '[群聊里的角色时间状态]',
    `[当前时段] ${timePeriodLabelMap[state.temporalFacts.timePeriod]}`,
    `[话题建议] ${topicActionLabelMap[state.topicHeatState.suggestedTopicAction]}`,
    `[能量状态] ${energyLabelMap[state.energyState]}`,
    `[社交状态] ${socialLabelMap[state.socialState]}`,
    `[注意力状态] ${attentionLabelMap[state.attentionState]}`,
    `[关系牵引] ${pullLabelMap[state.relationshipPull]}`,
    `[场景动量] ${momentumLabelMap[state.sceneMomentum]}`,
    state.topicHeatState.lastTopicAnchor ? `[最近话题锚点] ${state.topicHeatState.lastTopicAnchor}` : '',
    `[群聊节奏提醒] ${topicActionGuideMap[state.topicHeatState.suggestedTopicAction]}`,
  ].filter(Boolean).join('\n');
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
  const characterTemporalState = buildCharacterTemporalState({
    characterId: options.speaker.id,
    perception: options.perception,
    directChatHistory: options.directChatHistory,
    groupMessages: options.history,
  });
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
      temporalContext: formatGroupTemporalStatePrompt(characterTemporalState, options.temporalContext),
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
      relationshipAwareness: buildRelationshipAwareness(options.speaker, options.members, options.group, options.history),
      groupRoleAwareness: buildGroupRoleAwareness(options.speaker, options.members, options.group, options.history),
    },
    historyTranscript: buildHistoryTranscript(options.history, options.userName),
  };
}
