import type { DatingSceneInput } from '../../../scene-inputs/buildDatingSceneInput';
import { DATING_SCENARIO_PROMPT } from '../scenarios/dating';

type BuildDatingPromptOptions = {
  sceneInput: DatingSceneInput;
};

export function buildDatingPrompt({ sceneInput }: BuildDatingPromptOptions): string {
  return [
    DATING_SCENARIO_PROMPT.trim(),
    `角色：${sceneInput.characterName}`,
    `角色核心人设：${sceneInput.corePersona || '未提供'}`,
    `角色签名：${sceneInput.signature || '暂无'}`,
    `用户：${sceneInput.userName}`,
    `本次约会地点：${sceneInput.location || '未提供'}`,
    `本次约会情景：${sceneInput.scenario || '未提供'}`,
    `本次约会氛围：${sceneInput.mood || '未提供'}`,
    sceneInput.backgroundRule,
    `用户与角色的过往聊天记录（用于延续关系和心理变化）：
${sceneInput.pastChatContext || '暂无可用聊天记录。'}`,
    `正式约会内的消息流记录：
${sceneInput.datingMessages || '暂无约会内消息。'}`,
    `最近一轮已生成的约会正文：
${sceneInput.currentGeneratedNarrative}`,
    sceneInput.currentGeneratedStatus,
    sceneInput.currentGeneratedPlaylist,
    sceneInput.task,
    ...sceneInput.sections,
  ]
    .filter(Boolean)
    .join('\n\n');
}
