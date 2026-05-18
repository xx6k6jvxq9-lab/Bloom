import type {
  GroupOfflineCard,
  GroupOfflineRound,
  GroupOfflineScenarioState,
  GroupOfflineScenarioTaskStatus,
  GroupOfflineScenarioTaskStep,
  GroupOfflineScenarioTaskStepStatus,
  GroupOfflineScenarioTaskStepUpdate,
  GroupOfflineScenarioType,
  GroupOfflineSession,
} from '../../types';

type ScenarioBlueprint = {
  roundLimit: number;
  playStyle: string;
  pressureRule: string;
  backgroundVariants: Array<(context: ScenarioTextContext) => string>;
  taskVariants: Array<(context: ScenarioTextContext) => string>;
  successVariants: Array<(context: ScenarioTextContext) => string>;
  failureVariants: Array<(context: ScenarioTextContext) => string>;
  stepVariants: [
    Array<(context: ScenarioTextContext) => string>,
    Array<(context: ScenarioTextContext) => string>,
    Array<(context: ScenarioTextContext) => string>,
  ];
};

type BlindBoxMission = {
  label: string;
  background: string;
  task: string;
  success: string;
  finalStep: string;
};

type RescueTarget = {
  target: string;
  reason: string;
};

type IdentityPair = {
  first: string;
  second: string;
};

type ScenarioTextContext = {
  location: string;
  weatherLabel: string;
  vibe: string;
  primaryName: string;
  secondaryName: string;
  participantNames: string[];
  storySource: string;
  authorityLabel: string;
  missionObject: string;
  handoffPoint: string;
  lockedZone: string;
  countdownDevice: string;
  identityPair: IdentityPair;
  falseRecord: string;
  rescueTarget: RescueTarget;
  anomalySource: string;
  exitMethod: string;
  suspectLabel: string;
  ruleLabel: string;
  witnessLabel: string;
  blindBoxMission: BlindBoxMission;
};

type BuildScenarioStateInput = {
  type: GroupOfflineScenarioType;
  scenePrompt?: string;
  storySourceHint?: string;
  userInvolvementHint?: string;
  currentTaskHint?: string;
  missionObjectHint?: string;
  identityPairHint?: string;
  rescueTargetHint?: string;
  handoffOrExitHint?: string;
  failureConditionHint?: string;
  userName?: string;
  location: string;
  weatherLabel: string;
  vibe: string;
  participantNames: string[];
  seed?: number;
};

const DEFAULT_SCENARIO_STATUS_LABELS: Record<GroupOfflineScenarioTaskStatus, string> = {
  active: '任务进行中',
  completed: '任务已完成',
  failed: '任务失败',
};

const STORY_SOURCE_POOL = [
  '昨晚有人把临时交接记录改过一版',
  '清场前十分钟收到了一条只发给你们的补充指令',
  '原本该封存的现场资料在换班时被人私自挪了位置',
  '一条延迟送达的语音把这场局重新叫了回来',
  '本来已经结束的流程，因为一份错签文件被重新拉起',
  '封场名单里多出的一行备注，把所有人重新扣在了现场',
];

const AUTHORITY_LABELS = [
  '守夜管理员',
  '临时封场小组',
  '交接值班台',
  '巡查记录员',
  '外场安保口',
  '备用控制室',
];

const MISSION_OBJECTS = [
  '装在红封套里的三号底片',
  '写着旧名单编号的备用密钥',
  '被贴错封签的监控硬盘',
  '只剩一份的临时通行证',
  '记录异常来源的纸质总账',
  '能解除封场的授权卡',
];

const HANDOFF_POINTS = [
  '旧货梯口',
  '后场备用门',
  '楼顶风机平台',
  '港口外栏交接点',
  '放映室外侧的玻璃廊桥',
  '旧检票口后方的储物间',
];

const LOCKED_ZONES = [
  '二层放映室',
  '后场器材间',
  '封条还没撕开的资料柜',
  '临时断电的侧廊',
  '已经锁死的观众出口',
  '挂着停用牌的维修通道',
];

const COUNTDOWN_DEVICES = [
  '清场倒计时屏',
  '封锁程序的归零条',
  '外场切电时钟',
  '临时权限失效计时器',
  '备用通道的自动锁门程序',
];

const IDENTITY_PAIRS: IdentityPair[] = [
  { first: '夜班放映员', second: '临时审片人' },
  { first: '外场接应人', second: '资料登记员' },
  { first: '备用钥匙持有人', second: '封场记录员' },
  { first: '维修通道巡查员', second: '临时调度员' },
];

const FALSE_RECORDS = [
  '错登记录',
  '临时权限更正单',
  '封场签认册',
  '备用名单页',
];

const RESCUE_TARGETS: RescueTarget[] = [
  { target: '失联的值班剪辑师', reason: '他手里有能解除封锁的总钥匙' },
  { target: '被困在后场的临时证人', reason: '她知道是谁先改了那份名单' },
  { target: '在断电侧廊里失去联系的联络人', reason: '他带着唯一一张有效通行证' },
  { target: '被留在资料柜后的伤员', reason: '他身上绑着能指向故障源的定位贴' },
];

const ANOMALY_SOURCES = [
  '一段被人反复回滚的广播记录',
  '主控台上还没熄灭的异常灯列',
  '写错时间的封场日志',
  '反复跳回原点的路线指示屏',
  '在后台循环的测试指令',
  '被换过顺序的应急预案页',
];

const EXIT_METHODS = [
  '真正的回程锚点',
  '只在断电后会开启的后门线路',
  '藏在备用投影机里的离场口令',
  '能重置封场规则的人工开锁流程',
  '连接外场的临时升降梯',
];

const SUSPECT_LABELS = [
  '最后一个碰过封条的人',
  '把交接时间改掉的值班员',
  '故意留下伪口令的内场人员',
  '在名单上多写了一行备注的人',
  '提前锁死侧门的巡查员',
];

const RULE_LABELS = [
  '退场前必须核对最后一位在场者',
  '名单未闭合前谁都不能离开',
  '只要错登记录还在，现场就算没有散',
  '最后一张通行证回收前封场不会解除',
  '触发异常的人没被指出来之前，出口都算无效',
];

const WITNESS_LABELS = [
  '最后一位见过封条的人',
  '在后场听见争执的清洁工',
  '知道备用钥匙去向的检票员',
  '看见身份牌被换过的灯光师',
];

const BLIND_BOX_MISSIONS: BlindBoxMission[] = [
  {
    label: '护送',
    background: '签上写明要把受伤的联络人连同药箱一起带到交接点。',
    task: '护送受伤的联络人，并把药箱一起带到交接点。',
    success: '联络人和药箱都安全抵达交接点。',
    finalStep: '确认联络人能在交接点完成身份确认并离场。',
  },
  {
    label: '回收',
    background: '签上写明要把散落在现场的关键资料全部追回并重新封袋。',
    task: '回收散落的关键资料，并确认没有留下第二份副本。',
    success: '关键资料被追回，且现场没有遗留可用副本。',
    finalStep: '把追回的资料重新封袋并送到交接点。',
  },
  {
    label: '辨真',
    background: '签上写明要在多份伪物里找出真正能生效的那一份。',
    task: '辨认真正能生效的目标物，并用它打开后续通道。',
    success: '选对目标物，并让后续通道成功开启。',
    finalStep: '用确认后的目标物完成开门或交接动作。',
  },
];

function pickVariant<T>(items: T[], seed: number, offset: number): T {
  return items[Math.abs(seed + offset) % items.length];
}

function summarizeText(value: string | undefined, max = 160): string {
  const normalized = value?.trim() || '';
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function resolveScenarioHint(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function parseIdentityPairHint(value: string | undefined, fallback: IdentityPair): IdentityPair {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  const parts = normalized
    .split(/\s*(?:\/|／|\||｜|->|=>|→|、|，|,)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      first: parts[0]!,
      second: parts[1]!,
    };
  }

  return {
    first: normalized,
    second: fallback.second,
  };
}

function parseRescueTargetHint(value: string | undefined, fallback: RescueTarget): RescueTarget {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  const parts = normalized
    .split(/\s*(?:\/|／|\||｜|->|=>|→)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      target: parts[0]!,
      reason: parts.slice(1).join('，'),
    };
  }

  return {
    target: normalized,
    reason: fallback.reason,
  };
}

function buildScenarioTextContext(input: BuildScenarioStateInput, seed: number): ScenarioTextContext {
  const participantNames = input.participantNames.filter((name) => name.trim().length > 0);
  const fallbackMissionObject = pickVariant(MISSION_OBJECTS, seed, 7);
  const fallbackHandoffPoint = pickVariant(HANDOFF_POINTS, seed, 11);
  const fallbackIdentityPair = pickVariant(IDENTITY_PAIRS, seed, 19);
  const fallbackRescueTarget = pickVariant(RESCUE_TARGETS, seed, 29);
  const fallbackExitMethod = pickVariant(EXIT_METHODS, seed, 37);
  const sharedHandoffOrExitHint = input.handoffOrExitHint?.trim();
  return {
    location: input.location.trim() || '现场',
    weatherLabel: input.weatherLabel.trim() || '空气压得很低',
    vibe: input.vibe.trim() || '局势未明',
    primaryName: participantNames[0] || '第一个人',
    secondaryName: participantNames[1] || participantNames[0] || '另一个人',
    participantNames,
    storySource: input.storySourceHint?.trim() || pickVariant(STORY_SOURCE_POOL, seed, 3),
    authorityLabel: pickVariant(AUTHORITY_LABELS, seed, 5),
    missionObject: resolveScenarioHint(input.missionObjectHint, fallbackMissionObject),
    handoffPoint: resolveScenarioHint(sharedHandoffOrExitHint, fallbackHandoffPoint),
    lockedZone: pickVariant(LOCKED_ZONES, seed, 13),
    countdownDevice: pickVariant(COUNTDOWN_DEVICES, seed, 17),
    identityPair: parseIdentityPairHint(input.identityPairHint, fallbackIdentityPair),
    falseRecord: pickVariant(FALSE_RECORDS, seed, 23),
    rescueTarget: parseRescueTargetHint(input.rescueTargetHint, fallbackRescueTarget),
    anomalySource: pickVariant(ANOMALY_SOURCES, seed, 31),
    exitMethod: resolveScenarioHint(sharedHandoffOrExitHint, fallbackExitMethod),
    suspectLabel: pickVariant(SUSPECT_LABELS, seed, 41),
    ruleLabel: pickVariant(RULE_LABELS, seed, 43),
    witnessLabel: pickVariant(WITNESS_LABELS, seed, 47),
    blindBoxMission: pickVariant(BLIND_BOX_MISSIONS, seed, 53),
  };
}

function normalizeTaskSteps(stepLabels: string[]): GroupOfflineScenarioTaskStep[] {
  return stepLabels.map((label, index) => ({
    slot: index + 1,
    label,
    status: 'pending',
  }));
}

function buildInitialProgressSummary(state: Pick<GroupOfflineScenarioState, 'taskSteps' | 'currentTask'>) {
  const firstStep = state.taskSteps[0]?.label;
  return firstStep
    ? `局刚压下来，先把“${firstStep}”这一步踩实，别让真正的线索继续往后滑。`
    : `先围绕“${state.currentTask}”把这一局推起来，别把轮次浪费在空转上。`;
}

function buildUserInvolvementLabel(input: {
  type: GroupOfflineScenarioType;
  userName?: string;
  currentTask: string;
  firstStep?: string;
}): string {
  const userLabel = input.userName?.trim() || '你';
  switch (input.type) {
    case '临时同盟':
      return `${userLabel}不是旁观者。你得先稳住同盟站位，再决定谁去碰真正的成果。`;
    case '倒计时任务':
      return `${userLabel}要先盯住目标物和交接点，这一局的时限会先压到你面前。`;
    case '身份错位':
      return `${userLabel}得先看清谁拿错了身份、哪份记录能改回去，错一步就会先从你这边穿帮。`;
    case '穿越落点':
      return `${userLabel}要先判断这是不是临时落点，再带着大家去试那条真正能回去的路。`;
    case '盲盒任务':
      return `${userLabel}得先把抽中的任务读明白，再决定第一步碰哪里；这不是围观局。`;
    case '世界故障':
      return `${userLabel}要先盯住最先失真的那条规则，不然所有人都会被故障一起往里拖。`;
    case '密室未退场':
      return `${userLabel}得先把锁场的原因捋清，谁都走不了的时候，第一句判断会落到你这里。`;
    case '临时营救':
      return `${userLabel}要先定营救路线和接应顺序，晚一轮，目标就可能直接失联。`;
    default:
      return input.firstStep
        ? `${userLabel}得先把“${input.firstStep}”这一步推出来，别把自己放在局外。`
        : `${userLabel}不是局外人，这一步得由你先把任务带起来。`;
  }
}

const GROUP_OFFLINE_SCENARIO_BLUEPRINTS: Record<GroupOfflineScenarioType, ScenarioBlueprint> = {
  临时同盟: {
    roundLimit: 8,
    playStyle: '先合作过关，再看同盟会不会在中途翻脸。',
    pressureRule: '第 8 轮前没把合作换成实际成果，这个临时同盟就会先崩。',
    backgroundVariants: [
      ({ storySource, primaryName, secondaryName, location, authorityLabel, lockedZone }) =>
        `${storySource}之后，${primaryName}和${secondaryName}被${authorityLabel}一起扣在${location}的${lockedZone}外侧；谁先翻脸，谁就会先被当成替罪羊。`,
      ({ storySource, location, missionObject, authorityLabel, witnessLabel }) =>
        `${storySource}把${missionObject}留在了${location}，而${witnessLabel}只肯把去向说给同一阵线的人听；${authorityLabel}已经在等谁先露出破绽。`,
    ],
    taskVariants: [
      ({ missionObject, lockedZone, handoffPoint, authorityLabel }) =>
        `先稳住这次临时同盟，再把${missionObject}从${lockedZone}带到${handoffPoint}，否则${authorityLabel}会在清场前把全部线索收走。`,
      ({ missionObject, witnessLabel, handoffPoint }) =>
        `先从${witnessLabel}手里套出${missionObject}的准确位置，再带着成果撤到${handoffPoint}。`,
    ],
    successVariants: [
      ({ missionObject, handoffPoint }) => `在同盟没散之前把${missionObject}送到${handoffPoint}，并且没有让彼此先拆台。`,
      ({ primaryName, secondaryName }) => `${primaryName}和${secondaryName}都带着成果脱身，而不是只剩一场空口合作。`,
    ],
    failureVariants: [
      ({ missionObject }) => `同盟先崩，或者${missionObject}在清场前根本没落到手里。`,
      ({ authorityLabel }) => `还没拿到成果就先互相翻脸，最后一起被${authorityLabel}扣住。`,
    ],
    stepVariants: [
      [
        ({ authorityLabel, primaryName, secondaryName }) => `先说清谁去顶住${authorityLabel}，谁来稳住${primaryName}和${secondaryName}之间的合作。`,
        ({ witnessLabel }) => `先确认谁去接近${witnessLabel}，谁负责把话题稳在同一阵线上。`,
      ],
      [
        ({ missionObject, lockedZone }) => `把${missionObject}从${lockedZone}里真正拿到手，别把轮次耗在口头试探上。`,
        ({ missionObject, witnessLabel }) => `从${witnessLabel}那里套出${missionObject}的准确信息，并立刻去碰实物。`,
      ],
      [
        ({ handoffPoint }) => `带着成果撤到${handoffPoint}，别让这次同盟只停在“暂时合作”四个字上。`,
        ({ authorityLabel, handoffPoint }) => `在${authorityLabel}反应过来之前完成交接并撤到${handoffPoint}。`,
      ],
    ],
  },
  倒计时任务: {
    roundLimit: 6,
    playStyle: '强目标、强时限，每一轮都必须看到具体推进。',
    pressureRule: '第 6 轮前没办成，就是直接失败，没有缓冲。',
    backgroundVariants: [
      ({ storySource, location, lockedZone, missionObject, countdownDevice, weatherLabel }) =>
        `${storySource}让${missionObject}被锁进了${location}的${lockedZone}，${countdownDevice}已经启动；${weatherLabel}只是表面，真正压人的东西是那块还在跳的归零条。`,
      ({ storySource, location, missionObject, handoffPoint, authorityLabel }) =>
        `${storySource}之后，${missionObject}本该直接送到${handoffPoint}，却在${location}中途失了手；${authorityLabel}已经把这段路的可用时间压到只剩几轮。`,
    ],
    taskVariants: [
      ({ missionObject, handoffPoint, countdownDevice }) =>
        `在${countdownDevice}归零前找到${missionObject}，并把它送到${handoffPoint}。`,
      ({ missionObject, lockedZone, handoffPoint }) =>
        `在封锁前从${lockedZone}拿出${missionObject}，再完成送往${handoffPoint}的最后交接。`,
    ],
    successVariants: [
      ({ missionObject, handoffPoint }) => `${missionObject}在时限内送到${handoffPoint}，后果没有落到在场的人身上。`,
      ({ missionObject }) => `${missionObject}被及时处理掉，而不是只在最后一刻摸到一点希望。`,
    ],
    failureVariants: [
      ({ countdownDevice }) => `${countdownDevice}归零时任务仍未完成，后果会直接落地。`,
      ({ missionObject }) => `错过时间窗，${missionObject}没能在封锁前送出去，整场局会直接转成收残局。`,
    ],
    stepVariants: [
      [
        ({ lockedZone, missionObject, countdownDevice }) => `先确认${missionObject}到底还在不在${lockedZone}，以及${countdownDevice}还剩多少可操作空间。`,
        ({ handoffPoint }) => `先把交接点${handoffPoint}和途中最容易卡人的那一步摸清。`,
      ],
      [
        ({ missionObject, lockedZone }) => `别再空转了，立刻把${missionObject}从${lockedZone}里拿到手。`,
        ({ missionObject }) => `围绕${missionObject}完成第一次有效推进，至少让它离开原本的失控位置。`,
      ],
      [
        ({ missionObject, handoffPoint }) => `把${missionObject}按时送到${handoffPoint}，并确认这次交接真的生效。`,
        ({ handoffPoint }) => `在封锁前把最后一步落到${handoffPoint}，别把成果留在半路。`,
      ],
    ],
  },
  身份错位: {
    roundLimit: 8,
    playStyle: '重点是错位身份下的试探、伪装和具体任务推进。',
    pressureRule: '拖到第 8 轮，错位身份就会越来越难圆，任务也会一起失控。',
    backgroundVariants: [
      ({ storySource, primaryName, secondaryName, location, identityPair, authorityLabel, falseRecord }) =>
        `${storySource}之后，${primaryName}和${secondaryName}在${location}的临时身份被对调了：${primaryName}现在顶着“${identityPair.second}”的权限，${secondaryName}手里却是“${identityPair.first}”的通行牌，${authorityLabel}只认那份还没撤掉的${falseRecord}。`,
      ({ storySource, location, primaryName, secondaryName, falseRecord, witnessLabel }) =>
        `${storySource}让${location}的${falseRecord}写反了人名，${primaryName}和${secondaryName}只能先按错身份行动；偏偏${witnessLabel}已经看见这次调包，只等谁先说漏。`,
    ],
    taskVariants: [
      ({ primaryName, secondaryName, identityPair, missionObject, falseRecord }) =>
        `让${primaryName}用“${identityPair.second}”的身份拿到${missionObject}，再让${secondaryName}以“${identityPair.first}”身份把${falseRecord}撤掉；两步都做完前谁都不能露真名。`,
      ({ missionObject, falseRecord, authorityLabel }) =>
        `顶着错位身份拿到${missionObject}，并在${authorityLabel}看出异常前改回那份${falseRecord}。`,
    ],
    successVariants: [
      ({ missionObject, falseRecord }) => `拿到${missionObject}、撤掉${falseRecord}，而且没有在公开场合穿帮。`,
      ({ authorityLabel }) => `任务成果落了地，${authorityLabel}却没能抓到任何身份对调的把柄。`,
    ],
    failureVariants: [
      ({ missionObject }) => `任一人身份先暴露，或${missionObject}没能在封场前拿到。`,
      ({ falseRecord }) => `${falseRecord}没改回去，错位身份反而先把整场局推到台面上。`,
    ],
    stepVariants: [
      [
        ({ primaryName, secondaryName, identityPair }) => `先定下谁来顶着“${identityPair.second}”行动，谁去处理${primaryName}和${secondaryName}留下的错位痕迹。`,
        ({ falseRecord }) => `先摸清${falseRecord}到底卡在谁手里，别让伪装还没开始就露底。`,
      ],
      [
        ({ missionObject, authorityLabel }) => `顶着错位身份碰到${missionObject}，同时别让${authorityLabel}看出权限不对。`,
        ({ missionObject, falseRecord }) => `一边把${missionObject}拿到手，一边确认${falseRecord}的改动点到底在哪。`,
      ],
      [
        ({ falseRecord, location }) => `把${falseRecord}改回去并撤离${location}，别把穿帮留到收尾。`,
        ({ authorityLabel }) => `在${authorityLabel}回头核对前完成善后，让这次身份错位像从没发生过。`,
      ],
    ],
  },
  穿越落点: {
    roundLimit: 10,
    playStyle: '先搞清这是什么地方、规则怎么运作，再谈如何回去。',
    pressureRule: '第 10 轮前还没找到回程办法，这个落点就会把人彻底困住。',
    backgroundVariants: [
      ({ storySource, location, anomalySource, weatherLabel, missionObject }) =>
        `${storySource}把所有人甩进了${location}，${anomalySource}正在反复改写这里的路标和时间感；${weatherLabel}只是表象，真正古怪的是连${missionObject}都像被当成了临时锚点。`,
      ({ storySource, location, exitMethod, lockedZone }) =>
        `${storySource}之后，${location}和原来的世界彻底对不上了；唯一可能通向外面的${exitMethod}被埋在${lockedZone}那条不再按常理运行的路线里。`,
    ],
    taskVariants: [
      ({ missionObject, exitMethod, lockedZone }) =>
        `先确认${missionObject}能不能充当回程锚点，再在${lockedZone}里找到真正的${exitMethod}。`,
      ({ anomalySource, exitMethod }) =>
        `搞清${anomalySource}为什么会反复重写环境规则，并据此把${exitMethod}真正找出来。`,
    ],
    successVariants: [
      ({ exitMethod }) => `确认环境规则、稳住现场，并把${exitMethod}真正打开。`,
      ({ missionObject }) => `${missionObject}被用对了位置，大家也找到了能回去的办法。`,
    ],
    failureVariants: [
      ({ exitMethod }) => `${exitMethod}始终没被找到，环境规则会先一步彻底闭合。`,
      ({ anomalySource }) => `还没摸清${anomalySource}的规律，真正能回去的窗口就先关上了。`,
    ],
    stepVariants: [
      [
        ({ anomalySource, location }) => `先搞明白${location}里最不像原来世界的那条规则，尤其是${anomalySource}在改什么。`,
        ({ missionObject }) => `先确认${missionObject}为什么会被卷进这个落点，它到底是不是关键锚点。`,
      ],
      [
        ({ lockedZone, exitMethod }) => `在${lockedZone}里完成第一次有效探索，至少把${exitMethod}的线索挖出来。`,
        ({ missionObject, exitMethod }) => `别只顾着自保，先用${missionObject}去试一次${exitMethod}的触发条件。`,
      ],
      [
        ({ exitMethod, location }) => `把${exitMethod}真正打开，然后带着人从${location}脱身。`,
        ({ anomalySource }) => `在${anomalySource}再次改写环境前，把最后一步落稳。`,
      ],
    ],
  },
  盲盒任务: {
    roundLimit: 7,
    playStyle: '随机的是任务来源，不是任务目标；开局后目标必须非常明确。',
    pressureRule: '第 7 轮前没把抽到的任务做完，这次盲盒就只能算失败。',
    backgroundVariants: [
      ({ storySource, location, blindBoxMission, lockedZone }) =>
        `${storySource}把一张封口任务签塞进了${location}的${lockedZone}，拆开后才知道这次抽到的是“${blindBoxMission.label}”：${blindBoxMission.background}`,
      ({ location, blindBoxMission, witnessLabel }) =>
        `${location}本来只是普通碰头点，结果${witnessLabel}临走前丢下了一张盲盒任务签；签上写得很直白：${blindBoxMission.background}`,
    ],
    taskVariants: [
      ({ blindBoxMission }) => blindBoxMission.task,
      ({ blindBoxMission, handoffPoint }) => `${blindBoxMission.task.replace('交接点', handoffPoint)}。`,
    ],
    successVariants: [
      ({ blindBoxMission }) => blindBoxMission.success,
      ({ blindBoxMission }) => `盲盒任务不是只猜到方向，而是真把“${blindBoxMission.label}”这件事做成了。`,
    ],
    failureVariants: [
      () => '把盲盒当气氛看待，结果到最后什么都没做成。',
      ({ blindBoxMission }) => `任务目标一直没落地，最后连“${blindBoxMission.label}”到底要做什么都没做完。`,
    ],
    stepVariants: [
      [
        ({ blindBoxMission, lockedZone }) => `先把盲盒任务签的要求读清楚，尤其别漏掉${lockedZone}里那条补充限制：${blindBoxMission.background}`,
        ({ blindBoxMission }) => `先确认这次抽到的“${blindBoxMission.label}”到底要交付什么结果。`,
      ],
      [
        ({ blindBoxMission }) => `围绕“${blindBoxMission.label}”完成第一次有效推进，不要让任务一直停在口头阶段。`,
        ({ blindBoxMission }) => `别再猜了，直接把${blindBoxMission.task}这件事往前推一步。`,
      ],
      [
        ({ blindBoxMission }) => blindBoxMission.finalStep,
        ({ handoffPoint, blindBoxMission }) => `把最后结果带到${handoffPoint}，确认“${blindBoxMission.label}”这次真的落地。`,
      ],
    ],
  },
  世界故障: {
    roundLimit: 10,
    playStyle: '世界规则会继续失真，不修源头就只会越拖越坏。',
    pressureRule: '每拖一轮故障都会加深，第 10 轮前还没修复源头，这个世界就不再按原规则运行。',
    backgroundVariants: [
      ({ storySource, location, anomalySource, missionObject, weatherLabel }) =>
        `${storySource}之后，${location}的世界规则开始出错：${anomalySource}一层层失真，连${missionObject}的用途都被改写了；${weatherLabel}只是表面，真正的坏消息是故障还在继续扩散。`,
      ({ location, anomalySource, authorityLabel, lockedZone }) =>
        `${location}表面上还稳着，但${anomalySource}已经把${lockedZone}那一层规则先撕开了；${authorityLabel}只能临时压住，治不了根。`,
    ],
    taskVariants: [
      ({ anomalySource, missionObject }) => `找出${anomalySource}真正的源头，并用${missionObject}完成一次有效修复。`,
      ({ lockedZone, anomalySource }) => `在故障扩到全场前进入${lockedZone}，把${anomalySource}对应的异常点先关掉。`,
    ],
    successVariants: [
      ({ anomalySource }) => `确认${anomalySource}的源头、关掉异常点，并让规则重新稳定下来。`,
      ({ missionObject }) => `${missionObject}被用在真正该用的位置上，而不是只做一次临时止血。`,
    ],
    failureVariants: [
      ({ anomalySource }) => `${anomalySource}继续升级，最后连最基本的规则都维持不住。`,
      ({ lockedZone }) => `一直没碰到源头，${lockedZone}那层故障会先把整场局拖坏。`,
    ],
    stepVariants: [
      [
        ({ anomalySource, location }) => `先确认${anomalySource}在${location}里最先从哪一步开始失真。`,
        ({ missionObject }) => `先弄清${missionObject}为什么会被故障一起带偏，它很可能就是修复钥匙。`,
      ],
      [
        ({ lockedZone, anomalySource }) => `在${lockedZone}里拦住${anomalySource}的第一次扩散，至少别让它继续往外层蔓延。`,
        ({ missionObject }) => `把${missionObject}真正接到故障点上，不要只停在判断阶段。`,
      ],
      [
        ({ anomalySource }) => `完成源头修复，让${anomalySource}这条线真正停下来。`,
        ({ location }) => `把修复结果留在${location}，别让故障在撤离后再回潮。`,
      ],
    ],
  },
  密室未退场: {
    roundLimit: 8,
    playStyle: '散场失败后的封闭空间，要把锁场规则和出口一起查清。',
    pressureRule: '拖到第 8 轮还没打开出口，困场规则就会彻底锁死。',
    backgroundVariants: [
      ({ storySource, location, ruleLabel, witnessLabel }) =>
        `${storySource}让这场本该散掉的局卡在了${location}：表面上人已经要走完了，但${ruleLabel}还在生效，而${witnessLabel}知道是谁把最后一步做错了。`,
      ({ location, falseRecord, ruleLabel, suspectLabel }) =>
        `${location}的散场流程因为一页没收回的${falseRecord}被重新卡住了；${ruleLabel}像钉子一样把所有人扣在原地，偏偏${suspectLabel}始终不肯露面。`,
    ],
    taskVariants: [
      ({ falseRecord, exitMethod }) => `找出是哪一份${falseRecord}把现场重新锁住，再把真正的${exitMethod}打开。`,
      ({ suspectLabel, ruleLabel }) => `确认${suspectLabel}和${ruleLabel}之间的关系，把“为什么不能退场”这件事彻底查明。`,
    ],
    successVariants: [
      ({ exitMethod }) => `锁场原因被还原，${exitMethod}也真的被打开了。`,
      ({ ruleLabel }) => `不是暂时钻空子离开，而是把“${ruleLabel}”这条困场规则从根上解掉。`,
    ],
    failureVariants: [
      ({ exitMethod }) => `${exitMethod}始终没打开，所有人都会继续被困在原地。`,
      ({ suspectLabel }) => `只知道哪里不对，却始终没把${suspectLabel}和真正的锁场原因对上。`,
    ],
    stepVariants: [
      [
        ({ ruleLabel, location }) => `先确认${location}里到底是哪一条“${ruleLabel}”还在继续生效。`,
        ({ falseRecord }) => `先把那份没收回的${falseRecord}找出来，别让问题一直悬着。`,
      ],
      [
        ({ suspectLabel, witnessLabel }) => `把${suspectLabel}和${witnessLabel}手里的线索对上，查清谁触发了锁场。`,
        ({ exitMethod }) => `围绕${exitMethod}完成第一次有效试错，别让出口一直停在猜测里。`,
      ],
      [
        ({ exitMethod, location }) => `把${exitMethod}真正打开，让${location}重新具备退场条件。`,
        ({ ruleLabel }) => `把“${ruleLabel}”这条规则最后拆干净，别再给它回锁的机会。`,
      ],
    ],
  },
  临时营救: {
    roundLimit: 6,
    playStyle: '分工、路线、时机都要快，营救目标必须明确。',
    pressureRule: '第 6 轮前没把目标带出来，营救就会直接转成更糟的收尾。',
    backgroundVariants: [
      ({ storySource, location, rescueTarget, weatherLabel, lockedZone }) =>
        `${storySource}之后，${rescueTarget.target}被困在${location}的${lockedZone}里，${weatherLabel}只是表面；真正的问题是${rescueTarget.reason}，等不到天亮。`,
      ({ location, rescueTarget, authorityLabel }) =>
        `${location}里还有人没出来，偏偏${rescueTarget.target}手里握着${rescueTarget.reason}；${authorityLabel}已经准备把整层一起封死。`,
    ],
    taskVariants: [
      ({ rescueTarget, handoffPoint }) => `把${rescueTarget.target}安全带到${handoffPoint}，并确保${rescueTarget.reason}也一起被带出来。`,
      ({ rescueTarget, lockedZone }) => `在封场前进入${lockedZone}接出${rescueTarget.target}，别把${rescueTarget.reason}留在原地。`,
    ],
    successVariants: [
      ({ rescueTarget, handoffPoint }) => `${rescueTarget.target}和关键线索都从现场撤到了${handoffPoint}。`,
      ({ rescueTarget }) => `${rescueTarget.target}真正脱离危险区，而不是只被短暂接应了一下。`,
    ],
    failureVariants: [
      ({ rescueTarget }) => `营救窗口关死时，${rescueTarget.target}仍然没被带出来，后面只会更难。`,
      ({ handoffPoint }) => `路线、分工或时机出错，结果连${handoffPoint}都没能摸到。`,
    ],
    stepVariants: [
      [
        ({ rescueTarget, lockedZone }) => `先确认${rescueTarget.target}在${lockedZone}里的准确位置，以及谁去接应最合适。`,
        ({ rescueTarget }) => `先把“为什么必须现在救”说清楚：${rescueTarget.reason}不能再晚。`,
      ],
      [
        ({ rescueTarget, lockedZone }) => `完成第一次实质接触，把${rescueTarget.target}从${lockedZone}的核心危险点带出来。`,
        ({ handoffPoint }) => `一边接人，一边把撤离路线朝${handoffPoint}清出来。`,
      ],
      [
        ({ rescueTarget, handoffPoint }) => `带着${rescueTarget.target}撤到${handoffPoint}，并确认关键线索没有掉在半路。`,
        ({ rescueTarget }) => `把追击和善后一起压住，别让${rescueTarget.target}刚出险又被拖回去。`,
      ],
    ],
  },
};

export function isGroupOfflineScenarioType(value: string | undefined | null): value is GroupOfflineScenarioType {
  return Boolean(value && value in GROUP_OFFLINE_SCENARIO_BLUEPRINTS);
}

export function getGroupOfflineScenarioBlueprint(type: GroupOfflineScenarioType) {
  const blueprint = GROUP_OFFLINE_SCENARIO_BLUEPRINTS[type];
  return {
    roundLimit: blueprint.roundLimit,
    playStyle: blueprint.playStyle,
    pressureRule: blueprint.pressureRule,
  };
}

export function buildGroupOfflineScenarioState(input: BuildScenarioStateInput): GroupOfflineScenarioState {
  const blueprint = GROUP_OFFLINE_SCENARIO_BLUEPRINTS[input.type];
  const seed = input.seed ?? Date.now();
  const textContext = buildScenarioTextContext(input, seed);
  const backgroundLabel = summarizeText(
    input.scenePrompt?.trim()
      || pickVariant(blueprint.backgroundVariants, seed, 1)(textContext),
  );
  const currentTask = input.currentTaskHint?.trim()
    || pickVariant(blueprint.taskVariants, seed, 3)(textContext);
  const taskSteps = normalizeTaskSteps([
    pickVariant(blueprint.stepVariants[0], seed, 5)(textContext),
    pickVariant(blueprint.stepVariants[1], seed, 7)(textContext),
    pickVariant(blueprint.stepVariants[2], seed, 11)(textContext),
  ]);
  const userInvolvementLabel = buildUserInvolvementLabel({
    type: input.type,
    userName: input.userName,
    currentTask,
    firstStep: taskSteps[0]?.label,
  });

  return {
    type: input.type,
    storySourceLabel: textContext.storySource,
    userInvolvementLabel: input.userInvolvementHint?.trim() || userInvolvementLabel,
    missionObjectLabel: textContext.missionObject,
    identityPairLabel: `${textContext.identityPair.first} / ${textContext.identityPair.second}`,
    rescueTargetLabel: textContext.rescueTarget.target,
    handoffPointLabel: textContext.handoffPoint,
    exitMethodLabel: textContext.exitMethod,
    backgroundLabel,
    currentTask,
    successCondition: pickVariant(blueprint.successVariants, seed, 13)(textContext),
    failureCondition: input.failureConditionHint?.trim() || pickVariant(blueprint.failureVariants, seed, 17)(textContext),
    pressureLine: blueprint.pressureRule,
    progressSummary: buildInitialProgressSummary({ taskSteps, currentTask }),
    taskSteps,
    status: 'active',
  };
}

export function rebuildGroupOfflineScenarioState(
  session: Pick<GroupOfflineSession, 'mode' | 'activityType' | 'scenePrompt' | 'location' | 'weatherLabel' | 'vibe' | 'createdAt'>,
  participantNames: string[],
  userName?: string,
): GroupOfflineScenarioState | undefined {
  if (session.mode !== 'scenario' || !isGroupOfflineScenarioType(session.activityType)) {
    return undefined;
  }
  return buildGroupOfflineScenarioState({
    type: session.activityType,
    scenePrompt: session.scenePrompt,
    userName,
    location: session.location,
    weatherLabel: session.weatherLabel,
    vibe: session.vibe,
    participantNames,
    seed: session.createdAt,
  });
}

function countCompletedTaskSteps(taskSteps: GroupOfflineScenarioTaskStep[]): number {
  return taskSteps.filter((step) => step.status === 'completed').length;
}

function normalizeScenarioTaskStatus(value: string | undefined): GroupOfflineScenarioTaskStatus | undefined {
  if (value === 'active' || value === 'completed' || value === 'failed') {
    return value;
  }
  return undefined;
}

function normalizeScenarioTaskStepStatus(value: string | undefined): GroupOfflineScenarioTaskStepStatus | undefined {
  if (value === 'pending' || value === 'completed' || value === 'failed') {
    return value;
  }
  return undefined;
}

export function getGroupOfflineScenarioRemainingRounds(session: Pick<GroupOfflineSession, 'mode' | 'roundLimit' | 'currentRound' | 'scenarioState'>): number | undefined {
  if (session.mode !== 'scenario' || !session.scenarioState || typeof session.roundLimit !== 'number') {
    return undefined;
  }
  return Math.max(session.roundLimit - session.currentRound, 0);
}

export function getGroupOfflineScenarioStatusLabel(status: GroupOfflineScenarioTaskStatus | undefined): string {
  return DEFAULT_SCENARIO_STATUS_LABELS[status || 'active'];
}

export function getGroupOfflineScenarioLockReason(session: Pick<GroupOfflineSession, 'mode' | 'roundLimit' | 'currentRound' | 'scenarioState'>): string | undefined {
  if (session.mode !== 'scenario' || !session.scenarioState) {
    return undefined;
  }
  if (session.scenarioState.status === 'completed') {
    return '任务已经完成，先结束这场设定局吧。';
  }
  if (session.scenarioState.status === 'failed') {
    return '任务已经失败，先结束这场设定局吧。';
  }
  if (typeof session.roundLimit === 'number' && session.currentRound >= session.roundLimit) {
    return '已经达到设定局轮数上限，不能再继续推进了。';
  }
  return undefined;
}

export function buildGroupOfflineScenarioCardFields(session: Pick<GroupOfflineSession, 'mode' | 'roundLimit' | 'currentRound' | 'scenarioState'>): Pick<GroupOfflineCard, 'backgroundLabel' | 'taskLabel' | 'statusLabel' | 'progressLabel' | 'objectiveLabel' | 'roundLabel'> {
  if (session.mode !== 'scenario' || !session.scenarioState) {
    return {};
  }
  const completedCount = countCompletedTaskSteps(session.scenarioState.taskSteps);
  const remainingRounds = getGroupOfflineScenarioRemainingRounds(session);
  const totalSteps = session.scenarioState.taskSteps.length || 0;
  const roundLabel = typeof session.roundLimit === 'number'
    ? (session.currentRound <= 0
      ? `共景 · 剩余 ${session.roundLimit} 轮`
      : `第 ${session.currentRound}/${session.roundLimit} 轮 · 剩余 ${Math.max(session.roundLimit - session.currentRound, 0)} 轮`)
    : undefined;

  return {
    backgroundLabel: session.scenarioState.backgroundLabel,
    taskLabel: session.scenarioState.currentTask,
    statusLabel: getGroupOfflineScenarioStatusLabel(session.scenarioState.status),
    progressLabel: [
      totalSteps > 0 ? `${completedCount}/${totalSteps} 步完成` : '',
      session.scenarioState.progressSummary,
    ].filter(Boolean).join(' · '),
    objectiveLabel: session.scenarioState.currentTask,
    roundLabel,
  };
}

function applyTaskStepUpdates(
  taskSteps: GroupOfflineScenarioTaskStep[],
  updates: GroupOfflineScenarioTaskStepUpdate[] | undefined,
  currentRound: number,
): GroupOfflineScenarioTaskStep[] {
  if (!updates || updates.length === 0) {
    return taskSteps.map((step) => ({ ...step }));
  }
  const updatesBySlot = new Map<number, GroupOfflineScenarioTaskStepUpdate>();
  updates.forEach((update) => {
    const status = normalizeScenarioTaskStepStatus(update.status);
    if (!status || !Number.isFinite(update.slot)) return;
    updatesBySlot.set(update.slot, { ...update, status });
  });
  return taskSteps.map((step) => {
    const update = updatesBySlot.get(step.slot);
    if (!update) {
      return { ...step };
    }
    return {
      ...step,
      status: update.status,
      note: update.note?.trim() || step.note,
      updatedAtRound: update.status !== step.status || update.note?.trim()
        ? currentRound
        : step.updatedAtRound,
    };
  });
}

function deriveScenarioProgressSummary(
  scenarioState: GroupOfflineScenarioState,
  round: GroupOfflineRound | undefined,
  progressSummary: string | undefined,
) {
  if (progressSummary?.trim()) {
    return progressSummary.trim();
  }
  if (scenarioState.status === 'completed') {
    return '关键步骤已经全部达成，这场设定局可以自然收束了。';
  }
  if (scenarioState.status === 'failed') {
    return '轮数已经耗尽，任务没有在规定限制内完成。';
  }
  const roundSummary = summarizeText(round?.sceneText, 72);
  return roundSummary || scenarioState.progressSummary;
}

export function applyGroupOfflineScenarioRoundResult(session: GroupOfflineSession, round: GroupOfflineRound | undefined): GroupOfflineSession {
  if (session.mode !== 'scenario' || !session.scenarioState) {
    return session;
  }

  const update = round?.scenarioUpdate;
  const nextTaskSteps = applyTaskStepUpdates(
    session.scenarioState.taskSteps,
    update?.taskStepUpdates,
    session.currentRound,
  );
  const normalizedStatus = normalizeScenarioTaskStatus(update?.status);
  const nextScenarioState: GroupOfflineScenarioState = {
    ...session.scenarioState,
    currentTask: update?.currentTask?.trim() || session.scenarioState.currentTask,
    taskSteps: nextTaskSteps,
    status: normalizedStatus || session.scenarioState.status,
  };

  if (
    nextScenarioState.status === 'active'
    && nextTaskSteps.length > 0
    && nextTaskSteps.every((step) => step.status === 'completed')
  ) {
    nextScenarioState.status = 'completed';
  }

  if (
    nextScenarioState.status === 'active'
    && typeof session.roundLimit === 'number'
    && session.currentRound >= session.roundLimit
  ) {
    nextScenarioState.status = 'failed';
  }

  nextScenarioState.progressSummary = deriveScenarioProgressSummary(
    nextScenarioState,
    round,
    update?.progressSummary,
  );

  if (nextScenarioState.status === 'completed' && !nextScenarioState.completedAtRound) {
    nextScenarioState.completedAtRound = session.currentRound;
  }

  if (nextScenarioState.status === 'failed' && !nextScenarioState.failedAtRound) {
    nextScenarioState.failedAtRound = session.currentRound;
  }

  return {
    ...session,
    scenarioState: nextScenarioState,
  };
}

export function replayGroupOfflineScenarioState(
  session: GroupOfflineSession,
  rounds: GroupOfflineRound[],
  participantNames: string[],
  userName?: string,
): GroupOfflineScenarioState | undefined {
  const baselineState = rebuildGroupOfflineScenarioState(session, participantNames, userName);
  if (!baselineState) {
    return undefined;
  }

  let workingSession: GroupOfflineSession = {
    ...session,
    currentRound: 0,
    scenarioState: baselineState,
  };

  rounds.forEach((round, index) => {
    workingSession = applyGroupOfflineScenarioRoundResult({
      ...workingSession,
      currentRound: index + 1,
    }, round);
  });

  return workingSession.scenarioState;
}
