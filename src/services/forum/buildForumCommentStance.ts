import type { ForumPost } from '../../types';

export type ForumCommentStance =
  | 'protect'
  | 'mock'
  | 'watch'
  | 'doubt'
  | 'ship'
  | 'advice';

type ResolveForumCommentStanceInput = {
  post: ForumPost;
  kind: 'authorReply' | 'ambientReply';
  seed: number;
};

type ForumCommentStanceMeta = {
  stance: ForumCommentStance;
  lines: string[];
};

function pickBySeed<T>(items: T[], seed: number) {
  if (!items.length) return undefined;
  return items[Math.abs(seed) % items.length];
}

const STANCE_LINES: Record<ForumCommentStance, string[]> = {
  protect: [
    '我偏向护着这层，至少别让节奏先把人埋了。',
    '先别急着扑上来审，楼里最该保的是边界。',
    '这事先护一下再说，别把人直接往火上架。',
  ],
  mock: [
    '嘴硬成这样，评论区不笑都难。',
    '这楼最有意思的地方就是有人明明露馅还硬装。',
    '要不还是别演了，楼里都快替他尴尬了。',
  ],
  watch: [
    '我先蹲，不急着站边，这楼后面多半还有戏。',
    '先看着，这种楼往往越后面越真。',
    '这层我先码住，感觉还会再翻。',
  ],
  doubt: [
    '我先存疑，很多细节听起来还是差一口气。',
    '这楼我不敢全信，后面最好还有补证。',
    '先别盖章，我总觉得还有一层没翻出来。',
  ],
  ship: [
    '这还不嗑的话评论区要求是不是有点太高了。',
    '我先承认，我就是来嗑这种藏不住的细节。',
    '这层一出来，嗑点已经自己长出来了。',
  ],
  advice: [
    '先把边界和需求列清，再决定要不要往下走。',
    '如果真想解决，最好先把关键节点补完整。',
    '先别急着情绪化，按步骤拆开会更清楚。',
  ],
};

export function resolveForumCommentStance(input: ResolveForumCommentStanceInput): ForumCommentStanceMeta {
  const text = `${input.post.title}\n${input.post.content}`;
  const lowered = text.toLowerCase();

  const candidates: ForumCommentStance[] = [];

  if (input.kind === 'authorReply') {
    candidates.push('protect', 'watch');
  }

  if (input.post.threadType === 'commission' || input.post.threadType === 'help') {
    candidates.push('advice', 'protect');
  }
  if (input.post.threadType === 'vote' || input.post.threadType === 'reversal') {
    candidates.push('mock', 'doubt', 'watch');
  }
  if (input.post.threadType === 'sameTopic' || input.post.threadType === 'timeline') {
    candidates.push('watch', 'doubt');
  }
  if (input.post.threadType === 'essay' || /片段|短文|代餐|同人|拉扯|嘴硬|偏心|护短|吃醋/u.test(text)) {
    candidates.push('ship', 'watch');
  }
  if (/求助|怎么办|要不要|该不该|委托|帮忙|报酬/u.test(text)) {
    candidates.push('advice', 'protect');
  }
  if (/爆料|听说|目击|撞见|不保真|风声/u.test(text)) {
    candidates.push('doubt', 'watch');
  }
  if (/离谱|笑死|嘴硬|装|翻车|打脸/u.test(text) || lowered.includes('lol')) {
    candidates.push('mock');
  }

  if (!candidates.length) {
    candidates.push('watch', 'doubt', 'protect');
  }

  const stance = pickBySeed(candidates, input.seed) || 'watch';
  return {
    stance,
    lines: STANCE_LINES[stance],
  };
}
