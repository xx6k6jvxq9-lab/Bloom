import { Character, Mask, ApiConfig, MomentImageCard, WorldBookEntry } from '../../types';
import { buildChatPrompt } from '../ai/prompts/builders/buildChatPrompt';
import { buildMomentCommentReplyPrompt } from '../ai/prompts/builders/buildMomentCommentReplyPrompt';
import { buildMomentsPrompt } from '../ai/prompts/builders/buildMomentsPrompt';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildSharedCharacterStateFromCharacter } from '../relationship-context/buildSharedCharacterState';
import { buildBudgetedWorldBookPrompt } from '../world-book/worldBookBudget';
import { sortWorldBooksByPriority } from '../world-book/worldBookMeta';
import { buildMomentPostBlueprint, type MomentPostBlueprint } from './postBlueprints';
import {
  buildMomentTranslationInstruction,
  resolveMomentLanguagePlan,
  splitMomentTranslationParts,
} from './momentLanguage';
import { buildMomentReadableMemoryView } from './momentMemoryVisibility';
import {
  classifyMomentCommentType,
  getRecentMomentReplyContext,
  inferMomentIntent,
  inferMomentTone,
} from './triggers';
import { hasOwnershipClaimRisk } from './publicThreadPolicy';
import { getCharacterPublicThreadProfile } from './publicThreadPolicy';

type MomentCommentLike = {
  authorId: string;
  content: string;
  replyToAuthorName?: string;
};

type MomentLike = {
  authorId: string;
  content: string;
  timestamp: number;
  images?: string[];
  comments: MomentCommentLike[];
};

type GeneratedMomentPost = {
  content: string;
  translation?: string;
  imageCard?: MomentImageCard;
};

const MOMENT_FALLBACKS = [
  '今天先这样，晚点再说。',
  '脑子有点乱，先记一笔。',
  '风一吹，心情就安静了一点。',
  '今天适合少解释，先过完这一天。',
  '状态一般，但还在往前走。',
];

const MOMENT_BAD_PATTERNS = [
  /发动态/,
  /我发一条/,
  /那我发/,
  /给你发/,
  /你让我发/,
  /chat reply/i,
  /trigger/i,
  /stylehint/i,
];

const CHAT_REACTION_BAD_PATTERNS = [
  /我发一条/,
  /我去发/,
  /我准备发/,
  /给你发个动态/,
  /下面是动态/,
];

const MOMENT_REPLY_LEAK_PATTERNS = [
  /如果有人让你/i,
  /我永远站在你这一边/i,
  /既然是你/i,
  /不用管什么道理/i,
  /给你准备的/i,
  /哄好/i,
  /某人/i,
  /某些人/i,
];

 function buildMaskPrompt(characterId: string, masks: Mask[]) {
  const activeMask = masks.find((mask) => mask.isActive && mask.linkedCharacters.includes(characterId));
  if (!activeMask) return '';

  return [
    activeMask.name ? `Name: ${activeMask.name}` : '',
    activeMask.personality ? `Personality: ${activeMask.personality}` : '',
    activeMask.occupation ? `Occupation: ${activeMask.occupation}` : '',
    activeMask.relationship ? `Relationship with you: ${activeMask.relationship}` : '',
    activeMask.worldBackground ? `World Background: ${activeMask.worldBackground}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildWorldBookPrompt(character: Character, worldBook: WorldBookEntry[]) {
  const activeWorldBooks = sortWorldBooksByPriority(
    worldBook.filter(
      (entry) =>
        (entry.isActive && (entry.isGlobal || entry.characterIds?.includes(character.id)))
        || character.activeWorldBookIds?.includes(entry.id),
    ),
  );

  return buildBudgetedWorldBookPrompt(activeWorldBooks, 'direct');
}

function buildMomentCharacterCore(options: {
  character: Character;
  masks: Mask[];
  worldBook: WorldBookEntry[];
}) {
  const { character, masks, worldBook } = options;
  const characterContext = buildCharacterContext({
    character,
    activeMask: masks.find((mask) => mask.isActive && mask.linkedCharacters.includes(character.id)) ?? null,
    activeWorldBooks: worldBook.filter(
      (entry) =>
        (entry.isActive && (entry.isGlobal || entry.characterIds?.includes(character.id)))
        || character.activeWorldBookIds?.includes(entry.id),
    ),
  });

  return {
    characterSetting: [
      characterContext.corePersona,
      characterContext.expressionStyle ? `表达风格：${characterContext.expressionStyle}` : '',
      characterContext.boundaryPack ? `边界与禁区：${characterContext.boundaryPack}` : '',
      characterContext.extendedLore ? `扩展设定：${characterContext.extendedLore}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    maskPrompt: characterContext.maskPrompt || buildMaskPrompt(character.id, masks),
    worldBookPrompt: characterContext.worldBookPrompt || buildWorldBookPrompt(character, worldBook),
  };
}

type MomentPrivateCarryoverLevel = NonNullable<Character['momentPrivateCarryoverLevel']>;

function resolveMomentPrivateCarryoverLevel(options: {
  level?: Character['momentPrivateCarryoverLevel'];
  legacyEnabled?: boolean;
}): MomentPrivateCarryoverLevel {
  if (
    options.level === 'light'
    || options.level === 'medium'
    || options.level === 'high'
    || options.level === 'none'
  ) {
    return options.level;
  }

  return options.legacyEnabled ? 'light' : 'none';
}

function buildMomentRecentResidueSummary(options: {
  level: MomentPrivateCarryoverLevel;
  publicResidueSummary?: string;
  privateAfterglowSummary?: string;
}) {
  const { level } = options;
  const publicResidueSummary = options.publicResidueSummary?.trim();
  const privateAfterglowSummary = options.privateAfterglowSummary?.trim();
  const sections: string[] = [];

  if (publicResidueSummary) {
    sections.push(`Public-readable recent residue for moments: ${publicResidueSummary}`);
  }

  if (level === 'none' || !privateAfterglowSummary) {
    return sections.join('\n');
  }

  if (level === 'light') {
    sections.push(`Private carryover for public moments: only hint at it faintly as mood or aftertaste. Do not expose private-only details. ${privateAfterglowSummary}`);
    return sections.join('\n');
  }
  if (level === 'medium') {
    sections.push(`Private carryover for public moments: a moderate amount of afterglow is allowed if it still reads like a public-facing status, not a private chat leak. ${privateAfterglowSummary}`);
    return sections.join('\n');
  }

  sections.push(`Private carryover for public moments: a clearly noticeable private afterglow is allowed when it still feels like something this character would publicly post. Never quote private lines or reveal private-only details. ${privateAfterglowSummary}`);
  return sections.join('\n');
}

function buildMomentPrivateCarryoverStyleHints(level: MomentPrivateCarryoverLevel) {
  switch (level) {
    case 'light':
      return [
        'Only let a faint trace of private afterglow show up, more like mood than content.',
        'Do not reveal private-only details, quoted lines, or make it read like direct speech to the user.',
      ];
    case 'medium':
      return [
        'A moderate amount of private afterglow is okay, but it should still read like a normal public post.',
        'You may lightly imply relationship residue, but do not expose private-only details or turn it into direct user-facing speech.',
      ];
    case 'high':
      return [
        'A fairly clear private afterglow is allowed if it still feels like a public post this character would really make.',
        'Even at this level, never reveal private-only details, quoted lines, or write it like direct speech to the user.',
      ];
    case 'none':
    default:
      return [
        'Use only publicly readable state, life fragments, and public carryover. Do not use private carryover or short-term direct-chat residue.',
        'If the user is mentioned at all, keep it limited to what would still feel normal on a public social feed.',
      ];
  }
}

function buildMomentMemoryContext(
  character: Character,
  options: {
    privateCarryoverLevel?: MomentPrivateCarryoverLevel;
    allowPrivateMomentCarryover?: boolean;
  } = {},
) {
  const privateCarryoverLevel = resolveMomentPrivateCarryoverLevel({
    level: options.privateCarryoverLevel ?? character.momentPrivateCarryoverLevel,
    legacyEnabled: options.allowPrivateMomentCarryover ?? character.allowPrivateMomentCarryover,
  });
  const layers = buildResolvedMemoryLayers(character);
  const sharedCharacterState = buildSharedCharacterStateFromCharacter({
    character,
  });
  const readableMemoryView = buildMomentReadableMemoryView({
    character,
    shortTermSummary: layers.shortTermSummary?.trim(),
    longTermMemoryProfile: layers.longTermMemoryProfile?.trim(),
  });
  const lifeFlavor = [
    character.signature?.trim() ? `公开底色：${character.signature.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const shortTermSummary = buildMomentRecentResidueSummary({
    level: privateCarryoverLevel,
    publicResidueSummary: readableMemoryView.publicResidueSummary,
    privateAfterglowSummary: readableMemoryView.privateAfterglowSummary,
  });

  return {
    _legacyShortTermSummary: readableMemoryView.publicResidueSummary?.trim()
      ? `近期余波（只作背景，不要整条围着用户转）：${readableMemoryView.publicResidueSummary.trim()}`
      : '',
    shortTermSummary,
    longTermMemoryProfile: readableMemoryView.publicMemoryProfile?.trim()
      ? `长期印象（保持角色连续性，但不要独占主题）：${readableMemoryView.publicMemoryProfile.trim()}`
      : '',
    perceptionPrompt: lifeFlavor,
    sharedCharacterStatePrompt: sharedCharacterState.groupPrompt,
  };
}

function inferMomentPostMode(requestText: string): 'self_life' | 'relationship_carryover' | 'public_daily' {
  const normalized = requestText.trim().toLowerCase();

  if (/emotion-and-closing|emotion-after-long-chat|event-and-closing|long-chat-closing|relationship|carryover|after-chat|用户|余波|刚聊完|聊天后/.test(normalized)) {
    return 'relationship_carryover';
  }

  if (/自主发动态|auto|self|life|daily|status|rhythm|observe|interest|today|busy|moment|生活|日常|状态|节奏|观察|兴趣|今天|在忙|发动态/.test(normalized)) {
    return 'self_life';
  }

  return 'public_daily';
}

function buildBalancedMomentPostPrompt(options: {
  character: Character;
  masks: Mask[];
  worldBook: WorldBookEntry[];
  triggerHint?: string;
  extraStyleHints?: string[];
  mode?: 'self_life' | 'relationship_carryover' | 'public_daily';
  blueprint?: MomentPostBlueprint;
  privateCarryoverLevel?: MomentPrivateCarryoverLevel;
  allowPrivateMomentCarryover?: boolean;
}) {
  const {
    character,
    masks,
    worldBook,
    triggerHint,
    extraStyleHints = [],
    mode = 'public_daily',
    blueprint,
    privateCarryoverLevel,
    allowPrivateMomentCarryover = false,
  } = options;
  const resolvedPrivateCarryoverLevel = resolveMomentPrivateCarryoverLevel({
    level: privateCarryoverLevel ?? character.momentPrivateCarryoverLevel,
    legacyEnabled: allowPrivateMomentCarryover || character.allowPrivateMomentCarryover,
  });

  const relationship =
    mode === 'relationship_carryover'
      ? '这是一条公开动态，可以轻轻带到和用户有关的关系余波，但整体仍要像公开状态，而不是写给用户看的私聊。'
      : mode === 'self_life'
        ? '这是一条公开动态，优先写角色自己的生活节奏、观察、兴趣和状态感。'
        : '这是一条公开动态，可以是生活碎片、公开日常或轻微关系余波，但不要每条都围着用户转。';

  const styleHints =
    mode === 'relationship_carryover'
      ? [
          '直接给出已经可以发布的动态正文。',
          '允许带一点和用户有关的余波，但不要写成对用户说话。',
          '重点是公开可见的状态感，而不是私聊外溢。',
        ]
      : mode === 'self_life'
        ? [
            '直接给出已经可以发布的动态正文。',
            '优先写角色自己的生活、观察、兴趣和状态感。',
            '如果提到用户，只能是很轻的关系余波。',
          ]
        : [
            '直接给出已经可以发布的动态正文。',
            '可以写公开日常、兴趣吐槽或生活碎片。',
            '和用户有关的内容不是禁区，但不要每条都围着用户转。',
          ];
  const privacyStyleHints = buildMomentPrivateCarryoverStyleHints(resolvedPrivateCarryoverLevel);

  return buildMomentsPrompt({
    characterCore: buildMomentCharacterCore({ character, masks, worldBook }),
    memoryContext: buildMomentMemoryContext(character, {
      privateCarryoverLevel: resolvedPrivateCarryoverLevel,
      allowPrivateMomentCarryover,
    }),
    postContext: {
      signature: character.signature,
      relationship,
      maxLength: blueprint?.maxChars ?? 50,
      allowImages: blueprint?.allowImages ?? false,
      triggerReason: triggerHint || '当前是在生成一条已经准备公开发出的动态正文。这不是私聊回复。',
      styleHints: [
        ...styleHints,
        ...privacyStyleHints,
        ...(blueprint?.styleHints || []),
        'Prefer posts with a visible real-world anchor: a room, desk, mirror, food, clothing, weather, train, store, gym, street, pet, or work scene.',
        'Allow life-sharing, complaint, flirting, jealousy, public preference, work snippets, jokes, hot takes, and abstract fragments. Do not collapse everything into introspection.',
        'If the user is involved, keep it public-facing: a hint, tease, stance, petty line, flirt, or a post clearly meant for them to see, not a direct chat bubble.',
        'If the post smells like a real photo, imagine a real subject in frame instead of a metaphor card: selfie, outfit, abs, maid outfit, cat ears, pet, hot dog, milk tea, gym mirror, bedroom corner, convenience store light, desk, screenshot.',
        'Long posts must break into natural paragraphs. Short posts can be blunt, casual, messy, or playful.',
        '不要写成任务说明。',
        '不要出现“你让我发”“那我发一条”这类过渡句。',
        '像角色自己会发的一条公开状态。',
        '长度和段落由这次发布形态决定，不要默认压成统一短句。',
        ...extraStyleHints,
      ],
    },
    sections: blueprint?.promptSections || [],
  });
}

function trimMomentContentAtBoundary(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return text;
  }

  const probe = text.slice(0, Math.min(text.length, maxChars + 36));
  const tail = probe.slice(Math.max(0, maxChars - 20));
  const punctuationMatch = tail.match(/[\n。！？!?]/g);
  if (punctuationMatch && punctuationMatch.length > 0) {
    const lastPunctuation = Math.max(
      tail.lastIndexOf('\n'),
      tail.lastIndexOf('。'),
      tail.lastIndexOf('！'),
      tail.lastIndexOf('？'),
      tail.lastIndexOf('!'),
      tail.lastIndexOf('?'),
    );
    if (lastPunctuation >= 0) {
      return probe
        .slice(0, Math.max(0, maxChars - 20) + lastPunctuation + 1)
        .trim();
    }
  }

  return probe.slice(0, maxChars).trim();
}

function splitMomentSentences(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .match(/[^。！？!?]+[。！？!?]?/g)
    ?.map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    || [];
}

function rebalanceMomentParagraphs(text: string, shape?: MomentPostBlueprint['shape']) {
  const normalizedParagraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' '))
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (shape === 'short_status') {
    return normalizedParagraphs.join(' ');
  }

  if (normalizedParagraphs.length >= 2) {
    return normalizedParagraphs.join('\n\n');
  }

  const flattened = normalizedParagraphs.join(' ').trim();
  if (!flattened || flattened.length < 88) {
    return flattened;
  }

  const sentences = splitMomentSentences(flattened);
  if (sentences.length < 3) {
    return flattened;
  }

  const targetParagraphCount =
    shape === 'photo_dump'
      ? Math.min(4, Math.max(2, Math.ceil(sentences.length / 2)))
      : shape === 'music_diary'
        ? Math.min(3, Math.max(2, Math.ceil(sentences.length / 2)))
        : shape === 'multi_paragraph' || shape === 'journal_note'
          ? Math.min(4, Math.max(2, Math.ceil(sentences.length / 2)))
          : Math.min(3, Math.max(2, Math.ceil(sentences.length / 2)));
  const idealGroupSize = Math.max(1, Math.ceil(sentences.length / targetParagraphCount));
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    const candidate = [...current, sentence].join(' ');
    const shouldBreak = current.length > 0 && (
      current.length >= idealGroupSize
      || candidate.length > 74
    );
    if (shouldBreak) {
      paragraphs.push(current.join(' ').trim());
      current = [sentence];
      continue;
    }

    current.push(sentence);
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' ').trim());
  }

  return paragraphs.filter(Boolean).join('\n\n');
}

function normalizeGeneratedMomentContent(text: string, maxChars: number, shape?: MomentPostBlueprint['shape']) {
  const normalized = text
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\r/g, '')
    .trim();

  if (!normalized) {
    return '';
  }

  return trimMomentContentAtBoundary(
    rebalanceMomentParagraphs(normalized, shape),
    maxChars,
  );
}

/* broken legacy helper kept only to neutralize a malformed regex during refactor
function normalizeMomentTranslationText__legacy(text: string) {
  return text
    .replace(/^["'鈥溾€漖+|["'鈥溾€漖+$/g, '')
    .replace(/\r/g, '')
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' '))
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

*/

function normalizeMomentTranslationText(text: string) {
  return text
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\r/g, '')
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' '))
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function isContaminatedMomentContent(
  text: string,
  mode: 'self_life' | 'relationship_carryover' | 'public_daily',
) {
  const normalized = text.trim();
  if (!normalized) return true;
  if (MOMENT_BAD_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (MOMENT_REPLY_LEAK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (mode !== 'relationship_carryover') {
    const secondPersonCount = (normalized.match(/给你|等你|陪你|你那边|你这一边|你准备的|哄你|记得|别熬|早点睡/g) || []).length;
    if (secondPersonCount >= 2) {
      return true;
    }
  }

  return false;
}

function normalizeChatReaction(text: string) {
  return text
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\r/g, '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .join(' ')
    .slice(0, 80);
}

function isContaminatedChatReaction(text: string) {
  const normalized = text.trim();
  if (!normalized) return true;
  return CHAT_REACTION_BAD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getCleanMomentFallback(shape?: MomentPostBlueprint['shape']) {
  return '';
  const shapeFallbacks: Partial<Record<MomentPostBlueprint['shape'], string[]>> = {
    photo_dump: [
      '最近存了几张零碎的图。\n\n单看都很普通，拼在一起倒像这几天。',
      '翻相册的时候才发现，这几天其实也不是只有忙和累。',
    ],
    multi_paragraph: [
      '今天一整天都像被拆成好几小段。\n\n有些事现在还没想清楚，但我知道自己确实在往前走。',
      '这一天下来，情绪起起落落的。\n\n先把它记在这里，等明天再慢慢整理。',
    ],
    journal_note: [
      '有些心情当下说不清楚，写下来反而会安静一点。\n\n所以先记一笔，留给今晚的自己。',
      '最近越来越想把一些日子留存下来。\n\n不是为了证明什么，只是怕自己转头就忘了。',
    ],
    music_diary: [
      '今天想配一点很轻的歌。\n\n像把这一天慢慢收回来。',
      '耳机里那首歌放到第三遍的时候，人终于没那么紧绷了。',
    ],
    cheerful_share: [
      '今天有几件很小的好事，刚好够让我心情亮一点。',
      '没发生什么惊天动地的大事，但今天确实过得不错。',
    ],
    abstract_fragment: [
      '今天像被风吹散过一次，最后又慢慢拢回来。',
      '人有时候像没完全登录，直到某个很小的瞬间才突然接上网。',
    ],
    tiny_complaint: [
      '今天火气有一点，但夜风吹完就先不跟世界吵了。',
      '忙是真的忙，烦也是真的烦，好在现在总算收工了。',
    ],
    soft_claim: [
      '有些偏心藏不太住，先记在这里，不展开。',
      '今天立场有点明显，不过我懒得装看不出来。',
    ],
  };

  const pool = shape ? shapeFallbacks[shape] : undefined;
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return MOMENT_FALLBACKS[Math.floor(Math.random() * MOMENT_FALLBACKS.length)];
}

function getCleanChatReactionFallback() {
  return '';
  return '行，我去整理一条。';
}

async function generateSingleText(options: {
  activeConfig: ApiConfig;
  prompt: string;
  requestText: string;
  fallback: string;
}) {
  const { activeConfig, prompt, requestText, fallback } = options;
  try {
    const text = await generateTextFromMessagesWithConfig({
      activeConfig,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${requestText}`,
        },
      ],
      temperature: 0.8,
    });
    return text?.trim() || fallback;
  } catch {
    return fallback;
  }
}

function hashString(input: string) {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = ((value << 5) - value + input.charCodeAt(i)) | 0;
  }
  return Math.abs(value);
}

function summarizeEnglishMomentVisualCue(content: string): string {
  const normalized = content.toLowerCase();
  const subject = /cat|kitten|meow/.test(normalized)
    ? '一只猫咪'
    : /dog|puppy/.test(normalized)
      ? '一只小狗'
      : /girl|woman|lady/.test(normalized)
        ? '一个女生'
        : /boy|man|guy/.test(normalized)
          ? '一个男生'
          : /rabbit|bunny/.test(normalized)
            ? '一只兔子'
            : /bear/.test(normalized)
              ? '一只小熊'
              : '一个带情绪的画面';
  const mood = /threat|menac|angry|mad|furious|glare|staring|wide eyes/.test(normalized)
    ? '正盯着镜头，神情有点凶'
    : /sad|cry|tears?|sob/.test(normalized)
      ? '眼神委屈，像是快要哭出来'
      : /happy|smile|laugh|grin|joy/.test(normalized)
        ? '表情轻松，看起来有点开心'
        : /shy|blush/.test(normalized)
          ? '神情有点害羞'
          : /surpris|shock|wow/.test(normalized)
            ? '像是被什么突然吓了一跳'
            : /sleep|tired|yawn/.test(normalized)
              ? '看起来懒懒的，有点困'
              : '停在一个很有情绪感的瞬间';

  return `${subject}，${mood}`;
}

function createChineseMomentPhotoDescription(content: string): string {
  const cleaned = content
    .replace(/["'`“”‘’]+/g, '')
    .replace(/[。！？!?,，、]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '一张安静的生活片段';
  }

  const containsChinese = /[\u4e00-\u9fff]/.test(cleaned);
  const containsLatin = /[A-Za-z]/.test(cleaned);
  if (!containsChinese && containsLatin) {
    return summarizeEnglishMomentVisualCue(cleaned);
  }

  const shortened = cleaned.slice(0, 22);
  if (/(阳光|月光|风|雨|灯|海|街道|晚霞|影子|天台|阳台)/.test(shortened)) {
    return shortened;
  }

  if (/(今天|刚刚|现在|这会儿|突然)/.test(shortened)) {
    return `${shortened}的片刻`;
  }

  return `像是${shortened}的一瞬`;
}

function createMomentPhotoDescription(content: string): string {
  const cleaned = content
    .replace(/["'“”‘’]/g, '')
    .replace(/[。！？!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '一些安静的光影停在眼前';
  }

  const shortened = cleaned.slice(0, 22);

  if (/(阳光|月光|风|雨|云|灯|窗|海|街|晚霞|影子|天台|阳台)/.test(shortened)) {
    return shortened;
  }

  if (/今天|刚刚|现在|这会儿|突然/.test(shortened)) {
    return `${shortened}的片刻`;
  }

  return `像${shortened}的一幕`;
}

function buildMomentVisualAnchors(content: string): string[] {
  const normalized = content.replace(/\r/g, '').trim();
  const anchors = [
    /女仆|maid/i.test(normalized) && /猫|cat|猫耳/i.test(normalized) ? '猫耳女仆装' : '',
    /女仆|maid/i.test(normalized) ? '女仆装镜前自拍' : '',
    /腹肌|abs/i.test(normalized) ? '八块腹肌' : '',
    /热狗|hot dog/i.test(normalized) ? '热气腾腾的热狗' : '',
    /奶茶|milk tea/i.test(normalized) ? '快化掉的奶茶' : '',
    /健身房|gym/i.test(normalized) ? '周末健身房镜子' : '',
    /路灯|街灯/i.test(normalized) ? '路灯下的一段影子' : '',
    /卧室|房间/i.test(normalized) ? '没开灯的卧室' : '',
    /便利店/i.test(normalized) ? '便利店门口的灯' : '',
    /地铁|车厢/i.test(normalized) ? '地铁车窗倒影' : '',
    /工位|电脑|表格|会议/i.test(normalized) ? '工位上的电脑屏幕' : '',
    /耳机|歌|bgm|音乐/i.test(normalized) ? '耳机线和锁屏界面' : '',
    /猫|cat/i.test(normalized) ? '猫趴在边上' : '',
    /自拍|镜子|穿搭/i.test(normalized) ? '镜子里的今日穿搭' : '',
    /雨|下雨/i.test(normalized) ? '伞边的雨线' : '',
    /夜风|晚风/i.test(normalized) ? '夜风吹过的街口' : '',
  ].filter(Boolean) as string[];

  return Array.from(new Set(anchors));
}

function buildMomentVisualDirections(content: string): string[] {
  const normalized = content.replace(/\r/g, '').trim();
  const directions = [
    /自拍|镜子|穿搭|look|outfit/i.test(normalized) ? '镜子里的自己' : '',
    /女仆|maid|猫耳|cos/i.test(normalized) ? '镜头前的一身打扮' : '',
    /腹肌|abs|腰线|锁骨/i.test(normalized) ? '镜子里露出来的身体线条' : '',
    /耳机|节奏|歌|bgm|音乐/i.test(normalized) ? '手里捏着的耳机' : '',
    /热狗|奶茶|咖啡|拉面|蛋糕|夜宵|早餐|便当|烧烤|吃/i.test(normalized) ? '手边那份还冒着热气的东西' : '',
    /健身房|gym|跑步|运动/i.test(normalized) ? '镜子和灯光里的运动痕迹' : '',
    /路灯|街灯|夜路|街口/i.test(normalized) ? '夜里那一点灯光' : '',
    /卧室|房间|床边|窗边|桌面|阳台/i.test(normalized) ? '房间里被拍下来的一个角落' : '',
    /便利店|商店|超市/i.test(normalized) ? '门口亮着的灯和玻璃反光' : '',
    /地铁|车厢|公交|路上/i.test(normalized) ? '路上随手拍到的倒影' : '',
    /工位|电脑|表格|会议|文件|键盘/i.test(normalized) ? '桌上摊着的东西' : '',
    /猫|狗|宠物|cat|dog/i.test(normalized) ? '镜头里那只小东西' : '',
    /下雨|雨伞|雨/i.test(normalized) ? '伞边垂下来的雨线' : '',
    /晚风|夜风|风/i.test(normalized) ? '被风吹乱的一小块画面' : '',
    /手|指尖|掌心/i.test(normalized) ? '指尖捏着的一点东西' : '',
  ].filter(Boolean) as string[];

  return Array.from(new Set(directions));
}

function normalizeMomentVisualTextLine(text: string) {
  return text
    .replace(/^[\d\-•.、\s]+/, '')
    .replace(/[。！？!?,，；;:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMomentVisualTextLines(text: string, maxItems: number): string[] {
  return Array.from(new Set(
    text
      .replace(/\r/g, '')
      .split(/\n+/)
      .map((line) => normalizeMomentVisualTextLine(line))
      .filter(Boolean)
      .filter((line) => !/某人|某些人|someone|some people/i.test(line))
      .slice(0, maxItems),
  ));
}

async function generateMomentVisualTextLines(options: {
  activeConfig: ApiConfig;
  character: Character;
  momentContent: string;
  frameCount: number;
}) {
  const { activeConfig, character, momentContent, frameCount } = options;
  const prompt = [
    'You are generating short text overlays for pseudo-images in a social post.',
    `The role name is ${character.name}.`,
    `Post body:\n${momentContent}`,
    `Need ${frameCount} different image-text lines.`,
    'Each line should describe what can be seen in a picture, not repeat the whole post.',
    'Prefer visible things: object, place, selfie, body part, clothing, food, pet, desk, mirror, light, weather, screen, room corner, street, store, gym, or a captured gesture.',
    'Use the same language as the post body.',
    'Do not use placeholders like 某人, 某些人, someone, some people.',
    'Each line should feel like a small visual focus, concise and specific.',
    'Output one line per image, no numbering, no commentary.',
  ].join('\n');

  const raw = await generateSingleText({
    activeConfig,
    prompt: 'Generate visual overlay lines for a pseudo-image post.',
    requestText: prompt,
    fallback: '',
  });

  return parseMomentVisualTextLines(raw, frameCount);
}

function buildMomentFrameCaptions(content: string, frameCount: number): string[] {
  const normalized = content.replace(/\r/g, '').trim();
  if (!normalized || frameCount <= 1) {
    return [];
  }

  const fragments = normalized
    .split(/\n+/)
    .flatMap((line) => line.split(/[，,。！？!?\u2026]/))
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const merged = Array.from(new Set([
    ...buildMomentVisualDirections(normalized),
    ...fragments
      .map((item) => item.slice(0, 16).trim())
      .filter(Boolean),
  ]));
  if (merged.length === 0) {
    return [];
  }

  return merged.slice(0, frameCount);
}

function needsMomentVisualTranslation(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  return !/[\u4e00-\u9fff]/u.test(normalized) && /[A-Za-z]/.test(normalized);
}

function buildFallbackMomentVisualTranslations(lines: string[]) {
  return lines.map((line) => (
    needsMomentVisualTranslation(line) ? createChineseMomentPhotoDescription(line) : line.trim()
  ));
}

async function generateMomentVisualTranslations(options: {
  activeConfig: ApiConfig;
  lines: string[];
}) {
  const lines = options.lines
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0 || !lines.some(needsMomentVisualTranslation)) {
    return undefined;
  }

  const fallbackTranslations = buildFallbackMomentVisualTranslations(lines);
  const prompt = [
    'Translate the following pseudo-image caption lines into natural Simplified Chinese.',
    'Keep one translated line for each original line in the same order.',
    'Do not add numbering, quotes, commentary, or extra lines.',
    'If a line is already natural Simplified Chinese, keep it as-is.',
    '',
    'Original lines:',
    ...lines.map((line, index) => `${index + 1}. ${line}`),
  ].join('\n');

  const raw = await generateSingleText({
    activeConfig: options.activeConfig,
    prompt: 'Translate pseudo-image caption lines into Simplified Chinese.',
    requestText: prompt,
    fallback: '',
  });

  const parsed = parseMomentVisualTextLines(raw, lines.length);
  const translatedLines = parsed.length === lines.length
    ? parsed.map((line, index) => line.trim() || fallbackTranslations[index] || lines[index])
    : fallbackTranslations;

  return translatedLines.every((line, index) => line === lines[index]) ? undefined : translatedLines;
}

async function generateMomentImageCard(options: {
  activeConfig: ApiConfig;
  character: Character;
  momentContent: string;
  blueprint?: MomentPostBlueprint;
}): Promise<MomentImageCard | undefined> {
  const { activeConfig, character, momentContent, blueprint } = options;
  const normalized = momentContent.trim();
  if (!normalized) return undefined;

  const themePool: MomentImageCard['theme'][] = ['polaroid', 'film', 'note', 'poster'];
  const theme = blueprint?.preferredTheme || themePool[hashString(`${character.id}:${normalized}`) % themePool.length];
  const layout = blueprint?.preferredLayout || ((hashString(`${character.id}:${normalized}`) % 100) < 62 ? 'described-photo' : 'card');
  const firstParagraph = normalized.split(/\n+/)[0]?.trim() || normalized;
  const requestedFrameCount = blueprint?.shape === 'photo_dump'
    ? [4, 6, 9][hashString(`${character.id}:${normalized}:frames`) % 3]
    : blueprint?.shape === 'music_diary' || blueprint?.shape === 'cheerful_share'
      ? 4
      : 1;
  const generatedVisualLines = await generateMomentVisualTextLines({
    activeConfig,
    character,
    momentContent: normalized,
    frameCount: requestedFrameCount,
  });
  const frameCaptions = requestedFrameCount > 1
    ? (generatedVisualLines.length > 1 ? generatedVisualLines : buildMomentFrameCaptions(normalized, requestedFrameCount))
    : [];
  const overlayText = generatedVisualLines[0]
    || buildMomentVisualDirections(firstParagraph)[0]
    || createChineseMomentPhotoDescription(firstParagraph);
  const visualLines = frameCaptions.length > 1 ? frameCaptions : [overlayText];
  const translatedVisualLines = await generateMomentVisualTranslations({
    activeConfig,
    lines: visualLines,
  });

  return {
    title: `${character.name} 的动态`,
    description: createChineseMomentPhotoDescription(normalized),
    theme,
    layout,
    overlayText,
    translatedOverlayText: translatedVisualLines && visualLines.length === 1 ? translatedVisualLines[0] : undefined,
    frameCaptions: frameCaptions.length > 1 ? frameCaptions : undefined,
    translatedFrameCaptions: translatedVisualLines && frameCaptions.length > 1 ? translatedVisualLines : undefined,
  };
}

export async function generateMomentPostContent(options: {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBook: WorldBookEntry[];
  requestText: string;
  extraPromptSections?: string[];
  privateCarryoverLevel?: MomentPrivateCarryoverLevel;
  allowPrivateMomentCarryover?: boolean;
}): Promise<GeneratedMomentPost> {
  const {
    activeConfig,
    character,
    masks,
    worldBook,
    requestText,
    extraPromptSections = [],
    privateCarryoverLevel,
    allowPrivateMomentCarryover = false,
  } = options;
  const momentMode = inferMomentPostMode(requestText);
  const languagePlan = resolveMomentLanguagePlan(character);
  const translationInstructions = buildMomentTranslationInstruction(languagePlan);
  const combinedRequestText = [
    ...extraPromptSections.filter((section) => section.trim()),
    requestText,
  ].join('\n\n');
  const blueprint = buildMomentPostBlueprint({
    character,
    requestText: combinedRequestText,
    mode: momentMode,
  });
  const fallback = getCleanMomentFallback(blueprint.shape);

  const firstPrompt = buildBalancedMomentPostPrompt({
    character,
    masks,
    worldBook,
    triggerHint: 'Generate a publishable public post body. This is not a chat reply.',
    mode: momentMode,
    blueprint,
    privateCarryoverLevel,
    allowPrivateMomentCarryover,
    extraStyleHints: translationInstructions,
  });

  const firstRaw = await generateSingleText({
    activeConfig,
    prompt: firstPrompt,
    requestText: `Generate one publishable public post body. Trigger: ${combinedRequestText}`,
    fallback,
  });
  const firstParts = splitMomentTranslationParts(firstRaw);
  const firstPass = normalizeGeneratedMomentContent(firstParts.mainText, blueprint.maxChars, blueprint.shape);
  const firstTranslation = normalizeMomentTranslationText(firstParts.translation);

  if (!isContaminatedMomentContent(firstPass, momentMode) && (!languagePlan.needsTranslation || !!firstTranslation)) {
    return {
      content: firstPass,
      ...(firstTranslation ? { translation: firstTranslation } : {}),
      imageCard: await generateMomentImageCard({
        activeConfig,
        character,
        momentContent: firstPass,
        blueprint,
      }),
    };
  }

  const retryPrompt = buildBalancedMomentPostPrompt({
    character,
    masks,
    worldBook,
    triggerHint: 'Regenerate a clean public post body. Remove task narration and direct-chat residue.',
    mode: momentMode,
    blueprint,
    privateCarryoverLevel,
    allowPrivateMomentCarryover,
    extraStyleHints: [
      'Do not write the post as direct speech to the user.',
      'Do not make the whole post orbit around the user.',
      'Prefer the character’s own life fragments, interests, observations, and state.',
      'Write it as a post that has already been published.',
      'Allow real paragraph breaks when the shape fits; do not flatten everything into one sentence.',
      'Keep a human social-feed feeling: not too tidy, not too official, not too AI-polished.',
      ...translationInstructions,
    ],
  });

  const secondRaw = await generateSingleText({
    activeConfig,
    prompt: retryPrompt,
    requestText: `Regenerate one publishable public post body. Trigger: ${combinedRequestText}`,
    fallback,
  });
  const secondParts = splitMomentTranslationParts(secondRaw);
  const secondPass = normalizeGeneratedMomentContent(secondParts.mainText, blueprint.maxChars, blueprint.shape);
  const secondTranslation = normalizeMomentTranslationText(secondParts.translation);

  if (!isContaminatedMomentContent(secondPass, momentMode) && (!languagePlan.needsTranslation || !!secondTranslation)) {
    return {
      content: secondPass,
      ...(secondTranslation ? { translation: secondTranslation } : {}),
      imageCard: await generateMomentImageCard({
        activeConfig,
        character,
        momentContent: secondPass,
        blueprint,
      }),
    };
  }

  return {
    content: fallback,
    imageCard: await generateMomentImageCard({
      activeConfig,
      character,
      momentContent: fallback,
      blueprint,
    }),
  };
}

export async function generateMomentChatReaction(options: {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBook: WorldBookEntry[];
  requestText: string;
}) {
  const { activeConfig, character, masks, worldBook, requestText } = options;

  const reactionPrompt = buildChatPrompt({
    mode: 'chat',
    characterCore: buildMomentCharacterCore({ character, masks, worldBook }),
    memoryContext: buildMomentMemoryContext(character),
    sections: [
      [
        '【特殊当前任务】用户刚刚要你去发一条动态。',
        '你现在只需要先在聊天里自然回用户一句，像聊天回复，不是动态正文。',
        '要求：1 到 2 句；可以答应、吐槽、接梗，但不要提前把动态正文说出来。',
        '不要出现“我发一条”“我去发个动态”这种预告式表达。',
      ].join('\n'),
    ],
  });

  const reaction = normalizeChatReaction(await generateSingleText({
    activeConfig,
    prompt: reactionPrompt,
    requestText: `请先在聊天里自然回应这次发动态请求：${requestText}`,
    fallback: getCleanChatReactionFallback(),
  }));

  if (isContaminatedChatReaction(reaction)) {
    return getCleanChatReactionFallback();
  }

  return reaction;
}

export function buildFallbackMomentCommentReply(
  replyCharacter: Character,
  moment: MomentLike,
  userComment: string,
  recentReplies: string[],
) {
  return '';
  const commentType = classifyMomentCommentType(userComment);
  const content = moment.content.trim();
  const pools: Record<string, string[]> = {
    '无意义搭话 / 测试话': ['别水我。', '又来试探我？', '你这也太敷衍了。', '发个正经评论行不行。'],
    '调侃 / 接梗': ['行，你这梗我接了。', '嘴还挺会贫。', '你这句倒是挺到位。', '又被你接上了。'],
    '吐槽': ['我也没说错吧。', '你先别急着嫌弃。', '这条就是给你吐槽的。', '我发这句本来就带点怨气。'],
    '冒犯 / 骂人': ['嘴这么冲干啥。', '行，你今天火气不小。', '少来这套。', '你这是专门来呛我？'],
    '求助 / 认真问': ['先别慌，我看一眼。', '你先说细一点。', '这条底下问我，算你找对人。', '行，我接着跟你说。'],
    '普通评论': ['你这句我收到了。', '这条底下回你一句。', '行，我看到你这句了。', '你倒是会挑地方说。'],
  };

  const toneBoost = /烦|累|无语|离谱|崩/.test(content)
    ? ['我这条本来就带点烦。', '你正好撞我这会儿情绪上。']
    : /哈哈|开心|好耶|笑死/.test(content)
      ? ['你这句接得还挺顺。', '行，这条底下算你接住了。']
      : [];

  const candidates = [...(pools[commentType] || pools['普通评论']), ...toneBoost];
  const lowerRecent = recentReplies.map((item) => item.toLowerCase());
  const picked = candidates.find((item) => !lowerRecent.some((recent) => recent.includes(item.toLowerCase())));
  if (!picked) return '';
  return picked;

  return picked || candidates[0] || `${replyCharacter.name} 看到了。`;
}

export async function generateMomentCommentReply(options: {
  activeConfig: ApiConfig;
  replyCharacter: Character;
  moment: MomentLike;
  userComment: string;
  characters: Character[];
  chatGroups?: import('../../types').ChatGroup[];
  userName: string;
}) {
  const { activeConfig, replyCharacter, moment, userComment, characters, userName } = options;
  const recentCommentReplies = getRecentMomentReplyContext(moment, characters, userName);
  const commentType = classifyMomentCommentType(userComment);
  const fallback = buildFallbackMomentCommentReply(replyCharacter, moment, userComment, recentCommentReplies);

  const prompt = buildMomentCommentReplyPrompt({
    characterCore: {
      characterSetting: buildCharacterContext({ character: replyCharacter }).corePersona ?? '',
    },
    memoryContext: buildMomentMemoryContext(replyCharacter),
    momentContext: {
      momentContent: moment.content,
      momentTone: inferMomentTone(moment.content),
      momentIntent: inferMomentIntent(moment.content),
      signature: replyCharacter.signature,
      relationship: '角色在自己动态的评论区里回复用户',
      commentType,
      userComment,
      recentCommentReplies,
      maxLength: 30,
      replyStyleHints: [
        '要贴着动态正文接话。',
        '像评论区顺手回一句。',
        '不要展开成长解释。',
        '最近几条回复不要重复句型。',
      ],
    },
  });

  const response = normalizeChatReaction(await generateSingleText({
    activeConfig,
    prompt,
    requestText: `请以评论区回复的方式，自然回应这条用户评论：${userComment}`,
    fallback,
  }));

  return response || fallback;
}

export async function generateMomentAutoComment(options: {
  activeConfig: ApiConfig;
  replyCharacter: Character;
  moment: MomentLike;
  characters: Character[];
  chatGroups?: import('../../types').ChatGroup[];
  userName: string;
}) {
  const { activeConfig, replyCharacter, moment, characters, chatGroups, userName } = options;
  const recentCommentReplies = getRecentMomentReplyContext(moment, characters, userName);
  const fallbackPool = [
    '这条我看到了。',
    '行，这句有点意思。',
    '先记一笔。',
    '这状态我懂。',
  ];
  const fallback = '';
  const momentAuthor = characters.find((character) => character.id === moment.authorId) || null;
  const relationProfile = momentAuthor
    ? getCharacterPublicThreadProfile(replyCharacter, momentAuthor, chatGroups || [])
    : null;
  const relationHint = !momentAuthor
    ? '这是公开动态下的一句短评。'
    : relationProfile?.familiarity === 'familiar'
      ? relationProfile.allowIntimateTone
        ? '你和动态作者确实比较熟，可以自然接一句，但还是评论区，不是私聊。'
        : '你和动态作者虽然比较熟，但这层熟不等于能说亲密话，保持熟人感即可。'
      : relationProfile?.familiarity === 'aware'
        ? '你和动态作者只是认识或半熟，语气自然一点，但不要演成熟人私聊。'
        : relationProfile?.userOverlap !== 'none'
          ? '你和动态作者并不熟，只是可能会因为同一个人多看彼此两眼，所以只能非常克制地接一句。'
          : '你和动态作者不熟，这句更像顺着场合留一句，不要亲密。';
  const relationStyleHint = relationProfile?.familiarity === 'familiar'
    ? relationProfile.allowBanter
      ? '允许一点熟人感，但不要把评论区聊成你们自己的小窗。'
      : '虽然彼此比较熟，但别互怼玩梗，收得自然一点。'
    : '不要突然变亲密，更不要替作者认领谁、替作者做主或站位。';
  const relationNoteHint = relationProfile?.note?.trim()
    ? `补充关系备注：${relationProfile.note.trim()}`
    : '';

  const prompt = buildMomentCommentReplyPrompt({
    characterCore: {
      characterSetting: buildCharacterContext({ character: replyCharacter }).corePersona ?? '',
    },
    memoryContext: buildMomentMemoryContext(replyCharacter),
    momentContext: {
      momentContent: moment.content,
      momentTone: inferMomentTone(moment.content),
      momentIntent: inferMomentIntent(moment.content),
      signature: replyCharacter.signature,
      relationship: relationHint,
      commentType: '自动评论',
      userComment: '请对这条动态留一句自然短评。',
      recentCommentReplies,
      maxLength: 24,
      replyStyleHints: [
        '像评论区顺手留一句短评。',
        '可以是态度、接梗、轻吐槽或认可。',
        '不要写成私聊回复。',
        relationStyleHint,
        ...(relationNoteHint ? [relationNoteHint] : []),
      ],
    },
  });

  const response = normalizeChatReaction(await generateSingleText({
    activeConfig,
    prompt,
    requestText: `请为这条动态写一句自然短评：${moment.content}`,
    fallback,
  }));

  if (replyCharacter.id !== moment.authorId && response && hasOwnershipClaimRisk(response)) {
    return fallback;
  }

  return response || fallback;
}
