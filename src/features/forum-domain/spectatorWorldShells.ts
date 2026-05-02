import type { ForumSpectatorSettings } from '../../types';

export type SpectatorWorldShell =
  | 'campus'
  | 'workplace'
  | 'xianmen'
  | 'entertainment'
  | 'manor'
  | 'starnet'
  | 'weird'
  | 'esports'
  | 'showbiz'
  | 'haoMen'
  | 'apocalypse'
  | 'agency';

export type SpectatorWorldShellMeta = {
  id: SpectatorWorldShell;
  label: string;
  badge: string;
  blurb: string;
  ambient: string;
  hooks: string[];
};

export const SPECTATOR_WORLD_SHELLS: SpectatorWorldShellMeta[] = [
  {
    id: 'campus',
    label: '校园墙',
    badge: '宿舍楼下',
    blurb: '像匿名墙、表白墙、宿舍群和选课区一起传开的关系线。',
    ambient: '社团、选课、宿舍、晚自习、操场、食堂、朋友圈截图',
    hooks: ['同学在嗑', '宿舍在复盘', '匿名墙热帖', '社团里有人认出来'],
  },
  {
    id: 'workplace',
    label: '工位区',
    badge: '茶水间',
    blurb: '像办公室匿名板、茶水间和项目群外的边角八卦。',
    ambient: '工位、会议室、加班、群消息、权限、汇报、茶水间',
    hooks: ['同组人在看戏', '项目合作火花', '权限护短', '下班后的八卦帖'],
  },
  {
    id: 'xianmen',
    label: '仙门帖',
    badge: '山门热帖',
    blurb: '像山门闲谈、弟子私议和仙门公告墙里的关系风声。',
    ambient: '山门、师门、闭关、心魔、渡劫、名分、护道、门规',
    hooks: ['同门在嗑', '师兄师姐看破不说破', '门规压不住气氛', '劫数味太重'],
  },
  {
    id: 'entertainment',
    label: '贵圈组',
    badge: '路透区',
    blurb: '像饭圈匿名组、站姐路透和业内瓜楼里传开的关系线。',
    ambient: '路透、同台、后台、直播、红毯、站姐、热搜、营业',
    hooks: ['站姐在剪糖', '路透楼起飞', '营销号先闻到味', '同担先破防'],
  },
  {
    id: 'manor',
    label: '夜话厅',
    badge: '宴会后厅',
    blurb: '像宴会后厅、名流夜话和旧家族传闻里的拉扯。',
    ambient: '宴席、家宴、婚约、珠宝、后厅、马车、旧规矩、夜谈',
    hooks: ['宴后闲话', '婚约旧闻翻出来', '有人开始押注', '后厅已经传遍了'],
  },
  {
    id: 'starnet',
    label: '星网港',
    badge: '联讯热帖',
    blurb: '像星网匿名港、联讯站和舰桥讨论区里的高热关系线。',
    ambient: '舰桥、白名单、精神链接、军港、机甲、主控台、航线、联讯',
    hooks: ['联讯楼开盘', '白名单太明显', '舰桥上的人都懂', '权限味太重'],
  },
  {
    id: 'weird',
    label: '夜谈楼',
    badge: '凌晨三点',
    blurb: '像怪谈论坛、夜半灌水楼和匿名目击贴里发酵的危险关系。',
    ambient: '旧楼、镜子、规则、门缝、监控、走廊、半夜广播、影子',
    hooks: ['夜楼已经传开', '规则党先来了', '目击帖一层层盖高', '越说越像真的'],
  },
  {
    id: 'esports',
    label: '竞圈楼',
    badge: '赛后复盘',
    blurb: '像竞圈论坛、超话楼和直播切片区里越扒越热的关系线。',
    ambient: '训练室、双排、复盘、赛后采访、后台通道、直播、休息室、同队默契',
    hooks: ['切片先飞了', '双排味太重', '赛后楼开盘', '直播观众全在猜'],
  },
  {
    id: 'showbiz',
    label: '片场楼',
    badge: '收工以后',
    blurb: '像剧组路透、采访同框和收工夜聊里一点点发酵出来的线。',
    ambient: '片场、对戏、收工、同车、采访、化妆间、探班、杀青',
    hooks: ['同车被拍到', '对戏感太满', '采访剪不掉', '收工楼已经炸了'],
  },
  {
    id: 'haoMen',
    label: '豪门夜话',
    badge: '宴后小厅',
    blurb: '像豪门秘闻、联姻旧闻和圈内夜话里压不住的关系风声。',
    ambient: '晚宴、联姻、家族、会所、旧闻、继承权、珠宝、车门一扶',
    hooks: ['联姻楼翻旧账', '家宴上有人看见了', '车门那一下太夸张', '圈里早就在传'],
  },
  {
    id: 'apocalypse',
    label: '末日站',
    badge: '废墟电台',
    blurb: '像末日电台、据点留言墙和生存队夜聊里传开的高压关系线。',
    ambient: '据点、夜巡、物资、废墟、通讯台、伤口、守夜、撤离',
    hooks: ['守夜人全看见了', '物资分配先偏心', '撤离名单不对劲', '据点楼越盘越真'],
  },
  {
    id: 'agency',
    label: '事务所',
    badge: '后台小群',
    blurb: '像事务所匿名楼、后台小群和流程表之外偷偷发酵的关系线。',
    ambient: '会议室、行程单、后台、接送、经纪群、休息室、排练、流程表',
    hooks: ['后台小群先炸', '行程单藏不住了', '接送味太重', '事务所全员装瞎'],
  },
];

export function getSpectatorWorldShellMeta(worldShell: SpectatorWorldShell): SpectatorWorldShellMeta {
  return SPECTATOR_WORLD_SHELLS.find((item) => item.id === worldShell) || SPECTATOR_WORLD_SHELLS[0];
}

export function resolveSpectatorWorldShell(
  worldShell?: ForumSpectatorSettings['worldShell'],
): SpectatorWorldShell {
  return (worldShell as SpectatorWorldShell | undefined) || 'campus';
}

const SPECTATOR_AUTHOR_BANK: Record<SpectatorWorldShell, Array<{ name: string; handle: string; description: string }>> = {
  campus: [
    { name: '宿舍楼下匿名同学', handle: '下课先来吃瓜', description: '校园墙常驻路人' },
    { name: '选课区路过学姐', handle: '晚自习还在复盘', description: '总能把气氛看出点门道' },
    { name: '社团群截图目击者', handle: '操场边上看热闹', description: '爱在校园热帖里顺手补一句' },
  ],
  workplace: [
    { name: '茶水间匿名同事', handle: '工位先别装没事', description: '工位区常驻围观群众' },
    { name: '项目群边角路人', handle: '下班后继续复盘', description: '对合作氛围特别敏感' },
    { name: '权限表旁听员工', handle: '会议室外听到了', description: '一看关系走向就想开帖' },
  ],
  xianmen: [
    { name: '山门口路过弟子', handle: '今日先不守门规', description: '仙门帖常驻闲谈人' },
    { name: '闭关外偷听师姐', handle: '这劫数味太重了', description: '对门规压不住的气氛很敏锐' },
    { name: '执剑台旁观同门', handle: '护道护得太明显', description: '最爱在山门热帖里补一刀' },
  ],
  entertainment: [
    { name: '站姐群匿名路人', handle: '路透先存图了', description: '贵圈组常驻追线人' },
    { name: '超话搬运小号', handle: '不嗑但会截图', description: '对营业和真糖分得很清' },
    { name: '后台瓜田目击者', handle: '热搜前排蹲着', description: '最会把细节抠成长楼' },
  ],
  manor: [
    { name: '宴会角落旁听客', handle: '后厅风声很大', description: '夜话厅常驻闲谈人' },
    { name: '家宴回廊路过人', handle: '珠宝盒旁听到了', description: '很懂体面底下的暗潮' },
    { name: '旧闻翻页记录员', handle: '婚约味太明显', description: '最爱在夜话厅补旧账' },
  ],
  starnet: [
    { name: '联讯站匿名监听员', handle: '白名单太醒目', description: '星网港热帖常客' },
    { name: '舰桥边缘观察员', handle: '权限高得过分', description: '一眼就能看出失衡偏爱' },
    { name: '主控台路过乘员', handle: '航线都在说了', description: '喜欢把冷感关系盘成高热楼' },
  ],
  weird: [
    { name: '旧楼匿名夜班人', handle: '凌晨三点别回头', description: '夜谈楼常驻目击者' },
    { name: '规则贴补充路人', handle: '镜子那边先动了', description: '最爱给怪谈关系补一句' },
    { name: '走廊监控旁听客', handle: '半夜广播又响了', description: '对危险亲近感特别敏锐' },
  ],
  esports: [
    { name: '赛后复盘路人', handle: '这把味太重了', description: '竞圈楼常驻切片党' },
    { name: '训练室门口观众', handle: '双排不是没理由', description: '对默契和偏爱最敏感' },
    { name: '直播间长驻弹幕', handle: '导播都懂了吧', description: '擅长把细节盘成长楼' },
  ],
  showbiz: [
    { name: '收工路透小号', handle: '同车先存图了', description: '片场楼常驻抠糖人' },
    { name: '采访切片剪刀手', handle: '这眼神藏不住', description: '对营业和真情绪分得很清' },
    { name: '化妆间门口路人', handle: '收工以后再说', description: '爱把小动作记得特别细' },
  ],
  haoMen: [
    { name: '宴后匿名听客', handle: '小厅里都在传', description: '豪门夜话常驻听风人' },
    { name: '旧闻翻页小号', handle: '联姻味太浓了', description: '很会把旧账和新糖串起来' },
    { name: '车门前排目击者', handle: '扶那一下过界了', description: '最懂体面里的失控感' },
  ],
  apocalypse: [
    { name: '据点夜班路人', handle: '撤离名单不对劲', description: '末日站常驻守夜人' },
    { name: '通讯台旁听员', handle: '耳机里都听见了', description: '对紧绷关系异常敏锐' },
    { name: '物资表记录者', handle: '先护谁太明显', description: '擅长从分配细节里看偏心' },
  ],
  agency: [
    { name: '后台小群路人', handle: '流程表骗不了人', description: '事务所匿名楼常驻补料人' },
    { name: '行程单边角员工', handle: '接送味太重了', description: '对谁在照顾谁特别有感' },
    { name: '休息室门口旁听客', handle: '练习结束别装了', description: '最会顺手开一栋楼' },
  ],
};

export function buildSpectatorAuthorProfile(worldShell: SpectatorWorldShell, index: number) {
  const bank = SPECTATOR_AUTHOR_BANK[worldShell] || SPECTATOR_AUTHOR_BANK.campus;
  return bank[index % bank.length];
}

export function buildSpectatorRuntimeHandle(worldShell: SpectatorWorldShell, index: number, displayName?: string) {
  const bank = SPECTATOR_AUTHOR_BANK[worldShell] || SPECTATOR_AUTHOR_BANK.campus;
  const profile = bank[index % bank.length];
  const extraPool = ['先记一下', '今晚再扒', '路过存档', '我先蹲后续', '不敢说太满', '先嗑这一口'] as const;
  const cleanedName = (displayName || '')
    .replace(/\s+/g, '')
    .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, '')
    .slice(0, 3);
  const extra = extraPool[index % extraPool.length];

  if (!cleanedName || cleanedName === profile.name.slice(0, cleanedName.length)) {
    return profile.handle;
  }

  const merged = `${cleanedName}${extra}`.slice(0, 10);
  return merged || profile.handle;
}

export function parseSpectatorAuthorShell(authorId: string): SpectatorWorldShell {
  if (authorId.includes('_workplace_')) return 'workplace';
  if (authorId.includes('_xianmen_')) return 'xianmen';
  if (authorId.includes('_entertainment_')) return 'entertainment';
  if (authorId.includes('_manor_')) return 'manor';
  if (authorId.includes('_starnet_')) return 'starnet';
  if (authorId.includes('_weird_')) return 'weird';
  if (authorId.includes('_esports_')) return 'esports';
  if (authorId.includes('_showbiz_')) return 'showbiz';
  if (authorId.includes('_haoMen_')) return 'haoMen';
  if (authorId.includes('_apocalypse_')) return 'apocalypse';
  if (authorId.includes('_agency_')) return 'agency';
  return 'campus';
}
