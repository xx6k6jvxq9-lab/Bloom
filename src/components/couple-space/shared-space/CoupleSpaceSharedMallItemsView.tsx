import React from 'react';
import { ArchiveRestore, Heart, LoaderCircle, Package } from 'lucide-react';
import type { CoupleSpaceSharedMallItem } from '../../../types';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';

function ResolvedSharedMallCover({
  value,
  alt,
  fallbackEmoji,
}: {
  value?: string;
  alt: string;
  fallbackEmoji?: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (resolvedUrl) {
    return <img src={resolvedUrl} alt={alt} className="h-full w-full object-cover" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center text-[54px] leading-none">
      {fallbackEmoji || '🏠'}
    </div>
  );
}

type Props = {
  items: CoupleSpaceSharedMallItem[];
  partnerName?: string;
  onMoveBack?: (itemId: string) => void;
  isItemBusy?: (itemId: string) => boolean;
};

export function CoupleSpaceSharedMallItemsView({
  items,
  partnerName,
  onMoveBack,
  isItemBusy,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] pt-[112px]">
        <div className="rounded-[28px] bg-white/85 px-6 py-12 text-center shadow-sm backdrop-blur-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-300">
            <Heart size={26} />
          </div>
          <div className="mt-4 text-[16px] font-bold text-zinc-800">共同空间还没有摆上东西</div>
          <div className="mt-2 text-[12px] leading-6 text-zinc-500">
            先去商城把适合陈列的小物件放进来，这里就会慢慢有你们的共同空间。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] pt-[112px]">
      <div className="rounded-[26px] bg-white/80 px-4 py-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-300">
            <Package size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-zinc-900">共同空间陈列</div>
            <div className="mt-1 text-[12px] text-zinc-500">
              {partnerName ? `这里收着你和 ${partnerName} 的空间摆件。` : '这里收着你们一起摆进来的空间物件。'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((entry) => {
          const busy = isItemBusy?.(entry.id) ?? false;

          return (
            <div key={entry.id} className="overflow-hidden rounded-[24px] bg-white/88 shadow-sm backdrop-blur-md">
              <div
                className="relative h-40 overflow-hidden"
                style={{
                  backgroundImage: entry.snapshot.backgroundPreset
                    ? `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.72) 100%)`
                    : 'linear-gradient(180deg, #faf5f5 0%, #f4ede8 100%)',
                }}
              >
                <ResolvedSharedMallCover
                  value={entry.snapshot.coverImage}
                  alt={entry.snapshot.title}
                  fallbackEmoji={entry.snapshot.fallbackEmoji}
                />
                <div className="absolute left-3 top-3 rounded-full bg-white/88 px-2.5 py-1 text-[10px] font-medium text-zinc-500 shadow-sm">
                  {entry.snapshot.category}
                </div>
              </div>
              <div className="space-y-2 px-3.5 pb-3.5 pt-3.5">
                <div className="text-[14px] font-semibold text-zinc-900">{entry.snapshot.title}</div>
                {entry.snapshot.subtitle ? (
                  <div className="text-[11px] text-zinc-500">{entry.snapshot.subtitle}</div>
                ) : null}
                <div className="line-clamp-2 text-[12px] leading-5 text-zinc-500">{entry.snapshot.blurb}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  摆入于 {new Date(entry.placedAt).toLocaleDateString()}
                </div>
                {onMoveBack && entry.sourceOwnedItemId ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onMoveBack(entry.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-600 transition duration-150 ease-out active:translate-y-[1px] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? <LoaderCircle size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                    收回我的物品
                  </button>
                ) : (
                  <div className="rounded-full bg-rose-50 px-3 py-2 text-center text-[11px] font-semibold text-rose-400">
                    已经留在共同空间
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
