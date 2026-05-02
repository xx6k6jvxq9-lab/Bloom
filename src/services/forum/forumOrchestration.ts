import type { ForumChannel, ForumContentTier, ForumThreadType } from '../../features/forum-domain/types';
import type { ForumPost } from '../../types';
import { inferForumContentTier, inferForumDiscourseAxis } from './forumContentTier';

type ForumReplyPlanMode = 'post' | 'comment' | 'refresh';

const FORUM_TIER_PRIORITY: Record<ForumContentTier, number> = {
  highlight: 0,
  ferment: 1,
  baseline: 2,
  fragment: 3,
};

export function inferForumThreadTypeFromText(title: string, content: string): ForumThreadType {
  const text = `${title} ${content}`;
  if (/二编|后续|更新|补充|汇报|再补一句/.test(text)) return 'ownerUpdate';
  if (/反转|打脸|结果是|后来发现|真相|不是这样/.test(text)) return 'reversal';
  if (/投票|站队|押一个|开盘|选哪个/.test(text)) return 'vote';
  if (/时间线|复盘|整理一下|记录帖|按时间排/.test(text)) return 'timeline';
  if (/片段|短文|脑补|代餐|\[片段\]|【片段】/.test(text)) return 'essay';
  if (/目击|看见|撞见|路过|现场/.test(text)) return 'sighting';
  if (/爆料|吃瓜|听说|不保真|风声/.test(text)) return 'gossip';
  if (/委托|悬赏|求个|谁能|帮忙|预算|有偿/.test(text)) return 'commission';
  if (/同题|跟风|我也来|同样|也有类似/.test(text)) return 'sameTopic';
  if (/求助|怎么办|该不该|想问|有人懂/.test(text)) return 'help';
  if (/串台|跨区|错频|两个世界|裂缝/.test(text)) return 'rift';
  return 'normal';
}

export function buildForumPostMeta(title: string, content: string, channel: ForumChannel) {
  const threadType = inferForumThreadTypeFromText(title, content);
  const contentTier = inferForumContentTier(threadType, title, content);
  const discourseAxis = inferForumDiscourseAxis(threadType, channel, title, content);
  return {
    threadType,
    contentTier,
    discourseAxis,
  };
}

export function buildForumReplyPlan(
  post: { contentTier?: ForumPost['contentTier'] },
  mode: ForumReplyPlanMode,
  isThreadReply = false,
) {
  const tier = post.contentTier || 'baseline';
  if (mode === 'post') {
    if (tier === 'highlight') return { replyCount: 4, replyMode: 'mixed' as const };
    if (tier === 'ferment') return { replyCount: 4, replyMode: 'mixed' as const };
    if (tier === 'fragment') return { replyCount: 2, replyMode: 'independent_only' as const };
    return { replyCount: 3, replyMode: 'independent_only' as const };
  }

  if (mode === 'refresh') {
    if (tier === 'highlight') return { replyCount: 28, replyMode: 'mixed' as const };
    if (tier === 'ferment') return { replyCount: 26, replyMode: 'mixed' as const };
    if (tier === 'fragment') return { replyCount: 20, replyMode: 'mixed' as const };
    return { replyCount: 22, replyMode: 'mixed' as const };
  }

  if (tier === 'highlight') {
    return { replyCount: isThreadReply ? 4 : 4, replyMode: 'mixed' as const };
  }
  if (tier === 'ferment') {
    return { replyCount: isThreadReply ? 4 : 4, replyMode: 'mixed' as const };
  }
  if (tier === 'fragment') {
    return { replyCount: isThreadReply ? 3 : 2, replyMode: 'mixed' as const };
  }
  return { replyCount: isThreadReply ? 3 : 3, replyMode: 'mixed' as const };
}

export function diversifyForumPosts(posts: ForumPost[]) {
  const remaining = [...posts];
  const ordered: ForumPost[] = [];
  let previousTier: ForumContentTier | undefined;
  let previousThreadType: ForumThreadType | undefined;

  while (remaining.length > 0) {
    remaining.sort((left, right) => {
      const leftTierScore = FORUM_TIER_PRIORITY[left.contentTier || 'baseline'] ?? 9;
      const rightTierScore = FORUM_TIER_PRIORITY[right.contentTier || 'baseline'] ?? 9;
      if (leftTierScore !== rightTierScore) return leftTierScore - rightTierScore;
      return right.timestamp - left.timestamp;
    });

    let pickedIndex = remaining.findIndex((post) => (
      post.contentTier !== previousTier
      && post.threadType !== previousThreadType
    ));
    if (pickedIndex === -1) {
      pickedIndex = remaining.findIndex((post) => post.contentTier !== previousTier);
    }
    if (pickedIndex === -1) {
      pickedIndex = remaining.findIndex((post) => post.threadType !== previousThreadType);
    }
    if (pickedIndex === -1) {
      pickedIndex = 0;
    }

    const [picked] = remaining.splice(pickedIndex, 1);
    ordered.push(picked);
    previousTier = picked.contentTier || 'baseline';
    previousThreadType = picked.threadType || 'normal';
  }

  return ordered;
}
