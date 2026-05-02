import { FORUM_THREAD_TYPE_LABELS } from './constants';
import type { ForumChannel, ForumThreadType } from './types';

export const FORUM_CHANNEL_TABS: Array<{
  id: ForumChannel;
  label: string;
  blurb: string;
}> = [
  { id: 'junction', label: '交界', blurb: '跨世界公共区' },
  { id: 'present', label: '今世', blurb: '都市、校园、职场和匿名日常' },
  { id: 'oldDynasty', label: '旧朝', blurb: '宫墙门第、宅院旧事和朝堂风声' },
  { id: 'xianmen', label: '仙门', blurb: '宗门历劫、道心破戒和山门夜话' },
  { id: 'otherworld', label: '异域', blurb: '公会旅店、圣堂集市和种族杂谈' },
  { id: 'starSea', label: '星海', blurb: '舰桥航线、权限名单和精神链接' },
  { id: 'weird', label: '怪谈', blurb: '规则传闻、夜半目击和异常记录' },
  { id: 'cyber', label: '赛博城', blurb: '内网事故、监控盲区和越权日志' },
  { id: 'apocalypse', label: '末日', blurb: '避难所琐事、巡夜名单和拾荒委托' },
  { id: 'underworld', label: '冥府', blurb: '判词旧账、引魂路闻和阴间公务' },
  { id: 'dragonPalace', label: '龙宫', blurb: '海宴水廊、旧约婚配和潮声秘闻' },
  { id: 'infiniteTower', label: '无限楼', blurb: '副本组队、奖励分配和高层传闻' },
  { id: 'godCourt', label: '神庭', blurb: '神谕命格、天规边界和云阶风声' },
  { id: 'dreamStation', label: '梦站', blurb: '夜车换乘、梦境错站和醒后失联' },
  { id: 'bookCity', label: '书中城', blurb: '章节番外、设定失控和角色掉马' },
  { id: 'beastPlain', label: '兽原', blurb: '领地巡夜、气味误会和兽群闲谈' },
];

export const FORUM_FILTER_THREAD_TYPES: ForumThreadType[] = [
  'normal',
  'gossip',
  'help',
  'commission',
  'sameTopic',
  'sighting',
  'timeline',
  'essay',
  'vote',
  'rift',
  'reversal',
  'ownerUpdate',
];

const FORUM_THREAD_TYPE_STYLES: Record<ForumThreadType, string> = {
  normal: 'border border-zinc-200 bg-white text-zinc-700',
  gossip: 'border border-rose-200 bg-rose-50 text-rose-700',
  help: 'border border-amber-200 bg-amber-50 text-amber-700',
  commission: 'border border-orange-200 bg-orange-50 text-orange-700',
  sameTopic: 'border border-sky-200 bg-sky-50 text-sky-700',
  sighting: 'border border-violet-200 bg-violet-50 text-violet-700',
  timeline: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  essay: 'border border-pink-200 bg-pink-50 text-pink-700',
  vote: 'border border-indigo-200 bg-indigo-50 text-indigo-700',
  rift: 'border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  reversal: 'border border-red-200 bg-red-50 text-red-700',
  ownerUpdate: 'border border-teal-200 bg-teal-50 text-teal-700',
};

export function getForumThreadTypeMeta(threadType?: string) {
  const normalized = FORUM_FILTER_THREAD_TYPES.includes(threadType as ForumThreadType)
    ? threadType as ForumThreadType
    : 'normal';

  return {
    label: FORUM_THREAD_TYPE_LABELS[normalized],
    className: FORUM_THREAD_TYPE_STYLES[normalized],
  };
}
