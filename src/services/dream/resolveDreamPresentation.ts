import { pickDreamNarrativeLayout } from './dreamNarrativeLayouts';
import { pickDreamThemePreset } from './dreamThemePresets';

export function resolveDreamPresentation(seed: string) {
  const layout = pickDreamNarrativeLayout(seed);
  const theme = pickDreamThemePreset(seed);

  return {
    layout,
    theme,
  };
}
