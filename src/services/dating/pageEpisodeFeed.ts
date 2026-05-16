import type {
  DatingPageEpisodeFeedComment,
  DatingPageEpisodeFeedItem,
  DatingPageEpisodePlatform,
} from '../../types';

const NUMBERED_ITEM_PREFIX_REGEX = /^(?:\d+[\.\)、)]|[一二三四五六七八九十两]+[、.)）])\s*/u;
const COMMENT_COUNT_REGEX = /评论(?:区)?[^\n]{0,12}?(\d{1,3})条/u;

const FALLBACK_COMMENTER_NAMES = [
  '路人甲',
  '前排围观',
  '热心网友',
  '电子显微镜',
  '沙发观察员',
  '人间清醒',
  '考据选手',
  '路过吃瓜',
  '评论区课代表',
  '听劝群众',
  '抽象研究会',
  '隔壁路人',
] as const;

const GENERIC_HELP_COMMENT_TEMPLATES = [
  '建议先别自乱阵脚，你这条信息量已经够大了。',
  '先把现象记下来，再决定要不要立刻行动。',
  '像这种情况，先观察比立刻冲上去更稳。',
  '你都写成这样了，我感觉当事人已经很明显了。',
  '楼主先别慌，这种信号通常不是空穴来风。',
  '建议先确认对方真实意图，再决定下一步。',
] as const;

const GENERIC_REACTION_COMMENT_TEMPLATES = [
  '这条我先码住，后劲有点大。',
  '你这个表达像是把脑内弹幕直接发出来了。',
  '不说别的，这条确实很有画面感。',
  '这味儿对了，一看就是亲历现场。',
  '评论区先蹲一个后续。',
  '这条不像编的，像刚发生完就来发了。',
] as const;

const PLATFORM_HELP_COMMENTS: Record<Exclude<DatingPageEpisodePlatform, 'wechat' | 'moments'>, readonly string[]> = {
  weibo: [
    '建议先别慌，这种程度已经够微博评论区连夜开分析楼了。',
    '你这个信息量，建议先记证据再行动，别让评论区白替你着急。',
    '微博上这种帖通常会被分成三派，我先站“她有点在意你”那边。',
  ],
  xiaohongshu: [
    '姐妹先别急，我会建议你先看她后续有没有继续主动贴近。',
    '这种情况放小红书大概率会有人说“别猜，直接试探一次”。',
    '如果是我，我会先确认她是不是只对你这样，再决定要不要冲。',
  ],
  netease: [
    '这条像歌评区那种会有人认真接住你情绪的评论。',
    '先别把自己绕晕，能写成这样说明这段心事已经压很久了。',
    '网易云底下通常会劝你先听完再回头看人，我也差不多这个建议。',
  ],
  survey: [
    '这题要是放问卷里，我会选“高概率另有含义”。',
    '建议先把变量拆开，不然样本再多也会被情绪带偏。',
    '从结论上看，这已经不是普通波动了。',
  ],
  campus: [
    '校园墙遇到这种一般都会先劝你别急着摊牌，先观察两天。',
    '这事放校园论坛肯定有人替你列时间线，我先建议你也记一下。',
    '像宿舍楼下那种吃瓜楼会默认她对你有点特别。',
  ],
  generic: [
    '先别急，至少说明这件事已经值得认真看待了。',
    '你这条发出来之后，正常人都会觉得不太普通。',
    '建议先稳住，再决定怎么回应。',
  ],
};

const PLATFORM_REACTION_COMMENTS: Record<Exclude<DatingPageEpisodePlatform, 'wechat' | 'moments'>, readonly string[]> = {
  weibo: [
    '这条我先转评一个“有情况”。',
    '微博看到这种句子，第一反应就是后面还有大戏。',
    '不说别的，这条已经有热评潜质了。',
  ],
  xiaohongshu: [
    '这条我先收藏，评论区肯定有很多人代入。',
    '小红书看到这种文字第一反应就是“姐妹你别太会写”。',
    '这条也太像深夜笔记区会爆的内容了。',
  ],
  netease: [
    '这句很像歌评区里半夜会突然扎人的那种热评。',
    '听着听着刷到这条，人会一下子安静下来。',
    '这不是普通吐槽，这像带着 BGM 的心事。',
  ],
  survey: [
    '这题我先选“有隐情”。',
    '这个样本一看就不适合草率下结论。',
    '你这条像是把问卷开放题写成了现场报告。',
  ],
  campus: [
    '这条丢到校园墙，楼里绝对会有人开始押后续。',
    '宿舍区看到这种内容，第一反应就是“有瓜”。',
    '这味儿太像校内匿名楼会飘起来的帖子了。',
  ],
  generic: [
    '这条我先码住，后劲有点大。',
    '你这个表达像是把脑内弹幕直接发出来了。',
    '这味儿对了，一看就是亲历现场。',
  ],
};

export function splitFeedBodyIntoItems(body: string): string[] {
  const normalized = body.replace(/\r/g, '').trim();
  if (!normalized) {
    return [];
  }

  const introLines: string[] = [];
  const blocks: string[][] = [];
  let currentBlock: string[] | null = null;

  normalized.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      if (currentBlock && currentBlock[currentBlock.length - 1] !== '') {
        currentBlock.push('');
      }
      return;
    }

    if (NUMBERED_ITEM_PREFIX_REGEX.test(line)) {
      if (currentBlock && currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line.replace(NUMBERED_ITEM_PREFIX_REGEX, '').trim()];
      return;
    }

    if (currentBlock) {
      currentBlock.push(line);
      return;
    }

    introLines.push(line);
  });

  if (currentBlock && currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  if (blocks.length < 2) {
    return [];
  }

  const introText = introLines.join('\n').trim();
  return blocks
    .map((lines, index) => {
      const bodyText = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      if (!bodyText) {
        return '';
      }

      if (index === 0 && introText) {
        return `${introText}\n${bodyText}`.trim();
      }

      return bodyText;
    })
    .filter(Boolean);
}

export function extractRequiredCommentCount(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\r/g, '');
  const match = normalized.match(COMMENT_COUNT_REGEX);
  if (!match) {
    return undefined;
  }

  const count = Number.parseInt(match[1] || '', 10);
  return Number.isFinite(count) && count > 0 ? Math.min(count, 50) : undefined;
}

function pickFallbackCommentText(
  item: DatingPageEpisodeFeedItem,
  platform: Exclude<DatingPageEpisodePlatform, 'wechat' | 'moments'>,
  index: number,
): string {
  const sourceText = `${item.headline || ''}\n${item.body}`.trim();
  const wantsAdvice = /求助|请问|怎么办|在线等|建议|分析|到底/u.test(sourceText);
  const pool = wantsAdvice
    ? (PLATFORM_HELP_COMMENTS[platform] || GENERIC_HELP_COMMENT_TEMPLATES)
    : (PLATFORM_REACTION_COMMENTS[platform] || GENERIC_REACTION_COMMENT_TEMPLATES);
  return pool[index % pool.length].trim();
}

export function ensureSocialFeedComments(
  item: DatingPageEpisodeFeedItem,
  platform: DatingPageEpisodePlatform | undefined,
  instructionText?: string,
): DatingPageEpisodeFeedItem {
  if (!platform || platform === 'wechat' || platform === 'moments') {
    return item;
  }

  const requiredCount = extractRequiredCommentCount(instructionText) || 3;
  const existingComments = item.comments || [];
  if (existingComments.length >= requiredCount) {
    return {
      ...item,
      commentCountLabel: item.commentCountLabel || String(existingComments.length),
    };
  }

  const socialPlatform = platform as Exclude<DatingPageEpisodePlatform, 'wechat' | 'moments'>;
  const synthesizedComments: DatingPageEpisodeFeedComment[] = [];
  for (let i = existingComments.length; i < requiredCount; i += 1) {
    synthesizedComments.push({
      id: `auto-social-comment-${i + 1}`,
      authorName: FALLBACK_COMMENTER_NAMES[i % FALLBACK_COMMENTER_NAMES.length],
      authorRole: 'other',
      text: pickFallbackCommentText(item, socialPlatform, i),
    });
  }

  return {
    ...item,
    comments: [...existingComments, ...synthesizedComments],
    commentCountLabel: String(existingComments.length + synthesizedComments.length),
  };
}
