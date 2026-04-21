export type DreamNarrativeBlockType =
  | 'narration'
  | 'dialogue'
  | 'highlight-dialogue'
  | 'framed-dialogue'
  | 'aside'
  | 'prompt'
  | 'strikethrough'
  | 'annotation'
  | 'verdict'
  | 'redacted'
  | 'echo-line';

export type DreamNarrativeBlock = {
  id: string;
  type: DreamNarrativeBlockType;
  text: string;
  speakerName?: string;
  speakerAvatar?: string;
  emphasis?: 'low' | 'medium' | 'high';
  align?: 'left' | 'center' | 'right';
};

export type DreamNarrativePage = {
  id: string;
  title?: string;
  blocks: DreamNarrativeBlock[];
};

export type DreamNarrativeDocument = {
  themeId: string;
  layoutId: string;
  pages: DreamNarrativePage[];
};
