export type GroupOfflineStylePresetId = 'jjwxc' | 'haitang' | 'yanyan' | 'fanqie' | 'qidian';

export type GroupOfflineStylePreset = {
  id: GroupOfflineStylePresetId;
  label: string;
  summary: string;
  rules: string[];
};

export const GROUP_OFFLINE_STYLE_PRESETS: GroupOfflineStylePreset[] = [
  {
    id: 'jjwxc',
    label: '晋江感',
    summary: '更细腻、更重关系拉扯和心理递进。',
    rules: [
      '重点放在关系流动、眼神变化、停顿和没说透的情绪上。',
      '环境细节要服务情绪，不要只是摆背景板。',
      '句子可以柔一点、长一点，但不要散。',
      '角色说出口的话要克制，真正的情绪更多放在动作和心口不一里。',
      '整体更像细密推进的情感场，不要写得过硬、过工具化。',
    ],
  },
  {
    id: 'haitang',
    label: '海棠感',
    summary: '感官张力更直接，靠近感和危险感更前置。',
    rules: [
      '把靠近、呼吸、触感、距离变化写得更明显，但不要改事件事实。',
      '句子允许更黏、更贴身，情绪和欲望感可以更直白一点。',
      '角色台词可以更带试探和挑动，不要过分收着。',
      '环境要像在推着人靠近，而不是中性背景。',
      '保留分寸，不要直接写成粗暴说明或低级直给。',
    ],
  },
  {
    id: 'yanyan',
    label: '盐言感',
    summary: '节奏更利落，冲突和钩子更靠前。',
    rules: [
      '段落更短，信息密度更高，少绕弯子。',
      '把这一轮最抓人的 tension 尽快抬出来，不要慢热铺垫过长。',
      '角色话里要更有锋利感和情绪落点，少空抒情。',
      '环境细节只留最能推冲突或推吸引的那几个。',
      '仍然保持群线下叙事，不要硬改成人称独白体。',
    ],
  },
  {
    id: 'fanqie',
    label: '番茄感',
    summary: '更直接、更好读，推进点清楚。',
    rules: [
      '表达更直给，剧情推进点要清楚易懂。',
      '动作、台词、情绪变化都尽量明确，不要故作玄虚。',
      '段落和句子保持顺滑，减少过度修辞。',
      '角色互动要有即时反馈感，别拖。',
      '保留沉浸感，但优先可读性和爽点落点。',
    ],
  },
  {
    id: 'qidian',
    label: '起点感',
    summary: '更强调逻辑、局势和角色动作的因果推进。',
    rules: [
      '把局势变化、谁压谁一头、谁在控场写得更清楚。',
      '句子更利落，因果关系更强，少飘着写氛围。',
      '角色台词要更有目的性，像在试探、压场或抢主动。',
      '环境描写要服务局势判断，而不是只服务抒情。',
      '保持人物关系戏，但整体笔触更稳、更硬一点。',
    ],
  },
];

export const GROUP_OFFLINE_STYLE_PRESET_OPTIONS = GROUP_OFFLINE_STYLE_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
}));

export function getGroupOfflineStylePreset(presetId: GroupOfflineStylePresetId) {
  return GROUP_OFFLINE_STYLE_PRESETS.find((preset) => preset.id === presetId) || GROUP_OFFLINE_STYLE_PRESETS[0];
}

export function buildGroupOfflineStylePresetInstruction(presetId: GroupOfflineStylePresetId): string {
  const preset = getGroupOfflineStylePreset(presetId);
  return [
    `当前固定文风：${preset.label}`,
    `目标手感：${preset.summary}`,
    '总原则：文风只改写法，不改人物主动性、占有欲、亲密尺度、说话力度、边界或关系判断。',
    ...preset.rules.map((rule, index) => `${index + 1}. ${rule}`),
  ].join('\n');
}
