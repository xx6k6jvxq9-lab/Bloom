import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, MoreVertical, Save, Send, Star, Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ApiConfig,
  Character,
  ChatMessage,
  DateMessage,
  DateSession,
  DatingGeneratedContent,
  UserProfileExtended,
} from '../../types';
import { generateTextWithConfig } from '../../services/ai/runtimeClient';
import { buildDatingPrompt } from '../../services/ai/prompts/builders/buildDatingPrompt';
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
  onBackToPlanner: () => void;
  onClose: () => void;
  onSaveDate: (session: DateSession) => void;
  onCollectDate: (session: DateSession) => void;
};

type SceneSessionState = DateSession & { isCollected?: boolean; isSaved?: boolean };

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

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
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
  onBackToPlanner,
  onClose,
  onSaveDate,
  onCollectDate,
}: DatingSceneProps) {
  const [currentSession, setCurrentSession] = useState<SceneSessionState>(() => ({
    ...session,
    messages: normalizeDateSessionMessages(session),
    isCollected: (session as SceneSessionState).isCollected || false,
  }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [rollbackMode, setRollbackMode] = useState(false);
  const [selectedRollbackMessageId, setSelectedRollbackMessageId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [backgroundBroken, setBackgroundBroken] = useState(false);
  const [statusExpandedMap, setStatusExpandedMap] = useState<Record<string, boolean>>({});
  const [playlistExpandedMap, setPlaylistExpandedMap] = useState<Record<string, boolean>>({});
  const requestedStartTokenRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const normalizedMessages = normalizeDateSessionMessages(session);
    setCurrentSession({
      ...session,
      messages: normalizedMessages,
      generatedContent: getLatestGeneratedContent(normalizedMessages, session.generatedContent),
      isCollected: (session as SceneSessionState).isCollected || false,
    });
    setMenuOpen(false);
    setRollbackMode(false);
    setSelectedRollbackMessageId(null);
    setError('');
    setBackgroundBroken(false);
    setStatusExpandedMap({});
    setPlaylistExpandedMap({});
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession.messages, isLoading]);

  useEffect(() => {
    if (!startToken) return;
    if (requestedStartTokenRef.current === startToken) return;
    requestedStartTokenRef.current = startToken;

    if (normalizeDateSessionMessages(session).length === 0) {
      void generateRound({ mode: 'start', baseSession: session });
    }
  }, [startToken, session]);

  const backgroundInfo = resolveDateSessionBackground(currentSession, character.avatar);
  const backgroundImage = backgroundBroken ? character.avatar : backgroundInfo.image;

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
      messages: normalizedMessages,
      generatedContent: getLatestGeneratedContent(normalizedMessages, nextSession.generatedContent),
    };
    setCurrentSession(merged);
    onSaveDate(merged);
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
        mode,
        character,
        userProfile,
        session: {
          ...pendingSession,
          messages: workingMessages,
          generatedContent: getLatestGeneratedContent(workingMessages, sessionSeed.generatedContent),
        },
        chatHistory,
        latestUserInput,
      });

      const rawText = await generateTextWithConfig({ activeConfig, prompt });
      const jsonText = extractJsonObject(rawText);
      const parsed = JSON.parse(jsonText) as DatingGeneratedContent;
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

  return (
    <div className="dating-scene">
      <div className="dating-scene__background" style={{ backgroundImage: `url(${backgroundImage})` }} />
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
      <div className="dating-scene__blur" />
      <div className="dating-scene__overlay" />

      <div className="dating-scene__shell">
        <div className="dating-scene__topbar">
          <div className="dating-scene__topbar-left">
            <button type="button" className="dating-scene__icon-btn" onClick={onBackToPlanner}>
              <ChevronLeft size={16} />
            </button>
            <img src={character.avatar} alt={character.name} className="dating-scene__avatar" />
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
                      保存
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
                    <button type="button" className="dating-scene__menu-item dating-scene__menu-item--danger" onClick={onClose}>
                      <X size={15} />
                      退出
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
              <div className="dating-scene__scene-card dating-scene__scene-card--placeholder">
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
                  <div className="dating-scene__scene-card">
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
          <div className="dating-scene__composer">
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={isLoading ? '约会剧情生成中…' : '发送消息'}
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
    </div>
  );
}
