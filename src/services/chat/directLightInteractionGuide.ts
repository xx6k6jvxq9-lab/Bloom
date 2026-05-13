import type { Character, ChatMessage, LightInteractionMessageMeta } from '../../types';
import { getMessageMainText } from '../../utils';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import type { ChatRecentContext } from '../relationship-context/types';

export type DirectPokeBehaviorTone = 'light' | 'warm' | 'guarded' | 'serious';
export type DirectPokeBehaviorFamiliarity = 'low' | 'medium' | 'high';

export type DirectPokeBehaviorGuide = {
  tone: DirectPokeBehaviorTone;
  familiarity: DirectPokeBehaviorFamiliarity;
  allowCounterPoke: boolean;
  defaultAssistantBubbles: string[];
  summaryLine: string;
  promptLines: string[];
};

const PLAYFUL_RECENT_REGEX = /(拍一拍|拍了拍|别闹|逗你|逗我|嘴硬|坏心眼|试探|撩|幼稚|哼|笑死|故意|装没事)/i;
const WARM_RECENT_REGEX = /(想你|在意|晚安|早安|辛苦了|抱抱|陪你|偏心|想见你|回来|等你|乖)/i;
const SERIOUS_RECENT_REGEX = /(难受|伤心|委屈|崩溃|焦虑|不舒服|发烧|头疼|住院|加班|好累|睡不着|分手|吵架|别烦|滚|讨厌|道歉|对不起|解释|安慰|哭)/i;
const PLAYFUL_PERSONA_REGEX = /(嘴硬|别扭|傲娇|会逗|爱闹|调侃|会撩|试探|坏心眼|皮)/i;
const WARM_PERSONA_REGEX = /(温柔|照顾|偏爱|会哄|体贴|关心|黏人)/i;
const GUARDED_PERSONA_REGEX = /(克制|高冷|防备|谨慎|边界感|冷淡|疏离|慢热|不主动)/i;

function buildRecentText(messages: ChatMessage[], recentContext?: ChatRecentContext) {
  const messageText = messages
    .filter((message) => !message.isSystem && !message.isRecalled)
    .slice(-8)
    .map((message) => getMessageMainText(message).trim())
    .filter(Boolean)
    .join('\n');

  const contextText = [
    recentContext?.shortTermSummary,
    recentContext?.sharedRecentRelationshipSummary,
    recentContext?.recentCoupleSpaceSummary,
    recentContext?.publicAcquaintanceSummary,
    ...(recentContext?.relationshipResidue || []).map((item) => item.summary),
    ...(recentContext?.topicAnchors || []).map((item) => item.summary),
    ...(recentContext?.taskResidue || []).map((item) => item.summary),
  ]
    .filter(Boolean)
    .join('\n');

  return [messageText, contextText].filter(Boolean).join('\n');
}

function resolveFamiliarity(input: {
  responderCharacter: Character;
  recentMessages: ChatMessage[];
  recentContext?: ChatRecentContext;
  longTermMemoryProfile?: string;
  latestCounterActionType?: LightInteractionMessageMeta['counterActionType'];
  recentText: string;
}): DirectPokeBehaviorFamiliarity {
  let score = 0;
  const visibleMessageCount = input.recentMessages.filter((message) => !message.isSystem && !message.isRecalled).length;
  const personaText = [
    buildCharacterContext({ character: input.responderCharacter }).corePersona,
    input.longTermMemoryProfile,
    input.responderCharacter.signature,
    input.responderCharacter.openingRemark,
  ]
    .filter(Boolean)
    .join('\n');

  if (visibleMessageCount >= 8) {
    score += 2;
  } else if (visibleMessageCount >= 4) {
    score += 1;
  }

  if (
    input.longTermMemoryProfile?.trim()
    || input.recentContext?.publicAcquaintanceSummary?.trim()
    || input.recentContext?.sharedRecentRelationshipSummary?.trim()
  ) {
    score += 1;
  }

  if (WARM_RECENT_REGEX.test(input.recentText)) {
    score += 1;
  }

  if (PLAYFUL_PERSONA_REGEX.test(personaText) || WARM_PERSONA_REGEX.test(personaText)) {
    score += 1;
  }

  if (input.latestCounterActionType === 'poke_back') {
    score += 1;
  }

  if (score >= 4) {
    return 'high';
  }

  if (score >= 2) {
    return 'medium';
  }

  return 'low';
}

function resolveTone(input: {
  responderCharacter: Character;
  recentText: string;
  familiarity: DirectPokeBehaviorFamiliarity;
  latestCounterActionType?: LightInteractionMessageMeta['counterActionType'];
}): DirectPokeBehaviorTone {
  const personaText = [
    buildCharacterContext({ character: input.responderCharacter }).corePersona,
    input.responderCharacter.signature,
    input.responderCharacter.openingRemark,
  ]
    .filter(Boolean)
    .join('\n');

  if (SERIOUS_RECENT_REGEX.test(input.recentText)) {
    return 'serious';
  }

  if (input.familiarity === 'low' && GUARDED_PERSONA_REGEX.test(personaText)) {
    return 'guarded';
  }

  if (
    WARM_RECENT_REGEX.test(input.recentText)
    || (input.familiarity === 'high' && WARM_PERSONA_REGEX.test(personaText))
  ) {
    return 'warm';
  }

  if (
    PLAYFUL_RECENT_REGEX.test(input.recentText)
    || PLAYFUL_PERSONA_REGEX.test(personaText)
    || input.latestCounterActionType === 'poke_back'
  ) {
    return 'light';
  }

  if (input.familiarity === 'low') {
    return 'guarded';
  }

  return 'light';
}

function buildDefaultAssistantBubbles(params: {
  actorRole: 'user' | 'character';
  tone: DirectPokeBehaviorTone;
}) {
  if (params.actorRole === 'character') {
    if (params.tone === 'warm') {
      return ['拍你一下。', '看到就回我。'];
    }

    if (params.tone === 'light') {
      return ['拍你一下。', '别装没看见。'];
    }

    return ['拍你一下。'];
  }

  if (params.tone === 'serious') {
    return ['？', '有事？'];
  }

  if (params.tone === 'guarded') {
    return ['？', '有事说。'];
  }

  if (params.tone === 'warm') {
    return ['怎么了。', '突然拍我？'];
  }

  return ['……你拍我干嘛。', '有话就说。'];
}

function buildSummaryLine(tone: DirectPokeBehaviorTone) {
  switch (tone) {
    case 'serious':
      return '本轮建议手感：偏严肃，短、收、稳，不要硬逗。';
    case 'guarded':
      return '本轮建议手感：偏克制，冷一点也可以，但不要突然装熟。';
    case 'warm':
      return '本轮建议手感：偏熟和，允许柔和一点，但不要油腻。';
    default:
      return '本轮建议手感：偏轻松，允许嘴硬、试探或轻一点的来回。';
  }
}

function buildPromptLines(input: {
  actorRole: 'user' | 'character';
  tone: DirectPokeBehaviorTone;
  familiarity: DirectPokeBehaviorFamiliarity;
  allowCounterPoke: boolean;
}) {
  const familiarityLine = input.familiarity === 'high'
    ? '两边已经不是纯生疏状态，可以自然一点，但仍然要像顺手反应。'
    : input.familiarity === 'medium'
      ? '关系处在中间区，轻一点可以，但别突然跳到很黏或很撩。'
      : '关系还没熟到可以默认贴近或打情骂俏。';

  const actionLine = input.actorRole === 'character'
    ? '如果这轮由角色主动发起，动作一定要轻，像临时起意，不要拍得太闹。'
    : input.tone === 'serious'
      ? '如果这轮要回拍，也要顺着当前情绪来，像一句严肃里的顺手一碰，不要硬转成嬉闹。'
      : input.tone === 'guarded'
        ? '如果这轮要回拍，也要克制一点，不要突然装熟。'
        : '如果真要回拍，也只能像顺手回一下，不要把来回拍成固定连招。';

  const toneLine = buildSummaryLine(input.tone);

  return [toneLine, familiarityLine, actionLine];
}

export function buildDirectPokeBehaviorGuide(input: {
  responderCharacter: Character;
  actorRole: 'user' | 'character';
  recentMessages: ChatMessage[];
  recentContext?: ChatRecentContext;
  longTermMemoryProfile?: string;
  latestCounterActionType?: LightInteractionMessageMeta['counterActionType'];
  upcomingStreak?: number;
}): DirectPokeBehaviorGuide {
  const recentText = buildRecentText(input.recentMessages, input.recentContext);
  const familiarity = resolveFamiliarity({
    responderCharacter: input.responderCharacter,
    recentMessages: input.recentMessages,
    recentContext: input.recentContext,
    longTermMemoryProfile: input.longTermMemoryProfile,
    latestCounterActionType: input.latestCounterActionType,
    recentText,
  });
  const tone = resolveTone({
    responderCharacter: input.responderCharacter,
    recentText,
    familiarity,
    latestCounterActionType: input.latestCounterActionType,
  });
  const allowCounterPoke = input.actorRole === 'user';

  return {
    tone,
    familiarity,
    allowCounterPoke,
    defaultAssistantBubbles: buildDefaultAssistantBubbles({
      actorRole: input.actorRole,
      tone,
    }),
    summaryLine: buildSummaryLine(tone),
    promptLines: buildPromptLines({
      actorRole: input.actorRole,
      tone,
      familiarity,
      allowCounterPoke,
    }),
  };
}
