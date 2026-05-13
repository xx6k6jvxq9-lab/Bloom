import type { CharacterOpenLoopEntry } from '../../types';
import type { ChatRecentContext } from '../relationship-context/types';
import type { CharacterTemporalState } from '../relationship-time/buildCharacterTemporalState';

export type DirectInitiativeGuideInput = {
  temporalState: CharacterTemporalState;
  recentContext?: ChatRecentContext;
  openLoopRegistry?: CharacterOpenLoopEntry[];
};

function compactLine(value: string | undefined, maxLength = 96): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function uniqueLines(lines: Array<string | undefined>, maxItems = 4): string[] {
  const seen = new Set<string>();
  const collected: string[] = [];

  for (const line of lines) {
    const normalized = compactLine(line);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    collected.push(normalized);
    if (collected.length >= maxItems) {
      break;
    }
  }

  return collected;
}

function buildReadinessLabel(state: CharacterTemporalState): string {
  if (state.initiativeReadiness === 'ready') {
    return '当前主动意愿偏高，可以自然把自己的生活线、旧余波或顺手想到的点带进来。';
  }

  if (state.initiativeReadiness === 'hold') {
    return '当前更适合轻一点、短一点的主动，不要猛推剧情，也不要硬续旧线。';
  }

  return '当前主动意愿偏低，如果不是很有必要，更适合轻轻碰一下或只顺手带一点生活感。';
}

function buildCandidateLines(input: DirectInitiativeGuideInput): string[] {
  const { temporalState, recentContext, openLoopRegistry = [] } = input;
  const relationshipLoop = openLoopRegistry.find((entry) => entry.kind === 'relationship' && entry.status !== 'resolved');
  const taskLoop = openLoopRegistry.find((entry) => entry.kind === 'task' && entry.status !== 'resolved');

  const lifeCandidates = uniqueLines([
    temporalState.presenceCue.currentActivity
      ? `从你当下的生活状态里顺手开口：${compactLine(temporalState.presenceCue.currentActivity)}`
      : '',
    temporalState.presenceCue.lifeResidue
      ? `把最近这段生活余波翻成一句更像活人的顺手念头：${compactLine(temporalState.presenceCue.lifeResidue)}`
      : '',
    recentContext?.recentCoupleSpaceSummary
      ? `最近共同生活的余温可以翻成一句生活感很强的顺手消息：${compactLine(recentContext.recentCoupleSpaceSummary)}`
      : '',
  ], 2);

  const relationshipCandidates = uniqueLines([
    recentContext?.sharedRecentRelationshipSummary
      ? `如果想轻轻接旧余波，只带一句新的态度或生活角度，不要整段复述：${compactLine(recentContext.sharedRecentRelationshipSummary)}`
      : '',
    relationshipLoop?.content
      ? `如果你想继续碰关系线，优先轻轻碰这类还在发热的点：${compactLine(relationshipLoop.content)}`
      : '',
    recentContext?.topicAnchors?.[0]?.summary
      ? `如果你想轻轻回带旧话题，只提最相关的一根线，不要整段冷启动：${compactLine(recentContext.topicAnchors[0].summary)}`
      : '',
  ], 2);

  const actionCandidates = uniqueLines([
    recentContext?.taskResidue?.[0]?.summary
      ? `如果你想主动提一件还挂着的事，优先提这类可落地的小约定：${compactLine(recentContext.taskResidue[0].summary)}`
      : '',
    taskLoop?.content
      ? `如果你要把未完事项带回来，先挑这种最容易落地的一件：${compactLine(taskLoop.content)}`
      : '',
  ], 1);

  const candidates = uniqueLines([
    ...lifeCandidates,
    ...relationshipCandidates,
    ...actionCandidates,
  ], 5);

  if (candidates.length > 0) {
    return candidates;
  }

  return [
    '如果最近没有特别适合主动提的旧线，就只带一小块生活碎片、顺手想到的事、轻微关心或一条短问句。',
  ];
}

export function buildDirectInitiativeGuide(input: DirectInitiativeGuideInput): string {
  const { temporalState } = input;
  const cautionLine = temporalState.continuityMode === 'resume_after_gap'
    ? '这次更像隔了一段时间后重新出现，主动开口时先回到现在的生活状态，不要像上一句还悬在半空。'
    : temporalState.sceneMomentum === 'close'
      ? '如果当前这一轮本来就适合收束，允许只轻轻碰一下，不必强行找新剧情。'
      : '主动带线时优先像顺手想到、顺手发来，而不是像预设好的剧情触发器。';

  return [
    '## 角色主动带线参考',
    buildReadinessLabel(temporalState),
    cautionLine,
    '[可以主动带出的方向]',
    ...buildCandidateLines(input).map((line) => `- ${line}`),
    '[限制]',
    '- 允许角色主动分享自己的生活、旧余波、顺手想到的事、未完小约定或轻微情绪变化。',
    '- 不要为了“主动”就强行升级关系、编造重大事件、突然抛出新设定，或把旧话题整段搬回来。',
    '- 主动不等于必须热情；冷冷地来一句、收着提一嘴、半途转开、故意压着不说，也都成立。',
  ].join('\n');
}
