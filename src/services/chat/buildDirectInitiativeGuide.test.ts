import assert from 'node:assert/strict';
import test from 'node:test';
import type { CharacterTemporalState } from '../relationship-time/buildCharacterTemporalState';
import { buildDirectInitiativeGuide } from './buildDirectInitiativeGuide';

function createTemporalState(overrides: Partial<CharacterTemporalState> = {}): CharacterTemporalState {
  return {
    temporalFacts: {
      nowTimestamp: Date.now(),
      timeSource: 'real',
      dateText: '2026-05-14 21:00',
      timePeriod: 'evening',
      isLateNight: false,
    } as CharacterTemporalState['temporalFacts'],
    interactionGapState: {
      continuityMode: 'same_day_resume',
      minutesSinceLastContinuityChat: 90,
      minutesSinceLastGroupChat: null,
      minutesSinceLastCoupleSpaceActivity: null,
      recentInteractionDensity: 'medium',
    } as CharacterTemporalState['interactionGapState'],
    topicHeatState: {
      currentTopicHeat: 'warm',
      suggestedTopicAction: 'continue',
      topicDecayStage: 'fresh',
      hasPendingEmotionalThread: true,
      lastTopicAnchor: '上次那句没说完的话',
    } as CharacterTemporalState['topicHeatState'],
    continuityMode: 'same_day_resume',
    energyState: 'steady',
    socialState: 'open',
    attentionState: 'focused',
    relationshipPull: 'high',
    initiativeReadiness: 'ready',
    sceneMomentum: 'continue',
    presenceCue: {
      currentActivity: '刚忙完，顺手回来看看你这边。',
      attentionNote: '这轮可以自然接住，也可以主动带一点自己的状态。',
      lifeResidue: '最近还有一点共同生活的余温挂在身上。',
      resumeStyle: 'soft_return',
    },
    ...overrides,
  };
}

test('buildDirectInitiativeGuide offers lightweight initiative candidates instead of hard plot commands', () => {
  const guide = buildDirectInitiativeGuide({
    temporalState: createTemporalState(),
    recentContext: {
      sharedRecentRelationshipSummary: '最近这段关系余波还在发热。',
      taskResidue: [{
        type: 'task_residue',
        summary: '还欠着一起去那家店的约定',
        sourceScene: 'direct_chat',
        timestamp: Date.now(),
        decay: 'medium',
        visibility: 'cross_scene_readable',
      }],
    },
    openLoopRegistry: [{
      id: 'loop-1',
      kind: 'relationship',
      status: 'waiting_user',
      content: '上次那句喜欢还没真正挑明',
      source: 'manual',
      createdAt: Date.now(),
      lastTouchedAt: Date.now(),
      updatedAt: Date.now(),
    }],
  });

  assert.match(guide, /## 角色主动带线参考/);
  assert.match(guide, /可以主动带出的方向/);
  assert.match(guide, /刚忙完，顺手回来看看你这边/);
  assert.match(guide, /最近这段关系余波还在发热/);
  assert.match(guide, /上次那句喜欢还没真正挑明/);
  assert.match(guide, /主动不等于必须热情/);
});
