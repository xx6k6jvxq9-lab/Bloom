import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupOfflineSession } from '../../../../types';
import type {
  GroupOfflineRoundPlan,
  GroupOfflineRuntimeProjection,
} from '../../../group-offline/types';
import { buildGroupOfflineScenarioState } from '../../../group-offline/scenarioTasks';
import { buildGroupOfflinePrompt } from './buildGroupOfflinePrompt';

function createSession(overrides: Partial<GroupOfflineSession> = {}): GroupOfflineSession {
  return {
    id: overrides.id ?? 'offline-1',
    groupId: overrides.groupId ?? 'group-1',
    mode: overrides.mode ?? 'daily',
    generationMode: overrides.generationMode ?? 'blocks',
    activityType: overrides.activityType ?? '夜色里也藏不住谁先偏心',
    customActivityType: overrides.customActivityType,
    scenePrompt: overrides.scenePrompt,
    location: overrides.location ?? '海边长椅',
    timeLabel: overrides.timeLabel ?? '今晚 21:30',
    weatherLabel: overrides.weatherLabel ?? '海风有点冷',
    vibe: overrides.vibe ?? '各怀心事',
    participants: overrides.participants ?? [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    currentRound: overrides.currentRound ?? 1,
    roundLimit: overrides.roundLimit,
    scenarioState: overrides.scenarioState,
    directorInstruction: overrides.directorInstruction,
    awaitingDirectorInstruction: overrides.awaitingDirectorInstruction,
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
      activityType: '夜色里也藏不住谁先偏心',
      customActivityType: undefined,
      location: '海边长椅',
      timeLabel: '今晚 21:30',
      weatherLabel: '海风有点冷',
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
      publicFacts: '彼此都知道不只是普通群友。',
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
        groupState: {} as GroupOfflineRuntimeProjection['characters'][number]['groupState'],
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
        memory: {} as GroupOfflineRuntimeProjection['characters'][number]['memory'],
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
        groupState: {} as GroupOfflineRuntimeProjection['characters'][number]['groupState'],
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
    latestUserMessage: '张白，你别光顾着看热闹。',
    roundPlan,
  });

  assert.match(prompt, /## 本轮调度/);
  assert.match(prompt, /调度摘要：本轮按手动顺序出场：沈星回 -> 张白。/);
  assert.match(prompt, /这份调度只约束谁先出场、对谁出声/);
  assert.match(prompt, /群线下运行时状态/);
  assert.match(prompt, /和用户之间已经不是泛泛之交/);
  assert.match(prompt, /aftereffects\.items 固定输出 4 张卡/);
  assert.match(prompt, /memoryPanel\.shortTerm/);
  assert.doesNotMatch(prompt, /articleParagraphs/);
  assert.doesNotMatch(prompt, /"soundtrack": \{/);
});

test('buildGroupOfflinePrompt adds task-forward scenario rules for task-based sessions', () => {
  const scenarioSession = createSession({
    mode: 'scenario',
    activityType: '倒计时任务',
    scenePrompt: '封锁区已经开始清场。',
    currentRound: 2,
    roundLimit: 6,
    scenarioState: buildGroupOfflineScenarioState({
      type: '倒计时任务',
      scenePrompt: '封锁区已经开始清场。',
      location: '封锁区后门',
      weatherLabel: '风压很低',
      vibe: '越聊越紧',
      participantNames: ['沈星回', '张白'],
      seed: 7,
    }),
  });

  const prompt = buildGroupOfflinePrompt({
    session: scenarioSession,
    runtimeProjection: {
      ...createProjection(),
      session: {
        ...createProjection().session,
        mode: 'scenario',
        activityType: '倒计时任务',
        currentRound: 2,
      },
    },
    phase: 'round',
    selectedCharacterIds: ['alpha', 'beta'],
    dispatchMode: 'recommend',
    latestUserMessage: '别拖了，先把真正的东西带出来。',
  });

  assert.match(prompt, /## 设定局任务/);
  assert.match(prompt, /当前任务：/);
  assert.match(prompt, /如果这一轮完成了关键步骤、任务成功或任务失败/);
  assert.match(prompt, /scenarioUpdate/);
  assert.match(prompt, /taskStepUpdates/);
});

test('buildGroupOfflinePrompt keeps stored director text dormant unless this turn explicitly activates it', () => {
  const prompt = buildGroupOfflinePrompt({
    session: createSession({
      directorInstruction: '先让沈星回接，少铺环境，多落到任务物上。',
    }),
    runtimeProjection: createProjection(),
    phase: 'round',
    selectedCharacterIds: ['alpha', 'beta'],
    dispatchMode: 'recommend',
  });

  assert.doesNotMatch(prompt, /## 导演额外指令/);
  assert.doesNotMatch(prompt, /先让沈星回接/);
});

test('buildGroupOfflinePrompt injects director instruction block when start or next-round explicitly uses it', () => {
  const prompt = buildGroupOfflinePrompt({
    session: createSession({
      directorInstruction: '先把真正的东西交到我手里，再让张白补一句。',
      awaitingDirectorInstruction: true,
    }),
    runtimeProjection: createProjection(),
    phase: 'intro',
    directorMode: 'start',
  });

  assert.match(prompt, /## 导演额外指令/);
  assert.match(prompt, /优先级顺序：角色设定 \/ 世界观 \/ 不在场约束 > 设定局任务 > 调度顺序 > 导演指令 > 文风。/);
  assert.match(prompt, /先把真正的东西交到我手里，再让张白补一句。/);
});

test('buildGroupOfflinePrompt lets explicit special-instruction length override the outer max-char cap', () => {
  const prompt = buildGroupOfflinePrompt({
    session: createSession({
      maxGeneratedChars: 800,
    }),
    runtimeProjection: createProjection(),
    phase: 'round',
    selectedCharacterIds: ['alpha', 'beta'],
    dispatchMode: 'recommend',
    directorInstructionOverride: '这一轮按任务压迫感写，正文尽量展开到5000字，先让沈星回接。',
    directorMode: 'next_round',
  });

  assert.match(prompt, /如果这条特殊指令明确要求了篇幅或字数，以这条特殊指令为准；外部默认字数上限只在特殊指令没提篇幅时兜底。/);
  assert.match(prompt, /这次如果特殊指令明确要求了篇幅或字数，以特殊指令为准，不要再被外部默认字数上限截断。/);
  assert.doesNotMatch(prompt, /总字数控制在 800 汉字以内/);
});

test('buildGroupOfflinePrompt switches to page-episode schema when special instruction asks for html', () => {
  const prompt = buildGroupOfflinePrompt({
    session: createSession(),
    runtimeProjection: createProjection(),
    phase: 'round',
    selectedCharacterIds: ['alpha', 'beta'],
    dispatchMode: 'recommend',
    directorInstructionOverride: '生成一个 html 页面，这一轮改成一个可交互的小模块，带按钮和反馈区。',
    directorMode: 'next_round',
  });

  assert.match(prompt, /page_episode/);
  assert.match(prompt, /"mode": "page_episode"/);
  assert.match(prompt, /"pageType": "micro_app"/);
  assert.match(prompt, /"htmlDocument": "完整 html 或可直接渲染的主体结构"/);
  assert.doesNotMatch(prompt, /每个角色正文最好 2 到 4 段/);
});

test('buildGroupOfflinePrompt switches to wechat page schema when special instruction asks for a wechat page', () => {
  const prompt = buildGroupOfflinePrompt({
    session: createSession(),
    runtimeProjection: createProjection(),
    phase: 'round',
    selectedCharacterIds: ['alpha', 'beta'],
    dispatchMode: 'recommend',
    directorInstructionOverride: '暂停主线，生成一个微信聊天页面番外，不要状态栏，消息不少于 30 条。',
    directorMode: 'next_round',
  });

  assert.match(prompt, /"mode": "page_episode"/);
  assert.match(prompt, /"pageType": "wechat_chat"/);
  assert.match(prompt, /"platform": "wechat"/);
  assert.match(prompt, /"chat": \{/);
  assert.match(prompt, /"messages": \[/);
});