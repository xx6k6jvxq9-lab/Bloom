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
];

export const FORUM_THREAD_TYPE_LABELS: Record<ForumThreadType, string> = {
  normal: '普通帖',
  rift: '裂隙帖',
  sameTopic: '同题帖',
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
];

export function getForumWorldTheme(channel: ForumChannel): ForumWorldTheme | undefined {
  return FORUM_WORLD_THEMES.find((theme) => theme.channel === channel);
}
