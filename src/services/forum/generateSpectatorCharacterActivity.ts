import type {
  ApiConfig,
  Character,
  ForumGlobalSettings,
  ForumPost,
  ForumSpectatorSettings,
  Mask,
  WorldBookEntry,
} from '../../types';
import { generateCharacterSpectatorPost, generateCharacterSpectatorReply } from './generateCharacterSpectatorContribution';
import { buildSpectatorSettingsSummary } from './buildSpectatorSettingsSummary';
import { resolveForumGenerationContext } from './forumGenerationContext';
import { normalizeSpectatorTargetCharacters } from '../../features/forum-domain/spectatorBoard';

type BaseActivityInput = {
  activeConfig: ApiConfig;
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Character[];
  allCharacters: Character[];
  existingPosts: ForumPost[];
  globalSettings?: ForumGlobalSettings;
  masks?: Mask[];
  worldBooks?: WorldBookEntry[];
};

type GenerateSpectatorCharacterPostActivityInput = BaseActivityInput & {
  now?: number;
};

type GenerateSpectatorCharacterReplyActivityInput = BaseActivityInput & {
  post: ForumPost;
  userComment: string;
};

function pickWeightedCharacter(
  candidates: Character[],
  existingPosts: ForumPost[],
  settings: ForumSpectatorSettings,
  mode: 'post' | 'reply',
  selectedRoleWeights: Map<string, number>,
  post?: ForumPost,
) {
  const now = Date.now();
  const normalizedHints = [
    settings.subjectName,
    settings.relationshipSummary,
    post?.title,
    post?.content,
  ].filter(Boolean).join('\n');

  const scored = candidates
    .filter((character) => (character.postFrequency || 'medium') !== 'none')
    .filter((character) => {
      if (mode === 'post') {
        const recentMirrorPost = existingPosts.find((item) => (
          item.authorId === character.id
          && (item.board === 'spectator' || item.category === '镜间')
        ));
        if (!recentMirrorPost) return true;
        const cooldownMs = character.postFrequency === 'high'
          ? 2 * 60 * 60 * 1000
          : character.postFrequency === 'low'
            ? 10 * 60 * 60 * 1000
            : 5 * 60 * 60 * 1000;
        return now - recentMirrorPost.timestamp > cooldownMs;
      }

      const recentMirrorReply = existingPosts
        .flatMap((item) => item.comments)
        .find((comment) => comment.authorId === character.id);
      if (!recentMirrorReply) return true;
      const cooldownMs = character.postFrequency === 'high'
        ? 20 * 60 * 1000
        : character.postFrequency === 'low'
          ? 90 * 60 * 1000
          : 45 * 60 * 1000;
      return now - recentMirrorReply.timestamp > cooldownMs;
    })
    .map((character) => {
      const frequency = character.postFrequency || 'medium';
      const frequencyWeight = frequency === 'high' ? 4 : frequency === 'low' ? 1 : 2;
      const selectedWeight = selectedRoleWeights.get(character.id) || 0;
      const mentionWeight = normalizedHints.includes(character.name) ? 3 : 0;
      const replyWeight = post?.authorId === character.id ? -100 : 0;
      return {
        character,
        weight: Math.max(0, frequencyWeight + selectedWeight + mentionWeight + replyWeight),
      };
    })
    .filter((entry) => entry.weight > 0);

  if (!scored.length) return null;

  const totalWeight = scored.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const entry of scored) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.character;
  }
  return scored[0].character;
}

function buildSelectedRoleWeights(settings: ForumSpectatorSettings, selectedCharacters: Character[]) {
  const weights = new Map<string, number>();
  const normalizedTargets = normalizeSpectatorTargetCharacters(settings);
  const singleMode = settings.objectMode === 'single_character';
  normalizedTargets.forEach((target) => {
    weights.set(
      target.characterId,
      singleMode
        ? (target.role === 'primary' ? 6 : target.role === 'secondary' ? 2 : 4)
        : (target.role === 'primary' ? 6 : target.role === 'secondary' ? 4 : 3),
    );
  });
  if (!weights.size) {
    selectedCharacters.forEach((character, index) => {
      weights.set(character.id, index === 0 ? 6 : 3);
    });
  }
  return weights;
}

export async function maybeGenerateSpectatorCharacterPost(input: GenerateSpectatorCharacterPostActivityInput) {
  const {
    activeConfig,
    settings,
    currentUserName,
    selectedCharacters,
    allCharacters,
    existingPosts,
    globalSettings,
    masks = [],
    worldBooks = [],
    now = Date.now(),
  } = input;

  const selectedRoleWeights = buildSelectedRoleWeights(settings, selectedCharacters);
  const candidate = pickWeightedCharacter(
    selectedCharacters.length ? selectedCharacters : allCharacters,
    existingPosts,
    settings,
    'post',
    selectedRoleWeights,
  );
  if (!candidate) return null;

  const selectedWeight = selectedRoleWeights.get(candidate.id) || 0;
  const triggerChance = selectedWeight >= 6 ? 0.68 : selectedWeight >= 4 ? 0.6 : selectedWeight > 0 ? 0.54 : 0.28;
  if (Math.random() > triggerChance) return null;

  const generationContext = resolveForumGenerationContext({
    globalSettings,
    masks,
    worldBooks,
    spectatorSettings: settings,
    worldBookScope: 'character_post',
    maskScope: 'character_post',
  });

  return generateCharacterSpectatorPost({
    activeConfig,
    character: candidate,
    settingsSummary: buildSpectatorSettingsSummary({
      settings,
      currentUserName,
      selectedCharacters,
    }),
    currentUserName,
    selectedCharacterNames: selectedCharacters.map((character) => character.name),
    masks: generationContext.activeMasks,
    worldBook: generationContext.activeWorldBooks,
    extraContextSections: [
      generationContext.worldBookPromptBlock,
      generationContext.maskPromptBlock,
    ].filter(Boolean),
    now,
  });
}

export async function maybeGenerateSpectatorCharacterReply(input: GenerateSpectatorCharacterReplyActivityInput) {
  const {
    activeConfig,
    settings,
    currentUserName,
    selectedCharacters,
    allCharacters,
    existingPosts,
    globalSettings,
    masks = [],
    worldBooks = [],
    post,
    userComment,
  } = input;

  if (!userComment.trim()) return null;

  const selectedRoleWeights = buildSelectedRoleWeights(settings, selectedCharacters);
  const candidate = pickWeightedCharacter(
    selectedCharacters.length ? selectedCharacters : allCharacters,
    existingPosts,
    settings,
    'reply',
    selectedRoleWeights,
    post,
  );
  if (!candidate) return null;

  const selectedWeight = selectedRoleWeights.get(candidate.id) || 0;
  const triggerChance = selectedWeight >= 6 ? 0.8 : selectedWeight >= 4 ? 0.74 : selectedWeight > 0 ? 0.68 : 0.35;
  if (Math.random() > triggerChance) return null;

  const generationContext = resolveForumGenerationContext({
    globalSettings,
    masks,
    worldBooks,
    spectatorSettings: settings,
    worldBookScope: 'character_post',
    maskScope: 'character_post',
  });

  return generateCharacterSpectatorReply({
    activeConfig,
    character: candidate,
    post,
    userComment,
    settingsSummary: buildSpectatorSettingsSummary({
      settings,
      currentUserName,
      selectedCharacters,
    }),
    extraContextSections: [
      generationContext.worldBookPromptBlock,
      generationContext.maskPromptBlock,
    ].filter(Boolean),
  });
}
