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
    lines.push(`- 叙事视角：${perspectiveLabelMap[sceneInput.narrativePerspective]}。`);
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
    lines.push(`- 文风预设：${presetLabelMap[sceneInput.writingPreset]}。`);
  }

  if (sceneInput.writingReference && sceneInput.writingReference !== 'none') {
    const referenceLabelMap = {
      jjwxc: '晋江言情读感',
      zhihu: '故事讲述感',
      'taiwan-romance': '台言暧昧感',
      'youth-ache': '青春疼痛感',
      'urban-mature': '都市熟龄感',
      'light-novel': '轻小说轻快感',
    } as const;
    lines.push(`- 风格参考：${referenceLabelMap[sceneInput.writingReference]}。只参考读感，不模仿具体作者。`);
  }

  if (sceneInput.dialogueFormat && sceneInput.dialogueFormat !== 'default') {
    lines.push(
      sceneInput.dialogueFormat === 'quoted'
        ? '- 对白格式：尽量使用中文引号“”包裹。'
        : '- 对白格式：保持自然裸台词，不使用引号。',
    );
  }

  if (sceneInput.descriptionDensity && sceneInput.descriptionDensity !== 'default') {
    const densityLabelMap = {
      default: '默认',
      light: '轻描写、快推进',
      medium: '中等描写、保持均衡',
      heavy: '重描写、细节更满',
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
    '以下设置只影响表现形式；如有冲突，以用户补充为最高优先级，同时保持关系阶段、剧情连续性与 JSON 结构不变。',
    ...lines,
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
    sceneInput.sceneProgress,
    sceneInput.currentGeneratedStatus,
    sceneInput.currentGeneratedPlaylist,
    sceneInput.task,
    ...sceneInput.sections,
  ]
    .filter(Boolean)
    .join('\n\n');
}
