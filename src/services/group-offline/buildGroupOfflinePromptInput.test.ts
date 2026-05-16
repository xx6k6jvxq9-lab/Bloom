import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupOfflineRuntimeProjection } from './types';
import { buildGroupOfflinePromptInput } from './buildGroupOfflinePromptInput';

test('buildGroupOfflinePromptInput exposes per-character relationship context and group runtime summary', () => {
  const projection: GroupOfflineRuntimeProjection = {
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
    characters: [{
      identity: {
        characterId: 'alpha',
        name: '沈星回',
        displayName: '沈星回',
        avatarCandidates: [],
      },
      persona: {},
      memory: {},
      userRelation: {},
      peerRelations: [],
      groupState: {},
      relationshipContextSummary: '公开关系：已经不是泛泛之交。',
    }],
  };

  const promptInput = buildGroupOfflinePromptInput(projection);

  assert.equal(promptInput.relationshipContextByCharacterId.alpha, '公开关系：已经不是泛泛之交。');
  assert.match(promptInput.groupStateSummary || '', /群长期氛围/);
  assert.match(promptInput.groupStateSummary || '', /群共同经历/);
  assert.match(promptInput.groupStateSummary || '', /当前群场景/);
});
