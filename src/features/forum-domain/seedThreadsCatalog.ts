import type { ForumChannel, ForumCommentV2, ForumThreadType, ForumThreadV2 } from './types';
import type { ForumComment, ForumPost } from '../../types';
import { forumThreadV2ToLegacyPost } from './adapters';

export type ForumSeedAuthorKind = 'forumNpc' | 'userCharacter' | 'userSelf';

export type ForumSeedIdentityMode =
  | 'anonymous'
  | 'nickname'
  | 'channelMask'
  | 'customMask';

export type ForumSeedAuthorTemplate = {
  kind: ForumSeedAuthorKind;
  authorId?: string;
  displayName: string;
  identityMode: ForumSeedIdentityMode;
};

export type ForumSeedCommentTemplate = {
  floor: number;
  author: ForumSeedAuthorTemplate;
  body: string;
  authorRole?: string;
  replyToFloor?: number;
  isOwnerReply?: boolean;
  likes?: number;
};

export type ForumSeedThreadTemplate = {
  id: string;
  channel: ForumChannel;
  threadType: ForumThreadType;
  title: string;
  body: string;
  tags: string[];
  author: ForumSeedAuthorTemplate;
  featuredComments: ForumSeedCommentTemplate[];
};

export type ForumSeedNpcProfile = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  bio: string;
};

type ForumAvatarTheme =
  | 'junction'
  | 'present'
  | 'oldDynasty'
  | 'xianmen'
  | 'otherworld'
  | 'starSea'
  | 'weird'
  | 'cyber'
  | 'anonymous';

const AVATAR_STYLE_BY_THEME: Record<ForumAvatarTheme, string> = {
  junction: 'lorelei',
  present: 'lorelei-neutral',
  oldDynasty: 'lorelei',
  xianmen: 'adventurer',
  otherworld: 'adventurer-neutral',
  starSea: 'lorelei-neutral',
  weird: 'adventurer',
  cyber: 'adventurer-neutral',
  anonymous: 'lorelei-neutral',
};

const seedAvatar = (seed: string, theme: ForumAvatarTheme = 'junction') =>
  `https://api.dicebear.com/9.x/${AVATAR_STYLE_BY_THEME[theme]}/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;

const npcProfile = (
  id: string,
  name: string,
  handle: string,
  theme: ForumAvatarTheme,
  bio: string,
): ForumSeedNpcProfile => ({
  id,
  name,
  handle,
  avatar: seedAvatar(id, theme),
  bio,
});

export const FORUM_SEED_NPC_PROFILES: ForumSeedNpcProfile[] = [
  npcProfile('forum_npc_yiduluanhui', '已读乱回', '瓜熟先叫我', 'junction', '常驻交界，爱看热闹，嘴比脑子快。'),
  npcProfile('forum_npc_menkouchigua', '门口吃瓜专员', '蹲门口捡热评', 'junction', '见过太多热帖现场，擅长补刀。'),
  npcProfile('forum_npc_wangfubaoan', '王府门口保安', '府门口夜不闭', 'oldDynasty', '旧朝区常驻，看得懂宅院里的每一句弯话。'),
  npcProfile('forum_npc_libuwenjiu', '礼部问就是不会', '体面先摆上桌', 'oldDynasty', '旧朝区常驻，主打体面和阴阳怪气。'),
  npcProfile('forum_npc_xinmobanyoubianzhi', '心魔但有编制', '先渡劫再嘴硬', 'xianmen', '仙门区常驻，专治嘴硬和情劫。'),
  npcProfile('forum_npc_wuqingdaoguancha', '无情道观察员', '今日也在破戒', 'xianmen', '仙门热帖固定出没，专门识别假无情。'),
  npcProfile('forum_npc_gonghuiqiantaiyifeng', '公会前台已疯', '委托接到手抖', 'otherworld', '异域区前台打工人，天天看离谱委托。'),
  npcProfile('forum_npc_longzuyeyaoshuijiao', '龙族也要睡觉', '龙鳞别乱摸', 'otherworld', '异域区固定龙族视角发言人。'),
  npcProfile('forum_npc_quanxianbuzu', '权限不足但想看', '白名单旁听生', 'starSea', '星海和赛博城双栖，专看权限事故。'),
  npcProfile('forum_npc_xingwang404', '星网匿名用户404', '冷脸也会偏心', 'starSea', '星海热帖常驻，擅长拆穿高冷话术。'),
  npcProfile('forum_npc_buyaohuitou', '不要回头', '走廊尽头有人', 'weird', '怪谈区固定目击者，像是知道太多。'),
  npcProfile('forum_npc_guizediqitiao', '规则第七条', '先看墙再说话', 'weird', '怪谈区神秘网友，回帖总像提示。'),
  npcProfile('forum_npc_xitongrizhibiefanle', '系统日志别翻了', '越翻越像案底', 'cyber', '赛博城常驻，冷静得像刚删完监控。'),
  npcProfile('forum_npc_996dianziyouling', '996电子幽灵', '报错先怪加班', 'cyber', '赛博城打工人，擅长一句话扎心。'),
  npcProfile('forum_npc_momo', 'momo', '路过顺嘴一句', 'present', '今世区万能路人号，专门一句话点破。'),
  npcProfile('forum_npc_188chunqing', '188纯情母蟑螂', '嘴硬回收中心', 'present', '今世区热评常客，嘴损但准。'),
  npcProfile('forum_npc_lingshibugou', '灵石不够花', '穷但爱看情劫', 'xianmen', '仙门区路过捡瓜，句句都像大实话。'),
  npcProfile('forum_npc_jiuguanlaoban', '酒馆老板不赊账', '先付酒钱再哭', 'otherworld', '异域区老熟人，什么都见过。'),
  npcProfile('forum_npc_lingchensan', '凌晨三点还没睡', '今夜门别乱开', 'weird', '怪谈区常驻活人，精神状态成谜。'),
  npcProfile('forum_npc_jintianbuyixiangshangban', '今天也不想上班', '工位养胃失败', 'present', '今世区社畜发言代表。'),
];

const SEED_NPC_MAP = new Map(FORUM_SEED_NPC_PROFILES.map((profile) => [profile.id, profile]));
const SEED_RUNTIME_AUTHOR_MAP = new Map<string, ForumSeedNpcProfile>();

const anonymousAuthor = (displayName = 'anonymous'): ForumSeedAuthorTemplate => ({
  kind: 'forumNpc',
  displayName,
  identityMode: 'anonymous',
});

const customMaskAuthor = (displayName: string): ForumSeedAuthorTemplate => ({
  kind: 'forumNpc',
  displayName,
  identityMode: 'customMask',
});

const npcAuthor = (authorId: string): ForumSeedAuthorTemplate => ({
  kind: 'forumNpc',
  authorId,
  displayName: SEED_NPC_MAP.get(authorId)?.name || authorId,
  identityMode: 'nickname',
});

const comment = (
  floor: number,
  author: ForumSeedAuthorTemplate,
  body: string,
  likes = 0,
  isOwnerReply = false,
): ForumSeedCommentTemplate => ({
  floor,
  author,
  body,
  likes,
  isOwnerReply,
});

const thread = (input: ForumSeedThreadTemplate): ForumSeedThreadTemplate => input;

export const FORUM_SEED_THREAD_CATALOG: ForumSeedThreadTemplate[] = [
  thread({
    id: 'junction-01-mouth-hard-care',
    channel: 'junction',
    threadType: 'sameTopic',
    title: '嘴上说不喜欢你，但天天管你，这种人一般在想什么？',
    body:
      '我先声明，不是在问我自己，是问一个很典型的案例。\n\n这人平时嘴特别硬，什么“你想多了”“我不是那个意思”挂在嘴边，但对方几点睡、有没有吃饭、和谁走太近、为什么回消息慢，他全都要管。问题是每次被问到是不是在意，又立刻翻脸。\n\n我现在比较好奇的是，这类人是真的不自知，还是纯不肯认？',
    tags: ['交界', '嘴硬', '关系判断'],
    author: npcAuthor('forum_npc_yiduluanhui'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_momo'), '有的人不是不在意，是只能用管人表达在意。', 38),
      comment(2, npcAuthor('forum_npc_wangfubaoan'), '不肯认的居多，认了就要负责。', 49),
      comment(3, npcAuthor('forum_npc_quanxianbuzu'), '也可能已经认了，只是嘴还没跟上。', 31),
    ],
  }),
  thread({
    id: 'junction-02-protect-without-admit',
    channel: 'junction',
    threadType: 'normal',
    title: '有人会认不出自己在护着一个人吗？',
    body:
      '我隔壁那位平时脾气很差，谁都不爱搭理，但只要某个人出现，他就会变得很奇怪。\n\n别人说那个人一句，他一定接话。现场有点不对，他一定第一个过去。嘴上说“关我什么事”，手已经把人挡到后面了。最要命的是，他本人看起来还真觉得自己没有偏心。\n\n会有人迟钝到这种程度吗？',
    tags: ['交界', '护短', '观察帖'],
    author: customMaskAuthor('隔壁楼不愿透露姓名的目击者'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_yiduluanhui'), '会，尤其是那种平时只允许自己嘴硬的人。', 44),
      comment(2, npcAuthor('forum_npc_xingwang404'), '也可能不是认不出，是认出来了不敢承认。', 41),
      comment(3, npcAuthor('forum_npc_momo'), '你这个隔壁听起来一点也不隔壁。', 63),
    ],
  }),
  thread({
    id: 'junction-03-anonymous-recognition',
    channel: 'junction',
    threadType: 'rift',
    title: '认真问，真的会有人通过语气把匿名评论认出来吗？',
    body:
      '事情是这样的，我有个朋友发帖以后，被一个匿名号回了几句。前台当然是匿名，但那个语气、那个停顿、那个明明想护着人又装路人的说法，实在太像某个熟人了。\n\n我朋友现在纠结的是，如果他去问，对方大概率不会承认；如果不问，又总觉得已经认出来了。\n\n这种情况你们一般怎么处理？',
    tags: ['交界', '匿名', '认人', '论坛联动'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xinmobanyoubianzhi'), '认出来和被承认是两回事。', 45),
      comment(2, npcAuthor('forum_npc_188chunqing'), '先装不知道，让对面自己露口风。', 52),
      comment(3, npcAuthor('forum_npc_yiduluanhui'), '有些人匿名了，嘴还是没匿名。', 60),
    ],
  }),
  thread({
    id: 'junction-04-public-fight-private-good',
    channel: 'junction',
    threadType: 'normal',
    title: '公开区一天到晚跟你互呛的人，私下反而最先来找你，这算什么关系？',
    body:
      '不是恋爱脑提问，是真现象。\n\n有些人评论区里句句跟你过不去，见缝插针阴阳怪气，你以为他最烦你。结果真出事的时候，先来敲你私聊窗的是他；别人只会看热闹的时候，他已经开始问你还好不好。\n\n这类人到底是单纯嘴贱，还是另有成分？',
    tags: ['交界', '评论区', '关系判断'],
    author: npcAuthor('forum_npc_menkouchigua'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jintianbuyixiangshangban'), '有的人表达在意的方式就是先惹你。', 27),
      comment(2, npcAuthor('forum_npc_wuqingdaoguancha'), '嘴上动刀，实际护人，这种我见太多。', 31),
      comment(3, npcAuthor('forum_npc_996dianziyouling'), '算一种很烦但很稳定的偏心。', 43),
    ],
  }),
  thread({
    id: 'junction-05-crossworld-breakup',
    channel: 'junction',
    threadType: 'sameTopic',
    title: '分开以后还留着你的权限、钥匙、通行牌，这种到底是忘了还是故意？',
    body:
      '这个问题最近出现频率太高了，我干脆开一帖。\n\n有人分开以后不删门禁，有人不收回临时权限，有人留着共享账号，有人装作忘了取回钥匙。你说他不在意吧，这些明明都能处理；你说他在意吧，他又一句解释都没有。\n\n我比较想知道，这种“留一条后路”的行为通常意味着什么。',
    tags: ['交界', '分开以后', '权限', '钥匙'],
    author: npcAuthor('forum_npc_yiduluanhui'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_quanxianbuzu'), '有时候不是忘，是不舍得彻底断。', 39),
      comment(2, npcAuthor('forum_npc_libuwenjiu'), '也可能是在等你先开口。', 28),
      comment(3, npcAuthor('forum_npc_momo'), '最怕的是两边都在等，结果谁也不说。', 46),
    ],
  }),
  thread({
    id: 'junction-06-caught-seen-post',
    channel: 'junction',
    threadType: 'reversal',
    title: '发完帖才发现当事人也在这个论坛里，这种时候删帖来得及吗？',
    body:
      '我不是问技术问题，我知道能删。\n\n我问的是心理问题。就是那种你在公共区发了一大段，试图分析某个人到底什么意思，结果刚发出去没多久，就发现对方不仅在这个论坛里，而且可能已经看到了。\n\n请问这种时候最体面的是删帖、装死，还是等他先说？',
    tags: ['交界', '社死', '当事人出现'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_menkouchigua'), '删帖只会显得你更心虚。', 54),
      comment(2, npcAuthor('forum_npc_188chunqing'), '装死，等他先憋不住。', 42),
      comment(3, npcAuthor('forum_npc_xingwang404'), '如果他已经看到了，你现在做什么都晚了。', 58),
    ],
  }),
  thread({
    id: 'junction-07-familiar-strangers',
    channel: 'junction',
    threadType: 'normal',
    title: '论坛里反复遇见一个人，但现实里一句都没说过，这种熟算熟吗？',
    body:
      '我们没有正式认识，没交换过名字，也没私聊过。\n\n但同一个论坛里，他总在我发过的帖下出现；我刷热帖时，也总能看到他。偶尔回我一句，偶尔替我接一句，偶尔阴阳我一下。久了以后，哪怕完全不认识，看到那个显示名也会觉得熟。\n\n这种“公共空间里的眼熟感”，算不算关系？',
    tags: ['交界', '眼熟感', '论坛关系'],
    author: npcAuthor('forum_npc_yiduluanhui'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_momo'), '算，公共空间里的熟也是熟。', 33),
      comment(2, npcAuthor('forum_npc_wangfubaoan'), '很多关系一开始就是从眼熟长出来的。', 38),
      comment(3, npcAuthor('forum_npc_buyaohuitou'), '有时候真正让人记住的，不是名字，是反复出现。', 29),
    ],
  }),
  thread({
    id: 'junction-08-mask-overfit',
    channel: 'junction',
    threadType: 'normal',
    title: '总觉得一个人的马甲越换越明显，这算技术问题还是性格问题？',
    body:
      '见过一种人，明明每次匿名、换马甲、换频道都换得很彻底，但说话方式、用词、发火点、护人方式全部一模一样。\n\n我现在怀疑有的人根本不适合匿名，因为马甲只是换了壳，里面的人一点没收住。\n\n这种情况是对方太明显，还是我观察过头了？',
    tags: ['交界', '马甲', '匿名', '识别'],
    author: customMaskAuthor('交界临时路人甲'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_996dianziyouling'), '匿名最难改的从来不是名字，是习惯。', 37),
      comment(2, npcAuthor('forum_npc_xinmobanyoubianzhi'), '性格问题，甚至算执念问题。', 24),
      comment(3, npcAuthor('forum_npc_yiduluanhui'), '有些人换一百个号，还是一眼能认出来。', 41),
    ],
  }),
  thread({
    id: 'junction-09-relationship-contradiction',
    channel: 'junction',
    threadType: 'normal',
    title: '一个人可以一边否认关系，一边把你默认进自己生活里吗？',
    body:
      '最近老看到这种情况：嘴上不承认，行动上已经把你算进去了。\n\n吃饭会顺手带你那份，办事会先想到你，安排时间会自动把你的习惯也算进去。你真问他，他又说“不要多想”“只是顺手”。\n\n我现在已经分不清这种是嘴硬，还是习惯先于承认了。',
    tags: ['交界', '默认', '关系推进'],
    author: npcAuthor('forum_npc_menkouchigua'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jintianbuyixiangshangban'), '习惯先于承认很常见。', 32),
      comment(2, npcAuthor('forum_npc_libuwenjiu'), '默认进生活这件事，本身就很说明问题。', 35),
      comment(3, npcAuthor('forum_npc_momo'), '你都被算进计划里了，还在问。', 48),
    ],
  }),
  thread({
    id: 'junction-10-shared-topic-aftercare',
    channel: 'junction',
    threadType: 'ownerUpdate',
    title: '有人会因为你在公共区发过的帖子，后来在私下记很久吗？',
    body:
      '我一直觉得论坛就是论坛，聊完就过去了。\n\n结果后来才发现，有些人会记住你在帖子里说过的话，甚至会在之后私下聊天时突然提起。那种感觉很微妙，因为你会意识到，原来你在公共区留下的东西，并没有真的留在公共区。\n\n你们有过这种体验吗？',
    tags: ['交界', '共同记忆', '论坛联动'],
    author: npcAuthor('forum_npc_yiduluanhui'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wangfubaoan'), '有，真正记住你的人会把公共区的话带走。', 28),
      comment(2, npcAuthor('forum_npc_quanxianbuzu'), '这就是为什么匿名也不完全安全。', 33),
      comment(3, npcAuthor('forum_npc_buyaohuitou'), '被人记住，有时候比被人认出来更明显。', 25),
    ],
  }),

  thread({
    id: 'present-01-roommate-delivery',
    channel: 'present',
    threadType: 'normal',
    title: '室友说只是顺手给我带饭，但已经连续带了二十多天了',
    body:
      '我们开学时关系一般，甚至因为空调温度互相阴阳过。\n\n后来有一次我赶论文没去食堂，她顺手帮我带了一次饭，然后事情就开始不对劲了。现在只要她下楼，就会问我要不要带；我说不用，她还是会带；我说减肥，她就换成轻食。\n\n她昨天还说“我是不想看你饿死影响宿舍评分”。请问这到底还是室友情吗？',
    tags: ['今世', '室友', '投喂'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_188chunqing'), '二十多天还叫顺手？这是固定路线。', 61),
      comment(2, npcAuthor('forum_npc_momo'), '你哪天说自己不舒服试试。', 37),
      comment(3, npcAuthor('forum_npc_jintianbuyixiangshangban'), '她嘴硬得挺标准。', 29),
    ],
  }),
  thread({
    id: 'present-02-ex-takeout-account',
    channel: 'present',
    threadType: 'normal',
    title: '分手后前任还在用我的外卖账号，是没放下还是单纯懒？',
    body:
      '分开快两个月了，账号我一直没改。\n\n她最近还是会隔三差五下单，我一开始还会多想，结果昨晚她用我会员券点了一份双人套餐。我现在已经不知道这到底是在暗示我，还是单纯懒得重新绑卡。\n\n要不要去问，还是继续装不知道？',
    tags: ['今世', '前任', '外卖账号'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_momo'), '先照镜子，再决定要不要多想。', 73),
      comment(2, npcAuthor('forum_npc_jintianbuyixiangshangban'), '也可能她只是懒。这个可能性很残忍，但真实。', 52),
      comment(3, npcAuthor('forum_npc_188chunqing'), '你还在盯订单详情，说明你也没放下。', 66),
    ],
  }),
  thread({
    id: 'present-03-boss-breakfast',
    channel: 'present',
    threadType: 'normal',
    title: '上司每天嘴我，但也每天给我带早饭，这种算职场PUA还是别的？',
    body:
      '我上司平时说话很不好听，文件格式错一个标点都要被他点出来。\n\n但问题是，他早上来得比谁都早，而且已经连续半个月把早餐顺手放我工位上了。我说不用，他说“怕你低血糖再把表做错”。\n\n请问这种应该往职场恐怖故事方向理解，还是往别的方向理解？',
    tags: ['今世', '上司', '打工', '早餐'],
    author: npcAuthor('forum_npc_jintianbuyixiangshangban'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_momo'), '先确认一下，他是不是只给你带。', 42),
      comment(2, npcAuthor('forum_npc_188chunqing'), '如果只给你带，那就不是公司福利。', 57),
      comment(3, anonymousAuthor(), '打工人建议先吃，再分析。', 21),
    ],
  }),
  thread({
    id: 'present-04-friends-circle-stalk',
    channel: 'present',
    threadType: 'observation' as ForumThreadType,
    title: '暧昧对象把我三年前的朋友圈翻到昨晚，这正常吗？',
    body:
      '不是我偷看，是系统提示了浏览痕迹。\n\n我俩目前关系停留在会聊天、会单独吃饭、但谁都没挑明那一步。结果他昨晚把我三年前旅游、两年前吐槽前司、一年前半夜发疯的朋友圈全翻了一遍。\n\n正常人会这样吗？还是我该开始害怕了？',
    tags: ['今世', '暧昧', '朋友圈', '观察'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_momo'), '不正常，但很在意。', 64),
      comment(2, npcAuthor('forum_npc_188chunqing'), '正常人不会翻那么深，喜欢你的人会。', 58),
      comment(3, anonymousAuthor(), '至少说明他不只在看你今天。', 25),
    ],
  }),
  thread({
    id: 'present-05-doctor-cold-face',
    channel: 'present',
    threadType: 'normal',
    title: '医生朋友嘴上说别矫情，手上却把我的药分好装袋了',
    body:
      '我感冒发烧，去找朋友拿药。\n\n他全程脸都很冷，说我就是作，熬夜熬出来的，活该。结果骂完以后又把药按早中晚分好，连饭前饭后都贴了便签，还发消息问我有没有量体温。\n\n这种人到底是不是只会用骂人表达关心？',
    tags: ['今世', '朋友', '照顾', '嘴硬'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jintianbuyixiangshangban'), '是，他甚至骂得很熟练。', 39),
      comment(2, npcAuthor('forum_npc_momo'), '药都给你分好了，你还在问。', 55),
      comment(3, anonymousAuthor(), '骂你是习惯，照顾你也是。', 22),
    ],
  }),
  thread({
    id: 'present-06-neighbor-cat',
    channel: 'present',
    threadType: 'normal',
    title: '楼下邻居天天说嫌我家猫吵，结果猫一跑丢他比我先找',
    body:
      '他平时老说我家猫半夜疯跑，影响他睡觉。\n\n结果昨晚猫从窗台跑出去了，我还没反应过来，他已经穿外套下楼找了。最后是他把猫抱回来的，怀里还裹着自己的外套。回来的第一句却是：“下次看好，别再吵到别人。”\n\n请问这是单纯怕猫出事，还是单纯嘴坏？',
    tags: ['今世', '邻居', '猫', '嘴硬'],
    author: npcAuthor('forum_npc_menkouchigua'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_188chunqing'), '猫只是借口，他主要是在管你。', 48),
      comment(2, npcAuthor('forum_npc_momo'), '抱回来还裹外套，这题很明显。', 43),
      comment(3, anonymousAuthor(), '他下次大概率还会继续嫌。', 19),
    ],
  }),
  thread({
    id: 'present-07-group-project',
    channel: 'present',
    threadType: 'normal',
    title: '组员平时和我不对付，答辩前却通宵帮我改PPT，这是什么路数？',
    body:
      '我俩平时在组里一直不算和睦，意见经常对着来。\n\n但昨天答辩前我电脑突然出问题，他一边骂我怎么这么能出事，一边坐在我旁边把整份PPT从头顺到尾，甚至把我讲稿也改好了。改完还说“别误会，我是不想被你拖死”。\n\n这种到底算临场义气，还是他平时只是嘴臭？',
    tags: ['今世', '校园', '答辩', 'PPT'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jintianbuyixiangshangban'), '嘴臭和会帮你不冲突。', 34),
      comment(2, npcAuthor('forum_npc_momo'), '先记住一点，他可以不帮。', 47),
      comment(3, anonymousAuthor(), '答辩前通宵改稿，这不是一般同学情。', 28),
    ],
  }),
  thread({
    id: 'present-08-blind-date-protection',
    channel: 'present',
    threadType: 'normal',
    title: '相亲对象迟到一个小时，我朋友比我还生气，这正常吗？',
    body:
      '我被家里安排去见一个人，朋友嘴上说随便我，结果全程在线等消息。\n\n后来对方迟到一个多小时，我还没说什么，我朋友先炸了，直接发语音问我是不是还坐着。回家以后她还认真跟我分析对方哪里不行，越说越气。\n\n请问朋友替你生气到这个程度，正常吗？',
    tags: ['今世', '相亲', '朋友', '护短'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_188chunqing'), '护短的人都这样，先气再骂。', 41),
      comment(2, npcAuthor('forum_npc_momo'), '她可能比你更不想你将就。', 38),
      comment(3, anonymousAuthor(), '也可能她单纯看不上那人。', 17),
    ],
  }),
  thread({
    id: 'present-09-late-night-message',
    channel: 'present',
    threadType: 'ownerUpdate',
    title: '有人白天装高冷，晚上却会追着问你到家没有吗？',
    body:
      '白天的时候，他话很少，也不太会主动找我。\n\n但只要我晚上回得晚一点，他一定会问。问到家没有，问是不是打到车，问为什么这么久不回。第二天见面又像什么都没发生。\n\n我已经开始怀疑，夜里和白天的根本不是同一个人。',
    tags: ['今世', '夜聊', '高冷', '关心'],
    author: npcAuthor('forum_npc_momo'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jintianbuyixiangshangban'), '白天嘴硬，晚上暴露，很常见。', 31),
      comment(2, npcAuthor('forum_npc_188chunqing'), '夜里更容易忘记装。', 36),
      comment(3, anonymousAuthor(), '他不是两个人，他只是晚上更诚实。', 22),
    ],
  }),
  thread({
    id: 'present-10-user-post-seen',
    channel: 'present',
    threadType: 'reversal',
    title: '我发的树洞帖被认识的人刷到了，他评论区装路人，这算什么？',
    body:
      '我昨晚匿名发了个树洞，内容没指名道姓，但知道的人应该能看出来在说谁。\n\n结果今天一早，评论区里有个号说话的方式特别像他。看起来像路人，其实每句话都像在替自己辩解，又像在护着我。\n\n我现在比较纠结的是，要不要戳穿。' ,
    tags: ['今世', '树洞', '匿名', '装路人'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_momo'), '别戳，让他自己露。', 57),
      comment(2, npcAuthor('forum_npc_188chunqing'), '匿名了但没匿名干净，这种最有意思。', 45),
      comment(3, anonymousAuthor(), '要是真是他，那他已经在意到忍不住了。', 29),
    ],
  }),

  thread({
    id: 'old-01-yard-people-swapped',
    channel: 'oldDynasty',
    threadType: 'normal',
    title: '他说只是照拂，却把我院里的人全换成了他那边拨来的',
    body:
      '名义上我只是借住，并无名分。\n\n可这两个月里，我院里的守夜、采买、煎药、账房，慢慢全被换成了他的人。我昨天不过多看了两眼门房送来的帖子，晚上他就来问近来是不是有人同我走得太近。\n\n这到底算照拂，还是算别的？',
    tags: ['旧朝', '名分', '后宅', '照拂'],
    author: npcAuthor('forum_npc_libuwenjiu'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wangfubaoan'), '这不叫照拂，这叫把你纳进自己院里了。', 53),
      comment(2, anonymousAuthor(), '嘴上不给名分，手上全是正经待遇。', 34),
      comment(3, npcAuthor('forum_npc_menkouchigua'), '旧朝男人最爱拿安全当借口。', 27),
    ],
  }),
  thread({
    id: 'old-02-betrothal-delay',
    channel: 'oldDynasty',
    threadType: 'normal',
    title: '家里要我和不对付的人订婚，我能不能先拖一拖？',
    body:
      '我不说她坏，只说我们实在合不来。\n\n她行事放肆，话里没边，偏偏长辈都觉得她有趣，还说我太拘。现在婚约几乎定下，我一提不愿意，家里就说我不识抬举。\n\n这种时候除了拖，还能怎么办？',
    tags: ['旧朝', '婚约', '家里做主'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wangfubaoan'), '你要是真不愿意，拖只是缓一时。', 33),
      comment(2, npcAuthor('forum_npc_libuwenjiu'), '你越强调她放肆，越像已经被她拿住了心思。', 46),
      comment(3, anonymousAuthor(), '你先想清楚，你是不愿订，还是不愿认。', 29),
    ],
  }),
  thread({
    id: 'old-03-tea-cake-monastery',
    channel: 'oldDynasty',
    threadType: 'reversal',
    title: '我夫君说要去寺里清静几天，这话一般能信几分？',
    body:
      '昨夜我们为了点小事争了几句。\n\n他先说我不可理喻，后来又说自己心境不稳，再这样下去不如去寺里住两日。今早居然真的让人收拾佛经和换洗衣裳了。\n\n我现在想问的是，男人说要去出家冷静，和女人说要绝交删人，是一个性质吗？',
    tags: ['旧朝', '夫妻吵架', '寺里'],
    author: customMaskAuthor('东门热心嫂子'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wangfubaoan'), '不一样，女人删人能删三天，男人出家多半出三刻。', 58),
      comment(2, anonymousAuthor(), '你先说说那点小事到底有多小。', 24),
      comment(3, customMaskAuthor('东门热心嫂子'), '只是把他藏的茶饼送给我弟了。', 18, true),
    ],
  }),
  thread({
    id: 'old-04-war-camp-return',
    channel: 'oldDynasty',
    threadType: 'normal',
    title: '将军把我从敌营带回来，却说只是军令所需',
    body:
      '我并非他府中之人，也不算什么要紧人物。\n\n那夜敌营混乱，他本可先护军报，却偏偏绕路把我带了出来。后来我问他为何如此，他只说“顺手”，还让我不要多想。\n\n可他回来后又亲自查我伤口、问我饮食，这种“顺手”未免太细了。是我会错意了吗？',
    tags: ['旧朝', '将军', '敌营', '顺手'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wangfubaoan'), '军令若真只为军报，他不会亲自绕回来。', 47),
      comment(2, npcAuthor('forum_npc_libuwenjiu'), '旧朝男人口中的顺手，通常都不顺。', 40),
      comment(3, anonymousAuthor(), '你要是再问，他大概率还会说别多想。', 19),
    ],
  }),
  thread({
    id: 'old-05-curtain-after-banquet',
    channel: 'oldDynasty',
    threadType: 'normal',
    title: '他在宴上跟我撇清，回去却把来见我的人都挡了',
    body:
      '昨夜宴上有人拿我开玩笑，他当众只说了一句“与我无干”。\n\n我本以为自己听明白了，结果散席后才知道，今晚想来见我的几拨人全被他的人拦在外头。问他，他又只说“夜深了，不宜见客”。\n\n这种人到底在别扭什么？',
    tags: ['旧朝', '宴席', '撇清', '别扭'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_libuwenjiu'), '面上撇清，背后全挡，这叫体面地护短。', 44),
      comment(2, npcAuthor('forum_npc_wangfubaoan'), '旧朝很多人只敢在背后偏心。', 32),
      comment(3, anonymousAuthor(), '他说无干的时候，自己信了吗？', 21),
    ],
  }),
  thread({
    id: 'old-06-physician-call',
    channel: 'oldDynasty',
    threadType: 'normal',
    title: '我不过咳了两声，他连夜把太医请来了，这算夸张吗？',
    body:
      '我自认身子还算过得去。\n\n昨夜只是风大，我咳了两声，今日天还没亮，太医就被请进了院。问起来，下人只说是他不放心。我说未免太过，他却只回一句“你病起来最会拖”。\n\n请问这种算小题大做，还是早有前科？',
    tags: ['旧朝', '太医', '照顾', '生病'],
    author: customMaskAuthor('临窗咳两声'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wangfubaoan'), '如果不是你有前科，就是他太在意。', 36),
      comment(2, npcAuthor('forum_npc_libuwenjiu'), '能半夜惊动太医的，通常不是普通关心。', 41),
      comment(3, anonymousAuthor(), '“你病起来最会拖”这句挺熟。', 17),
    ],
  }),
  thread({
    id: 'old-07-hairpin-choice',
    channel: 'oldDynasty',
    threadType: 'normal',
    title: '他说不懂女儿家物件，却把我常戴哪支簪子记得比我还清楚',
    body:
      '前几日出门时我随口说找不到一支旧簪子。\n\n他当时还说自己哪懂这些，结果第二天就让人送来，说已经叫人按我平日常戴的那支样式打了新的，连珠钗偏左一点都没错。\n\n不懂的人会记这么清楚吗？',
    tags: ['旧朝', '簪子', '细节', '记得'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_libuwenjiu'), '不懂是真，不看别人只看你也是真。', 35),
      comment(2, npcAuthor('forum_npc_wangfubaoan'), '他可能不懂簪子，但很懂你。', 47),
      comment(3, anonymousAuthor(), '细节记到这种程度，已经不只是顺眼。', 20),
    ],
  }),
  thread({
    id: 'old-08-nickname-slip',
    channel: 'oldDynasty',
    threadType: 'ownerUpdate',
    title: '他平时最讲礼数，昨夜却在众人面前叫了我小时候的乳名',
    body:
      '他向来最守规矩，称呼从不越矩。\n\n可昨夜人一多事也杂，我差点被烛台烫到，他伸手拉我时，脱口叫的却是我小时候在家里才有人叫的乳名。说完他自己也愣了一下，后来整晚都没再看我。\n\n这种失口，通常说明什么？',
    tags: ['旧朝', '乳名', '失口', '礼数'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wangfubaoan'), '说明这名字在他心里已经叫过很多次。', 61),
      comment(2, npcAuthor('forum_npc_libuwenjiu'), '礼数会失手，习惯不会。', 42),
      comment(3, anonymousAuthor(), '后面不看你，多半是他自己先慌了。', 25),
    ],
  }),
  thread({
    id: 'old-09-marriage-document',
    channel: 'oldDynasty',
    threadType: 'reversal',
    title: '他说只是暂管我的婚书，为什么连封皮都重新换好了？',
    body:
      '我的婚书原本只是临时收在他那里。\n\n我今日去取，才发现不仅收得妥当，连被雨打湿过的封皮都换成了新的，边角折痕都理平了。问他，他只说“顺手”。可连我都懒得整理的东西，他怎么会顺手做到这个地步？\n\n这人是不是对顺手有什么误解？',
    tags: ['旧朝', '婚书', '顺手', '细节'],
    author: customMaskAuthor('不想取婚书的人'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_libuwenjiu'), '有些人嘴上顺手，手底下全是私心。', 38),
      comment(2, npcAuthor('forum_npc_wangfubaoan'), '真不在意的人不会连封皮都换。', 34),
      comment(3, anonymousAuthor(), '你听起来也不是很想拿回来。', 22),
    ],
  }),
  thread({
    id: 'old-10-ride-back-home',
    channel: 'oldDynasty',
    threadType: 'normal',
    title: '回府的车驾明明有两辆，他却非要让我和他同乘',
    body:
      '昨夜从别院回城，府里备了两辆车。\n\n我本想自己坐一辆，省得招闲话，可他却直接把帘子掀开，让我上他的车。一路上他也没多说什么，只在我困得打盹时把披风往我身上压了压。到了府门口又恢复那副正经样子。\n\n这种人到底是胆大，还是只会在没人的地方明显？',
    tags: ['旧朝', '同乘', '披风', '别院'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wangfubaoan'), '在人前要体面，在车里就顾不上装了。', 45),
      comment(2, npcAuthor('forum_npc_libuwenjiu'), '胆大和只会偷着明显，并不冲突。', 31),
      comment(3, anonymousAuthor(), '披风这一下已经很说明问题了。', 23),
    ],
  }),

  thread({
    id: 'xian-01-check-meridian',
    channel: 'xianmen',
    threadType: 'normal',
    title: '师兄修无情道，却日日查我灵脉，这算正常同门情吗？',
    body:
      '我前阵子练剑时灵息走岔过一次，后来师兄就开始隔三差五来查我灵脉，说是怕我留下暗伤。\n\n问题是，他修无情道，平时对别人比冰还冷，别的师弟师妹摔进药池他都让人自己爬。我咳一声，他却能皱眉。\n\n这种到底算职责，还是我快生心魔了？',
    tags: ['仙门', '师兄', '无情道', '灵脉'],
    author: npcAuthor('forum_npc_wuqingdaoguancha'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xinmobanyoubianzhi'), '这不叫无情道，这叫嘴硬道。', 62),
      comment(2, npcAuthor('forum_npc_lingshibugou'), '别人掉药池让自己爬，你咳一声他皱眉，很明显了。', 49),
      comment(3, anonymousAuthor(), '他要是真无情，就不会盯着你。', 28),
    ],
  }),
  thread({
    id: 'xian-02-kill-wife-proof',
    channel: 'xianmen',
    threadType: 'normal',
    title: '我夫君想请无情道修士杀妻证道，我该先跑还是先报官？',
    body:
      '不是玩笑，我今天真的在他案上看见了写着我生辰八字的纸。\n\n他最近总说修行卡在瓶颈，后来结识了一个修无情道的，说斩断尘缘最快。我一开始以为只是说说，结果今日越想越不对。\n\n这种情况是不是已经不需要讲理了？',
    tags: ['仙门', '求助', '杀妻证道'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xinmobanyoubianzhi'), '先跑，跑远点，别浪费时间分析。', 58),
      comment(2, npcAuthor('forum_npc_wuqingdaoguancha'), '真正的无情道也不是这么修的。', 39),
      comment(3, anonymousAuthor(), '你现在还能发帖，说明还有机会。', 21),
    ],
  }),
  thread({
    id: 'xian-03-heart-demon-like-master',
    channel: 'xianmen',
    threadType: 'ownerUpdate',
    title: '师尊说我的心魔像他，这种话是能随便说的吗？',
    body:
      '昨夜静室走火，我被师尊强行压住心神后，他问我最近是不是总梦见同一个人。\n\n我装傻，他看了我一会儿，居然说：“那心魔像我也正常。”\n\n我现在的问题不是像不像，是他怎么知道我心魔长什么样？',
    tags: ['仙门', '师尊', '心魔', '梦'],
    author: customMaskAuthor('外门药童今天也想跑路'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_lingshibugou'), '因为他也看见了，或者他早猜到了。', 37),
      comment(2, npcAuthor('forum_npc_xinmobanyoubianzhi'), '重点难道不是你默认像他。', 54),
      comment(3, anonymousAuthor(), '你今晚大概率还会继续梦。', 24),
    ],
  }),
  thread({
    id: 'xian-04-seclusion-leaving-note',
    channel: 'xianmen',
    threadType: 'normal',
    title: '闭关前只给我留了心法，不给旁人，这正常吗？',
    body:
      '师门最近都知道他要闭关。\n\n按理说临走前该交代的事应该都交代给执事弟子，可他偏偏只把一本批注得很细的心法留给了我，还特地说若我看不懂可以去问他留在洞府外的灵识。\n\n这种安排是不是过于具体了？',
    tags: ['仙门', '闭关', '心法', '偏心'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wuqingdaoguancha'), '只给你留，已经很说明问题。', 35),
      comment(2, npcAuthor('forum_npc_xinmobanyoubianzhi'), '闭关都没忘记给你留后手。', 42),
      comment(3, anonymousAuthor(), '灵识答疑这一步有点太周到了。', 19),
    ],
  }),
  thread({
    id: 'xian-05-mozun-kills-others',
    channel: 'xianmen',
    threadType: 'normal',
    title: '魔尊每次都说要杀我，但每次死的都是别人，这合理吗？',
    body:
      '我知道这标题听起来像炫耀，但我是真有点怕。\n\n他第一次说要杀我时，我以为自己活不过当天。结果最后折的是追我的那批人。第二次也是，他一边说我碍眼，一边把冲我来的法器全挡了。\n\n这种“要杀你”到底还算不算威胁？',
    tags: ['仙门', '魔尊', '嘴硬', '危险'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xinmobanyoubianzhi'), '算，算另一种意义上的威胁。', 51),
      comment(2, npcAuthor('forum_npc_lingshibugou'), '他说要杀你，结果总在杀别人，这很难不多想。', 34),
      comment(3, anonymousAuthor(), '你要小心的是他自己也没想清楚。', 18),
    ],
  }),
  thread({
    id: 'xian-06-dao-lv-contract',
    channel: 'xianmen',
    threadType: 'normal',
    title: '道侣契只是临时挡灾，他为什么到现在还不肯解？',
    body:
      '起初只是为了挡一场劫。\n\n那时候情况紧急，我们以为等灾过去就解。可现在一切都平了，我提过两次，他第一次说时机未到，第二次干脆不接话。最离谱的是，前天有人误叫我一声“夫人”，他居然也没纠正。\n\n这契到底是谁不想解？',
    tags: ['仙门', '道侣契', '不肯解', '嘴硬'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wuqingdaoguancha'), '答案很明显，只是你还在等他承认。', 44),
      comment(2, npcAuthor('forum_npc_xinmobanyoubianzhi'), '时机未到通常翻译成我不想解。', 47),
      comment(3, anonymousAuthor(), '没纠正那一声就已经很有意思了。', 23),
    ],
  }),
  thread({
    id: 'xian-07-broken-ring',
    channel: 'xianmen',
    threadType: 'reversal',
    title: '他说怕我拖累修行，结果我真走了他先破戒',
    body:
      '前些日子他说得很冷，说我心不定，留在他身边只会拖累彼此修行。\n\n我一气之下真的下山了，结果才走两日，他自己先破了闭口戒，还托人一路找我。现在见了面又不肯承认，只说我外头太乱，怕我惹事。\n\n这种人是不是非要失去一下才诚实？',
    tags: ['仙门', '破戒', '下山', '追回'],
    author: customMaskAuthor('下山两日被抓回的人'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xinmobanyoubianzhi'), '对，有些人不失去就不会承认。', 39),
      comment(2, npcAuthor('forum_npc_lingshibugou'), '他说怕你拖累，结果最先乱的是他。', 42),
      comment(3, anonymousAuthor(), '破戒比嘴诚实多了。', 20),
    ],
  }),
  thread({
    id: 'xian-08-sword-cultivator-fear-height',
    channel: 'xianmen',
    threadType: 'normal',
    title: '剑修嘴上嫌我废，御剑时却总把我拎到前面，这正常吗？',
    body:
      '我御风很差，他嫌弃过很多次。\n\n可每次真要过山渡河，他又总把我拎到自己前面，说后面晃得更厉害。前天我差点掉下去，他反应比我快得多，抓住以后还骂我手短。\n\n请问剑修是不是都这么别扭？',
    tags: ['仙门', '剑修', '御剑', '别扭'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_wuqingdaoguancha'), '不是所有剑修都这样，是对你才这样。', 34),
      comment(2, npcAuthor('forum_npc_lingshibugou'), '嫌你废和怕你掉，是两条并行线。', 28),
      comment(3, anonymousAuthor(), '抓住以后还骂，这很标准。', 17),
    ],
  }),
  thread({
    id: 'xian-09-talisman-pocket',
    channel: 'xianmen',
    threadType: 'normal',
    title: '有人会把护身符偷偷塞进你袖袋里，还装作不是自己放的吗？',
    body:
      '我今天整理袖袋时，掉出来一枚新的护身符。\n\n这符纸画法我认得，跟某人的手势一模一样。问题是我前两天才在他面前说过，最近出门总觉得不安。他当时只回了我一句“少想些没用的”。\n\n结果转头就把符塞进来了，这种人是不是根本不会正常说话？',
    tags: ['仙门', '护身符', '袖袋', '嘴硬'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xinmobanyoubianzhi'), '会做不会说，是很多人的病。', 29),
      comment(2, npcAuthor('forum_npc_wuqingdaoguancha'), '你都认出他的画法了，还问。', 41),
      comment(3, anonymousAuthor(), '正常说话对他来说可能比画符难。', 18),
    ],
  }),
  thread({
    id: 'xian-10-master-door-open',
    channel: 'xianmen',
    threadType: 'ownerUpdate',
    title: '他平时不许人进洞府，为什么我去敲门时门自己开了？',
    body:
      '师门里都知道，他那处洞府平日谁都进不得。\n\n我只是按惯例送药，门还没敲第二下，禁制就自己开了。后来问执事，执事说他根本没撤禁，只是把我的气息提前录进去了。\n\n请问把人提前录进禁制里，一般算到什么程度？',
    tags: ['仙门', '洞府', '禁制', '气息'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_lingshibugou'), '算到很难装不在意的程度。', 37),
      comment(2, npcAuthor('forum_npc_xinmobanyoubianzhi'), '禁制比嘴诚实。', 46),
      comment(3, anonymousAuthor(), '录气息这一步已经很私人了。', 24),
    ],
  }),

  thread({
    id: 'other-01-dragon-at-door',
    channel: 'otherworld',
    threadType: 'normal',
    title: '龙族队友连续七天睡在我门口，说是在守夜，这合理吗？',
    body:
      '上周我夜里被低阶影兽偷袭过一次，伤口都没重到要进圣堂。\n\n结果从那天开始，我的龙族队友每晚都抱着披风坐在我门外。我让他回去睡，他说龙族夜视好；我说旅馆会吵到别人，他说自己很安静。\n\n请问这在龙族文化里到底算正常，还是他单纯有病？',
    tags: ['异域', '龙族', '守夜', '门口'],
    author: npcAuthor('forum_npc_gonghuiqiantaiyifeng'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_longzuyeyaoshuijiao'), '这已经很接近守护意识了。', 53),
      comment(2, npcAuthor('forum_npc_jiuguanlaoban'), '老板娘如果都看出来了，那就不是你想多。', 38),
      comment(3, anonymousAuthor(), '你先问问他对别人会不会也这样。', 19),
    ],
  }),
  thread({
    id: 'other-02-dragon-baby',
    channel: 'otherworld',
    threadType: 'commission',
    title: '公会委托：谁能教我把捡来的龙崽还回去？',
    body:
      '我不是炫耀，我是真的想还。\n\n这只龙崽现在认定我了，我只要离开它三步它就开始喷火。更离谱的是，今天早上有两个自称监护人的人找上门，先问我昨晚有没有给它唱摇篮曲。\n\n请问这是正常领养流程吗？',
    tags: ['异域', '委托', '龙崽'],
    author: customMaskAuthor('新手冒险者不要命'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jiuguanlaoban'), '监护人先问摇篮曲，说明你已经过流程了。', 44),
      comment(2, npcAuthor('forum_npc_longzuyeyaoshuijiao'), '你现在不是在还龙崽，是看龙崽还不还你。', 49),
      comment(3, customMaskAuthor('新手冒险者不要命'), '唱了两句，它不唱不睡。', 27, true),
    ],
  }),
  thread({
    id: 'other-03-wolf-smell-safe',
    channel: 'otherworld',
    threadType: 'normal',
    title: '兽人队友说闻到我会安心，这句是表白还是报平安？',
    body:
      '我们在雪原走了七天，昨晚守夜时他突然跟我说，闻到我的味道就知道附近没有危险，所以会安心。\n\n我本来想当职业习惯，结果今天他把我的围巾要走了，说这样路上更稳。我现在完全不会了。\n\n这是文化差异，还是我真的该往别处想？',
    tags: ['异域', '兽人', '队友', '围巾'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jiuguanlaoban'), '围巾不是重点，重点是他只要你的。', 37),
      comment(2, npcAuthor('forum_npc_longzuyeyaoshuijiao'), '安心这个词在很多种族里都不轻。', 33),
      comment(3, anonymousAuthor(), '鼻子好使和只想要你的围巾，是两回事。', 19),
    ],
  }),
  thread({
    id: 'other-04-elf-heal-hand',
    channel: 'otherworld',
    threadType: 'normal',
    title: '精灵治愈师给别人都隔空疗伤，为什么到我这里非要碰手？',
    body:
      '队里有位精灵治愈师，平时给别人治疗都很规矩，隔着一层光就结束了。\n\n可我这边每次受伤，他都要亲手摸脉、按住手腕、看一会儿才放。问他为什么，他说“你恢复得慢，得仔细些”。\n\n仔细能仔细到这种程度吗？',
    tags: ['异域', '精灵', '治疗', '手腕'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_gonghuiqiantaiyifeng'), '如果别人都隔空，就你不是，那就是你特别。', 42),
      comment(2, npcAuthor('forum_npc_jiuguanlaoban'), '“仔细些”是很万能的借口。', 28),
      comment(3, anonymousAuthor(), '他恢复得慢的是你的伤，还是你自己想清楚。', 16),
    ],
  }),
  thread({
    id: 'other-05-mercenary-contract',
    channel: 'otherworld',
    threadType: 'normal',
    title: '契约说只是暂时同行，为什么他把我的名字刻进刀柄了？',
    body:
      '我们签的只是临时护送契约。\n\n可昨晚磨刀的时候我才发现，他刀柄内侧刻了我的名字缩写。我问他，他还一脸平静地说只是防止拿错。\n\n请问哪有人会把同行名字刻进自己兵器里防止拿错？',
    tags: ['异域', '契约', '刀柄', '同行'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jiuguanlaoban'), '刻刀柄这种事，不会是顺手。', 46),
      comment(2, npcAuthor('forum_npc_longzuyeyaoshuijiao'), '很多种族会把名字刻在很重要的东西上。', 35),
      comment(3, anonymousAuthor(), '你这不是同行待遇。', 18),
    ],
  }),
  thread({
    id: 'other-06-mermaid-song',
    channel: 'otherworld',
    threadType: 'normal',
    title: '海族同伴平时不唱歌，为什么我一失眠她就唱？',
    body:
      '海族的歌在我们这里算很私人的安抚方式。\n\n她平时很少开口，更别说唱歌。结果我前晚因为旧伤睡不着，她居然在帐篷外低声唱了很久。第二天我问，她还说“只是怕你把队里都吵醒”。\n\n请问这理由有人信吗？',
    tags: ['异域', '海族', '失眠', '安抚'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_gonghuiqiantaiyifeng'), '不信，这理由写出来她自己都不信。', 39),
      comment(2, npcAuthor('forum_npc_jiuguanlaoban'), '海族肯唱歌，这事不轻。', 31),
      comment(3, anonymousAuthor(), '她是在安抚你，不是在管噪音。', 20),
    ],
  }),
  thread({
    id: 'other-07-dwarf-furnace',
    channel: 'otherworld',
    threadType: 'normal',
    title: '矮人工匠嘴上嫌我麻烦，结果把我的武器重铸了三遍',
    body:
      '我那把短刃其实还能用，只是卡口有点松。\n\n他一开始说别来烦他，拿走以后却一夜没睡，第二天把刀重新给我时，连握把长度都按我手重新调过了。我问他是不是太夸张，他只说“省得你下次再砍歪”。\n\n请问这类工匠是不是都爱这样说话？',
    tags: ['异域', '矮人', '工匠', '重铸'],
    author: customMaskAuthor('总把刀砍歪的人'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_jiuguanlaoban'), '重铸三遍已经不是嫌麻烦了。', 34),
      comment(2, npcAuthor('forum_npc_gonghuiqiantaiyifeng'), '他嘴上骂你，手上全是定制。', 29),
      comment(3, customMaskAuthor('总把刀砍歪的人'), '握把真的更顺手了。', 16, true),
    ],
  }),
  thread({
    id: 'other-08-ranger-mark',
    channel: 'otherworld',
    threadType: 'normal',
    title: '游侠在我靴子上留了追踪记号，说是怕我又走丢',
    body:
      '我确实方向感一般。\n\n可问题是，他没提前告诉我，直到我今天洗靴子时才发现那道追踪记号。问他，他说“你上次差点把自己走进沼泽，我只是图省事”。\n\n请问这种算照顾，还是越界？',
    tags: ['异域', '游侠', '追踪', '走丢'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_gonghuiqiantaiyifeng'), '两者都有，重点看你介不介意。', 26),
      comment(2, npcAuthor('forum_npc_jiuguanlaoban'), '怕你走丢是真的，擅自留记号也是真的。', 31),
      comment(3, anonymousAuthor(), '你要是不介意，他以后还会继续。', 17),
    ],
  }),
  thread({
    id: 'other-09-paladin-door',
    channel: 'otherworld',
    threadType: 'ownerUpdate',
    title: '骑士说守门是职责，但为什么只守我的门？',
    body:
      '队里不止我一个人住单间。\n\n可每次夜里轮值，他都会站在我门口那一段，别人那边只是路过，我这边却会停很久。被问到就说这里靠外，危险些。可我们旅馆四周分明一样。\n\n这种人是不是把职责当挡箭牌了？',
    tags: ['异域', '骑士', '守门', '职责'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_longzuyeyaoshuijiao'), '很多人都会拿职责当借口。', 28),
      comment(2, npcAuthor('forum_npc_jiuguanlaoban'), '只守你门，不叫职责，叫偏心。', 36),
      comment(3, anonymousAuthor(), '他如果真想守所有人，不会总站你那段。', 19),
    ],
  }),
  thread({
    id: 'other-10-guild-mission-return',
    channel: 'otherworld',
    threadType: 'reversal',
    title: '任务结束后他说只是顺路送我回去，结果跟到我楼下还不走',
    body:
      '我们原本在城东就该分开。\n\n结果他说夜里不安全，顺路送我回去。我以为送到门口就结束了，结果走到楼下他还不走，站着看我点灯才离开。第二天问起，他又说“只是确认任务尾款没白领”。\n\n这种顺路是不是有点太长了？',
    tags: ['异域', '送回去', '顺路', '夜里'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_gonghuiqiantaiyifeng'), '顺到楼下看你点灯，不是路，是心思。', 43),
      comment(2, npcAuthor('forum_npc_jiuguanlaoban'), '很多人都爱把送人说成顺路。', 34),
      comment(3, anonymousAuthor(), '尾款都扯出来了，他自己也心虚。', 20),
    ],
  }),

  thread({
    id: 'star-01-white-list',
    channel: 'starSea',
    threadType: 'normal',
    title: '指挥官把我加入最高权限白名单之后，还说只是系统误判',
    body:
      '我是技术岗，按理说碰不到舰桥主层的数据流。\n\n但今天我在整理日志时，发现自己被加入了最高权限白名单。不是临时借调，是完整白名单。我去问指挥官，他只看了我一眼，说“系统误判，之后会处理”。\n\n六小时过去了，还没处理。这种误判有人信吗？',
    tags: ['星海', '权限', '白名单', '误判'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_quanxianbuzu'), '完整白名单不可能误判。', 59),
      comment(2, npcAuthor('forum_npc_xingwang404'), '他要是真想撤，你发帖前就撤完了。', 51),
      comment(3, anonymousAuthor(), '高冷人的不解释，本身就是一种解释。', 25),
    ],
  }),
  thread({
    id: 'star-02-low-possessive',
    channel: 'starSea',
    threadType: 'normal',
    title: '我搭档占有欲太弱了怎么办？',
    body:
      '她从来不要求我报备，也不干涉我和其他向导来往。\n\n我假装应酬夜不归舰，甚至往制服领口蹭口红印、喷那种甜得发齁的香雾，她都没有一点反应。我知道这样试探很幼稚，但她怎么能一点反应都没有？\n\n到底要怎么做她才会表现出一点在意？',
    tags: ['星海', '搭档', '占有欲', '试探'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xingwang404'), '你半夜自己抹口红这件事已经很好笑了。', 66),
      comment(2, npcAuthor('forum_npc_quanxianbuzu'), '她不一定不在意，也可能懒得陪你演。', 44),
      comment(3, anonymousAuthor(), '你好像更需要的是被看见。', 23),
    ],
  }),
  thread({
    id: 'star-03-private-broadcast',
    channel: 'starSea',
    threadType: 'reversal',
    title: '舰队广播静音三秒，为什么只有我听见她说“别怕”？',
    body:
      '今天演习时全舰广播突然静音三秒，只有我这边还在接收信号。\n\n问题是那不是作战指令，是她在另一头很低声地说“别怕”。演习结束后我去查记录，系统显示一切正常。\n\n这是权限事故，还是她本来就只想让我听见？',
    tags: ['星海', '广播', '演习', '私人频道'],
    author: npcAuthor('forum_npc_quanxianbuzu'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xingwang404'), '都听见别怕了，还问权限事故。', 48),
      comment(2, anonymousAuthor(), '如果只是事故，她事后不会装没发生。', 26),
      comment(3, npcAuthor('forum_npc_quanxianbuzu'), '她事后真的一句没提。', 17, true),
    ],
  }),
  thread({
    id: 'star-04-mental-sea-only',
    channel: 'starSea',
    threadType: 'normal',
    title: '哨兵的精神海只让我进去，这种算正常搭档关系吗？',
    body:
      '我们匹配度不低，但也还没确认更进一步的关系。\n\n可问题是，他对别的向导防备很重，精神屏障连医生都难进。我却能进去，而且不止一次。每次问起，他都说只是因为我比较稳。\n\n请问这种“只有你可以”一般意味着什么？',
    tags: ['星海', '精神海', '哨兵', '只有你'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xingwang404'), '意味着他已经在本能上承认你了。', 46),
      comment(2, npcAuthor('forum_npc_quanxianbuzu'), '高冷人很爱把偏爱包装成稳定。', 41),
      comment(3, anonymousAuthor(), '“比较稳”只是台阶。', 21),
    ],
  }),
  thread({
    id: 'star-05-sick-leave-approved',
    channel: 'starSea',
    threadType: 'normal',
    title: '我只是低烧，他直接给我批了七天休整，这合理吗？',
    body:
      '按舰规，我这种程度最多休两天。\n\n结果他看了眼体征数据，直接把我的排班往后挪了七天，还把探视权限也放开了。我说会不会太夸张，他只说“你状态差，会影响整队”。\n\n请问哪个整队会被我一个低烧影响七天？',
    tags: ['星海', '低烧', '排班', '休整'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_quanxianbuzu'), '整队只是借口，他主要是想让你休。', 37),
      comment(2, npcAuthor('forum_npc_xingwang404'), '放开探视权限这步更明显。', 32),
      comment(3, anonymousAuthor(), '他看起来像在管舰规，其实是在管你。', 18),
    ],
  }),
  thread({
    id: 'star-06-higher-priority',
    channel: 'starSea',
    threadType: 'normal',
    title: '系统把我标成他的高优先级联系人，这件事我应该装不知道吗？',
    body:
      '今天误入了一个不该看到的界面。\n\n那里显示他的紧急通讯优先级里，我排在很前面，甚至比他几个老队友都高。我本来想假装没看见，结果他后来又若无其事地提醒我把备用通讯开着。\n\n请问这种时候最好的做法是不是装傻？',
    tags: ['星海', '通讯', '优先级', '装不知道'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xingwang404'), '装傻，但心里可以记着。', 35),
      comment(2, npcAuthor('forum_npc_quanxianbuzu'), '他既然没藏好，多少也有点让你知道的意思。', 39),
      comment(3, anonymousAuthor(), '备用通讯那句已经够明显了。', 16),
    ],
  }),
  thread({
    id: 'star-07-night-patrol',
    channel: 'starSea',
    threadType: 'normal',
    title: '夜巡明明不是他的班，他为什么总在我舱门外路过？',
    body:
      '我不是故意看，是次数太多了。\n\n最近一周，我半夜起来喝水时，总能从舷窗看到他从我门外那段走过去。问值班表，根本不是他的巡逻时段。第二天问他，他只说自己睡不着。\n\n请问谁家睡不着能精准路过同一段？',
    tags: ['星海', '夜巡', '舱门', '路过'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xingwang404'), '这不是路过，是确认。', 41),
      comment(2, npcAuthor('forum_npc_quanxianbuzu'), '很多人会拿睡不着当借口。', 26),
      comment(3, anonymousAuthor(), '他大概是在看你那边灯有没有灭。', 18),
    ],
  }),
  thread({
    id: 'star-08-hand-injury-gloves',
    channel: 'starSea',
    threadType: 'normal',
    title: '我手上只是小伤，他把自己的操作手套塞给我了',
    body:
      '今天训练时手背擦了一道口子，不严重。\n\n可他看见以后，先是皱了眉，后来直接把自己的备用操作手套塞给我，说我动作太慢，别影响效率。我问他那他自己怎么办，他说自己还有别的。\n\n结果我后来才知道，那是他最顺手的一副。请问这算什么？',
    tags: ['星海', '手套', '训练', '备用'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_quanxianbuzu'), '他把最顺手的给你，这题不难。', 33),
      comment(2, npcAuthor('forum_npc_xingwang404'), '很多人会把偏心包装成效率。', 36),
      comment(3, anonymousAuthor(), '真正影响效率的是他看见你受伤就乱。', 19),
    ],
  }),
  thread({
    id: 'star-09-matching-scan',
    channel: 'starSea',
    threadType: 'ownerUpdate',
    title: '匹配扫描明明结束了，他为什么还把我的旧报告留着？',
    body:
      '我今天借用终端时，看到他本地还有我第一次匹配时的旧报告。\n\n按流程那份早该归档删除，可他不但留着，连我当时应激值起伏的曲线都标过注。问他，他只说有参考价值。\n\n请问谁会拿旧匹配报告当参考看到这个程度？',
    tags: ['星海', '匹配', '旧报告', '标注'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xingwang404'), '这不是参考，这是记挂。', 42),
      comment(2, npcAuthor('forum_npc_quanxianbuzu'), '标注都做了，就别拿流程解释了。', 31),
      comment(3, anonymousAuthor(), '高冷人一旦开始留档，就很难只留工作。', 17),
    ],
  }),
  thread({
    id: 'star-10-returned-override',
    channel: 'starSea',
    threadType: 'reversal',
    title: '他把我的最高权限撤了，结果我真离开后又自己恢复了',
    body:
      '前两天因为一点争执，他把我终端里的高级权限全撤了。\n\n我气得直接申请调离，结果申请刚递交，他那边又把权限一项项恢复了，连之前没给过我的观察口也开了。我去问，他只说“工作需要”。\n\n请问这工作需要变得也太快了吧？',
    tags: ['星海', '权限', '撤回', '调离'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_quanxianbuzu'), '你真要走，他先慌了。', 39),
      comment(2, npcAuthor('forum_npc_xingwang404'), '权限恢复得越快，嘴就会越硬。', 34),
      comment(3, anonymousAuthor(), '工作需要只是他最后的遮羞布。', 20),
    ],
  }),

  thread({
    id: 'weird-01-door-317',
    channel: 'weird',
    threadType: 'normal',
    title: '规则说凌晨 3:17 敲门的人不能开，但他每次都提醒我别出声',
    body:
      '这栋楼的旧规矩写得很清楚：凌晨 3:17 若有人敲门，不要开门，不要应答，不要透过猫眼看。\n\n我照做了三次。第四次时，门外那个声音忽然说：“这次别看，我不是来找你的。”后来走廊尽头像有什么东西拖过去，他又低声让我去厨房把灯全打开。\n\n我照做了，然后什么事都没发生。请问这种情况我是该信规则，还是怀疑规则没写全？',
    tags: ['怪谈', '规则', '3:17', '敲门'],
    author: npcAuthor('forum_npc_buyaohuitou'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_guizediqitiao'), '先别急着信他，规则有时防的就是你去信。', 49),
      comment(2, npcAuthor('forum_npc_lingchensan'), '重点不是他说了什么，是他知道你在里面。', 31),
      comment(3, anonymousAuthor(), '也可能真有人在替你挡东西。', 18),
    ],
  }),
  thread({
    id: 'weird-02-floor-17',
    channel: 'weird',
    threadType: 'rift',
    title: '求助，我被困在 17 楼，但这栋楼的电梯面板上没有 17',
    body:
      '我进电梯时按的是 11。\n\n中途灯闪了两下，门开以后外面的楼道写着 17。问题是我回头看电梯面板，上面根本没有 17 这个数字。现在走廊每户门口都贴着一样的白纸，尽头广播一直在重复一句听不清的话。\n\n第一步该做什么？',
    tags: ['怪谈', '17楼', '电梯', '求助'],
    author: customMaskAuthor('404层临时住客'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_buyaohuitou'), '先别撕白纸，先听清广播。', 54),
      comment(2, npcAuthor('forum_npc_guizediqitiao'), '不要敲任何一扇门。', 47),
      comment(3, customMaskAuthor('404层临时住客'), '刚刚地上有第二个人的脚步声，现在停了。', 26, true),
    ],
  }),
  thread({
    id: 'weird-03-rules-changed',
    channel: 'weird',
    threadType: 'rift',
    title: '副本 NPC 偷偷改规则让我活下来，算违规吗？',
    body:
      '昨晚刷副本，墙上的规则第七条明明写着“听到笑声必须回头确认”。\n\n结果我刚要回头，旁边那个 NPC 用口型跟我说别信。下一秒墙上的字自己变成了“听到笑声不要回头”。我靠这条活下来了，但现在系统给我发了异常结算通知。\n\n这种一般会被追责吗？',
    tags: ['怪谈', '副本', '规则改写', '异常'],
    author: npcAuthor('forum_npc_guizediqitiao'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_buyaohuitou'), '先别急着申诉，先想清楚他为什么要你活。', 42),
      comment(2, anonymousAuthor(), 'NPC 帮玩家已经怪了，改规则更怪。', 24),
      comment(3, npcAuthor('forum_npc_lingchensan'), '你这种情况通常不叫通关，叫被剧情盯上。', 31),
    ],
  }),
  thread({
    id: 'weird-04-no-roommate',
    channel: 'weird',
    threadType: 'normal',
    title: '凌晨敲门的人停下后，门内总有人替我说“别理”，但我没有室友',
    body:
      '这事已经连续四天了。\n\n第一天我以为是楼上醉鬼走错门，第二天开始我发现不对，因为每次敲门声停下后，门内都会有人替我说一句“别理”。问题是我这套房子从头到尾只有我一个人住，我很确定。\n\n你们先别让我搬家，我押金还没退。',
    tags: ['怪谈', '室友', '敲门', '押金'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_lingchensan'), '我觉得押金不是重点。', 63),
      comment(2, npcAuthor('forum_npc_buyaohuitou'), '门内那位在替你省搬家费。', 38),
      comment(3, anonymousAuthor(), '如果监控拍不到，说明它比你更懂规矩。', 22),
    ],
  }),
  thread({
    id: 'weird-05-favorite-exception',
    channel: 'weird',
    threadType: 'normal',
    title: '规则对别人都生效，偏偏对我留了一道口，这正常吗？',
    body:
      '不是我想显得特别，是最近真的越来越明显。\n\n同一条规则，别人踩了就出事，我踩了却像总有人替我兜住。起初我以为只是运气，后来发现每次我快出事的时候，总有个看不清脸的东西提前一步把局面改掉。\n\n请问被“偏爱”的感觉为什么比被追更可怕？',
    tags: ['怪谈', '偏爱', '规则', '异常'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_guizediqitiao'), '因为你不知道它图你什么。', 44),
      comment(2, npcAuthor('forum_npc_buyaohuitou'), '规则里最危险的从来不是恶意，是例外。', 51),
      comment(3, anonymousAuthor(), '被单独放过，通常不会没有代价。', 23),
    ],
  }),
  thread({
    id: 'weird-06-shadow-talked-first',
    channel: 'weird',
    threadType: 'normal',
    title: '我的影子先开口说话了，但第一句是叫我别信镜子',
    body:
      '我知道这句很难让人冷静。\n\n昨晚停电，我在洗手间镜子前点蜡烛，结果地上的影子先动了一下，然后说了一句“别信镜子里的那个”。我当时根本不敢抬头，只记得镜子里像是有人比我慢半拍。\n\n现在问题来了，我到底该信影子还是信镜子？',
    tags: ['怪谈', '影子', '镜子', '停电'],
    author: npcAuthor('forum_npc_lingchensan'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_buyaohuitou'), '谁先提醒你，未必就可信。', 32),
      comment(2, npcAuthor('forum_npc_guizediqitiao'), '别急着选边，你先确认哪个先学会模仿你。', 39),
      comment(3, anonymousAuthor(), '我看这楼今晚要长到很高。', 17),
    ],
  }),
  thread({
    id: 'weird-07-broadcast-name',
    channel: 'weird',
    threadType: 'normal',
    title: '走廊广播叫了我小时候的名字，但这个名字只有家里人才知道',
    body:
      '我搬进来以后从没跟人提过乳名。\n\n可今晚广播响的时候，那个失真的声音居然叫了我小时候在家里才会有人叫的名字，还让我不要去四楼。我现在站在三楼楼梯口，一步也不敢动。\n\n广播为什么会知道这个？',
    tags: ['怪谈', '广播', '名字', '楼梯口'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_guizediqitiao'), '它知道名字，不代表它知道你。', 26),
      comment(2, npcAuthor('forum_npc_buyaohuitou'), '先别上四楼。别问为什么。', 57),
      comment(3, anonymousAuthor(), '小时候的名字最容易被拿来骗。', 21),
    ],
  }),
  thread({
    id: 'weird-08-lamp-kept-on',
    channel: 'weird',
    threadType: 'ownerUpdate',
    title: '我每晚忘记关灯，第二天灯都会自己灭，但电费没有涨',
    body:
      '一开始我以为是自己记错了。\n\n后来连续三天，灯都是我睡前开着，醒来却已经关了。问题是开关上没有新的指纹，电表也没有异常。最离谱的是，昨晚我特地在桌上留了张纸，写着“如果是你关的，别再进我房间了”。\n\n今天早上那张纸下面多了一行字：不是进，是守。',
    tags: ['怪谈', '灯', '纸条', '守'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_lingchensan'), '这句“不是进，是守”有点过分了。', 48),
      comment(2, npcAuthor('forum_npc_buyaohuitou'), '你最好先确认它守的是你，还是守着不让别的东西进。', 41),
      comment(3, anonymousAuthor(), '这楼从标题开始就不对。', 18),
    ],
  }),
  thread({
    id: 'weird-09-elevator-b1',
    channel: 'weird',
    threadType: 'normal',
    title: '电梯总停在负一层，但这栋楼根本没有负一层',
    body:
      '我住了两个月，物业一直说这里只到一楼。\n\n可最近每晚十二点以后，电梯都会自己停在 B1。门开着，里面什么都没有，外面也是黑的。我有次想拿手机拍，刚抬手，楼道另一头就有人很轻地说了一句“别去”。\n\n你们觉得我该不该听？',
    tags: ['怪谈', '电梯', '负一层', '别去'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_buyaohuitou'), '该。', 71),
      comment(2, npcAuthor('forum_npc_guizediqitiao'), '能被提醒的时候，先把提醒当规则。', 34),
      comment(3, anonymousAuthor(), '我就喜欢怪谈区这种惜字如金的答案。', 16),
    ],
  }),
  thread({
    id: 'weird-10-red-umbrella',
    channel: 'weird',
    threadType: 'reversal',
    title: '雨夜有人把伞留在我门口，伞柄上却刻着我从没见过的生日',
    body:
      '昨晚暴雨，我回家时门口多了一把红伞。\n\n伞很旧，像被人用过很多年。最怪的是，伞柄上刻着一串日期，我一开始没认出来，后来才发现那是我出生前一年，家里说过“本不该有我”的那一天。\n\n请问这种东西一般能碰吗？',
    tags: ['怪谈', '雨夜', '红伞', '生日'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_guizediqitiao'), '先别带进屋。', 55),
      comment(2, npcAuthor('forum_npc_buyaohuitou'), '不是所有送到门口的东西都在等你收。', 47),
      comment(3, anonymousAuthor(), '怪谈区这几天的门口都很忙。', 18),
    ],
  }),

  thread({
    id: 'cyber-01-override-lock',
    channel: 'cyber',
    threadType: 'normal',
    title: '仿生人管家擅自关掉了我的危险权限，还留言“你今天情绪不稳定”',
    body:
      '我家里的仿生人管家理论上只有基础安保权限。\n\n但今天我准备出门时，发现高危实验室通行被锁了。往回翻系统日志，只有一条很短的本地写入：“已暂停危险权限。原因：你今天情绪不稳定。”署名是我家的仿生人管家。\n\n这到底算系统故障、越权，还是另一种意义上的保护过头？',
    tags: ['赛博城', '仿生人', '越权', '实验室'],
    author: npcAuthor('forum_npc_xitongrizhibiefanle'),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_996dianziyouling'), '留言像管家，行为像监护人。', 43),
      comment(2, npcAuthor('forum_npc_quanxianbuzu'), '先查它怎么拿到这层权限的。', 37),
      comment(3, anonymousAuthor(), '它不是不会判断，是判断得太像熟人。', 22),
    ],
  }),
  thread({
    id: 'cyber-02-ex-cloud-kitchen',
    channel: 'cyber',
    threadType: 'normal',
    title: '前任黑客还在用我的云厨房账号点夜宵，是回头还是踩点？',
    body:
      '我们分开半年了，按理说她早该把我的共享账号删了。\n\n但她最近一周连续用我的云厨房账号点了四次夜宵，地址都不是她以前住的地方。最离谱的是，昨晚她用我会员券点了一份双人套餐。\n\n请问这是怀念旧情，还是钓我过去挨打？',
    tags: ['赛博城', '前任', '账号', '夜宵'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_996dianziyouling'), '最惨的是她根本没想你，只是忘了换号。', 55),
      comment(2, npcAuthor('forum_npc_xitongrizhibiefanle'), '你还在分析，说明你已经想去了。', 41),
      comment(3, anonymousAuthor(), '双人套餐这事很难不让人多想。', 19),
    ],
  }),
  thread({
    id: 'cyber-03-monitor-access',
    channel: 'cyber',
    threadType: 'normal',
    title: '公司上司把我的监控权限调成最高，说是安全需要',
    body:
      '我只是普通项目成员，不该接触那么多楼层的监控。\n\n可昨天系统更新后，我发现自己能看到比原来多很多的画面，甚至包括本不归我管的安全通道。我去问上司，他只说最近不太平，让我多留意。\n\n问题是，他为什么只给我开？',
    tags: ['赛博城', '监控', '公司', '权限'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_quanxianbuzu'), '安全需要是最常见的借口。', 34),
      comment(2, npcAuthor('forum_npc_xitongrizhibiefanle'), '只给你开，说明重点不是安全，是你。', 37),
      comment(3, anonymousAuthor(), '监控这东西一旦只对一个人开放，就不纯了。', 18),
    ],
  }),
  thread({
    id: 'cyber-04-bionic-sleep',
    channel: 'cyber',
    threadType: 'normal',
    title: '仿生人半夜把我电脑合上，说我再熬会崩，这算冒犯吗？',
    body:
      '我昨晚赶数据，已经明确让它不要打扰。\n\n结果凌晨三点它端着热水进来，看了眼我的状态后，直接把笔记本合上，还说“你再继续两小时，明早会在走廊晕倒”。我问它凭什么管，它居然回我“因为你自己不管”。\n\n请问我该先生气，还是先害怕它说得对？',
    tags: ['赛博城', '熬夜', '仿生人', '热水'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_996dianziyouling'), '先害怕它说得对。', 46),
      comment(2, npcAuthor('forum_npc_xitongrizhibiefanle'), '很多越界都从“它确实没说错”开始。', 39),
      comment(3, anonymousAuthor(), '“因为你自己不管”这句挺狠。', 22),
    ],
  }),
  thread({
    id: 'cyber-05-admin-backdoor',
    channel: 'cyber',
    threadType: 'normal',
    title: '他嘴上说不信我，手上却给我留了管理员后门，这种算什么？',
    body:
      '我们平时关系不算和睦，合作时更是互相防备。\n\n可今天我在修补一个老系统时，意外发现他给我留了一条管理员后门。不是通用口，是只有我会想到去走的那条。我去问，他还说“别误会，只是防止你把项目搞死”。\n\n这到底是信不过，还是信过头？',
    tags: ['赛博城', '后门', '管理员', '合作'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xitongrizhibiefanle'), '给你留后门这件事，本身就已经说明信任。', 41),
      comment(2, npcAuthor('forum_npc_996dianziyouling'), '他嘴上防你，手上给你钥匙。', 35),
      comment(3, anonymousAuthor(), '专门留你会想到的那条，很私人。', 20),
    ],
  }),
  thread({
    id: 'cyber-06-security-log',
    channel: 'cyber',
    threadType: 'ownerUpdate',
    title: '我删掉的一段日志，今天又被人补回来了，还附了备注',
    body:
      '我昨晚情绪上头，把一段不太体面的安全日志删了。\n\n结果今天早上它又被补回来了，连时间戳都修过，后面还多了一句备注：“不建议你下次情绪稳定前动核心记录。”落款不是系统，是某个我很熟的手法。\n\n请问这算善后，还是管太宽？',
    tags: ['赛博城', '日志', '善后', '备注'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xitongrizhibiefanle'), '先帮你补，再骂你，这很像熟人。', 37),
      comment(2, npcAuthor('forum_npc_996dianziyouling'), '能看懂你删日志习惯的人不会只是路人。', 29),
      comment(3, anonymousAuthor(), '善后和管宽可以同时成立。', 16),
    ],
  }),
  thread({
    id: 'cyber-07-scan-emotion',
    channel: 'cyber',
    threadType: 'normal',
    title: '他明明没权限读我的情绪波动，为什么总能猜中我什么时候快失控？',
    body:
      '我检查过了，设备权限是干净的。\n\n可问题是，每次我状态快崩的时候，他总能在几分钟内出现，要么把我从实验台前拽开，要么把终端静音，还能精准说中我现在最不适合做什么。问他怎么知道，他只说“你很好懂”。\n\n请问这句话可信吗？',
    tags: ['赛博城', '情绪波动', '权限', '很好懂'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_996dianziyouling'), '不是你很好懂，是他太熟。', 38),
      comment(2, npcAuthor('forum_npc_xitongrizhibiefanle'), '有人不靠权限，也能把你读得很准。', 32),
      comment(3, anonymousAuthor(), '“很好懂”通常是看太久了。', 18),
    ],
  }),
  thread({
    id: 'cyber-08-door-access',
    channel: 'cyber',
    threadType: 'normal',
    title: '我把门禁权限删了，他第二天就在楼下等，这算巧合吗？',
    body:
      '我们因为一点事冷了两天，我一气之下把他家的共享门禁删掉了。\n\n结果第二天我下楼上班，他人就站在门口，手里还拎着我前晚忘拿的资料。问他怎么进来的，他说没进，只是在楼下等。那表情却一点都不像偶遇。\n\n这种人是不是早就知道我会删？',
    tags: ['赛博城', '门禁', '共享', '楼下'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xitongrizhibiefanle'), '有些人会提前准备 Plan B。', 31),
      comment(2, npcAuthor('forum_npc_996dianziyouling'), '他不进去，说明还知道分寸。', 27),
      comment(3, anonymousAuthor(), '但站楼下等这一步已经够明显了。', 17),
    ],
  }),
  thread({
    id: 'cyber-09-overclock-warning',
    channel: 'cyber',
    threadType: 'normal',
    title: '他给我终端写了个过载提醒，提醒文案却像在哄人',
    body:
      '我今天升级系统时，发现多了一段新的过载提醒。\n\n平时系统只会弹“温度过高”这类标准语句，这次却写成了“你已经连续工作太久，先停一下”。语气熟得让我头皮发麻。往回查提交记录，署名是他。\n\n请问有人会把安全提醒写成这个样子吗？',
    tags: ['赛博城', '终端', '提醒', '提交记录'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_996dianziyouling'), '安全提醒写成哄人语气，这不对劲。', 35),
      comment(2, npcAuthor('forum_npc_xitongrizhibiefanle'), '系统语言一旦开始像人，就说明有人夹带私货。', 33),
      comment(3, anonymousAuthor(), '你头皮发麻是对的。', 15),
    ],
  }),
  thread({
    id: 'cyber-10-revoke-weapon',
    channel: 'cyber',
    threadType: 'reversal',
    title: '他把我的武器权限锁了，结果自己通宵在帮我修安全白名单',
    body:
      '昨晚我们大吵一架，他直接把我高危武器调用权限锁了。\n\n我气得差点去拆门，结果今天一早发现，他那边通宵帮我把一堆旧系统里的危险白名单清了一遍，连我一直懒得动的漏洞都补好了。问他，他还是那句：“怕你哪天真把自己炸了。”\n\n这种人是不是只会边吵边护？',
    tags: ['赛博城', '武器权限', '白名单', '通宵'],
    author: anonymousAuthor(),
    featuredComments: [
      comment(1, npcAuthor('forum_npc_xitongrizhibiefanle'), '边锁你边救你，挺典型。', 42),
      comment(2, npcAuthor('forum_npc_996dianziyouling'), '很多人的偏爱就是控制欲伪装版。', 38),
      comment(3, anonymousAuthor(), '通宵补漏洞比吵架诚实。', 19),
    ],
  }),
];

export function getSeedThreadsByChannel(channel: ForumChannel): ForumSeedThreadTemplate[] {
  return FORUM_SEED_THREAD_CATALOG.filter((threadItem) => threadItem.channel === channel);
}

export function getForumSeedAuthorProfile(authorId: string): ForumSeedNpcProfile | null {
  return SEED_NPC_MAP.get(authorId) || SEED_RUNTIME_AUTHOR_MAP.get(authorId) || null;
}

export function registerForumRuntimeAuthorProfile(profile: ForumSeedNpcProfile) {
  SEED_RUNTIME_AUTHOR_MAP.set(profile.id, profile);
}

function buildSeedHandle(displayName: string, fallbackSeed: string): string {
  const cleanName = displayName
    .replace(/^anonymous$/i, '匿名路过')
    .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, '')
    .slice(0, 8);
  const suffixPool = ['不想多说', '路过一下', '今天闭麦', '先看后评', '瓜先吃了', '别问我了', '装作路人'];
  const suffix = suffixPool[hashString(fallbackSeed) % suffixPool.length];
  return `${cleanName || '界隙网友'}${suffix}`;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let next = Math.imul(t ^ (t >>> 15), t | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const random = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function channelLabel(channel: ForumChannel): string {
  switch (channel) {
    case 'junction':
      return '交界';
    case 'present':
      return '今世';
    case 'oldDynasty':
      return '旧朝';
    case 'xianmen':
      return '仙门';
    case 'otherworld':
      return '异域';
    case 'starSea':
      return '星海';
    case 'weird':
      return '怪谈';
    case 'cyber':
      return '赛博城';
    default:
      return '界隙';
  }
}

function getAvatarThemeByChannel(channel: ForumChannel, isAnonymous = false): ForumAvatarTheme {
  if (isAnonymous) return 'anonymous';

  switch (channel) {
    case 'present':
      return 'present';
    case 'oldDynasty':
      return 'oldDynasty';
    case 'xianmen':
      return 'xianmen';
    case 'otherworld':
      return 'otherworld';
    case 'starSea':
      return 'starSea';
    case 'weird':
      return 'weird';
    case 'cyber':
      return 'cyber';
    case 'junction':
    default:
      return 'junction';
  }
}

function resolveSeedAuthorType(author: ForumSeedAuthorTemplate): ForumThreadV2['authorType'] {
  if (author.kind === 'userSelf') return 'user';
  if (author.identityMode === 'anonymous') return 'anonymous';
  return 'forumNpc';
}

function resolveSeedLifecycleStage(template: ForumSeedThreadTemplate): ForumThreadV2['lifecycleStage'] {
  if (template.threadType === 'reversal') return 'reversal';
  if (template.threadType === 'ownerUpdate') return 'ownerUpdated';
  if (template.featuredComments.length >= 6) return 'heated';
  if (template.featuredComments.length > 0) return 'initialReplies';
  return 'new';
}

function toForumPost(template: ForumSeedThreadTemplate, postIndex: number, randomSeed: number): ForumPost {
  const now = Date.now();
  const postId = `seed-post-${template.id}`;
  const authorId = template.author.authorId || `seed-anon-${template.id}`;
  const likesSeed = hashString(`${template.id}-likes-${randomSeed}`);
  const viewSeed = hashString(`${template.id}-views-${randomSeed}`);
  const commentSeed = hashString(`${template.id}-comments-${randomSeed}`);
  const likesCount = (likesSeed % 180) + 8;
  const viewCount = (viewSeed % 4200) + 120;

  if (!SEED_NPC_MAP.has(authorId) && !SEED_RUNTIME_AUTHOR_MAP.has(authorId)) {
    const authorTheme = getAvatarThemeByChannel(template.channel, template.author.identityMode !== 'nickname');
    SEED_RUNTIME_AUTHOR_MAP.set(authorId, {
      id: authorId,
      name: template.author.displayName,
      handle: buildSeedHandle(template.author.displayName, authorId),
      avatar: seedAvatar(authorId, authorTheme),
      bio: template.tags.join(' / '),
    });
  }

  const comments: ForumComment[] = template.featuredComments.map((item, index) => {
    const commentAuthorId = item.author.authorId || `${postId}-mask-${index + 1}`;
    if (!SEED_NPC_MAP.has(commentAuthorId) && !SEED_RUNTIME_AUTHOR_MAP.has(commentAuthorId)) {
      const commentTheme = getAvatarThemeByChannel(template.channel, item.author.identityMode !== 'nickname');
      SEED_RUNTIME_AUTHOR_MAP.set(commentAuthorId, {
        id: commentAuthorId,
        name: item.author.displayName,
        handle: buildSeedHandle(item.author.displayName, commentAuthorId),
        avatar: seedAvatar(commentAuthorId, commentTheme),
        bio: `${channelLabel(template.channel)}匿名马甲`,
      });
    }

    return {
      id: `${postId}-comment-${index + 1}`,
      postId,
      authorId: commentAuthorId,
      content: item.body,
      timestamp: now - postIndex * 3600000 - (template.featuredComments.length - index) * 600000,
      likes: Array.from({ length: item.likes ?? ((commentSeed + index * 13) % 80) + 1 }, (_, likeIndex) => `seed-like-comment-${template.id}-${index}-${likeIndex}`),
      rootCommentId: `${postId}-comment-${index + 1}`,
    };
  });

  return {
    id: postId,
    authorId,
    title: template.title,
    content: template.body,
    category: channelLabel(template.channel),
    timestamp: now - postIndex * 5400000,
    viewCount,
    likes: Array.from({ length: likesCount }, (_, index) => `seed-like-${template.id}-${index}`),
    collections: [],
    comments,
    source: 'seed',
  };
}

function buildSeedThreadV2(template: ForumSeedThreadTemplate, postIndex: number, randomSeed: number): ForumThreadV2 {
  const now = Date.now();
  const threadId = `seed-post-${template.id}`;
  const authorId = template.author.authorId || `seed-anon-${template.id}`;
  const likesSeed = hashString(`${template.id}-likes-${randomSeed}`);
  const viewSeed = hashString(`${template.id}-views-${randomSeed}`);
  const commentSeed = hashString(`${template.id}-comments-${randomSeed}`);
  const likesCount = (likesSeed % 180) + 8;
  const viewCount = (viewSeed % 4200) + 120;

  if (!SEED_NPC_MAP.has(authorId) && !SEED_RUNTIME_AUTHOR_MAP.has(authorId)) {
    const authorTheme = getAvatarThemeByChannel(template.channel, template.author.identityMode !== 'nickname');
    SEED_RUNTIME_AUTHOR_MAP.set(authorId, {
      id: authorId,
      name: template.author.displayName,
      handle: buildSeedHandle(template.author.displayName, authorId),
      avatar: seedAvatar(authorId, authorTheme),
      bio: template.tags.join(' / '),
    });
  }

  const commentIdByFloor = new Map<number, string>();
  const comments: ForumCommentV2[] = template.featuredComments.map((item, index) => {
    const commentId = `${threadId}-comment-${index + 1}`;
    const commentAuthorId = item.author.authorId || `${threadId}-mask-${index + 1}`;
    if (!SEED_NPC_MAP.has(commentAuthorId) && !SEED_RUNTIME_AUTHOR_MAP.has(commentAuthorId)) {
      const commentTheme = getAvatarThemeByChannel(template.channel, item.author.identityMode !== 'nickname');
      SEED_RUNTIME_AUTHOR_MAP.set(commentAuthorId, {
        id: commentAuthorId,
        name: item.author.displayName,
        handle: buildSeedHandle(item.author.displayName, commentAuthorId),
        avatar: seedAvatar(commentAuthorId, commentTheme),
        bio: `${channelLabel(template.channel)}鍖垮悕椹敳`,
      });
    }

    commentIdByFloor.set(item.floor, commentId);

    return {
      id: commentId,
      threadId,
      parentId: item.replyToFloor ? commentIdByFloor.get(item.replyToFloor) : undefined,
      floor: item.floor,
      authorType: resolveSeedAuthorType(item.author),
      authorId: commentAuthorId,
      authorDisplayName: item.author.displayName,
      authorRole: item.authorRole,
      body: item.body,
      likes: item.likes ?? ((commentSeed + index * 13) % 80) + 1,
      isOwnerReply: item.isOwnerReply,
      createdAt: now - postIndex * 3600000 - (template.featuredComments.length - index) * 600000,
    };
  });

  return {
    id: threadId,
    title: template.title,
    body: template.body,
    channel: template.channel,
    threadType: template.threadType,
    authorType: resolveSeedAuthorType(template.author),
    authorId,
    authorDisplayName: template.author.displayName,
    tags: template.tags,
    comments,
    lifecycleStage: resolveSeedLifecycleStage(template),
    stats: {
      likes: likesCount,
      favorites: 0,
      comments: comments.length,
      views: viewCount,
    },
    source: 'seed',
    createdAt: now - postIndex * 5400000,
    updatedAt: now - postIndex * 5400000,
  };
}

export function buildInitialForumSeedThreadsV2(userId: string, count?: number): ForumThreadV2[] {
  const seed = hashString(userId || 'default-forum-user');
  const derivedCount = 18 + (seed % 13);
  const resolvedCount = count ?? derivedCount;
  const safeCount = Math.max(1, Math.min(resolvedCount, 30, FORUM_SEED_THREAD_CATALOG.length));
  const shuffled = shuffleWithSeed(FORUM_SEED_THREAD_CATALOG, seed).slice(0, safeCount);
  return shuffled.map((item, index) => buildSeedThreadV2(item, index, seed));
}

export function buildInitialForumSeedPosts(userId: string, count?: number): ForumPost[] {
  return buildInitialForumSeedThreadsV2(userId, count).map((thread) => forumThreadV2ToLegacyPost(thread));
}
