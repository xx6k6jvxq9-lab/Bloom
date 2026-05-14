import React, { Suspense } from 'react';
import { lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Heart, Image as ImageIcon, Sparkles } from 'lucide-react';
import type { AppData, AppSettings, Character, ChatHistory, CoupleSpaceData, CoupleSpaceState } from '../../types';
import { HomeScreen } from '../../components/home/HomeScreen/Page';
import { CharacterMomentsProfile, CharacterProfile } from '../../components/main/ContactsShell/Page';
import { MainApp } from '../../components/main/MainAppShell/Page';
import { AddCharacterSheet } from '../../components/main/AddCharacterSheet';
import {
  ResolvedAssetImage as ResolvedAssetImagePrimitive,
} from './AppShellPrimitives';
import { getPredictedNextApps } from './appPreloadPredictor';
import {
  loadChatSessionMount,
  loadDreamAppPage,
  loadMomentsApp,
  loadSettingsAppScreen,
  loadWorldBookManager,
} from './lazyApps';
import {
  CoupleSpaceApp,
  CustomizationApp,
  ForumApp,
  MonitorApp,
  MusicApp,
  PerceptionView,
  WalletApp,
  preloadPanelForApp,
} from './lazyPanels';
import { DEFAULT_CHARACTERS } from './defaultCharacters';
import { DEFAULT_CONFIG } from './defaultSettings';
import { DEFAULT_ZHOU_JIBAI_AVATAR } from './defaultAppConstants';
import {
  handleCustomizationExportData,
  handleCustomizationImportData,
  handleCustomizationResetData,
  handleCustomizationUpdateAppData,
} from './customizationHandlers';
import { formatMessagePreview } from './formatMessagePreview';
import { navigateToAppWithTransition, type AppScreen, type AppTab } from './appShellHandlers';
import type { CoupleSpaceUpdateToast, DatingGenerationToast, DreamGenerationToast, MomentPublishToast } from './appShellTypes';
import { sanitizeChatGroupsWithCharacters as sanitizeChatGroupsWithCharactersFromStore } from '../persistence/appDataSanitizers';
import {
  extractDirectFactTraces,
  extractDirectRelationshipWaves,
  extractDirectSessionMetadata,
  extractGroupSessions,
  saveChatHistoryRecords,
} from '../persistence/chatHistoryStore';
import { persistChatOrganization } from '../persistence/chatOrganizationStore';
import { switchCurrentCoupleSpaceState } from '../persistence/coupleSpaceStore';
import { persistFriendRequests } from '../persistence/friendRequestsStore';
import { runMomentPublishCommentSequence } from '../../services/moments/commentOrchestrator';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { buildSharedStateWritePatch } from '../../services/relationship-context/buildSharedCharacterState';
import { saveCharacters } from '../persistence/charactersStore';
import { removeCharacterById } from '../character-domain/characterMutations';
import {
  getNextFriendRequestReleaseAt,
  getLatestCharacterRelationshipPageKey,
  releaseDueFriendRequests,
} from '../contacts/friendRequestThreads';
import {
  runRelationshipBlockToggleFlow,
  runRelationshipRequestSubmissionFlow,
} from '../contacts/relationshipFlow';
import { buildForumSharedSettlement } from '../../services/forum/buildForumSharedSettlement';
import { bridgeForumFriendToFormalChat } from '../../services/forum/forumFriendBridge';
import { createEmptyForumTempChatSession, markForumFriendRequestResolved } from '../../services/forum/forumTempChatState';
import {
  canCharacterAutoCommentOnMoment,
  canCharacterAutoLikeMoment,
} from '../../services/moments/publicThreadPolicy';
import { applyMomentInteractionGrowth } from '../../services/moments/momentInteractionGrowth';
import { getDefaultMomentVisibilityScope } from '../../services/moments/momentVisibilityScope';
import {
  appendForumFriendResolutionMessage,
  resolveOutgoingForumFriendRequest,
} from '../../services/forum/forumOutgoingFriendRequestResolution';
import {
  buildSceneSettlementCharacterPatch,
  persistSceneSettlementBatch,
  type PersistSceneSettlementInput,
} from '../../services/memory/sceneSettlement';

type CharacterMomentsBackApp = 'chat' | 'chat-session' | 'character-profile';

const LazyMomentsApp = lazy(loadMomentsApp);
const LazyChatSessionMount = lazy(loadChatSessionMount);
const LazyDreamAppPage = lazy(loadDreamAppPage);
const LazyWorldBookManager = lazy(loadWorldBookManager);
const LazySettingsAppScreen = lazy(loadSettingsAppScreen);
const CHAT_DOMAIN_PERSIST_DEBOUNCE_MS = 600;

function DeferredMomentsApp({
  appData,
  setAppData,
  settings,
}: {
  appData: AppData;
  setAppData: Dispatch<SetStateAction<AppData>>;
  settings: AppSettings;
}) {
  return (
    <Suspense fallback={null}>
      <LazyMomentsApp appData={appData} setAppData={setAppData} settings={settings} />
    </Suspense>
  );
}

function isChatSessionApp(activeApp: AppScreen) {
  return activeApp === 'chat-session' || activeApp === 'group-chat-session';
}

const CHAT_DETAIL_SCREENS: AppScreen[] = [
  'character-profile',
  'character-moments',
  'add-character',
];

function isRetainedChatDetailScreen(activeApp: AppScreen): activeApp is (typeof CHAT_DETAIL_SCREENS)[number] {
  return CHAT_DETAIL_SCREENS.includes(activeApp as (typeof CHAT_DETAIL_SCREENS)[number]);
}

function preloadPredictedAppTarget(app: AppScreen): Promise<unknown> | null {
  switch (app) {
    case 'chat':
      return null;
    case 'chat-session':
    case 'group-chat-session':
      return loadChatSessionMount();
    case 'dream':
      return loadDreamAppPage();
    case 'settings':
      return loadSettingsAppScreen();
    case 'worldbook':
      return loadWorldBookManager();
    case 'monitor':
    case 'customization':
    case 'couple-space':
    case 'perception':
    case 'music':
    case 'forum':
    case 'wallet':
      return preloadPanelForApp(app);
    default:
      return null;
  }
}

function getNormalizedForumData(forumData: AppData['forumData']) {
  return {
    ...(forumData || {}),
    posts: forumData?.posts || [],
    notifications: forumData?.notifications || [],
    followedUsers: forumData?.followedUsers || [],
    followerMap: forumData?.followerMap || {},
    tempChats: forumData?.tempChats || {},
    runtimeAuthorProfiles: forumData?.runtimeAuthorProfiles || {},
  };
}

function applyForumFriendAcceptanceSettlement(
  characters: Character[],
  input: {
    characterId: string;
    actorName: string;
    content: string;
    timestamp: number;
  },
) {
  const settlementInputs: PersistSceneSettlementInput[] = [];

  const nextCharacters = characters.map((character) => {
    if (!character || character.id !== input.characterId) {
      return character;
    }

    const settlement = buildForumSharedSettlement(character, {
      kind: 'friend_request_accepted',
      actorName: input.actorName,
      content: input.content,
      timestamp: input.timestamp,
    });
    settlementInputs.push({
      characterId: character.id,
      sourceScene: 'forum',
      settlement,
      timestamp: input.timestamp,
    });

    return {
      ...character,
      ...buildSceneSettlementCharacterPatch(settlement),
    };
  });

  return {
    nextCharacters,
    settlementInputs,
  };
}

function resolveDueOutgoingForumFriendRequests(appData: AppData, now = Date.now()) {
  const forumData = getNormalizedForumData(appData.forumData);
  const pendingOutgoingRequests = (appData.friendRequests || []).filter((request) => (
    request.sourceScene === 'forum'
    && request.status === 'pending'
    && (request.direction === 'outgoing' || request.initiator === 'user')
    && request.autoResolveKind === 'forum_outgoing_request'
    && typeof request.autoResolveAt === 'number'
  ));

  const dueRequests = pendingOutgoingRequests.filter((request) => (request.autoResolveAt || 0) <= now);
  const nextDueAt = pendingOutgoingRequests
    .map((request) => request.autoResolveAt)
    .filter((value): value is number => typeof value === 'number' && value > now)
    .sort((left, right) => left - right)[0] || null;

  if (dueRequests.length === 0) {
    return {
      changed: false,
      nextDueAt,
    };
  }

  let nextCharacters = appData.characters;
  let nextChatHistory = appData.chatHistory;
  let nextTempChats = { ...forumData.tempChats };
  const resolvedRequestIds = new Set<string>();
  const settlementInputs: PersistSceneSettlementInput[] = [];

  dueRequests.forEach((request) => {
    const authorId = request.fromUserId;
    const currentSession = nextTempChats[authorId] || createEmptyForumTempChatSession(authorId, now);
    const relatedPost = request.sourcePostId
      ? forumData.posts.find((post) => post.id === request.sourcePostId) || null
      : forumData.posts
          .filter((post) => post.authorId === authorId || post.comments.some((comment) => comment.authorId === authorId))
          .sort((left, right) => right.timestamp - left.timestamp)[0] || null;

    const resolution = resolveOutgoingForumFriendRequest({
      author: {
        id: authorId,
        name: request.fromUserName,
        handle: request.forumHandle,
        bio: request.forumBio,
        persona: request.forumPersona,
      },
      session: currentSession,
      relatedPost,
      currentUserId: appData.userProfile.id,
      followedUsers: forumData.followedUsers,
      followerMap: forumData.followerMap,
      now,
    });

    const resolvedSession = appendForumFriendResolutionMessage(
      markForumFriendRequestResolved(currentSession, resolution.accepted ? 'accepted' : 'rejected', now),
      resolution.responseText,
      now,
    );
    nextTempChats[authorId] = resolvedSession;
    resolvedRequestIds.add(request.id);

    if (resolution.accepted) {
      const bridged = bridgeForumFriendToFormalChat({
        appData: {
          ...appData,
          characters: nextCharacters,
          chatHistory: nextChatHistory,
        } as any,
        author: {
          id: authorId,
          name: request.fromUserName,
          avatar: request.fromUserAvatar,
          handle: request.forumHandle,
          bio: request.forumBio,
          persona: request.forumPersona,
        },
        session: resolvedSession,
        now,
      });

      const acceptanceResult = applyForumFriendAcceptanceSettlement(bridged.nextCharacters, {
        characterId: authorId,
        actorName: request.fromUserName,
        content: resolution.responseText,
        timestamp: now,
      });
      nextCharacters = acceptanceResult.nextCharacters;
      settlementInputs.push(...acceptanceResult.settlementInputs);
      nextChatHistory = bridged.nextChatHistory as ChatHistory;
      nextTempChats[authorId] = bridged.nextTempSession;
    }
  });

  return {
    changed: true,
    nextDueAt,
    nextAppData: {
      ...appData,
      characters: nextCharacters,
      chatHistory: nextChatHistory,
      friendRequests: (appData.friendRequests || []).map((request) => (
        !resolvedRequestIds.has(request.id)
          ? request
          : {
              ...request,
              status: dueRequests.find((item) => item.id === request.id) ? (
                nextTempChats[request.fromUserId]?.addedAsFriend ? 'accepted' : 'rejected'
              ) : request.status,
              resolutionMessage: nextTempChats[request.fromUserId]?.addedAsFriend
                ? '对方通过了你的申请'
                : '对方暂时没有通过你的申请',
              responseText: nextTempChats[request.fromUserId]?.messages[nextTempChats[request.fromUserId].messages.length - 1]?.text || request.responseText,
              autoResolveAt: undefined,
              autoResolveKind: undefined,
              lastUpdatedAt: now,
            }
      )),
      forumData: {
        ...appData.forumData,
        ...forumData,
        tempChats: nextTempChats,
      },
    },
    nextCharacters,
    settlementInputs,
  };
}

type AppScreenContentProps = {
  activeApp: AppScreen;
  activeConfig: AppSettings['configs'][number];
  activeTab: AppTab;
  appData: AppData;
  audioRef: RefObject<HTMLAudioElement | null>;
  characterMomentsBackApp: CharacterMomentsBackApp;
  couplePartnerCharacter: Character;
  coupleSpaceState?: CoupleSpaceState;
  coupleSpaceUpdateToast: CoupleSpaceUpdateToast | null;
  currentCoupleSpace: CoupleSpaceData;
  datingGenerationToast: DatingGenerationToast | null;
  datingResumeSignal: number;
  dreamGenerationToast: DreamGenerationToast | null;
  dreamResumeSignal: number;
  handleAcceptCoupleSpaceInvite: (partnerId: string) => void;
  handleAddCharacter: (character: Character) => void;
  handleMergeCharacter: (character: Character) => void;
  handleOpenApp: (app: AppScreen) => void;
  handleOpenChat: (characterId: string) => void;
  handlePatchCharacterById: (characterId: string, patch: Partial<Character>) => void;
  handleUpdateCurrentCoupleSpace: (updates: any) => void;
  handleUpsertCharacter: (character: Character) => void;
  momentPublishToast: MomentPublishToast | null;
  selectedCharacter: Character | null;
  selectedCharacterId: string | null;
  selectedForumPostId: string | null;
  selectedGroupId: string | null;
  isStorageReady: boolean;
  setActiveApp: Dispatch<SetStateAction<AppScreen>>;
  setActiveTab: Dispatch<SetStateAction<AppTab>>;
  setAppData: Dispatch<SetStateAction<AppData>>;
  setCharacterMomentsBackApp: Dispatch<SetStateAction<CharacterMomentsBackApp>>;
  setCoupleSpaceUpdateToast: Dispatch<SetStateAction<CoupleSpaceUpdateToast | null>>;
  setMomentPublishToast: Dispatch<SetStateAction<MomentPublishToast | null>>;
  setSelectedCharacterId: Dispatch<SetStateAction<string | null>>;
  setSelectedForumPostId: Dispatch<SetStateAction<string | null>>;
  setSelectedGroupId: Dispatch<SetStateAction<string | null>>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  setStatusBarVisible: Dispatch<SetStateAction<boolean>>;
  settings: AppSettings;
  onOpenReadyDating: (characterId: string) => void;
  onDismissDatingToast: () => void;
  onOpenReadyDream: () => void;
  onDismissDreamToast: () => void;
  onDreamResumeHandled: () => void;
  openCoupleSpaceApp: () => void;
  openForumApp: (postId?: string | null) => void;
};

export function AppScreenContent({
  activeApp,
  activeConfig,
  activeTab,
  appData,
  audioRef,
  characterMomentsBackApp,
  couplePartnerCharacter,
  coupleSpaceState,
  coupleSpaceUpdateToast,
  currentCoupleSpace,
  datingGenerationToast,
  datingResumeSignal,
  dreamGenerationToast,
  dreamResumeSignal,
  handleAcceptCoupleSpaceInvite,
  handleAddCharacter,
  handleMergeCharacter,
  handleOpenApp,
  handleOpenChat,
  handlePatchCharacterById,
  handleUpdateCurrentCoupleSpace,
  handleUpsertCharacter,
  momentPublishToast,
  selectedCharacter,
  selectedCharacterId,
  selectedForumPostId,
  selectedGroupId,
  isStorageReady,
  setActiveApp,
  setActiveTab,
  setAppData,
  setCharacterMomentsBackApp,
  setCoupleSpaceUpdateToast,
  setMomentPublishToast,
  setSelectedCharacterId,
  setSelectedForumPostId,
  setSelectedGroupId,
  setSettings,
  setStatusBarVisible,
  settings,
  onOpenReadyDating,
  onDismissDatingToast,
  onOpenReadyDream,
  onDismissDreamToast,
  onDreamResumeHandled,
  openCoupleSpaceApp,
  openForumApp,
}: AppScreenContentProps) {
  const [hasActivatedChatApp, setHasActivatedChatApp] = useState(activeApp === 'chat');
  const [hasActivatedChatSessions, setHasActivatedChatSessions] = useState(() => isChatSessionApp(activeApp));
  const [mountedChatDetailScreens, setMountedChatDetailScreens] = useState<AppScreen[]>(() => (
    isRetainedChatDetailScreen(activeApp) ? [activeApp] : []
  ));
  const [contactsRelationshipThreadKey, setContactsRelationshipThreadKey] = useState<string | null>(null);
  const preloadedPredictedTargetsRef = useRef<Set<AppScreen>>(new Set());
  const latestCharactersRef = useRef(appData.characters);
  const latestDirectHistoryRef = useRef<ChatHistory>(appData.chatHistory);
  const latestChatGroupsRef = useRef(appData.chatGroups || []);
  const latestGroupsRef = useRef(appData.groups);
  const latestFriendRequestsRef = useRef(appData.friendRequests || []);
  const latestDirectRelationshipWavesRef = useRef(extractDirectRelationshipWaves(appData.chatHistory));
  const latestDirectFactTracesRef = useRef(extractDirectFactTraces(appData.chatHistory));
  const latestGroupSessionsRef = useRef(extractGroupSessions(appData.chatGroups || []));
  const latestDirectSessionMetadataSignatureRef = useRef(
    JSON.stringify(extractDirectSessionMetadata(appData.characters, appData.chatHistory)),
  );
  const pendingImmediateDirectHistoryRef = useRef<ChatHistory | null>(null);
  const pendingImmediateChatGroupsRef = useRef<typeof latestChatGroupsRef.current | null>(null);
  const pendingChatDomainFlushTimerRef = useRef<number | null>(null);
  const screenRootBackgroundClass =
    activeApp === 'home' || activeApp === 'dream'
      ? 'bg-transparent'
      : 'bg-zinc-50';
  const shouldRenderChatApp = hasActivatedChatApp || activeApp === 'chat';
  const shouldRenderChatSessions = hasActivatedChatSessions || isChatSessionApp(activeApp);
  const shouldRenderCharacterProfile =
    selectedCharacter != null
    && (mountedChatDetailScreens.includes('character-profile') || activeApp === 'character-profile');
  const shouldRenderCharacterMoments =
    selectedCharacter != null
    && (mountedChatDetailScreens.includes('character-moments') || activeApp === 'character-moments');
  const shouldRenderAddCharacter =
    mountedChatDetailScreens.includes('add-character') || activeApp === 'add-character';
  const transitionToApp = (nextApp: AppScreen, options?: Parameters<typeof navigateToAppWithTransition>[2]) => {
    void navigateToAppWithTransition(nextApp, setActiveApp, options);
  };
  const openDirectChatSession = (characterId: string) => {
    setSelectedCharacterId(characterId);
    transitionToApp('chat-session', { awaitPreload: true });
  };
  const openGroupChatSession = (groupId: string) => {
    setSelectedGroupId(groupId);
    transitionToApp('group-chat-session', { awaitPreload: true });
  };
  const forumConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'forum',
  }).runtimeConfig;
  const relationshipFlowRuntime = {
    appData,
    settings,
    setAppData,
    coupleSpace: currentCoupleSpace,
    persistCharacters: saveCharacters,
  };
  const clearPendingChatDomainFlush = useCallback(() => {
    if (pendingChatDomainFlushTimerRef.current === null) {
      return;
    }

    if (typeof window !== 'undefined') {
      window.clearTimeout(pendingChatDomainFlushTimerRef.current);
    }
    pendingChatDomainFlushTimerRef.current = null;
  }, []);
  const saveCombinedChatHistorySnapshot = useCallback(() => (
    saveChatHistoryRecords({
      directHistory: latestDirectHistoryRef.current,
      directSessionMetadata: extractDirectSessionMetadata(
        latestCharactersRef.current,
        latestDirectHistoryRef.current,
      ),
      directRelationshipWaves: latestDirectRelationshipWavesRef.current,
      directFactTraces: latestDirectFactTracesRef.current,
      groupSessions: latestGroupSessionsRef.current,
    })
  ), []);
  const persistChatOrganizationSnapshot = useCallback((input?: {
    groups?: string[];
    chatGroups?: typeof latestChatGroupsRef.current;
  }) => {
    const groups = input?.groups ?? latestGroupsRef.current;
    const chatGroups = input?.chatGroups ?? latestChatGroupsRef.current;
    latestGroupsRef.current = groups;
    latestChatGroupsRef.current = chatGroups;
    return persistChatOrganization({
      groups,
      chatGroups,
    });
  }, []);
  const persistFriendRequestsSnapshot = useCallback((friendRequests = latestFriendRequestsRef.current) => {
    latestFriendRequestsRef.current = friendRequests;
    return persistFriendRequests(friendRequests);
  }, []);
  const flushCurrentChatDomainSnapshot = useCallback(() => {
    clearPendingChatDomainFlush();
    latestDirectRelationshipWavesRef.current = extractDirectRelationshipWaves(latestDirectHistoryRef.current);
    latestDirectFactTracesRef.current = extractDirectFactTraces(latestDirectHistoryRef.current);
    latestGroupSessionsRef.current = extractGroupSessions(latestChatGroupsRef.current);
    void saveCombinedChatHistorySnapshot();
    void persistChatOrganizationSnapshot();
    void persistFriendRequestsSnapshot();
  }, [
    clearPendingChatDomainFlush,
    persistChatOrganizationSnapshot,
    persistFriendRequestsSnapshot,
    saveCombinedChatHistorySnapshot,
  ]);
  const scheduleChatDomainSnapshotFlush = useCallback(() => {
    if (!isStorageReady || typeof window === 'undefined') {
      return;
    }

    clearPendingChatDomainFlush();
    pendingChatDomainFlushTimerRef.current = window.setTimeout(() => {
      pendingChatDomainFlushTimerRef.current = null;
      flushCurrentChatDomainSnapshot();
    }, CHAT_DOMAIN_PERSIST_DEBOUNCE_MS);
  }, [
    clearPendingChatDomainFlush,
    flushCurrentChatDomainSnapshot,
    isStorageReady,
  ]);
  const setDirectChatHistory = useCallback((chatHistory: SetStateAction<ChatHistory>) => {
    const nextChatHistory = typeof chatHistory === 'function'
      ? chatHistory(latestDirectHistoryRef.current)
      : chatHistory;

    latestDirectHistoryRef.current = nextChatHistory;
    pendingImmediateDirectHistoryRef.current = nextChatHistory;

    if (isStorageReady) {
      scheduleChatDomainSnapshotFlush();
    }

    setAppData((prev) => (
      prev.chatHistory === nextChatHistory
        ? prev
        : {
            ...prev,
            chatHistory: nextChatHistory,
          }
    ));
  }, [isStorageReady, scheduleChatDomainSnapshotFlush, setAppData]);
  const setPersistedChatGroups = useCallback((chatGroupsOrUpdater: SetStateAction<typeof latestChatGroupsRef.current>) => {
    const resolvedChatGroups =
      typeof chatGroupsOrUpdater === 'function'
        ? chatGroupsOrUpdater(latestChatGroupsRef.current)
        : chatGroupsOrUpdater;
    const nextChatGroups = sanitizeChatGroupsWithCharactersFromStore(
      resolvedChatGroups,
      latestCharactersRef.current,
    );

    latestChatGroupsRef.current = nextChatGroups;
    pendingImmediateChatGroupsRef.current = nextChatGroups;

    if (isStorageReady) {
      scheduleChatDomainSnapshotFlush();
    }

    setAppData((prev) => (
      prev.chatGroups === nextChatGroups
        ? prev
        : {
            ...prev,
            chatGroups: nextChatGroups,
          }
    ));
  }, [isStorageReady, scheduleChatDomainSnapshotFlush, setAppData]);
  const setPersistedFriendRequests = useCallback((friendRequestsOrUpdater: SetStateAction<typeof latestFriendRequestsRef.current>) => {
    const nextFriendRequests =
      typeof friendRequestsOrUpdater === 'function'
        ? friendRequestsOrUpdater(latestFriendRequestsRef.current)
        : friendRequestsOrUpdater;

    latestFriendRequestsRef.current = nextFriendRequests;

    if (isStorageReady) {
      scheduleChatDomainSnapshotFlush();
    }

    setAppData((prev) => (
      prev.friendRequests === nextFriendRequests
        ? prev
        : {
            ...prev,
            friendRequests: nextFriendRequests,
          }
    ));
  }, [isStorageReady, scheduleChatDomainSnapshotFlush, setAppData]);

  useEffect(() => {
    latestCharactersRef.current = appData.characters;
    latestDirectHistoryRef.current = appData.chatHistory;
    latestChatGroupsRef.current = appData.chatGroups || [];
    latestGroupsRef.current = appData.groups;
    latestFriendRequestsRef.current = appData.friendRequests || [];
  }, [appData.characters, appData.chatGroups, appData.chatHistory, appData.friendRequests, appData.groups]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    const nextSignature = JSON.stringify(
      extractDirectSessionMetadata(appData.characters, appData.chatHistory),
    );
    if (nextSignature === latestDirectSessionMetadataSignatureRef.current) {
      return;
    }

    latestDirectSessionMetadataSignatureRef.current = nextSignature;
    scheduleChatDomainSnapshotFlush();
  }, [
    appData.characters,
    appData.chatHistory,
    isStorageReady,
    scheduleChatDomainSnapshotFlush,
  ]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    if (pendingImmediateDirectHistoryRef.current === appData.chatHistory) {
      pendingImmediateDirectHistoryRef.current = null;
      return;
    }

    scheduleChatDomainSnapshotFlush();
  }, [
    appData.chatHistory,
    isStorageReady,
    scheduleChatDomainSnapshotFlush,
  ]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    const nextChatGroups = appData.chatGroups || [];
    if (pendingImmediateChatGroupsRef.current === nextChatGroups) {
      pendingImmediateChatGroupsRef.current = null;
      return;
    }

    scheduleChatDomainSnapshotFlush();
  }, [
    appData.chatGroups,
    isStorageReady,
    scheduleChatDomainSnapshotFlush,
  ]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    void persistChatOrganizationSnapshot({ groups: appData.groups });
  }, [appData.groups, isStorageReady, persistChatOrganizationSnapshot]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    scheduleChatDomainSnapshotFlush();
  }, [appData.friendRequests, isStorageReady, scheduleChatDomainSnapshotFlush]);

  useEffect(() => {
    const friendRequests = appData.friendRequests || [];
    const releasedRequests = releaseDueFriendRequests(friendRequests, Date.now());
    if (releasedRequests !== friendRequests) {
      setPersistedFriendRequests(releasedRequests);
      return;
    }

    const nextReleaseAt = getNextFriendRequestReleaseAt(friendRequests, Date.now());
    if (!nextReleaseAt || typeof window === 'undefined') {
      return;
    }

    const timerId = window.setTimeout(() => {
      setPersistedFriendRequests((prev) => releaseDueFriendRequests(prev, Date.now()));
    }, Math.max(0, nextReleaseAt - Date.now()));

    return () => {
      window.clearTimeout(timerId);
    };
  }, [appData.friendRequests, setPersistedFriendRequests]);

  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const commitDueOutgoingForumFriendRequests = async (currentAppData: AppData) => {
      const resolution = resolveDueOutgoingForumFriendRequests(currentAppData, Date.now());
      if (!resolution.changed || !resolution.nextAppData) {
        return resolution;
      }

      try {
        if (resolution.settlementInputs?.length) {
          await persistSceneSettlementBatch(resolution.settlementInputs);
        }
        if (!cancelled && resolution.nextCharacters && resolution.nextCharacters !== currentAppData.characters) {
          await saveCharacters(resolution.nextCharacters);
        }
        if (!cancelled) {
          setAppData(resolution.nextAppData);
        }
      } catch (error) {
        console.error('[app-screen-content] Failed to persist due forum acceptance settlements', error);
      }

      return resolution;
    };

    void commitDueOutgoingForumFriendRequests(appData).then((resolution) => {
      if (!resolution?.nextDueAt || typeof window === 'undefined' || cancelled) {
        return;
      }

      timerId = window.setTimeout(() => {
        void commitDueOutgoingForumFriendRequests(appData);
      }, Math.max(0, resolution.nextDueAt - Date.now()));
    });

    return () => {
      cancelled = true;
      if (timerId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timerId);
      }
    };
  }, [appData, setAppData]);

  useEffect(() => () => {
    clearPendingChatDomainFlush();
  }, [clearPendingChatDomainFlush]);

  useEffect(() => {
    if (!isStorageReady || typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushCurrentChatDomainSnapshot();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushCurrentChatDomainSnapshot);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushCurrentChatDomainSnapshot);
    };
  }, [flushCurrentChatDomainSnapshot, isStorageReady]);
  const handleDeleteCharacterFromProfile = () => {
    if (!selectedCharacterId) {
      return;
    }

    const characterId = selectedCharacterId;
    setAppData((prev) => {
      const nextCharacters = removeCharacterById(prev.characters, characterId);
      const { [characterId]: _removedHistory, ...nextChatHistory } = prev.chatHistory;
      const nextFriendRequests = (prev.friendRequests || []).filter((request) => {
        const requestCharacterId = request.characterId || (request.sourceScene !== 'forum' ? request.fromUserId : undefined);
        return requestCharacterId !== characterId;
      });
      const nextChatGroups = sanitizeChatGroupsWithCharactersFromStore(
        (prev.chatGroups || [])
          .map((group) => ({
            ...group,
            memberIds: group.memberIds.filter((memberId) => memberId !== characterId),
          }))
          .filter((group) => group.memberIds.length > 0),
        nextCharacters,
      );
      void saveCharacters(nextCharacters);

      return {
        ...prev,
        characters: nextCharacters,
        chatHistory: nextChatHistory,
        friendRequests: nextFriendRequests,
        chatGroups: nextChatGroups,
      };
    });
    setSelectedCharacterId(null);
    transitionToApp('chat');
  };
  const handleToggleCharacterBlock = (
    characterId: string,
    targetCharacterOverride?: Character | null,
  ) => {
    runRelationshipBlockToggleFlow({
      runtime: relationshipFlowRuntime,
      characterId,
      targetCharacter: targetCharacterOverride,
    });
  };
  const handleToggleCharacterBlockFromProfile = () => {
    if (!selectedCharacterId || !selectedCharacter) {
      return;
    }

    handleToggleCharacterBlock(selectedCharacterId, selectedCharacter);
  };
  const handleSubmitCharacterFriendRequest = (message: string) => {
    if (!selectedCharacterId || !selectedCharacter) {
      return;
    }
    const started = runRelationshipRequestSubmissionFlow({
      runtime: relationshipFlowRuntime,
      characterId: selectedCharacterId,
      targetCharacter: selectedCharacter,
      message,
    });
    if (!started) {
      alert('这条关系线程的申请次数已经到上限了。');
    }
  };
  const appendLikeToMoment = (momentId: string, likerId: string) => {
    setAppData((prev) => ({
      ...prev,
      moments: (prev.moments || []).map((moment) => {
        if (moment.id !== momentId) return moment;
        const likedBy = moment.likedBy || [];
        if (likedBy.includes(likerId)) return moment;
        const nextLikedBy = [...likedBy, likerId];
        return {
          ...moment,
          likedBy: nextLikedBy,
          likes: nextLikedBy.length,
        };
      }),
    }));
  };

  const appendCommentToMoment = (momentId: string, comment: import('../../types').MomentComment) => {
    setAppData((prev) => ({
      ...prev,
      characters: (() => {
        const targetMoment = (prev.moments || []).find((moment) => moment.id === momentId);
        if (!targetMoment) {
          return prev.characters;
        }
        return applyMomentInteractionGrowth({
          characters: prev.characters,
          moment: {
            ...targetMoment,
            comments: [...targetMoment.comments, comment],
          },
          newComment: comment,
          chatGroups: prev.chatGroups || [],
        });
      })(),
      moments: (prev.moments || []).map((moment) => (
        moment.id === momentId
          ? { ...moment, comments: [...moment.comments, comment] }
          : moment
      )),
    }));
  };

  useEffect(() => {
    if (activeApp === 'chat') {
      setHasActivatedChatApp(true);
    }

    if (isRetainedChatDetailScreen(activeApp)) {
      setMountedChatDetailScreens((current) => (
        current.includes(activeApp) ? current : [...current, activeApp]
      ));
    }
  }, [activeApp]);

  useEffect(() => {
    if (activeApp === 'chat') {
      void preloadPredictedAppTarget('chat-session');
      void loadMomentsApp();
    }

    if (isChatSessionApp(activeApp)) {
      setHasActivatedChatSessions(true);
      void loadChatSessionMount();
    }
  }, [activeApp]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)')
      : null;
    const isDesktop = media?.matches ?? false;
    const standaloneMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null;
    const isStandalone =
      (standaloneMedia?.matches ?? false)
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.includes('android');

    if (activeApp === 'home' && isAndroid && !isStandalone && !isDesktop) {
      return undefined;
    }

    const maxTargets = isDesktop ? 3 : isStandalone ? 2 : isAndroid ? 1 : 2;
    const boostedTargets: AppScreen[] = [
      ...(activeApp === 'chat' ? (['chat-session'] as AppScreen[]) : []),
      ...(activeApp === 'chat-session' ? (['dream', 'forum'] as AppScreen[]) : []),
      ...(activeApp === 'couple-space' ? (['perception'] as AppScreen[]) : []),
      ...getPredictedNextApps(activeApp, maxTargets + 2),
    ];

    const targetApps = Array.from(new Set(boostedTargets))
      .filter((app) => app !== activeApp)
      .filter((app) => !preloadedPredictedTargetsRef.current.has(app))
      .slice(0, maxTargets);

    if (targetApps.length === 0) {
      return undefined;
    }

    const initialDelay = activeApp === 'chat'
      ? 220
      : activeApp === 'chat-session'
        ? 900
        : isDesktop
          ? 700
          : isStandalone
            ? 1100
            : 1500;
    const stepDelay = isDesktop ? 240 : 420;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let cancelled = false;
    let startTimerId: number | null = null;
    let nextTimerId: number | null = null;
    let idleHandle: number | null = null;

    const runSequentialPreload = async (index: number) => {
      if (cancelled || index >= targetApps.length) {
        return;
      }

      const targetApp = targetApps[index];
      const preloadTask = preloadPredictedAppTarget(targetApp);
      if (preloadTask) {
        try {
          await preloadTask;
          preloadedPredictedTargetsRef.current.add(targetApp);
        } catch (error) {
          console.warn('[app-shell] Contextual preload failed', { activeApp, targetApp, error });
        }
      }

      if (!cancelled && index + 1 < targetApps.length) {
        nextTimerId = window.setTimeout(() => {
          void runSequentialPreload(index + 1);
        }, stepDelay);
      }
    };

    const schedulePreloads = () => {
      startTimerId = window.setTimeout(() => {
        void runSequentialPreload(0);
      }, initialDelay);
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleHandle = idleWindow.requestIdleCallback(schedulePreloads, { timeout: initialDelay + 600 });
    } else {
      schedulePreloads();
    }

    return () => {
      cancelled = true;
      if (startTimerId !== null) {
        window.clearTimeout(startTimerId);
      }
      if (nextTimerId !== null) {
        window.clearTimeout(nextTimerId);
      }
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, [activeApp]);

  return (
    <div className={`phone-screen-root flex-1 relative overflow-hidden ${screenRootBackgroundClass}`}>
      {coupleSpaceUpdateToast && (
        <button
          type="button"
          onClick={() => {
            setAppData((prev) => {
              const switched = switchCurrentCoupleSpaceState(
                prev.coupleSpaceState,
                prev.coupleSpace,
                coupleSpaceUpdateToast.partnerId,
              );
              return {
                ...prev,
                coupleSpaceState: switched.coupleSpaceState,
                coupleSpace: switched.coupleSpace,
              };
            });
            openCoupleSpaceApp();
            setCoupleSpaceUpdateToast(null);
          }}
          className="absolute left-4 right-4 top-4 z-[70] rounded-3xl border border-white/70 bg-white/92 p-4 text-left shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-[#fff3f7]">
              {coupleSpaceUpdateToast.partnerAvatar ? (
                <ResolvedAssetImagePrimitive
                  value={coupleSpaceUpdateToast.partnerAvatar}
                  alt={coupleSpaceUpdateToast.partnerName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#d99ab5]">
                  <Heart size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-400">情侣空间</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800">
                {coupleSpaceUpdateToast.partnerName} 更新了{coupleSpaceUpdateToast.moduleLabel}
              </div>
              <div className="mt-1 text-xs text-zinc-500">点开看看这次的新内容</div>
            </div>
          </div>
        </button>
      )}
      {momentPublishToast && (
        <button
          type="button"
          onClick={() => {
            transitionToApp('chat');
            setActiveTab('moments');
            setMomentPublishToast(null);
          }}
          className={`absolute left-4 right-4 ${coupleSpaceUpdateToast ? 'top-[98px]' : 'top-4'} z-[69] rounded-3xl border border-white/70 bg-white/92 p-4 text-left shadow-lg backdrop-blur-md`}
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-[#fff3f7]">
              {momentPublishToast.authorAvatar ? (
                <ResolvedAssetImagePrimitive
                  value={momentPublishToast.authorAvatar}
                  alt={momentPublishToast.authorName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#d99ab5]">
                  <ImageIcon size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-400">消息提醒</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800">
                {momentPublishToast.authorName} 发了新动态
              </div>
              <div className="mt-1 truncate text-xs text-zinc-500">
                {momentPublishToast.preview || '点开看看这次的新内容'}
              </div>
            </div>
          </div>
        </button>
      )}
      {datingGenerationToast && (
        <div
          className={`absolute left-4 right-4 ${coupleSpaceUpdateToast ? (momentPublishToast ? 'top-[192px]' : 'top-[98px]') : momentPublishToast ? 'top-[98px]' : 'top-4'} z-[68] rounded-3xl border border-white/70 bg-white/92 p-4 text-left shadow-lg backdrop-blur-md`}
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-[#fff3f7]">
              {datingGenerationToast.characterAvatar ? (
                <ResolvedAssetImagePrimitive
                  value={datingGenerationToast.characterAvatar}
                  alt={datingGenerationToast.characterName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#d99ab5]">
                  <Heart size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-400">约会提醒</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800">
                {datingGenerationToast.characterName} 的约会有新进展
              </div>
              <div className="mt-1 truncate text-xs text-zinc-500">
                {datingGenerationToast.preview || '点开继续这次约会'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenReadyDating(datingGenerationToast.characterId)}
              className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200"
            >
              点开进入
            </button>
            <button
              type="button"
              onClick={onDismissDatingToast}
              className="rounded-full px-2 py-1 text-xs text-zinc-400"
            >
              稍后再看
            </button>
          </div>
        </div>
      )}
      {dreamGenerationToast && (
        <div
          className={`absolute left-4 right-4 ${coupleSpaceUpdateToast ? (momentPublishToast ? 'top-[192px]' : 'top-[98px]') : momentPublishToast ? 'top-[98px]' : 'top-4'} z-[68] rounded-3xl border border-white/70 bg-white/92 p-4 text-left shadow-lg backdrop-blur-md`}
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-[#f7f1e4]">
              {dreamGenerationToast.roleAvatar ? (
                <ResolvedAssetImagePrimitive
                  value={dreamGenerationToast.roleAvatar}
                  alt={dreamGenerationToast.roleName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#c69a6a]">
                  <Sparkles size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-400">梦境提醒</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800">
                {dreamGenerationToast.title || `${dreamGenerationToast.roleName} 的梦境已生成`}
              </div>
              <div className="mt-1 truncate text-xs text-zinc-500">
                {dreamGenerationToast.preview || '点开继续进入这场梦'}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenReadyDream}
              className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200"
            >
              点开进入
            </button>
            <button
              type="button"
              onClick={onDismissDreamToast}
              className="rounded-full px-2 py-1 text-xs text-zinc-400"
            >
              稍后再看
            </button>
          </div>
        </div>
      )}
      <div
        className={`absolute inset-0 ${activeApp === 'home' ? 'z-[1] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
        aria-hidden={activeApp === 'home' ? undefined : true}
      >
        <HomeScreen
          key="home"
          onOpenApp={handleOpenApp}
          userProfile={appData.userProfile}
          setUserProfile={(profile) => setAppData((prev) => ({ ...prev, userProfile: profile }))}
          visualSettings={appData.visualSettings}
          setVisualSettings={(s) => setAppData((prev) => ({ ...prev, visualSettings: s }))}
          appData={appData}
          setAppData={setAppData}
        />
      </div>
      {shouldRenderChatApp && (
        <div
          className={`absolute inset-0 ${activeApp === 'chat' ? 'z-[20] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
          aria-hidden={activeApp === 'chat' ? undefined : true}
        >
          <MainApp
            key="chat"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            appData={appData}
            setAppData={setAppData}
            onOpenChat={handleOpenChat}
            onOpenGroupChat={openGroupChatSession}
            onOpenProfile={(id) => {
              setSelectedCharacterId(id);
              transitionToApp('character-profile');
            }}
            defaultRelationshipThreadKey={contactsRelationshipThreadKey}
            onRelationshipThreadHandled={() => setContactsRelationshipThreadKey(null)}
            onAddCharacter={() => transitionToApp('add-character')}
            onBack={() => transitionToApp('home')}
            settings={settings}
            MomentsAppComponent={DeferredMomentsApp}
            formatMessagePreview={formatMessagePreview}
          />
        </div>
      )}
      {shouldRenderCharacterProfile && selectedCharacter && (
        <div
          className={`absolute inset-0 ${activeApp === 'character-profile' ? 'z-[30] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
          aria-hidden={activeApp === 'character-profile' ? undefined : true}
        >
          <CharacterProfile
            character={selectedCharacter}
            onBack={() => transitionToApp('chat')}
            onChat={() => openDirectChatSession(selectedCharacter.id)}
            onOpenMoments={() => {
              setCharacterMomentsBackApp('character-profile');
              transitionToApp('character-moments');
            }}
            onViewRelationshipThread={() => {
              setContactsRelationshipThreadKey(
                getLatestCharacterRelationshipPageKey(appData.friendRequests || [], selectedCharacter.id),
              );
              setActiveTab('contacts');
              transitionToApp('chat');
            }}
            groups={appData.groups}
            friendRequests={appData.friendRequests || []}
            onUpdateGroup={(groupId) => {
              if (!selectedCharacterId) return;
              handlePatchCharacterById(selectedCharacterId, { groupId });
            }}
            onTogglePin={() => {
              if (!selectedCharacterId || !selectedCharacter) return;
              handlePatchCharacterById(selectedCharacterId, { isPinned: !selectedCharacter.isPinned });
            }}
            onUpdateRemark={(remarkName) => {
              if (!selectedCharacterId) return;
              handlePatchCharacterById(selectedCharacterId, { remarkName });
            }}
            onDeleteCharacter={handleDeleteCharacterFromProfile}
            onToggleBlock={handleToggleCharacterBlockFromProfile}
            onSubmitFriendRequest={handleSubmitCharacterFriendRequest}
          />
        </div>
      )}
      {shouldRenderCharacterMoments && selectedCharacter && (
        <div
          className={`absolute inset-0 ${activeApp === 'character-moments' ? 'z-[30] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
          aria-hidden={activeApp === 'character-moments' ? undefined : true}
        >
          <CharacterMomentsProfile
            character={selectedCharacter}
            appData={appData}
            setAppData={setAppData}
            settings={settings}
            moments={appData.moments || []}
            onBack={() => transitionToApp(characterMomentsBackApp)}
          />
        </div>
      )}
      {shouldRenderChatSessions && (
        <Suspense
          fallback={null}
        >
          <LazyChatSessionMount
            activeApp={activeApp}
            selectedCharacterId={selectedCharacterId}
            selectedGroupId={selectedGroupId}
            characters={appData.characters}
            chatGroups={appData.chatGroups || []}
            setChatGroups={setPersistedChatGroups}
            chatHistory={appData.chatHistory}
            setChatHistory={setDirectChatHistory}
            settings={settings}
            setSettings={setSettings}
            userAvatar={appData.userProfile.avatar}
            userName={appData.userProfile.name}
            masks={appData.masks}
            favorites={appData.favorites}
            setFavorites={(f) => setAppData((prev) => ({ ...prev, favorites: f }))}
            visualSettings={appData.visualSettings}
            setVisualSettings={(visualSettings) => setAppData((prev) => ({ ...prev, visualSettings }))}
            groups={appData.groups}
            worldBook={appData.worldBooks || []}
            perception={appData.perception}
            coupleSpaceState={coupleSpaceState}
            coupleSpace={currentCoupleSpace}
            callHistory={appData.callHistory || []}
            setCallHistory={(callHistory) => setAppData((prev) => ({ ...prev, callHistory }))}
            savedDates={appData.savedDates || []}
            collectedDates={appData.collectedDates || []}
            datingResumeSignal={datingResumeSignal}
            setDatingRecords={({ savedDates, collectedDates }) =>
              setAppData((prev) => ({
                ...prev,
                savedDates,
                collectedDates,
              }))
            }
            walletData={appData.walletData}
            setWalletData={(data) => setAppData((prev) => ({ ...prev, walletData: data }))}
            updateCharacter={handleMergeCharacter}
            patchCharacter={handlePatchCharacterById}
            setFriendRequests={setPersistedFriendRequests}
            onToggleCharacterBlock={handleToggleCharacterBlock}
            onBackToChat={() => transitionToApp('chat')}
            onOpenCharacterProfile={(characterId) => {
              setSelectedCharacterId(characterId);
              transitionToApp('character-profile');
            }}
            onViewForumPost={(postId) => {
              openForumApp(postId);
            }}
            onPublishMoment={({ authorId, content, translation, images, imageCard, isCollected, sourceChatMessage }) => {
              const author = appData.characters.find((character) => character.id === authorId) || null;
              const newMomentId = Date.now().toString();
              const newMoment = {
                id: newMomentId,
                authorId,
                visibilityScope: getDefaultMomentVisibilityScope(authorId),
                content,
                ...(translation ? { translation } : {}),
                images,
                imageCard,
                sourceChatMessage,
                timestamp: Date.now(),
                likes: 0,
                comments: [],
                ...(isCollected ? { isCollected: true } : {}),
              };
              console.info('[moment-special] onPublishMoment called', {
                authorId,
                content,
                imagesCount: images?.length || 0,
                hasImageCard: !!imageCard,
              });
              setAppData((prev) => ({
                ...(console.info('[moment-special] moments latest', {
                  length: (prev.moments?.length || 0) + 1,
                  latestContent: content,
                }), prev),
                characters: prev.characters.map((character) => {
                  if (!author || character.id !== authorId) {
                    return character;
                  }

                  return {
                    ...character,
                    sharedState: buildSharedStateWritePatch({
                      character,
                      sourceScene: 'moments',
                      publicSummaries: [`鍒氬垰鍙戜簡涓€鏉″叕寮€鍔ㄦ€侊細${content.slice(0, 72)}`],
                    }),
                  };
                }),
                moments: [newMoment, ...(prev.moments || [])],
              }));

              const chatGroups = appData.chatGroups || [];
              const shuffledCharacters = [...appData.characters]
                .filter((character) => character.id !== authorId)
                .sort(() => Math.random() - 0.5);
              const commentEligibleIds = new Set(
                shuffledCharacters
                  .filter((character) => canCharacterAutoCommentOnMoment({
                    actor: character,
                    moment: newMoment,
                    characters: appData.characters,
                    chatGroups,
                  }))
                  .map((character) => character.id),
              );
              const autoLikerIds = shuffledCharacters
                .filter((character) => {
                  if (!canCharacterAutoLikeMoment({
                    actor: character,
                    moment: newMoment,
                    characters: appData.characters,
                    chatGroups,
                  })) {
                    return false;
                  }

                  const likeChance = commentEligibleIds.has(character.id) ? 0.75 : 0.4;
                  return Math.random() < likeChance;
                })
                .map((character) => character.id)
                .slice(0, Math.min(shuffledCharacters.length, 3));

              if (autoLikerIds.length > 0) {
                void (async () => {
                  for (const likerId of autoLikerIds) {
                    await new Promise((resolve) => setTimeout(resolve, 150 + Math.floor(Math.random() * 500)));
                    appendLikeToMoment(newMomentId, likerId);
                  }
                })();
              }

              if (forumConfig && commentEligibleIds.size > 0) {
                void runMomentPublishCommentSequence({
                  activeConfig: forumConfig,
                  moment: newMoment,
                  characters: appData.characters,
                  chatGroups,
                  userName: appData.userProfile.name,
                  appendComment: (comment) => appendCommentToMoment(newMomentId, comment),
                });
              }

              if (author) {
                setMomentPublishToast({
                  id: `${authorId}-${Date.now()}`,
                  authorId,
                  authorName: author.name,
                  authorAvatar: author.avatar,
                  preview: content.slice(0, 26),
                });
              }
            }}
            onOpenCharacterMoments={() => {
              setCharacterMomentsBackApp('chat-session');
              transitionToApp('character-moments');
            }}
            onStatusBarVisibilityChange={setStatusBarVisible}
            onAcceptCoupleSpaceInvite={handleAcceptCoupleSpaceInvite}
            friendRequests={appData.friendRequests || []}
          />
        </Suspense>
      )}
      {shouldRenderAddCharacter && (
        <div
          className={`absolute inset-0 ${activeApp === 'add-character' ? 'z-[30] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
          aria-hidden={activeApp === 'add-character' ? undefined : true}
        >
          <AddCharacterSheet
            key="add-character"
            onSave={handleAddCharacter}
            onBack={() => transitionToApp('chat')}
            groups={appData.groups}
          />
        </div>
      )}
      {activeApp === 'settings' && (
        <Suspense fallback={null}>
          <LazySettingsAppScreen
            key="settings"
            onBack={() => transitionToApp('home')}
            settings={settings}
            defaultConfig={DEFAULT_CONFIG}
            setSettings={setSettings}
            characters={appData.characters}
          />
        </Suspense>
      )}
      {activeApp === 'dream' && (
        <Suspense fallback={null}>
          <LazyDreamAppPage
            key="dream"
            onBack={() => transitionToApp('home')}
            characters={appData.characters}
            userName={appData.userProfile.name}
            activeConfig={activeConfig}
            masks={appData.masks || []}
            worldBooks={appData.worldBooks || []}
            resumeBackgroundSignal={dreamResumeSignal}
            onResumeBackgroundHandled={onDreamResumeHandled}
          />
        </Suspense>
      )}
      {activeApp === 'worldbook' && (
        <Suspense fallback={null}>
          <LazyWorldBookManager
            worldBooks={appData.worldBooks || []}
            characters={appData.characters}
            setWorldBooks={(wb) => setAppData((prev) => ({ ...prev, worldBooks: wb }))}
            onBack={() => transitionToApp('home')}
            globalBackground={appData.visualSettings?.globalBackground || ''}
            onAddCharacter={(char) => {
              const newChar: Character = {
                id: Date.now().toString(),
                ...char,
                lastTime: Date.now(),
              };
              handleUpsertCharacter(newChar);
            }}
          />
        </Suspense>
      )}
      {activeApp === 'monitor' && (
        <Suspense fallback={null}>
          <MonitorApp
            characters={appData.characters}
            onBack={() => transitionToApp('home')}
            visualSettings={appData.visualSettings}
          />
        </Suspense>
      )}
      {activeApp === 'customization' && (
        <Suspense fallback={null}>
          <CustomizationApp
            visualSettings={appData.visualSettings}
            setVisualSettings={(s) => setAppData((prev) => ({ ...prev, visualSettings: s }))}
            onBack={() => transitionToApp('home')}
            onResetData={handleCustomizationResetData}
            onExportData={() => handleCustomizationExportData(appData)}
            onImportData={(data) =>
              handleCustomizationImportData({
                data,
                defaultCharacters: DEFAULT_CHARACTERS,
                defaultZhouJibaiAvatar: DEFAULT_ZHOU_JIBAI_AVATAR,
                setAppData,
              })
            }
            appData={appData}
            setAppData={setAppData}
            settings={settings}
            setSettings={setSettings}
          />
        </Suspense>
      )}
      {activeApp === 'couple-space' && (
        <Suspense fallback={null}>
          <CoupleSpaceApp
            appData={appData}
            setAppData={setAppData}
            onBack={() => transitionToApp('home')}
            settings={settings}
          />
        </Suspense>
      )}
      {activeApp === 'perception' && (
        <Suspense fallback={null}>
          <PerceptionView
            perception={appData.perception}
            onChange={(perception) => setAppData((prev) => ({
              ...prev,
              perception,
              coupleSpaceState: prev.coupleSpaceState
                ? {
                    ...prev.coupleSpaceState,
                    sharedPerception: perception,
                  }
                : prev.coupleSpaceState,
            }))}
            onBack={() => transitionToApp('home')}
          />
        </Suspense>
      )}
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      {activeApp === 'music' && (
        <Suspense fallback={null}>
          <MusicApp
            musicData={appData.musicData!}
            onUpdateMusicData={(data) => setAppData((prev) => ({ ...prev, musicData: data }))}
            userAvatar={appData.userProfile.avatar}
            userName={appData.userProfile.name}
            character={couplePartnerCharacter}
            directChatHistory={appData.chatHistory}
            visualSettings={appData.visualSettings}
            settings={settings}
            onPatchCharacter={handlePatchCharacterById}
            allCharacters={appData.characters}
            worldBooks={appData.worldBooks || []}
            onBack={() => transitionToApp('home')}
            audioRef={audioRef}
          />
        </Suspense>
      )}
      {activeApp === 'forum' && (
        <Suspense fallback={null}>
          <ForumApp
            appData={appData}
            onUpdateAppData={(newData) => handleCustomizationUpdateAppData(newData, setAppData)}
            onClose={() => transitionToApp('home')}
            settings={settings}
            onOpenChat={openDirectChatSession}
            initialPostId={selectedForumPostId}
          />
        </Suspense>
      )}
      {activeApp === 'wallet' && (
        <Suspense fallback={null}>
          <WalletApp
            appData={appData}
            onUpdateAppData={(newData) => handleCustomizationUpdateAppData(newData, setAppData)}
            onClose={() => transitionToApp('home')}
          />
        </Suspense>
      )}
    </div>
  );
}
