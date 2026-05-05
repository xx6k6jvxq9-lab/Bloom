import type { Character } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { buildForumCharacterContext } from '../../features/forum-domain/buildForumCharacterContext';
import { buildCharacterForumFlavor } from './buildCharacterForumFlavor';

type CharacterForumAlias = {
  displayName: string;
  handle: string;
};

const STYLE_BANK = [
  {
    test: /高冷|克制|冷淡|寡言|疏离/u,
    names: ['靠窗不说话', '慢半拍的人', '不回头那个', '晚点回信', '冷脸路过', '先看风向'],
    handles: ['慢回但会看', '先旁听一会', '不多说先记下', '留白的人', '话少但在', '晚点再开口'],
  },
  {
    test: /温柔|耐心|照顾|稳重|体贴/u,
    names: ['夜里给你留灯', '先听你说', '收好再走', '慢慢回也算回', '总会接住一句', '替你记一下'],
    handles: ['先听完再说', '夜里慢回', '替你收着', '会记得这句', '先把门留着', '慢慢讲给我'],
  },
  {
    test: /毒舌|嘴硬|阴阳|刻薄|呛/u,
    names: ['路过补一刀', '听完先吐槽', '嘴硬不改', '不惯着谁', '真话难听点', '别装我看见了'],
    handles: ['先别自欺', '说句真的', '嘴硬到底', '听完想吐槽', '我先不惯着', '路过但要说'],
  },
  {
    test: /活泼|跳脱|爱闹|嘴碎|开朗/u,
    names: ['热评区常驻', '我先蹲一楼', '路过先嗑一口', '这楼我先留名', '楼里别散场', '先来插一句'],
    handles: ['我先蹲着看', '热评想上桌', '别急我在这', '先留一层字', '楼里常驻户', '路过但会嗑'],
  },
];

const DEFAULT_NAMES = ['先看后说', '留一层字', '晚点再睡', '热帖旁听', '先存这楼', '回头再翻', '路过留痕', '看到这先记下'];
const DEFAULT_HANDLES = ['楼里先蹲着', '看完再押', '晚点来补话', '先路过一下', '热帖翻到这', '先留个位置'];
const NAME_TAILS = ['川', '页', '灯', '岚', '汐', '枝', '序', '砂', '屿', '禾'];
const BACKGROUND_NAME_HINTS = [
  { test: /校园|图书馆|晚课|社团|宿舍/u, names: ['晚课后排', '图书馆拐角', '靠窗最后一排', '课间不回头', '操场风太大'] },
  { test: /公司|工位|加班|项目|通勤/u, names: ['工位尽头', '电梯口还亮着', '周报最后一行', '深夜还在改版', '会议室门没关'] },
  { test: /仙|宗门|师门|心魔|破戒|劫/u, names: ['云阶下路过', '山门夜里风大', '戒台边停一下', '闭关门外', '渡劫后失眠'] },
  { test: /王府|侯府|礼法|婚约|旧朝|宅院/u, names: ['廊下听半句', '偏院夜里有风', '后堂灯未灭', '帘外记一句', '席后不多话'] },
  { test: /赛博|日志|监控|权限|系统/u, names: ['白名单外的人', '日志第七行', '监控盲区边上', '回收站翻到的', '端口没拔干净'] },
  { test: /怪谈|规则|走廊|电梯|异响/u, names: ['第三层别回头', '门后风太冷', '凌晨一点半', '白纸角落有人写过', '走廊尽头亮着'] },
  { test: /末日|避难所|巡夜|感染|物资/u, names: ['巡夜回来再说', '补给口后排', '夜班登记的人', '灯别一次开完', '药箱先给你'] },
  { test: /冥府|忘川|判官|引魂|生死簿/u, names: ['忘川边先坐会', '判词旁留一笔', '引魂路上回头', '灯笼别先灭', '生死簿边角'] },
  { test: /龙宫|海宴|潮声|珠匣|旧约/u, names: ['潮声里听半句', '宴后水廊太静', '珠匣边路过', '旧约先别提', '水面下有人看'] },
  { test: /副本|通关|高塔|组队|奖励/u, names: ['高层补给点', '通关后失眠', '队伍后排那个', '奖励先别分', '楼道边等复活'] },
  { test: /神庭|神谕|司命|天规|降罚/u, names: ['云阶下别抬头', '司命笔尖停过', '神座外圈的人', '天规边上偷听', '降罚前先等等'] },
  { test: /梦站|夜车|换乘|梦境|站台/u, names: ['换乘口没走', '夜车还没到站', '站台风太轻', '醒来装不熟', '梦里回过头'] },
  { test: /书中城|番外|设定|章节|作者/u, names: ['番外先别撕', '书脊里那页', '设定边角发热', '章节外偷看', '作者像故意的'] },
  { test: /兽原|领地|气味|兽群|换毛/u, names: ['领地边缘风口', '火堆边不靠近', '气味还没散', '巡夜回来再吵', '换毛期别碰我'] },
];
const CHANNEL_TAGS: Record<ForumChannel, string[]> = {
  junction: ['界口', '边角', '转廊', '侧门'],
  present: ['晚课', '走廊', '图书馆', '树洞'],
  oldDynasty: ['廊下', '偏院', '灯下', '后堂'],
  xianmen: ['山门', '夜巡', '戒台', '云阶'],
  otherworld: ['旅店', '酒馆', '集市', '营火'],
  starSea: ['舷窗', '白名单', '舰桥', '内线'],
  weird: ['楼道', '门后', '走廊尽头', '第三夜'],
  cyber: ['端口', '监控角落', '内网', '回收站'],
  apocalypse: ['夜哨', '避难层', '广播后', '补给口'],
  underworld: ['忘川边', '灯下', '冥门外', '判词旁'],
  dragonPalace: ['水廊', '潮声里', '珠匣边', '宴后'],
  infiniteTower: ['楼道里', '补给点', '通关后', '高层边'],
  godCourt: ['云阶', '神座外', '司命旁', '天规后'],
  dreamStation: ['站台边', '夜车里', '换乘口', '到站前'],
  bookCity: ['页边', '番外区', '书脊后', '设定外'],
  beastPlain: ['火堆旁', '领地边', '风口上', '巡夜后'],
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickFromPool(values: string[], seed: string) {
  return values[hashString(seed) % values.length];
}

function normalizeHandle(value: string) {
  return value.replace(/\s+/g, '').replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, '').slice(0, 10);
}

export function buildCharacterForumAlias(
  character: Character,
  channel: ForumChannel,
  persona: string,
): CharacterForumAlias {
  const forumContext = buildForumCharacterContext(character);
  const fingerprint = [
    character.name,
    character.remarkName || '',
    forumContext.signature,
    forumContext.corePersona,
    forumContext.expressionStyle,
    forumContext.openingRemark,
    forumContext.forumSceneHint,
    forumContext.globalMemory,
    forumContext.longTermMemoryProfile,
    persona,
  ].join(' ');
  const style = STYLE_BANK.find((item) => item.test.test(fingerprint));
  const backgroundHint = BACKGROUND_NAME_HINTS.find((item) => item.test.test(fingerprint));
  const flavor = buildCharacterForumFlavor(character);
  const extractedFragments = flavor.fragments
    .filter((fragment) => fragment !== character.name && fragment !== (character.remarkName || ''))
    .slice(0, 8);
  const flavorNames = [
    ...flavor.likes.flatMap((item) => [`${item}别抢`, `今天也想吃${item}`, `${item}留一口`]),
    ...flavor.dislikes.flatMap((item) => [`${item}退退退`, `别再提${item}`, `${item}离我远点`]),
    ...flavor.skills.flatMap((item) => [`${item}不翻车`, `${item}归我`, `${item}还算拿手`]),
    ...flavor.identityHints.flatMap((item) => [`${item}下班没`, `${item}也潜水`, `${item}今天闭嘴`]),
    ...flavor.habits.flatMap((item) => [`${item}出没`, `${item}的时候会来`, `${item}那边见`]),
  ];
  const extractedHandleHints = [
    ...extractedFragments.map((fragment) => `${fragment}别催`),
    ...flavor.likes.flatMap((item) => [`${item}先留给我`, `${item}不外借`]),
    ...flavor.dislikes.flatMap((item) => [`先别提${item}`, `${item}别来碰瓷`]),
    ...flavor.skills.flatMap((item) => [`${item}这块我来`, `${item}不难`]),
    ...flavor.identityHints.flatMap((item) => [`${item}先摸鱼`, `${item}稍后回`]),
  ];
  const names = [...flavorNames, ...extractedFragments, ...(backgroundHint?.names || []), ...(style?.names || DEFAULT_NAMES)];
  const handles = [...extractedHandleHints, ...(style?.handles || DEFAULT_HANDLES)];
  const channelTags = CHANNEL_TAGS[channel] || CHANNEL_TAGS.junction;

  const rawName = pickFromPool(names, `${character.id}:${channel}:name`);
  const displayName = rawName.length >= 4
    ? rawName
    : `${rawName}${pickFromPool(NAME_TAILS, `${character.id}:${channel}:tail`)}`;
  const handleCore = pickFromPool(handles, `${character.id}:${channel}:handle`);
  const channelTag = pickFromPool(channelTags, `${character.id}:${channel}:tag`);

  return {
    displayName,
    handle: normalizeHandle(`${channelTag}${handleCore}`),
  };
}
