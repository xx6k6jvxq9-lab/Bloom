import type { ForumComment, ForumPost } from '../../types';
import type { GeneratedForumAuthorDraft } from './generateForumThreads';

type ExpandInitialEngagementInput = {
  posts: ForumPost[];
  authors: GeneratedForumAuthorDraft[];
  boardLabel: string;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickFromPool(values: string[], seed: string) {
  return values[hashString(seed) % values.length];
}

function buildCommentPool(post: ForumPost, boardLabel: string) {
  const text = `${post.title}\n${post.content}`;
  const common = [
    '这楼我先蹲着，感觉后面还会长。',
    '楼里终于有人把我想说的说出来了。',
    '这帖最好看的一点就是细节都像真的。',
    '别删，我先留着等后续。',
    '这种一看就会继续盖楼。',
  ];
  if (post.threadType === 'commission') {
    return [
      '先说正经的，我觉得你这个可以从最早那条线索往回找。',
      '如果真是委托，报酬和风险最好写细一点。',
      '我先蹲一个后续，这类求助帖经常后面会反转。',
      '这事放在现在这个板块里，感觉很快就会有人来认领。',
      ...common,
    ];
  }
  if (post.threadType === 'ownerUpdate') {
    return [
      '楼主这次补充的信息比前面关键多了。',
      '你这一更，前面那几层的理解都得改。',
      '我就知道这事不会只是前面那样。',
      '二编之后这楼味道完全不一样了。',
      ...common,
    ];
  }
  if (post.threadType === 'reversal') {
    return [
      '好，真反转来了，我前面那层当我没说。',
      '这种打脸式后续最适合盖高楼。',
      '我就说事情不会那么简单。',
      '前面站错队的人可以回来补票了。',
      ...common,
    ];
  }
  if (post.threadType === 'sameTopic') {
    return [
      '同题帖最有意思的就是每栋楼都能歪出不同走向。',
      '这口我在别的楼也嗑过，但你这个细节更狠。',
      '这种话题最近是真的压不住。',
      '同题归同题，这栋楼还是有自己的味。',
      ...common,
    ];
  }
  if (post.threadType === 'rift') {
    return [
      `${boardLabel} 这味儿太重了，一看就不是单线能解释的。`,
      '串台感真的很强，我先记下这栋楼。',
      '这种错频式的帖子最容易出名场面。',
      '这楼越看越像两个频道串在一起了。',
      ...common,
    ];
  }

  if (/片段|短文|同人|代餐|脑补/u.test(text)) {
    return [
      '楼上文笔是真的会写，难怪评论区一下子热起来。',
      '这类片段体最容易让人自己往后补剧情。',
      '我都能想象这楼今晚会被人截图转来转去。',
      '再写一段吧，这种停在这里真的太会吊人了。',
      ...common,
    ];
  }

  return [
    '这帖一发出来就很容易起楼。',
    '我先不站边，但这层确实有点意思。',
    '楼里人应该很快就会开始各说各的。',
    '这种帖子就是越翻越上头。',
    ...common,
  ];
}

export function buildForumInitialEngagement(input: ExpandInitialEngagementInput): ForumPost[] {
  const authorIds = input.authors.map((author) => author.id).filter(Boolean);
  if (!authorIds.length) return input.posts;

  return input.posts.map((post, postIndex) => {
    const targetCount = 2 + (hashString(`${post.id}:${postIndex}`) % 2);
    if (post.comments.length >= targetCount) return post;

    const pool = buildCommentPool(post, input.boardLabel);
    const comments: ForumComment[] = [...post.comments];
    const usedContents = new Set(comments.map((comment) => comment.content.trim()));
    let cursor = comments.length;
    while (comments.length < targetCount) {
      const authorId = authorIds[(cursor + postIndex) % authorIds.length] || post.authorId;
      let content = pickFromPool(pool, `${post.id}:${authorId}:${cursor}`);
      if (usedContents.has(content)) {
        const fallback = pool.find((item) => !usedContents.has(item));
        if (fallback) content = fallback;
      }
      usedContents.add(content);
      comments.push({
        id: `${post.id}-seed-expand-${cursor + 1}`,
        postId: post.id,
        authorId,
        content,
        timestamp: post.timestamp + (cursor + 1) * 45_000,
        likes: [],
        isAiGenerated: true,
      });
      cursor += 1;
    }

    return {
      ...post,
      comments,
      viewCount: Math.max(post.viewCount, 80 + comments.length * 6),
    };
  });
}
