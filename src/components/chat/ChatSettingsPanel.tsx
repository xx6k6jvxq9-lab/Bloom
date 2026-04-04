import React, { useState, useEffect } from 'react';
import { Activity, BellOff, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Database, Download, History, Image as ImageIcon, Languages, MoreHorizontal, Palette, Phone, Pin, Plus, Share2, Smile, Star, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, ChatMessage, ApiConfig, WorldBookEntry, Mask, CallRecord, FavoriteMessage, VisualSettings } from '../../types';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from '../../services/ai/prompts/builders/buildSummaryPrompt';
import { streamTextWithConfig } from '../../services/ai/runtimeClient';
import { buildLongTermMemoryProfile } from '../../services/memory/buildLongTermMemoryProfile';
import { buildShortTermSummary } from '../../services/memory/buildShortTermSummary';
import { buildChatSceneInput } from '../../services/scene-inputs/buildChatSceneInput';
import { extractImageUrls, getMessageMainText, getSummaryHistoryWindow, showInAppConfirm } from '../../utils';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { usePersistentFieldActions } from '../../features/persistence/usePersistentFieldActions';

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
  visualSettings,
  onUpdateVisualSettings
}: { 
  character: Character; 
  onUpdate: (c: Character) => void; 
  onBack: () => void;
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  groups: string[];
  activeConfig: ApiConfig;
  worldBooks: WorldBookEntry[];
  masks: Mask[];
  callHistory?: CallRecord[];
  favorites: FavoriteMessage[];
  setFavorites: (f: FavoriteMessage[]) => void;
  onDeleteCallRecord?: (recordId: string) => void;
  visualSettings: VisualSettings;
  onUpdateVisualSettings: (settings: VisualSettings) => void;
}) {
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
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedCallRecords, setSelectedCallRecords] = useState<Set<string>>(new Set());
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showSettingEditor, setShowSettingEditor] = useState(false);
  const [showRemarkEditor, setShowRemarkEditor] = useState(false);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [pendingRemarkName, setPendingRemarkName] = useState('');
  const [pendingSignature, setPendingSignature] = useState('');

  if (!character) return null;

  const { resolvedUrl: resolvedCharacterAvatarUrl } = useResolvedPersistentValue(character.avatar);
  const { resolvedUrl: resolvedCharacterBackgroundUrl } = useResolvedPersistentValue(character.background);

  const currentGroupLabel = character.groupId || '无分组';
  const remarkName = character.remarkName?.trim() || '';
  const profileSummary = character.signature?.trim() || character.openingRemark?.trim() || '这个角色还没有填写个性签名。';
  const resolvedCorePersona = character.corePersona?.trim() || character.setting.trim();
  const expressionStyle = character.expressionStyle?.trim() || '';
  const boundaryPack = character.boundaryPack?.trim() || '';
  const shortTermSummary = buildShortTermSummary(character) || '';
  const longTermMemoryProfile = buildLongTermMemoryProfile(character) || '';
  const settingSummary = resolvedCorePersona
    ? `${resolvedCorePersona.slice(0, 48)}${resolvedCorePersona.length > 48 ? '...' : ''}`
    : '还没有填写角色设定。';

  useEffect(() => {
    setPendingRemarkName(character.remarkName ?? '');
  }, [character.remarkName]);

  useEffect(() => {
    setPendingSignature(character.signature ?? '');
  }, [character.signature]);

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

      const historyLimit = character.memoryLimit || 20;
      const historyWindow = history.slice(-historyLimit);
      const historyWindowText = historyWindow.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${getMessageMainText(msg)}`).join('\n');
      const summaryHistoryWindow = getSummaryHistoryWindow(history, character.memoryLimit);
      const summaryHistoryWindowText = summaryHistoryWindow.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${getMessageMainText(msg)}`).join('\n');

      const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(character.id));
      const activeWorldBooks = worldBooks.filter(wb =>
        (wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id))) ||
        character.activeWorldBookIds?.includes(wb.id)
      );

      const mainChatPrompt = buildChatPrompt(buildChatSceneInput({
        mode: 'chat',
        character,
        userName: '用户',
        activeMask,
        activeWorldBooks,
        perceptionPrompt: '',
      }));

      const autoReplyPrompt = buildChatPrompt(buildChatSceneInput({
        mode: 'autoReply',
        includeProtocolRules: false,
        character,
        userName: '用户',
        activeMask,
        activeWorldBooks,
        perceptionPrompt: '',
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
  };

  useEffect(() => {
    if (!character) return;
    calculateTokens();
  }, [character, history, masks, worldBooks]);

  const toggleMute = () => onUpdate({ ...character, isMuted: !character.isMuted });
  const togglePin = () => onUpdate({ ...character, isPinned: !character.isPinned });

  const handleGenerateSummary = async ({
    mode,
    longTermMemoryProfile,
    onComplete,
    setLoading,
  }: {
    mode: 'small' | 'large';
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
      const summaryHistoryWindow = getSummaryHistoryWindow(history, character.memoryLimit);
      
      const prompt = buildSummaryPrompt({
        mode,
        characterCore: {
          characterSetting: resolvedCorePersona,
        },
        memoryContext: {
          longTermMemoryProfile,
        },
        sections: [
          summaryHistoryWindow.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${getMessageMainText(msg)}`).join('\n')
        ],
      });
      let responseText = '';
      await streamTextWithConfig({
        activeConfig,
        messages: [{ role: 'system', content: prompt }],
        onTextChunk: (chunkText) => {
          responseText += chunkText;
        },
      });

      if (responseText) {
        onComplete(responseText);
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
      longTermMemoryProfile,
      onComplete: (responseText) => onUpdate({ ...character, shortTermSummary: responseText }),
      setLoading: setIsShortTermSummarizing,
    });
  };

  const handleSummarizeLongTerm = async () => {
    await handleGenerateSummary({
      mode: 'large',
      longTermMemoryProfile,
      onComplete: (responseText) => onUpdate({ ...character, longTermMemoryProfile: responseText }),
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const data = parseJsonFileContent(reader.result as string);
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
      {/* Header */}
      <div className="min-h-[64px] pt-12 pb-3 px-4 bg-white/30 backdrop-blur-md border-b border-white/20 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-zinc-600 active:text-zinc-800"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-bold text-zinc-900 flex-1 text-center mr-8">聊天设置</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-10">
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
              className="order-3 w-full bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm px-4 py-4 flex items-center justify-between text-left active:bg-white/70 transition-colors"
            >
              <div>
                <h2 className="text-[15px] font-semibold text-zinc-800">聊天设置</h2>
                <p className="text-[11px] text-zinc-500 mt-1">回复习惯、显示偏好和互动相关设置</p>
              </div>
              <ChevronDown size={18} className={`text-zinc-400 transition-transform ${expandedSection === 'chat' ? '' : '-rotate-90'}`} />
            </button>
            <button
              onClick={() => setExpandedSection(prev => (prev === 'model' ? null : 'model'))}
              className="order-5 w-full bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm px-4 py-4 flex items-center justify-between text-left active:bg-white/70 transition-colors"
            >
              <div>
                <h2 className="text-[15px] font-semibold text-zinc-800">模型与记忆</h2>
                <p className="text-[11px] text-zinc-500 mt-1">上下文窗口、记忆总结和世界书读取</p>
              </div>
              <ChevronDown size={18} className={`text-zinc-400 transition-transform ${expandedSection === 'model' ? '' : '-rotate-90'}`} />
            </button>
            <button
              onClick={() => setExpandedSection(prev => (prev === 'resource' ? null : 'resource'))}
              className="order-7 w-full bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm px-4 py-4 flex items-center justify-between text-left active:bg-white/70 transition-colors"
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
                      className="flex-1 bg-zinc-900 text-white text-[12px] py-2 rounded-lg font-medium"
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
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${!character.groupId ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white/50 border-white/30 text-zinc-600'}`}
                    >
                      无分组
                    </button>
                    {groups.map(g => (
                      <button
                        key={g}
                        onClick={() => onUpdate({ ...character, groupId: g })}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${character.groupId === g ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white/50 border-white/30 text-zinc-600'}`}
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
                        onChange={e => setPendingRemarkName(e.target.value)}
                        placeholder="例如：阿白、学长、小周"
                        className="w-full bg-white/70 border border-white/40 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-zinc-900"
                      />
                      <button
                        onClick={() => {
                          onUpdate({ ...character, remarkName: pendingRemarkName });
                          setShowRemarkEditor(false);
                        }}
                        className="w-full bg-zinc-900 text-white text-[12px] py-2 rounded-lg font-medium"
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
                        onChange={e => setPendingSignature(e.target.value)}
                        placeholder="这个角色希望在资料页展示的一句签名..."
                        className="w-full bg-white/70 border border-white/40 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[88px] resize-none"
                      />
                      <button
                        onClick={() => {
                          onUpdate({ ...character, signature: pendingSignature });
                          setShowSignatureEditor(false);
                        }}
                        className="w-full bg-zinc-900 text-white text-[12px] py-2 rounded-lg font-medium"
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
                <div className="min-w-0 text-left">
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
                    type="number"
                    min="1"
                    max={character.maxReplies || 10}
                    value={character.minReplies || 1}
                    onChange={e => onUpdate({ ...character, minReplies: Math.max(1, parseInt(e.target.value)) })}
                    className="w-10 bg-white/50 border border-white/30 rounded-lg px-1 py-1 text-[12px] text-center outline-none focus:border-zinc-900"
                  />
                  <span className="text-zinc-400">-</span>
                  <input
                    type="number"
                    min={character.minReplies || 1}
                    max="10"
                    value={character.maxReplies || 3}
                    onChange={e => onUpdate({ ...character, maxReplies: Math.min(10, parseInt(e.target.value)) })}
                    className="w-10 bg-white/50 border border-white/30 rounded-lg px-1 py-1 text-[12px] text-center outline-none focus:border-zinc-900"
                  />
                </div>
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                    <Clock size={18} />
                  </div>
                  <span className="text-[14px] text-zinc-700">显示发送时间</span>
                </div>
                <div 
                  onClick={() => onUpdate({ ...character, showTime: !character.showTime })}
                  className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${character.showTime ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                >
                  <div className={`absolute top-0.75 left-0.75 w-4 h-4 bg-white rounded-full transition-transform ${character.showTime ? 'translate-x-4.5' : ''}`} />
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
                      className="flex-1 bg-zinc-900 text-white text-[12px] py-2 rounded-lg font-medium"
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

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                  <Palette size={18} />
                </div>
                <span className="text-[15px] text-zinc-700 font-medium">聊天气泡设置</span>
              </div>
              
              {/* Character Bubble */}
              <div className="flex items-center justify-between bg-white/40 p-3 rounded-xl">
                <span className="text-[14px] text-zinc-600">角色气泡</span>
                <div className="flex items-center gap-3">
                  <label className="text-zinc-900 text-[13px] font-medium cursor-pointer">
                    上传图片
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => onUpdate({ ...character, bubbleImage: reader.result as string });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {character.bubbleImage && (
                    <button 
                      onClick={() => onUpdate({ ...character, bubbleImage: undefined })}
                      className="text-red-500 text-[13px] font-medium"
                    >
                      清除
                    </button>
                  )}
                  <input 
                    type="color" 
                    value={character.bubbleColor || '#ffffff'}
                    onChange={e => onUpdate({ ...character, bubbleColor: e.target.value })}
                    className="w-6 h-6 rounded overflow-hidden border-none p-0 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              {/* User Bubble */}
              <div className="flex items-center justify-between bg-white/40 p-3 rounded-xl">
                <span className="text-[14px] text-zinc-600">用户气泡</span>
                <div className="flex items-center gap-3">
                  <label className="text-zinc-900 text-[13px] font-medium cursor-pointer">
                    上传图片
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => onUpdate({ ...character, userBubbleImage: reader.result as string });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {character.userBubbleImage && (
                    <button 
                      onClick={() => onUpdate({ ...character, userBubbleImage: undefined })}
                      className="text-red-500 text-[13px] font-medium"
                    >
                      清除
                    </button>
                  )}
                  <input 
                    type="color" 
                    value={character.userBubbleColor || '#3b82f6'}
                    onChange={e => onUpdate({ ...character, userBubbleColor: e.target.value })}
                    className="w-6 h-6 rounded overflow-hidden border-none p-0 bg-transparent cursor-pointer"
                  />
                </div>
              </div>
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
                    <span className="text-[11px] text-zinc-400">决定模型每次直接读取的最近聊天范围，更早记录仍会保留，但不会自动进入当前对话。</span>
                  </div>
                </div>
                <input
                  type="number"
                  value={character.memoryLimit || 20}
                  onChange={e => onUpdate({ ...character, memoryLimit: parseInt(e.target.value) })}
                  className="w-16 bg-white/50 border border-white/30 rounded-lg px-2 py-1 text-[14px] text-center outline-none focus:border-zinc-900"
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={character.memoryLimit || 20}
                onChange={e => onUpdate({ ...character, memoryLimit: parseInt(e.target.value) })}
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
                  )}

                  <div className="flex flex-col gap-4">
                    <div className="rounded-2xl bg-white/55 border border-white/40 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-white/40 bg-white/55">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-[14px] text-zinc-700 font-medium">近期记忆 / 短期总结</span>
                          <span className="text-[11px] text-zinc-500">这里放最近几轮互动的状态、余波和当前气氛，适合被自动总结频繁刷新。</span>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            onClick={handleSummarizeShortTerm}
                            disabled={isShortTermSummarizing}
                            className="px-3 py-1.5 bg-zinc-900 text-white text-[12px] rounded-lg active:bg-black disabled:opacity-50"
                          >
                            {isShortTermSummarizing ? '总结中...' : '刷新近期总结'}
                          </button>
                          <button
                            onClick={() => alert('近期总结详情页稍后接入，这里会进入短期总结记录列表。')}
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
                        placeholder="最近几轮互动的状态与余波会出现在这里..."
                        className="w-full bg-white/70 border border-white/40 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-zinc-900 min-h-[132px] resize-none"
                      />
                    </div>
                    </div>

                    <div className="rounded-2xl bg-white/55 border border-white/40 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-white/40 bg-white/55">
                        <div className="flex flex-col gap-1 min-w-0 pr-2">
                          <span className="text-[14px] text-zinc-700 font-medium">长期记忆 / 长期画像</span>
                          <span className="text-[11px] text-zinc-500">手动整理会把这段关系里更稳定的印象、偏好和边界沉淀到这里。</span>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            onClick={handleSummarizeLongTerm}
                            disabled={isLongTermSummarizing}
                            className="px-3 py-1.5 bg-zinc-900 text-white text-[12px] rounded-lg active:bg-black disabled:opacity-50"
                          >
                            {isLongTermSummarizing ? '总结中...' : '生成长期画像'}
                          </button>
                          <button
                            onClick={() => alert('长期画像详情页稍后接入，这里会进入长期画像记录列表。')}
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
                          placeholder="长期沉淀下来的稳定印象、偏好、边界会保存在这里..."
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

            <div className="flex-1 overflow-y-auto pb-6">
              <SettingsSection
                title="核心人设"
                summary="角色是谁、基本气质和稳定关系姿态"
              >
                <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4">
                  <p className="text-[11px] text-zinc-500 mb-3">优先填写核心人设，避免把所有背景都塞进一个超长大字段里。</p>
                  <textarea
                    value={character.corePersona ?? character.setting}
                    onChange={e => onUpdate({ ...character, corePersona: e.target.value })}
                    placeholder="输入核心人设..."
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-blue-500 min-h-[320px] resize-none"
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="表达风格与相处方式"
                summary="角色怎么说话、怎么靠近你、怎么收着表达"
              >
                <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4">
                  <p className="text-[11px] text-zinc-500 mb-3">
                    写这个角色怎么说话、怎么转折、怎么靠近你、又会怎么收着表达，尽量少写空泛标签。
                  </p>
                  <textarea
                    value={expressionStyle}
                    onChange={e => onUpdate({ ...character, expressionStyle: e.target.value })}
                    placeholder="例如：嘴硬时会先轻轻顶一句，再把真实关心补回来；靠近时不黏腻，会用很自然的小动作和短句试探。"
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-blue-500 min-h-[180px] resize-none"
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="边界与禁区"
                summary="角色不能越过什么线、不能失真什么地方"
              >
                <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4">
                  <p className="text-[11px] text-zinc-500 mb-3">
                    写清楚不能编造什么、不能突破什么亲密强度、不能为了推进互动牺牲哪些角色原则。
                  </p>
                  <textarea
                    value={boundaryPack}
                    onChange={e => onUpdate({ ...character, boundaryPack: e.target.value })}
                    placeholder="例如：不把关心写成控制；关系没到时不主动说过火的话；不能编造不存在的共同经历。"
                    className="w-full bg-white/50 border border-white/30 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-blue-500 min-h-[160px] resize-none"
                  />
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
            <div className="flex items-center justify-between px-4 py-3 bg-white/30 backdrop-blur-md border-b border-white/20 sticky top-0 z-10 shrink-0">
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
              <div className="grid grid-cols-3 gap-3">
                <label className="aspect-square bg-white/40 backdrop-blur-md rounded-2xl border-2 border-white/30 border-dashed flex flex-col items-center justify-center text-zinc-500 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer shadow-sm">
                  <Plus size={28} className="mb-2" />
                  <span className="text-[13px] font-medium">上传表情</span>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*,application/json,.json" 
                    className="hidden" 
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        let newStickers: string[] = [];
                        let loaded = 0;
                        files.forEach((file: File) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                              const data = parseJsonFileContent(reader.result as string);
                              if (Array.isArray(data)) {
                                newStickers = [...newStickers, ...data.filter(item => typeof item === 'string')];
                              } else if (isRecord(data)) {
                                if (Array.isArray(data.stickers)) {
                                  newStickers = [...newStickers, ...data.stickers.filter(item => typeof item === 'string')];
                                } else {
                                  const arrayProp = Object.values(data).find(val => Array.isArray(val));
                                  if (arrayProp) {
                                    newStickers = [...newStickers, ...arrayProp.filter(item => typeof item === 'string')];
                                  }
                                }
                              }
                            } else {
                              newStickers.push(reader.result as string);
                            }
                            loaded++;
                            if (loaded === files.length) {
                              onUpdate({ ...character, stickers: [...(character.stickers || []), ...newStickers] });
                            }
                          };
                          if (file.type === 'application/json' || file.name.endsWith('.json')) {
                            reader.readAsText(file);
                          } else {
                            reader.readAsDataURL(file);
                          }
                        });
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

          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
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

