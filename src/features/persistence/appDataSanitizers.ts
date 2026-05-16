import type { AppData, Character, ChatGroup, MomentItem } from '../../types';
import { sanitizeGroupMemberBadges } from '../group-settings/memberBadges';
import { sanitizeGroupMemberBubbleColors } from '../group-settings/groupBubbleColors';
import { getGroupAwarenessMode, sanitizeGroupAwarenessEntries } from '../group-settings/groupAwareness';
import { sanitizeDutyAdminAssignment, sanitizeTemporaryPermissionGrants } from '../group-settings/groupDynamicPermissions';
import { sanitizeAdminNominationCooldowns } from '../group-settings/groupGovernanceState';
import { sanitizeMutedMemberEntries } from '../group-settings/groupMutedMembers';
import { sanitizeGroupLongTermMemory } from '../../services/group-chat/groupLongTermMemory';
import { sanitizeGroupMemberPerspectiveSummaries } from '../../services/group-chat/groupShortTermMemory';
import { buildPersistableCoupleSpacePayload } from './coupleSpaceStore';
import { normalizeContactGroupName } from './contactGroupNames';
import { migrateCharacterShapes } from './migrateCharacterShape';
import { sanitizeTransientAssetValue } from './sanitizeTransientAssetValue';
import { resolveMomentVisibilityScope } from '../../services/moments/momentVisibilityScope';
import { hasRemovedGroupOfflineEnsembleContent } from '../group-offline/sessionUtils';

const HIDDEN_CHARACTER_IDS = new Set(['char-2', 'char-zhou-jibai']);
const HIDDEN_CHARACTER_NAMES = new Set(['林策', '周既白']);
const REMOVED_CHARACTER_IDS = new Set(['gemini-default']);
const REMOVED_CHARACTER_NAMES = new Set(['阿野']);
const REMOVED_DEFAULT_MOMENT_IDS = new Set(['m1', 'm2']);

export const DEFAULT_MOMENTS: MomentItem[] = [];

export function sanitizePersistedCharacters(
  characters: Character[] | undefined,
  defaultCharacters: Character[],
  defaultZhouJibaiAvatar: string,
): Character[] {
  const persistedCharacters = migrateCharacterShapes(characters || [])
    .filter(character => (
      !REMOVED_CHARACTER_IDS.has(character.id)
      && !REMOVED_CHARACTER_NAMES.has(character.name)
      && !HIDDEN_CHARACTER_IDS.has(character.id)
      && !HIDDEN_CHARACTER_NAMES.has(character.name)
    ))
    .map(character =>
      character.id === 'char-zhou-jibai'
        ? {
            ...character,
            avatar:
              sanitizeTransientAssetValue(character.avatar) || defaultZhouJibaiAvatar,
            groupId: normalizeContactGroupName(character.groupId),
          }
        : {
            ...character,
            avatar: sanitizeTransientAssetValue(character.avatar),
            groupId: normalizeContactGroupName(character.groupId),
          },
    );

  const existingIds = new Set(persistedCharacters.map(character => character.id));
  const missingDefaults = defaultCharacters.filter(character => (
    !existingIds.has(character.id)
    && !HIDDEN_CHARACTER_IDS.has(character.id)
    && !HIDDEN_CHARACTER_NAMES.has(character.name)
  ));

  return [...persistedCharacters, ...missingDefaults];
}

export function getPersistableAppData(appData: AppData): Omit<AppData, 'characters'> {
  const { characters: _characters, ...persistableAppData } = appData;
  const { coupleSpaceState, coupleSpace } = buildPersistableCoupleSpacePayload(
    appData.coupleSpaceState,
    appData.coupleSpace,
  );
  const chatGroups = (persistableAppData.chatGroups || []).map((group) => {
    const { history: _history, lastMessage: _lastMessage, lastTime: _lastTime, ...organization } = group;
    return organization;
  });

  return {
    ...persistableAppData,
    chatGroups,
    coupleSpace,
    coupleSpaceState,
  };
}

export function sanitizeChatGroupsWithCharacters(
  chatGroups: ChatGroup[] | null | undefined,
  characters: Character[],
): ChatGroup[] {
  if (!Array.isArray(chatGroups)) return [];

  const validCharacterIds = new Set(characters.map((character) => character.id));
  const sanitizeGroupBackgroundValue = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (/^data:/i.test(trimmed) && !/^data:image\/[a-zA-Z0-9.+-]+(?:;[^,]+)?,.+$/i.test(trimmed)) {
      return undefined;
    }

    return trimmed;
  };

  return chatGroups.map((group) => ({
    ...group,
    name: typeof group.name === 'string' ? group.name.trim() : '',
    groupBackground: sanitizeGroupBackgroundValue(group.groupBackground),
    groupNickname: typeof group.groupNickname === 'string' ? group.groupNickname.trim() : undefined,
    groupNotice: typeof group.groupNotice === 'string' ? group.groupNotice.trim() : undefined,
    groupRemark: typeof group.groupRemark === 'string' ? group.groupRemark.trim() : undefined,
    backgroundSummary: typeof group.backgroundSummary === 'string' ? group.backgroundSummary.trim() : undefined,
    memberRelationshipState:
      group.memberRelationshipState === 'close'
      || group.memberRelationshipState === 'semi'
      || group.memberRelationshipState === 'distant'
      || group.memberRelationshipState === 'mixed'
        ? group.memberRelationshipState
        : undefined,
    memberRelationshipNote: typeof group.memberRelationshipNote === 'string' ? group.memberRelationshipNote.trim() : undefined,
    currentScene: typeof group.currentScene === 'string' ? group.currentScene.trim() : undefined,
    publicFacts: typeof group.publicFacts === 'string' ? group.publicFacts.trim() : undefined,
    activeOfflineSession: hasRemovedGroupOfflineEnsembleContent(group.activeOfflineSession)
      ? undefined
      : group.activeOfflineSession,
    awarenessMode: getGroupAwarenessMode(group),
    groupShortTermSummary: typeof group.groupShortTermSummary === 'string'
      ? group.groupShortTermSummary.trim() || undefined
      : undefined,
    groupMemberPerspectiveSummaries: sanitizeGroupMemberPerspectiveSummaries(
      group.groupMemberPerspectiveSummaries,
      Array.isArray(group.memberIds) ? group.memberIds : [],
    ),
    groupLongTermMemory: sanitizeGroupLongTermMemory(
      group.groupLongTermMemory,
      Array.isArray(group.memberIds) ? group.memberIds : [],
    ),
    activeWorldBookIds: Array.isArray(group.activeWorldBookIds)
      ? group.activeWorldBookIds.filter((worldBookId): worldBookId is string => typeof worldBookId === 'string')
      : [],
    allowDirectMemoryInterop:
      group.allowDirectMemoryInteropConfigured === true
        ? group.allowDirectMemoryInterop !== false
        : true,
    allowDirectMemoryInteropConfigured: group.allowDirectMemoryInteropConfigured === true,
    adminIds: Array.from(
      new Set(
        (Array.isArray(group.adminIds) ? group.adminIds : []).filter((memberId): memberId is string => (
          typeof memberId === 'string'
          && memberId !== group.creatorId
          && (Array.isArray(group.memberIds) ? group.memberIds : []).includes(memberId)
        )),
      ),
    ),
    dutyAdminAssignment: sanitizeDutyAdminAssignment(group.dutyAdminAssignment, {
      memberIds: Array.isArray(group.memberIds) ? group.memberIds : [],
      creatorId: typeof group.creatorId === 'string' ? group.creatorId : 'user',
    }),
    temporaryPermissionGrants: sanitizeTemporaryPermissionGrants(group.temporaryPermissionGrants, {
      memberIds: Array.isArray(group.memberIds) ? group.memberIds : [],
      creatorId: typeof group.creatorId === 'string' ? group.creatorId : 'user',
    }),
    awarenessEntries: sanitizeGroupAwarenessEntries(group.awarenessEntries, {
      validCharacterIds: Array.from(validCharacterIds),
    }),
    adminNominationCooldowns: sanitizeAdminNominationCooldowns(group.adminNominationCooldowns, {
      memberIds: Array.isArray(group.memberIds) ? group.memberIds : [],
    }),
    mutedMemberEntries: sanitizeMutedMemberEntries(group.mutedMemberEntries, {
      memberIds: Array.isArray(group.memberIds) ? group.memberIds : [],
      creatorId: typeof group.creatorId === 'string' ? group.creatorId : 'user',
    }),
    memberBadges: sanitizeGroupMemberBadges({
      memberBadges: group.memberBadges,
      memberIds: Array.isArray(group.memberIds) ? group.memberIds : [],
      creatorId: typeof group.creatorId === 'string' ? group.creatorId : 'user',
    }),
    memberBubbleColors: sanitizeGroupMemberBubbleColors({
      memberBubbleColors: group.memberBubbleColors,
      memberIds: Array.isArray(group.memberIds) ? group.memberIds : [],
      creatorId: typeof group.creatorId === 'string' ? group.creatorId : 'user',
    }),
    muteNotifications: !!group.muteNotifications,
    pinChat: !!group.pinChat,
    voiceRepliesEnabled: !!group.voiceRepliesEnabled,
    voiceReplyMemberIds: Array.from(
      new Set(
        (Array.isArray(group.voiceReplyMemberIds) ? group.voiceReplyMemberIds : []).filter((memberId): memberId is string => (
          typeof memberId === 'string'
          && (Array.isArray(group.memberIds) ? group.memberIds : []).includes(memberId)
          && validCharacterIds.has(memberId)
        )),
      ),
    ),
    groupStage: group.groupStage === 'warming' || group.groupStage === 'familiar' ? group.groupStage : 'new',
    memberIds: Array.from(
      new Set(
        (Array.isArray(group.memberIds) ? group.memberIds : []).filter((memberId): memberId is string => (
          typeof memberId === 'string' && validCharacterIds.has(memberId)
        )),
      ),
    ),
    memberRelationSeeds: Array.isArray(group.memberRelationSeeds)
      ? group.memberRelationSeeds.filter((seed) => (
          !!seed
          && typeof seed.sourceMemberId === 'string'
          && typeof seed.targetMemberId === 'string'
          && validCharacterIds.has(seed.sourceMemberId)
          && validCharacterIds.has(seed.targetMemberId)
          && seed.sourceMemberId !== seed.targetMemberId
          && (
            seed.familiarity === 'strangers'
            || seed.familiarity === 'aware'
            || seed.familiarity === 'familiar'
          )
        ))
      : [],
  }));
}

export function hydratePersistedCharacters(
  source: Character[] | null | undefined,
  fallback: Character[],
  defaultZhouJibaiAvatar: string,
): Character[] {
  return sanitizePersistedCharacters(source || fallback, fallback, defaultZhouJibaiAvatar);
}

export function sanitizePersistedMoments(moments: MomentItem[] | null | undefined): MomentItem[] {
  if (!Array.isArray(moments)) {
    return [];
  }

  return moments
    .filter((moment) => !REMOVED_DEFAULT_MOMENT_IDS.has(moment.id))
    .map((moment) => ({
      ...moment,
      visibilityScope: resolveMomentVisibilityScope(moment),
      sourceImage:
        moment.sourceImage
        && moment.sourceImage.source === 'recent_chat_image'
        && typeof moment.sourceImage.characterId === 'string'
          ? {
              source: 'recent_chat_image' as const,
              characterId: moment.sourceImage.characterId,
              ...(typeof moment.sourceImage.messageTimestamp === 'number'
                ? { messageTimestamp: moment.sourceImage.messageTimestamp }
                : {}),
              ...(typeof moment.sourceImage.imageUrl === 'string' ? { imageUrl: moment.sourceImage.imageUrl } : {}),
            }
          : undefined,
    }));
}
