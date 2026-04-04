import type { Character, ChatMessage, DateSession, UserProfileExtended } from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';

export type DatingSceneInput = {
  mode: 'start' | 'continue';
  characterName: string;
  corePersona: string;
  signature?: string;
  userName: string;
  location?: string;
  scenario?: string;
  mood?: string;
  backgroundRule: string;
  pastChatContext: string;
  datingMessages: string;
  currentGeneratedNarrative: string;
  currentGeneratedStatus: string;
  currentGeneratedPlaylist: string;
  task: string;
  sections: string[];
};

type BuildDatingSceneInputOptions = {
  mode: 'start' | 'continue';
  character: Character;
  userProfile: UserProfileExtended;
  session: DateSession;
  chatHistory: ChatMessage[];
  latestUserInput?: string;
};

function formatPastChatContext(chatHistory: ChatMessage[], characterName: string): string {
  return chatHistory
    .slice(-16)
    .map((message) => `${message.role === 'user' ? '用户' : characterName}：${message.text}`)
    .join('\n');
}

function formatDatingMessages(session: DateSession): string {
  return session.messages
    .slice(-12)
    .map((message) => {
      if (message.role === 'user') {
        return `用户在约会中说：${message.text}`;
      }

      if (message.generatedContent) {
        const summary = message.generatedContent.narrative.segments.map((segment) => segment.text).join(' ');
        return `角色上一轮剧情：${summary}`;
      }

      return `角色上一轮剧情：${message.text}`;
    })
    .join('\n');
}

function formatCurrentGeneratedNarrative(session: DateSession): string {
  if (!session.generatedContent?.narrative?.segments?.length) {
    return '当前还没有已生成的正式约会正文。';
  }

  return session.generatedContent.narrative.segments
    .map((segment) => `${segment.type === 'dialogue' ? '[对白]' : '[叙述]'} ${segment.text}`)
    .join('\n');
}

function formatCurrentGeneratedStatus(session: DateSession): string {
  if (!session.generatedContent?.status) {
    return '当前还没有已生成的状态。';
  }

  return `当前状态：
地点：${session.generatedContent.status.location}
时间：${session.generatedContent.status.time}
心情：${session.generatedContent.status.mood}
内心 OS：${session.generatedContent.status.innerThought}`;
}

function formatCurrentGeneratedPlaylist(session: DateSession): string {
  if (!session.generatedContent?.playlist?.length) {
    return '当前还没有已生成的歌单。';
  }

  return `当前歌单：
${session.generatedContent.playlist
  .map((song) => `- ${song.title} / ${song.artist}：${song.note || '符合当前氛围'}`)
  .join('\n')}`;
}

function buildTask(options: BuildDatingSceneInputOptions): string {
  if (options.mode === 'start') {
    return '现在请正式生成这次约会的第一轮内容。第一轮内容也必须是即时生成，不能使用默认模板文案。';
  }

  if (options.latestUserInput) {
    return `用户刚刚在正式约会里说了：${options.latestUserInput}
请从这句话之后继续推进剧情，并同步更新状态与歌单。`;
  }

  return '请基于当前保留的约会上下文继续生成后续内容。';
}

function buildExtraSections(input: {
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  datingSceneHint?: string;
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
  recentCoupleSpaceSummary?: string;
}): string[] {
  return [
    input.expressionStyle ? ['## 表达风格与相处方式', input.expressionStyle].join('\n') : '',
    input.boundaryPack ? ['## 边界与禁区', input.boundaryPack].join('\n') : '',
    input.extendedLore ? ['## 扩展背景与长期补充', input.extendedLore].join('\n') : '',
    input.datingSceneHint ? ['## 当前约会场景补充', input.datingSceneHint].join('\n') : '',
    input.shortTermSummary ? ['## 近期关系余波', input.shortTermSummary].join('\n') : '',
    input.longTermMemoryProfile ? ['## 长期关系印象', input.longTermMemoryProfile].join('\n') : '',
    input.recentCoupleSpaceSummary ? ['## 最近情侣空间相关痕迹', input.recentCoupleSpaceSummary].join('\n') : '',
  ].filter(Boolean);
}

export function buildDatingSceneInput(options: BuildDatingSceneInputOptions): DatingSceneInput {
  const characterContext = buildCharacterContext({
    character: options.character,
  });
  const relationshipProjection = buildRelationshipProjection({
    character: options.character,
    userName: options.userProfile.name,
  });
  const { characterScopedMemory, sceneScopedSignals } = relationshipProjection;

  return {
    mode: options.mode,
    characterName: options.character.name,
    corePersona: characterContext.corePersona ?? '',
    signature: options.character.signature?.trim() || undefined,
    userName: options.userProfile.name,
    location: options.session.location,
    scenario: options.session.scenario,
    mood: options.session.mood,
    backgroundRule: options.session.backgroundImage
      ? `本次约会背景图已经确定，页面会优先使用：${options.session.backgroundImage}`
      : '本次约会背景图未单独设置，页面默认使用角色头像作为背景。',
    pastChatContext: formatPastChatContext(options.chatHistory, options.character.name),
    datingMessages: formatDatingMessages(options.session),
    currentGeneratedNarrative: formatCurrentGeneratedNarrative(options.session),
    currentGeneratedStatus: formatCurrentGeneratedStatus(options.session),
    currentGeneratedPlaylist: formatCurrentGeneratedPlaylist(options.session),
    task: buildTask(options),
    sections: buildExtraSections({
      expressionStyle: characterContext.expressionStyle,
      boundaryPack: characterContext.boundaryPack,
      extendedLore: characterContext.extendedLore,
      datingSceneHint: characterContext.sceneHints?.dating,
      shortTermSummary: characterScopedMemory.shortTermSummary,
      longTermMemoryProfile: characterScopedMemory.longTermMemoryProfile,
      recentCoupleSpaceSummary: sceneScopedSignals.recentCoupleSpaceSummary,
    }),
  };
}
