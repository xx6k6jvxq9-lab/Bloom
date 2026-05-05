import React from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ChatHistory, Character, CoupleSpaceData, UserProfileExtended } from '../../../types';
import { buildTaRememberedEntries } from '../../../services/couple-space/interaction/buildTaRememberedEntries';
import { TaRememberedScroll } from './TaRememberedScroll';
import { TaRememberedNoteSheet } from './TaRememberedNoteSheet';

type Props = {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  onBack: () => void;
};

type BallLayout = {
  x: number;
  y: number;
  size: number;
  rotation: number;
  floatDuration: number;
  floatDelay: number;
};

type DragState = {
  entryId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

const CURRENT_PHASE_STAR_CAP = 3;

export function TaRememberedPage({ user, partner, coupleSpace, chatHistory, onBack }: Props) {
  const fieldRef = React.useRef<HTMLDivElement | null>(null);
  const entries = React.useMemo(
    () =>
      buildTaRememberedEntries({
        user,
        partner,
        coupleSpace,
        chatMessages: chatHistory?.[partner.id] || [],
      }),
    [chatHistory, coupleSpace, partner, user],
  );

  const [activeEntryId, setActiveEntryId] = React.useState<string | null>(null);
  const [scrollLayouts, setScrollLayouts] = React.useState<Record<string, BallLayout>>({});
  const dragStateRef = React.useRef<DragState | null>(null);
  const suppressOpenRef = React.useRef<string | null>(null);
  const [refreshSeed, setRefreshSeed] = React.useState(() => Date.now());

  const visibleEntries = React.useMemo(() => {
    const visibleCap = Math.min(getFutureStarCapacity(entries.length), CURRENT_PHASE_STAR_CAP);
    if (entries.length <= visibleCap) return entries;

    const copied = [...entries];
    copied.sort((a, b) => hashString(`${a.id}-${refreshSeed}`) - hashString(`${b.id}-${refreshSeed}`));
    return copied.slice(0, visibleCap);
  }, [entries, refreshSeed]);

  React.useEffect(() => {
    setRefreshSeed(Date.now());
  }, [partner.id]);

  React.useEffect(() => {
    setScrollLayouts((prev) => {
      const next: Record<string, BallLayout> = {};
      visibleEntries.forEach((entry, index) => {
        next[entry.id] = prev[entry.id] || createScrollLayout(entry.id, index);
      });
      return next;
    });
  }, [visibleEntries]);

  const activeEntry = visibleEntries.find((entry) => entry.id === activeEntryId) || null;

  const clampLayout = React.useCallback((x: number, y: number, size: number) => {
    const field = fieldRef.current;
    if (!field) return { x, y };

    const rect = field.getBoundingClientRect();
    const half = size / 2;
    return {
      x: Math.min(Math.max(x, half), Math.max(half, rect.width - half)),
      y: Math.min(Math.max(y, half), Math.max(half, rect.height - half)),
    };
  }, []);

  const handlePointerDown = React.useCallback(
    (entryId: string, event: React.PointerEvent<HTMLDivElement>) => {
      const field = fieldRef.current;
      const layout = scrollLayouts[entryId];
      if (!field || !layout) return;

      const rect = field.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      dragStateRef.current = {
        entryId,
        pointerId: event.pointerId,
        offsetX: pointerX - layout.x,
        offsetY: pointerY - layout.y,
        moved: false,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [scrollLayouts],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      const field = fieldRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId || !field) return;

      const rect = field.getBoundingClientRect();
      const nextLayout = scrollLayouts[dragState.entryId];
      if (!nextLayout) return;

      const rawX = event.clientX - rect.left - dragState.offsetX;
      const rawY = event.clientY - rect.top - dragState.offsetY;
      const clamped = clampLayout(rawX, rawY, nextLayout.size);

      const moved =
        dragState.moved ||
        Math.abs(clamped.x - nextLayout.x) > 4 ||
        Math.abs(clamped.y - nextLayout.y) > 4;

      dragStateRef.current = {
        ...dragState,
        moved,
      };

      setScrollLayouts((prev) => {
        const current = prev[dragState.entryId];
        if (!current) return prev;

        return {
          ...prev,
          [dragState.entryId]: {
            ...current,
            x: clamped.x,
            y: clamped.y,
          },
        };
      });
    },
    [clampLayout, scrollLayouts],
  );

  const handlePointerEnd = React.useCallback((entryId: string, event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || dragState.entryId !== entryId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState.moved) {
      suppressOpenRef.current = entryId;
      window.setTimeout(() => {
        if (suppressOpenRef.current === entryId) {
          suppressOpenRef.current = null;
        }
      }, 0);
    }

    dragStateRef.current = null;
  }, []);

  const handleOpenEntry = React.useCallback((entryId: string) => {
    if (suppressOpenRef.current === entryId) {
      suppressOpenRef.current = null;
      return;
    }

    setActiveEntryId(entryId);
  }, []);

  return (
    <div className="relative overflow-hidden px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] pt-3">
      <style>{`
        @keyframes ta-scroll-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          50% { transform: translate3d(0, -9px, 0) rotate(1.6deg); }
        }
        .ta-memory-scroll {
          animation: ta-scroll-float ease-in-out infinite;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex items-start justify-start px-1">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white/65 px-3 py-1.5 text-sm font-medium text-zinc-500 shadow-[0_10px_30px_rgba(255,255,255,0.55)] backdrop-blur-md transition hover:bg-white/80 hover:text-zinc-700"
        >
          <ChevronLeft size={16} />
          返回互动
        </button>
      </div>

      <div
        ref={fieldRef}
        className="relative min-h-[calc(100vh-210px)] overflow-hidden pt-16"
      >
        {visibleEntries.map((entry) => {
          const layout = scrollLayouts[entry.id];
          if (!layout) return null;

          return (
            <div
              key={entry.id}
              className="absolute touch-none"
              onPointerDown={(event) => handlePointerDown(entry.id, event)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => handlePointerEnd(entry.id, event)}
              onPointerCancel={(event) => handlePointerEnd(entry.id, event)}
              style={{
                left: layout.x,
                top: layout.y,
                width: layout.size,
                height: layout.size,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <TaRememberedScroll
                entry={entry}
                size={layout.size}
                rotation={layout.rotation}
                floatDuration={layout.floatDuration}
                floatDelay={layout.floatDelay}
                onOpen={() => handleOpenEntry(entry.id)}
              />
            </div>
          );
        })}

        {!visibleEntries.length && (
          <div className="mx-auto mt-24 max-w-sm text-center text-sm leading-7 text-zinc-400">
            今天还没有攒出新的纸团。你们再多说几句，我再替你把它们偷偷收起来。
          </div>
        )}
      </div>

      {activeEntry && <TaRememberedNoteSheet entry={activeEntry} onClose={() => setActiveEntryId(null)} />}
    </div>
  );
}

function createScrollLayout(seed: string, index: number): BallLayout {
  const base = hashString(seed);
  const presets = [
    { x: 104, y: 156, size: 118 },
    { x: 222, y: 136, size: 114 },
    { x: 152, y: 292, size: 116 },
    { x: 248, y: 252, size: 112 },
    { x: 106, y: 388, size: 110 },
    { x: 234, y: 396, size: 108 },
    { x: 168, y: 474, size: 106 },
  ] as const;
  const preset = presets[index] || presets[presets.length - 1];

  return {
    x: preset.x + ((base % 10) - 5),
    y: preset.y + (((base >> 3) % 10) - 5),
    size: preset.size,
    rotation: (base % 18) - 9,
    floatDuration: 5.4 + ((base >> 7) % 18) / 10,
    floatDelay: ((base >> 2) % 20) / 10,
  };
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getFutureStarCapacity(entryCount: number) {
  if (entryCount >= 25) return 7;
  if (entryCount >= 16) return 6;
  if (entryCount >= 9) return 5;
  if (entryCount >= 4) return 4;
  return 3;
}
