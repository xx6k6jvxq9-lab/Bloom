import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupOfflineRound, GroupOfflineScenarioType, GroupOfflineSession } from '../../types';
import {
  applyGroupOfflineScenarioRoundResult,
  buildGroupOfflineScenarioCardFields,
  buildGroupOfflineScenarioState,
  getGroupOfflineScenarioBlueprint,
  replayGroupOfflineScenarioState,
} from './scenarioTasks';

function createScenarioSession(overrides: Partial<GroupOfflineSession> = {}): GroupOfflineSession {
  const activityType = ((overrides.activityType as GroupOfflineSession['activityType']) || '倒计时任务') as GroupOfflineScenarioType;
  const roundLimit = getGroupOfflineScenarioBlueprint(activityType).roundLimit;
  const scenarioState = buildGroupOfflineScenarioState({
    type: activityType,
    scenePrompt: overrides.scenePrompt || '封锁区正在准备清场。',
    location: overrides.location || '封锁区后门',
    weatherLabel: overrides.weatherLabel || '风压很低',
    vibe: overrides.vibe || '越聊越紧',
    participantNames: ['Alpha', 'Beta'],
    seed: overrides.createdAt ?? 1,
  });

  return {
    id: overrides.id ?? 'scenario-1',
    groupId: overrides.groupId ?? 'group-1',
    mode: 'scenario',
    generationMode: 'blocks',
    activityType,
    location: overrides.location ?? '封锁区后门',
    scenePrompt: overrides.scenePrompt ?? '封锁区正在准备清场。',
    timeLabel: overrides.timeLabel ?? '今晚 21:30',
    weatherLabel: overrides.weatherLabel ?? '风压很低',
    vibe: overrides.vibe ?? '越聊越紧',
    participants: overrides.participants ?? [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    currentRound: overrides.currentRound ?? 0,
    roundLimit: overrides.roundLimit ?? roundLimit,
    scenarioState: overrides.scenarioState ?? scenarioState,
    messages: overrides.messages ?? [],
    status: overrides.status ?? 'active',
    generatedContent: overrides.generatedContent,
  } as GroupOfflineSession;
}

test('buildGroupOfflineScenarioState creates a concrete background and task for identity-mismatch sessions', () => {
  const scenarioState = buildGroupOfflineScenarioState({
    type: '身份错位',
    location: '旧影院楼上',
    weatherLabel: '信号不稳 / 空气像被什么压住',
    vibe: '各怀心事',
    participantNames: ['张白', '沈星回'],
    seed: 7,
  });

  assert.equal(scenarioState.backgroundLabel.includes('张白') || scenarioState.backgroundLabel.includes('沈星回'), true);
  assert.equal(/身份|权限|记录/.test(scenarioState.backgroundLabel), true);
  assert.equal(/身份|拿到|撤掉|通行/.test(scenarioState.currentTask), true);
  assert.equal((scenarioState.userInvolvementLabel || '').length > 0, true);
  assert.equal(scenarioState.taskSteps.length, 3);
});

test('buildGroupOfflineScenarioState lets an explicit task hint override the default task template', () => {
  const scenarioState = buildGroupOfflineScenarioState({
    type: '倒计时任务',
    storySourceHint: '昨晚有人把真正的授权卡从档案袋里换了出来，今天清场前这件事被重新翻到台面上。',
    userInvolvementHint: '你得先盯住交接点，因为第一句判断会先落到你这里。',
    currentTaskHint: '在剩余 6 轮内把真正的授权卡带到后场交接点，并确认交接生效。',
    location: '旧影院楼上',
    weatherLabel: '信号不稳 / 空气像被什么压住',
    vibe: '各怀心事',
    participantNames: ['张白', '沈星回'],
    seed: 11,
  });

  assert.equal(
    scenarioState.currentTask,
    '在剩余 6 轮内把真正的授权卡带到后场交接点，并确认交接生效。',
  );
  assert.equal(
    scenarioState.storySourceLabel,
    '昨晚有人把真正的授权卡从档案袋里换了出来，今天清场前这件事被重新翻到台面上。',
  );
  assert.equal(
    scenarioState.userInvolvementLabel,
    '你得先盯住交接点，因为第一句判断会先落到你这里。',
  );
});

test('buildGroupOfflineScenarioCardFields exposes task and countdown labels for scenario sessions', () => {
  const session = createScenarioSession();
  const fields = buildGroupOfflineScenarioCardFields(session);

  assert.equal(typeof fields.taskLabel, 'string');
  assert.equal(typeof fields.backgroundLabel, 'string');
  assert.match(fields.roundLabel || '', /剩余 6 轮/);
  assert.match(fields.progressLabel || '', /0\/3 步完成/);
});

test('applyGroupOfflineScenarioRoundResult updates task steps and progress summary', () => {
  const session = createScenarioSession({ currentRound: 1 });
  const round: GroupOfflineRound = {
    id: 'round-1',
    characterEntries: [],
    scenarioUpdate: {
      progressSummary: '已经确认了真正的目标物位置。',
      taskStepUpdates: [
        { slot: 1, status: 'completed', note: '目标物和交接点已经对上。' },
      ],
    },
  };

  const nextSession = applyGroupOfflineScenarioRoundResult(session, round);

  assert.equal(nextSession.scenarioState?.taskSteps[0]?.status, 'completed');
  assert.equal(nextSession.scenarioState?.taskSteps[0]?.updatedAtRound, 1);
  assert.match(nextSession.scenarioState?.progressSummary || '', /目标物位置/);
  assert.equal(nextSession.scenarioState?.status, 'active');
});

test('applyGroupOfflineScenarioRoundResult marks active scenario as failed at round limit', () => {
  const session = createScenarioSession({ currentRound: 6 });
  const nextSession = applyGroupOfflineScenarioRoundResult(session, {
    id: 'round-6',
    characterEntries: [],
  });

  assert.equal(nextSession.scenarioState?.status, 'failed');
  assert.match(nextSession.scenarioState?.progressSummary || '', /轮数已经耗尽/);
});

test('replayGroupOfflineScenarioState rebuilds scenario progress from remaining rounds', () => {
  const session = createScenarioSession();
  const rounds: GroupOfflineRound[] = [
    {
      id: 'round-1',
      characterEntries: [],
      scenarioUpdate: {
        taskStepUpdates: [{ slot: 1, status: 'completed' }],
      },
    },
    {
      id: 'round-2',
      characterEntries: [],
      scenarioUpdate: {
        taskStepUpdates: [{ slot: 2, status: 'completed' }],
        progressSummary: '已经完成两步，最后只差交接。',
      },
    },
  ];

  const replayed = replayGroupOfflineScenarioState(session, rounds, ['Alpha', 'Beta']);

  assert.equal(replayed?.taskSteps[0]?.status, 'completed');
  assert.equal(replayed?.taskSteps[1]?.status, 'completed');
  assert.equal(replayed?.taskSteps[2]?.status, 'pending');
  assert.match(replayed?.progressSummary || '', /最后只差交接/);
});
