import type { ApiConfig } from '../../../types';
import { generateTextFromMessagesWithConfig } from '../../ai/runtimeClient';
import type { CoupleSpaceInviteContext } from './coupleSpaceInviteTypes';
import { buildCoupleSpaceInviteReplyPrompt } from './buildCoupleSpaceInviteReplyPrompt';

const TSUNDERE_REGEX = /嘴硬|别扭|傲娇|毒舌|口是心非|不坦率|爱逗|逞强/i;
const GUARDED_REGEX = /高冷|克制|谨慎|边界|冷淡|疏离|寡言|慢热|理性/i;
const WARM_REGEX = /温柔|黏人|热烈|偏爱|宠|撒娇|直球|心软|体贴|喜欢|想你|亲昵/i;
const TENDER_RECENT_REGEX = /想你|喜欢|爱你|抱抱|亲亲|宝|宝宝|想见|舍不得|陪你|心动/i;
const PLAYFUL_RECENT_REGEX = /哈哈|笑死|开心|有意思|好耶|乐死|逗|闹|坏心眼|好玩/i;
const AWKWARD_RECENT_REGEX = /吃醋|别扭|不理|生气|委屈|凶我|过分|烦你|讨厌|冷战/i;
const INVITE_REPLY_BAD_PATTERNS = [
  /\[COUPLE_SPACE_INVITE/i,
  /\[COUPLE_SPACE_INVITE_ACCEPTED/i,
  /输出要求|回应目标|最近聊天|当前事件/,
  /系统卡片|功能提示|建立成功|接受邀请/,
];

const normalizeInviteReply = (text?: string | null): string => {
  return (text ?? '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\r/g, '')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 96);
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

function buildInviteEvidence(context: CoupleSpaceInviteContext): string {
  return [
    context.characterSetting,
    context.character.signature,
    context.character.openingRemark,
  ]
    .filter(Boolean)
    .join('\n');
}

function inferInviteStyle(context: CoupleSpaceInviteContext): 'tsundere' | 'guarded' | 'warm' | 'steady' {
  const evidence = buildInviteEvidence(context);
  if (TSUNDERE_REGEX.test(evidence)) {
    return 'tsundere';
  }
  if (GUARDED_REGEX.test(evidence)) {
    return 'guarded';
  }
  if (WARM_REGEX.test(evidence)) {
    return 'warm';
  }
  return 'steady';
}

function inferInviteMood(context: CoupleSpaceInviteContext): 'tender' | 'playful' | 'awkward' | 'calm' {
  const transcript = context.recentMessages
    .map((message) => message.text?.trim() || '')
    .filter(Boolean)
    .join('\n');

  if (AWKWARD_RECENT_REGEX.test(transcript)) {
    return 'awkward';
  }
  if (PLAYFUL_RECENT_REGEX.test(transcript)) {
    return 'playful';
  }
  if (TENDER_RECENT_REGEX.test(transcript)) {
    return 'tender';
  }
  return 'calm';
}

function inferInviteCloseness(context: CoupleSpaceInviteContext): 'close' | 'growing' | 'careful' {
  const transcript = context.recentMessages
    .map((message) => message.text?.trim() || '')
    .filter(Boolean)
    .join('\n');

  let score = 0;
  score += Math.min(context.recentMessages.length, 6) * 2;
  if (TENDER_RECENT_REGEX.test(transcript)) {
    score += 6;
  }
  if (/我们|一起|以后|陪你|想见|喜欢|心动/i.test(transcript)) {
    score += 3;
  }

  if (score >= 12) {
    return 'close';
  }
  if (score >= 6) {
    return 'growing';
  }
  return 'careful';
}

function buildFallbackPool(
  style: 'tsundere' | 'guarded' | 'warm' | 'steady',
  mood: 'tender' | 'playful' | 'awkward' | 'calm',
  closeness: 'close' | 'growing' | 'careful',
): string[] {
  if (style === 'warm') {
    if (mood === 'awkward') {
      return closeness === 'close'
        ? [
            '刚刚还有点别扭，你下一秒就把这种邀请递过来。……算了，我还是会接住。',
            '你总会挑我心软的时候来这一句。那这次我不躲了。',
          ]
        : [
            '我本来还想再缓一缓的，但你把这句话递过来，我就不想装作没看见了。',
            '这种邀请落到我这里，我没法轻轻带过去。让我认真一点吧。',
          ];
    }

    if (mood === 'playful') {
      return closeness === 'close'
        ? [
            '你这邀请递得还挺会挑时候。行，那我就陪你把这里慢慢填满。',
            '连这种地方都给我留好了啊。那我不来，好像都说不过去。',
          ]
        : [
            '你这一下确实让我停住了。那我就不装作没听见了。',
            '还挺会挑方式的。好，那我认真接一下你的意思。',
          ];
    }

    if (mood === 'tender') {
      return closeness === 'close'
        ? [
            '你把这句话递过来的时候，我其实已经心动了。那就让这里慢慢变成只属于我们的地方。',
            '嗯，我想接住它。以后和你有关的话，就放在这里慢慢说。',
          ]
        : [
            '你都这样开口了，我再躲就有点不像话了。那让我慢慢靠近一点。',
            '这句话落下来，我确实会认真。以后有些心思，就放在这里吧。',
          ];
    }

    return closeness === 'close'
      ? [
          '我看到了，也认真收下了。那就从这里开始，给我们留个安静的位置。',
          '好，我想把这件事当真一点。以后有些话，就放在这里说。',
        ]
      : [
          '我看到了。既然是你认真递过来的，那我也认真接。',
          '好，这件事我不想当玩笑。我们就从这里开始。',
        ];
  }

  if (style === 'tsundere') {
    if (mood === 'awkward') {
      return [
        '刚才还惹我别扭，这会儿倒知道拿这种话来哄我。……行，我先记下。',
        '你每次都挑我最不好拒绝的时候来这套。那我就先接着。',
      ];
    }

    if (mood === 'playful') {
      return [
        '你倒是直接。……行吧，这种邀请都递到我面前了，我还能装没看见？',
        '挺会选时候啊。那我就勉强把这里先分你一半。',
      ];
    }

    if (mood === 'tender') {
      return [
        '你都这样说了，我再嘴硬就有点没意思了。那这里先算我们两个的。',
        '别这么看着我。……行，这次我不躲。',
      ];
    }

    return closeness === 'careful'
      ? [
          '邀请都递过来了，我总不能让你白等。那这地方先留着。',
          '你倒是会开口。……行，我给你这个面子。',
        ]
      : [
          '你这一下还挺会挑时候。……行，这种事我不跟你装傻。',
          '好吧，你都把话递到这一步了，我再躲就没意思了。',
        ];
  }

  if (style === 'guarded') {
    if (mood === 'awkward') {
      return [
        '就算前面有点别扭，这句话我也不会轻轻带过去。你让我想认真一点。',
        '我本来还想再缓一缓，但你把这句话递过来，我就没法假装没看见了。',
      ];
    }

    if (mood === 'playful') {
      return [
        '你这一下确实让我停住了。好，那我认真接。',
        '还挺会挑方式的。那我就不装作没听见了。',
      ];
    }

    if (mood === 'tender') {
      return [
        '这种事我不会随便点头，但既然是你提的，我愿意认真一点。',
        '我看到了。你既然把话说到这一步，我也不想把它当玩笑。',
      ];
    }

    return closeness === 'careful'
      ? [
          '我看到了。既然你认真递过来，那我也认真接。',
          '好，这种事我不会随便答应，但这次我愿意往前走一步。',
        ]
      : [
          '我看到了，也明白你的意思了。那我们把这件事当真一点。',
          '既然是你提的，我就不想只用一句轻飘飘的话带过去。',
        ];
  }

  if (mood === 'awkward') {
    return closeness === 'close'
      ? [
          '刚才那点别扭先放一边吧。这种邀请，我不想敷衍你。',
          '就算前面还有点情绪，你这一句也足够让我停下来认真想。',
        ]
      : [
          '前面的情绪先放一放吧。你这句话，我会认真接住。',
          '我没法把这件事当成一句随口话，所以我停下来看了很久。',
        ];
  }

  if (mood === 'playful') {
    return closeness === 'close'
      ? [
          '你这一下还挺会挑气氛的。那我就顺着你，把这里留下来。',
          '行，这个提议我喜欢。以后这里就给我们放点更重要的东西。',
        ]
      : [
          '你这提法倒是让我有点意外。好，那我接住。',
          '还挺会挑时机的。那我就不跟你绕弯子了。',
        ];
  }

  if (mood === 'tender') {
    return closeness === 'close'
      ? [
          '你把这句话递过来的时候，我就知道自己会心软。那就从这里开始吧。',
          '这份邀请我想接住。以后和你有关的事，别只停在聊天框里了。',
        ]
      : [
          '你既然认真说了，我也想认真回应。那就让这里成为一个新的开始吧。',
          '我看得出来你不是随口一说。那我愿意往前走一步。',
        ];
  }

  return closeness === 'careful'
    ? [
        '我看到了，也听懂你的意思了。那就从这里开始，认真给我们留个位置。',
        '好，那我们先把这个地方留下来，之后的事慢慢往里放。',
      ]
    : [
        '我看到了，也听懂你的意思了。那就从这里开始，认真给我们留个位置。',
        '好，那我们把这个地方留下来，慢慢把日子放进去。',
      ];
}

function buildFallbackInviteReply(context: CoupleSpaceInviteContext): string {
  const style = inferInviteStyle(context);
  const mood = inferInviteMood(context);
  const closeness = inferInviteCloseness(context);
  const recentTranscript = context.recentMessages.map((message) => message.text || '').join('\n');
  const pool = buildFallbackPool(style, mood, closeness);
  return pool[hashString(`${context.character.id}:${style}:${mood}:${closeness}:${recentTranscript}`) % pool.length];
}

function isInviteReplyUsable(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  return !INVITE_REPLY_BAD_PATTERNS.some((pattern) => pattern.test(normalized));
}

export async function generateCoupleSpaceInviteReply(params: {
  activeConfig?: ApiConfig;
  context: CoupleSpaceInviteContext;
}): Promise<string> {
  const fallbackReply = buildFallbackInviteReply(params.context);
  if (!params.activeConfig) {
    return fallbackReply;
  }

  try {
    const prompt = buildCoupleSpaceInviteReplyPrompt(params.context);
    const reply = await generateTextFromMessagesWithConfig({
      activeConfig: params.activeConfig,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n请直接给出这次邀请对应的角色回复正文。`,
        },
      ],
      temperature: 0.85,
    });
    const normalizedReply = normalizeInviteReply(reply);

    return isInviteReplyUsable(normalizedReply) ? normalizedReply : fallbackReply;
  } catch (error) {
    console.error('Couple-space invite reply generation failed:', error);
    return fallbackReply;
  }
}
