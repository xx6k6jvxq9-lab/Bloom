import type { ForumPost, WorldBookEntry } from '../../types';
import type { ForumChannel, ForumThreadType } from '../../features/forum-domain/types';

type ForumWorldEcology = {
  id: string;
  label: string;
  identityEcologies: string[];
  publicSpaces: string[];
  eventTypes: string[];
  relationStructures: string[];
  stakeStructures: string[];
  fermentationStyles: string[];
  moodKeywords: string[];
  topicHooks: string[];
  preferredThreadTypes: ForumThreadType[];
  commentStyles: string[];
};

export type ForumTopicSlotPlan = {
  ecologyId: string;
  ecologyLabel: string;
  scene: string;
  conflict: string;
  relationship: string;
  stake: string;
  fermentation: string;
  mood: string;
  hook: string;
  preferredThreadType: ForumThreadType;
  commentStyle: string;
};

export type ForumWorldBookTopicSignal = {
  sourceTitle: string;
  sceneHooks: string[];
  conflictHooks: string[];
  relationHooks: string[];
  institutionHooks: string[];
  preferredThreadTypes: ForumThreadType[];
};

export type ForumTopicPackage = {
  channel: ForumChannel;
  ecologyLabels: string[];
  summaryLines: string[];
  worldBookSummaryLines: string[];
  userSummaryLines: string[];
  threadTypePlanLines: string[];
  slotPlans: ForumTopicSlotPlan[];
};

type PlanForumTopicPackageInput = {
  channel: ForumChannel;
  count: number;
  existingPosts: ForumPost[];
  allowedThreadTypes: ForumThreadType[];
  ordinaryPostFloor?: number;
  worldBooks?: WorldBookEntry[];
  preferredTopicText?: string;
  preferredSceneText?: string;
  preferredConflictText?: string;
  preferredRelationshipText?: string;
  excludedTopicText?: string;
};

const DEFAULT_THREAD_TYPES: ForumThreadType[] = [
  'normal',
  'gossip',
  'help',
  'sighting',
  'timeline',
  'essay',
  'vote',
  'commission',
  'sameTopic',
  'reversal',
  'ownerUpdate',
  'rift',
];

const WORLD_ECOLOGIES: Record<ForumChannel, ForumWorldEcology[]> = {
  junction: [
    {
      id: 'junction_cross_channel',
      label: '跨区串楼',
      identityEcologies: ['披皮路人', '跨区常驻', '热楼围观党'],
      publicSpaces: ['公共热楼', '跨区吃瓜贴', '旧帖翻坟区'],
      eventTypes: ['串台吵架', '多区版本对账', '旧事翻车'],
      relationStructures: ['熟人装路人', '认亲认仇', '隔区护短'],
      stakeStructures: ['名声连带', '论坛站队', '旧账被翻'],
      fermentationStyles: ['吃瓜', '对账', '阴阳怪气'],
      moodKeywords: ['缺德', '热闹', '火药味'],
      topicHooks: ['跨区认人', '旧帖翻坟', '同一事件两边版本不一样'],
      preferredThreadTypes: ['gossip', 'sameTopic', 'timeline', 'rift', 'vote'],
      commentStyles: ['跨楼补料', '站队互呛', '路过拱火'],
    },
    {
      id: 'junction_forum_fame',
      label: '论坛名人效应',
      identityEcologies: ['热楼常客', '匿名爆料人', '老网友'],
      publicSpaces: ['首页热榜', '围观总结楼', '公共区回收站'],
      eventTypes: ['热帖后续', '掉马', '名人楼复活'],
      relationStructures: ['围观者和被围观者', '老恩怨续上', '集体误读'],
      stakeStructures: ['论坛名气', '话语权', '谁先占叙事'],
      fermentationStyles: ['复盘', '吃瓜', '半信半疑'],
      moodKeywords: ['上头', '混乱', '兴奋'],
      topicHooks: ['论坛名人', '掉马后装无事发生', '一楼带崩整个讨论'],
      preferredThreadTypes: ['ownerUpdate', 'timeline', 'gossip', 'sameTopic'],
      commentStyles: ['考古补刀', '旧楼截图', '看戏不嫌事大'],
    },
    {
      id: 'junction_public_help',
      label: '公共区顺手求助',
      identityEcologies: ['路过网友', '热心答疑', '半匿名楼主'],
      publicSpaces: ['公共问答楼', '树洞区', '顺手吐槽区'],
      eventTypes: ['求助', '规则不懂', '公共误会'],
      relationStructures: ['半熟网友', '隔区援手', '围观者给建议'],
      stakeStructures: ['体面', '效率', '少社死'],
      fermentationStyles: ['认真支招', '顺手吐槽', '代入自己'],
      moodKeywords: ['尴尬', '温吞', '轻社死'],
      topicHooks: ['公共区顺手问一句', '不想开号只能在这里发', '想低调但还是被看到了'],
      preferredThreadTypes: ['help', 'normal', 'commission', 'sameTopic'],
      commentStyles: ['认真答题', '一人一句经验', '顺手损一句'],
    },
  ],
  present: [
    {
      id: 'present_campus_social',
      label: '校园与半熟社交',
      identityEcologies: ['学生', '社团人', '宿舍熟人'],
      publicSpaces: ['宿舍楼下', '教学楼走廊', '校园匿名墙'],
      eventTypes: ['社死', '跑腿帮忙', '群聊误会'],
      relationStructures: ['半熟嘴硬', '朋友装不熟', '同学护短'],
      stakeStructures: ['面子', '时间截止', '社交圈评价'],
      fermentationStyles: ['认真支招', '代入', '阴阳怪气'],
      moodKeywords: ['暧昧', '尴尬', '轻松'],
      topicHooks: ['代拿快递', '社团群翻车', '宿舍楼下撞见'],
      preferredThreadTypes: ['help', 'normal', 'sighting', 'sameTopic', 'commission'],
      commentStyles: ['校园经验帖', '起哄', '代入自己'],
    },
    {
      id: 'present_city_circles',
      label: '都市圈层与饭局余波',
      identityEcologies: ['白领', '留学生', '富二代', '饭局熟人'],
      publicSpaces: ['饭局散场后', '私立校圈', '留学群外'],
      eventTypes: ['圈层冷暴力', '饭局站位', '朋友局翻车'],
      relationStructures: ['表面体面', '暗地偏心', '熟人互相试探'],
      stakeStructures: ['圈层归属', '脸面', '谁跟谁更熟'],
      fermentationStyles: ['站队', '复盘', '吃瓜'],
      moodKeywords: ['克制', '压抑', '微妙'],
      topicHooks: ['豪门饭局后', '留学圈冷暴力', '局后被截图复盘'],
      preferredThreadTypes: ['gossip', 'timeline', 'vote', 'normal'],
      commentStyles: ['复盘站位', '看穿不说破', '替人补刀'],
    },
    {
      id: 'present_media_work',
      label: '娱乐圈电竞与网感现场',
      identityEcologies: ['主播', '练习生', '电竞选手', '粉圈路人'],
      publicSpaces: ['后台通道', '直播间外', '粉圈讨论楼'],
      eventTypes: ['后台事故', '采访嘴硬', '热搜翻车'],
      relationStructures: ['公开区不清白', '护短被看出来', '队内别扭'],
      stakeStructures: ['流量', '口碑', '队内位置'],
      fermentationStyles: ['吃瓜', '站队', '缺德乐子'],
      moodKeywords: ['热烈', '刺激', '缺德'],
      topicHooks: ['电竞后台事故', '直播弹幕带节奏', '赛后采访嘴硬'],
      preferredThreadTypes: ['gossip', 'sighting', 'vote', 'reversal', 'sameTopic'],
      commentStyles: ['乐子人狂欢', '粉黑大战', '半懂不懂也要押'],
    },
    {
      id: 'present_daily_life',
      label: '生活边界与普通人底盘',
      identityEcologies: ['打工人', '合租人', '本地网友'],
      publicSpaces: ['工位边', '租房群', '同城跑腿区'],
      eventTypes: ['顺手吐槽', '边界感拉扯', '求推荐'],
      relationStructures: ['普通熟人', '嘴上嫌弃手上照顾', '邻里互助'],
      stakeStructures: ['效率', '省钱', '生活便利'],
      fermentationStyles: ['认真支招', '吐槽', '顺手补料'],
      moodKeywords: ['真实', '温吞', '小烦'],
      topicHooks: ['同城跑腿', '合租边界', '上班路上顺手帮带'],
      preferredThreadTypes: ['normal', 'help', 'commission', 'sameTopic'],
      commentStyles: ['生活经验', '吐槽大会', '顺手安慰'],
    },
  ],
  oldDynasty: [
    {
      id: 'old_household',
      label: '后宅与门第秩序',
      identityEcologies: ['正室旁支', '侍女侍从', '门第亲眷'],
      publicSpaces: ['后堂', '偏院', '家宴散场处'],
      eventTypes: ['家宴失态', '名分争执', '偏院流言'],
      relationStructures: ['体面下的偏心', '门第压人', '婚配试探'],
      stakeStructures: ['名分', '体面', '家中资源'],
      fermentationStyles: ['站队', '复盘', '阴阳怪气'],
      moodKeywords: ['克制', '紧绷', '暗流'],
      topicHooks: ['家宴风波', '退婚余波', '偏院流言'],
      preferredThreadTypes: ['gossip', 'timeline', 'vote', 'reversal'],
      commentStyles: ['礼法复盘', '表面客气实则补刀', '站嫡庶位'],
    },
    {
      id: 'old_court_spill',
      label: '朝堂外溢与旧账翻出',
      identityEcologies: ['幕僚', '门客', '朝堂边角人'],
      publicSpaces: ['书信流出楼', '茶肆消息楼', '外城传闻区'],
      eventTypes: ['旧账翻案', '贬谪余波', '朝堂风声外传'],
      relationStructures: ['旧情旧怨', '护短包庇', '名义上的疏远'],
      stakeStructures: ['前程', '门路', '谁背锅'],
      fermentationStyles: ['复盘', '半信半疑', '吃瓜'],
      moodKeywords: ['压抑', '沉稳', '危险'],
      topicHooks: ['手札流出', '流放后续', '旧案重新被提'],
      preferredThreadTypes: ['timeline', 'gossip', 'ownerUpdate', 'reversal'],
      commentStyles: ['搬旧卷宗', '低声讨论', '不敢说满'],
    },
    {
      id: 'old_night_watch',
      label: '夜值目击与体面失手',
      identityEcologies: ['守更人', '值夜侍从', '路过下人'],
      publicSpaces: ['回廊夜灯下', '守更路', '书房外'],
      eventTypes: ['夜里撞见', '礼法失手', '不该出现的人出现了'],
      relationStructures: ['暗地照拂', '嘴硬护人', '不能明说的熟悉'],
      stakeStructures: ['清誉', '规矩', '被谁先看见'],
      fermentationStyles: ['目击补料', '揣测', '代餐'],
      moodKeywords: ['暧昧', '夜色感', '克制'],
      topicHooks: ['夜里更衣目击', '回廊停步太久', '守更撞见不该看的'],
      preferredThreadTypes: ['sighting', 'essay', 'gossip', 'sameTopic'],
      commentStyles: ['夜色脑补', '小声嗑', '目击接龙'],
    },
  ],
  xianmen: [
    {
      id: 'xianmen_mountain_daily',
      label: '山门日常与轮值秩序',
      identityEcologies: ['外门弟子', '内门弟子', '值夜巡门人'],
      publicSpaces: ['山门夜巡路', '练剑场边', '灵脉值守点'],
      eventTypes: ['轮值安排', '闭关前后变动', '门规漏洞'],
      relationStructures: ['同门别扭', '嘴硬照看', '师门偏心'],
      stakeStructures: ['资源分配', '轮值轻重', '谁被照拂'],
      fermentationStyles: ['复盘', '认真支招', '目击补料'],
      moodKeywords: ['清冷', '绷着', '细腻'],
      topicHooks: ['山门轮值', '闭关前后', '门规空子'],
      preferredThreadTypes: ['normal', 'help', 'timeline', 'sighting'],
      commentStyles: ['门规讨论', '同门经验', '看似正经实际很嗑'],
    },
    {
      id: 'xianmen_quest_resource',
      label: '悬赏委托与资源流向',
      identityEcologies: ['接悬赏的人', '炼器炼丹人', '守库弟子'],
      publicSpaces: ['悬赏墙', '法器库外', '灵草采买楼'],
      eventTypes: ['任务委托', '法器归属', '灵草抢手'],
      relationStructures: ['师兄师姐照应', '临时协作', '资源偏向某人'],
      stakeStructures: ['法器', '灵草', '历练名额'],
      fermentationStyles: ['认真支招', '站队', '复盘'],
      moodKeywords: ['务实', '紧张', '带点酸'],
      topicHooks: ['灵草委托', '法器归属', '悬赏任务出岔子'],
      preferredThreadTypes: ['commission', 'help', 'vote', 'timeline'],
      commentStyles: ['接单回复', '资源对账', '阴阳谁被照顾'],
    },
    {
      id: 'xianmen_break_rule',
      label: '历劫事故与破戒余波',
      identityEcologies: ['历劫相关人', '心法不稳者', '围观同门'],
      publicSpaces: ['禁地边', '历劫现场回收楼', '清修处外'],
      eventTypes: ['历劫事故', '破戒迹象', '禁地误入'],
      relationStructures: ['护道协作', '例外偏爱', '冷面失守'],
      stakeStructures: ['修行前途', '师门脸面', '谁替谁担责'],
      fermentationStyles: ['吃瓜', '代餐', '半信半疑'],
      moodKeywords: ['危险', '压抑', '上头'],
      topicHooks: ['历劫事故', '破戒迹象', '护道过界'],
      preferredThreadTypes: ['gossip', 'sighting', 'essay', 'reversal'],
      commentStyles: ['围观上头', '嗑得很克制', '有人认真辟谣'],
    },
  ],
  otherworld: [
    {
      id: 'other_guild_town',
      label: '公会与边境镇日常',
      identityEcologies: ['冒险者', '旅店常客', '边境镇居民'],
      publicSpaces: ['公会前台', '旅店大厅', '边境小镇公告栏'],
      eventTypes: ['委托排队', '旅店八卦', '王都风声'],
      relationStructures: ['队友默契', '临时照应', '嘴硬护短'],
      stakeStructures: ['悬赏金', '任务优先权', '谁跟谁更搭'],
      fermentationStyles: ['吃瓜', '认真支招', '接单补充'],
      moodKeywords: ['热闹', '轻快', '冒险感'],
      topicHooks: ['公会委托', '旅店传闻', '边境小镇偶遇'],
      preferredThreadTypes: ['commission', 'normal', 'gossip', 'help'],
      commentStyles: ['接单回帖', '冒险见闻', '顺手起哄'],
    },
    {
      id: 'other_race_contract',
      label: '契约与种族混居摩擦',
      identityEcologies: ['契约对象', '混居住民', '学院旁听生'],
      publicSpaces: ['契约登记处', '学院走廊', '集市交易区'],
      eventTypes: ['契约边界', '礼俗冲突', '种族误会'],
      relationStructures: ['跨种族试探', '幼崽认人', '礼貌下的偏袒'],
      stakeStructures: ['契约义务', '礼俗体面', '交易信誉'],
      fermentationStyles: ['认真支招', '站队', '代入'],
      moodKeywords: ['微妙', '温热', '异域感'],
      topicHooks: ['契约边界', '种族混居摩擦', '幼崽突然黏人'],
      preferredThreadTypes: ['help', 'vote', 'sameTopic', 'commission'],
      commentStyles: ['礼俗科普', '站不同族群', '替人翻译潜台词'],
    },
    {
      id: 'other_ruin_escort',
      label: '遗迹目击与护送风险',
      identityEcologies: ['探险队', '护送人', '遗迹目击者'],
      publicSpaces: ['遗迹外围', '夜守营地', '护送途中驿站'],
      eventTypes: ['夜守异状', '护送出事', '遗迹目击'],
      relationStructures: ['生死同行', '暗地照顾', '任务外的额外留心'],
      stakeStructures: ['队伍安全', '赏金', '谁该负责'],
      fermentationStyles: ['目击补料', '复盘', '半信半疑'],
      moodKeywords: ['危险', '紧张', '迷雾'],
      topicHooks: ['冒险队夜守', '护送委托', '遗迹里看到不该看的'],
      preferredThreadTypes: ['sighting', 'timeline', 'commission', 'reversal'],
      commentStyles: ['补现场细节', '分析谁失误', '押后续'],
    },
  ],
  starSea: [
    {
      id: 'starsea_bridge_ops',
      label: '舰桥值班与航线调度',
      identityEcologies: ['舰桥值班员', '调度员', '后勤协作人'],
      publicSpaces: ['舰桥', '停泊区', '航线调度台'],
      eventTypes: ['值班交接', '指令误传', '编队协作问题'],
      relationStructures: ['高压下的偏心', '冷脸照顾', '流程里开后门'],
      stakeStructures: ['任务效率', '责任归属', '谁背指令锅'],
      fermentationStyles: ['复盘', '认真支招', '站队'],
      moodKeywords: ['冷感', '紧绷', '专业'],
      topicHooks: ['舰桥值夜', '航线调度', '指令误传'],
      preferredThreadTypes: ['timeline', 'help', 'vote', 'normal'],
      commentStyles: ['流程复盘', '军规讨论', '冷脸补料'],
    },
    {
      id: 'starsea_permission_chain',
      label: '权限白名单与高层例外',
      identityEcologies: ['权限管理员', '实验线成员', '高层旁观者'],
      publicSpaces: ['权限台账', '白名单审批链', '高层会议外'],
      eventTypes: ['白名单异常', '权限越界', '保密协议冲突'],
      relationStructures: ['例外待遇', '嘴硬维护', '高位偏袒'],
      stakeStructures: ['权限', '安全等级', '谁被例外放行'],
      fermentationStyles: ['吃瓜', '复盘', '半信半疑'],
      moodKeywords: ['危险', '压制', '克制'],
      topicHooks: ['白名单异常', '权限越界', '保密协议被踩线'],
      preferredThreadTypes: ['gossip', 'timeline', 'reversal', 'vote'],
      commentStyles: ['翻日志', '猜谁改的名单', '押谁会被追责'],
    },
    {
      id: 'starsea_medical_psy',
      label: '精神海与医疗舱余波',
      identityEcologies: ['医疗舱人员', '实验对象', '外勤归来者'],
      publicSpaces: ['医疗舱', '精神海监测室', '归航回收区'],
      eventTypes: ['精神海副作用', '科研异常', '外勤归来后失控'],
      relationStructures: ['高危照料', '异常同步', '谁被特别盯着'],
      stakeStructures: ['稳定度', '医疗资源', '能否继续出勤'],
      fermentationStyles: ['认真支招', '代餐', '目击补料'],
      moodKeywords: ['漂浮', '压抑', '危险'],
      topicHooks: ['精神海副作用', '医疗舱事故', '外勤归来异常'],
      preferredThreadTypes: ['help', 'sighting', 'essay', 'reversal'],
      commentStyles: ['专业分析', '担心过头', '轻声补目击'],
    },
  ],
  weird: [
    {
      id: 'weird_rule_notice',
      label: '规则贴与旧楼广播',
      identityEcologies: ['守规则的人', '半懂不懂的新手', '夜里补一句的人'],
      publicSpaces: ['旧楼公告栏', '广播贴', '夜间规则楼'],
      eventTypes: ['规则更新', '广播提醒', '别回头型预警'],
      relationStructures: ['陌生人互相提醒', '知道一点但不敢说全', '默认有人在看'],
      stakeStructures: ['能不能平安过夜', '谁先触发规则', '哪些规则是假的'],
      fermentationStyles: ['半信半疑', '复盘', '接力补充'],
      moodKeywords: ['诡异', '紧张', '留白'],
      topicHooks: ['白纸规则', '旧楼广播', '别回头预警'],
      preferredThreadTypes: ['rift', 'timeline', 'sameTopic', 'help'],
      commentStyles: ['夜里补一句', '补规则漏洞', '劝人先别试'],
    },
    {
      id: 'weird_live_sighting',
      label: '活人误入与现场目击',
      identityEcologies: ['误入者', '路过目击人', '知道内情的本地人'],
      publicSpaces: ['电梯口', '走廊尽头', '楼层不对劲的地方'],
      eventTypes: ['活人区误入', '楼层异常', '时间错乱'],
      relationStructures: ['陌生人短暂互救', '某个例外被保护', '大家默认装没看见'],
      stakeStructures: ['能不能出来', '谁被留下', '谁知道太多'],
      fermentationStyles: ['目击补料', '半信半疑', '吃瓜'],
      moodKeywords: ['惊悚', '失重', '压迫'],
      topicHooks: ['楼层不对劲', '电梯异常', '活人误入'],
      preferredThreadTypes: ['sighting', 'gossip', 'timeline', 'reversal'],
      commentStyles: ['补现场细节', '怀疑是编的', '有人低声认出地点'],
    },
    {
      id: 'weird_clue_pool',
      label: '纸条照片与旧事不承认',
      identityEcologies: ['捡到线索的人', '旧事见证者', '匿名补图党'],
      publicSpaces: ['照片贴', '录音整理楼', '旧事翻案楼'],
      eventTypes: ['纸条线索', '录音异常', '已经发生过但没人承认'],
      relationStructures: ['共同保密', '被某个例外反复保护', '有人明明知道却装不知道'],
      stakeStructures: ['线索真伪', '谁先掉马', '哪些名字不能提'],
      fermentationStyles: ['复盘', '阴阳怪气', '目击补料'],
      moodKeywords: ['阴冷', '悬疑', '上头'],
      topicHooks: ['纸条照片', '录音线索', '旧事没人敢承认'],
      preferredThreadTypes: ['timeline', 'gossip', 'sameTopic', 'ownerUpdate'],
      commentStyles: ['补图', '猜谁删帖', '翻旧楼对证'],
    },
  ],
  cyber: [
    {
      id: 'cyber_corp_ops',
      label: '企业内网与工位生态',
      identityEcologies: ['内网员工', '工位同事', '系统维护人'],
      publicSpaces: ['企业内网论坛', '工位边角', '项目组同步楼'],
      eventTypes: ['工位吐槽', '项目同步翻车', '自动化替人决定'],
      relationStructures: ['同事嘴硬帮忙', '系统里偷偷放水', '公开装不熟但线下帮你挡'],
      stakeStructures: ['绩效', '工时', '谁在替谁兜锅'],
      fermentationStyles: ['认真支招', '吐槽', '阴阳怪气'],
      moodKeywords: ['疲惫', '冷幽默', '真实'],
      topicHooks: ['工位生态', '自动化替你决定', '项目组同步翻车'],
      preferredThreadTypes: ['normal', 'help', 'sameTopic', 'ownerUpdate'],
      commentStyles: ['内网吐槽', '工位损一句', '帮楼主看系统备注'],
    },
    {
      id: 'cyber_surveillance',
      label: '监控误判与日志删改',
      identityEcologies: ['监控岗', '被监控者', '日志管理员'],
      publicSpaces: ['监控回放楼', '门禁记录区', '日志台账'],
      eventTypes: ['监控误判', '记录被删改', '身份认证错配'],
      relationStructures: ['系统替人做判断', '有人越权护你', '冷脸压下后续'],
      stakeStructures: ['权限', '安全等级', '谁改了记录'],
      fermentationStyles: ['复盘', '吃瓜', '半信半疑'],
      moodKeywords: ['冷硬', '危险', '怀疑'],
      topicHooks: ['监控误判', '日志删改', '门禁记录不对劲'],
      preferredThreadTypes: ['timeline', 'gossip', 'reversal', 'sameTopic'],
      commentStyles: ['翻记录', '猜是谁改的', '押后续谁先嘴硬'],
    },
    {
      id: 'cyber_gray_market',
      label: '黑市灰产与城市接口',
      identityEcologies: ['灰产人', '改造维护师', '黑市中间人'],
      publicSpaces: ['黑市委托楼', '改造维护点', '城市边角接口区'],
      eventTypes: ['黑市委托', '终端异常', '数据泄露'],
      relationStructures: ['交易里生出的信任', '灰区护短', '旧交易对象重逢'],
      stakeStructures: ['钱', '数据', '被谁掌握把柄'],
      fermentationStyles: ['吃瓜', '认真接单', '缺德乐子'],
      moodKeywords: ['刺激', '灰暗', '快节奏'],
      topicHooks: ['黑市委托', '终端异常', '数据泄露'],
      preferredThreadTypes: ['commission', 'gossip', 'sighting', 'vote'],
      commentStyles: ['接单', '压价', '围观看谁先翻车'],
    },
  ],
  apocalypse: [
    {
      id: 'apoc_shelter_rules',
      label: '避难所规则与轮班底盘',
      identityEcologies: ['轮班守夜人', '避难所居民', '临时管理者'],
      publicSpaces: ['避难所公告区', '轮班表楼', '发电间外'],
      eventTypes: ['巡夜排班', '断电', '规则执行争议'],
      relationStructures: ['一起熬夜的人', '明里冷硬暗里照顾', '谁被优先安排'],
      stakeStructures: ['休息时间', '安全', '谁承担更多风险'],
      fermentationStyles: ['认真支招', '站队', '吐槽'],
      moodKeywords: ['疲惫', '紧张', '务实'],
      topicHooks: ['巡夜轮班', '发电断电', '避难所规则'],
      preferredThreadTypes: ['help', 'normal', 'vote', 'sameTopic'],
      commentStyles: ['生存经验', '骂安排不合理', '替楼主算班'],
    },
    {
      id: 'apoc_supply_chain',
      label: '物资补给与最后一针',
      identityEcologies: ['物资分配人', '外勤拾荒队', '医疗线成员'],
      publicSpaces: ['补给楼', '临时交易点', '医疗帐篷外'],
      eventTypes: ['物资分配', '补给投票', '医疗资源不足'],
      relationStructures: ['优先救谁', '偏向某个小队', '旧情影响分配'],
      stakeStructures: ['药', '食物', '发电燃料'],
      fermentationStyles: ['站队', '复盘', '认真争论'],
      moodKeywords: ['高压', '残酷', '尖锐'],
      topicHooks: ['最后一针给谁', '补给投票', '医疗资源不足'],
      preferredThreadTypes: ['vote', 'timeline', 'help', 'reversal'],
      commentStyles: ['生存伦理辩论', '算账', '站人不站理'],
    },
    {
      id: 'apoc_signal_field',
      label: '旧信号与外勤归来',
      identityEcologies: ['广播站人', '外勤归来者', '边界守望人'],
      publicSpaces: ['广播站', '外勤回收点', '边界岗哨'],
      eventTypes: ['旧信号来源', '外勤归来异常', '收容新人'],
      relationStructures: ['生死同行', '归来后被特别关照', '对外来者的疑心'],
      stakeStructures: ['情报', '安全边界', '谁值得信'],
      fermentationStyles: ['目击补料', '半信半疑', '吃瓜'],
      moodKeywords: ['危险', '荒凉', '不安'],
      topicHooks: ['旧信号', '外勤归来', '收容新人'],
      preferredThreadTypes: ['sighting', 'gossip', 'timeline', 'ownerUpdate'],
      commentStyles: ['补现场', '怀疑感染链', '有人默默认人'],
    },
  ],
  underworld: [
    {
      id: 'underworld_bureau',
      label: '黄泉公务与名册流程',
      identityEcologies: ['阴差', '判官属吏', '名册管理员'],
      publicSpaces: ['黄泉公务楼', '名册更正处', '路引窗口'],
      eventTypes: ['名册错置', '流程出错', '公务里夹带私心'],
      relationStructures: ['冷脸放水', '公事公办里护短', '前世旧识重逢'],
      stakeStructures: ['流程优先级', '谁能改判', '谁被压在后面'],
      fermentationStyles: ['复盘', '阴阳怪气', '半信半疑'],
      moodKeywords: ['冷静', '压抑', '黑色幽默'],
      topicHooks: ['名册异常', '黄泉公务', '路引事故'],
      preferredThreadTypes: ['timeline', 'normal', 'reversal', 'gossip'],
      commentStyles: ['流程吐槽', '旧规矩补充', '阴差内部梗'],
    },
    {
      id: 'underworld_judgement',
      label: '判词改判与旧账翻案',
      identityEcologies: ['判词相关人', '翻案围观者', '旧案知情人'],
      publicSpaces: ['改判楼', '旧账翻案区', '押送复盘楼'],
      eventTypes: ['判词变动', '旧账翻案', '押送顺序争议'],
      relationStructures: ['前世关系余波', '偏袒被看出来', '嘴上公正手上例外'],
      stakeStructures: ['判决结果', '谁欠谁债', '谁能被放一马'],
      fermentationStyles: ['站队', '复盘', '吃瓜'],
      moodKeywords: ['危险', '尖锐', '宿命感'],
      topicHooks: ['改判', '旧账翻案', '押送秩序'],
      preferredThreadTypes: ['vote', 'timeline', 'gossip', 'reversal'],
      commentStyles: ['翻前世旧账', '站谁该被判', '抓偏袒痕迹'],
    },
    {
      id: 'underworld_border',
      label: '引魂路见闻与阴阳摩擦',
      identityEcologies: ['引魂人', '生魂求助者', '边界路过者'],
      publicSpaces: ['引魂路', '阴阳边界', '冥灯事故现场'],
      eventTypes: ['引魂见闻', '生魂求助', '冥灯失火'],
      relationStructures: ['陌生人短暂结伴', '某个生魂被反复照应', '边界外的人被特别放过'],
      stakeStructures: ['能不能回去', '谁该被带走', '边界规矩'],
      fermentationStyles: ['目击补料', '认真支招', '半信半疑'],
      moodKeywords: ['阴冷', '柔软', '诡异'],
      topicHooks: ['引魂路见闻', '生魂求助', '冥灯事故'],
      preferredThreadTypes: ['sighting', 'help', 'essay', 'sameTopic'],
      commentStyles: ['轻声支招', '补边界规则', '阴间版代餐'],
    },
  ],
  dragonPalace: [
    {
      id: 'dragon_banquet',
      label: '海宴余波与宫中流言',
      identityEcologies: ['王族旁系', '海宴来客', '宫中侍从'],
      publicSpaces: ['海宴散场处', '水廊', '宫中流言楼'],
      eventTypes: ['海宴风波', '赐珠误会', '王族偏心'],
      relationStructures: ['体面下的偏爱', '礼制里开小差', '眼神停留过久'],
      stakeStructures: ['王族体面', '珠宝赏赐', '谁被公开抬高'],
      fermentationStyles: ['吃瓜', '站队', '代餐'],
      moodKeywords: ['华丽', '潮湿', '暧昧'],
      topicHooks: ['海宴余波', '赐珠误解', '王族偏心'],
      preferredThreadTypes: ['gossip', 'vote', 'essay', 'sighting'],
      commentStyles: ['华丽脑补', '站珠子归属', '海风味嗑线'],
    },
    {
      id: 'dragon_protocol',
      label: '旧约婚配与礼制压人',
      identityEcologies: ['礼官', '婚配相关人', '龙宫旁听者'],
      publicSpaces: ['礼制登记处', '婚配旧约楼', '避水珠借还处'],
      eventTypes: ['婚配旧约', '借珠纠纷', '礼制冲突'],
      relationStructures: ['旧约绑定', '公开疏远私下例外', '礼制下的双标'],
      stakeStructures: ['婚配名义', '旧约效力', '谁有资格出手'],
      fermentationStyles: ['复盘', '站队', '认真支招'],
      moodKeywords: ['克制', '高压', '宿命感'],
      topicHooks: ['婚配旧约', '避水珠失主', '礼制压人'],
      preferredThreadTypes: ['timeline', 'vote', 'help', 'reversal'],
      commentStyles: ['礼制分析', '问旧约细则', '替人算体面账'],
    },
    {
      id: 'dragon_outer_sea',
      label: '远海来客与潮汐异动',
      identityEcologies: ['水卫', '远海来客', '巡夜人'],
      publicSpaces: ['远海码头', '潮声观测点', '夜巡水道'],
      eventTypes: ['潮汐异动', '夜巡目击', '旧战遗留物上岸'],
      relationStructures: ['护送协作', '有人被特别放行', '看似公事其实护人'],
      stakeStructures: ['海域安全', '谁先知道消息', '旧战秘密'],
      fermentationStyles: ['目击补料', '半信半疑', '复盘'],
      moodKeywords: ['危险', '神秘', '潮湿冷感'],
      topicHooks: ['潮声目击', '夜巡偏心', '远海来客'],
      preferredThreadTypes: ['sighting', 'timeline', 'gossip', 'ownerUpdate'],
      commentStyles: ['补水道细节', '猜旧战关联', '压低声音讨论'],
    },
  ],
  infiniteTower: [
    {
      id: 'tower_route_team',
      label: '副本路线与队伍默契',
      identityEcologies: ['队长', '探路人', '固定队成员'],
      publicSpaces: ['路线复盘楼', '副本门口', '高层补给点'],
      eventTypes: ['路线选择', '探路顺位', '新人带队翻车'],
      relationStructures: ['生死同行', '嘴硬护人', '队伍绑定关系'],
      stakeStructures: ['通关概率', '队内信任', '谁去探路'],
      fermentationStyles: ['复盘', '站队', '认真支招'],
      moodKeywords: ['紧张', '高压', '可靠感'],
      topicHooks: ['副本路线', '探路顺位', '新人带队'],
      preferredThreadTypes: ['timeline', 'help', 'vote', 'sameTopic'],
      commentStyles: ['路线分析', '站队长', '教你别这么走'],
    },
    {
      id: 'tower_reward_supply',
      label: '奖励分配与保命道具',
      identityEcologies: ['分配负责人', '补给管理人', '临时结盟者'],
      publicSpaces: ['奖励分配楼', '补给点', '队后整理区'],
      eventTypes: ['奖励分配', '保命道具归属', '临时结盟破裂'],
      relationStructures: ['谁被优先保', '资源偏爱', '嘴上公平手上倾斜'],
      stakeStructures: ['奖励', '补给', '活下来谁更重要'],
      fermentationStyles: ['站队', '吃瓜', '认真争论'],
      moodKeywords: ['尖锐', '紧绷', '直白'],
      topicHooks: ['奖励分配', '保命道具归属', '谁被优先救'],
      preferredThreadTypes: ['vote', 'gossip', 'reversal', 'help'],
      commentStyles: ['算贡献值', '吵谁该拿', '押队伍散不散'],
    },
    {
      id: 'tower_highfloor_sighting',
      label: '高层目击与团灭后续',
      identityEcologies: ['高层目击者', '团灭幸存者', '委托旁观者'],
      publicSpaces: ['高层走廊', '复活点', '团灭后续楼'],
      eventTypes: ['高层目击', '团灭争论', '任务委托后遗症'],
      relationStructures: ['幸存者偏爱', '带着旧战损再合作', '有人被特别记着'],
      stakeStructures: ['名声', '能否继续组队', '谁该背团灭锅'],
      fermentationStyles: ['目击补料', '复盘', '半信半疑'],
      moodKeywords: ['危险', '后怕', '上头'],
      topicHooks: ['高层目击', '团灭后续', '任务委托出事故'],
      preferredThreadTypes: ['sighting', 'timeline', 'commission', 'ownerUpdate'],
      commentStyles: ['补高层细节', '追问谁活着回来', '押后续还组不组队'],
    },
  ],
  godCourt: [
    {
      id: 'godcourt_regulation',
      label: '天规司命与高位流程',
      identityEcologies: ['司命相关人', '神官', '天规执行者'],
      publicSpaces: ['司命记录楼', '云阶通报区', '神职流程贴'],
      eventTypes: ['神谕偏差', '命格争议', '天规漏洞'],
      relationStructures: ['高位偏袒', '规矩里给你留口子', '嘴上公正手上放过'],
      stakeStructures: ['神职位置', '命格判定', '谁能被赦免'],
      fermentationStyles: ['复盘', '半信半疑', '站队'],
      moodKeywords: ['高压', '冷淡', '神圣感'],
      topicHooks: ['司命记录', '天规漏洞', '命格争议'],
      preferredThreadTypes: ['timeline', 'vote', 'reversal', 'gossip'],
      commentStyles: ['搬天规条文', '猜谁动的笔', '押会不会降罚'],
    },
    {
      id: 'godcourt_banquet',
      label: '神庭宴席与越界护短',
      identityEcologies: ['宴席旁观者', '供奉相关人', '高位随从'],
      publicSpaces: ['神庭宴席后', '云阶转角', '供奉回报楼'],
      eventTypes: ['宴席失态', '供奉异常回报', '越界护短'],
      relationStructures: ['公开克制私下偏爱', '高位双标', '例外感被看见'],
      stakeStructures: ['体面', '神庭风评', '谁被当众护住'],
      fermentationStyles: ['吃瓜', '代餐', '站队'],
      moodKeywords: ['华丽', '压抑', '危险暧昧'],
      topicHooks: ['神庭宴席', '越界护短', '供奉异常回报'],
      preferredThreadTypes: ['gossip', 'essay', 'vote', 'sighting'],
      commentStyles: ['高位嗑线', '补宴席站位', '阴阳谁又被偏爱'],
    },
    {
      id: 'godcourt_ritual',
      label: '祭仪事故与人间回响',
      identityEcologies: ['祭仪执行人', '人间使者', '事故见证者'],
      publicSpaces: ['祭仪现场', '降罚通告楼', '人间回响回收贴'],
      eventTypes: ['祭仪事故', '降罚前夜', '人间回响反冲神界'],
      relationStructures: ['临时联手', '有人替谁扛罚', '公开流程中的偏转'],
      stakeStructures: ['降罚结果', '祭仪能否继续', '谁替谁背锅'],
      fermentationStyles: ['复盘', '目击补料', '认真争论'],
      moodKeywords: ['肃杀', '庄重', '紧张'],
      topicHooks: ['祭仪事故', '降罚前夜', '人间回响'],
      preferredThreadTypes: ['timeline', 'sighting', 'reversal', 'help'],
      commentStyles: ['祭仪分析', '补现场风声', '问能不能补救'],
    },
  ],
  dreamStation: [
    {
      id: 'dreamstation_platform',
      label: '站台重逢与换乘失联',
      identityEcologies: ['夜车乘客', '换乘人', '站台路人'],
      publicSpaces: ['站台长椅', '换乘口', '到站前广播楼'],
      eventTypes: ['夜车重逢', '换乘失联', '到站前消失'],
      relationStructures: ['梦里先认出你', '醒后装不熟', '明明等了很久'],
      stakeStructures: ['能不能再次遇见', '谁先承认认出来了', '记忆是不是共享'],
      fermentationStyles: ['代餐', '目击补料', '吃瓜'],
      moodKeywords: ['漂浮', '暧昧', '惆怅'],
      topicHooks: ['夜车重逢', '换乘失联', '站台目击'],
      preferredThreadTypes: ['sighting', 'essay', 'gossip', 'sameTopic'],
      commentStyles: ['梦感脑补', '补站台细节', '嗑醒后装不熟'],
    },
    {
      id: 'dreamstation_rules',
      label: '站务规则与梦境轨道偏移',
      identityEcologies: ['站务旁听人', '老乘客', '规则半懂的人'],
      publicSpaces: ['站务通告楼', '梦境轨道图', '错站求助贴'],
      eventTypes: ['错站误入', '轨道偏移', '广播提示不对劲'],
      relationStructures: ['陌生人短暂结伴', '有人被规则放过', '某人总能等到你'],
      stakeStructures: ['能不能下车', '记忆会不会丢', '规则到底有没有例外'],
      fermentationStyles: ['认真支招', '半信半疑', '复盘'],
      moodKeywords: ['朦胧', '不安', '轻诡异'],
      topicHooks: ['错站误入', '梦境轨道偏移', '站务规则'],
      preferredThreadTypes: ['help', 'timeline', 'rift', 'sameTopic'],
      commentStyles: ['补规则', '劝别乱试', '讲自己的错站经历'],
    },
    {
      id: 'dreamstation_memory',
      label: '旧梦回潮与现实落差',
      identityEcologies: ['旧梦见证者', '睡醒后失落的人', '旅伴视角'],
      publicSpaces: ['半夜投稿区', '旧梦记录楼', '现实回收站'],
      eventTypes: ['旧梦回潮', '睡醒后现实落差', '记忆共享不共享'],
      relationStructures: ['只有一方记得', '两边都装没事', '现实里失联'],
      stakeStructures: ['记忆真伪', '谁先承认', '现实还能不能续上'],
      fermentationStyles: ['代餐', '复盘', '认真安慰'],
      moodKeywords: ['惆怅', '温柔', '酸涩'],
      topicHooks: ['旧梦回潮', '睡醒落差', '记忆共享'],
      preferredThreadTypes: ['essay', 'timeline', 'help', 'ownerUpdate'],
      commentStyles: ['共情安慰', '补梦境细节', '劝别立刻去找人'],
    },
  ],
  bookCity: [
    {
      id: 'bookcity_meta_bug',
      label: '章节 bug 与设定穿帮',
      identityEcologies: ['读者考据党', '设定警察', '路过补丁人'],
      publicSpaces: ['章节讨论楼', '设定补丁贴', '时间线纠错区'],
      eventTypes: ['章节 bug', '设定穿帮', '时间线错位'],
      relationStructures: ['作者偏爱被看穿', '角色待遇不一样', '配角被压或被抬'],
      stakeStructures: ['设定自洽', '谁是亲儿子', '剧情还能不能圆'],
      fermentationStyles: ['复盘', '站队', '阴阳怪气'],
      moodKeywords: ['机灵', '挑刺', '兴奋'],
      topicHooks: ['章节 bug', '设定穿帮', '时间线错位'],
      preferredThreadTypes: ['timeline', 'sameTopic', 'vote', 'reversal'],
      commentStyles: ['考据大战', '补章节', '阴阳作者手滑'],
    },
    {
      id: 'bookcity_character_break',
      label: '角色出格与主角光环争议',
      identityEcologies: ['角色厨', '配角党', '反光环阵营'],
      publicSpaces: ['角色站队楼', '番外事故楼', '主角待遇讨论帖'],
      eventTypes: ['角色出格', '番外翻车', '主角光环争议'],
      relationStructures: ['角色偏爱', '被写出来的不公平', '配角上位'],
      stakeStructures: ['戏份', '人气', '谁有资格越线'],
      fermentationStyles: ['站队', '吃瓜', '代餐'],
      moodKeywords: ['上头', '热闹', '争议大'],
      topicHooks: ['角色出格', '番外翻车', '主角光环争议'],
      preferredThreadTypes: ['vote', 'gossip', 'essay', 'sameTopic'],
      commentStyles: ['站角色', '嗑到失智', '拉踩主配角'],
    },
    {
      id: 'bookcity_author_revolt',
      label: '作者手滑与角色反叛',
      identityEcologies: ['元叙事围观者', '作者受害者联盟', '书页边角路人'],
      publicSpaces: ['作者手滑楼', '角色反叛贴', '书页边角流言区'],
      eventTypes: ['作者手滑', '角色意识到被写', '设定回收失败'],
      relationStructures: ['作者和角色对抗', '角色反过来争命', '角色之间争谁被偏爱'],
      stakeStructures: ['叙事权', '谁能改命', '哪条线被保留'],
      fermentationStyles: ['吃瓜', '复盘', '缺德乐子'],
      moodKeywords: ['疯感', '元叙事', '活泼'],
      topicHooks: ['作者手滑', '角色反叛', '设定回收失败'],
      preferredThreadTypes: ['gossip', 'reversal', 'timeline', 'rift'],
      commentStyles: ['读者群围观', '押谁能改命', '乐子人追更'],
    },
  ],
  beastPlain: [
    {
      id: 'beast_territory',
      label: '领地边界与巡猎守夜',
      identityEcologies: ['首领侧近', '巡猎者', '守夜人'],
      publicSpaces: ['风口值守点', '领地边界', '火堆夜谈处'],
      eventTypes: ['领地争执', '巡猎排班', '风口目击'],
      relationStructures: ['本能护短', '同群默契', '把谁当自己人'],
      stakeStructures: ['领地安全', '谁先出去巡', '谁有资格靠近火堆'],
      fermentationStyles: ['站队', '目击补料', '认真支招'],
      moodKeywords: ['野性', '直接', '紧张'],
      topicHooks: ['领地边界', '巡猎守夜', '风口目击'],
      preferredThreadTypes: ['sighting', 'vote', 'help', 'normal'],
      commentStyles: ['谁该守夜', '补气味线索', '站首领和站猎手'],
    },
    {
      id: 'beast_pack_care',
      label: '幼崽照看与受伤照料',
      identityEcologies: ['照看幼崽的人', '伤员', '同群熟人'],
      publicSpaces: ['巢穴边', '休息地', '照料求助楼'],
      eventTypes: ['幼崽认人', '受伤照料', '谁把谁带回来了'],
      relationStructures: ['把你认成自己人', '嘴上凶手上照顾', '护崽本能外溢'],
      stakeStructures: ['安全感', '照料时间', '谁该负责带着'],
      fermentationStyles: ['认真支招', '代入', '轻度乐子'],
      moodKeywords: ['柔软', '野性', '温热'],
      topicHooks: ['幼崽照看', '受伤照料', '被认成自己人'],
      preferredThreadTypes: ['help', 'essay', 'sameTopic', 'normal'],
      commentStyles: ['养崽经验', '被萌到', '顺手起哄'],
    },
    {
      id: 'beast_instinct',
      label: '气味标记与礼俗冲突',
      identityEcologies: ['礼俗守旧派', '外来者', '换毛期当事人'],
      publicSpaces: ['礼俗讨论楼', '迁徙路线边', '换毛期树洞'],
      eventTypes: ['气味识别', '标记误会', '外来者融入'],
      relationStructures: ['本能比嘴更诚实', '礼俗压住心思', '谁先把谁算进群里'],
      stakeStructures: ['礼俗体面', '融入资格', '关系边界'],
      fermentationStyles: ['代餐', '站队', '半信半疑'],
      moodKeywords: ['本能', '暧昧', '危险'],
      topicHooks: ['标记误会', '气味识别', '外来者融入'],
      preferredThreadTypes: ['gossip', 'essay', 'vote', 'reversal'],
      commentStyles: ['嗑本能反应', '站礼俗派和直觉派', '猜谁先认群'],
    },
  ],
};

const SCENE_PATTERNS = /(楼|站|桥|堂|宫|门|廊|舰|舱|台|岗|区|室|房|店|馆|院|营|驿|走廊|后台|工位|宿舍|公告栏)/;
const CONFLICT_PATTERNS = /(误会|越界|失控|漏洞|事故|风波|失联|翻车|冲突|偏心|双标|掉马|争执|冷暴力|失手|改判|争议)/;
const RELATION_PATTERNS = /(室友|同门|师徒|队友|同事|婚约|道侣|护短|偏爱|试探|嘴硬|例外|熟人|配角|主角|自己人)/;
const INSTITUTION_PATTERNS = /(白名单|权限|名单|法器|路引|名册|珠|日志|神谕|命格|供奉|规则|广播|委托|契约|工单|副本|祭仪|设定)/;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickByIndex<T>(items: T[], seed: number) {
  if (!items.length) return undefined;
  return items[Math.abs(seed) % items.length];
}

function unique<T>(items: T[]) {
  return items.filter((item, index) => items.indexOf(item) === index);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function splitTopicTokens(value?: string) {
  if (!value) return [];
  return unique(
    value
      .split(/[，,、\/\n；;。]/)
      .map((part) => normalizeText(part))
      .filter((part) => part.length >= 2),
  );
}

function buildKeywordPool(ecology: ForumWorldEcology) {
  return unique([
    ...ecology.identityEcologies,
    ...ecology.publicSpaces,
    ...ecology.eventTypes,
    ...ecology.relationStructures,
    ...ecology.stakeStructures,
    ...ecology.topicHooks,
  ]);
}

function scoreRecentOverlap(ecology: ForumWorldEcology, recentTexts: string[]) {
  const keywords = buildKeywordPool(ecology);
  return recentTexts.reduce((score, text) => {
    const matchedCount = keywords.filter((keyword) => text.includes(keyword)).length;
    return score + (matchedCount > 0 ? 1 + Math.min(2, matchedCount - 1) : 0);
  }, 0);
}

function scoreUserTopicAffinity(ecology: ForumWorldEcology, preferredTopics: string[], excludedTopics: string[]) {
  const keywords = buildKeywordPool(ecology);
  const preferredScore = preferredTopics.reduce((score, topic) => {
    const matched = keywords.some((keyword) => keyword.includes(topic) || topic.includes(keyword));
    return score + (matched ? 18 : 0);
  }, 0);
  const excludedPenalty = excludedTopics.reduce((score, topic) => {
    const matched = keywords.some((keyword) => keyword.includes(topic) || topic.includes(keyword));
    return score + (matched ? 22 : 0);
  }, 0);
  return preferredScore - excludedPenalty;
}

function pickPreferredThreadType(
  ecology: ForumWorldEcology,
  allowedThreadTypes: ForumThreadType[],
  seed: number,
): ForumThreadType {
  const allowed = allowedThreadTypes.length > 0 ? allowedThreadTypes : DEFAULT_THREAD_TYPES;
  const preferred = ecology.preferredThreadTypes.filter((threadType) => allowed.includes(threadType));
  if (preferred.length > 0) {
    return preferred[Math.abs(seed) % preferred.length];
  }
  return allowed[Math.abs(seed) % allowed.length] || 'normal';
}

function buildWorldBookSnippets(worldBooks: WorldBookEntry[]) {
  return unique(worldBooks.flatMap((item) => (
    item.content
      .split(/[\n。；;！？!?]/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 4 && part.length <= 24)
      .slice(0, 6)
  )));
}

export function extractWorldBookTopicSignals(worldBooks: WorldBookEntry[]): ForumWorldBookTopicSignal[] {
  return worldBooks.slice(0, 4).map((item) => {
    const snippets = buildWorldBookSnippets([item]);
    const sceneHooks = snippets.filter((snippet) => SCENE_PATTERNS.test(snippet)).slice(0, 3);
    const conflictHooks = snippets.filter((snippet) => CONFLICT_PATTERNS.test(snippet)).slice(0, 3);
    const relationHooks = snippets.filter((snippet) => RELATION_PATTERNS.test(snippet)).slice(0, 3);
    const institutionHooks = snippets.filter((snippet) => INSTITUTION_PATTERNS.test(snippet)).slice(0, 3);
    const text = `${item.title} ${item.content}`;
    const preferredThreadTypes = unique([
      /委托|悬赏|征集|找人/.test(text) ? 'commission' : null,
      /求助|怎么办|请问|想问/.test(text) ? 'help' : null,
      /目击|撞见|看到|路过/.test(text) ? 'sighting' : null,
      /记录|时间线|复盘|整理/.test(text) ? 'timeline' : null,
      /投票|站队|押/.test(text) ? 'vote' : null,
      /爆料|匿名|风声|听说/.test(text) ? 'gossip' : null,
      /后续|更新|补充/.test(text) ? 'ownerUpdate' : null,
      /反转|真相|后来发现/.test(text) ? 'reversal' : null,
    ].filter(Boolean) as ForumThreadType[]);

    return {
      sourceTitle: item.title,
      sceneHooks: sceneHooks.length > 0 ? sceneHooks : snippets.slice(0, 2),
      conflictHooks: conflictHooks.length > 0 ? conflictHooks : snippets.slice(0, 2),
      relationHooks: relationHooks.length > 0 ? relationHooks : snippets.slice(0, 2),
      institutionHooks: institutionHooks.length > 0 ? institutionHooks : snippets.slice(0, 2),
      preferredThreadTypes,
    };
  });
}

function pickEcologies(
  ecologies: ForumWorldEcology[],
  recentTexts: string[],
  targetCount: number,
  allowedThreadTypes: ForumThreadType[],
  count: number,
  preferredTopics: string[],
  excludedTopics: string[],
) {
  const picked: ForumWorldEcology[] = [];
  const target = clamp(targetCount, 1, ecologies.length);

  while (picked.length < target) {
    const candidates = ecologies
      .filter((ecology) => !picked.find((item) => item.id === ecology.id))
      .map((ecology, index) => {
        const overlapPenalty = scoreRecentOverlap(ecology, recentTexts) * 18;
        const allowedBoost = ecology.preferredThreadTypes.some((threadType) => allowedThreadTypes.includes(threadType)) ? 8 : 0;
        const userTopicScore = scoreUserTopicAffinity(ecology, preferredTopics, excludedTopics);
        const baseScore = 100 - overlapPenalty + allowedBoost + userTopicScore + (ecologies.length - index);
        return {
          ecology,
          score: Math.max(8, baseScore + (hashString(`${ecology.id}:${count}:${picked.length}`) % 13)),
        };
      })
      .sort((left, right) => right.score - left.score);

    const total = candidates.reduce((sum, item) => sum + item.score, 0);
    let roll = Math.abs(hashString(`${count}:${picked.length}:${recentTexts.join('|')}`)) % Math.max(total, 1);
    let chosen: ForumWorldEcology | undefined;
    candidates.forEach((candidate) => {
      if (chosen) {
        return;
      }
      roll -= candidate.score;
      if (roll < 0) {
        chosen = candidate.ecology;
      }
    });
    if (!chosen && candidates[0]) {
      chosen = candidates[0].ecology;
    }
    if (!chosen) break;
    picked.push(chosen);
  }

  return picked;
}

function buildSlotPlans(input: {
  ecologies: ForumWorldEcology[];
  count: number;
  allowedThreadTypes: ForumThreadType[];
  ordinaryPostFloor?: number;
  worldBookSignals: ForumWorldBookTopicSignal[];
  preferredTopics: string[];
  excludedTopics: string[];
}) {
  const {
    ecologies,
    count,
    allowedThreadTypes,
    ordinaryPostFloor = 0,
    worldBookSignals,
    preferredTopics,
    excludedTopics,
  } = input;
  const allowed = allowedThreadTypes.length > 0 ? allowedThreadTypes : DEFAULT_THREAD_TYPES;

  const baseSlots = Array.from({ length: count }, (_, index): ForumTopicSlotPlan => {
    const ecology = ecologies[index % ecologies.length] || ecologies[0];
    const signal = worldBookSignals.length > 0 ? worldBookSignals[index % worldBookSignals.length] : undefined;
    const seedBase = hashString(`${ecology.id}:${index}:${signal?.sourceTitle || 'none'}`);
    const forcedNormal = ordinaryPostFloor > 0 && index < ordinaryPostFloor && allowed.includes('normal');
    const preferredThreadTypeFromUser = preferredTopics.some((topic) => /求助|帮忙|建议/.test(topic)) && allowed.includes('help')
      ? 'help'
      : preferredTopics.some((topic) => /委托|悬赏|找人|求推荐/.test(topic)) && allowed.includes('commission')
        ? 'commission'
        : preferredTopics.some((topic) => /目击|撞见|看到/.test(topic)) && allowed.includes('sighting')
          ? 'sighting'
          : preferredTopics.some((topic) => /复盘|整理|时间线/.test(topic)) && allowed.includes('timeline')
            ? 'timeline'
            : preferredTopics.some((topic) => /站队|投票|押/.test(topic)) && allowed.includes('vote')
              ? 'vote'
              : undefined;
    const preferredThreadType = forcedNormal
      ? 'normal'
      : (preferredThreadTypeFromUser
        || signal?.preferredThreadTypes.find((threadType) => allowed.includes(threadType))
        || pickPreferredThreadType(ecology, allowed, seedBase));

    const userScene = preferredTopics.find((topic) => SCENE_PATTERNS.test(topic));
    const userConflict = preferredTopics.find((topic) => CONFLICT_PATTERNS.test(topic));
    const userRelation = preferredTopics.find((topic) => RELATION_PATTERNS.test(topic));
    const userStake = preferredTopics.find((topic) => INSTITUTION_PATTERNS.test(topic));
    const blockedHook = excludedTopics.find((topic) => ecology.topicHooks.some((hook) => hook.includes(topic) || topic.includes(hook)));

    return {
      ecologyId: ecology.id,
      ecologyLabel: ecology.label,
      scene: userScene || pickByIndex(signal?.sceneHooks?.length ? signal.sceneHooks : ecology.publicSpaces, seedBase) || ecology.publicSpaces[0] || '公共区',
      conflict: userConflict || pickByIndex(signal?.conflictHooks?.length ? signal.conflictHooks : ecology.eventTypes, seedBase + 3) || ecology.eventTypes[0] || '一点事故',
      relationship: userRelation || pickByIndex(signal?.relationHooks?.length ? signal.relationHooks : ecology.relationStructures, seedBase + 5) || ecology.relationStructures[0] || '半熟关系',
      stake: userStake || pickByIndex(signal?.institutionHooks?.length ? signal.institutionHooks : ecology.stakeStructures, seedBase + 7) || ecology.stakeStructures[0] || '谁更吃亏',
      fermentation: pickByIndex(ecology.fermentationStyles, seedBase + 11) || ecology.fermentationStyles[0] || '吃瓜',
      mood: pickByIndex(ecology.moodKeywords, seedBase + 13) || ecology.moodKeywords[0] || '真实',
      hook: blockedHook
        ? ecology.topicHooks.find((hook) => !(hook.includes(blockedHook) || blockedHook.includes(hook)))
          || ecology.topicHooks[0]
          || ecology.label
        : (pickByIndex(ecology.topicHooks, seedBase + 17) || ecology.topicHooks[0] || ecology.label),
      preferredThreadType,
      commentStyle: pickByIndex(ecology.commentStyles, seedBase + 19) || ecology.commentStyles[0] || '顺手回两句',
    };
  });

  const threadTypeSequence = buildThreadTypeSequence({
    slots: baseSlots,
    allowedThreadTypes: allowed,
    ordinaryPostFloor,
  });

  return baseSlots.map((slot, index) => ({
    ...slot,
    preferredThreadType: threadTypeSequence[index] || slot.preferredThreadType,
  }));
}

function buildThreadTypeSequence(input: {
  slots: ForumTopicSlotPlan[];
  allowedThreadTypes: ForumThreadType[];
  ordinaryPostFloor: number;
}) {
  const { slots, allowedThreadTypes, ordinaryPostFloor } = input;
  const count = slots.length;
  const sequence: ForumThreadType[] = [];
  const counts = new Map<ForumThreadType, number>();
  const allowed = allowedThreadTypes.length > 0 ? allowedThreadTypes : DEFAULT_THREAD_TYPES;
  const maxSameType = Math.max(3, Math.ceil(count / 2));
  const orderedDistinctTypes = slots
    .map((slot) => slot.preferredThreadType)
    .filter((threadType, index, collection) => collection.indexOf(threadType) === index && allowed.includes(threadType));
  const fallbackSpecialTypes = ['help', 'gossip', 'sighting', 'timeline', 'commission', 'sameTopic', 'vote', 'reversal'] as ForumThreadType[];

  for (let index = 0; index < count; index += 1) {
    const forcedNormal = ordinaryPostFloor > 0 && index < ordinaryPostFloor && allowed.includes('normal');
    if (forcedNormal) {
      sequence.push('normal');
      counts.set('normal', (counts.get('normal') || 0) + 1);
      continue;
    }

    const slot = slots[index];
    const candidates = [
      slot.preferredThreadType,
      ...orderedDistinctTypes,
      ...fallbackSpecialTypes.filter((threadType) => allowed.includes(threadType)),
      ...allowed,
    ].filter((threadType, candidateIndex, collection) => collection.indexOf(threadType) === candidateIndex);

    const previous = sequence[sequence.length - 1];
    const previous2 = sequence[sequence.length - 2];
    const chosen = candidates.find((threadType) => {
      const currentCount = counts.get(threadType) || 0;
      if (threadType === previous && threadType === previous2) return false;
      if (threadType !== 'normal' && currentCount >= maxSameType && threadType !== slot.preferredThreadType) return false;
      return true;
    }) || slot.preferredThreadType;

    sequence.push(chosen);
    counts.set(chosen, (counts.get(chosen) || 0) + 1);
  }

  return sequence;
}

function buildThreadTypePlanLines(slotPlans: ForumTopicSlotPlan[]) {
  const counts = slotPlans.reduce<Record<ForumThreadType, number>>((acc, slot) => {
    acc[slot.preferredThreadType] = (acc[slot.preferredThreadType] || 0) + 1;
    return acc;
  }, {} as Record<ForumThreadType, number>);

  const sorted = Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .map(([threadType, count]) => `${threadType} x${count}`);

  const dominantTypes = slotPlans
    .slice(0, 6)
    .map((slot) => slot.preferredThreadType)
    .filter((threadType, index, collection) => collection.indexOf(threadType) === index);

  return [
    sorted.length > 0 ? `本轮帖型分布优先往这些方向长：${sorted.join('、')}。` : '',
    dominantTypes.length > 0 ? `这一轮尽量混开这些帖型：${dominantTypes.join('、')}。避免整页几乎只有一种楼。` : '',
  ].filter(Boolean);
}

export function planForumTopicPackage(input: PlanForumTopicPackageInput): ForumTopicPackage {
  const ecologies = WORLD_ECOLOGIES[input.channel] || WORLD_ECOLOGIES.junction;
  const recentTexts = input.existingPosts
    .slice(0, 10)
    .map((post) => `${post.title} ${post.content}`.replace(/\s+/g, ' '));
  const allowedThreadTypes = input.allowedThreadTypes.length > 0 ? input.allowedThreadTypes : DEFAULT_THREAD_TYPES;
  const ecologyTargetCount = clamp(Math.ceil(input.count / 3), 3, 5);
  const preferredTopics = unique([
    ...splitTopicTokens(input.preferredTopicText),
    ...splitTopicTokens(input.preferredSceneText),
    ...splitTopicTokens(input.preferredConflictText),
    ...splitTopicTokens(input.preferredRelationshipText),
  ]);
  const excludedTopics = splitTopicTokens(input.excludedTopicText);
  const selectedEcologies = pickEcologies(
    ecologies,
    recentTexts,
    ecologyTargetCount,
    allowedThreadTypes,
    input.count,
    preferredTopics,
    excludedTopics,
  );
  const worldBookSignals = extractWorldBookTopicSignals(input.worldBooks || []);
  const slotPlans = buildSlotPlans({
    ecologies: selectedEcologies.length > 0 ? selectedEcologies : ecologies.slice(0, 1),
    count: input.count,
    allowedThreadTypes,
    ordinaryPostFloor: input.ordinaryPostFloor,
    worldBookSignals,
    preferredTopics,
    excludedTopics,
  });

  return {
    channel: input.channel,
    ecologyLabels: selectedEcologies.map((ecology) => ecology.label),
    summaryLines: [
      `本轮默认世界子生态优先从这些方向开：${selectedEcologies.map((ecology) => ecology.label).join('、')}。`,
      `这些子生态覆盖的人群与公共空间包括：${selectedEcologies.map((ecology) => `${ecology.identityEcologies[0]} / ${ecology.publicSpaces[0]}`).join('；')}。`,
      `本轮题材要主动拉开事件、关系和发酵方式，不要只围着同一种关系戏打转。`,
    ],
    worldBookSummaryLines: worldBookSignals.map((signal) => {
      const hookSummary = unique([
        ...signal.sceneHooks.slice(0, 1),
        ...signal.conflictHooks.slice(0, 1),
        ...signal.relationHooks.slice(0, 1),
      ]).join(' / ');
      return `世界书《${signal.sourceTitle}》这轮重点拉动：${hookSummary || signal.sourceTitle}。`;
    }),
    userSummaryLines: [
      input.preferredTopicText?.trim() ? `用户想看的题材关键词：${input.preferredTopicText.trim()}。` : '',
      input.preferredSceneText?.trim() ? `用户想看的场景：${input.preferredSceneText.trim()}。` : '',
      input.preferredConflictText?.trim() ? `用户想看的冲突：${input.preferredConflictText.trim()}。` : '',
      input.preferredRelationshipText?.trim() ? `用户想看的关系感：${input.preferredRelationshipText.trim()}。` : '',
      excludedTopics.length > 0 ? `用户这轮明确不想看：${excludedTopics.join('、')}。题材规划时要主动避开这些方向。` : '',
    ].filter(Boolean),
    threadTypePlanLines: buildThreadTypePlanLines(slotPlans),
    slotPlans,
  };
}
