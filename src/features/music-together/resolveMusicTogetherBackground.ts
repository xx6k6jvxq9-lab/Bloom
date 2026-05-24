import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';

export function resolveMusicTogetherBackground(options: {
  musicTogetherBackground?: string | null;
  resolvedMusicTogetherBackgroundUrl?: string | null;
  globalBackground?: string | null;
  resolvedGlobalBackgroundUrl?: string | null;
}): string {
  const musicTogetherBackground = options.musicTogetherBackground?.trim() || '';

  if (musicTogetherBackground) {
    return getDisplayableAssetValue(
      musicTogetherBackground,
      options.resolvedMusicTogetherBackgroundUrl,
    ) || '';
  }

  return getDisplayableAssetValue(
    options.globalBackground,
    options.resolvedGlobalBackgroundUrl,
  ) || '';
}
