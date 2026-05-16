import type { Character, ChatMessage } from '../../types';

export type GroupModerationAction = 'mute' | 'unmute' | 'remove';

type GroupModerationTarget = Pick<Character, 'id' | 'name' | 'remarkName'>;

function getMemberAliases(member: GroupModerationTarget): string[] {
  return Array.from(
    new Set(
      [member.name, member.remarkName]
        .map((value) => value?.trim())
        .filter((value): value is string => !!value),
    ),
  );
}

function matchesAliasInText(text: string, alias: string): boolean {
  const normalizedAlias = alias.trim();
  if (!normalizedAlias) {
    return false;
  }

  const escapedAlias = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/^[a-z0-9 _-]+$/i.test(normalizedAlias)) {
    return new RegExp(`(^|[^a-z0-9])${escapedAlias}([^a-z0-9]|$)`, 'i').test(text);
  }

  return text.includes(normalizedAlias);
}

function resolveMemberByPublicName(name: string, members: GroupModerationTarget[]): GroupModerationTarget | null {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  return members.find((member) => (
    getMemberAliases(member).some((alias) => alias.trim().toLowerCase() === normalizedName)
  )) || null;
}

function extractMentionedMembers(text: string, members: GroupModerationTarget[]): GroupModerationTarget[] {
  const results: GroupModerationTarget[] = [];
  const seenIds = new Set<string>();
  const atMatches = Array.from(text.matchAll(/@([^\s@]+)/g));

  const pushMember = (member: GroupModerationTarget | null) => {
    if (!member || seenIds.has(member.id)) {
      return;
    }
    seenIds.add(member.id);
    results.push(member);
  };

  for (const match of atMatches) {
    pushMember(resolveMemberByPublicName(match[1], members));
  }

  members.forEach((member) => {
    if (seenIds.has(member.id)) {
      return;
    }
    if (getMemberAliases(member).some((alias) => matchesAliasInText(text, alias))) {
      pushMember(member);
    }
  });

  return results;
}

export function parseModerationDurationMs(text: string): number | undefined {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return undefined;
  }

  if (/半小时/.test(normalizedText)) {
    return 30 * 60 * 1000;
  }

  const unitMatch = normalizedText.match(/(\d+)\s*(分钟|分|小时|时|天|日|m|h|d)(?![a-z])/i);
  if (unitMatch) {
    const amount = Number(unitMatch[1]);
    const unit = unitMatch[2].toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) {
      return undefined;
    }

    if (unit === '分钟' || unit === '分' || unit === 'm') {
      return amount * 60 * 1000;
    }
    if (unit === '小时' || unit === '时' || unit === 'h') {
      return amount * 60 * 60 * 1000;
    }
    return amount * 24 * 60 * 60 * 1000;
  }

  return undefined;
}

function parseExplicitModerationAction(text: string): GroupModerationAction | null {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return null;
  }

  if (/(解除禁言|解禁|恢复发言|放出来)/.test(normalizedText)) {
    return 'unmute';
  }

  if (/(踢出群|踢出去|移出群聊|移出群|请出群|清出去)/.test(normalizedText)) {
    return 'remove';
  }

  if (
    /(先禁言|给.*禁言|把.*禁言|禁言一下|闭麦一下|闭麦吧|先闭麦|先别说话|给我闭嘴)/.test(normalizedText)
    || (/禁言/.test(normalizedText) && !/(按钮|功能|哪里|怎么|研究|想想|要不要|能不能|不会|如果)/.test(normalizedText))
  ) {
    return 'mute';
  }

  return null;
}

function parseRequestedModerationAction(text: string): GroupModerationAction | null {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return null;
  }

  if (/(解除禁言|解禁)/.test(normalizedText)) {
    return 'unmute';
  }

  if (/(踢出群|踢出去|移出群)/.test(normalizedText)) {
    return 'remove';
  }

  if (/(禁言|闭麦|先别说话)/.test(normalizedText)) {
    return 'mute';
  }

  return null;
}

function looksLikeModerationApproval(text: string): boolean {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return false;
  }

  if (/(别禁|先别|不用|没必要|算了|不至于|先缓缓)/.test(normalizedText)) {
    return false;
  }

  return /(确实|有点吵|打扰|我来|先这样|行|好|知道了|该闭麦|先处理一下|收一收)/.test(normalizedText);
}

export function resolveExplicitModerationCommand(params: {
  message: Pick<ChatMessage, 'text' | 'replyTo'>;
  members: GroupModerationTarget[];
}): { action: GroupModerationAction; targetMemberId: string; durationMs?: number } | null {
  const action = parseExplicitModerationAction(params.message.text);
  if (!action) {
    return null;
  }

  const candidateMembers = [
    ...(params.message.replyTo?.role === 'model'
      ? [resolveMemberByPublicName(params.message.replyTo.authorLabel, params.members)].filter((value): value is GroupModerationTarget => !!value)
      : []),
    ...extractMentionedMembers(params.message.text, params.members),
  ];

  const targetMember = candidateMembers[0];
  if (!targetMember) {
    return null;
  }

  return {
    action,
    targetMemberId: targetMember.id,
    ...(action === 'mute' ? { durationMs: parseModerationDurationMs(params.message.text) } : {}),
  };
}

export function resolveRequestedModerationAction(params: {
  userMessage: Pick<ChatMessage, 'text' | 'replyTo'>;
  adminReplyText: string;
  members: GroupModerationTarget[];
}): { action: GroupModerationAction; targetMemberId: string; durationMs?: number } | null {
  if (!looksLikeModerationApproval(params.adminReplyText)) {
    return null;
  }

  const action = parseRequestedModerationAction(params.userMessage.text);
  if (!action) {
    return null;
  }

  const candidateMembers = [
    ...(params.userMessage.replyTo?.role === 'model'
      ? [resolveMemberByPublicName(params.userMessage.replyTo.authorLabel, params.members)].filter((value): value is GroupModerationTarget => !!value)
      : []),
    ...extractMentionedMembers(params.userMessage.text, params.members),
  ];

  const targetMember = candidateMembers[0];
  if (!targetMember) {
    return null;
  }

  return {
    action,
    targetMemberId: targetMember.id,
    ...(action === 'mute'
      ? { durationMs: parseModerationDurationMs(params.adminReplyText) ?? parseModerationDurationMs(params.userMessage.text) }
      : {}),
  };
}
