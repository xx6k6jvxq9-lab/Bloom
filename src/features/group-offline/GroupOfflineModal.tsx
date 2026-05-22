import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Dices,
  MapPin,
  Palette,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import type {
  ApiConfig,
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  DateDescriptionDensity,
  DateDialogueFormat,
  DateNarrativePerspective,
  DateWritingPreset,
  DateWritingReference,
  GroupOfflineMode,
  GroupOfflineMemoryWritebackPolicy,
  GroupOfflineRecruitResponseRecord,
  GroupOfflineRecruitDraft,
  GroupOfflineSession,
  PerceptionSettings,
  WorldBookEntry,
} from '../../types';
import { GroupOfflineScene } from './GroupOfflineScene';
import { ResolvedOfflineAvatar } from './ResolvedOfflineAvatar';
import {
  DEFAULT_GROUP_OFFLINE_BODY_TEXT_COLOR,
  DEFAULT_GROUP_OFFLINE_HIGHLIGHT_COLOR,
  GROUP_OFFLINE_BODY_TEXT_COLOR_OPTIONS,
  GROUP_OFFLINE_HIGHLIGHT_COLOR_OPTIONS,
} from './colorOptions';
import {
  createGroupOfflineSessionId,
  createGroupOfflineRecruitMessage,
  createGroupOfflineStartMessage,
} from './sessionUtils';
import {
  buildGroupOfflineScenarioState,
  getGroupOfflineScenarioBlueprint,
  isGroupOfflineScenarioType,
} from '../../services/group-offline/scenarioTasks';
import {
  buildGroupOfflineWorldBookSnapshot,
  resolveGroupOfflineWorldBookSnapshot,
} from '../../services/group-offline/worldBookSnapshot';
import {
  buildGroupOfflineRecruitStatusSummary,
  normalizeGroupOfflineRecruitResponses,
} from '../../services/group-offline/recruitState';

type GroupOfflineModalProps = {
  isOpen: boolean;
  group: ChatGroup;
  members: Character[];
  inviteableCharacters: Character[];
  userName: string;
  activeConfig: ApiConfig | null;
  activeWorldBooks?: WorldBookEntry[];
  history: ChatMessage[];
  directChatHistory?: ChatHistory;
  perception?: PerceptionSettings;
  initialSession?: GroupOfflineSession | null;
  initialDraft?: GroupOfflineRecruitDraft | null;
  onClose: () => void;
  onSessionStart: (session: GroupOfflineSession, startMessage: ChatMessage) => void;
  onSessionUpdate: (session: GroupOfflineSession | null) => void;
  onPublishRecruitCard: (draft: GroupOfflineRecruitDraft, cardMessage: ChatMessage) => void;
  onRecruitDraftUpdate: (draft: GroupOfflineRecruitDraft) => void;
  onContinueRecruitRound?: (draft: GroupOfflineRecruitDraft) => void;
  onSessionComplete: (payload: {
    archivedSession: GroupOfflineSession;
    endMessage: ChatMessage;
    followupMessages: ChatMessage[];
  }) => void;
};

type ExpandableFieldKey =
  | 'custom_activity'
  | 'scene_prompt'
  | 'scenario_story_source'
  | 'scenario_user_hook'
  | 'scenario_mission_object'
  | 'scenario_identity_pair'
  | 'scenario_rescue_target'
  | 'scenario_handoff_or_exit'
  | 'scenario_failure_condition'
  | 'scenario_task'
  | 'location'
  | 'time'
  | 'weather'
  | 'vibe'
  | 'writing_style'
  | 'max_chars';

type ActivityOption = {
  value: string;
  label: string;
};

const MODE_OPTIONS: Array<{ value: GroupOfflineMode; label: string; caption: string }> = [
  { value: 'daily', label: '日常', caption: '熟人现场，关系流动。' },
  { value: 'scenario', label: '设定', caption: 'AI 生成规则和任务。' },
  { value: 'random', label: '盲开', caption: '主题和推进随机落地。' },
];

const DAILY_ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: '深夜续摊', label: '深夜续摊' },
  { value: '咖啡碰面', label: '咖啡碰面' },
  { value: '包厢夜场', label: '包厢夜场' },
  { value: '夜路散心', label: '夜路散心' },
  { value: '庆生名场', label: '庆生名场' },
  { value: '看展同行', label: '看展同行' },
  { value: '车里多待会', label: '车里多待会' },
  { value: '凌晨便利店', label: '凌晨便利店' },
];

const SCENARIO_ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: '临时同盟', label: '临时同盟' },
  { value: '倒计时任务', label: '倒计时任务' },
  { value: '身份错位', label: '身份错位' },
  { value: '穿越落点', label: '穿越落点' },
  { value: '盲盒任务', label: '盲盒任务' },
  { value: '世界故障', label: '世界故障' },
  { value: '密室未退场', label: '密室未退场' },
  { value: '临时营救', label: '临时营救' },
];

const RANDOM_ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: '完全盲开', label: '完全盲开' },
  { value: '偏群像', label: '偏群像' },
  { value: '偏关系戏', label: '偏关系戏' },
  { value: '偏任务感', label: '偏任务感' },
];

const VIBE_OPTIONS = [
  '慢热开场',
  '暗流浮面',
  '起哄好笑',
  '各怀心事',
  '越聊越乱',
  '一触即燃',
];

const SCENE_DETAIL_FIELD_KEYS: ExpandableFieldKey[] = [
  'custom_activity',
  'scene_prompt',
  'scenario_story_source',
  'scenario_user_hook',
  'scenario_mission_object',
  'scenario_identity_pair',
  'scenario_rescue_target',
  'scenario_handoff_or_exit',
  'scenario_failure_condition',
  'scenario_task',
  'location',
  'time',
  'weather',
];

const WRITING_FIELD_KEYS: ExpandableFieldKey[] = [
  'max_chars',
  'writing_style',
];

const PARTICIPANT_FIELD_KEYS: ExpandableFieldKey[] = [
  'vibe',
];

const WRITING_PRESET_OPTIONS: Array<{ value: DateWritingPreset; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'cinematic', label: '电影镜头感' },
  { value: 'novel', label: '小说感' },
  { value: 'tender', label: '细腻拉扯' },
  { value: 'casual', label: '轻口语' },
  { value: 'tension', label: '张力' },
];

const PERSPECTIVE_OPTIONS: Array<{ value: DateNarrativePerspective; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'first', label: '第一人称' },
  { value: 'second', label: '第二人称' },
  { value: 'third', label: '第三人称' },
];

const WRITING_REFERENCE_OPTIONS: Array<{ value: DateWritingReference; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'jjwxc', label: '晋江感' },
  { value: 'zhihu', label: '知乎文感' },
  { value: 'light-novel', label: '轻小说感' },
];

const DIALOGUE_FORMAT_OPTIONS: Array<{ value: DateDialogueFormat; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'quoted', label: '带引号' },
  { value: 'plain', label: '无引号' },
];

const DESCRIPTION_DENSITY_OPTIONS: Array<{ value: DateDescriptionDensity; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'light', label: '轻' },
  { value: 'medium', label: '中' },
  { value: 'heavy', label: '重' },
];

const RANDOM_POOLS = {
  location: {
    daily: [
      '街角小馆',
      '便利店门口',
      '靠窗咖啡店',
      '夜市边摊',
      '城市天桥下',
      '展厅出口',
      '旧商场顶楼',
      '街边甜品店',
      '地铁站外长椅',
      '安静书店二层',
      '停车场出口',
      '深夜便利店后街',
    ],
    scenario: [
      '失控站台',
      '临时安全屋',
      '旧影院楼上',
      '雨夜港口',
      '折叠走廊尽头',
      '未命名中转点',
      '废弃讯号塔下',
      '封锁区边缘',
      '临时任务点',
      '高架桥阴影里',
      '旧城区地下入口',
      '世界缝隙落点',
    ],
    random: [
      '今晚会出事的地方',
      '还没人想好名字的角落',
      '临时被选中的碰头点',
      '说不上安全的地方',
      '看起来像巧合的地点',
      '谁都不该碰面的地方',
      '刚好能让气氛变掉的角落',
      '离散场还很远的地方',
    ],
  },
  scene: {
    daily: [
      '刚下过雨，店里只剩靠窗的位置。',
      '人声不算吵，但谁先接谁的话会被看得很清楚。',
      '场子看起来轻松，实际上每个人都在等第一句。',
      '音乐压得不高，刚好够把有些停顿衬得更明显。',
      '桌上的东西还没摆满，谁要坐哪里却已经快定下来了。',
      '灯光太柔，反而让每个人的视线都显得有点直白。',
      '明明只是普通碰面，但空气里已经先有了谁都不肯承认的偏向。',
      '看起来像一次随手约出来的见面，实际上谁都没那么随便。',
    ],
    scenario: [
      '上一层副本刚关门，新的落点就把所有人一起甩进了现场。',
      '错误身份和旧规则一起落下来，谁先认出这场局的来源，谁就能先活一步。',
      '这不是普通碰面，而像被临时抽中的支线副本，所有人都被迫带着任务进场。',
      '倒计时还没亮到台面上，但那种“再慢一步就会出事”的压迫已经贴到后颈。',
      '像是快穿里被塞进了错误剧本，表面身份还能用，真正的来历却已经对不上了。',
      '入口已经在身后合上了，现场看似平静，实际每一条规则都像在等人踩错。',
      '任务不是突然出现的，是有人先把旧记录改了，才把这场局重新推开。',
      '每个人都像带着半截前情掉进来，剩下那半截要靠今晚把真相一点点掀出来。',
    ],
    random: [
      '空气里像是藏着一条还没被点明的暗线。',
      '今晚的场面不是安静，是还没决定先往哪边偏。',
      '人和环境都已经到位，真正的推进只差一句话。',
      '看似没什么特别，但每个人都像比平时更难随便敷衍过去。',
      '谁都没有急着动，可那种“迟早会有事发生”的感觉已经很明显。',
      '这地方本身没什么问题，问题是偏偏这几个人今晚都在这里。',
      '局面暂时还稳着，但只要有谁先伸手，整场就会换味道。',
      '有些东西还没被说出来，反而让所有细节都显得更重。',
    ],
  },
  weather: {
    daily: [
      '晚风轻 / 氛围刚刚好',
      '夜色平稳 / 店里很暖',
      '城市灯光太近 / 所有人都显得清醒',
      '雨后偏凉 / 说话时呼吸都能被注意到',
      '天色压低 / 但店里亮得有点过分',
      '夜风不大 / 只是每个人都比平时更在意细节',
    ],
    scenario: [
      '局势未明 / 暗流初起',
      '规则生效中 / 现场温度偏低',
      '信号不稳 / 空气像被什么压住',
      '倒计时未显现 / 每个人都已经先紧起来了',
      '环境稳定 / 但不代表安全',
      '所有异常都还没爆开 / 只是先藏在表面下面',
    ],
    random: [
      '空气里像要发生点什么',
      '今晚的风向很会挑事',
      '一切都还没落定',
      '表面平静 / 实际很难装作无事发生',
      '夜色偏静 / 人心不太静',
      '环境没有问题 / 人与人之间的问题比较大',
    ],
  },
} as const;

const RANDOM_TIME_OPTIONS = [
  '今晚 19:40',
  '今晚 20:15',
  '今晚 21:05',
  '明晚 19:20',
  '周五 20:30',
  '周六 18:50',
  '今晚 22:10',
  '周三 19:05',
  '周日 17:40',
  '明晚 21:20',
  '周六 20:05',
  '今晚 18:35',
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeGroupOfflineMode(value: unknown): GroupOfflineMode {
  return value === 'scenario' || value === 'random' || value === 'daily'
    ? value
    : 'daily';
}

function pickRandomLocation(mode: GroupOfflineMode | undefined): string {
  const normalizedMode = normalizeGroupOfflineMode(mode);
  return pickRandom(RANDOM_POOLS.location[normalizedMode] || RANDOM_POOLS.location.daily);
}

function pickRandomScene(mode: GroupOfflineMode | undefined): string {
  const normalizedMode = normalizeGroupOfflineMode(mode);
  return pickRandom(RANDOM_POOLS.scene[normalizedMode] || RANDOM_POOLS.scene.daily);
}

function pickRandomWeather(mode: GroupOfflineMode | undefined): string {
  const normalizedMode = normalizeGroupOfflineMode(mode);
  return pickRandom(RANDOM_POOLS.weather[normalizedMode] || RANDOM_POOLS.weather.daily);
}

function pickRandomTimeLabel(): string {
  return pickRandom(RANDOM_TIME_OPTIONS);
}

function activityOptionsByMode(mode: GroupOfflineMode | undefined): ActivityOption[] {
  const normalizedMode = normalizeGroupOfflineMode(mode);
  if (normalizedMode === 'scenario') return SCENARIO_ACTIVITY_OPTIONS;
  if (normalizedMode === 'random') return RANDOM_ACTIVITY_OPTIONS;
  return DAILY_ACTIVITY_OPTIONS;
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function dedupeIds(ids: string[] | undefined): string[] {
  return Array.from(new Set((ids || []).filter((id) => typeof id === 'string' && id.trim().length > 0)));
}

function sameIds(left: string[] | undefined, right: string[] | undefined): boolean {
  const normalizedLeft = dedupeIds(left);
  const normalizedRight = dedupeIds(right);
  return (
    normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((id, index) => id === normalizedRight[index])
  );
}

function buildRecruitDraftSnapshotKey(draft: GroupOfflineRecruitDraft | null | undefined): string {
  if (!draft) {
    return '';
  }

  return JSON.stringify({
    createdAt: draft.createdAt,
    recruitCardSessionId: safeText(draft.recruitCardSessionId),
    title: draft.title,
    mode: draft.mode,
    activityType: draft.activityType,
    customActivityType: safeText(draft.customActivityType),
    location: draft.location,
    scenePrompt: safeText(draft.scenePrompt),
    timeLabel: draft.timeLabel,
    weatherLabel: draft.weatherLabel,
    vibe: draft.vibe,
    selectedParticipantIds: dedupeIds(draft.selectedParticipantIds),
    participantLabels: dedupeIds(draft.participantLabels),
    recruitResponses: normalizeGroupOfflineRecruitResponses(draft.recruitResponses).map((item) => ({
      characterId: item.characterId,
      decision: item.decision,
      text: item.text,
      respondedAt: item.respondedAt,
    })),
    signedUpParticipantIds: dedupeIds(draft.signedUpParticipantIds),
    confirmedParticipantIds: dedupeIds(draft.confirmedParticipantIds),
    rosterLockedAt: draft.rosterLockedAt ?? null,
    maxGeneratedChars: draft.maxGeneratedChars ?? null,
    roundLimit: draft.roundLimit ?? null,
    directorInstruction: safeText(draft.directorInstruction),
  });
}

function FieldShell(props: {
  label: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`block ${props.className || ''}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[12px] font-medium text-zinc-500">{props.label}</div>
        {props.action}
      </div>
      {props.children}
    </div>
  );
}

function RandomMiniButton(props: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600"
    >
      <Dices size={11} />
      {props.label || '随机'}
    </button>
  );
}

function ExpandableField(props: {
  label: ReactNode;
  value: string;
  placeholder: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  action?: ReactNode;
  multiline?: boolean;
  rows?: number;
  className?: string;
}) {
  const extraAction = (
    <div className="flex items-center gap-2">
      {props.action}
      {props.expanded ? (
        <button
          type="button"
          onClick={props.onToggle}
          className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600"
        >
          收起
        </button>
      ) : null}
    </div>
  );

  return (
    <FieldShell label={props.label} action={extraAction} className={props.className}>
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className={`overflow-hidden rounded-[20px] border border-zinc-200 bg-white ${
          props.expanded ? 'shadow-[0_8px_22px_rgba(15,23,42,0.06)]' : ''
        }`}
      >
        {!props.expanded ? (
          <button
            type="button"
            onClick={props.onToggle}
            className="w-full px-4 py-3 text-left text-[14px] leading-7 text-zinc-900 transition hover:bg-zinc-50"
          >
            <span className={safeText(props.value).trim() ? 'text-zinc-900' : 'text-zinc-400'}>
              {safeText(props.value).trim() || props.placeholder}
            </span>
          </button>
        ) : (
          <div className="px-3 py-3">
            {props.multiline ? (
              <textarea
                autoFocus
                value={safeText(props.value)}
                onChange={(event) => props.onChange(event.target.value)}
                rows={props.rows || 6}
                placeholder={props.placeholder}
                className="min-h-[150px] w-full resize-none rounded-[16px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] leading-7 text-zinc-900 outline-none focus:border-zinc-400"
              />
            ) : (
              <input
                autoFocus
                value={safeText(props.value)}
                onChange={(event) => props.onChange(event.target.value)}
                placeholder={props.placeholder}
                className="h-14 w-full rounded-[16px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] leading-7 text-zinc-900 outline-none focus:border-zinc-400"
              />
            )}
          </div>
        )}
      </motion.div>
    </FieldShell>
  );
}

function CollapsibleSection(props: {
  title: ReactNode;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={props.onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-zinc-900">{props.title}</div>
          <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-500">{props.summary}</div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-400 transition-transform ${props.open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {props.open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-100"
          >
            <div className="space-y-4 px-4 py-4">
              {props.children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export const GroupOfflineModal: React.FC<GroupOfflineModalProps> = ({
  isOpen,
  group,
  members,
  inviteableCharacters,
  userName,
  activeConfig,
  activeWorldBooks = [],
  history,
  directChatHistory,
  perception,
  initialSession,
  initialDraft,
  onClose,
  onSessionStart,
  onSessionUpdate,
  onPublishRecruitCard,
  onRecruitDraftUpdate,
  onContinueRecruitRound,
  onSessionComplete,
}) => {
  const initializationKeyRef = useRef('closed');
  const [mode, setMode] = useState<GroupOfflineMode>('daily');
  const [activityType, setActivityType] = useState(activityOptionsByMode('daily')[0]?.value || '');
  const [customActivityType, setCustomActivityType] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [scenarioStorySourcePrompt, setScenarioStorySourcePrompt] = useState('');
  const [scenarioUserHookPrompt, setScenarioUserHookPrompt] = useState('');
  const [scenarioMissionObjectPrompt, setScenarioMissionObjectPrompt] = useState('');
  const [scenarioIdentityPairPrompt, setScenarioIdentityPairPrompt] = useState('');
  const [scenarioRescueTargetPrompt, setScenarioRescueTargetPrompt] = useState('');
  const [scenarioHandoffOrExitPrompt, setScenarioHandoffOrExitPrompt] = useState('');
  const [scenarioFailureConditionPrompt, setScenarioFailureConditionPrompt] = useState('');
  const [scenarioTaskPrompt, setScenarioTaskPrompt] = useState('');
  const [recruitResponses, setRecruitResponses] = useState<GroupOfflineRecruitResponseRecord[]>([]);
  const [signedUpParticipantIds, setSignedUpParticipantIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [timeLabel, setTimeLabel] = useState('');
  const [weatherLabel, setWeatherLabel] = useState('');
  const [vibe, setVibe] = useState(VIBE_OPTIONS[0]);
  const [highlightColor, setHighlightColor] = useState(DEFAULT_GROUP_OFFLINE_HIGHLIGHT_COLOR);
  const [bodyTextColor, setBodyTextColor] = useState(DEFAULT_GROUP_OFFLINE_BODY_TEXT_COLOR);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [sceneDetailsOpen, setSceneDetailsOpen] = useState(false);
  const [participantSettingsOpen, setParticipantSettingsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedField, setExpandedField] = useState<ExpandableFieldKey | null>(null);
  const [narrativePerspective, setNarrativePerspective] = useState<DateNarrativePerspective>('default');
  const [writingPreset, setWritingPreset] = useState<DateWritingPreset>('default');
  const [writingReference, setWritingReference] = useState<DateWritingReference>('none');
  const [dialogueFormat, setDialogueFormat] = useState<DateDialogueFormat>('default');
  const [descriptionDensity, setDescriptionDensity] = useState<DateDescriptionDensity>('default');
  const [writingStyleCustom, setWritingStyleCustom] = useState('');
  const [maxGeneratedChars, setMaxGeneratedChars] = useState('800');
  const [showScene, setShowScene] = useState(false);
  const [currentSession, setCurrentSession] = useState<GroupOfflineSession | null>(null);
  const [directorLaunchToken, setDirectorLaunchToken] = useState(0);
  const [initialDirectorSection, setInitialDirectorSection] = useState<'instruction' | undefined>(undefined);
  const lastRecruitDraftSnapshotRef = useRef('');

  const activityOptions = useMemo(() => activityOptionsByMode(mode), [mode]);
  const selectedScenarioBlueprint = useMemo(() => (
    mode === 'scenario' && isGroupOfflineScenarioType(activityType)
      ? getGroupOfflineScenarioBlueprint(activityType)
      : null
  ), [activityType, mode]);
  const sceneMemberPool = useMemo(() => {
    const map = new Map<string, Character>();
    [...members, ...inviteableCharacters].forEach((character) => {
      map.set(character.id, character);
    });
    return Array.from(map.values());
  }, [inviteableCharacters, members]);
  const isRecruitDraftFlow = Boolean(initialDraft && !initialSession);
  const recruitCandidateIds = useMemo(() => (
    selectedParticipantIds.length > 0
      ? selectedParticipantIds
      : sceneMemberPool.map((member) => member.id)
  ), [sceneMemberPool, selectedParticipantIds]);
  const recruitSignedUpIds = useMemo(
    () => dedupeIds(signedUpParticipantIds).filter((id) => recruitCandidateIds.includes(id)),
    [recruitCandidateIds, signedUpParticipantIds],
  );
  const recruitResponseByCharacterId = useMemo(
    () => new Map(normalizeGroupOfflineRecruitResponses(recruitResponses).map((item) => [item.characterId, item] as const)),
    [recruitResponses],
  );
  const recruitStatusSummary = useMemo(
    () => buildGroupOfflineRecruitStatusSummary({
      draft: {
        selectedParticipantIds: recruitCandidateIds,
        signedUpParticipantIds: recruitSignedUpIds,
        recruitResponses,
      } as Pick<GroupOfflineRecruitDraft, 'selectedParticipantIds' | 'signedUpParticipantIds' | 'recruitResponses'>,
      fallbackCandidateIds: recruitCandidateIds,
      members: sceneMemberPool,
    }),
    [recruitCandidateIds, recruitResponses, recruitSignedUpIds, sceneMemberPool],
  );
  const recruitPendingIds = recruitStatusSummary.pendingIds;

  useEffect(() => {
    const initializationKey = isOpen
      ? `${group.id}:${initialSession?.id || 'none'}:${initialDraft?.createdAt || 'none'}`
      : 'closed';

    if (!isOpen) {
      initializationKeyRef.current = initializationKey;
      setShowScene(false);
      setCurrentSession(null);
      setDirectorLaunchToken(0);
      setInitialDirectorSection(undefined);
      setRecruitResponses([]);
      setSignedUpParticipantIds([]);
      lastRecruitDraftSnapshotRef.current = '';
      setExpandedField(null);
      setSceneDetailsOpen(false);
      setParticipantSettingsOpen(false);
      setAdvancedOpen(false);
      return;
    }

    if (initializationKeyRef.current === initializationKey) {
      return;
    }
    initializationKeyRef.current = initializationKey;

    if (initialSession) {
      const resumedParticipantNames = initialSession.participants
        .map((participant) => sceneMemberPool.find((member) => member.id === participant.characterId))
        .filter((member): member is Character => !!member)
        .map((member) => member.remarkName?.trim() || member.name);
      const resumedScenarioState = (
        initialSession.mode === 'scenario'
        && !initialSession.scenarioState
        && isGroupOfflineScenarioType(initialSession.activityType)
      )
        ? buildGroupOfflineScenarioState({
            type: initialSession.activityType,
            scenePrompt: initialSession.scenePrompt,
            userName,
            location: initialSession.location,
            weatherLabel: initialSession.weatherLabel,
            vibe: initialSession.vibe,
            participantNames: resumedParticipantNames,
            seed: initialSession.createdAt,
          })
        : initialSession.scenarioState;
      setCurrentSession({
        ...initialSession,
        generationMode: 'blocks',
        worldBookSnapshot: resolveGroupOfflineWorldBookSnapshot(initialSession, activeWorldBooks),
        ...(resumedScenarioState ? { scenarioState: resumedScenarioState } : {}),
        ...(initialSession.mode === 'scenario'
          && isGroupOfflineScenarioType(initialSession.activityType)
          && !initialSession.roundLimit
          ? { roundLimit: getGroupOfflineScenarioBlueprint(initialSession.activityType).roundLimit }
          : {}),
      });
      setDirectorLaunchToken(initialSession.awaitingDirectorInstruction ? Date.now() : 0);
      setInitialDirectorSection(initialSession.awaitingDirectorInstruction ? 'instruction' : undefined);
      setShowScene(true);
      return;
    }

    if (initialDraft && !initialSession) {
      const draftMode = normalizeGroupOfflineMode(initialDraft.mode);
      const draftParticipantIds = Array.isArray(initialDraft.selectedParticipantIds)
        ? initialDraft.selectedParticipantIds
        : Array.isArray(initialDraft.participantLabels) && initialDraft.participantLabels.length > 0
          ? sceneMemberPool
              .filter((member) => initialDraft.participantLabels.includes(member.remarkName?.trim() || member.name) || initialDraft.participantLabels.includes(member.name))
              .map((member) => member.id)
          : [];
      setMode(draftMode);
      setActivityType(safeText(initialDraft.activityType) || activityOptionsByMode(draftMode)[0]?.value || '');
      setCustomActivityType(safeText(initialDraft.customActivityType));
      setScenePrompt(safeText(initialDraft.scenePrompt));
      setScenarioStorySourcePrompt(safeText(initialDraft.scenarioState?.storySourceLabel));
      setScenarioUserHookPrompt(safeText(initialDraft.scenarioState?.userInvolvementLabel));
      setScenarioMissionObjectPrompt(safeText(initialDraft.scenarioState?.missionObjectLabel));
      setScenarioIdentityPairPrompt(safeText(initialDraft.scenarioState?.identityPairLabel));
      setScenarioRescueTargetPrompt(safeText(initialDraft.scenarioState?.rescueTargetLabel));
      setScenarioHandoffOrExitPrompt(
        safeText(initialDraft.scenarioState?.handoffPointLabel)
        || safeText(initialDraft.scenarioState?.exitMethodLabel),
      );
      setScenarioFailureConditionPrompt(safeText(initialDraft.scenarioState?.failureCondition));
      setScenarioTaskPrompt(safeText(initialDraft.scenarioState?.currentTask));
      const normalizedRecruitResponses = normalizeGroupOfflineRecruitResponses(initialDraft.recruitResponses);
      setRecruitResponses(normalizedRecruitResponses);
      setSignedUpParticipantIds(
        normalizedRecruitResponses.filter((item) => item.decision === 'join').map((item) => item.characterId).length > 0
          ? normalizedRecruitResponses.filter((item) => item.decision === 'join').map((item) => item.characterId)
          : Array.isArray(initialDraft.signedUpParticipantIds) && initialDraft.signedUpParticipantIds.length > 0
          ? initialDraft.signedUpParticipantIds
          : Array.isArray(initialDraft.confirmedParticipantIds)
            ? initialDraft.confirmedParticipantIds
            : [],
      );
      lastRecruitDraftSnapshotRef.current = buildRecruitDraftSnapshotKey(initialDraft);
      setLocation(safeText(initialDraft.location));
      setTimeLabel(safeText(initialDraft.timeLabel));
      setWeatherLabel(safeText(initialDraft.weatherLabel));
      setVibe(safeText(initialDraft.vibe) || VIBE_OPTIONS[0]);
      setHighlightColor(initialDraft.highlightColor || DEFAULT_GROUP_OFFLINE_HIGHLIGHT_COLOR);
      setBodyTextColor(initialDraft.bodyTextColor || DEFAULT_GROUP_OFFLINE_BODY_TEXT_COLOR);
      setSelectedParticipantIds(draftParticipantIds);
      setSceneDetailsOpen(false);
      setParticipantSettingsOpen(false);
      setAdvancedOpen(false);
      setExpandedField(null);
      setNarrativePerspective(initialDraft.narrativePerspective || 'default');
      setWritingPreset(initialDraft.writingPreset || 'default');
      setWritingReference(initialDraft.writingReference || 'none');
      setDialogueFormat(initialDraft.dialogueFormat || 'default');
      setDescriptionDensity(initialDraft.descriptionDensity || 'default');
      setWritingStyleCustom(safeText(initialDraft.writingStyleCustom));
      setMaxGeneratedChars(String(initialDraft.maxGeneratedChars || '800'));
      setDirectorLaunchToken(0);
      setInitialDirectorSection(undefined);
      setShowScene(false);
      setCurrentSession(null);
      return;
    }

    setMode('daily');
    setActivityType(activityOptionsByMode('daily')[0]?.value || '');
    setCustomActivityType('');
    setScenePrompt('');
    setScenarioStorySourcePrompt('');
    setScenarioUserHookPrompt('');
    setScenarioMissionObjectPrompt('');
    setScenarioIdentityPairPrompt('');
    setScenarioRescueTargetPrompt('');
    setScenarioHandoffOrExitPrompt('');
    setScenarioFailureConditionPrompt('');
    setScenarioTaskPrompt('');
    setRecruitResponses([]);
    setSignedUpParticipantIds([]);
    lastRecruitDraftSnapshotRef.current = '';
    setLocation('');
    setTimeLabel('');
    setWeatherLabel('');
    setVibe(VIBE_OPTIONS[0]);
    setHighlightColor(DEFAULT_GROUP_OFFLINE_HIGHLIGHT_COLOR);
    setBodyTextColor(DEFAULT_GROUP_OFFLINE_BODY_TEXT_COLOR);
    setSelectedParticipantIds(members.map((member) => member.id));
    setSceneDetailsOpen(false);
    setParticipantSettingsOpen(false);
    setAdvancedOpen(false);
    setExpandedField(null);
    setNarrativePerspective('default');
    setWritingPreset('default');
    setWritingReference('none');
    setDialogueFormat('default');
    setDescriptionDensity('default');
    setWritingStyleCustom('');
    setMaxGeneratedChars('800');
    setDirectorLaunchToken(0);
    setInitialDirectorSection(undefined);
    setShowScene(false);
    setCurrentSession(null);
  }, [activeWorldBooks, group.id, initialDraft, initialSession, isOpen, members, onSessionUpdate, sceneMemberPool]);

  useEffect(() => {
    setSignedUpParticipantIds((previous) => {
      const next = dedupeIds(previous).filter((id) => recruitCandidateIds.includes(id));
      return sameIds(previous, next) ? previous : next;
    });
  }, [recruitCandidateIds]);

  useEffect(() => {
    setRecruitResponses((previous) => {
      const next = normalizeGroupOfflineRecruitResponses(previous)
        .filter((item) => recruitCandidateIds.includes(item.characterId));
      return JSON.stringify(previous) === JSON.stringify(next)
        ? previous
        : next;
    });
  }, [recruitCandidateIds]);

  useEffect(() => {
    setActivityType((previous) => (
      activityOptions.some((option) => option.value === previous)
        ? previous
        : (activityOptions[0]?.value || '')
    ));
  }, [activityOptions]);

  const toggleExpandedField = (key: ExpandableFieldKey) => {
    setExpandedField((prev) => (prev === key ? null : key));
  };

  const collapseExpandedFieldGroup = (keys: ExpandableFieldKey[]) => {
    setExpandedField((previous) => (previous && keys.includes(previous) ? null : previous));
  };

  const handleToggleSceneDetails = () => {
    setSceneDetailsOpen((previous) => {
      const next = !previous;
      if (!next) {
        collapseExpandedFieldGroup(SCENE_DETAIL_FIELD_KEYS);
      }
      return next;
    });
  };

  const handleToggleAdvanced = () => {
    setAdvancedOpen((previous) => {
      const next = !previous;
      if (!next) {
        collapseExpandedFieldGroup(WRITING_FIELD_KEYS);
      }
      return next;
    });
  };

  const handleToggleParticipantSettings = () => {
    setParticipantSettingsOpen((previous) => {
      const next = !previous;
      if (!next) {
        collapseExpandedFieldGroup(PARTICIPANT_FIELD_KEYS);
      }
      return next;
    });
  };

  const toggleParticipant = (characterId: string) => {
    setSelectedParticipantIds((prev) => (
      prev.includes(characterId)
        ? prev.filter((id) => id !== characterId)
        : [...prev, characterId]
    ));
  };

  const sceneDetailsSummary = [
    safeText(customActivityType).trim() || activityType || '沿用开局标签',
    safeText(location).trim() || '地点随机',
    safeText(timeLabel).trim() || '时间随机',
    safeText(weatherLabel).trim() || '天气随机',
    selectedScenarioBlueprint ? `${selectedScenarioBlueprint.roundLimit} 轮任务局` : '',
  ].filter(Boolean).join(' · ');
  const participantSettingsSummary = isRecruitDraftFlow
    ? `${recruitStatusSummary.invitedCount > 0 ? `${recruitStatusSummary.invitedCount} 人候选` : '开放报名'} · 已报名 ${recruitStatusSummary.joinedCount} 人 · 已婉拒 ${recruitStatusSummary.declinedCount} 人 · 待表态 ${recruitStatusSummary.pendingCount} 人`
    : `${selectedParticipantIds.length > 0 ? `${selectedParticipantIds.length} 人参与` : '待征集'} · ${vibe}`;
  const displayedParticipantMembers = isRecruitDraftFlow
    ? members.filter((member) => recruitCandidateIds.includes(member.id))
    : members;

  const buildPreparedDraft = (createdAt = Date.now(), options?: { allowEmptyParticipants?: boolean }): GroupOfflineRecruitDraft | null => {
    if (!options?.allowEmptyParticipants && selectedParticipantIds.length === 0) {
      return null;
    }

    const resolvedLocation = safeText(location).trim() || pickRandomLocation(mode);
    const resolvedScene = safeText(scenePrompt).trim() || pickRandomScene(mode);
    const resolvedStorySource = safeText(scenarioStorySourcePrompt).trim();
    const resolvedUserHook = safeText(scenarioUserHookPrompt).trim();
    const resolvedMissionObject = safeText(scenarioMissionObjectPrompt).trim();
    const resolvedIdentityPair = safeText(scenarioIdentityPairPrompt).trim();
    const resolvedRescueTarget = safeText(scenarioRescueTargetPrompt).trim();
    const resolvedHandoffOrExit = safeText(scenarioHandoffOrExitPrompt).trim();
    const resolvedFailureCondition = safeText(scenarioFailureConditionPrompt).trim();
    const resolvedScenarioTask = safeText(scenarioTaskPrompt).trim();
    const resolvedTime = safeText(timeLabel).trim() || pickRandomTimeLabel();
    const resolvedWeather = safeText(weatherLabel).trim() || pickRandomWeather(mode);
    const participantSourceIds = selectedParticipantIds.length > 0
      ? selectedParticipantIds
      : [];
    const participantMembers = sceneMemberPool.filter((member) => participantSourceIds.includes(member.id));
    const signedUpMembers = sceneMemberPool.filter((member) => recruitSignedUpIds.includes(member.id));
    const scenarioState = mode === 'scenario' && isGroupOfflineScenarioType(activityType)
      ? buildGroupOfflineScenarioState({
          type: activityType,
          scenePrompt: resolvedScene,
          storySourceHint: resolvedStorySource || undefined,
          userInvolvementHint: resolvedUserHook || undefined,
          missionObjectHint: resolvedMissionObject || undefined,
          identityPairHint: resolvedIdentityPair || undefined,
          rescueTargetHint: resolvedRescueTarget || undefined,
          handoffOrExitHint: resolvedHandoffOrExit || undefined,
          failureConditionHint: resolvedFailureCondition || undefined,
          currentTaskHint: resolvedScenarioTask || undefined,
          userName,
          location: resolvedLocation,
          weatherLabel: resolvedWeather,
          vibe,
          participantNames: participantMembers.map((member) => member.remarkName?.trim() || member.name),
          seed: createdAt,
        })
      : undefined;
    const scenarioRoundLimit = scenarioState && isGroupOfflineScenarioType(activityType)
      ? getGroupOfflineScenarioBlueprint(activityType).roundLimit
      : undefined;
    const worldBookSnapshot = buildGroupOfflineWorldBookSnapshot(activeWorldBooks);

    return {
      createdAt,
      title: safeText(customActivityType).trim() || activityType,
      mode,
      activityType,
      customActivityType: safeText(customActivityType).trim() || undefined,
      location: resolvedLocation,
      scenePrompt: resolvedScene,
      timeLabel: resolvedTime,
      weatherLabel: resolvedWeather,
      vibe,
      highlightColor,
      bodyTextColor,
      selectedParticipantIds: [...selectedParticipantIds],
      participantLabels: signedUpMembers.map((member) => member.remarkName?.trim() || member.name),
      selectedWorldBookIds: worldBookSnapshot.map((entry) => entry.id),
      worldBookSnapshot,
      backgroundImage: group.groupBackground,
      backgroundSource: group.groupBackground ? 'group-background' : undefined,
      narrativePerspective,
      writingPreset,
      writingReference,
      dialogueFormat,
      descriptionDensity,
      writingStyleCustom: safeText(writingStyleCustom).trim() || undefined,
      ...(safeText(initialDraft?.recruitCardSessionId).trim() ? { recruitCardSessionId: safeText(initialDraft?.recruitCardSessionId).trim() } : {}),
      ...(safeText(initialDraft?.directorInstruction).trim() ? { directorInstruction: safeText(initialDraft?.directorInstruction).trim() } : {}),
      ...(initialDraft?.directorInstructionOutputMode ? { directorInstructionOutputMode: initialDraft.directorInstructionOutputMode } : {}),
      ...(initialDraft?.memoryWritebackPolicy === 'allow' || initialDraft?.memoryWritebackPolicy === 'block'
        ? { memoryWritebackPolicy: initialDraft.memoryWritebackPolicy }
        : {}),
      ...(initialDraft?.awaitingDirectorInstruction ? { awaitingDirectorInstruction: true } : {}),
      ...(normalizeGroupOfflineRecruitResponses(recruitResponses).length > 0
        ? { recruitResponses: normalizeGroupOfflineRecruitResponses(recruitResponses) }
        : {}),
      ...(recruitSignedUpIds.length > 0 ? { signedUpParticipantIds: recruitSignedUpIds } : {}),
      ...(typeof initialDraft?.launchedAt === 'number' && Number.isFinite(initialDraft.launchedAt)
        ? { launchedAt: initialDraft.launchedAt }
        : {}),
      maxGeneratedChars: Math.max(300, Math.min(2200, Number.parseInt(maxGeneratedChars || '800', 10) || 800)),
      roundLimit: scenarioRoundLimit,
      scenarioState,
    };
  };

  const buildRecruitDraftSnapshot = (): GroupOfflineRecruitDraft | null => {
    if (!initialDraft || initialSession) {
      return null;
    }

    const preparedDraft = buildPreparedDraft(initialDraft.createdAt, { allowEmptyParticipants: true });
    if (!preparedDraft) {
      return null;
    }

    return preparedDraft;
  };

  useEffect(() => {
    if (!isOpen || !isRecruitDraftFlow || !!initialSession) {
      return;
    }

    const nextDraft = buildRecruitDraftSnapshot();
    if (!nextDraft) {
      return;
    }

    const snapshot = buildRecruitDraftSnapshotKey(nextDraft);
    if (lastRecruitDraftSnapshotRef.current === snapshot) {
      return;
    }

    lastRecruitDraftSnapshotRef.current = snapshot;
    onRecruitDraftUpdate(nextDraft);
  }, [
    activityType,
    bodyTextColor,
    customActivityType,
    descriptionDensity,
    dialogueFormat,
    group.id,
    highlightColor,
    initialDraft,
    initialSession,
    isOpen,
    isRecruitDraftFlow,
    location,
    maxGeneratedChars,
    mode,
    narrativePerspective,
    onRecruitDraftUpdate,
    recruitResponses,
    scenarioFailureConditionPrompt,
    scenarioHandoffOrExitPrompt,
    scenarioIdentityPairPrompt,
    scenarioMissionObjectPrompt,
    scenarioRescueTargetPrompt,
    scenarioStorySourcePrompt,
    scenarioTaskPrompt,
    scenarioUserHookPrompt,
    scenePrompt,
    selectedParticipantIds,
    signedUpParticipantIds,
    timeLabel,
    vibe,
    weatherLabel,
    writingPreset,
    writingReference,
    writingStyleCustom,
  ]);

  const buildSessionFromPreparedDraft = (
    preparedDraft: GroupOfflineRecruitDraft,
    createdAt: number,
    options?: {
      awaitingDirectorInstruction?: boolean;
      memoryWritebackPolicy?: GroupOfflineMemoryWritebackPolicy;
      launchFromSignups?: boolean;
    },
  ): GroupOfflineSession => {
    const launchSignedUpIds = dedupeIds(preparedDraft.signedUpParticipantIds || []);
    const launchParticipantIds = options?.launchFromSignups && launchSignedUpIds.length > 0
      ? launchSignedUpIds
      : preparedDraft.selectedParticipantIds;

    return {
      id: createGroupOfflineSessionId(createdAt),
      groupId: group.id,
      mode: preparedDraft.mode,
      generationMode: 'blocks',
      activityType: preparedDraft.activityType,
      customActivityType: preparedDraft.customActivityType,
      location: preparedDraft.location,
      scenePrompt: preparedDraft.scenePrompt,
      timeLabel: preparedDraft.timeLabel,
      weatherLabel: preparedDraft.weatherLabel,
      vibe: preparedDraft.vibe,
      highlightColor: preparedDraft.highlightColor,
      bodyTextColor: preparedDraft.bodyTextColor,
      selectedWorldBookIds: preparedDraft.selectedWorldBookIds,
      worldBookSnapshot: preparedDraft.worldBookSnapshot,
      backgroundImage: preparedDraft.backgroundImage,
      backgroundSource: preparedDraft.backgroundSource,
      narrativePerspective: preparedDraft.narrativePerspective,
      writingPreset: preparedDraft.writingPreset,
      writingReference: preparedDraft.writingReference,
      dialogueFormat: preparedDraft.dialogueFormat,
      descriptionDensity: preparedDraft.descriptionDensity,
      writingStyleCustom: preparedDraft.writingStyleCustom,
      directorInstruction: preparedDraft.directorInstruction,
      directorInstructionOutputMode: preparedDraft.directorInstructionOutputMode,
      memoryWritebackPolicy: options?.memoryWritebackPolicy || preparedDraft.memoryWritebackPolicy || 'allow',
      awaitingDirectorInstruction: options?.awaitingDirectorInstruction ? true : undefined,
      sourceRecruitCardSessionId: preparedDraft.recruitCardSessionId,
      maxGeneratedChars: preparedDraft.maxGeneratedChars,
      participants: launchParticipantIds.map((characterId) => ({
        characterId,
        joinedAt: createdAt,
        presence: 'arrived' as const,
      })),
      createdAt,
      updatedAt: createdAt,
      currentRound: 0,
      roundLimit: preparedDraft.roundLimit,
      scenarioState: preparedDraft.scenarioState,
      messages: [],
      status: 'active',
    };
  };

  const canLaunchDirectStart = selectedParticipantIds.length > 0;
  const canLaunchRecruitStart = recruitSignedUpIds.length > 0;
  const canContinueRecruitRound = isRecruitDraftFlow && recruitPendingIds.length > 0 && !!onContinueRecruitRound;
  const canEnterSpecialInstruction = isRecruitDraftFlow
    ? canLaunchRecruitStart
    : canLaunchDirectStart;

  const handleStart = () => {
    const createdAt = Date.now();
    const preparedDraft = buildPreparedDraft(createdAt);
    if (!preparedDraft) return;
    if (!canLaunchDirectStart) return;

    const nextSession = buildSessionFromPreparedDraft(preparedDraft, createdAt);

    const launchParticipantIds = nextSession.participants.map((participant) => participant.characterId);
    const participantMembers = sceneMemberPool.filter((member) => launchParticipantIds.includes(member.id));
    const startMessage = createGroupOfflineStartMessage({
      session: nextSession,
      members: participantMembers,
    });

    setDirectorLaunchToken(0);
    setInitialDirectorSection(undefined);
    setCurrentSession(nextSession);
    setShowScene(true);
    onSessionStart(nextSession, startMessage);
    onSessionUpdate(nextSession);
  };

  const handleStartFromSignups = () => {
    const createdAt = Date.now();
    const preparedDraft = buildPreparedDraft(createdAt, { allowEmptyParticipants: true });
    if (!preparedDraft) return;
    if (!canLaunchRecruitStart) return;

    const nextSession = buildSessionFromPreparedDraft(preparedDraft, createdAt, {
      launchFromSignups: true,
    });

    const launchParticipantIds = nextSession.participants.map((participant) => participant.characterId);
    const participantMembers = sceneMemberPool.filter((member) => launchParticipantIds.includes(member.id));
    const startMessage = createGroupOfflineStartMessage({
      session: nextSession,
      members: participantMembers,
    });

    setDirectorLaunchToken(0);
    setInitialDirectorSection(undefined);
    setCurrentSession(nextSession);
    setShowScene(true);
    onSessionStart(nextSession, startMessage);
    onSessionUpdate(nextSession);
  };

  const handleOpenSpecialInstructionEntry = () => {
    const createdAt = Date.now();
    const preparedDraft = buildPreparedDraft(createdAt, isRecruitDraftFlow ? { allowEmptyParticipants: true } : undefined);
    if (!preparedDraft) return;
    if (!canEnterSpecialInstruction) return;

    const nextSession = buildSessionFromPreparedDraft(preparedDraft, createdAt, {
      awaitingDirectorInstruction: true,
      ...(isRecruitDraftFlow ? { launchFromSignups: true } : {}),
    });
    const launchParticipantIds = nextSession.participants.map((participant) => participant.characterId);
    const participantMembers = sceneMemberPool.filter((member) => launchParticipantIds.includes(member.id));
    const startMessage = createGroupOfflineStartMessage({
      session: nextSession,
      members: participantMembers,
    });

    setCurrentSession(nextSession);
    setShowScene(true);
    setInitialDirectorSection('instruction');
    setDirectorLaunchToken(Date.now());
    onSessionStart(nextSession, startMessage);
    onSessionUpdate(nextSession);
  };

  const handlePublishRecruitCard = () => {
    const createdAt = Date.now();
    const recruitCardSessionId = `group-offline-recruit-${createdAt}`;
    const preparedDraft = buildPreparedDraft(createdAt, { allowEmptyParticipants: true });
    if (!preparedDraft) return;
    const nextDraft: GroupOfflineRecruitDraft = {
      ...preparedDraft,
      recruitCardSessionId,
      signedUpParticipantIds: [],
    };
    const cardMessage = createGroupOfflineRecruitMessage({
      draft: nextDraft,
      createdBy: userName,
      timestamp: createdAt,
    });
    onPublishRecruitCard(nextDraft, cardMessage);
    onClose();
  };

  const handleContinueRecruitRound = () => {
    if (!initialDraft || !onContinueRecruitRound) {
      return;
    }

    const nextDraft = buildRecruitDraftSnapshot();
    if (!nextDraft) {
      return;
    }

    onContinueRecruitRound(nextDraft);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <div className="absolute inset-0 z-[120] bg-black/20 backdrop-blur-sm">
        {showScene && currentSession ? (
          <GroupOfflineScene
            session={currentSession}
            directorLaunchToken={directorLaunchToken}
            initialDirectorSection={initialDirectorSection}
            group={group}
            members={sceneMemberPool}
            inviteableCharacters={inviteableCharacters}
            userName={userName}
            activeConfig={activeConfig}
            activeWorldBooks={activeWorldBooks}
            history={history}
            directChatHistory={directChatHistory}
            perception={perception}
            onCloseScene={onClose}
            onBackToPlanner={() => setShowScene(false)}
            onUpdateSession={(nextSession) => {
              setCurrentSession(nextSession);
              onSessionUpdate(nextSession);
            }}
            onComplete={(payload) => {
              onSessionComplete(payload);
              onSessionUpdate(null);
              setCurrentSession(null);
              setShowScene(false);
              onClose();
            }}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="mx-auto flex h-full w-full max-w-[760px] flex-col overflow-y-auto bg-[#f4f5f7] px-4 pb-8 pt-5 text-zinc-900"
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm"
                aria-label="关闭"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className="text-[18px] font-semibold text-zinc-950">群聊线下</div>
                <div className="mt-1 text-[12px] text-zinc-500">先配置这场局，再进入独立现场页。</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-1 py-1">
              <section>
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
                  <Sparkles size={14} />
                  模式
                </div>
                <div className="flex gap-2">
                  {MODE_OPTIONS.map((option) => {
                    const active = mode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMode(option.value)}
                        className={`min-w-0 flex-1 rounded-full border px-4 py-2.5 text-center text-[13px] font-medium transition ${
                          active
                            ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 min-h-[20px] text-[12px] leading-5 text-zinc-500">
                  {MODE_OPTIONS.find((option) => option.value === mode)?.caption || ''}
                </div>
              </section>

              <section className="mt-5">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
                  <Users size={14} />
                  出场方式
                </div>
                <div className="rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-[13px] leading-6 text-zinc-700">
                  当前只保留分块推进。共景后系统会每轮调度 1 到 3 个角色按顺序推进，不再提供同场群像玩法。
                </div>
              </section>

              <div className="mt-6 grid gap-5">
                <FieldShell label="开局标签">
                  <div className="grid grid-cols-2 gap-2">
                    {activityOptions.map((option) => {
                      const active = activityType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setActivityType(option.value)}
                          className={`rounded-[18px] border px-3 py-3 text-[13px] transition ${
                            active
                              ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </FieldShell>

                {selectedScenarioBlueprint ? (
                  <section className="rounded-[24px] border border-zinc-200 bg-white px-4 py-4 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                        默认 {selectedScenarioBlueprint.roundLimit} 轮
                      </div>
                      <div className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                        任务型设定局
                      </div>
                    </div>
                    <div className="mt-3 text-[13px] leading-6 text-zinc-800">
                      {selectedScenarioBlueprint.playStyle}
                    </div>
                    <div className="mt-2 text-[12px] leading-5 text-zinc-500">
                      {selectedScenarioBlueprint.pressureRule}
                    </div>
                  </section>
                ) : null}

                <CollapsibleSection
                  title="场景细节"
                  summary={sceneDetailsSummary}
                  open={sceneDetailsOpen}
                  onToggle={handleToggleSceneDetails}
                >
                  <ExpandableField
                    label="自定义局名"
                    value={customActivityType}
                    placeholder="留空则沿用上面的开局标签"
                    expanded={expandedField === 'custom_activity'}
                    onToggle={() => toggleExpandedField('custom_activity')}
                    onChange={setCustomActivityType}
                  />

                  <ExpandableField
                    label={mode === 'scenario' ? '背景' : '情景'}
                    action={<RandomMiniButton onClick={() => setScenePrompt(pickRandomScene(mode))} />}
                    value={scenePrompt}
                    placeholder={mode === 'scenario'
                      ? '留空随机，例如：昨晚有人把你们的临时身份牌调包了，守夜人正在按错误名单点人。'
                      : '留空随机，例如：刚下过雨，店里只剩靠窗的位置。'}
                    expanded={expandedField === 'scene_prompt'}
                    onToggle={() => toggleExpandedField('scene_prompt')}
                    onChange={setScenePrompt}
                    multiline
                    rows={6}
                  />

                  {selectedScenarioBlueprint ? (
                    <ExpandableField
                      label="故事来源"
                      value={scenarioStorySourcePrompt}
                      placeholder="例如：昨晚有人把你们的临时身份牌调包了，今天清场前这件事被重新翻出来。"
                      expanded={expandedField === 'scenario_story_source'}
                      onToggle={() => toggleExpandedField('scenario_story_source')}
                      onChange={setScenarioStorySourcePrompt}
                      multiline
                      rows={4}
                    />
                  ) : null}

                  {selectedScenarioBlueprint ? (
                    <ExpandableField
                      label="你的切入口"
                      value={scenarioUserHookPrompt}
                      placeholder="例如：你得先确认谁拿错了身份牌，因为第一句判断会先落到你这里。"
                      expanded={expandedField === 'scenario_user_hook'}
                      onToggle={() => toggleExpandedField('scenario_user_hook')}
                      onChange={setScenarioUserHookPrompt}
                      multiline
                      rows={4}
                    />
                  ) : null}

                  {selectedScenarioBlueprint ? (
                    <ExpandableField
                      label="关键目标物"
                      value={scenarioMissionObjectPrompt}
                      placeholder="例如：真正能生效的授权卡 / 被调包的硬盘 / 只有一份的临时通行证。"
                      expanded={expandedField === 'scenario_mission_object'}
                      onToggle={() => toggleExpandedField('scenario_mission_object')}
                      onChange={setScenarioMissionObjectPrompt}
                      multiline
                      rows={4}
                    />
                  ) : null}

                  {selectedScenarioBlueprint ? (
                    <ExpandableField
                      label="错位身份"
                      value={scenarioIdentityPairPrompt}
                      placeholder="例如：夜班放映员 / 临时审片人。留空则按局内模板随机。"
                      expanded={expandedField === 'scenario_identity_pair'}
                      onToggle={() => toggleExpandedField('scenario_identity_pair')}
                      onChange={setScenarioIdentityPairPrompt}
                      multiline
                      rows={4}
                    />
                  ) : null}

                  {selectedScenarioBlueprint ? (
                    <ExpandableField
                      label="营救对象"
                      value={scenarioRescueTargetPrompt}
                      placeholder="例如：被困在后场的临时证人。也可以写成“对象 / 为什么非救不可”。"
                      expanded={expandedField === 'scenario_rescue_target'}
                      onToggle={() => toggleExpandedField('scenario_rescue_target')}
                      onChange={setScenarioRescueTargetPrompt}
                      multiline
                      rows={4}
                    />
                  ) : null}

                  {selectedScenarioBlueprint ? (
                    <ExpandableField
                      label="交接点 / 出口"
                      value={scenarioHandoffOrExitPrompt}
                      placeholder="例如：后场备用门 / 港口外栏交接点 / 只在断电后开启的后门线路。"
                      expanded={expandedField === 'scenario_handoff_or_exit'}
                      onToggle={() => toggleExpandedField('scenario_handoff_or_exit')}
                      onChange={setScenarioHandoffOrExitPrompt}
                      multiline
                      rows={4}
                    />
                  ) : null}

                  {selectedScenarioBlueprint ? (
                    <ExpandableField
                      label="失败后果"
                      value={scenarioFailureConditionPrompt}
                      placeholder="例如：倒计时归零时目标物还没送到交接点，整场就会直接转成收残局。"
                      expanded={expandedField === 'scenario_failure_condition'}
                      onToggle={() => toggleExpandedField('scenario_failure_condition')}
                      onChange={setScenarioFailureConditionPrompt}
                      multiline
                      rows={4}
                    />
                  ) : null}

                  {selectedScenarioBlueprint ? (
                    <ExpandableField
                      label="自定义任务"
                      value={scenarioTaskPrompt}
                      placeholder="例如：在剩余 8 轮内认出谁拿错了身份牌，并把真正的授权卡带到外场交接点。"
                      expanded={expandedField === 'scenario_task'}
                      onToggle={() => toggleExpandedField('scenario_task')}
                      onChange={setScenarioTaskPrompt}
                      multiline
                      rows={4}
                    />
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-3">
                    <ExpandableField
                      label={<span className="inline-flex items-center gap-2"><MapPin size={12} />地点</span>}
                      action={<RandomMiniButton onClick={() => setLocation(pickRandomLocation(mode))} />}
                      value={location}
                      placeholder="留空随机"
                      expanded={expandedField === 'location'}
                      onToggle={() => toggleExpandedField('location')}
                      onChange={setLocation}
                    />
                    <ExpandableField
                      label={<span className="inline-flex items-center gap-2"><Clock3 size={12} />时间</span>}
                      action={<RandomMiniButton onClick={() => setTimeLabel(pickRandomTimeLabel())} />}
                      value={timeLabel}
                      placeholder="留空随机"
                      expanded={expandedField === 'time'}
                      onToggle={() => toggleExpandedField('time')}
                      onChange={setTimeLabel}
                    />
                    <ExpandableField
                      label={<span className="inline-flex items-center gap-2"><Calendar size={12} />天气 / 世界状态</span>}
                      action={<RandomMiniButton onClick={() => setWeatherLabel(pickRandomWeather(mode))} />}
                      value={weatherLabel}
                      placeholder="留空随机"
                      expanded={expandedField === 'weather'}
                      onToggle={() => toggleExpandedField('weather')}
                      onChange={setWeatherLabel}
                      multiline
                      rows={5}
                    />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title="参与设置"
                  summary={participantSettingsSummary}
                  open={participantSettingsOpen}
                  onToggle={handleToggleParticipantSettings}
                >
                  <FieldShell label="氛围倾向">
                    <div className="flex flex-wrap gap-2">
                      {VIBE_OPTIONS.map((option) => {
                        const active = vibe === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setVibe(option)}
                            className={`rounded-full border px-3 py-2 text-[12px] transition ${
                              active
                                ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </FieldShell>

                  <ExpandableField
                    label="自定义氛围"
                    value={vibe}
                    placeholder="例如：表面在起哄，实际每个人都在试探谁先松口。"
                    expanded={expandedField === 'vibe'}
                    onToggle={() => toggleExpandedField('vibe')}
                    onChange={setVibe}
                    multiline
                    rows={4}
                  />

                  <FieldShell label={<span className="inline-flex items-center gap-2"><Users size={12} />{isRecruitDraftFlow ? '征集名单' : '参与角色'}</span>}>
                    <div className="space-y-2">
                      {displayedParticipantMembers.map((member) => {
                        const selected = selectedParticipantIds.includes(member.id);
                        const recruitResponse = recruitResponseByCharacterId.get(member.id);
                        const recruitStatusLabel = recruitResponse?.decision === 'join'
                          ? '已报名'
                          : recruitResponse?.decision === 'decline'
                            ? '已婉拒'
                            : isRecruitDraftFlow
                              ? '待表态'
                              : '';
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleParticipant(member.id)}
                            disabled={isRecruitDraftFlow}
                            className={`flex w-full items-center gap-3 rounded-[20px] border px-3 py-3 text-left transition ${
                              selected
                                ? 'border-zinc-300 bg-zinc-100'
                                : 'border-zinc-200 bg-white hover:bg-zinc-50'
                            } disabled:cursor-not-allowed disabled:opacity-55`}
                          >
                            <ResolvedOfflineAvatar
                              value={member.avatar}
                              alt={member.name}
                              containerClassName="h-11 w-11 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100"
                              fallbackClassName="text-[14px] text-zinc-700"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-[14px] font-medium text-zinc-900">{member.remarkName?.trim() || member.name}</div>
                              <div className="truncate text-[12px] text-zinc-500">
                                {isRecruitDraftFlow
                                  ? (recruitResponse?.text || `${recruitStatusLabel} · ${member.signature?.trim() || '等群里公开表态'}`)
                                  : (member.signature?.trim() || '加入这次群线下')}
                              </div>
                            </div>
                            {isRecruitDraftFlow ? (
                              <div className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
                                recruitResponse?.decision === 'join'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : recruitResponse?.decision === 'decline'
                                    ? 'bg-zinc-100 text-zinc-600'
                                    : 'bg-amber-50 text-amber-700'
                              }`}>
                                {recruitStatusLabel}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </FieldShell>

                </CollapsibleSection>

                <section className="border-t border-zinc-200 pt-5">
                  <button
                    type="button"
                    onClick={handleToggleAdvanced}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
                        <WandSparkles size={14} />
                        文风设置
                      </div>
                      <div className="mt-1 text-[12px] text-zinc-500">沿用约会设置的思路，但会按群像现场去生成。</div>
                    </div>
                    <span className={`text-zinc-400 transition ${advancedOpen ? 'rotate-180' : ''}`}>⌄</span>
                  </button>

                  <AnimatePresence initial={false}>
                    {advancedOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <FieldShell label="叙事视角">
                            <select
                              value={narrativePerspective}
                              onChange={(event) => setNarrativePerspective(event.target.value as DateNarrativePerspective)}
                              className="w-full rounded-[18px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-900 outline-none"
                            >
                              {PERSPECTIVE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </FieldShell>
                          <FieldShell label="文风预设">
                            <select
                              value={writingPreset}
                              onChange={(event) => setWritingPreset(event.target.value as DateWritingPreset)}
                              className="w-full rounded-[18px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-900 outline-none"
                            >
                              {WRITING_PRESET_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </FieldShell>
                          <FieldShell label="风格参考">
                            <select
                              value={writingReference}
                              onChange={(event) => setWritingReference(event.target.value as DateWritingReference)}
                              className="w-full rounded-[18px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-900 outline-none"
                            >
                              {WRITING_REFERENCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </FieldShell>
                          <FieldShell label="对白格式">
                            <select
                              value={dialogueFormat}
                              onChange={(event) => setDialogueFormat(event.target.value as DateDialogueFormat)}
                              className="w-full rounded-[18px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-900 outline-none"
                            >
                              {DIALOGUE_FORMAT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </FieldShell>
                          <FieldShell label="描写浓度" className="md:col-span-2">
                            <select
                              value={descriptionDensity}
                              onChange={(event) => setDescriptionDensity(event.target.value as DateDescriptionDensity)}
                              className="w-full rounded-[18px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-900 outline-none"
                            >
                              {DESCRIPTION_DENSITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </FieldShell>
                          <FieldShell
                            label={<span className="inline-flex items-center gap-2"><Palette size={12} />高亮字体颜色</span>}
                            className="md:col-span-2"
                          >
                            <div className="flex flex-wrap gap-3">
                              {GROUP_OFFLINE_HIGHLIGHT_COLOR_OPTIONS.map((color) => {
                                const active = highlightColor === color;
                                return (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setHighlightColor(color)}
                                    className={`h-11 w-11 rounded-full border transition ${
                                      active
                                        ? 'scale-105 border-zinc-900 shadow-[0_0_0_3px_rgba(24,24,27,0.08)]'
                                        : 'border-zinc-200'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`选择高亮色 ${color}`}
                                  />
                                );
                              })}
                            </div>
                          </FieldShell>
                          <FieldShell
                            label={<span className="inline-flex items-center gap-2"><Palette size={12} />普通字体颜色</span>}
                            className="md:col-span-2"
                          >
                            <div className="flex flex-wrap gap-3">
                              {GROUP_OFFLINE_BODY_TEXT_COLOR_OPTIONS.map((color) => {
                                const active = bodyTextColor === color;
                                return (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setBodyTextColor(color)}
                                    className={`h-11 w-11 rounded-full border transition ${
                                      active
                                        ? 'scale-105 border-zinc-900 shadow-[0_0_0_3px_rgba(24,24,27,0.08)]'
                                        : 'border-zinc-200'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`选择普通字体颜色 ${color}`}
                                  />
                                );
                              })}
                            </div>
                          </FieldShell>
                          <ExpandableField
                            label="字数上限"
                            value={maxGeneratedChars}
                            placeholder="默认 800"
                            expanded={expandedField === 'max_chars'}
                            onToggle={() => toggleExpandedField('max_chars')}
                            onChange={setMaxGeneratedChars}
                            className="md:col-span-2"
                          />
                          <div className="md:col-span-2 -mt-2 text-[12px] leading-5 text-zinc-500">
                            可自定义本次群线下的生成字数上限，默认 800 字，最高 2200 字。
                          </div>
                          <ExpandableField
                            label="自定义文风要求"
                            value={writingStyleCustom}
                            placeholder="例如：共景更像镜头推进、台词更利落、状态栏偏细节描写。"
                            expanded={expandedField === 'writing_style'}
                            onToggle={() => toggleExpandedField('writing_style')}
                            onChange={setWritingStyleCustom}
                            multiline
                            rows={6}
                            className="md:col-span-2"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                <section className="rounded-[24px] border border-zinc-200 bg-white px-4 py-4 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[14px] font-semibold text-zinc-900">特殊指令入口</div>
                      <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                        先进入群聊线下页，不立即生成。会直接打开大鹅导演的“特殊指令”分区，等你写完要求后再开始。
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenSpecialInstructionEntry}
                      disabled={!canEnterSpecialInstruction}
                      className="shrink-0 rounded-[14px] border border-zinc-200 bg-zinc-100 px-3.5 py-2 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      进入
                    </button>
                  </div>
                </section>
              </div>

              <div className="mt-6 flex flex-col gap-3 md:flex-row">
                {isRecruitDraftFlow ? (
                  <>
                    <button
                      type="button"
                      disabled={!canContinueRecruitRound}
                      onClick={handleContinueRecruitRound}
                      className="flex-1 rounded-[22px] border border-zinc-300 bg-white px-4 py-3 text-[15px] font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      继续征集
                    </button>
                    <button
                      type="button"
                      disabled={!canLaunchRecruitStart}
                      onClick={handleStartFromSignups}
                      className="flex-1 rounded-[22px] border border-zinc-300 bg-zinc-100 px-4 py-3 text-[15px] font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      按报名名单开局
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={!canLaunchDirectStart}
                      onClick={handleStart}
                      className="flex-1 rounded-[22px] border border-zinc-300 bg-zinc-100 px-4 py-3 text-[15px] font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      直接开始
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishRecruitCard}
                      className="flex-1 rounded-[22px] border border-zinc-300 bg-white px-4 py-3 text-[15px] font-medium text-zinc-800 transition hover:bg-zinc-50"
                    >
                      发征集卡
                    </button>
                  </>
                )}
              </div>

              {isRecruitDraftFlow ? (
                <div className="mt-4 text-[12px] leading-6 text-zinc-500">
                  {recruitStatusSummary.pendingCount > 0
                    ? '这张征集卡已经发到群里了。你可以继续征集还没表态的人；参加的人会自动写进卡片，不参加的人会在群里说明原因。'
                    : '这轮征集已经收过一遍口了。现在可以直接按报名名单开局，或者改候选后重新发一张新卡。'}
                </div>
              ) : null}

              {activeWorldBooks.length > 0 ? (
                <div className="mt-4 text-[12px] leading-6 text-zinc-500">
                  本次会在开局时锁定当前群启用的世界书快照：{activeWorldBooks.map((entry) => entry.title).join('、')}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
