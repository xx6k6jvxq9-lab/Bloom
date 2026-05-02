import type { ForumChannel, ForumContentTier, ForumThreadType } from '../../features/forum-domain/types';

type BuildForumPostTagsInput = {
  title: string;
  body: string;
  threadType?: ForumThreadType;
  contentTier?: ForumContentTier;
  discourseAxis?: string;
  channel?: ForumChannel;
};

const THREAD_TYPE_TAGS: Partial<Record<ForumThreadType, string[]>> = {
  normal: ['路过问问', '这事怪吗', '日常发酵'],
  gossip: ['路过吃瓜', '风声很大', '别太当真'],
  help: ['求个建议', '真的想问', '救救我'],
  commission: ['认真求助', '带条件问', '真有点急'],
  sameTopic: ['同款来认', '我也有过', '隔壁联动'],
  sighting: ['我真看见', '现场路过', '目击一下'],
  timeline: ['我来整理', '时间线补全', '越盘越怪'],
  essay: ['片段脑补', '代餐一下', '余味很长'],
  vote: ['站哪边啊', '开盘一下', '你押谁'],
  reversal: ['这就翻车', '后续反转', '前面错了'],
  ownerUpdate: ['楼主补充', '我又来了', '后续在这'],
  rift: ['这不对劲', '味太怪了', '别区也在聊'],
};

const CONTENT_TIER_TAGS: Record<ForumContentTier, string[]> = {
  baseline: ['普通但真', '越想越怪', '有点那个'],
  ferment: ['评论会吵', '这楼能烧', '后劲上来'],
  highlight: ['高光一句', '全楼看这', '这句太准'],
  fragment: ['短短一口', '一小段就够', '碎片很真'],
};

const CHANNEL_TAGS: Record<string, string[]> = {
  campus: ['校园墙', '食堂见闻', '宿舍夜聊'],
  workplace: ['工位吃瓜', '下班再说', '会议室风声'],
  entertainment: ['超话体感', '营业味重', '路透一下'],
  xianxia: ['仙门这味', '灵脉不稳', '护道过界'],
  dream: ['梦站碎片', '醒后余震', '这梦不对'],
  abyss: ['异域现场', '契约后劲', '领地感重'],
  sciFi: ['权限异常', '白名单味', '频道泄露'],
  weird: ['规则怪谈', '越想越凉', '监控别看'],
  junction: ['镜间围观', '别人怎么看', '这楼有味'],
};

const KEYWORD_TAG_RULES: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /已读不回|不回消息|不读不回/u, tags: ['已读不回', '消息冷战'] },
  { pattern: /早餐|夜宵|投喂|喂饭|送饭/u, tags: ['投喂过界', '日常偏心'] },
  { pattern: /护|挡|拉到怀里|先护|偏心/u, tags: ['护短现场', '偏心得很'] },
  { pattern: /嘴硬|不承认|装没事|说不是/u, tags: ['嘴硬预警', '不认也算'] },
  { pattern: /前任|旧账|以前|之前/u, tags: ['旧账翻出', '前情未了'] },
  { pattern: /目击|看见|撞见|路过|现场/u, tags: ['现场看到', '我真路过'] },
  { pattern: /吃醋|醋|酸|占有|不让/u, tags: ['醋味上来', '占有欲犯'] },
  { pattern: /朋友圈|背景|白名单|权限|备注/u, tags: ['细节露馅', '权限偏爱'] },
  { pattern: /暧昧|拉扯|试探|回头|眼神/u, tags: ['拉扯感重', '回头太快'] },
  { pattern: /宿敌|要散没|敌对|对呛/u, tags: ['宿敌特供', '越吵越有'] },
];

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickBySeed<T>(items: T[], seed: string, count: number) {
  if (!items.length || count <= 0) return [] as T[];
  const pool = [...items];
  const picked: T[] = [];
  let cursor = hashString(seed);
  while (pool.length > 0 && picked.length < count) {
    const index = cursor % pool.length;
    picked.push(pool.splice(index, 1)[0]);
    cursor = hashString(`${cursor}:${picked.length}:${seed}`);
  }
  return picked;
}

export function buildForumPostFooterTags(input: BuildForumPostTagsInput) {
  const text = `${input.title} ${input.body} ${input.discourseAxis || ''}`.replace(/\s+/g, ' ').trim();
  const seed = `${input.threadType || 'normal'}:${input.contentTier || 'baseline'}:${text.slice(0, 80)}`;
  const tags: string[] = [];

  const pushTag = (value?: string) => {
    const normalized = (value || '').replace(/^#/, '').trim();
    if (!normalized) return;
    if (normalized.length < 2 || normalized.length > 8) return;
    if (tags.includes(normalized)) return;
    tags.push(normalized);
  };

  pickBySeed(THREAD_TYPE_TAGS[input.threadType || 'normal'] || THREAD_TYPE_TAGS.normal || [], `${seed}:type`, 1).forEach(pushTag);
  pickBySeed(CONTENT_TIER_TAGS[input.contentTier || 'baseline'] || [], `${seed}:tier`, 1).forEach(pushTag);

  KEYWORD_TAG_RULES.forEach((rule) => {
    if (rule.pattern.test(text) && tags.length < 4) {
      pickBySeed(rule.tags, `${seed}:${rule.pattern}`, 1).forEach(pushTag);
    }
  });

  if (tags.length < 3) {
    pickBySeed(CHANNEL_TAGS[input.channel || 'junction'] || CHANNEL_TAGS.junction || [], `${seed}:channel`, 1).forEach(pushTag);
  }

  if (tags.length < 2) {
    ['楼里再聊', '这句很怪', '别急下结论'].forEach((item) => {
      if (tags.length < 3) pushTag(item);
    });
  }

  return tags.slice(0, 3);
}

export function appendForumPostFooterTags(content: string, input: BuildForumPostTagsInput) {
  const normalized = content.trim();
  if (!normalized) return normalized;
  if (/#([\p{Script=Han}A-Za-z0-9_]{1,12})/u.test(normalized)) return normalized;
  const tags = buildForumPostFooterTags(input);
  if (tags.length < 2) return normalized;
  return `${normalized}\n\n${tags.map((tag) => `#${tag}`).join(' ')}`;
}
