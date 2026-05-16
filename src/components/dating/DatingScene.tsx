import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, MoreVertical, Pencil, RefreshCw, Save, Send, Smile, Star, Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ApiConfig,
  Character,
  ChatMessage,
  DateMessage,
  DatingPageEpisode,
  DatingPageEpisodeChatMessage,
  DatingPageEpisodeFeedItem,
  DateRelationshipStageOverride,
  DateSession,
  DatingGeneratedContent,
  Mask,
  PerceptionSettings,
  UserProfileExtended,
  WorldBookEntry,
} from '../../types';
import { DatingGooseDirectorOrb } from './DatingGooseDirectorOrb';
import { generateTextFromMessagesWithConfig } from '../../services/ai/runtimeClient';
import { buildDatingPrompt } from '../../services/ai/prompts/builders/buildDatingPrompt';
import { dispatchDatingBackgroundCompleted } from '../../services/dating/datingBackgroundEvents';
import { buildDatingSceneInput } from '../../services/scene-inputs/buildDatingSceneInput';
import {
  compileSpecialDirective,
  extractSpecialDirectiveCommand,
} from '../../services/special-directives/compileSpecialDirective';
import { buildTemporalContextPrompt } from '../../services/relationship-time/buildTemporalContextPrompt';
import {
  buildGroupOfflineStylePresetInstruction,
  GROUP_OFFLINE_STYLE_PRESET_OPTIONS,
  type GroupOfflineStylePresetId,
} from '../../services/ai/prompts/builders/groupOfflineStylePresets';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import {
  createDateMessageId,
  createSceneMessage,
  getLatestGeneratedContent,
  normalizeDateSessionMessages,
  resolveDateSessionBackground,
} from './sessionUtils';
import {
  ensureSocialFeedComments,
  splitFeedBodyIntoItems,
} from '../../services/dating/pageEpisodeFeed';
import {
  buildCustomPageEpisodeSrcDoc,
  normalizePageEpisodeHtmlDocument,
} from '../../services/dating/pageEpisodeHtml';
import { resolveDatingGeneratedMemoryWritebackPolicy } from '../../services/dating/datingWritebackPolicy';
import type { DatingDirectorSection } from './DatingGooseDirectorOrb';
import './DatingScene.css';

type DatingSceneProps = {
  session: DateSession;
  startToken: number;
  directorLaunchToken?: number;
  initialDirectorSection?: DatingDirectorSection;
  character: Character;
  userProfile: UserProfileExtended;
  activeConfig: ApiConfig;
  chatHistory: ChatMessage[];
  activeMask?: Mask | null;
  worldBooks?: WorldBookEntry[];
  perception?: PerceptionSettings;
  onBackToPlanner: () => void;
  onClose: () => void;
  onSaveDate: (session: DateSession) => void;
  onCollectDate: (session: DateSession) => void;
  onEndDateComplete: (payload: { archivedSession: DateSession; returnChatText: string }) => Promise<void> | void;
  autoSaveEnabled?: boolean;
};

type SceneSessionState = DateSession & {
  isCollected?: boolean;
  isSaved?: boolean;
  pendingRoundRetry?: {
    mode: 'start' | 'continue';
    session: DateSession;
  } | null;
  pendingRoundError?: string;
};
type EndingSequencePayload = {
  monologue: string;
  chatFollowup: string;
};

type EndingParticle = {
  x: number;
  y: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  delay: number;
  wiggle: number;
};

const DATING_STICKERS = ['🥺', '😤', '😭', '😳', '😎', '❤️', '(贴贴)', '(抱抱)', '(委屈)', '(不理你了)'];
const DEFAULT_DATING_ACCENT = '#92EBF2';
const DEFAULT_DATING_BODY_TEXT = '#FAFBFF';
const DATING_PROMPT_HARD_LIMIT = 45000;

const createEmptyGeneratedContent = (session: DateSession, character: Character): DatingGeneratedContent => ({
  mode: 'scene',
  background: {
    source: session.backgroundSource || 'character-avatar',
    image: session.backgroundImage || character.avatar,
    atmosphere: '',
    focus: '',
  },
  narrative: {
    title: '',
    subtitle: '',
    segments: [],
  },
  status: {
    location: session.location || '',
    time: '',
    mood: session.mood || '',
    innerThought: '',
  },
  playlist: [],
  pageEpisode: undefined,
});

function normalizeHexColor(value: string | null | undefined): string {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#([0-9a-fA-F]{6})$/.test(normalized) ? normalized.toUpperCase() : '';
}

function hexToRgb(value: string): [number, number, number] | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function resolveDatingAccentColor(session: DateSession, character: Character): string {
  const characterAccent = normalizeHexColor(character.bubbleColor) || DEFAULT_DATING_ACCENT;
  return session.accentColorMode === 'character'
    ? characterAccent
    : normalizeHexColor(session.accentColor) || characterAccent;
}

function resolveDatingHighlightTextColor(session: DateSession, accentColor: string): string {
  return normalizeHexColor(session.highlightTextColor) || accentColor;
}

function buildDatingAccentVars(session: DateSession, character: Character): React.CSSProperties {
  const accent = resolveDatingAccentColor(session, character);
  const rgb = hexToRgb(accent) || [146, 235, 242];
  const highlight = resolveDatingHighlightTextColor(session, accent);
  const highlightRgb = hexToRgb(highlight) || rgb;
  const bodyText = normalizeHexColor(session.bodyTextColor) || DEFAULT_DATING_BODY_TEXT;
  const bodyRgb = hexToRgb(bodyText) || [250, 251, 255];

  return {
    '--dating-accent': accent,
    '--dating-accent-soft': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.16)`,
    '--dating-accent-strong': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`,
    '--dating-accent-glow': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.45)`,
    '--dating-accent-muted': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.35)`,
    '--dating-highlight-text': highlight,
    '--dating-highlight-glow': `rgba(${highlightRgb[0]}, ${highlightRgb[1]}, ${highlightRgb[2]}, 0.45)`,
    '--dating-body-text': bodyText,
    '--dating-body-text-soft': `rgba(${bodyRgb[0]}, ${bodyRgb[1]}, ${bodyRgb[2]}, 0.9)`,
    '--dating-body-text-muted': `rgba(${bodyRgb[0]}, ${bodyRgb[1]}, ${bodyRgb[2]}, 0.74)`,
  } as React.CSSProperties;
}

function parseCssPx(value: string | null | undefined): number {
  if (!value || value === 'normal') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCanvasFont(style: CSSStyleDeclaration): string {
  const fontStyle = style.fontStyle || 'normal';
  const fontVariant = style.fontVariant || 'normal';
  const fontWeight = style.fontWeight || '400';
  const fontSize = style.fontSize || '16px';
  const fontFamily = style.fontFamily || 'sans-serif';
  return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize} ${fontFamily}`;
}

function drawTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
) {
  if (!text) return;
  if (!letterSpacing) {
    ctx.fillText(text, x, y);
    return;
  }

  let cursor = x;
  const chars = Array.from(text);
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    const width = ctx.measureText(char).width;
    cursor += width + (index < chars.length - 1 ? letterSpacing : 0);
  });
}

function drawElementTextToCanvas(
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  containerRect: DOMRect,
) {
  const text = element.textContent?.trim();
  if (!text) return;

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  ctx.save();
  ctx.font = buildCanvasFont(style);
  ctx.fillStyle = style.color || '#ffffff';
  ctx.textBaseline = 'top';
  drawTextWithLetterSpacing(
    ctx,
    text,
    rect.left - containerRect.left,
    rect.top - containerRect.top,
    parseCssPx(style.letterSpacing),
  );
  ctx.restore();
}

function formatEndingCharacterName(name: string): string {
  const normalized = name.trim();
  return normalized ? Array.from(normalized).join(' ') : '';
}

function splitEndingMonologue(text: string): string[] {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split('\n')
    .flatMap((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return [];
      const matches = trimmed.match(/[^。！？!?…]+(?:[。！？!?…]+|$)/g);
      return (matches || [trimmed]).map((segment) => segment.trim()).filter(Boolean);
    })
    .slice(0, 4);

  return lines.length > 0 ? lines : [normalized];
}

function splitEditedSceneText(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n{2,}|\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function findLatestSceneMessage(messages: DateMessage[]): { index: number; message: DateMessage } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'model' && message.kind === 'scene') {
      return { index, message };
    }
  }

  return null;
}

function extractCandidateJsonObjects(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    pushCandidate(trimmed);
  }

  const fencedBlocks = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const block of fencedBlocks) {
    pushCandidate(block[1]);
  }

  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== '{') {
      continue;
    }

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let i = start; i < trimmed.length; i += 1) {
      const char = trimmed[i];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }

        if (char === '\\') {
          isEscaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        depth += 1;
        continue;
      }

      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          pushCandidate(trimmed.slice(start, i + 1));
          break;
        }
      }
    }
  }

  pushCandidate(trimmed);
  return candidates;
}

function buildRawPreview(text: string, maxLength = 240): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function getSafeTextLength(value: string | null | undefined): number {
  return typeof value === 'string' ? value.length : 0;
}

function normalizeStructuredText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStructuredTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeStructuredText(item))
    .filter(Boolean)
    .slice(0, 8);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizePageEpisodeMessages(value: unknown): DatingPageEpisodeChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const payload = item as Record<string, unknown>;
      const sender = payload.sender === 'user' || payload.sender === 'character' || payload.sender === 'system'
        ? payload.sender
        : 'system';
      const kind = payload.kind === 'timestamp' || payload.kind === 'system' || payload.kind === 'transfer'
        ? payload.kind
        : 'text';
      const text = normalizeStructuredText(payload.text);
      const timestampLabel = normalizeStructuredText(payload.timestampLabel);
      const amountLabel = normalizeStructuredText(payload.amountLabel);
      const note = normalizeStructuredText(payload.note);

      if (kind === 'timestamp' && !timestampLabel && !text) {
        return null;
      }

      if (kind !== 'timestamp' && !text && !amountLabel && !note) {
        return null;
      }

      return {
        id: normalizeStructuredText(payload.id) || `page-message-${index + 1}`,
        sender,
        kind,
        text,
        timestampLabel,
        amountLabel,
        note,
      } satisfies DatingPageEpisodeChatMessage;
    })
    .filter(Boolean) as DatingPageEpisodeChatMessage[])
    .slice(0, 180);
}

function normalizePageEpisodeStatusBar(value: unknown): DatingPageEpisode['statusBar'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const mode = payload.mode === 'hidden' || payload.mode === 'custom' ? payload.mode : 'auto';
  const batteryValue = typeof payload.battery === 'number'
    ? payload.battery
    : typeof payload.battery === 'string'
      ? Number.parseInt(payload.battery, 10)
      : Number.NaN;

  return {
    mode,
    time: normalizeStructuredText(payload.time) || undefined,
    carrier: normalizeStructuredText(payload.carrier) || undefined,
    network: normalizeStructuredText(payload.network) || undefined,
    battery: Number.isFinite(batteryValue) ? clampNumber(Math.round(batteryValue), 0, 100) : undefined,
  };
}

function normalizePageEpisodeFeedComments(value: unknown): DatingPageEpisodeFeedItem['comments'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const payload = item as Record<string, unknown>;
      const text = normalizeStructuredText(payload.text);
      const authorName = normalizeStructuredText(payload.authorName);
      if (!text || !authorName) {
        return null;
      }

      return {
        id: normalizeStructuredText(payload.id) || `page-comment-${index + 1}`,
        authorName,
        authorRole: payload.authorRole === 'character' || payload.authorRole === 'user' ? payload.authorRole : 'other',
        text,
        badge: normalizeStructuredText(payload.badge) || undefined,
      } satisfies DatingPageEpisodeFeedItem['comments'][number];
    })
    .filter(Boolean) as DatingPageEpisodeFeedItem['comments'];
}

function normalizePageEpisodeFeedItem(
  value: unknown,
  character: Character,
  fallbackId?: string,
): DatingPageEpisodeFeedItem | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const body = normalizeStructuredText(payload.body);
  if (!body) {
    return undefined;
  }

  return {
    id: normalizeStructuredText(payload.id) || fallbackId || undefined,
    authorName: normalizeStructuredText(payload.authorName) || character.remarkName?.trim() || character.name,
    authorBadge: normalizeStructuredText(payload.authorBadge) || undefined,
    handle: normalizeStructuredText(payload.handle) || undefined,
    bio: normalizeStructuredText(payload.bio) || undefined,
    headline: normalizeStructuredText(payload.headline) || undefined,
    sourceLabel: normalizeStructuredText(payload.sourceLabel) || undefined,
    timestampLabel: normalizeStructuredText(payload.timestampLabel) || undefined,
    locationLabel: normalizeStructuredText(payload.locationLabel) || undefined,
    topics: normalizeStructuredTextList(payload.topics),
    body,
    followerCountLabel: normalizeStructuredText(payload.followerCountLabel) || undefined,
    followingCountLabel: normalizeStructuredText(payload.followingCountLabel) || undefined,
    postCountLabel: normalizeStructuredText(payload.postCountLabel) || undefined,
    likeCountLabel: normalizeStructuredText(payload.likeCountLabel) || undefined,
    commentCountLabel: normalizeStructuredText(payload.commentCountLabel) || undefined,
    repostCountLabel: normalizeStructuredText(payload.repostCountLabel) || undefined,
    comments: normalizePageEpisodeFeedComments(payload.comments),
  };
}

function normalizePageEpisodeFeedItems(value: unknown, character: Character): DatingPageEpisodeFeedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => normalizePageEpisodeFeedItem(item, character, `page-feed-item-${index + 1}`))
    .filter(Boolean) as DatingPageEpisodeFeedItem[];
}

function normalizePageEpisodeFeed(value: unknown, character: Character): DatingPageEpisode['feed'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const items = normalizePageEpisodeFeedItems(payload.items, character);
  const primaryItem = normalizePageEpisodeFeedItem(payload, character);
  const resolvedPrimaryItem = primaryItem || items[0];
  if (!resolvedPrimaryItem) {
    return undefined;
  }

  const fallbackSplitItems = items.length === 0
    ? splitFeedBodyIntoItems(resolvedPrimaryItem.body).map((body, index, array) => ({
      ...resolvedPrimaryItem,
      id: `${resolvedPrimaryItem.id || 'page-feed-item'}-${index + 1}`,
      body,
      comments: index === array.length - 1 ? resolvedPrimaryItem.comments : [],
      likeCountLabel: index === array.length - 1 ? resolvedPrimaryItem.likeCountLabel : undefined,
      commentCountLabel: index === array.length - 1 ? resolvedPrimaryItem.commentCountLabel : undefined,
      repostCountLabel: index === array.length - 1 ? resolvedPrimaryItem.repostCountLabel : undefined,
    }))
    : [];
  const resolvedItems = items.length > 0 ? items : fallbackSplitItems;

  return {
    ...resolvedPrimaryItem,
    items: resolvedItems.length > 0 ? resolvedItems : undefined,
  };
}

function applyFeedPlatformDefaults(
  feed: DatingPageEpisode['feed'] | undefined,
  platform: DatingPageEpisode['platform'],
  instructionText?: string,
): DatingPageEpisode['feed'] | undefined {
  if (!feed) {
    return undefined;
  }

  const items = resolvePageEpisodeFeedItems(feed)
    .map((item) => ensureSocialFeedComments(item, platform, instructionText));
  const firstItem = items[0];
  if (!firstItem) {
    return undefined;
  }

  return {
    ...firstItem,
    items,
  };
}

function normalizePageEpisodeDocumentSections(value: unknown): NonNullable<DatingPageEpisode['document']>['sections'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const payload = item as Record<string, unknown>;
      const body = normalizeStructuredText(payload.body);
      if (!body) {
        return null;
      }

      return {
        heading: normalizeStructuredText(payload.heading) || undefined,
        body,
      } satisfies NonNullable<DatingPageEpisode['document']>['sections'][number];
    })
    .filter(Boolean) as NonNullable<DatingPageEpisode['document']>['sections'];
}

function normalizePageEpisodeDocument(value: unknown, fallbackTitle: string): DatingPageEpisode['document'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const sections = normalizePageEpisodeDocumentSections(payload.sections);
  const intro = normalizeStructuredText(payload.intro);
  if (sections.length === 0 && !intro) {
    return undefined;
  }

  return {
    title: normalizeStructuredText(payload.title) || fallbackTitle,
    subtitle: normalizeStructuredText(payload.subtitle) || undefined,
    intro: intro || undefined,
    sections,
    primaryActionLabel: normalizeStructuredText(payload.primaryActionLabel) || undefined,
    secondaryActionLabel: normalizeStructuredText(payload.secondaryActionLabel) || undefined,
  };
}

function normalizePageEpisode(
  value: unknown,
  fallbackTitle: string,
  character: Character,
  fallbackPlatform?: DatingPageEpisode['platform'],
  fallbackPageType?: DatingPageEpisode['pageType'],
  instructionText?: string,
): DatingPageEpisode | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const rawPageType = payload.pageType === 'wechat_chat'
    || payload.pageType === 'feed_post'
    || payload.pageType === 'document_page'
    || payload.pageType === 'micro_app'
    || payload.pageType === 'custom_html'
    ? payload.pageType
    : null;
  const pageType = fallbackPageType || rawPageType;
  if (!pageType) {
    return undefined;
  }

  const chatPayload = payload.chat && typeof payload.chat === 'object'
    ? payload.chat as Record<string, unknown>
    : {};
  const canonMode = payload.canonMode === 'mainline' ? 'mainline' : payload.canonMode === 'side_story' ? 'side_story' : undefined;
  const platform = payload.platform === 'wechat'
    || payload.platform === 'moments'
    || payload.platform === 'weibo'
    || payload.platform === 'xiaohongshu'
    || payload.platform === 'netease'
    || payload.platform === 'survey'
    || payload.platform === 'campus'
    || payload.platform === 'generic'
    ? payload.platform
    : fallbackPlatform;

  return {
    pageType,
    platform,
    title: normalizeStructuredText(payload.title) || fallbackTitle,
    subtitle: normalizeStructuredText(payload.subtitle) || undefined,
    caption: normalizeStructuredText(payload.caption) || undefined,
    canonMode,
    statusBar: normalizePageEpisodeStatusBar(payload.statusBar),
    htmlDocument: normalizePageEpisodeHtmlDocument(payload.htmlDocument) || undefined,
    chat: pageType === 'wechat_chat'
      ? {
          headerTitle: normalizeStructuredText(chatPayload.headerTitle) || character.remarkName?.trim() || character.name,
          headerSubtitle: normalizeStructuredText(chatPayload.headerSubtitle) || undefined,
          inputPlaceholder: normalizeStructuredText(chatPayload.inputPlaceholder) || undefined,
          messages: normalizePageEpisodeMessages(chatPayload.messages),
        }
      : undefined,
    feed: pageType === 'feed_post'
      ? applyFeedPlatformDefaults(normalizePageEpisodeFeed(payload.feed, character), platform, instructionText)
      : undefined,
    document: pageType === 'document_page'
      ? normalizePageEpisodeDocument(payload.document, fallbackTitle)
      : undefined,
  };
}

function buildAutoStatusBarTime(): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

function escapePageHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPageAvatarMarkup(src: string, label: string): string {
  const fallback = escapePageHtml((label || '?').trim().slice(0, 1).toUpperCase() || '?');
  if (!src) {
    return `<div class="wx-avatar wx-avatar--fallback">${fallback}</div>`;
  }

  return `<img class="wx-avatar" src="${escapePageHtml(src)}" alt="${escapePageHtml(label)}" />`;
}

function resolvePageEpisodeFeedItems(feed: DatingPageEpisode['feed'] | undefined): DatingPageEpisodeFeedItem[] {
  if (!feed) {
    return [];
  }

  return feed.items && feed.items.length > 0 ? feed.items : [feed];
}

function buildWeChatPageEpisodeSrcDoc(
  pageEpisode: DatingPageEpisode,
  options: {
    userAvatarUrl: string;
    characterAvatarUrl: string;
    userName: string;
    characterName: string;
  },
): string {
  const chatData = pageEpisode.chat || {
    headerTitle: options.characterName,
    headerSubtitle: '',
    inputPlaceholder: '发消息',
    messages: [] as DatingPageEpisodeChatMessage[],
  };
  const statusBar = pageEpisode.statusBar?.mode === 'hidden'
    ? null
    : {
        time: pageEpisode.statusBar?.time?.trim() || buildAutoStatusBarTime(),
        carrier: pageEpisode.statusBar?.carrier?.trim() || '中国移动',
        network: pageEpisode.statusBar?.network?.trim() || '5G',
        battery: clampNumber(pageEpisode.statusBar?.battery ?? 86, 0, 100),
      };
  const headerTitle = chatData.headerTitle?.trim() || options.characterName;
  const headerSubtitle = chatData.headerSubtitle?.trim() || pageEpisode.subtitle?.trim() || '';
  const inputPlaceholder = chatData.inputPlaceholder?.trim() || '发消息';
  const messages = chatData.messages.length > 0
    ? chatData.messages
    : [{
        sender: 'system',
        kind: 'system',
        text: pageEpisode.caption || '这一页番外暂时没有生成完整聊天记录。',
      } satisfies DatingPageEpisodeChatMessage];

  const messageMarkup = messages.map((message) => {
    if (message.kind === 'timestamp') {
      return `<div class="wx-timestamp">${escapePageHtml(message.timestampLabel || message.text || '')}</div>`;
    }

    if (message.kind === 'system' || message.sender === 'system') {
      return `<div class="wx-system">${escapePageHtml(message.text || '')}</div>`;
    }

    const isUser = message.sender === 'user';
    const avatarMarkup = buildPageAvatarMarkup(
      isUser ? options.userAvatarUrl : options.characterAvatarUrl,
      isUser ? options.userName : options.characterName,
    );
    const contentMarkup = message.kind === 'transfer'
      ? `
        <div class="wx-bubble wx-bubble--transfer">
          <div class="wx-transfer-label">${escapePageHtml(message.text || (isUser ? '转账给对方' : '转账给你'))}</div>
          <div class="wx-transfer-amount">${escapePageHtml(message.amountLabel || '¥520.00')}</div>
          ${message.note ? `<div class="wx-transfer-note">${escapePageHtml(message.note)}</div>` : ''}
        </div>
      `
      : `<div class="wx-bubble">${escapePageHtml(message.text || '')}</div>`;

    return `
      <div class="wx-row ${isUser ? 'wx-row--user' : 'wx-row--character'}">
        ${isUser ? '' : avatarMarkup}
        ${contentMarkup}
        ${isUser ? avatarMarkup : ''}
      </div>
    `;
  }).join('');

  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePageHtml(pageEpisode.title || headerTitle)}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0) 38%),
          linear-gradient(180deg, #eef1f6 0%, #f5f6f8 42%, #ebedf2 100%);
        color: #111827;
      }
      body {
        padding: 0;
      }
      .wx-shell {
        min-height: 100vh;
        padding-bottom: 20px;
      }
      .wx-statusbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 18px 8px;
        font-size: 13px;
        font-weight: 600;
      }
      .wx-statusbar-right {
        display: flex;
        align-items: center;
        gap: 8px;
        color: rgba(17, 24, 39, 0.82);
      }
      .wx-battery {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .wx-battery-bar {
        width: 22px;
        height: 11px;
        border: 1.4px solid rgba(17, 24, 39, 0.9);
        border-radius: 3px;
        padding: 1px;
      }
      .wx-battery-fill {
        height: 100%;
        border-radius: 2px;
        background: #22c55e;
      }
      .wx-topbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 18px 12px;
      }
      .wx-back {
        font-size: 22px;
        line-height: 1;
        color: #111827;
      }
      .wx-topbar-main {
        min-width: 0;
        flex: 1;
      }
      .wx-topbar-title {
        font-size: 18px;
        font-weight: 700;
      }
      .wx-topbar-subtitle {
        margin-top: 3px;
        font-size: 11px;
        color: rgba(75, 85, 99, 0.82);
      }
      .wx-scroll {
        padding: 8px 14px 0;
      }
      .wx-timestamp,
      .wx-system {
        margin: 12px auto;
        width: fit-content;
        max-width: min(84%, 320px);
        border-radius: 999px;
        background: rgba(17, 24, 39, 0.08);
        color: rgba(55, 65, 81, 0.72);
        padding: 5px 10px;
        font-size: 11px;
        text-align: center;
      }
      .wx-system {
        border-radius: 12px;
        white-space: pre-wrap;
        line-height: 1.5;
      }
      .wx-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin: 10px 0;
      }
      .wx-row--user {
        justify-content: flex-end;
      }
      .wx-avatar {
        width: 34px;
        height: 34px;
        border-radius: 12px;
        object-fit: cover;
        flex: 0 0 auto;
        background: #dbe4ee;
      }
      .wx-avatar--fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        background: linear-gradient(135deg, #94a3b8, #64748b);
      }
      .wx-bubble {
        max-width: min(70%, 280px);
        padding: 11px 13px;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
        font-size: 14px;
        line-height: 1.58;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .wx-row--user .wx-bubble {
        background: linear-gradient(180deg, #b7f17f 0%, #9ee85e 100%);
      }
      .wx-bubble--transfer {
        min-width: 190px;
        background: linear-gradient(180deg, #f7b36b 0%, #ee9b4f 100%);
        color: #ffffff;
      }
      .wx-transfer-label {
        font-size: 12px;
        opacity: 0.92;
      }
      .wx-transfer-amount {
        margin-top: 6px;
        font-size: 31px;
        font-weight: 700;
        letter-spacing: -0.03em;
      }
      .wx-transfer-note {
        margin-top: 7px;
        font-size: 12px;
        opacity: 0.94;
      }
      .wx-composer {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 16px 14px 0;
        padding: 10px 12px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.78);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
        color: rgba(107, 114, 128, 0.92);
        font-size: 13px;
      }
      .wx-composer-input {
        min-width: 0;
        flex: 1;
        border-radius: 999px;
        background: rgba(229, 231, 235, 0.88);
        padding: 9px 12px;
      }
      .wx-composer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .wx-composer-dot {
        width: 26px;
        height: 26px;
        border-radius: 999px;
        background: rgba(17, 24, 39, 0.08);
      }
    </style>
  </head>
  <body>
    <div class="wx-shell">
      ${statusBar ? `
        <div class="wx-statusbar">
          <div>${escapePageHtml(statusBar.time)}</div>
          <div class="wx-statusbar-right">
            <span>${escapePageHtml(statusBar.carrier)}</span>
            <span>${escapePageHtml(statusBar.network)}</span>
            <span class="wx-battery">
              <span>${statusBar.battery}%</span>
              <span class="wx-battery-bar">
                <span class="wx-battery-fill" style="width:${statusBar.battery}%;"></span>
              </span>
            </span>
          </div>
        </div>
      ` : ''}
      <div class="wx-topbar">
        <div class="wx-back">‹</div>
        <div class="wx-topbar-main">
          <div class="wx-topbar-title">${escapePageHtml(headerTitle)}</div>
          ${headerSubtitle ? `<div class="wx-topbar-subtitle">${escapePageHtml(headerSubtitle)}</div>` : ''}
        </div>
      </div>
      <div class="wx-scroll">${messageMarkup}</div>
      <div class="wx-composer">
        <div class="wx-composer-input">${escapePageHtml(inputPlaceholder)}</div>
        <div class="wx-composer-actions">
          <div class="wx-composer-dot"></div>
          <div class="wx-composer-dot"></div>
        </div>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

function buildFeedCommentRows(
  comments: DatingPageEpisodeFeedItem['comments'],
  classPrefix: string,
): string {
  return comments.map((comment) => `
    <div class="${classPrefix}-comment">
      <span class="${classPrefix}-comment-name">${escapePageHtml(comment.authorName)}</span>
      ${comment.badge ? `<span class="${classPrefix}-comment-badge">${escapePageHtml(comment.badge)}</span>` : ''}
      <span class="${classPrefix}-comment-text">${escapePageHtml(comment.text)}</span>
    </div>
  `).join('');
}

function buildTopicPills(topics: string[] | undefined, className: string): string {
  if (!topics?.length) {
    return '';
  }

  return topics.map((topic) => `<span class="${className}">${escapePageHtml(topic)}</span>`).join('');
}

function buildParagraphMarkup(value: string, className: string): string {
  const normalized = value.replace(/\r/g, '').trim();
  if (!normalized) {
    return '';
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs.map((paragraph) => `<p class="${className}">${escapePageHtml(paragraph)}</p>`).join('');
  }

  const sentenceChunks = normalized
    .split(/(?<=[。！？!?])/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentenceChunks.length >= 4) {
    const grouped: string[] = [];
    for (let i = 0; i < sentenceChunks.length; i += 2) {
      grouped.push(sentenceChunks.slice(i, i + 2).join(''));
    }
    return grouped.map((paragraph) => `<p class="${className}">${escapePageHtml(paragraph)}</p>`).join('');
  }

  return `<p class="${className}">${escapePageHtml(normalized)}</p>`;
}

function buildGenericFeedPageEpisodeSrcDoc(
  pageEpisode: DatingPageEpisode,
  options: {
    characterAvatarUrl: string;
    characterName: string;
  },
): string {
  const feed = pageEpisode.feed;
  if (!feed) {
    return '';
  }

  const feedItems = resolvePageEpisodeFeedItems(feed);
  const cardsMarkup = feedItems.map((item) => {
    const avatarMarkup = buildPageAvatarMarkup(options.characterAvatarUrl, item.authorName || options.characterName)
      .replace('class="wx-avatar', 'class="feed-avatar');
    const commentsMarkup = buildFeedCommentRows(item.comments, 'feed');
    const topicsMarkup = buildTopicPills(item.topics, 'feed-topic');

    return `
      <div class="feed-card">
        <div class="feed-header">
          ${avatarMarkup}
          <div>
            <div class="feed-platform">动态页</div>
            <div class="feed-title">${escapePageHtml(item.authorName)}</div>
            ${(item.authorBadge || item.locationLabel) ? `<div class="feed-subtitle">${escapePageHtml(item.authorBadge || item.locationLabel || '')}</div>` : ''}
          </div>
        </div>
        ${item.headline ? `<div class="feed-headline">${escapePageHtml(item.headline)}</div>` : ''}
        <div class="feed-body">${escapePageHtml(item.body)}</div>
        ${topicsMarkup ? `<div class="feed-topics">${topicsMarkup}</div>` : ''}
        <div class="feed-meta">${escapePageHtml([item.timestampLabel, item.sourceLabel].filter(Boolean).join(' · ') || pageEpisode.caption || '')}</div>
        <div class="feed-actions">
          <span>${escapePageHtml(item.likeCountLabel || '53')}</span>
          <span>${escapePageHtml(item.commentCountLabel || '8')}</span>
          <span>${escapePageHtml(item.repostCountLabel || '互动')}</span>
        </div>
        ${commentsMarkup ? `<div class="feed-comment-wrap">${commentsMarkup}</div>` : ''}
      </div>
    `.trim();
  }).join('\n');

  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePageHtml(pageEpisode.title || feedItems[0]?.authorName || '')}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: linear-gradient(180deg, #f4f5f7 0%, #eef1f6 100%);
        color: #111827;
      }
      body { padding: 18px 14px 28px; }
      .feed-shell { max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
      .feed-card {
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
        overflow: hidden;
      }
      .feed-header { display: flex; align-items: center; gap: 12px; padding: 16px; }
      .feed-avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        flex: 0 0 auto;
        background: #e5e7eb;
      }
      .feed-avatar--fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 800;
        color: #ffffff;
        background: linear-gradient(135deg, #60a5fa, #2563eb);
      }
      .feed-platform {
        display: inline-flex;
        margin-bottom: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.12);
        color: #2563eb;
        font-size: 10px;
        font-weight: 800;
      }
      .feed-title { font-size: 16px; font-weight: 700; }
      .feed-subtitle { margin-top: 3px; font-size: 12px; color: rgba(75, 85, 99, 0.78); }
      .feed-headline { padding: 0 16px 8px; font-size: 17px; font-weight: 800; }
      .feed-body { padding: 0 16px 14px; white-space: pre-wrap; line-height: 1.72; font-size: 14px; }
      .feed-topics { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 12px; }
      .feed-topic {
        display: inline-flex;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.1);
        color: #2563eb;
        font-size: 11px;
        font-weight: 700;
      }
      .feed-meta { padding: 0 16px 16px; font-size: 12px; color: rgba(75, 85, 99, 0.78); }
      .feed-actions {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid rgba(226, 232, 240, 0.9);
        color: #2563eb;
        font-size: 12px;
        font-weight: 700;
      }
      .feed-comment-wrap {
        border-top: 1px solid rgba(226, 232, 240, 0.9);
        padding: 12px 16px 16px;
        background: rgba(248, 250, 252, 0.9);
      }
      .feed-comment { line-height: 1.6; font-size: 13px; }
      .feed-comment + .feed-comment { margin-top: 9px; }
      .feed-comment-name { font-weight: 700; color: #111827; }
      .feed-comment-badge {
        display: inline-flex;
        margin-left: 6px;
        padding: 1px 5px;
        border-radius: 999px;
        background: rgba(239, 68, 68, 0.12);
        color: #ef4444;
        font-size: 10px;
        font-weight: 700;
      }
      .feed-comment-text { margin-left: 6px; color: #374151; }
      .feed-caption { margin-top: 12px; font-size: 12px; line-height: 1.6; color: rgba(75, 85, 99, 0.78); }
    </style>
  </head>
  <body>
    <div class="feed-shell">
      ${cardsMarkup}
      ${pageEpisode.caption ? `<div class="feed-caption">${escapePageHtml(pageEpisode.caption)}</div>` : ''}
    </div>
  </body>
</html>
  `.trim();
}

function buildWeiboPageEpisodeSrcDoc(
  pageEpisode: DatingPageEpisode,
  options: {
    characterAvatarUrl: string;
    characterName: string;
  },
): string {
  const feed = pageEpisode.feed;
  if (!feed) {
    return '';
  }

  const feedItems = resolvePageEpisodeFeedItems(feed);
  const profileSeed = feedItems[0];
  const profileName = profileSeed?.authorName || options.characterName;
  const profileBadge = profileSeed?.authorBadge || '认证';
  const profileHandle = profileSeed?.handle || `@${profileName.replace(/\s+/g, '')}`;
  const profileBio = profileSeed?.bio || pageEpisode.subtitle || '这人暂时什么都没写。';
  const followerCountLabel = profileSeed?.followerCountLabel || '2.1亿';
  const followingCountLabel = profileSeed?.followingCountLabel || '3';
  const postCountLabel = profileSeed?.postCountLabel || (feedItems.length > 1 ? String(feedItems.length) : '89');
  const profileAvatarMarkup = buildPageAvatarMarkup(options.characterAvatarUrl, profileName)
    .replace('class="wx-avatar', 'class="weibo-profile-avatar');
  const cardsMarkup = feedItems.map((item) => {
    const avatarMarkup = buildPageAvatarMarkup(options.characterAvatarUrl, item.authorName || options.characterName)
      .replace('class="wx-avatar', 'class="weibo-avatar');
    const commentsMarkup = buildFeedCommentRows(item.comments, 'weibo');
    const bodyMarkup = buildParagraphMarkup(item.body, 'weibo-body-paragraph');
    const topicsMarkup = item.topics?.length
      ? `<div class="weibo-topics">${item.topics.map((topic) => `<span class="weibo-topic">#${escapePageHtml(topic)}#</span>`).join(' ')}</div>`
      : '';

    return `
      <article class="weibo-post">
        <div class="weibo-head">
          ${avatarMarkup}
          <div class="weibo-head-main">
            <div class="weibo-name-row">
              <div class="weibo-name">${escapePageHtml(item.authorName)}</div>
              ${item.authorBadge ? `<span class="weibo-badge">${escapePageHtml(item.authorBadge)}</span>` : ''}
            </div>
            <div class="weibo-subline">${escapePageHtml([item.timestampLabel, item.sourceLabel].filter(Boolean).join(' · ') || '刚刚')}</div>
          </div>
        </div>
        ${item.headline ? `<div class="weibo-headline">${escapePageHtml(item.headline)}</div>` : ''}
        <div class="weibo-body">${bodyMarkup}</div>
        ${topicsMarkup}
        ${item.locationLabel ? `<div class="weibo-location">发布于 ${escapePageHtml(item.locationLabel)}</div>` : ''}
        <div class="weibo-toolbar">
          <span>转发 ${escapePageHtml(item.repostCountLabel || '17')}</span>
          <span>评论 ${escapePageHtml(item.commentCountLabel || '32')}</span>
          <span>赞 ${escapePageHtml(item.likeCountLabel || '88')}</span>
        </div>
        ${commentsMarkup ? `<div class="weibo-comments"><div class="weibo-comments-title">评论区</div>${commentsMarkup}</div>` : ''}
      </article>
    `.trim();
  }).join('\n');

  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePageHtml(pageEpisode.title || feedItems[0]?.authorName || '')}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: #f5f6f8;
        color: #111827;
      }
      body { padding: 0 0 20px; }
      .weibo-shell {
        max-width: 390px;
        margin: 0 auto;
        min-height: 100vh;
        background: #f5f6f8;
      }
      .weibo-titlebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 42px;
        padding: 0 14px;
        background: #0f1115;
        color: rgba(255,255,255,0.94);
      }
      .weibo-titlebar-title {
        font-size: 15px;
        font-weight: 800;
      }
      .weibo-titlebar-side {
        font-size: 18px;
        color: rgba(255,255,255,0.82);
      }
      .weibo-cover {
        height: 10px;
        background: #ffffff;
      }
      .weibo-profile-card {
        margin: 0 12px 0;
        border-radius: 24px 24px 0 0;
        background: rgba(255,255,255,0.98);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        overflow: hidden;
      }
      .weibo-profile-main {
        padding: 14px 16px 16px;
      }
      .weibo-profile-header {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 0;
      }
      .weibo-profile-avatar {
        width: 72px;
        height: 72px;
        border-radius: 20px;
        object-fit: cover;
        display: block;
        flex: 0 0 auto;
        border: 4px solid #ffffff;
        background: #fef3c7;
      }
      .weibo-profile-avatar--fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 800;
        color: #ffffff;
        background: linear-gradient(135deg, #fb923c, #ea580c);
      }
      .weibo-profile-info {
        min-width: 0;
        flex: 1;
        padding-bottom: 8px;
      }
      .weibo-profile-name-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .weibo-profile-name {
        font-size: 18px;
        font-weight: 900;
        color: #3f3f46;
      }
      .weibo-profile-badge {
        display: inline-flex;
        padding: 3px 8px;
        border-radius: 10px;
        background: #f4ebe8;
        color: #8b5e3c;
        font-size: 11px;
        font-weight: 800;
      }
      .weibo-profile-handle {
        margin-top: 6px;
        font-size: 14px;
        color: #8b8b93;
      }
      .weibo-profile-bio {
        margin-top: 14px;
        font-size: 14px;
        line-height: 1.7;
        color: #4b5563;
      }
      .weibo-profile-stats {
        display: flex;
        gap: 18px;
        margin-top: 16px;
        flex-wrap: wrap;
      }
      .weibo-profile-stat {
        font-size: 13px;
        color: #8b8b93;
      }
      .weibo-profile-stat strong {
        font-size: 15px;
        color: #3f3f46;
        font-weight: 900;
        margin-right: 4px;
      }
      .weibo-profile-follow {
        margin-top: 14px;
        min-width: 78px;
        height: 32px;
        border: none;
        border-radius: 999px;
        background: rgba(255, 130, 0, 0.12);
        color: #ff8200;
        font-size: 13px;
        font-weight: 800;
      }
      .weibo-tabs {
        display: flex;
        align-items: center;
        justify-content: space-around;
        min-height: 42px;
        padding: 0 12px;
        background: #ffffff;
        border-bottom: 1px solid rgba(229, 231, 235, 0.96);
      }
      .weibo-tab {
        position: relative;
        padding: 10px 0;
        font-size: 15px;
        color: #b3a9a3;
        font-weight: 800;
      }
      .weibo-tab.is-active {
        color: #3f3f46;
      }
      .weibo-tab.is-active::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        border-radius: 999px;
        background: #ff8200;
      }
      .weibo-feed {
        background: #ffffff;
        border-bottom: 1px solid rgba(229, 231, 235, 0.94);
      }
      .weibo-post {
        padding: 14px 16px 12px;
      }
      .weibo-post + .weibo-post {
        border-top: 1px solid rgba(229, 231, 235, 0.96);
      }
      .weibo-head { display: flex; gap: 10px; align-items: center; }
      .weibo-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        flex: 0 0 auto;
        background: #fde68a;
      }
      .weibo-avatar--fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 800;
        color: #ffffff;
        background: linear-gradient(135deg, #fb923c, #ea580c);
      }
      .weibo-head-main { min-width: 0; flex: 1; }
      .weibo-name-row { display: flex; align-items: center; gap: 8px; }
      .weibo-name { font-size: 15px; font-weight: 800; }
      .weibo-badge {
        display: inline-flex;
        padding: 2px 7px;
        border-radius: 999px;
        background: rgba(249, 115, 22, 0.12);
        color: #ea580c;
        font-size: 10px;
        font-weight: 800;
      }
      .weibo-subline { margin-top: 4px; font-size: 12px; color: rgba(107, 114, 128, 0.82); }
      .weibo-headline { margin-top: 12px; font-size: 18px; line-height: 1.4; font-weight: 800; }
      .weibo-body { margin-top: 10px; line-height: 1.8; font-size: 15px; color: #111827; }
      .weibo-body-paragraph {
        margin: 0;
      }
      .weibo-body-paragraph + .weibo-body-paragraph {
        margin-top: 10px;
      }
      .weibo-topics { margin-top: 10px; line-height: 1.9; }
      .weibo-topic { color: #ff8200; font-size: 14px; font-weight: 700; margin-right: 10px; }
      .weibo-location { margin-top: 8px; font-size: 12px; color: rgba(107, 114, 128, 0.82); }
      .weibo-toolbar {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid rgba(229, 231, 235, 0.96);
        font-size: 12px;
        color: rgba(107, 114, 128, 0.9);
        font-weight: 700;
      }
      .weibo-comments {
        margin-top: 12px;
        border-radius: 14px;
        background: #f7f8fa;
        padding: 10px 12px;
      }
      .weibo-comments-title {
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 800;
        color: rgba(107, 114, 128, 0.9);
      }
      .weibo-comment { font-size: 13px; line-height: 1.68; color: #1f2937; }
      .weibo-comment + .weibo-comment { margin-top: 8px; }
      .weibo-comment-name { font-weight: 700; color: #111827; }
      .weibo-comment-badge { margin-left: 6px; font-size: 10px; color: #ef4444; font-weight: 700; }
      .weibo-comment-text { margin-left: 6px; }
      .weibo-caption {
        padding: 12px 16px 0;
        font-size: 12px;
        line-height: 1.6;
        color: rgba(75, 85, 99, 0.82);
      }
    </style>
  </head>
  <body>
    <div class="weibo-shell">
      <div class="weibo-titlebar">
        <div class="weibo-titlebar-side">‹</div>
        <div class="weibo-titlebar-title">微博主页</div>
        <div class="weibo-titlebar-side">⋯</div>
      </div>
      <div class="weibo-cover"></div>
      <div class="weibo-profile-card">
        <div class="weibo-profile-main">
          <div class="weibo-profile-header">
            ${profileAvatarMarkup}
            <div class="weibo-profile-info">
              <div class="weibo-profile-name-row">
                <div class="weibo-profile-name">${escapePageHtml(profileName)}</div>
                <span class="weibo-profile-badge">${escapePageHtml(profileBadge)}</span>
              </div>
              <div class="weibo-profile-handle">${escapePageHtml(profileHandle)}</div>
            </div>
          </div>
          <div class="weibo-profile-bio">${escapePageHtml(profileBio)}</div>
          <div class="weibo-profile-stats">
            <div class="weibo-profile-stat"><strong>${escapePageHtml(followerCountLabel)}</strong>粉丝</div>
            <div class="weibo-profile-stat"><strong>${escapePageHtml(followingCountLabel)}</strong>关注</div>
            <div class="weibo-profile-stat"><strong>${escapePageHtml(postCountLabel)}</strong>微博</div>
          </div>
          <button type="button" class="weibo-profile-follow">+ 关注</button>
        </div>
      </div>
      <div class="weibo-tabs">
        <div class="weibo-tab is-active">主页</div>
        <div class="weibo-tab">动态</div>
        <div class="weibo-tab">相册</div>
        <div class="weibo-tab">管理</div>
      </div>
      <div class="weibo-feed">
        ${cardsMarkup}
      </div>
      ${pageEpisode.caption ? `<div class="weibo-caption">${escapePageHtml(pageEpisode.caption)}</div>` : ''}
    </div>
  </body>
</html>
  `.trim();
}

function buildXiaohongshuPageEpisodeSrcDoc(
  pageEpisode: DatingPageEpisode,
  options: {
    characterAvatarUrl: string;
    characterName: string;
  },
): string {
  const feed = pageEpisode.feed;
  if (!feed) {
    return '';
  }

  const feedItems = resolvePageEpisodeFeedItems(feed);
  const cardsMarkup = feedItems.map((item) => {
    const avatarMarkup = buildPageAvatarMarkup(options.characterAvatarUrl, item.authorName || options.characterName)
      .replace('class="wx-avatar', 'class="xhs-avatar');
    const commentsMarkup = buildFeedCommentRows(item.comments, 'xhs');
    const topicsMarkup = buildTopicPills(item.topics, 'xhs-topic');
    const bodyMarkup = buildParagraphMarkup(item.body, 'xhs-body-paragraph');

    return `
      <article class="xhs-card">
        <div class="xhs-head">
          <div class="xhs-author-wrap">
            ${avatarMarkup}
            <div class="xhs-author-block">
              <div class="xhs-author-row">
                <div class="xhs-author">${escapePageHtml(item.authorName)}</div>
                ${item.authorBadge ? `<span class="xhs-badge">${escapePageHtml(item.authorBadge)}</span>` : ''}
              </div>
              <div class="xhs-subline">${escapePageHtml(item.locationLabel || item.timestampLabel || '刚刚更新')}</div>
            </div>
          </div>
          <button type="button" class="xhs-follow-btn">关注</button>
        </div>
        <div class="xhs-title">${escapePageHtml(item.headline || pageEpisode.title || '今日笔记')}</div>
        <div class="xhs-body">${bodyMarkup}</div>
        ${topicsMarkup ? `<div class="xhs-topics">${topicsMarkup}</div>` : ''}
        ${item.sourceLabel ? `<div class="xhs-source">${escapePageHtml(item.sourceLabel)}</div>` : ''}
        <div class="xhs-toolbar">
          <span>赞 ${escapePageHtml(item.likeCountLabel || '2.3k')}</span>
          <span>藏 ${escapePageHtml(item.repostCountLabel || '860')}</span>
          <span>评 ${escapePageHtml(item.commentCountLabel || '319')}</span>
        </div>
        ${commentsMarkup ? `<div class="xhs-comments">${commentsMarkup}</div>` : ''}
      </article>
    `.trim();
  }).join('\n');

  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePageHtml(pageEpisode.title || feedItems[0]?.headline || '')}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: #f7f7f7;
        color: #111827;
      }
      body { padding: 0 0 28px; }
      .xhs-shell {
        max-width: 390px;
        margin: 0 auto;
        display: grid;
        gap: 12px;
        padding: 12px 12px 0;
      }
      .xhs-appbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 42px;
        padding: 2px 2px 0;
      }
      .xhs-appbar-title {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.02em;
      }
      .xhs-appbar-side {
        font-size: 18px;
        color: rgba(17, 24, 39, 0.86);
      }
      .xhs-card {
        border-radius: 22px;
        background: rgba(255,255,255,0.98);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        overflow: hidden;
        padding: 16px 16px 14px;
      }
      .xhs-head {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
      }
      .xhs-author-wrap {
        display: flex;
        gap: 12px;
        align-items: center;
        min-width: 0;
        flex: 1;
      }
      .xhs-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        flex: 0 0 auto;
        background: #f3f4f6;
      }
      .xhs-avatar--fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 800;
        color: #ffffff;
        background: linear-gradient(135deg, #fb7185, #ff2442);
      }
      .xhs-author-block { min-width: 0; flex: 1; }
      .xhs-author-row { display: flex; align-items: center; gap: 8px; }
      .xhs-author { font-size: 15px; font-weight: 800; }
      .xhs-badge {
        display: inline-flex;
        padding: 2px 7px;
        border-radius: 999px;
        background: rgba(255, 36, 66, 0.12);
        color: #ff2442;
        font-size: 10px;
        font-weight: 800;
      }
      .xhs-subline { margin-top: 4px; font-size: 12px; color: rgba(107, 114, 128, 0.82); }
      .xhs-follow-btn {
        flex: 0 0 auto;
        min-width: 68px;
        height: 32px;
        border: none;
        border-radius: 999px;
        background: #ff2442;
        color: #ffffff;
        font-size: 13px;
        font-weight: 800;
      }
      .xhs-title { margin-top: 16px; font-size: 20px; line-height: 1.42; font-weight: 800; }
      .xhs-body {
        margin-top: 12px;
        line-height: 1.85;
        font-size: 15px;
        color: #111827;
      }
      .xhs-body-paragraph {
        margin: 0;
      }
      .xhs-body-paragraph + .xhs-body-paragraph {
        margin-top: 12px;
      }
      .xhs-topics { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .xhs-topic {
        display: inline-flex;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(255, 36, 66, 0.1);
        color: #ff2442;
        font-size: 11px;
        font-weight: 700;
      }
      .xhs-source { margin-top: 10px; font-size: 12px; color: rgba(75, 85, 99, 0.78); }
      .xhs-toolbar {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid rgba(229, 231, 235, 0.95);
        font-size: 12px;
        color: rgba(75, 85, 99, 0.9);
        font-weight: 700;
      }
      .xhs-comments {
        margin-top: 12px;
        border-top: 1px solid rgba(229, 231, 235, 0.95);
        padding-top: 12px;
      }
      .xhs-comment { font-size: 13px; line-height: 1.78; color: #1f2937; }
      .xhs-comment + .xhs-comment {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(243, 244, 246, 0.92);
      }
      .xhs-comment-name { font-weight: 700; color: #111827; }
      .xhs-comment-badge { margin-left: 6px; font-size: 10px; color: #ef4444; font-weight: 700; }
      .xhs-comment-text { margin-left: 6px; }
      .xhs-caption {
        padding: 0 6px;
        font-size: 12px;
        line-height: 1.6;
        color: rgba(75, 85, 99, 0.82);
      }
      .xhs-composer {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 46px;
        padding: 0 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.98);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
        color: rgba(107, 114, 128, 0.88);
        font-size: 13px;
      }
      .xhs-composer-dot {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(244, 244, 245, 0.95);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #ff2442;
        font-weight: 900;
      }
    </style>
  </head>
  <body>
    <div class="xhs-shell">
      <div class="xhs-appbar">
        <div class="xhs-appbar-side">‹</div>
        <div class="xhs-appbar-title">小红书</div>
        <div class="xhs-appbar-side">⋯</div>
      </div>
      ${cardsMarkup}
      <div class="xhs-composer">
        <div class="xhs-composer-dot">✦</div>
        <div>说点什么呢...</div>
      </div>
      ${pageEpisode.caption ? `<div class="xhs-caption">${escapePageHtml(pageEpisode.caption)}</div>` : ''}
    </div>
  </body>
</html>
  `.trim();
}

function buildNeteasePageEpisodeSrcDoc(
  pageEpisode: DatingPageEpisode,
  options: {
    characterAvatarUrl: string;
    characterName: string;
  },
): string {
  const feed = pageEpisode.feed;
  if (!feed) {
    return '';
  }

  const feedItems = resolvePageEpisodeFeedItems(feed);
  const cardsMarkup = feedItems.map((item) => {
    const avatarMarkup = buildPageAvatarMarkup(options.characterAvatarUrl, item.authorName || options.characterName)
      .replace('class="wx-avatar', 'class="netease-avatar');
    const bodyMarkup = buildParagraphMarkup(item.body, 'netease-body-paragraph');
    const commentsMarkup = item.comments.map((comment) => `
      <div class="netease-reply">
        <div class="netease-reply-head">
          <span class="netease-reply-name">${escapePageHtml(comment.authorName)}</span>
          ${comment.badge ? `<span class="netease-reply-badge">${escapePageHtml(comment.badge)}</span>` : ''}
        </div>
        <div class="netease-reply-text">${escapePageHtml(comment.text)}</div>
      </div>
    `).join('');
    const topicsMarkup = item.topics?.length
      ? `<div class="netease-topics">${item.topics.map((topic) => `<span class="netease-topic">${escapePageHtml(topic)}</span>`).join('')}</div>`
      : '';

    return `
      <article class="netease-comment-card">
        <div class="netease-comment-head">
          ${avatarMarkup}
          <div class="netease-comment-main">
            <div class="netease-name">${escapePageHtml(item.authorName)}</div>
            <div class="netease-subline">${escapePageHtml(item.timestampLabel || '刚刚')}</div>
          </div>
          <div class="netease-like">♡ ${escapePageHtml(item.likeCountLabel || '999+')}</div>
        </div>
        <div class="netease-body">${bodyMarkup}</div>
        ${topicsMarkup}
        ${item.locationLabel ? `<div class="netease-location">${escapePageHtml(item.locationLabel)}</div>` : ''}
        <div class="netease-toolbar">
          <span>回复 ${escapePageHtml(item.commentCountLabel || '77')}</span>
          <span>${escapePageHtml(item.sourceLabel || item.authorBadge || '来自云村')}</span>
        </div>
        ${commentsMarkup ? `<div class="netease-replies"><div class="netease-replies-title">回复</div>${commentsMarkup}</div>` : ''}
      </article>
    `.trim();
  }).join('\n');

  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePageHtml(pageEpisode.title || feedItems[0]?.headline || '')}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: linear-gradient(180deg, #1b1b1f 0%, #111216 100%);
        color: #f8fafc;
      }
      body { padding: 0 0 20px; }
      .netease-shell {
        max-width: 390px;
        margin: 0 auto;
        min-height: 100vh;
        background: linear-gradient(180deg, #1b1b1f 0%, #111216 100%);
      }
      .netease-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 48px;
        padding: 0 16px;
        color: rgba(255,255,255,0.95);
      }
      .netease-topbar-title {
        font-size: 17px;
        font-weight: 900;
      }
      .netease-topbar-side {
        font-size: 18px;
        color: rgba(255,255,255,0.78);
      }
      .netease-hero {
        display: flex;
        gap: 14px;
        align-items: center;
        padding: 12px 18px 18px;
      }
      .netease-disc {
        width: 78px;
        height: 78px;
        border-radius: 50%;
        background:
          radial-gradient(circle at center, #111827 0 18%, transparent 19%),
          linear-gradient(135deg, #ef4444 0%, #fb7185 100%);
        box-shadow:
          inset 0 0 0 10px rgba(255,255,255,0.12),
          0 12px 24px rgba(0,0,0,0.28);
      }
      .netease-hero-title {
        font-size: 18px;
        font-weight: 900;
        line-height: 1.45;
      }
      .netease-hero-subtitle {
        margin-top: 6px;
        font-size: 12px;
        color: rgba(226, 232, 240, 0.76);
      }
      .netease-hero-caption {
        margin-top: 10px;
        font-size: 13px;
        line-height: 1.7;
        color: rgba(248, 250, 252, 0.84);
      }
      .netease-sheet {
        border-radius: 28px 28px 0 0;
        background: #ffffff;
        color: #111827;
        min-height: calc(100vh - 158px);
        padding-bottom: 20px;
        box-shadow: 0 -12px 30px rgba(0,0,0,0.2);
      }
      .netease-sheet-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px 10px;
      }
      .netease-sheet-title {
        font-size: 18px;
        font-weight: 900;
        color: #111827;
      }
      .netease-sheet-subtitle {
        font-size: 12px;
        color: rgba(107, 114, 128, 0.86);
      }
      .netease-sort-tabs {
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 0 18px 10px;
        border-bottom: 1px solid rgba(229, 231, 235, 0.92);
      }
      .netease-sort-tab {
        position: relative;
        padding: 8px 0;
        font-size: 13px;
        font-weight: 700;
        color: rgba(107, 114, 128, 0.82);
      }
      .netease-sort-tab.is-active {
        color: #111827;
      }
      .netease-sort-tab.is-active::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
        height: 3px;
        border-radius: 999px;
        background: #d33a31;
      }
      .netease-comment-card {
        padding: 14px 18px 16px;
      }
      .netease-comment-card + .netease-comment-card {
        border-top: 1px solid rgba(229, 231, 235, 0.92);
      }
      .netease-comment-head { display: flex; gap: 12px; align-items: center; }
      .netease-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        flex: 0 0 auto;
        background: #fee2e2;
      }
      .netease-avatar--fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 800;
        color: #ffffff;
        background: linear-gradient(135deg, #ef4444, #f97316);
      }
      .netease-comment-main { min-width: 0; flex: 1; }
      .netease-name { font-size: 14px; font-weight: 700; color: #111827; }
      .netease-subline { margin-top: 4px; font-size: 12px; color: rgba(107, 114, 128, 0.84); }
      .netease-like {
        flex: 0 0 auto;
        font-size: 12px;
        color: #ef4444;
        font-weight: 700;
      }
      .netease-body { margin-top: 12px; line-height: 1.82; font-size: 15px; color: #111827; }
      .netease-body-paragraph { margin: 0; }
      .netease-body-paragraph + .netease-body-paragraph { margin-top: 10px; }
      .netease-topics { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .netease-topic {
        display: inline-flex;
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(239, 68, 68, 0.12);
        color: #ef4444;
        font-size: 11px;
        font-weight: 700;
      }
      .netease-location {
        margin-top: 8px;
        font-size: 12px;
        color: rgba(107, 114, 128, 0.86);
      }
      .netease-toolbar {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(229, 231, 235, 0.92);
        font-size: 12px;
        color: rgba(107, 114, 128, 0.88);
        font-weight: 700;
      }
      .netease-replies {
        margin-top: 12px;
        border-radius: 16px;
        background: #f7f8fa;
        padding: 10px 12px;
      }
      .netease-replies-title {
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 800;
        color: rgba(107, 114, 128, 0.86);
      }
      .netease-reply + .netease-reply { margin-top: 10px; }
      .netease-reply-head { display: flex; align-items: center; gap: 6px; }
      .netease-reply-name { font-size: 12px; font-weight: 700; color: #111827; }
      .netease-reply-badge { font-size: 10px; color: #ef4444; font-weight: 700; }
      .netease-reply-text { margin-top: 4px; font-size: 13px; line-height: 1.7; color: #374151; }
      .netease-caption {
        padding: 12px 18px 0;
        font-size: 12px;
        line-height: 1.6;
        color: rgba(107, 114, 128, 0.86);
      }
    </style>
  </head>
  <body>
    <div class="netease-shell">
      <div class="netease-topbar">
        <div class="netease-topbar-side">‹</div>
        <div class="netease-topbar-title">评论</div>
        <div class="netease-topbar-side">⋯</div>
      </div>
      <div class="netease-hero">
        <div class="netease-disc"></div>
        <div>
          <div class="netease-hero-title">${escapePageHtml(feedItems[0]?.headline || pageEpisode.title || '云村热评')}</div>
          <div class="netease-hero-subtitle">${escapePageHtml(feedItems[0]?.sourceLabel || feedItems[0]?.authorBadge || '来自网易云音乐')}</div>
          ${pageEpisode.caption ? `<div class="netease-hero-caption">${escapePageHtml(pageEpisode.caption)}</div>` : ''}
        </div>
      </div>
      <div class="netease-sheet">
        <div class="netease-sheet-head">
          <div class="netease-sheet-title">精彩评论</div>
          <div class="netease-sheet-subtitle">${escapePageHtml(feedItems[0]?.commentCountLabel || String(feedItems[0]?.comments.length || 0))} 条互动</div>
        </div>
        <div class="netease-sort-tabs">
          <div class="netease-sort-tab is-active">推荐</div>
          <div class="netease-sort-tab">热度</div>
          <div class="netease-sort-tab">时间</div>
        </div>
        ${cardsMarkup}
      </div>
    </div>
  </body>
</html>
  `.trim();
}

function buildCampusPageEpisodeSrcDoc(
  pageEpisode: DatingPageEpisode,
  options: {
    characterAvatarUrl: string;
    characterName: string;
  },
): string {
  const feed = pageEpisode.feed;
  if (!feed) {
    return '';
  }

  const feedItems = resolvePageEpisodeFeedItems(feed);
  const cardsMarkup = feedItems.map((item) => {
    const avatarMarkup = buildPageAvatarMarkup(options.characterAvatarUrl, item.authorName || options.characterName)
      .replace('class="wx-avatar', 'class="campus-avatar');
    const bodyMarkup = buildParagraphMarkup(item.body, 'campus-body-paragraph');
    const commentsMarkup = item.comments.map((comment, index) => `
      <div class="campus-floor">
        <div class="campus-floor-head">
          <span class="campus-floor-index">${index + 1}L</span>
          <span class="campus-comment-name">${escapePageHtml(comment.authorName)}</span>
          ${comment.badge ? `<span class="campus-comment-badge">${escapePageHtml(comment.badge)}</span>` : ''}
        </div>
        <div class="campus-floor-text">${escapePageHtml(comment.text)}</div>
      </div>
    `).join('');
    const topicsMarkup = buildTopicPills(item.topics, 'campus-tag');

    return `
      <article class="campus-thread">
        <div class="campus-thread-head">
          <div class="campus-wall-label">${escapePageHtml(item.authorBadge || '校园论坛')}</div>
          <div class="campus-thread-meta">${escapePageHtml(item.locationLabel || '匿名区')} · ${escapePageHtml(item.timestampLabel || '刚刚')}</div>
        </div>
        ${item.headline ? `<div class="campus-title">${escapePageHtml(item.headline)}</div>` : ''}
        <div class="campus-user-row">
          ${avatarMarkup}
          <div>
            <div class="campus-name">${escapePageHtml(item.authorName)}</div>
            <div class="campus-time">${escapePageHtml(item.handle || '@匿名楼主')}</div>
          </div>
        </div>
        <div class="campus-body">${bodyMarkup}</div>
        ${topicsMarkup ? `<div class="campus-tags">${topicsMarkup}</div>` : ''}
        <div class="campus-toolbar">
          <span>围观 ${escapePageHtml(item.likeCountLabel || '326')}</span>
          <span>回帖 ${escapePageHtml(item.commentCountLabel || '29')}</span>
          <span>收藏 ${escapePageHtml(item.repostCountLabel || '12')}</span>
        </div>
        ${commentsMarkup ? `<div class="campus-comments"><div class="campus-comments-title">楼层回复</div>${commentsMarkup}</div>` : ''}
      </article>
    `.trim();
  }).join('\n');

  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePageHtml(pageEpisode.title || feedItems[0]?.headline || '')}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: #f3f4f6;
        color: #111827;
      }
      body { padding: 0 0 24px; }
      .campus-shell {
        max-width: 390px;
        margin: 0 auto;
        min-height: 100vh;
        background: #f3f4f6;
      }
      .campus-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 46px;
        padding: 0 14px;
        background: #ffffff;
        border-bottom: 1px solid rgba(229, 231, 235, 0.94);
      }
      .campus-topbar-title {
        font-size: 17px;
        font-weight: 900;
      }
      .campus-topbar-side {
        font-size: 18px;
        color: rgba(107, 114, 128, 0.86);
      }
      .campus-tabs {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px 8px;
        background: #ffffff;
        border-bottom: 1px solid rgba(229, 231, 235, 0.94);
      }
      .campus-tab {
        display: inline-flex;
        padding: 5px 10px;
        border-radius: 999px;
        background: #f3f4f6;
        color: #6b7280;
        font-size: 12px;
        font-weight: 800;
      }
      .campus-tab.is-active {
        background: rgba(245, 158, 11, 0.14);
        color: #a16207;
      }
      .campus-thread-list {
        padding: 12px;
        display: grid;
        gap: 12px;
      }
      .campus-thread {
        border-radius: 18px;
        background: rgba(255,255,255,0.98);
        border: 1px solid rgba(229, 231, 235, 0.92);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        padding: 16px;
      }
      .campus-thread-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .campus-wall-label {
        display: inline-flex;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(234, 179, 8, 0.14);
        color: #a16207;
        font-size: 11px;
        font-weight: 800;
      }
      .campus-thread-meta { font-size: 12px; color: rgba(107, 114, 128, 0.82); }
      .campus-user-row { display: flex; gap: 12px; align-items: center; margin-top: 12px; }
      .campus-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        flex: 0 0 auto;
        background: #fef3c7;
      }
      .campus-avatar--fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 800;
        color: #ffffff;
        background: linear-gradient(135deg, #f59e0b, #d97706);
      }
      .campus-name { font-size: 15px; font-weight: 800; }
      .campus-time { margin-top: 4px; font-size: 12px; color: rgba(107, 114, 128, 0.82); }
      .campus-title { margin-top: 14px; font-size: 17px; line-height: 1.45; font-weight: 800; }
      .campus-body { margin-top: 12px; line-height: 1.82; font-size: 14px; color: #111827; }
      .campus-body-paragraph { margin: 0; }
      .campus-body-paragraph + .campus-body-paragraph { margin-top: 10px; }
      .campus-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .campus-tag {
        display: inline-flex;
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(253, 224, 71, 0.22);
        color: #854d0e;
        font-size: 11px;
        font-weight: 700;
      }
      .campus-toolbar {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px dashed rgba(245, 158, 11, 0.3);
        font-size: 12px;
        color: #a16207;
        font-weight: 800;
      }
      .campus-comments {
        margin-top: 12px;
        border-radius: 16px;
        background: rgba(248, 250, 252, 0.9);
        padding: 10px 12px;
      }
      .campus-comments-title {
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 800;
        color: rgba(107, 114, 128, 0.86);
      }
      .campus-floor + .campus-floor { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(229, 231, 235, 0.9); }
      .campus-floor-head { display: flex; align-items: center; gap: 8px; }
      .campus-floor-index { font-size: 11px; font-weight: 800; color: #a16207; }
      .campus-comment-name { font-weight: 700; color: #854d0e; }
      .campus-comment-badge { margin-left: 6px; font-size: 10px; color: #b45309; font-weight: 700; }
      .campus-floor-text { margin-top: 4px; font-size: 13px; line-height: 1.72; color: #374151; }
      .campus-caption { padding: 0 14px; font-size: 12px; line-height: 1.6; color: rgba(75, 85, 99, 0.82); }
    </style>
  </head>
  <body>
    <div class="campus-shell">
      <div class="campus-topbar">
        <div class="campus-topbar-side">‹</div>
        <div class="campus-topbar-title">校园论坛</div>
        <div class="campus-topbar-side">⋯</div>
      </div>
      <div class="campus-tabs">
        <div class="campus-tab is-active">广场</div>
        <div class="campus-tab">求助</div>
        <div class="campus-tab">匿名墙</div>
        <div class="campus-tab">热帖</div>
      </div>
      <div class="campus-thread-list">
        ${cardsMarkup}
      </div>
      ${pageEpisode.caption ? `<div class="campus-caption">${escapePageHtml(pageEpisode.caption)}</div>` : ''}
    </div>
  </body>
</html>
  `.trim();
}

function buildMomentsPageEpisodeSrcDoc(
  pageEpisode: DatingPageEpisode,
  options: {
    characterAvatarUrl: string;
    characterName: string;
  },
): string {
  const feed = pageEpisode.feed;
  if (!feed) {
    return '';
  }

  const feedItems = resolvePageEpisodeFeedItems(feed);
  const cardsMarkup = feedItems.map((item) => {
    const avatarMarkup = buildPageAvatarMarkup(options.characterAvatarUrl, item.authorName || options.characterName);
    const commentsMarkup = buildFeedCommentRows(item.comments, 'moments');
    const topicsMarkup = buildTopicPills(item.topics, 'moments-tag');

    return `
      <div class="moments-card">
        <div class="moments-head">
          ${avatarMarkup.replace('class="wx-avatar', 'class="moments-avatar')}
          <div>
            <div class="moments-name">${escapePageHtml(item.authorName)}</div>
            ${(item.authorBadge || pageEpisode.subtitle) ? `<div class="moments-subtitle">${escapePageHtml(item.authorBadge || pageEpisode.subtitle || '')}</div>` : ''}
            ${item.headline ? `<div class="moments-headline">${escapePageHtml(item.headline)}</div>` : ''}
            <div class="moments-body">${escapePageHtml(item.body)}</div>
            ${topicsMarkup ? `<div class="moments-tags">${topicsMarkup}</div>` : ''}
            <div class="moments-meta">
              <span>${escapePageHtml(item.timestampLabel || '1分钟前')}</span>
              <span class="moments-actions">${escapePageHtml(item.likeCountLabel || '99+')} · ${escapePageHtml(item.commentCountLabel || '评论')}</span>
            </div>
            ${(item.comments.length > 0 || item.likeCountLabel) ? `
              <div class="moments-social">
                <div class="moments-likes">${escapePageHtml(item.authorName)} ${escapePageHtml(item.likeCountLabel ? `及其他人点赞 ${item.likeCountLabel}` : '及其他人点赞')}</div>
                ${commentsMarkup ? `<div class="moments-comments">${commentsMarkup}</div>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `.trim();
  }).join('\n');

  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePageHtml(pageEpisode.title || feedItems[0]?.authorName || '')}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: #f7f7f7;
        color: #111827;
      }
      body { padding: 0; }
      .moments-shell {
        min-height: 100vh;
        background: linear-gradient(180deg, rgba(245, 247, 250, 0.98) 0%, rgba(250, 250, 250, 0.98) 100%);
      }
      .moments-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 14px 10px;
        font-size: 16px;
        font-weight: 700;
        color: #111827;
      }
      .moments-topbar-side { width: 32px; text-align: center; font-size: 20px; color: rgba(17, 24, 39, 0.9); }
      .moments-card { margin: 0; padding: 8px 16px 24px; }
      .moments-card + .moments-card {
        margin-top: 6px;
        padding-top: 18px;
        border-top: 6px solid rgba(17, 24, 39, 0.04);
      }
      .moments-head {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }
      .moments-avatar {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        object-fit: cover;
        background: #dbe4ee;
      }
      .moments-name { font-size: 16px; font-weight: 700; color: #576b95; }
      .moments-subtitle { margin-top: 4px; font-size: 12px; color: rgba(107, 114, 128, 0.82); }
      .moments-headline { margin-top: 10px; font-size: 15px; font-weight: 800; color: #111827; }
      .moments-body {
        margin-top: 10px;
        font-size: 15px;
        line-height: 1.82;
        color: #111827;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .moments-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .moments-tag {
        display: inline-flex;
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(22, 163, 74, 0.12);
        color: #15803d;
        font-size: 11px;
        font-weight: 700;
      }
      .moments-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 14px;
        font-size: 12px;
        color: rgba(107, 114, 128, 0.84);
      }
      .moments-actions { display: inline-flex; align-items: center; gap: 10px; color: #576b95; font-weight: 600; }
      .moments-social {
        margin-top: 10px;
        border-radius: 0;
        background: #f0f6ef;
        border-top: 1px solid rgba(17, 24, 39, 0.06);
        border-bottom: 1px solid rgba(17, 24, 39, 0.06);
        overflow: hidden;
      }
      .moments-likes { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-size: 13px; font-weight: 700; color: #3b9f5a; }
      .moments-comments { padding: 4px 12px 10px; }
      .moments-comment { font-size: 13px; line-height: 1.72; color: #1f2937; }
      .moments-comment + .moments-comment { margin-top: 8px; }
      .moments-comment-name { font-weight: 700; color: #1f6fb2; }
      .moments-comment-badge { display: inline-flex; margin-left: 6px; padding: 1px 5px; border-radius: 999px; background: rgba(239, 68, 68, 0.12); color: #ef4444; font-size: 10px; font-weight: 700; }
      .moments-comment-text { margin-left: 6px; }
      .moments-caption { margin: 12px 16px 0; font-size: 12px; line-height: 1.6; color: rgba(107, 114, 128, 0.82); }
    </style>
  </head>
  <body>
    <div class="moments-shell">
      <div class="moments-topbar">
        <div class="moments-topbar-side">‹</div>
        <div>朋友圈</div>
        <div class="moments-topbar-side">⋯</div>
      </div>
      <div class="moments-list">
        ${cardsMarkup}
      </div>
      ${pageEpisode.caption ? `<div class="moments-caption">${escapePageHtml(pageEpisode.caption)}</div>` : ''}
    </div>
  </body>
</html>
  `.trim();
}

function buildDocumentPageEpisodeSrcDoc(pageEpisode: DatingPageEpisode): string {
  const documentView = pageEpisode.document;
  if (!documentView) {
    return '';
  }

  const documentText = `${documentView.title} ${documentView.subtitle || ''} ${documentView.intro || ''}`.trim();
  const flavor = /问卷|调查|survey/u.test(documentText)
    ? 'survey'
    : /报名|申请|招募|signup/u.test(documentText)
      ? 'signup'
      : /公告|通知|notice|announcement/u.test(documentText)
        ? 'notice'
        : 'document';
  const sectionsMarkup = documentView.sections.map((section, index) => {
    if (flavor === 'survey') {
      return `
        <section class="doc-section doc-section--survey">
          <div class="doc-question-no">Q${index + 1}</div>
          <div class="doc-question-main">
            ${section.heading ? `<div class="doc-heading">${escapePageHtml(section.heading)}</div>` : `<div class="doc-heading">问题 ${index + 1}</div>`}
            <div class="doc-body">${escapePageHtml(section.body)}</div>
          </div>
        </section>
      `.trim();
    }

    if (flavor === 'signup') {
      return `
        <section class="doc-section doc-section--signup">
          ${section.heading ? `<div class="doc-heading">${escapePageHtml(section.heading)}</div>` : `<div class="doc-heading">信息项 ${index + 1}</div>`}
          <div class="doc-body">${escapePageHtml(section.body)}</div>
        </section>
      `.trim();
    }

    if (flavor === 'notice') {
      return `
        <section class="doc-section doc-section--notice">
          ${section.heading ? `<div class="doc-heading">${escapePageHtml(section.heading)}</div>` : `<div class="doc-heading">通知事项</div>`}
          <div class="doc-body">${escapePageHtml(section.body)}</div>
        </section>
      `.trim();
    }

    return `
      <section class="doc-section">
        ${section.heading ? `<div class="doc-heading">${escapePageHtml(section.heading)}</div>` : ''}
        <div class="doc-body">${escapePageHtml(section.body)}</div>
      </section>
    `.trim();
  }).join('');

  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePageHtml(pageEpisode.title || documentView.title)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: ${flavor === 'survey'
    ? 'linear-gradient(180deg, #f4f7ff 0%, #eef2ff 100%)'
    : flavor === 'signup'
      ? 'linear-gradient(180deg, #fff8ef 0%, #fff1e6 100%)'
      : flavor === 'notice'
        ? 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
        : 'linear-gradient(180deg, #f4f4f5 0%, #eef2ff 100%)'};
        color: #111827;
      }
      body { padding: 18px 14px 28px; }
      .doc-shell {
        max-width: 440px;
        margin: 0 auto;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
        overflow: hidden;
      }
      .doc-header {
        padding: 18px 18px 14px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.9);
      }
      .doc-kicker {
        display: inline-flex;
        margin-bottom: 10px;
        padding: 4px 10px;
        border-radius: 999px;
        background: ${flavor === 'survey'
    ? 'rgba(59, 130, 246, 0.12)'
    : flavor === 'signup'
      ? 'rgba(249, 115, 22, 0.12)'
      : flavor === 'notice'
        ? 'rgba(71, 85, 105, 0.12)'
        : 'rgba(99, 102, 241, 0.12)'};
        color: ${flavor === 'survey'
    ? '#2563eb'
    : flavor === 'signup'
      ? '#ea580c'
      : flavor === 'notice'
        ? '#475569'
        : '#4f46e5'};
        font-size: 11px;
        font-weight: 800;
      }
      .doc-title {
        font-size: 20px;
        font-weight: 800;
      }
      .doc-subtitle {
        margin-top: 6px;
        font-size: 12px;
        color: rgba(75, 85, 99, 0.78);
      }
      .doc-intro {
        margin-top: 12px;
        line-height: 1.7;
        font-size: 13px;
        color: #374151;
        white-space: pre-wrap;
      }
      .doc-section {
        padding: 16px 18px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.76);
      }
      .doc-heading {
        font-size: 13px;
        font-weight: 700;
        color: ${flavor === 'survey'
    ? '#1d4ed8'
    : flavor === 'signup'
      ? '#c2410c'
      : flavor === 'notice'
        ? '#334155'
        : '#1d4ed8'};
      }
      .doc-body {
        margin-top: 8px;
        line-height: 1.72;
        font-size: 14px;
        color: #111827;
        white-space: pre-wrap;
      }
      .doc-section--survey {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }
      .doc-question-no {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.12);
        color: #2563eb;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
      }
      .doc-question-main {
        min-width: 0;
      }
      .doc-section--signup {
        border-left: 3px solid ${flavor === 'signup' ? '#ea580c' : '#cbd5e1'};
        background: rgba(255,255,255,0.72);
      }
      .doc-section--notice {
        background: rgba(248, 250, 252, 0.76);
        border-top: 1px dashed rgba(148, 163, 184, 0.36);
      }
      .doc-actions {
        display: flex;
        gap: 10px;
        padding: 18px;
      }
      .doc-btn {
        flex: 1;
        min-height: 42px;
        border-radius: 16px;
        border: none;
        font-size: 13px;
        font-weight: 700;
      }
      .doc-btn--primary {
        background: ${flavor === 'survey'
    ? '#1d4ed8'
    : flavor === 'signup'
      ? '#ea580c'
      : flavor === 'notice'
        ? '#334155'
        : '#1d4ed8'};
        color: #ffffff;
      }
      .doc-btn--secondary {
        background: #e5e7eb;
        color: #111827;
      }
    </style>
  </head>
  <body>
    <div class="doc-shell">
      <div class="doc-header">
        <div class="doc-kicker">${flavor === 'survey'
    ? '调查问卷'
    : flavor === 'signup'
      ? '报名表'
      : flavor === 'notice'
        ? '公告通知'
        : '文档页'}</div>
        <div class="doc-title">${escapePageHtml(documentView.title)}</div>
        ${documentView.subtitle ? `<div class="doc-subtitle">${escapePageHtml(documentView.subtitle)}</div>` : ''}
        ${documentView.intro ? `<div class="doc-intro">${escapePageHtml(documentView.intro)}</div>` : ''}
      </div>
      ${sectionsMarkup}
      ${(documentView.primaryActionLabel || documentView.secondaryActionLabel) ? `
        <div class="doc-actions">
          ${documentView.secondaryActionLabel ? `<button class="doc-btn doc-btn--secondary">${escapePageHtml(documentView.secondaryActionLabel)}</button>` : ''}
          ${documentView.primaryActionLabel ? `<button class="doc-btn doc-btn--primary">${escapePageHtml(documentView.primaryActionLabel)}</button>` : ''}
        </div>
      ` : ''}
    </div>
  </body>
</html>
  `.trim();
}

function buildPageEpisodeSrcDoc(
  pageEpisode: DatingPageEpisode | undefined,
  options: {
    userAvatarUrl: string;
    characterAvatarUrl: string;
    userName: string;
    characterName: string;
  },
): string {
  if (!pageEpisode) {
    return '';
  }

  if (pageEpisode.pageType === 'wechat_chat') {
    return buildWeChatPageEpisodeSrcDoc(pageEpisode, options);
  }

  if (pageEpisode.pageType === 'feed_post') {
    if (pageEpisode.platform === 'moments') {
      return buildMomentsPageEpisodeSrcDoc(pageEpisode, options);
    }
    if (pageEpisode.platform === 'weibo') {
      return buildWeiboPageEpisodeSrcDoc(pageEpisode, options);
    }
    if (pageEpisode.platform === 'xiaohongshu') {
      return buildXiaohongshuPageEpisodeSrcDoc(pageEpisode, options);
    }
    if (pageEpisode.platform === 'netease') {
      return buildNeteasePageEpisodeSrcDoc(pageEpisode, options);
    }
    if (pageEpisode.platform === 'campus') {
      return buildCampusPageEpisodeSrcDoc(pageEpisode, options);
    }
    return buildGenericFeedPageEpisodeSrcDoc(pageEpisode, options);
  }

  if (pageEpisode.pageType === 'document_page') {
    return buildDocumentPageEpisodeSrcDoc(pageEpisode);
  }

  if (pageEpisode.pageType === 'micro_app' || pageEpisode.pageType === 'custom_html') {
    return buildCustomPageEpisodeSrcDoc({
      pageType: pageEpisode.pageType,
      title: pageEpisode.title,
      subtitle: pageEpisode.subtitle,
      caption: pageEpisode.caption,
      htmlDocument: pageEpisode.htmlDocument,
    });
  }

  return '';
}

function resolvePageEpisodeSandbox(pageEpisode: DatingPageEpisode | undefined): string {
  if (!pageEpisode) {
    return 'allow-same-origin';
  }

  if (pageEpisode.pageType === 'micro_app' || pageEpisode.pageType === 'custom_html') {
    return 'allow-scripts';
  }

  return 'allow-same-origin';
}

function isNarrativeCompatibleConstraint(line: string): boolean {
  return !/状态栏|html|页面|js|css|svg|canvas|按钮|点击|切换页面|切页|width|height|max-width|min-height/u.test(line);
}

function buildNarrativeFallbackDirective(
  plan: ReturnType<typeof compileSpecialDirective>,
  rawInstruction?: string,
): string {
  if (!plan) {
    return [
      '暂停当前主线，按原事件生成普通番外剧情。',
      '不要页面形式，不要 html，只输出剧情。',
      rawInstruction?.trim() || '',
    ].filter(Boolean).join('\n');
  }

  return [
    '暂停当前主线，按同一事件骨架生成普通番外剧情。',
    '不要页面形式，不要 html，不要平台壳，只输出剧情。',
    ...plan.eventPlan,
    ...plan.hardConstraints.filter(isNarrativeCompatibleConstraint),
    plan.softPreferences.length > 0
      ? '下面这些风格偏好只有在不违背角色原设时才允许轻量采用：'
      : '',
    ...plan.softPreferences,
  ].filter(Boolean).join('\n');
}

function buildCustomHtmlFallbackDirective(
  plan: ReturnType<typeof compileSpecialDirective>,
  rawInstruction?: string,
): string {
  if (!plan) {
    return [
      '暂停当前主线，生成一个自定义 html 页面。',
      rawInstruction?.trim() || '',
    ].filter(Boolean).join('\n');
  }

  return [
    '暂停当前主线，基于同一事件骨架生成一个自定义 html 页面。',
    '不要使用平台模板，允许直接输出完整 htmlDocument。',
    ...plan.eventPlan,
    ...plan.hardConstraints,
    plan.softPreferences.length > 0
      ? '下面这些风格偏好只有在不违背角色原设时才允许轻量采用：'
      : '',
    ...plan.softPreferences,
  ].filter(Boolean).join('\n');
}

function buildPlatformPageFallbackDirective(
  plan: ReturnType<typeof compileSpecialDirective>,
  rawInstruction?: string,
): string {
  if (!plan) {
    return [
      '暂停当前主线，生成一个平台模板页番外。',
      rawInstruction?.trim() || '',
    ].filter(Boolean).join('\n');
  }

  const platformLabel = plan.platform === 'wechat'
    ? '微信聊天页'
    : plan.platform === 'moments'
      ? '朋友圈页'
      : plan.platform === 'weibo'
        ? '微博页'
        : plan.platform === 'xiaohongshu'
          ? '小红书页'
          : plan.platform === 'netease'
            ? '网易云风页面'
            : plan.platform === 'survey'
              ? '问卷文档页'
              : plan.platform === 'campus'
                ? '校园风页面'
                : '平台模板页';

  return [
    `暂停当前主线，基于同一事件骨架改成${platformLabel}。`,
    '不要自定义 html，不要自由布局，优先使用平台模板化页面结构。',
    ...plan.eventPlan,
    ...plan.hardConstraints,
    plan.softPreferences.length > 0
      ? '下面这些风格偏好只有在不违背角色原设时才允许轻量采用：'
      : '',
    ...plan.softPreferences,
  ].filter(Boolean).join('\n');
}

function parseGeneratedContent(text: string): Partial<DatingGeneratedContent> | null {
  const candidates = extractCandidateJsonObjects(text);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  console.warn('[dating-scene] Ignoring invalid generated JSON payload.', {
    rawPreview: buildRawPreview(text),
    extractedPreview: buildRawPreview(candidates[0] || text),
  });
  return null;
}

function parseEndingSequencePayload(text: string): EndingSequencePayload | null {
  const candidates = extractCandidateJsonObjects(text);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<EndingSequencePayload>;
      const monologue = parsed.monologue?.trim();
      const chatFollowup = parsed.chatFollowup?.trim();

      if (monologue && chatFollowup) {
        return {
          monologue,
          chatFollowup,
        };
      }
    } catch {
      continue;
    }
  }

  console.warn('[dating-scene] Ignoring invalid ending payload.', {
    rawPreview: buildRawPreview(text),
    extractedPreview: buildRawPreview(candidates[0] || text),
  });
  return null;
}

function normalizeGeneratedContent(
  parsed: Partial<DatingGeneratedContent> | null | undefined,
  session: DateSession,
  character: Character,
  directorInstructionOverride?: string,
): DatingGeneratedContent {
  const fallback = createEmptyGeneratedContent(session, character);
  const appliedDirectorInstruction = (directorInstructionOverride || session.directorInstruction || '').trim() || undefined;
  const compiledDirective = compileSpecialDirective(appliedDirectorInstruction);
  const pageEpisode = normalizePageEpisode(
    parsed?.pageEpisode,
    parsed?.narrative?.title?.trim() || session.scenario || '页面番外',
    character,
    compiledDirective?.platform,
    compiledDirective?.pageType,
    appliedDirectorInstruction,
  );
  const narrativeSegments = (parsed?.narrative?.segments || [])
    .map(segment => ({
      type: (segment.type === 'dialogue' ? 'dialogue' : 'narration') as 'dialogue' | 'narration',
      text: segment.text?.trim() || '',
    }))
    .filter(segment => segment.text);
  const resolvedNarrativeSegments = narrativeSegments.length > 0
    ? narrativeSegments
    : pageEpisode?.caption
      ? [{
          type: 'narration' as const,
          text: pageEpisode.caption,
        }]
      : [];
  const memoryWritebackPolicy = resolveDatingGeneratedMemoryWritebackPolicy({
    session,
    generatedContent: {
      appliedDirectorInstruction,
      memoryWritebackPolicy: parsed?.memoryWritebackPolicy,
    },
  });

  return {
    mode: parsed?.mode === 'page_episode' || pageEpisode ? 'page_episode' : 'scene',
    appliedDirectorInstruction,
    memoryWritebackPolicy,
    background: {
      source: session.backgroundSource || fallback.background.source,
      image: session.backgroundImage || fallback.background.image,
      atmosphere: parsed?.background?.atmosphere?.trim() || '',
      focus: parsed?.background?.focus?.trim() || '',
    },
    narrative: {
      title: parsed?.narrative?.title?.trim() || pageEpisode?.title || '',
      subtitle: parsed?.narrative?.subtitle?.trim() || pageEpisode?.subtitle || '',
      segments: resolvedNarrativeSegments,
    },
    status: {
      location: parsed?.status?.location?.trim() || session.location || '',
      time: parsed?.status?.time?.trim() || '',
      mood: parsed?.status?.mood?.trim() || session.mood || '',
      innerThought: parsed?.status?.innerThought?.trim() || '',
    },
    playlist: (parsed?.playlist || []).slice(0, 5).map(song => ({
      title: song.title?.trim() || '未命名歌曲',
      artist: song.artist?.trim() || '未知歌手',
      note: song.note?.trim() || '',
    })),
    pageEpisode,
  };
}

function resolveAppliedDirectorInstruction(
  message: DateMessage | undefined,
  session: DateSession,
): string | undefined {
  return message?.generatedContent?.appliedDirectorInstruction?.trim()
    || session.directorInstruction?.trim()
    || undefined;
}

export function DatingScene({
  session,
  startToken,
  directorLaunchToken = 0,
  initialDirectorSection,
  character,
  userProfile,
  activeConfig,
  chatHistory,
  activeMask,
  worldBooks,
  perception,
  onBackToPlanner,
  onClose,
  onSaveDate,
  onCollectDate,
  onEndDateComplete,
  autoSaveEnabled = false,
}: DatingSceneProps) {
  const [currentSession, setCurrentSession] = useState<SceneSessionState>(() => ({
    ...session,
    status: session.status || 'active',
    endedAt: session.endedAt,
    messages: normalizeDateSessionMessages(session),
    isCollected: (session as SceneSessionState).isCollected || false,
  }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [rollbackMode, setRollbackMode] = useState(false);
  const [selectedRollbackMessageId, setSelectedRollbackMessageId] = useState<string | null>(null);
  const [roundEditDraft, setRoundEditDraft] = useState('');
  const [editingSceneMessageId, setEditingSceneMessageId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryPayload, setRetryPayload] = useState<{
    mode: 'start' | 'continue';
    session: SceneSessionState;
  } | null>(null);
  const [backgroundBroken, setBackgroundBroken] = useState(false);
  const [statusExpandedMap, setStatusExpandedMap] = useState<Record<string, boolean>>({});
  const [playlistExpandedMap, setPlaylistExpandedMap] = useState<Record<string, boolean>>({});
  const [pageStoryExpandedMap, setPageStoryExpandedMap] = useState<Record<string, boolean>>({});
  const [endingState, setEndingState] = useState<'idle' | 'generating' | 'ready' | 'returning'>('idle');
  const [endingMonologue, setEndingMonologue] = useState('');
  const [endingRevealCount, setEndingRevealCount] = useState(0);
  const [endingReturnText, setEndingReturnText] = useState('');
  const [endingError, setEndingError] = useState('');
  const [endingRipple, setEndingRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [endingCurtainVisible, setEndingCurtainVisible] = useState(false);
  const [showUnsavedBackDialog, setShowUnsavedBackDialog] = useState(false);
  const requestedStartTokenRef = useRef<number | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const endingScreenRef = useRef<HTMLButtonElement | null>(null);
  const endingContentRef = useRef<HTMLDivElement | null>(null);
  const endingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const endingFlowActiveRef = useRef(false);
  const generationInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const continueGeneratingAfterCloseRef = useRef(false);
  const endingParticlesRef = useRef<EndingParticle[]>([]);
  const endingAnimationFrameRef = useRef<number | null>(null);
  const endingParticleKickoffTimeoutRef = useRef<number | null>(null);
  const endingCurtainTimeoutRef = useRef<number | null>(null);
  const endingCompleteTimeoutRef = useRef<number | null>(null);
  const latestSceneInfo = React.useMemo(
    () => findLatestSceneMessage(currentSession.messages),
    [currentSession.messages],
  );
  const relationshipDirectorSummary = React.useMemo(() => {
    const lines = [
      currentSession.relationshipStageOverride && currentSession.relationshipStageOverride !== 'auto'
        ? `关系阶段：${
            currentSession.relationshipStageOverride === 'intimate'
              ? '已亲密'
              : currentSession.relationshipStageOverride === 'growing'
                ? '升温中'
                : '谨慎基线'
          }`
        : '关系阶段：自动继承',
      currentSession.allowAdultIntimacy ? '成人亲密：允许' : '成人亲密：默认',
    ];
    return lines.join('\n');
  }, [currentSession.allowAdultIntimacy, currentSession.relationshipStageOverride]);
  const clearEndingVisualTimers = () => {
    if (endingParticleKickoffTimeoutRef.current !== null) {
      window.clearTimeout(endingParticleKickoffTimeoutRef.current);
      endingParticleKickoffTimeoutRef.current = null;
    }
    if (endingCurtainTimeoutRef.current !== null) {
      window.clearTimeout(endingCurtainTimeoutRef.current);
      endingCurtainTimeoutRef.current = null;
    }
    if (endingCompleteTimeoutRef.current !== null) {
      window.clearTimeout(endingCompleteTimeoutRef.current);
      endingCompleteTimeoutRef.current = null;
    }
  };

  const stopEndingParticleAnimation = () => {
    if (endingAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(endingAnimationFrameRef.current);
      endingAnimationFrameRef.current = null;
    }

    endingParticlesRef.current = [];
    const canvas = endingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearEndingVisualTimers();
      stopEndingParticleAnimation();
    };
  }, []);

  useEffect(() => {
    const normalizedMessages = normalizeDateSessionMessages(session);

    if (endingFlowActiveRef.current && session.id === currentSession.id) {
      setCurrentSession(prev => ({
        ...prev,
        ...session,
        status: session.status || prev.status || 'active',
        endedAt: session.endedAt,
        messages: normalizedMessages,
        generatedContent: getLatestGeneratedContent(normalizedMessages, session.generatedContent),
        isCollected: (session as SceneSessionState).isCollected || prev.isCollected || false,
      }));
      return;
    }

    setCurrentSession({
      ...session,
      status: session.status || 'active',
      endedAt: session.endedAt,
      messages: normalizedMessages,
      generatedContent: getLatestGeneratedContent(normalizedMessages, session.generatedContent),
      isCollected: (session as SceneSessionState).isCollected || false,
    });
    setMenuOpen(false);
    setRollbackMode(false);
    setSelectedRollbackMessageId(null);
    setError('');
    setShowStickerPanel(false);
    setBackgroundBroken(false);
    setStatusExpandedMap({});
    setPlaylistExpandedMap({});
    setEndingState('idle');
    setEndingMonologue('');
    setEndingRevealCount(0);
    setEndingReturnText('');
    setEndingError('');
    setEndingRipple(null);
    setEndingCurtainVisible(false);
    setShowUnsavedBackDialog(false);
    clearEndingVisualTimers();
    stopEndingParticleAnimation();
    setRetryPayload(
      session.pendingRoundRetry
        ? {
            mode: session.pendingRoundRetry.mode,
            session: session.pendingRoundRetry.session as SceneSessionState,
          }
        : null,
    );
    setError(session.pendingRoundError || '');
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession.messages, isLoading]);

  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = '0px';
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [input]);

  useEffect(() => {
    if (endingState !== 'ready' || endingDisplayLines.length === 0) {
      setEndingRevealCount(0);
      return;
    }

    setEndingRevealCount(0);
    const timer = window.setInterval(() => {
      setEndingRevealCount(prev => {
        const next = prev + 1;
        if (next >= endingDisplayLines.length) {
          window.clearInterval(timer);
          return endingDisplayLines.length;
        }
        return next;
      });
    }, 350);

    return () => window.clearInterval(timer);
  }, [endingMonologue, endingState]);

  useEffect(() => {
    if (!startToken) return;
    if (requestedStartTokenRef.current === startToken) return;
    requestedStartTokenRef.current = startToken;

    if (normalizeDateSessionMessages(session).length === 0) {
      void generateRound({ mode: 'start', baseSession: session });
    }
  }, [startToken, session]);

  useEffect(() => {
    const phoneContainer = document.getElementById('phone-container');
    const phoneScreenRoot = phoneContainer?.querySelector('.phone-screen-root');

    phoneContainer?.classList.add('is-dating-scene');
    phoneScreenRoot?.classList.add('is-dating-scene');

    return () => {
      phoneContainer?.classList.remove('is-dating-scene');
      phoneScreenRoot?.classList.remove('is-dating-scene');
    };
  }, []);

  const backgroundInfo = resolveDateSessionBackground(currentSession, character.avatar);
  const { resolvedUrl: resolvedBackgroundImageUrl } = useResolvedPersistentValue(backgroundInfo.image);
  const { resolvedUrl: resolvedCharacterAvatarUrl } = useResolvedPersistentValue(character.avatar);
  const { resolvedUrl: resolvedUserAvatarUrl } = useResolvedPersistentValue(userProfile.avatar);
  const backgroundImage = backgroundBroken
    ? character.avatar
    : getDisplayableAssetValue(
        backgroundInfo.source === 'character-avatar' ? character.avatar : backgroundInfo.image,
        resolvedBackgroundImageUrl,
      ) || '';
  const endingDisplayName = formatEndingCharacterName(character.name);
  const endingDisplayLines = splitEndingMonologue(endingMonologue);
  const endingHighlightIndex = endingDisplayLines.length > 0 ? endingDisplayLines.length - 1 : -1;

  const buildEndingParticles = () => {
    const screen = endingScreenRef.current;
    const content = endingContentRef.current;
    const canvas = endingCanvasRef.current;

    if (!screen || !content || !canvas) {
      return [] as EndingParticle[];
    }

    const screenRect = screen.getBoundingClientRect();
    const width = Math.max(1, Math.round(screenRect.width));
    const height = Math.max(1, Math.round(screenRect.height));

    canvas.width = width;
    canvas.height = height;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) {
      return [] as EndingParticle[];
    }

    const drawableElements = content.querySelectorAll<HTMLElement>(
      '.dating-scene__ending-name, .dating-scene__ending-line',
    );

    drawableElements.forEach((element) => {
      drawElementTextToCanvas(offscreenCtx, element, screenRect);
    });

    const density = 2;
    const imageData = offscreenCtx.getImageData(0, 0, width, height).data;
    const particles: EndingParticle[] = [];

    for (let y = 0; y < height; y += density) {
      for (let x = 0; x < width; x += density) {
        const index = (y * width + x) * 4;
        const alpha = imageData[index + 3];
        if (alpha <= 35) continue;

        const angle = Math.random() * Math.PI * 2;
        const speed = 0.12 + Math.random() * 0.5;

        particles.push({
          x: x + (Math.random() - 0.5) * density,
          y: y + (Math.random() - 0.5) * density,
          color: `rgba(${imageData[index]}, ${imageData[index + 1]}, ${imageData[index + 2]}, ${(alpha / 255).toFixed(2)})`,
          size: 0.55 + Math.random() * 0.9,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.15,
          life: 1,
          decay: 0.004 + Math.random() * 0.005,
          delay: Math.random() * 55,
          wiggle: Math.random() * Math.PI * 2,
        });
      }
    }

    return particles;
  };

  const finalizeEndingReturn = (archivedSession: SceneSessionState) => {
    clearEndingVisualTimers();
    endingCompleteTimeoutRef.current = window.setTimeout(() => {
      endingFlowActiveRef.current = false;
      void Promise.resolve(onEndDateComplete({
        archivedSession,
        returnChatText: endingReturnText.trim(),
      })).catch((error) => {
        console.error('[dating-scene] Failed to complete ending return', error);
      });
    }, 2800);
  };

  const revealEndingCurtain = (archivedSession: SceneSessionState) => {
    stopEndingParticleAnimation();
    setEndingCurtainVisible(true);
    finalizeEndingReturn(archivedSession);
  };

  const startEndingParticleAnimation = (archivedSession: SceneSessionState) => {
    const canvas = endingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      revealEndingCurtain(archivedSession);
      return;
    }

    const particles = buildEndingParticles();
    if (particles.length === 0) {
      revealEndingCurtain(archivedSession);
      return;
    }

    endingParticlesRef.current = particles;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = 0;
      endingParticlesRef.current.forEach((particle) => {
        if (particle.delay > 0) {
          particle.delay -= 1;
          alive += 1;
          return;
        }

        particle.wiggle += 0.04;
        particle.vx += Math.sin(particle.wiggle) * 0.007;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;

        if (particle.life <= 0) {
          return;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, particle.life * particle.life);
        ctx.fillStyle = particle.color;
        if (particle.size > 1.2) {
          ctx.shadowBlur = 3;
          ctx.shadowColor = particle.color;
        }
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * Math.max(particle.life, 0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        alive += 1;
      });

      if (alive > 0) {
        endingAnimationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      endingAnimationFrameRef.current = null;
      revealEndingCurtain(archivedSession);
    };

    tick();
  };

  const saveSession = (nextSession: SceneSessionState, options?: { preserveSaved?: boolean }) => {
    const normalizedMessages = normalizeDateSessionMessages(nextSession);
    const merged = {
      ...nextSession,
      isSaved: autoSaveEnabled ? true : options?.preserveSaved ? Boolean(nextSession.isSaved) : false,
      pendingRoundRetry: nextSession.pendingRoundRetry || null,
      pendingRoundError: nextSession.pendingRoundError || '',
      messages: normalizedMessages,
      generatedContent: getLatestGeneratedContent(normalizedMessages, nextSession.generatedContent),
    };
    if (isMountedRef.current) {
      setCurrentSession(merged);
    }
    if (autoSaveEnabled) {
      onSaveDate(merged);
    }
  };

  const persistSession = (nextSession: SceneSessionState) => {
    const normalizedMessages = normalizeDateSessionMessages(nextSession);
    const merged = {
      ...nextSession,
      isSaved: true,
      status: nextSession.status || 'active',
      endedAt: nextSession.status === 'ended' ? nextSession.endedAt : undefined,
      pendingRoundRetry: null,
      pendingRoundError: '',
      messages: normalizedMessages,
      generatedContent: getLatestGeneratedContent(normalizedMessages, nextSession.generatedContent),
    };
    if (isMountedRef.current) {
      setCurrentSession(merged);
    }
    onSaveDate(merged);
  };

  const rewriteLatestRound = async (sessionPatch: Partial<SceneSessionState> = {}) => {
    return rewriteLatestRoundWithMode(sessionPatch, undefined);
  };

  const rewriteLatestRoundWithMode = async (
    sessionPatch: Partial<SceneSessionState> = {},
    directorMode?: 'rewrite' | 'next_round',
    directorInstructionOverride?: string,
  ) => {
    if (isLoading) {
      return;
    }

    setEditingSceneMessageId(null);
    setRoundEditDraft('');

    const latestScene = findLatestSceneMessage(currentSession.messages);
    if (!latestScene) {
      saveSession({
        ...currentSession,
        ...sessionPatch,
      }, { preserveSaved: true });
      return;
    }

    const baseMessages = currentSession.messages.slice(0, latestScene.index);
    const latestUserText = [...baseMessages]
      .reverse()
      .find((message) => message.role === 'user' && message.text.trim())
      ?.text;
    const effectiveDirectorInstructionOverride = directorInstructionOverride
      || resolveAppliedDirectorInstruction(latestScene.message, currentSession);
    const baseSession: SceneSessionState = {
      ...currentSession,
      ...sessionPatch,
      pendingRoundRetry: null,
      pendingRoundError: '',
      messages: baseMessages,
      generatedContent: getLatestGeneratedContent(baseMessages),
    };

    await generateRound({
      mode: baseMessages.length === 0 ? 'start' : 'continue',
      latestUserInput: baseMessages.length > 0 ? latestUserText : undefined,
      baseSession,
      directorMode,
      directorInstructionOverride: effectiveDirectorInstructionOverride,
    });
  };

  const hasUnsavedProgress = Boolean(
    currentSession.messages.length > 0
      && (currentSession.status || 'active') === 'active'
      && !currentSession.isSaved
      && !autoSaveEnabled,
  );

  const handleBackAttempt = () => {
    if (isLoading) {
      handleLeaveAndContinueGenerating();
      return;
    }

    if (hasUnsavedProgress) {
      setMenuOpen(false);
      setShowStickerPanel(false);
      setRollbackMode(false);
      setSelectedRollbackMessageId(null);
      setShowUnsavedBackDialog(true);
      return;
    }

    onBackToPlanner();
  };

  const handleSaveAndLeave = () => {
    persistSession(currentSession);
    setShowUnsavedBackDialog(false);
    onBackToPlanner();
  };

  const handleDiscardAndLeave = () => {
    setShowUnsavedBackDialog(false);
    onBackToPlanner();
  };

  const handleLeaveAndContinueGenerating = () => {
    continueGeneratingAfterCloseRef.current = true;
    persistSession({
      ...currentSession,
      status: currentSession.status || 'active',
    });
    onBackToPlanner();
  };

  const buildEndingSequencePrompt = (archivedSession: SceneSessionState) => {
    const latestGeneratedContent = getLatestGeneratedContent(archivedSession.messages, archivedSession.generatedContent);
    const latestNarrative = latestGeneratedContent?.narrative.segments.map(segment => segment.text).join('\n') || '';
    const latestStatus = latestGeneratedContent?.status;
    const recentUserMessages = archivedSession.messages
      .filter(message => message.role === 'user')
      .slice(-4)
      .map(message => `- ${message.text}`)
      .join('\n');
    const temporalContext = buildTemporalContextPrompt({
      perception,
      now: archivedSession.endedAt || Date.now(),
    });

    return [
      `你现在要为角色 ${character.name} 生成“结束约会后的收尾内容”。`,
      '请严格只输出 JSON，不要输出解释、前缀、Markdown。',
      'JSON 格式如下：',
      '{"monologue":"1到2句角色内心独白","chatFollowup":"回到线上聊天后角色主动发给用户的一句话"}',
      '要求：',
      '- monologue 必须是角色心里正在想的话，偏克制、收束、带回味，不要写动作说明。',
      '- monologue 只能 1 到 2 句。',
      '- monologue 优先写成适合视觉断行的短句结构，最好能自然切成 2 到 4 行，最后一句更适合作为收束高亮。',
      '- chatFollowup 必须是线上聊天语境的一句话，不要再写线下现场动作，不要继续约会场景描写。',
      '- chatFollowup 要自然像回到聊天软件后的主动开口。',
      temporalContext,
      `角色当前信息：心情=${archivedSession.mood || '未设定'}；地点=${archivedSession.location || '未设定'}；场景=${archivedSession.scenario || '未设定'}。`,
      latestStatus
        ? `本轮结束时的状态：地点=${latestStatus.location || archivedSession.location || '未设定'}；时间=${latestStatus.time || '未设定'}；心情=${latestStatus.mood || archivedSession.mood || '未设定'}；内心=${latestStatus.innerThought || '未设定'}。`
        : '',
      latestNarrative ? `本轮约会最后的主要内容：\n${latestNarrative}` : '',
      recentUserMessages ? `用户本轮最近说过的话：\n${recentUserMessages}` : '',
      chatHistory.length > 0
        ? `你们线上聊天最近的语气参考：\n${chatHistory
            .slice(-6)
            .map(message => `${message.role === 'user' ? userProfile.name : character.name}：${message.text}`)
            .join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const generateEndingSequence = async (archivedSession: SceneSessionState) => {
    const rawText = await generateTextFromMessagesWithConfig({
      activeConfig,
      messages: [
        {
          role: 'user',
          content: buildEndingSequencePrompt(archivedSession),
        },
      ],
    });

    const parsed = parseEndingSequencePayload(rawText);
    if (!parsed) {
      throw new Error('约会收尾内容生成失败，请稍后重试。');
    }

    return parsed;
  };

  const handleEndDate = async () => {
    if (endingState === 'generating' || endingState === 'ready' || endingState === 'returning') {
      return;
    }

    const archivedSession: SceneSessionState = {
      ...currentSession,
      status: 'ended',
      endedAt: Date.now(),
    };

    setMenuOpen(false);
    setEndingError('');
    setEndingMonologue('');
    setEndingReturnText('');
    setEndingRevealCount(0);
    setEndingRipple(null);
    setEndingCurtainVisible(false);
    clearEndingVisualTimers();
    stopEndingParticleAnimation();
    endingFlowActiveRef.current = true;
    setEndingState('generating');

    window.setTimeout(() => {
      persistSession(archivedSession);

      void (async () => {
        try {
          const endingPayload = await generateEndingSequence(archivedSession);
          setEndingMonologue(endingPayload.monologue);
          setEndingReturnText(endingPayload.chatFollowup);
          setEndingState('ready');
        } catch (err) {
          console.error('[dating-scene] ending sequence failed', err);
          setEndingError(err instanceof Error ? err.message : '约会收尾内容生成失败，请稍后重试。');
          setEndingState('ready');
        }
      })();
    }, 0);
  };

  const handleEndingScreenClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (endingState !== 'ready') {
      return;
    }

    const linesReady = endingDisplayLines.length === 0 || endingRevealCount >= endingDisplayLines.length;
    if (!linesReady) {
      setEndingRevealCount(endingDisplayLines.length);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setEndingRipple({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      key: Date.now(),
    });
    setEndingState('returning');
    setEndingCurtainVisible(false);
    clearEndingVisualTimers();
    stopEndingParticleAnimation();

    const archivedSession: SceneSessionState = {
      ...currentSession,
      status: 'ended',
      endedAt: currentSession.endedAt || Date.now(),
    };

    endingParticleKickoffTimeoutRef.current = window.setTimeout(() => {
      const maybeFonts = typeof document !== 'undefined' && 'fonts' in document
        ? (document.fonts.ready as Promise<unknown>)
        : Promise.resolve();

      maybeFonts
        .catch(() => undefined)
        .finally(() => {
          startEndingParticleAnimation(archivedSession);
        });
    }, 90);
  };

  const replaceMessage = (messages: DateMessage[], messageId: string, updater: (message: DateMessage) => DateMessage) =>
    messages.map(message => (message.id === messageId ? updater(message) : message));

  const generateRound = async ({
    mode,
    latestUserInput,
    baseSession,
    appendUserMessage = false,
    directorMode,
    directorInstructionOverride,
  }: {
    mode: 'start' | 'continue';
    latestUserInput?: string;
    baseSession?: DateSession;
    appendUserMessage?: boolean;
    directorMode?: 'rewrite' | 'next_round';
    directorInstructionOverride?: string;
  }) => {
    if (isLoading || generationInFlightRef.current) return;

    generationInFlightRef.current = true;
    setIsLoading(true);
    setError('');

    const sessionSeed: SceneSessionState = (baseSession as SceneSessionState) || currentSession;
    const normalizedSeed = normalizeDateSessionMessages(sessionSeed);
    let workingMessages = normalizedSeed;

    if (appendUserMessage && latestUserInput) {
      const userMessage: DateMessage = {
        id: createDateMessageId('user'),
        role: 'user',
        kind: 'user',
        text: latestUserInput,
        timestamp: Date.now(),
      };
      workingMessages = [...workingMessages, userMessage];
    }

    const retrySession: SceneSessionState = {
      ...sessionSeed,
      pendingRoundRetry: null,
      pendingRoundError: '',
      messages: workingMessages,
      generatedContent: getLatestGeneratedContent(workingMessages, sessionSeed.generatedContent),
    };

    const placeholderId = createDateMessageId('scene');
    const placeholderMessage: DateMessage = {
      id: placeholderId,
      role: 'model',
      kind: 'scene',
      text: '',
      timestamp: Date.now(),
      pending: true,
    };

    const pendingSession: SceneSessionState = {
      ...sessionSeed,
      pendingRoundRetry: null,
      pendingRoundError: '',
      messages: [...workingMessages, placeholderMessage],
      generatedContent: getLatestGeneratedContent(workingMessages, sessionSeed.generatedContent),
    };

    saveSession(pendingSession);

    try {
      const prompt = buildDatingPrompt({
        sceneInput: buildDatingSceneInput({
          mode,
          character,
          userProfile,
          activeMask,
          worldBooks,
          session: {
            ...pendingSession,
            messages: workingMessages,
            generatedContent: getLatestGeneratedContent(workingMessages, sessionSeed.generatedContent),
          },
          chatHistory,
          perception,
          latestUserInput,
          directorMode,
          directorInstructionOverride,
        }),
      });

      console.info('[dating-scene] prompt diagnostics', {
        promptLength: prompt.length,
        avatarLength: getSafeTextLength(character.avatar),
        backgroundImageLength: getSafeTextLength(pendingSession.backgroundImage),
        shortTermSummaryLength: getSafeTextLength(character.shortTermSummary),
        longTermMemoryProfileLength: getSafeTextLength(character.longTermMemoryProfile),
        backgroundSource: pendingSession.backgroundSource || 'character-avatar',
      });

      if (prompt.length > DATING_PROMPT_HARD_LIMIT) {
        throw new Error('本次约会上下文过大，已阻止发送。请优先检查该角色头像、约会背景或本地记忆数据是否异常。');
      }

      const rawText = await generateTextFromMessagesWithConfig({
        activeConfig,
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = parseGeneratedContent(rawText);
      if (!parsed) {
        throw new Error('约会内容格式不完整，请稍后再试。');
      }
      const normalizedContent = normalizeGeneratedContent(
        parsed,
        pendingSession,
        character,
        directorInstructionOverride,
      );
      const sceneMessage = createSceneMessage(normalizedContent, placeholderMessage.timestamp);
      sceneMessage.id = placeholderId;

      const finalMessages = replaceMessage(pendingSession.messages, placeholderId, () => sceneMessage);
      const finalSession: SceneSessionState = {
        ...pendingSession,
        pendingRoundRetry: null,
        pendingRoundError: '',
        messages: finalMessages,
        generatedContent: normalizedContent,
      };
      saveSession(finalSession);
      if (continueGeneratingAfterCloseRef.current && !autoSaveEnabled) {
        onSaveDate({
          ...finalSession,
          isSaved: true,
        });
      }
      if (continueGeneratingAfterCloseRef.current) {
        dispatchDatingBackgroundCompleted({
          kind: 'completed',
          characterId: character.id,
          characterName: character.name,
          characterAvatar: character.avatar,
          scenario: finalSession.generatedContent?.narrative.title || finalSession.scenario || '正式约会',
        });
        continueGeneratingAfterCloseRef.current = false;
      }
      if (isMountedRef.current) {
        setRetryPayload(null);
      }
    } catch (err) {
      console.error('[dating-scene] generate failed', err);
      const failedMessages = replaceMessage(pendingSession.messages, placeholderId, message => ({
        ...message,
        pending: false,
        text: '这一轮约会剧情生成失败了，请稍后再试。',
      }));
      const errorMessage = err instanceof Error ? err.message : '正式约会内容生成失败，请稍后重试。';
      const failedSession: SceneSessionState = {
        ...pendingSession,
        isSaved: autoSaveEnabled ? true : pendingSession.isSaved,
        pendingRoundRetry: {
          mode,
          session: retrySession,
        },
        pendingRoundError: errorMessage,
        messages: failedMessages,
      };
      if (isMountedRef.current) {
        setCurrentSession(failedSession);
        setRetryPayload({
          mode,
          session: retrySession,
        });
        setError(errorMessage);
      }
      if (autoSaveEnabled || continueGeneratingAfterCloseRef.current) {
        onSaveDate(failedSession);
      }
      continueGeneratingAfterCloseRef.current = false;
    } finally {
      generationInFlightRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleManualRetry = async () => {
    if (!retryPayload || isLoading) return;
    await generateRound({
      mode: retryPayload.mode,
      baseSession: retryPayload.session,
    });
  };

  const handleSend = async () => {
    const nextInput = input.replace(/\r\n?/g, '\n');
    if (!nextInput.trim() || isLoading) return;
    setInput('');

    const directorCommand = extractSpecialDirectiveCommand(nextInput);
    if (directorCommand) {
      await openNextRound({}, 'next_round', directorCommand);
      return;
    }

    await generateRound({
      mode: 'continue',
      latestUserInput: nextInput,
      appendUserMessage: true,
    });
  };

  const handleRollbackFromSelected = async () => {
    if (!selectedRollbackMessageId) return;
    const rollbackIndex = currentSession.messages.findIndex(item => item.id === selectedRollbackMessageId);
    if (rollbackIndex < 0) return;

    const truncatedMessages = currentSession.messages.slice(0, rollbackIndex + 1);
    const rollbackSession: SceneSessionState = {
      ...currentSession,
      messages: truncatedMessages,
      generatedContent: getLatestGeneratedContent(truncatedMessages),
    };

    setRollbackMode(false);
    setSelectedRollbackMessageId(null);
    setMenuOpen(false);
    saveSession(rollbackSession);
    await generateRound({
      mode: 'continue',
      baseSession: rollbackSession,
    });
  };

  const handleToggleCollect = () => {
    const nextCollected = !currentSession.isCollected;
    const nextSession: SceneSessionState = {
      ...currentSession,
      isCollected: nextCollected,
    };

    saveSession(nextSession, { preserveSaved: true });
    if (nextCollected) {
      onCollectDate(nextSession);
    }
    setMenuOpen(false);
  };

  const handleApplyRelationshipDirector = async (params: {
    relationshipStageOverride: DateRelationshipStageOverride;
    allowAdultIntimacy: boolean;
  }, mode: 'rewrite' | 'next_round') => {
    const patch = {
      relationshipStageOverride: params.relationshipStageOverride,
      allowAdultIntimacy: params.allowAdultIntimacy || undefined,
    };

    if (mode === 'next_round') {
      await openNextRound(patch, 'next_round');
      return;
    }

    await rewriteLatestRoundWithMode({ ...patch }, 'rewrite');
  };

  const handleApplyStylePresetDirector = async (presetId: GroupOfflineStylePresetId) => {
    await rewriteLatestRound({
      writingStyleCustom: buildGroupOfflineStylePresetInstruction(presetId),
    });
  };

  const openNextRound = async (
    sessionPatch: Partial<SceneSessionState> = {},
    directorMode?: 'rewrite' | 'next_round',
    directorInstructionOverride?: string,
  ) => {
    if (isLoading) {
      return;
    }

    setEditingSceneMessageId(null);
    setRoundEditDraft('');

    const baseSession: SceneSessionState = {
      ...currentSession,
      ...sessionPatch,
      pendingRoundRetry: null,
      pendingRoundError: '',
      messages: currentSession.messages,
      generatedContent: getLatestGeneratedContent(currentSession.messages, currentSession.generatedContent),
    };

    await generateRound({
      mode: baseSession.messages.length === 0 ? 'start' : 'continue',
      baseSession,
      directorMode,
      directorInstructionOverride,
    });
  };

  const handleApplyCustomStyleDirector = async (text: string, mode: 'rewrite' | 'next_round') => {
    const patch = {
      writingStyleCustom: text.trim() || undefined,
    };

    if (mode === 'next_round') {
      await openNextRound(patch, 'next_round');
      return;
    }

    await rewriteLatestRoundWithMode(patch, 'rewrite');
  };

  const handleChangeDirectorTextColors = (params: {
    bodyTextColor?: string;
    highlightTextColor?: string;
  }) => {
    saveSession({
      ...currentSession,
      bodyTextColor: params.bodyTextColor || undefined,
      highlightTextColor: params.highlightTextColor || undefined,
    }, { preserveSaved: true });
  };

  const handleApplyDirectorInstruction = async (text: string, mode: 'rewrite' | 'next_round') => {
    const patch = {
      directorInstruction: text.trim() || undefined,
    };

    if (mode === 'next_round') {
      await openNextRound(patch, 'next_round');
      return;
    }

    await rewriteLatestRoundWithMode(patch, 'rewrite');
  };

  const toggleInlineRoundEditor = () => {
    if (editingSceneMessageId) {
      setEditingSceneMessageId(null);
      setRoundEditDraft('');
      return;
    }

    if (!latestSceneInfo) {
      return;
    }

    if (latestSceneInfo.message.generatedContent?.mode === 'page_episode') {
      return;
    }

    setRoundEditDraft(latestSceneInfo.message.text);
    setEditingSceneMessageId(latestSceneInfo.message.id);
  };

  const handleSaveRoundEdit = (messageId: string) => {
    if (!roundEditDraft.trim()) {
      return;
    }

    const nextMessages = currentSession.messages.map((message) => (
      message.id === messageId
        ? {
            ...message,
            text: roundEditDraft.trim(),
            isEdited: true,
          }
        : message
    ));

    saveSession({
      ...currentSession,
      messages: nextMessages,
      generatedContent: getLatestGeneratedContent(nextMessages, currentSession.generatedContent),
    }, { preserveSaved: true });
    setEditingSceneMessageId(null);
    setRoundEditDraft('');
  };

  const toggleStatus = (id: string) => {
    setStatusExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePlaylist = (id: string) => {
    setPlaylistExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePageStory = (id: string) => {
    setPageStoryExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConvertCurrentPageEpisode = async (target: 'narrative' | 'platform_page' | 'custom_html') => {
    if (isLoading) {
      return;
    }

    const compiledPlan = compileSpecialDirective(resolveAppliedDirectorInstruction(latestSceneInfo?.message, currentSession));
    const override = target === 'narrative'
      ? buildNarrativeFallbackDirective(compiledPlan, resolveAppliedDirectorInstruction(latestSceneInfo?.message, currentSession))
      : target === 'platform_page'
        ? buildPlatformPageFallbackDirective(compiledPlan, resolveAppliedDirectorInstruction(latestSceneInfo?.message, currentSession))
        : buildCustomHtmlFallbackDirective(compiledPlan, resolveAppliedDirectorInstruction(latestSceneInfo?.message, currentSession));
    await rewriteLatestRoundWithMode({
      directorInstruction: override,
    }, 'rewrite', override);
  };

  const handleSendSticker = async (sticker: string) => {
    setShowStickerPanel(false);
    if (isLoading) return;
    if (input.trim()) {
      setInput(prev => `${prev}${sticker}`);
      return;
    }
    await generateRound({
      mode: 'continue',
      latestUserInput: sticker,
      appendUserMessage: true,
    });
  };

  return (
    <div className="dating-scene" style={buildDatingAccentVars(currentSession, character)}>
      <div className="dating-scene__background" style={{ backgroundImage: `url(${backgroundImage})` }} />
      {backgroundImage ? (
        <img
          src={backgroundImage}
          alt=""
          className="hidden"
          onError={() => {
            if (!backgroundBroken) {
              setBackgroundBroken(true);
            }
          }}
        />
      ) : null}
      <div className="dating-scene__blur" />
      <div className="dating-scene__overlay" />

      <div ref={shellRef} className="dating-scene__shell">
        <div className="dating-scene__topbar">
          <div className="dating-scene__topbar-left">
            <button type="button" className="dating-scene__icon-btn" onClick={handleBackAttempt}>
              <ChevronLeft size={16} />
            </button>
            {(() => {
              const avatarSrc = getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl);
              return avatarSrc ? <img src={avatarSrc} alt={character.name} className="dating-scene__avatar" /> : null;
            })()}
            <div className="dating-scene__identity">
              <div className="dating-scene__name">{character.name}</div>
              <div className="dating-scene__subtitle">{currentSession.scenario || '正式约会'}</div>
            </div>
          </div>

          <div className="dating-scene__actions">
            <button type="button" className="dating-scene__icon-btn" onClick={() => setMenuOpen(prev => !prev)}>
              <MoreVertical size={16} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="dating-scene__menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -6 }}
                    className="dating-scene__menu"
                  >
                    <button
                      type="button"
                      className="dating-scene__menu-item"
                      onClick={() => {
                        persistSession(currentSession);
                        setMenuOpen(false);
                      }}
                    >
                      <Save size={15} />
                      保存进度
                    </button>
                    <button
                      type="button"
                      className={`dating-scene__menu-item ${currentSession.isCollected ? 'dating-scene__menu-item--active' : ''}`}
                      onClick={handleToggleCollect}
                    >
                      <Star size={15} />
                      {currentSession.isCollected ? '已收藏' : '收藏'}
                    </button>
                    <button
                      type="button"
                      className="dating-scene__menu-item"
                      onClick={() => {
                        setRollbackMode(prev => {
                          const next = !prev;
                          if (!next) {
                            setSelectedRollbackMessageId(null);
                          }
                          return next;
                        });
                        setMenuOpen(false);
                      }}
                    >
                      <Undo2 size={15} />
                      {rollbackMode ? '取消回溯' : '回溯'}
                    </button>
                    <button
                      type="button"
                      className="dating-scene__menu-item dating-scene__menu-item--danger"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleEndDate();
                      }}
                    >
                      <X size={15} />
                      结束约会
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <DatingGooseDirectorOrb
          containerRef={shellRef}
          loading={isLoading}
          directorLaunchToken={directorLaunchToken}
          initialDirectorSection={initialDirectorSection}
          relationshipSummary={relationshipDirectorSummary}
          currentCustomStyle={currentSession.writingStyleCustom || ''}
          currentBodyTextColor={currentSession.bodyTextColor}
          currentHighlightTextColor={currentSession.highlightTextColor}
          currentDirectorInstruction={currentSession.directorInstruction}
          stylePresetOptions={GROUP_OFFLINE_STYLE_PRESET_OPTIONS}
          canEditCurrentRound={Boolean(latestSceneInfo)}
          isInlineEditing={Boolean(editingSceneMessageId)}
          currentRelationshipStage={currentSession.relationshipStageOverride || 'auto'}
          allowAdultIntimacy={Boolean(currentSession.allowAdultIntimacy)}
          onApplyRelationship={(params, mode) => void handleApplyRelationshipDirector(params, mode)}
          onApplyStylePreset={(presetId) => void handleApplyStylePresetDirector(presetId)}
          onApplyCustomStyle={(text, mode) => void handleApplyCustomStyleDirector(text, mode)}
          onChangeTextColors={handleChangeDirectorTextColors}
          onRetryRound={() => void rewriteLatestRound()}
          onApplyDirectorInstruction={(text, mode) => void handleApplyDirectorInstruction(text, mode)}
          onToggleInlineEdit={toggleInlineRoundEditor}
        />

        <div className="dating-scene__body">
          {isLoading && currentSession.messages.length > 0 ? (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                className="dating-scene__error-retry"
                onClick={handleLeaveAndContinueGenerating}
              >
                返回聊天继续生成
              </button>
            </div>
          ) : null}
          <div className="dating-scene__messages">
            {currentSession.messages.length === 0 && isLoading ? (
              <div className="dating-scene__scene-content dating-scene__scene-content--placeholder">
                <div className="dating-scene__scene-header">
                  <div className="dating-scene__scene-title">{currentSession.scenario || '正式约会'}</div>
                </div>
                <p className="dating-scene__segment dating-scene__segment--placeholder">
                  角色正在根据你们的过往聊天、当前关系和这次约会的地点氛围生成第一轮剧情……
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    className="dating-scene__error-retry"
                    onClick={handleLeaveAndContinueGenerating}
                  >
                    返回聊天继续生成
                  </button>
                </div>
              </div>
            ) : null}
            {currentSession.messages.length === 0 && !isLoading ? (
              <div className="dating-scene__scene-content dating-scene__scene-content--placeholder">
                <div className="dating-scene__scene-header">
                  <div className="dating-scene__scene-title">{currentSession.scenario || '番外模式'}</div>
                </div>
                <p className="dating-scene__segment dating-scene__segment--placeholder">
                  番外导演台已就绪。先在左侧大鹅导演的“指令”标签里输入你想要的番外要求，再点“重写当前轮”或“开下一轮”。
                </p>
              </div>
            ) : null}

            {currentSession.messages.map((message, messageIndex) => {
              if (message.role === 'user') {
                const selectable = rollbackMode;
                const selected = selectedRollbackMessageId === message.id;

                return (
                  <div key={`${message.id}-${messageIndex}`} className="dating-scene__message dating-scene__message--user">
                    <button
                      type="button"
                      className={`dating-scene__user-bubble ${selectable ? 'is-rollbackable' : ''} ${selected ? 'is-selected' : ''}`}
                      onClick={() => {
                        if (selectable) {
                          setSelectedRollbackMessageId(prev => (prev === message.id ? null : message.id));
                        }
                      }}
                    >
                      {selectable ? (
                        <span className="dating-scene__rollback-marker">
                          {selected ? <Check size={12} /> : null}
                        </span>
                      ) : null}
                      {message.text}
                    </button>
                  </div>
                );
              }

              const content = message.generatedContent;
              const statusOpen = !!statusExpandedMap[message.id];
              const playlistOpen = !!playlistExpandedMap[message.id];
              const editedParagraphs = message.isEdited ? splitEditedSceneText(message.text) : [];
              const isCurrentRoundMessage = latestSceneInfo?.message.id === message.id;
              const isEditingCurrentRound = editingSceneMessageId === message.id;
              const pageEpisode = content?.pageEpisode;
              const isPageEpisode = content?.mode === 'page_episode' && !!pageEpisode;
              const currentDirectivePlan = compileSpecialDirective(resolveAppliedDirectorInstruction(message, currentSession));
              const pageStoryExpanded = !!pageStoryExpandedMap[message.id];
              const narrativeSegments = content?.narrative?.segments || [];
              const hasPageStory = message.isEdited ? editedParagraphs.length > 0 : narrativeSegments.length > 0;
              const pageEpisodeSandbox = resolvePageEpisodeSandbox(pageEpisode);
              const pageEpisodeSrcDoc = isPageEpisode
                ? buildPageEpisodeSrcDoc(pageEpisode, {
                    userAvatarUrl: getDisplayableAssetValue(userProfile.avatar, resolvedUserAvatarUrl) || '',
                    characterAvatarUrl: getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl) || '',
                    userName: userProfile.name,
                    characterName: character.remarkName?.trim() || character.name,
                  })
                : '';
              const canInlineEditCurrentRound = isCurrentRoundMessage && !isPageEpisode;

              return (
                <div key={`${message.id}-${messageIndex}`} className="dating-scene__message dating-scene__message--scene">
                  <div className="dating-scene__scene-content">
                    {content ? (
                      <>
                        <div className="dating-scene__scene-header">
                          <div className="dating-scene__scene-header-main">
                            <div className="dating-scene__scene-title">{pageEpisode?.title || content.narrative?.title || currentSession.scenario || '正式约会'}</div>
                            {(pageEpisode?.subtitle || content.narrative?.subtitle || content.background?.atmosphere) ? (
                              <div className="dating-scene__scene-subtitle">
                                {pageEpisode?.subtitle || content.narrative?.subtitle || content.background?.atmosphere}
                              </div>
                            ) : null}
                          </div>
                          {isCurrentRoundMessage ? (
                            <div className="dating-scene__scene-tools">
                              {isPageEpisode ? <div className="dating-scene__scene-tag">页面番外</div> : null}
                              {message.isEdited ? <div className="dating-scene__scene-tag">手动改过</div> : null}
                              {canInlineEditCurrentRound ? (
                                <button
                                  type="button"
                                  className="dating-scene__scene-tool"
                                  onClick={toggleInlineRoundEditor}
                                  disabled={isLoading}
                                >
                                  <Pencil size={13} />
                                  {isEditingCurrentRound ? '取消编辑' : '编辑'}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="dating-scene__scene-tool"
                                onClick={() => void rewriteLatestRound()}
                                disabled={isLoading}
                              >
                                <RefreshCw size={13} />
                                重写当前轮
                              </button>
                              {isPageEpisode ? (
                                <button
                                  type="button"
                                  className="dating-scene__scene-tool"
                                  onClick={() => void handleConvertCurrentPageEpisode('narrative')}
                                  disabled={isLoading}
                                >
                                  改成普通番外
                                </button>
                              ) : null}
                              {isPageEpisode && pageEpisode?.pageType !== 'custom_html' ? (
                                <button
                                  type="button"
                                  className="dating-scene__scene-tool"
                                  onClick={() => void handleConvertCurrentPageEpisode('custom_html')}
                                  disabled={isLoading}
                                >
                                  改成自定义页
                                </button>
                              ) : null}
                              {isPageEpisode && pageEpisode?.pageType !== 'wechat_chat' && pageEpisode?.pageType !== 'feed_post' && pageEpisode?.pageType !== 'document_page' && currentDirectivePlan?.platform && currentDirectivePlan.platform !== 'generic' ? (
                                <button
                                  type="button"
                                  className="dating-scene__scene-tool"
                                  onClick={() => void handleConvertCurrentPageEpisode('platform_page')}
                                  disabled={isLoading}
                                >
                                  改成平台页
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {canInlineEditCurrentRound && isEditingCurrentRound ? (
                          <div className="dating-scene__scene-editor">
                            <textarea
                              value={roundEditDraft}
                              onChange={(event) => setRoundEditDraft(event.target.value)}
                              className="dating-scene__scene-textarea"
                              rows={10}
                            />
                            <div className="dating-scene__scene-editor-actions">
                              <button
                                type="button"
                                className="dating-scene__scene-tool"
                                onClick={toggleInlineRoundEditor}
                              >
                                <X size={13} />
                                取消
                              </button>
                              <button
                                type="button"
                                className="dating-scene__scene-tool dating-scene__scene-tool--primary"
                                onClick={() => handleSaveRoundEdit(message.id)}
                                disabled={!roundEditDraft.trim()}
                              >
                                <Check size={13} />
                                保存改动
                              </button>
                            </div>
                          </div>
                        ) : isPageEpisode ? (
                          <div className="dating-scene__page-episode">
                            {pageEpisodeSrcDoc ? (
                              <iframe
                                title={pageEpisode?.title || content.narrative?.title || '页面番外'}
                                className="dating-scene__page-frame"
                                srcDoc={pageEpisodeSrcDoc}
                                sandbox={pageEpisodeSandbox}
                              />
                            ) : null}
                            {pageEpisode?.caption ? (
                              <div className="dating-scene__page-caption">{pageEpisode.caption}</div>
                            ) : null}
                            {hasPageStory ? (
                              <div className="dating-scene__page-story-wrap">
                                <button
                                  type="button"
                                  className="dating-scene__page-story-toggle"
                                  onClick={() => togglePageStory(message.id)}
                                >
                                  <ChevronRight size={14} className={`dating-scene__fold-icon ${pageStoryExpanded ? 'is-open' : ''}`} />
                                  {pageStoryExpanded ? '收起剧情摘要' : '查看剧情摘要'}
                                </button>
                                {pageStoryExpanded ? (
                                  message.isEdited
                                    ? (
                                        <div className="dating-scene__page-story">
                                          <div className="dating-scene__page-story-title">剧情摘要</div>
                                          {editedParagraphs.map((paragraph, index) => (
                                            <p
                                              key={`${message.id}-${messageIndex}-page-edited-${index}`}
                                              className="dating-scene__segment dating-scene__segment--edited"
                                            >
                                              {paragraph}
                                            </p>
                                          ))}
                                        </div>
                                      )
                                    : (
                                        <div className="dating-scene__page-story">
                                          <div className="dating-scene__page-story-title">剧情摘要</div>
                                          {narrativeSegments.map((segment, index) => (
                                            <p
                                              key={`${message.id}-${messageIndex}-page-${segment.type}-${index}`}
                                              className={`dating-scene__segment ${segment.type === 'dialogue' ? 'dating-scene__segment--dialogue' : ''}`}
                                            >
                                              {segment.text}
                                            </p>
                                          ))}
                                        </div>
                                      )
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="dating-scene__narrative">
                            {message.isEdited
                              ? editedParagraphs.map((paragraph, index) => (
                                <p
                                  key={`${message.id}-${messageIndex}-edited-${index}`}
                                  className="dating-scene__segment dating-scene__segment--edited"
                                >
                                  {paragraph}
                                </p>
                              ))
                              : narrativeSegments.map((segment, index) => (
                                <p
                                  key={`${message.id}-${messageIndex}-${segment.type}-${index}`}
                                  className={`dating-scene__segment ${segment.type === 'dialogue' ? 'dating-scene__segment--dialogue' : ''}`}
                                >
                                  {segment.text}
                                </p>
                              ))}
                          </div>
                        )}

                        <div className="dating-scene__folds">
                          <div className="dating-scene__fold">
                            <button type="button" className="dating-scene__fold-btn" onClick={() => toggleStatus(message.id)}>
                              <ChevronRight size={14} className={`dating-scene__fold-icon ${statusOpen ? 'is-open' : ''}`} />
                              状态
                            </button>
                            {statusOpen ? (
                              <div className="dating-scene__fold-panel">
                                <div className="dating-scene__status-list">
                                  <div className="dating-scene__status-item"><strong>地点：</strong>{content.status?.location || currentSession.location || '未生成'}</div>
                                  <div className="dating-scene__status-item"><strong>时间：</strong>{content.status?.time || '未生成'}</div>
                                  <div className="dating-scene__status-item"><strong>心情：</strong>{content.status?.mood || currentSession.mood || '未生成'}</div>
                                  <div className="dating-scene__status-item"><strong>内心 OS：</strong>{content.status?.innerThought || '未生成'}</div>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="dating-scene__fold">
                            <button type="button" className="dating-scene__fold-btn" onClick={() => togglePlaylist(message.id)}>
                              <ChevronRight size={14} className={`dating-scene__fold-icon ${playlistOpen ? 'is-open' : ''}`} />
                              歌单
                            </button>
                            {playlistOpen ? (
                              <div className="dating-scene__fold-panel">
                                <div className="dating-scene__playlist-list">
                                  {(content.playlist || []).map((song, index) => (
                                    <div key={`${message.id}-${messageIndex}-song-${index}`}>
                                      <span className="dating-scene__song-title">{song.title}</span>
                                      <span> · {song.artist}</span>
                                      {song.note ? <span className="dating-scene__song-note">{song.note}</span> : null}
                                    </div>
                                  ))}
                                  {(!content.playlist || content.playlist.length === 0) ? <div>暂无</div> : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="dating-scene__narrative">
                        <p className="dating-scene__segment dating-scene__segment--placeholder">
                          {message.pending ? '角色正在续写这一轮约会剧情……' : message.text}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {error ? (
            <div className="dating-scene__error">
              <div className="dating-scene__error-text">{error}</div>
              {retryPayload ? (
                <button
                  type="button"
                  className="dating-scene__error-retry"
                  disabled={isLoading}
                  onClick={() => void handleManualRetry()}
                >
                  {isLoading ? '重试中…' : '手动重试本轮'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <AnimatePresence>
          {rollbackMode ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="dating-scene__rollback-bar"
            >
              <div className="dating-scene__rollback-text">
                {selectedRollbackMessageId ? '已选中一条你的消息' : '请选择一条你的消息作为新的分叉点'}
              </div>
              <button
                type="button"
                className="dating-scene__rollback-action"
                disabled={!selectedRollbackMessageId || isLoading}
                onClick={() => void handleRollbackFromSelected()}
              >
                从这条消息开始回溯
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="dating-scene__composer-wrap">
          <AnimatePresence>
            {showStickerPanel ? (
              <>
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="dating-scene__sticker-backdrop"
                  onClick={() => setShowStickerPanel(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 28 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="dating-scene__sticker-sheet"
                >
                  <div className="dating-scene__sticker-sheet-handle" />
                  <div className="dating-scene__sticker-sheet-title">表情</div>
                  <div className="dating-scene__sticker-panel">
                    {DATING_STICKERS.map(sticker => (
                      <button
                        key={sticker}
                        type="button"
                        className="dating-scene__sticker-btn"
                        onClick={() => void handleSendSticker(sticker)}
                      >
                        {sticker}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
          <div className="dating-scene__composer">
            <button
              type="button"
              className={`dating-scene__emoji-btn ${showStickerPanel ? 'is-active' : ''}`}
              onClick={() => setShowStickerPanel(prev => !prev)}
            >
              <Smile size={18} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={isLoading ? '生成中...' : '说点什么呢...'}
              className="dating-scene__input"
              rows={1}
            />
            <button
              type="button"
              className="dating-scene__send"
              onClick={() => void handleSend()}
              disabled={isLoading || !input.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </div>

      </div>
      <AnimatePresence>
        {showUnsavedBackDialog ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="dating-scene__confirm-backdrop"
              onClick={() => setShowUnsavedBackDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="dating-scene__confirm-dialog"
            >
              <div className="dating-scene__confirm-title">保存约会</div>
              <div className="dating-scene__confirm-text">
                这段约会还没有保存，返回后可能会丢失当前进度。
              </div>
              <div className="dating-scene__confirm-actions">
                <button type="button" className="dating-scene__confirm-btn" onClick={() => setShowUnsavedBackDialog(false)}>
                  取消
                </button>
                <button
                  type="button"
                  className="dating-scene__confirm-btn dating-scene__confirm-btn--danger"
                  onClick={handleDiscardAndLeave}
                >
                  直接返回
                </button>
                <button
                  type="button"
                  className="dating-scene__confirm-btn dating-scene__confirm-btn--primary"
                  onClick={handleSaveAndLeave}
                >
                  保存并返回
                </button>
              </div>
            </motion.div>
          </>
        ) : null}

        {endingState !== 'idle' ? (
          <motion.button
            ref={endingScreenRef}
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`dating-scene__ending-screen dating-scene__ending-screen--${endingState}`}
            onClick={handleEndingScreenClick}
          >
            <div className="dating-scene__ending-backdrop" />
            {endingState === 'generating' ? (
              <div className="dating-scene__ending-wait">
                <div className="dating-scene__ending-stars" aria-hidden="true">
                  <span className="dating-scene__ending-star dating-scene__ending-star--white" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--white" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--white" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--white" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--white" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--white" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--accent" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--accent" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--accent" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--accent" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--accent" />
                  <span className="dating-scene__ending-star dating-scene__ending-star--accent" />
                </div>
                <div className="dating-scene__ending-wait-copy">
                  <div className="dating-scene__ending-wait-name">{endingDisplayName || character.name}</div>
                  <div className="dating-scene__ending-wait-sub">正在回想今天</div>
                </div>
              </div>
            ) : (
              <div
                ref={endingContentRef}
                className={`dating-scene__ending-content ${endingState === 'returning' ? 'is-returning' : ''}`}
              >
                <div className={`dating-scene__ending-header ${endingDisplayLines.length > 0 || endingError ? 'is-visible' : ''}`}>
                  <span className="dating-scene__ending-pip" />
                  <span className="dating-scene__ending-name">{endingDisplayName || character.name}</span>
                </div>
                <div className="dating-scene__ending-lines">
                  {endingDisplayLines.map((line, index) => (
                    <span
                      key={`ending-line-${index}-${line}`}
                      className={`dating-scene__ending-line ${index === endingHighlightIndex ? 'dating-scene__ending-line--highlight' : ''} ${index < endingRevealCount ? 'is-visible' : ''}`}
                    >
                      {line}
                    </span>
                  ))}
                </div>
                <div className={`dating-scene__ending-rule ${endingDisplayLines.length > 0 && endingRevealCount >= endingDisplayLines.length ? 'is-visible' : ''}`} />
                {endingError ? <div className="dating-scene__ending-error">{endingError}</div> : null}
                {endingState === 'ready' && !endingError && endingDisplayLines.length > 0 && endingRevealCount >= endingDisplayLines.length ? (
                  <div className="dating-scene__ending-hint">
                    轻 触 离 开
                  </div>
                ) : null}
                {endingState === 'ready' && endingError ? (
                  <div className="dating-scene__ending-hint">轻触页面，结束约会并回到聊天</div>
                ) : null}
              </div>
            )}
            <canvas ref={endingCanvasRef} className="dating-scene__ending-canvas" />
            <div className={`dating-scene__ending-curtain ${endingCurtainVisible ? 'is-visible' : ''}`}>
              <div className="dating-scene__ending-curtain-text">已 离 开 约 会</div>
            </div>
            {endingRipple ? (
              <span
                key={endingRipple.key}
                className="dating-scene__ending-ripple"
                style={{ left: endingRipple.x, top: endingRipple.y }}
              />
            ) : null}
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
