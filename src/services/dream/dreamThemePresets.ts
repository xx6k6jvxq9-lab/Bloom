export type DreamThemePreset = {
  id: string;
  name: string;
  accent: string;
  accentSoft: string;
  dialogueText: string;
  frameBorder: string;
  frameFill: string;
};

export const dreamThemePresets: DreamThemePreset[] = [
  { id: 'amber-night', name: '琥珀夜', accent: '#D6B16A', accentSoft: 'rgba(214,177,106,.16)', dialogueText: '#F0D7A0', frameBorder: 'rgba(214,177,106,.55)', frameFill: 'rgba(19,16,12,.58)' },
  { id: 'mist-blue', name: '雾蓝', accent: '#9EBEE2', accentSoft: 'rgba(158,190,226,.16)', dialogueText: '#B7D4F6', frameBorder: 'rgba(158,190,226,.48)', frameFill: 'rgba(11,18,28,.54)' },
  { id: 'rose-ash', name: '灰玫', accent: '#D9A7A7', accentSoft: 'rgba(217,167,167,.16)', dialogueText: '#F1C3C3', frameBorder: 'rgba(217,167,167,.45)', frameFill: 'rgba(24,14,16,.56)' },
  { id: 'jade-dusk', name: '暮玉', accent: '#83C3AE', accentSoft: 'rgba(131,195,174,.16)', dialogueText: '#AEE3D2', frameBorder: 'rgba(131,195,174,.46)', frameFill: 'rgba(10,20,18,.56)' },
  { id: 'violet-smoke', name: '烟紫', accent: '#B8A5D6', accentSoft: 'rgba(184,165,214,.16)', dialogueText: '#D7C9F4', frameBorder: 'rgba(184,165,214,.46)', frameFill: 'rgba(18,14,24,.56)' },
  { id: 'crimson-veil', name: '绯幕', accent: '#D88E8E', accentSoft: 'rgba(216,142,142,.16)', dialogueText: '#F2B5B5', frameBorder: 'rgba(216,142,142,.48)', frameFill: 'rgba(28,13,15,.58)' },
  { id: 'moon-silver', name: '月银', accent: '#C7CBD6', accentSoft: 'rgba(199,203,214,.16)', dialogueText: '#E4E8F1', frameBorder: 'rgba(199,203,214,.42)', frameFill: 'rgba(20,22,28,.54)' },
  { id: 'sea-glass', name: '海玻璃', accent: '#7FC7C2', accentSoft: 'rgba(127,199,194,.16)', dialogueText: '#B7ECE7', frameBorder: 'rgba(127,199,194,.44)', frameFill: 'rgba(10,24,24,.56)' },
  { id: 'pearl-lilac', name: '珠丁香', accent: '#C5B0DA', accentSoft: 'rgba(197,176,218,.16)', dialogueText: '#E1D1F1', frameBorder: 'rgba(197,176,218,.46)', frameFill: 'rgba(21,16,29,.56)' },
  { id: 'sunset-copper', name: '落铜', accent: '#CF9169', accentSoft: 'rgba(207,145,105,.16)', dialogueText: '#E9BC9D', frameBorder: 'rgba(207,145,105,.46)', frameFill: 'rgba(28,18,12,.58)' },
  { id: 'frost-cyan', name: '霜青', accent: '#8FCFE3', accentSoft: 'rgba(143,207,227,.16)', dialogueText: '#BFE9F6', frameBorder: 'rgba(143,207,227,.45)', frameFill: 'rgba(10,19,26,.54)' },
  { id: 'olive-gold', name: '苔金', accent: '#B8B06F', accentSoft: 'rgba(184,176,111,.16)', dialogueText: '#DDD59B', frameBorder: 'rgba(184,176,111,.44)', frameFill: 'rgba(24,22,12,.56)' },
  { id: 'night-orchid', name: '夜兰', accent: '#A98BCF', accentSoft: 'rgba(169,139,207,.16)', dialogueText: '#CDB5EF', frameBorder: 'rgba(169,139,207,.45)', frameFill: 'rgba(19,14,28,.56)' },
  { id: 'tea-brown', name: '茶褐', accent: '#B38D73', accentSoft: 'rgba(179,141,115,.16)', dialogueText: '#D9B7A0', frameBorder: 'rgba(179,141,115,.44)', frameFill: 'rgba(24,18,14,.56)' },
  { id: 'ice-lotus', name: '冰莲', accent: '#99B8D9', accentSoft: 'rgba(153,184,217,.16)', dialogueText: '#C4DCF6', frameBorder: 'rgba(153,184,217,.45)', frameFill: 'rgba(12,18,28,.54)' },
  { id: 'ember-rose', name: '烬玫', accent: '#CC8C9F', accentSoft: 'rgba(204,140,159,.16)', dialogueText: '#EDB4C3', frameBorder: 'rgba(204,140,159,.46)', frameFill: 'rgba(27,14,18,.56)' },
  { id: 'pine-shadow', name: '松影', accent: '#7DA48F', accentSoft: 'rgba(125,164,143,.16)', dialogueText: '#A9D1BC', frameBorder: 'rgba(125,164,143,.44)', frameFill: 'rgba(12,22,18,.56)' },
  { id: 'opal-rain', name: '雨欧泊', accent: '#A6C1C6', accentSoft: 'rgba(166,193,198,.16)', dialogueText: '#D0E8EC', frameBorder: 'rgba(166,193,198,.42)', frameFill: 'rgba(13,20,22,.54)' },
  { id: 'plum-wine', name: '梅酒', accent: '#B17A97', accentSoft: 'rgba(177,122,151,.16)', dialogueText: '#D8A6C0', frameBorder: 'rgba(177,122,151,.44)', frameFill: 'rgba(24,12,20,.56)' },
  { id: 'sand-lantern', name: '砂灯', accent: '#D4B88A', accentSoft: 'rgba(212,184,138,.16)', dialogueText: '#EED8B3', frameBorder: 'rgba(212,184,138,.46)', frameFill: 'rgba(25,20,13,.56)' },
];

export function pickDreamThemePreset(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return dreamThemePresets[total % dreamThemePresets.length];
}
