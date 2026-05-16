import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  GroupOfflineRound,
  GroupOfflineRoundCharacterEntry,
  GroupOfflineSession,
} from '../../../../types';
import type { GroupOfflineRuntimeProjection } from '../../../group-offline/types';
import { buildGroupOfflineEntryRewritePrompt } from './buildGroupOfflineEntryRewritePrompt';

function createSession(overrides: Partial<GroupOfflineSession> = {}): GroupOfflineSession {
  return {
    id: overrides.id ?? 'offline-1',
    groupId: overrides.groupId ?? 'group-1',
    mode: overrides.mode ?? 'daily',
    generationMode: overrides.generationMode ?? 'blocks',
    activityType: overrides.activityType ?? '夜色里也藏不住',
    location: overrides.location ?? '海边长椅',
    timeLabel: overrides.timeLabel ?? '今晚 21:30',
    weatherLabel: overrides.weatherLabel ?? '海风有点凉',
    vibe: overrides.vibe ?? '各怀心事',
    participants: overrides.participants ?? [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    currentRound: overrides.currentRound ?? 1,
    messages: overrides.messages ?? [],
    status: overrides.status ?? 'active',
  } as GroupOfflineSession;
}

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
          signature: '不想说破，但也不打算完全放过。',
        },
        persona: {
          corePersona: '表面冷静，实际上会记很细。',
          expressionStyle: '说话不高声，但会把重点留在停顿后面。',
          boundaryPack: '不会一下子把话说破。',
        },
        memory: {
          shortTermSummary: '刚经历过一轮关系发热，表面收着，注意力其实没退开。',
          longTermMemoryProfile: '会把表面克制、实际偏心的互动记很久。',
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
          expressionStyle: '更常用轻一点的打趣把气氛往前拨。',
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

function createEntry(): GroupOfflineRoundCharacterEntry {
  return {
    characterId: 'alpha',
    speakerLabel: '沈星回',
    target: { type: 'character', label: '张白', characterId: 'beta' },
    text: '沈星回把杯子往手边扣了扣，像是在压住那句已经到了嘴边的话。',
    highlightText: '“你先把话说完。”',
    statusFields: [],
  };
}

function createRound(entry: GroupOfflineRoundCharacterEntry): GroupOfflineRound {
  return {
    id: 'round-1',
    title: '第 1 轮',
    sceneText: '风从海边卷过来，场上的气氛还没真正散掉。',
    userMessageText: '张白，你别光顾着看吃的。',
    characterEntries: [
      entry,
      {
        characterId: 'beta',
        speakerLabel: '张白',
        text: '张白嘴上还在绕，眼神却先偏了过去。',
        statusFields: [],
      },
    ],
  };
}

test('buildGroupOfflineEntryRewritePrompt uses runtime projection and style guard', () => {
  const entry = createEntry();
  const prompt = buildGroupOfflineEntryRewritePrompt({
    kind: 'retry',
    session: createSession(),
    round: createRound(entry),
    entry,
    runtimeProjection: createProjection(),
  });

  assert.match(prompt, /当前角色运行时资料：/);
  assert.match(prompt, /和用户关系：和用户之间已经不是泛泛之交。/);
  assert.match(prompt, /同轮其他角色（只用于衔接，不要改写他们）/);
  assert.match(prompt, /文风只能改变句子节奏、描写密度、镜头感和措辞/);
  assert.match(prompt, /notebook 必须严格控制在 30 到 50 个汉字/);
  assert.match(prompt, /aftereffects\.items 固定输出 4 张卡/);
  assert.doesNotMatch(prompt, /当前角色关系上下文：/);
});
