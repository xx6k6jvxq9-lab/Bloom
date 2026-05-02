import type { ForumChannel, ForumThreadType } from '../../features/forum-domain/types';

const CHANNEL_TOPIC_BUCKETS: Record<ForumChannel, string[]> = {
  junction: ['匿名掉马', '公共区互呛', '护短被看出来', '跨频道围观', '旧事翻车', '熟人装路人', '论坛社死', '权限没收回', '同一问题跨世界吵起来', '一个楼把两边都得罪了'],
  present: ['已读不回', '朋友圈秒赞', '室友边界', '打工人关系', '前任返场', '暧昧拉扯', '树洞社死', '相亲翻车', '校园委托', '同事匿名投稿'],
  oldDynasty: ['名分拉扯', '后宅误会', '婚约体面', '王府照拂', '席间失态', '家宴站队', '退婚风波', '私下护短', '手札旧账', '夜里更衣目击'],
  xianmen: ['闭关前后', '破戒迹象', '心魔失控', '道侣误读', '灵脉照看', '师门偏心', '历劫事故', '无情道嘴硬', '悬赏灵草', '山门夜巡目击'],
  otherworld: ['冒险队夜守', '契约边界', '公会委托', '幼崽粘人', '龙族宣示', '跨种族误会', '圣堂事故', '旅店八卦', '赏金单风波', '集市偶遇'],
  starSea: ['白名单异常', '权限越界', '匹配度嘴硬', '舰桥目光', '精神海波动', '作战链偏爱', '保密协定', '冷脸护人', '系统投票', '航线事故记录'],
  weird: ['规则更新', '门外敲门', '电梯异常', '走廊脚步', '旧楼广播', '白纸规则', '活人误入', '例外保护', '夜里投稿', '目击楼层不对劲'],
  cyber: ['日志越权', '监控盯人', '仿生人边界', '系统冻结', '权限回收', '数据误删', '替你决定', '内网事故', '黑市委托', '论坛截图复盘'],
  apocalypse: ['物资分配', '避难所关系', '巡夜轮班', '感染猜疑', '旧信号', '拾荒队委托', '断电后目击', '补给楼投票', '广播站失联', '最后一针该给谁'],
  underworld: ['引魂误会', '判官偏袒', '名册异常', '忘川旧事', '冥灯失火', '生魂求助', '押送路上目击', '旧债投票', '阴差匿名爆料', '判词复盘'],
  dragonPalace: ['婚配旧约', '龙鳞忌讳', '海宴风波', '赐珠误解', '夜巡偏心', '水卫委托', '潮声目击', '龙宫八卦', '旧约投票', '避水珠失主'],
  infiniteTower: ['层数事故', '队友绑定', '奖励分配', '通关嘴硬', '危险提示', '副本委托', '高层目击', '路线复盘', '队长投票', '补给点爆料'],
  godCourt: ['神谕偏心', '司命失笔', '神庭宴席', '降罚护短', '天规空子', '供奉委托', '云阶目击', '命格复盘', '神官投票', '天罚后续'],
  dreamStation: ['梦站偶遇', '转乘失联', '梦境掉马', '夜车目击', '错站重逢', '寻人委托', '旧梦记录', '站台匿名爆料', '梦里投票', '换乘路线复盘'],
  bookCity: ['角色出格', '章节改命', '作者偏爱', '番外事故', '设定穿帮', '补设定委托', '页边目击', '剧情时间线', '角色站队投票', '读者爆料'],
  beastPlain: ['兽群守夜', '标记误会', '幼崽认人', '领地争执', '换毛期嘴硬', '巡猎委托', '风口目击', '痕迹复盘', '首领投票', '火堆边匿名楼'],
};

const CHANNEL_WRITING_GUIDES: Record<ForumChannel, string[]> = {
  junction: ['要像公开论坛，口气混杂，有看热闹也有认真分析。', '容易出现跨世界比喻、串台感和“你们那边也这样？”的说法。'],
  present: ['多用生活细节、打工和校园的顺手吐槽感。', '标题和正文都可以更口语，不要端着。'],
  oldDynasty: ['可以克制，但不要像文案，应像后宅、席间、手札传闻。', '多用礼法、名分、体面、偏心这些旧朝语境。'],
  xianmen: ['要有山门、心法、历劫、破戒这些修仙场景词。', '情绪偏冷，动作细节要比直白表白更有效。'],
  otherworld: ['要带冒险队、公会、旅店、契约、种族差异的轻奇幻日常。', '可以有委托、赏金、队友夜守这种游戏感情境。'],
  starSea: ['多写权限、名单、航线、匹配度、舰桥这种未来感词汇。', '氛围偏高权限冷感，不要像纯现世职场。'],
  weird: ['要像目击帖、规则贴、夜里树洞，留白比解释更有效。', '不要把恐怖说破，要让楼里人自己补完。'],
  cyber: ['多用工位、项目组、门禁、终端、监控、日志、内网这些具体词，不要只飘赛博黑话。', '赛博城首先要像公司内网和城市系统边角的人在发帖，其次才是赛博味。'],
  apocalypse: ['需要紧迫感，物资、巡夜、感染、广播这些是日常。', '关系张力常常通过分配、护人、牺牲体现。'],
  underworld: ['要有旧账、判词、生死簿、引魂路这些冥府语感。', '像阴间公务体系里的私人偏爱。'],
  dragonPalace: ['要有潮湿华丽感，海宴、水廊、珠匣、旧约。', '不要写成普通古风。'],
  infiniteTower: ['要有副本、通关、组队、奖励分配的紧张感。', '关系张力经常出现在生死同行和保命道具里。'],
  godCourt: ['要有高位、神谕、天规、降罚、司命这种压迫感。', '感情是藏在规矩和越界里，不是直白黏糊。'],
  dreamStation: ['要有夜车、站台、换乘、梦里相认的漂浮感。', '可以暧昧，但别写成普通都市恋爱。'],
  bookCity: ['要有元叙事感，角色、章节、番外、设定自己跑偏。', '读者视角和角色视角可以混一点。'],
  beastPlain: ['要有领地、气味、守夜、换毛期、幼崽等野性感。', '护短和本能反应要比人类嘴炮更重。'],
};

const CHANNEL_VOCAB_HINTS: Record<ForumChannel, string[]> = {
  junction: ['串台', '掉马', '披皮', '热楼', '跨区', '路过补一句'],
  present: ['已读不回', '顺手', '楼下等', '工位', '宿舍', '朋友圈'],
  oldDynasty: ['体面', '照拂', '席间', '名分', '后院', '家宴'],
  xianmen: ['历劫', '破戒', '心法', '山门', '夜巡', '清心'],
  otherworld: ['委托单', '旅店', '公会', '守夜', '赏金', '圣堂'],
  starSea: ['白名单', '权限', '舰桥', '航线', '匹配度', '内线'],
  weird: ['规则', '走廊尽头', '凌晨', '目击', '纸条', '别回头'],
  cyber: ['工位', '项目组', '门禁', '日志', '监控', '终端'],
  apocalypse: ['补给', '巡夜', '广播', '感染', '避难层', '断电'],
  underworld: ['判词', '旧账', '引魂', '名册', '冥灯', '生死簿'],
  dragonPalace: ['海宴', '潮声', '旧约', '珠匣', '水廊', '水卫'],
  infiniteTower: ['副本', '通关', '组队', '保命道具', '补给点', '高层'],
  godCourt: ['神谕', '天规', '司命', '降罚', '命格', '云阶'],
  dreamStation: ['夜车', '换乘', '站台', '错站', '到站前', '梦里'],
  bookCity: ['番外', '章节', '设定', '掉马', '作者手滑', '剧情线'],
  beastPlain: ['领地', '气味', '守夜', '换毛期', '风口', '幼崽'],
};

const CHANNEL_REPEAT_AVOIDANCE: Record<ForumChannel, string[]> = {
  junction: ['不要总写泛泛的“关系判断”，至少带一个具体论坛事故。'],
  present: ['不要老写暧昧嘴硬，穿插室友、同事、家人群、打工和社死后续。'],
  oldDynasty: ['不要每条都在婚约和世子之间打转，加入家宴、抄录、手札、退婚和照拂账。'],
  xianmen: ['不要连续都写道侣，加入悬赏、灵脉、闭关、夜巡和破戒后续。'],
  otherworld: ['不要只写龙族，混入公会、幼崽、赏金、圣堂和旅店夜守。'],
  starSea: ['不要只写匹配度，混入权限事故、名单、航线、作战链和终端投票。'],
  weird: ['不要全是走廊敲门，混入广播、纸条、楼层异常和白天看不懂的后续。'],
  cyber: ['不要只写监控护短，混入项目组同步、电梯偶遇、门禁记录、提交备注和终端提醒。'],
  apocalypse: ['不要只写最后一支药，混入轮班、补给、广播、外勤和物资投票。'],
  underworld: ['不要只写判官偏心，混入押送、引魂、旧账、名册和阴差爆料。'],
  dragonPalace: ['不要只写婚配旧约，混入海宴、避水珠、水卫、赐珠和潮声目击。'],
  infiniteTower: ['不要只写队长护短，混入奖励分配、路线复盘、组队委托和高层事故。'],
  godCourt: ['不要只写神官降罚，混入司命、命格、供奉委托和云阶目击。'],
  dreamStation: ['不要只写重逢，混入夜车、换乘错站、醒后失联和旧梦记录。'],
  bookCity: ['不要只写作者偏爱，混入设定穿帮、章节时间线、读者爆料和角色失控。'],
  beastPlain: ['不要只写标记误会，混入巡猎、幼崽、风口守夜和领地投票。'],
};

const CHANNEL_SCENE_RULES: Record<ForumChannel, string[]> = {
  junction: ['多写“隔壁楼”“另一个区也在吵”“这题跨区串起来了”的平台感。', '标题要像公共区热题，不要缩成私密二人转。'],
  present: ['正文里尽量落到宿舍、工位、电梯口、群聊、外卖、晚课这些现实场景。', '今世区的热帖应该更像活人一天里顺手发出来的东西。'],
  oldDynasty: ['多让信息通过席间、手札、后堂、夜灯、礼法失手这些细节露出来。', '不要把旧朝区写成纯古风恋爱文案，要像体面人失控现场。'],
  xianmen: ['优先出现山门夜巡、闭关前后、灵脉、悬赏灵草、破戒余波这类具体场景。', '仙门区的片段帖要有动作和气息，不要只有抒情。'],
  otherworld: ['热帖最好和公会、旅店、集市、守夜、契约、赏金单这些公共空间有关。', '异域区的委托帖要像真能接单。'],
  starSea: ['多让名单、权限、航线、日志、舷窗、舰桥成为冲突入口。', '星海区的高冷感要体现在流程和记录里，不要只写“他很冷”。'],
  weird: ['怪谈区要更像规则贴、目击贴、夜里补一句的临场感。', '不要把异常解释太满，让楼里人自己拼图。'],
  cyber: ['尽量用工位、电梯、项目组同步、门禁、终端、日志这些具体细节。', '赛博城的关系张力最好藏在“系统记录很冷，但人味露出来了”这种反差里。'],
  apocalypse: ['末日区热帖要和物资、轮班、广播、感染、外勤、退烧针这些生存细节挂钩。', '不要把末日区写成普通吵架楼。'],
  underworld: ['冥府区更适合判词、旧账、名册、引魂、押送顺位这种公务里藏私心。', '正文里尽量出现“翻旧簿子”的感觉。'],
  dragonPalace: ['龙宫区多写海宴散场后、水廊、潮声、珠匣、避水珠、旧约这类华丽余波。', '不要把它写成泛古风。'],
  infiniteTower: ['无限楼多用副本、路线、奖励、补给点、探路顺位、组队默契。', '这区的投票楼和复盘楼都应该带强烈生死同行感。'],
  godCourt: ['神庭区要通过天规、司命、命格、降罚、云阶风声去写越界。', '别只写高位压迫，也要写规矩怎么被悄悄弯一下。'],
  dreamStation: ['梦站更适合夜车、换乘、到站前、错站、醒后失联、梦里先回头。', '气氛要漂一点，但还是论坛楼，不是散文。'],
  bookCity: ['书中城多写章节、番外、设定穿帮、角色出格、作者手滑。', '元叙事感要落在论坛讨论，不要纯文学化。'],
  beastPlain: ['兽原区优先写领地、守夜、气味、风口、火堆、幼崽、换毛期。', '这区的护短要更像本能，不要只靠嘴上说。'],
};

const THREAD_TYPE_GUIDES: Record<ForumThreadType, string[]> = {
  normal: ['像一个人真的来发帖，不要空泛总结。', '正文要有事情经过、情绪或者细节。'],
  gossip: ['要像匿名爆料或吃瓜，不一定保真，但一定有让人跟楼的点。', '语气可以带“我先说我不保真”“有人知道内情吗”。'],
  help: ['重点是求助、问办法、问怎么看，不是单纯倾诉。', '正文里要把卡住的地方说清楚。'],
  commission: ['必须明确是在征集、悬赏、委托、找人、找物、求推荐。', '正文要把需求、条件或报酬说出来，像真的在发委托。'],
  sameTopic: ['必须明显是在接热题、跟风、同问、同感、补充另一种视角。', '不要像普通帖贴个同题标签。'],
  sighting: ['要像现场目击，重点写你看见了什么、当时的氛围、哪里不对劲。', '比起解释，现场感更重要。'],
  timeline: ['要像时间线、repo、记录、复盘，把零散细节串起来。', '可以分点，但要像网友在整理线索。'],
  essay: ['允许像小短文或片段，但仍然是论坛帖，不要写成长篇小说。', '要有镜头感、对白或动作细节，不要写成抒情散文。'],
  vote: ['要明确让楼里人站队、投票、押后续或选观点。', '正文里要抛出可选项，而不是自说自话。'],
  rift: ['要有串台、错频、两个世界的规则打架或信息混入。', '看起来像本频道的人突然看见了不该出现在这里的东西。'],
  reversal: ['正文必须有后续真相、打脸或前情被推翻。', '第一段和后续认知要形成反差。'],
  ownerUpdate: ['必须像楼主回来二编、更新、补证据、汇报进展。', '不要重发原帖，要有“我回来了说后续”的感觉。'],
};

const THREAD_TYPE_GUIDE_OVERRIDES: Partial<Record<ForumThreadType, string[]>> = {
  normal: ['像真人顺手发出来的帖子，不要只有概括句。', '正文要分段，至少给出经过、细节和情绪里的一个。'],
  gossip: ['要像匿名爆料或吃瓜楼，半真半假，但必须有能让人跟楼的钩子。', '允许嘴碎、试探、留后手，不要写成标准说明文。'],
  help: ['重点是求助、求判断、求经验，不是单纯抒情。', '把卡住的地方说具体，最好能看出你到底在问什么。'],
  commission: ['要像真委托帖，需求、条件、预算或时间范围至少占两项。', '格式可以更像信息块，不要整段挤在一起。'],
  sameTopic: ['必须明显是在接热楼、跟风或补另一个视角。', '不能只是普通帖挂一个同题标签，要看得出它在回应别的楼。'],
  sighting: ['像现场目击，重点写你看见了什么、哪里不对劲、当时气氛如何。', '比起解释，更重要的是让人脑子里有画面。'],
  timeline: ['像时间线、记录帖、复盘帖，优先用分点、编号、阶段句。', '不要一整段硬讲完，整理感要明显。'],
  essay: ['允许写成高质量片段帖、短打、代餐文感，但它仍然是论坛帖。', '要有镜头、动作、对白、留白，像小说片段或同人短打，不要乱 prose，也不要纯抒情散文。'],
  vote: ['必须给出明确选项，让人真能站队。', '选项单独成行，最好用 A/B/C 或编号，不要把投票写进一整段里。'],
  rift: ['要有串台、错频、规则打架或不该出现在这里的信息。', '读起来要像论坛里有人突然看到了不属于本区的东西。'],
  reversal: ['正文必须有后续真相、打脸点或前情被推翻。', '前后认知差要足够明显，最好分成“原判断”和“新证据”两层。'],
  ownerUpdate: ['必须像楼主回来二编、补后续、补证据、改口或汇报进展。', '要有更新感，像“我回来补一句”，不要像把主楼重发一遍。'],
};

const THREAD_TYPE_EXAMPLES: Partial<Record<ForumThreadType, string[]>> = {
  gossip: ['我先说不保真，但昨晚海宴散场后有人看见他把避水珠塞她袖子里了。', '这瓜我憋一天了，内网那条删帖是不是因为真有人越权护人？'],
  help: ['求问各位，副本队长连续三次把保命道具留给我，这种到底是战术还是别的？', '有没有人懂，梦里认识我的人醒来装不熟，我现在该不该先装没事？'],
  commission: ['委托一下仙门区的道友，谁知道清心咒反噬后半夜心口发热怎么缓？有偿。', '求一个靠谱的旧朝抄录人，想查某年家宴座次，酬劳可谈。'],
  sameTopic: ['同题一下，楼里都在说高冷护短，我也来交个赛博城版本。', '跟风开个今世版，嘴上嫌弃手上照顾的到底算不算一类人？'],
  sighting: ['刚从图书馆出来，我应该是撞见了本楼最近那条线最不对劲的一幕。', '夜巡路过水廊时看见他停在门外太久了，那个眼神不像顺路。'],
  timeline: ['整理一下这条线最近三次翻车时间线，越排越觉得早就不清白。', '我把论坛里这几张截图按时间顺一下，感觉大家都漏看了一处细节。'],
  essay: ['【片段】关于那个总在换乘口慢半拍回头的人。', '短打一口，假如那句“走慢点”真的不是对空气说的。'],
  vote: ['开个盘，你们觉得这条线会先掉马、先嘴硬，还是先装作无事发生？', '投票一下，这种情况算护短、偏心，还是已经超过普通熟人了？'],
  reversal: ['后续来了，我原以为只是顺手，结果今天发现那份名单是他改的。', '昨天还以为是误会，今天见到证据之后我收回。'],
  ownerUpdate: ['楼主回来补个后续，事情没有我昨晚想的那么简单。', '二编一下，刚刚拿到新证据，原帖里有一处我判断错了。'],
  rift: ['不是，本区怎么会刷出神庭的降罚记录，谁又串台了？', '今世区这条热帖下面突然有人用仙门口气回我，我现在有点发毛。'],
};

const CHANNEL_THREAD_TYPE_BIAS: Record<ForumChannel, ForumThreadType[]> = {
  junction: ['gossip', 'sameTopic', 'vote', 'rift', 'timeline'],
  present: ['help', 'gossip', 'sameTopic', 'essay', 'ownerUpdate'],
  oldDynasty: ['timeline', 'gossip', 'essay', 'reversal', 'ownerUpdate'],
  xianmen: ['essay', 'commission', 'sighting', 'reversal', 'timeline'],
  otherworld: ['commission', 'sighting', 'gossip', 'help', 'vote'],
  starSea: ['timeline', 'vote', 'commission', 'reversal', 'gossip'],
  weird: ['sighting', 'gossip', 'timeline', 'essay', 'rift'],
  cyber: ['vote', 'timeline', 'commission', 'gossip', 'reversal'],
  apocalypse: ['help', 'commission', 'vote', 'sighting', 'timeline'],
  underworld: ['gossip', 'timeline', 'sighting', 'vote', 'reversal'],
  dragonPalace: ['gossip', 'sighting', 'vote', 'commission', 'essay'],
  infiniteTower: ['commission', 'vote', 'timeline', 'sighting', 'help'],
  godCourt: ['timeline', 'vote', 'gossip', 'commission', 'reversal'],
  dreamStation: ['essay', 'sighting', 'gossip', 'help', 'timeline'],
  bookCity: ['timeline', 'gossip', 'essay', 'vote', 'reversal'],
  beastPlain: ['sighting', 'gossip', 'vote', 'help', 'essay'],
};

export function getForumChannelTopicBuckets(channel: ForumChannel) {
  return CHANNEL_TOPIC_BUCKETS[channel] || CHANNEL_TOPIC_BUCKETS.junction;
}

export function getForumChannelWritingGuides(channel: ForumChannel) {
  return CHANNEL_WRITING_GUIDES[channel] || CHANNEL_WRITING_GUIDES.junction;
}

export function getForumChannelVocabHints(channel: ForumChannel) {
  return CHANNEL_VOCAB_HINTS[channel] || CHANNEL_VOCAB_HINTS.junction;
}

export function getForumChannelRepeatAvoidance(channel: ForumChannel) {
  return CHANNEL_REPEAT_AVOIDANCE[channel] || CHANNEL_REPEAT_AVOIDANCE.junction;
}

export function getForumChannelSceneRules(channel: ForumChannel) {
  return CHANNEL_SCENE_RULES[channel] || CHANNEL_SCENE_RULES.junction;
}

export function buildForumThreadPromptGuide() {
  return Object.entries(THREAD_TYPE_GUIDES)
    .map(([threadType, guides]) => `${threadType}：${guides.join(' ')}`)
    .join('\n');
}

export function buildForumThreadPromptGuideV2() {
  return (Object.keys(THREAD_TYPE_GUIDES) as ForumThreadType[])
    .map((threadType) => {
      const guides = THREAD_TYPE_GUIDE_OVERRIDES[threadType] || THREAD_TYPE_GUIDES[threadType];
      return `${threadType}：${guides.join(' ')}`;
    })
    .join('\n');
}

export function buildForumThreadPromptExamples() {
  return Object.entries(THREAD_TYPE_EXAMPLES)
    .map(([threadType, examples]) => `${threadType} 示例：${examples?.join(' / ')}`)
    .join('\n');
}

export function buildForumBatchTypePlan(channel: ForumChannel, count: number): ForumThreadType[] {
  const preferred = CHANNEL_THREAD_TYPE_BIAS[channel] || CHANNEL_THREAD_TYPE_BIAS.junction;
  const baseline: ForumThreadType[] = ['normal', 'gossip', 'help', 'sighting', 'timeline', 'essay', 'vote', 'commission', 'sameTopic', 'reversal', 'ownerUpdate', 'rift'];
  const merged = Array.from(new Set([...preferred, ...baseline]));
  return merged.slice(0, Math.max(3, count));
}

export function buildForumBatchTypePlanLine(channel: ForumChannel, count: number) {
  const plan = buildForumBatchTypePlan(channel, count);
  return `本轮帖型分布尽量覆盖这些方向：${plan.join('、')}。至少保证 3 种以上不同帖型，不要一刷出来几乎全是 normal。`;
}

export function buildForumMandatoryTypeLine(channel: ForumChannel, count: number) {
  const plan = buildForumBatchTypePlan(channel, count);
  const mustHave = plan.slice(0, Math.min(4, Math.max(3, count)));
  return `这一轮至少明确写出这些帖型中的 ${Math.min(3, mustHave.length)} 种：${mustHave.join('、')}，不要只在标签上区分。`;
}
