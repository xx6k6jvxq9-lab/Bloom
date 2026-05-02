import type {
  Character,
  ForumSpectatorObjectMode,
  ForumSpectatorSettings,
  ForumSpectatorTargetCharacter,
  ForumSpectatorTargetRole,
  ForumSpectatorUserSlot,
} from '../../types';
import { getSpectatorWorldShellMeta, resolveSpectatorWorldShell } from './spectatorWorldShells';

export const SPECTATOR_BOARD_AUTHOR_PREFIX = 'forum_spectator_board_';
export const SPECTATOR_BOARD_CATEGORY = '镜间';
export const SPECTATOR_BOARD_LABEL = '镜间';

export type SpectatorThreadKind =
  | 'relationship-observation'
  | 'romance-imagination'
  | 'sighting'
  | 'dangerous-charm'
  | 'rumor-drop'
  | 'vote-war'
  | 'cp-discussion'
  | 'multi-dynamic'
  | 'ranking-discussion'
  | 'soft-sweet'
  | 'daily-sugar'
  | 'comfort-scene';

export type SpectatorPostDraft = {
  kind: SpectatorThreadKind;
  badge: string;
  title: string;
  content: string;
  linkedToPrevious?: boolean;
};

export const SPECTATOR_TONE_OPTIONS = [
  { id: '嘴碎路人', label: '路过乱讲' },
  { id: '深夜不睡', label: '深夜开嗑' },
  { id: '嗑疯了', label: '嗑到失智' },
  { id: '拉扯党', label: '就爱拉扯' },
  { id: '缺德乐子人', label: '缺德看戏' },
  { id: '正经考据', label: '认真扒线' },
  { id: '半真半假', label: '真假都押' },
  { id: '代餐文学', label: '代餐管够' },
  { id: '押注开盘', label: '买定离手' },
  { id: '冷脸上头', label: '冷脸也嗑' },
  { id: '阴暗乱嗑', label: '阴暗乱嗑' },
  { id: '买冷股的', label: '专买冷股' },
  { id: '见证文学', label: '见证这一对' },
  { id: '背德发作', label: '背德发作' },
  { id: '宿敌特供', label: '宿敌特供' },
] as const;

export const SPECTATOR_ANGLE_OPTIONS = [
  { id: 'observation', label: '抠细节', draftKind: 'relationship-observation' as SpectatorThreadKind },
  { id: 'romance', label: '嗑这口', draftKind: 'romance-imagination' as SpectatorThreadKind },
  { id: 'sighting', label: '偶遇贴', draftKind: 'sighting' as SpectatorThreadKind },
  { id: 'danger', label: '危险拉扯', draftKind: 'dangerous-charm' as SpectatorThreadKind },
  { id: 'fiction', label: '同人文', draftKind: 'romance-imagination' as SpectatorThreadKind },
  { id: 'rumor', label: '匿名瓜', draftKind: 'rumor-drop' as SpectatorThreadKind },
  { id: 'vote', label: '开盘押注', draftKind: 'vote-war' as SpectatorThreadKind },
  { id: 'contrast', label: '反差糖', draftKind: 'dangerous-charm' as SpectatorThreadKind },
  { id: 'hardmouth', label: '嘴硬区', draftKind: 'relationship-observation' as SpectatorThreadKind },
  { id: 'protective', label: '护短局', draftKind: 'relationship-observation' as SpectatorThreadKind },
  { id: 'occupy', label: '占有欲', draftKind: 'dangerous-charm' as SpectatorThreadKind },
  { id: 'jealousy', label: '醋坛子', draftKind: 'dangerous-charm' as SpectatorThreadKind },
  { id: 'essay', label: '短打一口', draftKind: 'romance-imagination' as SpectatorThreadKind },
  { id: 'analysis', label: '扒线复盘', draftKind: 'relationship-observation' as SpectatorThreadKind },
  { id: 'melodrama', label: '修罗场', draftKind: 'dangerous-charm' as SpectatorThreadKind },
  { id: 'rps', label: '代餐发癫', draftKind: 'romance-imagination' as SpectatorThreadKind },
  { id: 'bet', label: '押后续', draftKind: 'vote-war' as SpectatorThreadKind },
  { id: 'breakup', label: '要散没', draftKind: 'rumor-drop' as SpectatorThreadKind },
  { id: 'misread', label: '全员误读', draftKind: 'relationship-observation' as SpectatorThreadKind },
  { id: 'shipwar', label: '站反了没', draftKind: 'vote-war' as SpectatorThreadKind },
  { id: 'backstory', label: '旧糖翻新', draftKind: 'relationship-observation' as SpectatorThreadKind },
  { id: 'forbidden', label: '背德感', draftKind: 'dangerous-charm' as SpectatorThreadKind },
  { id: 'adult', label: '成年人拉扯', draftKind: 'dangerous-charm' as SpectatorThreadKind },
  { id: 'enemy', label: '宿敌味', draftKind: 'dangerous-charm' as SpectatorThreadKind },
] as const;

export const SPECTATOR_RELATIONSHIP_HINTS = [
  '同框目击',
  '护短偏心',
  '嘴硬拉扯',
  '气氛不清白',
  '双标现场',
  '熟得过界',
  '旁人视角',
  '匿名爆料',
  '聊天存疑',
  '反差失守',
  '吃醋修罗场',
  '占有欲',
  '半公开味',
  '旧账翻出',
  '对视过长',
  '动作越界',
  '代餐脑补',
  '小短文向',
  '暗糖太多',
  '照顾得太顺手',
  '默契过头',
  '日常感很重',
  '看着像已经在一起',
  '很会哄人',
  '委托里偏心',
  '嘴上嫌弃手上护着',
  '隔着人群也认得出',
  '半夜单独回头',
  '故意装不熟',
  '旧聊天记录翻出',
  '看起来像宿敌其实最懂',
  '像在偷偷养着',
  '一句话就能哄住',
  '明着吵暗里帮',
] as const;

type SpectatorContext = {
  shellLabel: string;
  shellBadge: string;
  shellAmbient: string;
  shellHooks: string[];
  targetLabel: string;
  castLine: string;
  relationshipLine: string;
  vibeLine: string;
};

export function buildDefaultSpectatorSettings(): ForumSpectatorSettings {
  return {
    subjectName: '',
    relationshipSummary: '',
    objectMode: 'user_with_characters',
    topicHint: '',
    mode: 'configured',
    threadTypes: [],
    tone: undefined,
    worldShell: undefined,
    angles: [],
    autoGenerate: false,
    selectedCharacterIds: [],
    userSlot: { mode: 'self' },
    userNameSource: 'user',
    targetCharacters: [],
    targetPresets: [],
    defaultThreadTypePool: [],
    cluePool: [],
  };
}

export function buildRandomSpectatorSettings(options: {
  currentUserName: string;
  availableCharacterNames: string[];
}): ForumSpectatorSettings {
  const { currentUserName, availableCharacterNames } = options;
  const subjectPool = buildSubjectPool(currentUserName, availableCharacterNames);
  return {
    subjectName: pickRandomOption(subjectPool) || `${currentUserName} x 某位关系户`,
    relationshipSummary: pickRandomOption(SPECTATOR_RELATIONSHIP_HINTS) || '',
    objectMode: 'user_with_characters',
    topicHint: '',
    mode: 'random',
    threadTypes: [],
    tone: pickRandomOption(SPECTATOR_TONE_OPTIONS.map((item) => item.id)),
    worldShell: pickRandomOption(SPECTATOR_WORLD_SHELL_IDS),
    angles: shuffleList(SPECTATOR_ANGLE_OPTIONS.map((item) => item.id)).slice(0, 2 + Math.floor(Math.random() * 3)),
    autoGenerate: false,
    selectedCharacterIds: [],
    userSlot: { mode: 'self' },
    userNameSource: 'user',
    targetCharacters: [],
    targetPresets: [],
    defaultThreadTypePool: [],
    cluePool: [],
  };
}

export function normalizeSpectatorTargetCharacters(settings: ForumSpectatorSettings): ForumSpectatorTargetCharacter[] {
  if (settings.targetCharacters && settings.targetCharacters.length > 0) {
    return settings.targetCharacters;
  }
  return (settings.selectedCharacterIds || []).map((characterId, index) => ({
    characterId,
    role: index === 0 ? 'primary' : 'equal',
  }));
}

export function normalizeSpectatorUserSlot(settings: ForumSpectatorSettings): ForumSpectatorUserSlot {
  return settings.userSlot || { mode: 'self' };
}

export function resolveAutoSpectatorFlavor(settings: ForumSpectatorSettings): Pick<ForumSpectatorSettings, 'tone' | 'angles'> {
  const summary = settings.relationshipSummary.trim();
  const normalized = summary.toLowerCase();
  const angles = new Set<NonNullable<ForumSpectatorSettings['angles']>[number]>();
  const shell = settings.worldShell;

  if (/同框|偶遇|目击|撞见|碰见/.test(summary)) angles.add('sighting');
  if (/护短|偏心|照顾|先护|挡|撑腰/.test(summary)) angles.add('protective');
  if (/嘴硬|不认|嘴上|装不熟|口是心非/.test(summary)) angles.add('hardmouth');
  if (/吃醋|酸|醋|修罗场/.test(summary)) angles.add('jealousy');
  if (/占有|圈住|不让|看紧|盯很紧/.test(summary)) angles.add('occupy');
  if (/匿名|爆料|听说|风声|传闻/.test(summary)) angles.add('rumor');
  if (/双标|反差|失守|破防/.test(summary)) angles.add('contrast');
  if (/代餐|脑补|短文|同人|写文/.test(summary)) angles.add('essay');
  if (/聊天|记录|截图|复盘|扒线|考据/.test(summary)) angles.add('analysis');
  if (/拉扯|危险|不清白|过界|越界/.test(summary)) angles.add('danger');
  if (/误会|误读|会错意|想太多|脑内补完/.test(summary)) angles.add('misread');
  if (/站队|买股|押|投票|站反/.test(summary)) angles.add('shipwar');
  if (/以前|之前|旧事|旧糖|前情|早就/.test(summary)) angles.add('backstory');
  if (/背德|不该|不能|有违|禁忌/.test(summary)) angles.add('forbidden');
  if (/成年人|成熟|克制|体面|分寸/.test(summary)) angles.add('adult');
  if (/宿敌|对家|死对头|针锋相对|互呛/.test(summary)) angles.add('enemy');

  if (shell === 'xianmen' || shell === 'haoMen') angles.add('forbidden');
  if (shell === 'workplace' || shell === 'agency') angles.add('adult');
  if (shell === 'esports' || shell === 'showbiz') angles.add('shipwar');
  if (shell === 'weird' || shell === 'apocalypse') angles.add('danger');

  if (angles.size === 0) {
    angles.add('observation');
    if (summary) angles.add('romance');
  }

  if (angles.has('essay')) angles.add('fiction');
  if (angles.has('analysis')) angles.add('observation');
  if (angles.has('protective') || angles.has('hardmouth') || angles.has('contrast')) angles.add('observation');
  if (angles.has('jealousy') || angles.has('occupy') || angles.has('danger')) angles.add('romance');
  if (angles.has('misread') || angles.has('backstory')) angles.add('observation');
  if (angles.has('shipwar')) angles.add('vote');
  if (angles.has('forbidden') || angles.has('adult') || angles.has('enemy')) angles.add('danger');

  const resolvedAngles = prioritizeSpectatorAngles([...angles]).slice(0, 6);
  const tone = resolveAutoSpectatorTone(summary, normalized, resolvedAngles);

  return {
    tone,
    angles: resolvedAngles,
  };
}

export function resolveSpectatorTargetLabel(options: {
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Character[];
}): string {
  const { settings, currentUserName, selectedCharacters } = options;
  const selectedById = new Map(selectedCharacters.map((character) => [character.id, character.name] as const));
  const userSlot = normalizeSpectatorUserSlot(settings);
  const objectMode: ForumSpectatorObjectMode = settings.objectMode || 'user_with_characters';
  const userLabel = userSlot.mode === 'mask' ? '面具用户' : currentUserName;
  const normalizedTargets = normalizeSpectatorTargetCharacters(settings);
  const orderedNames = normalizedTargets
    .map((target) => selectedById.get(target.characterId))
    .filter(Boolean) as string[];
  const fallbackNames = selectedCharacters.map((character) => character.name).filter(Boolean);
  const roleNames = orderedNames.length > 0 ? orderedNames : fallbackNames;

  if (objectMode === 'single_character') {
    return settings.subjectName.trim() || roleNames.join(' / ') || userLabel;
  }

  return settings.subjectName.trim() || [userLabel, ...roleNames].filter(Boolean).join(' x ');
}

export function buildSpectatorPostDrafts(options: {
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Character[];
}): SpectatorPostDraft[] {
  const context = buildSpectatorContext(options);
  const { targetLabel, relationshipLine, shellLabel, shellBadge, shellHooks, vibeLine, castLine, shellAmbient } = context;
  const selectedAngles = resolveSpectatorAngles(options.settings);
  const tone = options.settings.tone;
  const objectMode: ForumSpectatorObjectMode = options.settings.objectMode || 'user_with_characters';
  const roleNames = options.selectedCharacters.map((character) => character.name).filter(Boolean);
  const firstRole = roleNames[0] || '其中一个角色';
  const secondRole = roleNames[1] || roleNames[0] || '另一个角色';
  const rolePairLabel = roleNames.slice(0, 2).join(' x ') || targetLabel;
  const drafts: SpectatorPostDraft[] = [
    {
      kind: 'relationship-observation',
      badge: '观察楼',
      title: `${targetLabel} 这条线是不是已经明显到快装不下去了`,
      content: `${relationshipLine}${castLine}我本来还想说别想太多，但这几次看下来真的很像旁边的人已经默认他们不只是普通熟人。`,
    },
    {
      kind: 'romance-imagination',
      badge: '脑补楼',
      title: `你们别骂我先嗑，${targetLabel} 这种走向真的很像迟早要出事`,
      content: `${vibeLine}我不是说现在就能盖章，我只是觉得这种线最可怕的地方就是还没发生什么，旁边的人已经开始替他们补后续了。`,
    },
    {
      kind: 'sighting',
      badge: '目击楼',
      title: `刚在 ${shellAmbient.split('、')[0]} 那边撞见 ${targetLabel}，真的不是我一个人多想吧`,
      content: `${relationshipLine}最要命的不是他们做了多夸张的事，是周围人那种“先别说破但大家都懂”的眼神。`,
    },
    {
      kind: 'dangerous-charm',
      badge: '气质楼',
      title: `${targetLabel} 这种线是不是最容易把人带进 ${shellBadge} 式发疯`,
      content: `${vibeLine}尤其那种嘴上克制、动作先越界的感觉，会让整栋楼一边说别脑补一边继续盯。`,
    },
    {
      kind: 'rumor-drop',
      badge: '风声楼',
      title: `有人听过 ${targetLabel} 这条线后面那点风声没`,
      content: `${relationshipLine}先说我不是来锤人的，但这条线最近已经有点到“本人还没认，旁边已经开始传”的阶段了。`,
    },
    {
      kind: 'vote-war',
      badge: '站队楼',
      title: `来投一个，你们觉得 ${targetLabel} 现在更像偏心、暧昧还是已经半公开了`,
      content: `${vibeLine}这条线最有意思的点就是每个人看法都不一样，但又都觉得自己抓到了证据。`,
    },
    {
      kind: 'relationship-observation',
      badge: '复盘楼',
      title: `我来复盘一下 ${targetLabel} 最近这几次细节，真的越看越不对`,
      content: `${relationshipLine}${castLine}单看每次都能嘴硬说巧合，但连起来就已经不是普通熟人能解释的程度。`,
    },
    {
      kind: 'relationship-observation',
      badge: '旧糖楼',
      title: `旧账翻出来之后，${targetLabel} 这条线是不是从很早就不清白了`,
      content: `${vibeLine}以前被当成路过的小动作，现在回头看全都有后劲，这种旧糖最会把人搞疯。`,
    },
    {
      kind: 'romance-imagination',
      badge: '脑洞楼',
      title: `要是 ${targetLabel} 真在一起，最先装没事的会是谁`,
      content: `${relationshipLine}我不是催官宣，我只是觉得这条线一旦成真，最精彩的部分一定是他们嘴硬装普通。`,
    },
    {
      kind: 'sighting',
      badge: '路过楼',
      title: `路过 ${shellAmbient.split('、')[0]} 的时候瞟到一眼，${targetLabel} 那氛围真没法装普通`,
      content: `${relationshipLine}重点根本不是做了什么，是旁边人一看就知道自己不该继续站在那里。`,
    },
    {
      kind: 'dangerous-charm',
      badge: '背德楼',
      title: `${targetLabel} 这条线是不是自带一点不该这么熟的背德感`,
      content: `${vibeLine}最让人上头的从来不是直白，是他们明知道该收着，却还是会在关键地方失手。`,
    },
    {
      kind: 'dangerous-charm',
      badge: '宿敌楼',
      title: `有没有人懂 ${targetLabel} 这种一边互呛一边又最护对方的宿敌味`,
      content: `${relationshipLine}真宿敌最可怕的地方就是所有人都觉得他们关系差，结果出事时第一个冲出去的还是对方。`,
    },
    {
      kind: 'dangerous-charm',
      badge: '成年人楼',
      title: `${targetLabel} 这种成年人拉扯才最要命，表面体面，私下全是越界`,
      content: `${vibeLine}嘴上都很有分寸，动作却比谁都先一步，这种克制感最容易把整栋楼逼疯。`,
    },
    {
      kind: 'rumor-drop',
      badge: '风声楼',
      title: `只问一句，${targetLabel} 这条线最近是不是又有新风声了`,
      content: `${relationshipLine}不是来锤，只是感觉最近大家说话都开始带着“你懂我懂”的味道。`,
    },
    {
      kind: 'vote-war',
      badge: '买股楼',
      title: `给 ${targetLabel} 开个盘吧，这条线接下来会更甜、更疯还是直接翻车`,
      content: `${vibeLine}这类线最适合买股，因为谁都觉得自己那派马上就要赢了。`,
    },
    {
      kind: 'vote-war',
      badge: '站反楼',
      title: `认真问一句，${targetLabel} 这条线你们不会站反吧`,
      content: `${relationshipLine}我每次看这种关系都觉得大家嗑的根本不是同一口，但每一派又都有证据。`,
    },
  ];

  const filtered = selectedAngles.length
    ? drafts.filter((draft) => selectedAngles.some((angle) => angleMatchesDraft(angle, draft.kind)))
    : drafts.slice(0, 10);

  if (objectMode === 'single_character') {
    const roleByCharacterId = new Map(normalizeSpectatorTargetCharacters(options.settings).map((target) => [target.characterId, target.role] as const));
    const singleCharacterDrafts = options.selectedCharacters.flatMap((character) => {
      const role = roleByCharacterId.get(character.id) || 'equal';
      const count = resolveSingleCharacterDraftCopies(role);
      const templates: SpectatorPostDraft[] = [
        {
          kind: 'ranking-discussion',
          badge: '单人楼',
          title: `${character.name} 这个人到底是对谁都这样，还是只在特定人面前会变`,
          content: `${vibeLine}单开 ${character.name} 的时候，重点就不是“这对是不是成了”，而是这个人本身。比如他是不是对谁都嘴硬、对谁都护短，还是其实只有碰到某些人才会露出和平时完全不一样的反应。`,
        },
        {
          kind: 'relationship-observation',
          badge: '反差楼',
          title: `${character.name} 最让人上头的点是不是他只会在特定人面前先露馅`,
          content: `${character.name} 这种人最容易让楼里人越聊越上头的地方，往往不是做了多夸张的事，而是他在不同人面前反应差得太明显。对有些人冷得很稳，对另一些人却总会先停一下、先接一句、先把场子接住。`,
        },
        {
          kind: 'cp-discussion',
          badge: '嗑点楼',
          title: `${character.name} 这种人最容易让人嗑上的点，到底是护短、反差还是嘴硬`,
          content: `${vibeLine}真要给 ${character.name} 开单人嗑点楼，我更想聊的不是“他配谁”，而是“他为什么会让人忍不住嗑”。是护短太顺手，还是反差太大，还是明明嘴上撇清、行动却先露馅，这些东西单独拿出来就够楼里人盘很久。`,
        },
        {
          kind: 'multi-dynamic',
          badge: '气场楼',
          title: `${character.name} 放进关系局里最明显的其实不是谁在嗑他，是他会先对谁不一样`,
          content: `${character.name} 一旦被放进关系局里，最有意思的往往不是别人怎么看他，而是他自己会先对谁不一样。有人一靠近他就会起反应，有人一开口他就懒得装了，这种细微偏差比正面盖章更能让镜间开楼。`,
        },
      ];

      return templates.slice(0, count);
    });

    return dedupeSpectatorDrafts(singleCharacterDrafts).slice(0, 10);
  }

  filtered.push(
    {
      kind: 'cp-discussion',
      badge: 'cp楼',
      title: `${rolePairLabel} 这组到底是 cp 感重，还是大家太会脑补了`,
      content: `${relationshipLine}${castLine}我现在更想开的其实不是现场楼，而是讨论楼。不是说一定发生了什么大事，而是有些组合光是放在一起看，反应顺序、说话轻重、谁更容易先让步这种小地方就已经很有味道了。真要我说，${firstRole} 对 ${secondRole} 的耐心和对别人完全不是一个量级。`,
    },
    {
      kind: 'multi-dynamic',
      badge: '氛围楼',
      title: `${roleNames.length >= 3 ? roleNames.slice(0, 3).join(' / ') : targetLabel} 放在一个局里为什么总有种说不清的气场`,
      content: `${vibeLine}${castLine}我觉得有意思的不一定是某一对单拎出来多好嗑，而是几个人放在一起之后，整个场的温度会变。有人负责把气氛撑住，有人负责把锋芒拉高，有人明明没说多少话却会让别人的视线全偏过去。镜间这种多人楼，本来就不一定非得靠同场目击才成立。`,
    },
    {
      kind: 'ranking-discussion',
      badge: '排行楼',
      title: `${targetLabel} 这局要是排一下，谁对谁最不像普通人`,
      content: `${relationshipLine}真要我开排行楼，我最想排的不是谁最会嘴硬，而是谁在谁面前最容易露馅、谁最会先接住对方、谁平时一视同仁但偏偏对某个人标准不一样。这种楼不是靠一个现场撑起来的，是靠大家一点点把关系味读出来。`,
      linkedToPrevious: true,
    },
  );

  if (false) {
    filtered.push({
      kind: 'cp-discussion',
      badge: '嗑法楼',
      title: `${rolePairLabel} 这组更像双向拉扯，还是单边偏心`,
      content: `${vibeLine}纯角色楼最有意思的地方，就是不用硬把用户放进中心，也能单独聊出角色和角色之间的张力。真正好嗑的往往不是明牌，而是谁先让步、谁更记得对方习惯、谁最会在旁边把场子接住。`,
    });
  }

  if (false && objectMode === 'single_character') {
    filtered.push({
      kind: 'ranking-discussion',
      badge: '单人楼',
      title: `${firstRole} 这个人到底是对谁都这样，还是只在特定人面前会变`,
      content: `${vibeLine}单开一个人聊的时候，重点就不是“这对是不是成了”，而是这个人本身。比如他是不是对谁都嘴硬、是不是对谁都护短、还是其实只有碰到某些人才会露出和平时完全不一样的反应。`,
    });
  }

  if (selectedAngles.includes('fiction') || selectedAngles.includes('essay') || selectedAngles.includes('rps')) {
    filtered.push(
      {
        kind: 'romance-imagination',
        badge: '短文楼',
        title: `投一段 ${targetLabel} 的代餐短文，有人吃这种片段感吗`,
        content: `【片段】\n23:54，灯还亮着。\n${targetLabel} 谁都没说话，只是隔着一扇门站了太久。风从走廊灌进来，衣角都冷了，有人却还是没走。\n我最怕这种时刻，明明什么都没发生，却像已经把后面所有失控都提前写好。`,
      },
      {
        kind: 'romance-imagination',
        badge: '幻想楼',
        title: `【幻想日记】如果 ${targetLabel} 这条线真的被人写成楼，会先疯的是谁`,
        content: `不是正经分析，就一口代餐。\n我总觉得这条线最适合写成那种半夜发出来、第二天删掉的帖子。字不用很多，只要有人在最不该心软的时候还是回了头，这楼就已经够人反复截图了。`,
      },
    );
  }

  if (selectedAngles.includes('analysis')) {
    filtered.push({
      kind: 'relationship-observation',
      badge: '扒线楼',
      title: `扒一下 ${targetLabel} 这条线的时间线，感觉有些细节根本不是最近才开始`,
      content: `${relationshipLine}越是把零碎细节按时间排开，越会发现这条线比大家意识到的早得多。`,
    });
    filtered.push({
      kind: 'relationship-observation',
      badge: '时间线',
      title: `给 ${targetLabel} 开个简版时间线，这条线到底是从哪一步开始不对劲的`,
      content: `先不升堂，就顺一遍。\n第一次觉得不对，是有人已经开始下意识替对方留位置。\n第二次，是明明可以装没看见，却还是回头了。\n第三次之后我就不嘴硬了，这条线真的不是临时起意。`,
    });
  }

  if (selectedAngles.includes('backstory')) {
    filtered.push({
      kind: 'relationship-observation',
      badge: '旧糖楼',
      title: `旧糖重新翻出来以后，${targetLabel} 这条线像是从头到尾都有人先动心`,
      content: `${vibeLine}当时没人当回事的动作，现在回看全像提前写好的前情提要。`,
    });
  }

  if (selectedAngles.includes('misread')) {
    filtered.push({
      kind: 'relationship-observation',
      badge: '误读楼',
      title: `有没有可能 ${targetLabel} 这条线本来没那么明显，是旁边人先集体想多了`,
      content: `${relationshipLine}但问题就在于，大家会误读同一对，往往也不是毫无理由。`,
    });
  }

  if (selectedAngles.includes('protective')) {
    filtered.push({
      kind: 'relationship-observation',
      badge: '护短楼',
      title: `${targetLabel} 这条线最明显的点是不是有人护短已经护到不避人了`,
      content: `我最受不了的就是这种。\n平时还能装两句，真到有人被点名或者被怼的时候，某个人反应比谁都快。\n这种下意识最骗不了人。`,
    });
  }

  if (selectedAngles.includes('hardmouth')) {
    filtered.push({
      kind: 'relationship-observation',
      badge: '嘴硬楼',
      title: `越看 ${targetLabel} 越像那种嘴上最会撇清、行动最先露馅的线`,
      content: `最典型的就是嘴上说“没什么”，结果该回头的时候回头，该管的时候还是管。\n这种线不需要官宣，楼里人自己就能嗑起来。`,
    });
  }

  if (selectedAngles.includes('contrast')) {
    filtered.push({
      kind: 'dangerous-charm',
      badge: '双标楼',
      title: `${targetLabel} 这条线是不是已经双标到旁观的人都看出来了`,
      content: `对别人一个态度，对那个人又是另一套标准。\n最烦的是当事人自己还不一定承认，旁边的人却已经把差别待遇看得明明白白。`,
    });
  }

  if (selectedAngles.includes('jealousy')) {
    filtered.push({
      kind: 'dangerous-charm',
      badge: '吃醋楼',
      title: `说真的，${targetLabel} 这条线最近是不是已经有点吃醋味溢出来了`,
      content: `不是那种直白闹大的醋，是你站远一点看才会觉得不对。\n语气、眼神、打断别人说话的时机，越看越像有人已经开始介意了。`,
    });
  }

  if (selectedAngles.includes('occupy')) {
    filtered.push({
      kind: 'dangerous-charm',
      badge: '占有楼',
      title: `${targetLabel} 这条线最危险的地方是不是那种没说出口的占有欲`,
      content: `最可怕的从来不是把话说满，而是那种“别人可以靠近，但不能靠太近”的默认边界。\n这种边界一旦被楼里人看出来，就会越聊越疯。`,
    });
  }

  if (selectedAngles.includes('sighting')) {
    filtered.push({
      kind: 'sighting',
      badge: '现场楼',
      title: `【现场】刚刚路过 ${shellAmbient.split('、')[0]}，${targetLabel} 那一下真的让我停住了`,
      content: `不长篇大论，就记一下现场感。\n人很多，声音也杂，但他们两个站在一起的时候，周围那种突然安静半秒的感觉特别明显。\n我本来想走，结果还是回头看了第二眼。`,
    });
  }

  if (selectedAngles.includes('rumor')) {
    filtered.push({
      kind: 'rumor-drop',
      badge: '听说楼',
      title: `听说 ${targetLabel} 这条线最近又有新料了，但我不保真`,
      content: `先叠甲，不保真，只是听来的一耳朵。\n但最微妙的是，这种料每次传到最后，细节都对得上。对得上这件事本身就已经够吓人了。`,
    });
  }

  if (selectedAngles.includes('forbidden')) {
    filtered.push({
      kind: 'dangerous-charm',
      badge: '禁忌楼',
      title: `${targetLabel} 这条线最上头的地方是不是它本来就不该这么发展`,
      content: `${vibeLine}越是知道不该，越会让每次失控看起来更致命。`,
    });
  }

  if (selectedAngles.includes('enemy')) {
    filtered.push({
      kind: 'dangerous-charm',
      badge: '对家楼',
      title: `对家味最浓的往往最好嗑，${targetLabel} 这条线有人懂吗`,
      content: `${relationshipLine}平时谁都不服谁，真到关键时刻却只信对方，这口太邪门了。`,
    });
  }

  if (selectedAngles.includes('adult')) {
    filtered.push({
      kind: 'dangerous-charm',
      badge: '体面楼',
      title: `${targetLabel} 这种最折磨人的就是表面体面，私下每一步都像踩线`,
      content: `成年人拉扯最磨人就磨人在这里。\n明明每句话都留了分寸，可真要说没越界，又总觉得哪里已经过头了。`,
    });
  }

  if (selectedAngles.includes('shipwar') || selectedAngles.includes('bet')) {
    filtered.push({
      kind: 'vote-war',
      badge: '押股楼',
      title: `给 ${targetLabel} 补个押股楼，大家现在到底在买哪边`,
      content: `${vibeLine}这种线最适合打起来，因为每一派都觉得自己才是正解。`,
    });
    filtered.push({
      kind: 'vote-war',
      badge: '投票楼',
      title: `来，给 ${targetLabel} 投票：你觉得这条线现在是心照不宣、单箭头还是双向嘴硬`,
      content: `我先投双向嘴硬。\n这种线最适合开投票，不是因为真能投出答案，是因为楼里每个人都能拿出自己的证据吵三页。`,
    });
  }

  if (tone === '正经考据') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 如果认真拆细节，这条线最容易暴露的其实不是嘴上说什么，而是默认彼此会先照顾对方。`,
    }));
  }

  if (tone === '深夜不睡') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 半夜看这种线真的最容易越想越多，越盘越觉得细节早就超标了。`,
    }));
  }

  if (tone === '拉扯党' || tone === '冷脸上头') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 越是表面冷，越容易把那种没说破的拉扯感放大出来。`,
    }));
  }

  if (tone === '缺德乐子人') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 反正我先把楼盖起来，这种线不被起哄才奇怪。`,
    }));
  }

  if (tone === '嗑疯了' || tone === '代餐文学') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 我先不站太重，就先当一口细糖慢慢吃。`,
    }));
  }

  if (tone === '嘴碎路人' || tone === '半真半假') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 反正我就是顺嘴一说，但这味道真的很难当普通关系看。`,
    }));
  }

  if (tone === '押注开盘') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 要我说这楼迟早会从闲聊聊到押后续，谁都忍不住想下注。`,
    }));
  }

  if (tone === '阴暗乱嗑' || tone === '背德发作' || tone === '宿敌特供') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 反正这种线越不健康越让人忍不住继续看下去。`,
    }));
  }

  if (tone === '买冷股的' || tone === '见证文学') {
    return filtered.map((draft) => ({
      ...draft,
      content: `${draft.content} 我现在就是想先把这楼留着，等以后回来看谁才是真正押中的那一个。`,
    }));
  }

  const deduped = dedupeSpectatorDrafts(filtered);
  const linked = deduped.filter((draft) => draft.linkedToPrevious).slice(0, 2);
  const remainder = deduped.filter((draft) => !draft.linkedToPrevious);
  return [...linked, ...remainder].slice(0, 10);
}

export function resolveSpectatorAngles(settings: ForumSpectatorSettings): Array<NonNullable<ForumSpectatorSettings['angles']>[number]> {
  return settings.angles?.length ? settings.angles : [];
}

function buildSpectatorContext(options: {
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Character[];
}): SpectatorContext {
  const { settings, currentUserName, selectedCharacters } = options;
  const shellMeta = getSpectatorWorldShellMeta(resolveSpectatorWorldShell(settings.worldShell));
  const targetLabel = resolveSpectatorTargetLabel({ settings, currentUserName, selectedCharacters });
  const cast = selectedCharacters.map((character) => character.name).join('、');
  const topicLine = settings.topicHint?.trim();

  return {
    shellLabel: shellMeta.label,
    shellBadge: shellMeta.badge,
    shellAmbient: shellMeta.ambient,
    shellHooks: shellMeta.hooks,
    targetLabel,
    castLine: cast ? `相关角色里最显眼的是 ${cast}。` : '',
    relationshipLine: settings.relationshipSummary.trim()
      ? `${[topicLine, settings.relationshipSummary.trim()].filter(Boolean).join(' / ')} `
      : `${targetLabel} 最近那种说不清但又躲不开的张力，已经开始像会被人拿出来单开一栋楼了。`,
    vibeLine: `放在 ${shellMeta.label} 这种场景里，这条线特别容易被旁人先一步看出不普通。`,
  };
}

function resolveAutoSpectatorTone(
  summary: string,
  normalized: string,
  angles: Array<NonNullable<ForumSpectatorSettings['angles']>[number]>,
): ForumSpectatorSettings['tone'] {
  if (/宿敌|对家|死对头|互呛/.test(summary)) return '宿敌特供';
  if (/背德|禁忌|不该|有违/.test(summary)) return '背德发作';
  if (/见证|一路看着|从头看到尾/.test(summary)) return '见证文学';
  if (/冷门|逆家|买股|押股/.test(summary)) return '买冷股的';
  if (/匿名|爆料|传闻|风声/.test(summary)) return '半真半假';
  if (/同人|短文|代餐|写文/.test(summary)) return '代餐文学';
  if (/复盘|截图|聊天|考据|扒线/.test(summary)) return '正经考据';
  if (/吃醋|修罗场|占有|拉扯|越界/.test(summary)) return '拉扯党';
  if (/护短|偏心|双标/.test(summary)) return '嗑疯了';
  if (!summary && angles.includes('vote')) return '押注开盘';
  if (normalized.includes('夜') || normalized.includes('凌晨')) return '深夜不睡';
  if (angles.includes('forbidden') || angles.includes('enemy')) return '阴暗乱嗑';
  return '嘴碎路人';
}

function angleMatchesDraft(
  angle: NonNullable<ForumSpectatorSettings['angles']>[number],
  kind: SpectatorThreadKind,
) {
  if (angle === 'observation' || angle === 'analysis' || angle === 'hardmouth' || angle === 'protective' || angle === 'misread' || angle === 'backstory') {
    return kind === 'relationship-observation' || kind === 'multi-dynamic' || kind === 'ranking-discussion';
  }
  if (angle === 'romance' || angle === 'fiction' || angle === 'essay' || angle === 'rps') {
    return kind === 'romance-imagination' || kind === 'cp-discussion';
  }
  if (angle === 'sighting') return kind === 'sighting';
  if (angle === 'danger' || angle === 'contrast' || angle === 'occupy' || angle === 'jealousy' || angle === 'melodrama' || angle === 'forbidden' || angle === 'adult' || angle === 'enemy') {
    return kind === 'dangerous-charm';
  }
  if (angle === 'rumor' || angle === 'breakup') return kind === 'rumor-drop';
  if (angle === 'vote' || angle === 'bet' || angle === 'shipwar') return kind === 'vote-war';
  return false;
}

function dedupeSpectatorDrafts(drafts: SpectatorPostDraft[]) {
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    const key = `${draft.badge}:${draft.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function prioritizeSpectatorAngles(angles: Array<NonNullable<ForumSpectatorSettings['angles']>[number]>) {
  const priority: Array<NonNullable<ForumSpectatorSettings['angles']>[number]> = [
    'sighting',
    'protective',
    'hardmouth',
    'jealousy',
    'occupy',
    'analysis',
    'backstory',
    'misread',
    'shipwar',
    'forbidden',
    'enemy',
    'adult',
    'essay',
    'fiction',
    'rumor',
    'bet',
    'vote',
    'danger',
    'contrast',
    'melodrama',
    'romance',
    'observation',
    'rps',
    'breakup',
  ];
  return [...angles].sort((left, right) => priority.indexOf(left) - priority.indexOf(right));
}

const SPECTATOR_WORLD_SHELL_IDS = [
  'campus',
  'workplace',
  'xianmen',
  'entertainment',
  'manor',
  'starnet',
  'weird',
  'esports',
  'showbiz',
  'haoMen',
  'apocalypse',
  'agency',
] as const;

function pickRandomOption<T>(items: readonly T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function resolveSingleCharacterDraftCopies(role: ForumSpectatorTargetRole) {
  if (role === 'primary') return 4;
  if (role === 'secondary') return 2;
  return 3;
}

function shuffleList<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function buildSubjectPool(currentUserName: string, availableCharacterNames: string[]) {
  const pairs = availableCharacterNames.flatMap((name) => [
    `${currentUserName} x ${name}`,
    `${name} 单开`,
  ]);
  return [...new Set(pairs)];
}
