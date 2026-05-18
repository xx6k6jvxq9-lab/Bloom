import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGroupOfflineScenarioState } from './scenarioTasks';

test('buildGroupOfflineScenarioState keeps explicit editable anchor hints', () => {
  const scenarioState = buildGroupOfflineScenarioState({
    type: '临时营救',
    missionObjectHint: '真正能生效的授权卡',
    identityPairHint: '夜班放映员 / 临时审片人',
    rescueTargetHint: '被困在后场的临时证人 / 她知道是谁先改了名单',
    handoffOrExitHint: '后场备用门',
    failureConditionHint: '倒计时归零时人还没带出来，这场局就会直接转成收残局。',
    location: '旧影院楼上',
    weatherLabel: '信号不稳 / 空气像被什么压住',
    vibe: '各怀心事',
    participantNames: ['张白', '沈星回'],
    seed: 23,
  });

  assert.equal(scenarioState.missionObjectLabel, '真正能生效的授权卡');
  assert.equal(scenarioState.identityPairLabel, '夜班放映员 / 临时审片人');
  assert.equal(scenarioState.rescueTargetLabel, '被困在后场的临时证人');
  assert.equal(scenarioState.handoffPointLabel, '后场备用门');
  assert.equal(scenarioState.exitMethodLabel, '后场备用门');
  assert.equal(
    scenarioState.failureCondition,
    '倒计时归零时人还没带出来，这场局就会直接转成收残局。',
  );
});
