import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAvatarLibraryDecisionReplyPromptSection,
  deriveFallbackAvatarLibraryDecision,
  shouldReviewAutonomousAvatarLibraryDecision,
  shouldReviewTextOnlyAvatarLibraryDecision,
} from './avatarLibraryDecision';
import { pickPreferredAvatarLibraryEntry } from './avatarPreference';

function createCharacter() {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: 'current-avatar.png',
    setting: '',
    openingRemark: '',
    friendshipStatus: 'friends',
    blockedByUser: false,
    blockedByCharacter: false,
    avatarLibrary: {
      entries: [
        {
          id: 'current',
          image: 'current-avatar.png',
          source: 'upload',
          status: 'current',
          addedAt: 1,
          updatedAt: 1,
        },
        {
          id: 'favorite',
          image: 'favorite-avatar.png',
          source: 'upload',
          status: 'saved',
          addedAt: 2,
          updatedAt: 2,
          characterChoiceCount: 2,
          lastCharacterChoiceAt: 2,
          preference: {
            affinity: 'love',
            selfFit: 'high',
            moodTags: ['高兴'],
            sceneTags: ['夜聊'],
            note: '这张最像自己放松时的样子',
            learnedFrom: 'character',
            updatedAt: 2,
          },
        },
        {
          id: 'backup',
          image: 'backup-avatar.png',
          source: 'upload',
          status: 'saved',
          addedAt: 3,
          updatedAt: 3,
          preference: {
            affinity: 'neutral',
            selfFit: 'medium',
            learnedFrom: 'history',
            updatedAt: 3,
          },
        },
      ],
      updatedAt: 3,
    },
  } as const;
}

test('text-only avatar library requests are reviewed even without a new image', () => {
  const character = createCharacter();
  const messages = [
    {
      role: 'user',
      text: '再换一个哥哥',
      timestamp: 1,
    },
  ];

  assert.equal(shouldReviewTextOnlyAvatarLibraryDecision(character as any, messages as any), true);
});

test('fallback library decision can directly pick the preferred saved avatar for explicit text requests', () => {
  const character = createCharacter();
  const review = deriveFallbackAvatarLibraryDecision({
    character: character as any,
    trigger: 'user_request',
    latestUserText: '再换一个哥哥',
    shortTermSummary: '刚聊得很开心，状态是松一点的。',
    sharedRecentRelationshipSummary: '气氛在升温。',
  });

  assert.equal(review.decision, 'change');
  assert.equal(review.selectedEntryId, 'favorite');
  assert.equal(review.action?.source, 'avatar_library:favorite');
});

test('preferred avatar scoring favors character-loved entries in autonomous mode', () => {
  const character = createCharacter();
  const picked = pickPreferredAvatarLibraryEntry({
    character: character as any,
    trigger: 'autonomous',
    latestUserText: '',
    shortTermSummary: '今天心情挺高兴，像夜里慢慢松下来那种状态。',
    sharedRecentRelationshipSummary: '刚刚聊得很自然。',
    now: Date.now() - 24 * 60 * 60 * 1000,
  });

  assert.equal(picked.best?.entry.id, 'favorite');
  assert.equal((picked.best?.score || 0) > 0, true);
});

test('autonomous review opens only when a high-preference alternative exists beyond cooldown', () => {
  const character = createCharacter() as any;
  character.avatarAutonomyMode = 'natural';
  character.avatarLibrary.entries[1].lastCharacterChoiceAt = Date.now() - 24 * 60 * 60 * 1000;
  character.avatarLibrary.entries[1].lastUsedAt = Date.now() - 24 * 60 * 60 * 1000;
  const messages = [
    {
      role: 'model',
      text: '今晚我先来敲你一下。',
      timestamp: 1,
    },
  ];

  assert.equal(shouldReviewAutonomousAvatarLibraryDecision({
    character,
    messages: messages as any,
    latestUserText: '',
    shortTermSummary: '今天心情偏高兴，像夜聊里会自己松一点的状态。',
    sharedRecentRelationshipSummary: '刚和你熟络了一点。',
  }), true);
});

test('conservative autonomy mode is stricter than frequent mode', () => {
  const messages = [
    {
      role: 'model',
      text: '我刚上线。',
      timestamp: 1,
    },
  ];

  const conservativeCharacter = createCharacter() as any;
  conservativeCharacter.avatarAutonomyMode = 'conservative';
  conservativeCharacter.avatarLibrary.entries[1].characterChoiceCount = 0;
  conservativeCharacter.avatarLibrary.entries[1].preference.affinity = 'neutral';
  conservativeCharacter.avatarLibrary.entries[1].preference.selfFit = 'medium';
  conservativeCharacter.avatarLibrary.entries[1].preference.moodTags = [];
  conservativeCharacter.avatarLibrary.entries[1].lastCharacterChoiceAt = Date.now() - 24 * 60 * 60 * 1000;
  conservativeCharacter.avatarLibrary.entries[1].lastUsedAt = Date.now() - 24 * 60 * 60 * 1000;

  const frequentCharacter = createCharacter() as any;
  frequentCharacter.avatarAutonomyMode = 'frequent';
  frequentCharacter.avatarLibrary.entries[1].characterChoiceCount = 0;
  frequentCharacter.avatarLibrary.entries[1].preference.affinity = 'neutral';
  frequentCharacter.avatarLibrary.entries[1].preference.selfFit = 'medium';
  frequentCharacter.avatarLibrary.entries[1].preference.moodTags = [];
  frequentCharacter.avatarLibrary.entries[1].lastCharacterChoiceAt = Date.now() - 24 * 60 * 60 * 1000;
  frequentCharacter.avatarLibrary.entries[1].lastUsedAt = Date.now() - 24 * 60 * 60 * 1000;

  const sharedArgs = {
    messages: messages as any,
    latestUserText: '',
    shortTermSummary: '今天心情还不错，但也没有特别上头。',
    sharedRecentRelationshipSummary: '刚刚打过招呼。',
  };

  assert.equal(shouldReviewAutonomousAvatarLibraryDecision({
    character: conservativeCharacter,
    ...sharedArgs,
  }), false);
  assert.equal(shouldReviewAutonomousAvatarLibraryDecision({
    character: frequentCharacter,
    ...sharedArgs,
  }), true);
});

test('reply prompt section can explain autonomous avatar switching to the main chat prompt', () => {
  const section = buildAvatarLibraryDecisionReplyPromptSection({
    trigger: 'autonomous',
    decision: 'change',
    confidence: 'medium',
    selectedEntryId: 'favorite',
    reason: '当前状态和偏好都足够支持角色自己从头像库里换一张喜欢的头像。',
    replyHint: '如果你提到头像，就像自己一时兴起换了个更顺眼的样子，轻轻带过，不要像系统通知。',
    action: {
      type: 'change',
      source: 'avatar_library:favorite',
      reason: '当前状态和偏好都足够支持角色自己从头像库里换一张喜欢的头像。',
    },
    origin: 'fallback',
  });

  assert.match(section, /角色自己在想要不要换头像/);
  assert.match(section, /从头像库里直接换头像/);
});
