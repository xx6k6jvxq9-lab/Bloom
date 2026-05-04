import type { DatingSceneInput } from '../../../scene-inputs/buildDatingSceneInput';
import { DATING_SCENARIO_PROMPT } from '../scenarios/dating';

type BuildDatingPromptOptions = {
  sceneInput: DatingSceneInput;
};

function buildNarrativePerspectivePrompt(sceneInput: DatingSceneInput): string[] {
  if (!sceneInput.narrativePerspective || sceneInput.narrativePerspective === 'default') {
    return [];
  }

  const perspectiveRuleMap = {
    first: [
      '本次约会正文的 narration 尽量使用第一人称，让角色以“我”的临场感来叙述当下经历。',
      'dialogue 仍然只写角色真正说出口的话，不要在台词前后额外补叙述标签。',
      'status.innerThought 可以继续使用第一人称，并与正文口吻保持一致。',
    ],
    second: [
      '本次约会正文的 narration 尽量使用第二人称临场感来描写用户与现场，让“你”的感受更贴近镜头中心。',
      `角色本身仍然保持 ${sceneInput.characterName} / 他 / 她 这样的指代，不要把角色写成“我”。`,
      'status.innerThought 仍然是角色自己的内心 OS，可以使用第一人称。',
    ],
    third: [
      `本次约会正文明确保持第三人称旁白感，稳定使用 ${sceneInput.characterName} / 他 / 她 作为角色指代。`,
      `用户优先写作“你”，必要时可少量自然使用 ${sceneInput.userName}。`,
      'status.innerThought 仍然允许使用第一人称，因为那里是角色的内心独白。',
    ],
  } as const;

  return [
    `- 叙事视角覆盖：${sceneInput.narrativePerspective}`,
    ...perspectiveRuleMap[sceneInput.narrativePerspective].map((line) => `  - ${line}`),
  ];
}

function buildWritingPresetPrompt(sceneInput: DatingSceneInput): string[] {
  if (!sceneInput.writingPreset || sceneInput.writingPreset === 'default') {
    return [];
  }

  const presetRuleMap = {
    novel: [
      '整体写成连贯的互动小说正文，不要像提纲、说明文或摘要。',
      '动作、神态、环境和心理自然穿插，段落之间要有顺滑过渡。',
      '少用解释腔和总结腔，让情绪通过画面与细节自己成立。',
    ],
    cinematic: [
      '强调镜头感，多写视线、距离、动作切换、光线和空间调度。',
      '减少抽象概括，优先写看得见、听得到、感觉得到的现场变化。',
      '让段落像镜头推进，少空泛抒情，少大段解释。',
    ],
    tender: [
      '整体语气细腻、暧昧、温柔，重视呼吸感、停顿感和微小情绪波动。',
      '多写眼神、手指、距离、迟疑、语气变化，不要一上来就直白表白。',
      '甜度可以有，但要克制地递进，保持朦胧和拉近的过程感。',
    ],
    restrained: [
      '整体表达收着写，语气克制、冷静、含蓄，不要甜腻外放。',
      '情绪可以深，但尽量通过动作细节、短暂停顿和言外之意来体现。',
      '避免过于直白的抒情或热烈告白，保留人物边界感。',
    ],
    casual: [
      '整体口吻更自然、更生活流，像熟人之间真实发生的聊天与相处。',
      '对白允许更口语一点，但仍要保留角色人设与情绪层次。',
      '减少过分文学化的比喻和堆砌辞藻，让内容轻松顺口。',
    ],
    tension: [
      '强化试探、拉扯、停顿、反复确认和若即若离的张力。',
      '角色可以嘴硬、绕开正面回答、借动作或语气藏情绪，但不能失真。',
      '让关系推进带一点克制的压迫感和心跳感，不要直接甜到位。',
    ],
  } as const;

  return [
    `- 文风预设：${sceneInput.writingPreset}`,
    ...presetRuleMap[sceneInput.writingPreset].map((line) => `  - ${line}`),
  ];
}

function buildWritingReferencePrompt(sceneInput: DatingSceneInput): string[] {
  if (!sceneInput.writingReference || sceneInput.writingReference === 'none') {
    return [];
  }

  const referenceRuleMap = {
    jjwxc: [
      '参考偏言情网文的顺滑读感，关系推进要有钩子，情绪递进更明确。',
      '人物互动要细腻好读，能让人明显感到暧昧流动和心动节点。',
      '不要模仿具体作者，只保留“顺滑、细腻、容易上头”的读感。',
    ],
    zhihu: [
      '参考偏故事讲述型的表达，语气更直接，事件推进更快。',
      '允许带一点“正在讲一段很具体的事”的口吻，但不要写成问答体或总结帖。',
      '保留现场感和情绪推进，不要变成复盘腔。',
    ],
    'taiwan-romance': [
      '参考偏台言式的情绪浓度，暧昧、拉扯、试探和克制都可以更明显。',
      '语言可以更柔、更黏一点，但不要油腻，不要失去角色本身的人设。',
      '重点放在情绪对撞和关系张力，不要只剩甜腻对白。',
    ],
    'youth-ache': [
      '参考青春疼痛感的读感，语气更敏感、克制、留白，情绪有一点钝痛。',
      '多写心口不一、迟疑、误解、欲言又止，但不要无病呻吟。',
      '保持人物真实，不要把剧情写得过分沉重或失去互动性。',
    ],
    'urban-mature': [
      '参考都市熟龄感的表达，语气更成熟、更稳，更注重分寸和试探。',
      '减少幼态化撒娇和轻飘飘的甜，强化成年人之间的克制与默契。',
      '可以有暧昧，但要显得稳、准、自然。',
    ],
    'light-novel': [
      '参考轻小说式的轻快临场感，节奏更活，对白占比可以略高。',
      '画面要清楚，互动要轻盈，允许有一点俏皮感和反应感。',
      '不要写得太厚重，保持易读和流动。',
    ],
  } as const;

  return [
    `- 风格参考：${sceneInput.writingReference}`,
    ...referenceRuleMap[sceneInput.writingReference].map((line) => `  - ${line}`),
  ];
}

function buildDialogueFormatPrompt(sceneInput: DatingSceneInput): string[] {
  if (!sceneInput.dialogueFormat || sceneInput.dialogueFormat === 'default') {
    return [];
  }

  return sceneInput.dialogueFormat === 'quoted'
    ? [
        '- 对白格式覆盖：角色对白尽量使用中文引号“”包裹，但仍然只写说出口的话。',
      ]
    : [
        '- 对白格式覆盖：角色对白不要使用引号，保持自然裸台词。',
      ];
}

function buildDescriptionDensityPrompt(sceneInput: DatingSceneInput): string[] {
  if (!sceneInput.descriptionDensity || sceneInput.descriptionDensity === 'default') {
    return [];
  }

  const densityRuleMap = {
    light: [
      '描写浓度偏轻，推进更快，少做过长铺垫。',
      '每段抓住最关键的动作或情绪变化即可，不要堆太多环境和心理描写。',
    ],
    medium: [
      '描写浓度保持中等，动作、对白、情绪和环境均衡展开。',
    ],
    heavy: [
      '描写浓度偏重，可以写得更细，强化氛围、动作、神态与心理层次。',
      '允许更长一点的细节铺陈，但仍要保持节奏，不要写成散文。',
    ],
  } as const;

  return [
    `- 描写浓度：${sceneInput.descriptionDensity}`,
    ...densityRuleMap[sceneInput.descriptionDensity].map((line) => `  - ${line}`),
  ];
}

function buildDatingStyleOverridePrompt(sceneInput: DatingSceneInput): string {
  const sections = [
    ...buildNarrativePerspectivePrompt(sceneInput),
    ...buildWritingPresetPrompt(sceneInput),
    ...buildWritingReferencePrompt(sceneInput),
    ...buildDialogueFormatPrompt(sceneInput),
    ...buildDescriptionDensityPrompt(sceneInput),
    ...(sceneInput.writingStyleCustom?.trim()
      ? [`- 用户补充文风要求：${sceneInput.writingStyleCustom.trim()}`]
      : []),
  ];

  if (sections.length === 0) {
    return '';
  }

  return [
    '## 本次约会风格覆盖',
    '以下设置只作用于本次约会，并且只影响表现形式，不改变关系阶段、剧情连续性与 JSON 输出结构。',
    '如果文风预设、小开关和用户自定义补充之间发生冲突，以用户自定义补充为最高优先级。',
    ...sections,
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
