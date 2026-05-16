import React from 'react';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';

type ResolvedOfflineAvatarProps = {
  value?: string | null;
  alt: string;
  containerClassName: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

export function ResolvedOfflineAvatar({
  value,
  alt,
  containerClassName,
  imageClassName = 'h-full w-full object-cover',
  fallbackClassName = 'text-[14px] text-zinc-700',
}: ResolvedOfflineAvatarProps) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl) || '';

  return (
    <div className={containerClassName}>
      {src ? (
        <img src={src} alt={alt} className={imageClassName} />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${fallbackClassName}`}>
          {alt.slice(0, 1)}
        </div>
      )}
    </div>
  );
}
