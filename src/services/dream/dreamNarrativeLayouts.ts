export type DreamNarrativeLayoutId =
  | 'full-bleed-dialogue-card'
  | 'soft-overlay-monologue'
  | 'highlight-line-break'
  | 'floating-aside-stack'
  | 'cinematic-caption-stream';

export type DreamNarrativeLayoutPreset = {
  id: DreamNarrativeLayoutId;
  name: string;
  description: string;
  suggestedBlocks: string[];
};

export const dreamNarrativeLayouts: DreamNarrativeLayoutPreset[] = [
  {
    id: 'full-bleed-dialogue-card',
    name: '满屏叙述 + 对话框',
    description: '大段正文铺底，中段插入边框对话卡，适合压迫感与占有欲场景。',
    suggestedBlocks: ['narration', 'framed-dialogue', 'narration'],
  },
  {
    id: 'soft-overlay-monologue',
    name: '雾层独白',
    description: '正文覆盖背景图，角色台词以柔色漂浮覆盖，适合克制和潮湿感。',
    suggestedBlocks: ['narration', 'dialogue', 'aside', 'narration'],
  },
  {
    id: 'highlight-line-break',
    name: '高亮断句',
    description: '正文段落之间插入高亮台词，适合强势、挑逗、危险靠近。',
    suggestedBlocks: ['narration', 'highlight-dialogue', 'narration', 'highlight-dialogue'],
  },
  {
    id: 'floating-aside-stack',
    name: '浮动贴边',
    description: '正文为主体，角色的短句以贴边悬浮块切入，适合梦里低声耳语感。',
    suggestedBlocks: ['narration', 'aside', 'narration', 'aside'],
  },
  {
    id: 'cinematic-caption-stream',
    name: '电影字幕流',
    description: '正文像镜头切换，夹杂居中提示与短促台词，适合场面推进型梦局。',
    suggestedBlocks: ['prompt', 'narration', 'dialogue', 'narration'],
  },
];

export function pickDreamNarrativeLayout(seed: string) {
  const total = Array.from(seed).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
  return dreamNarrativeLayouts[total % dreamNarrativeLayouts.length];
}
