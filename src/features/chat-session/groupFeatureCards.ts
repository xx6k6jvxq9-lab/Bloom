import type { ChatMessage, GroupPollCard, GroupPollOption, GroupRelayCard, GroupRelayEntry, GroupTaskCard, GroupTaskEntry } from '../../types';

function createOptionId(index: number) {
  return `option-${index + 1}`;
}

function createRelayEntryId(index: number) {
  return `relay-entry-${index + 1}`;
}

function createTaskEntryId(index: number) {
  return `task-entry-${index + 1}`;
}

export function createGroupPollMessage(params: {
  title: string;
  options: string[];
  creatorName: string;
  senderCharacterId?: string;
  timestamp?: number;
}): ChatMessage {
  const createdAt = params.timestamp ?? Date.now();
  const normalizedOptions = params.options
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map<GroupPollOption>((option, index) => ({
      id: createOptionId(index),
      text: option,
      voterIds: [],
    }));

  const pollCard: GroupPollCard = {
    kind: 'poll',
    title: params.title.trim(),
    createdBy: params.creatorName,
    createdAt,
    status: 'active',
    options: normalizedOptions,
  };

  return {
    role: 'model',
    text: `[group-poll] ${pollCard.title}`,
    timestamp: createdAt,
    isSystem: true,
    senderCharacterId: params.senderCharacterId,
    groupPollCard: pollCard,
  };
}

export function completeGroupPollMessage(message: ChatMessage): ChatMessage {
  const currentCard = message.groupPollCard;
  if (!currentCard || currentCard.kind !== 'poll') {
    return message;
  }

  return {
    ...message,
    groupPollCard: {
      ...currentCard,
      status: 'completed',
    },
  };
}

export function voteOnGroupPollMessage(params: {
  message: ChatMessage;
  voterId: string;
  optionId: string;
}): ChatMessage {
  const currentCard = params.message.groupPollCard;
  if (!currentCard || currentCard.kind !== 'poll') {
    return params.message;
  }

  const nextOptions = currentCard.options.map((option) => {
    const filteredVoters = option.voterIds.filter((id) => id !== params.voterId);
    if (option.id !== params.optionId) {
      return { ...option, voterIds: filteredVoters };
    }
    return {
      ...option,
      voterIds: [...filteredVoters, params.voterId],
    };
  });

  return {
    ...params.message,
    groupPollCard: {
      ...currentCard,
      options: nextOptions,
    },
  };
}

export function createGroupRelayMessage(params: {
  topic: string;
  starterText: string;
  creatorId: string;
  creatorName: string;
  role?: ChatMessage['role'];
  senderCharacterId?: string;
  timestamp?: number;
}): ChatMessage {
  const createdAt = params.timestamp ?? Date.now();
  const starterEntry: GroupRelayEntry = {
    id: createRelayEntryId(0),
    authorId: params.creatorId,
    authorName: params.creatorName,
    content: params.starterText.trim(),
    timestamp: createdAt,
  };

  const relayCard: GroupRelayCard = {
    kind: 'relay',
    topic: params.topic.trim(),
    createdBy: params.creatorName,
    createdAt,
    status: 'active',
    entries: [starterEntry],
  };

  return {
    role: params.role ?? 'user',
    text: `[group-relay] ${relayCard.topic}`,
    timestamp: createdAt,
    senderCharacterId: params.senderCharacterId,
    groupRelayCard: relayCard,
  };
}

export function completeGroupRelayMessage(message: ChatMessage): ChatMessage {
  const currentCard = message.groupRelayCard;
  if (!currentCard || currentCard.kind !== 'relay') {
    return message;
  }

  return {
    ...message,
    groupRelayCard: {
      ...currentCard,
      status: 'completed',
    },
  };
}

export function appendGroupRelayEntry(params: {
  message: ChatMessage;
  authorId: string;
  authorName: string;
  content: string;
  timestamp?: number;
}): ChatMessage {
  const currentCard = params.message.groupRelayCard;
  if (!currentCard || currentCard.kind !== 'relay') {
    return params.message;
  }

  const nextEntry: GroupRelayEntry = {
    id: createRelayEntryId(currentCard.entries.length),
    authorId: params.authorId,
    authorName: params.authorName,
    content: params.content.trim(),
    timestamp: params.timestamp ?? Date.now(),
  };

  return {
    ...params.message,
    groupRelayCard: {
      ...currentCard,
      entries: [...currentCard.entries, nextEntry],
    },
  };
}

export function createGroupTaskMessage(params: {
  prompt: string;
  creatorId: string;
  creatorName: string;
  role?: ChatMessage['role'];
  senderCharacterId?: string;
  timestamp?: number;
}): ChatMessage {
  const createdAt = params.timestamp ?? Date.now();
  const taskCard: GroupTaskCard = {
    kind: 'task',
    prompt: params.prompt.trim(),
    createdBy: params.creatorName,
    createdAt,
    participantIds: [],
    rounds: 0,
    status: 'active',
    entries: [],
  };

  return {
    role: params.role ?? 'user',
    text: `[group-task] ${taskCard.prompt}`,
    timestamp: createdAt,
    senderCharacterId: params.senderCharacterId,
    groupTaskCard: taskCard,
  };
}

export function updateGroupTaskMessage(params: {
  message: ChatMessage;
  participantId?: string;
  rounds?: number;
  status?: GroupTaskCard['status'];
}): ChatMessage {
  const currentCard = params.message.groupTaskCard;
  if (!currentCard || currentCard.kind !== 'task') {
    return params.message;
  }

  const safeParticipantIds = Array.isArray(currentCard.participantIds) ? currentCard.participantIds : [];
  const safeEntries = Array.isArray(currentCard.entries) ? currentCard.entries : [];
  const safeRounds = typeof currentCard.rounds === 'number' ? currentCard.rounds : 0;
  const safeStatus = currentCard.status === 'completed' ? 'completed' : 'active';

  const nextParticipantIds = params.participantId
    ? Array.from(new Set([...safeParticipantIds, params.participantId]))
    : safeParticipantIds;

  return {
    ...params.message,
    groupTaskCard: {
      ...currentCard,
      entries: safeEntries,
      participantIds: nextParticipantIds,
      rounds: typeof params.rounds === 'number' ? params.rounds : safeRounds,
      status: params.status || safeStatus,
    },
  };
}

export function appendGroupTaskEntry(params: {
  message: ChatMessage;
  authorId: string;
  authorName: string;
  content: string;
  timestamp?: number;
}): ChatMessage {
  const currentCard = params.message.groupTaskCard;
  if (!currentCard || currentCard.kind !== 'task') {
    return params.message;
  }

  const safeEntries = Array.isArray(currentCard.entries) ? currentCard.entries : [];
  const safeParticipantIds = Array.isArray(currentCard.participantIds) ? currentCard.participantIds : [];
  const safeRounds = typeof currentCard.rounds === 'number' ? currentCard.rounds : 0;
  const safeStatus = currentCard.status === 'completed' ? 'completed' : 'active';

  const nextEntry: GroupTaskEntry = {
    id: createTaskEntryId(safeEntries.length),
    authorId: params.authorId,
    authorName: params.authorName,
    content: params.content.trim(),
    timestamp: params.timestamp ?? Date.now(),
  };

  return {
    ...params.message,
    groupTaskCard: {
      ...currentCard,
      participantIds: safeParticipantIds,
      rounds: safeRounds,
      status: safeStatus,
      entries: [...safeEntries, nextEntry],
    },
  };
}
