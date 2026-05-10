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
  if (!forumConfig || autoMomentSchedulerRunning) {
    return 0;
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

    if (plan.length === 0) {
      return 0;
    }

    const executeTask = options.executeTask || (async (task: () => Promise<void>) => task());

    for (const entry of plan) {
      await executeTask(async () => {
        const latestData = getSnapshot();
        const liveCharacter = latestData.characters.find((character) => character.id === entry.characterId) || null;
        if (!liveCharacter) {
          return;
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
          return;
        }

        await publishGeneratedCharacterMoment({
          authorId: liveCharacter.id,
          content,
          translation: generated.translation,
          imageCard: generated.imageCard,
        });
      });
    }

    return plan.length;
  } finally {
    saveLastAutoMomentCheckAt(startedAt);
    autoMomentSchedulerRunning = false;
  }
}
