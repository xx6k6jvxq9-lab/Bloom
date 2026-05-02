import type { ForumPost } from '../../types';
import type { ForumChannel, ForumThreadType } from '../../features/forum-domain/types';

type BuildForumShadowFollowupPostInput = {
  sourcePost: ForumPost;
  channel: ForumChannel;
  authorId: string;
  authorName: string;
  categoryLabel: string;
  now?: number;
};

type ForumShadowFollowupDraft = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  category: string;
  threadType: ForumThreadType;
  timestamp: number;
};

const CHANNEL_SHADOW_TEMPLATES: Record<ForumChannel, Array<{ threadType: ForumThreadType; title: string; body: string }>> = {
  junction: [
    { threadType: 'sameTopic', title: '隔壁热楼那个味我也闻到了', body: '不是来复读主楼的，只是想说隔壁那栋楼里有些人装路人装得太辛苦了。你们有没有发现，越急着撇清的人，发言越像在给自己找补。' },
    { threadType: 'gossip', title: '不点名，但交界今晚又有人披皮翻车', body: '我先说不保真，只是觉得有的人嘴上说“别多想”，回帖节奏却像把自己卖得明明白白。隔壁那楼再翻下去，多半还会继续掉东西。 ' },
  ],
  present: [
    { threadType: 'sameTopic', title: '今世区这种“顺手”味也太统一了', body: '刚看完隔壁那栋楼，想说一句，今世区很多所谓顺手，其实都是已经把人默默认进生活里了。越说不是那回事，越像那回事。' },
    { threadType: 'gossip', title: '不点名，但楼下等人这种事真的很难装路过', body: '看到隔壁楼突然想到，今世区很多人最爱拿顺路、拿外卖、拿工位当借口。问题是正常路过不会一而再再而三地路过到同一个人面前。' },
  ],
  oldDynasty: [
    { threadType: 'timeline', title: '有些“照拂”一旦排成时间线就很难体面', body: '刚翻完隔壁那栋楼，突然意识到旧朝区最不能细排的就是“顺手照拂”。一件件看都能圆，连起来就全是私心。' },
    { threadType: 'gossip', title: '旧朝区有些人最会拿体面当挡箭牌', body: '不点名，但最近那种嘴上讲规矩、背后换守夜和改座次的味道实在太明显。有人再装下去，整个区都快看腻了。' },
  ],
  xianmen: [
    { threadType: 'sameTopic', title: '无情道嘴硬楼今天是不是又多了一栋', body: '刚看完隔壁楼，只想说仙门区很多人嘴上修的是无情道，行动上修的根本是护短道。越不肯承认，破戒感越重。' },
    { threadType: 'essay', title: '【片段】有些人说别多想的时候，手已经先伸过来了', body: '夜里风大，规矩说了一半，人已经先把你往身后挡。很多楼看久了就会发现，破戒从来不是那句承认，而是身体先动的那一下。' },
  ],
  otherworld: [
    { threadType: 'gossip', title: '异域区最近的守夜味是不是有点太重了', body: '不点名，但隔壁那楼让我想起很多公会和旅店夜守故事。嘴上说职责，行动上却只守某一个门口，这种事真的很难洗成普通队友情。' },
    { threadType: 'sameTopic', title: '契约和偏心有时候只隔一层纸', body: '刚看完隔壁楼，想补一句，异域区很多人最爱把在意装成契约义务。真要是公事公办，根本不会细到那种程度。 ' },
  ],
  starSea: [
    { threadType: 'timeline', title: '高权限嘴硬的人，动作日志最诚实', body: '隔壁那栋楼让我又想翻白名单记录了。很多人嘴上说程序、说流程，真到关键节点，权限变动和访问轨迹比嘴诚实多了。' },
    { threadType: 'vote', title: '开个盘，这种权限越界算护短还是控制', body: '不是想复读隔壁楼，只是最近这种“嘴上说安全，手上改名单”的事太多了。来押一个，你们觉得这是护短、控制，还是高冷人不承认的在意。' },
  ],
  weird: [
    { threadType: 'sighting', title: '有些楼一热起来，夜里就会多出不该有的人', body: '看完隔壁那楼之后半夜又出去了一趟。只能说怪谈区有些热楼不是纯讨论，它们好像真的会把什么东西招出来。' },
    { threadType: 'gossip', title: '不点名，但今晚那栋楼我建议别在凌晨一点后重看', body: '不是吓人，只是有些帖子白天看和夜里看味道不一样。隔壁那楼要是今晚还往下长，我建议先别一个人看。' },
  ],
  cyber: [
    { threadType: 'sameTopic', title: '赛博城这类“安全提醒”最近是不是有点太私人了', body: '刚看完隔壁楼，突然觉得最近很多日志和提醒文案都不像系统话。表面写的是安全，底下那点在意几乎藏不住。' },
    { threadType: 'gossip', title: '不点名，但有人最近夹带私货夹得有点明显', body: '从提交备注到门禁白名单，再到终端提醒，表面全是流程，实则全是偏心。再这样下去，赛博城迟早把某些人看穿。' },
  ],
  apocalypse: [
    { threadType: 'sameTopic', title: '末日区很多偏心都藏在“先活下来”里', body: '刚看完隔壁楼，突然想说，补给、退烧针、巡夜顺位这些东西一旦只往一个人身上倾斜，就很难再说只是顺手。' },
    { threadType: 'vote', title: '押一个，物资优先级里掺没掺私心真的看不出来吗', body: '隔壁楼那味实在太典型了。来投票吧，你们觉得这种“安全优先 / 资源倾斜”里到底有多少是真公事，多少是护人。' },
  ],
  underworld: [
    { threadType: 'gossip', title: '冥府这种旧账一旦翻起来就装不住了', body: '看完隔壁那楼只想说，阴间很多偏袒一开始都装得很像公事。等真把判词、名册和押送顺序凑在一起，就什么都藏不住。' },
    { threadType: 'timeline', title: '判词、名册、押送顺序，这三样连起来一般都不简单', body: '不是复读隔壁楼，是这种味最近太熟了。你单看一件会觉得巧，三件放一起看，基本就是有人在借公务藏私心。' },
  ],
  dragonPalace: [
    { threadType: 'gossip', title: '龙宫区最近“旧约”这两个字是不是被用滥了', body: '刚看完隔壁楼，感觉最近海宴、水廊、避水珠这些事全在一个方向上跑。要真只是旧约，很多动作根本没必要做到那个份上。' },
    { threadType: 'sameTopic', title: '潮声底下藏不住的，从来不只是旧约', body: '补一句，龙宫区很多人拿旧约说事，其实真正露馅的是那些散场之后还继续发生的动作。隔壁楼就是标准样本。' },
  ],
  infiniteTower: [
    { threadType: 'vote', title: '副本里这种“我先护着你”到底还能装多久队友情', body: '刚看完隔壁楼，感觉无限楼最近很适合再开一盘。保命道具、路线优先级、探路顺位，这些东西真的还洗得动普通队友吗。' },
    { threadType: 'sameTopic', title: '高层活久了就知道，有些偏心根本演不成战术', body: '不是想跟隔壁抢热度，只是这种味看太多了。战术可以解释一两次，解释不了每次都先落在同一个人身上。' },
  ],
  godCourt: [
    { threadType: 'gossip', title: '神庭最近“按规矩来”的人是不是都太会挑着护了', body: '看完隔壁那楼之后有点想笑。很多高位人最爱说天规、公事、公允，结果一到关键处，降罚和改命都只绕着一个人转。' },
    { threadType: 'timeline', title: '神谕和动作一旦对不上，后面多半藏着私心', body: '不是复读，只是想说，神庭很多事别听他说了什么，要看最后罚落在哪、命格改没改、谁被放过。隔壁楼就是一个活样本。' },
  ],
  dreamStation: [
    { threadType: 'essay', title: '【片段】有些人醒着不认，梦里却总先回头', body: '隔壁楼看完后突然想到，梦站最让人受不了的不是重逢，是有人醒来装不熟，梦里却一次次先停下来等你。那种拉扯比承认更像承认。 ' },
    { threadType: 'sameTopic', title: '梦站这种“醒后失联，梦里回头”的味到底谁发明的', body: '不是复读隔壁楼，但最近这类错站感太重了。嘴上不认、白天不认，偏偏在梦里和夜车上露得干干净净。' },
  ],
  bookCity: [
    { threadType: 'timeline', title: '角色一旦开始脱离设定，后面每一页都会露馅', body: '刚看完隔壁楼，想说书中城很多事最适合按章节排。你单看会像作者手滑，连起来就知道有人已经在设定外行动了。' },
    { threadType: 'gossip', title: '不点名，但最近有些番外像在替正文偷偷认账', body: '隔壁那栋楼让我又怀疑起某些番外安排。很多人嘴上说不是那回事，结果番外里每个细节都像在替自己补票。' },
  ],
  beastPlain: [
    { threadType: 'sameTopic', title: '兽原这种领地味一上来，嘴硬基本就没用了', body: '刚看完隔壁楼，想补一句，很多本能护短根本演不成普通关照。风口、守夜、领地边缘这些动作一堆上去，谁都看得出味。' },
    { threadType: 'gossip', title: '不点名，但最近有人把“巡夜顺路”说得太像借口了', body: '先说不是故意跟隔壁楼撞题，只是这种“顺路守门口”“顺手留气味”的事最近也太频繁了。顺路一次叫巧，次次都顺就不是巧。' },
  ],
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function buildForumShadowFollowupPost(input: BuildForumShadowFollowupPostInput): ForumShadowFollowupDraft {
  const pool = CHANNEL_SHADOW_TEMPLATES[input.channel] || CHANNEL_SHADOW_TEMPLATES.junction;
  const template = pool[hashString(`${input.sourcePost.id}:${input.authorId}`) % pool.length];
  const timestamp = input.now || Date.now();

  return {
    id: `forum-shadow-${input.authorId}-${hashString(`${input.sourcePost.id}:${timestamp}`).toString(36)}`,
    authorId: input.authorId,
    title: template.title,
    content: `${template.body}\n\n先记一下，隔壁《${input.sourcePost.title || input.sourcePost.content.slice(0, 16)}》那栋楼我还会继续看。`,
    category: input.categoryLabel,
    threadType: template.threadType,
    timestamp,
  };
}
