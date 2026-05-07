import React, { useState, useEffect } from 'react';
import { Activity, BellOff, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Database, Download, History, Image as ImageIcon, Languages, MessageCircle, MoreHorizontal, Phone, Pin, Plus, Share2, Smile, Star, Trash2, Volume2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, ChatMessage, ApiConfig, WorldBookEntry, Mask, CallRecord, FavoriteMessage, VisualSettings, AppSettings, type MemoryLibraryEntry } from '../../types';
import { ChatMemoryLibraryHome } from './ChatMemoryLibraryHome';
import { ChatMemoryLibraryEntry } from './ChatMemoryLibraryEntry';
import { ChatMemoryLibraryYear } from './ChatMemoryLibraryYear';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from '../../services/ai/prompts/builders/buildSummaryPrompt';
import { generateTextFromMessagesWithConfig, streamTextWithConfig } from '../../services/ai/runtimeClient';
import { buildLongTermMemoryProfile } from '../../services/memory/buildLongTermMemoryProfile';
import {
  clampDirectMemoryLimit,
  DIRECT_MEMORY_LIMIT_DEFAULT,
  DIRECT_MEMORY_LIMIT_MAX,
  DIRECT_MEMORY_LIMIT_MIN,
  getDirectMemoryMessageLimit,
} from '../../services/memory/memoryWindowLimits';
import { buildMemoryLibraryPatch, getMemoryLibraryEntries, getMemoryLibraryStats, groupMemoryLibraryEntriesByYear, type MemoryLibraryYearGroup } from '../../services/memory/memoryLibrary';
import { appendMemoryLibraryEntries, deleteMemoryLibraryEntry } from '../../services/memory/memoryLibrary';
import { buildMemoryExportPayload, stringifyMemoryExportAsText, type MemoryExportFormat, type MemoryExportScope } from '../../services/memory/exportMemory';
import { prepareMemoryImportFromUnknown, type PreparedMemoryImport } from '../../services/memory/importMemory';
import { buildShortTermSummary, compressShortTermSummaryAfterLongTerm } from '../../services/memory/buildShortTermSummary';
import { buildChatSceneInput } from '../../services/scene-inputs/buildChatSceneInput';
import { buildCharacterContext } from '../../services/relationship-context/buildCharacterContext';
import { selectWorldBooksForPrompt, type WorldBookSelectionDiagnostic } from '../../services/world-book/worldBookBudget';
import { extractImageUrls, getMessageMainText, getSummaryHistoryWindow, showInAppConfirm } from '../../utils';
import { showInAppAlert } from '../../utils';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { saveUploadedDataUrl } from '../../features/persistence/persistentAssetService';
import { usePersistentFieldActions } from '../../features/persistence/usePersistentFieldActions';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import {
  extractCompatibleChatSettingsImport,
  parseJsonWithCompatibility,
} from '../../features/import/importCompat';
import { cloneTtsVoice } from '../../services/ai/apiCenter/cloneTtsVoice';
import { copyTextContent } from '../../services/chat/messageActions';
import { fetchMinimaxVoices, type MinimaxVoiceRecord } from '../../services/ai/apiCenter/fetchMinimaxVoices';

function SettingsSection({
  title,
  summary,
  defaultOpen = false,
  hideHeader = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  hideHeader?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (hideHeader) {
    return <div className="mt-3">{children}</div>;
  }

  return (
    <div className="mt-6 px-4">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm px-4 py-3 flex items-center justify-between text-left active:bg-white/70 transition-colors"
      >
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-zinc-800">{title}</h2>
          {summary && <p className="text-[11px] text-zinc-500 mt-1 truncate">{summary}</p>}
        </div>
        <ChevronDown size={18} className={`text-zinc-400 transition-transform shrink-0 ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function isRetryableSummaryStreamError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('failed to fetch') || message.includes('networkerror');
}

function ResolvedSettingsImage({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt?: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}

function parseJsonFileContent(raw: string) {
  const parsed = parseJsonWithCompatibility(raw);
  if (parsed !== null) {
    return parsed;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    console.warn('[chat-settings] Ignoring invalid JSON file.', error);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStickerEntries(values: string[]) {
  const seen = new Set<string>();
  const nextValues: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    nextValues.push(normalized);
  }

  return nextValues;
}

function extractStickerEntriesFromText(raw: string): string[] {
  const normalized = raw.replace(/\r/g, '\n');
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const urlRegex = /https?:\/\/[^\s,)\]"'<>]+/gi;
  const entries: string[] = [];

  for (const line of lines) {
    const urlMatches = line.match(urlRegex);
    if (urlMatches && urlMatches.length > 0) {
      entries.push(...urlMatches);
      continue;
    }

    const csvParts = line
      .split(/[,\t|]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (csvParts.length > 0) {
      entries.push(...csvParts.flatMap((part) => part.match(urlRegex) || []));
    }
  }

  return normalizeStickerEntries(entries);
}

function extractStickerEntriesFromJson(data: unknown): string[] {
  if (Array.isArray(data)) {
    return normalizeStickerEntries(data.filter((item): item is string => typeof item === 'string'));
  }

  if (isRecord(data)) {
    if (Array.isArray(data.stickers)) {
      return normalizeStickerEntries(data.stickers.filter((item): item is string => typeof item === 'string'));
    }

    const stringValues = Object.values(data).filter((item): item is string => typeof item === 'string');
    const arrayValues = Object.values(data)
      .filter(Array.isArray)
      .flatMap((item) => item.filter((entry): entry is string => typeof entry === 'string'));

    return normalizeStickerEntries([
      ...stringValues.filter((item) => /^https?:\/\//i.test(item)),
      ...arrayValues,
    ]);
  }

  return [];
}

function formatMemoryStatDate(timestamp: number | null): string {
  if (timestamp == null) {
    return '暂无';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
}

const REPLY_LANGUAGE_MODE_OPTIONS = [
  { value: 'follow-user', label: '跟随用户语言' },
  { value: 'chinese-with-native-flavor', label: '中文为主，母语点缀' },
  { value: 'native-first', label: '角色母语为主' },
  { value: 'fixed', label: '固定指定语言' },
] as const;

const LANGUAGE_PRESET_OPTIONS = ['自动识别', '中文', '韩语', '日语', '英语', '粤语'];

function getWorldBookDiscardReasonLabel(reason?: WorldBookSelectionDiagnostic['discardReason']): string {
  switch (reason) {
    case 'per_book_limit':
      return '同一本命中过多';
    case 'max_selections':
      return '达到片段数量上限';
    case 'hard_budget':
      return '达到硬预算上限';
    case 'soft_budget_stop':
      return '软预算提前收口';
    case 'empty_content':
      return '片段内容为空';
    default:
      return '未入选';
  }
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

function isInlineDataImage(value: string) {
  return /^data:image\/[a-zA-Z0-9.+-]+(?:;[^,]+)?,/i.test(value.trim());
}

function areStickerListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function migrateLegacyStickerEntries(
  values: string[],
  persistDataUrl: (dataUrl: string, fileName?: string) => Promise<string>,
) {
  let changed = false;
  const nextValues = await Promise.all(values.map(async (value, index) => {
    const normalized = value.trim();
    if (!isInlineDataImage(normalized)) {
      return normalized;
    }

    changed = true;
    return persistDataUrl(normalized, `sticker-${index + 1}.png`);
  }));

  return {
    changed,
    values: normalizeStickerEntries(nextValues),
  };
}

async function importStickerFiles(
  files: File[],
  persistUploadedFile: (file: File) => Promise<string>,
) {
  if (files.length === 0) return [];

  const stickerGroups = await Promise.all(files.map(async (file) => {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const raw = await readFileAsText(file);
      return extractStickerEntriesFromJson(parseJsonFileContent(raw));
    }

    if (
      file.type === 'text/plain'
      || file.type === 'text/csv'
      || file.name.endsWith('.txt')
      || file.name.endsWith('.csv')
    ) {
      const raw = await readFileAsText(file);
      return extractStickerEntriesFromText(raw);
    }

    const assetRef = await persistUploadedFile(file);
    return [assetRef];
  }));

  return normalizeStickerEntries(stickerGroups.flat());
}

export function ChatSettingsPanel({ 
  character, 
  onUpdate, 
  onBack,
  history,
  setHistory,
  groups,
  activeConfig,
  worldBooks,
  masks,
  callHistory,
  favorites,
  setFavorites,
  onDeleteCallRecord,
  settings,
  onUpdateSettings,
  visualSettings,
  onUpdateVisualSettings
}: { 
  character: Character; 
  onUpdate: (c: Character) => void; 
  onBack: () => void;
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  groups: string[];
  activeConfig?: ApiConfig;
  worldBooks: WorldBookEntry[];
  masks: Mask[];
  callHistory?: CallRecord[];
  favorites: FavoriteMessage[];
  setFavorites: (f: FavoriteMessage[]) => void;
  onDeleteCallRecord?: (recordId: string) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  visualSettings: VisualSettings;
  onUpdateVisualSettings: (settings: VisualSettings) => void;
}) {
  const CHARACTER_EDITOR_LIMITS = {
    remarkName: 32,
    signature: 200,
    corePersona: 12000,
    extendedLore: 6000,
    expressionStyle: 3000,
    boundaryPack: 2000,
    sceneHint: 1200,
  } as const;

  const { setUploadedFile } = usePersistentFieldActions();
  const [expandedSection, setExpandedSection] = useState<'basic' | 'chat' | 'model' | 'resource' | null>(null);
  const [tempAvatar, setTempAvatar] = useState('');
  const [tempBg, setTempBg] = useState('');
  const [showAvatarInput, setShowAvatarInput] = useState(false);
  const [showBgInput, setShowBgInput] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isLongTermSummarizing, setIsLongTermSummarizing] = useState(false);
  const [isShortTermSummarizing, setIsShortTermSummarizing] = useState(false);
  const [showMemorySettings, setShowMemorySettings] = useState(false);
  const [showWorldBookSelector, setShowWorldBookSelector] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [tokenEstimate, setTokenEstimate] = useState({
    mainChat: 0,
    autoReply: 0,
    autoTranslate: 0,
    autoSummary: 0,
  });
  const [worldBookDebug, setWorldBookDebug] = useState<{
    selected: WorldBookSelectionDiagnostic[];
    discarded: WorldBookSelectionDiagnostic[];
    query?: string;
    usedChars: number;
    softCharBudget: number;
    hardCharBudget: number;
    maxSelections: number;
    totalCandidates: number;
  }>({
    selected: [],
    discarded: [],
    query: undefined,
    usedChars: 0,
    softCharBudget: 0,
    hardCharBudget: 0,
    maxSelections: 0,
    totalCandidates: 0,
  });
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedCallRecords, setSelectedCallRecords] = useState<Set<string>>(new Set());
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showSettingEditor, setShowSettingEditor] = useState(false);
  const [showRemarkEditor, setShowRemarkEditor] = useState(false);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [activeMemoryDetail, setActiveMemoryDetail] = useState<null | 'short-term' | 'long-term'>(null);
  const [activeMemoryHomeTab, setActiveMemoryHomeTab] = useState<'library' | 'stats'>('library');
  const [activeMemoryYear, setActiveMemoryYear] = useState<MemoryLibraryYearGroup | null>(null);
  const [activeMemoryEntry, setActiveMemoryEntry] = useState<MemoryLibraryEntry | null>(null);
  const [pendingMemoryImport, setPendingMemoryImport] = useState<(PreparedMemoryImport & { fileName: string }) | null>(null);
  const [pendingMemoryExport, setPendingMemoryExport] = useState<{
    scope: MemoryExportScope;
    label: string;
    entries: MemoryLibraryEntry[];
  } | null>(null);
  const [pendingRemarkName, setPendingRemarkName] = useState('');
  const [pendingSignature, setPendingSignature] = useState('');
  const [sharedStickerLinksDraft, setSharedStickerLinksDraft] = useState('');
  const [characterStickerLinksDraft, setCharacterStickerLinksDraft] = useState('');
  const [minRepliesDraft, setMinRepliesDraft] = useState(String(character?.minReplies || 1));
  const [maxRepliesDraft, setMaxRepliesDraft] = useState(String(character?.maxReplies || 3));
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [voiceClonePreviewUrl, setVoiceClonePreviewUrl] = useState('');
  const [voiceLibrary, setVoiceLibrary] = useState<MinimaxVoiceRecord[]>([]);
  const [isFetchingVoiceLibrary, setIsFetchingVoiceLibrary] = useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const memoryImportInputRef = React.useRef<HTMLInputElement | null>(null);
  const voiceSampleInputRef = React.useRef<HTMLInputElement | null>(null);
  useKeyboardSafeViewport({
    containerRef: panelRef,
    enabled: true,
  });

  if (!character) return null;

  const voiceProfile = {
    enabled: character.voiceProfile?.enabled !== false,
    mode: character.voiceProfile?.mode || 'default',
    voiceId: character.voiceProfile?.voiceId || '',
    voiceName: character.voiceProfile?.voiceName || '',
    voiceSource: character.voiceProfile?.voiceSource,
    sampleAssetId: character.voiceProfile?.sampleAssetId,
    sampleName: character.voiceProfile?.sampleName,
    autoPlay: !!character.voiceProfile?.autoPlay,
    replyMode: character.voiceProfile?.replyMode || 'voice',
    replyFrequency: character.voiceProfile?.replyFrequency || 'medium',
  } as NonNullable<Character['voiceProfile']>;
  const { resolvedUrl: resolvedCharacterAvatarUrl } = useResolvedPersistentValue(character.avatar);
  const { resolvedUrl: resolvedCharacterBackgroundUrl } = useResolvedPersistentValue(character.background);
  const { resolvedUrl: resolvedVoiceSampleUrl } = useResolvedPersistentValue(voiceProfile.sampleAssetId);

  const currentGroupLabel = character.groupId || '无分组';
  const remarkName = character.remarkName?.trim() || '';
  const profileSummary = character.signature?.trim() || character.openingRemark?.trim() || '这个角色还没有填写个性签名。';
  const resolvedCorePersona = buildCharacterContext({ character }).corePersona ?? '';
  const extendedLore = character.extendedLore ?? '';
  const expressionStyle = character.expressionStyle ?? '';
  const boundaryPack = character.boundaryPack ?? '';
  const sceneHints = character.sceneHints ?? {};
  const chatSceneHint = sceneHints.chat ?? '';
  const datingSceneHint = sceneHints.dating ?? '';
  const groupChatSceneHint = sceneHints.groupChat ?? '';
  const musicTogetherSceneHint = sceneHints.musicTogether ?? '';
  const forumSceneHint = sceneHints.forum ?? '';
  const shortTermSummary = buildShortTermSummary(character) || '';
  const longTermMemoryProfile = buildLongTermMemoryProfile(character) || '';
  const shortTermMemoryEntries = getMemoryLibraryEntries(character, 'short-term');
  const longTermMemoryEntries = getMemoryLibraryEntries(character, 'long-term');
  const activeMemoryEntries = activeMemoryDetail === 'long-term' ? longTermMemoryEntries : shortTermMemoryEntries;
  const activeMemoryStats = getMemoryLibraryStats(activeMemoryEntries);
  const activeMemoryYearGroups = groupMemoryLibraryEntriesByYear(activeMemoryEntries);
  const effectiveMemoryLimit = clampDirectMemoryLimit(character.memoryLimit);
  const updateMemoryLimit = (value: unknown) => {
    onUpdate({ ...character, memoryLimit: clampDirectMemoryLimit(value) });
  };
  const updateSceneHint = (key: string, rawValue: string) => {
    const nextValue = rawValue.slice(0, CHARACTER_EDITOR_LIMITS.sceneHint);
    const nextSceneHints = { ...(character.sceneHints || {}) };

    if (nextValue.trim()) {
      nextSceneHints[key] = nextValue;
    } else {
      delete nextSceneHints[key];
    }

    onUpdate({
      ...character,
      sceneHints: Object.keys(nextSceneHints).length > 0 ? nextSceneHints : undefined,
    });
  };
  const sceneHintEditors = [
    {
      key: 'chat',
      label: '单聊时',
      summary: '写私聊的时候。比如回消息快慢、说话轻重、会不会多说一点。',
      placeholder: '比如：私聊里回得不算慢，话不多，但也不会让你一个人把话说完。',
      value: chatSceneHint,
    },
    {
      key: 'dating',
      label: '约会时',
      summary: '写你们单独见面、出门、散步、吃饭这种时候。',
      placeholder: '比如：出门时会比平时松一点，走路会等你，气氛慢下来以后才会多说。',
      value: datingSceneHint,
    },
    {
      key: 'groupChat',
      label: '群里',
      summary: '写群聊、朋友局、很多人都在的时候。',
      placeholder: '比如：人多时先听着，不抢话；真轮到你这里，会顺手替你圆一句。',
      value: groupChatSceneHint,
    },
    {
      key: 'musicTogether',
      label: '一起听歌时',
      summary: '写一起听歌、安静待着、气氛比较轻的时候。',
      placeholder: '比如：这种时候话会更轻，偶尔顺着歌词说一句，但不会一直分析歌。',
      value: musicTogetherSceneHint,
    },
    {
      key: 'forum',
      label: '论坛 / 界隙提示',
      summary: '写公开发言、旁人围观、外人看你们的时候。',
      placeholder: '比如：外人先看到的是冷静和分寸，不太看得出他私下那一面。',
      value: forumSceneHint,
    },
  ] as const;
  const activeMemoryStatCards = [
    {
      label: '总记忆条数',
      value: `${activeMemoryStats.totalEntries}`,
      helper: activeMemoryDetail === 'long-term' ? '长期沉淀下来的稳定记录数量' : '近期状态和余波记录数量',
    },
    {
      label: '总字数',
      value: `${activeMemoryStats.totalChars}`,
      helper: '当前这个记忆库累计沉淀下来的正文总字数',
    },
    {
      label: '最近更新时间',
      value: formatMemoryStatDate(activeMemoryStats.latestCreatedAt),
      helper: '最后一次写入这类记忆的真实时间',
    },
    {
      label: '最早记录时间',
      value: formatMemoryStatDate(activeMemoryStats.earliestCreatedAt),
      helper: '这类记忆第一次被收进记忆库的时间',
    },
    {
      label: '本月新增',
      value: `${activeMemoryStats.currentMonthEntries}`,
      helper: '按当前自然月统计的新增记录数',
    },
    {
      label: '自动 / 手动',
      value: `${activeMemoryStats.autoEntries} / ${activeMemoryStats.manualEntries}`,
      helper: '自动总结和手动触发的记录数量',
    },
  ];
  const settingSummary = resolvedCorePersona
    ? `${resolvedCorePersona.slice(0, 48)}${resolvedCorePersona.length > 48 ? '...' : ''}`
    : '还没有填写角色设定。';
  const voiceSampleDisplayUrl = getDisplayableAssetValue(voiceProfile.sampleAssetId, resolvedVoiceSampleUrl);
  const apiCenterDefaultVoiceId = settings.apiCenterConfig?.voiceCall?.tts?.defaultVoiceId?.trim() || '';
  const apiCenterDefaultSampleName = settings.apiCenterConfig?.voiceCall?.tts?.defaultSampleName?.trim() || '';
  const selectedLibraryVoice = voiceLibrary.find((voice) => voice.voiceId === voiceProfile.voiceId?.trim()) || null;

  useEffect(() => {
    setPendingRemarkName(character.remarkName ?? '');
  }, [character.remarkName]);

  useEffect(() => {
    setPendingSignature(character.signature ?? '');
  }, [character.signature]);

  useEffect(() => {
    setMinRepliesDraft(String(character.minReplies || 1));
  }, [character.minReplies]);

  useEffect(() => {
    setMaxRepliesDraft(String(character.maxReplies || 3));
  }, [character.maxReplies]);

  useEffect(() => {
    let cancelled = false;

    const migrateLegacyStickers = async () => {
      const sharedStickers = settings.sharedStickers || [];
      const characterStickers = character.stickers || [];
      const hasLegacyShared = sharedStickers.some(isInlineDataImage);
      const hasLegacyCharacter = characterStickers.some(isInlineDataImage);

      if (!hasLegacyShared && !hasLegacyCharacter) {
        return;
      }

      try {
        if (hasLegacyShared) {
          const migratedShared = await migrateLegacyStickerEntries(sharedStickers, saveUploadedDataUrl);
          if (!cancelled && migratedShared.changed && !areStickerListsEqual(sharedStickers, migratedShared.values)) {
            onUpdateSettings({
              ...settings,
              sharedStickers: migratedShared.values,
            });
          }
        }

        if (hasLegacyCharacter) {
          const migratedCharacter = await migrateLegacyStickerEntries(characterStickers, saveUploadedDataUrl);
          if (!cancelled && migratedCharacter.changed && !areStickerListsEqual(characterStickers, migratedCharacter.values)) {
            onUpdate({
              ...character,
              stickers: migratedCharacter.values,
            });
          }
        }
      } catch (error) {
        console.error('[chat-settings] Failed to migrate legacy sticker entries.', error);
      }
    };

    void migrateLegacyStickers();

    return () => {
      cancelled = true;
    };
  }, [character, onUpdate, onUpdateSettings, settings]);

  useEffect(() => {
    if (!activeMemoryDetail) {
      return;
    }

    setActiveMemoryEntry((current) => {
      if (!current) {
        return current;
      }

      return activeMemoryEntries.find((entry) => entry.id === current.id) ?? null;
    });

    setActiveMemoryYear((current) => {
      if (!current) {
        return current;
      }

      return activeMemoryYearGroups.find((group) => group.key === current.key) ?? null;
    });
  }, [activeMemoryDetail, character.memoryLibraryEntries]);

  const appendSharedStickers = (stickers: string[]) => {
    const nextStickers = normalizeStickerEntries([
      ...(settings.sharedStickers || []),
      ...stickers,
    ]);
    onUpdateSettings({
      ...settings,
      sharedStickers: nextStickers,
    });
  };

  const appendCharacterStickers = (stickers: string[]) => {
    const nextStickers = normalizeStickerEntries([
      ...(character.stickers || []),
      ...stickers,
    ]);
    onUpdate({ ...character, stickers: nextStickers });
  };

  const handleVoiceSampleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('audio/')) {
      await showInAppAlert('请上传音频文件，例如 mp3、wav、m4a。');
      event.currentTarget.value = '';
      return;
    }

    try {
      const assetRef = await setUploadedFile(file);
      onUpdate({
        ...character,
        voiceProfile: {
          ...voiceProfile,
          enabled: true,
          mode: 'cloned',
          sampleAssetId: assetRef,
          sampleName: file.name,
        },
      });
      setVoiceClonePreviewUrl('');
    } finally {
      event.currentTarget.value = '';
    }
  };

  const handleRemoveVoiceSample = async () => {
    if (!voiceProfile.sampleAssetId) {
      return;
    }

    if (!(await showInAppConfirm('确定要移除这个语音样本吗？'))) {
      return;
    }

    onUpdate({
      ...character,
      voiceProfile: {
        ...voiceProfile,
        sampleAssetId: undefined,
        sampleName: undefined,
        ...(voiceProfile.mode === 'cloned' ? { voiceId: '' } : {}),
      },
    });
  };

  const handleCloneCharacterVoice = async () => {
    if (!voiceProfile.sampleAssetId) {
      await showInAppAlert('请先上传语音样本。');
      return;
    }

    const ttsConfig = settings.apiCenterConfig?.voiceCall?.tts;
    if (!ttsConfig?.enabled) {
      await showInAppAlert('请先在 API 中心启用语音合成 TTS。');
      return;
    }

    setIsCloningVoice(true);
    try {
      const voiceIdSeed = voiceProfile.voiceId?.trim()
        || character.name.trim()
        || voiceProfile.sampleName?.replace(/\.[^.]+$/, '').trim()
        || 'BloomCharacterVoice';
      const result = await cloneTtsVoice({
        config: {
          id: 'api-center-tts-clone',
          name: 'API Center TTS Clone',
          provider: ttsConfig.config.provider === 'gemini'
            ? 'Google Gemini'
            : ttsConfig.config.provider === 'openai-compatible'
              ? 'OpenAI Compatible'
              : 'Custom',
          apiKey: ttsConfig.config.apiKey || '',
          baseUrl: ttsConfig.config.baseUrl || '',
          model: ttsConfig.config.model || '',
          temperature: typeof ttsConfig.config.temperature === 'number' ? ttsConfig.config.temperature : 0.7,
        },
        sampleAssetRef: voiceProfile.sampleAssetId,
        voiceId: voiceIdSeed,
        promptText: `${character.name}，你好，很高兴见到你。`,
      });

      onUpdate({
        ...character,
        voiceProfile: {
          ...voiceProfile,
          enabled: true,
          mode: 'cloned',
          voiceId: result.voiceId,
          voiceName: `${character.name} 专属音色`,
          voiceSource: 'voice_cloning',
        },
      });
      setVoiceClonePreviewUrl(result.demoAudioUrl || '');

      if (result.demoAudioUrl) {
        void new Audio(result.demoAudioUrl).play().catch((error) => {
          console.warn('Unable to autoplay cloned character voice demo.', error);
        });
      }

      await showInAppAlert(`角色声音已生成并回填 voiceId：${result.voiceId}`);
    } catch (error: any) {
      await showInAppAlert(`生成角色声音失败：${error?.message || 'unknown error'}`);
    } finally {
      setIsCloningVoice(false);
    }
  };

  const handleFetchVoiceLibrary = async () => {
    if (isFetchingVoiceLibrary) {
      return;
    }

    const ttsConfig = settings.apiCenterConfig?.voiceCall?.tts;
    if (!ttsConfig?.enabled) {
      await showInAppAlert('请先在 API 中心启用语音合成 TTS。');
      return;
    }

    setIsFetchingVoiceLibrary(true);
    try {
      const voices = await fetchMinimaxVoices({
        id: 'api-center-tts-library',
        name: 'API Center TTS Library',
        provider: ttsConfig.config.provider === 'gemini'
          ? 'Google Gemini'
          : ttsConfig.config.provider === 'openai-compatible'
            ? 'OpenAI Compatible'
            : 'Custom',
        apiKey: ttsConfig.config.apiKey || '',
        baseUrl: ttsConfig.config.baseUrl || '',
        model: ttsConfig.config.model || '',
        temperature: typeof ttsConfig.config.temperature === 'number' ? ttsConfig.config.temperature : 0.7,
      }, 'all');
      setVoiceLibrary(voices);
      await showInAppAlert(`已拉取 ${voices.length} 条音色，可直接绑定给这个角色。`);
    } catch (error: any) {
      await showInAppAlert(`拉取音色库失败：${error?.message || 'unknown error'}`);
    } finally {
      setIsFetchingVoiceLibrary(false);
    }
  };

  const librarySourceLabelMap: Record<NonNullable<MinimaxVoiceRecord['source']>, string> = {
    system: '系统音色',
    voice_cloning: '克隆音色',
    voice_generation: '设计音色',
  };

  const commitReplyRange = (field: 'min' | 'max', rawValue: string) => {
    const fallbackMin = character.minReplies || 1;
    const fallbackMax = character.maxReplies || 3;
    const parsed = parseInt(rawValue, 10);

    if (field === 'min') {
      const nextMin = Number.isNaN(parsed)
        ? fallbackMin
        : Math.max(1, Math.min(parsed, fallbackMax || 10));
      setMinRepliesDraft(String(nextMin));
      onUpdate({ ...character, minReplies: nextMin });
      return;
    }

    const nextMax = Number.isNaN(parsed)
      ? fallbackMax
      : Math.min(10, Math.max(parsed, fallbackMin || 1));
    setMaxRepliesDraft(String(nextMax));
    onUpdate({ ...character, maxReplies: nextMax });
  };

  const handleImportSharedStickerLinks = () => {
    const entries = extractStickerEntriesFromText(sharedStickerLinksDraft);
    if (entries.length === 0) return;
    appendSharedStickers(entries);
    setSharedStickerLinksDraft('');
  };

  const handleImportCharacterStickerLinks = () => {
    const entries = extractStickerEntriesFromText(characterStickerLinksDraft);
    if (entries.length === 0) return;
    appendCharacterStickers(entries);
    setCharacterStickerLinksDraft('');
  };

  const calculateTokens = () => {
      const estimateTextTokens = (text: string) => {
      let cjkCount = 0;
      let otherCount = 0;
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode >= 0x4E00 && charCode <= 0x9FFF) {
          cjkCount++;
        } else {
          otherCount++;
        }
      }
      return Math.ceil(cjkCount + otherCount * 0.35);
    };

      const historyLimit = getDirectMemoryMessageLimit(effectiveMemoryLimit);
      const historyWindow = history.slice(-historyLimit);
      const historyWindowText = historyWindow.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${getMessageMainText(msg)}`).join('\n');
      const summaryHistoryWindow = getSummaryHistoryWindow(history, effectiveMemoryLimit);
      const summaryHistoryWindowText = summaryHistoryWindow.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${getMessageMainText(msg)}`).join('\n');

      const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(character.id));
      const activeWorldBooks = worldBooks.filter(wb =>
        (wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id))) ||
        character.activeWorldBookIds?.includes(wb.id)
      );
      const latestUserText = [...history]
        .reverse()
        .find((msg) => msg.role === 'user' && getMessageMainText(msg).trim())?.text;
      const worldBookSelection = selectWorldBooksForPrompt(activeWorldBooks, 'direct', {
        query: latestUserText,
        recentText: historyWindow.map((msg) => getMessageMainText(msg)),
      });

      const mainChatPrompt = buildChatPrompt(buildChatSceneInput({
        mode: 'chat',
        character,
        userName: '用户',
        activeMask,
        activeWorldBooks,
        worldBooks,
        perceptionPrompt: '',
        worldBookQuery: latestUserText,
      }));

      const autoReplyPrompt = buildChatPrompt(buildChatSceneInput({
        mode: 'autoReply',
        includeProtocolRules: false,
        character,
        userName: '用户',
        activeMask,
        activeWorldBooks,
        worldBooks,
        perceptionPrompt: '',
        worldBookQuery: latestUserText,
      }));

      const latestModelMessage = [...history]
        .reverse()
        .find(msg => msg.role === 'model' && !msg.isSystem && !msg.translation && !msg.text.includes('---TRANSLATION---'));

      const autoTranslatePrompt = character.autoTranslate && latestModelMessage
        ? `Translate the following text to Chinese. Output ONLY the translation, no other text.\n\nText: ${getMessageMainText(latestModelMessage)}`
        : '';

      const autoSummaryPrompt = character.autoSummaryEnabled
        ? buildSummaryPrompt({
            mode: 'small',
            characterCore: {
              characterSetting: resolvedCorePersona,
            },
            memoryContext: {
              shortTermSummary,
              longTermMemoryProfile,
            },
            sections: [summaryHistoryWindowText],
          })
        : '';

      setTokenEstimate({
        mainChat: estimateTextTokens(`${mainChatPrompt}\n\n${historyWindowText}`),
        autoReply: estimateTextTokens(`${autoReplyPrompt}\n\n${historyWindowText}`),
        autoTranslate: autoTranslatePrompt ? estimateTextTokens(autoTranslatePrompt) : 0,
        autoSummary: autoSummaryPrompt ? estimateTextTokens(autoSummaryPrompt) : 0,
      });
      setWorldBookDebug({
        selected: worldBookSelection.diagnostics.selected,
        discarded: worldBookSelection.diagnostics.discarded,
        query: worldBookSelection.diagnostics.query,
        usedChars: worldBookSelection.diagnostics.usedChars,
        softCharBudget: worldBookSelection.diagnostics.softCharBudget,
        hardCharBudget: worldBookSelection.diagnostics.hardCharBudget,
        maxSelections: worldBookSelection.diagnostics.maxSelections,
        totalCandidates: worldBookSelection.diagnostics.totalCandidates,
      });
  };

  useEffect(() => {
    if (!character) return;
    calculateTokens();
  }, [character, history, masks, worldBooks]);

  const toggleMute = () => onUpdate({ ...character, isMuted: !character.isMuted });
  const togglePin = () => onUpdate({ ...character, isPinned: !character.isPinned });

  const handleGenerateSummary = async ({
    mode,
    shortTermSummary,
    longTermMemoryProfile,
    onComplete,
    setLoading,
  }: {
    mode: 'small' | 'large';
    shortTermSummary: string;
    longTermMemoryProfile: string;
    onComplete: (responseText: string) => void;
    setLoading: (value: boolean) => void;
  }) => {
    if (!activeConfig?.apiKey) {
      alert('请先配置 API Key');
      return;
    }
    if (history.length === 0) {
      alert('没有聊天记录可供总结');
      return;
    }

    setLoading(true);
    try {
      const summaryHistoryWindow = getSummaryHistoryWindow(history, effectiveMemoryLimit);
      const summarySourceLines = summaryHistoryWindow
        .map((msg) => {
          const mainText = getMessageMainText(msg).trim();
          if (!mainText) {
            return '';
          }

          return `${msg.role === 'user' ? '用户' : character.name}: ${mainText}`;
        })
        .filter(Boolean);

      if (summarySourceLines.length === 0) {
        alert('当前窗口里没有可供总结的有效文本内容。');
        return;
      }
      
      const prompt = buildSummaryPrompt({
        mode,
        characterCore: {
          characterSetting: resolvedCorePersona,
        },
        memoryContext: {
          shortTermSummary,
          longTermMemoryProfile,
        },
        sections: [summarySourceLines.join('\n')],
      });

      let responseText = '';
      try {
        await streamTextWithConfig({
          activeConfig,
          messages: [{ role: 'user', content: prompt }],
          onTextChunk: (chunkText) => {
            responseText += chunkText;
          },
        });
      } catch (error) {
        if (!isRetryableSummaryStreamError(error)) {
          throw error;
        }

        responseText = await generateTextFromMessagesWithConfig({
          activeConfig,
          messages: [{ role: 'user', content: prompt }],
        });
      }

      if (responseText.trim()) {
        onComplete(responseText.trim());
        alert('总结完成！');
      }
    } catch (error: any) {
      console.error('Failed to summarize:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      alert(`总结失败: ${message.split(' Raw preview:')[0]}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarizeShortTerm = async () => {
    await handleGenerateSummary({
      mode: 'small',
      shortTermSummary,
      longTermMemoryProfile,
      onComplete: (responseText) => onUpdate({
        ...character,
        shortTermSummary: responseText,
        ...buildMemoryLibraryPatch(character, {
          kind: 'short-term',
          source: 'manual',
          content: responseText,
        }),
      }),
      setLoading: setIsShortTermSummarizing,
    });
  };

  const handleSummarizeLongTerm = async () => {
    await handleGenerateSummary({
      mode: 'large',
      shortTermSummary,
      longTermMemoryProfile,
      onComplete: (responseText) => onUpdate({
        ...character,
        shortTermSummary: compressShortTermSummaryAfterLongTerm(shortTermSummary),
        longTermMemoryProfile: responseText,
        ...buildMemoryLibraryPatch(character, {
          kind: 'long-term',
          source: 'manual',
          content: responseText,
        }),
      }),
      setLoading: setIsLongTermSummarizing,
    });
  };

  const handleExport = () => {
    const data = JSON.stringify({ character, history }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name}_chat_data.json`;
    a.click();
    setShowExportDialog(false);
  };

  const handleDeleteMemoryEntry = async (entry: MemoryLibraryEntry) => {
    const confirmed = await showInAppConfirm('确定要删除这条记忆吗？这不会自动改动当前生效层。');
    if (!confirmed) {
      return;
    }

    onUpdate({
      ...character,
      memoryLibraryEntries: deleteMemoryLibraryEntry(character, entry.id),
    });
    setActiveMemoryEntry(null);
  };

  const handleOpenMemoryImport = () => {
    memoryImportInputRef.current?.click();
  };

  const handleMemoryImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const rawText = String(reader.result || '');
      const parsed =
        file.type === 'application/json' || file.name.endsWith('.json')
          ? parseJsonFileContent(rawText) ?? rawText
          : rawText;
      const prepared = prepareMemoryImportFromUnknown(parsed);

      if (!prepared || prepared.entries.length === 0) {
        await showInAppAlert('这个文件里没有识别到可导入的记忆内容。');
        event.target.value = '';
        return;
      }

      setPendingMemoryImport({
        ...prepared,
        fileName: file.name,
      });
      event.target.value = '';
    };

    if (
      file.type === 'application/json'
      || file.type === 'text/plain'
      || file.name.endsWith('.json')
      || file.name.endsWith('.txt')
      || file.name.endsWith('.md')
    ) {
      reader.readAsText(file, 'utf-8');
      return;
    }

    void showInAppAlert('当前只支持导入 .json / .txt / .md 记忆文件。');
    event.target.value = '';
  };

  const applyMemoryImport = (mode: 'library-only' | 'set-short-term' | 'set-long-term') => {
    if (!pendingMemoryImport) {
      return;
    }

    const allImportedText = pendingMemoryImport.entries.map((entry) => entry.content).join('\n\n').trim();
    const fallbackCurrentText =
      pendingMemoryImport.longTermCurrentText || pendingMemoryImport.shortTermCurrentText || allImportedText;
    const nextShortTermSummary =
      mode === 'set-short-term'
        ? (pendingMemoryImport.shortTermCurrentText || fallbackCurrentText)
        : character.shortTermSummary;
    const nextLongTermMemoryProfile =
      mode === 'set-long-term'
        ? (pendingMemoryImport.longTermCurrentText || fallbackCurrentText)
        : character.longTermMemoryProfile;

    onUpdate({
      ...character,
      shortTermSummary: nextShortTermSummary,
      longTermMemoryProfile: nextLongTermMemoryProfile,
      memoryLibraryEntries: appendMemoryLibraryEntries(character, pendingMemoryImport.entries),
    });

    setPendingMemoryImport(null);
    setActiveMemoryEntry(null);
    setActiveMemoryYear(null);
    setActiveMemoryHomeTab('library');

    if (mode === 'set-short-term') {
      setActiveMemoryDetail('short-term');
    } else if (mode === 'set-long-term') {
      setActiveMemoryDetail('long-term');
    }
  };

  const downloadMemoryExport = (format: MemoryExportFormat) => {
    if (!pendingMemoryExport || !activeMemoryDetail) {
      return;
    }

    const payload = buildMemoryExportPayload(
      activeMemoryDetail,
      pendingMemoryExport.scope,
      pendingMemoryExport.label,
      pendingMemoryExport.entries,
    );
    const fileStem = `${character.name}_${activeMemoryDetail}_${pendingMemoryExport.scope}_${Date.now()}`;
    const data =
      format === 'json'
        ? JSON.stringify(payload, null, 2)
        : stringifyMemoryExportAsText(payload);
    const blob = new Blob([data], {
      type: format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileStem}.${format === 'json' ? 'json' : 'txt'}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setPendingMemoryExport(null);
  };

  const openLibraryMemoryExport = () => {
    if (!activeMemoryEntries.length || !activeMemoryDetail) {
      void showInAppAlert('当前记忆库里还没有可导出的记录。');
      return;
    }

    setPendingMemoryExport({
      scope: 'library',
      label: activeMemoryDetail === 'short-term' ? '当前短期记忆库' : '当前长期记忆库',
      entries: activeMemoryEntries,
    });
  };

  const openYearMemoryExport = (group: MemoryLibraryYearGroup) => {
    setPendingMemoryExport({
      scope: 'year',
      label: `${group.year} 年`,
      entries: group.months.flatMap((month) => month.entries),
    });
  };

  const openMonthMemoryExport = (year: number, month: number) => {
    const monthGroup = activeMemoryYear?.months.find((item) => item.year === year && item.month === month);
    if (!monthGroup) {
      return;
    }

    setPendingMemoryExport({
      scope: 'month',
      label: `${year} 年 ${String(month).padStart(2, '0')} 月`,
      entries: monthGroup.entries,
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result as string;
        const compatibleImport = extractCompatibleChatSettingsImport(raw);
        if (compatibleImport?.character) {
          onUpdate({ ...character, ...compatibleImport.character });
        }
        if (compatibleImport?.history) {
          setHistory(compatibleImport.history);
        }
        if (compatibleImport?.character || compatibleImport?.history) {
          setShowImportDialog(false);
          return;
        }

        const data = parseJsonFileContent(raw);
        if (!isRecord(data)) {
          alert('无效的 JSON 文件');
          return;
        }

        if (isRecord(data.character)) {
          onUpdate({ ...character, ...data.character });
        }
        if (Array.isArray(data.history)) {
          setHistory(data.history as ChatMessage[]);
        }
        if ('character' in data || 'history' in data) {
          setShowImportDialog(false);
          return;
        }

        alert('JSON 文件缺少可导入的 character 或 history 字段');
      };
      reader.readAsText(file);
    }
  };

  return (
    <motion.div 
      ref={panelRef}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 flex flex-col z-[70]"
      style={{
        backgroundImage: resolvedCharacterBackgroundUrl ? `url(${resolvedCharacterBackgroundUrl})` : 'none',
        backgroundColor: resolvedCharacterBackgroundUrl ? 'transparent' : '#fafafa',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {activeMemoryDetail === 'short-term' && (
        <ChatMemoryLibraryHome
          kind="short-term"
          title="近期记忆 / 短期总结"
          description="按真实时间查看这位角色积累下来的短期总结记录。"
          activeTab={activeMemoryHomeTab}
          statsCards={activeMemoryStatCards}
          yearGroups={activeMemoryYearGroups}
          onImport={handleOpenMemoryImport}
          onExport={openLibraryMemoryExport}
          onOpenYear={setActiveMemoryYear}
          onTabChange={setActiveMemoryHomeTab}
          onBack={() => {
            setActiveMemoryEntry(null);
            setActiveMemoryYear(null);
            setActiveMemoryDetail(null);
          }}
        />
      )}

      {activeMemoryDetail === 'long-term' && (
        <ChatMemoryLibraryHome
          kind="long-term"
          title="长期记忆 / 长期画像"
          description="按真实时间查看这位角色积累下来的长期画像记录。"
          activeTab={activeMemoryHomeTab}
          statsCards={activeMemoryStatCards}
          yearGroups={activeMemoryYearGroups}
          onImport={handleOpenMemoryImport}
          onExport={openLibraryMemoryExport}
          onOpenYear={setActiveMemoryYear}
          onTabChange={setActiveMemoryHomeTab}
          onBack={() => {
            setActiveMemoryEntry(null);
            setActiveMemoryYear(null);
            setActiveMemoryDetail(null);
          }}
        />
      )}

      {activeMemoryDetail && activeMemoryEntry && (
        <ChatMemoryLibraryEntry
          kind={activeMemoryDetail}
          entry={activeMemoryEntry}
          onBack={() => setActiveMemoryEntry(null)}
          onDelete={() => handleDeleteMemoryEntry(activeMemoryEntry)}
        />
      )}

      {activeMemoryDetail && activeMemoryYear && (
        <ChatMemoryLibraryYear
          kind={activeMemoryDetail}
          group={activeMemoryYear}
          onBack={() => setActiveMemoryYear(null)}
          onSelectEntry={setActiveMemoryEntry}
          onExportYear={openYearMemoryExport}
          onExportMonth={(group) => openMonthMemoryExport(group.year, group.month)}
        />
      )}

      {/* Header */}
      <input
        ref={memoryImportInputRef}
        type="file"
        accept=".json,.txt,.md"
        className="hidden"
        onChange={handleMemoryImportFileChange}
      />
      <div className="min-h-[64px] pt-12 pb-3 px-4 bg-white/30 backdrop-blur-md border-b border-white/20 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-zinc-600 active:text-zinc-800"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-bold text-zinc-900 flex-1 text-center mr-8">聊天设置</h1>
      </div>

      <div
        className="flex-1 overflow-y-auto pb-10"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 20px)',
          transition: 'padding-bottom 180ms ease',
        }}
      >
        <div className="px-4 pt-6 flex flex-col gap-3">
            <button
              onClick={() => setExpandedSection(prev => (prev === 'basic' ? null : 'basic'))}
              className="order-1 w-full bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm px-4 py-4 flex items-center justify-between text-left active:bg-white/70 transition-colors"
            >
              <div>
                <h2 className="text-[15px] font-semibold text-zinc-800">基础设置</h2>
                <p className="text-[11px] text-zinc-500 mt-1">头像、分组、签名与角色基础资料</p>
              </div>
              <ChevronDown size={18} className={`text-zinc-400 transition-transform ${expandedSection === 'basic' ? '' : '-rotate-90'}`} />
            </button>
            <button
              onClick={() => setExpandedSection(prev => (prev === 'chat' ? null : 'chat'))}
              className="order-2 w-full bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm px-4 py-4 flex items-center justify-between text-left active:bg-white/70 transition-colors"
            >
              <div>
                <h2 className="text-[15px] font-semibold text-zinc-800">聊天设置</h2>
                <p className="text-[11px] text-zinc-500 mt-1">回复习惯、显示偏好和互动相关设置</p>
              </div>
              <ChevronDown size={18} className={`text-zinc-400 transition-transform ${expandedSection === 'chat' ? '' : '-rotate-90'}`} />
            </button>
            <button
              onClick={() => setExpandedSection(prev => (prev === 'model' ? null : 'model'))}
              className="order-3 w-full bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm px-4 py-4 flex items-center justify-between text-left active:bg-white/70 transition-colors"
            >
              <div>
                <h2 className="text-[15px] font-semibold text-zinc-800">模型与记忆</h2>
                <p className="text-[11px] text-zinc-500 mt-1">上下文窗口、记忆总结和世界书读取</p>
              </div>
              <ChevronDown size={18} className={`text-zinc-400 transition-transform ${expandedSection === 'model' ? '' : '-rotate-90'}`} />
            </button>
            <button
              onClick={() => setExpandedSection(prev => (prev === 'resource' ? null : 'resource'))}
              className="order-4 w-full bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm px-4 py-4 flex items-center justify-between text-left active:bg-white/70 transition-colors"
            >
              <div>
                <h2 className="text-[15px] font-semibold text-zinc-800">资源与内容</h2>
                <p className="text-[11px] text-zinc-500 mt-1">导入导出、表情包与内容管理</p>
              </div>
              <ChevronDown size={18} className={`text-zinc-400 transition-transform ${expandedSection === 'resource' ? '' : '-rotate-90'}`} />
            </button>
            <button
              onClick={async () => {
                if (await showInAppConfirm('确定要清空聊天记录吗？')) setHistory([]);
              }}
              className="order-9 w-full bg-white/80 backdrop-blur-md text-red-500 py-3.5 rounded-2xl font-bold text-[15px] border border-red-100/50 active:bg-red-50 transition-colors shadow-sm mt-2"
            >
              清空聊天记录
            </button>
        
        {expandedSection === 'basic' && (
        <div className="order-2">
        <SettingsSection
          title="基础设置"
          summary={`常用资料与聊天入口，当前分组：${currentGroupLabel}`}
          defaultOpen
          hideHeader
        >
          <div className="bg-white/60 backdrop-blur-md rounded-2xl overflow-hidden border border-white/40 shadow-sm">
            <div className="p-3 flex flex-col items-center gap-2 border-b border-white/30">
              <div className="relative group">
                <img
                  src={getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl) || undefined}
                  alt={character.name}
                  className="w-16 h-16 rounded-full object-cover bg-zinc-100 border-2 border-zinc-50"
                />
                <button
                  onClick={() => setShowAvatarInput(!showAvatarInput)}
                  className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ImageIcon className="text-white" size={20} />
                </button>
              </div>
              {showAvatarInput && (
                <div className="w-full space-y-2">
                  <input
                    type="text"
                    placeholder="支持链接、Markdown或HTML图片"
                    value={tempAvatar}
                    onChange={e => setTempAvatar(e.target.value)}
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-zinc-900"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (tempAvatar) {
                          const finalUrl = extractImageUrls(tempAvatar)[0] || tempAvatar.trim();
                          onUpdate({ ...character, avatar: finalUrl });
                        }
                        setShowAvatarInput(false);
                        setTempAvatar('');
                      }}
                      className="flex-1 rounded-lg border border-zinc-200 bg-zinc-100 py-2 text-[12px] font-medium text-zinc-900 hover:bg-zinc-200"
                    >
                      确认
                    </button>
                    <label className="flex-1 bg-white/50 border border-white/30 text-zinc-600 text-[12px] py-2 rounded-lg font-medium text-center cursor-pointer">
                      上传文件
                      <input
                        type="file"
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const persistedValue = await setUploadedFile(file);
                            onUpdate({ ...character, avatar: persistedValue });
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
              <div className="w-full flex flex-col items-center gap-0.5">
                <input
                  type="text"
                  value={character.name}
                  onChange={e => onUpdate({ ...character, name: e.target.value })}
                  className="text-[15px] font-bold text-zinc-900 text-center bg-transparent border-none outline-none focus:ring-1 focus:ring-zinc-100 rounded px-2"
                />
                <span className="text-[10px] text-zinc-400">点击名称可修改</span>
              </div>
            </div>

            <button
              onClick={toggleMute}
              className="w-full px-4 py-3 flex items-center justify-between active:bg-white/40 border-b border-white/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                  <BellOff size={18} />
                </div>
                <span className="text-[14px] text-zinc-700">消息免打扰</span>
              </div>
              <div className={`w-10 h-5.5 rounded-full transition-colors relative ${character.isMuted ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.isMuted ? 'translate-x-4.5' : ''}`} />
              </div>
            </button>

            <button
              onClick={togglePin}
              className="w-full px-4 py-3 flex items-center justify-between active:bg-white/40 border-b border-white/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                  <Pin size={18} />
                </div>
                <span className="text-[14px] text-zinc-700">置顶聊天</span>
              </div>
              <div className={`w-10 h-5.5 rounded-full transition-colors relative ${character.isPinned ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.isPinned ? 'translate-x-4.5' : ''}`} />
              </div>
            </button>

            <div className="border-b border-white/30">
              <button
                onClick={() => setShowGroupSettings(prev => !prev)}
                className="w-full px-4 py-3 flex items-center justify-between active:bg-white/40"
              >
                <div className="flex flex-col items-start">
                  <span className="text-[14px] text-zinc-700">分组设置</span>
                  <span className="text-[11px] text-zinc-400">当前已选：{currentGroupLabel}</span>
                </div>
                <ChevronDown size={18} className={`text-zinc-400 transition-transform ${showGroupSettings ? '' : '-rotate-90'}`} />
              </button>

              {showGroupSettings && (
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onUpdate({ ...character, groupId: undefined })}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${!character.groupId ? 'bg-sky-50 border-sky-200 text-sky-700 shadow-sm' : 'bg-white/50 border-white/30 text-zinc-600'}`}
                    >
                      无分组
                    </button>
                    {groups.map(g => (
                      <button
                        key={g}
                        onClick={() => onUpdate({ ...character, groupId: g })}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${character.groupId === g ? 'bg-sky-50 border-sky-200 text-sky-700 shadow-sm' : 'bg-white/50 border-white/30 text-zinc-600'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-xl bg-white/40 border border-white/30 px-3 py-3 space-y-3">
                <div className="space-y-2">
                  <button
                    onClick={() => setShowRemarkEditor(prev => !prev)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <h3 className="text-[14px] text-zinc-700 font-medium">备注</h3>
                      <p className="text-[11px] text-zinc-500 mt-1 break-words">{remarkName || '点击展开后填写备注'}</p>
                    </div>
                    <ChevronDown size={18} className={`text-zinc-400 transition-transform shrink-0 ${showRemarkEditor ? '' : '-rotate-90'}`} />
                  </button>
                  {showRemarkEditor && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={pendingRemarkName}
                        onChange={e => setPendingRemarkName(e.target.value.slice(0, CHARACTER_EDITOR_LIMITS.remarkName))}
                        placeholder="例如：阿白、学长、小周"
                        className="w-full bg-white/70 border border-white/40 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-zinc-900"
                      />
                      <div className="text-[11px] text-zinc-400 text-right">
                        {pendingRemarkName.length}/{CHARACTER_EDITOR_LIMITS.remarkName}
                      </div>
                      <button
                        onClick={() => {
                          onUpdate({ ...character, remarkName: pendingRemarkName });
                          setShowRemarkEditor(false);
                        }}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-2 text-[12px] font-medium text-zinc-900 hover:bg-zinc-200"
                      >
                        确认
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setShowSignatureEditor(prev => !prev)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <h3 className="text-[14px] text-zinc-700 font-medium">个性签名 / 角色资料摘要</h3>
                      <p className="text-[11px] text-zinc-500 mt-1 break-words">{profileSummary}</p>
                    </div>
                    <ChevronDown size={18} className={`text-zinc-400 transition-transform shrink-0 ${showSignatureEditor ? '' : '-rotate-90'}`} />
                  </button>
                  {showSignatureEditor && (
                    <div className="space-y-2">
                      <textarea
                        value={pendingSignature}
                        onChange={e => setPendingSignature(e.target.value.slice(0, CHARACTER_EDITOR_LIMITS.signature))}
                        placeholder="这个角色希望在资料页展示的一句签名..."
                        className="w-full bg-white/70 border border-white/40 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[88px] resize-none"
                      />
                      <div className="text-[11px] text-zinc-400 text-right">
                        {pendingSignature.length}/{CHARACTER_EDITOR_LIMITS.signature}
                      </div>
                      <button
                        onClick={() => {
                          onUpdate({ ...character, signature: pendingSignature });
                          setShowSignatureEditor(false);
                        }}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-2 text-[12px] font-medium text-zinc-900 hover:bg-zinc-200"
                      >
                        确认
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowSettingEditor(true)}
                className="w-full rounded-xl bg-white/40 border border-white/30 px-3 py-3 flex items-center justify-between active:bg-white/60 transition-colors"
              >
                <div className="min-w-0 text-left flex-1">
                  <h3 className="text-[14px] text-zinc-700 font-medium">角色设定</h3>
                </div>
                <ChevronRight size={18} className="text-zinc-400 shrink-0" />
              </button>
            </div>
          </div>
        </SettingsSection>
        </div>
        )}

        {expandedSection === 'chat' && (
        <div className="order-4">
        <SettingsSection
          title="聊天设置"
          summary="高频聊天行为、显示偏好和互动相关设置"
          defaultOpen
          hideHeader
        >
          <div className="bg-white/60 backdrop-blur-md rounded-2xl overflow-hidden border border-white/40 shadow-sm divide-y divide-white/30">
            <div className="px-4 py-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[14px] text-zinc-700">单次回复条数</span>
                  <span className="text-[11px] text-zinc-400">设置 AI 每次回复的消息数量区间</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={minRepliesDraft}
                    onChange={e => setMinRepliesDraft(e.target.value.replace(/[^\d]/g, ''))}
                    onBlur={() => commitReplyRange('min', minRepliesDraft)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-10 bg-white/50 border border-white/30 rounded-lg px-1 py-1 text-[12px] text-center outline-none focus:border-zinc-900"
                  />
                  <span className="text-zinc-400">-</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxRepliesDraft}
                    onChange={e => setMaxRepliesDraft(e.target.value.replace(/[^\d]/g, ''))}
                    onBlur={() => commitReplyRange('max', maxRepliesDraft)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-10 bg-white/50 border border-white/30 rounded-lg px-1 py-1 text-[12px] text-center outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-2xl bg-zinc-50/80 px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Languages size={18} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[14px] text-zinc-700">角色回复语言</span>
                    <span className="text-[10px] text-zinc-400">可让外语角色直接使用母语，并配合自动翻译查看中文</span>
                  </div>
                </div>
                <select
                  value={character.replyLanguageMode || 'follow-user'}
                  onChange={e => onUpdate({
                    ...character,
                    replyLanguageMode: e.target.value as Character['replyLanguageMode'],
                  })}
                  className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-[13px] text-zinc-700 outline-none focus:border-zinc-900"
                >
                  {REPLY_LANGUAGE_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
                    角色母语
                    <input
                      list="reply-language-presets"
                      value={character.nativeLanguage || ''}
                      placeholder="如：韩语"
                      onChange={e => onUpdate({ ...character, nativeLanguage: e.target.value })}
                      className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-[13px] text-zinc-700 outline-none focus:border-zinc-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
                    固定语言
                    <input
                      list="reply-language-presets"
                      value={character.fixedReplyLanguage || ''}
                      placeholder="如：韩语"
                      onChange={e => onUpdate({ ...character, fixedReplyLanguage: e.target.value })}
                      disabled={character.replyLanguageMode !== 'fixed'}
                      className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-[13px] text-zinc-700 outline-none focus:border-zinc-900 disabled:opacity-45"
                    />
                  </label>
                </div>
                <datalist id="reply-language-presets">
                  {LANGUAGE_PRESET_OPTIONS.map((language) => (
                    <option key={language} value={language} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <MessageCircle size={18} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[14px] text-zinc-700">自动回复</span>
                    <span className="text-[10px] text-zinc-400">开启后，发送消息会自动触发角色回复</span>
                  </div>
                </div>
                <div
                  onClick={() => onUpdate({ ...character, autoReplyEnabled: !character.autoReplyEnabled })}
                  className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${character.autoReplyEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                >
                  <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.autoReplyEnabled ? 'translate-x-4.5' : ''}`} />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                      <Smile size={18} />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[14px] text-zinc-700">场景动作描述</span>
                      <span className="text-[10px] text-zinc-400">开启后，输入框显示（）动作场景输入</span>
                    </div>
                  </div>
                  <div
                    onClick={() => {
                      const nextEnabled = !character.actionDescriptionEnabled;
                      onUpdate({
                        ...character,
                        actionDescriptionEnabled: nextEnabled,
                        characterActionDescriptionEnabled: nextEnabled ? character.characterActionDescriptionEnabled : false,
                      });
                    }}
                    className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${character.actionDescriptionEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                  >
                    <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.actionDescriptionEnabled ? 'translate-x-4.5' : ''}`} />
                  </div>
                </div>

                {character.actionDescriptionEnabled && (
                  <div className="ml-11 flex items-center justify-between rounded-2xl bg-zinc-50/80 px-3 py-2.5">
                    <div className="flex flex-col items-start">
                      <span className="text-[13px] text-zinc-700">角色使用括号</span>
                      <span className="text-[10px] text-zinc-400">开启后，角色可用（）描述动作和场景</span>
                    </div>
                    <div
                      onClick={() => onUpdate({
                        ...character,
                        characterActionDescriptionEnabled: !character.characterActionDescriptionEnabled,
                      })}
                      className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${character.characterActionDescriptionEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                    >
                      <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.characterActionDescriptionEnabled ? 'translate-x-4.5' : ''}`} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Languages size={18} />
                  </div>
                  <span className="text-[14px] text-zinc-700">自动翻译</span>
                </div>
                <div 
                  onClick={() => onUpdate({ ...character, autoTranslate: !character.autoTranslate })}
                  className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${character.autoTranslate ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                >
                  <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.autoTranslate ? 'translate-x-4.5' : ''}`} />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl bg-zinc-50/80 px-3 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                      <Volume2 size={18} />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[14px] text-zinc-700">角色语音</span>
                      <span className="text-[10px] text-zinc-400">启用后，角色可优先使用 API 中心的 TTS 配置生成语音</span>
                    </div>
                  </div>
                  <div
                    onClick={() => onUpdate({
                      ...character,
                      voiceProfile: {
                        ...voiceProfile,
                        enabled: !voiceProfile.enabled,
                      },
                    })}
                    className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${voiceProfile.enabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                  >
                    <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${voiceProfile.enabled ? 'translate-x-4.5' : ''}`} />
                  </div>
                </div>

                <div className="ml-11 space-y-2">
                  <select
                    value={voiceProfile.mode}
                    onChange={e => onUpdate({
                      ...character,
                      voiceProfile: {
                        ...voiceProfile,
                        mode: e.target.value as NonNullable<Character['voiceProfile']>['mode'],
                      },
                    })}
                    className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-[13px] text-zinc-700 outline-none focus:border-zinc-900"
                  >
                    <option value="default">使用 API 中心默认声音</option>
                    <option value="library">从音色库选择</option>
                    <option value="voiceId">手动填写 voiceId</option>
                    <option value="cloned">预留克隆 voiceId</option>
                  </select>

                  {voiceProfile.mode === 'default' && (
                    <div className="rounded-2xl border border-white/50 bg-white/70 px-3 py-3 text-[12px] leading-5 text-zinc-600">
                      {apiCenterDefaultVoiceId
                        ? `当前默认声音：${apiCenterDefaultVoiceId}${apiCenterDefaultSampleName ? `（样本：${apiCenterDefaultSampleName}）` : ''}`
                        : '尚未在 API 中心生成默认声音。请先到 API 中心的语音合成 TTS 中上传默认语音样本并生成默认声音。'}
                    </div>
                  )}

                  {voiceProfile.mode === 'library' && (
                    <div className="space-y-2 rounded-2xl bg-white/70 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-zinc-700">角色音色库</div>
                          <div className="mt-1 text-[10px] leading-5 text-zinc-400">
                            这里会读取 API 中心当前账号下可用的系统音色、克隆音色和设计音色。角色只做绑定，不在这里做复杂调音。
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleFetchVoiceLibrary()}
                          disabled={isFetchingVoiceLibrary}
                          className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
                        >
                          {isFetchingVoiceLibrary ? '拉取中...' : '拉取音色库'}
                        </button>
                      </div>

                      {voiceLibrary.length > 0 ? (
                        <>
                          <select
                            value={voiceProfile.voiceId}
                            onChange={(e) => {
                              const nextVoice = voiceLibrary.find((voice) => voice.voiceId === e.target.value) || null;
                              onUpdate({
                                ...character,
                                voiceProfile: {
                                  ...voiceProfile,
                                  mode: 'library',
                                  voiceId: e.target.value,
                                  voiceName: nextVoice?.voiceName || '',
                                  voiceSource: nextVoice?.source,
                                },
                              });
                            }}
                            className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-[13px] text-zinc-700 outline-none focus:border-zinc-900"
                          >
                            <option value="">选择一个系统音色 / 我的音色</option>
                            {voiceLibrary.map((voice) => (
                              <option key={voice.voiceId} value={voice.voiceId}>
                                [{librarySourceLabelMap[voice.source]}] {voice.voiceName}
                              </option>
                            ))}
                          </select>

                          {selectedLibraryVoice ? (
                            <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[11px] text-zinc-500">当前绑定音色</div>
                                  <div className="truncate text-[13px] font-medium text-zinc-900">
                                    {selectedLibraryVoice.voiceName}
                                  </div>
                                </div>
                                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-white">
                                  {librarySourceLabelMap[selectedLibraryVoice.source]}
                                </span>
                              </div>
                              <div className="text-[12px] text-zinc-600">
                                voiceId：{selectedLibraryVoice.voiceId}
                              </div>
                              {selectedLibraryVoice.description ? (
                                <div className="text-[12px] text-zinc-500">
                                  {selectedLibraryVoice.description}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-[12px] leading-5 text-zinc-500">
                              先拉取音色库，再从系统音色、克隆音色或设计音色里挑一个绑定给这个角色。
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-[12px] leading-5 text-zinc-500">
                          这里会显示你当前账号下的系统音色、克隆音色和设计音色。点击上方按钮即可加载。
                        </div>
                      )}
                    </div>
                  )}

                  {(voiceProfile.mode === 'voiceId' || voiceProfile.mode === 'cloned') && (
                    <input
                      type="text"
                      value={voiceProfile.voiceId}
                      onChange={e => onUpdate({
                        ...character,
                        voiceProfile: {
                          ...voiceProfile,
                          voiceId: e.target.value,
                          voiceName: '',
                          voiceSource: undefined,
                        },
                      })}
                      placeholder={voiceProfile.mode === 'cloned' ? '填写克隆得到的 voiceId' : '填写该角色专属 voiceId'}
                      className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-[13px] text-zinc-700 outline-none focus:border-zinc-900"
                    />
                  )}

                  {voiceProfile.mode === 'cloned' && (
                    <div className="space-y-2 rounded-2xl bg-white/70 px-3 py-3">
                      <input
                        ref={voiceSampleInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={(event) => void handleVoiceSampleUpload(event)}
                        className="hidden"
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-zinc-700">语音样本</div>
                          <div className="mt-1 text-[10px] leading-5 text-zinc-400">
                            建议上传 10-30 秒、环境安静、只有一个人声的音频样本。
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => voiceSampleInputRef.current?.click()}
                          className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-900 hover:bg-zinc-200"
                        >
                          {voiceProfile.sampleAssetId ? '更换样本' : '上传样本'}
                        </button>
                      </div>

                      {voiceProfile.sampleAssetId ? (
                        <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                          <div className="text-[12px] text-zinc-600">
                            当前样本：{voiceProfile.sampleName || '未命名音频样本'}
                          </div>
                          {voiceSampleDisplayUrl ? (
                            <audio controls src={voiceSampleDisplayUrl} className="w-full" />
                          ) : null}
                          {voiceProfile.voiceId ? (
                            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-[11px] text-zinc-500">当前角色 voiceId</div>
                                <div className="truncate text-[13px] font-medium text-zinc-900">{voiceProfile.voiceId}</div>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await copyTextContent(voiceProfile.voiceId || '');
                                  await showInAppAlert(result.ok ? '角色 voiceId 已复制。' : '复制失败，请手动复制。');
                                }}
                                className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-700 hover:bg-zinc-100"
                                title="复制 voiceId"
                              >
                                <Copy size={16} />
                              </button>
                            </div>
                          ) : null}
                          {voiceClonePreviewUrl ? (
                            <div className="space-y-1">
                              <div className="text-[11px] text-zinc-500">最新试听</div>
                              <audio controls src={voiceClonePreviewUrl} className="w-full" />
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleCloneCharacterVoice()}
                              disabled={isCloningVoice}
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              {isCloningVoice ? '生成中...' : '生成声音'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRemoveVoiceSample()}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-100"
                            >
                              删除样本
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2.5">
                    <div className="flex flex-col items-start">
                      <span className="text-[13px] text-zinc-700">自动播放</span>
                      <span className="text-[10px] text-zinc-400">收到带语音的角色回复时自动开始播放</span>
                    </div>
                    <div
                      onClick={() => onUpdate({
                        ...character,
                        voiceProfile: {
                          ...voiceProfile,
                          autoPlay: !voiceProfile.autoPlay,
                        },
                      })}
                      className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${voiceProfile.autoPlay ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                    >
                      <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${voiceProfile.autoPlay ? 'translate-x-4.5' : ''}`} />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl bg-white/70 px-3 py-3">
                    <div className="flex flex-col items-start">
                      <span className="text-[13px] text-zinc-700">回复形式</span>
                      <span className="text-[10px] text-zinc-400">控制角色是只打字、文字语音混合，还是尽量都发语音</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'text', label: '纯文字' },
                        { value: 'mixed', label: '混合' },
                        { value: 'voice', label: '多语音' },
                      ].map((option) => {
                        const selected = voiceProfile.replyMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => onUpdate({
                              ...character,
                              voiceProfile: {
                                ...voiceProfile,
                                replyMode: option.value as NonNullable<Character['voiceProfile']>['replyMode'],
                              },
                            })}
                            className={`rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${
                              selected
                                ? 'border border-zinc-300 bg-zinc-100 text-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
                                : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl bg-white/70 px-3 py-3">
                    <div className="flex flex-col items-start">
                      <span className="text-[13px] text-zinc-700">语音频率</span>
                      <span className="text-[10px] text-zinc-400">
                        {voiceProfile.replyMode === 'mixed'
                          ? '混合模式下，决定角色这次回复有多大概率发语音'
                          : '只有在混合模式下会用到这个频率'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'low', label: '低' },
                        { value: 'medium', label: '中' },
                        { value: 'high', label: '高' },
                      ].map((option) => {
                        const selected = voiceProfile.replyFrequency === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => onUpdate({
                              ...character,
                              voiceProfile: {
                                ...voiceProfile,
                                replyFrequency: option.value as NonNullable<Character['voiceProfile']>['replyFrequency'],
                              },
                            })}
                            className={`rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${
                              selected
                                ? 'border border-zinc-300 bg-zinc-100 text-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
                                : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Clock size={18} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[14px] text-zinc-700">显示消息下方时间</span>
                    <span className="text-[10px] text-zinc-400">消息底部显示时分，自己消息会和已读一起显示</span>
                  </div>
                </div>
                <div 
                  onClick={() => onUpdateSettings({ ...settings, showChatMessageTime: !(settings.showChatMessageTime ?? character.showTime ?? true) })}
                  className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${(settings.showChatMessageTime ?? character.showTime ?? true) ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                >
                  <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${(settings.showChatMessageTime ?? character.showTime ?? true) ? 'translate-x-4.5' : ''}`} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Clock size={18} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[14px] text-zinc-700">显示中间时间</span>
                    <span className="text-[10px] text-zinc-400">第一条、跨较久或跨天时在聊天中间显示时间条</span>
                  </div>
                </div>
                <div 
                  onClick={() => onUpdateSettings({ ...settings, showChatTimeDividers: !(settings.showChatTimeDividers ?? true) })}
                  className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${(settings.showChatTimeDividers ?? true) ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                >
                  <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${(settings.showChatTimeDividers ?? true) ? 'translate-x-4.5' : ''}`} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Activity size={18} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[14px] text-zinc-700">发动态频率</span>
                    <span className="text-[10px] text-zinc-400">设置角色在动态页面的活跃度</span>
                  </div>
                </div>
                <div className="flex bg-zinc-100 p-0.5 rounded-lg">
                  {(['none', 'low', 'medium', 'high'] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => onUpdate({ ...character, postFrequency: freq })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                        (character.postFrequency || 'medium') === freq 
                          ? 'bg-white text-zinc-900 shadow-sm' 
                          : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      {freq === 'none' ? '关闭' : freq === 'low' ? '低' : freq === 'medium' ? '中' : '高'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowCallHistory(true)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Phone size={18} />
                  </div>
                  <span className="text-[14px] text-zinc-700">通话记录</span>
                </div>
                <ChevronRight size={16} className="text-zinc-400" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <ImageIcon size={18} />
                  </div>
                  <span className="text-[15px] text-zinc-700">聊天背景图</span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const randomId = Math.floor(Math.random() * 1000);
                      onUpdate({ ...character, background: `https://picsum.photos/seed/${randomId}/360/720?blur=4` });
                    }}
                    className="text-zinc-500 text-[14px] font-medium"
                  >
                    随机背景
                  </button>
                  <button 
                    onClick={() => setShowBgInput(!showBgInput)}
                    className="text-zinc-900 text-[14px] font-medium"
                  >
                    设置
                  </button>
                </div>
              </div>
              {showBgInput && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-white/70 px-3 py-2 text-[12px] font-medium text-zinc-900 transition-colors hover:bg-white">
                      上传图片
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const nextValue = await setUploadedFile(file);
                          onUpdate({ ...character, background: nextValue });
                          setShowBgInput(false);
                          setTempBg('');
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <div className="flex items-center text-[11px] text-zinc-400">
                      这里只修改当前单聊背景，不会改动自定义功能里的全局聊天背景。
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="支持链接、Markdown或HTML图片"
                    value={tempBg}
                    onChange={e => setTempBg(e.target.value)}
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const finalUrl = tempBg ? (extractImageUrls(tempBg)[0] || tempBg.trim()) : '';
                        onUpdate({ ...character, background: finalUrl });
                        setShowBgInput(false);
                        setTempBg('');
                      }}
                      className="flex-1 rounded-lg border border-zinc-200 bg-zinc-100 py-2 text-[12px] font-medium text-zinc-900 hover:bg-zinc-200"
                    >
                      确认链接
                    </button>
                    <button 
                      onClick={() => {
                        onUpdate({ ...character, background: '' });
                        setShowBgInput(false);
                      }}
                      className="flex-1 bg-red-50/80 text-red-500 text-[12px] py-2 rounded-lg font-medium"
                    >
                      清除背景
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </SettingsSection>
        </div>
        )}

        {expandedSection === 'model' && (
        <div className="order-6">
        <SettingsSection
          title="模型与记忆"
          summary="上下文窗口、Token 估算和短期/长期记忆设置"
          defaultOpen
          hideHeader
        >
          <div className="bg-white/60 backdrop-blur-md rounded-2xl overflow-hidden border border-white/40 shadow-sm divide-y divide-white/30">
            <div className="px-4 py-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <History size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[15px] text-zinc-700">记忆对话轮数</span>
                    <span className="text-[11px] text-zinc-400">用户设多少就实际读取多少轮；未设置时默认 20 轮。更早内容交给短期/长期记忆延续。</span>
                  </div>
                </div>
                <input
                  type="number"
                  min={DIRECT_MEMORY_LIMIT_MIN}
                  max={DIRECT_MEMORY_LIMIT_MAX}
                  value={effectiveMemoryLimit}
                  onChange={e => updateMemoryLimit(e.target.value || DIRECT_MEMORY_LIMIT_DEFAULT)}
                  className="w-16 bg-white/50 border border-white/30 rounded-lg px-2 py-1 text-[14px] text-center outline-none focus:border-zinc-900"
                />
              </div>
              <input
                type="range"
                min={DIRECT_MEMORY_LIMIT_MIN}
                max={DIRECT_MEMORY_LIMIT_MAX}
                value={effectiveMemoryLimit}
                onChange={e => updateMemoryLimit(e.target.value)}
                className="w-full accent-zinc-900"
              />

              <div className="pt-2 border-t border-white/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[14px] text-zinc-700">计算消耗 Token</span>
                    <span className="text-[11px] text-zinc-400">显示实时 Token 消耗预估</span>
                  </div>
                  <div
                    onClick={() => onUpdate({ ...character, showTokenCount: !character.showTokenCount })}
                    className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${character.showTokenCount ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                  >
                    <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.showTokenCount ? 'translate-x-4.5' : ''}`} />
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 text-[11px] text-zinc-400 pt-1">
                <div className="flex flex-col gap-1">
                  <span>主聊天单次预估: {tokenEstimate.mainChat} Tokens</span>
                  <span>
                    附加链（触发时）:
                    {` 自动回复 ${tokenEstimate.autoReply}`}
                    {character.autoTranslate ? ` / 自动翻译 ${tokenEstimate.autoTranslate}` : ' / 自动翻译 未开启'}
                    {character.autoSummaryEnabled ? ` / 自动总结 ${tokenEstimate.autoSummary}` : ' / 自动总结 未开启'}
                  </span>
                  <span>以上为主聊天基础消耗与附加链触发时预估，不代表全局真实总消耗。</span>
                </div>
                <button onClick={calculateTokens} className="text-zinc-500 hover:text-zinc-900 shrink-0">重新计算</button>
              </div>
              {character.showTokenCount && (
                <div className="mt-3 rounded-xl border border-white/40 bg-white/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-medium text-zinc-700">世界书命中调试</div>
                      <div className="mt-1 text-[10px] text-zinc-400">
                        {worldBookDebug.query?.trim() ? `当前检索锚点：${worldBookDebug.query.trim().slice(0, 48)}` : '当前没有明确 query，主要按优先级与最近聊天选段。'}
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-400">{worldBookDebug.selected.length} / {worldBookDebug.maxSelections || '-'} 条已注入</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
                    <div className="rounded-lg border border-zinc-100 bg-white/60 px-2.5 py-2">
                      已用预算 {worldBookDebug.usedChars} / {worldBookDebug.hardCharBudget || '-'}
                    </div>
                    <div className="rounded-lg border border-zinc-100 bg-white/60 px-2.5 py-2">
                      软预算 {worldBookDebug.softCharBudget || '-'} / 候选 {worldBookDebug.totalCandidates}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {worldBookDebug.selected.length === 0 ? (
                      <div className="text-[11px] text-zinc-400">当前没有命中的世界书片段。</div>
                    ) : (
                      worldBookDebug.selected.map((item) => (
                        <div key={`${item.worldBookId}-${item.label}`} className="rounded-lg border border-zinc-100 bg-white/70 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-medium text-zinc-700">{item.title}</span>
                            <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-500">{item.label}</span>
                            {item.pinned && <span className="rounded border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">钉住</span>}
                            <span className="text-[10px] text-zinc-400">score {item.score}</span>
                          </div>
                          <div className="mt-1 text-[10px] leading-5 text-zinc-500">{item.preview}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 border-t border-white/40 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-medium text-zinc-700">未注入片段</div>
                      <span className="text-[10px] text-zinc-400">{worldBookDebug.discarded.length} 条</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {worldBookDebug.discarded.length === 0 ? (
                        <div className="text-[11px] text-zinc-400">当前没有被丢弃的世界书片段。</div>
                      ) : (
                        worldBookDebug.discarded.slice(0, 8).map((item) => (
                          <div key={`discarded-${item.worldBookId}-${item.label}`} className="rounded-lg border border-zinc-100 bg-white/55 px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-medium text-zinc-700">{item.title}</span>
                              <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-500">{item.label}</span>
                              {item.pinned && <span className="rounded border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">钉住</span>}
                              <span className="rounded border border-rose-100 bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">
                                {getWorldBookDiscardReasonLabel(item.discardReason)}
                              </span>
                              <span className="text-[10px] text-zinc-400">score {item.score}</span>
                            </div>
                            <div className="mt-1 text-[10px] leading-5 text-zinc-500">{item.preview}</div>
                          </div>
                        ))
                      )}
                    </div>
                    {worldBookDebug.discarded.length > 8 && (
                      <div className="mt-2 text-[10px] text-zinc-400">
                        仅显示前 8 条未注入片段，剩余 {worldBookDebug.discarded.length - 8} 条未展开。
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <button
                onClick={() => setShowMemorySettings(!showMemorySettings)}
                className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/40"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Database size={18} />
                  </div>
                  <span className="text-[15px] text-zinc-700">全局记忆系统</span>
                </div>
                <ChevronDown size={18} className={`text-zinc-300 transition-transform ${showMemorySettings ? '' : '-rotate-90'}`} />
              </button>

              {showMemorySettings && (
                <div className="px-4 pb-4 pt-2 bg-white/30 border-t border-white/20 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[14px] text-zinc-700">自动刷新近期总结</span>
                      <span className="text-[11px] text-zinc-500">开启后，聊天主链会按间隔更新短期总结；关闭时，AI主要依赖最近窗口和已有长期画像。</span>
                    </div>
                    <div
                      onClick={() => onUpdate({ ...character, autoSummaryEnabled: !character.autoSummaryEnabled })}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${character.autoSummaryEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${character.autoSummaryEnabled ? 'translate-x-5' : ''}`} />
                    </div>
                  </div>

                  {character.autoSummaryEnabled && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-zinc-700">总结间隔 (条)</span>
                        <input
                          type="number"
                          min="10"
                          max="100"
                          value={character.summaryInterval || 20}
                          onChange={e => onUpdate({ ...character, summaryInterval: parseInt(e.target.value) })}
                          className="w-16 bg-white/50 border border-white/30 rounded-lg px-2 py-1 text-[14px] text-center outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[14px] text-zinc-700">长期沉淀阈值 (短期条数)</span>
                          <span className="text-[11px] text-zinc-500">累计多少条自动短期记忆后，才允许尝试自动生成长期画像。</span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={character.autoLongTermMinShortTermEntries || 5}
                          onChange={e => onUpdate({ ...character, autoLongTermMinShortTermEntries: parseInt(e.target.value) })}
                          className="w-16 bg-white/50 border border-white/30 rounded-lg px-2 py-1 text-[14px] text-center outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[14px] text-zinc-700">长期沉淀跨天阈值</span>
                          <span className="text-[11px] text-zinc-500">这些自动短期记忆至少跨几天后，才允许进入长期，避免同一天情绪直接沉淀。</span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="7"
                          value={character.autoLongTermMinDaySpan || 2}
                          onChange={e => onUpdate({ ...character, autoLongTermMinDaySpan: parseInt(e.target.value) })}
                          className="w-16 bg-white/50 border border-white/30 rounded-lg px-2 py-1 text-[14px] text-center outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <div className="rounded-2xl bg-white/55 border border-white/40 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-white/40 bg-white/55">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-[14px] text-zinc-700 font-medium">近期记忆 / 短期总结</span>
                          <span className="text-[11px] text-zinc-500">这里放最近几轮互动的状态、余波、未完事项和当前气氛，适合被自动总结频繁刷新，不应写成长期画像。</span>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            onClick={handleSummarizeShortTerm}
                            disabled={isShortTermSummarizing}
                            className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[12px] text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
                          >
                            {isShortTermSummarizing ? '总结中...' : '刷新近期总结'}
                          </button>
                          <button
                              onClick={() => {
                                setActiveMemoryHomeTab('library');
                                setActiveMemoryEntry(null);
                                setActiveMemoryYear(null);
                                setActiveMemoryDetail('short-term');
                              }}
                            className="text-[11px] text-zinc-500 hover:text-zinc-900 underline"
                          >
                            查看详情
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                      <textarea
                        value={shortTermSummary}
                        onChange={e => onUpdate({ ...character, shortTermSummary: e.target.value })}
                        placeholder="最近几轮互动的状态、余波、未完事项会出现在这里..."
                        className="w-full bg-white/70 border border-white/40 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[132px] resize-none"
                      />
                    </div>
                    </div>

                    <div className="rounded-2xl bg-white/55 border border-white/40 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-white/40 bg-white/55">
                        <div className="flex flex-col gap-1 min-w-0 pr-2">
                          <span className="text-[14px] text-zinc-700 font-medium">长期记忆 / 长期画像</span>
                          <span className="text-[11px] text-zinc-500">手动整理会把这段关系里更稳定的印象、偏好、边界和长期相处模式沉淀到这里，不应写成最近聊天压缩版。</span>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            onClick={handleSummarizeLongTerm}
                            disabled={isLongTermSummarizing}
                            className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[12px] text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
                          >
                            {isLongTermSummarizing ? '总结中...' : '生成长期画像'}
                          </button>
                          <button
                              onClick={() => {
                                setActiveMemoryHomeTab('library');
                                setActiveMemoryEntry(null);
                                setActiveMemoryYear(null);
                                setActiveMemoryDetail('long-term');
                              }}
                            className="text-[11px] text-zinc-500 hover:text-zinc-900 underline"
                          >
                            查看详情
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <div className="mb-2 text-[11px] text-zinc-400">当前生效的长期画像</div>
                        <textarea
                          value={longTermMemoryProfile}
                          onChange={e => onUpdate({ ...character, longTermMemoryProfile: e.target.value })}
                          placeholder="长期沉淀下来的稳定印象、偏好、边界和相处模式会保存在这里..."
                          className="w-full bg-white/70 border border-white/40 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[180px] resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowWorldBookSelector(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/40"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                  <BookOpen size={18} />
                </div>
                <span className="text-[15px] text-zinc-700">读取世界书</span>
              </div>
              <ChevronDown size={18} className="text-zinc-300 -rotate-90" />
            </button>
          </div>
        </SettingsSection>
        </div>
        )}

        {expandedSection === 'resource' && (
        <div className="order-8">
        <SettingsSection
          title="资源与内容"
          summary="表情包、导入导出等低频内容操作"
          defaultOpen
          hideHeader
        >
          <div className="bg-white/60 backdrop-blur-md rounded-2xl overflow-hidden border border-white/40 shadow-sm divide-y divide-white/30">
            <div className="grid grid-cols-2 divide-x divide-white/30">
              <button
                onClick={() => setShowImportDialog(true)}
                className="px-4 py-3.5 flex items-center justify-center gap-2 active:bg-white/40 text-[14px] text-zinc-900"
              >
                <Download size={16} /> 导入数据
              </button>
              <button
                onClick={() => setShowExportDialog(true)}
                className="px-4 py-3.5 flex items-center justify-center gap-2 active:bg-white/40 text-[14px] text-zinc-900"
              >
                <Share2 size={16} /> 导出数据
              </button>
            </div>

            <div
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/40 cursor-pointer"
              onClick={() => setShowStickers(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                  <Smile size={18} />
                </div>
                <span className="text-[15px] text-zinc-700">导入表情包</span>
              </div>
              <div className="flex items-center gap-2">
                {character.stickers && character.stickers.length > 0 && (
                  <span className="text-[12px] text-zinc-400">{character.stickers.length} 个</span>
                )}
                <ChevronDown size={18} className="text-zinc-300 -rotate-90" />
              </div>
            </div>
          </div>
        </SettingsSection>
        </div>
        )}
        </div>
      </div>
      <AnimatePresence>
        {showSettingEditor && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute inset-0 flex flex-col z-[80]"
            style={{
              backgroundImage: resolvedCharacterBackgroundUrl ? `url(${resolvedCharacterBackgroundUrl})` : 'none',
              backgroundColor: resolvedCharacterBackgroundUrl ? 'transparent' : '#fafafa',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="min-h-[64px] pt-12 pb-3 px-4 bg-white/30 backdrop-blur-md border-b border-white/20 flex items-center gap-3 shrink-0">
              <button onClick={() => setShowSettingEditor(false)} className="p-1 -ml-1 text-zinc-600 active:text-zinc-800">
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-[17px] font-bold text-zinc-900 flex-1 text-center mr-8">编辑角色设定</h1>
            </div>

            <div
              className="flex-1 overflow-y-auto pb-6"
              style={{
                paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 16px)',
                transition: 'padding-bottom 180ms ease',
              }}
            >
              <SettingsSection
                title="核心人设"
                summary="角色是谁、基本气质和稳定关系姿态"
              >
                <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4">
                  <p className="text-[11px] text-zinc-500 mb-3">优先填写核心人设，避免把所有背景都塞进一个超长大字段里。</p>
                  <textarea
                    value={character.corePersona ?? ''}
                    onChange={e => onUpdate({ ...character, corePersona: e.target.value.slice(0, CHARACTER_EDITOR_LIMITS.corePersona) })}
                    placeholder="输入核心人设..."
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[320px] resize-none"
                  />
                  <div className="mt-2 text-[11px] text-zinc-400 text-right">
                    {(character.corePersona ?? '').length}/{CHARACTER_EDITOR_LIMITS.corePersona}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="扩展设定与长期补充"
                summary="放核心人设之外，但仍长期有效的背景信息"
              >
                <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4 mb-4">
                  <p className="text-[11px] text-zinc-500 mb-3">
                    写不必每轮都重说、但长期有效的补充背景。这里适合放成长经历、关系惯性、固定偏好或长期世界信息；特别长的资料仍然更建议放进 World Book。
                  </p>
                  <textarea
                    value={extendedLore}
                    onChange={e => onUpdate({ ...character, extendedLore: e.target.value.slice(0, CHARACTER_EDITOR_LIMITS.extendedLore) })}
                    placeholder="例如：长期住在怎样的环境里；对某类话题天然敏感；某段关系史如何影响他现在的防备方式。"
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[180px] resize-none"
                  />
                  <div className="mt-2 text-[11px] text-zinc-400 text-right">
                    {extendedLore.length}/{CHARACTER_EDITOR_LIMITS.extendedLore}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="表达风格与相处方式"
                summary="角色怎么说话、怎么靠近你、怎么收着表达"
              >
                <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4">
                  <p className="text-[11px] text-zinc-500 mb-3">
                    写这个角色怎么说话、怎么转折、怎么靠近你、又会怎么收着表达。这里写风格，不写禁止项。
                  </p>
                  <textarea
                    value={expressionStyle}
                    onChange={e => onUpdate({ ...character, expressionStyle: e.target.value.slice(0, CHARACTER_EDITOR_LIMITS.expressionStyle) })}
                    placeholder="例如：嘴硬时会先轻轻顶一句，再把真实关心补回来；靠近时不黏腻，会用很自然的小动作和短句试探。"
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[180px] resize-none"
                  />
                  <div className="mt-2 text-[11px] text-zinc-400 text-right">
                    {expressionStyle.length}/{CHARACTER_EDITOR_LIMITS.expressionStyle}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="边界与禁区"
                summary="角色不能越过什么线、不能失真什么地方"
              >
                <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4">
                  <p className="text-[11px] text-zinc-500 mb-3">
                    写清楚不能编造什么、不能突破什么亲密强度、不能说什么、不能为了推进互动牺牲哪些角色原则。
                  </p>
                  <textarea
                    value={boundaryPack}
                    onChange={e => onUpdate({ ...character, boundaryPack: e.target.value.slice(0, CHARACTER_EDITOR_LIMITS.boundaryPack) })}
                    placeholder="例如：不把关心写成控制；关系没到时不主动说过火的话；不会说脏话；不能编造不存在的共同经历。"
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[160px] resize-none"
                  />
                  <div className="mt-2 text-[11px] text-zinc-400 text-right">
                    {boundaryPack.length}/{CHARACTER_EDITOR_LIMITS.boundaryPack}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="场景提示"
                summary="写角色在不同场合下是什么样子"
              >
                <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4">
                  <p className="text-[11px] text-zinc-500 mb-4">
                    这里写的是场合里的样子，不是重写人设。单聊、约会、群里、一起听歌、论坛 / 界隙这些都可以分别写一点。梦境不读这里。
                  </p>
                  <div className="space-y-4">
                    {sceneHintEditors.map((entry) => (
                      <div key={entry.key} className="rounded-2xl border border-white/35 bg-white/45 p-3">
                        <div className="text-[13px] font-medium text-zinc-700">{entry.label}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">{entry.summary}</div>
                        <textarea
                          value={entry.value}
                          onChange={e => updateSceneHint(entry.key, e.target.value)}
                          placeholder={entry.placeholder}
                          className="mt-3 w-full bg-white/65 border border-white/40 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[110px] resize-none"
                        />
                        <div className="mt-2 text-[11px] text-zinc-400 text-right">
                          {entry.value.length}/{CHARACTER_EDITOR_LIMITS.sceneHint}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SettingsSection>
            </div>
          </motion.div>
        )}

        {showStickers && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute inset-0 flex flex-col z-[80]"
            style={{
              backgroundImage: resolvedCharacterBackgroundUrl ? `url(${resolvedCharacterBackgroundUrl})` : 'none',
              backgroundColor: resolvedCharacterBackgroundUrl ? 'transparent' : '#fafafa',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div
              className="flex items-center justify-between px-4 pb-3 bg-white/30 backdrop-blur-md border-b border-white/20 sticky top-0 z-10 shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
            >
              <button 
                onClick={() => setShowStickers(false)}
                className="w-10 h-10 flex items-center justify-center -ml-2 text-zinc-600 active:bg-white/20 rounded-full transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-[17px] font-semibold text-zinc-800">表情包管理</h1>
              <div className="w-10" />
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-800">共享表情包</h2>
                    <p className="mt-1 text-[12px] text-zinc-500">这里导入一次，其他单聊也能直接读取。</p>
                  </div>
                  <span className="text-[12px] text-zinc-400">{settings.sharedStickers?.length || 0} 个</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <label className="aspect-square bg-white/40 backdrop-blur-md rounded-2xl border-2 border-white/30 border-dashed flex flex-col items-center justify-center text-zinc-500 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer shadow-sm">
                    <Plus size={28} className="mb-2" />
                    <span className="text-[13px] font-medium">导入共享</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/json,.json,text/plain,.txt,text/csv,.csv"
                      className="hidden"
                      onChange={async e => {
                        const input = e.currentTarget;
                        const files = Array.from(input.files || []);

                        try {
                          const newStickers = await importStickerFiles(files, setUploadedFile);
                          if (newStickers.length > 0) {
                            appendSharedStickers(newStickers);
                          }
                        } catch (error) {
                          console.error('[chat-settings] Failed to import shared stickers.', error);
                          await showInAppAlert('导入共享表情包失败，请重试。');
                        } finally {
                          input.value = '';
                        }
                      }}
                    />
                  </label>
                  {(settings.sharedStickers || []).map((sticker, idx) => (
                    <div key={`shared-${idx}`} className="relative group aspect-square bg-white/40 backdrop-blur-md rounded-2xl border border-white/30 overflow-hidden shadow-sm">
                      <ResolvedSettingsImage value={sticker} className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextSharedStickers = [...(settings.sharedStickers || [])];
                          nextSharedStickers.splice(idx, 1);
                          onUpdateSettings({ ...settings, sharedStickers: nextSharedStickers });
                        }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                {(settings.sharedStickers || []).length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={async () => {
                        if (await showInAppConfirm('确定要清空所有共享表情包吗？')) {
                          onUpdateSettings({ ...settings, sharedStickers: [] });
                        }
                      }}
                      className="w-full py-3 text-[14px] text-red-500 bg-white/80 backdrop-blur-md border border-red-100/50 rounded-2xl font-semibold active:bg-red-50 transition-colors shadow-sm"
                    >
                      清空共享表情包
                    </button>
                  </div>
                )}
                <div className="mt-4 rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm">
                  <div className="text-[14px] font-medium text-zinc-800">多链接导入</div>
                  <p className="mt-1 text-[11px] text-zinc-500">支持多行链接，或一行里粘贴多个链接；也兼容 `csv/txt` 里只有链接的内容。</p>
                  <textarea
                    value={sharedStickerLinksDraft}
                    onChange={(e) => setSharedStickerLinksDraft(e.target.value)}
                    placeholder={'每行一个链接，或直接粘贴多行链接\nhttps://example.com/a.gif\nhttps://example.com/b.png'}
                    className="mt-3 w-full min-h-[110px] resize-none rounded-xl border border-white/40 bg-white/75 px-3 py-3 text-[13px] outline-none focus:border-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={handleImportSharedStickerLinks}
                    disabled={!sharedStickerLinksDraft.trim()}
                    className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-3 text-[14px] font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                  >
                    导入这些共享链接
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-800">当前角色表情包</h2>
                    <p className="mt-1 text-[12px] text-zinc-500">只在这个角色的单聊里追加显示。</p>
                  </div>
                  <span className="text-[12px] text-zinc-400">{character.stickers?.length || 0} 个</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="aspect-square bg-white/40 backdrop-blur-md rounded-2xl border-2 border-white/30 border-dashed flex flex-col items-center justify-center text-zinc-500 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer shadow-sm">
                  <Plus size={28} className="mb-2" />
                  <span className="text-[13px] font-medium">上传表情</span>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*,application/json,.json,text/plain,.txt,text/csv,.csv" 
                    className="hidden" 
                    onChange={async e => {
                      const input = e.currentTarget;
                      const files = Array.from(input.files || []);

                      try {
                        const newStickers = await importStickerFiles(files, setUploadedFile);
                        if (newStickers.length > 0) {
                          appendCharacterStickers(newStickers);
                        }
                      } catch (error) {
                        console.error('[chat-settings] Failed to import character stickers.', error);
                        await showInAppAlert('导入角色表情包失败，请重试。');
                      } finally {
                        input.value = '';
                      }
                    }}
                  />
                </label>
                {character.stickers?.map((sticker, idx) => (
                  <div key={idx} className="relative group aspect-square bg-white/40 backdrop-blur-md rounded-2xl border border-white/30 overflow-hidden shadow-sm">
                    <ResolvedSettingsImage value={sticker} className="w-full h-full object-cover" />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newStickers = [...(character.stickers || [])];
                        newStickers.splice(idx, 1);
                        onUpdate({ ...character, stickers: newStickers });
                      }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              
              {character.stickers && character.stickers.length > 0 && (
                <div className="mt-8">
                  <button 
                    onClick={async () => {
                      if (await showInAppConfirm('确定要清空所有表情包吗？')) {
                        onUpdate({ ...character, stickers: [] });
                      }
                    }}
                    className="w-full py-3.5 text-[15px] text-red-500 bg-white/80 backdrop-blur-md border border-red-100/50 rounded-2xl font-bold active:bg-red-50 transition-colors shadow-sm"
                  >
                    清空所有表情包
                  </button>
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm">
                <div className="text-[14px] font-medium text-zinc-800">多链接导入</div>
                <p className="mt-1 text-[11px] text-zinc-500">这里导入的是当前角色私有表情包，不会同步给别的单聊。</p>
                <textarea
                  value={characterStickerLinksDraft}
                  onChange={(e) => setCharacterStickerLinksDraft(e.target.value)}
                  placeholder={'每行一个链接，或直接粘贴多行链接\nhttps://example.com/c.gif\nhttps://example.com/d.png'}
                  className="mt-3 w-full min-h-[110px] resize-none rounded-xl border border-white/40 bg-white/75 px-3 py-3 text-[13px] outline-none focus:border-zinc-900"
                />
                <button
                  type="button"
                  onClick={handleImportCharacterStickerLinks}
                  disabled={!characterStickerLinksDraft.trim()}
                  className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-3 text-[14px] font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  导入这些角色链接
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Modals */}
        {showImportDialog && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-[300px] rounded-2xl p-6 shadow-xl flex flex-col items-center"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4">
                <Download size={24} />
              </div>
              <h3 className="text-[16px] font-bold text-zinc-800 mb-2">导入聊天数据</h3>
              <p className="text-[13px] text-zinc-500 text-center mb-6">
                选择一个 JSON 文件来导入角色设定和聊天记录。这将覆盖当前数据。
              </p>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <button 
                  onClick={() => setShowImportDialog(false)}
                  className="py-3 rounded-xl bg-zinc-50 text-zinc-600 font-medium active:scale-95 transition-transform text-[14px]"
                >
                  取消
                </button>
                <label className="py-3 rounded-xl bg-blue-500 text-white font-medium active:scale-95 transition-transform text-[14px] text-center cursor-pointer">
                  选择文件
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".json"
                    onChange={handleImport}
                  />
                </label>
              </div>
            </motion.div>
          </div>
        )}

        {showExportDialog && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-[300px] rounded-2xl p-6 shadow-xl flex flex-col items-center"
            >
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-4">
                <Share2 size={24} />
              </div>
              <h3 className="text-[16px] font-bold text-zinc-800 mb-2">导出聊天数据</h3>
              <p className="text-[13px] text-zinc-500 text-center mb-6">
                确认导出当前角色的设定和所有聊天记录吗？
              </p>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <button 
                  onClick={() => setShowExportDialog(false)}
                  className="py-3 rounded-xl bg-zinc-50 text-zinc-600 font-medium active:scale-95 transition-transform text-[14px]"
                >
                  取消
                </button>
                <button 
                  onClick={handleExport}
                  className="py-3 rounded-xl bg-green-500 text-white font-medium active:scale-95 transition-transform text-[14px]"
                >
                  确认导出
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {pendingMemoryImport && (
          <div className="absolute inset-0 z-[101] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-[360px] rounded-3xl border border-white/60 bg-white p-6 shadow-xl"
            >
              <div className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-950">导入记忆</div>
              <div className="mt-2 text-[12px] leading-5 text-zinc-500">
                已读取 {pendingMemoryImport.fileName}。大文件会先拆分再分类，不会整块塞成一条记忆。
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-white/80 bg-zinc-50 px-4 py-3">
                  <div className="text-[11px] text-zinc-500">拆分后条数</div>
                  <div className="mt-1 text-[18px] font-semibold text-zinc-950">{pendingMemoryImport.entries.length}</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-zinc-50 px-4 py-3">
                  <div className="text-[11px] text-zinc-500">总字数</div>
                  <div className="mt-1 text-[18px] font-semibold text-zinc-950">{pendingMemoryImport.totalChars}</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-zinc-50 px-4 py-3">
                  <div className="text-[11px] text-zinc-500">短期块</div>
                  <div className="mt-1 text-[18px] font-semibold text-zinc-950">{pendingMemoryImport.shortTermCount}</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-zinc-50 px-4 py-3">
                  <div className="text-[11px] text-zinc-500">长期块</div>
                  <div className="mt-1 text-[18px] font-semibold text-zinc-950">{pendingMemoryImport.longTermCount}</div>
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                <button
                  onClick={() => applyMemoryImport('library-only')}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-[14px] font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  仅入库
                </button>
                <button
                  onClick={() => applyMemoryImport('set-short-term')}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] font-medium text-zinc-900 transition hover:bg-zinc-50"
                >
                  入库并设为当前短期记忆
                </button>
                <button
                  onClick={() => applyMemoryImport('set-long-term')}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] font-medium text-zinc-900 transition hover:bg-zinc-50"
                >
                  入库并设为当前长期记忆
                </button>
              </div>

              <button
                onClick={() => setPendingMemoryImport(null)}
                className="mt-3 w-full rounded-2xl px-4 py-3 text-[13px] font-medium text-zinc-500 transition hover:bg-zinc-50"
              >
                取消
              </button>
            </motion.div>
          </div>
        )}

        {pendingMemoryExport && (
          <div className="absolute inset-0 z-[101] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-[360px] rounded-3xl border border-white/60 bg-white p-6 shadow-xl"
            >
              <div className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-950">导出记忆</div>
              <div className="mt-2 text-[12px] leading-5 text-zinc-500">
                将导出 {pendingMemoryExport.label}，共 {pendingMemoryExport.entries.length} 条记录。
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-white/80 bg-zinc-50 px-4 py-3">
                  <div className="text-[11px] text-zinc-500">导出范围</div>
                  <div className="mt-1 text-[15px] font-semibold text-zinc-950">{pendingMemoryExport.label}</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-zinc-50 px-4 py-3">
                  <div className="text-[11px] text-zinc-500">导出条数</div>
                  <div className="mt-1 text-[15px] font-semibold text-zinc-950">{pendingMemoryExport.entries.length}</div>
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                <button
                  onClick={() => downloadMemoryExport('json')}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-[14px] font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  导出为 JSON
                </button>
                <button
                  onClick={() => downloadMemoryExport('txt')}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] font-medium text-zinc-900 transition hover:bg-zinc-50"
                >
                  导出为 TXT
                </button>
              </div>

              <button
                onClick={() => setPendingMemoryExport(null)}
                className="mt-3 w-full rounded-2xl px-4 py-3 text-[13px] font-medium text-zinc-500 transition hover:bg-zinc-50"
              >
                取消
              </button>
            </motion.div>
          </div>
        )}

        {showWorldBookSelector && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-[340px] rounded-2xl p-6 shadow-xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[16px] font-bold text-zinc-900">选择世界书</h3>
                <button onClick={() => setShowWorldBookSelector(false)} className="p-1 text-zinc-400">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
                {worldBooks.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-sm">暂无世界书，请在"我的"页面添加</div>
                ) : (
                  worldBooks.map(wb => {
                    const isActive = character.activeWorldBookIds?.includes(wb.id);
                    return (
                      <div 
                        key={wb.id}
                        onClick={() => {
                          const currentIds = character.activeWorldBookIds || [];
                          const newIds = isActive 
                            ? currentIds.filter(id => id !== wb.id)
                            : [...currentIds, wb.id];
                          onUpdate({ ...character, activeWorldBookIds: newIds });
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isActive ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-100 hover:bg-zinc-50 text-zinc-800'
                        }`}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="font-bold text-[14px] truncate">{wb.title}</div>
                          <div className={`text-[11px] truncate ${isActive ? 'text-zinc-400' : 'text-zinc-500'}`}>{wb.category}</div>
                        </div>
                        {isActive && <Check size={16} className="text-emerald-400" />}
                      </div>
                    );
                  })
                )}
              </div>

              <button 
                onClick={() => setShowWorldBookSelector(false)}
                className="w-full py-3 bg-zinc-100 text-zinc-900 rounded-xl font-bold text-[14px] active:scale-95 transition-transform"
              >
                完成
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showCallHistory && (
        <div className="absolute inset-0 bg-zinc-50 z-[80] flex flex-col">
          <div className="min-h-[64px] pt-12 pb-3 px-4 bg-white border-b border-zinc-100 flex items-center justify-between shrink-0 relative">
            {isBatchMode ? (
              <button 
                onClick={() => {
                  setIsBatchMode(false);
                  setSelectedCallRecords(new Set());
                }}
                className="text-zinc-600 text-[15px]"
              >
                取消
              </button>
            ) : (
              <button onClick={() => setShowCallHistory(false)} className="p-1 -ml-1 text-zinc-600 active:text-zinc-800">
                <ChevronLeft size={24} />
              </button>
            )}
            
            <h1 className="text-[17px] font-bold text-zinc-900 absolute left-1/2 -translate-x-1/2">通话记录</h1>
            
            {isBatchMode ? (
              <button 
                onClick={() => {
                  const allIds = callHistory?.filter(r => r.characterId === character.id).map(r => r.id) || [];
                  if (selectedCallRecords.size === allIds.length) {
                    setSelectedCallRecords(new Set());
                  } else {
                    setSelectedCallRecords(new Set(allIds));
                  }
                }}
                className="text-zinc-900 text-[15px] font-medium"
              >
                {selectedCallRecords.size === (callHistory?.filter(r => r.characterId === character.id).length || 0) ? '全不选' : '全选'}
              </button>
            ) : (
              <div className="relative">
                <button 
                  onClick={() => setShowBatchMenu(!showBatchMenu)}
                  className="p-1 -mr-1 text-zinc-600 active:text-zinc-800"
                >
                  <MoreHorizontal size={24} />
                </button>
                {showBatchMenu && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setShowBatchMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-xl border border-zinc-100 z-[91] overflow-hidden py-1">
                      <button 
                        onClick={() => {
                          setIsBatchMode(true);
                          setShowBatchMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-[14px] text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100"
                      >
                        批量管理
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+6rem)]">
            {(!callHistory || callHistory.filter(r => r.characterId === character.id).length === 0) ? (
              <div className="text-center py-10 text-zinc-400 text-sm">暂无通话记录</div>
            ) : (
              callHistory.filter(r => r.characterId === character.id).map(record => {
                const isFavorited = favorites.some(f => f.timestamp === record.timestamp && f.category === '通话');
                const isSelected = selectedCallRecords.has(record.id);
                
                return (
                  <div 
                    key={record.id} 
                    className={`bg-white p-4 rounded-2xl shadow-sm border transition-all ${
                      isBatchMode && isSelected ? 'border-blue-500 bg-blue-50/10' : 'border-zinc-100'
                    }`}
                    onClick={() => {
                      if (isBatchMode) {
                        const newSet = new Set(selectedCallRecords);
                        if (newSet.has(record.id)) newSet.delete(record.id);
                        else newSet.add(record.id);
                        setSelectedCallRecords(newSet);
                      }
                    }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {isBatchMode && (
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-300'
                          }`}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                        )}
                        <span className="text-xs text-zinc-400">{new Date(record.timestamp).toLocaleString()}</span>
                      </div>
                      <span className="text-xs font-mono text-zinc-300">
                        {Math.floor(record.duration / 60).toString().padStart(2, '0')}:
                        {(record.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-800 leading-relaxed mb-3">{record.text}</p>
                    
                    {!isBatchMode && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-50">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (isFavorited) {
                              setFavorites(favorites.filter(f => !(f.timestamp === record.timestamp && f.category === '通话')));
                            } else {
                              const newFavorite: FavoriteMessage = {
                                id: Date.now().toString(),
                                characterId: character.id,
                                characterName: character.name,
                                text: record.text,
                                timestamp: record.timestamp,
                                category: '通话'
                              };
                              setFavorites([...favorites, newFavorite]);
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs ${
                            isFavorited 
                              ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' 
                              : 'text-zinc-400 hover:text-yellow-500 hover:bg-yellow-50'
                          }`}
                        >
                          <Star size={14} className={isFavorited ? 'fill-current' : ''} />
                          <span>{isFavorited ? '已收藏' : '收藏'}</span>
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (await showInAppConfirm('确定要删除这条通话记录吗？')) {
                              onDeleteCallRecord?.(record.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1 text-xs"
                        >
                          <Trash2 size={14} />
                          <span>删除</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {isBatchMode && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-zinc-100 p-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[13px] text-zinc-500">已选 {selectedCallRecords.size} 项</span>
                <span className="text-[13px] text-zinc-400">
                  预估消耗: {Array.from(selectedCallRecords).reduce<number>((acc, id) => {
                    const r = callHistory?.find(item => item.id === id);
                    return acc + (r?.tokens || Math.ceil((r?.text.length || 0) * 1.5));
                  }, 0)} Tokens
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={async () => {
                    const records = callHistory?.filter(r => selectedCallRecords.has(r.id)) || [];
                    const newFavorites = [...favorites];
                    let addedCount = 0;
                    records.forEach(record => {
                      if (!newFavorites.some(f => f.timestamp === record.timestamp && f.category === '通话')) {
                        newFavorites.push({
                          id: Date.now().toString() + Math.random(),
                          characterId: character.id,
                          characterName: character.name,
                          text: record.text,
                          timestamp: record.timestamp,
                          category: '通话'
                        });
                        addedCount++;
                      }
                    });
                    setFavorites(newFavorites);
                    alert(`已收藏 ${addedCount} 条记录`);
                    setIsBatchMode(false);
                    setSelectedCallRecords(new Set());
                  }}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl active:bg-zinc-50 text-zinc-600"
                >
                  <Star size={20} />
                  <span className="text-[11px]">收藏</span>
                </button>
                <button
                  onClick={async () => {
                    const records = callHistory?.filter(r => selectedCallRecords.has(r.id)) || [];
                    const data = JSON.stringify(records, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${character.name}_call_history_export.json`;
                    a.click();
                    setIsBatchMode(false);
                    setSelectedCallRecords(new Set());
                  }}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl active:bg-zinc-50 text-zinc-600"
                >
                  <Share2 size={20} />
                  <span className="text-[11px]">导出</span>
                </button>
                <button
                  onClick={async () => {
                    if (await showInAppConfirm(`确定要删除选中的 ${selectedCallRecords.size} 条记录吗？`)) {
                      selectedCallRecords.forEach(id => onDeleteCallRecord?.(id));
                      setSelectedCallRecords(new Set());
                      setIsBatchMode(false);
                    }
                  }}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl active:bg-red-50 text-red-500"
                >
                  <Trash2 size={20} />
                  <span className="text-[11px]">删除</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

