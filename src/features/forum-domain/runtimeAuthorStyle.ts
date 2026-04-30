import type { ForumChannel } from './types';

const NAME_BANK: Record<ForumChannel, string[]> = {
  junction: ['今天先不站队', '门口吃瓜但被叫号', '看热闹顺手补刀', '匿名区常住户', '先围观再发言', '瓜吃到自己头上'],
  present: ['今天也不想上班', '工位养胃失败', '地铁通勤失语', '深夜树洞常驻', '午休失败选手', '外卖备注成真'],
  oldDynasty: ['今夜不当体面人', '偏院听墙角', '门口守夜未归', '后宅见闻录', '灯下抄手札', '礼部今天也心累'],
  xianmen: ['今日又被心魔点名', '闭关失败已出山', '灵石不够还想看戏', '无情道观察员', '今夜又想破戒', '剑修路过但嘴硬'],
  otherworld: ['酒馆角落蹲委托', '冒险队临时后勤', '幼崽看护超时', '龙巢门口值夜', '公会前台想辞职', '旅店老板今天也在'],
  starSea: ['权限不足但想看', '白名单旁听生', '舰桥玻璃旁观众', '匹配度先别涨了', '监控死角住户', '值夜频道潜水员'],
  weird: ['凌晨三点还没睡', '先看规则第七条', '走廊尽头别回头', '电梯异常记录员', '白纸条别乱拿', '门外敲门先装睡'],
  cyber: ['日志别再翻了', '工位端口未拔', '监控盲区常客', '报错先怪加班', '内网旁听生', '回收站捡八卦'],
  apocalypse: ['夜班物资登记员', '避难所角落发呆', '今天先把灯省着', '巡夜回来说一句', '广播里别点我名', '口粮分配旁听生'],
  underworld: ['冥府门口等叫号', '忘川边上先旁听', '今夜别翻旧账', '判词没我想的快', '引魂路过不说破', '灯笼先别熄'],
  dragonPalace: ['夜巡水廊未归', '龙宫侧门听浪', '今日先不认旧约', '珠匣旁听生', '潮声底下偷听', '海宴散场太晚'],
  infiniteTower: ['这层又没睡成', '楼道补给先别抢', '通关前先看热闹', '队伍后排旁听生', '这层风评不对劲', '奖励先别分太早'],
  godCourt: ['今夜神谕先缓缓', '天规边上旁听生', '云阶尽头偷听', '司命笔下躲一躲', '神座外圈等散场', '先别给我降罚'],
  dreamStation: ['夜车还没到站', '换乘口发呆常客', '今夜又差点坐过', '梦站广播旁听生', '车窗倒影没睡醒', '站台风太轻'],
  bookCity: ['番外区潜水员', '设定边角旁听生', '这页先别撕', '作者手滑目击者', '章节缝里吃瓜', '今日先不出格'],
  beastPlain: ['巡夜火堆旁听生', '领地边缘发呆', '幼崽打架记录员', '换毛期少惹我', '先看风向再站队', '今夜兽群有瓜'],
};

const HANDLE_BANK: Record<ForumChannel, string[]> = {
  junction: ['门口吃瓜专座', '今日先不站队', '匿名区补刀位', '交界围观中', '先看后发言', '热帖门外蹲'],
  present: ['工位弄丢失败', '外卖备注成真', '工牌差点刷反', '午休总被抓包', '深夜树洞住户', '通勤耳机没电'],
  oldDynasty: ['偏院灯下听见了', '体面先放一边', '后宅门没关严', '今夜先不守礼', '廊下听见半句', '灯下先记一笔'],
  xianmen: ['闭关门口路过', '心魔今天加班', '灵石还是不够', '破戒边缘旁听', '剑穗先别乱晃', '道心暂时离线'],
  otherworld: ['酒馆账单未结', '公会前台路过', '龙巢门口值夜', '委托栏刚看完', '旅店后厨听见了', '幼崽别再乱跑'],
  starSea: ['白名单旁听生', '权限回收前先听', '舰桥旁听位', '匹配度先别升', '舷窗边偷看', '监控盲区住户'],
  weird: ['规则第七条先看', '走廊尽头别回头', '电梯异常记录', '门外敲门未应答', '白纸条不要捡', '凌晨三点别开门'],
  cyber: ['日志别再翻了', '工位端口未拔', '监控盲区旁听', '报错先怪加班', '内网论坛潜水', '回收站翻到瓜'],
  apocalypse: ['口粮先别多领', '巡夜回来再说', '广播别点我名', '夜班登记路过', '避难所门口听见', '灯先别全开'],
  underworld: ['忘川边上旁听', '判词先别下太快', '引魂路过听见', '灯笼别先灭', '冥府门口路过', '旧账先缓缓'],
  dragonPalace: ['旧约先别提', '海廊边上旁听', '夜巡水廊未归', '珠匣刚刚合上', '浪头底下听见', '宴散后门见闻'],
  infiniteTower: ['奖励先别急分', '楼道补给旁听', '通关前先别吵', '后排旁听位', '这层先别开团', '风评不太对劲'],
  godCourt: ['天规先缓一缓', '云阶尽头旁听', '司命笔下留名', '神座外圈偷听', '今夜先别降罚', '神谕还没落地'],
  dreamStation: ['换乘口还没走', '梦站广播听见', '今夜差点坐过', '站台边上旁听', '车窗倒影没睡', '到站前先发言'],
  bookCity: ['番外区潜水中', '设定边角听见', '这页先别撕', '章节缝里围观', '作者手滑目击', '今日先不出格'],
  beastPlain: ['领地边缘旁听', '巡夜火堆边上', '换毛期先别惹', '幼崽打架记录', '今晚兽群有瓜', '风向不对先蹲'],
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickFromBank(channel: ForumChannel, seed: string, bank: Record<ForumChannel, string[]>) {
  const candidates = bank[channel] || bank.junction;
  return candidates[hashString(`${channel}:${seed}`) % candidates.length];
}

export function looksMachineGeneratedForumHandle(value?: string) {
  if (!value) return true;
  return /forum_runtime|generated-post|seed-|user\d|^u[_\d]|[_]{2,}|[A-Za-z]{6,}\d{3,}/i.test(value) || value.length > 18;
}

export function looksMachineGeneratedForumName(value?: string) {
  if (!value) return true;
  return /forum_runtime|generated|^用户|^网友\d|user\d|[A-Za-z]{5,}\d{2,}/i.test(value) || value.length > 12;
}

export function buildHumanizedForumIdentity(input: {
  channel: ForumChannel;
  seed: string;
  rawDisplayName?: string;
  rawHandle?: string;
  persona?: string;
}) {
  const seedBase = `${input.seed}:${input.rawDisplayName || ''}:${input.rawHandle || ''}:${input.persona || ''}`;
  const displayName = looksMachineGeneratedForumName(input.rawDisplayName)
    ? pickFromBank(input.channel, `${seedBase}:name`, NAME_BANK)
    : (input.rawDisplayName || '').trim();
  const handle = looksMachineGeneratedForumHandle(input.rawHandle)
    ? pickFromBank(input.channel, `${seedBase}:handle`, HANDLE_BANK)
    : (input.rawHandle || '').replace(/^@/, '').trim();

  return {
    displayName: displayName || pickFromBank(input.channel, `${seedBase}:fallback-name`, NAME_BANK),
    handle: handle || pickFromBank(input.channel, `${seedBase}:fallback-handle`, HANDLE_BANK),
  };
}
