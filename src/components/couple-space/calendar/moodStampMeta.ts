import type { CalendarMoodStampId } from '../../../types';

export const MOOD_STAMP_META: Record<
  CalendarMoodStampId,
  { label: string; emoji: string; shortLabel: string }
> = {
  missing_you: { label: '想你', emoji: '૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა', shortLabel: '想你' },
  clingy: { label: '贴贴', emoji: '(づ ᴗ _ᴗ)づ', shortLabel: '贴贴' },
  happy: { label: '开心', emoji: '(*˘︶˘*).｡.:*', shortLabel: '开心' },
  expecting: { label: '期待', emoji: '(｡>﹏<｡)', shortLabel: '期待' },
  flutter: { label: '心动', emoji: '( ˘ ³˘)♥', shortLabel: '心动' },
  softened: { label: '心软', emoji: '(｡･ω･｡)', shortLabel: '心软' },
  quiet: { label: '安静', emoji: '( ᵕᴗᵕ )', shortLabel: '安静' },
  sulky: { label: '别扭', emoji: '(¬_¬ )', shortLabel: '别扭' },
};

export function getMoodStampMeta(mood?: CalendarMoodStampId | null) {
  if (!mood) return null;
  return MOOD_STAMP_META[mood] ?? null;
}
