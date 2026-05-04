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
import type {
  ApiConfig,
  Character,
  ChatMessage,
  DateAccentColorMode,
  DateDescriptionDensity,
  DateDialogueFormat,
  DateNarrativePerspective,
  DateWritingReference,
  DateSession,
  DateWritingPreset,
  PerceptionSettings,
  UserProfileExtended,
} from '../../types';
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
const DATING_AUTO_SAVE_KEY = 'dating_modal_auto_save_enabled';

const NARRATIVE_PERSPECTIVE_OPTIONS: Array<{ value: DateNarrativePerspective; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'first', label: '第一人称' },
  { value: 'second', label: '第二人称' },
  { value: 'third', label: '第三人称' },
];

const WRITING_PRESET_OPTIONS: Array<{ value: DateWritingPreset; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'novel', label: '小说感' },
  { value: 'cinematic', label: '电影镜头感' },
  { value: 'tender', label: '细腻暧昧' },
  { value: 'restrained', label: '克制冷感' },
  { value: 'casual', label: '轻松口语' },
  { value: 'tension', label: '拉扯张力' },
];

const WRITING_REFERENCE_OPTIONS: Array<{ value: DateWritingReference; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'jjwxc', label: '晋江感' },
  { value: 'zhihu', label: '知乎文感' },
  { value: 'taiwan-romance', label: '台言感' },
  { value: 'youth-ache', label: '青春疼痛感' },
  { value: 'urban-mature', label: '都市熟龄感' },
  { value: 'light-novel', label: '轻小说感' },
];

const DIALOGUE_FORMAT_OPTIONS: Array<{ value: DateDialogueFormat; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'quoted', label: '对白加 “ ”' },
  { value: 'plain', label: '对白不加引号' },
];

const DESCRIPTION_DENSITY_OPTIONS: Array<{ value: DateDescriptionDensity; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'light', label: '轻' },
  { value: 'medium', label: '中' },
  { value: 'heavy', label: '重' },
];

const ACCENT_COLOR_MODE_OPTIONS: Array<{ value: DateAccentColorMode; label: string }> = [
  { value: 'character', label: '跟随默认' },
  { value: 'random', label: '随机主题色' },
  { value: 'custom', label: '手动指定' },
];

const DATE_ACCENT_PRESETS = [
  '#92EBF2',
  '#FF8FA3',
  '#FFC56B',
  '#B7A7FF',
  '#7FE7C4',
  '#F9A8D4',
  '#9CC7FF',
  '#F7D774',
] as const;

function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#([0-9a-fA-F]{6})$/.test(normalized) ? normalized.toUpperCase() : '';
}

function pickRandomAccentColor(seed = Date.now()): string {
  const index = Math.abs(seed) % DATE_ACCENT_PRESETS.length;
  return DATE_ACCENT_PRESETS[index];
}

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [narrativePerspective, setNarrativePerspective] = useState<DateNarrativePerspective>('default');
  const [writingPreset, setWritingPreset] = useState<DateWritingPreset>('default');
  const [writingReference, setWritingReference] = useState<DateWritingReference>('none');
  const [dialogueFormat, setDialogueFormat] = useState<DateDialogueFormat>('default');
  const [descriptionDensity, setDescriptionDensity] = useState<DateDescriptionDensity>('default');
  const [writingStyleCustom, setWritingStyleCustom] = useState('');
  const [accentColorMode, setAccentColorMode] = useState<DateAccentColorMode>('character');
  const [customAccentColor, setCustomAccentColor] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(DATING_AUTO_SAVE_KEY) === '1';
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setUploadedFile } = usePersistentFieldActions();
  const wasOpenRef = useRef(false);
  const resetDatingScenePresentation = () => {
    if (typeof document === 'undefined') {
      return;
    }

    const phoneContainer = document.getElementById('phone-container');
    const phoneScreenRoot = phoneContainer?.querySelector('.phone-screen-root');

    phoneContainer?.classList.remove('is-dating-scene');
    phoneScreenRoot?.classList.remove('is-dating-scene');
  };
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
      resetDatingScenePresentation();
      return;
    }

    if (!wasOpenRef.current) {
      if (initialSession) {
        setLocation(initialSession.location || '');
        setScenario(initialSession.scenario || '');
        setMood(initialSession.mood || '浪漫');
        setCustomMood('');
        setNarrativePerspective(initialSession.narrativePerspective || 'default');
        setWritingPreset(initialSession.writingPreset || 'default');
        setWritingReference(initialSession.writingReference || 'none');
        setDialogueFormat(initialSession.dialogueFormat || 'default');
        setDescriptionDensity(initialSession.descriptionDensity || 'default');
        setWritingStyleCustom(initialSession.writingStyleCustom || '');
        setAccentColorMode(initialSession.accentColorMode || 'character');
        setCustomAccentColor(initialSession.accentColor || '');
        setLocalBackground(
          initialSession.backgroundSource === 'local-upload' ? initialSession.backgroundImage || '' : '',
        );
        setBackgroundUrl(initialSession.backgroundSource === 'url' ? initialSession.backgroundImage || '' : '');
      } else {
        setLocation('');
        setScenario('');
        setMood('浪漫');
        setCustomMood('');
        setNarrativePerspective('default');
        setWritingPreset('default');
        setWritingReference('none');
        setDialogueFormat('default');
        setDescriptionDensity('default');
        setWritingStyleCustom('');
        setAccentColorMode('character');
        setCustomAccentColor('');
        setLocalBackground('');
        setBackgroundUrl('');
      }

      setShowMenu(false);
      setActiveSceneSession(shouldResumeSavedScene ? recoverableInitialSession : null);
      setSceneStartToken(0);
      wasOpenRef.current = true;
    }
  }, [character.id, initialSession, isOpen, recoverableInitialSession, shouldResumeSavedScene]);

  useEffect(() => {
    return () => {
      resetDatingScenePresentation();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DATING_AUTO_SAVE_KEY, autoSaveEnabled ? '1' : '0');
  }, [autoSaveEnabled]);

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

  const resolveSessionAccent = () => {
    const normalizedCustomAccent = normalizeHexColor(customAccentColor);
    const normalizedExistingAccent = normalizeHexColor(recoverableInitialSession?.accentColor || '');

    if (accentColorMode === 'custom') {
      return normalizedCustomAccent || normalizedExistingAccent || DATE_ACCENT_PRESETS[0];
    }

    if (accentColorMode === 'random') {
      return normalizedExistingAccent || pickRandomAccentColor(Date.now());
    }

    return normalizedExistingAccent;
  };

  const buildSession = (): RecoverableDateSession => ({
    id: initialSession?.id || Date.now().toString(),
    characterId: character.id,
    location,
    scenario,
    mood: customMood.trim() || mood,
    narrativePerspective,
    writingPreset,
    writingReference,
    dialogueFormat,
    descriptionDensity,
    writingStyleCustom: writingStyleCustom.trim(),
    accentColorMode,
    accentColor: resolveSessionAccent(),
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
    setNarrativePerspective('default');
    setWritingPreset('default');
    setDialogueFormat('default');
    setDescriptionDensity('default');
    setWritingStyleCustom('');
    setAccentColorMode('character');
    setCustomAccentColor('');
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
              autoSaveEnabled={autoSaveEnabled}
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
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(prev => !prev)}
                    className="flex w-full items-center justify-between rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-left"
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-zinc-800">高级设置</div>
                      <div className="mt-1 text-[11px] text-zinc-500">自动保存约会进度等功能</div>
                    </div>
                    <div className="text-[12px] text-zinc-500">{advancedOpen ? '收起' : '展开'}</div>
                  </button>

                  {advancedOpen ? (
                    <div className="mt-3 rounded-[18px] border border-zinc-200 bg-white px-4 py-4">
                      <div className="space-y-4">
                        <div className="rounded-[16px] bg-zinc-50 px-3.5 py-3">
                          <div className="text-[12px] leading-5 text-zinc-500">
                            不设置时保持当前默认效果；只有你手动指定后，才会覆盖本次约会的视角、文风或高亮色。
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1.5 text-[12px] text-zinc-500">
                            叙事视角
                            <select
                              value={narrativePerspective}
                              onChange={(event) => setNarrativePerspective(event.target.value as DateNarrativePerspective)}
                              className="h-11 rounded-[14px] border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400"
                            >
                              {NARRATIVE_PERSPECTIVE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1.5 text-[12px] text-zinc-500">
                            文风预设
                            <select
                              value={writingPreset}
                              onChange={(event) => setWritingPreset(event.target.value as DateWritingPreset)}
                              className="h-11 rounded-[14px] border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400"
                            >
                              {WRITING_PRESET_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1.5 text-[12px] text-zinc-500">
                            风格参考
                            <select
                              value={writingReference}
                              onChange={(event) => setWritingReference(event.target.value as DateWritingReference)}
                              className="h-11 rounded-[14px] border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400"
                            >
                              {WRITING_REFERENCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1.5 text-[12px] text-zinc-500">
                            对白格式
                            <select
                              value={dialogueFormat}
                              onChange={(event) => setDialogueFormat(event.target.value as DateDialogueFormat)}
                              className="h-11 rounded-[14px] border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400"
                            >
                              {DIALOGUE_FORMAT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1.5 text-[12px] text-zinc-500">
                            描写浓度
                            <select
                              value={descriptionDensity}
                              onChange={(event) => setDescriptionDensity(event.target.value as DateDescriptionDensity)}
                              className="h-11 rounded-[14px] border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400"
                            >
                              {DESCRIPTION_DENSITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="flex flex-col gap-1.5 text-[12px] text-zinc-500">
                          自定义文风
                          <textarea
                            value={writingStyleCustom}
                            onChange={(event) => setWritingStyleCustom(event.target.value.slice(0, 240))}
                            placeholder="例如：偏晋江感，人物对白加“”，多写眼神和停顿，少一点解释感。"
                            className="min-h-[108px] rounded-[16px] border border-zinc-200 bg-white px-3 py-3 text-[13px] leading-6 text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400 resize-none"
                          />
                          <span className="text-right text-[11px] text-zinc-400">{writingStyleCustom.length}/240</span>
                        </label>

                        <div className="space-y-3 rounded-[16px] border border-zinc-200 px-3.5 py-3">
                          <label className="flex flex-col gap-1.5 text-[12px] text-zinc-500">
                            本次约会主题色
                            <select
                              value={accentColorMode}
                              onChange={(event) => setAccentColorMode(event.target.value as DateAccentColorMode)}
                              className="h-11 rounded-[14px] border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400"
                            >
                              {ACCENT_COLOR_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          {accentColorMode === 'custom' ? (
                            <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                              <input
                                type="color"
                                value={normalizeHexColor(customAccentColor) || DATE_ACCENT_PRESETS[0]}
                                onChange={(event) => setCustomAccentColor(event.target.value.toUpperCase())}
                                className="h-11 w-full rounded-[14px] border border-zinc-200 bg-white px-1 py-1"
                              />
                              <input
                                value={customAccentColor}
                                onChange={(event) => setCustomAccentColor(event.target.value)}
                                placeholder="#FF8FA3"
                                className="h-11 rounded-[14px] border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                              />
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {DATE_ACCENT_PRESETS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => {
                                  setAccentColorMode('custom');
                                  setCustomAccentColor(color);
                                }}
                                className="h-8 w-8 rounded-full border border-white shadow-sm ring-1 ring-zinc-200"
                                style={{ backgroundColor: color }}
                                aria-label={`选择主题色 ${color}`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-start justify-between gap-4 border-t border-zinc-100 pt-1">
                        <div>
                          <div className="text-[13px] font-semibold text-zinc-800">自动保存约会进度</div>
                          <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                            开启后，约会每一轮生成后都会自动保存当前进度；结束约会后，下次仍会正常开启新的约会。
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAutoSaveEnabled(prev => !prev)}
                          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${autoSaveEnabled ? 'bg-zinc-900' : 'bg-zinc-300'}`}
                          aria-pressed={autoSaveEnabled}
                        >
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${autoSaveEnabled ? 'left-6' : 'left-1'}`}
                          />
                        </button>
                      </div>
                    </div>
                    </div>
                  ) : null}
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
