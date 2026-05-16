import type {
  ApiConfig,
  AppData,
  Character,
  MomentComment,
  MomentImageCard,
  MomentSourceImageRef,
  MomentItem,
} from '../../types';
import { rebuildSharedStateFromCharacter } from '../relationship-context/buildSharedCharacterState';
import {
  buildSceneSettlementCharacterPatch,
  persistSceneSettlement,
} from '../memory/sceneSettlement';
import { runMomentPublishCommentSequence } from './commentOrchestrator';
import {
  type AutoMomentPlanEntry,
  buildAutoMomentPlan,
  loadLastAutoMomentCheckAt,
  saveLastAutoMomentCheckAt,
  type AutoMomentSchedulerTrigger,
} from './autoScheduler';
import {
  filterAutoMomentSceneUnlockedCharacters,
  getCharacterAutoMomentSceneGate,
} from './autoSceneGate';
import {
  analyzeRecentMomentVariety,
  buildRecentMomentShapeHints,
  buildRecentMomentVarietyPromptLines,
} from './momentRecentVariety';
import { buildMomentPublishedSettlement } from './buildMomentPublishedSettlement';
import { buildMomentExposureAwarenessPatches } from '../../features/group-settings/groupAwarenessPropagation';
import { generateMomentPostContent } from './generators';
import {
  canCharacterAutoCommentOnMoment,
  canCharacterAutoLikeMoment,
} from './publicThreadPolicy';
import { applyMomentInteractionGrowth } from './momentInteractionGrowth';
import { getDefaultMomentVisibilityScope } from './momentVisibilityScope';
import { extractRecentMomentImageReferences } from './momentRecentImageReferences';

export type AutoMomentRuntimeSnapshot = Pick<
  AppData,
  'characters' | 'moments' | 'masks' | 'worldBooks' | 'chatGroups' | 'userProfile' | 'chatHistory'
>;

export type GeneratedCharacterMomentPayload = {
  authorId: string;
  content: string;
  translation?: string;
  images?: string[];
  sourceImage?: MomentSourceImageRef;
  imageCard?: MomentImageCard;
};

export type GeneratedCharacterMomentToast = {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  preview: string;
};

type PublishGeneratedCharacterMomentToFeedOptions = {
  payload: GeneratedCharacterMomentPayload;
  snapshot: AutoMomentRuntimeSnapshot;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  forumConfig?: ApiConfig | null;
  onMomentPublished?: (toast: GeneratedCharacterMomentToast) => void;
};

type RunAutoMomentSchedulerPassOptions = {
  trigger: AutoMomentSchedulerTrigger;
  forumConfig?: ApiConfig | null;
  getSnapshot: () => AutoMomentRuntimeSnapshot;
  publishGeneratedCharacterMoment: (payload: GeneratedCharacterMomentPayload) => Promise<void>;
  executeTask?: (task: () => Promise<void>) => Promise<void>;
};

let autoMomentSchedulerRunning = false;
const SCENE_CARRYOVER_ONLY_SHAPES: NonNullable<AutoMomentPlanEntry['generationHints']>['allowedShapes'] = [
  'short_status',
  'tiny_complaint',
  'abstract_fragment',
  'soft_claim',
];
const GENERAL_MANUAL_REFRESH_SHAPES: NonNullable<AutoMomentPlanEntry['generationHints']>['allowedShapes'] = [
  'short_status',
  'cheerful_share',
  'tiny_complaint',
  'abstract_fragment',
  'soft_claim',
  'photo_dump',
];

function getLatestMomentTimestampByAuthor(characterId: string, moments: MomentItem[] = []) {
  return moments
    .filter((moment) => moment.authorId === characterId)
    .reduce((latest, moment) => Math.max(latest, moment.timestamp), 0);
}

function buildManualRefreshPlanEntry(options: {
  character: Character;
  sceneGate: ReturnType<typeof getCharacterAutoMomentSceneGate>;
  recentMoments?: MomentItem[];
}): AutoMomentPlanEntry {
  const { character, sceneGate, recentMoments = [] } = options;
  const sharedState = rebuildSharedStateFromCharacter({
    character,
  });
  const presenceState = character.presenceState;
  const activeDatingSummary = character.activeDatingState?.summary?.trim();
  const recentVariety = analyzeRecentMomentVariety(recentMoments);
  const varietySections = buildRecentMomentVarietyPromptLines(recentVariety);

  if (sceneGate.restriction === 'scene_carryover_only') {
    return {
      characterId: character.id,
      requestText: '自主发动态：手动刷新；意图=当前互动的公开余波；形态=纯文字短状态/短吐槽/抽象片段/轻微站位；主题=把此刻互动留下的后劲翻成一条公开可见、时间线一致的动态。',
      extraPromptSections: [
        sharedState?.currentActivity?.trim() ? `当前生活状态：${sharedState.currentActivity.trim()}` : '',
        presenceState?.recentLifeBeat?.trim() ? `最近生活节奏：${presenceState.recentLifeBeat.trim()}` : '',
        sharedState?.publicCarryover?.trim() ? `公开余波：${sharedState.publicCarryover.trim()}` : '',
        activeDatingSummary ? `当前进行中的互动：${activeDatingSummary}` : '',
        ...varietySections,
        '这是用户手动点击刷新后的强制刷新，但角色还在强互动中，或者刚从强互动场景里出来不久。',
        '只能发和当前场景兼容的公开余波：嘴硬、回温、小吃醋、小吐槽、短短一句、轻微站位、抽象情绪都可以。',
        '必须是纯文字动态，不要配图、不要截图感、不要九宫格、不要伪图片说明。',
        '不要突然切去上班、下班、公司、室友、宿舍、便利店、街拍或另一条新生活线，除非这些事实已经明确出现在当前状态里。',
        '不要泄露私聊细节，只保留公开可见的情绪后劲和状态感。',
        '不要返回空白，不要解释说明，不要重复上一条动态。',
      ].filter(Boolean),
      generationHints: buildRecentMomentShapeHints({
        baseAllowedShapes: SCENE_CARRYOVER_ONLY_SHAPES,
        recentVariety,
        preferTextOnly: true,
      }),
    };
  }

  return {
    characterId: character.id,
    requestText: '自主发动态：手动刷新；请立即生成一条新的公开动态。',
    extraPromptSections: [
      sharedState?.currentActivity?.trim() ? `当前生活状态：${sharedState.currentActivity.trim()}` : '',
      presenceState?.recentLifeBeat?.trim() ? `最近生活节奏：${presenceState.recentLifeBeat.trim()}` : '',
      sharedState?.publicCarryover?.trim() ? `公开余波：${sharedState.publicCarryover.trim()}` : '',
      ...varietySections,
      '这是用户手动点击刷新后的强制刷新，必须产出一条新的动态。',
      '优先写低风险、看得见的锚点：手机、桌面、镜子、窗外天气、衣服、耳机、饮料、房间角落、灯光、路灯、街景、身体状态。',
      '没有在当前状态或设定里出现的事实，不要临时补室友、同事、老板、家人、宠物或固定工作地点。',
      '不要返回空白，不要解释说明，不要重复上一条动态。',
    ].filter(Boolean),
    generationHints: buildRecentMomentShapeHints({
      baseAllowedShapes: GENERAL_MANUAL_REFRESH_SHAPES,
      recentVariety,
    }),
  };
}

function buildForcedManualRefreshEntry(
  snapshot: AutoMomentRuntimeSnapshot,
  options: {
    trigger: AutoMomentSchedulerTrigger;
    now: number;
  },
) {
  const rankedCharacters = [...(snapshot.characters || [])]
    .map((character) => ({
      character,
      sceneGate: getCharacterAutoMomentSceneGate({
        character,
        trigger: options.trigger,
        now: options.now,
      }),
    }))
    .filter(({ sceneGate }) => sceneGate.allowed)
    .map((character) => ({
      ...character,
      frequencyDisabled: (character.character.postFrequency || 'medium') === 'none',
      latestMomentAt: getLatestMomentTimestampByAuthor(character.character.id, snapshot.moments || []),
    }))
    .sort((left, right) => {
      if (left.frequencyDisabled !== right.frequencyDisabled) {
        return left.frequencyDisabled ? 1 : -1;
      }

      if ((left.sceneGate.restriction === 'scene_carryover_only') !== (right.sceneGate.restriction === 'scene_carryover_only')) {
        return left.sceneGate.restriction === 'scene_carryover_only' ? 1 : -1;
      }

      if (left.latestMomentAt !== right.latestMomentAt) {
        return left.latestMomentAt - right.latestMomentAt;
      }

      return left.character.id.localeCompare(right.character.id);
    });

  const picked = rankedCharacters[0] || null;
  if (!picked) {
    return null;
  }

  return buildManualRefreshPlanEntry({
    character: picked.character,
    sceneGate: picked.sceneGate,
    recentMoments: (snapshot.moments || [])
      .filter((moment) => moment.authorId === picked.character.id)
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 3),
  });
}

async function executeMomentPlanEntry(options: {
  entry: AutoMomentPlanEntry;
  trigger: AutoMomentSchedulerTrigger;
  forumConfig: ApiConfig;
  getSnapshot: () => AutoMomentRuntimeSnapshot;
  publishGeneratedCharacterMoment: (payload: GeneratedCharacterMomentPayload) => Promise<void>;
}) {
  const { entry, trigger, forumConfig, getSnapshot, publishGeneratedCharacterMoment } = options;
  const latestData = getSnapshot();
  const liveCharacter = latestData.characters.find((character) => character.id === entry.characterId) || null;
  if (!liveCharacter) {
    return false;
  }
  const sceneGate = getCharacterAutoMomentSceneGate({
    character: liveCharacter,
    trigger,
  });
  if (!sceneGate.allowed) {
    return false;
  }

  const generated = await generateMomentPostContent({
    activeConfig: forumConfig,
    character: liveCharacter,
    masks: latestData.masks || [],
    worldBook: latestData.worldBooks || [],
    requestText: entry.requestText,
    extraPromptSections: entry.extraPromptSections,
    generationHints: entry.generationHints,
    privateCarryoverLevel: liveCharacter.momentPrivateCarryoverLevel,
    allowPrivateMomentCarryover: liveCharacter.allowPrivateMomentCarryover ?? false,
    recentImageReferences: extractRecentMomentImageReferences(latestData.chatHistory?.[entry.characterId] || [], 2),
  });

  const content = generated.content.trim();
  if (!content) {
    return false;
  }

  await publishGeneratedCharacterMoment({
    authorId: liveCharacter.id,
    content,
    translation: generated.translation,
    images: generated.images,
    imageCard: generated.imageCard,
  });

  return true;
}

function appendLikeToMoment(
  setAppData: React.Dispatch<React.SetStateAction<AppData>>,
  momentId: string,
  likerId: string,
) {
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
}

function appendCommentToMoment(
  setAppData: React.Dispatch<React.SetStateAction<AppData>>,
  momentId: string,
  comment: MomentComment,
) {
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
}

export async function publishGeneratedCharacterMomentToFeed(
  options: PublishGeneratedCharacterMomentToFeedOptions,
) {
  const { payload, snapshot, setAppData, forumConfig, onMomentPublished } = options;
  const author = snapshot.characters.find((character) => character.id === payload.authorId) || null;
  if (!author) {
    return;
  }

  const newMomentId = `${payload.authorId}-${Date.now()}`;
  const newMoment: MomentItem = {
    id: newMomentId,
    authorId: payload.authorId,
    visibilityScope: getDefaultMomentVisibilityScope(payload.authorId),
    content: payload.content,
    translation: payload.translation,
    images: payload.images,
    sourceImage: payload.sourceImage,
    imageCard: payload.imageCard,
    timestamp: Date.now(),
    likes: 0,
    comments: [],
  };
  const settlement = buildMomentPublishedSettlement({
    character: author,
    moment: {
      content: payload.content,
      timestamp: newMoment.timestamp,
    },
  });
  const settlementPatch = buildSceneSettlementCharacterPatch(settlement);

  setAppData((prev) => {
    const exposurePatches = buildMomentExposureAwarenessPatches({
      moment: newMoment,
      characters: prev.characters,
      chatGroups: prev.chatGroups || [],
      now: newMoment.timestamp,
    });
    const patchByGroupId = new Map(
      exposurePatches.map((patch) => [patch.groupId, patch.awarenessEntries] as const),
    );

    return {
      ...prev,
      characters: prev.characters.map((character) => {
        if (character.id !== payload.authorId) {
          return character;
        }

        return {
          ...character,
          sharedContextSnapshots: settlementPatch.sharedContextSnapshots,
          shortTermSummary: settlementPatch.shortTermSummary ?? character.shortTermSummary,
          openLoopRegistry: settlementPatch.openLoopRegistry ?? character.openLoopRegistry,
          sharedState: settlementPatch.sharedState ?? character.sharedState,
        };
      }),
      chatGroups: (prev.chatGroups || []).map((group) => {
        const awarenessEntries = patchByGroupId.get(group.id);
        return awarenessEntries ? { ...group, awarenessEntries } : group;
      }),
      moments: [newMoment, ...(prev.moments || [])],
    };
  });

  try {
    await persistSceneSettlement({
      characterId: payload.authorId,
      sourceScene: 'moments',
      settlement,
      sourceSessionType: 'direct',
      sourceSessionId: payload.authorId,
      timestamp: newMoment.timestamp,
    });
  } catch (error) {
    console.error('[moments] Failed to persist published moment settlement', error);
  }

  onMomentPublished?.({
    authorId: payload.authorId,
    authorName: author.name,
    authorAvatar: author.avatar,
    preview: payload.content.slice(0, 26),
  });

  const shuffledCharacters = [...snapshot.characters]
    .filter((character) => character.id !== payload.authorId)
    .sort(() => Math.random() - 0.5);
  const chatGroups = snapshot.chatGroups || [];
  const commentEligibleIds = new Set(
    shuffledCharacters
      .filter((character) => canCharacterAutoCommentOnMoment({
        actor: character,
        moment: newMoment,
        characters: snapshot.characters,
        chatGroups,
      }))
      .map((character) => character.id),
  );
  const autoLikerIds = shuffledCharacters
    .filter((character) => {
      if (!canCharacterAutoLikeMoment({
        actor: character,
        moment: newMoment,
        characters: snapshot.characters,
        chatGroups,
      })) {
        return false;
      }

      const likeChance = commentEligibleIds.has(character.id) ? 0.62 : 0.42;
      return Math.random() < likeChance;
    })
    .map((character) => character.id)
    .slice(0, Math.min(shuffledCharacters.length, 3));

  if (autoLikerIds.length > 0) {
    void (async () => {
      for (const likerId of autoLikerIds) {
        await new Promise((resolve) => setTimeout(resolve, 140 + Math.floor(Math.random() * 360)));
        appendLikeToMoment(setAppData, newMomentId, likerId);
      }
    })();
  }

  if (forumConfig && commentEligibleIds.size > 0) {
    void runMomentPublishCommentSequence({
      activeConfig: forumConfig,
      moment: newMoment,
      characters: snapshot.characters,
      chatGroups,
      userName: snapshot.userProfile.name,
      appendComment: (comment) => appendCommentToMoment(setAppData, newMomentId, comment),
    });
  }
}

export async function runAutoMomentSchedulerPass(
  options: RunAutoMomentSchedulerPassOptions,
): Promise<number> {
  const { trigger, forumConfig, getSnapshot, publishGeneratedCharacterMoment } = options;
  if (!forumConfig) {
    return 0;
  }

  const executeTask = options.executeTask || (async (task: () => Promise<void>) => task());

  if (autoMomentSchedulerRunning) {
    if (trigger !== 'manual_refresh') {
      return 0;
    }

    const forcedEntry = buildForcedManualRefreshEntry(getSnapshot(), {
      trigger,
      now: Date.now(),
    });
    if (!forcedEntry) {
      return 0;
    }

    let published = false;
    await executeTask(async () => {
      published = await executeMomentPlanEntry({
        entry: forcedEntry,
        trigger,
        forumConfig,
        getSnapshot,
        publishGeneratedCharacterMoment,
      });
    });

    return published ? 1 : 0;
  }

  autoMomentSchedulerRunning = true;
  const startedAt = Date.now();

  try {
    const currentData = getSnapshot();
    const unlockedCharacters = filterAutoMomentSceneUnlockedCharacters({
      characters: currentData.characters,
      trigger,
      now: startedAt,
    });
    const plan = buildAutoMomentPlan({
      characters: unlockedCharacters,
      moments: currentData.moments || [],
      now: startedAt,
      lastCheckedAt: loadLastAutoMomentCheckAt(),
      trigger,
    });

    const effectivePlan = plan.length > 0
      ? plan
      : trigger === 'manual_refresh'
        ? [buildForcedManualRefreshEntry(currentData, { trigger, now: startedAt })].filter((entry): entry is NonNullable<ReturnType<typeof buildForcedManualRefreshEntry>> => Boolean(entry))
        : [];

    if (effectivePlan.length === 0) {
      return 0;
    }

    let publishedCount = 0;
    for (const entry of effectivePlan) {
      await executeTask(async () => {
        const published = await executeMomentPlanEntry({
          entry,
          trigger,
          forumConfig,
          getSnapshot,
          publishGeneratedCharacterMoment,
        });
        if (published) {
          publishedCount += 1;
        }
      });
    }

    return publishedCount;
  } finally {
    saveLastAutoMomentCheckAt(startedAt);
    autoMomentSchedulerRunning = false;
  }
}
