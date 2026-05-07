import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildTemporalContextPrompt } from '../relationship-time/buildTemporalContextPrompt';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';
import { compressShortTermSummaryAfterLongTerm } from '../memory/buildShortTermSummary';
import type {
  Character,
  ChatMessage,
  DateDescriptionDensity,
  DateDialogueFormat,
  DateNarrativePerspective,
  DateWritingReference,
  DateWritingPreset,
  DateSession,
  PerceptionSettings,
  UserProfileExtended,
} from '../../types';

export type DatingSceneInput = {
  mode: 'start' | 'continue';
  characterName: string;
  corePersona: string;
  signature?: string;
  userName: string;
  location?: string;
  scenario?: string;
  mood?: string;
  narrativePerspective?: DateNarrativePerspective;
  writingPreset?: DateWritingPreset;
  writingReference?: DateWritingReference;
  dialogueFormat?: DateDialogueFormat;
  descriptionDensity?: DateDescriptionDensity;
  writingStyleCustom?: string;
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
  perception?: PerceptionSettings;
  latestUserInput?: string;
};

const DATING_PROMPT_BUDGET = {
  maxPastChatMessages: 12,
  maxPastChatChars: 2200,
  maxPastChatLineChars: 180,
  maxDatingMessages: 8,
  maxDatingChars: 2600,
  maxDatingLineChars: 260,
  maxNarrativeSegments: 6,
  maxNarrativeChars: 2400,
  maxNarrativeLineChars: 240,
  maxStatusFieldChars: 120,
  maxPlaylistItems: 3,
  maxPlaylistNoteChars: 90,
  maxSectionChars: 1200,
  maxSections: 7,
  maxCorePersonaChars: 2000,
  maxSignatureChars: 120,
  maxTaskChars: 320,
  maxStyleCustomChars: 240,
} as const;

function normalizeInlineText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function truncateFromStart(value: string | null | undefined, maxChars: number): string {
  const normalized = (value || '').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 1) return normalized.slice(0, maxChars);
  return `${normalized.slice(0, maxChars - 1)}…`;
}

function joinBudgetedLines(
  lines: string[],
  options: {
    maxLines: number;
    maxChars: number;
    maxLineChars: number;
  },
): string {
  const normalizedLines = lines
    .map((line) => truncateFromStart(normalizeInlineText(line), options.maxLineChars))
    .filter(Boolean)
    .slice(-options.maxLines);

  const selected: string[] = [];
  let usedChars = 0;

  for (let index = normalizedLines.length - 1; index >= 0; index -= 1) {
    const line = normalizedLines[index];
    const nextUsedChars = usedChars + line.length + (selected.length > 0 ? 1 : 0);
    if (nextUsedChars > options.maxChars && selected.length > 0) {
      break;
    }
    selected.unshift(line);
    usedChars = nextUsedChars;
  }

  return selected.join('\n');
}

function isImageDataValue(value: string | null | undefined): boolean {
  return /^data:image\//i.test((value || '').trim());
}

function buildBackgroundRule(session: DateSession): string {
  if (!session.backgroundImage) {
    return '本次约会背景图未单独设置，页面默认使用角色头像作为背景。不要把背景图当成文本线索。';
  }

  if (session.backgroundSource === 'local-upload') {
    return '本次约会背景图已设置为用户上传图片。页面会使用这张图片作为视觉背景，但不要把图片内容或编码文本当成剧情线索。';
  }

  if (session.backgroundSource === 'url') {
    return isImageDataValue(session.backgroundImage)
      ? '本次约会背景图已设置为外部图片资源。页面会使用这张图片作为视觉背景，但不要把图片编码文本当成剧情线索。'
      : '本次约会背景图已设置为外部图片链接。页面会使用这张图片作为视觉背景，但不要把图片链接文本当成剧情线索。';
  }

  return '本次约会背景图使用角色头像。页面会以角色头像作为视觉背景，但不要把头像地址或图片编码文本当成剧情线索。';
}

function budgetSections(sections: string[]): string[] {
  return sections
    .map((section) => truncateFromStart(section, DATING_PROMPT_BUDGET.maxSectionChars))
    .filter(Boolean)
    .slice(0, DATING_PROMPT_BUDGET.maxSections);
}

function formatPastChatContext(chatHistory: ChatMessage[], characterName: string): string {
  return joinBudgetedLines(
    chatHistory.map((message) => `${message.role === 'user' ? '用户' : characterName}：${normalizeInlineText(message.text)}`),
    {
      maxLines: DATING_PROMPT_BUDGET.maxPastChatMessages,
      maxChars: DATING_PROMPT_BUDGET.maxPastChatChars,
      maxLineChars: DATING_PROMPT_BUDGET.maxPastChatLineChars,
    },
  );
}

function formatDatingMessages(session: DateSession): string {
  return joinBudgetedLines(
    session.messages.map((message) => {
      if (message.role === 'user') {
        return `用户在约会中说：${normalizeInlineText(message.text)}`;
      }

      if (message.generatedContent) {
        const summary = message.generatedContent.narrative.segments
          .slice(-4)
          .map((segment) => normalizeInlineText(segment.text))
          .filter(Boolean)
          .join(' ');
        return `角色上一轮剧情：${summary}`;
      }

      return `角色上一轮剧情：${normalizeInlineText(message.text)}`;
    }),
    {
      maxLines: DATING_PROMPT_BUDGET.maxDatingMessages,
      maxChars: DATING_PROMPT_BUDGET.maxDatingChars,
      maxLineChars: DATING_PROMPT_BUDGET.maxDatingLineChars,
    },
  );
}

function formatCurrentGeneratedNarrative(session: DateSession): string {
  if (!session.generatedContent?.narrative?.segments?.length) {
    return '当前还没有已生成的正式约会正文。';
  }

  return joinBudgetedLines(
    session.generatedContent.narrative.segments.map((segment) => (
      `${segment.type === 'dialogue' ? '[对白]' : '[叙述]'} ${normalizeInlineText(segment.text)}`
    )),
    {
      maxLines: DATING_PROMPT_BUDGET.maxNarrativeSegments,
      maxChars: DATING_PROMPT_BUDGET.maxNarrativeChars,
      maxLineChars: DATING_PROMPT_BUDGET.maxNarrativeLineChars,
    },
  );
}

function formatCurrentGeneratedStatus(session: DateSession): string {
  if (!session.generatedContent?.status) {
    return '当前还没有已生成的状态。';
  }

  return `当前状态：
地点：${truncateFromStart(session.generatedContent.status.location, DATING_PROMPT_BUDGET.maxStatusFieldChars)}
时间：${truncateFromStart(session.generatedContent.status.time, DATING_PROMPT_BUDGET.maxStatusFieldChars)}
心情：${truncateFromStart(session.generatedContent.status.mood, DATING_PROMPT_BUDGET.maxStatusFieldChars)}
内心 OS：${truncateFromStart(session.generatedContent.status.innerThought, DATING_PROMPT_BUDGET.maxStatusFieldChars)}`;
}

function formatCurrentGeneratedPlaylist(session: DateSession): string {
  if (!session.generatedContent?.playlist?.length) {
    return '当前还没有已生成的歌单。';
  }

  return `当前歌单：
${session.generatedContent.playlist
    .slice(0, DATING_PROMPT_BUDGET.maxPlaylistItems)
    .map((song) => (
      `- ${truncateFromStart(song.title, 48)} / ${truncateFromStart(song.artist, 32)}：${truncateFromStart(song.note || '符合当前氛围', DATING_PROMPT_BUDGET.maxPlaylistNoteChars)}`
    ))
    .join('\n')}`;
}

function buildTask(options: BuildDatingSceneInputOptions): string {
  if (options.mode === 'start') {
    return '现在请正式生成这次约会的第一轮内容。第一轮内容也必须是即时生成，不能使用默认模板文案。';
  }

  if (options.latestUserInput) {
    return truncateFromStart(
      `用户刚刚在正式约会里说了：${normalizeInlineText(options.latestUserInput)}
请从这句之后继续推进剧情，并同步更新状态与歌单。`,
      DATING_PROMPT_BUDGET.maxTaskChars,
    );
  }

  return '请基于当前保留的约会上下文继续生成后续内容。';
}

function formatTypedResidueLines<T extends { summary: string }>(
  title: string,
  items: T[] | undefined,
  usageNote: string,
): string {
  const typedItems = (items || [])
    .map((item) => item.summary.trim())
    .filter(Boolean);
  if (typedItems.length === 0) {
    return '';
  }

  return [
    title,
    usageNote,
    ...typedItems.map((summary) => `- ${summary}`),
  ].join('\n');
}

function buildExtraSections(input: {
  temporalContext?: string;
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  datingSceneHint?: string;
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
  relationshipResidue?: Array<{ summary: string }>;
  topicAnchors?: Array<{ summary: string }>;
  taskResidue?: Array<{ summary: string }>;
  recentCoupleSpaceSummary?: string;
  sharedRecentRelationshipSummary?: string;
}): string[] {
  return [
    input.temporalContext || '',
    input.expressionStyle ? ['## 表达风格与相处方式', input.expressionStyle].join('\n') : '',
    input.boundaryPack ? ['## 边界与禁区', input.boundaryPack].join('\n') : '',
    input.extendedLore ? ['## 扩展背景与长期补充', input.extendedLore].join('\n') : '',
    input.datingSceneHint ? ['## 当前约会场景补充', input.datingSceneHint].join('\n') : '',
    input.shortTermSummary ? ['## 近期关系余波', input.shortTermSummary].join('\n') : '',
    input.longTermMemoryProfile ? ['## 长期关系印象', input.longTermMemoryProfile].join('\n') : '',
    formatTypedResidueLines(
      '## Typed Relationship Residue',
      input.relationshipResidue,
      '这些是最近还能影响约会语气和亲密感的关系余波。只把它们当成关系底色，不要直接改写成当前约会现场已经发生的动作。',
    ),
    formatTypedResidueLines(
      '## Typed Topic Anchors',
      input.topicAnchors,
      '这些是旧梗或旧话题锚点。只有这轮约会真的碰到时才可轻量带回，不要无缘无故自己翻旧梗。',
    ),
    formatTypedResidueLines(
      '## Typed Task Residue',
      input.taskResidue,
      '这些是仍可能算数的待办、约定或还没完全落地的事。只有当前语境相关时才轻量恢复。',
    ),
    input.recentCoupleSpaceSummary ? ['## 最近情侣空间相关痕迹', input.recentCoupleSpaceSummary].join('\n') : '',
    input.sharedRecentRelationshipSummary
      ? ['## 最近关系连续性', input.sharedRecentRelationshipSummary].join('\n')
      : '',
  ].filter(Boolean);
}

function normalizeStyleValue<T extends string>(value: T | undefined, fallback: T): T {
  return value && value !== fallback ? value : fallback;
}

export function buildDatingSceneInput(options: BuildDatingSceneInputOptions): DatingSceneInput {
  const characterContext = buildCharacterContext({
    character: options.character,
  });
  const relationshipProjection = buildRelationshipProjection({
    character: options.character,
    userName: options.userProfile.name,
    directMessages: options.chatHistory,
  });
  const { characterScopedMemory, sceneScopedSignals } = relationshipProjection;
  const shortTermSummary = characterScopedMemory.longTermMemoryProfile
    ? compressShortTermSummaryAfterLongTerm(characterScopedMemory.shortTermSummary || '')
    : characterScopedMemory.shortTermSummary;
  const sections = budgetSections(buildExtraSections({
    temporalContext: buildTemporalContextPrompt({
      perception: options.perception,
      now: Date.now(),
    }),
    expressionStyle: truncateFromStart(characterContext.expressionStyle, DATING_PROMPT_BUDGET.maxSectionChars),
    boundaryPack: truncateFromStart(characterContext.boundaryPack, DATING_PROMPT_BUDGET.maxSectionChars),
    extendedLore: truncateFromStart(characterContext.extendedLore, DATING_PROMPT_BUDGET.maxSectionChars),
    datingSceneHint: truncateFromStart(characterContext.sceneHints?.dating, DATING_PROMPT_BUDGET.maxSectionChars),
    shortTermSummary: truncateFromStart(shortTermSummary, DATING_PROMPT_BUDGET.maxSectionChars),
    longTermMemoryProfile: truncateFromStart(characterScopedMemory.longTermMemoryProfile, DATING_PROMPT_BUDGET.maxSectionChars),
    relationshipResidue: sceneScopedSignals.relationshipResidue?.slice(0, 3),
    topicAnchors: sceneScopedSignals.topicAnchors?.slice(0, 2),
    taskResidue: sceneScopedSignals.taskResidue?.slice(0, 2),
    recentCoupleSpaceSummary: truncateFromStart(sceneScopedSignals.recentCoupleSpaceSummary, DATING_PROMPT_BUDGET.maxSectionChars),
    sharedRecentRelationshipSummary: truncateFromStart(sceneScopedSignals.sharedRecentRelationshipSummary, DATING_PROMPT_BUDGET.maxSectionChars),
  }));

  return {
    mode: options.mode,
    characterName: options.character.name,
    corePersona: truncateFromStart(characterContext.corePersona, DATING_PROMPT_BUDGET.maxCorePersonaChars),
    signature: truncateFromStart(options.character.signature, DATING_PROMPT_BUDGET.maxSignatureChars) || undefined,
    userName: options.userProfile.name,
    location: options.session.location,
    scenario: options.session.scenario,
    mood: options.session.mood,
    narrativePerspective: normalizeStyleValue(options.session.narrativePerspective, 'default'),
    writingPreset: normalizeStyleValue(options.session.writingPreset, 'default'),
    writingReference: normalizeStyleValue(options.session.writingReference, 'none'),
    dialogueFormat: normalizeStyleValue(options.session.dialogueFormat, 'default'),
    descriptionDensity: normalizeStyleValue(options.session.descriptionDensity, 'default'),
    writingStyleCustom: truncateFromStart(options.session.writingStyleCustom?.trim(), DATING_PROMPT_BUDGET.maxStyleCustomChars) || undefined,
    backgroundRule: buildBackgroundRule(options.session),
    pastChatContext: formatPastChatContext(options.chatHistory, options.character.name),
    datingMessages: formatDatingMessages(options.session),
    currentGeneratedNarrative: formatCurrentGeneratedNarrative(options.session),
    currentGeneratedStatus: formatCurrentGeneratedStatus(options.session),
    currentGeneratedPlaylist: formatCurrentGeneratedPlaylist(options.session),
    task: buildTask(options),
    sections,
  };
}
