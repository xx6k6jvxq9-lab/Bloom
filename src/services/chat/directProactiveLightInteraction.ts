import type { Character, ChatMessage } from '../../types';
import type { BuildChatPromptOptions } from '../ai/prompts/builders/buildChatPrompt';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { getMessageMainText } from '../../utils';
import type { DirectPokeRecentState } from './lightInteractionHistory';

export const DIRECT_PROACTIVE_LIGHT_INTERACTION_PROTOCOL_PREFIX = '[LIGHT_INTERACTION]';

export type DirectProactivePokeGateResult = {
  shouldOffer: boolean;
  score: number;
  cues: string[];
  blockers: string[];
};

const PLAYFUL_RECENT_REGEX = /(拍一拍|拍了拍|逗你|逗我|别闹|闹你|闹我|干嘛|坏|幼稚|哼|笑死|欠|撩|逗|试探|嘴硬)/i;
const WARMTH_RECENT_REGEX = /(想你|在意|黏人|撒娇|哄|晚安|早安|抱抱|贴贴|乖|偏心)/i;
const SERIOUS_RECENT_REGEX = /(难受|伤心|委屈|崩溃|焦虑|烦死|生气|哭|发烧|头疼|不舒服|住院|加班|好累|睡不着|分手|吵架|别烦|滚|讨厌|道歉|对不起|解释)/i;
const PLAYFUL_PERSONA_REGEX = /(嘴硬|别扭|傲娇|爱闹|会撩|会逗|调侃|坏心眼|皮|幼稚一点|喜欢试探)/i;
const GUARDED_PERSONA_REGEX = /(克制|高冷|防备|谨慎|边界感强|冷淡|疏离|不主动)/i;

function getVisibleRecentTranscript(messages: ChatMessage[]) {
  return messages
    .filter((message) => !message.isSystem && !message.isRecalled)
    .slice(-8)
    .map((message) => getMessageMainText(message).trim())
    .filter(Boolean)
    .join('\n');
}

function getLatestVisibleUserText(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message?.role === 'user'
      && !message.isSystem
      && !message.isRecalled
    ) {
      const text = getMessageMainText(message).trim();
      if (text) {
        return text;
      }
    }
  }

  return '';
}

export function evaluateDirectProactivePokeGate(input: {
  character: Character;
  messages: ChatMessage[];
  recentContext?: BuildChatPromptOptions['recentContext'];
  recentPokeState: DirectPokeRecentState;
}): DirectProactivePokeGateResult {
  const cues: string[] = [];
  const blockers: string[] = [];
  const visibleMessages = input.messages.filter((message) => !message.isSystem && !message.isRecalled);
  const recentTranscript = getVisibleRecentTranscript(input.messages);
  const latestUserText = getLatestVisibleUserText(input.messages);
  const recentSummaryText = [
    input.recentContext?.shortTermSummary,
    input.recentContext?.sharedRecentRelationshipSummary,
    input.recentContext?.publicAcquaintanceSummary,
    ...(input.recentContext?.relationshipResidue || []).map((item) => item.summary),
    ...(input.recentContext?.topicAnchors || []).map((item) => item.summary),
  ]
    .filter(Boolean)
    .join('\n');
  const characterContext = buildCharacterContext({ character: input.character });
  const personaText = [
    characterContext.corePersona,
    characterContext.expressionStyle,
    input.character.signature,
    input.character.openingRemark,
  ]
    .filter(Boolean)
    .join('\n');

  let score = 0;

  if (visibleMessages.length >= 8) {
    score += 2;
    cues.push('最近来回聊天已经有一段了。');
  } else if (visibleMessages.length >= 5) {
    score += 1;
    cues.push('最近不是只聊了一两句。');
  } else {
    blockers.push('最近可参考的来回互动还不够多。');
  }

  if (recentSummaryText.trim()) {
    score += 1;
    cues.push('最近关系和气氛里有可承接的余波。');
  }

  if (PLAYFUL_RECENT_REGEX.test(`${latestUserText}\n${recentTranscript}\n${recentSummaryText}`)) {
    score += 2;
    cues.push('最近气氛里已经有一点逗弄或试探感。');
  }

  if (WARMTH_RECENT_REGEX.test(`${latestUserText}\n${recentTranscript}\n${recentSummaryText}`)) {
    score += 1;
    cues.push('最近互动里有熟悉和靠近的信号。');
  }

  if (PLAYFUL_PERSONA_REGEX.test(personaText)) {
    score += 2;
    cues.push('角色本人就有一点会逗人或会试探的手感。');
  }

  if (GUARDED_PERSONA_REGEX.test(personaText)) {
    score -= 1;
  }

  if (SERIOUS_RECENT_REGEX.test(`${latestUserText}\n${recentTranscript}\n${recentSummaryText}`)) {
    score -= 2;
    cues.push('当前语境偏重，只有这一下真的贴合时才会成立。');
  }

  if (input.recentPokeState.upcomingStreak > 1) {
    blockers.push('拍一拍刚发生过，暂时不适合连着再拍。');
  }

  if (blockers.length > 0) {
    return {
      shouldOffer: false,
      score,
      cues,
      blockers,
    };
  }

  return {
    shouldOffer: score >= 3,
    score,
    cues,
    blockers,
  };
}

export function buildDirectProactivePokeProtocolPrompt(input: {
  characterLabel: string;
  gate: DirectProactivePokeGateResult;
}): string {
  return [
    '## 可选主动轻互动：拍一拍',
    '这轮如果你觉得主动发一条普通消息，还不如轻轻拍一下更自然，你可以改用一次“主动拍一拍”。',
    '但这不是默认选项，只有在关系已经不生、最近气氛偏轻、而且这一下拍得很像你本人顺手试探或引注意时，才允许使用。',
    '不要为了使用功能而硬拍；如果稍微拿不准，就继续正常发消息。',
    '严肃沟通、安慰、吵架、道歉、明显低落这些场景不是绝对禁区；只是这一下必须贴合当下，而不是硬把气氛拽轻。',
    input.gate.cues.length > 0
      ? `这轮可以参考的轻触发线索：${input.gate.cues.slice(0, 4).join('；')}`
      : '',
    'systemLine 不一定只能写成“拍了拍你”；也可以像“拍了拍正在走神的你”“拍了拍还没回神的你”这样，给“你”补一个很短的当下状态描述。',
    '',
    '如果你决定主动拍一拍，不要输出普通聊天文本；只输出下面这种协议：',
    `${DIRECT_PROACTIVE_LIGHT_INTERACTION_PROTOCOL_PREFIX}
{
  "systemLine": "${input.characterLabel}拍了拍还没回神的你",
  "assistantBubbles": ["拍你一下。"],
  "counterAction": {
    "type": "none",
    "systemLine": ""
  },
  "nextActions": ["回一句", "拍回去", "继续装没事"],
  "interactionState": {
    "mood": "teasing",
    "streak": 1,
    "recentDescriptors": ["想引你注意"]
  }
}`,
    '协议限制：',
    '- 只能用于“角色主动拍用户”。',
    '- 不要代写用户回应，不要让用户自动回拍。',
    '- 如果不用这个协议，就按普通主动消息正常输出。',
  ].filter(Boolean).join('\n');
}

export function extractDirectProactiveLightInteractionPayload(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(DIRECT_PROACTIVE_LIGHT_INTERACTION_PROTOCOL_PREFIX)) {
    return null;
  }

  return trimmed.slice(DIRECT_PROACTIVE_LIGHT_INTERACTION_PROTOCOL_PREFIX.length).trim() || null;
}
