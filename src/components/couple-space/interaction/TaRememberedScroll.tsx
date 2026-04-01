import React from 'react';
import type { TaRememberedEntry } from '../../../services/couple-space/interaction/buildTaRememberedEntries';

type Props = {
  entry: TaRememberedEntry;
  size: number;
  rotation: number;
  floatDuration: number;
  floatDelay: number;
  onOpen: () => void;
};

export function TaRememberedScroll({
  entry,
  size,
  rotation,
  floatDuration,
  floatDelay,
  onOpen,
}: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ta-memory-scroll group relative transition-transform hover:scale-[1.02] active:scale-[0.98]"
      style={{
        width: size,
        height: size,
        transform: `rotate(${rotation}deg)`,
        animationDuration: `${floatDuration}s`,
        animationDelay: `${floatDelay}s`,
      }}
    >
      <span
        className="absolute inset-[12%] border shadow-[0_8px_16px_rgba(188,174,110,0.12)]"
        style={{
          clipPath: 'polygon(50% 6%, 63% 31%, 91% 34%, 71% 54%, 77% 84%, 50% 69%, 23% 84%, 29% 54%, 9% 34%, 37% 31%)',
          background: 'linear-gradient(180deg, #f1e29b 0%, #f1e29b 100%)',
          borderColor: '#f1e29b',
        }}
      />
      <span
        className="absolute inset-[19%] opacity-55"
        style={{
          clipPath: 'polygon(50% 10%, 61% 33%, 86% 36%, 68% 54%, 74% 79%, 50% 66%, 26% 79%, 32% 54%, 14% 36%, 39% 33%)',
          background: 'linear-gradient(180deg, rgba(255,245,191,0.52) 0%, rgba(255,245,191,0.2) 100%)',
        }}
      />
      <span className="sr-only">{entry.text}</span>
    </button>
  );
}
