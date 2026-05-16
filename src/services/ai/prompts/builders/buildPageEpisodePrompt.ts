import { EXISTENCE_PROMPT } from '../base/existence';
import { CHAT_OUTPUT_RULES, COMMON_OUTPUT_RULES } from '../base/outputRules';
import { buildReplyLanguageRules } from '../base/languageRules';
import { buildCharacterCoreSection } from '../character/characterCore';
import {
  buildLongTermMemoryContextSection,
  buildShortTermMemoryContextSection,
} from '../character/memoryContext';
import { DATING_PAGE_EPISODE_SCENARIO_PROMPT } from '../scenarios/dating';
import type { DatingSceneInput } from '../../../scene-inputs/buildDatingSceneInput';
import {
  buildDirectChatRhythmPrompt,
  buildRecentContextSection,
  buildUserContextSection,
} from './buildChatPrompt';

type BuildPageEpisodePromptOptions = {
  sceneInput: DatingSceneInput;
};

export function buildPageEpisodePrompt({ sceneInput }: BuildPageEpisodePromptOptions): string {
  const characterCoreSection = buildCharacterCoreSection({
    characterSetting: sceneInput.corePersona || '',
    signature: sceneInput.signature,
    openingRemark: sceneInput.openingRemark,
    personaGuidePrompt: sceneInput.personaGuidePrompt,
    maskPrompt: sceneInput.maskPrompt,
    worldBookPrompt: sceneInput.worldBookPrompt,
    mode: 'character_speaking',
  });

  return [
    EXISTENCE_PROMPT,
    characterCoreSection,
    buildUserContextSection({ userName: sceneInput.userName }),
    buildRecentContextSection(sceneInput.pagePromptContext?.recentContext),
    buildShortTermMemoryContextSection(sceneInput.pagePromptContext?.memoryContext),
    buildLongTermMemoryContextSection(sceneInput.pagePromptContext?.memoryContext),
    DATING_PAGE_EPISODE_SCENARIO_PROMPT.trim(),
    buildDirectChatRhythmPrompt(sceneInput.pagePromptContext?.directReplyConfig),
    buildReplyLanguageRules(sceneInput.pagePromptContext?.languagePolicy),
    COMMON_OUTPUT_RULES,
    CHAT_OUTPUT_RULES,
    sceneInput.backgroundRule,
    sceneInput.relationshipBaselineBlock,
    sceneInput.directorInstructionBlock,
    sceneInput.pageEpisodeInstructionBlock,
    `正式约会内的消息流记录：\n${sceneInput.datingMessages || '暂无约会内消息。'}`,
    sceneInput.sceneProgress,
    sceneInput.currentGeneratedStatus,
    sceneInput.currentGeneratedPlaylist,
    sceneInput.task,
  ]
    .filter(Boolean)
    .join('\n\n');
}
