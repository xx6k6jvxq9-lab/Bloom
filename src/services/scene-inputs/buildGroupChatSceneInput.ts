import type { Character, ChatGroup, ChatHistory, ChatMessage, PerceptionSettings, WorldBookEntry } from '../../types';
import { buildGroupWorldBookPrompt } from '../../features/group-world-book/buildGroupWorldBookPrompt';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildDirectFactTraceRecords } from '../relationship-context/buildDirectFactTraceRecords';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';
import type {
  RelationshipResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import { buildCharacterTemporalState } from '../relationship-time/buildCharacterTemporalState';
import { formatGroupTopicStateForPrompt } from '../group-chat/topicState';
import { filterTopicAnchorsForPrompt } from '../chat/topicRecall';

export type GroupChatSceneInput = {
  speakerName: string;
  speakerCorePersona: string;
  speakerSignature?: string;
  languagePolicy?: Pick<Character, 'replyLanguageMode' | 'nativeLanguage' | 'fixedReplyLanguage'>;
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
      relationshipResidue?: RelationshipResidueItem[];
      topicAnchors?: TopicAnchorItem[];
      taskResidue?: TaskResidueItem[];
      longTermMemoryProfile?: string;
      temporalContext?: string;
      activeDatingSummary?: string;
      groupSceneHint?: string;
    groupShortTermSummary?: string;
    groupMemberPerspectiveSummary?: string;
    groupLongTermAtmosphere?: string;
    groupRecurringDynamics?: string;
    groupSharedHistory?: string;
    speakerLongTermGroupRole?: string;
    backgroundSummary?: string;
    memberRelationshipState?: string;
    currentScene?: string;
    publicFacts?: string;
    topicStatePrompt?: string;
    worldBookPrompt?: string;
    expressionStyle?: string;
    boundaryPack?: string;
    publicAcquaintanceSummary?: string;
    sharedRecentRelationshipSummary?: string;
    relationshipTensionSummary?: string;
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
type UserRelationshipSignal =
  | 'romantic'
  | 'ambiguous_romantic'
  | 'ex'
  | 'family'
  | 'close_friend'
  | 'rival'
  | 'protective';

const FAMILIARITY_ORDER: Record<GroupMemberFamiliarity, number> = {
  strangers: 0,
  aware: 1,
  familiar: 2,
};

const USER_RELATIONSHIP_PATTERNS: Array<{
  signal: UserRelationshipSignal;
  patterns: RegExp[];
}> = [
  {
    signal: 'romantic',
    patterns: [/男朋友/i, /女朋友/i, /恋人/i, /伴侣/i, /老婆/i, /老公/i, /未婚夫/i, /未婚妻/i],
  },
  {
    signal: 'ambiguous_romantic',
    patterns: [/暧昧/i, /喜欢你/i, /暗恋/i, /心动/i, /crush/i],
  },
  {
    signal: 'ex',
    patterns: [/前任/i, /前男友/i, /前女友/i, /旧情人/i],
  },
  {
    signal: 'family',
    patterns: [/家人/i, /亲人/i, /姐姐/i, /妹妹/i, /哥哥/i, /弟弟/i, /妈妈/i, /爸爸/i, /母亲/i, /父亲/i],
  },
  {
    signal: 'close_friend',
    patterns: [/闺蜜/i, /竹马/i, /青梅/i, /死党/i, /挚友/i, /好友/i, /朋友/i],
  },
  {
    signal: 'rival',
    patterns: [/情敌/i, /对手/i, /宿敌/i, /竞争者/i],
  },
  {
    signal: 'protective',
    patterns: [/护着你/i, /照顾你/i, /守着你/i, /监护/i, /保护你/i],
  },
];

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

function getCharacterRelationshipSourceText(character: Character): string {
  const corePersona = buildCharacterContext({ character }).corePersona;

  return [
    corePersona,
    character.expressionStyle,
    character.signature,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
}

function getUserRelationshipSignals(character: Character): Set<UserRelationshipSignal> {
  const text = getCharacterRelationshipSourceText(character);
  const result = new Set<UserRelationshipSignal>();

  USER_RELATIONSHIP_PATTERNS.forEach(({ signal, patterns }) => {
    if (patterns.some((pattern) => pattern.test(text))) {
      result.add(signal);
    }
  });

  return result;
}

function getRelationshipLabel(signal: UserRelationshipSignal): string {
  switch (signal) {
    case 'romantic':
      return '明确恋人向关系';
    case 'ambiguous_romantic':
      return '暧昧或未说开的在意';
    case 'ex':
      return '前任或旧关系';
    case 'family':
      return '家人或亲属向关系';
    case 'close_friend':
      return '亲近朋友向关系';
    case 'rival':
      return '对立或竞争向关系';
    case 'protective':
      return '照顾或保护倾向';
    default:
      return '特殊关系';
  }
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

function buildRelationshipTensionSummary(
  speaker: Character,
  members: Character[],
): string | undefined {
  const speakerSignals = getUserRelationshipSignals(speaker);
  if (speakerSignals.size === 0) {
    return undefined;
  }

  const lines = members
    .filter((member) => member.id !== speaker.id)
    .map((member) => {
      const memberSignals = getUserRelationshipSignals(member);
      if (memberSignals.size === 0) {
        return '';
      }

      const sharedSignals = [...speakerSignals].filter((signal) => memberSignals.has(signal));
      const speakerHasRomantic = speakerSignals.has('romantic') || speakerSignals.has('ambiguous_romantic') || speakerSignals.has('ex');
      const memberHasRomantic = memberSignals.has('romantic') || memberSignals.has('ambiguous_romantic') || memberSignals.has('ex');

      if (speakerHasRomantic && memberHasRomantic) {
        return `${member.name} 也和用户存在恋爱或暧昧向关系，同场时可能自然出现比较、试探、吃味、装作没事或轻微护位；但只有符合你的人设时才需要表现出来。`;
      }

      if (sharedSignals.length > 0) {
        return `${member.name} 和你都与用户共享「${sharedSignals.map(getRelationshipLabel).join(' / ')}」这一侧面，同场时可能更容易出现默契、站位、护短或微妙比较；但不要硬演。`;
      }

      if (speakerSignals.has('family') && memberHasRomantic) {
        return `${member.name} 更偏恋爱向关系，而你更偏家人或照顾者视角；同场时你可能会更在意分寸、观察或护着用户，但仍然由你的人设决定。`;
      }

      if (speakerHasRomantic && memberSignals.has('family')) {
        return `${member.name} 更偏家人或照顾者视角；如果符合你的人设，你在同场时可能会更在意对方态度、略微收紧或暗自较劲，但不必强行表现。`;
      }

      if (speakerSignals.has('close_friend') && memberHasRomantic) {
        return `${member.name} 更偏恋爱向关系，而你更像亲近朋友；同场时可以自然出现调侃、护着用户、帮忙打圆场或观察气氛，但仍以人设为准。`;
      }

      if (speakerSignals.has('rival') || memberSignals.has('rival')) {
        return `${member.name} 和你之间可能更容易带出竞争、抬杠、试探或不轻易让步的气氛；但只有当前场面真的需要时才轻轻带出。`;
      }

      return '';
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return [
    '下面是与你同场时可能存在的关系张力提示，只是潜在语境，不是强制规则。',
    ...lines,
  ].join('\n');
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

function extractGroupRecallText(message: ChatMessage): string {
  const text = message.text?.trim();
  return text ? text : '';
}

function buildGroupWorldBookRetrievalOptions(history: ChatMessage[]) {
  const recentText = history
    .map(extractGroupRecallText)
    .filter(Boolean)
    .slice(-8);

  const latestUserText = [...history]
    .reverse()
    .find((message) => message.role === 'user' && extractGroupRecallText(message))?.text?.trim();
  const latestConversationText = [...history]
    .reverse()
    .map(extractGroupRecallText)
    .find(Boolean);

  return {
    query: latestUserText || latestConversationText,
    recentText,
  };
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
    continue: '当前群里这个点还可以自然承接，但仍然只接最 relevant 的一小步，不要抢着把话说满。',
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
    `[Light personal presence] ${state.presenceCue.currentActivity}`,
    `[Presence use] ${state.presenceCue.attentionNote}`,
    '[Presence boundary] Let this affect length, timing, and tone. Do not mention being busy, just arriving, or checking the group unless it naturally fits the current message; avoid turning group chat into status reporting.',
    state.interactionGapState.minutesSinceLastGroupChat !== null && state.interactionGapState.minutesSinceLastGroupChat > 90
      ? '[Group silence handling] The group has been quiet for a while, so do not force a stale topic. Re-enter lightly or shift only if it fits.'
      : '',
    `[关系牵引] ${pullLabelMap[state.relationshipPull]}`,
    `[场景动量] ${momentumLabelMap[state.sceneMomentum]}`,
    state.topicHeatState.lastTopicAnchor ? `[最近话题锚点] ${state.topicHeatState.lastTopicAnchor}` : '',
    `[群聊节奏提醒] ${topicActionGuideMap[state.topicHeatState.suggestedTopicAction]}`,
  ].filter(Boolean).join('\n');
}

function limitResidueItems<T>(items: T[] | undefined, maxItems: number): T[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.slice(0, Math.max(0, maxItems));
}

export function buildGroupChatSceneInput(
  options: BuildGroupChatSceneInputOptions,
): GroupChatSceneInput {
  const mode = options.mode ?? 'reply';
  const groupStage = options.group?.groupStage ?? 'new';
  const worldBookRetrievalOptions = buildGroupWorldBookRetrievalOptions(options.history);
  const characterContext = buildCharacterContext({
    character: options.speaker,
    activeWorldBooks: options.activeWorldBooks,
    worldBookQuery: worldBookRetrievalOptions.query,
    worldBookRecentText: worldBookRetrievalOptions.recentText,
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
    languagePolicy: options.speaker,
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
      relationshipResidue: limitResidueItems(sceneScopedSignals.relationshipResidue, 3),
      topicAnchors: filterTopicAnchorsForPrompt(
        sceneScopedSignals.topicAnchors,
        characterTemporalState.continuityMode,
      ).slice(0, 2),
      taskResidue: limitResidueItems(sceneScopedSignals.taskResidue, 2),
      longTermMemoryProfile: characterScopedMemory.longTermMemoryProfile,
      temporalContext: formatGroupTemporalStatePrompt(characterTemporalState, options.temporalContext),
      activeDatingSummary: options.speaker.activeDatingState?.summary,
      groupSceneHint: characterContext.sceneHints?.groupChat,
      groupShortTermSummary: options.group?.groupShortTermSummary?.trim() || undefined,
      groupMemberPerspectiveSummary: options.group?.groupMemberPerspectiveSummaries?.[options.speaker.id]?.trim() || undefined,
      groupLongTermAtmosphere: options.group?.groupLongTermMemory?.atmosphere?.trim() || undefined,
      groupRecurringDynamics: options.group?.groupLongTermMemory?.recurringDynamics?.trim() || undefined,
      groupSharedHistory: options.group?.groupLongTermMemory?.sharedHistory?.trim() || undefined,
      speakerLongTermGroupRole: options.group?.groupLongTermMemory?.memberRoles?.[options.speaker.id]?.trim() || undefined,
      backgroundSummary: options.group?.backgroundSummary?.trim() || undefined,
      memberRelationshipState,
      currentScene: options.group?.currentScene?.trim() || undefined,
      publicFacts: options.group?.publicFacts?.trim() || undefined,
      topicStatePrompt: formatGroupTopicStateForPrompt(options.group?.topicState),
      worldBookPrompt: buildGroupWorldBookPrompt(options.activeWorldBooks, worldBookRetrievalOptions),
      expressionStyle: characterContext.expressionStyle,
      boundaryPack: characterContext.boundaryPack,
      publicAcquaintanceSummary: sceneScopedSignals.publicAcquaintanceSummary,
      sharedRecentRelationshipSummary: sceneScopedSignals.sharedRecentRelationshipSummary,
      relationshipTensionSummary: buildRelationshipTensionSummary(options.speaker, options.members),
    },
    historyTranscript: buildHistoryTranscript(options.history, options.userName),
  };
}
