import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryRecordData, saveMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import type { Character, DateSession, Mask, UserProfileExtended } from '../../types';
import { getLatestMemoryDiagnostic, resetMemoryDiagnostics } from '../memory/memoryDiagnostics';
import { buildDatingSceneInput } from './buildDatingSceneInput';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? 'Alpha',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? 'Calm, observant, and quietly affectionate.',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

function createSession(overrides: Partial<DateSession> = {}): DateSession {
  return {
    id: overrides.id ?? 'date-1',
    characterId: overrides.characterId ?? 'alpha',
    location: overrides.location ?? 'Cafe',
    scenario: overrides.scenario ?? 'Evening walk',
    mood: overrides.mood ?? 'Warm',
    backgroundScene: overrides.backgroundScene ?? 'city-night',
    messages: overrides.messages ?? [],
    timestamp: overrides.timestamp ?? 1_700_000_000_000,
    ...overrides,
  } as DateSession;
}

const userProfile: UserProfileExtended = {
  id: 'user-1',
  name: 'User',
  avatar: '',
  bio: '',
  mood: 'curious',
};

const activeMask: Mask = {
  id: 'mask-1',
  name: '新身份',
  personality: '表面冷静，私下更会试探。',
  occupation: '策展人',
  relationship: '对外假装普通朋友',
  worldBackground: '这个身份在公开社交场合更方便接近对方。',
  isActive: true,
  linkedCharacters: ['alpha'],
};

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  resetMemoryDiagnostics();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('buildDatingSceneInput injects retrieved memory into dating prompt sections', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      alpha: [
        {
          id: 'fact-experience-1',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'remember the rooftop cafe story',
          timestamp: now - 600,
          factType: 'experience',
          subjectType: 'character',
          subjectId: 'alpha',
          confidence: 'explicit',
          relatedCharacterIds: ['alpha'],
        },
        {
          id: 'fact-plan-1',
          kind: 'fact',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'medium',
          summary: 'schedule the next cafe revisit',
          timestamp: now - 500,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'alpha',
          confidence: 'explicit',
          relatedCharacterIds: ['alpha'],
        },
      ],
    },
  });

  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession({
      messages: [
        {
          id: 'date-msg-1',
          role: 'user',
          text: 'Maybe we can revisit that cafe soon.',
          timestamp: now - 100,
        },
      ],
    }),
    chatHistory: [
      {
        role: 'user',
        text: 'You once mentioned the cafe rooftop view.',
        timestamp: now - 800,
      },
      {
        role: 'model',
        text: 'I still remember it.',
        timestamp: now - 700,
      },
    ],
    latestUserInput: 'cafe',
  });

  const joinedSections = sceneInput.sections.join('\n\n');
  const latestDiagnostic = getLatestMemoryDiagnostic({
    characterId: 'alpha',
    sourceScene: 'dating',
    type: 'read',
  });

  assert.match(joinedSections, /Retrieved Related Facts/);
  assert.match(joinedSections, /remember the rooftop cafe story/);
  assert.match(joinedSections, /Retrieved Open Tasks/);
  assert.match(joinedSections, /schedule the next cafe revisit/);
  assert.equal(latestDiagnostic?.type, 'read');
  if (latestDiagnostic?.type === 'read') {
    assert.equal(latestDiagnostic.retrievedMemoryCounts.matchedFacts > 0, true);
    assert.equal(latestDiagnostic.retrievedMemoryCounts.openTasks > 0, true);
    assert.equal(latestDiagnostic.promptSectionCount! > 0, true);
  }
});

test('buildDatingSceneInput preserves an already intimate direct-chat baseline for dating', () => {
  const now = Date.now();
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter({
      longTermMemoryProfile: '关系底色：你们已经是稳定亲密关系，会自然接住拥抱和更开放的成人亲密。',
      shortTermSummary: '短期余波：最近一直是很亲密的口吻，没有再回到生疏试探。',
    }),
    userProfile,
    session: createSession({
      messages: [
        {
          id: 'date-msg-2',
          role: 'user',
          text: '你刚才那样抱我，我还是会心软。',
          timestamp: now - 100,
        },
      ],
    }),
    chatHistory: [
      {
        role: 'user',
        text: '宝贝，过来让我抱一下。',
        timestamp: now - 400,
      },
      {
        role: 'model',
        text: '嗯，抱紧一点也没关系。',
        timestamp: now - 300,
      },
      {
        role: 'user',
        text: '我想亲你。',
        timestamp: now - 200,
      },
    ],
    latestUserInput: '抱抱',
  });

  assert.match(sceneInput.relationshipBaselineBlock || '', /已经是明确成立的亲密关系/);
  assert.match(sceneInput.relationshipBaselineBlock || '', /不要因为“线下约会”场景/);
  assert.match(sceneInput.relationshipBaselineBlock || '', /成人亲密表达/);
});

test('buildDatingSceneInput lets manual relationship override win and keeps adult-intimacy directive', () => {
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter({
      longTermMemoryProfile: '关系底色：你们已经是稳定亲密关系。',
      shortTermSummary: '短期余波：最近一直很黏。',
    }),
    userProfile,
    session: createSession({
      relationshipStageOverride: 'careful',
      allowAdultIntimacy: true,
    }),
    chatHistory: [
      {
        role: 'user',
        text: '宝贝，我想亲你。',
        timestamp: Date.now() - 100,
      },
    ],
  });

  assert.match(sceneInput.relationshipBaselineBlock || '', /手动关系阶段覆盖/);
  assert.match(sceneInput.relationshipBaselineBlock || '', /谨慎关系基线/);
  assert.match(sceneInput.relationshipBaselineBlock || '', /成人亲密允许/);
  assert.doesNotMatch(sceneInput.relationshipBaselineBlock || '', /明确成立的亲密关系/);
});

test('buildDatingSceneInput uses edited round text instead of stale generated content summary', () => {
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession({
      messages: [
        {
          id: 'scene-msg-1',
          role: 'model',
          text: '她没有退开，只是很轻地贴着你把那句喜欢补完了。',
          isEdited: true,
          timestamp: Date.now() - 100,
          generatedContent: {
            background: {
              source: 'character-avatar',
              image: '',
              atmosphere: '',
              focus: '',
            },
            narrative: {
              title: '旧版本',
              segments: [
                { type: 'narration', text: '旧的生成内容仍停在更保守的试探里。' },
              ],
            },
            status: {
              location: '街角',
              time: '傍晚',
              mood: '暧昧',
              innerThought: '',
            },
            playlist: [],
          },
        },
      ],
    }),
    chatHistory: [],
  });

  assert.match(sceneInput.datingMessages, /她没有退开，只是很轻地贴着你把那句喜欢补完了/);
  assert.doesNotMatch(sceneInput.datingMessages, /旧的生成内容仍停在更保守的试探里/);
});

test('buildDatingSceneInput carries selected writing style into later round generation', () => {
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession({
      writingStyleCustom: '当前固定文风：海棠感\n目标手感：感官张力更直接，靠近感和危险感更前置。',
      messages: [
        {
          id: 'date-msg-style-1',
          role: 'user',
          text: '继续。',
          timestamp: Date.now() - 100,
        },
      ],
    }),
    chatHistory: [],
    latestUserInput: '继续',
  });

  assert.equal(sceneInput.writingStyleCustom, '当前固定文风：海棠感\n目标手感：感官张力更直接，靠近感和危险感更前置。');
});

test('buildDatingSceneInput injects director instruction as high-priority guidance', () => {
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession({
      directorInstruction: '暂停当前主线，生成一个番外小剧场；不要状态栏；严格遵守人设。',
    }),
    chatHistory: [],
  });

  assert.match(sceneInput.directorInstructionBlock || '', /导演额外指令/);
  assert.match(sceneInput.directorInstructionBlock || '', /高优先级剧情指令/);
  assert.match(sceneInput.directorInstructionBlock || '', /暂停当前主线，生成一个番外小剧场/);
});

test('buildDatingSceneInput prefers one-shot director override and lifts it into the task', () => {
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession({
      directorInstruction: '旧指令：继续按原主线推进。',
    }),
    chatHistory: [],
    directorMode: 'next_round',
    directorInstructionOverride: '暂停当前主线，开一个番外小剧场，不要状态栏。',
  });

  assert.match(sceneInput.directorInstructionBlock || '', /暂停当前主线，开一个番外小剧场/);
  assert.doesNotMatch(sceneInput.directorInstructionBlock || '', /旧指令：继续按原主线推进/);
  assert.match(sceneInput.task, /下一轮优先执行导演指令/);
});

test('buildDatingSceneInput carries active mask into dating sections', () => {
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession(),
    chatHistory: [],
    activeMask,
  });

  assert.equal(sceneInput.sections.some((section) => section.includes('用户当前面具设定')), true);
  assert.equal(sceneInput.sections.some((section) => section.includes('新身份')), true);
});

test('buildDatingSceneInput routes long wechat page directives into page episode mode', () => {
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession(),
    chatHistory: [],
    directorMode: 'next_round',
    directorInstructionOverride: `现在暂停主线剧情，为我生成一个小手机微信聊天格式的番外。
不要状态栏。
消息不低于 60 条。`,
  });

  assert.equal(sceneInput.outputMode, 'page_episode');
  assert.equal(sceneInput.specialDirectivePlan?.outputKind, 'platform_page');
  assert.equal(sceneInput.specialDirectivePlan?.platform, 'wechat');
  assert.equal(sceneInput.pageEpisodeIntent?.pageType, 'wechat_chat');
  assert.equal(sceneInput.pageEpisodeIntent?.statusBarMode, 'hidden');
  assert.match(sceneInput.pageEpisodeInstructionBlock || '', /page_episode/);
  assert.match(sceneInput.task, /微信聊天页面番外/);
});

test('buildDatingSceneInput can route interactive html module directives into raw html page mode', () => {
  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession(),
    chatHistory: [],
    directorMode: 'next_round',
    directorInstructionOverride: `生成一个 html，主题为 char 绘制 user 的小剧场模块。
使用 js+svg+css。
点击开始按钮后出现绘制动画。`,
  });

  assert.equal(sceneInput.outputMode, 'page_episode');
  assert.equal(sceneInput.specialDirectivePlan?.outputKind, 'micro_app');
  assert.equal(sceneInput.pageEpisodeIntent?.pageType, 'micro_app');
  assert.match(sceneInput.pageEpisodeInstructionBlock || '', /micro_app/);
  assert.match(sceneInput.pageEpisodeInstructionBlock || '', /首屏必须直接可见/);
  assert.match(sceneInput.pageEpisodeInstructionBlock || '', /可操作控件/);
  assert.match(sceneInput.task, /互动小模块番外/);
});
