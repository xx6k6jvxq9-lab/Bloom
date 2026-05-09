export type DreamRole = {
  id: string;
  name: string;
  avatar: string;
  mood: string;
  glyph: string;
};

export type DreamConfirmPreview = {
  coverSubtitle: string;
  confirmHint: string;
};

export type DreamStage =
  | 'splash'
  | 'home'
  | 'archive'
  | 'role-picker'
  | 'entry'
  | 'tags'
  | 'confirm'
  | 'loading'
  | 'scene'
  | 'choices'
  | 'reaction'
  | 'ending'
  | 'aftermath';
