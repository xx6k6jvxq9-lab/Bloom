import type { DatingSceneInput } from '../../../scene-inputs/buildDatingSceneInput';
import { DATING_SCENARIO_PROMPT } from '../scenarios/dating';

type BuildDatingPromptOptions = {
  sceneInput: DatingSceneInput;
};

function buildDatingStyleOverridePrompt(sceneInput: DatingSceneInput): string {
  const lines: string[] = [];

  if (sceneInput.narrativePerspective && sceneInput.narrativePerspective !== 'default') {
    const perspectiveLabelMap = {
      default: '默认',
      first: '第一人称',
      second: '第二人称',
      third: '第三人称',
    } as const;
    lines.push(`- 本次约会正文叙事视角改为：${perspectiveLabelMap[sceneInput.narrativePerspective]}。`);
  }

  if (sceneInput.writingPreset && sceneInput.writingPreset !== 'default') {
    const presetLabelMap = {
      default: '默认',
      novel: '小说感',
      cinematic: '电影镜头感',
      tender: '细腻暧昧',
      restrained: '克制冷感',
      casual: '轻松口语',
      tension: '拉扯张力',
    } as const;
    lines.push(`- 本次约会整体文风偏向：${presetLabelMap[sceneInput.writingPreset]}。`);
  }

  if (sceneInput.dialogueFormat && sceneInput.dialogueFormat !== 'default') {
    lines.push(
      sceneInput.dialogueFormat === 'quoted'
        ? '- 角色对白尽量使用中文引号“”包裹。'
        : '- 角色对白不要使用引号包裹，保持自然裸台词。',
    );
  }

  if (sceneInput.descriptionDensity && sceneInput.descriptionDensity !== 'default') {
    const densityLabelMap = {
      default: '默认',
      light: '轻描写、快推进',
      medium: '中等描写、保持均衡',
      heavy: '重描写、细节和氛围更浓',
    } as const;
    lines.push(`- 描写浓度：${densityLabelMap[sceneInput.descriptionDensity]}。`);
  }

  if (sceneInput.writingStyleCustom?.trim()) {
    lines.push(`- 用户补充文风要求：${sceneInput.writingStyleCustom.trim()}`);
  }

  if (lines.length === 0) {
    return '';
  }

  return [
    '## 本次约会风格覆盖',
    '以下设置只作用于本次约会，优先级高于默认叙事视角和对白包装规则；如果和默认规则冲突，以本次设置为准，但仍必须保持 JSON 结构正确。',
    ...lines,
    '注意：只覆盖表现形式，不要破坏当前关系阶段、剧情连续性和状态字段逻辑。',
  ].join('\n');
}

export function buildDatingPrompt({ sceneInput }: BuildDatingPromptOptions): string {
  return [
    DATING_SCENARIO_PROMPT.trim(),
    buildDatingStyleOverridePrompt(sceneInput),
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
