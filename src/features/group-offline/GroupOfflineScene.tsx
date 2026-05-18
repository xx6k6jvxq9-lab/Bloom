import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  Save,
  Send,
  Star,
  X,
} from 'lucide-react';
import type {
  ApiConfig,
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  DatingPageEpisode,
  GroupOfflineAftereffectItem,
  GroupOfflineAftereffects,
  GroupOfflineEndingVoice,
  GroupOfflineGeneratedContent,
  GroupOfflineMemoryPanel,
  GroupOfflineParticipantSoundtrack,
  GroupOfflineRound,
  GroupOfflineRoundCharacterEntry,
  GroupOfflineRoundDispatchMode,
  GroupOfflineScenarioTaskStepUpdate,
  GroupOfflineSession,
  GroupOfflineSoundtrack,
  GroupOfflineStatusField,
  GroupOfflineStylePresetId,
  PerceptionSettings,
  WorldBookEntry,
} from '../../types';
import { generateTextFromMessagesWithConfig } from '../../services/ai/runtimeClient';
import { buildGroupOfflinePrompt } from '../../services/ai/prompts/builders/buildGroupOfflinePrompt';
import { buildGroupOfflineEntryRewritePrompt } from '../../services/ai/prompts/builders/buildGroupOfflineEntryRewritePrompt';
import { buildGroupOfflineRoundRewritePrompt } from '../../services/ai/prompts/builders/buildGroupOfflineRoundRewritePrompt';
import { buildCustomPageEpisodeSrcDoc, normalizePageEpisodeHtmlDocument } from '../../services/dating/pageEpisodeHtml';
import {
  buildGroupOfflineStylePresetInstruction,
  GROUP_OFFLINE_STYLE_PRESET_OPTIONS,
} from '../../services/ai/prompts/builders/groupOfflineStylePresets';
import { buildGroupWorldBookPrompt } from '../group-world-book/buildGroupWorldBookPrompt';
import { buildGroupWorldBookRetrievalOptions } from '../group-world-book/groupWorldBookRetrieval';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';
import { buildGroupOfflineRoundPlan } from '../../services/group-offline/buildGroupOfflineRoundPlan';
import { buildGroupOfflineRuntimeProjection } from '../../services/group-offline/buildGroupOfflineRuntimeProjection';
import {
  applyGroupOfflineScenarioRoundResult,
  buildGroupOfflineScenarioCardFields,
  getGroupOfflineScenarioLockReason,
  getGroupOfflineScenarioRemainingRounds,
  getGroupOfflineScenarioStatusLabel,
  replayGroupOfflineScenarioState,
} from '../../services/group-offline/scenarioTasks';
import { resolveGroupOfflineWorldBookSnapshot } from '../../services/group-offline/worldBookSnapshot';
import {
  buildGroupOfflineRoundPlanSnapshot,
  buildGroupOfflineRoundRuntimeProjectionSnapshot,
  resolveRoundPlannerSnapshot,
  resolveRoundRuntimeProjection,
} from '../../services/group-offline/roundSnapshots';
import { ResolvedOfflineAvatar } from './ResolvedOfflineAvatar';
import {
  GooseDirectorOrb,
  type GooseDirectorInstructionMode,
  type GooseDirectorSection,
} from './GooseDirectorOrb';
import { GroupOfflineSongBoard, type SongBoardItem } from './GroupOfflineSongBoard';
import {
  GroupOfflineRoundInspector,
  type GroupOfflineInspectorEntryView,
} from './GroupOfflineRoundInspector';
import { GroupOfflineSceneOverlays } from './GroupOfflineSceneOverlays';
import { GroupOfflineRoundEntry } from './GroupOfflineRoundEntry';
import {
  buildGroupOfflineGeneratedContentShell,
  createGroupOfflineEndedMessage,
  createGroupOfflineMessageId,
  createGroupOfflineRoundId,
  MAX_GROUP_OFFLINE_BLOCK_SELECTION,
  mergeGroupOfflineGeneratedContent,
  pickRandomGroupOfflineParticipantIds,
  pickRecommendedGroupOfflineParticipantIds,
  syncGroupOfflineDerivedContent,
  type GroupOfflineContentPhase,
} from './sessionUtils';
import './GroupOfflineScene.css';

type GroupOfflineSceneProps = {
  session: GroupOfflineSession;
  directorLaunchToken?: number;
  initialDirectorSection?: GooseDirectorSection;
  group: ChatGroup;
  members: Character[];
  inviteableCharacters: Character[];
  userName: string;
  activeConfig: ApiConfig | null;
  activeWorldBooks?: WorldBookEntry[];
  history: ChatMessage[];
  directChatHistory?: ChatHistory;
  perception?: PerceptionSettings;
  onBackToPlanner: () => void;
  onUpdateSession: (session: GroupOfflineSession) => void;
  onComplete: (payload: {
    archivedSession: GroupOfflineSession;
    endMessage: ChatMessage;
    followupMessages: ChatMessage[];
  }) => void;
};

type EndingPayload = {
  summaryLines: string[];
  endingVoices: GroupOfflineEndingVoice[];
};

type EntryActionKind = 'retry' | 'polish';
type GroupOfflineDirectorMode = GooseDirectorInstructionMode;
type RoundRewriteMode = 'style_preset' | 'custom_style' | 'retry_round' | 'director_instruction';

type GenerateContentOptions = {
  phase: GroupOfflineContentPhase;
  baseSession?: GroupOfflineSession;
  latestUserMessage?: string;
  userMessageText?: string;
  selectedCharacterIds?: string[];
  dispatchMode?: GroupOfflineRoundDispatchMode;
  nextRoundNumber?: number;
  directorInstructionOverride?: string;
  directorMode?: GroupOfflineDirectorMode;
};

type DisplayBlock = { type: 'body' | 'highlight'; text: string };

const ACTIVE_STATUS_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'state', label: '状态' },
  { key: 'outfit', label: '衣着' },
  { key: 'action', label: '动作' },
  { key: 'inner', label: '心声' },
];

const STATUS_MATCHERS: Record<string, RegExp> = {
  state: /(状态|当前状态|情绪|神色)/,
  outfit: /(衣着|穿着|打扮|外形|外套)/,
  action: /(动作|当前动作|行为|姿势)/,
  inner: /(心声|内心|心理|想法|念头)/,
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function memberAliasMatches(label: string | undefined, member: Pick<Character, 'name' | 'remarkName'>): boolean {
  const normalizedLabel = normalizeString(label).toLowerCase();
  if (!normalizedLabel) return false;
  return [member.name, member.remarkName?.trim()]
    .map((value) => normalizeString(value).toLowerCase())
    .filter(Boolean)
    .includes(normalizedLabel);
}

function resolveCharacterAvatarValue(member: Character | undefined): string | undefined {
  const directAvatar = normalizeString(member?.avatar);
  if (directAvatar) return directAvatar;
  const statusRank: Record<string, number> = {
    current: 0,
    saved: 1,
    candidate: 2,
    used: 3,
    rejected: 4,
  };
  const fallbackEntry = [...(member?.avatarLibrary?.entries || [])]
    .sort((left, right) => {
      const statusDelta = (statusRank[left.status] ?? 99) - (statusRank[right.status] ?? 99);
      if (statusDelta !== 0) return statusDelta;
      return (right.updatedAt || 0) - (left.updatedAt || 0);
    })
    .find((entry) => normalizeString(entry.image));
  return fallbackEntry ? normalizeString(fallbackEntry.image) || undefined : undefined;
}

function buildCharacterAliases(member: Pick<Character, 'name' | 'remarkName'>): string[] {
  return [member.name, member.remarkName?.trim()]
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function buildOffstageAliases(allMembers: Character[], sceneMembers: Character[]): string[] {
  const sceneIds = new Set(sceneMembers.map((member) => member.id));
  return allMembers
    .filter((member) => !sceneIds.has(member.id))
    .flatMap((member) => buildCharacterAliases(member));
}

function textMentionsOffstageAliases(text: string | undefined, offstageAliases: string[]): boolean {
  const normalized = normalizeString(text);
  if (!normalized || offstageAliases.length === 0) return false;
  return offstageAliases.some((alias) => alias && normalized.includes(alias));
}

function buildSongBoardSeed(input: string): number {
  return Array.from(input).reduce((total, char, index) => total + char.charCodeAt(0) * (index + 7), 0);
}

function buildSongBoardProgressPercent(seedInput: string): number {
  return 20 + (buildSongBoardSeed(seedInput) % 46);
}

function buildSongBoardDurationLabel(_seedInput: string): string {
  return '5:20';
}

function formatGroupOfflineMemoryDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function fitGroupOfflineTextRange(value: string, fallback: string, min: number, max: number): string {
  let next = value.trim() || fallback.trim();
  const fallbackText = fallback.trim();
  while (next.length < min) {
    next = `${next}${next.endsWith('。') ? '' : '。'}${fallbackText}`;
  }
  if (next.length > max) {
    next = `${next.slice(0, max - 1).trim()}…`;
  }
  return next;
}

function splitSongLyricLines(note: string): string[] {
  const multiline = note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (multiline.length === 0) return [];
  return multiline
    .map((line) => line.replace(/^["'“”《》「」\s]+|["'“”《》「」\s]+$/gu, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function isGroupOfflineTextLengthValid(value: string | undefined, min: number, max: number): boolean {
  const length = normalizeString(value).length;
  return length >= min && length <= max;
}

function buildActiveStatusFallbacks(speakerLabel: string): GroupOfflineStatusField[] {
  return [
    {
      key: 'state',
      label: '状态',
      value: `${speakerLabel}表面还稳得住，真正的注意力却已经挂在场上那一点最让人在意的动静上，没有真的放开。`,
    },
    {
      key: 'outfit',
      label: '衣着',
      value: `${speakerLabel}这一轮的衣着和细节都收得很干净，没有故意张扬，却看得出是带着明确心思来的。`,
    },
    {
      key: 'action',
      label: '动作',
      value: `${speakerLabel}每一个动作都还压着分寸，像是不急着先出手，却始终在借细小停顿试探这场局会往哪边偏。`,
    },
    {
      key: 'inner',
      label: '心声',
      value: `${speakerLabel}真正放在心里的不是表面那句轻话，而是后面谁会接、怎么接，以及这一点余温会不会继续发酵。`,
    },
  ];
}

function normalizeStatusFields(value: unknown): GroupOfflineStatusField[] {
  const rawFields = Array.isArray(value)
    ? value
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const key = normalizeString((item as { key?: unknown }).key);
          const label = normalizeString((item as { label?: unknown }).label);
          const fieldValue = normalizeString((item as { value?: unknown }).value);
          if (!key || !label || !fieldValue) return null;
          return { key, label, value: fieldValue } satisfies GroupOfflineStatusField;
        })
        .filter((item): item is GroupOfflineStatusField => !!item)
    : [];

  const resolved = new Map<string, GroupOfflineStatusField>();

  rawFields.forEach((field) => {
    const raw = `${field.key} ${field.label}`;
    const canonical = ACTIVE_STATUS_FIELDS.find((item) => STATUS_MATCHERS[item.key]?.test(raw))?.key;
    if (!canonical) return;
    if (!isGroupOfflineTextLengthValid(field.value, 30, 50)) return;
    resolved.set(canonical, {
      key: canonical,
      label: ACTIVE_STATUS_FIELDS.find((item) => item.key === canonical)?.label || field.label,
      value: field.value.trim(),
    });
  });

  return ACTIVE_STATUS_FIELDS
    .map((field) => resolved.get(field.key))
    .filter((field): field is GroupOfflineStatusField => !!field);
}

function normalizeSoundtrack(value: unknown): GroupOfflineSoundtrack | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const title = normalizeString((value as { title?: unknown }).title);
  const artist = normalizeString((value as { artist?: unknown }).artist);
  const note = normalizeString((value as { note?: unknown }).note);
  if (!title || !artist) return undefined;
  return { title, artist, note: note || '' };
}

function normalizeParticipantSoundtracks(value: unknown): GroupOfflineParticipantSoundtrack[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const characterId = normalizeString((item as { characterId?: unknown }).characterId);
      const characterName = normalizeString((item as { characterName?: unknown }).characterName);
      const soundtrack = normalizeSoundtrack(item);
      if (!characterId || !characterName || !soundtrack) return null;
      return { characterId, characterName, ...soundtrack } satisfies GroupOfflineParticipantSoundtrack;
    })
    .filter((item): item is GroupOfflineParticipantSoundtrack => !!item);
}

function normalizeAftereffectItems(value: unknown): GroupOfflineAftereffectItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const sourceLabel = normalizeString((item as { sourceLabel?: unknown }).sourceLabel);
      const actionText = normalizeString((item as { actionText?: unknown }).actionText);
      const residueText = normalizeString((item as { residueText?: unknown }).residueText);
      if (!sourceLabel || !actionText || !residueText) return null;
      return { sourceLabel, actionText, residueText } satisfies GroupOfflineAftereffectItem;
    })
    .filter((item): item is GroupOfflineAftereffectItem => !!item);
}

function normalizeAftereffects(value: unknown): GroupOfflineAftereffects | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const searches = Array.isArray((value as { searches?: unknown[] }).searches)
    ? ((value as { searches?: unknown[] }).searches || []).map((item) => normalizeString(item)).filter(Boolean)
    : [];
  const items = normalizeAftereffectItems((value as { items?: unknown[] }).items);
  if (searches.length === 0 && items.length === 0) return undefined;
  return { searches, items };
}

function normalizeMemoryPanel(value: unknown): GroupOfflineMemoryPanel | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const shortTerm = Array.isArray((value as { shortTerm?: unknown[] }).shortTerm)
    ? ((value as { shortTerm?: unknown[] }).shortTerm || []).map((item) => normalizeString(item)).filter(Boolean)
    : [];
  const longTerm = Array.isArray((value as { longTerm?: unknown[] }).longTerm)
    ? ((value as { longTerm?: unknown[] }).longTerm || []).map((item) => normalizeString(item)).filter(Boolean)
    : [];
  if (shortTerm.length === 0 && longTerm.length === 0) return undefined;
  return { shortTerm, longTerm };
}

function countCharacterShortTermItems(params: {
  rounds?: GroupOfflineRound[];
  characterId?: string;
  roundId?: string;
}): number {
  if (!params.rounds || !params.characterId || !params.roundId) return 0;

  let count = 0;
  for (const round of params.rounds) {
    const entry = round.characterEntries.find((item) => item.characterId === params.characterId);
    const rawMemoryPanel = normalizeMemoryPanel(entry?.memoryPanel);
    const latestShortTerm = rawMemoryPanel?.shortTerm?.[rawMemoryPanel.shortTerm.length - 1];
    if (latestShortTerm) {
      count += 1;
    }
    if (round.id === params.roundId) {
      break;
    }
  }
  return count;
}

function normalizeMemoryPanelForStorage(memoryPanel: GroupOfflineMemoryPanel | undefined): GroupOfflineMemoryPanel {
  return {
    shortTerm: (memoryPanel?.shortTerm || [])
      .map((line) => normalizeString(line))
      .filter(Boolean)
      .slice(-1),
    longTerm: (memoryPanel?.longTerm || [])
      .map((line) => normalizeString(line))
      .filter(Boolean)
      .slice(-1),
  };
}

function buildAccumulatedMemoryPanel(params: {
  memoryPanel: GroupOfflineMemoryPanel | undefined;
  rounds?: GroupOfflineRound[];
  characterId?: string;
  roundId?: string;
}): GroupOfflineMemoryPanel {
  const fallback = normalizeMemoryPanelForStorage(params.memoryPanel);
  if (!params.rounds || !params.characterId || !params.roundId) {
    return fallback;
  }

  const pendingShortTerm: string[] = [];
  const longTerm: string[] = [];

  for (const round of params.rounds) {
    const entry = round.characterEntries.find((item) => item.characterId === params.characterId);
    const rawMemoryPanel = normalizeMemoryPanel(entry?.memoryPanel);
    const latestShortTerm = rawMemoryPanel?.shortTerm?.[rawMemoryPanel.shortTerm.length - 1];
    if (latestShortTerm) {
      pendingShortTerm.push(latestShortTerm);
    }

    const latestLongTerm = rawMemoryPanel?.longTerm?.[rawMemoryPanel.longTerm.length - 1];
    if (latestLongTerm && pendingShortTerm.length >= 10) {
      longTerm.push(latestLongTerm);
      pendingShortTerm.length = 0;
    }

    if (round.id === params.roundId) {
      break;
    }
  }

  return {
    shortTerm: pendingShortTerm.map((line, index) => `[${index + 1}] ${line}`),
    longTerm,
  };
}

function normalizeNotebookText(value: string | undefined, _speakerLabel: string): string {
  const normalized = normalizeString(value);
  return isGroupOfflineTextLengthValid(normalized, 30, 50) ? normalized : '';
}

function normalizeAftereffectsForDisplay(
  aftereffects: GroupOfflineAftereffects | undefined,
): GroupOfflineAftereffects {
  const searches = (aftereffects?.searches || [])
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 2);
  const items = (aftereffects?.items || [])
    .map((item) => ({
      sourceLabel: normalizeString(item.sourceLabel),
      actionText: normalizeString(item.actionText),
      residueText: normalizeString(item.residueText),
    }))
    .filter((item) => item.sourceLabel && item.actionText && item.residueText)
    .slice(0, 4);
  return {
    searches,
    items: items.length === 4 ? items : [],
  };
}

function buildHumanMemoryPanelFallback(speakerLabel: string): GroupOfflineMemoryPanel {
  return {
    shortTerm: [
      `${speakerLabel}把这场线下里最具体的一下动作和话头记了下来，准备之后再翻出来看。`,
    ],
    longTerm: [
      `${speakerLabel}会把这几轮里反复出现的同一件事，慢慢记成一段清楚的关系经历。`,
    ],
  };
}

function trimSentenceLike(value: string | undefined, maxLength = 56): string {
  const normalized = normalizeString(value).replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function isGenericMemorySummary(value: string | undefined): boolean {
  const normalized = normalizeString(value);
  if (!normalized) return true;
  return /(这一轮|话没说透|余温|开始在意|表面|其实|气氛|挂念|关系节点|没真的|没有真的|最难退掉|偏向挂念)/.test(normalized);
}

function normalizeMemoryPanelForDisplayRich(
  memoryPanel: GroupOfflineMemoryPanel | undefined,
  _speakerLabel: string,
  _roundCount: number,
  _referenceTimestamp = Date.now(),
  context?: {
    notebookText?: string;
    aftereffects?: GroupOfflineAftereffects;
    highlightText?: string;
    text?: string;
    targetLabel?: string;
    rounds?: GroupOfflineRound[];
    characterId?: string;
    sceneLabel?: string;
    roundId?: string;
  },
): GroupOfflineMemoryPanel {
  return buildAccumulatedMemoryPanel({
    memoryPanel,
    rounds: context?.rounds,
    characterId: context?.characterId,
    roundId: context?.roundId,
  });
}

function normalizeGeneratedContentForDisplay(content: GroupOfflineGeneratedContent): GroupOfflineGeneratedContent {
  return syncGroupOfflineDerivedContent({
    ...content,
    rounds: (content.rounds || []).map((round) => ({
      ...round,
      characterEntries: round.characterEntries.map((entry) => ({
        ...entry,
        highlightText: resolveValidHighlightText(entry.text, entry.highlightText),
        statusFields: normalizeStatusFields(entry.statusFields),
        notebook: normalizeNotebookText(normalizeString(entry.notebook), entry.speakerLabel) || undefined,
        aftereffects: normalizeAftereffectsForDisplay(entry.aftereffects),
        memoryPanel: normalizeMemoryPanelForStorage(entry.memoryPanel),
      })),
    })),
  });
}

type GroupOfflineHtmlPageEpisode = Pick<DatingPageEpisode, 'title' | 'subtitle' | 'caption' | 'htmlDocument'> & {
  pageType: 'micro_app' | 'custom_html';
};

function normalizeGroupOfflinePageEpisode(
  value: unknown,
  fallbackTitle: string,
): GroupOfflineHtmlPageEpisode | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const payload = value as Partial<DatingPageEpisode>;
  const pageType = payload.pageType === 'micro_app' || payload.pageType === 'custom_html'
    ? payload.pageType
    : undefined;
  if (!pageType) {
    return undefined;
  }

  return {
    pageType,
    title: normalizeString(payload.title) || fallbackTitle,
    subtitle: normalizeString(payload.subtitle) || undefined,
    caption: normalizeString(payload.caption) || undefined,
    htmlDocument: normalizePageEpisodeHtmlDocument(payload.htmlDocument) || undefined,
  };
}

function isGroupOfflineHtmlPageEpisode(
  pageEpisode: DatingPageEpisode | undefined,
): pageEpisode is GroupOfflineHtmlPageEpisode {
  return Boolean(pageEpisode && (pageEpisode.pageType === 'micro_app' || pageEpisode.pageType === 'custom_html'));
}

function buildGroupOfflinePageEpisodeSrcDoc(pageEpisode: GroupOfflineHtmlPageEpisode | undefined): string {
  if (!pageEpisode) {
    return '';
  }

  return buildCustomPageEpisodeSrcDoc({
    pageType: pageEpisode.pageType,
    title: pageEpisode.title,
    subtitle: pageEpisode.subtitle,
    caption: pageEpisode.caption,
    htmlDocument: pageEpisode.htmlDocument,
  });
}

function resolveGroupOfflinePageEpisodeSandbox(pageEpisode: GroupOfflineHtmlPageEpisode | undefined): string {
  if (!pageEpisode) {
    return 'allow-same-origin';
  }

  return 'allow-scripts';
}

function normalizeTarget(value: unknown): GroupOfflineRoundCharacterEntry['target'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const type = normalizeString((value as { type?: unknown }).type);
  const label = normalizeString((value as { label?: unknown }).label);
  const characterId = normalizeString((value as { characterId?: unknown }).characterId);
  if (!label || !['user', 'character', 'group', 'scene'].includes(type)) return undefined;
  return {
    type: type as 'user' | 'character' | 'group' | 'scene',
    label,
    ...(characterId ? { characterId } : {}),
  };
}

function normalizeDialogueCore(value: string | undefined): string {
  return normalizeString(value).replace(/^["'“”《》「」『』\s]+|["'“”《》「」『』\s]+$/gu, '').trim();
}

function extractCandidateJsonObjects(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) pushCandidate(trimmed);
  const fencedBlocks = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const block of fencedBlocks) pushCandidate(block[1]);
  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < trimmed.length; index += 1) {
      const char = trimmed[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          pushCandidate(trimmed.slice(start, index + 1));
          break;
        }
      }
    }
  }
  return candidates;
}

function splitNarrativeParagraphs(text: string): string[] {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) return [];
  const explicitParagraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (explicitParagraphs.length > 1) return explicitParagraphs;
  const sentences = normalized
    .split(/(?<=[。！？])/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return [normalized];
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(''));
  }
  return paragraphs;
}

function resolveValidHighlightText(text: string, preferred?: string) {
  if (preferred?.trim() && text.includes(preferred.trim())) return preferred.trim();
  const quoted = text.match(/[“"「『]([^”"」』\n]{4,36})[”"」』]/u)?.[1]?.trim();
  return quoted && text.includes(quoted) ? quoted : undefined;
}

function splitBodyAndHighlight(text: string, highlightText: string | undefined): DisplayBlock[] {
  const paragraphs = splitNarrativeParagraphs(text);
  if (!highlightText?.trim()) {
    return paragraphs.map((paragraph) => ({ type: 'body', text: paragraph }));
  }
  const rawHighlight = highlightText.trim();
  const quoteWrappedCandidates = [
    `“${rawHighlight}”`,
    `"${rawHighlight}"`,
    `「${rawHighlight}」`,
    `『${rawHighlight}』`,
  ];
  const blocks: DisplayBlock[] = [];
  paragraphs.forEach((paragraph) => {
    const targetSegment = quoteWrappedCandidates.find((candidate) => paragraph.includes(candidate))
      || (paragraph.includes(rawHighlight) ? rawHighlight : '');
    if (!targetSegment) {
      blocks.push({ type: 'body', text: paragraph });
      return;
    }
    const [before = '', after = ''] = paragraph.split(targetSegment, 2);
    if (before.trim()) blocks.push({ type: 'body', text: before.trim() });
    blocks.push({ type: 'highlight', text: rawHighlight });
    if (after.trim()) blocks.push({ type: 'body', text: after.trim() });
  });
  return blocks.some((block) => block.type === 'highlight')
    ? blocks
    : paragraphs.map((paragraph) => ({ type: 'body', text: paragraph }));
}

function splitDialogueSegments(paragraph: string) {
  const matches = Array.from(paragraph.matchAll(/(“[^”\n]+”|"[^"\n]+"|「[^」\n]+」|『[^』\n]+』)/gu));
  if (matches.length === 0) return [{ type: 'body' as const, text: paragraph }];
  const segments: Array<{ type: 'body' | 'dialogue'; text: string }> = [];
  let lastIndex = 0;
  matches.forEach((match) => {
    const matchedText = match[0];
    const start = match.index || 0;
    if (start > lastIndex) segments.push({ type: 'body', text: paragraph.slice(lastIndex, start) });
    segments.push({ type: 'dialogue', text: matchedText });
    lastIndex = start + matchedText.length;
  });
  if (lastIndex < paragraph.length) segments.push({ type: 'body', text: paragraph.slice(lastIndex) });
  return segments.filter((segment) => segment.text);
}

function updateRoundEntryInContent(
  content: GroupOfflineGeneratedContent,
  roundId: string,
  characterId: string,
  updater: (entry: GroupOfflineRoundCharacterEntry) => GroupOfflineRoundCharacterEntry,
): GroupOfflineGeneratedContent {
  const rounds = (content.rounds || []).map((round) => (
    round.id !== roundId
      ? round
      : { ...round, characterEntries: round.characterEntries.map((entry) => (entry.characterId !== characterId ? entry : updater(entry))) }
  ));
  return normalizeGeneratedContentForDisplay({ ...content, rounds });
}

function updateRoundInContent(
  content: GroupOfflineGeneratedContent,
  roundId: string,
  updater: (round: GroupOfflineRound) => GroupOfflineRound,
): GroupOfflineGeneratedContent {
  const rounds = (content.rounds || []).map((round) => (round.id !== roundId ? round : updater(round)));
  return normalizeGeneratedContentForDisplay({ ...content, rounds });
}

function normalizeScenarioUpdate(value: unknown): GroupOfflineRound['scenarioUpdate'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as {
    status?: unknown;
    progressSummary?: unknown;
    currentTask?: unknown;
    taskStepUpdates?: unknown[];
  };
  const status = normalizeString(candidate.status);
  const progressSummary = normalizeString(candidate.progressSummary);
  const currentTask = normalizeString(candidate.currentTask);
  const taskStepUpdates = Array.isArray(candidate.taskStepUpdates)
    ? candidate.taskStepUpdates
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const slot = Number.parseInt(normalizeString((item as { slot?: unknown }).slot), 10);
          const stepStatus = normalizeString((item as { status?: unknown }).status);
          const note = normalizeString((item as { note?: unknown }).note);
          if (!Number.isFinite(slot)) return null;
          if (stepStatus !== 'pending' && stepStatus !== 'completed' && stepStatus !== 'failed') return null;
          return {
            slot,
            status: stepStatus,
            ...(note ? { note } : {}),
          };
        })
        .filter((item): item is GroupOfflineScenarioTaskStepUpdate => !!item)
    : [];
  const normalizedStatus = status === 'active' || status === 'completed' || status === 'failed'
    ? status
    : undefined;
  if (!normalizedStatus && !progressSummary && !currentTask && taskStepUpdates.length === 0) {
    return undefined;
  }
  return {
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(progressSummary ? { progressSummary } : {}),
    ...(currentTask ? { currentTask } : {}),
    ...(taskStepUpdates.length > 0 ? { taskStepUpdates } : {}),
  };
}

function buildCurrentRoundLabel(session: GroupOfflineSession): string {
  if (session.currentRound <= 0) {
    const remainingRounds = getGroupOfflineScenarioRemainingRounds(session);
    return typeof remainingRounds === 'number'
      ? `共景 · 剩余 ${remainingRounds} 轮`
      : '共景';
  }
  const remainingRounds = getGroupOfflineScenarioRemainingRounds(session);
  if (session.roundLimit) {
    return typeof remainingRounds === 'number'
      ? `第 ${session.currentRound}/${session.roundLimit} 轮 · 剩余 ${remainingRounds} 轮`
      : `第 ${session.currentRound}/${session.roundLimit} 轮`;
  }
  return `第 ${session.currentRound} 轮`;
}

function syncGeneratedContentCardWithSession(
  session: GroupOfflineSession,
  content: GroupOfflineGeneratedContent | undefined,
): GroupOfflineGeneratedContent | undefined {
  if (!content) return content;
  const scenarioCardFields = buildGroupOfflineScenarioCardFields(session);
  return normalizeGeneratedContentForDisplay({
    ...content,
    card: {
      ...content.card,
      objectiveLabel: scenarioCardFields.objectiveLabel || content.card.objectiveLabel,
      roundLabel: scenarioCardFields.roundLabel || buildCurrentRoundLabel(session),
    },
  });
}

function hasMeaningfulGeneratedContent(content: GroupOfflineGeneratedContent, phase: GroupOfflineContentPhase): boolean {
  if (phase === 'intro') {
    return Boolean(
      normalizeString(content.intro)
      || content.soundtrack
      || (content.participantSoundtracks?.length || 0) > 0,
    );
  }

  const latestRound = (content.rounds || []).slice(-1)[0];
  if (!latestRound) return false;
  return Boolean(
    normalizeString(latestRound.sceneText)
    || isGroupOfflineHtmlPageEpisode(latestRound.pageEpisode)
    || latestRound.characterEntries.some((entry) => normalizeString(entry.text)),
  );
}

function coerceGeneratedContent(
  parsed: unknown,
  fallback: GroupOfflineGeneratedContent,
  session: GroupOfflineSession,
  members: Character[],
  allMembers: Character[],
): GroupOfflineGeneratedContent {
  if (!parsed || typeof parsed !== 'object') return fallback;
  const candidate = parsed as {
    card?: Record<string, unknown>;
    intro?: unknown;
    soundtrack?: Record<string, unknown>;
    participantSoundtracks?: unknown[];
    rounds?: unknown[];
  };
  const offstageAliases = buildOffstageAliases(allMembers, members);
  const fallbackRounds = fallback.rounds || [];
  const rounds = Array.isArray(candidate.rounds)
    ? candidate.rounds
        .map((round, roundIndex) => {
          if (!round || typeof round !== 'object') return null;
          const fallbackRound = fallbackRounds[roundIndex];
          const title = normalizeString((round as { title?: unknown }).title) || fallbackRound?.title || `第 ${roundIndex + 1} 轮`;
          const pageEpisode = normalizeGroupOfflinePageEpisode(
            (round as { pageEpisode?: unknown }).pageEpisode,
            title,
          );
          const rawEntries = Array.isArray((round as { characterEntries?: unknown[] }).characterEntries)
            ? ((round as { characterEntries?: unknown[] }).characterEntries || [])
            : [];
          const characterEntries = rawEntries
            .map((entry, entryIndex) => {
              if (!entry || typeof entry !== 'object') return null;
              const rawCharacterId = normalizeString((entry as { characterId?: unknown }).characterId);
              const rawSpeakerLabel = normalizeString((entry as { speakerLabel?: unknown }).speakerLabel);
              const member = members.find((item) => item.id === rawCharacterId)
                || members.find((item) => memberAliasMatches(rawSpeakerLabel, item));
              const characterId = member?.id || rawCharacterId;
              const fallbackEntry = fallbackRound?.characterEntries.find((item) => item.characterId === characterId)
                || fallbackRound?.characterEntries[entryIndex];
              const speakerLabel = rawSpeakerLabel || member?.name || fallbackEntry?.speakerLabel || '';
              const text = normalizeString((entry as { text?: unknown }).text);
              if ((!member && !fallbackEntry) || !characterId || !speakerLabel || !text) return null;
              if (
                textMentionsOffstageAliases(text, offstageAliases)
                || textMentionsOffstageAliases(normalizeString((entry as { highlightText?: unknown }).highlightText), offstageAliases)
              ) {
                return null;
              }
              return {
                characterId,
                speakerLabel,
                target: normalizeTarget((entry as { target?: unknown }).target),
                text,
                highlightText: resolveValidHighlightText(text, normalizeString((entry as { highlightText?: unknown }).highlightText) || fallbackEntry?.highlightText),
                recommendedSong: normalizeSoundtrack((entry as { recommendedSong?: unknown }).recommendedSong) || fallbackEntry?.recommendedSong,
                statusFields: normalizeStatusFields((entry as { statusFields?: unknown }).statusFields),
                notebook: normalizeNotebookText(
                  normalizeString((entry as { notebook?: unknown }).notebook),
                  speakerLabel,
                ) || undefined,
                aftereffects: normalizeAftereffectsForDisplay(
                  normalizeAftereffects((entry as { aftereffects?: unknown }).aftereffects),
                ),
                memoryPanel: normalizeMemoryPanelForStorage(
                  normalizeMemoryPanel((entry as { memoryPanel?: unknown }).memoryPanel),
                ),
                lastOperation: 'generated',
              } satisfies GroupOfflineRoundCharacterEntry;
            })
            .filter(Boolean) as GroupOfflineRoundCharacterEntry[];
          const nextCharacterEntries = pageEpisode
            ? characterEntries
            : (characterEntries.length > 0 ? characterEntries : (fallbackRound?.characterEntries || []));
          const sceneText = normalizeString((round as { sceneText?: unknown }).sceneText) || undefined;
          if (textMentionsOffstageAliases(sceneText, offstageAliases)) {
            return null;
          }
          const nextRound: GroupOfflineRound = {
            id: normalizeString((round as { id?: unknown }).id) || createGroupOfflineRoundId(session.updatedAt + roundIndex),
            title: title || undefined,
            sceneText,
            mode: pageEpisode ? 'page_episode' : 'scene',
            pageEpisode,
            scenarioUpdate: normalizeScenarioUpdate((round as { scenarioUpdate?: unknown }).scenarioUpdate),
            characterEntries: nextCharacterEntries,
          };
          if (nextRound.characterEntries.length === 0 && !normalizeString(nextRound.sceneText) && !pageEpisode) return null;
          return nextRound satisfies GroupOfflineRound;
        })
        .filter(Boolean) as GroupOfflineRound[]
    : [];

  const result: GroupOfflineGeneratedContent = {
    card: {
      timeLabel: normalizeString(candidate.card?.timeLabel) || fallback.card.timeLabel,
      locationLabel: normalizeString(candidate.card?.locationLabel) || fallback.card.locationLabel,
      weatherLabel: normalizeString(candidate.card?.weatherLabel) || fallback.card.weatherLabel,
      participantLabels: Array.isArray(candidate.card?.participantLabels)
        ? (candidate.card?.participantLabels as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
        : fallback.card.participantLabels,
      objectiveLabel: normalizeString(candidate.card?.objectiveLabel) || fallback.card.objectiveLabel,
      roundLabel: normalizeString(candidate.card?.roundLabel) || fallback.card.roundLabel,
    },
    intro: normalizeString(candidate.intro) || fallback.intro,
    soundtrack: normalizeSoundtrack(candidate.soundtrack) || fallback.soundtrack,
    participantSoundtracks: normalizeParticipantSoundtracks(candidate.participantSoundtracks).length > 0
      ? normalizeParticipantSoundtracks(candidate.participantSoundtracks)
      : fallback.participantSoundtracks,
    lines: [],
    characterBlocks: [],
    rounds: rounds.length > 0 ? rounds : fallback.rounds,
    endingVoices: fallback.endingVoices,
  };

  return normalizeGeneratedContentForDisplay(result);
}

function parseGeneratedContent(
  rawText: string,
  fallback: GroupOfflineGeneratedContent,
  session: GroupOfflineSession,
  members: Character[],
  allMembers: Character[],
): GroupOfflineGeneratedContent {
  const candidates = extractCandidateJsonObjects(rawText);
  for (const candidate of candidates) {
    try {
      return coerceGeneratedContent(JSON.parse(candidate), fallback, session, members, allMembers);
    } catch {
      continue;
    }
  }
  return normalizeGeneratedContentForDisplay(fallback);
}

function coerceSingleEntry(parsed: unknown, fallback: GroupOfflineRoundCharacterEntry): GroupOfflineRoundCharacterEntry {
  if (!parsed || typeof parsed !== 'object') return fallback;
  const candidate = parsed as {
    target?: unknown;
    text?: unknown;
    highlightText?: unknown;
    statusFields?: unknown;
    notebook?: unknown;
    aftereffects?: unknown;
    memoryPanel?: unknown;
  };
  const text = normalizeString(candidate.text) || fallback.text;
  return {
    ...fallback,
    target: normalizeTarget(candidate.target) || fallback.target,
    text,
    highlightText: resolveValidHighlightText(text, normalizeString(candidate.highlightText) || fallback.highlightText),
    statusFields: normalizeStatusFields(candidate.statusFields),
    notebook: normalizeNotebookText(normalizeString(candidate.notebook), fallback.speakerLabel) || fallback.notebook,
    aftereffects: normalizeAftereffectsForDisplay(normalizeAftereffects(candidate.aftereffects) || fallback.aftereffects),
    memoryPanel: normalizeMemoryPanelForStorage(
      normalizeMemoryPanel(candidate.memoryPanel) || fallback.memoryPanel,
    ),
  };
}

function parseSingleEntryRewrite(rawText: string, fallback: GroupOfflineRoundCharacterEntry): GroupOfflineRoundCharacterEntry {
  const candidates = extractCandidateJsonObjects(rawText);
  for (const candidate of candidates) {
    try {
      return coerceSingleEntry(JSON.parse(candidate), fallback);
    } catch {
      continue;
    }
  }
  return fallback;
}

function parseRoundRewrite(rawText: string, fallbackRound: GroupOfflineRound): GroupOfflineRound {
  const candidates = extractCandidateJsonObjects(rawText);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        round?: { title?: unknown; sceneText?: unknown; characterEntries?: unknown[]; scenarioUpdate?: unknown };
        title?: unknown;
        sceneText?: unknown;
        characterEntries?: unknown[];
        scenarioUpdate?: unknown;
      };
      const roundCandidate = parsed.round || parsed;
      const nextEntriesById = new Map<string, GroupOfflineRoundCharacterEntry>();
      if (Array.isArray(roundCandidate.characterEntries)) {
        roundCandidate.characterEntries.forEach((entry) => {
          if (!entry || typeof entry !== 'object') return;
          const characterId = normalizeString((entry as { characterId?: unknown }).characterId);
          const fallbackEntry = fallbackRound.characterEntries.find((item) => item.characterId === characterId);
          if (!characterId || !fallbackEntry) return;
          nextEntriesById.set(characterId, coerceSingleEntry(entry, fallbackEntry));
        });
      }
      const pageEpisode = normalizeGroupOfflinePageEpisode(
        (roundCandidate as { pageEpisode?: unknown }).pageEpisode,
        normalizeString(roundCandidate.title) || fallbackRound.title || '当前轮',
      );
      const nextRound: GroupOfflineRound = {
        ...fallbackRound,
        title: normalizeString(roundCandidate.title) || fallbackRound.title,
        sceneText: normalizeString(roundCandidate.sceneText) || fallbackRound.sceneText,
        mode: pageEpisode ? 'page_episode' : fallbackRound.mode,
        pageEpisode: pageEpisode || fallbackRound.pageEpisode,
        scenarioUpdate: normalizeScenarioUpdate((roundCandidate as { scenarioUpdate?: unknown }).scenarioUpdate) || fallbackRound.scenarioUpdate,
        characterEntries: pageEpisode
          ? (Array.isArray(roundCandidate.characterEntries)
            ? fallbackRound.characterEntries
                .map((entry) => nextEntriesById.get(entry.characterId))
                .filter((entry): entry is GroupOfflineRoundCharacterEntry => !!entry)
            : [])
          : fallbackRound.characterEntries.map((entry) => nextEntriesById.get(entry.characterId) || entry),
      };
      return nextRound;
    } catch {
      continue;
    }
  }
  return fallbackRound;
}

function buildDerivedEndingPayload(session: GroupOfflineSession, members: Character[]): EndingPayload {
  const participantMembers = session.participants
    .map((participant) => members.find((member) => member.id === participant.characterId))
    .filter((member): member is Character => !!member);
  const rounds = session.generatedContent?.rounds || [];
  const latestRound = rounds[rounds.length - 1];
  const leadSummary = normalizeString(latestRound?.sceneText)
    || normalizeString(session.generatedContent?.intro)
    || normalizeString(session.scenePrompt)
    || `${session.customActivityType?.trim() || session.activityType}先收在这里了。`;
  const condensedSummary = leadSummary.length > 48 ? `${leadSummary.slice(0, 47).trim()}…` : leadSummary;
  return {
    summaryLines: [
      `${session.customActivityType?.trim() || session.activityType}先收在这里了。`,
      condensedSummary,
    ],
    endingVoices: participantMembers.map((member) => {
      const latestEntry = [...rounds]
        .reverse()
        .map((round) => round.characterEntries.find((entry) => entry.characterId === member.id))
        .find((entry) => !!entry);
      const quote = normalizeDialogueCore(latestEntry?.highlightText).slice(0, 18);
      const targetLabel = normalizeString(latestEntry?.target?.label);

      return {
        characterId: member.id,
        characterName: member.name,
        text: quote
          ? `我到了。刚才${targetLabel ? `对${targetLabel}` : ''}那句“${quote}”我还记着，回头再说。`
          : targetLabel
            ? `我到了。刚才和${targetLabel}那点话头我先记着，回群慢慢接。`
            : '我到了。刚才那轮我先记着，回群再慢慢接。',
      };
    }),
  };
}

async function generateEndingPayload(params: {
  session: GroupOfflineSession;
  members: Character[];
  activeConfig: ApiConfig | null;
}): Promise<EndingPayload> {
  if (!params.activeConfig?.apiKey?.trim()) return buildDerivedEndingPayload(params.session, params.members);
  const roundsSummary = (params.session.generatedContent?.rounds || [])
    .slice(-3)
    .map((round) => [
      round.title || '本轮',
      round.userMessageText ? `用户输入：${round.userMessageText}` : '',
      round.sceneText || '',
      ...round.characterEntries.map((entry) => `${entry.speakerLabel}：${entry.text}`),
    ].filter(Boolean).join('\n'))
    .join('\n\n');
  const prompt = [
    '请为一场“群聊线下”生成结束收尾 JSON。',
    '要求：',
    '1. 这是多人线下结束，不是单人独白。',
    '2. summaryLines 用 2 到 3 句收住余温，不要空泛抒情。',
    '3. endingVoices 不是内心独白，而是这些角色回到群聊后各自发出的公开群消息；每个角色一条，必须像正常群聊气泡。',
    '4. text 里不要写旁白、动作描写、角色名前缀，也不要写“他说”“她想”，只保留角色真正发出来的群消息内容。',
    '5. characterId 必须严格使用下面参与人列表里的真实 id，不要自己编，不要写名字代替 id。',
    '6. 风格要像有余温的回群消息，不要太 AI 腔。',
    '7. 输出 JSON：{"summaryLines":["..."],"endingVoices":[{"characterId":"...","characterName":"...","text":"..."}]}',
    '',
    `局类型：${params.session.customActivityType?.trim() || params.session.activityType}`,
    `地点：${params.session.location}`,
    `时间：${params.session.timeLabel}`,
    '参与人：',
    ...params.members.map((member) => `- ${member.id} :: ${member.remarkName?.trim() || member.name}`),
    '',
    '最近几轮内容：',
    roundsSummary || '暂无',
  ].join('\n');
  const rawText = await generateTextFromMessagesWithConfig({
    activeConfig: params.activeConfig,
    messages: [{ role: 'user', content: prompt }],
  });
  const candidates = extractCandidateJsonObjects(rawText);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<EndingPayload>;
      const summaryLines = Array.isArray(parsed.summaryLines)
        ? parsed.summaryLines.map((line) => normalizeString(line)).filter(Boolean)
        : [];
      const endingVoices = Array.isArray(parsed.endingVoices)
        ? parsed.endingVoices
            .map((entry) => {
              if (!entry || typeof entry !== 'object') return null;
              const characterId = normalizeString((entry as { characterId?: unknown }).characterId);
              const characterName = normalizeString((entry as { characterName?: unknown }).characterName);
              const text = normalizeString((entry as { text?: unknown }).text);
              const matchedMember = (
                params.members.find((member) => member.id === characterId)
                || params.members.find((member) => memberAliasMatches(characterName, member))
              );
              if (!matchedMember || !text) return null;
              return {
                characterId: matchedMember.id,
                characterName: matchedMember.remarkName?.trim() || matchedMember.name,
                text,
              } satisfies GroupOfflineEndingVoice;
            })
            .filter((item): item is GroupOfflineEndingVoice => !!item)
        : [];
      if (endingVoices.length > 0) {
        return {
          summaryLines: summaryLines.length > 0 ? summaryLines : buildDerivedEndingPayload(params.session, params.members).summaryLines,
          endingVoices,
        };
      }
    } catch {
      continue;
    }
  }
  return buildDerivedEndingPayload(params.session, params.members);
}

function dispatchLabel(dispatchMode: GroupOfflineRoundDispatchMode | undefined) {
  switch (dispatchMode) {
    case 'manual':
      return '手动排顺序';
    case 'random':
      return '随机出场';
    case 'continue':
      return '继续推进';
    case 'recommend':
    default:
      return '系统推荐';
  }
}

export function GroupOfflineScene({
  session,
  directorLaunchToken = 0,
  initialDirectorSection,
  group,
  members,
  inviteableCharacters: _inviteableCharacters,
  userName,
  activeConfig,
  activeWorldBooks = [],
  history,
  directChatHistory,
  perception,
  onBackToPlanner,
  onUpdateSession,
  onComplete,
}: GroupOfflineSceneProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [currentSession, setCurrentSession] = useState<GroupOfflineSession>({
    ...session,
    generationMode: 'blocks',
    generatedContent: syncGeneratedContentCardWithSession(
      session,
      session.generatedContent ? normalizeGeneratedContentForDisplay(session.generatedContent) : session.generatedContent,
    ),
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showCustomStyleSheet, setShowCustomStyleSheet] = useState(false);
  const [manualSelectionMode, setManualSelectionMode] = useState(false);
  const [queuedCharacterIds, setQueuedCharacterIds] = useState<string[]>([]);
  const [expandedStatusKeys, setExpandedStatusKeys] = useState<Record<string, boolean>>({});
  const [expandedSideSectionKeys, setExpandedSideSectionKeys] = useState<Record<string, boolean>>({});
  const [selectedInspectorEntryByRoundId, setSelectedInspectorEntryByRoundId] = useState<Record<string, string>>({});
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [customStyleDraft, setCustomStyleDraft] = useState(session.writingStyleCustom || '');
  const [entryActionKey, setEntryActionKey] = useState<string | null>(null);
  const [endingState, setEndingState] = useState<'idle' | 'generating' | 'ready'>('idle');
  const [endingPayload, setEndingPayload] = useState<EndingPayload | null>(null);
  const { resolvedUrl: resolvedBackgroundUrl } = useResolvedPersistentValue(currentSession.backgroundImage || group.groupBackground);
  const backgroundImage = getDisplayableAssetValue(currentSession.backgroundImage || group.groupBackground, resolvedBackgroundUrl) || '';

  useEffect(() => {
    setCurrentSession({
      ...session,
      generationMode: 'blocks',
      generatedContent: syncGeneratedContentCardWithSession(
        session,
        session.generatedContent ? normalizeGeneratedContentForDisplay(session.generatedContent) : session.generatedContent,
      ),
    });
  }, [session]);

  useEffect(() => {
    if (!showCustomStyleSheet) {
      setCustomStyleDraft(session.writingStyleCustom || '');
    }
  }, [session.writingStyleCustom, showCustomStyleSheet]);

  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const sessionWorldBooks = useMemo(
    () => resolveGroupOfflineWorldBookSnapshot(currentSession, activeWorldBooks),
    [activeWorldBooks, currentSession],
  );
  const resolveMemberForEntry = (entry: Pick<GroupOfflineRoundCharacterEntry, 'characterId' | 'speakerLabel'>) => (
    memberMap.get(entry.characterId)
    || members.find((member) => memberAliasMatches(entry.speakerLabel, member))
  );
  const buildRuntimeProjectionForSession = (sessionToProject: GroupOfflineSession) => buildGroupOfflineRuntimeProjection({
    session: sessionToProject,
    group,
    members,
    userName,
    history,
    directChatHistory,
    activeWorldBooks: sessionWorldBooks,
    perception,
  });
  const runtimeProjection = useMemo(
    () => buildRuntimeProjectionForSession(currentSession),
    [currentSession, directChatHistory, group, history, members, perception, sessionWorldBooks, userName],
  );
  const participantMembers = useMemo(
    () => currentSession.participants
      .map((participant) => memberMap.get(participant.characterId))
      .filter((member): member is Character => !!member),
    [currentSession.participants, memberMap],
  );
  const addableGroupMembers = useMemo(
    () => members.filter((member) => (
      group.memberIds.includes(member.id)
      && !currentSession.participants.some((participant) => participant.characterId === member.id)
    )),
    [currentSession.participants, group.memberIds, members],
  );
  const highlightStyle = useMemo<React.CSSProperties | undefined>(
    () => ({ color: currentSession.highlightColor || '#92EBF2' }),
    [currentSession.highlightColor],
  );
  const bodyTextStyle = useMemo<React.CSSProperties | undefined>(
    () => currentSession.bodyTextColor ? { color: currentSession.bodyTextColor } : undefined,
    [currentSession.bodyTextColor],
  );
  const queuedMembers = useMemo(
    () => queuedCharacterIds.map((characterId) => memberMap.get(characterId)).filter((member): member is Character => !!member),
    [queuedCharacterIds, memberMap],
  );
  const recommendedCharacterIds = useMemo(
    () => pickRecommendedGroupOfflineParticipantIds({
      session: currentSession,
      members: participantMembers,
      latestUserMessage: input,
      desiredCount: Math.min(2, participantMembers.length || 1),
    }),
    [currentSession, input, participantMembers],
  );
  const latestRound = useMemo(() => {
    const rounds = currentSession.generatedContent?.rounds || [];
    return rounds.length > 0 ? rounds[rounds.length - 1] : null;
  }, [currentSession.generatedContent]);
  const awaitingDirectorInstruction = Boolean(currentSession.awaitingDirectorInstruction);
  const scenarioCardFields = useMemo(
    () => buildGroupOfflineScenarioCardFields(currentSession),
    [currentSession],
  );
  const scenarioLockReason = useMemo(
    () => getGroupOfflineScenarioLockReason(currentSession),
    [currentSession],
  );
  const dispatchDisabledReason = awaitingDirectorInstruction
    ? '先在大鹅导演里写特殊指令，再点击“开始这场”。'
    : scenarioLockReason;
  const progressPanel = useMemo(() => {
    const rounds = currentSession.generatedContent?.rounds || [];
    const lastRoundId = rounds[rounds.length - 1]?.id;
    const memoryRows = participantMembers.map((member) => {
      const memoryPanel = buildAccumulatedMemoryPanel({
        memoryPanel: undefined,
        rounds,
        characterId: member.id,
        roundId: lastRoundId,
      });
      return {
        characterName: member.remarkName?.trim() || member.name,
        shortTermCount: memoryPanel.shortTerm.length,
        longTermCount: memoryPanel.longTerm.length,
      };
    });

    return {
      roundLabel: scenarioCardFields.roundLabel || buildCurrentRoundLabel(currentSession),
      backgroundLabel: currentSession.scenarioState?.backgroundLabel || currentSession.scenePrompt?.trim() || undefined,
      taskLabel: currentSession.scenarioState?.currentTask || undefined,
      statusLabel: currentSession.scenarioState
        ? getGroupOfflineScenarioStatusLabel(currentSession.scenarioState.status)
        : '现场进行中',
      progressSummary: currentSession.scenarioState?.progressSummary
        || normalizeString(latestRound?.sceneText)
        || '共景已经铺开，下一轮会继续往前推。',
      successCondition: currentSession.scenarioState?.successCondition,
      failureCondition: currentSession.scenarioState?.failureCondition,
      pressureLine: currentSession.scenarioState?.pressureLine,
      taskSteps: currentSession.scenarioState?.taskSteps || [],
      memoryRows,
      lockReason: dispatchDisabledReason,
    };
  }, [currentSession, dispatchDisabledReason, latestRound, participantMembers, scenarioCardFields.roundLabel]);
  const pendingUserMessages = useMemo(() => {
    const sentMessages = currentSession.messages.filter((message) => message.role === 'user');
    const attachedCount = (currentSession.generatedContent?.rounds || [])
      .filter((round) => normalizeString(round.userMessageText))
      .length;
    return sentMessages.slice(attachedCount);
  }, [currentSession.generatedContent, currentSession.messages]);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [pendingUserMessages.length, (currentSession.generatedContent?.rounds || []).length]);

  const sceneSongBoardItem = useMemo<SongBoardItem | null>(() => {
    const soundtrack = currentSession.generatedContent?.soundtrack;
    if (!soundtrack) return null;
    const seedInput = `scene:${soundtrack.title}:${soundtrack.artist}`;
    return {
      sourceLabel: '场景音乐',
      title: soundtrack.title,
      artist: soundtrack.artist,
      lyricLines: splitSongLyricLines(soundtrack.note),
      progressPercent: buildSongBoardProgressPercent(seedInput),
      durationLabel: buildSongBoardDurationLabel(seedInput),
    };
  }, [currentSession.generatedContent]);

  const resolveSessionMembers = (sessionToResolve: GroupOfflineSession) => (
    sessionToResolve.participants
      .map((participant) => memberMap.get(participant.characterId))
      .filter((member): member is Character => !!member)
  );

  const saveSession = (nextSession: GroupOfflineSession) => {
    const normalizedNextSession = {
      ...nextSession,
      generatedContent: syncGeneratedContentCardWithSession(
        nextSession,
        nextSession.generatedContent ? normalizeGeneratedContentForDisplay(nextSession.generatedContent) : nextSession.generatedContent,
      ),
    };
    setCurrentSession(normalizedNextSession);
    onUpdateSession(normalizedNextSession);
  };

  const ensureScenarioCanAdvance = (sessionToCheck: GroupOfflineSession) => {
    const lockReason = getGroupOfflineScenarioLockReason(sessionToCheck);
    if (!lockReason) {
      return true;
    }
    setError(lockReason);
    return false;
  };

  const decorateRoundContent = (
    content: GroupOfflineGeneratedContent,
    meta: {
      dispatchMode?: GroupOfflineRoundDispatchMode;
      selectedCharacterIds?: string[];
      userMessageText?: string;
      appliedDirectorInstruction?: string;
      runtimeProjectionSnapshot?: ReturnType<typeof buildGroupOfflineRoundRuntimeProjectionSnapshot>;
      plannerSnapshot?: ReturnType<typeof buildGroupOfflineRoundPlanSnapshot>;
    },
  ): GroupOfflineGeneratedContent => {
    const rounds: GroupOfflineRound[] = (content.rounds || []).map((round) => ({
      ...round,
      generationMode: 'blocks',
      dispatchMode: meta.dispatchMode,
      selectedCharacterIds: meta.selectedCharacterIds,
      userMessageText: meta.userMessageText?.trim() || undefined,
      appliedDirectorInstruction: meta.appliedDirectorInstruction,
      runtimeProjectionSnapshot: meta.runtimeProjectionSnapshot,
      plannerSnapshot: meta.plannerSnapshot,
      characterEntries: round.characterEntries.map((entry) => ({
        ...entry,
        highlightText: resolveValidHighlightText(entry.text, entry.highlightText),
        lastOperation: entry.lastOperation || 'generated',
      })),
    }));
    return normalizeGeneratedContentForDisplay({ ...content, rounds });
  };

  const generateContent = async (options: GenerateContentOptions): Promise<GroupOfflineSession | undefined> => {
    const baseSession = options.baseSession ?? currentSession;
    const appliedDirectorInstruction = options.directorInstructionOverride?.trim() || undefined;
    const workingSession: GroupOfflineSession = {
      ...baseSession,
      generationMode: 'blocks',
      currentRound: options.phase === 'round'
        ? (options.nextRoundNumber ?? baseSession.currentRound)
        : baseSession.currentRound,
      updatedAt: Date.now(),
    };
    const workingRuntimeProjection = buildRuntimeProjectionForSession(workingSession);
    const workingRoundPlan = options.phase === 'round'
      ? buildGroupOfflineRoundPlan({
          session: workingSession,
          projection: workingRuntimeProjection,
          selectedCharacterIds: options.selectedCharacterIds,
          dispatchMode: options.dispatchMode,
          latestUserMessage: options.latestUserMessage,
          userMessageText: options.userMessageText,
        })
      : undefined;
    const sessionMembers = resolveSessionMembers(workingSession);
    const shell = buildGroupOfflineGeneratedContentShell({
      session: workingSession,
      members: sessionMembers,
      userName,
      phase: options.phase,
      selectedCharacterIds: options.selectedCharacterIds,
      dispatchMode: options.dispatchMode,
      userMessageText: options.userMessageText,
    });

    setLoading(true);
    setError('');
    try {
      if (!activeConfig?.apiKey?.trim()) {
        if (options.phase === 'intro' && !baseSession.generatedContent) {
          saveSession({
            ...workingSession,
            generatedContent: normalizeGeneratedContentForDisplay(shell),
            weatherLabel: shell.card.weatherLabel || workingSession.weatherLabel,
          });
        }
        setError('当前没有可用的 AI 配置，暂时不能生成群线下内容。');
        return undefined;
      }

      const worldBookPrompt = buildGroupWorldBookPrompt(
        sessionWorldBooks,
        buildGroupWorldBookRetrievalOptions({
          history,
          supplementalMessages: workingSession.messages,
          latestUserMessage: options.latestUserMessage,
        }),
      );
      const rawText = await generateTextFromMessagesWithConfig({
        activeConfig,
        messages: [{
          role: 'user',
          content: buildGroupOfflinePrompt({
            session: workingSession,
            runtimeProjection: workingRuntimeProjection,
            worldBookPrompt,
            roundPlan: workingRoundPlan,
            latestUserMessage: options.latestUserMessage,
            existingRounds: baseSession.generatedContent?.rounds,
            phase: options.phase,
            selectedCharacterIds: options.selectedCharacterIds,
            dispatchMode: options.dispatchMode,
            directorInstructionOverride: appliedDirectorInstruction,
            directorMode: options.directorMode,
          }),
        }],
      });
      let nextContent = parseGeneratedContent(rawText, shell, workingSession, sessionMembers, members);
      if (!hasMeaningfulGeneratedContent(nextContent, options.phase)) {
        throw new Error(options.phase === 'intro' ? 'AI 返回的开局内容不完整。' : 'AI 返回的轮次内容不完整。');
      }

      if (options.phase === 'round') {
        nextContent = decorateRoundContent(nextContent, {
          dispatchMode: options.dispatchMode,
          selectedCharacterIds: options.selectedCharacterIds,
          userMessageText: options.userMessageText,
          appliedDirectorInstruction,
          runtimeProjectionSnapshot: buildGroupOfflineRoundRuntimeProjectionSnapshot(workingRuntimeProjection),
          plannerSnapshot: workingRoundPlan ? buildGroupOfflineRoundPlanSnapshot(workingRoundPlan) : undefined,
        });
        const openingSoundtrack = baseSession.generatedContent?.soundtrack;
        const openingParticipantSoundtracks = baseSession.generatedContent?.participantSoundtracks;
        nextContent = {
          ...nextContent,
          soundtrack: openingSoundtrack || nextContent.soundtrack,
          participantSoundtracks: openingParticipantSoundtracks || nextContent.participantSoundtracks,
        };
      }

      const mergedContent = options.phase === 'intro'
        ? normalizeGeneratedContentForDisplay(nextContent)
        : normalizeGeneratedContentForDisplay(mergeGroupOfflineGeneratedContent(baseSession.generatedContent, nextContent));
      const latestMergedRound = options.phase === 'round'
        ? (mergedContent.rounds || []).slice(-1)[0]
        : undefined;
      const nextSession = options.phase === 'round'
        ? applyGroupOfflineScenarioRoundResult({
            ...workingSession,
            generatedContent: mergedContent,
            weatherLabel: mergedContent.card.weatherLabel || workingSession.weatherLabel,
          } as GroupOfflineSession, latestMergedRound)
        : {
            ...workingSession,
            generatedContent: mergedContent,
            weatherLabel: mergedContent.card.weatherLabel || workingSession.weatherLabel,
          };

      saveSession(nextSession);

      if (options.phase === 'round' && nextSession.mode === 'scenario' && nextSession.scenarioState?.status === 'failed') {
        setError('设定局已到轮数上限，任务判定失败，请结束这场线下。');
      }

      if (options.phase === 'round') {
        setManualSelectionMode(false);
        setQueuedCharacterIds([]);
      }
      return nextSession;
    } catch (generationError) {
      console.error('[group-offline] generation failed', generationError);
      if (options.phase === 'intro' && !baseSession.generatedContent) {
        saveSession({
          ...workingSession,
          generatedContent: normalizeGeneratedContentForDisplay(shell),
          weatherLabel: shell.card.weatherLabel || workingSession.weatherLabel,
        });
      }
      setError(generationError instanceof Error ? generationError.message : '群线下生成失败，请稍后再试。');
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentSession.generatedContent && !loading && !currentSession.awaitingDirectorInstruction) {
      void generateContent({ phase: 'intro' });
    }
  }, [currentSession.awaitingDirectorInstruction, currentSession.generatedContent, currentSession.id, loading]);

  const queueCharacter = (characterId: string) => {
    if (!manualSelectionMode) return;
    setQueuedCharacterIds((previous) => {
      if (previous.includes(characterId)) return previous.filter((item) => item !== characterId);
      if (previous.length >= MAX_GROUP_OFFLINE_BLOCK_SELECTION) {
        setError(`分块推进每轮最多调度 ${MAX_GROUP_OFFLINE_BLOCK_SELECTION} 个角色。`);
        return previous;
      }
      return [...previous, characterId];
    });
  };

  const runBlockRound = async (params: {
    dispatchMode: GroupOfflineRoundDispatchMode;
    baseSession?: GroupOfflineSession;
    selectedCharacterIds?: string[];
    latestUserMessage?: string;
    userMessageText?: string;
    directorInstructionOverride?: string;
    directorMode?: GroupOfflineDirectorMode;
  }): Promise<GroupOfflineSession | undefined> => {
    const baseSession = params.baseSession ?? currentSession;
    if (!ensureScenarioCanAdvance(baseSession)) {
      return undefined;
    }
    const selectedCharacterIds = params.selectedCharacterIds?.length
      ? params.selectedCharacterIds
      : params.dispatchMode === 'random'
        ? pickRandomGroupOfflineParticipantIds({
            session: baseSession,
            members: resolveSessionMembers(baseSession),
            latestUserMessage: params.latestUserMessage,
            desiredCount: Math.min(2, baseSession.participants.length || 1),
          })
        : pickRecommendedGroupOfflineParticipantIds({
            session: baseSession,
            members: resolveSessionMembers(baseSession),
            latestUserMessage: params.latestUserMessage,
            desiredCount: Math.min(2, baseSession.participants.length || 1),
          });

    if (selectedCharacterIds.length === 0) {
      setError('这一轮还没有可调度的角色。');
      return undefined;
    }

    return generateContent({
      phase: 'round',
      baseSession,
      latestUserMessage: params.latestUserMessage,
      userMessageText: params.userMessageText,
      selectedCharacterIds,
      dispatchMode: params.dispatchMode,
      nextRoundNumber: baseSession.currentRound + 1,
      directorInstructionOverride: params.directorInstructionOverride,
      directorMode: params.directorMode,
    });
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    if (currentSession.awaitingDirectorInstruction) {
      setError('先在大鹅导演里写特殊指令，再点击“开始这场”。');
      return;
    }
    if (!ensureScenarioCanAdvance(currentSession)) return;
    const userMessage = {
      id: createGroupOfflineMessageId(),
      role: 'user' as const,
      text: trimmed,
      timestamp: Date.now(),
    };
    const nextSession: GroupOfflineSession = {
      ...currentSession,
      messages: [...currentSession.messages, userMessage],
      updatedAt: userMessage.timestamp,
    };
    saveSession(nextSession);
    setInput('');

    const manualIds = manualSelectionMode && queuedCharacterIds.length > 0 ? queuedCharacterIds : undefined;
    await runBlockRound({
      baseSession: nextSession,
      dispatchMode: manualIds ? 'manual' : 'recommend',
      selectedCharacterIds: manualIds,
      latestUserMessage: trimmed,
      userMessageText: trimmed,
    });
  };

  const handleInviteCharacter = async (character: Character) => {
    if (loading) return;
    if (!ensureScenarioCanAdvance(currentSession)) return;
    const nextSession: GroupOfflineSession = {
      ...currentSession,
      participants: [
        ...currentSession.participants,
        {
          characterId: character.id,
          joinedAt: Date.now(),
          presence: 'added_midway',
          isTemporary: true,
        },
      ],
      updatedAt: Date.now(),
    };
    saveSession(nextSession);
    setShowInviteSheet(false);

    if (currentSession.awaitingDirectorInstruction) {
      return;
    }

    await runBlockRound({
      baseSession: nextSession,
      dispatchMode: 'recommend',
      selectedCharacterIds: [character.id],
      latestUserMessage: `${character.name}被中途拉进了这一场局。`,
      userMessageText: `${character.name}被中途拉进了这一场局。`,
    });
  };

  const handleEntryAction = async (
    kind: EntryActionKind,
    round: GroupOfflineRound,
    entry: GroupOfflineRoundCharacterEntry,
  ) => {
    if (entryActionKey) return;
    const actionKey = `${kind}:${round.id}:${entry.characterId}`;
    setEntryActionKey(actionKey);
    setError('');
    try {
      let nextEntry = {
        ...entry,
        lastOperation: kind === 'retry' ? 'retried' : 'polished',
      } satisfies GroupOfflineRoundCharacterEntry;

      if (activeConfig?.apiKey?.trim()) {
        const roundRuntimeProjection = resolveRoundRuntimeProjection(round, currentSession, runtimeProjection);
        const roundPlan = resolveRoundPlannerSnapshot(round, currentSession);
        const rawText = await generateTextFromMessagesWithConfig({
          activeConfig,
          messages: [{
            role: 'user',
            content: buildGroupOfflineEntryRewritePrompt({
              kind,
              session: currentSession,
              round,
              entry,
              runtimeProjection: roundRuntimeProjection,
              roundPlan,
            }),
          }],
        });
        nextEntry = {
          ...parseSingleEntryRewrite(rawText, nextEntry),
          lastOperation: kind === 'retry' ? 'retried' : 'polished',
        };
      }

      if (!currentSession.generatedContent) return;
      const nextContent = updateRoundEntryInContent(currentSession.generatedContent, round.id, entry.characterId, () => nextEntry);
      saveSession({
        ...currentSession,
        generatedContent: nextContent,
        updatedAt: Date.now(),
      });
    } catch (actionError) {
      console.error('[group-offline] entry action failed', actionError);
      setError(actionError instanceof Error ? actionError.message : `${kind === 'retry' ? '重试本块' : '只润色'}失败，请稍后再试。`);
    } finally {
      setEntryActionKey(null);
    }
  };

  const handleSaveEntryEdit = (roundId: string, characterId: string) => {
    const trimmed = editingDraft.trim();
    if (!trimmed || !currentSession.generatedContent) return;
    const nextContent = updateRoundEntryInContent(currentSession.generatedContent, roundId, characterId, (entry) => ({
      ...entry,
      text: trimmed,
      highlightText: resolveValidHighlightText(trimmed, entry.highlightText),
      lastOperation: 'edited',
    }));
    saveSession({
      ...currentSession,
      generatedContent: nextContent,
      updatedAt: Date.now(),
    });
    setEditingEntryKey(null);
    setEditingDraft('');
  };

  const handleRoundRewrite = async (params: {
    mode: RoundRewriteMode;
    stylePresetId?: GroupOfflineStylePresetId;
    customStyleText?: string;
    directorInstructionText?: string;
  }) => {
    if (loading || !currentSession.generatedContent || !latestRound) return;
    const nextWritingStyleCustom = params.mode === 'style_preset'
      ? (params.stylePresetId ? buildGroupOfflineStylePresetInstruction(params.stylePresetId) : currentSession.writingStyleCustom)
      : params.mode === 'custom_style'
        ? (params.customStyleText?.trim() || currentSession.writingStyleCustom)
        : currentSession.writingStyleCustom;
    const nextDirectorInstruction = params.mode === 'director_instruction'
      ? (params.directorInstructionText?.trim() || undefined)
      : currentSession.directorInstruction;
    if (!activeConfig?.apiKey?.trim()) {
      setError(
        params.mode === 'retry_round'
          ? '当前没有可用的 AI 配置，暂时不能重试本轮。'
          : params.mode === 'director_instruction'
            ? '当前没有可用的 AI 配置，暂时不能按指令重写本轮。'
            : '当前没有可用的 AI 配置，暂时不能改文风。',
      );
      return;
    }

    setLoading(true);
    setError('');
    const workingSession: GroupOfflineSession = {
      ...currentSession,
      writingStyleCustom: nextWritingStyleCustom?.trim() || undefined,
      directorInstruction: nextDirectorInstruction,
      updatedAt: Date.now(),
    };
    const liveWorkingRuntimeProjection = buildRuntimeProjectionForSession(workingSession);
    const workingRuntimeProjection = resolveRoundRuntimeProjection(latestRound, workingSession, liveWorkingRuntimeProjection);
    const workingRoundPlan = resolveRoundPlannerSnapshot(latestRound, workingSession);

    try {
      const rawText = await generateTextFromMessagesWithConfig({
        activeConfig,
        messages: [{
          role: 'user',
          content: buildGroupOfflineRoundRewritePrompt({
            mode: params.mode,
            session: workingSession,
            round: latestRound,
            runtimeProjection: workingRuntimeProjection,
            previousRounds: currentSession.generatedContent.rounds,
            stylePresetId: params.stylePresetId,
            customStyleText: params.customStyleText,
            directorInstructionText: params.directorInstructionText,
            roundPlan: workingRoundPlan,
          }),
        }],
      });
      const rewrittenRound = parseRoundRewrite(rawText, latestRound);
      const nextContent = updateRoundInContent(currentSession.generatedContent, latestRound.id, (round) => {
        const finalMode = rewrittenRound.mode || round.mode || 'scene';
        const finalPageEpisode = rewrittenRound.pageEpisode || (
          finalMode === 'page_episode' ? round.pageEpisode : undefined
        );
        const isPageEpisodeRound = finalMode === 'page_episode' && !!finalPageEpisode;
        const isNewPageEpisodeRound = isPageEpisodeRound && !round.pageEpisode;

        return {
          ...round,
          title: rewrittenRound.title || round.title,
          sceneText: rewrittenRound.sceneText || round.sceneText,
          mode: finalMode,
          pageEpisode: finalPageEpisode,
          appliedDirectorInstruction: params.mode === 'director_instruction'
            ? nextDirectorInstruction
            : round.appliedDirectorInstruction,
          characterEntries: isPageEpisodeRound
            ? (
              rewrittenRound.characterEntries.length > 0
                ? rewrittenRound.characterEntries.map((entry) => ({
                    ...entry,
                    highlightText: resolveValidHighlightText(entry.text, entry.highlightText),
                    lastOperation: params.mode === 'retry_round' || params.mode === 'director_instruction'
                      ? 'retried'
                      : 'polished',
                  }))
                : (isNewPageEpisodeRound ? [] : round.characterEntries)
            )
            : round.characterEntries.map((entry) => {
                const nextEntry = rewrittenRound.characterEntries.find((item) => item.characterId === entry.characterId) || entry;
                return {
                  ...entry,
                  ...nextEntry,
                  highlightText: resolveValidHighlightText(nextEntry.text, nextEntry.highlightText),
                  lastOperation: params.mode === 'retry_round' || params.mode === 'director_instruction'
                    ? 'retried'
                    : 'polished',
                };
              }),
        };
      });
      saveSession({
        ...workingSession,
        generatedContent: nextContent,
        writingStyleCustom: workingSession.writingStyleCustom,
      });
    } catch (rewriteError) {
      console.error('[group-offline] round rewrite failed', rewriteError);
      setError(
        rewriteError instanceof Error
          ? rewriteError.message
          : (
            params.mode === 'retry_round'
              ? '重试本轮失败，请稍后再试。'
              : params.mode === 'director_instruction'
                ? '按指令重写本轮失败，请稍后再试。'
                : '改文风失败，请稍后再试。'
          ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRewindLatestRound = () => {
    if (loading || !currentSession.generatedContent || !latestRound) return;
    const previousRounds = currentSession.generatedContent.rounds || [];
    if (previousRounds.length === 0) return;
    const nextRoundNumber = Math.max(0, currentSession.currentRound - 1);
    const nextSession: GroupOfflineSession = {
      ...currentSession,
      currentRound: nextRoundNumber,
      updatedAt: Date.now(),
    };
    const nextContent = normalizeGeneratedContentForDisplay({
      ...currentSession.generatedContent,
      card: {
        ...currentSession.generatedContent.card,
        roundLabel: buildCurrentRoundLabel(nextSession),
      },
      rounds: previousRounds.slice(0, -1),
    });
    saveSession({
      ...nextSession,
      generatedContent: nextContent,
    });
    setManualSelectionMode(false);
    setQueuedCharacterIds([]);
    setError('');
  };

  const handleApplyCustomStyle = async () => {
    const trimmed = customStyleDraft.trim();
    if (!trimmed) return;
    await handleRoundRewrite({ mode: 'custom_style', customStyleText: trimmed });
    setShowCustomStyleSheet(false);
  };

  const handleApplyDirectorInstruction = async (text: string, mode: GroupOfflineDirectorMode) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (mode === 'rewrite') {
      await handleRoundRewrite({
        mode: 'director_instruction',
        directorInstructionText: trimmed,
      });
      return;
    }

    const draftSession: GroupOfflineSession = {
      ...currentSession,
      directorInstruction: trimmed,
      updatedAt: Date.now(),
    };
    saveSession(draftSession);

    if (mode === 'start') {
      const hasGeneratedIntro = Boolean(draftSession.generatedContent);
      const introSession = hasGeneratedIntro
        ? draftSession
        : await generateContent({
            phase: 'intro',
            baseSession: draftSession,
            directorInstructionOverride: trimmed,
            directorMode: 'start',
          });
      if (!introSession) {
        return;
      }

      const startedSession = await runBlockRound({
        baseSession: introSession,
        dispatchMode: 'recommend',
        directorInstructionOverride: trimmed,
        directorMode: 'start',
      });
      if (!startedSession) {
        return;
      }

      saveSession({
        ...startedSession,
        awaitingDirectorInstruction: false,
        updatedAt: Date.now(),
      });
      return;
    }

    if (!ensureScenarioCanAdvance(draftSession)) {
      return;
    }

    await runBlockRound({
      baseSession: draftSession,
      dispatchMode: 'recommend',
      directorInstructionOverride: trimmed,
      directorMode: 'next_round',
    });
  };

  const handleEnd = async () => {
    if (endingState !== 'idle') return;
    setMenuOpen(false);
    setEndingState('generating');
    try {
      const payload = await generateEndingPayload({
        session: currentSession,
        members: participantMembers,
        activeConfig,
      });
      setEndingPayload(payload);
      setEndingState('ready');
    } catch (endingError) {
      console.error('[group-offline] ending generation failed', endingError);
      setEndingPayload(buildDerivedEndingPayload(currentSession, participantMembers));
      setEndingState('ready');
    }
  };

  const finalizeEnding = () => {
    if (!endingPayload) return;
    const endedAt = Date.now();
    const archivedSession: GroupOfflineSession = {
      ...currentSession,
      status: 'ended',
      endedAt,
      updatedAt: endedAt,
      summaryCard: {
        title: `${currentSession.customActivityType?.trim() || currentSession.activityType}已结束`,
        lines: endingPayload.summaryLines,
      },
      generatedContent: {
        ...currentSession.generatedContent,
        endingVoices: endingPayload.endingVoices,
      } as GroupOfflineGeneratedContent,
    };
    const endMessage = createGroupOfflineEndedMessage({
      session: archivedSession,
      members: participantMembers,
      summaryLines: endingPayload.summaryLines,
    });
    const followupMessages = endingPayload.endingVoices.map((voice, index) => ({
      role: 'model' as const,
      text: voice.text,
      timestamp: endedAt + index + 1,
      senderCharacterId: voice.characterId,
    }));
    onComplete({
      archivedSession,
      endMessage,
      followupMessages,
    });
  };

  const toggleStatusPanel = (key: string) => {
    setExpandedStatusKeys((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? true),
    }));
  };

  const toggleSideSection = (key: string) => {
    setExpandedSideSectionKeys((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? false),
    }));
  };

  const resolveInspectorEntry = (round: GroupOfflineRound) => {
    const selectedCharacterId = selectedInspectorEntryByRoundId[round.id];
    return round.characterEntries.find((entry) => entry.characterId === selectedCharacterId)
      || round.characterEntries[0]
      || null;
  };

  const renderRoundInspector = (round: GroupOfflineRound) => {
    const inspectorEntry = resolveInspectorEntry(round);
    if (!inspectorEntry) return null;

    const inspectorEntries: GroupOfflineInspectorEntryView[] = round.characterEntries.map((entry) => ({
      characterId: entry.characterId,
      speakerLabel: entry.speakerLabel,
      targetLabel: entry.target?.label,
      avatarValue: resolveCharacterAvatarValue(resolveMemberForEntry(entry)),
      statusFields: entry.statusFields.filter((field) => normalizeString(field.value)),
      notebookText: normalizeNotebookText(entry.notebook, entry.speakerLabel),
      aftereffects: normalizeAftereffectsForDisplay(entry.aftereffects),
      memoryPanel: normalizeMemoryPanelForDisplayRich(
        entry.memoryPanel,
        entry.speakerLabel,
        (currentSession.generatedContent?.rounds || []).length,
        currentSession.updatedAt || Date.now(),
        {
          notebookText: normalizeNotebookText(entry.notebook, entry.speakerLabel),
          aftereffects: normalizeAftereffectsForDisplay(entry.aftereffects),
          highlightText: entry.highlightText,
          text: entry.text,
          targetLabel: entry.target?.label,
          rounds: currentSession.generatedContent?.rounds || [],
          characterId: entry.characterId,
          sceneLabel: currentSession.location,
          roundId: round.id,
        },
      ),
    }));

    const inspectorStatusKey = `${round.id}:inspector:status`;
    const notebookKey = `${round.id}:inspector:notebook`;
    const aftereffectsKey = `${round.id}:inspector:aftereffects`;
    const memoryKey = `${round.id}:inspector:memory`;

    return (
      <GroupOfflineRoundInspector
        roundId={round.id}
        entries={inspectorEntries}
        bodyTextStyle={bodyTextStyle}
        selectedCharacterId={inspectorEntry.characterId}
        onSelectCharacterId={(characterId) => setSelectedInspectorEntryByRoundId((previous) => ({
          ...previous,
          [round.id]: characterId,
        }))}
        statusExpanded={expandedStatusKeys[inspectorStatusKey] ?? false}
        notebookExpanded={expandedSideSectionKeys[notebookKey] ?? false}
        aftereffectsExpanded={expandedSideSectionKeys[aftereffectsKey] ?? false}
        memoryExpanded={expandedSideSectionKeys[memoryKey] ?? false}
        onToggleStatus={() => toggleStatusPanel(inspectorStatusKey)}
        onToggleNotebook={() => toggleSideSection(notebookKey)}
        onToggleAftereffects={() => toggleSideSection(aftereffectsKey)}
        onToggleMemory={() => toggleSideSection(memoryKey)}
      />
    );
  };

  return (
    <div className="group-offline-scene">
      <div className="group-offline-scene__background" style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined} />
      <div className="group-offline-scene__blur" />
      <div className="group-offline-scene__overlay" />

      <div ref={shellRef} className="group-offline-scene__shell">
        <div className="group-offline-scene__topbar">
          <div className="group-offline-scene__topbar-left">
            <button type="button" className="group-offline-scene__icon-btn" onClick={onBackToPlanner}>
              <ChevronLeft size={16} />
            </button>
            <div className="group-offline-scene__identity">
              <div className="group-offline-scene__name">{currentSession.customActivityType?.trim() || currentSession.activityType}</div>
              <div className="group-offline-scene__subtitle">
                分块推进
                <span> 路 </span>
                {awaitingDirectorInstruction
                  ? '待指令启动'
                  : (currentSession.generatedContent?.card.roundLabel || '共景')}
              </div>
            </div>
          </div>
          <div className="group-offline-scene__actions">
            <button type="button" className="group-offline-scene__icon-btn" onClick={() => setMenuOpen((previous) => !previous)}>
              <MoreVertical size={16} />
            </button>
            <AnimatePresence initial={false}>
              {menuOpen ? (
                <>
                  <div className="group-offline-scene__menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="group-offline-scene__menu"
                  >
                    <button
                      type="button"
                      className="group-offline-scene__menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        saveSession({ ...currentSession, isSaved: true });
                      }}
                    >
                      <Save size={14} />
                      保存进度
                    </button>
                    <button
                      type="button"
                      className={`group-offline-scene__menu-item ${currentSession.isCollected ? 'group-offline-scene__menu-item--active' : ''}`}
                      onClick={() => {
                        setMenuOpen(false);
                        saveSession({ ...currentSession, isCollected: !currentSession.isCollected });
                      }}
                    >
                      <Star size={14} />
                      {currentSession.isCollected ? '已收藏' : '收藏'}
                    </button>
                    <button
                      type="button"
                      className="group-offline-scene__menu-item group-offline-scene__menu-item--danger"
                      onClick={() => void handleEnd()}
                    >
                      <X size={15} />
                      结束线下
                    </button>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div className="group-offline-scene__participants">
          {currentSession.participants.map((participant) => {
            const member = memberMap.get(participant.characterId);
            if (!member) return null;
            const queueIndex = queuedCharacterIds.indexOf(participant.characterId);
            const isQueued = queueIndex >= 0;
            const selectable = manualSelectionMode;
            return (
              <button
                key={participant.characterId}
                type="button"
                className={`group-offline-scene__participant ${selectable ? 'group-offline-scene__participant--selectable' : ''} ${isQueued ? 'group-offline-scene__participant--queued' : ''}`}
                onClick={() => queueCharacter(participant.characterId)}
              >
                <ResolvedOfflineAvatar
                  value={member.avatar}
                  alt={member.name}
                  containerClassName="group-offline-scene__participant-avatar"
                  fallbackClassName="text-[14px] text-white/84"
                />
                <div className="group-offline-scene__participant-name">{member.name}</div>
                <div className="group-offline-scene__participant-state">
                  {participant.presence === 'arrived'
                    ? '已到'
                    : participant.presence === 'added_midway'
                      ? '中途加入'
                      : participant.presence === 'late'
                        ? '迟到'
                        : participant.presence === 'left'
                          ? '已离场'
                          : participant.presence === 'en_route'
                            ? '路上'
                            : '待定'}
                </div>
                {isQueued ? <div className="group-offline-scene__participant-order">{queueIndex + 1}</div> : null}
              </button>
            );
          })}

          {addableGroupMembers.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowInviteSheet(true)}
              className="group-offline-scene__participant-add"
              aria-label="拉人加入"
            >
              <Plus size={18} />
            </button>
          ) : null}
        </div>

        <GooseDirectorOrb
          containerRef={shellRef}
          mode="blocks"
          loading={loading}
          directorLaunchToken={directorLaunchToken}
          initialDirectorSection={initialDirectorSection}
          currentDirectorInstruction={currentSession.directorInstruction}
          awaitingDirectorInstruction={awaitingDirectorInstruction}
          hasCurrentRound={!!latestRound}
          manualSelectionMode={manualSelectionMode}
          queuedLabels={queuedMembers.map((member) => member.name)}
          recommendedLabels={recommendedCharacterIds.map((characterId) => memberMap.get(characterId)?.name || '角色')}
          highlightColor={currentSession.highlightColor || '#92EBF2'}
          bodyTextColor={currentSession.bodyTextColor || '#FFFFFF'}
          highlightColorOptions={['#92EBF2', '#FFE27A', '#FBB6CE', '#C4B5FD', '#9AE6B4', '#FDBA74']}
          bodyTextColorOptions={['#FFFFFF', '#F8FBFF', '#F6F7FB', '#FFF7ED', '#F3FAFF', '#F6FFF8']}
          stylePresetOptions={GROUP_OFFLINE_STYLE_PRESET_OPTIONS}
          progressPanel={progressPanel}
          dispatchDisabledReason={dispatchDisabledReason}
          onRecommend={() => void runBlockRound({ dispatchMode: 'recommend' })}
          onRandom={() => void runBlockRound({ dispatchMode: 'random' })}
          onToggleManual={() => {
            setManualSelectionMode((previous) => !previous);
            setQueuedCharacterIds([]);
          }}
          onClearManual={() => setQueuedCharacterIds([])}
          onRunManual={() => void runBlockRound({ dispatchMode: 'manual', selectedCharacterIds: queuedCharacterIds })}
          onApplyStylePreset={(presetId) => {
            if (!latestRound) {
              saveSession({
                ...currentSession,
                writingStyleCustom: buildGroupOfflineStylePresetInstruction(presetId),
                updatedAt: Date.now(),
              });
              return;
            }
            void handleRoundRewrite({ mode: 'style_preset', stylePresetId: presetId });
          }}
          onOpenCustomStyle={() => {
            setCustomStyleDraft(currentSession.writingStyleCustom || '');
            setShowCustomStyleSheet(true);
          }}
          onApplyDirectorInstruction={(text: string, mode: GooseDirectorInstructionMode) => (
            void handleApplyDirectorInstruction(text, mode)
          )}
          onRetryRound={latestRound ? () => void handleRoundRewrite({ mode: 'retry_round' }) : undefined}
          onRewindRound={latestRound ? handleRewindLatestRound : undefined}
          onHighlightColorChange={(color: string) => {
            saveSession({
              ...currentSession,
              highlightColor: color,
              updatedAt: Date.now(),
            });
          }}
          onBodyTextColorChange={(color: string) => {
            saveSession({
              ...currentSession,
              bodyTextColor: color,
              updatedAt: Date.now(),
            });
          }}
        />

        <div ref={bodyRef} className="group-offline-scene__body">
          <section className="group-offline-scene__hero">
            {currentSession.mode === 'scenario' && currentSession.scenarioState ? (
              <div className="group-offline-scene__meta-card">
                <div className="group-offline-scene__briefing" style={bodyTextStyle}>
                  <div>
                    <div className="group-offline-scene__briefing-kicker">设定局简报</div>
                    <div className="group-offline-scene__briefing-title">{currentSession.customActivityType?.trim() || currentSession.activityType}</div>
                    <div className="group-offline-scene__briefing-subtitle">
                      这不是普通碰面，而是已经压到眼前的临时副本。每一步都得拿出结果。
                    </div>
                  </div>

                  <div className="group-offline-scene__briefing-meta">
                    <div className="group-offline-scene__briefing-meta-line">
                      <span><span className="group-offline-scene__briefing-meta-label">时间</span> {currentSession.generatedContent?.card.timeLabel || currentSession.timeLabel}</span>
                      <span>·</span>
                      <span><span className="group-offline-scene__briefing-meta-label">地点</span> {currentSession.generatedContent?.card.locationLabel || currentSession.location}</span>
                      <span>·</span>
                      <span><span className="group-offline-scene__briefing-meta-label">轮次</span> {scenarioCardFields.roundLabel || buildCurrentRoundLabel(currentSession)}</span>
                    </div>
                    <div className="group-offline-scene__briefing-meta-line">
                      <span><span className="group-offline-scene__briefing-meta-label">状态</span> {getGroupOfflineScenarioStatusLabel(currentSession.scenarioState.status)}</span>
                      <span>·</span>
                      <span><span className="group-offline-scene__briefing-meta-label">同场</span> {[`你（${userName}）`, ...(currentSession.generatedContent?.card.participantLabels || participantMembers.map((member) => member.name))].join('、')}</span>
                    </div>
                  </div>

                  {currentSession.scenarioState.storySourceLabel ? (
                    <div className="group-offline-scene__briefing-section">
                      <div className="group-offline-scene__briefing-section-label">来源</div>
                      <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.storySourceLabel}</div>
                    </div>
                  ) : null}

                  {(currentSession.scenarioState.backgroundLabel || currentSession.scenePrompt?.trim()) ? (
                    <div className="group-offline-scene__briefing-section">
                      <div className="group-offline-scene__briefing-section-label">现场背景</div>
                      <div className="group-offline-scene__briefing-copy group-offline-scene__briefing-copy--hero">
                        {currentSession.scenarioState.backgroundLabel || currentSession.scenePrompt?.trim()}
                      </div>
                    </div>
                  ) : null}

                  {currentSession.scenarioState.userInvolvementLabel ? (
                    <div className="group-offline-scene__briefing-section">
                      <div className="group-offline-scene__briefing-section-label">你的切入口</div>
                      <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.userInvolvementLabel}</div>
                    </div>
                  ) : null}

                  {(
                    currentSession.scenarioState.missionObjectLabel
                    || currentSession.scenarioState.identityPairLabel
                    || currentSession.scenarioState.rescueTargetLabel
                    || currentSession.scenarioState.handoffPointLabel
                    || currentSession.scenarioState.exitMethodLabel
                  ) ? (
                    <div className="group-offline-scene__briefing-section">
                      <div className="group-offline-scene__briefing-section-label">局内锚点</div>
                      <div className="group-offline-scene__briefing-rules">
                        {currentSession.scenarioState.missionObjectLabel ? (
                          <div className="group-offline-scene__briefing-rule">
                            <div className="group-offline-scene__briefing-rule-label">目标物</div>
                            <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.missionObjectLabel}</div>
                          </div>
                        ) : null}
                        {currentSession.scenarioState.identityPairLabel ? (
                          <div className="group-offline-scene__briefing-rule">
                            <div className="group-offline-scene__briefing-rule-label">错位身份</div>
                            <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.identityPairLabel}</div>
                          </div>
                        ) : null}
                        {currentSession.scenarioState.rescueTargetLabel ? (
                          <div className="group-offline-scene__briefing-rule">
                            <div className="group-offline-scene__briefing-rule-label">营救对象</div>
                            <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.rescueTargetLabel}</div>
                          </div>
                        ) : null}
                        {currentSession.scenarioState.handoffPointLabel ? (
                          <div className="group-offline-scene__briefing-rule">
                            <div className="group-offline-scene__briefing-rule-label">交接点</div>
                            <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.handoffPointLabel}</div>
                          </div>
                        ) : null}
                        {currentSession.scenarioState.exitMethodLabel ? (
                          <div className="group-offline-scene__briefing-rule">
                            <div className="group-offline-scene__briefing-rule-label">出口</div>
                            <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.exitMethodLabel}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="group-offline-scene__briefing-section group-offline-scene__briefing-section--task">
                    <div className="group-offline-scene__briefing-section-label">当前任务</div>
                    <div className="group-offline-scene__briefing-copy group-offline-scene__briefing-copy--hero group-offline-scene__briefing-copy--task">
                      {currentSession.scenarioState.currentTask}
                    </div>
                  </div>

                  <div className="group-offline-scene__briefing-section group-offline-scene__briefing-section--warning">
                    <div className="group-offline-scene__briefing-section-label">天气 / 世界状态</div>
                    <div className="group-offline-scene__briefing-copy">{currentSession.generatedContent?.card.weatherLabel || currentSession.weatherLabel}</div>
                  </div>

                  <div className="group-offline-scene__briefing-section">
                    <div className="group-offline-scene__briefing-rules">
                      <div className="group-offline-scene__briefing-rule">
                        <div className="group-offline-scene__briefing-rule-label">成功条件</div>
                        <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.successCondition}</div>
                      </div>
                      <div className="group-offline-scene__briefing-rule">
                        <div className="group-offline-scene__briefing-rule-label">失败条件</div>
                        <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.failureCondition}</div>
                      </div>
                    </div>
                  </div>

                  <div className="group-offline-scene__briefing-section group-offline-scene__briefing-section--danger">
                    <div className="group-offline-scene__briefing-section-label">当前推进</div>
                    <div className="group-offline-scene__briefing-copy">{currentSession.scenarioState.progressSummary}</div>
                  </div>

                  {currentSession.scenarioState.taskSteps.length > 0 ? (
                    <div className="group-offline-scene__briefing-section">
                      <div className="group-offline-scene__briefing-section-label">任务步骤</div>
                      <div className="group-offline-scene__briefing-step-list">
                        {currentSession.scenarioState.taskSteps.map((step) => (
                          <div key={step.slot} className="group-offline-scene__briefing-step">
                            <div className={`group-offline-scene__briefing-step-dot group-offline-scene__briefing-step-dot--${step.status}`} />
                            <div className="group-offline-scene__briefing-step-copy">
                              <div className="group-offline-scene__briefing-step-title">{step.slot}. {step.label}</div>
                              {step.note ? <div className="group-offline-scene__briefing-step-note">{step.note}</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="group-offline-scene__meta-card">
                <div className="group-offline-scene__meta" style={bodyTextStyle}>
                  <div className="group-offline-scene__meta-row"><span className="group-offline-scene__meta-label">时间</span><span>{currentSession.generatedContent?.card.timeLabel || currentSession.timeLabel}</span></div>
                  <div className="group-offline-scene__meta-row"><span className="group-offline-scene__meta-label">地点</span><span>{currentSession.generatedContent?.card.locationLabel || currentSession.location}</span></div>
                  {(currentSession.scenarioState?.backgroundLabel || currentSession.scenePrompt?.trim()) ? (
                    <div className="group-offline-scene__meta-row">
                      <span className="group-offline-scene__meta-label">{currentSession.mode === 'scenario' ? '背景' : '情景'}</span>
                      <span>{currentSession.scenarioState?.backgroundLabel || currentSession.scenePrompt?.trim()}</span>
                    </div>
                  ) : null}
                  <div className="group-offline-scene__meta-row"><span className="group-offline-scene__meta-label">天气</span><span>{currentSession.generatedContent?.card.weatherLabel || currentSession.weatherLabel}</span></div>
                  <div className="group-offline-scene__meta-row"><span className="group-offline-scene__meta-label">在场</span><span>{(currentSession.generatedContent?.card.participantLabels || participantMembers.map((member) => member.name)).join('、')}</span></div>
                  {currentSession.generatedContent?.card.objectiveLabel ? (
                    <div className="group-offline-scene__meta-row">
                      <span className="group-offline-scene__meta-label">目标</span>
                      <span>{currentSession.generatedContent.card.objectiveLabel}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {sceneSongBoardItem ? <GroupOfflineSongBoard item={sceneSongBoardItem} /> : null}
          </section>

          {currentSession.generatedContent?.intro ? (
            <div className="group-offline-scene__intro" style={bodyTextStyle}>
              {splitNarrativeParagraphs(currentSession.generatedContent.intro).map((paragraph, index) => (
                <p key={`intro-${index}`} className="group-offline-scene__entry-paragraph">{paragraph}</p>
              ))}
            </div>
          ) : null}

          {(currentSession.generatedContent?.rounds || []).length === 0 ? (
            <div className="group-offline-scene__empty-state">
              {awaitingDirectorInstruction
                ? (
                  currentSession.generatedContent?.intro
                    ? '导演指令已经挂上了。再点一次“开始这场”，就会按这条要求把第一轮落下来。'
                    : '这次是从特殊指令入口进来的。先在大鹅导演里写清要求，再点击“开始这场”。'
                )
                : currentSession.mode === 'scenario'
                  ? '共景已经铺开。下一轮开始要围绕当前任务推进，别把轮次花在空转上。'
                  : '共景已经铺开。下一轮你可以直接让系统推荐、随机出场，或者点顶部头像自己排顺序。'}
            </div>
          ) : null}

          <div className="group-offline-scene__rounds">
            {(currentSession.generatedContent?.rounds || []).map((round, roundIndex) => (
              <section key={round.id} className="group-offline-scene__round">
                <>
                {(() => {
                  const pageEpisode = isGroupOfflineHtmlPageEpisode(round.pageEpisode) ? round.pageEpisode : undefined;
                  const isPageEpisodeRound = round.mode === 'page_episode' && !!pageEpisode;
                  const pageEpisodeSrcDoc = buildGroupOfflinePageEpisodeSrcDoc(pageEpisode);
                  const pageEpisodeSandbox = resolveGroupOfflinePageEpisodeSandbox(pageEpisode);

                  return (
                    <>
                {round.userMessageText ? (
                  <div className="group-offline-scene__user-bubble-wrap">
                    <div className="group-offline-scene__user-bubble">{round.userMessageText}</div>
                  </div>
                ) : null}

                <div className="group-offline-scene__round-head">
                  <div>
                    <div className="group-offline-scene__round-title">
                      {pageEpisode?.title || round.title || `第 ${roundIndex + 1} 轮`}
                    </div>
                    <div className="group-offline-scene__round-mode">
                      {isPageEpisodeRound
                        ? (pageEpisode?.pageType === 'micro_app' ? '互动页面轮' : 'HTML页面轮')
                        : (
                          <>
                            分块推进
                            <span> 路 </span>
                            {dispatchLabel(round.dispatchMode)}
                          </>
                        )}
                    </div>
                  </div>
                  {round.selectedCharacterIds?.length ? (
                    <div className="group-offline-scene__round-queue">
                      {round.selectedCharacterIds.map((characterId, index) => (
                        <span key={`${round.id}:${characterId}`} className="group-offline-scene__chip">
                          {index + 1}. {memberMap.get(characterId)?.name || '角色'}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {isPageEpisodeRound ? (
                  <div className="group-offline-scene__page-episode">
                    {pageEpisodeSrcDoc ? (
                      <iframe
                        title={pageEpisode?.title || round.title || `第 ${roundIndex + 1} 轮页面`}
                        className="group-offline-scene__page-frame"
                        srcDoc={pageEpisodeSrcDoc}
                        sandbox={pageEpisodeSandbox}
                      />
                    ) : null}
                    {pageEpisode?.caption ? (
                      <div className="group-offline-scene__page-caption">{pageEpisode.caption}</div>
                    ) : null}
                  </div>
                ) : null}

                {round.sceneText ? (
                  <div className="group-offline-scene__round-scene" style={bodyTextStyle}>
                    {isPageEpisodeRound ? (
                      <div className="group-offline-scene__page-story-title">剧情摘要</div>
                    ) : null}
                    {splitNarrativeParagraphs(round.sceneText).map((paragraph, index) => (
                      <p key={`${round.id}-scene-${index}`} className="group-offline-scene__entry-paragraph">{paragraph}</p>
                    ))}
                  </div>
                ) : null}

                {!isPageEpisodeRound ? round.characterEntries.map((entry) => {
                  const member = resolveMemberForEntry(entry);
                  const statusKey = `${round.id}:${entry.characterId}`;
                  const isEditing = editingEntryKey === statusKey;
                  const actionLoading = entryActionKey?.endsWith(statusKey);
                  const displayBlocks = splitBodyAndHighlight(entry.text, entry.highlightText);

                  return (
                    <GroupOfflineRoundEntry
                      key={statusKey}
                      entry={entry}
                      avatarValue={resolveCharacterAvatarValue(member)}
                      statusKey={statusKey}
                      isEditing={isEditing}
                      actionLoading={actionLoading}
                      displayBlocks={displayBlocks}
                      highlightStyle={highlightStyle}
                      bodyTextStyle={bodyTextStyle}
                      editingDraft={editingDraft}
                      loading={loading}
                      entryActionKey={entryActionKey}
                      onStartEdit={() => {
                        setEditingEntryKey(statusKey);
                        setEditingDraft(entry.text);
                      }}
                      onRetry={() => void handleEntryAction('retry', round, entry)}
                      onPolish={() => void handleEntryAction('polish', round, entry)}
                      onCancelEdit={() => {
                        setEditingEntryKey(null);
                        setEditingDraft('');
                      }}
                      onSaveEdit={() => handleSaveEntryEdit(round.id, entry.characterId)}
                      onEditingDraftChange={setEditingDraft}
                      renderParagraph={(text, paragraphIndex) => (
                        <p key={`${statusKey}-paragraph-${paragraphIndex}`} className="group-offline-scene__entry-paragraph">
                          {splitDialogueSegments(text).map((segment, segmentIndex) => (
                            segment.type === 'dialogue' ? (
                              <span
                                key={`${statusKey}-dialogue-${paragraphIndex}-${segmentIndex}`}
                                className="group-offline-scene__entry-dialogue-inline"
                                style={highlightStyle}
                              >
                                {segment.text}
                              </span>
                            ) : (
                              <React.Fragment key={`${statusKey}-body-${paragraphIndex}-${segmentIndex}`}>
                                {segment.text}
                              </React.Fragment>
                            )
                          ))}
                        </p>
                      )}
                    />
                  );
                }) : null}
                {!isPageEpisodeRound ? renderRoundInspector(round) : null}
                    </>
                  );
                })()}
                    </>
              </section>
            ))}
          </div>

          {pendingUserMessages.length > 0 ? (
            <div className="group-offline-scene__pending-messages">
              {pendingUserMessages.map((message) => (
                <div key={message.id} className="group-offline-scene__user-bubble-wrap">
                  <div className="group-offline-scene__user-bubble">
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <div className="group-offline-scene__error">{error}</div> : null}
        </div>

        <div className="group-offline-scene__composer-wrap">
          <div className="group-offline-scene__composer">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={loading
                ? '这一轮正在推进…'
                : awaitingDirectorInstruction
                  ? '先在大鹅导演里写特殊指令，再点击“开始这场”…'
                : scenarioLockReason
                  ? scenarioLockReason
                  : '输入你要接的话，默认会按本轮调度继续…'}
              className="group-offline-scene__input"
              disabled={loading || awaitingDirectorInstruction || !!scenarioLockReason}
            />
            <button
              type="button"
              className="group-offline-scene__send"
              onClick={() => void handleSend()}
              disabled={loading || awaitingDirectorInstruction || !input.trim() || !!scenarioLockReason}
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        <GroupOfflineSceneOverlays
          showInviteSheet={showInviteSheet}
          addableGroupMembers={addableGroupMembers}
          onCloseInviteSheet={() => setShowInviteSheet(false)}
          onInviteCharacter={handleInviteCharacter}
          showCustomStyleSheet={showCustomStyleSheet}
          customStyleDraft={customStyleDraft}
          loading={loading}
          onCloseCustomStyleSheet={() => setShowCustomStyleSheet(false)}
          onCustomStyleDraftChange={setCustomStyleDraft}
          onApplyCustomStyle={handleApplyCustomStyle}
          endingState={endingState}
          endingPayload={endingPayload}
          endingTitle={currentSession.customActivityType?.trim() || currentSession.activityType}
          endingAccentColor={currentSession.highlightColor}
          onFinalizeEnding={finalizeEnding}
        />
      </div>
    </div>
  );
}
