import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupOfflineSession } from '../../../../types';
import type {
  GroupOfflineRoundPlan,
  GroupOfflineRuntimeProjection,
} from '../../../group-offline/types';
import { buildGroupOfflinePrompt } from './buildGroupOfflinePrompt';

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

test('buildGroupOfflinePrompt uses runtime projection and keeps round plan as dispatch only', () => {
  const roundPlan: GroupOfflineRoundPlan = {
    generationMode: 'blocks',
    dispatchMode: 'manual',
    selectedCharacterIds: ['alpha', 'beta'],
    summary: '本轮按手动顺序出场：沈星回 -> 张白。',
    characterSteps: [
      {
        characterId: 'alpha',
        speakerLabel: '沈星回',
        target: { type: 'character', label: '张白', characterId: 'beta' },
      },
      {
        characterId: 'beta',
        speakerLabel: '张白',
        target: { type: 'group', label: '全场' },
      },
    ],
  };

  const prompt = buildGroupOfflinePrompt({
    session: createSession(),
    runtimeProjection: createProjection(),
    phase: 'round',
    selectedCharacterIds: ['alpha', 'beta'],
    dispatchMode: 'manual',
    latestUserMessage: '张白，你别光顾着看吃的。',
    roundPlan,
  });

  assert.match(prompt, /## 本轮调度/);
  assert.match(prompt, /调度摘要：本轮按手动顺序出场：沈星回 -> 张白。/);
  assert.match(prompt, /这份规划只负责谁出场、顺序和目标对象/);
  assert.match(prompt, /群线下运行时状态/);
  assert.match(prompt, /和用户关系：和用户之间已经不是泛泛之交。/);
  assert.match(prompt, /notebook 必须严格控制在 30 到 50 个汉字/);
  assert.match(prompt, /aftereffects\.items 固定输出 4 张卡/);
  assert.match(prompt, /不要输出新的 soundtrack 或 participantSoundtracks/);
  assert.doesNotMatch(prompt, /"soundtrack": \{/);
  assert.doesNotMatch(prompt, /动作节拍：/);
  assert.doesNotMatch(prompt, /意图：/);
});

test('buildGroupOfflinePrompt requires ensemble rounds to output article paragraphs as main reading body', () => {
  const roundPlan: GroupOfflineRoundPlan = {
    generationMode: 'ensemble',
    dispatchMode: 'continue',
    selectedCharacterIds: ['alpha', 'beta'],
    summary: '本轮继续同场，让多人自然接话往下走。',
    characterSteps: [
      {
        characterId: 'alpha',
        speakerLabel: '沈星回',
        target: { type: 'group', label: '全场' },
      },
      {
        characterId: 'beta',
        speakerLabel: '张白',
        target: { type: 'character', label: '沈星回', characterId: 'alpha' },
      },
    ],
  };

  const prompt = buildGroupOfflinePrompt({
    session: createSession({ generationMode: 'ensemble' }),
    runtimeProjection: {
      ...createProjection(),
      session: {
        ...createProjection().session,
        generationMode: 'ensemble',
      },
    },
    phase: 'round',
    selectedCharacterIds: ['alpha', 'beta'],
    dispatchMode: 'continue',
    latestUserMessage: '你们继续。',
    roundPlan,
  });

  assert.match(prompt, /articleParagraphs 才是主阅读正文/);
  assert.match(prompt, /必须明显分段/);
  assert.match(prompt, /focusCharacterIds 和 speakerCharacterIds/);
  assert.match(prompt, /不要再按角色分块输出/);
  assert.match(prompt, /characterEntries 不是主阅读正文/);
  assert.match(prompt, /不要输出新的 soundtrack 或 participantSoundtracks/);
  assert.doesNotMatch(prompt, /"soundtrack": \{/);
  assert.match(prompt, /"articleParagraphs": \[/);
  assert.match(prompt, /"focusCharacterIds": \[/);
  assert.match(prompt, /"speakerCharacterIds": \[/);
});
