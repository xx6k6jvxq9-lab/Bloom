import type {
  ForumSpectatorObjectMode,
  ForumSpectatorTargetCharacter,
  ForumSpectatorTargetPreset,
  ForumSpectatorTargetRole,
} from '../../types';
import type { SpectatorWorldShell } from '../../features/forum-domain/spectatorWorldShells';
import type { ForumThreadType } from '../../features/forum-domain/types';

type CharacterRef = {
  id: string;
  name: string;
};

const SPECTATOR_ROLE_LABELS: Record<ForumSpectatorTargetRole, string> = {
  primary: '主',
  secondary: '副',
  equal: '平',
};

type SpectatorRelationshipCoordinates = {
  focusLine: string;
  userPosition: string;
  supportingRoleSummary: string;
  actionRuleSummary: string;
  readingBiasSummary: string;
  promptLines: string[];
};

export function deriveTargetCharactersFromIds(ids: string[]): ForumSpectatorTargetCharacter[] {
  return ids.map((characterId, index) => ({
    characterId,
    role: index === 0 ? 'primary' : 'equal',
  }));
}

export function buildSpectatorTargetLabel(options: {
  currentUserName: string;
  characters: CharacterRef[];
  targets: ForumSpectatorTargetCharacter[];
  userSlotMode: 'self' | 'mask';
  objectMode?: ForumSpectatorObjectMode;
}) {
  const { currentUserName, characters, targets, userSlotMode, objectMode = 'user_with_characters' } = options;
  const rank: Record<ForumSpectatorTargetRole, number> = { primary: 0, secondary: 1, equal: 2 };
  const ordered = [...targets].sort((left, right) => rank[left.role] - rank[right.role]);
  const names = ordered
    .map((target) => characters.find((character) => character.id === target.characterId)?.name)
    .filter(Boolean) as string[];
  const userLabel = userSlotMode === 'mask' ? '面具用户' : currentUserName;
  if (objectMode === 'single_character') return names.join(' / ') || userLabel;
  return [userLabel, ...names].filter(Boolean).join(' x ');
}

export function toggleSpectatorTargetCharacterSelection(
  current: ForumSpectatorTargetCharacter[],
  characterId: string,
): ForumSpectatorTargetCharacter[] {
  const existing = current.find((target) => target.characterId === characterId);
  if (existing) {
    return current.filter((target) => target.characterId !== characterId);
  }
  const nextRole: ForumSpectatorTargetRole = current.length === 0 ? 'primary' : 'equal';
  return [...current, { characterId, role: nextRole }];
}

export function cycleSpectatorTargetCharacterRole(
  current: ForumSpectatorTargetCharacter[],
  characterId: string,
): ForumSpectatorTargetCharacter[] {
  return current.map((target) => {
    if (target.characterId !== characterId) return target;
    const nextRole = target.role === 'primary'
      ? 'secondary'
      : target.role === 'secondary'
        ? 'equal'
        : 'primary';
    return { ...target, role: nextRole };
  });
}

export function buildSpectatorTargetPreset(options: {
  currentUserName: string;
  characters: CharacterRef[];
  objectMode?: ForumSpectatorObjectMode;
  userSlotMode: 'self' | 'mask';
  userNameSource?: 'user' | 'forum';
  userMaskId?: string;
  targetCharacters: ForumSpectatorTargetCharacter[];
  threadTypes: ForumThreadType[];
  angles: string[];
  relationshipSummary: string;
  worldShell?: SpectatorWorldShell;
}): ForumSpectatorTargetPreset {
  const {
    currentUserName,
    characters,
    objectMode,
    userSlotMode,
    userNameSource,
    userMaskId,
    targetCharacters,
    threadTypes,
    angles,
    relationshipSummary,
    worldShell,
  } = options;

  return {
    id: `spectator-preset-${Date.now()}`,
    label: buildSpectatorTargetLabel({
      currentUserName,
      characters,
      targets: targetCharacters,
      userSlotMode,
      objectMode,
    }),
    objectMode,
    userSlot: {
      mode: userSlotMode,
      maskId: userSlotMode === 'mask' ? userMaskId : undefined,
    },
    userNameSource: userNameSource || 'user',
    targetCharacters,
    threadTypes,
    angles: angles as ForumSpectatorTargetPreset['angles'],
    relationshipSummary: relationshipSummary.trim(),
    worldShell,
  };
}

export function buildSpectatorObjectRoleSummary(options: {
  characters: CharacterRef[];
  targets: ForumSpectatorTargetCharacter[];
}) {
  const { characters, targets } = options;
  const rank: Record<ForumSpectatorTargetRole, number> = { primary: 0, secondary: 1, equal: 2 };
  return [...targets]
    .sort((left, right) => rank[left.role] - rank[right.role])
    .map((target) => {
      const characterName = characters.find((character) => character.id === target.characterId)?.name || target.characterId;
      return `${SPECTATOR_ROLE_LABELS[target.role]}:${characterName}`;
    })
    .join(' / ');
}

export function buildSpectatorObjectSemantics(options: {
  currentUserName: string;
  characters: CharacterRef[];
  targets: ForumSpectatorTargetCharacter[];
  userSlotMode: 'self' | 'mask';
  objectMode?: ForumSpectatorObjectMode;
}) {
  const { currentUserName, characters, targets, userSlotMode, objectMode = 'user_with_characters' } = options;
  const orderedTargets = [...targets].sort((left, right) => {
    const rank: Record<ForumSpectatorTargetRole, number> = { primary: 0, secondary: 1, equal: 2 };
    return rank[left.role] - rank[right.role];
  });
  const nameById = new Map(characters.map((character) => [character.id, character.name] as const));
  const resolvedTargets = orderedTargets
    .map((target) => ({
      role: target.role,
      name: nameById.get(target.characterId) || target.characterId,
    }));
  const primaryNames = resolvedTargets.filter((target) => target.role === 'primary').map((target) => target.name);
  const secondaryNames = resolvedTargets.filter((target) => target.role === 'secondary').map((target) => target.name);
  const equalNames = resolvedTargets.filter((target) => target.role === 'equal').map((target) => target.name);
  const userObjectLabel = objectMode === 'single_character'
    ? '不入场'
    : userSlotMode === 'mask'
      ? '面具身份'
      : '本人';
  const targetLabel = buildSpectatorTargetLabel({
    currentUserName,
    characters,
    targets,
    userSlotMode,
    objectMode,
  });
  const roleSummary = resolvedTargets
    .map((target) => `${target.role === 'primary' ? '主' : target.role === 'secondary' ? '副' : '平'}:${target.name}`)
    .join(' / ');

  let focusGuidance = '';
  const supportingNames = [...secondaryNames, ...equalNames];

  if (objectMode === 'single_character') {
    focusGuidance = `这次更像围着 ${targetLabel} 单开的一栋楼，重点不是“你和谁”，而是这个人本身在不同关系里到底散发什么味道。`;
  } else if (resolvedTargets.length === 1) {
    focusGuidance = `网友会把它看成 ${targetLabel} 这条单线关系，重点盯用户和这个角色之间的拉扯。`;
  } else if (primaryNames.length === 0 && secondaryNames.length === 0 && equalNames.length > 1) {
    focusGuidance = `网友会把它看成 ${targetLabel} 这种多人关系线，重点是用户和所有平位角色一起被围观，不要偷缩成其中两个人。`;
  } else if (primaryNames.length > 0) {
    const leadLine = [userSlotMode === 'mask' ? '面具用户' : currentUserName, ...primaryNames].join(' x ');
    focusGuidance = supportingNames.length > 0
      ? `网友会更偏向把 ${leadLine} 当成主线，但 ${supportingNames.join('、')} 仍然在局里，要继续作为副线、对照、竞争者或误读来源存在。`
      : `网友会更偏向把 ${leadLine} 当成主线，整栋楼的围观重心也要更常落在这条线上。`;
  } else if (secondaryNames.length > 0) {
    focusGuidance = `网友会把 ${targetLabel} 当成多人关系线来聊，但会更常把视线偏向 ${secondaryNames.join('、')} 这边，不代表其他角色消失。`;
  }

  const promptLines: string[] = [];
  if (primaryNames.length === 0 && secondaryNames.length === 0 && equalNames.length > 1) {
    promptLines.push('当已选角色全部是平位时，要把它写成用户和所有角色一起被围观的多人关系线，不要自动缩成其中两个人。');
    promptLines.push('多人对象不限人数。就算选了四个或五个角色，也可以在不同帖子里轮流落焦点，但整体上必须让所有已选角色都持续在局。');
  }
  if (primaryNames.length > 0) {
    promptLines.push(`主位角色是 ${primaryNames.join('、')}。网友会更常把用户和主位角色看成主线，但不能因此把其他角色写没。`);
  }
  if (secondaryNames.length > 0) {
    promptLines.push(`副位角色是 ${secondaryNames.join('、')}。副位不是消失位，要继续承担接线、对照、竞争或拱火作用。`);
  }
  if (equalNames.length > 0 && (primaryNames.length > 0 || secondaryNames.length > 0)) {
    promptLines.push(`平位角色是 ${equalNames.join('、')}。平位要继续在场，不能只在标题里挂名，正文和评论也要留下存在感。`);
  }

  return {
    userObjectLabel,
    targetLabel,
    roleSummary,
    primaryNames,
    secondaryNames,
    equalNames,
    focusGuidance,
    relationshipCoordinates: buildSpectatorRelationshipCoordinates({
      currentUserName,
      userSlotMode,
      targetLabel,
      primaryNames,
      secondaryNames,
      equalNames,
    }),
    promptLines,
  };
}

function buildSpectatorRelationshipCoordinates(input: {
  currentUserName: string;
  userSlotMode: 'self' | 'mask';
  targetLabel: string;
  primaryNames: string[];
  secondaryNames: string[];
  equalNames: string[];
}): SpectatorRelationshipCoordinates {
  const {
    currentUserName,
    userSlotMode,
    targetLabel,
    primaryNames,
    secondaryNames,
    equalNames,
  } = input;
  const userLabel = userSlotMode === 'mask' ? '面具用户' : currentUserName;
  const allCharacterNames = [...primaryNames, ...secondaryNames, ...equalNames];

  const focusLine = primaryNames.length > 0
    ? `${userLabel} x ${primaryNames.join(' / ')}`
    : allCharacterNames.length > 0
      ? `${userLabel} x ${allCharacterNames.join(' / ')}`
      : userLabel;

  let userPosition = '';
  if (primaryNames.length > 0 && secondaryNames.length === 0 && equalNames.length === 0) {
    userPosition = `这次更像 ${userLabel} 和 ${primaryNames[0]} 的双人主线，网友会把用户放在关系正中心。`;
  } else if (primaryNames.length > 0) {
    userPosition = `这次更像 ${userLabel} 站在主线中心，${primaryNames.join(' / ')} 是最容易被围观成主搭线的人，其他角色继续在局里。`;
  } else if (equalNames.length >= 2 && secondaryNames.length === 0) {
    userPosition = `这次更像 ${userLabel} 被放进多人关系正中间，网友会把整组人一起看，不该自动缩成单对。`;
  } else if (secondaryNames.length > 0) {
    userPosition = `这次更像 ${userLabel} 被卷进一条多人关系线里，${secondaryNames.join(' / ')} 更容易被看成侧重点。`;
  } else {
    userPosition = `这次更像 ${userLabel} 和单个对象之间的围观楼，重点是关系余味，不是大动作。`;
  }

  const supportingParts: string[] = [];
  if (secondaryNames.length > 0) {
    supportingParts.push(`${secondaryNames.join(' / ')} 是副线、对照线或竞争线`);
  }
  if (equalNames.length > 0 && (primaryNames.length > 0 || secondaryNames.length > 0)) {
    supportingParts.push(`${equalNames.join(' / ')} 是平位在场角色，不能只挂名不落地`);
  }
  if (equalNames.length > 1 && primaryNames.length === 0 && secondaryNames.length === 0) {
    supportingParts.push(`${equalNames.join(' / ')} 是并列在场的多人对象，要轮流落焦点但不掉线`);
  }
  const supportingRoleSummary = supportingParts.join('；') || '这次没有额外陪衬位，重点是当前主线本身。';

  const discouragedActions = primaryNames.length > 0 || allCharacterNames.length > 1
    ? '不要随便写“拎上车 / 扔进副驾 / 当场带走 / 明着宣示归属”这类强动作，除非前文事实已经足够支撑。'
    : '不要上来就写强占有、强护送、强肢体动作，先让楼建立基本关系感。';
  const actionRuleSummary = primaryNames.length > 0
    ? `强关系动作默认优先往 ${focusLine} 这条主线附近判断，但也必须先过事实层，不能只凭嗑法硬写。${discouragedActions}`
    : `这次没有单一主位，动作更应该保守，先写谁看见了什么，再让网友往关系上读。${discouragedActions}`;

  const readingBiasSummary = primaryNames.length > 0
    ? `网友更容易把这条线读成 ${focusLine} 的偏心、护短或拉扯，但另一侧角色只能当“继续在场的压力和误读来源”，不能被写没。`
    : equalNames.length >= 2
      ? `网友更容易把这条线读成 ${targetLabel} 的多人关系局，允许站队和误读，但不要太快盖章谁赢了、谁归谁。`
      : '网友可以顺着气质误读，但不能把一两个动作直接上升成角色定论或关系盖章。';

  return {
    focusLine,
    userPosition,
    supportingRoleSummary,
    actionRuleSummary,
    readingBiasSummary,
    promptLines: [
      `先把这次镜间对象的关系坐标定成：${focusLine}。`,
      userPosition,
      supportingRoleSummary,
      '帖子里先写事实层：谁出现、谁站哪、谁说了什么、谁先动、谁停了一下；再写楼主和网友怎么读，不要把误读直接写成客观真相。',
      actionRuleSummary,
      readingBiasSummary,
      '如果是多人对象，不要为了好写自动缩成其中两个人；如果是单主线，也不要把旁侧角色一笔抹掉。',
    ],
  };
}
