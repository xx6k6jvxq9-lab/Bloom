import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, ChatGroup, MomentComment, MomentItem } from '../../types';
import { getMomentAutoCommentTargetCount, inferMomentAudience, pickInitialCommenters } from './commentRules';
import {
  canCharacterAutoCommentOnMoment,
  canCharacterAutoLikeMoment,
  canCharacterJoinMomentThread,
  getCharacterMomentEngagementAccess,
  getMomentAutoCommentSuppressionMode,
} from './publicThreadPolicy';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    ...overrides,
  } as Character;
}

function createMoment(overrides: Partial<MomentItem> = {}): MomentItem {
  return {
    id: 'moment',
    authorId: 'user',
    content: 'just posted',
    timestamp: Date.now(),
    likes: 0,
    comments: [],
    ...overrides,
  };
}

function createComment(overrides: Partial<MomentComment> = {}): MomentComment {
  return {
    id: 'comment',
    authorId: 'user',
    content: 'reply',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createGroup(overrides: Partial<ChatGroup> = {}): ChatGroup {
  return {
    id: 'group',
    name: 'Group',
    memberIds: [],
    creatorId: 'user',
    createdAt: 1,
    ...overrides,
  } as ChatGroup;
}

function createMutualHintPair(
  leftId: string,
  rightId: string,
  familiarity: 'stranger' | 'aware' | 'familiar',
) {
  return {
    left: [{
      targetCharacterId: rightId,
      familiarity,
      updatedAt: 1,
    }],
    right: [{
      targetCharacterId: leftId,
      familiarity,
      updatedAt: 1,
    }],
  };
}

test('stranger characters cannot auto-like or auto-comment on another character moment', () => {
  const author = createCharacter({ id: 'author', name: 'Author' });
  const stranger = createCharacter({ id: 'stranger', name: 'Stranger' });
  const moment = createMoment({ authorId: author.id, content: 'author post' });
  const characters = [author, stranger];

  const access = getCharacterMomentEngagementAccess({
    actor: stranger,
    moment,
    characters,
  });

  assert.equal(access.canLike, false);
  assert.equal(access.canTopLevelComment, false);
  assert.deepEqual(
    pickInitialCommenters({
      moment,
      characters,
    }),
    [],
  );
});

test('aware peers can auto-like but still cannot start top-level comments', () => {
  const hints = createMutualHintPair('author', 'aware-peer', 'aware');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: hints.left,
  });
  const awarePeer = createCharacter({
    id: 'aware-peer',
    name: 'Aware',
    publicThreadPeerHints: hints.right,
  });
  const moment = createMoment({ authorId: author.id, content: 'author post' });
  const characters = [author, awarePeer];

  assert.equal(canCharacterAutoLikeMoment({
    actor: awarePeer,
    moment,
    characters,
  }), true);
  assert.equal(canCharacterAutoCommentOnMoment({
    actor: awarePeer,
    moment,
    characters,
  }), false);
  assert.deepEqual(
    pickInitialCommenters({
      moment,
      characters,
    }),
    [],
  );
});

test('aware peers in shared groups can be lightly unlocked for top-level comments', () => {
  const author = createCharacter({ id: 'author', name: 'Author' });
  const awarePeer = createCharacter({ id: 'aware-peer', name: 'Aware Peer' });
  const chatGroups = [createGroup({
    memberIds: [author.id, awarePeer.id],
    groupStage: 'warming',
    memberRelationshipState: 'semi',
  })];
  const moment = createMoment({ authorId: author.id, content: 'author post' });
  const characters = [author, awarePeer];

  const access = getCharacterMomentEngagementAccess({
    actor: awarePeer,
    moment,
    characters,
    chatGroups,
  });

  assert.equal(access.canLike, true);
  assert.equal(access.canTopLevelComment, true);
  assert.equal(access.commentMode, 'limited');
});

test('aware peers can be lightly unlocked when the post directly hooks them', () => {
  const hints = createMutualHintPair('author', 'aware-peer', 'aware');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: hints.left,
  });
  const awarePeer = createCharacter({
    id: 'aware-peer',
    name: 'Aware Peer',
    publicThreadPeerHints: hints.right,
  });
  const moment = createMoment({
    authorId: author.id,
    content: 'Aware Peer，出来接一句。',
  });
  const characters = [author, awarePeer];

  const access = getCharacterMomentEngagementAccess({
    actor: awarePeer,
    moment,
    characters,
  });

  assert.equal(access.canTopLevelComment, true);
  assert.equal(access.commentMode, 'limited');
});

test('chat-image sourced moments stay user-directed but can allow one familiar relationship-based comment', () => {
  const hints = createMutualHintPair('author', 'familiar-peer', 'familiar');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: hints.left,
    corePersona: '喜欢你，嘴硬，护短',
  });
  const familiarPeer = createCharacter({
    id: 'familiar-peer',
    name: 'Familiar Peer',
    publicThreadPeerHints: hints.right,
  });
  const moment = createMoment({
    authorId: author.id,
    content: '手机红电报警，脑子也快停机了。长得挺乖，就是大半夜发图的行为有点存心不良。',
    sourceImage: {
      source: 'recent_chat_image',
      characterId: author.id,
      messageTimestamp: Date.now() - 1000,
    },
  });
  const characters = [author, familiarPeer];

  assert.equal(inferMomentAudience(moment, characters), 'user_directed');
  const picked = pickInitialCommenters({
    moment,
    characters,
  });
  assert.equal(picked.length, 1);
  assert.equal(picked[0]?.id, familiarPeer.id);
});

test('chat-image sourced user-directed moments allow all familiar peers to comment in the first wave', () => {
  const familiarAHints = createMutualHintPair('author', 'familiar-a', 'familiar');
  const familiarBHints = createMutualHintPair('author', 'familiar-b', 'familiar');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: [...familiarAHints.left, ...familiarBHints.left],
  });
  const familiarPeerA = createCharacter({
    id: 'familiar-a',
    name: 'Familiar A',
    publicThreadPeerHints: familiarAHints.right,
  });
  const familiarPeerB = createCharacter({
    id: 'familiar-b',
    name: 'Familiar B',
    publicThreadPeerHints: familiarBHints.right,
  });
  const moment = createMoment({
    authorId: author.id,
    content: '这条也是聊天图片带出来的动态。',
    sourceImage: {
      source: 'recent_chat_image',
      characterId: author.id,
      messageTimestamp: Date.now() - 1000,
    },
  });

  const picked = pickInitialCommenters({
    moment,
    characters: [author, familiarPeerA, familiarPeerB],
  });
  assert.equal(picked.length, 2);
  assert.equal(picked.some((character) => character.id === familiarPeerA.id), true);
  assert.equal(picked.some((character) => character.id === familiarPeerB.id), true);
});

test('chat-image sourced user-directed moments still keep aware peers out of first-wave comments', () => {
  const hints = createMutualHintPair('author', 'aware-peer', 'aware');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: hints.left,
  });
  const awarePeer = createCharacter({
    id: 'aware-peer',
    name: 'Aware Peer',
    publicThreadPeerHints: hints.right,
  });
  const moment = createMoment({
    authorId: author.id,
    content: '这条也是半夜发图后的余波。',
    sourceImage: {
      source: 'recent_chat_image',
      characterId: author.id,
      messageTimestamp: Date.now() - 1000,
    },
  });

  assert.equal(inferMomentAudience(moment, [author, awarePeer]), 'user_directed');
  assert.deepEqual(
    pickInitialCommenters({
      moment,
      characters: [author, awarePeer],
    }),
    [],
  );
});

test('familiar peers remain eligible for top-level auto comments', () => {
  const hints = createMutualHintPair('author', 'familiar-peer', 'familiar');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: hints.left,
  });
  const familiarPeer = createCharacter({
    id: 'familiar-peer',
    name: 'Familiar',
    publicThreadPeerHints: hints.right,
  });
  const stranger = createCharacter({
    id: 'stranger',
    name: 'Stranger',
  });
  const moment = createMoment({ authorId: author.id, content: 'author post' });
  const characters = [author, familiarPeer, stranger];

  const picked = pickInitialCommenters({
    moment,
    characters,
  });

  assert.equal(picked.length, 1);
  assert.equal(picked[0]?.id, familiarPeer.id);
});

test('new groups seeded as strangers do not unlock likes or comments by themselves', () => {
  const author = createCharacter({ id: 'author', name: 'Author' });
  const newGroupPeer = createCharacter({ id: 'new-peer', name: 'New Peer' });
  const chatGroups = [createGroup({
    memberIds: [author.id, newGroupPeer.id],
    groupStage: 'new',
    memberRelationSeeds: [
      { sourceMemberId: author.id, targetMemberId: newGroupPeer.id, familiarity: 'strangers' },
      { sourceMemberId: newGroupPeer.id, targetMemberId: author.id, familiarity: 'strangers' },
    ],
  })];
  const moment = createMoment({ authorId: author.id, content: 'author post' });
  const characters = [author, newGroupPeer];

  assert.equal(canCharacterAutoLikeMoment({
    actor: newGroupPeer,
    moment,
    characters,
    chatGroups,
  }), false);
  assert.equal(canCharacterAutoCommentOnMoment({
    actor: newGroupPeer,
    moment,
    characters,
    chatGroups,
  }), false);
});

test('user moments only allow friend characters, and aware peers can only join threads when directly replied to', () => {
  const friend = createCharacter({
    id: 'friend',
    name: 'Friend',
    friendshipStatus: 'friends',
  });
  const blocked = createCharacter({
    id: 'blocked',
    name: 'Blocked',
    friendshipStatus: 'friends',
    blockedByUser: true,
  });
  const outsider = createCharacter({
    id: 'outsider',
    name: 'Outsider',
    friendshipStatus: 'none',
  });
  const userMoment = createMoment({ authorId: 'user', content: 'user post' });
  const userMomentCharacters = [friend, blocked, outsider];

  assert.equal(canCharacterAutoCommentOnMoment({
    actor: friend,
    moment: userMoment,
    characters: userMomentCharacters,
  }), true);
  assert.equal(canCharacterAutoCommentOnMoment({
    actor: blocked,
    moment: userMoment,
    characters: userMomentCharacters,
  }), false);
  assert.equal(canCharacterAutoCommentOnMoment({
    actor: outsider,
    moment: userMoment,
    characters: userMomentCharacters,
  }), false);

  const awareHints = createMutualHintPair('author', 'aware-peer', 'aware');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: awareHints.left,
  });
  const awarePeer = createCharacter({
    id: 'aware-peer',
    name: 'Aware',
    publicThreadPeerHints: awareHints.right,
  });
  const characterMoment = createMoment({ authorId: author.id, content: 'author post' });
  const awareReply = createComment({
    authorId: author.id,
    replyToAuthorId: awarePeer.id,
    replyToAuthorName: awarePeer.name,
  });

  assert.equal(canCharacterJoinMomentThread({
    actor: awarePeer,
    moment: characterMoment,
    characters: [author, awarePeer],
    triggerComment: awareReply,
  }), true);
});

test('limited aware peers can join a thread when another comment directly hooks them', () => {
  const awareHints = createMutualHintPair('author', 'aware-peer', 'aware');
  const familiarHints = createMutualHintPair('author', 'familiar-peer', 'familiar');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: awareHints.left,
  });
  const awarePeer = createCharacter({
    id: 'aware-peer',
    name: 'Aware Peer',
    publicThreadPeerHints: awareHints.right,
  });
  const familiarPeer = createCharacter({
    id: 'familiar-peer',
    name: 'Familiar Peer',
    publicThreadPeerHints: familiarHints.right,
  });
  const chatGroups = [createGroup({
    memberIds: [author.id, awarePeer.id, familiarPeer.id],
    groupStage: 'warming',
    memberRelationshipState: 'semi',
  })];
  const moment = createMoment({ authorId: author.id, content: 'author post' });
  const triggerComment = createComment({
    authorId: familiarPeer.id,
    content: 'Aware Peer，轮到你接了。',
  });

  assert.equal(canCharacterJoinMomentThread({
    actor: awarePeer,
    moment,
    characters: [author, awarePeer, familiarPeer],
    chatGroups,
    triggerComment,
  }), true);
});

test('forum_mirror moments suppress auto interaction inside Moments even for familiar peers', () => {
  const hints = createMutualHintPair('author', 'familiar-peer', 'familiar');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: hints.left,
  });
  const familiarPeer = createCharacter({
    id: 'familiar-peer',
    name: 'Familiar',
    publicThreadPeerHints: hints.right,
  });
  const moment = createMoment({
    authorId: author.id,
    visibilityScope: 'forum_mirror',
    content: 'mirror post',
  });
  const triggerComment = createComment({
    authorId: 'user',
    content: 'saw this',
  });

  assert.equal(canCharacterAutoLikeMoment({
    actor: familiarPeer,
    moment,
    characters: [author, familiarPeer],
  }), false);
  assert.equal(canCharacterAutoCommentOnMoment({
    actor: familiarPeer,
    moment,
    characters: [author, familiarPeer],
  }), false);
  assert.equal(canCharacterJoinMomentThread({
    actor: author,
    moment,
    characters: [author, familiarPeer],
    triggerComment,
  }), false);

  const mirroredUserMoment = createMoment({
    authorId: 'user',
    visibilityScope: 'forum_mirror',
    content: 'mirror user post',
  });

  assert.equal(canCharacterAutoLikeMoment({
    actor: familiarPeer,
    moment: mirroredUserMoment,
    characters: [author, familiarPeer],
  }), false);
});

test('explicit allow_interaction can unlock stranger public interaction for character moments', () => {
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: [{
      targetCharacterId: 'stranger-peer',
      familiarity: 'stranger',
      momentInteractionPolicy: 'allow_interaction',
      updatedAt: 1,
    }],
  });
  const strangerPeer = createCharacter({
    id: 'stranger-peer',
    name: 'Stranger Peer',
    publicThreadPeerHints: [{
      targetCharacterId: 'author',
      familiarity: 'stranger',
      momentInteractionPolicy: 'allow_interaction',
      updatedAt: 1,
    }],
  });
  const moment = createMoment({ authorId: author.id, content: 'author post' });

  assert.equal(canCharacterAutoLikeMoment({
    actor: strangerPeer,
    moment,
    characters: [author, strangerPeer],
  }), true);
  assert.equal(canCharacterAutoCommentOnMoment({
    actor: strangerPeer,
    moment,
    characters: [author, strangerPeer],
  }), true);
});

test('soft user-shadow moments allow one limited third-party comment instead of clearing the floor', () => {
  const hints = createMutualHintPair('author', 'familiar-peer', 'familiar');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    corePersona: '喜欢你，黏人，护着你',
    publicThreadPeerHints: hints.left,
  });
  const familiarPeer = createCharacter({
    id: 'familiar-peer',
    name: 'Familiar Peer',
    publicThreadPeerHints: hints.right,
  });
  const moment = createMoment({
    authorId: author.id,
    content: '今天有点不想分开。',
  });
  const characters = [author, familiarPeer];

  assert.equal(getMomentAutoCommentSuppressionMode(moment, characters), 'limit_third_party');
  const picked = pickInitialCommenters({
    moment,
    characters,
  });
  assert.equal(picked.length, 1);
  assert.equal(picked[0]?.id, familiarPeer.id);
});

test('character moments reserve one limited seat when the first-wave floor has room', () => {
  const familiarA = createMutualHintPair('author', 'familiar-a', 'familiar');
  const familiarB = createMutualHintPair('author', 'familiar-b', 'familiar');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    publicThreadPeerHints: [...familiarA.left, ...familiarB.left],
  });
  const familiarPeerA = createCharacter({
    id: 'familiar-a',
    name: 'Familiar A',
    publicThreadPeerHints: familiarA.right,
  });
  const familiarPeerB = createCharacter({
    id: 'familiar-b',
    name: 'Familiar B',
    publicThreadPeerHints: familiarB.right,
  });
  const awarePeer = createCharacter({
    id: 'aware-peer',
    name: 'Aware Peer',
  });
  const chatGroups = [createGroup({
    memberIds: [author.id, familiarPeerA.id, familiarPeerB.id, awarePeer.id],
    groupStage: 'warming',
    memberRelationshipState: 'semi',
  })];
  const moment = createMoment({ authorId: author.id, content: 'author post' });
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const picked = pickInitialCommenters({
      moment,
      characters: [author, familiarPeerA, familiarPeerB, awarePeer],
      chatGroups,
    });
    assert.equal(picked.length, 2);
    assert.equal(picked.some((character) => character.id === awarePeer.id), true);
  } finally {
    Math.random = originalRandom;
  }
});

test('user moments now cap the first wave at one or two comments while character moments start at two or three', () => {
  const userMoment = createMoment({ authorId: 'user', content: 'user post' });
  const characterMoment = createMoment({ authorId: 'author', content: 'author post' });
  const characters = [
    createCharacter({ id: 'a', name: 'A' }),
    createCharacter({ id: 'b', name: 'B' }),
    createCharacter({ id: 'c', name: 'C' }),
    createCharacter({ id: 'd', name: 'D' }),
    createCharacter({ id: 'e', name: 'E' }),
  ];
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    assert.equal(getMomentAutoCommentTargetCount(userMoment, characters), 1);
    assert.equal(getMomentAutoCommentTargetCount(characterMoment, characters), 2);

    Math.random = () => 0.99;
    assert.equal(getMomentAutoCommentTargetCount(userMoment, characters), 2);
    assert.equal(getMomentAutoCommentTargetCount(characterMoment, characters), 3);
  } finally {
    Math.random = originalRandom;
  }
});

test('ownership-heavy user-shadow moments still fully suppress auto comments', () => {
  const hints = createMutualHintPair('author', 'familiar-peer', 'familiar');
  const author = createCharacter({
    id: 'author',
    name: 'Author',
    corePersona: '喜欢你，黏人，护着你',
    publicThreadPeerHints: hints.left,
  });
  const familiarPeer = createCharacter({
    id: 'familiar-peer',
    name: 'Familiar Peer',
    publicThreadPeerHints: hints.right,
  });
  const moment = createMoment({
    authorId: author.id,
    content: '今天直接把某人带走，我的人。',
  });
  const characters = [author, familiarPeer];

  assert.equal(getMomentAutoCommentSuppressionMode(moment, characters), 'full_block');
  assert.deepEqual(
    pickInitialCommenters({
      moment,
      characters,
    }),
    [],
  );
});

test('explicit observe_only and block override familiar defaults', () => {
  const observeHints = createMutualHintPair('author-observe', 'peer-observe', 'familiar');
  const observeAuthor = createCharacter({
    id: 'author-observe',
    name: 'Observe Author',
    publicThreadPeerHints: [{
      ...observeHints.left[0],
      momentInteractionPolicy: 'observe_only',
    }],
  });
  const observePeer = createCharacter({
    id: 'peer-observe',
    name: 'Observe Peer',
    publicThreadPeerHints: [{
      ...observeHints.right[0],
      momentInteractionPolicy: 'observe_only',
    }],
  });
  const observeMoment = createMoment({ authorId: observeAuthor.id, content: 'observe post' });

  assert.equal(canCharacterAutoLikeMoment({
    actor: observePeer,
    moment: observeMoment,
    characters: [observeAuthor, observePeer],
  }), false);
  assert.equal(canCharacterAutoCommentOnMoment({
    actor: observePeer,
    moment: observeMoment,
    characters: [observeAuthor, observePeer],
  }), false);

  const blockHints = createMutualHintPair('author-block', 'peer-block', 'familiar');
  const blockAuthor = createCharacter({
    id: 'author-block',
    name: 'Block Author',
    publicThreadPeerHints: [{
      ...blockHints.left[0],
      momentInteractionPolicy: 'block',
    }],
  });
  const blockPeer = createCharacter({
    id: 'peer-block',
    name: 'Block Peer',
    publicThreadPeerHints: [{
      ...blockHints.right[0],
      momentInteractionPolicy: 'block',
    }],
  });
  const blockMoment = createMoment({ authorId: blockAuthor.id, content: 'block post' });
  const directReply = createComment({
    authorId: blockAuthor.id,
    replyToAuthorId: blockPeer.id,
    replyToAuthorName: blockPeer.name,
  });

  assert.equal(canCharacterAutoLikeMoment({
    actor: blockPeer,
    moment: blockMoment,
    characters: [blockAuthor, blockPeer],
  }), false);
  assert.equal(canCharacterAutoCommentOnMoment({
    actor: blockPeer,
    moment: blockMoment,
    characters: [blockAuthor, blockPeer],
  }), false);
  assert.equal(canCharacterJoinMomentThread({
    actor: blockPeer,
    moment: blockMoment,
    characters: [blockAuthor, blockPeer],
    triggerComment: directReply,
  }), false);
});
