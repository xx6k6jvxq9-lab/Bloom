import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupOfflineRound, GroupOfflineSession } from '../../../../types';
import type { GroupOfflineRuntimeProjection } from '../../../group-offline/types';
import { buildGroupOfflineRoundRewritePrompt } from './buildGroupOfflineRoundRewritePrompt';

function createSession(overrides: Partial<GroupOfflineSession> = {}): GroupOfflineSession {
  return {
    id: overrides.id ?? 'offline-1',
    groupId: overrides.groupId ?? 'group-1',
    mode: overrides.mode ?? 'daily',
    generationMode: overrides.generationMode ?? 'blocks',
    activityType: overrides.activityType ?? '深夜续摊',
    customActivityType: overrides.customActivityType,
    location: overrides.location ?? '街角小馆',
    timeLabel: overrides.timeLabel ?? '今晚 22:10',
    weatherLabel: overrides.weatherLabel ?? '门口还有一点潮气',
    vibe: overrides.vibe ?? '各怀心事',
    participants: overrides.participants ?? [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    currentRound: overrides.currentRound ?? 2,
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
      activityType: '深夜续摊',
      customActivityType: undefined,
      location: '街角小馆',
      timeLabel: '今晚 22:10',
      weatherLabel: '门口还有一点潮气',
      vibe: '各怀心事',
      currentRound: 2,
    },
    userName: '林然然',
    groupName: '群聊',
    generatedAt: 1,
    groupSummary: {
      groupShortTermSummary: '这场局里大家都在等谁先把话落下来。',
      groupLongTermAtmosphere: '表面轻松，实际都很会记细节。',
      groupRecurringDynamics: '起哄和试探会交替出现。',
      groupSharedHistory: '这几个人不是第一次深夜续摊。',
      currentScene: '说到一半，谁都没有完全退开。',
      publicFacts: '大家都知道这场不是普通散场。',
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
          corePersona: '表面冷静，注意力却一直挂在人身上。',
          expressionStyle: '说话收着，但会留后手。',
        },
        memory: {} as GroupOfflineRuntimeProjection['characters'][number]['memory'],
        userRelation: {
          relationshipSummary: '和用户之间已经不是浅层熟悉。',
        },
        peerRelations: [],
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
          corePersona: '更直接，也更会顺着气氛往前拨。',
          expressionStyle: '喜欢拿轻一点的话试人。',
        },
        memory: {} as GroupOfflineRuntimeProjection['characters'][number]['memory'],
        userRelation: {
          relationshipSummary: '和用户说话已经不完全客气。',
        },
        peerRelations: [],
        groupState: {} as GroupOfflineRuntimeProjection['characters'][number]['groupState'],
      },
    ],
  };
}

function createRound(): GroupOfflineRound {
  return {
    id: 'round-1',
    title: '有人终于把话接下来',
    sceneText: '门口风有点凉，气氛却没有散。',
    dispatchMode: 'recommend',
    selectedCharacterIds: ['alpha', 'beta'],
    characterEntries: [
      {
        characterId: 'alpha',
        speakerLabel: '沈星回',
        target: { type: 'user', label: '林然然' },
        text: '沈星回抬眼看过来，没把那点逼近感藏得太干净。“你先别躲，东西先给我。”',
        highlightText: '你先别躲，东西先给我。',
        statusFields: [],
        lastOperation: 'generated',
      },
      {
        characterId: 'beta',
        speakerLabel: '张白',
        target: { type: 'group', label: '全场' },
        text: '张白靠在一边，像是笑了一下，又把视线压回到你们这边。',
        statusFields: [],
        lastOperation: 'generated',
      },
    ],
  };
}

function createHtmlRound(): GroupOfflineRound {
  return {
    ...createRound(),
    mode: 'page_episode',
    pageEpisode: {
      pageType: 'custom_html',
      title: '夜里的临时页面',
      subtitle: '这轮先改成一页独立页面',
      caption: '点一下按钮，看看这一轮怎么动。',
      htmlDocument: '<main><button>继续</button><div>反馈区</div></main>',
    },
    characterEntries: [],
  };
}

test('buildGroupOfflineRoundRewritePrompt adds director block for director-driven rewrite', () => {
  const prompt = buildGroupOfflineRoundRewritePrompt({
    mode: 'director_instruction',
    session: createSession(),
    round: createRound(),
    runtimeProjection: createProjection(),
    previousRounds: [createRound()],
    directorInstructionText: '先让沈星回把交接压实，再让张白只补一刀，不要把场面写散，正文尽量展开到5000字。',
  });

  assert.match(prompt, /## 导演额外指令/);
  assert.match(prompt, /如果这条特殊指令明确要求了篇幅或字数，以这条特殊指令为准，不要回退到外部默认字数限制。/);
  assert.match(prompt, /优先级顺序：角色设定 \/ 世界观 \/ 不在场约束 > 设定局任务 > 当前轮已确定的调度顺序 > 导演指令 > 文风。/);
  assert.match(prompt, /不能增删出场角色/);
  assert.match(prompt, /先让沈星回把交接压实，再让张白只补一刀，不要把场面写散，正文尽量展开到5000字。/);
});

test('buildGroupOfflineRoundRewritePrompt keeps director block out of pure style rewrites', () => {
  const prompt = buildGroupOfflineRoundRewritePrompt({
    mode: 'custom_style',
    session: createSession(),
    round: createRound(),
    runtimeProjection: createProjection(),
    previousRounds: [createRound()],
    customStyleText: '写得更利落一点，少一点环境铺陈。',
  });

  assert.doesNotMatch(prompt, /## 导演额外指令/);
  assert.match(prompt, /## 本次自定义文风要求/);
});

test('buildGroupOfflineRoundRewritePrompt keeps page-episode schema when retrying an html round', () => {
  const prompt = buildGroupOfflineRoundRewritePrompt({
    mode: 'retry_round',
    session: createSession(),
    round: createHtmlRound(),
    runtimeProjection: createProjection(),
    previousRounds: [createRound()],
  });

  assert.match(prompt, /page_episode/);
  assert.match(prompt, /"mode": "page_episode"/);
  assert.match(prompt, /"pageType": "custom_html"/);
  assert.match(prompt, /"htmlDocument": "完整 html 或可直接渲染的主体结构"/);
});

test('buildGroupOfflineRoundRewritePrompt switches to wechat page schema when director rewrite asks for a wechat page', () => {
  const prompt = buildGroupOfflineRoundRewritePrompt({
    mode: 'director_instruction',
    session: createSession(),
    round: createRound(),
    runtimeProjection: createProjection(),
    previousRounds: [createRound()],
    directorInstructionText: '暂停主线，改成一个微信聊天页面，不要状态栏，消息不少于 20 条。',
  });

  assert.match(prompt, /"mode": "page_episode"/);
  assert.match(prompt, /"pageType": "wechat_chat"/);
  assert.match(prompt, /"platform": "wechat"/);
  assert.match(prompt, /"chat": \{/);
  assert.match(prompt, /"messages": \[/);
});
