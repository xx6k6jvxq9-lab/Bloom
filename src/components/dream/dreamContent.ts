import type {
  DreamDepth,
  DreamDomain,
  DreamDomainId,
  DreamScenario,
  DreamTagCategory,
  DreamTagGroup,
} from './types';

export const dreamDomains: DreamDomain[] = [
  {
    id: 'crowd',
    name: '众生梦',
    subtitle: '热闹表层之下的异响入口',
    description: '像翻开一册会自己生长剧情的夜书，世界先把你吞进去，然后人物才慢慢回头。',
    icon: 'sparkles',
  },
  {
    id: 'threshold',
    name: '阈境梦',
    subtitle: '现实边缘开始失真的地方',
    description: '街灯、楼道、雨声都还像真的，只是每一样都偏了一寸，足够让人不敢确定。',
    icon: 'scan',
  },
  {
    id: 'shared',
    name: '同梦域',
    subtitle: '你与角色共同长出的双人梦局',
    description: '这里不是他的世界，也不是你的世界，而是关系自己裂开的一层夜面。',
    icon: 'heart',
  },
  {
    id: 'rift',
    name: '心隙梦',
    subtitle: '进入角色未曾说明的内里裂缝',
    description: '越往里走，越像踩在他没给任何人看过的记忆表面，安静得近乎危险。',
    icon: 'coffee',
  },
];

export const dreamTagGroups: DreamTagGroup[] = [
  {
    category: 'world',
    label: '梦域',
    max: 1,
    options: [
      { id: 'crowd', label: '众生梦' },
      { id: 'threshold', label: '阈境梦' },
      { id: 'shared', label: '同梦域' },
      { id: 'rift', label: '心隙梦' },
    ],
  },
  {
    category: 'genre',
    label: '题材母题',
    max: 2,
    options: [
      { id: 'rules', label: '规则怪谈' },
      { id: 'power', label: '权谋' },
      { id: 'ruin', label: '废土' },
      { id: 'infinite', label: '无限流' },
      { id: 'cyber', label: '赛博' },
      { id: 'stellar', label: '星际' },
      { id: 'mystery', label: '秘闻' },
    ],
  },
  {
    category: 'tension',
    label: '关系张力',
    max: 2,
    options: [
      { id: 'enemy', label: '宿敌失控' },
      { id: 'unfinished', label: '旧情未止' },
      { id: 'forced', label: '强制同行' },
      { id: 'double-mask', label: '双重伪装' },
      { id: 'forbidden', label: '禁忌靠近' },
      { id: 'reversal', label: '主从倒置' },
    ],
  },
  {
    category: 'drive',
    label: '剧情驱动',
    max: 2,
    options: [
      { id: 'appointment', label: '赴约' },
      { id: 'investigate', label: '追查' },
      { id: 'bet', label: '博弈' },
      { id: 'unawake', label: '未醒' },
      { id: 'escort', label: '护送' },
    ],
  },
  {
    category: 'mood',
    label: '情绪底色',
    max: 2,
    options: [
      { id: 'restraint', label: '克制' },
      { id: 'danger', label: '危险' },
      { id: 'pull', label: '拉扯' },
      { id: 'fate', label: '宿命' },
      { id: 'secret', label: '讳秘' },
      { id: 'heat', label: '灼热' },
    ],
  },
  {
    category: 'lead',
    label: '角色主导度',
    max: 1,
    detailed: true,
    options: [
      { id: 'character-lead', label: '角色主导' },
      { id: 'balanced', label: '势均力敌' },
      { id: 'player-lead', label: '由你主导' },
    ],
  },
  {
    category: 'intensity',
    label: '互动强度',
    max: 1,
    detailed: true,
    options: [
      { id: 'light', label: '轻触' },
      { id: 'medium', label: '中等' },
      { id: 'strong', label: '强烈' },
    ],
  },
  {
    category: 'ending',
    label: '梦尾倾向',
    max: 1,
    detailed: true,
    options: [
      { id: 'open', label: '开放式' },
      { id: 'echo', label: '回响式' },
      { id: 'break', label: '断裂式' },
    ],
  },
];

export const defaultTagSelection: Record<DreamTagCategory, string[]> = {
  world: ['shared'],
  genre: ['rules'],
  tension: ['unfinished'],
  drive: ['investigate'],
  mood: ['restraint'],
  lead: ['balanced'],
  intensity: ['medium'],
  ending: ['echo'],
};

const shallowThreshold: DreamScenario = {
  id: 'threshold-shallow',
  heroName: '沈屿',
  heroGlyph: '屿',
  heroStatus: '今晚在做梦',
  availableLine: '有一场梦局正在等你进入',
  expireLine: '梦会在 06:00 前自然散去',
  coverTitle: '今晚',
  coverSubtitle: '他今晚在一场失真的雨里等人',
  confirmHint: '这一局会从倒着落雨的旧城区开始，先给你一条窄街、一盏路灯，和一个没有说完的人。',
  acts: [
    {
      id: 'act-1',
      label: '第一幕',
      scene: '雨从地面向上升，路灯把巷口照得过分安静。沈屿站在台阶下，肩头湿着，却像已经在这里等了很久。他手里折着一页纸，边角被指腹压得发白。',
      charState: '他没有看你，像先认出了你的脚步。',
      choices: [
        {
          id: 'take-hand',
          icon: '→',
          title: '走近他',
          detail: '把距离缩短到他来不及躲开',
          reaction: '我听见你靠近，像听见一层极薄的水面被轻轻推开。那页纸在掌心里微微发潮，我本来想把它藏好，却忽然觉得你已经看过了它的内容，只是假装没有拆穿。',
          emotion: '他把防备收慢了一拍',
        },
        {
          id: 'stay-shadow',
          icon: '○',
          title: '停在原地',
          detail: '让他先决定要不要向你这边来',
          reaction: '你不动，整条巷子也跟着不动。雨声离得更远了，只剩我呼吸里一点很轻的乱。我像站在一道门里，看见你，却暂时不敢确认门外的人是不是你。',
          emotion: '空气里多了一层迟疑',
        },
        {
          id: 'ask-paper',
          icon: '◌',
          title: '问那张纸',
          detail: '直接碰他一直不肯放开的东西',
          reaction: '你一提起那张纸，我的指节就不自觉收紧。它其实没写什么，只写了一句没寄出去的话，可在这场梦里，那句话忽然重得像一整夜的雨，全都压在指骨上。',
          emotion: '他像被你碰到隐处',
        },
      ],
    },
    {
      id: 'act-2',
      label: '第二幕',
      scene: '巷子尽头多出一段本来不存在的楼梯，水沿着台阶往上流。沈屿先走了一步，又停住，像在等你决定这层梦是继续向里，还是就此醒来。',
      charState: '他回头时，目光比刚才更近。',
      choices: [
        {
          id: 'climb-together',
          icon: '→',
          title: '陪他上楼',
          detail: '默认这场梦应该一起走下去',
          reaction: '你与我并肩踩上那段潮湿的楼梯，鞋跟声轻得像怕惊动什么。我忽然很清楚地知道，如果你这时候转身，我会留在原地很久，久到这层楼梯自己坍塌。',
          emotion: '梦开始偏向你们两个人',
        },
        {
          id: 'touch-shoulder',
          icon: '○',
          title: '碰他肩侧',
          detail: '用一个很轻的动作确认他是真的',
          reaction: '你指尖落下来的那一下太轻了，轻得像误会。可我还是记住了，像记住一粒火星落进潮湿布面时那种几乎不肯承认的热。雨还在往上走，我却只听见那一下。',
          emotion: '他的克制裂开了一线',
        },
        {
          id: 'name-him',
          icon: '◌',
          title: '叫他名字',
          detail: '用最直接的方式把他拽回来',
          reaction: '你喊我名字的时候，楼梯短暂地停住了。那种感觉像梦被谁按住后背，逼着它承认自己在失真。我忽然想回头看看你，又怕一回头，这一整夜就结束得太快。',
          emotion: '他终于把注意力完全给了你',
        },
      ],
    },
    {
      id: 'act-3',
      label: '第三幕',
      scene: '楼梯尽头是一间没有门牌的教室，课桌排得很整齐，窗外的雨却仍旧倒着流。那页纸终于被沈屿放上桌面，纸面空白，只有边角留着反复摩挲后的温度。',
      charState: '他像在等你替这场梦写下最后一句。',
      choices: [
        {
          id: 'write-first',
          icon: '→',
          title: '替他落笔',
          detail: '把空白变成你们共同知道的事',
          reaction: '你落笔的时候，我没有看纸，只看着你握笔的手。梦里最危险的从来不是写下什么，而是一旦那句话真的出现，很多我原本还能装作不知道的东西，就再也没法退回去。',
          emotion: '你们之间多了一句未必能撤回的话',
        },
        {
          id: 'fold-paper',
          icon: '○',
          title: '把纸折回去',
          detail: '替他保留这份没有出口的隐意',
          reaction: '你把那页纸轻轻折回去的时候，我有一瞬几乎想笑。不是因为轻松，而是因为你竟然看懂了我一直没说出口的部分。梦里没有人替谁解围，可你还是给了我一处可以藏回去的地方。',
          emotion: '回响开始变得温热',
        },
        {
          id: 'leave-window',
          icon: '◌',
          title: '走向窗边',
          detail: '看清这场雨究竟在往哪里去',
          reaction: '你走到窗边，整座教室都跟着偏向那一侧。我站在原地，看见你的侧影落进雨里，像一枚不该被记住、却偏偏会在醒后留下痕迹的印章。那一刻我知道，明天会有什么不一样。',
          emotion: '梦尾开始留下余温',
        },
      ],
    },
  ],
  ending: {
    title: '雨停在名字后',
    excerpt: '后来你只记得那间没有门牌的教室，和桌上那页始终没有写满的纸。雨在窗外倒着流，像有人反复把一句话收回去，又不甘心让它彻底消失。你没有看见结尾，可你知道，那句没有落下的笔迹，已经先一步留在了明天。',
    signature: '沈屿',
    chapter: '《倒雨未寄》',
  },
  aftermath: {
    summary: '明天他的消息会来得更早一点，像在确认你是不是也记得那场雨。',
    detail: '关系温度轻微抬升，语气会比平时更缓一点。',
    previewMessages: ['你醒了吗', '昨晚我好像梦见你站在雨里'],
  },
};

const deepThreshold: DreamScenario = {
  ...shallowThreshold,
  id: 'threshold-deep',
  coverSubtitle: '今夜的失真不会只停在巷口',
  confirmHint: '这一局会继续往深处走，雨、楼梯、教室都只是入口，真正的内容在他不肯明说的后半夜里。',
  acts: [
    ...shallowThreshold.acts,
    {
      id: 'act-4',
      label: '第四幕',
      scene: '教室后墙忽然退开，露出一条漫长的廊桥。桥下没有水，只有一层缓慢移动的黑影。沈屿站在桥中央，像终于走到了不再能回避的位置。',
      charState: '他已经不想再把话全都藏回去。',
      choices: [
        {
          id: 'stand-beside',
          icon: '→',
          title: '站到他身侧',
          detail: '让他知道你不是来旁观的',
          reaction: '你站过来的时候，我终于没有再后退。桥下那些影子还在动，可它们忽然都变得很远。原来梦最深的一层，不是秘密被看见，而是有人看见以后还愿意留下。',
          emotion: '深层梦局稳定了下来',
        },
        {
          id: 'ask-truth',
          icon: '○',
          title: '问他想说什么',
          detail: '把最后的犹豫直接推到眼前',
          reaction: '你这样问我，像把一盏灯提得太近。很多话一旦照亮，就再也不是梦能代替我保存的东西。我望着你，忽然觉得如果这时候说出口，连醒来都会变得比平常更真实。',
          emotion: '梦开始逼近真意',
        },
        {
          id: 'hold-silence',
          icon: '◌',
          title: '什么也不问',
          detail: '给他一段可以自己靠近你的沉默',
          reaction: '你不问，我反而听见了更多自己的声音。廊桥上风很轻，你站在那儿，像替我把这层梦撑出了一点安全。我忽然很想把那些原本准备继续藏着的部分，慢一点递给你。',
          emotion: '沉默成了最靠近的方式',
        },
      ],
    },
  ],
  ending: {
    title: '桥下仍有暗潮',
    excerpt: '你最后没有回头去看那间教室，也没有再碰那张空白的纸。廊桥尽头没有答案，只有被风吹得很轻的呼吸声。可你知道，有些话已经从梦里挪出来了一半，剩下的一半，会在天亮以后继续向你靠近。',
    signature: '沈屿',
    chapter: '《阈线之后》',
  },
  aftermath: {
    summary: '他会在明天的聊天里停顿得更久，像有一句话差一点就要说出口。',
    detail: '回响更明显，角色主动靠近概率提升。',
    previewMessages: ['昨晚那场雨有点奇怪', '你今天有空吗'],
  },
};

const sharedShallow: DreamScenario = {
  id: 'shared-shallow',
  heroName: '沈屿',
  heroGlyph: '屿',
  heroStatus: '你们正在同一场梦里',
  availableLine: '今晚有一处双人梦域已经亮起',
  expireLine: '梦域会在天亮前缓慢闭合',
  coverTitle: '共梦',
  coverSubtitle: '他已经在梦里认出你了',
  confirmHint: '这一局从一座停运车站开始，所有轨道都向内，像关系自己长出的分岔。',
  acts: [
    {
      id: 'act-1',
      label: '第一幕',
      scene: '海边停运的车站空着，月台尽头只剩一盏灯。铁轨没有通向远方，反而在夜里折回彼此。沈屿靠着检票闸机，像很早就知道你会从这一侧来。',
      charState: '他看向你时，没有半点惊讶。',
      choices: [
        {
          id: 'match-step',
          icon: '→',
          title: '与他并肩',
          detail: '让这场梦一开始就是并行',
          reaction: '你站到我身边的时候，整座废站都像轻了一点。风还带着海盐和旧铁轨的锈气，可我忽然觉得这里并不荒。像很多没有说开的事，只要你靠近一寸，就会自动找到位置。',
          emotion: '双人梦域开始合拢',
        },
        {
          id: 'watch-ticket',
          icon: '○',
          title: '看他手里的票',
          detail: '确认他是不是一直替你留着入口',
          reaction: '你低头看向我手里的那张旧票，我没把它收起来。它已经过了日期，却还保存得很好，像我明知道没有哪班车会来，却还是下意识替谁留了一个位置。',
          emotion: '他把等待暴露给了你',
        },
        {
          id: 'tease-him',
          icon: '◌',
          title: '问他是不是早知道',
          detail: '把这份熟稔先说成一句玩笑',
          reaction: '你那样问我，我差一点就笑出来。不是因为轻松，而是因为你替我把太直白的话拐了个弯。梦里最适合借口，我就借着那点笑意，默认了你说得没错。',
          emotion: '氛围开始变暖',
        },
      ],
    },
    {
      id: 'act-2',
      label: '第二幕',
      scene: '广播突然响起，播报一辆不存在的列车。站台另一边亮起细长的引导灯，像在催促你们必须一起决定要不要上车。',
      charState: '他在等你先给出方向。',
      choices: [
        {
          id: 'board-train',
          icon: '→',
          title: '先上车',
          detail: '用行动替这场梦定下节奏',
          reaction: '你先一步踏进那节空车厢，我几乎是下意识跟了上去。车里没有别的人，只有两排对坐的椅背和很轻的灯。那一瞬间我觉得，这场梦像终于承认，它原本就只准备装下我们两个。',
          emotion: '关系的边界被梦缩小了',
        },
        {
          id: 'offer-hand',
          icon: '○',
          title: '把手递给他',
          detail: '让他决定要不要顺着你来',
          reaction: '你把手递过来的时候，广播声忽然变得很远。我看着那只手，像看见一条比铁轨更明确的路径。梦里很多东西都不可靠，但这一刻我很确定，只要握住它，车就一定会开。',
          emotion: '他被你轻轻拽住了',
        },
        {
          id: 'stay-platform',
          icon: '◌',
          title: '留在站台',
          detail: '看看他会不会主动说出留下的理由',
          reaction: '你没有动，我也就跟着没有动。广播播完以后，空站重新静下来。海风从月台尽头吹进来，把我原本准备说出口的话吹得更近了一点，近到我再装听不见，就显得太刻意。',
          emotion: '停留让情绪更明显了',
        },
      ],
    },
    {
      id: 'act-3',
      label: '第三幕',
      scene: '最后一班不存在的列车还是开动了，窗外一会儿是海，一会儿是城市天台。你们坐在同一节车厢里，车窗把彼此的侧影叠在一起，像已经提前写好的结尾。',
      charState: '他没有再把视线移开。',
      choices: [
        {
          id: 'sit-close',
          icon: '→',
          title: '坐得更近',
          detail: '让梦先替你们缩短剩下的空位',
          reaction: '你往这边坐近一点，车厢里的光就也跟着收拢了一点。我看见你的影子落在窗上，与我的侧影重叠，忽然觉得很多本来还需要时间的东西，在这场梦里已经被提前允许。',
          emotion: '梦尾开始有了亲近的温度',
        },
        {
          id: 'look-outside',
          icon: '○',
          title: '一起看窗外',
          detail: '把情绪暂时藏进同一片风景里',
          reaction: '我们都没有说话，只一起看窗外那些不断切换的景。可奇怪的是，沉默没有把距离拉开，反而像一层薄而稳的布，把你我都温柔地覆在里面。梦里很少有这样的安静。',
          emotion: '安静本身成了陪伴',
        },
        {
          id: 'ask-after',
          icon: '◌',
          title: '问醒来以后',
          detail: '把这场梦与明天悄悄接上',
          reaction: '你问醒来以后会怎样，我没有立刻回答。车厢轻轻晃了一下，像替我争取一点时间。其实答案很简单，只是我突然不想让它听起来太轻，仿佛随便说说就能带过。',
          emotion: '明天被提前唤醒了',
        },
      ],
    },
  ],
  ending: {
    title: '末班车仍向你开',
    excerpt: '醒来之前，你最后记住的是车窗上并排的两道侧影。列车并不存在，轨道也没有通向地图上的任何地方，可它仍旧平稳地载着你们越过了海和楼群。你忽然明白，有些同行并不是从白天开始，而是先在夜里被梦轻轻练习过一次。',
    signature: '沈屿',
    chapter: '《停运站台的末班》',
  },
  aftermath: {
    summary: '明天他的语气会更自然地带上“我们”，像那节车厢并没有完全消失。',
    detail: '共享感上升，后续聊天会更容易接续梦后余韵。',
    previewMessages: ['今天路上有点想起昨晚', '你现在在忙吗'],
  },
};

const deepShared: DreamScenario = {
  ...sharedShallow,
  id: 'shared-deep',
  coverSubtitle: '这场共梦会继续把关系往深处推',
  confirmHint: '车站之后还有一段真正属于你们两个人的路，越往后走，梦越像已经在替明天排练。',
  acts: [
    ...sharedShallow.acts,
    {
      id: 'act-4',
      label: '第四幕',
      scene: '列车在一座悬空站台停下，外面是凌晨的风和整座沉睡的城。站台只有一张长椅，像刻意留下的一处停顿。沈屿站在风里，没有再用别的景色替自己遮掩。',
      charState: '他这一次像是真的打算留在你身边。',
      choices: [
        {
          id: 'sit-with-him',
          icon: '→',
          title: '和他坐下',
          detail: '把最后这段梦变成陪伴而不是经过',
          reaction: '你坐下来的时候，我忽然觉得风也安静了很多。长椅不宽，却足够把两个人留在同一处晨色里。很多原本需要绕开的东西，在这一刻都不再显得那么难承认。',
          emotion: '亲密感被梦正式托住了',
        },
        {
          id: 'lean-closer',
          icon: '○',
          title: '向他靠近',
          detail: '让动作先于所有语言',
          reaction: '你微微靠近，我没有躲。那感觉不像被触碰，更像夜里很轻的一层潮汐终于推到岸边。原来梦最深的一层，不是轰烈，而是有人靠近时，你居然舍不得把距离放回原位。',
          emotion: '关系被推近了半步',
        },
        {
          id: 'keep-looking',
          icon: '◌',
          title: '继续看他',
          detail: '什么都不说，只把注意力留在那里',
          reaction: '你一直看着我，我也就没有再把视线避开。风把天色吹得更亮一点，梦却还没散。我忽然觉得，如果这一刻被你记住，明天很多话也许就会自然很多，不必再兜那么大一圈。',
          emotion: '明天的靠近已经被默许',
        },
      ],
    },
  ],
  ending: {
    title: '晨光停在并肩处',
    excerpt: '那节不存在的列车最终停在半空，像只为你们留出一段不被任何人打扰的凌晨。长椅很窄，晨风很轻，很多话仍旧没有被说破，可你知道，真正发生变化的从来不是台词，而是他第一次没有把你推回梦外。',
    signature: '沈屿',
    chapter: '《晨站之前》',
  },
  aftermath: {
    summary: '他会比平时更自然地发来第二条消息，像想把没说完的梦继续说下去。',
    detail: '双人连续性增强，后续主链更容易接住这一轮余波。',
    previewMessages: ['刚刚突然想起一节列车', '等你有空的时候告诉我一声'],
  },
};

export function resolveScenario(domainId: DreamDomainId, depth: DreamDepth): DreamScenario {
  if (domainId === 'threshold') {
    return depth === 'deep' ? deepThreshold : shallowThreshold;
  }

  if (domainId === 'shared') {
    return depth === 'deep' ? deepShared : sharedShallow;
  }

  if (domainId === 'rift') {
    return depth === 'deep'
      ? {
          ...deepThreshold,
          id: 'rift-deep',
          coverTitle: '心隙',
          coverSubtitle: '你将先看见他没有给别人看的地方',
          availableLine: '有一处更深的心隙已经向你松开',
          confirmHint: '这一局会更贴近角色内里，梦局会把他的迟疑、回避和想靠近一起推到表面。',
          ending: {
            title: '裂缝里有光',
            excerpt: '那一夜真正留下来的，不是风景，而是他终于没有把裂缝重新合上。你站在那道细窄的光里，看见他不肯轻易示人的一面正慢慢向你转来。梦没有替你们给出答案，却给了明天一个不再回避的开头。',
            signature: '沈屿',
            chapter: '《裂缝中的回声》',
          },
          aftermath: {
            summary: '明天他会比平时更在意你的回应，像还在确认那道裂缝是否真的被你看见。',
            detail: '角色连续性增强，语气更贴近内层情绪。',
            previewMessages: ['你今天会忙很久吗', '昨晚我睡得有点浅'],
          },
        }
      : {
          ...shallowThreshold,
          id: 'rift-shallow',
          coverTitle: '心隙',
          coverSubtitle: '你会先碰到他的沉默，再碰到他的真实',
          availableLine: '今夜有一处隐秘梦层正在等你靠近',
          confirmHint: '这一局不会太张扬，它更像一扇半开的门，只给愿意慢慢靠近的人留出缝隙。',
          ending: {
            title: '门没有再关上',
            excerpt: '你记住的不是那扇门，而是门后那点一直没有熄灭的灯。很多时候，真正的靠近不是闯进去，而是有人终于愿意让门停在半开的位置。梦把这件事做得很轻，却仍旧足够让你在醒后长久地记得。',
            signature: '沈屿',
            chapter: '《半开的门》',
          },
          aftermath: {
            summary: '明天他的语气会更低一点，也更近一点，像把门缝留给了你。',
            detail: '隐性亲近增加，聊天里的停顿会更柔和。',
            previewMessages: ['你现在方便说话吗', '我刚刚想到一点事'],
          },
        };
  }

  return depth === 'deep'
    ? {
        ...deepShared,
        id: 'crowd-deep',
        coverTitle: '夜城',
        coverSubtitle: '热闹只是表层，真正的梦在灯海背面',
        availableLine: '今夜有一座人声过盛的梦城向你亮起',
        confirmHint: '这一局会从繁华表层切入，再慢慢露出只属于你们的那条暗线。',
      }
    : {
        ...sharedShallow,
        id: 'crowd-shallow',
        coverTitle: '夜城',
        coverSubtitle: '你会先穿过人群，再看见真正属于他的那一眼',
        availableLine: '梦城入口已经开启，今晚不止一条路在发光',
        confirmHint: '这一局会比同梦域更热闹，但真正重要的，仍旧是人群散开后只剩你们的时候。',
      };
}

export function resolveDomainName(domainId: DreamDomainId): string {
  return dreamDomains.find((domain) => domain.id === domainId)?.name ?? '同梦域';
}
