import type { ForumChannel, ForumThreadType, ForumWorldTheme } from './types';

export const FORUM_CHANNEL_LABELS: Record<ForumChannel, string> = {
  junction: '交界',
  present: '今世',
  oldDynasty: '旧朝',
  xianmen: '仙门',
  otherworld: '异域',
  starSea: '星海',
  weird: '怪谈',
  cyber: '赛博城',
  apocalypse: '末日',
  underworld: '冥府',
  dragonPalace: '龙宫',
  infiniteTower: '无限楼',
  godCourt: '神庭',
  dreamStation: '梦站',
  bookCity: '书中城',
  beastPlain: '兽原',
};

export const FORUM_DEFAULT_CHANNELS: ForumChannel[] = [
  'junction',
  'present',
  'oldDynasty',
  'xianmen',
  'otherworld',
  'starSea',
  'weird',
  'cyber',
  'apocalypse',
  'underworld',
  'dragonPalace',
  'infiniteTower',
  'godCourt',
  'dreamStation',
  'bookCity',
  'beastPlain',
];

export const FORUM_THREAD_TYPE_LABELS: Record<ForumThreadType, string> = {
  normal: '普通帖',
  gossip: '爆料帖',
  help: '求助帖',
  rift: '裂隙帖',
  sameTopic: '同题帖',
  sighting: '目击帖',
  timeline: '记录帖',
  essay: '片段帖',
  vote: '投票帖',
  commission: '委托帖',
  reversal: '反转帖',
  ownerUpdate: '楼主补充',
};

export const FORUM_WORLD_THEMES: ForumWorldTheme[] = [
  {
    channel: 'junction',
    label: '交界',
    coreConflicts: ['跨世界误解', '不同价值观对撞', '同题不同解'],
    toneKeywords: ['公开讨论', '混杂视角', '跨界围观'],
    exampleTopics: [
      '怎么判断一个人喜欢你？',
      '占有欲到底算不算爱？',
      '谁家前任杀伤力最大？',
    ],
  },
  {
    channel: 'present',
    label: '今世',
    coreConflicts: ['暧昧', '已读不回', '打工发疯'],
    toneKeywords: ['都市感', '网感强', '嘴硬'],
    exampleTopics: [
      '对象嘴上说不喜欢我，但连我几点睡都要管。',
      '上司每天嘴毒但只给我带早饭。',
      '暧昧对象把我朋友圈翻到三年前。',
    ],
  },
  {
    channel: 'oldDynasty',
    label: '旧朝',
    coreConflicts: ['名分', '礼法', '身份差'],
    toneKeywords: ['古风', '克制', '礼法与私情'],
    exampleTopics: [
      '世子说只是照拂，却连我晚膳都要问。',
      '夫君说不爱我，却把妾室全遣散了。',
    ],
  },
  {
    channel: 'xianmen',
    label: '仙门',
    coreConflicts: ['道心', '破戒', '心魔'],
    toneKeywords: ['修仙', '冷感偏爱', '道侣张力'],
    exampleTopics: [
      '师兄修无情道，却日日查我灵脉。',
      '师尊闭关前只给我留了本心法。',
    ],
  },
  {
    channel: 'otherworld',
    label: '异域',
    coreConflicts: ['种族差异', '契约', '跨种族关系'],
    toneKeywords: ['冒险感', '异世界', '轻奇幻'],
    exampleTopics: [
      '捡到一只魔王幼崽，它非要跟我回家。',
      '龙族队友总睡在我门口，说是守夜。',
    ],
  },
  {
    channel: 'starSea',
    label: '星海',
    coreConflicts: ['匹配度', '权限', '精神链接'],
    toneKeywords: ['星际', '冷感控制', '高权限偏爱'],
    exampleTopics: [
      '匹配度 99%，但他说只是系统误差。',
      '指挥官把我加入最高权限名单，还说不熟。',
    ],
  },
  {
    channel: 'weird',
    label: '怪谈',
    coreConflicts: ['规则', '禁忌', '恐怖中的例外'],
    toneKeywords: ['诡异', '午夜感', '危险偏爱'],
    exampleTopics: [
      '规则说不能相信他，但他每次都在救我。',
      '凌晨 3:17 有人敲门，可我没有室友。',
    ],
  },
  {
    channel: 'cyber',
    label: '赛博城',
    coreConflicts: ['权限偏爱', '监控', '程序失控'],
    toneKeywords: ['赛博', '权限隐喻', '数据关系'],
    exampleTopics: [
      '仿生人管家擅自把我的危险权限关了。',
      '公司上司把我的监控权限调成最高。',
    ],
  },
  {
    channel: 'apocalypse',
    label: '末日',
    coreConflicts: ['物资分配', '避难所关系', '感染猜疑'],
    toneKeywords: ['求生感', '紧绷', '护人与牺牲'],
    exampleTopics: [
      '他把最后一支退烧针塞给我，还说只是顺手。',
      '巡夜名单每次都把我放在自己后面，这正常吗？',
    ],
  },
  {
    channel: 'underworld',
    label: '冥府',
    coreConflicts: ['旧账未了', '判词偏袒', '阴阳两隔'],
    toneKeywords: ['阴冷', '宿命感', '旧情翻出'],
    exampleTopics: [
      '判官说公事公办，却把我的名字从生死簿边上划掉了。',
      '引魂路上有人一路护着我，还装作没认出来。',
    ],
  },
  {
    channel: 'dragonPalace',
    label: '龙宫',
    coreConflicts: ['旧约', '婚配', '身份压制'],
    toneKeywords: ['华丽', '潮湿', '古艳关系'],
    exampleTopics: [
      '龙君说只是旧约照看，但我住处门口夜夜有水卫守着。',
      '海宴上他只给我留了那颗避水珠，这算什么？',
    ],
  },
  {
    channel: 'infiniteTower',
    label: '无限楼',
    coreConflicts: ['组队绑定', '通关分配', '危险偏爱'],
    toneKeywords: ['副本感', '高压', '生死同行'],
    exampleTopics: [
      '队长说别拖后腿，结果把唯一保命道具塞给我了。',
      '同伴平时最烦我，进副本却永远先确认我活着。',
    ],
  },
  {
    channel: 'godCourt',
    label: '神庭',
    coreConflicts: ['神谕偏心', '天规越界', '降罚与护短'],
    toneKeywords: ['高位感', '肃冷', '禁忌偏爱'],
    exampleTopics: [
      '神官说不能偏私，却替我压了整整三道天罚。',
      '司命当众翻脸，私下却把我的命格改回来了。',
    ],
  },
  {
    channel: 'dreamStation',
    label: '梦站',
    coreConflicts: ['错站重逢', '梦境掉马', '暧昧失联'],
    toneKeywords: ['轻悬浮', '夜车感', '暧昧漂流'],
    exampleTopics: [
      '每次梦站换乘都能碰见同一个人，他是不是故意的？',
      '他在梦里认得我，醒来却装作第一次见。',
    ],
  },
  {
    channel: 'bookCity',
    label: '书中城',
    coreConflicts: ['角色出格', '设定崩坏', '作者偏爱'],
    toneKeywords: ['元叙事', '纸面感', '失控张力'],
    exampleTopics: [
      '某角色疑似自己改剧情了，我不是开玩笑。',
      '作者说他没私心，那为什么番外总是单给我写？',
    ],
  },
  {
    channel: 'beastPlain',
    label: '兽原',
    coreConflicts: ['领地边界', '标记误会', '本能压制'],
    toneKeywords: ['野性', '直觉感', '护短很重'],
    exampleTopics: [
      '他嘴上说烦我，换毛期却只肯让我靠近。',
      '同伴说别误会，但他在领地边上只给我留了气味。',
    ],
  },
];

export function getForumWorldTheme(channel: ForumChannel): ForumWorldTheme | undefined {
  return FORUM_WORLD_THEMES.find((theme) => theme.channel === channel);
}
