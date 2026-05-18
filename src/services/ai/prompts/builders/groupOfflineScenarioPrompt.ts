import type { GroupOfflineSession } from '../../../../types';
import {
  getGroupOfflineScenarioRemainingRounds,
  getGroupOfflineScenarioStatusLabel,
} from '../../../group-offline/scenarioTasks';

export function formatGroupOfflineScenarioBrief(session: GroupOfflineSession): string | undefined {
  if (session.mode !== 'scenario' || !session.scenarioState) {
    return undefined;
  }

  const remainingRounds = getGroupOfflineScenarioRemainingRounds(session);

  return [
    '## 设定局任务',
    `类型：${session.scenarioState.type}`,
    `背景：${session.scenarioState.backgroundLabel}`,
    session.scenarioState.userInvolvementLabel ? `用户切入口：${session.scenarioState.userInvolvementLabel}` : '',
    session.scenarioState.missionObjectLabel ? `关键目标物：${session.scenarioState.missionObjectLabel}` : '',
    session.scenarioState.identityPairLabel ? `错位身份：${session.scenarioState.identityPairLabel}` : '',
    session.scenarioState.rescueTargetLabel ? `营救对象：${session.scenarioState.rescueTargetLabel}` : '',
    session.scenarioState.handoffPointLabel ? `交接点：${session.scenarioState.handoffPointLabel}` : '',
    session.scenarioState.exitMethodLabel ? `出口/回程：${session.scenarioState.exitMethodLabel}` : '',
    `当前任务：${session.scenarioState.currentTask}`,
    `当前状态：${getGroupOfflineScenarioStatusLabel(session.scenarioState.status)}`,
    typeof remainingRounds === 'number' ? `剩余轮数：${remainingRounds}` : '',
    `成功条件：${session.scenarioState.successCondition}`,
    `失败条件：${session.scenarioState.failureCondition}`,
    session.scenarioState.pressureLine ? `倒数规则：${session.scenarioState.pressureLine}` : '',
    `当前推进：${session.scenarioState.progressSummary}`,
    session.scenarioState.taskSteps.length > 0
      ? [
          '任务步骤：',
          ...session.scenarioState.taskSteps.map((step) => (
            `${step.slot}. [${step.status}] ${step.label}${step.note ? ` / ${step.note}` : ''}`
          )),
        ].join('\n')
      : '',
  ].filter(Boolean).join('\n');
}

export function buildGroupOfflineScenarioRoundRuleLines(session: GroupOfflineSession): string[] {
  if (session.mode !== 'scenario' || !session.scenarioState) {
    return [];
  }

  return [
    '当前是设定局。每一轮都必须围绕“当前任务”推进，不能只重写气氛而没有任务结果。',
    '这类设定局整体手感更像副本开局、快穿落点或临时异轨事件，不要写成值班记录、规则摘要或系统播报。',
    '背景必须写出这场局为什么会出现、是谁先动了哪一步、现场为什么会突然变成这样，不能只写抽象危险。',
    '用户必须在这场局里有明确切入口，不要把用户写成站在旁边听说明的局外人。',
    '当前任务必须落到具体对象、身份、地点、交接动作或出口条件上，不能只写“调查一下”“处理一下”。',
    'progressSummary 要像这一轮推进后的当前拍点，是一两句带余压的小说式承接，不要写成汇报口吻。',
    '如果这一轮完成了关键步骤、任务成功或任务失败，必须在 round.scenarioUpdate 里明确写出来。',
    'scenarioUpdate.taskStepUpdates 只允许更新已经给出的 1/2/3 号步骤，不要自己新增步骤。',
  ];
}

export function buildGroupOfflineScenarioSchemaLines(session: GroupOfflineSession, indent = '      '): string[] {
  if (session.mode !== 'scenario' || !session.scenarioState) {
    return [];
  }

  return [
    `${indent}"scenarioUpdate": {`,
    `${indent}  "status": "active|completed|failed",`,
    `${indent}  "progressSummary": "这一轮推进后的任务进度结果，必须具体，而且要像副本推进里的当前拍点，不要空话",`,
    `${indent}  "currentTask": "可选字符串；只有任务阶段真的变化时才改写",`,
    `${indent}  "taskStepUpdates": [`,
    `${indent}    { "slot": 1, "status": "pending|completed|failed", "note": "可选字符串" }`,
    `${indent}  ]`,
    `${indent}},`,
  ];
}
