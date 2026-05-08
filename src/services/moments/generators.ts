import { Character, Mask, ApiConfig, MomentImageCard, WorldBookEntry } from '../../types';
import { buildChatPrompt } from '../ai/prompts/builders/buildChatPrompt';
import { buildMomentCommentReplyPrompt } from '../ai/prompts/builders/buildMomentCommentReplyPrompt';
import { buildMomentsPrompt } from '../ai/prompts/builders/buildMomentsPrompt';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';
import { buildCharacterContext, buildUserMaskPrompt } from '../relationship-context/buildCharacterContext';
import { buildSharedCharacterStateFromCharacter } from '../relationship-context/buildSharedCharacterState';
import { buildBudgetedWorldBookPrompt } from '../world-book/worldBookBudget';
import { sortWorldBooksByPriority } from '../world-book/worldBookMeta';
import {
  classifyMomentCommentType,
  getRecentMomentReplyContext,
  inferMomentIntent,
  inferMomentTone,
} from './triggers';

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

function buildMaskPrompt(characterId: string, masks: Mask[]) {
  const activeMask = masks.find((mask) => mask.isActive && mask.linkedCharacters.includes(characterId));
  return buildUserMaskPrompt(activeMask) || '';
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

function buildMomentMemoryContext(character: Character) {
  const layers = buildResolvedMemoryLayers(character);
  const sharedCharacterState = buildSharedCharacterStateFromCharacter({
    character,
  });
  const lifeFlavor = [
    character.signature?.trim() ? `公开底色：${character.signature.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    shortTermSummary: layers.shortTermSummary?.trim()
      ? `近期余波（只作背景，不要整条围着用户转）：${layers.shortTermSummary.trim()}`
      : '',
    longTermMemoryProfile: layers.longTermMemoryProfile?.trim()
      ? `长期印象（保持角色连续性，但不要独占主题）：${layers.longTermMemoryProfile.trim()}`
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
}) {
  const { character, masks, worldBook, triggerHint, extraStyleHints = [], mode = 'public_daily' } = options;

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

  return buildMomentsPrompt({
    characterCore: buildMomentCharacterCore({ character, masks, worldBook }),
    memoryContext: buildMomentMemoryContext(character),
    postContext: {
      signature: character.signature,
      relationship,
      maxLength: 50,
      allowImages: false,
      triggerReason: triggerHint || '当前是在生成一条已经准备公开发出的动态正文。这不是私聊回复。',
      styleHints: [
        ...styleHints,
        '不要写成任务说明。',
        '不要出现“你让我发”“那我发一条”这类过渡句。',
        '像角色自己会发的一条公开状态。',
        ...extraStyleHints,
      ],
    },
  });
}

function normalizeGeneratedMomentContent(text: string) {
  return text
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\r/g, '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .join(' ')
    .slice(0, 120);
}

function isContaminatedMomentContent(text: string) {
  const normalized = text.trim();
  if (!normalized) return true;
  return MOMENT_BAD_PATTERNS.some((pattern) => pattern.test(normalized));
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

function getCleanMomentFallback() {
  return MOMENT_FALLBACKS[Math.floor(Math.random() * MOMENT_FALLBACKS.length)];
}

function getCleanChatReactionFallback() {
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

async function generateMomentImageCard(options: {
  activeConfig: ApiConfig;
  character: Character;
  momentContent: string;
}): Promise<MomentImageCard | undefined> {
  const { character, momentContent } = options;
  const normalized = momentContent.trim();
  if (!normalized) return undefined;

  const themePool: MomentImageCard['theme'][] = ['polaroid', 'film', 'note', 'poster'];
  const theme = themePool[hashString(`${character.id}:${normalized}`) % themePool.length];

  return {
    title: `${character.name} 的动态`,
    description: createChineseMomentPhotoDescription(normalized),
    theme,
    layout: (hashString(`${character.id}:${normalized}`) % 100) < 62 ? 'described-photo' : 'card',
    overlayText: createChineseMomentPhotoDescription(normalized),
  };
}

export async function generateMomentPostContent(options: {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBook: WorldBookEntry[];
  requestText: string;
  extraPromptSections?: string[];
}): Promise<GeneratedMomentPost> {
  const {
    activeConfig,
    character,
    masks,
    worldBook,
    requestText,
    extraPromptSections = [],
  } = options;
  const fallback = getCleanMomentFallback();
  const momentMode = inferMomentPostMode(requestText);
  const combinedRequestText = [
    ...extraPromptSections.filter((section) => section.trim()),
    requestText,
  ].join('\n\n');

  const firstPrompt = buildBalancedMomentPostPrompt({
    character,
    masks,
    worldBook,
    triggerHint: 'Generate a publishable public post body. This is not a chat reply.',
    mode: momentMode,
  });

  const firstPass = normalizeGeneratedMomentContent(await generateSingleText({
    activeConfig,
    prompt: firstPrompt,
    requestText: `Generate one publishable public post body. Trigger: ${combinedRequestText}`,
    fallback,
  }));

  if (!isContaminatedMomentContent(firstPass)) {
    return {
      content: firstPass,
      imageCard: await generateMomentImageCard({
        activeConfig,
        character,
        momentContent: firstPass,
      }),
    };
  }

  const retryPrompt = buildBalancedMomentPostPrompt({
    character,
    masks,
    worldBook,
    triggerHint: 'Regenerate a clean public post body. Remove task narration and direct-chat residue.',
    mode: momentMode,
    extraStyleHints: [
      'Do not write the post as direct speech to the user.',
      'Do not make the whole post orbit around the user.',
      'Prefer the character’s own life fragments, interests, observations, and state.',
      'Write it as a post that has already been published.',
    ],
  });

  const secondPass = normalizeGeneratedMomentContent(await generateSingleText({
    activeConfig,
    prompt: retryPrompt,
    requestText: `Regenerate one publishable public post body. Trigger: ${combinedRequestText}`,
    fallback,
  }));

  if (!isContaminatedMomentContent(secondPass)) {
    return {
      content: secondPass,
      imageCard: await generateMomentImageCard({
        activeConfig,
        character,
        momentContent: secondPass,
      }),
    };
  }

  return {
    content: fallback,
    imageCard: await generateMomentImageCard({
      activeConfig,
      character,
      momentContent: fallback,
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

  return picked || candidates[0] || `${replyCharacter.name} 看到了。`;
}

export async function generateMomentCommentReply(options: {
  activeConfig: ApiConfig;
  replyCharacter: Character;
  moment: MomentLike;
  userComment: string;
  characters: Character[];
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
  userName: string;
}) {
  const { activeConfig, replyCharacter, moment, characters, userName } = options;
  const recentCommentReplies = getRecentMomentReplyContext(moment, characters, userName);
  const fallbackPool = [
    '这条我看到了。',
    '行，这句有点意思。',
    '先记一笔。',
    '这状态我懂。',
  ];
  const fallback = fallbackPool[hashString(`${replyCharacter.id}:${moment.content}`) % fallbackPool.length];

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
      relationship: '角色在公开动态下顺手留一句评论',
      commentType: '自动评论',
      userComment: '请对这条动态留一句自然短评。',
      recentCommentReplies,
      maxLength: 24,
      replyStyleHints: [
        '像评论区顺手留一句短评。',
        '可以是态度、接梗、轻吐槽或认可。',
        '不要写成私聊回复。',
      ],
    },
  });

  const response = normalizeChatReaction(await generateSingleText({
    activeConfig,
    prompt,
    requestText: `请为这条动态写一句自然短评：${moment.content}`,
    fallback,
  }));

  return response || fallback;
}
