import type { ForumChannel, ForumContentTier, ForumThreadType } from '../../features/forum-domain/types';

const TIER_LABELS: Record<ForumContentTier, string> = {
  baseline: '底噪层',
  ferment: '发酵层',
  highlight: '高光层',
  fragment: '片段层',
};

const HIGHLIGHT_CHANNEL_BIASES: Partial<Record<ForumChannel, string[]>> = {
  present: ['嘴硬但超在意', '关系判断帖里的嘴硬人', '正经求助格式包着离谱关系'],
  junction: ['跨区热题的站队楼', '一句话定义整栋楼的乐子楼', '匿名区半真半假的热瓜'],
  weird: ['规则怪谈里看起来离谱却有人当真的楼', '夜里重看味道更重的热楼'],
  cyber: ['权限和流程包着的私心楼', '白名单和提醒味太私人的高热楼'],
  dreamStation: ['梦里承认醒来嘴硬的拉扯楼', '半夜代餐和错站感很强的楼'],
  beastPlain: ['把关系写成本能和领地的错位楼', '把人写成猎物或同伴的争抢楼'],
};

const THREAD_TIER_HINTS: Record<ForumContentTier, string[]> = {
  baseline: [
    '像真论坛里会稳定出现的普通楼，不追求每条都爆。',
    '重点是像活人顺手发出来，有具体处境和论坛口气，不要像总结。',
  ],
  ferment: [
    '这类楼要留出争议点和站队空间，让评论区自己长。',
    '正文要能把人引到同一个冲突点，但不要把话说死。',
  ],
  highlight: [
    '这类楼是首页里的高光楼，标题和第一段必须一眼抓人。',
    '允许更强钩子、更鲜明角度、更容易被复读的定义句，但仍然像论坛帖。',
  ],
  fragment: [
    '这类楼不是 prose 练笔，而是论坛里顺手发的一截片段、脑补或代餐。',
    '要短、留白、好接话，不要完整展开起承转合。',
  ],
};

function randomIndex(seed: string, length: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
}

export function getForumContentTierLabel(tier: ForumContentTier) {
  return TIER_LABELS[tier];
}

export function inferForumContentTier(threadType: ForumThreadType, title = '', body = ''): ForumContentTier {
  const text = `${title} ${body}`;
  if (threadType === 'essay') return body.trim().length >= 380 ? 'baseline' : 'fragment';
  if (threadType === 'vote' || threadType === 'reversal' || threadType === 'sameTopic' || threadType === 'rift') {
    return 'ferment';
  }
  if (
    threadType === 'commission'
    || threadType === 'help'
    || threadType === 'timeline'
    || threadType === 'sighting'
    || threadType === 'ownerUpdate'
  ) {
    return 'baseline';
  }

  if (/当狗|狗塑|猫塑|捡到|怎么劝|在线等|让我来|BOSS|野人|人类/u.test(text)) {
    return 'highlight';
  }

  return 'baseline';
}

export function buildForumBatchTierPlan(channel: ForumChannel, count: number): ForumContentTier[] {
  const plan: ForumContentTier[] = ['baseline', 'ferment'];
  if (count >= 3) {
    plan.push('highlight');
  }
  if (count >= 4) {
    plan.push('fragment');
  }
  if (channel === 'dreamStation' || channel === 'xianmen') {
    plan.push('fragment');
  }
  if (channel === 'junction' || channel === 'present' || channel === 'weird' || channel === 'cyber') {
    plan.push('highlight');
  }
  return plan.slice(0, Math.max(3, Math.min(count + 1, plan.length)));
}

export function buildForumContentTierPromptBlock(channel: ForumChannel, count: number) {
  const plan = Array.from(new Set(buildForumBatchTierPlan(channel, count)));
  const mustHave = plan.slice(0, Math.min(plan.length, Math.max(3, count >= 4 ? 4 : 3)));

  return [
    '## 内容层级要求',
    `本轮帖子不是同一种强度，至少要自然覆盖这些层：${mustHave.map((tier) => getForumContentTierLabel(tier)).join('、')}`,
    ...mustHave.map((tier) => `- ${getForumContentTierLabel(tier)}：${THREAD_TIER_HINTS[tier].join(' ')}`),
    '高光层只占一部分，不要整批都像截图体；底噪层也不能写成没劲的概述文。',
    '片段层必须短，发酵层必须留争议，底噪层必须像真论坛日常，高光层必须有抓手。',
  ].join('\n');
}

export function inferForumDiscourseAxis(threadType: ForumThreadType, channel: ForumChannel, title: string, body: string) {
  const text = `${title} ${body}`;

  if (/当狗|狗塑|让我来/u.test(text)) return '楼主把关系说成上岗抢位，评论区容易围绕“谁更像狗”发酵';
  if (/猫塑|野人|人类|捡到|收留/u.test(text)) return '关系错位是核心，评论区会围绕“谁在养谁、谁被拟态”展开';
  if (/BOSS|上司|权限|白名单|流程/u.test(text)) return '表面是规则，底下是控制或偏心，评论区会围绕越界和控制欲展开';
  if (/老婆|占有欲|偏心|顺路|不爱/u.test(text)) return '核心是“到底是不是在意、爱不爱、装不装”，评论区容易下定义和站队';
  if (threadType === 'vote') return '这栋楼靠站队和投票长，不靠统一结论';
  if (threadType === 'reversal') return '这栋楼靠前后认知翻盘，评论区要有人改口、补刀、追问';
  if (threadType === 'ownerUpdate') return '这栋楼靠后续补充把旧判断打乱，评论区要追细节和翻旧楼';
  if (threadType === 'timeline') return '这栋楼靠整理线索让人重新判断，评论区要围绕“拼起来就不对劲”';
  if (threadType === 'essay') return '这栋楼靠一句或一个动作的余味，不要把评论区写成大分析会';

  const channelBiases = HIGHLIGHT_CHANNEL_BIASES[channel];
  if (channelBiases?.length) {
    return channelBiases[randomIndex(`${title}:${body}`, channelBiases.length)] || '';
  }

  return '';
}

export function buildForumReplyRoleHintsV2(tier: ForumContentTier, hasUserNewComment: boolean) {
  const roles = tier === 'highlight'
    ? ['有人定性一句', '有人顺着往下接', '有人认真一点', '有人只补一刀']
    : tier === 'ferment'
      ? ['有人明确站队', '有人怀疑观望', '有人认真分析', '有人顺手接楼']
      : tier === 'fragment'
        ? ['有人接余味', '有人接画面', '有人轻轻补一句']
        : ['普通围观的人', '顺手接一句的人', '认真回一句的人'];

  if (hasUserNewComment) {
    roles.unshift('至少有人直接接住用户最后一句');
  }

  return roles;
}

export function buildForumReplyRoleHints(tier: ForumContentTier, hasUserNewComment: boolean) {
  const roles = tier === 'highlight'
    ? ['一句能定整栋楼气氛的人', '顺着那句继续抬高或反打的人', '一本正经分析但越说越怪的人', '短句补刀的人']
    : tier === 'ferment'
      ? ['明确站队的人', '怀疑和看戏的人', '认真建议的人', '顺着前面一句再补细节的人']
      : tier === 'fragment'
        ? ['接余味的人', '会说“这段太像了”的人', '补一个小画面的人']
        : ['普通围观的人', '顺手接一句的人', '认真回一句的人'];

  if (hasUserNewComment) {
    roles.unshift('直接接用户最后一句的人');
  }

  return roles;
}
