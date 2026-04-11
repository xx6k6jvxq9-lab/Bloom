import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, MoreVertical, Save, Send, Smile, Star, Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ApiConfig,
  Character,
  ChatMessage,
  DateMessage,
  DateSession,
  DatingGeneratedContent,
  PerceptionSettings,
  UserProfileExtended,
} from '../../types';
import { generateTextFromMessagesWithConfig } from '../../services/ai/runtimeClient';
import { buildDatingPrompt } from '../../services/ai/prompts/builders/buildDatingPrompt';
import { buildDatingSceneInput } from '../../services/scene-inputs/buildDatingSceneInput';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import {
  createDateMessageId,
  createSceneMessage,
  getLatestGeneratedContent,
  normalizeDateSessionMessages,
  resolveDateSessionBackground,
} from './sessionUtils';
import './DatingScene.css';

type DatingSceneProps = {
  session: DateSession;
  startToken: number;
  character: Character;
  userProfile: UserProfileExtended;
  activeConfig: ApiConfig;
  chatHistory: ChatMessage[];
  perception?: PerceptionSettings;
  onBackToPlanner: () => void;
  onClose: () => void;
  onSaveDate: (session: DateSession) => void;
  onCollectDate: (session: DateSession) => void;
  onEndDateComplete: (payload: { archivedSession: DateSession; returnChatText: string }) => void;
};

type SceneSessionState = DateSession & { isCollected?: boolean; isSaved?: boolean };
type EndingSequencePayload = {
  monologue: string;
  chatFollowup: string;
};

const DATING_STICKERS = ['🥺', '😤', '😭', '😳', '😎', '❤️', '(贴贴)', '(抱抱)', '(委屈)', '(不理你了)'];

const createEmptyGeneratedContent = (session: DateSession, character: Character): DatingGeneratedContent => ({
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
});

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
): DatingGeneratedContent {
  const fallback = createEmptyGeneratedContent(session, character);

  return {
    background: {
      source: session.backgroundSource || fallback.background.source,
      image: session.backgroundImage || fallback.background.image,
      atmosphere: parsed?.background?.atmosphere?.trim() || '',
      focus: parsed?.background?.focus?.trim() || '',
    },
    narrative: {
      title: parsed?.narrative?.title?.trim() || '',
      subtitle: parsed?.narrative?.subtitle?.trim() || '',
      segments: (parsed?.narrative?.segments || [])
        .map(segment => ({
          type: (segment.type === 'dialogue' ? 'dialogue' : 'narration') as 'dialogue' | 'narration',
          text: segment.text?.trim() || '',
        }))
        .filter(segment => segment.text),
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
  };
}

export function DatingScene({
  session,
  startToken,
  character,
  userProfile,
  activeConfig,
  chatHistory,
  perception,
  onBackToPlanner,
  onClose,
  onSaveDate,
  onCollectDate,
  onEndDateComplete,
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
  const [input, setInput] = useState('');
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [backgroundBroken, setBackgroundBroken] = useState(false);
  const [statusExpandedMap, setStatusExpandedMap] = useState<Record<string, boolean>>({});
  const [playlistExpandedMap, setPlaylistExpandedMap] = useState<Record<string, boolean>>({});
  const [endingState, setEndingState] = useState<'idle' | 'generating' | 'ready' | 'returning'>('idle');
  const [endingMonologue, setEndingMonologue] = useState('');
  const [endingRevealCount, setEndingRevealCount] = useState(0);
  const [endingReturnText, setEndingReturnText] = useState('');
  const [endingError, setEndingError] = useState('');
  const [endingRipple, setEndingRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const requestedStartTokenRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const endingScreenRef = useRef<HTMLButtonElement | null>(null);
  const endingFlowActiveRef = useRef(false);

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
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession.messages, isLoading]);

  useEffect(() => {
    if (endingState !== 'ready' || !endingMonologue) {
      setEndingRevealCount(0);
      return;
    }

    setEndingRevealCount(0);
    const timer = window.setInterval(() => {
      setEndingRevealCount(prev => {
        const next = prev + 1;
        if (next >= endingMonologue.length) {
          window.clearInterval(timer);
          return endingMonologue.length;
        }
        return next;
      });
    }, 42);

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
  const backgroundImage = backgroundBroken
    ? character.avatar
    : getDisplayableAssetValue(
        backgroundInfo.source === 'character-avatar' ? character.avatar : backgroundInfo.image,
        resolvedBackgroundImageUrl,
      ) || '';

  const saveSession = (nextSession: SceneSessionState) => {
    const normalizedMessages = normalizeDateSessionMessages(nextSession);
    const merged = {
      ...nextSession,
      messages: normalizedMessages,
      generatedContent: getLatestGeneratedContent(normalizedMessages, nextSession.generatedContent),
    };
    setCurrentSession(merged);
  };

  const persistSession = (nextSession: SceneSessionState) => {
    const normalizedMessages = normalizeDateSessionMessages(nextSession);
    const merged = {
      ...nextSession,
      isSaved: true,
      status: nextSession.status || 'active',
      endedAt: nextSession.status === 'ended' ? nextSession.endedAt : undefined,
      messages: normalizedMessages,
      generatedContent: getLatestGeneratedContent(normalizedMessages, nextSession.generatedContent),
    };
    setCurrentSession(merged);
    onSaveDate(merged);
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

    return [
      `你现在要为角色 ${character.name} 生成“结束约会后的收尾内容”。`,
      '请严格只输出 JSON，不要输出解释、前缀、Markdown。',
      'JSON 格式如下：',
      '{"monologue":"1到2句角色内心独白","chatFollowup":"回到线上聊天后角色主动发给用户的一句话"}',
      '要求：',
      '- monologue 必须是角色心里正在想的话，偏克制、收束、带回味，不要写动作说明。',
      '- monologue 只能 1 到 2 句。',
      '- chatFollowup 必须是线上聊天语境的一句话，不要再写线下现场动作，不要继续约会场景描写。',
      '- chatFollowup 要自然像回到聊天软件后的主动开口。',
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

    const monologueReady = !endingMonologue || endingRevealCount >= endingMonologue.length;
    if (!monologueReady) {
      setEndingRevealCount(endingMonologue.length);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setEndingRipple({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      key: Date.now(),
    });
    setEndingState('returning');
    endingFlowActiveRef.current = false;

    const archivedSession: SceneSessionState = {
      ...currentSession,
      status: 'ended',
      endedAt: currentSession.endedAt || Date.now(),
    };

    window.setTimeout(() => {
      onEndDateComplete({
        archivedSession,
        returnChatText: endingReturnText.trim(),
      });
    }, 720);
  };

  const replaceMessage = (messages: DateMessage[], messageId: string, updater: (message: DateMessage) => DateMessage) =>
    messages.map(message => (message.id === messageId ? updater(message) : message));

  const generateRound = async ({
    mode,
    latestUserInput,
    baseSession,
    appendUserMessage = false,
  }: {
    mode: 'start' | 'continue';
    latestUserInput?: string;
    baseSession?: DateSession;
    appendUserMessage?: boolean;
  }) => {
    if (isLoading) return;

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
      messages: [...workingMessages, placeholderMessage],
      generatedContent: getLatestGeneratedContent(workingMessages, sessionSeed.generatedContent),
    };

    setCurrentSession(pendingSession);

    try {
      const prompt = buildDatingPrompt({
        sceneInput: buildDatingSceneInput({
          mode,
          character,
          userProfile,
          session: {
            ...pendingSession,
            messages: workingMessages,
            generatedContent: getLatestGeneratedContent(workingMessages, sessionSeed.generatedContent),
          },
          chatHistory,
          perception,
          latestUserInput,
        }),
      });

      const rawText = await generateTextFromMessagesWithConfig({
        activeConfig,
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = parseGeneratedContent(rawText);
      if (!parsed) {
        throw new Error('约会内容格式不完整，请稍后再试。');
      }
      const normalizedContent = normalizeGeneratedContent(parsed, pendingSession, character);
      const sceneMessage = createSceneMessage(normalizedContent, placeholderMessage.timestamp);
      sceneMessage.id = placeholderId;

      const finalMessages = replaceMessage(pendingSession.messages, placeholderId, () => sceneMessage);
      saveSession({
        ...pendingSession,
        messages: finalMessages,
        generatedContent: normalizedContent,
      });
    } catch (err) {
      console.error('[dating-scene] generate failed', err);
      const failedMessages = replaceMessage(pendingSession.messages, placeholderId, message => ({
        ...message,
        pending: false,
        text: '这一轮约会剧情生成失败了，请稍后再试。',
      }));
      setCurrentSession({
        ...pendingSession,
        messages: failedMessages,
      });
      setError(err instanceof Error ? err.message : '正式约会内容生成失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const nextInput = input.trim();
    if (!nextInput || isLoading) return;
    setInput('');
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

    saveSession(nextSession);
    if (nextCollected) {
      onCollectDate(nextSession);
    }
    setMenuOpen(false);
  };

  const toggleStatus = (id: string) => {
    setStatusExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePlaylist = (id: string) => {
    setPlaylistExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
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
    <div className="dating-scene">
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

      <div className="dating-scene__shell">
        <div className="dating-scene__topbar">
          <div className="dating-scene__topbar-left">
            <button type="button" className="dating-scene__icon-btn" onClick={onBackToPlanner}>
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

        <div className="dating-scene__body">
          <div className="dating-scene__messages">
            {currentSession.messages.length === 0 && isLoading ? (
              <div className="dating-scene__scene-content dating-scene__scene-content--placeholder">
                <div className="dating-scene__scene-header">
                  <div className="dating-scene__scene-title">{currentSession.scenario || '正式约会'}</div>
                </div>
                <p className="dating-scene__segment dating-scene__segment--placeholder">
                  角色正在根据你们的过往聊天、当前关系和这次约会的地点氛围生成第一轮剧情……
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

              return (
                <div key={`${message.id}-${messageIndex}`} className="dating-scene__message dating-scene__message--scene">
                  <div className="dating-scene__scene-content">
                    {content ? (
                      <>
                        <div className="dating-scene__scene-header">
                          <div className="dating-scene__scene-title">{content.narrative.title || currentSession.scenario || '正式约会'}</div>
                          {(content.narrative.subtitle || content.background.atmosphere) ? (
                            <div className="dating-scene__scene-subtitle">
                              {content.narrative.subtitle || content.background.atmosphere}
                            </div>
                          ) : null}
                        </div>

                        <div className="dating-scene__narrative">
                          {content.narrative.segments.map((segment, index) => (
                            <p
                              key={`${message.id}-${messageIndex}-${segment.type}-${index}`}
                              className={`dating-scene__segment ${segment.type === 'dialogue' ? 'dating-scene__segment--dialogue' : ''}`}
                            >
                              {segment.text}
                            </p>
                          ))}
                        </div>

                        <div className="dating-scene__folds">
                          <div className="dating-scene__fold">
                            <button type="button" className="dating-scene__fold-btn" onClick={() => toggleStatus(message.id)}>
                              <ChevronRight size={14} className={`dating-scene__fold-icon ${statusOpen ? 'is-open' : ''}`} />
                              状态
                            </button>
                            {statusOpen ? (
                              <div className="dating-scene__fold-panel">
                                <div className="dating-scene__status-list">
                                  <div className="dating-scene__status-item"><strong>地点：</strong>{content.status.location}</div>
                                  <div className="dating-scene__status-item"><strong>时间：</strong>{content.status.time}</div>
                                  <div className="dating-scene__status-item"><strong>心情：</strong>{content.status.mood}</div>
                                  <div className="dating-scene__status-item"><strong>内心 OS：</strong>{content.status.innerThought}</div>
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
                                  {content.playlist.map((song, index) => (
                                    <div key={`${message.id}-${messageIndex}-song-${index}`}>
                                      <span className="dating-scene__song-title">{song.title}</span>
                                      <span> · {song.artist}</span>
                                      {song.note ? <span className="dating-scene__song-note">{song.note}</span> : null}
                                    </div>
                                  ))}
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

          {error ? <div className="dating-scene__error">{error}</div> : null}
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
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={isLoading ? '生成中...' : '说点什么呢...'}
              className="dating-scene__input"
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
            <div className="dating-scene__ending-content">
              <AnimatePresence mode="wait">
                <motion.div
                  key={endingState === 'generating' ? 'pending-thought' : 'ending-monologue'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.32, ease: 'easeOut' }}
                  className="dating-scene__ending-text"
                >
                  {endingState === 'generating' ? '他想说点什么' : endingMonologue.slice(0, endingRevealCount)}
                </motion.div>
              </AnimatePresence>
              {endingError ? <div className="dating-scene__ending-error">{endingError}</div> : null}
              {endingState === 'ready' && !endingError && endingMonologue && endingRevealCount >= endingMonologue.length ? (
                <div className="dating-scene__ending-hint">
                  轻触页面，回到聊天
                </div>
              ) : null}
              {endingState === 'ready' && endingError ? (
                <div className="dating-scene__ending-hint">轻触页面，结束约会并回到聊天</div>
              ) : null}
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
