export type GroupReplyIntent =
  | { kind: 'normal_chat' }
  | { kind: 'open_floor' }
  | { kind: 'stop_followups' }
  | { kind: 'force_all_members' }
  | { kind: 'force_targets'; targetIds: string[] }
  | { kind: 'group_topic' };

type ResolveGroupReplyIntentInput = {
  text: string;
  mentionedMemberIds?: string[];
  memberIds: string[];
};

const FORCE_ALL_PATTERNS = [
  /所有人/u,
  /全部人/u,
  /全员/u,
  /每个人/u,
  /大家都/u,
  /都报数/u,
  /报数/u,
];

const OPEN_FLOOR_PATTERNS = [
  /还有谁/u,
  /继续/u,
  /接着聊/u,
  /都说说/u,
  /来个人/u,
  /有人吗/u,
];

const GROUP_TOPIC_PATTERNS = [
  /你们/u,
  /大家/u,
  /群里/u,
  /有人.*吗/u,
  /谁.*知道/u,
  /你们.*在干嘛/u,
  /你们.*聊/u,
  /你们.*忙/u,
  /你们.*怎么看/u,
  /都在干嘛/u,
];

const STOP_PATTERNS = [
  /别接了/u,
  /先停/u,
  /停一下/u,
  /打住/u,
  /收一收/u,
  /别说了/u,
  /到此为止/u,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function resolveGroupReplyIntent(
  input: ResolveGroupReplyIntentInput,
): GroupReplyIntent {
  const normalized = input.text.trim();
  if (!normalized) {
    return { kind: 'normal_chat' };
  }

  if (matchesAny(normalized, STOP_PATTERNS)) {
    return { kind: 'stop_followups' };
  }

  if (matchesAny(normalized, FORCE_ALL_PATTERNS)) {
    return { kind: 'force_all_members' };
  }

  const targetIds = (input.mentionedMemberIds || []).filter((id) => input.memberIds.includes(id));
  if (targetIds.length > 0) {
    return { kind: 'force_targets', targetIds };
  }

  if (matchesAny(normalized, OPEN_FLOOR_PATTERNS)) {
    return { kind: 'open_floor' };
  }

  if (matchesAny(normalized, GROUP_TOPIC_PATTERNS)) {
    return { kind: 'group_topic' };
  }

  return { kind: 'normal_chat' };
}
