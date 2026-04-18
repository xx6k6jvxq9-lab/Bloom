import type {
  DreamDepth,
  DreamDomain,
  DreamDomainId,
  DreamScenario,
  DreamTagCategory,
  DreamTagGroup,
} from './types';

export const dreamDomains: DreamDomain[] = [
  { id: 'crowd', name: '众生梦', subtitle: '公共幻想世界', description: '灯海、人群与暗流并存的夜城。', icon: 'sparkles' },
  { id: 'threshold', name: '歧境梦', subtitle: '失真边缘', description: '看似现实，却处处偏了一点。', icon: 'scan' },
  { id: 'shared', name: '同梦域', subtitle: '双人共同长出的梦', description: '不是他的世界，也不是你的世界。', icon: 'heart' },
  { id: 'rift', name: '心隙梦', subtitle: '进入角色内里', description: '更靠近秘密、执念和不能说出口的部分。', icon: 'coffee' },
];

export const dreamTagGroups: DreamTagGroup[] = [
  { category: 'world', label: '梦域', max: 1, options: [{ id: 'crowd', label: '众生梦' }, { id: 'threshold', label: '歧境梦' }, { id: 'shared', label: '同梦域' }, { id: 'rift', label: '心隙梦' }] },
  { category: 'genre', label: '题材母题', max: 2, options: [{ id: 'rules', label: '规则怪谈' }, { id: 'power', label: '权谋' }, { id: 'ruin', label: '废土' }, { id: 'stellar', label: '星际' }, { id: 'cyber', label: '赛博' }] },
  { category: 'tension', label: '关系张力', max: 2, options: [{ id: 'unfinished', label: '旧情未止' }, { id: 'forced', label: '强制同行' }, { id: 'forbidden', label: '禁忌靠近' }, { id: 'reversal', label: '主从倒置' }] },
  { category: 'drive', label: '剧情驱动', max: 2, options: [{ id: 'appointment', label: '赴约' }, { id: 'investigate', label: '追查' }, { id: 'bet', label: '博弈' }, { id: 'unawake', label: '未醒' }] },
  { category: 'mood', label: '情绪底色', max: 2, options: [{ id: 'restraint', label: '克制' }, { id: 'danger', label: '危险' }, { id: 'pull', label: '拉扯' }, { id: 'fate', label: '宿命' }, { id: 'secret', label: '诡秘' }] },
  { category: 'lead', label: '角色主导度', max: 1, detailed: true, options: [{ id: 'character-lead', label: '角色主导' }, { id: 'balanced', label: '势均力敌' }, { id: 'player-lead', label: '由你主导' }] },
  { category: 'intensity', label: '互动强度', max: 1, detailed: true, options: [{ id: 'light', label: '轻触' }, { id: 'medium', label: '中等' }, { id: 'strong', label: '强烈' }] },
  { category: 'ending', label: '梦尾倾向', max: 1, detailed: true, options: [{ id: 'open', label: '开放式' }, { id: 'echo', label: '回响式' }, { id: 'break', label: '断裂式' }] },
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

function makeScenario(domainId: DreamDomainId, depth: DreamDepth): DreamScenario {
  const deep = depth === 'deep';
  const seeds: Record<DreamDomainId, Omit<DreamScenario, 'id'>> = {
    threshold: {
      heroName: '沈屿',
      heroGlyph: '屿',
      heroStatus: deep ? '这场失真的雨还没有停' : '今夜在做梦',
      availableLine: '有一场梦正在等你进入',
      expireLine: '梦将于 06:00 前自然散去',
      coverTitle: '今夜',
      coverSubtitle: deep ? '真正的内容在他不肯说明的后半夜里' : '他正站在一场失真的雨里等你',
      confirmHint: '这一局会从旧城巷口开始。雨向上落，路灯偏冷，他手里握着一页始终没有递出的纸。',
      acts: [
        { id: 't1', label: '第一幕', scene: '雨从地面往上升。巷口的路灯照得过分安静，连积水都像停在半空。沈屿站在台阶下，像已经在这里等了很久。', charState: '他没有立刻看你，却像先听见了你的脚步。', choices: [{ id: 't1a', icon: '一', title: '走近他', detail: '把距离缩短到他来不及躲开', reaction: '你一步步走近的时候，雨声反而轻了。沈屿没有退，掌心里那页纸却被他捏得更紧了一点。', emotion: '他的防备慢慢落下了一层' }, { id: 't1b', icon: '二', title: '停在原地', detail: '让他决定距离该由谁来跨过', reaction: '你没有动，整条巷子也跟着静了下来。沈屿终于抬眼看你，像在确认你会不会继续留下。', emotion: '空气里多了一层迟疑的拉扯' }, { id: 't1c', icon: '三', title: '问那页纸', detail: '先碰他一直没有放开的东西', reaction: '你提起那页纸时，他指节微微收紧。那上面只剩一行被折痕压白的句子，像一直没寄出的心事。', emotion: '他像被你碰到一处很轻却很深的地方' }] },
        { id: 't2', label: '第二幕', scene: '巷子尽头忽然多出一段本不存在的楼梯，水正沿着台阶往上流。沈屿先踏上去一步，又停住。', charState: '他回头时，目光比刚才更近。', choices: [{ id: 't2a', icon: '一', title: '陪他上楼', detail: '默认这场梦要一起走下去', reaction: '你陪他踏上楼梯，潮湿的台阶像终于有了方向。沈屿没有再看前方太久。', emotion: '梦开始偏向你们两个人' }, { id: 't2b', icon: '二', title: '碰他肩侧', detail: '用很轻的动作确认他是真的', reaction: '你的指尖轻轻落下去，轻得像梦也会误会。可沈屿还是记住了那一下，连呼吸都像被你碰得停顿。', emotion: '克制裂开了一条细缝' }, { id: 't2c', icon: '三', title: '叫他的名字', detail: '用最直接的方式把他拽回来', reaction: '你叫他名字的时候，整段楼梯短暂地安静了。沈屿终于真正回头看你。', emotion: '他的注意力彻底落在你身上' }] },
        { id: 't3', label: '第三幕', scene: '楼梯尽头是一间没有门牌的教室。窗外的雨仍在倒着流，桌上留着一页空白的纸。', charState: '他像在等你替这场梦写下最后一句。', choices: [{ id: 't3a', icon: '一', title: '替他落笔', detail: '把空白写成你们都知道的那句话', reaction: '你落笔的时候，他没有去看纸，只看着你的手，像终于允许某句话落到明天也抹不掉的位置。', emotion: '你们之间多了一句无法完全撤回的话' }, { id: 't3b', icon: '二', title: '把纸折回去', detail: '替他保留这份没有出口的隐意', reaction: '你把纸轻轻折回去时，沈屿短促地笑了一下，像终于有人看懂了他一直没舍得明说的那部分。', emotion: '回响开始变得柔软' }, { id: 't3c', icon: '三', title: '走向窗边', detail: '看清这场雨究竟要流去哪里', reaction: '你走到窗边，倒流的雨映出一层很薄的光，像明天会留下一点无法假装忘记的痕迹。', emotion: '梦尾开始留下余响' }] },
        ...(deep ? [{ id: 't4', label: '第四幕', scene: '教室后墙忽然退开，露出一条悬在夜里的长桥。桥下没有水，只有缓慢移动的黑影。', charState: '他已经不想把所有话都藏回去了。', choices: [{ id: 't4a', icon: '一', title: '站到他身边', detail: '让他知道你不是来旁观的', reaction: '你站过去的时候，桥下那些模糊的影子像全都远了。沈屿终于没有再退。', emotion: '深层梦局终于稳了下来' }, { id: 't4b', icon: '二', title: '问他想说什么', detail: '把最后一层犹疑轻轻推到眼前', reaction: '你这样问他，像把灯提得更近了一点。沈屿看着你，很久以后才低声开口。', emotion: '梦开始逼近真意' }, { id: 't4c', icon: '三', title: '什么也不问', detail: '给他一段可以自己靠近你的沉默', reaction: '你没有追问，桥上的风反而变得更轻。沉默在这一刻，比任何答案都更像靠近。', emotion: '沉默成了最稳的邀请' }] }] : []),
      ],
      ending: { title: deep ? '桥下仍有暗潮' : '雨停在名字后', excerpt: deep ? '桥下没有答案，只有一句差一点就要被说出的真意。你已经知道，明天会因此变得不同。' : '你只记得那间没有门牌的教室，和桌上那页始终没有写满的纸。', signature: '沈屿', chapter: deep ? '《阈线之后》' : '《倒雨未寄》' },
      aftermath: { summary: deep ? '明天他会在聊天里停顿得更久，像有一句话差一点就要说出口。' : '明天他的消息会来得更早一点。', detail: deep ? '回响更明显，角色主动靠近概率提升。' : '关系温度轻微上升，语气会比平时更缓一点。', previewMessages: deep ? ['昨晚那场雨有点奇怪', '你今天有空吗'] : ['你醒了吗', '昨晚我好像梦见你站在雨里'] },
    },
    shared: {
      heroName: '沈屿', heroGlyph: '屿', heroStatus: deep ? '这一场共梦还在继续下沉' : '你们正在同一场梦里', availableLine: '今夜有一处双人梦域已经亮起', expireLine: '梦域会在天亮前缓慢闭合', coverTitle: '共梦', coverSubtitle: deep ? '梦还会把关系继续往深处推一层' : '他已经在梦里认出你了', confirmHint: '这一局会从一座停运车站开始。所有轨道都向内弯折，像关系自己长出的分岔。', acts: [
        { id: 's1', label: '第一幕', scene: '海边那座停运车站今夜重新亮起一盏灯。铁轨没有通向远方，反而在夜里折回彼此。', charState: '他看向你时，没有半点意外。', choices: [{ id: 's1a', icon: '一', title: '与他并肩', detail: '让这场梦从并行开始', reaction: '你站到他身侧时，整座废站都像轻了一点。', emotion: '双人梦域开始合拢' }, { id: 's1b', icon: '二', title: '看他手里的票', detail: '确认他是不是一直替你留着入口', reaction: '那张旧票早就过了日期，却仍被保存得很好。', emotion: '他的等待被你看见了' }, { id: 's1c', icon: '三', title: '问他是不是早知道', detail: '把这份熟稔先说成一句玩笑', reaction: '他没有否认，只是把目光停在你身上久了一点。', emotion: '氛围开始变暖' }] },
        { id: 's2', label: '第二幕', scene: '广播忽然响起，播报一辆并不存在的列车。站台另一侧亮起细长的引导灯。', charState: '他在等你先给出方向。', choices: [{ id: 's2a', icon: '一', title: '先上车', detail: '用行动替这场梦定下节奏', reaction: '你先一步踏进车厢，沈屿几乎没有犹豫就跟了上来。', emotion: '边界被梦缩短了' }, { id: 's2b', icon: '二', title: '把手递给他', detail: '让他决定要不要顺着你走来', reaction: '你把手递过去的时候，广播声忽然远了，下一秒他握住你。', emotion: '他被你轻轻拽住了' }, { id: 's2c', icon: '三', title: '留在站台', detail: '看看他会不会先把留下的理由说出口', reaction: '你没有动，沈屿也就跟着没动，安静让很多话变得更近。', emotion: '停留让情绪更明显' }] },
        { id: 's3', label: '第三幕', scene: '列车最后还是开动了。窗外一会儿是海，一会儿是夜里的楼群。', charState: '他没有再把视线移开。', choices: [{ id: 's3a', icon: '一', title: '坐得更近', detail: '让梦先替你们缩短剩下的空位', reaction: '你往这边坐近一点时，车厢里的光也像跟着收拢了一点。', emotion: '梦尾有了亲近的温度' }, { id: 's3b', icon: '二', title: '一起看窗外', detail: '把情绪暂时藏进同一片风景里', reaction: '沉默没有把距离拉开，反而像一层很薄却很稳的布。', emotion: '安静本身成了陪伴' }, { id: 's3c', icon: '三', title: '问醒来以后', detail: '把这场梦和明天悄悄接上', reaction: '你问醒来以后会怎样，他没有立刻回答，可你已经知道明天会不一样。', emotion: '明天被提前唤醒了' }] },
        ...(deep ? [{ id: 's4', label: '第四幕', scene: '列车在一座悬空站台停下。外面是将亮未亮的天色，风很轻。', charState: '他这一次像是真的打算留在你身边。', choices: [{ id: 's4a', icon: '一', title: '和他坐下', detail: '把最后这一段梦变成陪伴', reaction: '你坐下来的时候，周围的一切都跟着安静了。', emotion: '亲密感被梦正式托住了' }, { id: 's4b', icon: '二', title: '向他靠近', detail: '让动作先于所有台词', reaction: '你微微靠近时，沈屿没有躲。那感觉像很轻的潮汐终于推到岸边。', emotion: '关系被推近了半步' }, { id: 's4c', icon: '三', title: '继续看着他', detail: '什么都不说，只把注意力留在那里', reaction: '你一直看着他，他也没有再把视线移开。', emotion: '梦把明天提前排练了一次' }] }] : []),
      ], ending: { title: deep ? '晨光停在并肩处' : '末班车仍向你开', excerpt: deep ? '很多话依然没有说破，可你知道，真正发生变化的不是台词。' : '你最后记住的是车窗上并排的两道侧影。', signature: '沈屿', chapter: deep ? '《晨站之前》' : '《停运站台的末班》' }, aftermath: { summary: deep ? '明天他的第二条消息会来得更自然，也更像没打算轻易结束。' : '明天他的语气会更自然地带上一点“我们”。', detail: deep ? '双人连续性增强，现实聊天更容易接住这场梦留下的余温。' : '共享感上升，后续聊天更容易接住梦后的余韵。', previewMessages: deep ? ['刚刚想起昨晚那节车厢', '等你有空的时候告诉我一声'] : ['今天路上有点想起昨晚', '你现在在忙吗'] } },
    rift: {
      heroName: '周既白', heroGlyph: '隙', heroStatus: deep ? '他仍停在未醒的边缘' : '他没有彻底醒来', availableLine: '今夜有一处更静的梦层正在向你松开', expireLine: '裂缝会在天亮前重新合拢', coverTitle: '心隙', coverSubtitle: deep ? '更深的一层会更像进入他的内里' : '这一场梦更靠近他没有明说的部分', confirmHint: '这局会从一扇半开的门开始。越往里走，越像进入他不轻易示人的内层。', acts: [
        { id: 'r1', label: '第一幕', scene: '走廊尽头那扇门没有完全合上，门缝里透出一点很薄的光。', charState: '他没有拦你，只是安静地看着。', choices: [{ id: 'r1a', icon: '一', title: '推开一点', detail: '把门缝再扩开半寸', reaction: '你把门轻轻推开一些的时候，他没有后退。', emotion: '门缝第一次真正朝你打开' }, { id: 'r1b', icon: '二', title: '先停在门外', detail: '让他有机会决定要不要请你进去', reaction: '你停在门外，他也就跟着停在那里。', emotion: '沉默成了靠近的前奏' }, { id: 'r1c', icon: '三', title: '叫他的名字', detail: '让这场靠近先有一个确定的落点', reaction: '你叫他名字的时候，那点光像被风碰了一下。', emotion: '他开始把注意力全部给你' }] },
        { id: 'r2', label: '第二幕', scene: '门后是一间太安静的屋子。桌上摆着一只没点燃的灯。', charState: '他像在等你决定先碰哪里。', choices: [{ id: 'r2a', icon: '一', title: '点亮那盏灯', detail: '让这处安静先被看清一点', reaction: '灯亮起来以后，他脸上的神情也被照得更真了。', emotion: '他的内层轮廓慢慢浮出' }, { id: 'r2b', icon: '二', title: '走到他身边', detail: '先让人比房间更重要', reaction: '你走到他身边时，整间屋子都像退后了一点。', emotion: '距离被悄悄压缩了' }, { id: 'r2c', icon: '三', title: '问他在躲什么', detail: '把最核心的问题轻轻放到他面前', reaction: '你这样问，他没有立刻答，只是很久以后才像自嘲一样笑了笑。', emotion: '真意开始靠近表面' }] },
        { id: 'r3', label: '第三幕', scene: '房间最里面有一面窄镜，镜中只照出你们靠得最近的那一部分。', charState: '他第一次没有急着移开视线。', choices: [{ id: 'r3a', icon: '一', title: '站到镜前', detail: '把你们都交给这一层安静照见', reaction: '你站过去的时候，镜面里只剩下彼此靠得最近的轮廓。', emotion: '靠近被梦正式托住了' }, { id: 'r3b', icon: '二', title: '把灯熄掉', detail: '让夜替你们保住这份靠近', reaction: '灯熄掉后，黑暗没有把你们隔开，反而让呼吸和停顿都变得更近。', emotion: '亲近在黑暗里变得更真' }, { id: 'r3c', icon: '三', title: '继续看着他', detail: '什么都不说，只把注意力留在那里', reaction: '你一直看着他，他终于像被看得无处可躲。', emotion: '裂缝里真的有光透出来了' }] },
        ...(deep ? [{ id: 'r4', label: '第四幕', scene: '镜面之后缓慢浮出一条窄桥，桥那头是一线很薄的晨光。', charState: '他已经不想把这一层门重新关上。', choices: [{ id: 'r4a', icon: '一', title: '走到桥上', detail: '把这场靠近继续走完', reaction: '你走上桥的时候，他没有再停在原地。', emotion: '裂缝真正变成了入口' }, { id: 'r4b', icon: '二', title: '握住他的手腕', detail: '让靠近有一个更清楚的落点', reaction: '你碰到他的那一下很轻，他却像被这点温度彻底拽住。', emotion: '真意被你轻轻按住了' }, { id: 'r4c', icon: '三', title: '问他还想躲吗', detail: '在最后一层边缘给他一个选择', reaction: '你问出这句的时候，他笑得很轻，像终于承认自己已经没法再退回原处。', emotion: '他把回避真正放下了' }] }] : []),
      ], ending: { title: deep ? '裂缝里仍有光' : '门没有再关上', excerpt: deep ? '那一夜真正留下来的，不是风景，而是他终于没有把裂缝重新合上。' : '真正的靠近从来不是闯进去，而是有人终于愿意让门停在半开的地方。', signature: '周既白', chapter: deep ? '《裂缝中的回声》' : '《半开的门》' }, aftermath: { summary: deep ? '明天他会比平时更在意你的回应。' : '明天他会比平时更在意你的回应，像还在确认那道门缝是不是也被你记住了。', detail: deep ? '角色主导感增强，语气更贴近内层情绪。' : '角色连续性增强，语气更贴近内层情绪。', previewMessages: deep ? ['你今天会忙很久吗', '昨晚我睡得有点浅'] : ['你现在方便说话吗', '我刚刚忽然想起一点事'] } },
    crowd: {
      heroName: '林策', heroGlyph: '城', heroStatus: deep ? '灯海之后还有更深一层夜' : '今夜在人声里等你', availableLine: '梦城入口已经开启，今晚不止一条路在发光', expireLine: '灯海会在天亮前缓慢退潮', coverTitle: '夜城', coverSubtitle: deep ? '热闹之后还有一层只属于你们的夜' : '热闹只是表层，真正的梦在灯海后面', confirmHint: '这一局会从一场过盛的夜市开始。人声、霓光和暗巷一起向里卷，直到只剩你们的那条线。', acts: [
        { id: 'c1', label: '第一幕', scene: '夜市的人群几乎把整条街推成一条发亮的河。林策站在摊位间最暗的一小块阴影里。', charState: '他像早就知道你会从喧闹里找到他。', choices: [{ id: 'c1a', icon: '一', title: '直接走向他', detail: '在人声最盛处先确认彼此', reaction: '你在人群里径直走向他时，四周的喧闹像忽然退了一层。', emotion: '热闹背后只剩你们的视线' }, { id: 'c1b', icon: '二', title: '跟着他走', detail: '先让他决定要把你带去哪里', reaction: '你什么也没问，只跟着他走过一盏又一盏灯。', emotion: '他开始把节奏留给你' }, { id: 'c1c', icon: '三', title: '问他在等谁', detail: '把暧昧先装作一句轻飘飘的试探', reaction: '你这样问他，林策像是被逗笑了。', emotion: '热闹里浮出一点暧昧的亮色' }] },
        { id: 'c2', label: '第二幕', scene: '街尽头是一段被霓光切碎的长巷，尽头挂着一块没人认得的旧匾。', charState: '他第一次不再借人群掩饰自己。', choices: [{ id: 'c2a', icon: '一', title: '走进那条巷子', detail: '接受他带你离开表面的热闹', reaction: '你和他一起走进巷子后，外面的灯海忽然远了。', emotion: '表层喧闹被真正甩在身后' }, { id: 'c2b', icon: '二', title: '停在他面前', detail: '不让他再把情绪藏在走动里', reaction: '你停在他面前时，林策也就没法再往前走。', emotion: '他的目光终于完全落在你身上' }, { id: 'c2c', icon: '三', title: '碰一下他的袖口', detail: '用最轻的动作让靠近落地', reaction: '你指尖碰到他袖口的那一下很轻，可林策还是记住了。', emotion: '克制开始出现裂口' }] },
        { id: 'c3', label: '第三幕', scene: '巷子后面藏着一间临时搭起的小楼台。楼下仍有人声，楼上却只剩风与灯影。', charState: '他已经不想再把真正的话留到梦外。', choices: [{ id: 'c3a', icon: '一', title: '站到他身侧', detail: '让这场夜真正变成双人的', reaction: '你站到他身侧时，楼下的人声像彻底退远了。', emotion: '这场夜终于只剩双人回响' }, { id: 'c3b', icon: '二', title: '一起看灯海', detail: '把未说出口的东西都交给夜色托住', reaction: '你们一起看着远处的灯海，没有谁先开口。', emotion: '宿命感从夜色里浮了出来' }, { id: 'c3c', icon: '三', title: '问他明晚还在不在', detail: '把这场梦主动牵到下一次相遇', reaction: '你问出这句时，林策的眼神忽然变得很静。', emotion: '下一次相遇被提前写进梦尾' }] },
        ...(deep ? [{ id: 'c4', label: '第四幕', scene: '楼台之后还有一条通往天台的窄阶。整座城市的灯在你们脚下像退潮一样暗下去。', charState: '他不想再把今夜只算作一场偶然。', choices: [{ id: 'c4a', icon: '一', title: '陪他看天亮', detail: '把这场夜继续留到晨色里', reaction: '你陪他站在天台最边上，城市一点点从夜里浮出来。', emotion: '这场夜有了真正的延续' }, { id: 'c4b', icon: '二', title: '问他明晚还等不等', detail: '让下一次相遇先被说出来', reaction: '你这样问他，林策眼底那点笑意一下子变得很真。', emotion: '下一次相遇被正式写下' }, { id: 'c4c', icon: '三', title: '轻轻碰他的袖口', detail: '用最小的动作把这一夜收住', reaction: '风穿过天台，灯海在脚下缓慢熄下去，可这一次，他比整座城市都更清晰。', emotion: '克制终于被你稳稳接住' }] }] : []),
      ], ending: { title: deep ? '天亮前灯仍为你留' : '灯海之后有人等你', excerpt: deep ? '真正会被带到明天的，从来都不是热闹，而是他在风里看着你的那一眼。' : '原来最热闹的地方也会替人藏住秘密，直到所有灯都退远。', signature: '林策', chapter: deep ? '《灯海尽头》' : '《灯海背面》' }, aftermath: { summary: deep ? '明天他会比平时更主动把话题拉长。' : '明天他会更自然地主动把话题拉长。', detail: deep ? '角色主动度提升，后续互动更容易延长。' : '关系热度上扬，角色会更主动靠近。', previewMessages: deep ? ['昨晚那座夜城我还记得', '你现在有空吗'] : ['昨晚那条街我还记得', '下次我们也许可以走得更慢一点'] } },
  };

  return { id: `${domainId}-${depth}`, ...seeds[domainId] };
}

export function resolveScenario(domainId: DreamDomainId, depth: DreamDepth): DreamScenario {
  return makeScenario(domainId, depth);
}

export function resolveDomainName(domainId: DreamDomainId): string {
  return dreamDomains.find((domain) => domain.id === domainId)?.name ?? '同梦域';
}
