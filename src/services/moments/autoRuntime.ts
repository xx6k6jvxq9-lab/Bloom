import type {
  ApiConfig,
  AppData,
  MomentComment,
  MomentImageCard,
  MomentItem,
} from '../../types';
import { buildSharedStateWritePatch } from '../relationship-context/buildSharedCharacterState';
import { runMomentPublishCommentSequence } from './commentOrchestrator';
import {
  buildAutoMomentPlan,
  loadLastAutoMomentCheckAt,
  saveLastAutoMomentCheckAt,
  type AutoMomentSchedulerTrigger,
} from './autoScheduler';
import { generateMomentPostContent } from './generators';

export type AutoMomentRuntimeSnapshot = Pick<
  AppData,
  'characters' | 'moments' | 'masks' | 'worldBooks' | 'chatGroups' | 'userProfile'
>;

export type GeneratedCharacterMomentPayload = {
  authorId: string;
  content: string;
  translation?: string;
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

function getLatestMomentTimestampByAuthor(characterId: string, moments: MomentItem[] = []) {
  return moments
    .filter((moment) => moment.authorId === characterId)
    .reduce((latest, moment) => Math.max(latest, moment.timestamp), 0);
}

function buildForcedManualRefreshEntry(snapshot: AutoMomentRuntimeSnapshot) {
  const rankedCharacters = [...(snapshot.characters || [])]
    .map((character) => ({
      character,
      frequencyDisabled: (character.postFrequency || 'medium') === 'none',
      latestMomentAt: getLatestMomentTimestampByAuthor(character.id, snapshot.moments || []),
    }))
    .sort((left, right) => {
      if (left.frequencyDisabled !== right.frequencyDisabled) {
        return left.frequencyDisabled ? 1 : -1;
      }

      if (left.latestMomentAt !== right.latestMomentAt) {
        return left.latestMomentAt - right.latestMomentAt;
      }

      return left.character.id.localeCompare(right.character.id);
    });

  const picked = rankedCharacters[0]?.character || null;
  if (!picked) {
    return null;
  }

  return {
    characterId: picked.id,
    requestText: '自主发动态：手动刷新；请立即生成一条新的公开动态。',
    extraPromptSections: [
      picked.sharedState?.currentActivity?.trim() ? `当前生活状态：${picked.sharedState.currentActivity.trim()}` : '',
      picked.presenceState?.recentLifeBeat?.trim() ? `最近生活节奏：${picked.presenceState.recentLifeBeat.trim()}` : '',
      picked.sharedState?.publicCarryover?.trim() ? `公开余波：${picked.sharedState.publicCarryover.trim()}` : '',
      '这是用户手动点击刷新后的强制刷新，必须产出一条新的动态。',
      '优先写具体可见内容：物品、地点、自拍、穿搭、食物、桌面、镜子、街景、房间、天气、路上、宠物。',
      '不要返回空白，不要解释说明，不要重复上一条动态。',
    ].filter(Boolean),
  };
}

async function executeMomentPlanEntry(options: {
  entry: {
    characterId: string;
    requestText: string;
    extraPromptSections: string[];
  };
  forumConfig: ApiConfig;
  getSnapshot: () => AutoMomentRuntimeSnapshot;
  publishGeneratedCharacterMoment: (payload: GeneratedCharacterMomentPayload) => Promise<void>;
}) {
  const { entry, forumConfig, getSnapshot, publishGeneratedCharacterMoment } = options;
  const latestData = getSnapshot();
  const liveCharacter = latestData.characters.find((character) => character.id === entry.characterId) || null;
  if (!liveCharacter) {
    return false;
  }

  const generated = await generateMomentPostContent({
    activeConfig: forumConfig,
    character: liveCharacter,
    masks: latestData.masks || [],
    worldBook: latestData.worldBooks || [],
    requestText: entry.requestText,
    extraPromptSections: entry.extraPromptSections,
    privateCarryoverLevel: liveCharacter.momentPrivateCarryoverLevel,
    allowPrivateMomentCarryover: liveCharacter.allowPrivateMomentCarryover ?? false,
  });

  const content = generated.content.trim();
  if (!content) {
    return false;
  }

  await publishGeneratedCharacterMoment({
    authorId: liveCharacter.id,
    content,
    translation: generated.translation,
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
    content: payload.content,
    translation: payload.translation,
    imageCard: payload.imageCard,
    timestamp: Date.now(),
    likes: 0,
    comments: [],
  };

  setAppData((prev) => ({
    ...prev,
    characters: prev.characters.map((character) => (
      character.id !== payload.authorId
        ? character
        : {
            ...character,
            sharedState: buildSharedStateWritePatch({
              character,
              sourceScene: 'moments',
              publicSummaries: [`刚刚发了一条动态：${payload.content.replace(/\s+/g, ' ').slice(0, 72)}`],
            }),
          }
    )),
    moments: [newMoment, ...(prev.moments || [])],
  }));

  onMomentPublished?.({
    authorId: payload.authorId,
    authorName: author.name,
    authorAvatar: author.avatar,
    preview: payload.content.slice(0, 26),
  });

  const shuffledCharacters = [...snapshot.characters]
    .filter((character) => character.id !== payload.authorId)
    .sort(() => Math.random() - 0.5);
  const autoLikerIds = shuffledCharacters
    .filter((character) => Math.random() < 0.42)
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

  if (forumConfig) {
    void runMomentPublishCommentSequence({
      activeConfig: forumConfig,
      moment: newMoment,
      characters: snapshot.characters,
      chatGroups: snapshot.chatGroups || [],
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

    const forcedEntry = buildForcedManualRefreshEntry(getSnapshot());
    if (!forcedEntry) {
      return 0;
    }

    let published = false;
    await executeTask(async () => {
      published = await executeMomentPlanEntry({
        entry: forcedEntry,
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
    const plan = buildAutoMomentPlan({
      characters: currentData.characters,
      moments: currentData.moments || [],
      now: startedAt,
      lastCheckedAt: loadLastAutoMomentCheckAt(),
      trigger,
    });

    const effectivePlan = plan.length > 0
      ? plan
      : trigger === 'manual_refresh'
        ? [buildForcedManualRefreshEntry(currentData)].filter((entry): entry is NonNullable<ReturnType<typeof buildForcedManualRefreshEntry>> => Boolean(entry))
        : [];

    if (effectivePlan.length === 0) {
      return 0;
    }

    let publishedCount = 0;
    for (const entry of effectivePlan) {
      await executeTask(async () => {
        const published = await executeMomentPlanEntry({
          entry,
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
