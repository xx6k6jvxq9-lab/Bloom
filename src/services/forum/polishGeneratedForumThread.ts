import type { ForumChannel, ForumContentTier, ForumThreadType } from '../../features/forum-domain/types';
import { buildForumPostFooterTags } from './forumPostTags';
import { getForumChannelVocabHints } from './buildForumThreadPromptExamples';

type PolishGeneratedForumThreadInput = {
  channel: ForumChannel;
  threadType: ForumThreadType;
  contentTier?: ForumContentTier;
  discourseAxis?: string;
  title: string;
  body: string;
};

type PolishGeneratedForumThreadResult = {
  title: string;
  body: string;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickFromPool(values: string[], seed: string) {
  if (!values.length) return '';
  return values[hashString(seed) % values.length];
}

const INLINE_MARKER_POOL = [
  ['==', '=='],
  ['!!', '!!'],
  ['^^', '^^'],
  ['%%', '%%'],
  ['@@', '@@'],
  ['__', '__'],
  ['[[', ']]'],
  ['{{', '}}'],
  ['<<', '>>'],
  ['//', '//'],
] as const;

const BLOCK_STYLE_POOL = [
  { kind: 'note', palette: 'amber' },
  { kind: 'paper', palette: 'sky' },
  { kind: 'sticky', palette: 'mint' },
  { kind: 'tape', palette: 'rose' },
  { kind: 'paper', palette: 'violet' },
] as const;

function ensurePrefix(value: string, prefix: string) {
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
}

function ensureIncludesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function splitSentences(body: string) {
  return body
    .split(/[。！？!?]\s*|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractDecoratablePhrases(body: string) {
  return Array.from(
    new Set(
      body
        .split(/\n+/)
        .flatMap((line) => line.split(/[，、。！？；：]/))
        .map((part) => part.trim())
        .filter((part) => part.length >= 4 && part.length <= 14)
        .filter((part) => !/^(OS|os)[:：]/.test(part))
        .filter((part) => !/[#@<>{}\[\]=~^/%]/.test(part)),
    ),
  );
}

function applyInlineMarker(text: string, phrase: string, marker: readonly [string, string]) {
  const [open, close] = marker;
  if (!phrase || text.includes(`${open}${phrase}${close}`)) return text;
  return text.replace(new RegExp(escapeRegExp(phrase)), `${open}${phrase}${close}`);
}

function buildReadableParagraphs(body: string, maxLines = 3) {
  const existing = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (existing.length >= maxLines) {
    return existing.slice(0, maxLines).join('\n\n');
  }

  const sentences = splitSentences(body);
  if (sentences.length <= 1) return body.trim();

  const groups: string[] = [];
  let cursor = 0;
  const targetSize = Math.max(1, Math.ceil(sentences.length / Math.min(maxLines, sentences.length)));

  while (cursor < sentences.length && groups.length < maxLines) {
    groups.push(`${sentences.slice(cursor, cursor + targetSize).join('，')}。`);
    cursor += targetSize;
  }

  return groups.join('\n\n');
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function countVisualBlocks(body: string) {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^\[!(note|paper|sticky|tape)(?::[a-z-]+)?\]/i.test(line))
    .length;
}

function wrapStyledBlock(text: string, style: typeof BLOCK_STYLE_POOL[number]) {
  return `[!${style.kind}:${style.palette}] ${text.trim()}`;
}

function stripInstructionLeakage(body: string) {
  const lines = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(需求|时间|规则|背景|地点|对象|人物|场景|任务|设定|说明|要求)[:：]\s*/u, ''))
    .filter((line) => line && !/^(只输出|格式|json|输出要求)/iu.test(line));

  return lines.join('\n');
}

function countHan(value: string) {
  return (value.match(/[\u4e00-\u9fff]/g) || []).length;
}

function looksFlatTitle(title: string) {
  const normalized = normalizeWhitespace(title);
  return (
    normalized.length <= 6
    || /^(关于|想问|求助|求问|记录|整理|这个|那个|一件事|一点事|有个问题)/u.test(normalized)
    || !/[?？!！]/.test(normalized) && !/怎么|什么意思|是不是|到底|谁|为什么|又|还|居然|结果/u.test(normalized)
  );
}

function buildHookedTitle(title: string, body: string, threadType: ForumThreadType) {
  const normalizedTitle = normalizeWhitespace(title);
  const firstSentence = splitSentences(body)[0] || body.trim();
  const compactFirstSentence = firstSentence.replace(/[，。！？!?,、；;：:]/g, '').slice(0, 20);

  if (!looksFlatTitle(normalizedTitle)) {
    if ((threadType === 'help' || threadType === 'vote') && !/[?？]$/.test(normalizedTitle)) {
      return `${normalizedTitle}？`;
    }
    return normalizedTitle;
  }

  if (threadType === 'help' && compactFirstSentence) {
    return normalizeWhitespace(`${compactFirstSentence}怎么办`).replace(/怎么办怎么办/u, '怎么办') + '？';
  }
  if ((threadType === 'sighting' || threadType === 'gossip' || threadType === 'vote') && compactFirstSentence) {
    return `${compactFirstSentence}？`;
  }

  return normalizedTitle || compactFirstSentence;
}

function ensureHighlightHook(title: string, body: string) {
  const hookedTitle = /[?？]$/.test(title) ? title : `${title}？`;
  if (ensureIncludesAny(body, [/如题/u, /先说/u, /不是我乱猜/u, /我先声明/u])) {
    return { title: hookedTitle, body };
  }
  return {
    title: hookedTitle,
    body: `我先说，我不是在硬开麦。\n\n${body}`,
  };
}

function ensureFragmentBody(body: string) {
  const trimmed = buildReadableParagraphs(body, 2)
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('\n\n');
  return trimmed || body.trim();
}

function ensureContainsDetail(body: string, detail: string) {
  if (!detail || body.includes(detail)) return body;
  const shouldAppendOs = (hashString(`${body}:${detail}`) % 100) < 35;
  if (!shouldAppendOs) return body;
  const tailPool = [
    `${detail}这块是真的很容易让人多想。`,
    `${detail}这个点我越想越不对劲。`,
    `${detail}这一笔真不是随便就能圆过去的。`,
    `${detail}这里越看越像还有后话。`,
  ];
  return `${body}\n\nOS：${tailPool[hashString(`${detail}:${body}`) % tailPool.length]}`;
}

function ensureForumVoiceOpening(body: string, threadType: ForumThreadType) {
  const paragraphs = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!paragraphs.length) return body.trim();

  const first = paragraphs[0];
  const rest = paragraphs.slice(1).join('\n\n');
  const hasNaturalOpening = /^(rt|如题|刚刚|今天|不是|先说|我本来|我现在|事情是这样的|我先说)/iu.test(first);
  if (hasNaturalOpening) return paragraphs.join('\n\n');

  const openingByType: Record<ForumThreadType, string[]> = {
    normal: [],
    gossip: ['我先说，我不是在硬开麦。', '先说我不保真。'],
    help: ['我现在有点拿不准，所以来问问。', '先别骂，我是真不知道怎么处理。'],
    rift: ['我本来以为自己看错了。'],
    sameTopic: ['同题来一个。'],
    sighting: ['刚刚路过的时候我是真的看见了。', '不是我乱猜，现场真的有点怪。'],
    timeline: ['整理一下。', '把时间线顺下来之后味道完全变了。'],
    essay: [],
    vote: ['来，认真问一句。'],
    commission: ['认真发个委托。'],
    reversal: ['我先说，我不是在硬开麦。', '后续真的反转了。'],
    ownerUpdate: ['楼主回来补个后续。', '我回来更一下，这事没前面那么简单。', '刚拿到新信息，回来补一嘴。'],
  };

  const opening = pickFromPool(openingByType[threadType], `${threadType}:${body}`) || '';
  return opening ? [opening, first, rest].filter(Boolean).join('\n\n') : paragraphs.join('\n\n');
}

function ensureConcreteNormalBody(body: string) {
  const normalized = normalizeWhitespace(body);
  const hasDetail = /刚刚|今天|昨晚|楼下|门口|工位|宿舍|车里|后台|夜巡|名单|日志|饭局|站台|路过/u.test(normalized);
  const hasEmotion = /烦|怪|尴尬|离谱|有点|不舒服|没想明白|后劲|上头/u.test(normalized);
  const hasQuestion = /怎么|为什么|什么意思|是不是|到底/u.test(normalized);

  let next = buildReadableParagraphs(body, 2);
  if (!hasDetail && countHan(next) < 55) {
    next = `${next}\n\n刚刚那一下我现在还在反复想。`;
  }
  if (!hasEmotion && !hasQuestion && countHan(next) < 70) {
    next = `${next}\n\n反正我现在越想越怪。`;
  }
  return next;
}

function maybeDecorateInlineFlavor(
  body: string,
  seedSource: string,
  channel: ForumChannel,
  threadType: ForumThreadType,
  contentTier?: ForumContentTier,
  discourseAxis?: string,
) {
  const phrases = extractDecoratablePhrases(body);
  if (!phrases.length) return body;

  const seed = hashString(`${seedSource}:${threadType}:${contentTier || ''}:${discourseAxis || ''}`);
  const totalDecorations = contentTier === 'highlight' || seed % 100 < 28 ? 2 : 1;

  let next = body;
  for (let index = 0; index < totalDecorations; index += 1) {
    const phrase = phrases[(seed + index * 3) % phrases.length];
    const marker = INLINE_MARKER_POOL[(seed + index * 5) % INLINE_MARKER_POOL.length];
    next = applyInlineMarker(next, phrase, marker);
  }

  if ((seed >> 3) % 100 < 18) {
    const tagPool = buildForumPostFooterTags({
      title: seedSource,
      body,
      threadType,
      contentTier,
      discourseAxis,
      channel,
    });

    if (tagPool.length >= 2 && !/#/.test(next)) {
      next = `${next}\n\n${tagPool.map((tag) => `#${tag}`).join(' ')}`;
    }
  }

  return next;
}

function ensureEssayShape(title: string, body: string) {
  const hanLength = (body.match(/[\u4e00-\u9fff]/g) || []).length;
  if (hanLength >= 420) {
    return {
      title: title.trim(),
      body: buildReadableParagraphs(body, 4),
    };
  }
  const nextTitle = /^(\[片段\]|【片段】)/u.test(title) ? title : `【片段】${title}`;
  const normalized = body
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (normalized.length >= 3) {
    return {
      title: nextTitle,
      body: normalized.slice(0, 3).join('\n\n'),
    };
  }

  const sentences = splitSentences(body);
  if (sentences.length >= 4) {
    const first = `${sentences.slice(0, 2).join('，')}。`;
    const second = `${sentences.slice(2, 3).join('，')}。`;
    const third = `${sentences.slice(3).join('，')}。`;
    return {
      title: nextTitle,
      body: [first, second, third].filter((item) => item !== '。').join('\n\n'),
    };
  }

  return {
    title: nextTitle,
    body: buildReadableParagraphs(body, 4),
  };
}

function ensureEssayLength(body: string, title: string) {
  let next = buildReadableParagraphs(body, 4);
  const fillerPool = [
    '我后来越想越觉得，真正让人记住的不是单一动作，而是前后那些细节全都能互相对上，像是早就有迹可循，只是当时没人愿意挑明。',
    '如果只截其中一幕出来，其实都还能找借口圆过去，可一旦把语气、停顿、别人当时的反应和后面补上的动作连起来看，味道就完全不一样了。',
    '而且这种事最怪的地方就在这儿，表面上每一步都不算夸张，甚至还能装作只是顺手，但连在一起以后，就很难再说只是普通同学、普通同事、普通队友那种程度。',
    '我现在回头写这一段，不是为了硬扣帽子，是因为这类场面往往只有在事后复盘时才会发现它到底哪里越了线，哪里又偏心得太自然。',
    `所以我一直觉得，${title.replace(/[《》【】]/g, '').trim() || '这件事'}最耐人寻味的地方，不在于谁嘴上承认了什么，而在于那些下意识的维护、停顿和回头，本身就已经很能说明问题。`,
  ];

  let cursor = 0;
  while (countHan(next) < 420 && cursor < fillerPool.length) {
    const candidate = fillerPool[cursor];
    cursor += 1;
    if (next.includes(candidate)) continue;
    next = `${next}\n\n${candidate}`;
  }

  return buildReadableParagraphs(next, 5);
}

function ensureTimelineShape(body: string) {
  const lines = body
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (lines.some((line) => /^\d+[\.、]/.test(line))) {
    return lines.join('\n');
  }

  const sentences = splitSentences(body).slice(0, 4);
  if (sentences.length < 2) {
    return ensurePrefix(body.trim(), '整理一下时间线：\n');
  }

  return [
    '整理一下时间线：',
    ...sentences.map((sentence, index) => `${index + 1}. ${sentence}`),
  ].join('\n');
}

function ensureVoteShape(body: string) {
  const lines = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.some((line) => /^[A-DＡ-Ｄ][\.．、:：)\s]+/.test(line))) {
    return lines.join('\n');
  }

  const intro = ensureIncludesAny(body, [/投票/u, /站队/u, /选哪边/u]) ? body.trim() : `${body.trim()}\n\n来，楼里开个投票：`;
  return [
    intro,
    'A. 这是嘴硬护短，已经很明显了',
    'B. 这不只是护短，已经越界了',
    'C. 我先观望，后面一定还有料',
  ].join('\n');
}

function ensureCommissionShape(body: string) {
  let next = body.trim();
  if (!ensureIncludesAny(next, [/委托/u, /求个/u, /有偿/u, /谁能/u, /帮忙/u])) {
    next = ensurePrefix(next, '有个委托想问问，');
  }
  if (!ensureIncludesAny(next, [/预算/u, /报价/u, /条件/u, /要求/u, /接单/u])) {
    next = `${buildReadableParagraphs(next, 2)}\n\n补充一下，能接的话带一下条件、时间或者报价范围。`;
  }
  return next;
}

function ensureOwnerUpdateShape(body: string) {
  return ensurePrefix(body.trim(), '楼主回来补个后续：\n');
}

function ensureReversalShape(body: string) {
  return ensurePrefix(body.trim(), '后续真的反转了，');
}

function ensureHelpShape(body: string) {
  if (ensureIncludesAny(body, [/求助/u, /想问/u, /怎么办/u, /该不该/u, /有人懂/u])) return buildReadableParagraphs(body, 2);
  return buildReadableParagraphs(ensurePrefix(body.trim(), '想认真求助一下，'), 2);
}

function ensureSightingShape(body: string) {
  if (ensureIncludesAny(body, [/刚刚/u, /我路过/u, /目击/u, /撞见/u, /看见/u])) return buildReadableParagraphs(body, 2);
  return buildReadableParagraphs(ensurePrefix(body.trim(), '刚刚路过的时候我是真的看见了，'), 2);
}

function ensureSameTopicShape(body: string) {
  if (ensureIncludesAny(body, [/同题/u, /我也来/u, /跟风/u, /同样/u, /也有类似/u])) return buildReadableParagraphs(body, 2);
  return buildReadableParagraphs(ensurePrefix(body.trim(), '同题来一个，'), 2);
}

function ensureOwnerBodyBreak(body: string) {
  return buildReadableParagraphs(body, 3);
}

function ensureObservationShape(body: string) {
  if (ensureIncludesAny(body, [/爆料/u, /听说/u, /风声/u, /不保真/u, /目击/u])) return buildReadableParagraphs(body, 3);
  return buildReadableParagraphs(ensurePrefix(body.trim(), '先说我不保真，'), 3);
}

function maybeDecorateBodyBlocks(
  body: string,
  seedSource: string,
  threadType: ForumThreadType,
  contentTier?: ForumContentTier,
) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!paragraphs.length) return body;

  const maxBlocks = Math.min(3, threadType === 'essay' ? 3 : contentTier === 'highlight' ? 2 : 1);
  const availableSlots = Math.max(0, maxBlocks - countVisualBlocks(body));
  if (availableSlots <= 0) return body;

  const candidates = paragraphs
    .map((paragraph, index) => ({ paragraph, index }))
    .filter(({ paragraph }) => paragraph.length >= 18 && paragraph.length <= 120)
    .filter(({ paragraph }) => !/^(A|B|C|D)[.\s、:：]/.test(paragraph))
    .filter(({ paragraph }) => !/^#/.test(paragraph))
    .filter(({ paragraph }) => !/^\[!/.test(paragraph));
  if (!candidates.length) return body;

  const decoratedIndexes = new Set<number>();
  const seed = hashString(`${seedSource}:${threadType}:${contentTier || ''}`);
  const desiredBlocks = Math.min(
    availableSlots,
    Math.max(1, threadType === 'essay' ? 2 : 1),
    candidates.length,
  );

  for (let step = 0; step < desiredBlocks; step += 1) {
    const picked = candidates[(seed + step * 5) % candidates.length];
    if (!picked || decoratedIndexes.has(picked.index)) continue;
    const style = BLOCK_STYLE_POOL[(seed + step * 3) % BLOCK_STYLE_POOL.length];
    paragraphs[picked.index] = wrapStyledBlock(paragraphs[picked.index], style);
    decoratedIndexes.add(picked.index);
  }

  return paragraphs.join('\n\n');
}

export function polishGeneratedForumThread(input: PolishGeneratedForumThreadInput): PolishGeneratedForumThreadResult {
  const vocabHints = getForumChannelVocabHints(input.channel);
  const detail = pickFromPool(vocabHints, `${input.title}:${input.threadType}:detail`);

  let title = normalizeWhitespace(input.title);
  let body = stripInstructionLeakage(input.body.trim());

  switch (input.threadType) {
    case 'commission':
      body = ensureCommissionShape(body);
      break;
    case 'ownerUpdate':
      body = ensureOwnerBodyBreak(ensureOwnerUpdateShape(body));
      break;
    case 'reversal':
      body = ensureReversalShape(body);
      break;
    case 'essay': {
      const shaped = ensureEssayShape(title, body);
      title = shaped.title;
      body = ensureEssayLength(shaped.body, title);
      break;
    }
    case 'timeline':
      body = ensureTimelineShape(body);
      break;
    case 'vote':
      body = ensureVoteShape(body);
      break;
    case 'help':
      body = ensureHelpShape(body);
      break;
    case 'sighting':
      body = ensureSightingShape(body);
      break;
    case 'sameTopic':
      body = ensureSameTopicShape(body);
      break;
    case 'gossip':
      body = ensureObservationShape(body);
      break;
    default:
      body = input.threadType === 'normal'
        ? ensureConcreteNormalBody(body)
        : buildReadableParagraphs(body, 3);
      break;
  }

  title = buildHookedTitle(title, body, input.threadType);
  body = ensureForumVoiceOpening(body, input.threadType);

  if (input.contentTier === 'highlight') {
    const highlighted = ensureHighlightHook(title, body);
    title = highlighted.title;
    body = highlighted.body;
  }

  if (input.contentTier === 'fragment' && input.threadType !== 'essay') {
    body = ensureFragmentBody(body);
  }

  body = maybeDecorateBodyBlocks(body, input.title, input.threadType, input.contentTier);
  body = maybeDecorateInlineFlavor(body, input.title, input.channel, input.threadType, input.contentTier, input.discourseAxis);
  body = ensureContainsDetail(body, detail);

  return {
    title,
    body: body.trim(),
  };
}
