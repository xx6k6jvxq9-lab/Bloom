import type React from 'react';

function joinClassNames(...values: Array<string | undefined | null | false>): string {
  return values.filter(Boolean).join(' ');
}

export function AvatarFrame({
  src,
  alt,
  size,
  borderRadius,
  borderWidth = 0,
  borderColor = '#e4e4e7',
  fit = 'cover',
  onImageError,
  scopeClassName,
  className,
  onClick,
}: {
  src?: string | null;
  alt?: string;
  size: number;
  borderRadius: number;
  borderWidth?: number;
  borderColor?: string;
  fit?: 'cover' | 'contain';
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  scopeClassName?: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const wrapperStyle = {
    width: size,
    height: size,
    ['--avatar-frame-size' as string]: `${size}px`,
    ['--avatar-frame-radius' as string]: `${borderRadius}px`,
    ['--avatar-frame-border-width' as string]: `${borderWidth}px`,
    ['--avatar-frame-border-color' as string]: borderColor,
  } as React.CSSProperties;

  return (
    <div
      className={joinClassNames('relative inline-flex items-center justify-center overflow-visible', scopeClassName, className)}
      style={wrapperStyle}
      onClick={onClick}
    >
      <div
        className="avatar-frame-shell relative h-full w-full overflow-visible"
        style={{
          borderRadius,
          boxSizing: 'border-box',
        }}
      >
        <div
          className="avatar-frame-media relative h-full w-full overflow-hidden bg-zinc-100"
          style={{
            borderRadius,
            borderWidth,
            borderColor,
            borderStyle: 'solid',
            boxSizing: 'border-box',
          }}
        >
          {src ? (
            <img
              src={src}
              alt={alt}
              onError={onImageError}
              className={`h-full w-full ${fit === 'contain' ? 'bg-white p-0.5 object-contain' : 'object-cover'}`}
            />
          ) : (
            <div className="h-full w-full bg-zinc-100" />
          )}
        </div>
        <span aria-hidden="true" className="avatar-frame-ring pointer-events-none absolute inset-0 rounded-[inherit]" />
        <span aria-hidden="true" className="avatar-frame-badge pointer-events-none">
          <span aria-hidden="true" className="avatar-frame-badge-core pointer-events-none absolute" />
        </span>
        <span aria-hidden="true" className="avatar-frame-clover avatar-frame-clover-top-left pointer-events-none" />
        <span aria-hidden="true" className="avatar-frame-clover avatar-frame-clover-top-right pointer-events-none" />
        <span aria-hidden="true" className="avatar-frame-clover avatar-frame-clover-bottom-right pointer-events-none" />
        <span aria-hidden="true" className="avatar-frame-spark avatar-frame-spark-left pointer-events-none" />
        <span aria-hidden="true" className="avatar-frame-spark avatar-frame-spark-right pointer-events-none" />
        <span aria-hidden="true" className="avatar-frame-heart pointer-events-none" />
        <span aria-hidden="true" className="avatar-frame-charm pointer-events-none">
          <span aria-hidden="true" className="avatar-frame-charm-string pointer-events-none" />
          <span aria-hidden="true" className="avatar-frame-charm-body pointer-events-none">
            <span aria-hidden="true" className="avatar-frame-charm-core pointer-events-none absolute" />
          </span>
        </span>
        <span aria-hidden="true" className="avatar-frame-dot avatar-frame-dot-a pointer-events-none" />
        <span aria-hidden="true" className="avatar-frame-dot avatar-frame-dot-b pointer-events-none" />
        <span aria-hidden="true" className="avatar-frame-dot avatar-frame-dot-c pointer-events-none" />
      </div>
    </div>
  );
}
