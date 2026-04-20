import type {
  DreamDecisionRecord,
  DreamRuntimeAct,
  DreamRuntimeScenario,
} from './dreamRuntimeTypes';

function normalizeInlineText(text: string | undefined) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export function compactSummaryText(text: string | undefined, maxLength: number) {
  const normalized = normalizeInlineText(text);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function findDecisionForAct(decisionTrail: DreamDecisionRecord[], actId: string) {
  return decisionTrail.find((record) => record.actId === actId) || null;
}

export function buildActBeatSummary(act: DreamRuntimeAct, decision?: DreamDecisionRecord | null) {
  const parts = [
    compactSummaryText(act.progression.plotAdvance, 18) || compactSummaryText(act.scene, 18),
    decision ? `你选了${compactSummaryText(decision.title, 10)}` : '',
    compactSummaryText(act.progression.consequence, 14) || compactSummaryText(act.progression.tensionShift, 14),
  ].filter(Boolean);

  return compactSummaryText(`${act.label}：${parts.join('；')}`, 52) || `${act.label}：梦继续往前。`;
}

export function buildDreamMemorySummary(scenario: DreamRuntimeScenario) {
  const frame = scenario.storyFrame;
  const parts = [
    compactSummaryText(frame.worldTitle, 12),
    compactSummaryText(`${frame.userDreamIdentity}与${frame.characterDreamIdentity}`, 28),
    compactSummaryText(frame.dreamRelationship, 18),
    compactSummaryText(frame.storyObjective, 18),
    compactSummaryText(frame.coreConflict, 18),
    compactSummaryText(frame.currentCrisis || frame.immediateGoal, 18),
  ].filter(Boolean);

  return compactSummaryText(parts.join('，'), 118) || compactSummaryText(scenario.coverTitle, 24) || '今夜的梦仍在继续。';
}

export function hydrateDreamRuntimeScenario<T extends DreamRuntimeScenario>(scenario: T): T {
  const acts = scenario.acts.map((act) => ({
    ...act,
    beatSummary: buildActBeatSummary(act, findDecisionForAct(scenario.decisionTrail, act.id)),
  }));

  return {
    ...scenario,
    acts,
    memorySummary: buildDreamMemorySummary({
      ...scenario,
      acts,
    }),
  };
}

export function buildRecentBeatSummary(scenario: DreamRuntimeScenario, count: number) {
  const recentActs = scenario.acts.slice(-count);
  return recentActs
    .map((act, index) => `${scenario.acts.length - recentActs.length + index + 1}. ${act.beatSummary || buildActBeatSummary(act, findDecisionForAct(scenario.decisionTrail, act.id))}`)
    .join('\n');
}

export function buildEndingFocusSummary(scenario: DreamRuntimeScenario) {
  const parts = [
    `总纲：${scenario.memorySummary || buildDreamMemorySummary(scenario)}`,
    `近幕：${buildRecentBeatSummary(scenario, 4) || 'n/a'}`,
    `收束：${compactSummaryText(scenario.endingInput.endingDirection, 24) || 'n/a'} / ${compactSummaryText(scenario.endingInput.keyActionSummary, 56) || 'n/a'}`,
  ];

  return compactSummaryText(parts.join('\n'), 320);
}

export function buildAftermathFocusSummary(scenario: DreamRuntimeScenario) {
  const endingSummary = scenario.endingOutput
    ? `${compactSummaryText(scenario.endingOutput.title, 14)}：${compactSummaryText(scenario.endingOutput.body, 56)}`
    : compactSummaryText(scenario.endingInput.keyActionSummary, 56);

  const parts = [
    `总纲：${scenario.memorySummary || buildDreamMemorySummary(scenario)}`,
    `近幕：${buildRecentBeatSummary(scenario, 3) || 'n/a'}`,
    `结尾：${endingSummary || 'n/a'}`,
    `余响提示：${compactSummaryText(scenario.aftermathInput.relationshipShift, 20) || 'n/a'} / ${compactSummaryText(scenario.aftermathInput.toneDrift, 24) || 'n/a'}`,
  ];

  return compactSummaryText(parts.join('\n'), 320);
}
