import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';

import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { generateDreamAftermath } from '../../services/dream/generateDreamAftermath';
import { buildDreamBackgroundRequestKey, getCurrentDreamBackgroundTask, startDreamBackgroundGeneration } from '../../services/dream/dreamBackgroundGeneration';
import { generateDreamContinuation } from '../../services/dream/generateDreamContinuation';
import { generateDreamEnding } from '../../services/dream/generateDreamEnding';
import { buildDreamPreflightPlan } from '../../services/dream/buildDreamPreflightPlan';
import { buildDreamPromptInput } from '../../services/dream/buildDreamPromptInput';
import { hydrateDreamRuntimeScenario } from '../../services/dream/dreamRuntimeSummaries';
import {
  buildDreamPromptWorldBooks,
  createDreamLocalWorldBooksFromFile,
  mergeDreamLocalWorldBooks,
  normalizeDreamWorldBookConfig,
  resolveDreamInheritedWorldBooks,
} from '../../services/dream/dreamWorldBooks';
import { buildWorldBookChunkCache } from '../../services/world-book/worldBookBudget';
import { getWorldBookPriorityWeight, normalizeWorldBookCategory } from '../../services/world-book/worldBookMeta';
import type {
  DreamCustomTag,
  DreamDecisionRecord,
  DreamGeneratedChoice,
  DreamPreflightPlan,
  DreamRuntimeAct,
  DreamRuntimeScenario,
  DreamWorldBookConfig,
} from '../../services/dream/dreamRuntimeTypes';
import type { DreamNarrativeBlock } from '../../services/dream/dreamNarrativeSchema';
import type { ApiConfig, Character, Mask, WorldBookEntry } from '../../types';
import { DreamWorldBookGlyph, DreamWorldBookSheet } from './DreamWorldBookSheet';
import { DreamWorldBookImportReviewSheet, type DreamWorldBookImportDraft } from './DreamWorldBookImportReviewSheet';
import { DreamArchiveStage } from './DreamArchiveStage';
import { buildDreamArchiveRecord, exportDreamArchiveRecords, getSelectedTagLabels, loadDreamArchiveRecords, saveDreamArchiveRecords, upsertDreamArchiveRecord, type DreamArchiveRecord } from './dreamArchive';
import { defaultTagSelection, dreamTagGroups, resolveDomainName, resolveScenario } from './dreamContent';
import type { DreamDepth, DreamDomainId, DreamEntryMode, DreamScenario, DreamTagCategory } from './types';

type ActiveDreamChoice = DreamGeneratedChoice & {
  reaction: string;
  fromCustom?: boolean;
};

type DreamEndingView = {
  title: string;
  body: string;
  excerpt: string;
  signature: string;
  chapter: string;
};

type DreamAftermathView = {
  summary: string;
  detail: string;
  previewMessages: [string, string];
};

const DREAM_LATEST_SESSION_KEY = 'dream_app_latest_session';
const DREAM_BACKGROUND_RESUME_REQUEST_KEY = 'dream_background_resume_request';
const DREAM_SELECTED_ROLE_KEY = 'dream_selected_role_id';

const BASE_TAG_BATCH_SIZE = 12;

type DreamStage =
  | 'splash'
  | 'home'
  | 'archive'
  | 'role-picker'
  | 'entry'
  | 'tags'
  | 'confirm'
  | 'loading'
  | 'scene'
  | 'choices'
  | 'reaction'
  | 'ending'
  | 'aftermath';

type DreamRole = {
  id: string;
  name: string;
  avatar: string;
  mood: string;
  glyph: string;
};

type DreamEntryOption = {
  id: DreamEntryMode;
  title: string;
  detail: string;
  glyph: string;
  advanced?: boolean;
};

type DreamConfirmPreview = {
  coverSubtitle: string;
  confirmHint: string;
};

type PersistedDreamSession = {
  resumeKind?: 'saved' | 'background_exit';
  mode: DreamEntryMode;
  roleId: string;
  domain: DreamDomainId;
  depth: DreamDepth;
  selectedTags: Record<DreamTagCategory, string[]>;
  customTags?: DreamCustomTag[];
  supplementNote?: string;
  dreamWorldBookConfig?: DreamWorldBookConfig;
  scenario: DreamRuntimeScenario;
  createdAt: number;
  progress?: {
    stage: DreamStage;
    actIndex: number;
    selectedChoice: ActiveDreamChoice | null;
    closingActId: string | null;
    customInput: string;
    customInputOpen: boolean;
  };
};

type DreamResumableState =
  | {
      source: 'saved';
      roleId: string;
      dreamWorldBookConfig?: DreamWorldBookConfig;
      scenario: DreamRuntimeScenario;
      createdAt: number;
      progress?: PersistedDreamSession['progress'];
    }
  | {
      source: 'background';
      roleId: string;
      dreamWorldBookConfig?: DreamWorldBookConfig;
      scenario: DreamRuntimeScenario;
      createdAt: number;
      progress?: PersistedDreamSession['progress'];
    };

const dreamThemeStyle = {
  '--void': '#030509',
  '--ink': '#05080E',
  '--deep': '#080C18',
  '--gold': '#C4A96A',
  '--gold-bright': '#D9C08A',
  '--jade': '#7BA8C4',
  '--paper': '#EDE6D6',
  '--paper-60': 'rgba(237,230,214,.6)',
  '--mist': '#647899',
  '--border': 'rgba(196,169,106,.1)',
  '--border-mid': 'rgba(196,169,106,.2)',
  fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', Georgia, serif",
} as CSSProperties;

const dreamNoise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

function buildDreamWorldBookImportDrafts(entries: WorldBookEntry[]): DreamWorldBookImportDraft[] {
  return entries.map((entry, index) => ({
    ...entry,
    draftId: `${entry.id || 'dream-import'}-${index}-${Math.random().toString(16).slice(2)}`,
    include: true,
    mergeGroup: '',
  }));
}

function toDreamImportedWorldBookEntry(draft: DreamWorldBookImportDraft): WorldBookEntry {
  const nextId = draft.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const content = draft.content.trim();

  return {
    id: nextId,
    title: draft.title.trim(),
    content,
    category: normalizeWorldBookCategory(draft.category),
    priorityLevel: draft.priorityLevel || 'normal',
    isActive: draft.isActive !== false,
    isGlobal: draft.isGlobal !== false,
    characterIds: Array.from(new Set(
      (draft.characterIds || []).filter((characterId): characterId is string => Boolean(characterId?.trim())),
    )),
    pinMode: draft.pinMode === 'always' ? 'always' : 'none',
    chunkCache: buildWorldBookChunkCache({
      id: nextId,
      content,
    }),
  };
}

function mergeDreamImportedDraftGroup(groupName: string, drafts: DreamWorldBookImportDraft[]): WorldBookEntry {
  const normalizedGroupName = groupName.trim();
  const categories = Array.from(new Set(drafts.map((draft) => normalizeWorldBookCategory(draft.category))));
  const mergedPriority = drafts.reduce<WorldBookEntry['priorityLevel']>((best, current) => {
    const currentWeight = getWorldBookPriorityWeight(current.priorityLevel);
    const bestWeight = getWorldBookPriorityWeight(best);
    return currentWeight >= bestWeight ? current.priorityLevel : best;
  }, 'normal');
  const mergedCharacterIds = Array.from(new Set(drafts.flatMap((draft) => draft.characterIds || [])));
  const mergedContent = drafts
    .map((draft) => [drafts.length > 1 ? `## ${draft.title.trim()}` : '', draft.content.trim()].filter(Boolean).join('\n'))
    .join('\n\n');
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: nextId,
    title: normalizedGroupName || drafts[0].title.trim(),
    content: mergedContent,
    category: categories.length === 1 ? categories[0] : '其他',
    priorityLevel: mergedPriority,
    isActive: drafts.some((draft) => draft.isActive !== false),
    isGlobal: mergedCharacterIds.length === 0,
    characterIds: mergedCharacterIds,
    pinMode: drafts.some((draft) => draft.pinMode === 'always') ? 'always' : 'none',
    chunkCache: buildWorldBookChunkCache({
      id: nextId,
      content: mergedContent,
    }),
  };
}

function buildDreamImportedWorldBooksFromDrafts(drafts: DreamWorldBookImportDraft[]): WorldBookEntry[] {
  const selectedDrafts = drafts.filter((draft) => draft.include);
  const groupedDrafts = new Map<string, DreamWorldBookImportDraft[]>();
  const standaloneEntries: WorldBookEntry[] = [];

  selectedDrafts.forEach((draft) => {
    const groupName = draft.mergeGroup.trim();
    if (!groupName) {
      standaloneEntries.push(toDreamImportedWorldBookEntry(draft));
      return;
    }

    const bucket = groupedDrafts.get(groupName) || [];
    bucket.push(draft);
    groupedDrafts.set(groupName, bucket);
  });

  const mergedEntries = Array.from(groupedDrafts.entries()).map(([groupName, grouped]) => (
    mergeDreamImportedDraftGroup(groupName, grouped)
  ));

  return [...mergedEntries, ...standaloneEntries];
}

function formatDreamTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function debugDreamStagePayload(label: string, payload: unknown) {
  try {
    console.info(label, payload);
  } catch {
    console.info(label);
  }
}

function readPersistedDreamSession(): PersistedDreamSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(DREAM_LATEST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDreamSession | null;
    if (!parsed?.scenario || !parsed.roleId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readPersistedDreamSelectedRoleId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(DREAM_SELECTED_ROLE_KEY);
    const roleId = raw?.trim();
    return roleId || null;
  } catch {
    return null;
  }
}

function writePersistedDreamSelectedRoleId(roleId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DREAM_SELECTED_ROLE_KEY, roleId);
}

function writePersistedDreamSession(session: PersistedDreamSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DREAM_LATEST_SESSION_KEY, JSON.stringify(session));
}

function clearPersistedDreamSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DREAM_LATEST_SESSION_KEY);
}

function readDreamBackgroundResumeRequest(): { taskId?: string; requestKey?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DREAM_BACKGROUND_RESUME_REQUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { taskId?: string; requestKey?: string } | null;
    if (!parsed?.taskId && !parsed?.requestKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDreamBackgroundResumeRequest(request: { taskId?: string; requestKey?: string }) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DREAM_BACKGROUND_RESUME_REQUEST_KEY, JSON.stringify(request));
}

function clearDreamBackgroundResumeRequest() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DREAM_BACKGROUND_RESUME_REQUEST_KEY);
}

function isDreamResumeStage(stage: DreamStage | undefined): stage is 'scene' | 'choices' | 'reaction' | 'ending' | 'aftermath' {
  return stage === 'scene' || stage === 'choices' || stage === 'reaction' || stage === 'ending' || stage === 'aftermath';
}

function isPersistedDreamUnfinished(session: PersistedDreamSession | null) {
  if (!session) return false;
  return !(session.scenario.endingOutput && session.scenario.aftermathOutput);
}

function isDreamScenarioUnfinished(scenario: DreamRuntimeScenario | null | undefined) {
  if (!scenario) return false;
  return !(scenario.endingOutput && scenario.aftermathOutput);
}

function formatPersistedDreamTime(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function buildDreamResumableState(
  savedSession: PersistedDreamSession | null,
  _backgroundTask: ReturnType<typeof getCurrentDreamBackgroundTask>,
): DreamResumableState | null {
  const unfinishedSaved = savedSession
    && (savedSession.resumeKind === 'saved' || savedSession.resumeKind === 'background_exit' || !savedSession.resumeKind)
    && isPersistedDreamUnfinished(savedSession)
    ? {
        source: 'saved' as const,
        roleId: savedSession.roleId,
        dreamWorldBookConfig: savedSession.dreamWorldBookConfig,
        scenario: savedSession.scenario,
        createdAt: savedSession.createdAt,
        progress: savedSession.progress,
      }
    : null;

  return unfinishedSaved;
}

function buildRoles(characters: Character[]): DreamRole[] {
  return characters.slice(0, 12).map((character) => ({
    id: character.id,
    name: character.remarkName?.trim() || character.name || '未命名角色',
    avatar: character.avatar || '',
    mood: character.signature?.trim() || character.motto?.trim() || character.openingRemark?.trim() || '今夜在等你',
    glyph: (character.remarkName?.trim() || character.name || '梦').trim().charAt(0) || '梦',
  }));
}

function hasCustomTagInCategories(customTags: DreamCustomTag[], categories: DreamTagCategory[]) {
  return customTags.some((tag) => categories.includes(tag.category));
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomIds(category: DreamTagCategory, count: number) {
  const group = dreamTagGroups.find((item) => item.category === category);
  if (!group) return [];
  const pool = [...group.options];
  const picked: string[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool[index].id);
    pool.splice(index, 1);
  }
  return picked;
}

function buildQuickDreamPreset(): {
  domainId: DreamDomainId;
  depth: DreamDepth;
  selectedTags: Record<DreamTagCategory, string[]>;
  preview: DreamConfirmPreview;
} {
  const domainId = pickRandom(['crowd', 'threshold', 'shared', 'rift'] as const);
  const genre = pickRandomIds('genre', 1);
  const tension = pickRandomIds('tension', 1);
  const drive = pickRandomIds('drive', 1);
  const mood = pickRandomIds('mood', 1);
  const climate = pickRandomIds('climate', 1);
  const participants = pickRandomIds('participants', 1);
  const faction = pickRandomIds('faction', 1);
  const camp = pickRandomIds('camp', 1);
  const identity = pickRandomIds('identity', 1);
  const lead = pickRandomIds('lead', 1);
  const intensity = pickRandomIds('intensity', 1);
  const interaction = pickRandomIds('interaction', 1);
  const ending = pickRandomIds('ending', 1);

  const selectedTags: Record<DreamTagCategory, string[]> = {
    ...defaultTagSelection,
    world: [domainId],
    genre,
    tension,
    drive,
    mood,
    climate,
    participants,
    faction,
    camp,
    identity,
    lead,
    intensity,
    interaction,
    ending,
  };

  const subtitle = `${pickRandom(['今夜的门先开了一条缝', '这一次梦会先把你拖进节点里', '有人已经在梦里等你', '这一局从失衡的瞬间开始'])}`;
  const confirmHint = `${pickRandom(['这场梦不会先解释规则，你要先活过第一幕。', '你们的关系已经被梦改写，进入后再确认谁站在哪一边。', '这一局会先给你一个世界，再逼你做选择。', '梦已经把身份和冲突排好，只等你落进去。'])}`;

  return {
    domainId,
    depth: 'shallow',
    selectedTags,
    preview: {
      coverSubtitle: subtitle,
      confirmHint,
    },
  };
}

function buildCharacterDreamPreset(): {
  domainId: DreamDomainId;
  depth: DreamDepth;
  selectedTags: Record<DreamTagCategory, string[]>;
} {
  const maybePick = (category: DreamTagCategory, probability: number, count = 1) => (
    Math.random() < probability ? pickRandomIds(category, count) : []
  );

  return {
    domainId: 'rift',
    depth: 'deep',
    selectedTags: {
      ...defaultTagSelection,
      world: ['rift'],
      lead: ['character-lead'],
      tension: maybePick('tension', 0.5),
      drive: maybePick('drive', 0.65),
      mood: maybePick('mood', 0.55),
      climate: maybePick('climate', 0.35),
      participants: maybePick('participants', 0.3),
      faction: maybePick('faction', 0.35),
      camp: maybePick('camp', 0.25),
      identity: maybePick('identity', 0.45),
      intensity: maybePick('intensity', 0.4),
      interaction: maybePick('interaction', 0.4),
      ending: maybePick('ending', 0.3),
    },
  };
}

function useNarrativeTypewriter(
  blocks: Array<{
    id: string;
    type: string;
    text: string;
    speakerName?: string;
    align?: 'left' | 'center' | 'right';
    emphasis?: 'low' | 'medium' | 'high';
  }>,
  active: boolean,
  scopeKey: string,
) {
  const [visibleBlocks, setVisibleBlocks] = useState<typeof blocks>([]);

  useEffect(() => {
    if (!active || blocks.length === 0) {
      setVisibleBlocks((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    let cancelled = false;
    let blockIndex = 0;
    let charIndex = 0;

    setVisibleBlocks(
      blocks.map((block) => ({
        ...block,
        text: '',
      })),
    );

    const step = () => {
      if (cancelled || blockIndex >= blocks.length) return;
      const sourceBlock = blocks[blockIndex];
      const char = sourceBlock.text[charIndex];
      if (!char) {
        blockIndex += 1;
        charIndex = 0;
        window.setTimeout(step, 120);
        return;
      }

      setVisibleBlocks((prev) =>
        prev.map((block, index) =>
          index === blockIndex
            ? {
                ...block,
                text: `${block.text}${char}`,
              }
            : block,
        ),
      );

      charIndex += 1;
      window.setTimeout(step, /[，。！？；：]/.test(char) ? 180 : 26);
    };

    window.setTimeout(step, 120);
    return () => {
      cancelled = true;
    };
  }, [active, blocks, scopeKey]);

  return visibleBlocks;
}

function buildSimpleTypewriterBlocks(items: Array<{ id: string; text: string }>) {
  return items.map((item) => ({
    id: item.id,
    type: 'narration',
    text: item.text,
    align: 'left' as const,
    emphasis: 'medium' as const,
  }));
}

function DreamStars() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const particles = Array.from({ length: 66 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.2 + Math.random() * 0.8,
      a: 0.03 + Math.random() * 0.32,
      da: (Math.random() - 0.5) * 0.006,
      vx: (Math.random() - 0.5) * 0.0007,
      vy: -0.00025 + (Math.random() - 0.5) * 0.00055,
    }));
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    let frame = 0;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
        p.a += p.da;
        if (p.a < 0.03 || p.a > 0.35) p.da *= -1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(196,169,106,${p.a})`;
        ctx.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      frame = window.requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frame);
    };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-0 h-full w-full" />;
}

function Shell({
  time: _time,
  children,
  bottomTone = true,
  scrollable = true,
  contentClassName = '',
}: {
  time: string;
  children: ReactNode;
  bottomTone?: boolean;
  scrollable?: boolean;
  contentClassName?: string;
}) {
  return (
    <div className="relative h-full min-h-full w-full overflow-hidden bg-[var(--ink)] text-[var(--paper)]" style={dreamThemeStyle}>
      <DreamStars />
      <div className="pointer-events-none fixed inset-0 z-[5] opacity-[0.025]" style={{ backgroundImage: dreamNoise, backgroundRepeat: 'repeat', mixBlendMode: 'screen' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-48 bg-[linear-gradient(180deg,rgba(8,12,24,.92),rgba(8,12,24,0))]" />
      {bottomTone ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-[linear-gradient(0deg,rgba(8,12,24,.96),rgba(8,12,24,0))]" /> : null}
      <div
        className={`relative z-10 flex h-full min-h-full min-w-0 flex-col px-5 pb-[calc(2.75rem+var(--app-safe-area-bottom-ui,0px))] pt-8 sm:px-7 ${scrollable ? 'overflow-y-auto overscroll-contain touch-pan-y' : ''} ${contentClassName}`}
        style={scrollable ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function Avatar({ role, secret, small = false }: { role?: DreamRole | null; secret?: boolean; small?: boolean }) {
  const outer = small ? 'h-[88px] w-[88px]' : 'h-[168px] w-[168px]';
  const inner = small ? 'h-[74px] w-[74px]' : 'h-[88px] w-[88px]';
  const { resolvedUrl } = useResolvedPersistentValue(role?.avatar);
  const avatarSrc = getDisplayableAssetValue(role?.avatar, resolvedUrl);
  const roleName = role?.name ?? '角色';
  return (
    <div className={`relative flex ${outer} items-center justify-center`}>
      <div className="absolute inset-[-28px] rounded-full border border-[rgba(196,169,106,.05)] animate-[pulse_6s_ease-in-out_infinite]" />
      <div className="absolute inset-[-14px] rounded-full border border-[var(--border)] animate-[pulse_5.2s_ease-in-out_infinite]" />
      <div
        className={`relative flex ${inner} items-center justify-center rounded-full border border-[var(--border-mid)]`}
        style={{
          background:
            'radial-gradient(circle at 40% 38%, rgba(196,169,106,.35), rgba(123,168,196,.15) 55%, transparent 75%)',
        }}
      >
        {secret ? (
          <span className="text-[40px] font-[200] text-[var(--gold)]">?</span>
        ) : avatarSrc ? (
          <img alt={roleName} src={avatarSrc} className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className={`${small ? 'text-[24px]' : 'text-[56px]'} font-[200] text-[var(--paper)]`}>{role?.glyph || '梦'}</span>
        )}
      </div>
    </div>
  );
}

function SealButton({
  label,
  onClick,
  disabled,
  presentation,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  presentation?: DreamPresentationView;
}) {
  const buttonColor = presentation?.accent || 'var(--gold)';
  const buttonBorder = presentation?.frameBorder || 'rgba(196,169,106,.2)';
  const buttonFill = presentation?.accentSoft || 'rgba(196,169,106,.14)';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative w-full overflow-hidden border px-6 py-4 text-center text-[13px] font-[400] tracking-[0.48em] transition duration-500 active:scale-[0.99] disabled:opacity-30"
      style={{ borderColor: buttonBorder, backgroundColor: disabled ? 'rgba(13,18,32,.45)' : 'transparent', color: buttonColor }}
    >
      <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition duration-500 group-hover:scale-x-100 group-active:scale-x-100" style={{ backgroundColor: buttonFill }} />
      <span className="pointer-events-none absolute inset-[3px] border" style={{ borderColor: buttonBorder }} />
      <span className="relative transition duration-500 group-hover:tracking-[0.62em] group-active:tracking-[0.62em]">{label}</span>
    </button>
  );
}

function SecondaryAction({
  label,
  onClick,
  className = '',
  disabled = false,
  presentation,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  presentation?: DreamPresentationView;
}) {
  const buttonColor = presentation?.accent || 'var(--gold)';
  const buttonBorder = presentation?.frameBorder || 'rgba(196,169,106,.2)';
  const buttonFill = presentation?.accentSoft || 'rgba(196,169,106,.14)';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative w-full overflow-hidden border px-6 py-4 text-center text-[13px] font-[400] tracking-[0.48em] transition duration-500 active:scale-[0.99] disabled:opacity-30 ${className}`}
      style={{ borderColor: buttonBorder, backgroundColor: disabled ? 'rgba(13,18,32,.45)' : 'transparent', color: buttonColor }}
    >
      <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition duration-500 group-hover:scale-x-100 group-active:scale-x-100" style={{ backgroundColor: buttonFill }} />
      <span className="pointer-events-none absolute inset-[3px] border" style={{ borderColor: buttonBorder }} />
      <span className="relative transition duration-500 group-hover:tracking-[0.62em] group-active:tracking-[0.62em]">{label}</span>
    </button>
  );
}

type DreamPresentationView = {
  accent: string;
  accentSoft: string;
  dialogueText: string;
  frameBorder: string;
  frameFill: string;
  layoutId?: string;
};

function DreamNarrativeBlocks({
  blocks,
  presentation,
}: {
  blocks: Array<{
    id: string;
    type: string;
    text: string;
    speakerName?: string;
    align?: 'left' | 'center' | 'right';
    emphasis?: 'low' | 'medium' | 'high';
  }>;
  presentation: DreamPresentationView;
}) {
  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        const alignClass =
          block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left';
        const emphasisClass =
          block.emphasis === 'high' ? 'text-[19px] leading-[2.15]' : block.emphasis === 'low' ? 'text-[14px] leading-[2.35]' : 'text-[16px] leading-[2.3]';
        const narrativeShellClass =
          presentation.layoutId === 'cinematic-caption-stream'
            ? 'px-1'
            : presentation.layoutId === 'full-bleed-dialogue-card'
              ? 'border-l pl-5'
              : presentation.layoutId === 'soft-overlay-monologue'
                ? block.type === 'narration'
                  ? 'px-1'
                  : 'rounded-[22px] px-4 py-4'
                : '';
        const narrativeShellStyle =
          presentation.layoutId === 'full-bleed-dialogue-card'
            ? { borderColor: presentation.frameBorder }
            : presentation.layoutId === 'soft-overlay-monologue'
              ? block.type === 'narration'
                ? undefined
                : { backgroundColor: presentation.accentSoft }
              : undefined;

        if (block.type === 'framed-dialogue') {
          return (
            <div
              key={block.id}
              className="rounded-[26px] border px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,.18)]"
              style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}
            >
              {block.speakerName ? (
                <div className="mb-3 text-[11px] tracking-[0.24em]" style={{ color: presentation.accent }}>
                  {block.speakerName}
                </div>
              ) : null}
              <div className={`whitespace-pre-line font-[300] ${alignClass} ${emphasisClass}`} style={{ color: presentation.accent }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'highlight-dialogue') {
          return (
            <div key={block.id} className={`rounded-[20px] px-4 py-3 whitespace-pre-line font-[400] ${alignClass} text-[22px] leading-[2]`} style={{ color: presentation.accent, backgroundColor: presentation.accentSoft }}>
              <span className="inline-block max-w-[28rem]">{block.text}</span>
            </div>
          );
        }

        if (block.type === 'dialogue') {
          return (
            <div key={block.id} className={`rounded-[20px] border px-4 py-3 ${alignClass}`} style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft }}>
              {block.speakerName ? (
                <div className="mb-2 text-[11px] tracking-[0.24em]" style={{ color: presentation.accent }}>
                  {block.speakerName}
                </div>
              ) : null}
              <div className={`whitespace-pre-line font-[300] ${emphasisClass}`} style={{ color: presentation.dialogueText || presentation.accent }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'aside') {
          return (
            <div key={block.id} className={`border-l pl-4 ${alignClass}`} style={{ borderColor: presentation.frameBorder }}>
              {block.speakerName ? (
                <div className="mb-2 text-[11px] tracking-[0.24em]" style={{ color: presentation.accent }}>
                  {block.speakerName}
                </div>
              ) : null}
              <div className="whitespace-pre-line text-[15px] font-[300] leading-[2.2] italic" style={{ color: presentation.accent }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'prompt') {
          return (
            <div key={block.id} className="rounded-[18px] border px-4 py-3 text-center text-[12px] tracking-[0.28em]" style={{ color: presentation.accent, borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft }}>
              {block.text}
            </div>
          );
        }

        if (block.type === 'strikethrough') {
          return (
            <div key={block.id} className={`border-l pl-4 ${alignClass}`} style={{ borderColor: presentation.frameBorder }}>
              <div className="whitespace-pre-line text-[16px] font-[300] leading-[2.25] opacity-70 line-through" style={{ color: presentation.accent }}>
                {block.text.replace(/^~~|~~$/g, '')}
              </div>
            </div>
          );
        }

        if (block.type === 'annotation') {
          return (
            <div key={block.id} className="rounded-[16px] border px-4 py-3" style={{ borderColor: presentation.frameBorder, backgroundColor: 'rgba(255,255,255,.02)' }}>
              <div className="text-[10px] tracking-[0.28em] mb-2" style={{ color: presentation.accent }}>档案批注</div>
              <div className="whitespace-pre-line text-[14px] font-[300] leading-[2.1]" style={{ color: 'var(--paper-60)' }}>
                {block.text.replace(/^注：/, '')}
              </div>
            </div>
          );
        }

        if (block.type === 'verdict') {
          return (
            <div key={block.id} className="rounded-[18px] border px-4 py-4 text-center" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
              <div className="text-[10px] tracking-[0.32em] mb-2" style={{ color: presentation.accent }}>裁定</div>
              <div className="whitespace-pre-line text-[15px] font-[400] leading-[2.1]" style={{ color: presentation.accent }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'redacted') {
          return (
            <div key={block.id} className="rounded-[16px] border px-4 py-4" style={{ borderColor: presentation.frameBorder, backgroundColor: 'rgba(255,255,255,.02)' }}>
              <div className="text-[10px] tracking-[0.28em] mb-2" style={{ color: presentation.accent }}>遮蔽记录</div>
              <div className="whitespace-pre-line text-[15px] font-[300] leading-[2.2]" style={{ color: 'var(--paper)' }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'echo-line') {
          const [mainLine, echoLine] = block.text.split('\n');
          return (
            <div key={block.id} className={`border-l px-4 py-2 ${alignClass}`} style={{ borderColor: presentation.frameBorder }}>
              <div className="whitespace-pre-line text-[17px] font-[300] leading-[2.25]">{mainLine}</div>
              {echoLine ? (
                <div className="mt-2 text-[13px] leading-[2] opacity-45" style={{ color: presentation.accent }}>
                  {echoLine}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <div key={block.id} className={`${narrativeShellClass}`} style={narrativeShellStyle}>
            <div className={`whitespace-pre-line font-[300] text-[17px] leading-[2.35] ${alignClass}`}>
              {block.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildRuntimeEndingView(scenario: DreamRuntimeScenario, roleName: string, userName: string): DreamEndingView {
  const { storyFrame, endingInput, endingOutput } = scenario;
  const resolvedUserName = userName.trim() || '你';
  if (endingOutput) {
    return {
      title: endingOutput.title,
      body: endingOutput.body,
      excerpt: endingOutput.excerpt,
      signature: roleName,
      chapter: endingOutput.chapter,
    };
  }
  const normalizedSummary = (endingInput.keyActionSummary || '').replaceAll('用户', resolvedUserName);
  return {
    title: storyFrame.worldTitle || scenario.coverTitle || '今夜',
    body:
      normalizedSummary ||
      `${storyFrame.characterDreamIdentity || roleName} 与 ${storyFrame.userDreamIdentity || resolvedUserName} 的这场梦，终于停在 ${storyFrame.coreConflict || '尚未说破的冲突'} 前。`,
    excerpt:
      normalizedSummary ||
      `${storyFrame.characterDreamIdentity || roleName} 与 ${storyFrame.userDreamIdentity || resolvedUserName} 的这场梦，最终停在 ${storyFrame.coreConflict || '尚未说破的冲突'} 前。`,
    signature: roleName,
    chapter: `《${endingInput.endingDirection || storyFrame.dreamRelationship || '梦局未竟'}》`,
  };
}

function buildPresetEndingView(scenario: DreamScenario): DreamEndingView {
  return {
    title: scenario.ending.title,
    body: scenario.ending.excerpt,
    excerpt: scenario.ending.excerpt,
    signature: scenario.ending.signature,
    chapter: scenario.ending.chapter,
  };
}

function buildRuntimeAftermathView(scenario: DreamRuntimeScenario): DreamAftermathView {
  if (scenario.aftermathOutput) {
    return {
      summary: scenario.aftermathOutput.summary,
      detail: scenario.aftermathOutput.detail,
      previewMessages: scenario.aftermathOutput.previewMessages,
    };
  }
  return {
    summary: scenario.aftermathInput.relationshipShift || '这场梦会在醒来后留下轻微的关系回响。',
    detail:
      scenario.aftermathInput.toneDrift || scenario.aftermathInput.messagePreviewDirection || '明日的聊天语气会沿着这场梦发生偏移。',
    previewMessages: [
      scenario.aftermathInput.messagePreviewDirection || '我还记得昨晚梦里的那一段。',
      scenario.storyFrame.openingNode || '你醒来之后，会先想起哪个瞬间？',
    ],
  };
}

function buildReactionBlocks(
  choice: ActiveDreamChoice | null,
  act: DreamRuntimeAct | null,
): DreamNarrativeBlock[] {
  if (!choice) return [];

  const blocks: DreamNarrativeBlock[] = [];
  const reactionText = choice.reaction?.trim() || '';
  const storyPushText = choice.storyPush?.trim() || '';
  const reactionParagraphs = reactionText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  reactionParagraphs.forEach((paragraph, index) => {
    const hasQuote = /“[^”]+”|"[^"]+"/.test(paragraph);
    blocks.push({
      id: `reaction-block-${index + 1}`,
      type: hasQuote ? 'dialogue' : index === 0 ? 'highlight-dialogue' : 'narration',
      text: paragraph,
      emphasis: hasQuote ? 'medium' : index === 0 ? 'high' : 'medium',
      align: hasQuote ? 'left' : index === 0 ? 'center' : 'left',
    });
  });

  if (storyPushText) {
    blocks.push({
      id: 'reaction-story-push',
      type: 'aside',
      text: `主线正在偏向：${storyPushText}`,
      emphasis: 'low',
      align: 'left',
    });
  }

  if (act?.progression.tensionShift) {
    blocks.push({
      id: 'reaction-tension-shift',
      type: 'prompt',
      text: `张力变化：${act.progression.tensionShift}`,
      emphasis: 'low',
      align: 'center',
    });
  }

  return blocks;
}

function hasStoryFrameContent(storyFrame: DreamRuntimeScenario['storyFrame'] | null) {
  if (!storyFrame) return false;
  return [
    storyFrame.worldTitle,
    storyFrame.worldSummary,
    storyFrame.userDreamIdentity,
    storyFrame.characterDreamIdentity,
    storyFrame.dreamRelationship,
    storyFrame.openingNode,
    storyFrame.storyObjective,
    storyFrame.coreConflict,
    storyFrame.realityAnchor,
    storyFrame.timeNode,
    storyFrame.currentCrisis,
    storyFrame.forbiddenRule,
    storyFrame.immediateGoal,
  ].some((value) => value?.trim());
}

function buildCustomVisibleStoryFrame(
  storyFrame: DreamRuntimeScenario['storyFrame'] | null,
  selectedTags: Record<DreamTagCategory, string[]>,
  customTags: DreamCustomTag[],
) {
  if (!storyFrame) return null;
  const backgroundSelected =
    ['world', 'genre', 'climate', 'camp', 'faction'].some((category) => (selectedTags[category as DreamTagCategory] ?? []).length > 0)
    || hasCustomTagInCategories(customTags, ['genre', 'climate', 'camp', 'faction']);
  const identitySelected =
    ['identity', 'participants'].some((category) => (selectedTags[category as DreamTagCategory] ?? []).length > 0)
    || hasCustomTagInCategories(customTags, ['identity', 'participants']);
  const relationshipSelected =
    ['tension', 'lead'].some((category) => (selectedTags[category as DreamTagCategory] ?? []).length > 0)
    || hasCustomTagInCategories(customTags, ['tension', 'lead']);
  const driveSelected =
    ['drive', 'interaction', 'intensity'].some((category) => (selectedTags[category as DreamTagCategory] ?? []).length > 0)
    || hasCustomTagInCategories(customTags, ['drive', 'interaction', 'intensity']);

  return {
    worldTitle: backgroundSelected ? storyFrame.worldTitle : '',
    worldSummary: backgroundSelected ? storyFrame.worldSummary : '',
    userDreamIdentity: identitySelected ? storyFrame.userDreamIdentity : '',
    characterDreamIdentity: identitySelected ? storyFrame.characterDreamIdentity : '',
    dreamRelationship: relationshipSelected ? storyFrame.dreamRelationship : '',
    openingNode: driveSelected ? storyFrame.openingNode : '',
    storyObjective: driveSelected ? storyFrame.storyObjective : '',
    immediateGoal: driveSelected ? storyFrame.immediateGoal : '',
  };
}

function createDecisionRecord(act: DreamRuntimeAct, choice: ActiveDreamChoice): DreamDecisionRecord {
  return {
    actId: act.id,
    actLabel: act.label,
    choiceId: choice.id,
    title: choice.title,
    direction: choice.direction,
    detail: choice.detail,
    reaction: choice.reaction,
    storyPush: choice.storyPush,
    emotion: choice.emotion,
    fromCustom: choice.fromCustom,
  };
}

function appendDecisionRecord(trail: DreamDecisionRecord[], nextRecord: DreamDecisionRecord | null) {
  if (!nextRecord) return trail;
  const existingIndex = trail.findIndex((record) => record.actId === nextRecord.actId);
  if (existingIndex === -1) return [...trail, nextRecord];
  const cloned = [...trail];
  cloned[existingIndex] = nextRecord;
  return cloned;
}

function upsertDreamAct(acts: DreamRuntimeAct[], nextAct: DreamRuntimeAct, index: number) {
  const cloned = [...acts];
  cloned[index] = nextAct;
  return cloned;
}

function Home({ time: _time, role: _role, onPickRole: _onPickRole, onEnter: _onEnter }: { time: string; role: DreamRole | null; onPickRole: () => void; onEnter: () => void }) {
  return null;
}
/*
function HomeLegacyDeadCode() {
  return (
    <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex min-h-full flex-col">
        <div className="flex items-center justify-between pb-4 text-[12px] tracking-[0.08em] text-[var(--mist)]">
          <div>{time}</div>
          <div className="h-[6px] w-[6px] rounded-full bg-[var(--gold)] animate-[pulse_2.4s_ease-in-out_infinite]" />
        </div>
        <div className="pt-2 text-[30px] font-[200] tracking-[0.32em] text-[var(--paper)]">梦境</div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-6 pb-8 pt-6 text-center sm:justify-center sm:py-8">
          <button type="button" onClick={onPickRole}><Avatar role={role} /></button>
          {role ? (
            <>
              <div className="hidden">
              <div className="hidden">
                <div className="text-[22px] font-[300] tracking-[0.18em] text-[var(--paper)]">{role.name}</div>
                <div className="text-[12px] font-[300] tracking-[0.18em] text-[var(--mist)]">今夜在做梦</div>
              </div>
              <div className="relative w-full max-w-[320px] border border-[var(--border)] bg-[rgba(196,169,106,.04)] px-7 py-5 text-center">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--ink)] px-3 text-[10px] tracking-[0.4em] text-[var(--gold)]">今夜</div>
                <div className="text-[15px] font-[300] leading-[2] tracking-[0.12em] text-[var(--paper)]">有一场梦等待进入</div>
                <div className="mt-2 text-[11px] tracking-[0.12em] text-[var(--mist)]">梦将于 06:00 消散</div>
              </div>
              <div className="w-full max-w-[334px]"><SealButton label="进入今夜" onClick={onEnter} /></div>
              <div className="hidden">
                <div className="text-[22px] font-[300] tracking-[0.18em] text-[var(--paper)]">{role.name}</div>
                <div className="text-[13px] font-[300] tracking-[0.18em] text-[var(--mist)]">浠婂鍦ㄥ仛姊?/div>
              </div>
              <div className="hidden">
              <div className="hidden w-full max-w-[320px] border border-[var(--border)] bg-[rgba(13,18,32,.62)] px-5 py-5 text-center">
                <div className="mx-auto -mt-8 mb-3 inline-block bg-[var(--ink)] px-3 text-[11px] tracking-[0.4em] text-[var(--gold)]">浠婂</div>
                <div className="text-[17px] font-[300] leading-[2] text-[var(--paper)]">鏈変竴鍦烘ⅵ绛夊緟杩涘叆</div>
                <div className="mt-2 text-[12px] tracking-[0.18em] text-[var(--mist)]">姊﹀皢浜?06:00 娑堟暎</div>
              </div>
              <div className="w-full max-w-[334px]"><SealButton label="进 入 今 夜" onClick={onEnter} /></div>
              </div>
            </>
          ) : (
            <div className="pt-2 text-[14px] font-[300] tracking-[0.22em] text-[var(--mist)]">点击头像，选择今夜入梦的角色</div>
          )}
        </div>
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <div className="grid grid-cols-3 text-center text-[12px] tracking-[0.28em] text-[var(--mist)]">
            {['今夜', '残响', '深层'].map((tab, index) => (
              <div key={tab} className="space-y-2">
                <div className={index === 0 ? 'text-[var(--gold)]' : ''}>{tab}</div>
                <div className="mx-auto h-[4px] w-[4px] border border-[var(--border)]">{index === 0 ? <div className="h-full w-full bg-[var(--gold)]" /> : null}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

*/
function HomeV2({
  time,
  role,
  archiveCount,
  deepArchiveCount,
  unfinishedDreamTitle,
  unfinishedDreamMeta,
  canContinueDream,
  hasWorldBookConfig,
  hasWorldBookSignal,
  onPickRole,
  onOpenWorldBooks,
  onEnter,
  onContinueDream,
  onOpenArchive,
  onExit,
}: {
  time: string;
  role: DreamRole | null;
  archiveCount: number;
  deepArchiveCount: number;
  unfinishedDreamTitle?: string;
  unfinishedDreamMeta?: string;
  canContinueDream?: boolean;
  hasWorldBookConfig?: boolean;
  hasWorldBookSignal?: boolean;
  onPickRole: () => void;
  onOpenWorldBooks: () => void;
  onEnter: () => void;
  onContinueDream: () => void;
  onOpenArchive: (view: 'all' | 'deep') => void;
  onExit: () => void;
}) {
  return (
    <Shell time={time} contentClassName="pb-[calc(5.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(2rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="flex items-center justify-between pb-4 text-[12px] tracking-[0.08em] text-[var(--mist)]">
          <div>{time}</div>
          <div className="h-[6px] w-[6px] rounded-full bg-[var(--gold)] animate-[pulse_2.4s_ease-in-out_infinite]" />
        </div>
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-[30px] font-[200] tracking-[0.32em] text-[var(--paper)]">梦境</div>
          <button
            type="button"
            onClick={onOpenWorldBooks}
            aria-label="打开梦境世界书"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition duration-300 hover:scale-[1.02]"
            style={{
              borderColor: hasWorldBookSignal ? 'rgba(196,169,106,.34)' : 'rgba(123,168,196,.18)',
              background: hasWorldBookSignal
                ? 'radial-gradient(circle, rgba(196,169,106,.14) 0%, rgba(123,168,196,.08) 58%, transparent 100%)'
                : 'radial-gradient(circle, rgba(123,168,196,.08) 0%, rgba(123,168,196,.03) 58%, transparent 100%)',
              boxShadow: hasWorldBookSignal ? '0 0 24px rgba(196,169,106,.12)' : 'none',
            }}
          >
            <DreamWorldBookGlyph active={hasWorldBookSignal} className={`h-5 w-5 ${hasWorldBookSignal ? 'text-[var(--gold)]' : 'text-[var(--mist)]'}`} />
            {(hasWorldBookConfig || hasWorldBookSignal) ? (
              <span
                className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full"
                style={{
                  backgroundColor: hasWorldBookConfig ? 'var(--gold)' : '#7BA8C4',
                  boxShadow: hasWorldBookConfig ? '0 0 12px rgba(196,169,106,.44)' : '0 0 12px rgba(123,168,196,.36)',
                }}
              />
            ) : null}
          </button>
        </div>
        <div className="flex flex-col items-center justify-start gap-4 pb-[calc(1.25rem+var(--app-safe-area-bottom-ui,0px))] pt-2 text-center sm:gap-6 sm:py-8">
          <button type="button" onClick={onPickRole}>
            <Avatar role={role} />
          </button>
          {role ? (
            <>
              <div className="space-y-2">
                <div className="text-[22px] font-[300] tracking-[0.18em] text-[var(--paper)]">{role.name}</div>
                <div className="text-[12px] font-[300] tracking-[0.18em] text-[var(--mist)]">今夜在做梦</div>
              </div>
              <div className="relative w-full max-w-[320px] border border-[var(--border)] bg-[rgba(196,169,106,.04)] px-7 py-5 text-center">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--ink)] px-3 text-[10px] tracking-[0.4em] text-[var(--gold)]">今夜</div>
                <div className="text-[15px] font-[300] leading-[2] tracking-[0.12em] text-[var(--paper)]">有一场梦等待进入</div>
                <div className="mt-2 text-[11px] tracking-[0.12em] text-[var(--mist)]">梦将于 06:00 消散</div>
              </div>
              {canContinueDream ? (
                <div className="w-full max-w-[334px] border border-[rgba(123,168,196,.28)] bg-[rgba(123,168,196,.08)] px-5 py-5 text-left">
                  <div className="text-[11px] tracking-[0.26em] text-[#9EBEE2]">未做完的梦</div>
                  <div className="mt-3 text-[15px] font-[300] tracking-[0.12em] text-[var(--paper)]">
                    {unfinishedDreamTitle || '继续上次梦境'}
                  </div>
                  {unfinishedDreamMeta ? (
                    <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.08em] text-[var(--mist)]">{unfinishedDreamMeta}</div>
                  ) : null}
                  <div className="mt-4">
                    <SecondaryAction label="继 续 上 次" onClick={onContinueDream} />
                  </div>
                </div>
              ) : null}
              <div className="w-full max-w-[334px]">
                <SealButton label="进入今夜" onClick={onEnter} />
              </div>
              <div className="w-full max-w-[334px]">
                <SecondaryAction label="退出梦境" onClick={onExit} className="mt-1" />
              </div>
            </>
          ) : (
            <div className="pt-2 text-[14px] font-[300] tracking-[0.22em] text-[var(--mist)]">点击头像，选择今夜入梦的角色</div>
          )}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t px-5 pb-[calc(1rem+var(--app-safe-area-bottom-ui,0px))] pt-4 backdrop-blur-md" style={{ borderColor: 'rgba(196,169,106,.26)', backgroundColor: 'rgba(9,14,25,.68)' }}>
          <div className="grid grid-cols-3 text-center text-[12px] tracking-[0.28em]">
            <button type="button" className="space-y-2" style={{ color: '#D9C08A', textShadow: '0 0 14px rgba(196,169,106,.32)' }}>
              <div>今夜</div>
              <div className="mx-auto h-[4px] w-[4px] border border-[var(--border)]"><div className="h-full w-full bg-[var(--gold)]" /></div>
            </button>
            <button type="button" onClick={() => onOpenArchive('all')} className="space-y-2 transition duration-300" style={{ color: '#9EBEE2' }}>
              <div>残响</div>
              <div className="mx-auto h-[4px] w-[4px] border" style={{ borderColor: archiveCount > 0 ? 'rgba(123,168,196,.55)' : 'rgba(123,168,196,.22)' }} />
            </button>
            <button type="button" onClick={() => onOpenArchive('deep')} className="space-y-2 transition duration-300" style={{ color: 'rgba(158,190,226,.78)' }}>
              <div>梦渊</div>
              <div className="mx-auto h-[4px] w-[4px] border" style={{ borderColor: deepArchiveCount > 0 ? 'rgba(123,168,196,.45)' : 'rgba(123,168,196,.18)' }} />
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function TagsStageV2({
  time,
  selectedRole,
  dreamDepth,
  setDreamDepth,
  selectedTags,
  customTags,
  supplementNote,
  setSupplementNote,
  toggleTag,
  onAddCustomTag,
  onRemoveCustomTag,
  tagBatchIndex,
  cycleTagBatch,
  detailExpanded,
  setDetailExpanded,
  selectedLabels,
  onBack,
  onConfirm,
}: {
  time: string;
  selectedRole: DreamRole;
  dreamDepth: DreamDepth;
  setDreamDepth: (depth: DreamDepth) => void;
  selectedTags: Record<DreamTagCategory, string[]>;
  customTags: DreamCustomTag[];
  supplementNote: string;
  setSupplementNote: Dispatch<SetStateAction<string>>;
  toggleTag: (category: DreamTagCategory, optionId: string, max: number) => void;
  onAddCustomTag: (category: Exclude<DreamTagCategory, 'world'>, label: string) => boolean;
  onRemoveCustomTag: (id: string) => void;
  tagBatchIndex: Partial<Record<DreamTagCategory, number>>;
  cycleTagBatch: (category: DreamTagCategory) => void;
  detailExpanded: boolean;
  setDetailExpanded: Dispatch<SetStateAction<boolean>>;
  selectedLabels: string[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  const customCategoryOptions = dreamTagGroups.filter((group) => group.category !== 'world');
  const [customTagCategory, setCustomTagCategory] = useState<Exclude<DreamTagCategory, 'world'>>('genre');
  const [customCategoryMenuOpen, setCustomCategoryMenuOpen] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const activeCustomCategoryLabel = customCategoryOptions.find((group) => group.category === customTagCategory)?.label || '选择分类';

  useEffect(() => {
    if (!customCategoryOptions.some((group) => group.category === customTagCategory)) {
      setCustomTagCategory(customCategoryOptions[0]?.category ?? 'genre');
    }
  }, [customCategoryOptions, customTagCategory]);

  return (
    <Shell time={time} scrollable contentClassName="pb-[calc(5.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(6rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="flex items-center gap-5 border-b border-[var(--border)] pb-5 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center text-[34px] font-[500] leading-none"
            style={{ color: '#D9C08A', textShadow: '0 0 18px rgba(196,169,106,.42)', opacity: 1 }}
          >
            ‹
          </button>
          <div className="text-[16px] tracking-[0.24em] text-[var(--gold)]">自定义入梦</div>
        </div>

        <div className="mt-8 border-b border-[var(--border)] pb-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">梦型</div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: 'shallow', title: '浅梦', detail: '4-5 轮，一局一结，更像短篇。' },
              { id: 'deep', title: '深梦', detail: '更长更沉，幕与幕之间会继续下去。' },
            ] as const).map((item) => {
              const active = dreamDepth === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDreamDepth(item.id)}
                  className="border px-4 py-4 text-left transition duration-300"
                  style={{
                    borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                    backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                  }}
                >
                  <div className={`text-[15px] tracking-[0.18em] ${active ? 'text-[var(--gold-bright)]' : 'text-[var(--jade)]'}`}>{item.title}</div>
                  <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.08em] text-[var(--mist)]">{item.detail}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-9">
          {dreamTagGroups
            .filter((group) => !group.detailed)
            .map((group) => {
              const activeIds = selectedTags[group.category] ?? [];
              const batchIndex = tagBatchIndex[group.category] ?? 0;
              const batchStart = (batchIndex * BASE_TAG_BATCH_SIZE) % Math.max(group.options.length, 1);
              const batchOptions = [
                ...group.options.slice(batchStart, batchStart + BASE_TAG_BATCH_SIZE),
                ...group.options.slice(0, Math.max(0, batchStart + BASE_TAG_BATCH_SIZE - group.options.length)),
              ].slice(0, Math.min(BASE_TAG_BATCH_SIZE, group.options.length));
              const visibleOptions = [
                ...group.options.filter((option) => activeIds.includes(option.id)),
                ...batchOptions,
              ].filter((option, index, array) => array.findIndex((item) => item.id === option.id) === index);
              const canCycle = group.options.length > BASE_TAG_BATCH_SIZE;
              return (
                <div key={group.category} className="border-b border-[var(--border)] pb-7">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">{group.label}</div>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    {canCycle ? (
                      <button
                        type="button"
                        onClick={() => cycleTagBatch(group.category)}
                        className="border px-3 py-2 text-[10px] tracking-[0.22em] transition duration-300"
                        style={{ borderColor: 'rgba(123,168,196,.2)', color: 'var(--jade)', backgroundColor: 'rgba(123,168,196,.05)' }}
                      >
                        换一批
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {visibleOptions.map((option) => {
                      const active = activeIds.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleTag(group.category, option.id, group.max)}
                          className="border px-5 py-4 text-[12px] tracking-[0.2em] transition duration-300"
                          style={{
                            borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                            backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                            color: active ? 'var(--gold-bright)' : 'var(--jade)',
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="mt-6 border-b border-t border-[var(--border)] py-5">
          <button type="button" onClick={() => setDetailExpanded((prev) => !prev)} className="flex w-full items-center justify-between text-left">
            <span className="text-[13px] tracking-[0.2em] text-[var(--mist)]">细化标签</span>
            <span className="text-[22px] leading-none text-[var(--jade)]">{detailExpanded ? '˄' : '˅'}</span>
          </button>
        </div>

        {detailExpanded ? (
          <div className="mt-8 flex flex-col gap-9">
            {dreamTagGroups
              .filter((group) => group.detailed)
              .map((group) => {
                const activeIds = selectedTags[group.category] ?? [];
                return (
                  <div key={group.category} className="border-b border-[var(--border)] pb-7">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">{group.label}</div>
                      <div className="h-px flex-1 bg-[var(--border)]" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {group.options.map((option) => {
                        const active = activeIds.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleTag(group.category, option.id, group.max)}
                            className="border px-5 py-4 text-[12px] tracking-[0.2em] transition duration-300"
                            style={{
                              borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                              backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                              color: active ? 'var(--gold-bright)' : 'var(--jade)',
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : null}

        <div className="mt-8 border-b border-[var(--border)] pb-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">自定义标签</div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="rounded-[24px] border px-4 py-4" style={{ borderColor: 'rgba(123,168,196,.18)', backgroundColor: 'rgba(10,15,25,.7)' }}>
            <div className="text-[11px] leading-[1.9] tracking-[0.12em] text-[var(--mist)]">
              开局前可以自己补标签。先选分类，再写标签名，这样梦还能继续按现有分类逻辑生成。
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCustomCategoryMenuOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between border px-3 py-3 text-left text-[12px] tracking-[0.14em] transition duration-300"
                  style={{ borderColor: 'rgba(123,168,196,.18)', backgroundColor: 'rgba(7,13,24,.92)', color: 'var(--jade)' }}
                >
                  <span>{activeCustomCategoryLabel}</span>
                  <span className="text-[12px] text-[var(--jade)]">{customCategoryMenuOpen ? '▴' : '▾'}</span>
                </button>
                {customCategoryMenuOpen ? (
                  <div
                    className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 border p-2"
                    style={{
                      borderColor: 'rgba(123,168,196,.18)',
                      backgroundColor: 'rgba(7,13,24,.98)',
                      boxShadow: '0 14px 34px rgba(0,0,0,.32)',
                    }}
                  >
                    <div className="grid gap-2">
                      {customCategoryOptions.map((group) => {
                        const active = group.category === customTagCategory;
                        return (
                          <button
                            key={group.category}
                            type="button"
                            onClick={() => {
                              setCustomTagCategory(group.category);
                              setCustomCategoryMenuOpen(false);
                            }}
                            className="border px-3 py-3 text-left text-[12px] tracking-[0.14em] transition duration-300"
                            style={{
                              borderColor: active ? 'rgba(196,169,106,.22)' : 'rgba(123,168,196,.14)',
                              backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.72)',
                              color: active ? 'var(--gold-bright)' : 'var(--jade)',
                            }}
                          >
                            {group.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3">
                <input
                  value={customTagInput}
                  onChange={(event) => setCustomTagInput(event.target.value)}
                  placeholder="比如：先婚后爱 / 赛博修仙 / 镜头感冷"
                  className="min-w-0 flex-1 border bg-transparent px-4 py-3 text-[12px] tracking-[0.12em] text-[var(--gold-bright)] outline-none placeholder:text-[rgba(237,230,214,.38)]"
                  style={{
                    color: '#F1E2B7',
                    WebkitTextFillColor: '#F1E2B7',
                    caretColor: '#F1E2B7',
                    borderColor: 'rgba(196,169,106,.14)',
                    backgroundColor: 'rgba(13,18,32,.72)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const added = onAddCustomTag(customTagCategory, customTagInput);
                    if (added) setCustomTagInput('');
                  }}
                  className="shrink-0 border px-4 py-3 text-[12px] tracking-[0.18em] transition duration-300"
                  style={{ borderColor: 'rgba(123,168,196,.22)', backgroundColor: 'rgba(123,168,196,.08)', color: 'var(--jade)' }}
                >
                  加入
                </button>
              </div>
            </div>

            {customTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {customTags.map((tag) => {
                  const categoryLabel = customCategoryOptions.find((group) => group.category === tag.category)?.label || tag.category;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onRemoveCustomTag(tag.id)}
                      className="border px-4 py-3 text-left text-[12px] tracking-[0.12em] transition duration-300"
                      style={{ borderColor: 'rgba(196,169,106,.18)', backgroundColor: 'rgba(13,18,32,.65)', color: 'var(--paper)' }}
                    >
                      <div className="text-[10px] tracking-[0.18em] text-[var(--jade)]">{categoryLabel}</div>
                      <div className="mt-1 text-[var(--gold-bright)]">{tag.label}</div>
                      <div className="mt-2 text-[10px] tracking-[0.14em] text-[var(--mist)]">点一下移除</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 text-[11px] leading-[1.9] tracking-[0.12em] text-[var(--mist)]">
                还没有自定义标签。固定标签负责骨架，自定义标签负责补你这局特别想要的那一点。
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-b border-[var(--border)] pb-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">补充说明</div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="rounded-[24px] border px-4 py-4" style={{ borderColor: 'rgba(123,168,196,.18)', backgroundColor: 'rgba(10,15,25,.7)' }}>
            <div className="text-[11px] leading-[1.9] tracking-[0.12em] text-[var(--mist)]">
              放不进标签分类的要求就写在这里。比如想要的气氛、想避开的东西、这局梦特别要收住的一点。
            </div>
            <textarea
              value={supplementNote}
              onChange={(event) => setSupplementNote(event.target.value)}
              placeholder="比如：不要太热闹，画面偏空一点；感情推进慢一点；别写得太甜腻。"
              className="mt-4 min-h-[132px] w-full resize-none border bg-transparent px-4 py-4 text-[12px] leading-[2] tracking-[0.12em] text-[var(--gold-bright)] outline-none placeholder:text-[rgba(237,230,214,.38)]"
              style={{
                color: '#F1E2B7',
                WebkitTextFillColor: '#F1E2B7',
                caretColor: '#F1E2B7',
                borderColor: 'rgba(196,169,106,.14)',
                backgroundColor: 'rgba(13,18,32,.72)',
              }}
            />
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[rgba(5,8,14,.96)] px-5 pb-[calc(1rem+var(--app-safe-area-bottom-ui,0px))] pt-5">
          <div className="mx-auto flex max-w-[390px] items-center justify-between gap-4">
            <div className="text-[12px] tracking-[0.16em] text-[var(--jade)]">已选 {selectedLabels.length} 项</div>
            <button
              type="button"
              onClick={onConfirm}
              className="relative w-[62%] overflow-hidden border px-6 py-4 text-center text-[13px] tracking-[0.48em] transition duration-500 active:scale-[0.99]"
              style={{
                borderColor: 'rgba(196,169,106,.2)',
                color: 'var(--gold)',
                backgroundColor: 'transparent',
              }}
            >
              <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-[rgba(196,169,106,.14)] transition duration-500 hover:scale-x-100" />
              <span className="pointer-events-none absolute inset-[3px] border border-[rgba(196,169,106,.15)]" />
              <span className="relative">开始做梦</span>
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function ConfirmStageV2({
  time,
  entryMode,
  selectedRole,
  selectedDomain,
  scenario,
  preview,
  preflightPlan,
  selectedLabels,
  onBack,
  onConfirm,
}: {
  time: string;
  entryMode: DreamEntryMode;
  selectedRole: DreamRole;
  selectedDomain: DreamDomainId;
  scenario: Pick<DreamScenario, 'coverTitle' | 'coverSubtitle' | 'confirmHint'>;
  preview?: DreamConfirmPreview | null;
  preflightPlan?: DreamPreflightPlan | null;
  selectedLabels: string[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Shell time={time} scrollable contentClassName="pb-[calc(5rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(1.5rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">
          {entryMode === 'character' ? '角色入梦' : `${resolveDomainName(selectedDomain)} · ${scenario.coverTitle}`}
        </div>

        {entryMode === 'character' ? (
          <div className="mt-10 flex flex-1 flex-col items-center justify-start pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))] text-center sm:mt-12 sm:justify-center">
            <div className="relative px-7">
              <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
              <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
              <Avatar role={selectedRole} small />
            </div>
            <div className="mt-10 text-[34px] font-[200] tracking-[0.12em] text-[var(--paper)]">{selectedRole.name}</div>
            <div className="mt-4 text-[13px] tracking-[0.2em] text-[#9EBEE2]">TA的梦，TA来决定</div>
            <div className="mt-8 space-y-4 text-[15px] leading-[2.1] tracking-[0.18em] text-[var(--jade)]">
              <div className="text-[#9EBEE2]">这场梦由TA决定</div>
              <div>你进入后才会逐渐知道</div>
              <div>身份 · 阵营 · 你们之间是什么关系</div>
            </div>
            <div className="mt-12 w-full max-w-[420px]"><SealButton label="确认入梦" onClick={onConfirm} /></div>
            <div className="w-full max-w-[420px]">
              <SecondaryAction label="← 换一种入梦方式" onClick={onBack} className="mt-5" />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-10 flex flex-col items-center text-center">
              <div className="relative px-7">
                <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                <Avatar role={selectedRole} small />
              </div>
              <div className="mt-8 text-[28px] font-[200] tracking-[0.18em] text-[var(--paper)]">{selectedRole.name}</div>
              <div className="mt-3 text-[13px] tracking-[0.18em] text-[var(--mist)]">{preview?.coverSubtitle || scenario.coverSubtitle}</div>
            </div>
            <div className="mt-10 flex-1">
              <div className="flex flex-wrap justify-center gap-3">
                {selectedLabels.map((label, index) => (
                  <div key={`${label}-${index}`} className="border px-4 py-3 text-[12px] tracking-[0.2em] text-[var(--gold)]" style={{ borderColor: 'rgba(196,169,106,.18)', backgroundColor: 'rgba(13,18,32,.7)' }}>
                    {label}
                  </div>
                ))}
              </div>
              {preflightPlan ? (
                <div className="mt-8 space-y-4">
                  <div className="border px-4 py-4" style={{ borderColor: 'rgba(196,169,106,.16)', backgroundColor: 'rgba(13,18,32,.58)' }}>
                    <div className="text-[11px] tracking-[0.28em] text-[var(--gold)]">入梦预览</div>
                    <div className="mt-3 text-[12px] tracking-[0.14em] text-[var(--paper)]">
                      今夜会读取 {preflightPlan.worldBookCount} 条世界书
                    </div>
                    <div className="mt-2 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--mist)]">
                      {preflightPlan.worldBookConflictSummary && preflightPlan.worldBookConflictSummary !== '未触发程序裁决'
                        ? preflightPlan.worldBookConflictSummary
                        : '当前没有发现需要按标签先压掉的世界书冲突。'}
                    </div>
                    {preflightPlan.activeWorldBookTitles.length > 0 ? (
                      <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--paper-60)]">
                        实际读取：{preflightPlan.activeWorldBookTitles.join(' / ')}
                      </div>
                    ) : null}
                    {preflightPlan.supplementNote ? (
                      <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--paper)]">
                        补充说明：{preflightPlan.supplementNote}
                      </div>
                    ) : null}
                    {preflightPlan.affectedWorldBookTitles.length > 0 ? (
                      <div className="mt-2 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--jade)]">
                        受影响书页：{preflightPlan.affectedWorldBookTitles.join(' / ')}
                      </div>
                    ) : null}
                  </div>

                  <div className="border px-4 py-4" style={{ borderColor: 'rgba(196,169,106,.16)', backgroundColor: 'rgba(13,18,32,.58)' }}>
                    <div className="text-[11px] tracking-[0.28em] text-[var(--gold)]">人设底线</div>
                    {preflightPlan.customTagLabels.length > 0 ? (
                      <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--jade)]">
                        自定义标签：{preflightPlan.customTagLabels.join(' / ')}
                      </div>
                    ) : null}
                    <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--paper)]">
                      {preflightPlan.personaFloor.mustKeep.slice(0, 2).map((line, index) => (
                        <div key={`keep-${index}`}>{index + 1}. {line}</div>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--jade)]">
                      {preflightPlan.personaFloor.mayAmplify.slice(0, 2).map((line, index) => (
                        <div key={`amp-${index}`}>可放大：{line}</div>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--mist)]">
                      {preflightPlan.personaFloor.mustNotBecome.slice(0, 2).map((line, index) => (
                        <div key={`not-${index}`}>不要写成：{line}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="mt-8 text-center text-[13px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]">{preview?.confirmHint || scenario.confirmHint}</div>
            </div>
            <div className="mt-10 w-full pb-2"><SealButton label="确认入梦" onClick={onConfirm} /></div>
            <div className="w-full">
              <SecondaryAction label="← 换一种入梦方式" onClick={onBack} className="mt-3" />
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function EntrySheet({
  role,
  onChoose,
  onClose,
}: {
  role: DreamRole;
  onChoose: (mode: DreamEntryMode) => void;
  onClose: () => void;
}) {
  const options: DreamEntryOption[] = [
    {
      id: 'quick',
      title: '一键入梦',
      detail: '系统自动给出世界观、关系张力、剧情驱动与情绪底色。',
      glyph: '壹',
    },
    {
      id: 'custom',
      title: '自定义入梦',
      detail: '你先挑标签，再决定这场梦该往哪里沉。',
      glyph: '定',
    },
    {
      id: 'character',
      title: '角色入梦',
      detail: `这一场梦由 ${role.name} 来决定。你进入之后，才会渐渐知道自己的位置。`,
      glyph: '隐',
      advanced: true,
    },
  ];

  return (
    <div className="absolute inset-0 z-20 bg-[rgba(3,5,9,.44)]" style={dreamThemeStyle}>
      <button type="button" aria-label="关闭入梦方式" className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.65, ease: [0.2, 0.8, 0.4, 1] }}
        className="absolute inset-x-0 bottom-0 max-h-[calc(100%-16px)] overflow-y-auto overscroll-contain touch-pan-y border-t border-[var(--border)] bg-[var(--deep)] px-8 pb-[calc(4.25rem+var(--app-safe-area-bottom-ui,0px))] pt-5 [webkit-overflow-scrolling:touch]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto h-[3px] w-10 rounded-[2px] bg-[var(--mist)] opacity-30" />
        <div className="mt-7 text-center text-[12px] tracking-[0.42em] text-[var(--mist)]">入 梦 方 式</div>
        <div className="mt-7">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChoose(option.id)}
              className="flex w-full items-start gap-4 border-b border-[var(--border)] px-1 py-5 text-left transition duration-300 hover:bg-[rgba(196,169,106,.04)]"
            >
              <div className="mt-1 flex h-10 w-10 flex-none items-center justify-center border border-[var(--border)] text-[16px] text-[var(--gold)]">
                {option.glyph}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[16px] font-[400] tracking-[0.12em] text-[var(--paper)]">{option.title}</div>
                  {option.advanced ? (
                    <span className="inline-flex border border-[rgba(123,168,196,.25)] px-2 py-[2px] text-[9px] tracking-[0.18em] text-[var(--jade)]">
                      高级
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-[12px] leading-[1.7] tracking-[0.08em] text-[var(--mist)]">{option.detail}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button type="button" onClick={onClose} className="text-[11px] tracking-[0.3em] text-[#8FB3D8]">
            返 回 今 夜
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function DreamAppPage({
  onBack,
  characters,
  userName,
  activeConfig,
  masks,
  worldBooks,
  resumeBackgroundSignal = 0,
  onResumeBackgroundHandled,
}: {
  onBack: () => void;
  characters: Character[];
  userName: string;
  activeConfig: ApiConfig;
  masks: Mask[];
  worldBooks: WorldBookEntry[];
  resumeBackgroundSignal?: number;
  onResumeBackgroundHandled?: () => void;
}) {
  const roles = useMemo(() => buildRoles(characters), [characters]);
  const [time, setTime] = useState(formatDreamTime);
  const [stage, setStage] = useState<DreamStage>('splash');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(() => readPersistedDreamSelectedRoleId());
  const [entryMode, setEntryMode] = useState<DreamEntryMode>('quick');
  const [selectedDomain, setSelectedDomain] = useState<DreamDomainId>('shared');
  const [dreamDepth, setDreamDepth] = useState<DreamDepth>('shallow');
  const [selectedTags, setSelectedTags] = useState<Record<DreamTagCategory, string[]>>(defaultTagSelection);
  const [customTags, setCustomTags] = useState<DreamCustomTag[]>(() => readPersistedDreamSession()?.customTags || []);
  const [supplementNote, setSupplementNote] = useState(() => readPersistedDreamSession()?.supplementNote || '');
  const [tagBatchIndex, setTagBatchIndex] = useState<Partial<Record<DreamTagCategory, number>>>({});
  const [confirmPreview, setConfirmPreview] = useState<DreamConfirmPreview | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [actIndex, setActIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<ActiveDreamChoice | null>(null);
  const [previewChoiceId, setPreviewChoiceId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [customInputOpen, setCustomInputOpen] = useState(false);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);
  const [isGeneratingNextAct, setIsGeneratingNextAct] = useState(false);
  const [isEndingDeepDream, setIsEndingDeepDream] = useState(false);
  const [isGeneratingEnding, setIsGeneratingEnding] = useState(false);
  const [isGeneratingAftermath, setIsGeneratingAftermath] = useState(false);
  const [closingActId, setClosingActId] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [runtimeScenario, setRuntimeScenario] = useState<DreamRuntimeScenario | null>(null);
  const [archiveRecords, setArchiveRecords] = useState<DreamArchiveRecord[]>(() => loadDreamArchiveRecords());
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState<'all' | 'deep'>('all');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [latestSavedSession, setLatestSavedSession] = useState<PersistedDreamSession | null>(() => readPersistedDreamSession());
  const [showDreamWorldBookSheet, setShowDreamWorldBookSheet] = useState(false);
  const [dreamWorldBookConfig, setDreamWorldBookConfig] = useState<DreamWorldBookConfig>(() => (
    normalizeDreamWorldBookConfig(readPersistedDreamSession()?.dreamWorldBookConfig)
  ));
  const [dreamWorldBookNote, setDreamWorldBookNote] = useState<{
    tone: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [dreamWorldBookImportDrafts, setDreamWorldBookImportDrafts] = useState<DreamWorldBookImportDraft[] | null>(null);
  const [showAdvancedDreamWorldBookImportReview, setShowAdvancedDreamWorldBookImportReview] = useState(false);
  const endingRequestActiveRef = useRef(false);
  const aftermathRequestActiveRef = useRef(false);
  const dreamWorldBookImportInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundTask = getCurrentDreamBackgroundTask();
  const persistedLatestSession = readPersistedDreamSession();
  const resumableDream = buildDreamResumableState(persistedLatestSession, backgroundTask);
  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedRoleId) ?? characters[0] ?? null,
    [characters, selectedRoleId],
  );
  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null, [roles, selectedRoleId]);
  const normalizedDreamWorldBookConfig = useMemo(
    () => normalizeDreamWorldBookConfig(dreamWorldBookConfig),
    [dreamWorldBookConfig],
  );
  const inheritedDreamWorldBooks = useMemo(
    () => (selectedCharacter ? resolveDreamInheritedWorldBooks(selectedCharacter, worldBooks) : []),
    [selectedCharacter, worldBooks],
  );
  const dreamPromptWorldBooks = useMemo(
    () => (
      selectedCharacter
        ? buildDreamPromptWorldBooks({
            character: selectedCharacter,
            inheritedWorldBooks: inheritedDreamWorldBooks,
            config: normalizedDreamWorldBookConfig,
          })
        : []
    ),
    [selectedCharacter, inheritedDreamWorldBooks, normalizedDreamWorldBookConfig],
  );
  const hasDreamWorldBookConfig = (
    (normalizedDreamWorldBookConfig.excludedInheritedIds?.length || 0)
    + (normalizedDreamWorldBookConfig.localEntries?.length || 0)
  ) > 0;
  const hasDreamWorldBookSignal = dreamPromptWorldBooks.length > 0;
  const dreamPreflightPlan = useMemo<DreamPreflightPlan | null>(() => {
    if (!selectedCharacter) return null;

    const promptInput = buildDreamPromptInput({
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks: dreamPromptWorldBooks,
      dreamWorldBookConfig: normalizedDreamWorldBookConfig,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
    });

    return buildDreamPreflightPlan({
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
      worldBooks: dreamPromptWorldBooks,
      worldBookConflictSummary: promptInput.worldBookConflictSummary,
      affectedWorldBookTitles: promptInput.worldBookConflictAffectedTitles,
      personaFloor: promptInput.personaFloor,
    });
  }, [
    activeConfig,
    customTags,
    dreamDepth,
    dreamPromptWorldBooks,
    entryMode,
    masks,
    normalizedDreamWorldBookConfig,
    selectedCharacter,
    selectedDomain,
    selectedTags,
    supplementNote,
  ]);
  const previewScenario = useMemo(() => resolveScenario(selectedDomain, dreamDepth), [selectedDomain, dreamDepth]);
  const scenario = runtimeScenario ?? previewScenario;
  const act = runtimeScenario?.acts[actIndex] ?? null;
  const choiceAct = stage === 'choices' ? act : null;
  const presentation = runtimeScenario?.presentation ?? {
    accent: 'var(--gold)',
    accentSoft: 'rgba(196,169,106,.12)',
    dialogueText: 'var(--gold-bright)',
    frameBorder: 'rgba(196,169,106,.28)',
    frameFill: 'rgba(13,18,32,.72)',
    layoutId: 'soft-overlay-monologue',
  };
  const storyFrame = runtimeScenario?.storyFrame ?? null;
  const displayStoryFrame = useMemo(
    () => (entryMode === 'custom' ? buildCustomVisibleStoryFrame(storyFrame, selectedTags, customTags) : storyFrame),
    [customTags, entryMode, selectedTags, storyFrame],
  );
  const sceneBlocks = useMemo(() => act?.narrative.pages[0]?.blocks ?? [], [act]);
  const typedSceneBlocks = useNarrativeTypewriter(sceneBlocks, stage === 'scene', `${runtimeScenario?.id || 'preview'}-${act?.id || 'none'}-scene`);
  const hasSceneContent = sceneBlocks.length > 0 && sceneBlocks.some((block) => block.text.trim());
  const sceneReady =
    hasSceneContent
    && typedSceneBlocks.length === sceneBlocks.length
    && typedSceneBlocks.every((block, index) => block.text === sceneBlocks[index]?.text);
  const isDeepDream = runtimeScenario?.depth === 'deep';
  const isClosingAct = Boolean(act && closingActId && act.id === closingActId);
  const isLastGeneratedAct = Boolean(runtimeScenario && actIndex === runtimeScenario.acts.length - 1);
  const endingView = runtimeScenario && selectedRole ? buildRuntimeEndingView(runtimeScenario, selectedRole.name, userName) : buildPresetEndingView(previewScenario);
  const aftermathView = runtimeScenario ? buildRuntimeAftermathView(runtimeScenario) : previewScenario.aftermath;
  const aftermathMetaLine = useMemo(() => {
    const relationshipShift = runtimeScenario?.aftermathInput.relationshipShift?.trim() || '';
    const toneDrift = runtimeScenario?.aftermathInput.toneDrift?.trim() || '';
    const parts = [relationshipShift, toneDrift].filter(Boolean);
    return parts.join(' · ');
  }, [runtimeScenario?.aftermathInput.relationshipShift, runtimeScenario?.aftermathInput.toneDrift]);
  const reactionFullText = selectedChoice ? `${selectedChoice.reaction}\n\n${selectedChoice.storyPush}` : '';
  const reactionBlocks = useMemo(() => buildReactionBlocks(selectedChoice, act), [act, selectedChoice]);
  const typedReactionBlocks = useNarrativeTypewriter(
    reactionBlocks,
    stage === 'reaction',
    `${runtimeScenario?.id || 'preview'}-${act?.id || 'none'}-${selectedChoice?.id || 'choice'}-reaction`,
  );
  const reactionReady =
    reactionBlocks.length > 0
    && typedReactionBlocks.length === reactionBlocks.length
    && typedReactionBlocks.every((block, index) => block.text === reactionBlocks[index]?.text);
  const endingTextBlocks = useMemo(
    () => buildSimpleTypewriterBlocks([
      { id: 'ending-body', text: endingView.body || '' },
      { id: 'ending-excerpt', text: endingView.excerpt || '' },
    ]),
    [endingView.body, endingView.excerpt],
  );
  const typedEndingTextBlocks = useNarrativeTypewriter(
    endingTextBlocks,
    stage === 'ending' && Boolean(runtimeScenario?.endingOutput) && !isGeneratingEnding,
    `${runtimeScenario?.id || 'preview'}-${runtimeScenario?.endingOutput?.title || 'ending'}-ending`,
  );
  const endingTextReady =
    Boolean(runtimeScenario?.endingOutput)
    && typedEndingTextBlocks.length === endingTextBlocks.length
    && typedEndingTextBlocks.every((block, index) => block.text === endingTextBlocks[index]?.text);
  const typedEndingBody = typedEndingTextBlocks[0]?.text || '';
  const typedEndingExcerpt = typedEndingTextBlocks[1]?.text || '';
  const aftermathMessageBlocks = useMemo(
    () => buildSimpleTypewriterBlocks(
      aftermathView.previewMessages.map((message, index) => ({
        id: `aftermath-message-${index + 1}`,
        text: message || '',
      })),
    ),
    [aftermathView.previewMessages],
  );
  const typedAftermathMessageBlocks = useNarrativeTypewriter(
    aftermathMessageBlocks,
    stage === 'aftermath' && Boolean(runtimeScenario?.aftermathOutput) && !isGeneratingAftermath,
    `${runtimeScenario?.id || 'preview'}-${runtimeScenario?.aftermathOutput?.summary || 'aftermath'}-messages`,
  );
  const aftermathTextBlocks = useMemo(
    () => buildSimpleTypewriterBlocks([
      { id: 'aftermath-summary', text: aftermathView.summary || '' },
      { id: 'aftermath-detail', text: aftermathView.detail || '' },
    ]),
    [aftermathView.detail, aftermathView.summary],
  );
  const typedAftermathTextBlocks = useNarrativeTypewriter(
    aftermathTextBlocks,
    stage === 'aftermath' && Boolean(runtimeScenario?.aftermathOutput) && !isGeneratingAftermath,
    `${runtimeScenario?.id || 'preview'}-${runtimeScenario?.aftermathOutput?.detail || 'aftermath'}-detail`,
  );
  const aftermathTextReady =
    Boolean(runtimeScenario?.aftermathOutput)
    && typedAftermathMessageBlocks.length === aftermathMessageBlocks.length
    && typedAftermathMessageBlocks.every((block, index) => block.text === aftermathMessageBlocks[index]?.text)
    && typedAftermathTextBlocks.length === aftermathTextBlocks.length
    && typedAftermathTextBlocks.every((block, index) => block.text === aftermathTextBlocks[index]?.text);
  const typedAftermathMessages = typedAftermathMessageBlocks.map((block) => block.text);
  const typedAftermathSummary = typedAftermathTextBlocks[0]?.text || '';
  const typedAftermathDetail = typedAftermathTextBlocks[1]?.text || '';
  const choiceHoldTimerRef = useRef<number | null>(null);
  const updateDreamWorldBookConfig = (
    updater: DreamWorldBookConfig | ((prev: DreamWorldBookConfig) => DreamWorldBookConfig),
  ) => {
    setDreamWorldBookConfig((prev) => {
      const resolved = typeof updater === 'function'
        ? (updater as (prev: DreamWorldBookConfig) => DreamWorldBookConfig)(prev)
        : updater;
      return normalizeDreamWorldBookConfig(resolved);
    });
  };
  const toggleDreamInheritedWorldBook = (worldBookId: string) => {
    updateDreamWorldBookConfig((prev) => {
      const excluded = new Set(prev.excludedInheritedIds || []);
      if (excluded.has(worldBookId)) {
        excluded.delete(worldBookId);
      } else {
        excluded.add(worldBookId);
      }
      return {
        ...prev,
        excludedInheritedIds: Array.from(excluded),
      };
    });
    setDreamWorldBookNote(null);
  };
  const removeDreamLocalWorldBook = (worldBookId: string) => {
    updateDreamWorldBookConfig((prev) => ({
      ...prev,
      localEntries: (prev.localEntries || []).filter((entry) => entry.id !== worldBookId),
    }));
    setDreamWorldBookNote(null);
  };
  const closeDreamWorldBookImportReview = () => {
    setDreamWorldBookImportDrafts(null);
    setShowAdvancedDreamWorldBookImportReview(false);
  };
  const commitDreamImportedWorldBooks = (entries: WorldBookEntry[]) => {
    if (!selectedCharacter) {
      setDreamWorldBookNote({
        tone: 'info',
        text: '先选一个入梦角色，再决定今夜私藏书页要带给谁。',
      });
      closeDreamWorldBookImportReview();
      return;
    }

    if (entries.length === 0) {
      setDreamWorldBookNote({
        tone: 'info',
        text: '至少选一条书页，再把它带进今夜。',
      });
      return;
    }

    updateDreamWorldBookConfig((prev) => ({
      ...prev,
      localEntries: mergeDreamLocalWorldBooks(prev.localEntries || [], entries, selectedCharacter.id),
    }));
    closeDreamWorldBookImportReview();
    setDreamWorldBookNote({
      tone: 'success',
      text: entries.length > 1
        ? `整理后带进今夜 ${entries.length} 条书页。`
        : `整理后带进今夜 1 条书页。`,
    });
  };
  const handleDreamWorldBookImportDefault = () => {
    if (!dreamWorldBookImportDrafts) return;
    commitDreamImportedWorldBooks(buildDreamImportedWorldBooksFromDrafts(
      dreamWorldBookImportDrafts.map((draft) => ({ ...draft, mergeGroup: '' })),
    ));
  };
  const toggleDreamWorldBookImportDraftInclude = (draftId: string) => {
    setDreamWorldBookImportDrafts((prev) => prev
      ? prev.map((draft) => (
        draft.draftId === draftId
          ? { ...draft, include: !draft.include }
          : draft
      ))
      : prev);
  };
  const updateDreamWorldBookImportDraftMergeGroup = (draftId: string, value: string) => {
    setDreamWorldBookImportDrafts((prev) => prev
      ? prev.map((draft) => (
        draft.draftId === draftId
          ? { ...draft, mergeGroup: value }
          : draft
      ))
      : prev);
  };
  const confirmReviewedDreamWorldBookImport = () => {
    if (!dreamWorldBookImportDrafts) return;
    commitDreamImportedWorldBooks(buildDreamImportedWorldBooksFromDrafts(dreamWorldBookImportDrafts));
  };
  const handleImportDreamWorldBookFile = async (file?: File | null) => {
    if (!file) return;
    if (!selectedCharacter) {
      setDreamWorldBookNote({
        tone: 'info',
        text: '先选一个入梦角色，再把今夜要读的书页放进来。',
      });
      setStage('role-picker');
      return;
    }

    try {
      const importedEntries = await createDreamLocalWorldBooksFromFile(file, selectedCharacter.id);
      if (importedEntries.length === 0) {
        throw new Error('没有认出可导入的世界书内容。');
      }

      setDreamWorldBookImportDrafts(buildDreamWorldBookImportDrafts(importedEntries));
      setShowAdvancedDreamWorldBookImportReview(false);
      setDreamWorldBookNote({
        tone: 'info',
        text: `识别到 ${importedEntries.length} 条书页，先整理一下再带进今夜吧。`,
      });
    } catch (error) {
      setDreamWorldBookNote({
        tone: 'error',
        text: error instanceof Error ? error.message : '导入失败了，换一个 JSON 或 TXT 文件再试试。',
      });
    }
  };

  const persistDreamProgress = (
    scenarioToPersist: DreamRuntimeScenario,
    overrides?: Partial<NonNullable<PersistedDreamSession['progress']>>,
  ) => {
    if (!selectedCharacter) return;

    const progressStage = overrides?.stage ?? stage;
    const nextSession: PersistedDreamSession = {
      resumeKind: 'saved',
      mode: entryMode,
      roleId: selectedCharacter.id,
      domain: selectedDomain,
      depth: dreamDepth,
      selectedTags,
      customTags,
      supplementNote,
      dreamWorldBookConfig: normalizedDreamWorldBookConfig,
      scenario: scenarioToPersist,
      createdAt: Date.now(),
      progress: isDreamResumeStage(progressStage)
        ? {
            stage: progressStage,
            actIndex: overrides?.actIndex ?? actIndex,
            selectedChoice: overrides?.selectedChoice ?? selectedChoice,
            closingActId: overrides?.closingActId ?? closingActId,
            customInput: overrides?.customInput ?? customInput,
            customInputOpen: overrides?.customInputOpen ?? customInputOpen,
          }
        : undefined,
    };

    writePersistedDreamSession(nextSession);
    setLatestSavedSession(nextSession);
  };

  const clearDreamProgress = () => {
    clearPersistedDreamSession();
    clearDreamBackgroundResumeRequest();
    setLatestSavedSession(null);
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig());
    setDreamWorldBookNote(null);
  };

  const refreshLatestSavedSession = () => {
    setLatestSavedSession(readPersistedDreamSession());
  };

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatDreamTime()), 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roles.length) return;
    if (!selectedRoleId || !roles.some((role) => role.id === selectedRoleId)) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (!selectedRoleId) return;
    writePersistedDreamSelectedRoleId(selectedRoleId);
  }, [selectedRoleId]);

  useEffect(() => {
    if (stage !== 'splash') return;
    const timer = window.setTimeout(() => setStage('home'), 3200);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'loading' || !selectedRole || !selectedCharacter) return;
    let cancelled = false;
    setLoadingError(null);
    setRuntimeScenario(null);
    setLoadingProgress(12);
    const progressTimer = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 92) return prev;
        return Math.min(92, prev + 1 + Math.random() * 3.5);
      });
    }, 180);

    const dreamOptions = {
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks: dreamPromptWorldBooks,
      dreamWorldBookConfig: normalizedDreamWorldBookConfig,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
    } as const;

    startDreamBackgroundGeneration(dreamOptions)
      .then((generatedScenario) => {
        if (cancelled) return;
        window.clearInterval(progressTimer);
        setRuntimeScenario(generatedScenario);
        setLoadingProgress(100);
        setActIndex(0);
        setSelectedChoice(null);
        setClosingActId(null);
        setCustomInput('');
        window.setTimeout(() => {
          if (!cancelled) setStage('scene');
        }, 260);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        window.clearInterval(progressTimer);
        setLoadingProgress(0);
        setLoadingError(error instanceof Error ? error.message : '梦境生成失败');
      });

    return () => {
      cancelled = true;
      window.clearInterval(progressTimer);
    };
  }, [
    activeConfig,
    customTags,
    dreamDepth,
    dreamPromptWorldBooks,
    entryMode,
    masks,
    normalizedDreamWorldBookConfig,
    selectedCharacter,
    selectedDomain,
    selectedRole,
    selectedTags,
    supplementNote,
    stage,
  ]);

  useEffect(() => {
    if (stage !== 'choices') {
      setPreviewChoiceId(null);
      setCustomInputOpen(false);
      if (choiceHoldTimerRef.current) {
        window.clearTimeout(choiceHoldTimerRef.current);
        choiceHoldTimerRef.current = null;
      }
    }
  }, [stage]);

  useEffect(() => {
    if (!resumeBackgroundSignal) return;

    const backgroundTask = getCurrentDreamBackgroundTask();
    if (backgroundTask?.status === 'resolved') {
      const backgroundCharacterId = backgroundTask.options.character.id;
      setSelectedRoleId(backgroundCharacterId);
      setEntryMode(backgroundTask.options.selection.entryMode);
      setSelectedDomain(backgroundTask.options.selection.domainId);
      setDreamDepth(backgroundTask.options.selection.depth);
      setSelectedTags(backgroundTask.options.selection.selectedTags);
      setCustomTags(backgroundTask.options.selection.customTags || []);
      setSupplementNote(backgroundTask.options.selection.supplementNote || '');
      setDreamWorldBookConfig(normalizeDreamWorldBookConfig(backgroundTask.options.dreamWorldBookConfig));
      setDreamWorldBookNote(null);
      setConfirmPreview(null);
      setLoadingError(null);
      setLoadingProgress(100);
      setRuntimeScenario(backgroundTask.scenario);
      setActIndex(0);
      setSelectedChoice(null);
      setClosingActId(null);
      setCustomInput('');
      setCustomInputOpen(false);
      setStage('scene');
      clearDreamBackgroundResumeRequest();
      onResumeBackgroundHandled?.();
      return;
    }

    const persisted = readPersistedDreamSession();
    if (!persisted || !isPersistedDreamUnfinished(persisted)) {
      onResumeBackgroundHandled?.();
      return;
    }

    setSelectedRoleId(persisted.roleId);
    setEntryMode(persisted.mode);
    setSelectedDomain(persisted.domain);
    setDreamDepth(persisted.depth);
    setSelectedTags(persisted.selectedTags);
    setCustomTags(persisted.customTags || []);
    setSupplementNote(persisted.supplementNote || '');
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig(persisted.dreamWorldBookConfig));
    setDreamWorldBookNote(null);
    setConfirmPreview(null);
    setLoadingError(null);
    setLoadingProgress(100);
    setRuntimeScenario(hydrateDreamRuntimeScenario(persisted.scenario));
    setActIndex(persisted.progress?.actIndex ?? 0);
    setSelectedChoice(persisted.progress?.selectedChoice ?? null);
    setClosingActId(persisted.progress?.closingActId ?? null);
    setCustomInput(persisted.progress?.customInput ?? '');
    setCustomInputOpen(persisted.progress?.customInputOpen ?? false);
    setStage(isDreamResumeStage(persisted.progress?.stage) ? persisted.progress.stage : 'scene');
    clearDreamBackgroundResumeRequest();
    onResumeBackgroundHandled?.();
  }, [onResumeBackgroundHandled, resumeBackgroundSignal]);

  useEffect(() => {
    if (!runtimeScenario?.endingOutput || !selectedCharacter) return;
    const nextRecord = buildDreamArchiveRecord({
      character: selectedCharacter,
      scenario: runtimeScenario,
      selectedTags,
      customTags,
      supplementNote,
    });
    setArchiveRecords((prev) => {
      const next = upsertDreamArchiveRecord(prev, nextRecord);
      saveDreamArchiveRecords(next);
      return next;
    });
  }, [customTags, runtimeScenario, selectedCharacter, selectedTags, supplementNote]);

  useEffect(() => {
    if (!runtimeScenario?.endingOutput || !runtimeScenario.aftermathOutput) return;
    clearDreamProgress();
  }, [runtimeScenario?.aftermathOutput, runtimeScenario?.endingOutput]);

  useEffect(() => {
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        refreshLatestSavedSession();
      }
    };

    const handleFocusRefresh = () => {
      refreshLatestSavedSession();
    };

    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    return () => {
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, []);

  useEffect(() => {
    if (!persistedLatestSession) return;
    if (isPersistedDreamUnfinished(persistedLatestSession)) return;
    clearDreamProgress();
  }, [persistedLatestSession]);

  useEffect(() => {
    endingRequestActiveRef.current = isGeneratingEnding;
  }, [isGeneratingEnding]);

  useEffect(() => {
    aftermathRequestActiveRef.current = isGeneratingAftermath;
  }, [isGeneratingAftermath]);

  useEffect(() => {
    if (
      stage !== 'ending'
      || !runtimeScenario
      || !selectedCharacter
      || runtimeScenario.endingOutput
      || endingRequestActiveRef.current
    ) {
      return;
    }

    let cancelled = false;
    setLoadingError(null);
    endingRequestActiveRef.current = true;
    setIsGeneratingEnding(true);
    debugDreamStagePayload('[dream][ending] request:start', {
      scenarioId: runtimeScenario.id,
      stage,
      actCount: runtimeScenario.acts.length,
      hasEndingOutput: Boolean(runtimeScenario.endingOutput),
      endingDirection: runtimeScenario.endingInput?.endingDirection || '',
    });

    generateDreamEnding({
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks: dreamPromptWorldBooks,
      dreamWorldBookConfig: normalizedDreamWorldBookConfig,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
      scenario: runtimeScenario,
      userName,
    })
      .then((endingOutput) => {
        if (cancelled) return;
        debugDreamStagePayload('[dream][ending] request:resolved', {
          scenarioId: runtimeScenario.id,
          title: endingOutput.title,
          chapter: endingOutput.chapter,
          bodyLength: endingOutput.body.length,
          excerptLength: endingOutput.excerpt.length,
        });
        setRuntimeScenario((prev) => (
          prev
            ? hydrateDreamRuntimeScenario({
                ...prev,
                endingOutput,
              })
            : prev
        ));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[dream][ending] request:failed', error);
        setLoadingError(error instanceof Error ? error.message : '结局生成失败');
      })
      .finally(() => {
        if (!cancelled) {
          debugDreamStagePayload('[dream][ending] request:finalized', {
            scenarioId: runtimeScenario.id,
            cancelled: false,
          });
          endingRequestActiveRef.current = false;
          setIsGeneratingEnding(false);
        }
      });

    return () => {
      cancelled = true;
      debugDreamStagePayload('[dream][ending] request:cleanup', {
        scenarioId: runtimeScenario.id,
      });
    };
  }, [
    activeConfig,
    customTags,
    dreamDepth,
    dreamPromptWorldBooks,
    entryMode,
    masks,
    normalizedDreamWorldBookConfig,
    runtimeScenario,
    selectedCharacter,
    selectedDomain,
    selectedTags,
    supplementNote,
    stage,
    userName,
  ]);

  useEffect(() => {
    if (
      stage !== 'aftermath'
      || !runtimeScenario
      || !selectedCharacter
      || !runtimeScenario.endingOutput
      || runtimeScenario.aftermathOutput
      || aftermathRequestActiveRef.current
    ) {
      return;
    }

    let cancelled = false;
    setLoadingError(null);
    aftermathRequestActiveRef.current = true;
    setIsGeneratingAftermath(true);
    debugDreamStagePayload('[dream][aftermath] request:start', {
      scenarioId: runtimeScenario.id,
      stage,
      hasEndingOutput: Boolean(runtimeScenario.endingOutput),
      hasAftermathOutput: Boolean(runtimeScenario.aftermathOutput),
    });

    generateDreamAftermath({
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks: dreamPromptWorldBooks,
      dreamWorldBookConfig: normalizedDreamWorldBookConfig,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
      scenario: runtimeScenario,
      userName,
    })
      .then((aftermathOutput) => {
        if (cancelled) return;
        debugDreamStagePayload('[dream][aftermath] request:resolved', {
          scenarioId: runtimeScenario.id,
          summaryLength: aftermathOutput.summary.length,
          detailLength: aftermathOutput.detail.length,
          previewCount: aftermathOutput.previewMessages.length,
        });
        setRuntimeScenario((prev) => (
          prev
            ? hydrateDreamRuntimeScenario({
                ...prev,
                aftermathOutput,
              })
            : prev
        ));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[dream][aftermath] request:failed', error);
        setLoadingError(error instanceof Error ? error.message : '余响生成失败');
      })
      .finally(() => {
        if (!cancelled) {
          debugDreamStagePayload('[dream][aftermath] request:finalized', {
            scenarioId: runtimeScenario.id,
            cancelled: false,
          });
          aftermathRequestActiveRef.current = false;
          setIsGeneratingAftermath(false);
        }
      });

    return () => {
      cancelled = true;
      debugDreamStagePayload('[dream][aftermath] request:cleanup', {
        scenarioId: runtimeScenario.id,
      });
    };
  }, [
    activeConfig,
    customTags,
    dreamDepth,
    dreamPromptWorldBooks,
    entryMode,
    masks,
    normalizedDreamWorldBookConfig,
    runtimeScenario,
    selectedCharacter,
    selectedDomain,
    selectedTags,
    supplementNote,
    stage,
    userName,
  ]);

  const openEntry = () => {
    if (!selectedRole) {
      setStage('role-picker');
      return;
    }
    setStage('entry');
  };

  const chooseMode = (mode: DreamEntryMode) => {
    setEntryMode(mode);
    if (mode === 'quick') {
      const preset = buildQuickDreamPreset();
      setSelectedDomain(preset.domainId);
      setDreamDepth(preset.depth);
      setSelectedTags(preset.selectedTags);
      setCustomTags([]);
      setSupplementNote('');
      setConfirmPreview(preset.preview);
      setStage('confirm');
      return;
    }
    if (mode === 'character') {
      const preset = buildCharacterDreamPreset();
      setSelectedDomain(preset.domainId);
      setDreamDepth(preset.depth);
      setSelectedTags(preset.selectedTags);
      setCustomTags([]);
      setSupplementNote('');
      setConfirmPreview(null);
      setStage('confirm');
      return;
    }
    setSelectedDomain('shared');
    setDreamDepth('shallow');
    setCustomTags([]);
    setSupplementNote('');
    setConfirmPreview(null);
    setStage('tags');
  };

  const toggleTag = (category: DreamTagCategory, optionId: string, max: number) => {
    setSelectedTags((prev) => {
      const current = prev[category] ?? [];
      const group = dreamTagGroups.find((item) => item.category === category);
      const isSingleSelect = category === 'world';
      const isUnlimitedDetailed = Boolean(group?.detailed);
      let next: string[];
      if (isSingleSelect) {
        next = [optionId];
      } else if (isUnlimitedDetailed) {
        next = current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current, optionId];
      } else {
        next = current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current.slice(-(Math.max(max - 1, 0))), optionId];
      }
      if (category === 'world' && next[0]) setSelectedDomain(next[0] as DreamDomainId);
      return { ...prev, [category]: next };
    });
  };

  const addCustomTag = (category: Exclude<DreamTagCategory, 'world'>, label: string) => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return false;

    const exists = customTags.some((tag) => (
      tag.category === category && tag.label.trim().toLowerCase() === normalizedLabel.toLowerCase()
    ));
    if (exists) return false;

    setCustomTags((prev) => [
      ...prev,
      {
        id: `dream-custom-tag-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        category,
        label: normalizedLabel,
      },
    ]);
    return true;
  };

  const removeCustomTag = (id: string) => {
    setCustomTags((prev) => prev.filter((tag) => tag.id !== id));
  };

  const cycleTagBatch = (category: DreamTagCategory) => {
    setTagBatchIndex((prev) => ({
      ...prev,
      [category]: (prev[category] ?? 0) + 1,
    }));
  };

  const continueDeeper = async () => {
    if (!runtimeScenario || !selectedCharacter || !selectedChoice || isGeneratingNextAct || isEndingDeepDream) return;
    setLoadingError(null);
    setIsGeneratingNextAct(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks: dreamPromptWorldBooks,
        dreamWorldBookConfig: normalizedDreamWorldBookConfig,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
          customTags,
          supplementNote,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'deeper',
        selectedChoice,
      });

      const nextActs = payload.nextActs ?? [];
      if (nextActs.length === 0) {
        throw new Error('深梦续写没有返回新的下沉段。');
      }

      setRuntimeScenario((prev) =>
        prev
          ? hydrateDreamRuntimeScenario({
              ...prev,
              acts: [...prev.acts, ...nextActs],
            })
          : prev,
      );
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '深梦继续失败');
    } finally {
      setIsGeneratingNextAct(false);
    }
  };

  const submitCustomChoice = async () => {
    if (!runtimeScenario || !selectedCharacter || !act || !customInput.trim() || isSubmittingCustom || isGeneratingNextAct || isEndingDeepDream) return;
    const currentAct = act;
    const needsNextAct = isDeepDream || actIndex < runtimeScenario.acts.length - 1;
    setLoadingError(null);
    setIsSubmittingCustom(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks: dreamPromptWorldBooks,
        dreamWorldBookConfig: normalizedDreamWorldBookConfig,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
          customTags,
          supplementNote,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'custom',
        userInput: customInput.trim(),
      });

      if (needsNextAct) {
        if (!payload.nextAct) {
          throw new Error('自定义续写没有返回下一幕。');
        }

        setRuntimeScenario((prev) =>
          prev
            ? hydrateDreamRuntimeScenario({
                ...prev,
                acts: upsertDreamAct(prev.acts, payload.nextAct!, actIndex + 1),
              })
            : prev,
        );
      }

      const nextChoice = {
        id: `custom-${Date.now()}`,
        title: '自定义描述',
        direction: '按你的描述推进',
        detail: customInput.trim(),
        reactionHint: payload.reactionText || '梦按你的描述发生了偏转。',
        storyPush: payload.storyPush || payload.nextAct?.progression.plotAdvance || act.progression.plotAdvance || '主线沿着你的输入继续下沉。',
        emotion: payload.emotion || '回响',
        reaction: payload.reactionText || '梦按你的描述继续往下走。',
        fromCustom: true,
      };
      setRuntimeScenario((prev) =>
        prev
          ? hydrateDreamRuntimeScenario({
              ...prev,
              decisionTrail: appendDecisionRecord(prev.decisionTrail, createDecisionRecord(currentAct, nextChoice)),
            })
          : prev,
      );
      setSelectedChoice(nextChoice);
      setCustomInput('');
      setCustomInputOpen(false);
      setStage('reaction');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '自定义续写失败');
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const endDeepDream = async () => {
    if (!runtimeScenario || !selectedCharacter || isGeneratingNextAct || isEndingDeepDream) return;
    setLoadingError(null);
    setIsEndingDeepDream(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks: dreamPromptWorldBooks,
        dreamWorldBookConfig: normalizedDreamWorldBookConfig,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
          customTags,
          supplementNote,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'deep-end',
        selectedChoice,
      });

      if (!payload.finalAct || !payload.endingInput || !payload.aftermathInput) {
        throw new Error('深梦收束没有返回完整的最后一幕与结局。');
      }

      setRuntimeScenario((prev) =>
        prev
          ? hydrateDreamRuntimeScenario({
              ...prev,
              acts: [...prev.acts, payload.finalAct!],
              endingInput: payload.endingInput!,
              aftermathInput: payload.aftermathInput!,
            })
          : prev,
      );
      setClosingActId(payload.finalAct.id);
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '结束做梦失败');
    } finally {
      setIsEndingDeepDream(false);
    }
  };

  const goNextFromReaction = async () => {
    if (actIndex < scenario.acts.length - 1) {
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
      return;
    }
    if (isDeepDream && !isClosingAct) {
      await continueDeeper();
      return;
    }
    setStage('ending');
  };

  const restart = () => {
    setEntryMode('quick');
    setSelectedDomain('shared');
    setDreamDepth('shallow');
    setSelectedTags(defaultTagSelection);
    setCustomTags([]);
    setSupplementNote('');
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig());
    setDreamWorldBookNote(null);
    setShowDreamWorldBookSheet(false);
    setDetailExpanded(false);
    setActIndex(0);
    setSelectedChoice(null);
    setPreviewChoiceId(null);
    setLoadingProgress(0);
    setCustomInput('');
    setCustomInputOpen(false);
    setConfirmPreview(null);
    setIsSubmittingCustom(false);
    setIsGeneratingNextAct(false);
    setIsEndingDeepDream(false);
    setClosingActId(null);
    setRuntimeScenario(null);
    setStage('home');
  };

  const deleteArchiveRecord = (id: string) => {
    setArchiveRecords((prev) => {
      const next = prev.filter((record) => record.id !== id);
      saveDreamArchiveRecords(next);
      return next;
    });
    setSelectedArchiveId(null);
  };

  const exportCurrentArchiveRecords = () => {
    const filename = archiveView === 'deep' ? 'dream-yuan-archive.json' : 'dream-echo-archive.json';
    exportDreamArchiveRecords(visibleArchiveRecords, filename);
  };

  const exportSingleArchiveRecord = (id: string) => {
    const record = archiveRecords.find((item) => item.id === id);
    if (!record) return;
    exportDreamArchiveRecords([record], `dream-${record.id}.json`);
  };
  const openDreamWorldBookSheet = () => {
    setDreamWorldBookNote(null);
    setShowDreamWorldBookSheet(true);
  };
  const triggerDreamWorldBookImport = () => {
    if (!selectedCharacter) {
      setDreamWorldBookNote({
        tone: 'info',
        text: '先选角色，再给这场梦带书页。',
      });
      setShowDreamWorldBookSheet(true);
      return;
    }

    dreamWorldBookImportInputRef.current?.click();
  };
  const restoreAllInheritedDreamWorldBooks = () => {
    updateDreamWorldBookConfig((prev) => ({
      ...prev,
      excludedInheritedIds: [],
    }));
    setDreamWorldBookNote({
      tone: 'info',
      text: '这一场梦会重新读取角色原本能读到的世界书。',
    });
  };
  const muteAllInheritedDreamWorldBooks = () => {
    updateDreamWorldBookConfig((prev) => ({
      ...prev,
      excludedInheritedIds: inheritedDreamWorldBooks.map((entry) => entry.id),
    }));
    setDreamWorldBookNote({
      tone: 'info',
      text: inheritedDreamWorldBooks.length > 0 ? '角色自带的世界书先都静下来了。' : '这个角色现在没有可继承的世界书。',
    });
  };
  const resetDreamWorldBookOverrides = () => {
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig());
    setDreamWorldBookNote({
      tone: 'info',
      text: '已经回到默认状态，只读角色原本能读到的世界书。',
    });
  };

  const selectedLabels = getSelectedTagLabels(selectedTags, customTags);
  const visibleArchiveRecords = archiveView === 'deep'
    ? archiveRecords.filter((record) => record.depth === 'deep')
    : archiveRecords;
  const deepArchiveCount = archiveRecords.filter((record) => record.depth === 'deep').length;
  const canContinueDream = Boolean(resumableDream);
  const unfinishedDreamTitle = latestSavedSession?.scenario.coverTitle || latestSavedSession?.scenario.storyFrame.worldTitle || '继续上次梦境';
  const unfinishedDreamMeta = canContinueDream
    ? [
        latestSavedSession?.scenario.storyFrame.dreamRelationship,
        formatPersistedDreamTime(latestSavedSession?.createdAt || 0),
      ].filter(Boolean).join(' · ')
    : '';
  const baseTagGroups = dreamTagGroups.filter((group) => !group.detailed);
  const detailedTagGroups = dreamTagGroups.filter((group) => group.detailed);

  const loadingLabel =
    loadingProgress < 25
      ? '正在入梦'
      : loadingProgress < 50
        ? '梦域生成中'
        : loadingProgress < 75
          ? '场景浮现'
          : '进入其中';

  const beginChoicePreview = (choiceId: string) => {
    if (choiceHoldTimerRef.current) {
      window.clearTimeout(choiceHoldTimerRef.current);
    }
    choiceHoldTimerRef.current = window.setTimeout(() => {
      setPreviewChoiceId(choiceId);
    }, 620);
  };

  const cancelChoicePreview = () => {
    if (choiceHoldTimerRef.current) {
      window.clearTimeout(choiceHoldTimerRef.current);
      choiceHoldTimerRef.current = null;
    }
  };

  const retryDreamGeneration = () => {
    setLoadingError(null);
    setLoadingProgress(0);
    setStage('confirm');
    window.requestAnimationFrame(() => {
      setStage('loading');
    });
  };

  const handleLeaveDuringDreamLoading = () => {
    const backgroundResumeTask = getCurrentDreamBackgroundTask();
    const dreamOptions = selectedCharacter
      ? {
          activeConfig,
          character: selectedCharacter,
          masks,
          worldBooks: dreamPromptWorldBooks,
          dreamWorldBookConfig: normalizedDreamWorldBookConfig,
          selection: {
            entryMode,
            domainId: selectedDomain,
            depth: dreamDepth,
            selectedTags,
            customTags,
            supplementNote,
          },
        }
      : null;
    if (!backgroundResumeTask && dreamOptions) {
      void startDreamBackgroundGeneration(dreamOptions);
    }
    const requestKey = dreamOptions ? buildDreamBackgroundRequestKey(dreamOptions) : undefined;
    writeDreamBackgroundResumeRequest({
      taskId: backgroundResumeTask?.status === 'pending' ? backgroundResumeTask.id : undefined,
      requestKey: backgroundResumeTask?.requestKey ?? requestKey,
    });
    onBack();
  };

  const retryEndingGeneration = () => {
    setLoadingError(null);
    setStage('scene');
    window.requestAnimationFrame(() => {
      setStage('ending');
    });
  };

  const retryAftermathGeneration = () => {
    setLoadingError(null);
    setStage('ending');
    window.requestAnimationFrame(() => {
      setStage('aftermath');
    });
  };

  const handleSaveAndExit = () => {
    if (runtimeScenario) {
      persistDreamProgress(runtimeScenario);
    }
    onBack();
  };

  const handleResumeLatestDream = () => {
    const resumable = buildDreamResumableState(readPersistedDreamSession(), getCurrentDreamBackgroundTask());
    if (!resumable) {
      setLatestSavedSession(readPersistedDreamSession());
      return;
    }

    const persistedCharacter = characters.find((character) => character.id === resumable.roleId) ?? null;
    if (!persistedCharacter) {
      clearDreamProgress();
      return;
    }

    const savedSession = latestSavedSession && latestSavedSession.roleId === resumable.roleId
      ? latestSavedSession
      : readPersistedDreamSession();
    const resumeStage = isDreamResumeStage(resumable.progress?.stage) ? resumable.progress.stage : 'scene';
    setSelectedRoleId(resumable.roleId);
    if (savedSession?.roleId === resumable.roleId) {
      setEntryMode(savedSession.mode);
      setSelectedDomain(savedSession.domain);
      setDreamDepth(savedSession.depth);
      setSelectedTags(savedSession.selectedTags);
      setCustomTags(savedSession.customTags || []);
      setSupplementNote(savedSession.supplementNote || '');
    }
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig(
      resumable.dreamWorldBookConfig
      ?? savedSession?.dreamWorldBookConfig,
    ));
    setDreamWorldBookNote(null);
    setConfirmPreview(null);
    setLoadingError(null);
    setRuntimeScenario(hydrateDreamRuntimeScenario(resumable.scenario));
    setActIndex(resumable.progress?.actIndex ?? 0);
    setSelectedChoice(resumable.progress?.selectedChoice ?? null);
    setClosingActId(resumable.progress?.closingActId ?? null);
    setCustomInput(resumable.progress?.customInput ?? '');
    setCustomInputOpen(resumable.progress?.customInputOpen ?? false);
    setStage(resumeStage);
    if (savedSession) {
      setLatestSavedSession(savedSession);
    }
    clearDreamBackgroundResumeRequest();
  };

  return (
    <>
        {stage === 'splash' && (
          <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex min-h-[calc(100%-5rem)] flex-1 items-start justify-center pt-[24vh] sm:pt-[22vh]">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }} className="space-y-6 text-center">
                <div className="text-[72px] font-[200] tracking-[0.2em] text-[var(--paper)]">梦</div>
                <div className="mx-auto h-px w-20 bg-[var(--border-mid)]" />
                <div className="text-[11px] tracking-[0.52em] text-[var(--paper-60)]">局 · 梦 · 夜</div>
              </motion.div>
            </div>
          </Shell>
        )}
        {(stage === 'home' || stage === 'entry') && (
          <div className="relative h-full min-h-0">
            <input
              ref={dreamWorldBookImportInputRef}
              type="file"
              accept="application/json,.json,text/plain,.txt,.md,.csv,.tsv,.yml,.yaml,.docx"
              className="hidden"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                await handleImportDreamWorldBookFile(file);
                input.value = '';
              }}
            />
          <HomeV2
            time={time}
            role={selectedRole}
            archiveCount={archiveRecords.length}
            deepArchiveCount={deepArchiveCount}
            unfinishedDreamTitle={resumableDream?.scenario.coverTitle || resumableDream?.scenario.storyFrame.worldTitle || '继续上次梦境'}
            unfinishedDreamMeta={
              canContinueDream
                ? [
                    resumableDream?.scenario.storyFrame.dreamRelationship,
                    formatPersistedDreamTime(resumableDream?.createdAt || 0),
                  ].filter(Boolean).join(' · ')
                : ''
            }
            canContinueDream={canContinueDream}
            hasWorldBookConfig={hasDreamWorldBookConfig}
            hasWorldBookSignal={hasDreamWorldBookSignal}
            onPickRole={() => setStage('role-picker')}
            onOpenWorldBooks={openDreamWorldBookSheet}
            onEnter={openEntry}
            onContinueDream={handleResumeLatestDream}
            onOpenArchive={(view) => {
              setArchiveView(view);
              setSelectedArchiveId(null);
              setStage('archive');
            }}
            onExit={onBack}
          />
            <AnimatePresence initial={false}>
              {stage === 'entry' && selectedRole ? (
                <EntrySheet key="dream-entry-sheet" role={selectedRole} onChoose={chooseMode} onClose={() => setStage('home')} />
              ) : null}
              {showDreamWorldBookSheet ? (
                <DreamWorldBookSheet
                  key="dream-worldbook-sheet"
                  roleName={selectedRole?.name}
                  inheritedWorldBooks={inheritedDreamWorldBooks}
                  excludedInheritedIds={normalizedDreamWorldBookConfig.excludedInheritedIds || []}
                  localWorldBooks={normalizedDreamWorldBookConfig.localEntries || []}
                  activeWorldBookCount={dreamPromptWorldBooks.length}
                  note={dreamWorldBookNote}
                  onClose={() => {
                    setShowDreamWorldBookSheet(false);
                    setDreamWorldBookNote(null);
                  }}
                  onPickRole={() => {
                    setShowDreamWorldBookSheet(false);
                    setDreamWorldBookNote(null);
                    setStage('role-picker');
                  }}
                  onImport={triggerDreamWorldBookImport}
                  onToggleInherited={toggleDreamInheritedWorldBook}
                  onRemoveLocal={removeDreamLocalWorldBook}
                  onSelectAllInherited={restoreAllInheritedDreamWorldBooks}
                  onMuteInherited={muteAllInheritedDreamWorldBooks}
                  onReset={resetDreamWorldBookOverrides}
                />
              ) : null}
              {dreamWorldBookImportDrafts ? (
                <DreamWorldBookImportReviewSheet
                  key="dream-worldbook-import-review"
                  drafts={dreamWorldBookImportDrafts}
                  advancedMode={showAdvancedDreamWorldBookImportReview}
                  onBack={closeDreamWorldBookImportReview}
                  onImportDefault={handleDreamWorldBookImportDefault}
                  onToggleAdvancedMode={() => setShowAdvancedDreamWorldBookImportReview((prev) => !prev)}
                  onConfirmImport={confirmReviewedDreamWorldBookImport}
                  onToggleInclude={toggleDreamWorldBookImportDraftInclude}
                  onChangeMergeGroup={updateDreamWorldBookImportDraftMergeGroup}
                />
              ) : null}
            </AnimatePresence>
          </div>
        )}
        {stage === 'archive' && (
          <DreamArchiveStage
            time={time}
            title={archiveView === 'deep' ? '梦渊档案' : '梦境档案'}
            subtitle={archiveView === 'deep' ? '只收更深处的梦线' : '已经收好的梦会留在这里'}
            emptyTitle={archiveView === 'deep' ? '暂无梦渊' : '暂无残响'}
            emptyHint={archiveView === 'deep' ? '深梦完成结局后会收入这里，方便回看更长的梦线。' : '梦完成结局后会自动收入档案，余响生成后也会同步补进来。'}
            records={visibleArchiveRecords}
            selectedId={selectedArchiveId}
            onSelect={setSelectedArchiveId}
            onBack={() => {
              setSelectedArchiveId(null);
              setStage('home');
            }}
            onDelete={deleteArchiveRecord}
            onExportAll={exportCurrentArchiveRecords}
            onExportRecord={exportSingleArchiveRecord}
          />
        )}
        {stage === 'role-picker' && (
          <Shell time={time} scrollable contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex flex-1 flex-col pb-[calc(1.5rem+var(--app-safe-area-bottom-ui,0px))]">
              <button type="button" onClick={() => setStage('home')} className="self-center border border-[var(--border)] px-6 py-2 text-[11px] tracking-[0.4em] text-[var(--mist)]">返 回</button>
              <div className="mt-10 text-center text-[14px] tracking-[0.36em] text-[var(--mist)]">选择入梦角色</div>
              <div className="mt-8 flex flex-1 flex-col gap-4">
                {roles.map((role) => {
                  const active = selectedRoleId === role.id;
                  return (
                    <button key={role.id} type="button" onClick={() => { setSelectedRoleId(role.id); setStage('home'); }} className="border px-4 py-5 text-left transition duration-300" style={{ borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)', backgroundColor: active ? 'rgba(19,25,38,.92)' : 'rgba(13,18,32,.76)' }}>
                      <div className="flex items-center gap-4">
                        <Avatar role={role} small />
                        <div className="min-w-0">
                          <div className="text-[16px] font-[300] tracking-[0.14em] text-[var(--paper)]">{role.name}</div>
                          <div className="mt-2 line-clamp-2 text-[12px] leading-[1.9] tracking-[0.14em] text-[var(--mist)]">{role.mood}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Shell>
        )}
        {stage === 'tags' && selectedRole && (
          <TagsStageV2
            time={time}
            selectedRole={selectedRole}
            dreamDepth={dreamDepth}
            setDreamDepth={setDreamDepth}
            selectedTags={selectedTags}
            customTags={customTags}
            supplementNote={supplementNote}
            setSupplementNote={setSupplementNote}
            toggleTag={toggleTag}
            onAddCustomTag={addCustomTag}
            onRemoveCustomTag={removeCustomTag}
            tagBatchIndex={tagBatchIndex}
            cycleTagBatch={cycleTagBatch}
            detailExpanded={detailExpanded}
            setDetailExpanded={setDetailExpanded}
            selectedLabels={selectedLabels}
            onBack={() => setStage('entry')}
            onConfirm={() => setStage('confirm')}
          />
        )}
        {false && stage === 'tags' && selectedRole && (
          <Shell time={time} scrollable>
            <div className="flex flex-1 flex-col">
              <div className="mt-7 text-center text-[12px] tracking-[0.56em] text-[var(--mist)]">{resolveDomainName(selectedDomain)} · {dreamDepth === 'deep' ? '深梦' : '浅梦'}</div>
              <div className="mt-8 flex flex-col items-center text-center">
                <Avatar role={selectedRole} small />
                <div className="mt-5 text-[22px] font-[200] tracking-[0.18em] text-[var(--paper)]">{selectedRole.name}</div>
                <div className="mt-2 text-[13px] tracking-[0.18em] text-[var(--mist)]">他正等你</div>
              </div>
              <div className="mt-8 border-y border-[var(--border)] py-5">
                <div className="text-[11px] tracking-[0.38em] text-[var(--mist)]">梦 型</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {([
                    {
                      id: 'shallow',
                      title: '浅梦',
                      detail: '4-5 轮，一局一结，更像短篇。',
                    },
                    {
                      id: 'deep',
                      title: '深梦',
                      detail: '更长更沉，幕与幕之间会继续往下走。',
                    },
                  ] as const).map((item) => {
                    const active = dreamDepth === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDreamDepth(item.id)}
                        className="border px-4 py-4 text-left transition duration-300"
                        style={{
                          borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                          backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                        }}
                      >
                        <div className={`text-[15px] tracking-[0.18em] ${active ? 'text-[var(--gold-bright)]' : 'text-[var(--gold)]'}`}>{item.title}</div>
                        <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.08em] text-[var(--mist)]">{item.detail}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 flex flex-1 flex-col gap-5">
                {dreamTagGroups.map((group) => {
                  const hidden = group.detailed && !detailExpanded;
                  const activeIds = selectedTags[group.category] ?? [];
                  return (
                    <div key={group.category} className="transition duration-300" style={{ opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : 'auto', height: hidden ? 0 : 'auto', overflow: 'hidden' }}>
                      <div className="mb-3 text-[11px] tracking-[0.42em] text-[var(--mist)]">{group.label}</div>
                      <div className="flex flex-wrap gap-3">
                        {group.options.map((option) => {
                          const active = activeIds.includes(option.id);
                          return (
                            <button key={option.id} type="button" onClick={() => toggleTag(group.category, option.id, group.max)} className="border px-4 py-3 text-[12px] tracking-[0.2em] transition duration-300" style={{ borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)', backgroundColor: active ? 'rgba(196,169,106,.1)' : 'rgba(13,18,32,.65)', color: active ? 'var(--gold-bright)' : 'var(--gold)' }}>
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 border border-[rgba(196,169,106,.16)] bg-[rgba(13,18,32,.56)] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[12px] tracking-[0.32em] text-[var(--gold)]">细化规则</div>
                    <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.12em] text-[var(--mist)]">细化标签已经默认展开，你可以继续控制 NPC / 阵营、角色身份、主导度、互动强度和结局倾向。</div>
                    <div className="mt-3 text-[11px] tracking-[0.18em] text-[var(--gold-bright)]">已选 {selectedLabels.length} 项</div>
                  </div>
                  <button type="button" onClick={() => setDetailExpanded((prev) => !prev)} className="shrink-0 border border-[rgba(196,169,106,.2)] px-3 py-2 text-[12px] tracking-[0.22em] text-[var(--gold)]">
                    {detailExpanded ? '收起' : '展开'}
                  </button>
                </div>
              </div>
              <div className="mt-6 border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] tracking-[0.18em] text-[var(--gold-bright)]">
                    已选 {selectedLabels.length} 项
                  </div>
                  <button type="button" onClick={() => setDetailExpanded((prev) => !prev)} className="text-[12px] tracking-[0.28em] text-[var(--mist)]">{detailExpanded ? '收 起 细 化' : '展 开 细 化'}</button>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => setStage('entry')} className="text-[12px] tracking-[0.28em] text-[var(--mist)]">返 回 选 择</button>
                  <div className="w-[54%]">
                    <SealButton label="前 往 确 认" onClick={() => setStage('confirm')} />
                  </div>
                </div>
              </div>
            </div>
          </Shell>
        )}
        {stage === 'confirm' && selectedRole && (
          <ConfirmStageV2
            time={time}
            entryMode={entryMode}
            selectedRole={selectedRole}
            selectedDomain={selectedDomain}
            scenario={scenario}
            preview={confirmPreview}
            preflightPlan={entryMode === 'character' ? null : dreamPreflightPlan}
            selectedLabels={selectedLabels}
            onBack={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')}
            onConfirm={() => setStage('loading')}
          />
        )}
        {/* {false && stage === 'confirm' && selectedRole && (
          <Shell time={time} scrollable>
            <div className="flex flex-1 flex-col">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{entryMode === 'character' ? '角 色 入 梦' : `${resolveDomainName(selectedDomain)} · ${scenario.coverTitle}`}</div>
              <div className={`mt-10 flex flex-col items-center text-center ${entryMode === 'character' ? 'hidden' : ''}`}>
                <div className="relative px-7">
                  <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                  <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                  <Avatar role={selectedRole} small secret={entryMode === 'character'} />
                </div>
                <div className="mt-8 text-[28px] font-[200] tracking-[0.18em] text-[var(--paper)]">{selectedRole.name}</div>
                <div className="mt-3 text-[13px] tracking-[0.18em] text-[var(--mist)]">{entryMode === 'character' ? '他的梦，他来决定' : scenario.coverSubtitle}</div>
              </div>
              {entryMode === 'character' ? (
                <div className="mt-12 flex flex-1 flex-col items-center justify-center text-center">
                  <div className="relative px-7">
                    <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                    <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                    <div className="flex h-[92px] w-[92px] items-center justify-center border border-[var(--border)] text-[44px] text-[var(--gold)]">?</div>
                  </div>
                  <div className="mt-10 text-[34px] font-[200] tracking-[0.12em] text-[var(--paper)]">{selectedRole.name}</div>
                  <div className="mt-4 text-[13px] tracking-[0.2em] text-[var(--jade)]">他的梦，他来决定</div>
                  <div className="mt-14 flex h-20 w-20 items-center justify-center border border-[rgba(196,169,106,.08)] text-[26px] text-[var(--jade)]">♦</div>
                  <div className="mt-8 space-y-4 text-[15px] leading-[2.1] tracking-[0.18em] text-[var(--jade)]">
                    <div>这场梦由他决定</div>
                    <div>你进入后才会逐渐知道</div>
                    <div>身份 · 阵营 · 你们之间是什么关系</div>
                  </div>
                </div>
              ) : false && entryMode === 'character' ? (
                <div className="mt-12 flex flex-1 flex-col items-center justify-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center border border-[var(--border)] text-[28px] text-[var(--mist)]">◊</div>
                  <div className="mt-8 space-y-3 text-[14px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]">
                    <div>这场梦由他决定</div>
                    <div>你进入后才会逐渐知道</div>
                    <div>身份 · 阵营 · 你们之间是什么关系</div>
                  </div>
                </div>
              ) : (
                <div className="mt-10 flex-1">
                  <div className="flex flex-wrap justify-center gap-3">
                    {selectedLabels.map((label, index) => <div key={`${label}-${index}`} className="border px-4 py-3 text-[12px] tracking-[0.2em] text-[var(--gold)]" style={{ borderColor: 'rgba(196,169,106,.18)', backgroundColor: 'rgba(13,18,32,.7)' }}>{label}</div>)}
                  </div>
                  <div className="mt-8 text-center text-[13px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]">{scenario.confirmHint}</div>
                </div>
              )}
              {entryMode === 'character' ? (
                <button type="button" onClick={() => setStage('entry')} className="mt-10 text-center text-[13px] tracking-[0.24em] text-[var(--gold)]">← 换一种入梦方式</button>
              ) : (
                <>
                  <div className="mt-10"><SealButton label="确认入梦" onClick={() => setStage('loading')} /></div>
                  <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.22em] text-[var(--mist)]">← 换一种入梦方式</button>
                </>
              )}
              <div className="hidden">
              {entryMode === 'character' ? (
                <button type="button" onClick={() => setStage('entry')} className="mt-10 text-center text-[13px] tracking-[0.24em] text-[var(--gold)]">← 换一种入梦方式</button>
              ) : (
                <>
                  <div className="mt-10"><SealButton label="确认入梦" onClick={() => setStage('loading')} /></div>
                  <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.22em] text-[var(--mist)]">← 换一种入梦方式</button>
                </>
              )}
              {entryMode === 'character' ? (
                <>
                  <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-10 text-center text-[13px] tracking-[0.24em] text-[var(--gold)]">← 换一种入梦方式</button>
                </>
              ) : (
                <>
                  <div className="mt-10"><SealButton label="确认入梦" onClick={() => setStage('loading')} /></div>
                  <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.22em] text-[var(--mist)]">← 换一种入梦方式</button>
                </>
              )}
              <div className="mt-10"><SealButton label="确认入梦" onClick={() => setStage('loading')} /></div>
              <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.3em] text-[var(--mist)]">← 换一种入梦方式</button>
              <div className="mt-10"><SealButton label="确 认 入 梦" onClick={() => setStage('loading')} /></div>
              <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.3em] text-[var(--mist)]">← 换 一 种 入 梦 方 式</button>
            </div>
          </Shell>
        )} */}
        {stage === 'loading' && selectedRole && (
          <Shell time={time} bottomTone={false} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex flex-1 flex-col items-center justify-start pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))] pt-[10vh] text-center sm:justify-center sm:pt-0">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <div className="absolute h-14 w-14 rounded-full border border-[rgba(196,169,106,.2)] bg-[radial-gradient(circle_at_40%_38%,rgba(196,169,106,.4),transparent_65%)] animate-[pulse_3s_ease-in-out_infinite]" />
                <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle,rgba(196,169,106,.06),transparent_70%)] animate-[pulse_3s_ease-in-out_infinite_reverse]" />
              </div>
              <div className="mt-8 text-[22px] font-[200] tracking-[0.22em] text-[var(--paper)]">正在进入 {selectedRole.name} 的今夜</div>
              {loadingError ? (
                <>
                  <div className="mt-4 max-w-[320px] text-[12px] leading-[2.1] tracking-[0.12em] text-[var(--mist)]">{loadingError}</div>
                  <div className="mt-8 grid w-full max-w-[334px] gap-4">
                    <SealButton label="重新入梦" onClick={retryDreamGeneration} />
                    <SecondaryAction label="返回确认" onClick={() => setStage('confirm')} />
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4 text-[12px] tracking-[0.42em] text-[var(--mist)] animate-[pulse_3s_ease-in-out_infinite]">{loadingLabel}</div>
                  <div className="mt-5 h-px w-20 bg-[rgba(196,169,106,.1)]">
                    <div className="h-px bg-[var(--gold)] transition-[width] duration-300 ease-linear" style={{ width: `${loadingProgress}%` }} />
                  </div>
                  <div className="mt-8 w-full max-w-[334px]">
                    <SecondaryAction label="返 回 首 页" onClick={handleLeaveDuringDreamLoading} />
                  </div>
                </>
              )}
            </div>
          </Shell>
        )}
        {stage === 'scene' && act && (
          <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex flex-1 flex-col pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))]">
              <div className="mt-5 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{scenario.coverTitle} · {act.label}</div>
              <div className="mt-8 flex items-center justify-center gap-3">{scenario.acts.map((item, index) => <div key={item.id} className="h-[5px] w-[5px] border border-[var(--border)]">{index <= actIndex ? <div className="h-full w-full bg-[var(--gold)]" /> : null}</div>)}</div>
              <div className="mt-8">
                <div className="mx-auto w-full max-w-[460px]">
                  {displayStoryFrame && actIndex === 0 && hasStoryFrameContent(displayStoryFrame as DreamRuntimeScenario['storyFrame']) ? (
                    <div className="mb-7 border px-4 py-4" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft }}>
                      {displayStoryFrame.worldTitle || displayStoryFrame.dreamRelationship ? (
                        <div className="text-[11px] tracking-[0.28em]" style={{ color: presentation.accent }}>
                          {[displayStoryFrame.worldTitle, displayStoryFrame.dreamRelationship].filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                      {displayStoryFrame.worldSummary ? <div className="mt-3 text-[14px] leading-[2.1] tracking-[0.08em] text-[var(--paper)]">{displayStoryFrame.worldSummary}</div> : null}
                      {displayStoryFrame.characterDreamIdentity || displayStoryFrame.userDreamIdentity ? (
                        <div className="mt-4 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">
                          {[displayStoryFrame.characterDreamIdentity, displayStoryFrame.userDreamIdentity].filter(Boolean).join(' / ')}
                        </div>
                      ) : null}
                      {displayStoryFrame.openingNode ? (
                        <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">
                          节点：{displayStoryFrame.openingNode}
                        </div>
                      ) : null}
                      {displayStoryFrame.immediateGoal ? <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em]" style={{ color: presentation.accent }}>此幕目标：{displayStoryFrame.immediateGoal}</div> : null}
                      {displayStoryFrame.storyObjective ? (
                        <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em]" style={{ color: presentation.accent }}>
                          主线：{displayStoryFrame.storyObjective}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <DreamNarrativeBlocks blocks={typedSceneBlocks} presentation={presentation} />
                  <div className="mt-8 border-l pl-4 text-[13px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]" style={{ borderColor: presentation.frameBorder }}>
                    <div>{act.charState}</div>
                    {act.progression.consequence ? <div className="mt-3">变化：{act.progression.consequence}</div> : null}
                    {act.progression.plotAdvance ? <div className="mt-2">推进：{act.progression.plotAdvance}</div> : null}
                  </div>
                </div>
              </div>
              {loadingError ? <div className="mt-6 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
              <div className="mt-10 grid gap-4">
                <SecondaryAction label="保 存 退 出" onClick={handleSaveAndExit} presentation={presentation} />
                <SealButton label={sceneReady ? (isClosingAct ? '进 入 结 局' : '进 入 选 择') : '正 文 正 在 浮 出'} onClick={() => (isClosingAct ? setStage('ending') : setStage('choices'))} disabled={!sceneReady} presentation={presentation} />
              </div>
              {isDeepDream && !isClosingAct ? (
                <div className="mt-4">
                  <SecondaryAction
                    label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
                    onClick={() => {
                      void endDeepDream();
                    }}
                    disabled={isEndingDeepDream || isGeneratingNextAct}
                    presentation={presentation}
                  />
                </div>
              ) : null}
            </div>
          </Shell>
        )}
        {choiceAct && (
          <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex flex-1 flex-col pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))]">
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] tracking-[0.26em] text-[var(--gold)]">
                <span className="inline-flex border border-[rgba(196,169,106,.18)] px-3 py-1">{resolveDomainName(selectedDomain)}</span>
                <span className="text-[var(--mist)]">路</span>
                <span>{scenario.coverTitle}</span>
              </div>
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{act.label} 路 梦触</div>
              <div className="mt-6 text-center text-[14px] leading-[2.2] tracking-[0.16em] text-[var(--paper-60)]">
                梦已经给出方向。<br />
                现在由你决定，下一步要怎样落下去。
              </div>
              <div className="mt-10 flex flex-1 flex-col gap-4">
                {choiceAct.choiceSet.generated.map((choice, index) => {
                  const previewing = previewChoiceId === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onPointerDown={() => beginChoicePreview(choice.id)}
                      onPointerUp={cancelChoicePreview}
                      onPointerLeave={cancelChoicePreview}
                      onPointerCancel={cancelChoicePreview}
                      onClick={() => {
                        cancelChoicePreview();
                        const nextChoice = {
                          ...choice,
                          reaction: choice.reactionHint,
                        };
                        setRuntimeScenario((prev) => (
                          prev
                            ? hydrateDreamRuntimeScenario({
                                ...prev,
                                decisionTrail: appendDecisionRecord(prev.decisionTrail, createDecisionRecord(choiceAct, nextChoice)),
                              })
                            : prev
                        ));
                        setSelectedChoice(nextChoice);
                        setStage('reaction');
                      }}
                      className="w-full border px-5 py-5 text-left transition duration-300"
                      style={{
                        borderColor: previewing ? presentation.frameBorder : 'rgba(255,255,255,.08)',
                        backgroundColor: previewing ? presentation.accentSoft : presentation.frameFill,
                        transform: previewing ? 'translateX(6px)' : 'translateX(0px)',
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="pt-1 text-[14px] tracking-[0.18em] text-[var(--gold)]">{['一', '二', '三'][index]}</div>
                        <div className="min-w-0">
                          <div className="text-[15px] font-[300] tracking-[0.18em] text-[var(--paper)]">{choice.title}</div>
                          <div className="mt-3 text-[12px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">{choice.detail}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCustomInputOpen((prev) => !prev)}
                  className="w-full border px-5 py-5 text-left opacity-70"
                  style={{
                    borderColor: presentation.frameBorder,
                    backgroundColor: presentation.frameFill,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-1 text-[14px] tracking-[0.18em]" style={{ color: presentation.accent }}>四</div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-[300] tracking-[0.18em] text-[var(--paper)]">{choiceAct.choiceSet.custom.title}</div>
                      <div className="mt-3 text-[12px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">{choiceAct.choiceSet.custom.guidance}</div>
                    </div>
                  </div>
                </button>
                {customInputOpen ? (
                  <div className="border px-5 py-5" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
                    <textarea
                      value={customInput}
                      onChange={(event) => setCustomInput(event.target.value)}
                      placeholder={choiceAct.choiceSet.custom.placeholder}
                      className="min-h-[120px] w-full resize-none bg-transparent text-[14px] leading-[2.1] tracking-[0.08em] text-white caret-white outline-none placeholder:text-white/65 selection:bg-white/20"
                      style={{
                        color: 'rgba(255,255,255,.96)',
                        WebkitTextFillColor: 'rgba(255,255,255,.96)',
                        caretColor: '#ffffff',
                        backgroundColor: 'rgba(255,255,255,.035)',
                      }}
                    />
                    <div className="mt-4 text-[12px] leading-[2] tracking-[0.12em] text-[var(--mist)]">
                      这里输入的是你这一幕想怎么做、怎么说、想把梦推向哪边。
                    </div>
                    <div className="mt-5 grid gap-3">
                      <SealButton
                        label={isSubmittingCustom ? '正 在 续 写' : '提 交 自 定 义'}
                        onClick={() => {
                          void submitCustomChoice();
                        }}
                        disabled={isSubmittingCustom || !customInput.trim()}
                        presentation={presentation}
                      />
                      <SecondaryAction label="收 起 输 入" onClick={() => setCustomInputOpen(false)} presentation={presentation} />
                    </div>
                  </div>
                ) : null}
                {loadingError ? <div className="text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
                <SecondaryAction label="保 存 退 出" onClick={handleSaveAndExit} presentation={presentation} />
                {isDeepDream ? (
                  <SecondaryAction
                    label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
                    onClick={() => {
                      void endDeepDream();
                    }}
                    disabled={isEndingDeepDream || isGeneratingNextAct || isSubmittingCustom}
                    presentation={presentation}
                  />
                ) : null}
              </div>
            </div>
          </Shell>
        )}
        {false && choiceAct && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] tracking-[0.26em] text-[var(--gold)]">
                <span className="inline-flex border border-[rgba(196,169,106,.18)] px-3 py-1">{resolveDomainName(selectedDomain)}</span>
                <span className="text-[var(--mist)]">路</span>
                <span>{scenario.coverTitle}</span>
              </div>
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{act.label} · 梦触</div>
              <div className="mt-6 text-center text-[14px] leading-[2.2] tracking-[0.16em] text-[var(--paper-60)]">梦已经给出方向。<br />现在由你决定，下一步要怎样落下去。</div>
              <div className="mt-10 flex flex-1 flex-col gap-4">
                {choiceAct.choiceSet.generated.map((choice, index) => <button key={choice.id} type="button" onClick={() => { setSelectedChoice({ ...choice, reaction: choice.reactionHint }); setStage('reaction'); }} className="w-full border px-5 py-5 text-left transition duration-300" style={{ borderColor: 'rgba(196,169,106,.12)', backgroundColor: 'rgba(13,18,32,.72)' }}><div className="flex items-start gap-4"><div className="pt-1 text-[14px] tracking-[0.18em] text-[var(--gold)]">{['一', '二', '三'][index]}</div><div className="min-w-0"><div className="text-[15px] font-[300] tracking-[0.18em] text-[var(--paper)]">{choice.title}</div><div className="mt-3 text-[12px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">{choice.detail}</div></div></div></button>)}
              </div>
            </div>
          </Shell>
        )}
        {stage === 'reaction' && selectedChoice && (
          <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex flex-1 flex-col pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))]">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">角 色 反 应</div>
              <div className="mt-10 flex items-center gap-4">
                <div className="h-px flex-1 bg-[rgba(196,169,106,.18)]" />
                <div className="text-[12px] tracking-[0.18em]" style={{ color: presentation.accent }}>你选择了 {selectedChoice.title}</div>
                <div className="h-px flex-1 bg-[rgba(196,169,106,.18)]" />
              </div>
              <div className="mt-12">
                <DreamNarrativeBlocks blocks={typedReactionBlocks} presentation={presentation} />
              </div>
              <div className={`mt-16 transition duration-500 ${reactionReady ? 'opacity-100' : 'opacity-0'}`}>
                <span className="inline-flex rounded-[20px] border px-5 py-3 text-[12px] tracking-[0.2em]" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft, color: presentation.accent }}>
                  <span className="mr-3 inline-block h-[6px] w-[6px] rounded-full" style={{ backgroundColor: presentation.accent }} />
                  {selectedChoice.emotion}
                </span>
              </div>
              {loadingError ? <div className="mt-6 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
              <div className="mt-8">
                <SealButton
                  label={
                    !reactionReady
                      ? '反 应 正 在 浮 出'
                      : isDeepDream && isLastGeneratedAct && !isClosingAct
                        ? isGeneratingNextAct
                          ? '正 在 下 沉'
                          : '沉 向 更 深 一 幕'
                        : '继 续  →'
                  }
                  onClick={() => {
                    void goNextFromReaction();
                  }}
                  disabled={!reactionReady || isGeneratingNextAct || isEndingDeepDream}
                  presentation={presentation}
                />
              </div>
              <div className="mt-4">
                <SecondaryAction label="保 存 退 出" onClick={handleSaveAndExit} presentation={presentation} />
              </div>
              {isDeepDream && !isClosingAct ? (
                <div className="mt-4">
                  <SecondaryAction
                    label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
                    onClick={() => {
                      void endDeepDream();
                    }}
                    disabled={isEndingDeepDream || isGeneratingNextAct}
                    presentation={presentation}
                  />
                </div>
              ) : null}
            </div>
          </Shell>
        )}
        {stage === 'ending' && (
          <Shell time={time} bottomTone={false} contentClassName="pb-[calc(5rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex flex-1 flex-col justify-center py-8">
              <div className="border-y py-10 text-center" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
                <div className="text-[34px] font-[200] tracking-[0.22em] text-[var(--paper)]">{endingView.title}</div>
                <div className="mx-auto mt-8 max-w-[360px] text-left text-[14px] font-[300] leading-[2.35] tracking-[0.1em] text-[var(--paper)]">
                  {isGeneratingEnding ? '结局正在收束……' : typedEndingBody}
                </div>
                <div className="mx-auto mt-10 max-w-[290px] text-[15px] font-[300] leading-[2.35] tracking-[0.08em] text-[var(--paper-60)]">
                  {isGeneratingEnding ? '梦尾摘录正在浮出。' : typedEndingExcerpt}
                </div>
                <div className="mt-8 text-[13px] tracking-[0.18em] text-[var(--mist)]">—— {endingView.signature}</div>
                <div className="mt-3 text-[12px] tracking-[0.26em]" style={{ color: presentation.accent }}>{endingView.chapter}</div>
              </div>
              {loadingError ? <div className="mt-6 px-8 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
              {loadingError && !isGeneratingEnding ? (
                <div className="mt-6 grid gap-3 px-8">
                  <SecondaryAction label="重 试 结 局" onClick={retryEndingGeneration} presentation={presentation} />
                  <SecondaryAction label="退 出 梦 境" onClick={onBack} presentation={presentation} />
                </div>
              ) : null}
              <div className="mt-10 grid gap-4 px-8">
                <SecondaryAction
                  label={
                    isGeneratingEnding
                      ? '结 局 正 在 收 束'
                      : !endingTextReady
                        ? '梦 尾 正 在 浮 出'
                        : runtimeScenario?.endingOutput
                          ? '查 看 梦 后 余 响  →'
                          : '请 先 等 结 局 完 成'
                  }
                  onClick={() => {
                    if (runtimeScenario?.endingOutput) setStage('aftermath');
                  }}
                  presentation={presentation}
                  disabled={isGeneratingEnding || !runtimeScenario?.endingOutput || !endingTextReady}
                />
              </div>
            </div>
          </Shell>
        )}
        {false && stage === 'ending' && (
          <Shell time={time} bottomTone={false}>
            <div className="flex flex-1 flex-col justify-center py-8">
              <div className="border-y border-[var(--border)] py-10 text-center">
                <div className="text-[34px] font-[200] tracking-[0.22em] text-[var(--paper)]">{endingView.title}</div>
                <div className="mx-auto mt-10 max-w-[290px] text-[15px] font-[300] leading-[2.35] tracking-[0.08em] text-[var(--paper-60)]">{endingView.excerpt}</div>
                <div className="mt-8 text-[13px] tracking-[0.18em] text-[var(--mist)]">—— {endingView.signature}</div>
                <div className="mt-3 text-[12px] tracking-[0.26em] text-[var(--gold)]">{endingView.chapter}</div>
              </div>
              <div className="mt-10"><SealButton label="查 看 余 响" onClick={() => setStage('aftermath')} /></div>
            </div>
          </Shell>
        )}
        {stage === 'aftermath' && (
          <Shell time={time} scrollable contentClassName="pb-[calc(5rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex flex-1 flex-col pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))]">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">余响</div>
              <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.72)] px-5 py-6">
                <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
                  <Avatar role={selectedRole} small />
                  <div className="min-w-0">
                    <div className="text-[14px] tracking-[0.14em] text-[var(--paper)]">{selectedRole?.name || '角色'}</div>
                    <div className="mt-1 text-[11px] tracking-[0.18em] text-[var(--mist)]">明日聊天预览</div>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {aftermathView.previewMessages.map((message, index) => (
                    <div
                      key={`${aftermathView.previewMessages[index]}-${index}`}
                      className="max-w-[92%] border px-4 py-4 text-[13px] leading-[2] tracking-[0.12em] text-[var(--paper)]"
                      style={{
                        marginLeft: index === 1 ? 'auto' : 0,
                        borderColor: presentation.frameBorder,
                        backgroundColor: index === 1 ? presentation.accentSoft : presentation.frameFill,
                      }}
                    >
                      {isGeneratingAftermath ? (index === 0 ? '余响正在回流……' : '次日聊天正在浮出。') : typedAftermathMessages[index] || ''}
                    </div>
                  ))}
                  <div className="max-w-[48%] border px-4 py-3 text-[12px] tracking-[0.24em] text-[var(--mist)]" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
                    ……
                  </div>
                </div>
              </div>
              <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.62)] px-5 py-6">
                <div className="text-[12px] tracking-[0.26em] text-[var(--mist)]">余响</div>
                <div className="mt-4 text-[14px] leading-[2.2] tracking-[0.14em] text-[var(--paper)]">
                  {isGeneratingAftermath ? '梦醒后的余响正在整理……' : typedAftermathSummary}
                </div>
                <div className="mt-3 text-[12px] leading-[2] tracking-[0.14em] text-[var(--mist)]">
                  {isGeneratingAftermath ? '它会沿着这场梦的结尾，慢一点回到现实里。' : typedAftermathDetail}
                </div>
                {aftermathMetaLine ? (
                  <div className="mt-5 border-t pt-4 text-[11px] tracking-[0.24em]" style={{ borderColor: presentation.frameBorder, color: presentation.accent }}>
                    {aftermathMetaLine}
                  </div>
                ) : null}
              </div>
              {loadingError ? <div className="mt-6 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
              {loadingError && !isGeneratingAftermath ? (
                <div className="mt-6 grid gap-3">
                  <SecondaryAction label="重 试 余 响" onClick={retryAftermathGeneration} presentation={presentation} />
                  <SecondaryAction label="退 出 梦 境" onClick={onBack} presentation={presentation} />
                </div>
              ) : null}
              <div className="mt-8">
                <SealButton
                  label={isGeneratingAftermath ? '余 响 正 在 回 流' : aftermathTextReady ? '再 入 一 梦' : '余 响 正 在 浮 出'}
                  onClick={restart}
                  presentation={presentation}
                  disabled={isGeneratingAftermath || !aftermathTextReady}
                />
              </div>
            </div>
          </Shell>
        )}
        {false && stage === 'aftermath' && (
          <Shell time={time} scrollable>
            <div className="flex flex-1 flex-col">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">余 响</div>
              <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.72)] px-5 py-6">
                <div className="text-[12px] tracking-[0.26em] text-[var(--mist)]">明日聊天预览</div>
                <div className="mt-5 space-y-3">{aftermathView.previewMessages.map((message, index) => <div key={`${message}-${index}`} className="border border-[rgba(123,168,196,.18)] bg-[rgba(123,168,196,.08)] px-4 py-4 text-[13px] leading-[2] tracking-[0.12em] text-[var(--paper)]">{message}</div>)}</div>
              </div>
              <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.62)] px-5 py-6">
                <div className="text-[12px] tracking-[0.26em] text-[var(--mist)]">回流说明</div>
                <div className="mt-4 text-[14px] leading-[2.2] tracking-[0.14em] text-[var(--paper)]">{aftermathView.summary}</div>
                <div className="mt-3 text-[12px] leading-[2] tracking-[0.14em] text-[var(--mist)]">{aftermathView.detail}</div>
              </div>
              <div className="mt-auto pt-8"><SealButton label="再 入 一 梦" onClick={restart} /></div>
            </div>
          </Shell>
        )}
    </>
  );
}
