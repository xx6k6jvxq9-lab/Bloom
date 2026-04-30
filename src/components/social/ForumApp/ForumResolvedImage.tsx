import React from 'react';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';

type ForumResolvedImageProps = {
  value: string;
  alt?: string;
  className?: string;
};

export function ForumResolvedImage({
  value,
  alt = '',
  className,
}: ForumResolvedImageProps) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) return null;

  return <img src={resolvedUrl} alt={alt} className={className} />;
}
