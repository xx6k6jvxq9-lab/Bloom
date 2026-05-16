import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupOfflineSession } from '../../types';
import type { GroupOfflineRuntimeProjection } from './types';
import { buildGroupOfflineRoundPlan } from './buildGroupOfflineRoundPlan';

function createProjection(): GroupOfflineRuntimeProjection {
  return {
    session: {
      id: 'offline-1',
      groupId: 'group-1',
      mode: 'daily',
      generationMode: 'blocks',
      activityType: '夜色里也藏不住',
      customActivityType: undefined,
      location: '海边长椅',
      timeLabel: '今晚 21:30',
      weatherLabel: '海风有点凉',
      vibe: '各怀心事',
      currentRound: 1,
    },
    userName: '林然然',
    groupName: '群聊',
    generatedAt: 1,
    groupSummary: {
      groupShortTermSummary: '这群人的注意力已经明显偏向彼此。',
      groupLongTermAtmosphere: '表面散漫，实际谁都记得分寸。',
      groupRecurringDynamics: '有人爱装没事，有人专盯停顿。',
      groupSharedHistory: '一起熬过几次深夜。',
      backgroundSummary: '这个群不是真的普通朋友群。',
      memberRelationshipState: 'close',
      currentScene: '刚从线下回到线上。',
      publicFacts: '彼此都知道不是普通群友。',
    },
    characters: [
      {
        identity: {
          characterId: 'alpha',
          name: '沈星回',
          displayName: '沈星回',
          avatarCandidates: [],
        },
        persona: {
          corePersona: '表面冷静，实际会在意别人细小反应。',
          expressionStyle: '说话不高声，但会把重点留在停顿后面。',
          boundaryPack: '不会一下子说破。',
        },
        memory: {
          shortTermSummary: '刚经历过一轮关系发热，表面收着，注意力其实没退开。',
        },
        userRelation: {
          relationshipSummary: '和用户之间已经不是泛泛之交。',
          relationshipTensionSummary: '他更在意用户到底会不会把注意力给到别人。',
        },
        peerRelations: [{
          peerCharacterId: 'beta',
          peerName: '张白',
          familiarityLabel: '群里已经偏熟',
          interactionStyleLabel: '互动偏打趣',
          summary: '熟悉度：群里已经偏熟\n最近同场：最近有明显对接和来回。',
        }],
        groupState: {},
      },
      {
        identity: {
          characterId: 'beta',
          name: '张白',
          displayName: '张白',
          avatarCandidates: [],
        },
        persona: {
          corePersona: '说话更直接，但不喜欢真把态度说穿。',
          expressionStyle: '常用轻一点的打趣把气氛往前拨。',
        },
        memory: {},
        userRelation: {
          relationshipSummary: '和用户说话已经不完全客气。',
        },
        peerRelations: [{
          peerCharacterId: 'alpha',
          peerName: '沈星回',
          familiarityLabel: '群里已经偏熟',
          interactionStyleLabel: '互动偏中性',
          summary: '熟悉度：群里已经偏熟\n最近同场：最近有同场露面，但互动还不算多。',
        }],
        groupState: {},
      },
    ],
  };
}

function createSession(): GroupOfflineSession {
  return {
    id: 'offline-1',
    groupId: 'group-1',
    mode: 'daily',
    generationMode: 'blocks',
    activityType: '夜色里也藏不住',
    location: '海边长椅',
    timeLabel: '今晚 21:30',
    weatherLabel: '海风有点凉',
    vibe: '各怀心事',
    participants: [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: 1,
    updatedAt: 1,
    currentRound: 1,
    messages: [],
    status: 'active',
  };
}

test('buildGroupOfflineRoundPlan keeps selected order and target as dispatch only', () => {
  const plan = buildGroupOfflineRoundPlan({
    session: createSession(),
    projection: createProjection(),
    selectedCharacterIds: ['alpha', 'beta'],
    dispatchMode: 'manual',
    latestUserMessage: '张白，你别光顾着看吃的，记得给沈哥也留点。',
    userMessageText: '张白，你别光顾着看吃的，记得给沈哥也留点。',
  });

  assert.deepEqual(plan.selectedCharacterIds, ['alpha', 'beta']);
  assert.equal(plan.characterSteps.length, 2);
  assert.equal(plan.characterSteps[0]?.target.type, 'character');
  assert.equal(plan.characterSteps[0]?.target.characterId, 'beta');
  assert.equal(plan.characterSteps[1]?.target.type, 'character');
  assert.match(plan.summary, /手动顺序出场：沈星回 -> 张白/);
});

test('buildGroupOfflineRoundPlan lets the first selected speaker point at the user when no one is explicitly named', () => {
  const plan = buildGroupOfflineRoundPlan({
    session: createSession(),
    projection: createProjection(),
    selectedCharacterIds: ['alpha'],
    dispatchMode: 'recommend',
    latestUserMessage: '你先说。',
    userMessageText: '你先说。',
  });

  assert.equal(plan.characterSteps[0]?.target.type, 'user');
  assert.equal(plan.characterSteps[0]?.target.label, '林然然');
  assert.match(plan.summary, /系统调度出场：沈星回/);
});
