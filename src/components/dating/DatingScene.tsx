import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, MoreVertical, Pencil, RefreshCw, Save, Send, Smile, Star, Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ApiConfig,
  Character,
  ChatMessage,
  DateMessage,
  DatingPageEpisode,
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
  buildPageEpisodeSrcDoc,
  normalizePageEpisode,
  resolvePageEpisodeSandbox,
} from '../../services/dating/pageEpisodeRuntime';
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

function isUncollectableDatingPageEpisode(pageEpisode: DatingPageEpisode | undefined): boolean {
  return pageEpisode?.pageType === 'custom_html' || pageEpisode?.pageType === 'micro_app';
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
  const latestCollectedPageEpisode = latestSceneInfo?.message.generatedContent?.pageEpisode
    || currentSession.generatedContent?.pageEpisode;
  const collectBlockedReason = !currentSession.isCollected && isUncollectableDatingPageEpisode(latestCollectedPageEpisode)
    ? 'HTML页不可收藏'
    : '';
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
    if (collectBlockedReason) {
      setMenuOpen(false);
      return;
    }

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
                      disabled={Boolean(collectBlockedReason)}
                    >
                      <Star size={15} />
                      {currentSession.isCollected ? '已收藏' : (collectBlockedReason || '收藏')}
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
