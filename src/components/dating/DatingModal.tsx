import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  Coffee,
  ImagePlus,
  Link2,
  LogOut,
  MapPin,
  MoreVertical,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ApiConfig, Character, ChatMessage, DateSession, PerceptionSettings, UserProfileExtended } from '../../types';
import { usePersistentFieldActions } from '../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { buildCharacterContext } from '../../services/relationship-context/buildCharacterContext';
import { DatingScene } from './DatingScene';
import { resolveDateBackgroundInput } from './sessionUtils';

interface DatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEndDateComplete: (payload: { archivedSession: DateSession; returnChatText: string }) => void;
  character: Character;
  userProfile: UserProfileExtended;
  activeConfig: ApiConfig;
  chatHistory: ChatMessage[];
  perception?: PerceptionSettings;
  onSaveDate: (session: DateSession) => void;
  onCollectDate: (session: DateSession) => void;
  initialSession?: DateSession | null;
}

type RecoverableDateSession = DateSession & { isSaved?: boolean };

const LOCATION_OPTIONS = ['海边沙滩', '电影院', '咖啡馆', '游乐园', '森林公园', '高档餐厅'];
const SCENARIO_OPTIONS = ['初次约会', '纪念日庆祝', '周末散步', '意外相遇', '浪漫晚餐'];
const MOOD_OPTIONS = ['浪漫', '轻松', '搞笑', '严肃', '温柔', '刺激'];

export const DatingModal: React.FC<DatingModalProps> = ({
  isOpen,
  onClose,
  onEndDateComplete,
  character,
  userProfile,
  activeConfig,
  chatHistory,
  perception,
  onSaveDate,
  onCollectDate,
  initialSession,
}) => {
  const [location, setLocation] = useState('');
  const [scenario, setScenario] = useState('');
  const [mood, setMood] = useState('浪漫');
  const [customMood, setCustomMood] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [localBackground, setLocalBackground] = useState('');
  const [activeSceneSession, setActiveSceneSession] = useState<RecoverableDateSession | null>(null);
  const [sceneStartToken, setSceneStartToken] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setUploadedFile } = usePersistentFieldActions();
  const wasOpenRef = useRef(false);
  const recoverableInitialSession = (initialSession as RecoverableDateSession | null) || null;
  const shouldResumeSavedScene = Boolean(
    (recoverableInitialSession?.status || 'active') === 'active' &&
    recoverableInitialSession?.isSaved &&
      ((recoverableInitialSession.messages?.length ?? 0) > 0 || recoverableInitialSession.generatedContent),
  );

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setActiveSceneSession(null);
      setSceneStartToken(0);
      return;
    }

    if (!wasOpenRef.current) {
      if (initialSession) {
        setLocation(initialSession.location || '');
        setScenario(initialSession.scenario || '');
        setMood(initialSession.mood || '浪漫');
        setCustomMood('');
        setLocalBackground(
          initialSession.backgroundSource === 'local-upload' ? initialSession.backgroundImage || '' : '',
        );
        setBackgroundUrl(initialSession.backgroundSource === 'url' ? initialSession.backgroundImage || '' : '');
      } else {
        setLocation('');
        setScenario('');
        setMood('浪漫');
        setCustomMood('');
        setLocalBackground('');
        setBackgroundUrl('');
      }

      setShowMenu(false);
      setActiveSceneSession(shouldResumeSavedScene ? recoverableInitialSession : null);
      setSceneStartToken(0);
      wasOpenRef.current = true;
    }
  }, [character.id, initialSession, isOpen, recoverableInitialSession, shouldResumeSavedScene]);

  const resolvedBackground = useMemo(
    () =>
      resolveDateBackgroundInput({
        localBackground,
        backgroundUrl,
        characterAvatar: character.avatar,
      }),
    [backgroundUrl, character.avatar, localBackground],
  );
  const { resolvedUrl: resolvedPreviewBackgroundUrl } = useResolvedPersistentValue(resolvedBackground.image);
  const { resolvedUrl: resolvedCharacterAvatarUrl } = useResolvedPersistentValue(character.avatar);

  const buildSession = (): RecoverableDateSession => ({
    id: initialSession?.id || Date.now().toString(),
    characterId: character.id,
    location,
    scenario,
    mood: customMood.trim() || mood,
    backgroundScene: '',
    backgroundImage: resolvedBackground.image,
    backgroundSource: resolvedBackground.source,
    generatedContent: initialSession?.generatedContent,
    messages: initialSession?.messages || [],
    timestamp: Date.now(),
    status: recoverableInitialSession?.status || 'active',
    endedAt: recoverableInitialSession?.endedAt,
    isSaved: recoverableInitialSession?.isSaved || false,
  });

  const resetBackgroundInputs = () => {
    setLocalBackground('');
    setBackgroundUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRestart = () => {
    setLocation('');
    setScenario('');
    setMood('浪漫');
    setCustomMood('');
    resetBackgroundInputs();
    setShowMenu(false);
    setActiveSceneSession(null);
    setSceneStartToken(0);
  };

  const handleSaveAndExit = () => {
    const savedSession: RecoverableDateSession = {
      ...buildSession(),
      isSaved: true,
      status: 'active',
      endedAt: undefined,
    };
    onSaveDate(savedSession);
    setShowMenu(false);
    setActiveSceneSession(null);
    setSceneStartToken(0);
    onClose();
  };

  const handleDirectExit = () => {
    setShowMenu(false);
    setActiveSceneSession(null);
    setSceneStartToken(0);
    onClose();
  };

  const handleConfirmPlan = () => {
    const nextSession: RecoverableDateSession = {
      ...buildSession(),
      isSaved: false,
      status: 'active',
      endedAt: undefined,
    };
    setShowMenu(false);
    setActiveSceneSession(nextSession);
    setSceneStartToken(Date.now());
  };

  const handleLocalBackgroundChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = '';
      return;
    }

    const nextValue = await setUploadedFile(file);
    setLocalBackground(nextValue);
    event.target.value = '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 bg-[#f6f6f7] text-zinc-900">
          {activeSceneSession ? (
            <DatingScene
              session={activeSceneSession}
              startToken={sceneStartToken}
              character={character}
              userProfile={userProfile}
              activeConfig={activeConfig}
              chatHistory={chatHistory}
              perception={perception}
              onBackToPlanner={handleDirectExit}
              onClose={handleDirectExit}
              onSaveDate={(session) => {
                setActiveSceneSession(session);
                onSaveDate(session);
              }}
              onCollectDate={onCollectDate}
              onEndDateComplete={onEndDateComplete}
            />
          ) : null}

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`relative flex h-full w-full flex-col ${activeSceneSession ? 'hidden' : ''}`}
          >
            <header className="flex items-center justify-between border-b border-zinc-200/70 bg-white/95 px-4 pt-6 pb-3 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDirectExit}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 transition-colors hover:bg-zinc-200"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-zinc-900 shadow-sm">
                  <Coffee size={18} />
                </div>
                <div>
                  <h2 className="text-[19px] font-bold tracking-tight text-zinc-900">策划约会</h2>
                  <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">先设定这次约会的场景与背景</p>
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu(prev => !prev)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm transition-colors hover:text-zinc-800"
                >
                  <MoreVertical size={18} />
                </button>

                <AnimatePresence>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -6 }}
                        className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-[20px] border border-zinc-100 bg-white shadow-[0_16px_36px_rgba(0,0,0,0.12)]"
                      >
                        <button
                          type="button"
                          onClick={handleRestart}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] text-zinc-700 transition-colors hover:bg-zinc-50"
                        >
                          <RefreshCw size={16} />
                          重启约会
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAndExit}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] text-zinc-700 transition-colors hover:bg-zinc-50"
                        >
                          <Save size={16} />
                          保存并退出
                        </button>
                        <div className="h-px bg-zinc-100" />
                        <button
                          type="button"
                          onClick={handleDirectExit}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] text-red-500 transition-colors hover:bg-red-50"
                        >
                          <LogOut size={16} />
                          直接退出
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-24">
              <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-4">
                <section className="border-b border-zinc-200/80 pb-4">
                  <div className="flex items-center gap-3">
                    {resolvedCharacterAvatarUrl ? (
                      <img
                        src={resolvedCharacterAvatarUrl}
                        alt={character.name}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-zinc-200"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-2xl bg-zinc-100 ring-1 ring-zinc-200" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[16px] font-semibold text-zinc-900">{character.name}</h3>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-500">
                        {character.signature || buildCharacterContext({ character }).corePersona || '给这次约会先定下一个适合你们的开场。'}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-zinc-700">
                      <MapPin size={16} className="text-zinc-400" />
                      约会地点
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {LOCATION_OPTIONS.map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setLocation(option)}
                          className={`rounded-[15px] border px-3 py-3 text-center text-[14px] transition-all ${
                            location === option
                              ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <input
                      value={location}
                      onChange={event => setLocation(event.target.value)}
                      placeholder="或输入自定义地点..."
                      className="mt-2.5 h-12 w-full rounded-[16px] border border-zinc-200 bg-white px-4 text-[14px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-zinc-700">
                      <Calendar size={16} className="text-zinc-400" />
                      约会情景
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {SCENARIO_OPTIONS.map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setScenario(option)}
                          className={`rounded-[14px] border px-4 py-2.5 text-[14px] transition-all ${
                            scenario === option
                              ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <input
                      value={scenario}
                      onChange={event => setScenario(event.target.value)}
                      placeholder="或输入自定义情景..."
                      className="mt-2.5 h-12 w-full rounded-[16px] border border-zinc-200 bg-white px-4 text-[14px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-zinc-700">
                      <Sparkles size={16} className="text-zinc-400" />
                      氛围
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {MOOD_OPTIONS.map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setMood(option)}
                          className={`rounded-[14px] px-4 py-2.5 text-[14px] transition-all ${
                            mood === option
                              ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <input
                      value={customMood}
                      onChange={event => setCustomMood(event.target.value)}
                      placeholder="或输入自定义氛围..."
                      className="mt-2.5 h-12 w-full rounded-[16px] border border-zinc-200 bg-white px-4 text-[14px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                    />
                  </div>
                </section>

                <section className="border-t border-zinc-200/80 pt-4">
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-zinc-700">
                    <ImagePlus size={16} className="text-zinc-400" />
                    本次约会背景
                  </div>

                  <div className="overflow-hidden rounded-[18px] border border-zinc-200 bg-zinc-100">
                    {(() => {
                      const previewSrc =
                        getDisplayableAssetValue(resolvedBackground.image, resolvedPreviewBackgroundUrl)
                        || getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl);
                      return previewSrc ? <img src={previewSrc} alt="约会背景预览" className="h-28 w-full object-cover" /> : null;
                    })()}
                  </div>

                  <p className="mt-2 text-[12px] leading-5 text-zinc-500">
                    本地上传优先，其次使用图片链接；如果都没设置，后续正式约会页会默认使用当前角色头像作为背景。
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-zinc-200 bg-zinc-100 px-3.5 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
                    >
                      <ImagePlus size={14} />
                      上传本地图片
                    </button>
                    <button
                      type="button"
                      onClick={resetBackgroundInputs}
                      className="inline-flex h-10 items-center justify-center rounded-[14px] bg-zinc-100 px-3.5 text-[13px] font-medium text-zinc-700"
                    >
                      恢复角色头像
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLocalBackgroundChange}
                    />
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-[12px] font-medium text-zinc-600">
                    <Link2 size={14} className="text-zinc-400" />
                    图片链接
                  </label>
                  <input
                    value={backgroundUrl}
                    onChange={event => setBackgroundUrl(event.target.value)}
                    placeholder="粘贴图片 URL、Markdown 或 HTML 图片地址..."
                    className="mt-2 h-11 w-full rounded-[15px] border border-zinc-200 bg-white px-4 text-[13px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                  />
                  <p className="mt-1.5 text-[11px] leading-5 text-zinc-400">
                    不按 jpg/png 后缀做死判断，只要最终能作为图片正常加载，就允许使用。
                  </p>
                </section>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 border-t border-zinc-200/70 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <button
                type="button"
                onClick={handleConfirmPlan}
                disabled={!location.trim() || !scenario.trim()}
                className={`h-12 w-full rounded-[16px] text-[15px] font-semibold transition-all ${
                  location.trim() && scenario.trim()
                    ? 'border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm hover:bg-zinc-200'
                    : 'bg-zinc-200 text-zinc-400'
                }`}
              >
                开始约会
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
