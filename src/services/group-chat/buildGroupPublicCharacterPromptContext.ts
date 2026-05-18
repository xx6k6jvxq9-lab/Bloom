import type {
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  PerceptionSettings,
  WorldBookEntry,
} from '../../types';
import { buildGroupChatSceneInput } from '../scene-inputs/buildGroupChatSceneInput';

type BuildGroupPublicCharacterPromptContextOptions = {
  speaker: Character;
  members: Character[];
  group?: ChatGroup;
  userName: string;
  history: ChatMessage[];
  directChatHistory?: ChatHistory;
  activeWorldBooks?: WorldBookEntry[];
  perception?: PerceptionSettings;
};

type BuildGroupPublicCharacterPromptCollectionOptions = Omit<BuildGroupPublicCharacterPromptContextOptions, 'speaker'> & {
  speakers: Character[];
};

function truncateText(value: string | undefined, maxChars: number): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxChars
    ? `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`
    : normalized;
}

function compactGuideBlock(value: string | undefined): string {
  const lines = (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('##'))
    .filter((line) => !line.startsWith('这些锚点只帮助你在群聊等公开场合继续像同一个人'));

  if (lines.length === 0) {
    return '';
  }

  return truncateText(lines.slice(0, 6).join('\n'), 520);
}

function buildPeerAwarenessBlock(peerAwareness: string[] | undefined): string {
  const lines = (peerAwareness || [])
    .map((line) => truncateText(line, 140))
    .filter(Boolean)
    .slice(0, 4);

  if (lines.length === 0) {
    return '';
  }

  return [
    '他眼里的群里其他人：',
    ...lines.map((line) => `- ${line}`),
  ].join('\n');
}

function ensureSpeakerInMembers(speaker: Character, members: Character[]): Character[] {
  return members.some((member) => member.id === speaker.id)
    ? members
    : [...members, speaker];
}

export function buildGroupPublicCharacterPromptContext(
  options: BuildGroupPublicCharacterPromptContextOptions,
): string {
  const sceneInput = buildGroupChatSceneInput({
    speaker: options.speaker,
    members: ensureSpeakerInMembers(options.speaker, options.members),
    group: options.group,
    userName: options.userName,
    history: options.history,
    directChatHistory: options.directChatHistory,
    activeWorldBooks: options.activeWorldBooks,
    perception: options.perception,
  });
  const compactGuide = compactGuideBlock(sceneInput.speakerPublicPersonaGuide);

  return [
    `### ${(options.speaker.remarkName?.trim() || options.speaker.name)} / ${options.speaker.id}`,
    sceneInput.speakerCorePersona
      ? `核心人设：${truncateText(sceneInput.speakerCorePersona, 240)}`
      : '',
    sceneInput.recentContext?.expressionStyle
      ? `公开说话手感：${truncateText(sceneInput.recentContext.expressionStyle, 200)}`
      : '',
    sceneInput.recentContext?.boundaryPack
      ? `公开场合边界：${truncateText(sceneInput.recentContext.boundaryPack, 180)}`
      : '',
    compactGuide
      ? ['公开场合角色锚点：', compactGuide].join('\n')
      : '',
    sceneInput.relationshipSummary
      ? `群内关系起点：${truncateText(sceneInput.relationshipSummary, 280)}`
      : '',
    buildPeerAwarenessBlock(sceneInput.peerAwareness),
    sceneInput.recentContext?.shortTermSummary
      ? `近期关系余波：${truncateText(sceneInput.recentContext.shortTermSummary, 220)}`
      : '',
    sceneInput.recentContext?.groupShortTermSummary
      ? `群公开短期记忆：${truncateText(sceneInput.recentContext.groupShortTermSummary, 220)}`
      : '',
    sceneInput.recentContext?.publicAcquaintanceSummary
      ? `公开认识连续性：${truncateText(sceneInput.recentContext.publicAcquaintanceSummary, 200)}`
      : '',
    sceneInput.recentContext?.sharedRecentRelationshipSummary
      ? `跨场景共享关系余波：${truncateText(sceneInput.recentContext.sharedRecentRelationshipSummary, 200)}`
      : '',
    sceneInput.recentContext?.currentScene
      ? `当前群场景：${truncateText(sceneInput.recentContext.currentScene, 200)}`
      : '',
    sceneInput.recentContext?.groupSceneHint
      ? `群聊场景提示：${truncateText(sceneInput.recentContext.groupSceneHint, 180)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildGroupPublicCharacterPromptCollection(
  options: BuildGroupPublicCharacterPromptCollectionOptions,
): string {
  return options.speakers
    .map((speaker) => buildGroupPublicCharacterPromptContext({
      ...options,
      speaker,
    }))
    .filter(Boolean)
    .join('\n\n');
}
