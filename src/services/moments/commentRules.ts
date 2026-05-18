import type { Character, ChatGroup, MomentComment, MomentItem } from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import {
  canCharacterJoinMomentThread,
  getCharacterMomentEngagementAccess,
  getMomentAutoCommentSuppressionMode,
  getCharacterPublicThreadProfile,
  inferCharacterPublicThreadRelation,
  isLikelyUserDirectedMoment,
} from './publicThreadPolicy';

type PickInitialCommentersOptions = {
  moment: MomentItem;
  characters: Character[];
  chatGroups?: ChatGroup[];
};

type PickNextResponderOptions = {
  moment: MomentItem;
  characters: Character[];
  triggerComment: MomentComment;
  recentChain: MomentComment[];
  usedAuthorIds?: string[];
  chatGroups?: ChatGroup[];
};

type ThreadReplyGuidanceOptions = {
  moment: MomentItem;
  targetComment: MomentComment;
  replyCharacter: Character;
  characters: Character[];
  userName: string;
  recentChain?: MomentComment[];
  chatGroups?: ChatGroup[];
};

export type CommentTimeMode = 'fresh' | 'same_day' | 'recent' | 'days_later' | 'stale';

export type CommentLoopContext = {
  maxDepth: number;
  timeMode: CommentTimeMode;
  audience: 'public' | 'user_directed';
};

export type CharacterRelationLevel = 'stranger' | 'aware' | 'familiar' | 'sensitive';
export type MomentSemanticAnchor =
  | 'anxious_support'
  | 'happy_share'
  | 'venting'
  | 'soft_signal'
  | 'daily_status';
export type ThreadReplyAction =
  | 'comfort'
  | 'encourage'
  | 'answer_directly'
  | 'light_tease'
  | 'support_side'
  | 'late_follow_up'
  | 'soft_close';

export type ThreadReplyGuidance = {
  semanticAnchor: MomentSemanticAnchor;
  semanticAnchorLabel: string;
  actionType: ThreadReplyAction;
  actionLabel: string;
  relationshipHint: string;
  timeHint: string;
  focusHint: string;
  joinReasonHint: string;
  styleHints: string[];
};

const POSITIVE_EMOTION_REGEX = /开心|高兴|幸福|可爱|喜欢|爱|笑死|哈哈|庆祝|快乐|满足/i;
const TENSE_EMOTION_REGEX = /生气|无语|委屈|嫉妒|吃醋|别装|阴阳|离谱|烦死|火大|服了|紧张|焦虑|压力|面试/i;
const REPLY_WORTHY_REGEX = /@|你|你们|好吧|行啊|是吗|笑死|无语|别|凭什么|又来|确实|不是|闭嘴|急了/i;
const USER_DIRECTED_MOMENT_REGEX = /你|你别|你又|给你|回来|回家|睡觉|顶嘴|记得|别到时候|别熬|听见没|少吃|多喝|先去|别闹|喊我|陪我/i;
const DIRECT_REPLY_TARGET_REGEX = /@|你|你们|哥哥|姐姐|对象|别听|少管|闭嘴|你先|你来|你就|你也/i;
const DRIFT_BANTER_REGEX = /火锅|加肉|请客|吃饭|账单|下馆子|带你去吃|多加一份|哪顿|宵夜|烤肉/i;
const SUPPORT_CHAIN_REGEX = /紧张|放轻松|别慌|稳住|加油|没事|面试|通过|安心|别怕|你行|别急/i;
const HAPPY_CHAIN_REGEX = /恭喜|开心|高兴|幸福|甜|不错|真好|祝福|酸了|笑死/i;
const VENT_CHAIN_REGEX = /烦|累|无语|离谱|服了|气|别理|辛苦|活该|少来|又来/i;
const SOFT_SIGNAL_REGEX = /想|等你|陪|想见|惦记|想你|挂念|梦里|回来|看得到/i;

const RELATION_PATTERNS = {
  romantic: [/男朋友/i, /女朋友/i, /恋人/i, /伴侣/i, /老婆/i, /老公/i, /未婚夫/i, /未婚妻/i, /对象/i],
  family: [/家人/i, /亲人/i, /姐姐/i, /妹妹/i, /哥哥/i, /弟弟/i, /妈妈/i, /爸爸/i, /母亲/i, /父亲/i],
  protective: [/护着你/i, /照顾你/i, /守着你/i, /保护你/i, /偏心/i, /管你/i],
  close: [/喜欢你/i, /青梅/i, /竹马/i, /发小/i, /宝贝/i, /朋友/i],
};

function shuffleCharacters(characters: Character[]) {
  return [...characters].sort(() => Math.random() - 0.5);
}

function getCharacterText(character: Character) {
  const characterContext = buildCharacterContext({ character });
  return [
    characterContext.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
  ]
    .filter(Boolean)
    .join('\n');
}

function getCharacterRelationSignalsToUser(character: Character) {
  const sourceText = getCharacterText(character);
  return {
    romantic: RELATION_PATTERNS.romantic.some((pattern) => pattern.test(sourceText)),
    family: RELATION_PATTERNS.family.some((pattern) => pattern.test(sourceText)),
    protective: RELATION_PATTERNS.protective.some((pattern) => pattern.test(sourceText)),
    close: RELATION_PATTERNS.close.some((pattern) => pattern.test(sourceText)),
  };
}

function getCharacterUserRelationStrength(character: Character) {
  const signals = getCharacterRelationSignalsToUser(character);
  return Object.values(signals).filter(Boolean).length;
}

function getParticipationWeight(character: Character, moment: MomentItem) {
  let weight = 1;
  const personaText = [
    character.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  const momentText = moment.content.toLowerCase();

  if (/毒舌|爱接梗|爱吐槽|阴阳|较真|占有|护短|张扬|外向|嘴硬/.test(personaText)) {
    weight += 0.7;
  }
  if (/安静|克制|寡言|冷淡|慢热/.test(personaText)) {
    weight -= 0.35;
  }
  if (POSITIVE_EMOTION_REGEX.test(momentText) && /甜|温柔|浪漫|热烈/.test(personaText)) {
    weight += 0.35;
  }
  if (TENSE_EMOTION_REGEX.test(momentText) && /毒舌|护短|强势|别扭|占有/.test(personaText)) {
    weight += 0.45;
  }

  return Math.max(weight, 0.2);
}

function pickWeightedCharacter(candidates: Array<{ character: Character; weight: number }>) {
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return candidates[0]?.character || null;
  }

  let threshold = Math.random() * totalWeight;
  for (const candidate of candidates) {
    threshold -= candidate.weight;
    if (threshold <= 0) {
      return candidate.character;
    }
  }

  return candidates[candidates.length - 1]?.character || null;
}

export function inferMomentAudience(moment: MomentItem, characters: Character[], _chatGroups: ChatGroup[] = []) {
  if (moment.authorId === 'user') {
    return 'public' as const;
  }

  const author = characters.find((character) => character.id === moment.authorId);
  if (!author) {
    return 'public' as const;
  }

  return isLikelyUserDirectedMoment({
    momentContent: moment.content,
    author,
  }) ? 'user_directed' : 'public';
}

function getMomentAgeHours(moment: MomentItem) {
  return Math.max((Date.now() - moment.timestamp) / (1000 * 60 * 60), 0);
}

export function buildCommentLoopContext(moment: MomentItem, characters: Character[], chatGroups: ChatGroup[] = []): CommentLoopContext {
  const ageHours = getMomentAgeHours(moment);
  const audience = inferMomentAudience(moment, characters, chatGroups);

  const timeMode: CommentTimeMode =
    ageHours <= 2
      ? 'fresh'
      : ageHours <= 12
        ? 'same_day'
        : ageHours <= 48
          ? 'recent'
          : ageHours <= 7 * 24
            ? 'days_later'
            : 'stale';

  return {
    timeMode,
    audience,
    maxDepth:
      timeMode === 'fresh'
        ? 3
        : timeMode === 'same_day'
          ? 2
          : timeMode === 'recent'
            ? 2
            : 1,
  };
}

export function getCharacterRelationLevel(left: Character, right: Character, chatGroups: ChatGroup[] = []): CharacterRelationLevel {
  return inferCharacterPublicThreadRelation(left, right, chatGroups);
}

function getRelationWeight(level: CharacterRelationLevel) {
  switch (level) {
    case 'sensitive':
      return 0.72;
    case 'familiar':
      return 1.08;
    case 'aware':
      return 0.5;
    case 'stranger':
    default:
      return 0.14;
  }
}

function hasDirectHookForCharacter(triggerComment: MomentComment, target: Character) {
  if (triggerComment.replyToAuthorId === target.id || triggerComment.authorId === target.id) {
    return true;
  }

  const aliases = [target.name, target.remarkName]
    .filter(Boolean)
    .map((value) => value!.trim())
    .filter(Boolean);

  if (DIRECT_REPLY_TARGET_REGEX.test(triggerComment.content)) {
    return true;
  }

  return aliases.some((alias) => triggerComment.content.includes(alias));
}

export function inferMomentSemanticAnchor(content: string): MomentSemanticAnchor {
  const text = content.trim();
  if (!text) return 'daily_status';
  if (/紧张|焦虑|面试|通过|三面|考试|希望|别挂|压力|发抖/.test(text)) return 'anxious_support';
  if (/开心|幸福|恭喜|终于|好耶|甜|圆满|顺利|庆祝|喜欢/.test(text)) return 'happy_share';
  if (/烦|累|无语|离谱|服了|火大|崩溃|顶嘴|吵|骂|受不了|工位|加班/.test(text)) return 'venting';
  if (/想|陪|等你|梦里|惦记|想你|回来|看得到|能被召唤/.test(text)) return 'soft_signal';
  return 'daily_status';
}

function getAnchorLabel(anchor: MomentSemanticAnchor) {
  switch (anchor) {
    case 'anxious_support':
      return '这层楼的主线是紧张、焦虑、求稳住或求通过。';
    case 'happy_share':
      return '这层楼的主线是开心、分享、祝福或轻松起哄。';
    case 'venting':
      return '这层楼的主线是吐槽、发泄、抱怨或护短。';
    case 'soft_signal':
      return '这层楼的主线是暧昧、惦记、别扭关心或轻微试探。';
    case 'daily_status':
    default:
      return '这层楼的主线是围绕动态本身顺手接一句，不要自顾自开新话题。';
  }
}

function getAnchorGuardRegex(anchor: MomentSemanticAnchor) {
  switch (anchor) {
    case 'anxious_support':
      return SUPPORT_CHAIN_REGEX;
    case 'happy_share':
      return HAPPY_CHAIN_REGEX;
    case 'venting':
      return VENT_CHAIN_REGEX;
    case 'soft_signal':
      return SOFT_SIGNAL_REGEX;
    case 'daily_status':
    default:
      return /./;
  }
}

function isLikelyOffTopicChain(moment: MomentItem, recentChain: MomentComment[]) {
  if (recentChain.length < 2) return false;

  const anchor = inferMomentSemanticAnchor(moment.content);
  const guardRegex = getAnchorGuardRegex(anchor);
  const recentText = recentChain.slice(-2).map((comment) => comment.content).join('\n');

  if (anchor !== 'daily_status' && !guardRegex.test(recentText) && DRIFT_BANTER_REGEX.test(recentText)) {
    return true;
  }

  const distinctAuthors = new Set(recentChain.slice(-3).map((comment) => comment.authorId)).size;
  return anchor !== 'daily_status' && distinctAuthors >= 3 && !guardRegex.test(recentText);
}

function getTimeHint(context: CommentLoopContext) {
  switch (context.timeMode) {
    case 'same_day':
      return '这是今天稍早前发的动态，能自然接，但别写得像秒回贴脸连聊。';
    case 'recent':
      return '这条动态已经过了一阵，语气可以自然，但要有一点“现在才接上”的感觉。';
    case 'days_later':
      return '这是几天后再来回应，要像补看、迟到回复或轻轻翻一下旧账，不要写成实时现场。';
    case 'stale':
      return '这是更久之前的旧动态，只适合很短地补一句，像隔了很久才想起回。';
    case 'fresh':
    default:
      return '这是较新的动态，允许顺着动态气氛自然接一句，但仍然要像评论区。';
  }
}

function getRelationshipHint(
  replyCharacter: Character,
  targetCharacter: Character | null,
  momentAuthor: Character | null,
  chatGroups: ChatGroup[] = [],
) {
  if (!targetCharacter) {
    if (momentAuthor && momentAuthor.id !== replyCharacter.id) {
      const relation = getCharacterRelationLevel(replyCharacter, momentAuthor, chatGroups);
      const profile = getCharacterPublicThreadProfile(replyCharacter, momentAuthor, chatGroups);
      if (relation === 'sensitive') {
        return '你和动态作者都可能围着同一个人产生张力，但这不代表你们彼此很熟。只允许很短地酸一句或收一句，不能替对方认领、替对方做主，也别说得像默认同一阵线。';
      }
      if (relation === 'familiar') {
        if (!profile.allowIntimateTone) {
          return '你和动态作者确实比较熟，能自然接一句，但你们这层熟不等于能说亲密话。保持熟人感即可，不要写成暧昧私聊或贴脸亲昵。';
        }
        return '你和动态作者确实比较熟，能自然接一句，也允许一点熟人感，但仍然是公开评论区，不要变成你们自己的小窗。';
      }
      if (relation === 'aware') {
        return '你和动态作者只是知道彼此，最多顺着场合接一句，别突然亲密，也别替对方认领什么。';
      }
      if (profile.userOverlap !== 'none') {
        return '你和动态作者都可能因为同一个人多看彼此两眼，但你们彼此并不熟，所以最多轻轻收一句，不要演成共同占位或熟人拌嘴。';
      }
    }
    return '你是在公开评论区顺手接一句，不要突然摆出私聊口气。';
  }

  const relation = getCharacterRelationLevel(replyCharacter, targetCharacter, chatGroups);
  const profile = getCharacterPublicThreadProfile(replyCharacter, targetCharacter, chatGroups);
  switch (relation) {
    case 'sensitive':
      return '你和对方在用户关系链上有点敏感张力，但不等于你们彼此很熟。可以短短较劲、阴阳或收一下话头，禁止用占有、接人、抱走、乖乖等着这类越界口气。';
    case 'familiar':
      if (!profile.allowIntimateTone) {
        return '你和对方确实算熟，可以自然回一句，也可以有一点熟人互动，但别突然说亲密话，更不要写成暧昧或长期私聊。';
      }
      return '你和对方确实算熟，能自然回一句，也允许轻微互动，但仍然要围绕动态主线，不要聊成你们自己的小窗。';
    case 'aware':
      return '你和对方只是知道彼此，说话别太像老熟人，更不要默认你能替对方表态、接人或站位。';
    case 'stranger':
    default:
      if (profile.userOverlap !== 'none') {
        return '你和对方其实并不熟，只是都可能因为同一个人而有点在意，所以只能非常克制地接一下，不能说成暧昧打趣或共同占位。';
      }
      return '你和对方不算熟，这一句要克制，更多是顺着场合回应，不要过分亲昵或长篇互怼。';
  }
}

function getJoinReasonHint(options: {
  moment: MomentItem;
  replyCharacter: Character;
  targetCharacter: Character | null;
  momentAuthor: Character | null;
  targetComment: MomentComment;
  chatGroups?: ChatGroup[];
}) {
  const { moment, replyCharacter, targetCharacter, momentAuthor, targetComment, chatGroups = [] } = options;
  const anchor = inferMomentSemanticAnchor(moment.content);

  if (targetCharacter && hasDirectHookForCharacter(targetComment, replyCharacter)) {
    return `你这次下场，是因为这句评论明显接到了你或点到了你。`;
  }

  if (momentAuthor && replyCharacter.id === momentAuthor.id) {
    return '你这次下场，是因为你是动态作者，适合顺手接住这层楼。';
  }

  if (targetCharacter) {
    const relation = getCharacterRelationLevel(replyCharacter, targetCharacter, chatGroups);
    const profile = getCharacterPublicThreadProfile(replyCharacter, targetCharacter, chatGroups);
    if (relation === 'sensitive') {
      return '你这次下场，不是因为你和对方很熟，而是这句刚好戳到你或让你有点在意，所以只能短短接一下。';
    }
    if (relation === 'familiar') {
      return '你这次下场，是因为你和当前楼层人物本来就比较熟，这句你接得上。';
    }
    if (profile.userOverlap !== 'none') {
      return '你这次下场，不是因为你和对方熟，而是这句让你有点在意，所以只适合克制地露一下态度。';
    }
  }

  if (anchor === 'anxious_support') {
    return '你这次下场，是因为这条动态的情绪点很明确，更适合来一句安慰或打气。';
  }
  if (anchor === 'venting') {
    return '你这次下场，是因为这条动态本身带情绪，适合顺着护一句或接一句吐槽。';
  }
  if (anchor === 'happy_share') {
    return '你这次下场，是因为这条动态偏分享和庆祝，适合轻轻接一句。';
  }

  return '你这次下场，只是顺着当前楼层补一句，所以要更短、更克制。';
}

function inferThreadReplyAction(options: {
  moment: MomentItem;
  targetComment: MomentComment;
  replyCharacter: Character;
  targetCharacter: Character | null;
  recentChain: MomentComment[];
  chatGroups?: ChatGroup[];
}) {
  const { moment, targetComment, replyCharacter, targetCharacter, recentChain, chatGroups = [] } = options;
  const anchor = inferMomentSemanticAnchor(moment.content);
  const context = buildCommentLoopContext(moment, targetCharacter ? [replyCharacter, targetCharacter] : [replyCharacter], chatGroups);
  const peerProfile = targetCharacter
    ? getCharacterPublicThreadProfile(replyCharacter, targetCharacter, chatGroups)
    : null;

  if (context.timeMode === 'days_later' || context.timeMode === 'stale') return 'late_follow_up';
  if (recentChain.length >= 2) return 'soft_close';
  if (anchor === 'anxious_support') return targetComment.authorId === moment.authorId ? 'comfort' : 'encourage';
  if (anchor === 'happy_share') return peerProfile?.allowBanter ? 'light_tease' : 'answer_directly';
  if (anchor === 'venting') return targetComment.authorId === moment.authorId ? 'support_side' : 'answer_directly';
  if (targetCharacter && targetCharacter.id !== moment.authorId && replyCharacter.id === moment.authorId) return 'answer_directly';
  return 'answer_directly';
}

function getActionLabel(actionType: ThreadReplyAction) {
  switch (actionType) {
    case 'comfort':
      return '这句要偏安慰、接住情绪、帮对方稳住。';
    case 'encourage':
      return '这句要偏打气、鼓劲、顺着主楼给一点支撑。';
    case 'light_tease':
      return '这句可以轻轻接梗或调侃，但别把楼带偏。';
    case 'support_side':
      return '这句更像护短、站位或顺着吐槽接一句。';
    case 'late_follow_up':
      return '这句是隔一阵后补回，要有时间差感，不要像实时连聊。';
    case 'soft_close':
      return '这句更适合收一收，让楼自然停住，不要再开新分支。';
    case 'answer_directly':
    default:
      return '这句要直接回应当前这条评论，不要借机转去聊别的话。';
  }
}

export function buildThreadReplyGuidance(options: ThreadReplyGuidanceOptions): ThreadReplyGuidance {
  const { moment, targetComment, replyCharacter, characters, userName, recentChain = [], chatGroups = [] } = options;
  const context = buildCommentLoopContext(moment, characters, chatGroups);
  const semanticAnchor = inferMomentSemanticAnchor(moment.content);
  const targetCharacter = targetComment.authorId === 'user'
    ? null
    : characters.find((character) => character.id === targetComment.authorId) || null;
  const momentAuthor = moment.authorId === 'user'
    ? null
    : characters.find((character) => character.id === moment.authorId) || null;
  const actionType = inferThreadReplyAction({
    moment,
    targetComment,
    replyCharacter,
    targetCharacter,
    recentChain,
    chatGroups,
  });
  const targetName = targetComment.authorId === 'user'
    ? userName
    : targetCharacter?.name || targetComment.replyToAuthorName || '对方';

  const focusHint = targetComment.replyToCommentId
    ? `你现在主要是在接 ${targetName} 这条评论，但仍然要服务整条动态的主线。`
    : `你现在是在评论区接 ${targetName} 刚刚这句，别把注意力从动态正文带跑。`;

  const joinReasonHint = getJoinReasonHint({
    moment,
    replyCharacter,
    targetCharacter,
    momentAuthor,
    targetComment,
    chatGroups,
  });

  const styleHints = [
    getAnchorLabel(semanticAnchor),
    getActionLabel(actionType),
    focusHint,
    getTimeHint(context),
    joinReasonHint,
    '评论区不是群聊窗口，只顺手接一句或两句，不要自顾自开新话题。',
    '如果能接住动态情绪，就优先接情绪；如果只是和别的角色玩梗，就宁可收住。',
    '如果你和楼里的人不熟，不要用亲昵称呼、共同占位、替别人做主或默认你们是一伙的。',
    '除非你就是动态作者本人，否则不要说“领走、带走、抱走、收到人了、乖乖等着、我的人”这类占位话。',
  ];

  const peerProfile = targetCharacter
    ? getCharacterPublicThreadProfile(replyCharacter, targetCharacter, chatGroups)
    : momentAuthor && momentAuthor.id !== replyCharacter.id
      ? getCharacterPublicThreadProfile(replyCharacter, momentAuthor, chatGroups)
      : null;

  if (peerProfile) {
    if (!peerProfile.allowBanter) {
      styleHints.push('你和这层楼里的人不适合互怼玩梗，宁可收短一点，也不要写成熟人拌嘴。');
    }
    if (!peerProfile.allowIntimateTone) {
      styleHints.push('不要用亲昵语气、私下昵称或像恋人/长期暧昧那样的说法。');
    }
    if (peerProfile.interactionStyle === 'guarded') {
      styleHints.push('你们彼此更偏克制，说话留一点距离感。');
    }
    if (peerProfile.interactionStyle === 'warm' && peerProfile.familiarity === 'familiar') {
      styleHints.push('允许一点自然熟人感，但仍然先服务动态主线，不要越聊越私。');
    }
    if (peerProfile.note?.trim()) {
      styleHints.push(`补充关系备注：${peerProfile.note.trim()}`);
    }
  }

  return {
    semanticAnchor,
    semanticAnchorLabel: getAnchorLabel(semanticAnchor),
    actionType,
    actionLabel: getActionLabel(actionType),
    relationshipHint: getRelationshipHint(replyCharacter, targetCharacter, momentAuthor, chatGroups),
    timeHint: getTimeHint(context),
    focusHint,
    joinReasonHint,
    styleHints,
  };
}

export function getMomentAutoCommentTargetCount(moment: MomentItem, characters: Character[], chatGroups: ChatGroup[] = []) {
  if (characters.length <= 1) return characters.length;

  const context = buildCommentLoopContext(moment, characters, chatGroups);
  const suppressionMode = getMomentAutoCommentSuppressionMode(moment, characters, chatGroups);
  if (suppressionMode === 'full_block') return 0;
  if (context.timeMode === 'days_later' || context.timeMode === 'stale') return 0;
  if (suppressionMode === 'limit_third_party') return Math.min(characters.length, 1);
  if (context.audience === 'user_directed') return 0;
  if (moment.authorId !== 'user' && inferMomentSemanticAnchor(moment.content) === 'soft_signal') return 0;
  if (moment.authorId === 'user') return Math.min(characters.length, Math.random() < 0.68 ? 1 : 2);
  return Math.min(characters.length, Math.random() < 0.62 ? 2 : 3);
}

export function pickInitialCommenters(options: PickInitialCommentersOptions) {
  const { moment, characters, chatGroups = [] } = options;
  const context = buildCommentLoopContext(moment, characters, chatGroups);
  const suppressionMode = getMomentAutoCommentSuppressionMode(moment, characters, chatGroups);
  if (context.timeMode === 'days_later' || context.timeMode === 'stale') {
    return [];
  }
  if (suppressionMode === 'full_block') {
    return [];
  }
  if (context.audience === 'user_directed' && suppressionMode === 'none') {
    return [];
  }

  const eligibleCharacters = characters
    .filter((character) => character.id !== moment.authorId)
    .map((character) => ({
      character,
      engagementAccess: getCharacterMomentEngagementAccess({
        actor: character,
        moment,
        characters,
        chatGroups,
      }),
    }))
    .filter((entry) => entry.engagementAccess.canTopLevelComment);
  const targetCount = getMomentAutoCommentTargetCount(moment, characters, chatGroups);
  if (targetCount <= 0) return [];
  const momentAuthor = moment.authorId === 'user'
    ? null
    : characters.find((character) => character.id === moment.authorId) || null;

  const weightedPool = [...eligibleCharacters]
    .sort(() => Math.random() - 0.5)
    .map(({ character, engagementAccess }) => ({
      character,
      commentMode: engagementAccess.commentMode,
      weight: (() => {
        let weight = getParticipationWeight(character, moment);
        const relationProfile = momentAuthor
          ? getCharacterPublicThreadProfile(character, momentAuthor, chatGroups)
          : null;
        if (momentAuthor) {
          if (relationProfile.familiarity === 'familiar') weight += 0.42;
          if (relationProfile.familiarity === 'aware') weight += 0.16;
          if (relationProfile.familiarity === 'stranger') weight -= 0.12;
          if (relationProfile.userOverlap === 'shared_claim' && relationProfile.familiarity === 'stranger') weight -= 0.18;
        }
        if (engagementAccess.commentMode === 'limited') {
          weight -= 0.38;
          if (relationProfile?.hasDirectReplyHistory || relationProfile?.hasMomentGrowthHint) {
            weight += 0.12;
          }
        }
        if (suppressionMode === 'limit_third_party') {
          if (engagementAccess.commentMode === 'limited') {
            weight -= 0.2;
          }
          if (relationProfile?.familiarity === 'familiar') {
            weight += 0.08;
          }
        }
        return Math.max(weight, 0.08);
      })(),
    }));

  const picked: Character[] = [];
  const usedIds = new Set<string>();
  const reserveLimitedSeat = (
    suppressionMode === 'none'
    && context.audience === 'public'
    && moment.authorId !== 'user'
    && targetCount >= 2
    && weightedPool.some((item) => item.commentMode === 'limited')
    && weightedPool.some((item) => item.commentMode === 'normal')
  );

  if (reserveLimitedSeat) {
    const limitedPick = pickWeightedCharacter(
      weightedPool
        .filter((item) => item.commentMode === 'limited')
        .map((item) => ({ character: item.character, weight: item.weight })),
    );
    if (limitedPick) {
      picked.push(limitedPick);
      usedIds.add(limitedPick.id);
    }
  }

  while (picked.length < targetCount) {
    const next = pickWeightedCharacter(weightedPool.filter((item) => !usedIds.has(item.character.id)));
    if (!next) break;
    picked.push(next);
    usedIds.add(next.id);
  }

  return picked;
}

export function shouldTriggerFollowUpReply(
  moment: MomentItem,
  triggerComment: MomentComment,
  currentDepth: number,
  characters: Character[],
  recentChain: MomentComment[] = [],
  chatGroups: ChatGroup[] = [],
) {
  const context = buildCommentLoopContext(moment, characters, chatGroups);
  const suppressionMode = getMomentAutoCommentSuppressionMode(moment, characters, chatGroups);
  if (currentDepth >= context.maxDepth) return false;
  if ((context.timeMode === 'days_later' || context.timeMode === 'stale') && currentDepth >= 1) return false;
  if (isLikelyOffTopicChain(moment, recentChain)) return false;
  if (
    suppressionMode === 'full_block'
    && triggerComment.authorId !== 'user'
    && triggerComment.authorId !== moment.authorId
  ) {
    return false;
  }
  if (
    suppressionMode === 'limit_third_party'
    && new Set(recentChain.map((comment) => comment.authorId).filter((authorId) => authorId !== 'user')).size >= 2
    && !recentChain.some((comment) => comment.authorId === 'user')
  ) {
    return false;
  }

  const text = `${moment.content}\n${triggerComment.content}`.trim();
  let chance = moment.authorId === 'user' ? 0.42 : 0.6;

  if (context.audience === 'user_directed') chance -= 0.22;
  if (context.timeMode === 'same_day') chance -= 0.05;
  if (context.timeMode === 'recent') chance -= 0.12;
  if (context.timeMode === 'days_later') chance -= 0.28;
  if (context.timeMode === 'stale') chance -= 0.4;
  if (POSITIVE_EMOTION_REGEX.test(text)) chance += 0.05;
  if (TENSE_EMOTION_REGEX.test(text)) chance += 0.12;
  if (REPLY_WORTHY_REGEX.test(triggerComment.content)) chance += 0.12;
  if (triggerComment.replyToCommentId) chance += 0.04;
  if (recentChain.length >= 2) chance -= 0.18;
  if (suppressionMode === 'limit_third_party') {
    if (triggerComment.authorId !== moment.authorId) chance -= 0.08;
    if (recentChain.length >= 2 && !recentChain.some((comment) => comment.authorId === 'user')) {
      chance -= 0.28;
    }
  }

  return Math.random() < Math.min(Math.max(chance, 0), 0.85);
}

export function pickNextResponder(options: PickNextResponderOptions) {
  const { moment, characters, triggerComment, recentChain, usedAuthorIds = [], chatGroups = [] } = options;
  const context = buildCommentLoopContext(moment, characters, chatGroups);
  const blockedIds = new Set<string>(usedAuthorIds);
  const suppressionMode = getMomentAutoCommentSuppressionMode(moment, characters, chatGroups);

  const triggerAuthor = characters.find((character) => character.id === triggerComment.authorId) || null;
  const targetAuthor = triggerComment.replyToAuthorId
    ? characters.find((character) => character.id === triggerComment.replyToAuthorId) || null
    : null;

  const candidates = characters.filter((character) => !blockedIds.has(character.id));
  if (candidates.length === 0) return null;

  const weightedCandidates = candidates
    .map((character) => {
      if (!canCharacterJoinMomentThread({
        actor: character,
        moment,
        characters,
        chatGroups,
        triggerComment,
      })) {
        return null;
      }

      const engagementAccess = getCharacterMomentEngagementAccess({
        actor: character,
        moment,
        characters,
        chatGroups,
      });
      let weight = getParticipationWeight(character, moment);
      const hooked = hasDirectHookForCharacter(triggerComment, character);

      if (character.id === moment.authorId) weight += 0.45;
      if (recentChain.length === 1 && character.id === moment.authorId && triggerComment.authorId !== moment.authorId) {
        weight += 0.38;
      }
      if (engagementAccess.commentMode === 'limited') {
        weight -= 0.42;
        if (hooked) weight += recentChain.length <= 1 ? 0.56 : 0.24;
      }
      if (triggerComment.authorId === 'user' && character.id === moment.authorId) {
        weight += 1.1;
      }
      if (triggerComment.authorId === 'user' && character.id !== moment.authorId) {
        weight -= 0.2;
      }
      if (targetAuthor) weight += getRelationWeight(getCharacterRelationLevel(character, targetAuthor, chatGroups));
      if (triggerAuthor) weight += getRelationWeight(getCharacterRelationLevel(character, triggerAuthor, chatGroups)) * 0.65;
      if (hooked) weight += 0.95;

      if (recentChain.slice(-2).some((comment) => comment.authorId === character.id)) {
        weight -= 0.9;
      }

      if (context.audience === 'user_directed' && character.id !== moment.authorId && !hooked) {
        weight -= 1.1;
      }
      if (context.timeMode === 'recent' && character.id !== moment.authorId && !hooked) {
        weight -= 0.15;
      }
      if ((context.timeMode === 'days_later' || context.timeMode === 'stale') && character.id !== moment.authorId) {
        weight -= 0.65;
      }
      if (recentChain.length >= 2 && !hooked) {
        weight -= 0.35;
      }

      const relationToTrigger = triggerAuthor ? getCharacterRelationLevel(character, triggerAuthor, chatGroups) : 'stranger';
      const relationToTarget = targetAuthor ? getCharacterRelationLevel(character, targetAuthor, chatGroups) : 'stranger';
      const canThirdPartyJoin =
        character.id === moment.authorId
        || hooked
        || relationToTrigger === 'familiar'
        || relationToTarget === 'familiar';

      if (recentChain.length >= 1 && !canThirdPartyJoin) {
        weight -= 0.85;
      }

      if (suppressionMode === 'full_block' && character.id !== moment.authorId && !hooked) {
        weight -= 1.4;
      }
      if (suppressionMode === 'limit_third_party') {
        if (character.id === moment.authorId) {
          weight += 0.68;
        } else if (!hooked) {
          weight -= 0.9;
          if (recentChain.length >= 1) {
            weight -= 0.38;
          }
        }
      }
      if (relationToTrigger === 'sensitive' && !hooked && character.id !== moment.authorId) {
        weight -= 0.28;
      }
      if (relationToTarget === 'sensitive' && !hooked && character.id !== moment.authorId) {
        weight -= 0.22;
      }

      return { character, weight: Math.max(weight, 0.01) };
    })
    .filter((item): item is { character: Character; weight: number } => Boolean(item && item.weight > 0.02));

  return pickWeightedCharacter(weightedCandidates);
}
