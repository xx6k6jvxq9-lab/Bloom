import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import { resetMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type { Character, ChatGroup, ChatHistory, GroupOfflineSession } from '../../types';
import { applyDerivedWorldBookMetadata } from '../world-book/worldBookDerived';
import { buildGroupOfflineRuntimeProjection } from './buildGroupOfflineRuntimeProjection';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? 'Alpha',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? 'Core persona: outwardly restrained, internally attentive.',
    corePersona: overrides.corePersona,
    expressionStyle: overrides.expressionStyle ?? 'Speaks softly and leaves emphasis in the pause after a sentence.',
    boundaryPack: overrides.boundaryPack ?? 'Does not drag private-chat wording straight into public scenes.',
    extendedLore: overrides.extendedLore,
    sceneHints: overrides.sceneHints,
    remarkName: overrides.remarkName,
    signature: overrides.signature ?? 'Does not want to say everything out loud, but does not plan to let it go either.',
    openingRemark: overrides.openingRemark ?? 'You came.',
    shortTermSummary: overrides.shortTermSummary,
    longTermMemoryProfile: overrides.longTermMemoryProfile,
    avatarLibrary: overrides.avatarLibrary,
    publicThreadPeerHints: overrides.publicThreadPeerHints,
  } as Character;
}

function createGroup(overrides: Partial<ChatGroup> = {}): ChatGroup {
  return {
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? 'Group Chat',
    memberIds: overrides.memberIds ?? ['alpha', 'beta'],
    creatorId: overrides.creatorId ?? 'user',
    createdAt: overrides.createdAt ?? 1,
    groupNickname: overrides.groupNickname,
    groupShortTermSummary: overrides.groupShortTermSummary,
    groupMemberPerspectiveSummaries: overrides.groupMemberPerspectiveSummaries,
    groupLongTermMemory: overrides.groupLongTermMemory,
    backgroundSummary: overrides.backgroundSummary,
    memberRelationshipState: overrides.memberRelationshipState,
    memberRelationshipNote: overrides.memberRelationshipNote,
    currentScene: overrides.currentScene,
    publicFacts: overrides.publicFacts,
    memberRelationSeeds: overrides.memberRelationSeeds,
    topicState: overrides.topicState,
    relationshipWaves: overrides.relationshipWaves,
    factTraces: overrides.factTraces,
  } as ChatGroup;
}

function createSession(overrides: Partial<GroupOfflineSession> = {}): GroupOfflineSession {
  return {
    id: overrides.id ?? 'offline-1',
    groupId: overrides.groupId ?? 'group-1',
    mode: overrides.mode ?? 'daily',
    generationMode: overrides.generationMode ?? 'blocks',
    activityType: overrides.activityType ?? 'Night walk',
    customActivityType: overrides.customActivityType,
    location: overrides.location ?? 'Seaside boardwalk',
    scenePrompt: overrides.scenePrompt,
    timeLabel: overrides.timeLabel ?? 'Tonight 21:30',
    weatherLabel: overrides.weatherLabel ?? 'Windy and cool',
    vibe: overrides.vibe ?? 'Everyone has something on their mind',
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

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('buildGroupOfflineRuntimeProjection lets current offline user input retrieve raw world book details', () => {
  const alpha = createCharacter({
    id: 'alpha',
    name: 'Alpha',
  });
  const beta = createCharacter({
    id: 'beta',
    name: 'Beta',
  });
  const group = createGroup({
    memberIds: ['alpha', 'beta'],
  });
  const session = createSession({
    messages: [
      {
        id: 'offline-user-1',
        role: 'user',
        text: 'Push this round with the nsfw reference terms, but keep it in character.',
        timestamp: 10,
      } as any,
    ],
  });
  const worldBooks = [
    applyDerivedWorldBookMetadata({
      id: 'raw-reference',
      title: 'High intensity raw reference',
      content: [
        'When the user hits these nsfw trigger terms, allow more direct adult-explicit phrasing samples.',
        'This stores raw wording references and high-intensity interaction phrasing, and should not live in the always-on overview layer.',
      ].join('\n'),
      category: 'Relationship',
      priorityLevel: 'high',
      isActive: true,
      isGlobal: true,
      pinMode: 'always',
    } as any),
  ];

  const projection = buildGroupOfflineRuntimeProjection({
    session,
    group,
    members: [alpha, beta],
    userName: 'User',
    history: [],
    directChatHistory: { alpha: [], beta: [] },
    activeWorldBooks: worldBooks,
  });

  const alphaProjection = projection.characters.find((character) => character.identity.characterId === 'alpha');
  assert.ok(alphaProjection);
  assert.match(alphaProjection.persona.worldBookPrompt || '', /\[World Book Details \/ Current Relevant Excerpts\]/);
  assert.match(alphaProjection.persona.worldBookPrompt || '', /nsfw/);
  assert.match(alphaProjection.persona.worldBookPrompt || '', /always-on overview layer/);
});

test('buildGroupOfflineRuntimeProjection collects persona, avatar fallback, peer relations and group state', () => {
  const alpha = createCharacter({
    id: 'alpha',
    name: 'Alpha',
    remarkName: 'Alpha',
    avatar: '',
    avatarLibrary: {
      updatedAt: 10,
      entries: [{
        id: 'avatar-alpha',
        image: 'https://example.com/alpha.jpg',
        source: 'manual',
        status: 'saved',
        addedAt: 1,
        updatedAt: 10,
      }],
    },
    corePersona: 'Outwardly calm, but notices other people in fine detail.',
    sceneHints: {
      groupOffline: 'In offline group scenes, watches the smallest movement in the other person’s hands first.',
    },
    shortTermSummary: 'Just came out of a heated relationship beat, outwardly restrained but still paying attention.',
    longTermMemoryProfile: 'Keeps memories of restrained-on-the-surface, biased-inward interactions for a long time.',
  });
  const beta = createCharacter({
    id: 'beta',
    name: 'Beta',
    remarkName: 'Beta',
    avatar: 'https://example.com/beta.jpg',
    corePersona: 'Speaks more directly, but does not like to fully spell out an attitude.',
  });

  const group = createGroup({
    memberIds: ['alpha', 'beta'],
    memberRelationSeeds: [{
      sourceMemberId: 'alpha',
      targetMemberId: 'beta',
      familiarity: 'familiar',
    }],
    groupShortTermSummary: 'The group just shifted from testing to missing each other.',
    groupMemberPerspectiveSummaries: {
      alpha: 'He has already started caring about where the scene is leaning.',
    },
    groupLongTermMemory: {
      atmosphere: 'This group looks loose on the surface, but everyone remembers everyone’s boundaries.',
      recurringDynamics: 'Someone pretends nothing happened, someone else specializes in pauses.',
      sharedHistory: 'They have stayed up together in a few deep-night situations.',
      memberRoles: {
        alpha: 'Looks the steadiest, but actually notices the shift in atmosphere first.',
      },
    },
    currentScene: 'Everyone has just returned online from the offline gathering.',
    publicFacts: 'Everyone in the group knows these are not ordinary group friends.',
  });

  const session = createSession();
  const directChatHistory: ChatHistory = {
    alpha: [],
    beta: [],
  };

  const projection = buildGroupOfflineRuntimeProjection({
    session,
    group,
    members: [alpha, beta],
    userName: 'User',
    history: [],
    directChatHistory,
    activeWorldBooks: [],
  });

  assert.equal(projection.characters.length, 2);
  const alphaProjection = projection.characters.find((character) => character.identity.characterId === 'alpha');
  assert.ok(alphaProjection);
  assert.equal(alphaProjection.identity.avatar, 'https://example.com/alpha.jpg');
  assert.equal(alphaProjection.persona.sceneHint, 'In offline group scenes, watches the smallest movement in the other person’s hands first.');
  assert.equal(alphaProjection.groupState.groupLongTermAtmosphere, 'This group looks loose on the surface, but everyone remembers everyone’s boundaries.');
  assert.equal(alphaProjection.peerRelations.length, 1);
  assert.ok(alphaProjection.peerRelations[0]?.familiarityLabel);
  assert.match(alphaProjection.relationshipContextSummary || '', /They have stayed up together/i);
});

test('buildGroupOfflineRuntimeProjection strips offstage member names from current runtime context', () => {
  const alpha = createCharacter({
    id: 'alpha',
    name: 'Alpha',
  });
  const beta = createCharacter({
    id: 'beta',
    name: 'Beta',
  });
  const gamma = createCharacter({
    id: 'gamma',
    name: 'Gamma',
  });

  const group = createGroup({
    memberIds: ['alpha', 'beta', 'gamma'],
    groupLongTermMemory: {
      sharedHistory: 'Alpha, Beta and Gamma used to stay up together through a whole channel.',
      atmosphere: 'When Gamma is present the atmosphere gets sharper.',
    },
    publicFacts: 'Gamma has the sharpest tongue in the room.',
  });

  const session = createSession({
    participants: [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
  });

  const projection = buildGroupOfflineRuntimeProjection({
    session,
    group,
    members: [alpha, beta, gamma],
    userName: 'User',
    history: [],
    directChatHistory: { alpha: [], beta: [], gamma: [] },
    activeWorldBooks: [],
  });

  assert.equal((projection.groupSummary.groupSharedHistory || '').includes('Gamma'), false);
  assert.equal((projection.groupSummary.publicFacts || '').includes('Gamma'), false);
});
