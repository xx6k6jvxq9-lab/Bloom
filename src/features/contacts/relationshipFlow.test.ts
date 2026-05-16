import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppData, AppSettings, Character } from '../../types';
import { createDefaultApiCenterConfig } from '../../services/ai/apiCenter/defaults';
import {
  resolveBlockedRelationshipFollowupPlan,
  runRelationshipBlockRepairFlow,
  runRelationshipBlockToggleFlow,
  type RelationshipFlowRuntime,
} from './relationshipFlow';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-a',
    name: '角色A',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    friendshipStatus: 'friends',
    blockedByUser: false,
    blockedByCharacter: false,
    ...overrides,
  } as Character;
}

function createRuntime(character: Character): RelationshipFlowRuntime {
  const apiCenterConfig = createDefaultApiCenterConfig();
  apiCenterConfig.defaultTextCall.enabled = false;
  let appData = {
    characters: [character],
    friendRequests: [],
    chatHistory: {
      [character.id]: [],
    },
    userProfile: {
      name: '测试用户',
    },
    masks: [],
    worldBooks: [],
    chatGroups: [],
  } as AppData;

  const runtime: RelationshipFlowRuntime = {
    appData,
    settings: {
      apiCenterConfig,
    } as AppSettings,
    setAppData: (updater) => {
      appData = updater(appData);
      runtime.appData = appData;
    },
    persistCharacters: () => undefined,
  };

  return runtime;
}

test('runRelationshipBlockToggleFlow does not create a local static follow-up request when generated output is unavailable', async () => {
  const character = createCharacter();
  const runtime = createRuntime(character);

  const started = runRelationshipBlockToggleFlow({
    runtime,
    characterId: character.id,
    targetCharacter: character,
  });

  assert.equal(started, true);
  assert.equal(runtime.appData.characters[0]?.blockedByUser, true);
  assert.ok(runtime.appData.characters[0]?.relationshipBlockRollbackSnapshot);

  const immediateRequest = (runtime.appData.friendRequests || []).find((request) => (
    request.status === 'pending'
    && request.characterId === character.id
    && request.initiator === 'character'
  ));

  assert.equal(immediateRequest, undefined);

  await new Promise((resolve) => setTimeout(resolve, 0));

  const persistedRequest = (runtime.appData.friendRequests || []).find((request) => (
    request.status === 'pending'
    && request.characterId === character.id
    && request.initiator === 'character'
  ));
  const relationshipEvent = (runtime.appData.friendRequests || []).find((request) => (
    request.isRelationshipEvent
    && request.characterId === character.id
    && request.eventKind === 'user_blocked_character'
  ));

  assert.equal(persistedRequest, undefined);
  assert.equal(relationshipEvent, undefined);
});

test('runRelationshipBlockRepairFlow restores the relationship state captured before block', () => {
  const character = createCharacter();
  const runtime = createRuntime(character);

  runRelationshipBlockToggleFlow({
    runtime,
    characterId: character.id,
    targetCharacter: character,
  });

  const repaired = runRelationshipBlockRepairFlow({
    runtime,
    characterId: character.id,
    targetCharacter: runtime.appData.characters[0],
  });

  assert.equal(repaired, true);
  assert.equal(runtime.appData.characters[0]?.friendshipStatus, 'friends');
  assert.equal(runtime.appData.characters[0]?.blockedByUser, false);
  assert.equal(runtime.appData.characters[0]?.blockedByCharacter, false);
  assert.equal(runtime.appData.characters[0]?.relationshipBlockRollbackSnapshot, undefined);
});

test('resolveBlockedRelationshipFollowupPlan stops follow-up requests after counter-block', () => {
  assert.deepEqual(
    resolveBlockedRelationshipFollowupPlan({
      canCreateRequest: true,
      decision: 'counter_block',
    }),
    {
      shouldCounterBlock: true,
      shouldSendRequest: false,
    },
  );

  assert.deepEqual(
    resolveBlockedRelationshipFollowupPlan({
      canCreateRequest: true,
      decision: 'send_request',
    }),
    {
      shouldCounterBlock: false,
      shouldSendRequest: true,
    },
  );
});
