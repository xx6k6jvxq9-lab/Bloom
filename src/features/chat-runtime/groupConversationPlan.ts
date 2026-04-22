import type { GroupReplyIntent } from './groupIntentResolver';
import type { CharacterTemporalState } from '../../services/relationship-time/buildCharacterTemporalState';

export type GroupConversationTrigger = 'auto' | 'manual';

export type GroupSpeechAct =
  | 'topic_starter'
  | 'topic_followup'
  | 'small_reaction'
  | 'add_angle'
  | 'light_pushback'
  | 'cool_down_or_shift';

export type GroupConversationPlan = {
  targetCount: number;
  maxFollowUpDepth: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createGroupConversationPlan(params: {
  trigger: GroupConversationTrigger;
  intent: GroupReplyIntent;
  memberCount: number;
  conversationHeat?: number;
  forcedSpeakerCount?: number;
}): GroupConversationPlan {
  const heat = params.conversationHeat ?? 0;
  const forcedSpeakerCount = params.forcedSpeakerCount ?? 0;

  if (params.memberCount <= 1) {
    return { targetCount: params.memberCount, maxFollowUpDepth: 0 };
  }

  if (params.intent.kind === 'force_all_members') {
    const count = Math.max(params.memberCount, forcedSpeakerCount);
    return { targetCount: count, maxFollowUpDepth: Math.max(count + 1, forcedSpeakerCount + 2) };
  }

  if (params.intent.kind === 'force_targets') {
    const count = clamp(Math.max(forcedSpeakerCount, 1), 1, params.memberCount);
    return { targetCount: count, maxFollowUpDepth: count };
  }

  if (params.intent.kind === 'stop_followups') {
    return { targetCount: 1, maxFollowUpDepth: 1 };
  }

  if (params.trigger === 'manual') {
    const targetCount = params.intent.kind === 'group_topic' || params.intent.kind === 'open_floor'
      ? params.memberCount >= 8
        ? clamp(4 + (heat >= 1.6 ? 1 : 0), 3, params.memberCount)
        : params.memberCount >= 5
          ? clamp(3, 2, params.memberCount)
          : clamp(2, 1, params.memberCount)
      : params.memberCount >= 8
        ? clamp(4, 2, params.memberCount)
        : params.memberCount >= 5
          ? clamp(3, 2, params.memberCount)
          : clamp(2, 1, params.memberCount);

    return { targetCount, maxFollowUpDepth: Math.max(0, targetCount - 1) };
  }

  if (params.intent.kind === 'group_topic') {
    const maxFollowUpDepth = Math.max(
      2,
      Math.min(
        params.memberCount >= 9 ? 4 : params.memberCount >= 6 ? 3 : 2,
        Math.ceil(params.memberCount / 3) + 1,
      ),
    );
    return { targetCount: maxFollowUpDepth + 1, maxFollowUpDepth };
  }

  if (params.intent.kind === 'open_floor') {
    const maxFollowUpDepth = Math.max(
      2,
      Math.min(
        5,
        heat >= 1.8
          ? Math.ceil(params.memberCount / 2) + 1
          : Math.ceil(params.memberCount / 3) + 1,
      ),
    );
    return { targetCount: maxFollowUpDepth + 1, maxFollowUpDepth };
  }

  const maxFollowUpDepth = Math.max(
    1,
    Math.min(
      4,
      heat >= 1.8
        ? Math.ceil(params.memberCount / 2)
        : Math.ceil(params.memberCount / 3),
    ),
  );
  return { targetCount: maxFollowUpDepth + 1, maxFollowUpDepth };
}

export function getGroupSpeechActForPlanPosition(params: {
  index: number;
  totalCount: number;
  hasExistingTopic: boolean;
}): GroupSpeechAct {
  if (params.index === 0) {
    return params.hasExistingTopic ? 'topic_followup' : 'topic_starter';
  }

  if (params.index === params.totalCount - 1 && params.totalCount >= 3) {
    return 'cool_down_or_shift';
  }

  if (params.index % 3 === 1) {
    return 'small_reaction';
  }

  return params.index % 2 === 0 ? 'add_angle' : 'light_pushback';
}

export function buildGroupSpeechActInstruction(params: {
  act: GroupSpeechAct;
  trigger: GroupConversationTrigger;
}): string {
  const instructionByAct: Record<GroupSpeechAct, string> = {
    topic_starter: 'Speech act tendency: start a small natural group-chat topic from your current state, time, mood, or group context. Do not make it formal.',
    topic_followup: 'Speech act tendency: continue the current shared topic with one specific angle. Do not answer everything or summarize.',
    small_reaction: 'Speech act tendency: react like a real group member: follow the vibe, lightly tease, side-comment, or stir the room if it fits your character.',
    add_angle: 'Speech act tendency: cut in briefly with a different angle, clarification, doubt, or a small personal reaction.',
    light_pushback: 'Speech act tendency: if it fits your character, add light pushback, skepticism, or a different stance. Keep it casual, not argumentative.',
    cool_down_or_shift: 'Speech act tendency: leave a short hook for others, gently cool the topic, or shift the angle if the current topic is getting thin.',
  };

  return [
    instructionByAct[params.act],
    params.trigger === 'manual'
      ? 'The user manually nudged the group to keep moving, so a little more participation is okay, but do not sound like assigned turns.'
      : 'This is an automatic group response, so stay natural and restrained if the topic does not need more voices.',
    'This is a soft tendency, not a script. Character persona and the actual conversation beat come first.',
  ].join('\n');
}

export function computePerspectiveReactionWeight(params: {
  perspectiveSummary?: string;
  latestSpeakerId?: string;
  memberId: string;
  latestText?: string;
}): number {
  const summary = params.perspectiveSummary?.trim();
  if (!summary) {
    return 0;
  }

  let weight = 0.18;
  if (params.latestSpeakerId && params.latestSpeakerId !== params.memberId) {
    weight += 0.18;
  }

  if (/Latest public beat|What you just heard|React from your own stance/i.test(summary)) {
    weight += 0.16;
  }

  if (/Avoid repeating the same point/i.test(summary)) {
    weight -= 0.22;
  }

  if (params.latestText && params.latestText.length <= 20) {
    weight += 0.08;
  }

  return clamp(weight, -0.3, 0.65);
}

export function computeGroupPresenceParticipationWeight(state: CharacterTemporalState): number {
  let weight = 0;

  if (state.attentionState === 'focused') {
    weight += 0.22;
  } else if (state.attentionState === 'split') {
    weight -= 0.08;
  } else if (state.attentionState === 'drifting') {
    weight -= 0.18;
  } else {
    weight -= 0.28;
  }

  if (state.energyState === 'high') {
    weight += 0.18;
  } else if (state.energyState === 'low') {
    weight -= 0.12;
  } else if (state.energyState === 'sleepy') {
    weight -= 0.24;
  }

  if (state.socialState === 'open') {
    weight += 0.18;
  } else if (state.socialState === 'reserved') {
    weight -= 0.14;
  } else if (state.socialState === 'avoidant') {
    weight -= 0.3;
  }

  const groupGap = state.interactionGapState.minutesSinceLastGroupChat;
  if (groupGap !== null && groupGap > 6 * 60) {
    weight -= 0.2;
  } else if (groupGap !== null && groupGap > 60) {
    weight -= 0.08;
  }

  if (state.presenceCue.resumeStyle === 'fresh_reentry') {
    weight -= 0.1;
  }

  return clamp(weight, -0.55, 0.45);
}
