import React, { useState } from 'react';
import { ChevronRight, Heart, LoaderCircle } from 'lucide-react';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import type { MallCatalogItem } from '../../../types';

const PRODUCT_BACKGROUND_MAP: Record<string, string> = {
  'mist-blue': 'linear-gradient(180deg, #eef5ff 0%, #e6eefb 100%)',
  'night-blue': 'linear-gradient(180deg, #f1f5ff 0%, #e9edfb 100%)',
  'warm-amber': 'linear-gradient(180deg, #fff8ef 0%, #f9efdf 100%)',
  'soft-gold': 'linear-gradient(180deg, #fffbea 0%, #f7f0d8 100%)',
  'coffee-brown': 'linear-gradient(180deg, #f9f2ec 0%, #efe4d8 100%)',
  'oak-wood': 'linear-gradient(180deg, #fbf4ee 0%, #f1e6da 100%)',
  'midnight-indigo': 'linear-gradient(180deg, #f2f4ff 0%, #e6eafd 100%)',
  'frost-blue': 'linear-gradient(180deg, #f3f8ff 0%, #e8eff9 100%)',
};
const PRESSABLE_CLASS =
  'touch-manipulation select-none transition duration-150 ease-out active:translate-y-[1px] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50';

function resolveProductBackground(item: MallCatalogItem) {
  return PRODUCT_BACKGROUND_MAP[item.media.backgroundPreset || '']
    || 'linear-gradient(180deg, #f6f7f8 0%, #efefef 100%)';
}

export function ClampText({
  text,
  lines,
  className,
}: {
  text: string;
  lines: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      {text}
    </div>
  );
}

export function ResolvedMallAvatar({
  value,
  name,
}: {
  value?: string | null;
  name: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const [failed, setFailed] = useState(false);
  const fallbackText = (name || '我').slice(0, 1);

  if (!resolvedUrl || failed) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#f1e3da] text-[20px] font-bold text-[#876471]">
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={name}
      className="h-16 w-16 rounded-[18px] object-cover"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function MallQuickEntry({
  title,
  value,
  onClick,
}: {
  title: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${PRESSABLE_CLASS} min-w-[74px] rounded-[16px] border border-zinc-100 bg-white px-4 py-3 text-left shadow-sm`}
    >
      <div className="text-[12px] font-bold text-zinc-900">{value}</div>
      <div className="mt-1 text-[10px] text-zinc-500">{title}</div>
    </button>
  );
}

export function MallListEntry({
  title,
  subtitle,
  value,
  onClick,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${PRESSABLE_CLASS} flex w-full items-center justify-between gap-3 rounded-[16px] px-1 py-3 text-left`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-zinc-900">{title}</div>
        {subtitle ? <div className="mt-1 text-[12px] leading-5 text-zinc-500">{subtitle}</div> : null}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-zinc-400">
        {value ? <span className="max-w-[120px] truncate">{value}</span> : null}
        <ChevronRight size={16} />
      </div>
    </button>
  );
}

export function MallProductThumb({
  item,
  size = 'card',
}: {
  item: MallCatalogItem;
  size?: 'card' | 'detail' | 'cart';
}) {
  const isDetail = size === 'detail';
  const isCart = size === 'cart';
  const heightClass = isDetail ? 'h-72' : isCart ? 'h-24' : 'h-32';
  const emojiSizeClass = isDetail ? 'text-[72px]' : isCart ? 'text-[34px]' : 'text-[44px]';

  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border border-zinc-100 ${heightClass}`}
      style={{ backgroundImage: resolveProductBackground(item) }}
    >
      <div className="absolute inset-x-0 top-0 h-10 bg-[linear-gradient(180deg,rgba(255,255,255,.65),rgba(255,255,255,0))]" />
      <div className="absolute left-3 top-3 rounded-full bg-white/88 px-2.5 py-1 text-[10px] font-medium text-zinc-500 shadow-sm">
        {item.category}
      </div>
      <div className="flex h-full items-center justify-center">
        <div className={`leading-none ${emojiSizeClass}`}>{item.media.fallbackEmoji || '📦'}</div>
      </div>
    </div>
  );
}

export function MallProductCard({
  item,
  priceText,
  onOpen,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  cartBusy = false,
  wishlistBusy = false,
}: {
  item: MallCatalogItem;
  priceText: string;
  onOpen: () => void;
  onAddToCart: () => void;
  onToggleWishlist?: (() => void) | null;
  isWishlisted?: boolean;
  cartBusy?: boolean;
  wishlistBusy?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-zinc-100 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.04)] transition-shadow duration-150 hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]">
      <div className="relative">
        <button type="button" onClick={onOpen} className={`${PRESSABLE_CLASS} block w-full text-left p-2.5`}>
          <MallProductThumb item={item} />
        </button>
        {onToggleWishlist ? (
          <button
            type="button"
            onClick={onToggleWishlist}
            disabled={wishlistBusy}
            aria-label={isWishlisted ? `取消收藏 ${item.title}` : `收藏 ${item.title}`}
            className={`${PRESSABLE_CLASS} absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/88 text-zinc-500 shadow-sm backdrop-blur-sm`}
          >
            {wishlistBusy ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Heart
                size={16}
                className={isWishlisted ? 'fill-current text-[#c56a82]' : ''}
              />
            )}
          </button>
        ) : null}
      </div>
      <div className="space-y-2 px-3.5 pb-3.5">
        <button type="button" onClick={onOpen} className={`${PRESSABLE_CLASS} block w-full text-left`}>
          <div className="text-[14px] font-semibold text-zinc-900">{item.title}</div>
          <div className="mt-1 text-[11px] text-zinc-500">{item.subtitle || item.subCategory || item.category}</div>
        </button>
        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
        <ClampText
          text={item.copy.cardBlurb}
          lines={2}
          className="text-[12px] leading-5 text-zinc-500"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-[18px] font-black tracking-tight text-zinc-900">{priceText}</div>
          <button
            type="button"
            onClick={onAddToCart}
            disabled={cartBusy}
            className={`${PRESSABLE_CLASS} rounded-full bg-[#f4dbe1] px-3 py-2 text-[11px] font-semibold text-[#764e60] shadow-sm`}
          >
            {cartBusy ? <LoaderCircle size={14} className="animate-spin" /> : '加入'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MallCategoryShortcut({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: string;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${PRESSABLE_CLASS} flex flex-col items-center rounded-[18px] bg-white px-3 py-4 text-center shadow-sm hover:bg-zinc-50`}
    >
      <div className="text-[26px] leading-none">{icon}</div>
      <div className="mt-2 text-[12px] font-semibold text-zinc-900">{label}</div>
      {hint ? <div className="mt-1 text-[10px] text-zinc-500">{hint}</div> : null}
    </button>
  );
}

export function MallHeroCarousel({
  slides,
  onAction,
}: {
  slides: Array<{
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    accent: string;
    emoji: string;
    actionLabel: string;
    actionValue: string;
  }>;
  onAction: (value: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex] ?? slides[0];

  if (!activeSlide) {
    return null;
  }

  return (
    <div className="rounded-[20px] bg-white p-3 shadow-sm">
      <div
        className="overflow-hidden rounded-[18px] px-5 py-5 text-white"
        style={{ background: activeSlide.accent }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">{activeSlide.eyebrow}</div>
            <div className="mt-2 text-[22px] font-black tracking-tight">{activeSlide.title}</div>
            <div className="mt-2 text-[12px] leading-5 text-white/85">{activeSlide.description}</div>
            <button
              type="button"
              onClick={() => onAction(activeSlide.actionValue)}
              className={`${PRESSABLE_CLASS} mt-4 rounded-full bg-white/90 px-4 py-2 text-[12px] font-semibold text-zinc-700 shadow-sm`}
            >
              {activeSlide.actionLabel}
            </button>
          </div>
          <div className="text-[54px] leading-none">{activeSlide.emoji}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`${PRESSABLE_CLASS} h-2.5 rounded-full transition-all ${
                index === activeIndex ? 'w-6 bg-zinc-900' : 'w-2.5 bg-zinc-300'
              }`}
              aria-label={`切换到 ${slide.title}`}
            />
          ))}
        </div>
        <div className="text-[10px] text-zinc-400">{activeIndex + 1} / {slides.length}</div>
      </div>
    </div>
  );
}

export function MallFilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${PRESSABLE_CLASS} rounded-full px-3 py-1.5 text-[11px] font-semibold ${
        active
          ? 'bg-[linear-gradient(135deg,#f6d9df_0%,#f4e6d7_100%)] text-[#754e5d] shadow-[0_6px_16px_rgba(188,153,165,0.16)]'
          : 'bg-zinc-100 text-zinc-500'
      }`}
    >
      {label}
    </button>
  );
}

export function MallTimelineStep({
  label,
  reached,
}: {
  label: string;
  reached: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-2.5 w-2.5 rounded-full ${reached ? 'bg-zinc-900' : 'bg-zinc-300'}`} />
      <div className={`text-[12px] ${reached ? 'font-semibold text-zinc-800' : 'text-zinc-400'}`}>{label}</div>
    </div>
  );
}

export function MallDetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-3 last:border-b-0">
      <div className="text-[12px] text-zinc-400">{label}</div>
      <div className="max-w-[68%] text-right text-[12px] leading-5 text-zinc-600">{value}</div>
    </div>
  );
}
