import type { Character } from '../../types';

type GroupParticipationIntentKind =
  | 'normal_chat'
  | 'open_floor'
  | 'stop_followups'
  | 'force_all_members'
  | 'force_targets'
  | 'group_topic';

export type GroupParticipationInput = {
  character: Character;
  userText: string;
  characterEvidence: string;
  aliases: string[];
  intentKind: GroupParticipationIntentKind;
  isExplicitTarget: boolean;
  isReplyTarget: boolean;
  recentCount: number;
  latestModelSpeakerId?: string;
};

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasAliasHit(text: string, aliases: string[]): boolean {
  const normalized = text.toLowerCase();
  return aliases.some((alias) => alias.trim() && normalized.includes(alias.trim().toLowerCase()));
}

export function computeGroupParticipationBonus(input: GroupParticipationInput): number {
  const normalizedUserText = input.userText.toLowerCase();
  let bonus = 0;

  if (input.isExplicitTarget) {
    bonus += 4.2;
  }

  if (input.isReplyTarget) {
    bonus += 3.4;
  }

  if (!input.isExplicitTarget && hasAliasHit(normalizedUserText, input.aliases)) {
    bonus += 1.8;
  }

  if (input.intentKind === 'force_all_members') {
    bonus += 1.3;
  }

  if (input.intentKind === 'group_topic') {
    bonus += 0.8;
  }

  if (includesAny(normalizedUserText, ['你们', '大家', '群里', '有人'])) {
    bonus += 0.5;
  }

  if (includesAny(input.characterEvidence, ['护短', '护着', '偏心', '占有'])) {
    bonus += includesAny(normalizedUserText, ['他', '她', '对象', '朋友', '喜欢']) ? 1.1 : 0.45;
  }

  if (includesAny(input.characterEvidence, ['起哄', '接梗', '吐槽', '嘴硬', '插嘴'])) {
    bonus += 0.9;
  }

  if (includesAny(input.characterEvidence, ['解释', '理性', '会说话', '圆场'])) {
    bonus += includesAny(normalizedUserText, ['怎么回事', '什么意思', '真的吗', '不是']) ? 0.85 : 0.3;
  }

  if (includesAny(normalizedUserText, ['谁', '真的假的', '怎么回事', '什么意思', '为什么'])) {
    bonus += includesAny(input.characterEvidence, ['吃瓜', '八卦', '好奇', '爱问']) ? 0.9 : 0.2;
  }

  if (includesAny(normalizedUserText, ['不是吧', '真的假的', '别', '滚', '操', '妈', '抢', '对象'])) {
    bonus += includesAny(input.characterEvidence, ['面子', '嘴硬', '好胜', '占有', '护短']) ? 0.95 : 0.35;
  }

  if (input.recentCount === 0) {
    bonus += 0.45;
  } else if (input.recentCount >= 2) {
    bonus -= 0.35;
  }

  if (input.latestModelSpeakerId && input.character.id === input.latestModelSpeakerId) {
    bonus -= 0.25;
  }

  return bonus;
}

export function shouldUseActivityFloor(input: {
  memberCount: number;
  conversationHeat: number;
  conversationMomentum: number;
  chainDepth: number;
  usedSpeakerCount: number;
  latestResponse: string;
  contextText: string;
}): boolean {
  if (input.chainDepth > 1) {
    return false;
  }

  if (input.memberCount <= 1) {
    return false;
  }

  const looksCold =
    input.conversationHeat < 1.05
    && input.conversationMomentum < 0.55
    && input.usedSpeakerCount <= 1;

  if (!looksCold) {
    return false;
  }

  const hasTinyHook =
    /[?!？！]/.test(input.latestResponse)
    || input.latestResponse.trim().length <= 14
    || /你们|大家|谁|什么|怎么|继续|然后|真的假的/.test(input.contextText);

  if (!hasTinyHook) {
    return false;
  }

  return Math.random() < 0.42;
}
