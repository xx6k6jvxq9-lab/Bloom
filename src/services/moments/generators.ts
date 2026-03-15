import { GoogleGenAI } from '@google/genai';
import { Character, Mask, ApiConfig, WorldBookEntry } from '../../types';
import { buildChatPrompt } from '../ai/prompts/builders/buildChatPrompt';
import { buildMomentCommentReplyPrompt } from '../ai/prompts/builders/buildMomentCommentReplyPrompt';
import { buildMomentsPrompt } from '../ai/prompts/builders/buildMomentsPrompt';
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
  comments: MomentCommentLike[];
};

const MOMENT_TEMPLATES = [
  '今天不太想说话。',
  '嘴上说没事，其实有点累。',
  '晚上的风一吹，人安静了一点。',
  '今天适合少解释。',
  '状态一般，先这样。',
  '风有点大，脑子也有点乱。',
];

const MOMENT_BAD_SAMPLE_PATTERNS = [
  /发动态/,
  /我发一条/,
  /我发一个/,
  /你让我发/,
  /那我发/,
  /我去发/,
  /给你发/,
  /发点什么/,
  /这条动态/,
  /要我发什么/,
  /你想看什么动态/,
  /我来发/,
];

const CHAT_REACTION_PREVIEW_PATTERNS = [
  /我发一句/,
  /我发个/,
  /我准备发/,
  /我去发个/,
  /给你发个/,
  /发条/,
  /动态[:：]/,
  /状态[:：]/,
];

function buildMaskPrompt(characterId: string, masks: Mask[]) {
  const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(characterId));
  return activeMask
    ? `Name: ${activeMask.name || ''}\nPersonality: ${activeMask.personality || ''}\nOccupation: ${activeMask.occupation || ''}\nRelationship with you: ${activeMask.relationship || ''}\nWorld Background: ${activeMask.worldBackground || 'Standard'}`
    : '';
}

function buildWorldBookPrompt(character: Character, worldBook: WorldBookEntry[]) {
  const activeWorldBooks = worldBook.filter(wb =>
    (wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id))) ||
    character.activeWorldBookIds?.includes(wb.id)
  );

  return activeWorldBooks.length > 0
    ? activeWorldBooks.map(wb => `[${wb.category}] ${wb.title}:\n${wb.content}`).join('\n\n')
    : '';
}

function isGeminiConfig(activeConfig: ApiConfig) {
  return activeConfig.provider === 'Google Gemini' || (!activeConfig.baseUrl && activeConfig.provider === '自定义 (Custom)');
}

function getCleanMomentFallback() {
  return MOMENT_TEMPLATES[Math.floor(Math.random() * MOMENT_TEMPLATES.length)];
}

function getCleanChatReactionFallback() {
  const fallbackReactions = [
    '行，等着。',
    '知道了，别催。',
    '又使唤我了是吧。',
    '行，我去弄。',
  ];
  return fallbackReactions[Math.floor(Math.random() * fallbackReactions.length)];
}

function normalizeGeneratedMomentContent(text: string) {
  return text
    .trim()
    .replace(/^["“”'\s]+|["“”'\s]+$/g, '')
    .replace(/^(动态|状态|朋友圈)[:：]\s*/i, '')
    .trim();
}

function isContaminatedMomentContent(text: string) {
  const normalized = normalizeGeneratedMomentContent(text);
  if (!normalized) return true;
  return MOMENT_BAD_SAMPLE_PATTERNS.some(pattern => pattern.test(normalized));
}

function normalizeChatReaction(text: string) {
  return text.replace(/\r?\n+/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

function isContaminatedChatReaction(text: string) {
  const normalized = normalizeChatReaction(text);
  if (!normalized) return true;
  if (normalized.length > 24) return true;
  if (normalized.split(/[。！？!?]/).filter(Boolean).length > 2) return true;
  if (CHAT_REACTION_PREVIEW_PATTERNS.some(pattern => pattern.test(normalized))) return true;
  if (normalized.includes('“') || normalized.includes('"') || normalized.includes('：')) return true;
  return false;
}

async function generateSingleText(options: {
  activeConfig: ApiConfig;
  prompt: string;
  fallback: string;
}) {
  const { activeConfig, prompt, fallback } = options;
  const apiKey = activeConfig.apiKey || process.env.GEMINI_API_KEY;
  const isGemini = isGeminiConfig(activeConfig);

  if (apiKey) {
    if (isGemini) {
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const response = await ai.models.generateContent({
        model: activeConfig.model || 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: activeConfig.temperature ?? 1.0,
        }
      });
      return (response.text || '').trim();
    }

    const baseUrl = activeConfig.baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: activeConfig.model,
        messages: [{ role: 'system', content: prompt }],
        temperature: activeConfig.temperature ?? 0.7,
        stream: false
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API 错误 (${res.status})`);
    }

    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  }

  return fallback.trim();
}

function buildMomentPostPrompt(options: {
  character: Character;
  masks: Mask[];
  worldBook: WorldBookEntry[];
  triggerHint?: string;
  extraStyleHints?: string[];
}) {
  const { character, masks, worldBook, triggerHint, extraStyleHints = [] } = options;
  return buildMomentsPrompt({
    characterCore: {
      characterSetting: character.setting,
      maskPrompt: buildMaskPrompt(character.id, masks),
      worldBookPrompt: buildWorldBookPrompt(character, worldBook),
    },
    memoryContext: {
      memorySummary: character.memorySummary?.trim() || '',
    },
    postContext: {
      signature: character.signature,
      relationship: '角色在社交动态页发一条公开可见的状态',
      maxLength: 50,
      allowImages: false,
      triggerReason: triggerHint || '当前是一次发动态行为，需要生成一条已经准备发布到动态页的公开正文。',
      styleHints: [
        '直接给出要发布的动态正文',
        '不要回应用户指令',
        '不要写成私聊回复',
        '不要写成任务说明',
        '不要出现“你让我发”“那我发一条”“我来发”这类过渡句',
        '像角色自己会发的状态',
        ...extraStyleHints,
      ],
    },
  });
}

export async function generateMomentPostContent(options: {
  activeConfig: ApiConfig;
  character: Character;
  masks: Mask[];
  worldBook: WorldBookEntry[];
  requestText: string;
}) {
  const { activeConfig, character, masks, worldBook } = options;
  const fallback = getCleanMomentFallback();

  const firstPrompt = buildMomentPostPrompt({
    character,
    masks,
    worldBook,
    triggerHint: '当前是一次发动态行为，需要生成一条角色已经准备公开发布的动态正文。这不是聊天回复。',
  });

  const firstPass = normalizeGeneratedMomentContent(await generateSingleText({
    activeConfig,
    prompt: firstPrompt,
    fallback,
  }));

  if (!isContaminatedMomentContent(firstPass)) {
    return firstPass;
  }

  const retryPrompt = buildMomentPostPrompt({
    character,
    masks,
    worldBook,
    triggerHint: '重新生成一条真正的动态正文。上一版带有任务解释或对用户说话的痕迹，这次只保留角色本人会发的状态内容。',
    extraStyleHints: [
      '绝对不要提用户要求你发动态',
      '绝对不要出现“发动态”“我发一条”“给你发”之类字样',
      '把内容写成已经发出去的一条状态',
    ],
  });

  const secondPass = normalizeGeneratedMomentContent(await generateSingleText({
    activeConfig,
    prompt: retryPrompt,
    fallback,
  }));

  if (!isContaminatedMomentContent(secondPass)) {
    return secondPass;
  }

  return fallback;
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
    characterCore: {
      characterSetting: character.setting,
      maskPrompt: buildMaskPrompt(character.id, masks),
      worldBookPrompt: buildWorldBookPrompt(character, worldBook),
    },
    memoryContext: {
      memorySummary: character.memorySummary?.trim() || '',
    },
    sections: [
      `【特殊当前任务】
用户刚刚要求你去发一条动态，原话是：“${requestText}”

你现在只需要在聊天里先回用户一句自然反应。
这句是聊天回复，不是动态正文，也不是动态预告。

要求：
1. 只回复 1 到 2 句短反应。
2. 可以答应、吐槽、嘴硬、敷衍、接梗，但要像对用户说话。
3. 不要直接输出准备发布的动态正文。
4. 不要提前说出你打算发什么内容。
5. 不要出现“我发一句……”“我去发个……”“我准备发……”这种预告式表达。`
    ],
  });

  const reaction = normalizeChatReaction(await generateSingleText({
    activeConfig,
    prompt: reactionPrompt,
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
    '无意义搭话 / 测试词': [
      '别水我。',
      '又来试探我？',
      '你这也太敷衍了。',
      '发个正经评论行不行。',
    ],
    '调侃 / 接梗': [
      '行，你这梗我接了。',
      '嘴还挺会贫。',
      '你这句倒是挺到位。',
      '又被你接上了。',
    ],
    '吐槽': [
      '我也没说错吧。',
      '你先别急着嫌弃。',
      '这条就是给你吐槽的。',
      '我发这句本来就带点怨气。',
    ],
    '冒犯 / 骂人': [
      '嘴这么冲干嘛。',
      '行，你今天火气不小。',
      '少来这套。',
      '你这是专门来呛我？',
    ],
    '求助 / 认真问': [
      '先别慌，我看一眼。',
      '你先说细一点。',
      '这条底下问我，算你找对人。',
      '行，我接着跟你说。',
    ],
    '普通评论': [
      '你这句我收到了。',
      '这条底下回你一句。',
      '行，我看到你这句了。',
      '你倒是会挑地方说。',
    ],
  };

  const toneBoost = /困|累|烦|无语|离谱|崩/.test(content)
    ? ['我这条本来就带点烦。', '你正好撞我这会儿情绪上。']
    : /哈哈|开心|好耶|笑死/.test(content)
      ? ['你这句接得还挺顺。', '行，这条底下算你接住了。']
      : [];

  const candidates = [...(pools[commentType] || pools['普通评论']), ...toneBoost];
  const lowerRecent = recentReplies.map(item => item.toLowerCase());
  const picked = candidates.find(item => !lowerRecent.some(recent => recent.includes(item.toLowerCase())));

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

  if (!activeConfig.apiKey) {
    return buildFallbackMomentCommentReply(replyCharacter, moment, userComment, recentCommentReplies);
  }

  try {
    const prompt = buildMomentCommentReplyPrompt({
      characterCore: {
        characterSetting: replyCharacter.setting,
      },
      memoryContext: {
        memorySummary: replyCharacter.memorySummary?.trim() || '',
      },
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
          '要贴着动态正文接话',
          '延续发动态时的状态',
          '像评论区顺手回一句',
          '不要展开解释',
          '最近几条回复不要重复句型',
          '按评论类型自然区分回应方式',
        ],
      },
    });

    const response = await generateSingleText({
      activeConfig,
      prompt,
      fallback: buildFallbackMomentCommentReply(replyCharacter, moment, userComment, recentCommentReplies),
    });

    return response || buildFallbackMomentCommentReply(replyCharacter, moment, userComment, recentCommentReplies);
  } catch {
    return buildFallbackMomentCommentReply(replyCharacter, moment, userComment, recentCommentReplies);
  }
}
