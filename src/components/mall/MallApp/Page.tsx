import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ChevronLeft,
  Edit3,
  Heart,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { AppSelect } from '../../shared/AppSelect';
import { createDefaultMallData } from '../../../features/mall/defaultMallData';
import { hydrateMallData } from '../../../features/persistence/mallDataStore';
import {
  resolveCoupleSpaceState,
  resolveCurrentCoupleSpace,
  updateCurrentCoupleSpaceState,
  updatePartnerCoupleSpaceState,
} from '../../../features/persistence/coupleSpaceStore';
import {
  buildMallShareDraftText,
  createMallShareChatMessage,
  type MallShareMode,
} from '../../../features/mall/mallShare';
import { buildMallGiftFeedback, supportsMallGift } from '../../../features/mall/mallGift';
import { isMallItemWishlisted, toggleMallWishlistItem } from '../../../features/mall/mallWishlist';
import {
  createCoupleSpaceSharedMallItem,
  removeCoupleSpaceSharedMallItem,
  resolveMallOwnedOwnership,
  supportsMallSharedSpacePlacement,
  upsertCoupleSpaceSharedMallItems,
} from '../../../features/mall/mallSharedSpace';
import {
  generateMallShelfPlan,
  parseMallSearchIntent,
} from '../../../features/mall/generateMallShelfPlan';
import { generateMallCompanionReply } from '../../../features/mall/generateMallCompanionReply';
import {
  getMallVisibleCategories,
  isPrivateMallItem,
  isMallItemVisibleForMode,
  normalizeMallCategorySelection,
  sanitizeMallGeneratedShelfPlan,
} from '../../../features/mall/mallCatalogView';
import {
  ClampText,
  MallCategoryShortcut,
  MallDetailRow,
  MallFilterPill,
  MallHeroCarousel,
  MallListEntry,
  MallProductCard,
  MallProductThumb,
  MallQuickEntry,
  ResolvedMallAvatar,
  MallTimelineStep,
} from './MallUiPrimitives';
import {
  CATEGORY_ICON_MAP,
  HOME_HERO_SLIDES,
  HOME_MODE_OPTIONS,
  ORDER_FILTER_OPTIONS,
  type MallHomeMode,
  type MallOrderFilter,
} from './MallViewData';
import type {
  AppData,
  AppSettings,
  Character,
  MallAddress,
  MallCartEntry,
  MallCatalogItem,
  MallData,
  MallOrder,
  MallOrderAddressSnapshot,
  MallOrderStatus,
  MallOwnedItem,
  MallOwnedItemOwnership,
  WalletCard,
  WalletData,
} from '../../../types';
import {
  getDirectChatBlockedComposerError,
  getDirectChatBlockedManualReplyError,
} from '../../../features/chat-runtime/directChatDelivery';

type MallAppProps = {
  appData: AppData;
  settings: AppSettings;
  onUpdateAppData: (data: AppData) => void;
  onClose: () => void;
  onOpenChat?: (characterId: string) => void;
};

type MallTab = 'home' | 'browse' | 'cart' | 'me';
type MallMePage = 'overview' | 'wallet' | 'addresses' | 'orders' | 'items' | 'wishlist' | 'deliveries';
type MallNoticeTone = 'info' | 'error';
type MallShelfPlan = {
  title: string;
  description: string;
  itemIds: string[];
  source: 'default' | 'generated' | 'fallback';
  generatedAt: number;
  categoryHint?: string | null;
};
type MallFloatingAskState = {
  itemId: string;
  characterId: string;
  questionText: string;
  replyText: string;
  status: 'loading' | 'success' | 'error';
  updatedAt: number;
};
type MallQueuedNotice = {
  id: string;
  tone: MallNoticeTone;
  text: string;
  durationMs: number;
};
type MallAddToCartResult =
  | { ok: false }
  | {
      ok: true;
      itemTitle: string;
      mode: Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'>;
      quantity: number;
      giftTargetCharacterName?: string;
    };

const PRESSABLE_CLASS =
  'touch-manipulation select-none transition duration-150 ease-out active:translate-y-[1px] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50';
const EMPTY_WALLET_DATA: WalletData = {
  balance: 0,
  yuebaoBalance: 0,
  yuebaoInterest: 0,
  familyCards: [],
  paymentPassword: '',
  cards: [],
  transactions: [],
};

const PRIMARY_BUTTON_CLASS =
  `${PRESSABLE_CLASS} rounded-full bg-[linear-gradient(135deg,#f7d8df_0%,#f2e2cf_100%)] px-4 py-2.5 text-[12px] font-semibold text-[#764e60] shadow-sm`;
const SECONDARY_BUTTON_CLASS =
  `${PRESSABLE_CLASS} rounded-full bg-[#edf2fb] px-4 py-2.5 text-[12px] font-semibold text-[#587097] shadow-sm`;
const ACTIVE_PILL_CLASS =
  'bg-[linear-gradient(135deg,#f6d9df_0%,#f4e6d7_100%)] text-[#754e5d] shadow-[0_6px_16px_rgba(188,153,165,0.16)]';
const WALLET_BALANCE_PAYMENT_ID = 'wallet-balance';

const MALL_ME_PAGE_META: Record<Exclude<MallMePage, 'overview'>, { title: string; subtitle: string }> = {
  wallet: {
    title: '钱包概览',
    subtitle: '查看可用卡片和当前可用于商城支付的余额',
  },
  addresses: {
    title: '收货地址',
    subtitle: '管理默认地址，后续实物商品结算会直接使用这里',
  },
  orders: {
    title: '我的订单',
    subtitle: '统一看订单进度、签收状态和数字商品发放状态',
  },
  items: {
    title: '我的物品',
    subtitle: '查看已经签收或已发放到手的全部内容',
  },
  wishlist: {
    title: '想要清单',
    subtitle: '收一收暂时不急着买、但还想留着看的商品',
  },
  deliveries: {
    title: '最近物流',
    subtitle: '最近几条订单动态会优先收在这里',
  },
};

function formatPrice(value: number) {
  return `\u00A5${value.toFixed(2)}`;
}

function formatMiniTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildRecentViewedItemIds(list: string[], itemId: string) {
  return [itemId, ...list.filter((entry) => entry !== itemId)].slice(0, 12);
}

function scoreMallItemForMode(item: MallCatalogItem, mode: MallHomeMode) {
  switch (mode) {
    case 'gift':
      return (item.destinationKinds.includes('gift') ? 5 : 0)
        + (item.tags.includes('礼物') ? 2 : 0)
        + (item.sceneTags?.includes('礼物') ? 2 : 0)
        + (item.destinationKinds.includes('shared_space') ? 1 : 0);
    case 'companion':
      return (item.destinationKinds.includes('gift') ? 3 : 0)
        + (item.destinationKinds.includes('shared_space') ? 3 : 0)
        + (item.sceneTags?.includes('共同空间') ? 2 : 0)
        + (item.sceneTags?.includes('纪念') ? 1 : 0);
    case 'private':
      return (item.category === '私密' ? 6 : 0)
        + (item.sensitivity === 'private' ? 4 : 0)
        + (item.sensitivity === 'restricted' ? 6 : 0);
    case 'self':
    default:
      return (item.destinationKinds.includes('self') ? 3 : 0)
        + (item.isWearable ? 2 : 0)
        + (item.isConsumable ? 1 : 0)
        + (item.destinationKinds.includes('digital') ? 1 : 0);
  }
}

function buildFallbackShelfPlan(
  catalog: MallCatalogItem[],
  mode: MallHomeMode,
  companionName?: string | null,
  variantSeed: number = 0,
): MallShelfPlan {
  const sortedItems = [...catalog]
    .map((item) => ({ item, score: scoreMallItemForMode(item, mode) }))
    .sort((left, right) => right.score - left.score || left.item.price - right.item.price)
    .map(({ item }) => item);

  const filteredItems = (mode === 'private'
    ? sortedItems.filter((item) => scoreMallItemForMode(item, mode) > 0)
    : sortedItems);
  const rotationIndex = filteredItems.length > 0 ? variantSeed % filteredItems.length : 0;
  const rotatedItems = filteredItems.length > 1
    ? [...filteredItems.slice(rotationIndex), ...filteredItems.slice(0, rotationIndex)]
    : filteredItems;
  const pickedItems = rotatedItems.slice(0, 6);

  switch (mode) {
    case 'gift':
      {
        const variants = companionName
          ? [
              {
                title: `给 ${companionName} 挑一份礼物`,
                description: '优先收一批更适合表达心意、留下反馈和后续余波的商品。',
              },
              {
                title: `${companionName} 可能会记住的那一批`,
                description: '这轮会更偏礼物感、纪念感和后续会被提起的商品。',
              },
            ]
          : [
              {
                title: '挑一份能送出去的礼物',
                description: '优先收一批更适合表达心意、留下反馈和后续余波的商品。',
              },
              {
                title: '这轮更像是在替你挑礼物',
                description: '优先往更有记忆点、更适合送人的商品上靠。',
              },
            ];
        const variant = variants[variantSeed % variants.length];
        return {
          title: variant.title,
          description: variant.description,
          itemIds: pickedItems.map((item) => item.id),
          source: 'default',
          generatedAt: Date.now(),
          categoryHint: pickedItems[0]?.category || null,
        };
      }
    case 'companion':
      {
        const variants = companionName
          ? [
              {
                title: `和 ${companionName} 一起慢慢挑`,
                description: '更偏适合讨论、一起决定，或者最后会一起放进空间里的东西。',
              },
              {
                title: `${companionName} 这轮更在意哪一批`,
                description: '会优先看更适合一起讨论、一起留下来的商品。',
              },
            ]
          : [
              {
                title: '一起逛时更顺手的一批',
                description: '更偏适合讨论、一起决定，或者最后会一起放进空间里的东西。',
              },
              {
                title: '这轮更适合一起慢慢挑',
                description: '会优先把更有共同感的商品往前放。',
              },
            ];
        const variant = variants[variantSeed % variants.length];
        return {
          title: variant.title,
          description: variant.description,
          itemIds: pickedItems.map((item) => item.id),
          source: 'default',
          generatedAt: Date.now(),
          categoryHint: pickedItems[0]?.category || null,
        };
      }
    case 'private':
      {
        const variants = [
          {
            title: '私密区的静场补货',
            description: '更偏只在自己的时间里慢慢用起来、不需要公开感的那一批。',
          },
          {
            title: '更安静也更贴身的一批',
            description: '会把更克制、更私密、更适合夜里和居家的商品往前放。',
          },
        ];
        const variant = variants[variantSeed % variants.length];
        return {
          title: variant.title,
          description: variant.description,
          itemIds: pickedItems.map((item) => item.id),
          source: 'default',
          generatedAt: Date.now(),
          categoryHint: pickedItems[0]?.category || '私密',
        };
      }
    case 'self':
    default:
      {
        const variants = [
          {
            title: '今天先补最常用的那一批',
            description: '更偏日常自购、高频使用和能立刻进入生活的小东西。',
          },
          {
            title: '这一轮更适合先补日常',
            description: '会把更容易马上用起来、不会闲置的商品排在前面。',
          },
        ];
        const variant = variants[variantSeed % variants.length];
        return {
          title: variant.title,
          description: variant.description,
          itemIds: pickedItems.map((item) => item.id),
          source: 'default',
          generatedAt: Date.now(),
          categoryHint: pickedItems[0]?.category || null,
        };
      }
  }
}

function buildFallbackSearchIntent(
  query: string,
  categories: string[],
): { normalizedQuery: string; categoryHint?: string | null; modeHint?: MallHomeMode | null } {
  const normalizedQuery = query.trim();
  const lowerQuery = normalizedQuery.toLowerCase();
  const matchedCategory = categories.find((entry) => normalizedQuery.includes(entry));

  let modeHint: MallHomeMode | null = null;
  if (/送|礼物|礼盒|给他|给她|给ta/i.test(normalizedQuery)) {
    modeHint = 'gift';
  } else if (/一起|共逛|陪我|帮我挑/i.test(normalizedQuery)) {
    modeHint = 'companion';
  } else if (/私密|成人|氛围|睡衣|夜里/i.test(normalizedQuery)) {
    modeHint = 'private';
  } else if (/自己|日常|通勤|补货/i.test(normalizedQuery)) {
    modeHint = 'self';
  }

  const keywordCategoryMap: Array<{ match: RegExp; category: string }> = [
    { match: /香薰|蜡烛|灯|杯|马克杯|夜灯/i, category: '家居' },
    { match: /主题|气泡|手机|数码/i, category: '数码' },
    { match: /睡衣|睡前|居家/i, category: '睡眠' },
    { match: /礼物|送人|纪念/i, category: '礼物' },
    { match: /共同空间|摆件|相框/i, category: '共同空间' },
    { match: /私密|情侣/i, category: '私密' },
  ];

  const matchedKeywordCategory = keywordCategoryMap.find((entry) => entry.match.test(lowerQuery))?.category ?? null;
  const categoryHint = matchedCategory || (matchedKeywordCategory && categories.includes(matchedKeywordCategory) ? matchedKeywordCategory : null);

  return {
    normalizedQuery,
    categoryHint,
    modeHint,
  };
}

function buildCompanionMood(items: MallCatalogItem[], companionName?: string | null) {
  const sharedSpaceCount = items.filter((item) => item.destinationKinds.includes('shared_space')).length;
  const giftCount = items.filter((item) => item.destinationKinds.includes('gift')).length;
  const digitalCount = items.filter((item) => item.destinationKinds.includes('digital')).length;

  if (sharedSpaceCount >= 2) {
    return companionName
      ? `${companionName} 这轮明显在认真看能一起留下来的空间物件。`
      : '这轮更像是在认真看能一起留下来的空间物件。';
  }

  if (giftCount >= 2) {
    return companionName
      ? `${companionName} 今天很容易把话题往“送出去会不会合适”那边带。`
      : '这轮明显更适合挑送得出去的东西。';
  }

  if (digitalCount >= 2) {
    return companionName
      ? `${companionName} 更像是在帮你挑那种能立刻看到变化的小东西。`
      : '这轮更偏想马上看到变化。';
  }

  return companionName
    ? `${companionName} 这轮嘴上不一定多说，但挑东西的方向其实挺明确。`
    : '这轮更像是在安静地陪你慢慢挑。';
}

function buildCompanionItemComment(item: MallCatalogItem, companionName?: string | null) {
  const namePrefix = companionName ? `${companionName}：` : '';

  if (item.destinationKinds.includes('shared_space')) {
    return `${namePrefix}${item.title} 这种更像会被留下来，不是买完就过去了。`;
  }

  if (item.destinationKinds.includes('gift')) {
    return `${namePrefix}${item.title} 拿来送人会更有记忆点，不会太轻飘。`;
  }

  if (item.destinationKinds.includes('digital') && !item.destinationKinds.includes('self')) {
    return `${namePrefix}${item.title} 这种比较适合现在，效果来得快。`;
  }

  return `${namePrefix}${item.title} 更偏日常一点，买回去会比较容易真正用起来。`;
}

function waitForMallUi(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildPendingActionKey(namespace: string, id?: string | null, extra?: string | null) {
  return [namespace, id || '', extra || ''].filter(Boolean).join(':');
}

function MallPendingSpinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return <LoaderCircle className={`${className} animate-spin`} />;
}

function resolveCartMode(
  item: MallCatalogItem,
  preferredMode?: Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'>,
): Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'> {
  if (preferredMode === 'gift' && supportsMallGift(item)) {
    return 'gift';
  }

  if (preferredMode === 'shared_space' && supportsMallSharedSpacePlacement(item)) {
    return 'shared_space';
  }

  return item.destinationKinds.includes('digital') && !item.destinationKinds.includes('self')
    ? 'digital'
    : 'self';
}

function resolveOrderModeLabel(order: MallOrder): string {
  if (order.mode === 'digital') {
    return '数字解锁';
  }

  if (order.mode === 'gift') {
    return order.giftTargetCharacterName?.trim()
      ? `送给 ${order.giftTargetCharacterName.trim()}`
      : '送给 TA';
  }

  if (order.mode === 'shared_space') {
    return '送到共同空间';
  }

  return '送到我这里';
}

function resolveGiftProgressActionLabel(order: MallOrder): string {
  if (order.status === 'paid') return '开始备货';
  if (order.status === 'packing') return '开始派送';
  if (order.status === 'delivering') return '确认送达';
  if (order.status === 'signed') return '完成记录';
  return '';
}

function resolveSharedSpaceProgressActionLabel(order: MallOrder): string {
  if (order.status === 'paid') return '开始发往空间';
  if (order.status === 'delivering') return '确认入仓';
  if (order.status === 'signed') return '完成摆放';
  return '';
}

function resolveOwnedOwnership(item: MallCatalogItem): MallOwnedItemOwnership {
  return resolveMallOwnedOwnership(item);
}

function resolveOrderStatusLabel(status: MallOrderStatus) {
  switch (status) {
    case 'pending_payment':
      return '待付款';
    case 'paid':
      return '已付款';
    case 'packing':
      return '备货中';
    case 'delivering':
      return '配送中';
    case 'signed':
      return '已签收';
    case 'fulfilled':
      return '已完成';
    case 'cancelled':
      return '已取消';
    case 'refunded':
      return '已退款';
    default:
      return '处理中';
  }
}

function resolveOwnershipLabel(ownership: MallOwnedItemOwnership) {
  switch (ownership) {
    case 'wardrobe':
      return '我的衣柜';
    case 'prop':
      return '我的道具';
    case 'digital':
      return '数字物品';
    case 'shared_space':
      return '共同空间';
    case 'gift_record':
      return '送礼记录';
    case 'self':
    default:
      return '我的物品';
  }
}

function resolveSelectedAddress(mallData: MallData): MallAddress | null {
  if (mallData.addresses.length === 0) {
    return null;
  }

  if (mallData.selectedAddressId) {
    const matched = mallData.addresses.find((entry) => entry.id === mallData.selectedAddressId);
    if (matched) {
      return matched;
    }
  }

  return mallData.addresses.find((entry) => entry.isDefault) || mallData.addresses[0] || null;
}

function buildAddressPreview(address: MallAddress | MallOrderAddressSnapshot | null | undefined) {
  if (!address) {
    return '暂未设置收货地址';
  }

  return `${address.region} ${address.detail}`.trim();
}

function buildAddressSnapshot(address: MallAddress): MallOrderAddressSnapshot {
  return {
    recipientName: address.recipientName,
    phone: address.phone,
    region: address.region,
    detail: address.detail,
    ...(address.tag ? { tag: address.tag } : {}),
  };
}

function buildRecentSearches(list: string[], value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return list;
  }

  return [normalized, ...list.filter((item) => item !== normalized)].slice(0, 8);
}

function getCharacterDisplayName(character: Pick<Character, 'name' | 'remarkName'>) {
  return character.remarkName?.trim() || character.name;
}

function getCompanionChatDisabledReason(character: Character | null) {
  if (!character) {
    return '先选一个角色。';
  }

  return getDirectChatBlockedComposerError(character)
    || getDirectChatBlockedManualReplyError(character)
    || '';
}

function buildMallSharePreview(item: MallCatalogItem, mode: MallShareMode) {
  return mode === 'ask'
    ? `[问问TA] ${item.title}`
    : `[分享商品] ${item.title}`;
}

function isPendingOrder(order: MallOrder) {
  return order.status === 'pending_payment' || order.status === 'paid' || order.status === 'packing';
}

function isDoneOrder(order: MallOrder) {
  return order.status === 'signed' || order.status === 'fulfilled';
}

function getOrderTimelineSteps(order: MallOrder) {
  if (order.status === 'cancelled') {
    return [
      { key: 'paid', label: '已支付', reached: order.createdAt > 0 },
      { key: 'cancelled', label: '已取消', reached: true },
    ];
  }

  if (order.status === 'refunded') {
    return [
      { key: 'paid', label: '已支付', reached: true },
      { key: 'refunded', label: '已退款', reached: true },
    ];
  }

  if (order.mode === 'shared_space') {
    return [
      { key: 'paid', label: '已支付', reached: order.status !== 'pending_payment' },
      { key: 'delivering', label: '配送中', reached: ['delivering', 'signed', 'fulfilled'].includes(order.status) },
      { key: 'signed', label: '已到空间仓库', reached: ['signed', 'fulfilled'].includes(order.status) },
      { key: 'fulfilled', label: '已摆放', reached: order.status === 'fulfilled' },
    ];
  }

  if (order.mode === 'gift') {
    const reached = {
      paid: order.status !== 'pending_payment',
      packing: order.status === 'packing' || order.status === 'delivering' || order.status === 'signed' || order.status === 'fulfilled',
      delivering: order.status === 'delivering' || order.status === 'signed' || order.status === 'fulfilled',
      signed: order.status === 'signed' || order.status === 'fulfilled',
      fulfilled: order.status === 'fulfilled',
    };

    return [
      { key: 'paid', label: '已支付', reached: reached.paid },
      { key: 'packing', label: '礼物准备中', reached: reached.packing },
      { key: 'delivering', label: '送往 TA', reached: reached.delivering },
      { key: 'signed', label: 'TA 已收下', reached: reached.signed },
      { key: 'fulfilled', label: '记录已归档', reached: reached.fulfilled },
    ];
  }

  if (order.mode === 'digital') {
    return [
      { key: 'paid', label: '已支付', reached: order.status !== 'pending_payment' },
      { key: 'fulfilled', label: '已发放', reached: order.status === 'fulfilled' },
    ];
  }

  const reached = {
    paid: order.status !== 'pending_payment',
    packing: order.status === 'packing' || order.status === 'delivering' || order.status === 'signed' || order.status === 'fulfilled',
    delivering: order.status === 'delivering' || order.status === 'signed' || order.status === 'fulfilled',
    signed: order.status === 'signed' || order.status === 'fulfilled',
    fulfilled: order.status === 'fulfilled',
  };

  return [
    { key: 'paid', label: '已支付', reached: reached.paid },
    { key: 'packing', label: '备货中', reached: reached.packing },
    { key: 'delivering', label: '配送中', reached: reached.delivering },
    { key: 'signed', label: '已签收', reached: reached.signed },
    { key: 'fulfilled', label: '已完成', reached: reached.fulfilled },
  ];
}

function getOrderFilterCount(orders: MallOrder[], filter: MallOrderFilter) {
  switch (filter) {
    case 'pending':
      return orders.filter(isPendingOrder).length;
    case 'delivering':
      return orders.filter((order) => order.status === 'delivering').length;
    case 'done':
      return orders.filter(isDoneOrder).length;
    case 'digital':
      return orders.filter((order) => order.mode === 'digital').length;
    case 'gift':
      return orders.filter((order) => order.mode === 'gift').length;
    case 'shared_space':
      return orders.filter((order) => order.mode === 'shared_space').length;
    case 'all':
    default:
      return orders.length;
  }
}

function resolveOrderDisplayStatusLabel(order: MallOrder) {
  if (order.mode === 'gift') {
    switch (order.status) {
      case 'signed':
        return 'TA 已收下';
      case 'fulfilled':
        return '已反馈';
      default:
        return resolveOrderStatusLabel(order.status);
    }
  }

  if (order.mode === 'shared_space') {
    switch (order.status) {
      case 'signed':
        return '已到仓';
      case 'fulfilled':
        return '已摆放';
      default:
        return resolveOrderStatusLabel(order.status);
    }
  }

  return resolveOrderStatusLabel(order.status);
}

function buildAddToCartNotice(
  result: Extract<MallAddToCartResult, { ok: true }>,
  options?: { jumpToCart?: boolean },
) {
  const quantitySuffix = result.quantity > 1 ? ` 当前共 ${result.quantity} 件。` : '。';
  const jumpSuffix = options?.jumpToCart ? ' 已为你打开购物车。' : '';

  if (result.mode === 'gift') {
    const targetName = result.giftTargetCharacterName?.trim() || 'TA';
    return `已把「${result.itemTitle}」加入送礼清单，会送给 ${targetName}${quantitySuffix}${jumpSuffix}`.trim();
  }

  if (result.mode === 'shared_space') {
    return `已把「${result.itemTitle}」加入共同空间清单${quantitySuffix}${jumpSuffix}`.trim();
  }

  if (result.mode === 'digital') {
    return `已把「${result.itemTitle}」加入数字商品清单${quantitySuffix}${jumpSuffix}`.trim();
  }

  return `已把「${result.itemTitle}」加入购物车${quantitySuffix}${jumpSuffix}`.trim();
}

function buildCheckoutSuccessNotice(input: {
  orderCount: number;
  physicalCount: number;
  giftCount: number;
  sharedSpaceCount: number;
  digitalCount: number;
}) {
  if (input.orderCount <= 0) {
    return '支付成功。';
  }

  if (input.digitalCount > 0 && input.physicalCount === 0 && input.giftCount === 0 && input.sharedSpaceCount === 0) {
    return `支付成功，已生成 ${input.orderCount} 笔订单。数字商品已经直接到账。`;
  }

  if (input.sharedSpaceCount > 0 && input.physicalCount === 0 && input.giftCount === 0 && input.digitalCount === 0) {
    return `支付成功，已生成 ${input.orderCount} 笔订单。共同空间商品会在后续直接送到空间里。`;
  }

  if (input.digitalCount > 0 || input.sharedSpaceCount > 0) {
    return `支付成功，已生成 ${input.orderCount} 笔订单。数字商品会直接到账，共同空间商品会继续送往空间，其它订单可以去“我的”里查看进度。`;
  }

  return `支付成功，已生成 ${input.orderCount} 笔订单。可以去“我的”里继续查看进度。`;
}

function buildOrderProgressNotice(input: {
  order: MallOrder;
  nextStatus: MallOrderStatus;
  itemTitle: string;
}) {
  const { order, nextStatus, itemTitle } = input;

  if (order.mode === 'gift') {
    const targetName = order.giftTargetCharacterName?.trim() || 'TA';
    if (nextStatus === 'packing') {
      return `已开始为 ${targetName} 准备「${itemTitle}」。`;
    }
    if (nextStatus === 'delivering') {
      return `已开始把「${itemTitle}」送往 ${targetName}。`;
    }
    if (nextStatus === 'signed') {
      return `已记录 ${targetName} 收到「${itemTitle}」。`;
    }
    if (nextStatus === 'fulfilled') {
      return `「${itemTitle}」的送礼记录已经归档。`;
    }
  }

  if (order.mode === 'shared_space') {
    if (nextStatus === 'delivering') {
      return `已开始把「${itemTitle}」送往共同空间。`;
    }
    if (nextStatus === 'signed') {
      return `「${itemTitle}」已经到达共同空间仓库。`;
    }
    if (nextStatus === 'fulfilled') {
      return `「${itemTitle}」已经摆进共同空间。`;
    }
  }

  if (nextStatus === 'packing') {
    return `已开始为「${itemTitle}」备货。`;
  }
  if (nextStatus === 'delivering') {
    return `已推进「${itemTitle}」的物流进度。`;
  }
  if (nextStatus === 'signed') {
    return `已确认收货，「${itemTitle}」已放入你的物品。`;
  }
  if (nextStatus === 'fulfilled') {
    return `「${itemTitle}」已完成入库。`;
  }

  return `「${itemTitle}」的订单状态已更新。`;
}

function buildSharedSpacePlacementNotice(itemTitle: string, partnerName?: string | null) {
  const targetLabel = partnerName?.trim() ? `${partnerName.trim()} 的共同空间` : '共同空间';
  return `已把「${itemTitle}」放进 ${targetLabel}。`;
}

function buildOrderCancellationNotice(itemTitle: string) {
  return `已取消「${itemTitle}」的订单，款项会退回原支付方式。`;
}

function buildOrderRefundNotice(itemTitle: string) {
  return `已为「${itemTitle}」完成退款，款项已退回原支付方式。`;
}

function resolveWalletTransactionCardId(cardId: string | undefined | null) {
  if (!cardId) {
    return WALLET_BALANCE_PAYMENT_ID;
  }

  return cardId === 'wallet' ? WALLET_BALANCE_PAYMENT_ID : cardId;
}

export default function MallApp({ appData, settings, onUpdateAppData, onClose, onOpenChat }: MallAppProps) {
  const mallData: MallData = useMemo(
    () => hydrateMallData(appData.mallData, createDefaultMallData()),
    [appData.mallData],
  );
  const walletData = appData.walletData ?? EMPTY_WALLET_DATA;
  const walletBalance = walletData.balance ?? 0;
  const selectedAddress = resolveSelectedAddress(mallData);

  const [activeTab, setActiveTab] = useState<MallTab>('home');
  const [homeMode, setHomeMode] = useState<MallHomeMode>('self');
  const [isHomeControlCollapsed, setIsHomeControlCollapsed] = useState(true);
  const [mePage, setMePage] = useState<MallMePage>('overview');
  const [orderFilter, setOrderFilter] = useState<MallOrderFilter>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [category, setCategory] = useState('全部');
  const [searchInput, setSearchInput] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [homeShelfPlan, setHomeShelfPlan] = useState<MallShelfPlan | null>(null);
  const [homeShelfFallbackSeed, setHomeShelfFallbackSeed] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressSheetError, setAddressSheetError] = useState<string | null>(null);
  const [showCompanionPanel, setShowCompanionPanel] = useState(false);
  const [detailNoticeQueue, setDetailNoticeQueue] = useState<MallQueuedNotice[]>([]);
  const [pendingActionKeys, setPendingActionKeys] = useState<string[]>([]);
  const [floatingAskState, setFloatingAskState] = useState<MallFloatingAskState | null>(null);
  const [addressDraft, setAddressDraft] = useState({
    recipientName: '',
    phone: '',
    region: '',
    detail: '',
    tag: '家',
  });

  const categories = useMemo(
    () => getMallVisibleCategories(mallData.catalog, homeMode),
    [homeMode, mallData.catalog],
  );
  const modeVisibleCatalog = useMemo(
    () => mallData.catalog.filter((item) => isMallItemVisibleForMode(item, homeMode)),
    [homeMode, mallData.catalog],
  );
  const selectedItem = useMemo(
    () => mallData.catalog.find((item) => item.id === selectedItemId) ?? null,
    [mallData.catalog, selectedItemId],
  );
  const selectedOrder = useMemo(
    () => mallData.orders.find((entry) => entry.id === selectedOrderId) ?? null,
    [mallData.orders, selectedOrderId],
  );
  const cartEntries = useMemo(
    () =>
      mallData.cart
        .map((entry) => ({
          entry,
          item: mallData.catalog.find((catalogItem) => catalogItem.id === entry.itemId) ?? null,
        }))
        .filter((record) => !!record.item),
    [mallData.cart, mallData.catalog],
  );
  const physicalCartEntries = useMemo(
    () => cartEntries.filter(({ entry }) => entry.mode === 'self'),
    [cartEntries],
  );
  const giftCartEntries = useMemo(
    () => cartEntries.filter(({ entry }) => entry.mode === 'gift'),
    [cartEntries],
  );
  const sharedSpaceCartEntries = useMemo(
    () => cartEntries.filter(({ entry }) => entry.mode === 'shared_space'),
    [cartEntries],
  );
  const digitalCartEntries = useMemo(
    () => cartEntries.filter(({ entry }) => entry.mode === 'digital'),
    [cartEntries],
  );
  const ownedEntries = useMemo(
    () =>
      mallData.ownedItems
        .map((entry) => ({
          entry,
          item: mallData.catalog.find((catalogItem) => catalogItem.id === entry.itemId) ?? null,
        }))
        .filter((record) => !!record.item),
    [mallData.catalog, mallData.ownedItems],
  );
  const filteredCatalog = useMemo(() => {
    const normalizedSearch = committedSearch.trim().toLowerCase();

    return modeVisibleCatalog.filter((item) => {
      if (category !== '全部' && item.category !== category) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.title,
        item.subtitle,
        item.category,
        item.subCategory,
        item.copy.cardBlurb,
        item.copy.detailDescription,
        ...(item.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [category, committedSearch, modeVisibleCatalog]);
  const cartTotal = useMemo(
    () => cartEntries.reduce((sum, record) => sum + (record.item?.price || 0) * record.entry.quantity, 0),
    [cartEntries],
  );
  const orderCounts = useMemo(() => ({
    pending: mallData.orders.filter((entry) => entry.status === 'pending_payment' || entry.status === 'paid' || entry.status === 'packing').length,
    delivering: mallData.orders.filter((entry) => entry.status === 'delivering').length,
    done: mallData.orders.filter((entry) => entry.status === 'signed' || entry.status === 'fulfilled').length,
    digital: mallData.orders.filter((entry) => entry.mode === 'digital').length,
    gift: mallData.orders.filter((entry) => entry.mode === 'gift').length,
    sharedSpace: mallData.orders.filter((entry) => entry.mode === 'shared_space').length,
  }), [mallData.orders]);
  const latestDeliveryEvents = useMemo(
    () => mallData.deliveryFeed.slice(0, 4),
    [mallData.deliveryFeed],
  );

  useEffect(() => {
    if (!categories.includes(category)) {
      setCategory('全部');
    }
  }, [categories, category]);

  const filteredOrders = useMemo(() => {
    return mallData.orders.filter((order) => {
      switch (orderFilter) {
        case 'pending':
          return isPendingOrder(order);
        case 'delivering':
          return order.status === 'delivering';
        case 'done':
          return isDoneOrder(order);
        case 'digital':
          return order.mode === 'digital';
        case 'gift':
          return order.mode === 'gift';
        case 'shared_space':
          return order.mode === 'shared_space';
        case 'all':
        default:
          return true;
      }
    });
  }, [mallData.orders, orderFilter]);
  const selectedOrderDeliveryEvents = useMemo(
    () => selectedOrderId
      ? mallData.deliveryFeed.filter((entry) => entry.orderId === selectedOrderId)
      : [],
    [mallData.deliveryFeed, selectedOrderId],
  );
  const companionOptions = useMemo(
    () => appData.characters.map((character) => {
      const disabledReason = getCompanionChatDisabledReason(character);
      return {
        value: character.id,
        label: getCharacterDisplayName(character),
        description: disabledReason || '可以直接聊聊这个商品',
      };
    }),
    [appData.characters],
  );
  const paymentMethodOptions = useMemo(
    () => [
      {
        value: WALLET_BALANCE_PAYMENT_ID,
        label: '账户余额',
        description: `余额 ${formatPrice(walletBalance)}`,
      },
      ...walletData.cards.map((card) => ({
        value: card.id,
        label: `${card.bankName} ${card.number}`,
        description: `余额 ${formatPrice(card.balance)}`,
      })),
    ],
    [walletBalance, walletData.cards],
  );
  const activeCompanionId = useMemo(() => {
    if (mallData.currentShoppingCompanionId && appData.characters.some((character) => character.id === mallData.currentShoppingCompanionId)) {
      return mallData.currentShoppingCompanionId;
    }

    return appData.characters[0]?.id ?? null;
  }, [appData.characters, mallData.currentShoppingCompanionId]);
  const activeCompanion = useMemo(
    () => appData.characters.find((character) => character.id === activeCompanionId) ?? null,
    [activeCompanionId, appData.characters],
  );
  const activeCompanionDisabledReason = useMemo(
    () => getCompanionChatDisabledReason(activeCompanion),
    [activeCompanion],
  );
  const currentCoupleSpaceState = useMemo(
    () => resolveCoupleSpaceState(appData.coupleSpaceState, appData.coupleSpace),
    [appData.coupleSpaceState, appData.coupleSpace],
  );
  const currentCoupleSpace = useMemo(
    () => resolveCurrentCoupleSpace(currentCoupleSpaceState, appData.coupleSpace),
    [currentCoupleSpaceState, appData.coupleSpace],
  );
  const currentCoupleSpacePartner = useMemo(
    () => currentCoupleSpace.partnerId
      ? appData.characters.find((character) => character.id === currentCoupleSpace.partnerId) ?? null
      : null,
    [appData.characters, currentCoupleSpace.partnerId],
  );
  const activeFloatingAskState = useMemo(
    () => (
      selectedItem
      && floatingAskState
      && floatingAskState.itemId === selectedItem.id
        ? floatingAskState
        : null
    ),
    [floatingAskState, selectedItem],
  );
  const activeFloatingAskCharacter = useMemo(
    () => activeFloatingAskState
      ? appData.characters.find((character) => character.id === activeFloatingAskState.characterId) ?? null
      : null,
    [activeFloatingAskState, appData.characters],
  );
  const wishlistedItemIds = useMemo(() => new Set(mallData.wishlist), [mallData.wishlist]);
  const wishlistEntries = useMemo(
    () => mallData.wishlist
      .map((itemId) => mallData.catalog.find((entry) => entry.id === itemId) ?? null)
      .filter((item): item is MallCatalogItem => !!item),
    [mallData.catalog, mallData.wishlist],
  );
  const recentViewedEntries = useMemo(
    () => mallData.recentViewedItemIds
      .map((itemId) => mallData.catalog.find((entry) => entry.id === itemId) ?? null)
      .filter((item): item is MallCatalogItem => !!item)
      .filter((item) => isMallItemVisibleForMode(item, homeMode)),
    [homeMode, mallData.catalog, mallData.recentViewedItemIds],
  );
  const resolvedHomeShelfPlan = useMemo(
    () => homeShelfPlan && homeShelfPlan.itemIds.length > 0
      ? homeShelfPlan
      : buildFallbackShelfPlan(modeVisibleCatalog, homeMode, currentCoupleSpacePartner?.name, homeShelfFallbackSeed),
    [currentCoupleSpacePartner?.name, homeMode, homeShelfFallbackSeed, homeShelfPlan, modeVisibleCatalog],
  );
  const homeShelfItems = useMemo(
    () => resolvedHomeShelfPlan.itemIds
      .map((itemId) => mallData.catalog.find((entry) => entry.id === itemId) ?? null)
      .filter((item): item is MallCatalogItem => !!item),
    [mallData.catalog, resolvedHomeShelfPlan],
  );
  const companionCommentItems = useMemo(
    () => homeMode === 'companion'
      ? [...homeShelfItems]
        .sort((left, right) => scoreMallItemForMode(right, 'companion') - scoreMallItemForMode(left, 'companion'))
        .slice(0, 2)
      : [],
    [homeMode, homeShelfItems],
  );
  const companionMoodText = useMemo(
    () => homeMode === 'companion'
      ? buildCompanionMood(homeShelfItems, activeCompanion ? getCharacterDisplayName(activeCompanion) : null)
      : '',
    [activeCompanion, homeMode, homeShelfItems],
  );
  const activeDetailNotice = detailNoticeQueue[0] ?? null;
  const pendingActionSet = useMemo(() => new Set(pendingActionKeys), [pendingActionKeys]);
  const floatingAskRequestIdRef = useRef(0);
  const pendingActionKeysRef = useRef(new Set<string>());
  const isMallAppMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMallAppMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedCardId && paymentMethodOptions.some((option) => option.value === selectedCardId)) {
      return;
    }

    if (paymentMethodOptions.length > 0) {
      setSelectedCardId(paymentMethodOptions[0].value);
    }
  }, [paymentMethodOptions, selectedCardId]);

  useEffect(() => {
    setHomeShelfPlan((current) => {
      if (!current) {
        return current;
      }

      const filteredItemIds = current.itemIds.filter((itemId) => mallData.catalog.some((item) => item.id === itemId));
      if (filteredItemIds.length === current.itemIds.length) {
        return current;
      }

      return {
        ...current,
        itemIds: filteredItemIds,
      };
    });
  }, [mallData.catalog]);

  useEffect(() => {
    setHomeShelfPlan(null);
    setHomeShelfFallbackSeed(0);
  }, [homeMode]);

  useEffect(() => {
    setFloatingAskState((current) => {
      if (!current) return null;
      if (!selectedItemId) return null;
      return current.itemId === selectedItemId ? current : null;
    });
  }, [selectedItemId]);

  useEffect(() => {
    if (!activeDetailNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setDetailNoticeQueue((current) => (
        current[0]?.id === activeDetailNotice.id
          ? current.slice(1)
          : current.filter((entry) => entry.id !== activeDetailNotice.id)
      ));
    }, activeDetailNotice.durationMs);

    return () => window.clearTimeout(timer);
  }, [activeDetailNotice]);

  useEffect(() => {
    if (!showAddressSheet) {
      return;
    }

    const editingAddress = editingAddressId
      ? mallData.addresses.find((entry) => entry.id === editingAddressId) ?? null
      : null;

    setAddressDraft({
      recipientName: editingAddress?.recipientName ?? '',
      phone: editingAddress?.phone ?? '',
      region: editingAddress?.region ?? '',
      detail: editingAddress?.detail ?? '',
      tag: editingAddress?.tag ?? '家',
    });
    setAddressSheetError(null);
  }, [editingAddressId, mallData.addresses, showAddressSheet]);

  const updateMallData = (nextMallData: MallData, nextWalletData?: WalletData) => {
    onUpdateAppData({
      ...appData,
      mallData: nextMallData,
      ...(nextWalletData ? { walletData: nextWalletData } : {}),
    });
  };

  const updateMallAndCoupleSpace = (
    nextMallData: MallData,
    nextCoupleSpaceState: AppData['coupleSpaceState'],
    nextCoupleSpace: AppData['coupleSpace'],
    nextWalletData?: WalletData,
  ) => {
    onUpdateAppData({
      ...appData,
      mallData: nextMallData,
      coupleSpaceState: nextCoupleSpaceState,
      coupleSpace: nextCoupleSpace,
      ...(nextWalletData ? { walletData: nextWalletData } : {}),
    });
  };

  const removeSharedMallItemsFromAllSpaces = (matcher: (entry: NonNullable<NonNullable<AppData['coupleSpace']>['sharedMallItems']>[number]) => boolean) => {
    const nextSpaces = Object.entries(currentCoupleSpaceState.spacesByPartnerId || {}).reduce<Record<string, NonNullable<AppData['coupleSpaceState']>['spacesByPartnerId'][string]>>((acc, [partnerId, space]) => {
      acc[partnerId] = {
        ...space,
        sharedMallItems: (space.sharedMallItems || []).filter((entry) => !matcher(entry)),
      };
      return acc;
    }, {});

    const nextCoupleSpaceState: NonNullable<AppData['coupleSpaceState']> = {
      ...currentCoupleSpaceState,
      spacesByPartnerId: nextSpaces,
    };

    return {
      coupleSpaceState: nextCoupleSpaceState,
      coupleSpace: resolveCurrentCoupleSpace(nextCoupleSpaceState, appData.coupleSpace),
    };
  };

  const showDetailNotice = (tone: MallNoticeTone, text: string) => {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return;
    }

    const nextNotice: MallQueuedNotice = {
      id: `mall-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tone,
      text: normalizedText,
      durationMs: tone === 'error' ? 3600 : 2400,
    };

    setDetailNoticeQueue((current) => {
      const lastNotice = current[current.length - 1];
      if (lastNotice && lastNotice.tone === nextNotice.tone && lastNotice.text === nextNotice.text) {
        return [...current.slice(0, -1), nextNotice];
      }

      return [...current, nextNotice];
    });
  };

  const clearDetailNotices = () => {
    setDetailNoticeQueue([]);
  };

  const isActionPending = (key: string) => pendingActionSet.has(key);

  const runPendingAction = async <T,>(
    key: string,
    action: () => Promise<T> | T,
    options?: { minDurationMs?: number },
  ): Promise<T | undefined> => {
    if (pendingActionKeysRef.current.has(key)) {
      return undefined;
    }

    pendingActionKeysRef.current.add(key);
    if (isMallAppMountedRef.current) {
      setPendingActionKeys(Array.from(pendingActionKeysRef.current));
    }
    const startedAt = Date.now();

    try {
      return await action();
    } finally {
      const minDurationMs = options?.minDurationMs ?? 0;
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < minDurationMs) {
        await waitForMallUi(minDurationMs - elapsedMs);
      }
      pendingActionKeysRef.current.delete(key);
      if (isMallAppMountedRef.current) {
        setPendingActionKeys(Array.from(pendingActionKeysRef.current));
      }
    }
  };

  const selectShoppingCompanion = (characterId: string) => {
    updateMallData({
      ...mallData,
      currentShoppingCompanionId: characterId,
    });
  };

  const pushMallMessageToChat = (item: MallCatalogItem, mode: MallShareMode) => {
    if (!activeCompanionId || !activeCompanion) {
      showDetailNotice('error', '先选一个角色，再把商品带进聊天。');
      return;
    }

    const disabledReason = getCompanionChatDisabledReason(activeCompanion);
    if (disabledReason) {
      showDetailNotice('error', disabledReason);
      return;
    }

    const newMessage = createMallShareChatMessage(item, mode);
    const currentHistory = appData.chatHistory?.[activeCompanionId] || [];
    const nextMallData = {
      ...mallData,
      currentShoppingCompanionId: activeCompanionId,
    };
    const updatedCharacters = appData.characters.map((character) => (
      character.id === activeCompanionId
        ? {
            ...character,
            lastMessage: buildMallSharePreview(item, mode),
            lastTime: newMessage.timestamp,
          }
        : character
    ));

    onUpdateAppData({
      ...appData,
      mallData: nextMallData,
      chatHistory: {
        ...appData.chatHistory,
        [activeCompanionId]: [...currentHistory, newMessage],
      },
      characters: updatedCharacters,
    });

    setShowCompanionPanel(false);
    showDetailNotice('info', `已经把商品分享给 ${getCharacterDisplayName(activeCompanion)}。`);
    onOpenChat?.(activeCompanionId);
  };

  const askCompanionInline = async (item: MallCatalogItem) => {
    if (!activeCompanionId || !activeCompanion) {
      showDetailNotice('error', '先选一个角色，再问 TA。');
      return;
    }

    const disabledReason = getCompanionChatDisabledReason(activeCompanion);
    if (disabledReason) {
      showDetailNotice('error', disabledReason);
      return;
    }

    const questionText = buildMallShareDraftText(item, 'ask');
    const requestId = floatingAskRequestIdRef.current + 1;
    floatingAskRequestIdRef.current = requestId;

    setShowCompanionPanel(true);
    clearDetailNotices();
    setFloatingAskState({
      itemId: item.id,
      characterId: activeCompanionId,
      questionText,
      replyText: '',
      status: 'loading',
      updatedAt: Date.now(),
    });

    try {
      const replyText = await generateMallCompanionReply({
        settings,
        character: activeCompanion,
        item,
        userName: appData.userProfile.name || '用户',
      });

      if (floatingAskRequestIdRef.current !== requestId) {
        return;
      }

      setFloatingAskState({
        itemId: item.id,
        characterId: activeCompanionId,
        questionText,
        replyText,
        status: 'success',
        updatedAt: Date.now(),
      });
    } catch (error) {
      if (floatingAskRequestIdRef.current !== requestId) {
        return;
      }

      const errorText = error instanceof Error ? error.message : '这次没有拿到有效回复，请再问一次。';
      setFloatingAskState({
        itemId: item.id,
        characterId: activeCompanionId,
        questionText,
        replyText: errorText,
        status: 'error',
        updatedAt: Date.now(),
      });
    }
  };

  const renderCompanionOverlay = (layout: {
    orbBottomClass: string;
    panelBottomClass: string;
  }) => {
    if (companionOptions.length === 0) {
      return null;
    }

    const hasSelectedItem = !!selectedItem;
    const hasFloatingConversation = !!(hasSelectedItem && activeFloatingAskState);
    const sharePending = hasSelectedItem ? isActionPending(buildSharePendingKey(selectedItem.id)) : false;
    const askPending = hasSelectedItem ? isActionPending(buildAskPendingKey(selectedItem.id)) : false;

    return (
      <>
        {showCompanionPanel ? (
          <button
            type="button"
            aria-label="close companion panel"
            onClick={() => setShowCompanionPanel(false)}
            className="absolute inset-0 z-[18] bg-black/5"
          />
        ) : null}
        {showCompanionPanel ? (
          <div className={`absolute right-4 z-[26] ${layout.panelBottomClass} w-[min(340px,calc(100%-2rem))] rounded-[28px] bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.18)]`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ResolvedMallAvatar
                  value={activeCompanion?.avatar}
                  name={activeCompanion ? getCharacterDisplayName(activeCompanion) : 'TA'}
                />
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Mall Companion</div>
                  <div className="mt-1 truncate text-[16px] font-bold text-zinc-900">
                    {activeCompanion ? getCharacterDisplayName(activeCompanion) : '先选一个角色'}
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    这里会记住当前陪逛角色，整个商城都能用。
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanionPanel(false)}
                className={`${PRESSABLE_CLASS} flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-zinc-400">当前角色</div>
              <AppSelect
                value={activeCompanionId || ''}
                onChange={selectShoppingCompanion}
                options={companionOptions}
                placeholder="选一个角色"
              />
            </div>
            <div
              className={`mt-4 rounded-[18px] px-4 py-3 text-[12px] ${
                activeCompanionDisabledReason
                  ? 'bg-[#fff4f4] text-[#9b5962]'
                  : 'bg-[#f7f1ff] text-[#6f5a94]'
              }`}
            >
              <div className="flex items-start gap-2">
                {activeCompanionDisabledReason ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <Sparkles size={16} className="mt-0.5 shrink-0" />}
                <div className="leading-5">
                  {activeCompanionDisabledReason || (hasSelectedItem
                    ? '分享会跳聊天；问问 TA 会直接在当前商品页显示消息。'
                    : '当前在商城全局待命。打开任意商品详情后，就能直接问问 TA。')}
                </div>
              </div>
            </div>
            {hasFloatingConversation ? (
              <div className="mt-4 rounded-[20px] bg-[#fbf7f8] p-4">
                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-[18px] bg-white px-4 py-3 text-[13px] leading-6 text-zinc-700 shadow-sm">
                    {activeFloatingAskState.questionText}
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f4dbe1_0%,#f3eadf_100%)] text-[12px] font-bold text-[#7b5a68]">
                    {(activeFloatingAskCharacter ? getCharacterDisplayName(activeFloatingAskCharacter) : 'TA').slice(0, 1)}
                  </div>
                  <div className={`max-w-[88%] rounded-[18px] px-4 py-3 text-[13px] leading-6 ${
                    activeFloatingAskState.status === 'error'
                      ? 'bg-[#fff1f2] text-[#9f4155]'
                      : 'bg-[linear-gradient(135deg,#fff5f7_0%,#fffaf2_100%)] text-zinc-700'
                  }`}>
                    {activeFloatingAskState.status === 'loading'
                      ? `正在问 ${activeFloatingAskCharacter ? getCharacterDisplayName(activeFloatingAskCharacter) : 'TA'}...`
                      : activeFloatingAskState.replyText}
                  </div>
                </div>
                <div className="mt-3 text-right text-[10px] text-zinc-400">
                  {formatMiniTime(activeFloatingAskState.updatedAt)}
                </div>
              </div>
            ) : null}
            {hasSelectedItem ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!activeCompanion || !!activeCompanionDisabledReason || sharePending}
                    onClick={() => handleShareItemAction(selectedItem, 'share')}
                    className={`${PRESSABLE_CLASS} flex items-center justify-center gap-2 rounded-full bg-[#edf2fb] px-4 py-3 text-[12px] font-semibold text-[#587097]`}
                  >
                    {sharePending ? <MallPendingSpinner className="h-4 w-4" /> : <Share2 size={15} />}
                    分享给TA
                  </button>
                  <button
                    type="button"
                    disabled={!activeCompanion || !!activeCompanionDisabledReason || askPending}
                    onClick={() => handleAskCompanionAction(selectedItem)}
                    className={`${PRESSABLE_CLASS} flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#f7d8df_0%,#f2e2cf_100%)] px-4 py-3 text-[12px] font-semibold text-[#764e60]`}
                  >
                    {askPending ? <MallPendingSpinner className="h-4 w-4" /> : <MessageCircle size={15} />}
                    问问TA
                  </button>
                </div>
                <div className="mt-3 text-[11px] leading-5 text-zinc-400">
                  分享会附带商品卡；问问 TA 会在当前商品页直接给你即时判断。
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setShowCompanionPanel((current) => !current)}
          className={`${PRESSABLE_CLASS} absolute right-4 z-[24] ${layout.orbBottomClass} flex items-center gap-3 rounded-full bg-white/96 px-3 py-2.5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.16)]`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f4dbe1_0%,#f3eadf_100%)] text-[13px] font-bold text-[#7b5a68]">
            {(activeCompanion ? getCharacterDisplayName(activeCompanion) : 'TA').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-900">
              问问TA
              <Sparkles size={13} className="text-[#8a6bb1]" />
            </div>
            <div className="max-w-[120px] truncate text-[10px] text-zinc-400">
              {activeCompanion ? getCharacterDisplayName(activeCompanion) : '选角色'}
            </div>
          </div>
        </button>
      </>
    );
  };

  const renderGlobalNotice = () => {
    if (!activeDetailNotice) {
      return null;
    }

    return (
      <div className="pointer-events-none absolute inset-x-0 top-[92px] z-[30] px-4">
        <div
          role={activeDetailNotice.tone === 'error' ? 'alert' : 'status'}
          aria-live={activeDetailNotice.tone === 'error' ? 'assertive' : 'polite'}
          className={`rounded-[18px] px-4 py-3 text-[12px] font-medium shadow-[0_16px_40px_rgba(15,23,42,0.12)] ${
            activeDetailNotice.tone === 'error'
              ? 'bg-[#fff1f2] text-[#9f4155]'
              : 'bg-[#eef6ff] text-[#476786]'
          }`}
        >
          {activeDetailNotice.text}
        </div>
      </div>
    );
  };

  const commitSearch = async () => {
    const normalized = searchInput.trim();
    setCommittedSearch(normalized);
    if (!normalized) {
      return;
    }

    const fallbackSearchIntent = buildFallbackSearchIntent(normalized, categories);
    let aiSearchIntent = null;

    try {
      aiSearchIntent = await parseMallSearchIntent({
        settings,
        query: normalized,
        categories,
      });
    } catch {
      aiSearchIntent = null;
    }

    const searchIntent = {
      normalizedQuery: aiSearchIntent?.normalizedQuery || fallbackSearchIntent.normalizedQuery || normalized,
      categoryHint: aiSearchIntent?.categoryHint ?? fallbackSearchIntent.categoryHint ?? null,
      modeHint: aiSearchIntent?.modeHint ?? fallbackSearchIntent.modeHint ?? null,
    };
    const resolvedQuery = searchIntent.normalizedQuery || normalized;
    const targetMode = searchIntent.modeHint ?? homeMode;
    const resolvedCategory = normalizeMallCategorySelection(searchIntent.categoryHint, mallData.catalog, targetMode);
    const currentCategoryInTargetMode = normalizeMallCategorySelection(category, mallData.catalog, targetMode);

    setCommittedSearch(resolvedQuery);
    setSearchInput(resolvedQuery);
    if (searchIntent.modeHint) {
      setHomeMode(searchIntent.modeHint);
    }
    if (resolvedCategory) {
      setCategory(resolvedCategory);
    } else if (!currentCategoryInTargetMode) {
      setCategory('全部');
    }

    updateMallData({
      ...mallData,
      recentSearches: buildRecentSearches(mallData.recentSearches, resolvedQuery),
    });
  };

  const buildWishlistPendingKey = (itemId: string) => buildPendingActionKey('wishlist', itemId);
  const buildAddToCartPendingKey = (
    itemId: string,
    mode?: Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'>,
  ) => buildPendingActionKey('cart-add', itemId, mode || 'self');
  const buildBuyNowPendingKey = (
    itemId: string,
    mode?: Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'>,
  ) => buildPendingActionKey('buy-now', itemId, mode || 'self');
  const buildSharePendingKey = (itemId: string) => buildPendingActionKey('share', itemId, activeCompanionId || 'none');
  const buildAskPendingKey = (itemId: string) => buildPendingActionKey('ask', itemId, activeCompanionId || 'none');
  const buildOrderProgressPendingKey = (orderId: string) => buildPendingActionKey('order-progress', orderId);
  const buildSharedSpacePendingKey = (ownedItemId: string) => buildPendingActionKey('shared-space-place', ownedItemId);
  const buildCancelOrderPendingKey = (orderId: string) => buildPendingActionKey('order-cancel', orderId);
  const buildRefundOrderPendingKey = (orderId: string) => buildPendingActionKey('order-refund', orderId);
  const buildAddressActionPendingKey = (action: 'save' | 'default' | 'remove', addressId?: string) => (
    buildPendingActionKey(`address-${action}`, addressId || 'current')
  );
  const buildShelfRefreshPendingKey = () => 'shelf-refresh';
  const buildSearchCommitPendingKey = () => 'search-commit';

  const openMallItemDetail = (itemId: string) => {
    updateMallData({
      ...mallData,
      recentViewedItemIds: buildRecentViewedItemIds(mallData.recentViewedItemIds, itemId),
    });
    setSelectedItemId(itemId);
  };

  const resolveDefaultModeAction = (
    item: MallCatalogItem,
  ): Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'> | undefined => {
    if (homeMode === 'gift' && supportsMallGift(item)) {
      return 'gift';
    }

    if (homeMode === 'private' && item.destinationKinds.includes('digital') && !item.destinationKinds.includes('self')) {
      return 'digital';
    }

    return undefined;
  };

  const refreshHomeShelf = async () => {
    const nextFallbackSeed = homeShelfFallbackSeed + 1;
    const fallbackPlan = buildFallbackShelfPlan(
      modeVisibleCatalog,
      homeMode,
      currentCoupleSpacePartner?.name,
      nextFallbackSeed,
    );
    const shouldUseAiRefresh = modeVisibleCatalog.length >= 4 && homeMode !== 'private';

    if (!shouldUseAiRefresh) {
      setHomeShelfFallbackSeed(nextFallbackSeed);
      setHomeShelfPlan({
        ...fallbackPlan,
        source: 'fallback',
        generatedAt: Date.now(),
      });
      return;
    }

    try {
      const generatedPlan = await generateMallShelfPlan({
        settings,
        mode: homeMode,
        userName: appData.userProfile.name || '用户',
        companionName: currentCoupleSpacePartner?.name || activeCompanion?.name || null,
        catalog: modeVisibleCatalog,
        wishlistTitles: wishlistEntries.map((item) => item.title),
        recentSearches: mallData.recentSearches,
        recentViewedTitles: recentViewedEntries.map((item) => item.title),
      });
      const sanitizedPlan = sanitizeMallGeneratedShelfPlan(generatedPlan, mallData.catalog, homeMode);

      if (!sanitizedPlan) {
        throw new Error('Invalid mall shelf plan');
      }

      setHomeShelfPlan({
        ...sanitizedPlan,
        source: 'generated',
        generatedAt: Date.now(),
      });
      if (sanitizedPlan.categoryHint) {
        setCategory(sanitizedPlan.categoryHint);
      }
      return;
    } catch {
      setHomeShelfFallbackSeed(nextFallbackSeed);
      setHomeShelfPlan({
        ...fallbackPlan,
        source: 'fallback',
        generatedAt: Date.now(),
      });
    }
  };

  const handleRefreshHomeShelfAction = () => {
    void runPendingAction(
      buildShelfRefreshPendingKey(),
      () => refreshHomeShelf(),
      { minDurationMs: 540 },
    );
  };

  const handleSearchCommitAction = () => {
    void runPendingAction(
      buildSearchCommitPendingKey(),
      async () => {
        await commitSearch();
        setActiveTab('browse');
      },
      { minDurationMs: 320 },
    );
  };

  const addToCart = (
    item: MallCatalogItem,
    preferredMode?: Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'>,
    options?: { silentNotice?: boolean },
  ): MallAddToCartResult => {
    const mode = resolveCartMode(item, preferredMode);
    const giftTarget = mode === 'gift'
      ? (() => {
          if (!activeCompanionId || !activeCompanion) {
            setShowCompanionPanel(true);
            showDetailNotice('error', '先选一个角色，再把这件礼物送出去。');
            return null;
          }

          return {
            giftTargetCharacterId: activeCompanionId,
            giftTargetCharacterName: getCharacterDisplayName(activeCompanion),
          };
        })()
      : null;
    const sharedSpaceTargetReady = mode !== 'shared_space' || !!currentCoupleSpace.partnerId;

    if (mode === 'gift' && !giftTarget) {
      return { ok: false };
    }

    if (!sharedSpaceTargetReady) {
      showDetailNotice('error', '先建立情侣空间，再把这件商品送到共同空间。');
      return { ok: false };
    }

    const existing = mallData.cart.find((entry) => (
      entry.itemId === item.id
      && entry.mode === mode
      && (mode !== 'gift' || entry.giftTargetCharacterId === giftTarget?.giftTargetCharacterId)
    ));
    const nextQuantity = existing ? existing.quantity + 1 : 1;
    const nextCart = existing
      ? mallData.cart.map((entry) => (
          entry.id === existing.id
            ? { ...entry, quantity: nextQuantity }
            : entry
        ))
      : [
          {
            id: `mall-cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            itemId: item.id,
            quantity: 1,
            mode,
            ...(giftTarget || {}),
            addedAt: Date.now(),
          },
          ...mallData.cart,
        ];

    updateMallData({
      ...mallData,
      cart: nextCart,
    });

    const addResult: Extract<MallAddToCartResult, { ok: true }> = {
      ok: true,
      itemTitle: item.title,
      mode,
      quantity: nextQuantity,
      ...(giftTarget?.giftTargetCharacterName
        ? { giftTargetCharacterName: giftTarget.giftTargetCharacterName }
        : {}),
    };

    if (!options?.silentNotice) {
      showDetailNotice('info', buildAddToCartNotice(addResult));
    }

    return addResult;
  };

  const toggleWishlist = (
    item: MallCatalogItem,
    options?: { silentNotice?: boolean },
  ) => {
    const currentlyWishlisted = isMallItemWishlisted(mallData.wishlist, item.id);
    const nextWishlist = toggleMallWishlistItem(mallData.wishlist, item.id);

    updateMallData({
      ...mallData,
      wishlist: nextWishlist,
    });

    if (!options?.silentNotice) {
      showDetailNotice(
        'info',
        currentlyWishlisted
          ? `已从想要清单移除「${item.title}」。`
          : `已把「${item.title}」加入想要清单。`,
      );
    }

    return !currentlyWishlisted;
  };

  const handleToggleWishlistAction = (item: MallCatalogItem) => {
    void runPendingAction(
      buildWishlistPendingKey(item.id),
      () => toggleWishlist(item),
      { minDurationMs: 220 },
    );
  };

  const handleAddToCartAction = (
    item: MallCatalogItem,
    preferredMode?: Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'>,
  ) => {
    void runPendingAction(
      buildAddToCartPendingKey(item.id, preferredMode),
      () => addToCart(item, preferredMode),
      { minDurationMs: 260 },
    );
  };

  const handleBuyNowAction = (
    item: MallCatalogItem,
    preferredMode?: Extract<MallCartEntry['mode'], 'self' | 'gift' | 'shared_space' | 'digital'>,
  ) => {
    void runPendingAction(
      buildBuyNowPendingKey(item.id, preferredMode),
      () => {
        const addResult = addToCart(item, preferredMode, { silentNotice: true });
        if (!addResult.ok) {
          return addResult;
        }

        setSelectedItemId(null);
        setActiveTab('cart');
        showDetailNotice('info', buildAddToCartNotice(addResult, { jumpToCart: true }));
        return addResult;
      },
      { minDurationMs: 320 },
    );
  };

  const handleShareItemAction = (item: MallCatalogItem, mode: MallShareMode = 'share') => {
    if (homeMode === 'private' || isPrivateMallItem(item)) {
      showDetailNotice('error', '私密专区商品不会直接分享进普通聊天。');
      return;
    }

    void runPendingAction(
      buildSharePendingKey(item.id),
      () => pushMallMessageToChat(item, mode),
      { minDurationMs: 280 },
    );
  };

  const handleAskCompanionAction = (item: MallCatalogItem) => {
    void runPendingAction(
      buildAskPendingKey(item.id),
      () => askCompanionInline(item),
      { minDurationMs: 600 },
    );
  };

  const placeOwnedItemIntoSharedSpace = (ownedItemId: string) => {
    const ownedItem = mallData.ownedItems.find((entry) => entry.id === ownedItemId) ?? null;
    if (!ownedItem) {
      showDetailNotice('error', '这件物品暂时找不到了。');
      return;
    }

    const item = mallData.catalog.find((entry) => entry.id === ownedItem.itemId) ?? null;
    if (!item) {
      showDetailNotice('error', '这件商品的数据暂时不完整。');
      return;
    }

    if (!supportsMallSharedSpacePlacement(item)) {
      showDetailNotice('error', '这件物品暂时不能放进共同空间。');
      return;
    }

    if (!currentCoupleSpace.partnerId) {
      showDetailNotice('error', '先建立情侣空间，再把这件物品放进去。');
      return;
    }

    if (ownedItem.ownership === 'shared_space') {
      showDetailNotice('info', `「${item.title}」已经在共同空间里了。`);
      return;
    }

    const placedAt = Date.now();
    const nextSharedItem = createCoupleSpaceSharedMallItem(item, {
      sourceOrderId: ownedItem.sourceOrderId,
      sourceOwnedItemId: ownedItem.id,
      placedAt,
      placedBy: 'user',
      placementReason: 'manual',
    });
    const { coupleSpaceState, coupleSpace } = updateCurrentCoupleSpaceState(
      currentCoupleSpaceState,
      appData.coupleSpace,
      (prevSpace) => ({
        sharedMallItems: upsertCoupleSpaceSharedMallItems(prevSpace.sharedMallItems, nextSharedItem),
      }),
    );

    updateMallAndCoupleSpace({
      ...mallData,
      ownedItems: mallData.ownedItems.map((entry) => (
        entry.id === ownedItemId
          ? { ...entry, ownership: 'shared_space' }
          : entry
      )),
    }, coupleSpaceState, coupleSpace);
    showDetailNotice('info', buildSharedSpacePlacementNotice(item.title, currentCoupleSpacePartner?.name));
  };

  const handlePlaceOwnedItemIntoSharedSpaceAction = (ownedItemId: string) => {
    void runPendingAction(
      buildSharedSpacePendingKey(ownedItemId),
      () => placeOwnedItemIntoSharedSpace(ownedItemId),
      { minDurationMs: 260 },
    );
  };

  const refundMallOrderPayment = (
    order: MallOrder,
    item: MallCatalogItem,
    actionLabel: 'cancel' | 'refund',
  ): WalletData => {
    const amount = Number(item.price.toFixed(2));
    const originalTransaction = walletData.transactions.find((entry) => entry.id === order.walletTransactionId) ?? null;
    const targetCardId = resolveWalletTransactionCardId(originalTransaction?.cardId);
    let matchedCard = false;
    const nextCards = walletData.cards.map((card) => {
      if (card.id !== targetCardId) {
        return card;
      }

      matchedCard = true;
      return {
        ...card,
        balance: Number((card.balance + amount).toFixed(2)),
      };
    });
    const shouldRefundToBalance = targetCardId === WALLET_BALANCE_PAYMENT_ID || !matchedCard;
    const normalizedBalance = shouldRefundToBalance
      ? Number(((walletData.balance ?? 0) + amount).toFixed(2))
      : (walletData.balance ?? 0);
    const resolvedCardId = shouldRefundToBalance ? WALLET_BALANCE_PAYMENT_ID : targetCardId;

    return {
      ...walletData,
      balance: normalizedBalance,
      cards: nextCards,
      transactions: [
        {
          id: `mall-refund-${actionLabel}-${order.id}-${Date.now()}`,
          title: `${actionLabel === 'cancel' ? '取消订单退款' : '订单退款'} ${item.title}`,
          type: 'income',
          amount,
          date: '刚刚',
          icon: 'mall',
          category: '商城退款',
          cardId: resolvedCardId,
        },
        ...walletData.transactions,
      ],
    };
  };

  const cancelOrder = (orderId: string) => {
    const order = mallData.orders.find((entry) => entry.id === orderId) ?? null;
    if (!order) {
      return;
    }

    const canCancel = order.mode === 'shared_space'
      ? order.status === 'paid'
      : ['paid', 'packing'].includes(order.status);

    if (!canCancel) {
      showDetailNotice('error', '这笔订单现在不能取消。');
      return;
    }

    const item = mallData.catalog.find((entry) => entry.id === order.itemId) ?? null;
    if (!item) {
      return;
    }

    const nextWalletData = refundMallOrderPayment(order, item, 'cancel');
    const { coupleSpaceState, coupleSpace } = removeSharedMallItemsFromAllSpaces(
      (entry) => entry.sourceOrderId === order.id,
    );

    updateMallAndCoupleSpace({
      ...mallData,
      orders: mallData.orders.map((entry) => (
        entry.id === orderId
          ? { ...entry, status: 'cancelled', updatedAt: Date.now() }
          : entry
      )),
      ownedItems: mallData.ownedItems.filter((entry) => entry.sourceOrderId !== order.id),
      deliveryFeed: [
        {
          id: `mall-delivery-${orderId}-cancelled-${Date.now()}`,
          orderId,
          kind: 'status_update',
          text: `${item.title} 的订单已取消，款项已退回原支付方式。`,
          timestamp: Date.now(),
        },
        ...mallData.deliveryFeed,
      ],
    }, coupleSpaceState, coupleSpace, nextWalletData);
    showDetailNotice('info', buildOrderCancellationNotice(item.title));
  };

  const handleCancelOrderAction = (orderId: string) => {
    void runPendingAction(
      buildCancelOrderPendingKey(orderId),
      () => cancelOrder(orderId),
      { minDurationMs: 260 },
    );
  };

  const refundOrder = (orderId: string) => {
    const order = mallData.orders.find((entry) => entry.id === orderId) ?? null;
    if (!order) {
      return;
    }

    if (!(
      (
        order.mode === 'self'
        && ['signed', 'fulfilled'].includes(order.status)
      )
      || (
        order.mode === 'shared_space'
        && ['signed', 'fulfilled'].includes(order.status)
      )
      || (
        order.mode === 'digital'
        && order.status === 'fulfilled'
      )
    )) {
      showDetailNotice('error', '这笔订单现在不能退款。');
      return;
    }

    const item = mallData.catalog.find((entry) => entry.id === order.itemId) ?? null;
    if (!item) {
      return;
    }

    const nextWalletData = refundMallOrderPayment(order, item, 'refund');
    const { coupleSpaceState, coupleSpace } = removeSharedMallItemsFromAllSpaces(
      (entry) => entry.sourceOrderId === order.id,
    );

    updateMallAndCoupleSpace({
      ...mallData,
      orders: mallData.orders.map((entry) => (
        entry.id === orderId
          ? { ...entry, status: 'refunded', updatedAt: Date.now() }
          : entry
      )),
      ownedItems: mallData.ownedItems.filter((entry) => entry.sourceOrderId !== order.id),
      deliveryFeed: [
        {
          id: `mall-delivery-${orderId}-refunded-${Date.now()}`,
          orderId,
          kind: 'status_update',
          text: `${item.title} 已完成退款处理，款项已退回原支付方式。`,
          timestamp: Date.now(),
        },
        ...mallData.deliveryFeed,
      ],
    }, coupleSpaceState, coupleSpace, nextWalletData);
    showDetailNotice('info', buildOrderRefundNotice(item.title));
  };

  const handleRefundOrderAction = (orderId: string) => {
    void runPendingAction(
      buildRefundOrderPendingKey(orderId),
      () => refundOrder(orderId),
      { minDurationMs: 320 },
    );
  };

  const changeCartQuantity = (entryId: string, delta: number) => {
    const nextCart = mallData.cart
      .map((entry) => (
        entry.id !== entryId
          ? entry
          : { ...entry, quantity: Math.max(0, entry.quantity + delta) }
      ))
      .filter((entry) => entry.quantity > 0);

    updateMallData({
      ...mallData,
      cart: nextCart,
    });
  };

  const removeCartEntry = (entryId: string) => {
    const removedEntry = mallData.cart.find((entry) => entry.id === entryId) ?? null;
    const removedItem = removedEntry
      ? mallData.catalog.find((entry) => entry.id === removedEntry.itemId) ?? null
      : null;

    updateMallData({
      ...mallData,
      cart: mallData.cart.filter((entry) => entry.id !== entryId),
    });

    if (removedItem) {
      showDetailNotice('info', `已从购物车移除「${removedItem.title}」。`);
    }
  };

  const openAddressCreator = () => {
    setEditingAddressId(null);
    setShowAddressSheet(true);
  };

  const openAddressEditor = (addressId: string) => {
    setEditingAddressId(addressId);
    setShowAddressSheet(true);
  };

  const saveAddressDraft = () => {
    const recipientName = addressDraft.recipientName.trim();
    const phone = addressDraft.phone.trim();
    const region = addressDraft.region.trim();
    const detail = addressDraft.detail.trim();
    const tag = addressDraft.tag.trim();

    if (!recipientName || !phone || !region || !detail) {
      setAddressSheetError('请把收货人、电话、地区和详细地址补全。');
      return;
    }

    const now = Date.now();
    const existing = editingAddressId
      ? mallData.addresses.find((entry) => entry.id === editingAddressId) ?? null
      : null;
    const nextAddress: MallAddress = {
      id: existing?.id ?? `mall-address-${now}`,
      recipientName,
      phone,
      region,
      detail,
      ...(tag ? { tag } : {}),
      isDefault: existing?.isDefault ?? mallData.addresses.length === 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const nextAddresses = existing
      ? mallData.addresses.map((entry) => (entry.id === existing.id ? nextAddress : entry))
      : [nextAddress, ...mallData.addresses];

    updateMallData({
      ...mallData,
      addresses: nextAddresses,
      selectedAddressId: nextAddress.id,
    });
    setAddressSheetError(null);
    setShowAddressSheet(false);
    setEditingAddressId(null);
    showDetailNotice('info', existing ? '收货地址已更新。' : '收货地址已保存，后续实物订单会直接使用这里。');
  };

  const removeAddress = (addressId: string) => {
    const nextAddresses = mallData.addresses.filter((entry) => entry.id !== addressId);
    const nextSelectedAddressId = mallData.selectedAddressId === addressId
      ? (nextAddresses[0]?.id ?? null)
      : mallData.selectedAddressId;

    updateMallData({
      ...mallData,
      addresses: nextAddresses,
      selectedAddressId: nextSelectedAddressId,
    });
    showDetailNotice('info', '收货地址已删除。');
  };

  const handleSaveAddressDraft = () => {
    void runPendingAction(buildAddressActionPendingKey('save'), () => saveAddressDraft(), { minDurationMs: 260 });
  };

  const handleRemoveAddressAction = (addressId: string) => {
    void runPendingAction(
      buildAddressActionPendingKey('remove', addressId),
      () => removeAddress(addressId),
      { minDurationMs: 220 },
    );
  };

  const handleSetDefaultAddressAction = (address: MallAddress) => {
    void runPendingAction(
      buildAddressActionPendingKey('default', address.id),
      () => {
        updateMallData({
          ...mallData,
          selectedAddressId: address.id,
          addresses: mallData.addresses.map((entry) => ({
            ...entry,
            isDefault: entry.id === address.id,
          })),
        });
        showDetailNotice('info', '默认收货地址已更新。');
      },
      { minDurationMs: 220 },
    );
  };

  const handleCheckout = () => {
    if (cartEntries.length === 0) {
      return;
    }

    const hasPhysicalItems = cartEntries.some(({ entry }) => entry.mode === 'self');
    if (hasPhysicalItems && !selectedAddress) {
      showDetailNotice('error', '请先添加并选择收货地址。');
      return;
    }

    const hasGiftEntriesWithoutTarget = cartEntries.some(({ entry }) => (
      entry.mode === 'gift' && (!entry.giftTargetCharacterId || !entry.giftTargetCharacterName)
    ));
    if (hasGiftEntriesWithoutTarget) {
      showDetailNotice('error', '送礼商品缺少目标角色，请重新选择后再结算。');
      return;
    }

    const isBalancePayment = selectedCardId === WALLET_BALANCE_PAYMENT_ID;
    const selectedCard = isBalancePayment
      ? null
      : walletData.cards.find((card) => card.id === selectedCardId);
    if (!isBalancePayment && !selectedCard) {
      showDetailNotice('error', '请先选择支付方式。');
      return;
    }

    if (isBalancePayment) {
      if (walletBalance < cartTotal) {
        showDetailNotice('error', '余额不足，暂时还不能完成支付。');
        return;
      }
    } else if ((selectedCard?.balance ?? 0) < cartTotal) {
      showDetailNotice('error', '所选银行卡余额不足。');
      return;
    }

    const now = Date.now();
    const walletTransactionId = `mall-wallet-${now}`;
    const nextBalance = isBalancePayment
      ? Number((walletBalance - cartTotal).toFixed(2))
      : walletBalance;
    const nextCards = isBalancePayment
      ? walletData.cards
      : walletData.cards.map((card) => (
          card.id === selectedCardId
            ? { ...card, balance: Number((card.balance - cartTotal).toFixed(2)) }
            : card
        ));
    const nextWalletData: WalletData = {
      ...walletData,
      balance: nextBalance,
      cards: nextCards,
      transactions: [
        {
          id: walletTransactionId,
          title: `商城下单 ${cartEntries.length} 件`,
          type: 'expense',
          amount: Number(cartTotal.toFixed(2)),
          date: '刚刚',
          icon: 'mall',
          category: '商城',
          cardId: selectedCardId,
        },
        ...(walletData.transactions || []),
      ],
    };

    const nextOrders: MallOrder[] = [];
    const nextOwnedItems = [...mallData.ownedItems];
    const nextDeliveryFeed = [...mallData.deliveryFeed];
    const physicalOrderCount = physicalCartEntries.reduce((sum, { entry }) => sum + entry.quantity, 0);
    const giftOrderCount = giftCartEntries.reduce((sum, { entry }) => sum + entry.quantity, 0);
    const sharedSpaceOrderCount = sharedSpaceCartEntries.reduce((sum, { entry }) => sum + entry.quantity, 0);
    const digitalOrderCount = digitalCartEntries.reduce((sum, { entry }) => sum + entry.quantity, 0);

    cartEntries.forEach(({ entry, item }, recordIndex) => {
      if (!item) {
        return;
      }

      for (let count = 0; count < entry.quantity; count += 1) {
        const orderId = `mall-order-${now}-${recordIndex}-${count}`;
        const status: MallOrder['status'] = entry.mode === 'digital' ? 'fulfilled' : 'paid';
        const createdAt = now + recordIndex + count;

        nextOrders.unshift({
          id: orderId,
          itemId: item.id,
          mode: entry.mode,
          status,
          walletTransactionId,
          ...(entry.mode === 'gift'
            ? {
                giftTargetCharacterId: entry.giftTargetCharacterId,
                giftTargetCharacterName: entry.giftTargetCharacterName,
              }
            : {}),
          ...(entry.mode === 'self' && selectedAddress
            ? {
                shippingAddressId: selectedAddress.id,
                shippingAddressSnapshot: buildAddressSnapshot(selectedAddress),
              }
            : {}),
          createdAt,
          updatedAt: createdAt,
        });

        nextDeliveryFeed.unshift({
          id: `mall-delivery-${orderId}`,
          orderId,
          kind: entry.mode === 'digital' ? 'system' : 'status_update',
          text: entry.mode === 'digital'
            ? `${item.title} 已直接发放到你的数字物品。`
            : entry.mode === 'gift'
              ? `${item.title} 已支付完成，等待为 ${entry.giftTargetCharacterName || 'TA'} 备货。`
              : entry.mode === 'shared_space'
                ? `${item.title} 已支付成功，准备送往共同空间。`
              : `${item.title} 已支付成功，等待备货，收货人是 ${selectedAddress?.recipientName || '你'}。`,
          timestamp: createdAt,
        });

        if (entry.mode === 'digital') {
          nextOwnedItems.unshift({
            id: `mall-owned-${orderId}`,
            sourceOrderId: orderId,
            itemId: item.id,
            ownership: 'digital',
            acquiredAt: createdAt,
          });
        }
      }
    });

    updateMallData({
      ...mallData,
      cart: [],
      orders: [...nextOrders, ...mallData.orders],
      ownedItems: nextOwnedItems,
      deliveryFeed: nextDeliveryFeed,
    }, nextWalletData);
    setMePage('orders');
    setActiveTab('me');
    showDetailNotice('info', buildCheckoutSuccessNotice({
      orderCount: nextOrders.length,
      physicalCount: physicalOrderCount,
      giftCount: giftOrderCount,
      sharedSpaceCount: sharedSpaceOrderCount,
      digitalCount: digitalOrderCount,
    }));
  };

  const handleCheckoutAction = () => {
    void runPendingAction('checkout', () => handleCheckout(), { minDurationMs: 480 });
  };

  const progressOrder = (orderId: string) => {
    const order = mallData.orders.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    const item = mallData.catalog.find((entry) => entry.id === order.itemId);
    if (!item) {
      return;
    }

    const now = Date.now();
    let nextStatus = order.status;
    let nextDeliveryText = '';
    let nextOrder = order;
    let nextOwnedItems = mallData.ownedItems;
    let nextCoupleSpaceState = currentCoupleSpaceState;
    let nextCoupleSpace = appData.coupleSpace;

    if (order.mode === 'gift') {
      if (order.status === 'paid') {
        nextStatus = 'packing';
        nextDeliveryText = `${item.title} 正在为 ${order.giftTargetCharacterName || 'TA'} 准备中。`;
      } else if (order.status === 'packing') {
        nextStatus = 'delivering';
        nextDeliveryText = `${item.title} 正在送往 ${order.giftTargetCharacterName || 'TA'}。`;
      } else if (order.status === 'delivering') {
        const giftFeedback = buildMallGiftFeedback({
          item,
          character: {
            id: order.giftTargetCharacterId || 'gift-target',
            name: order.giftTargetCharacterName || 'TA',
          },
          timestamp: now,
        });

        nextStatus = 'signed';
        nextOrder = {
          ...order,
          giftFeedback,
        };
        nextDeliveryText = `${order.giftTargetCharacterName || 'TA'} 已收到 ${item.title}。`;

        if (
          giftFeedback.placeIntoSharedSpace
          && order.giftTargetCharacterId
          && currentCoupleSpaceState.spacesByPartnerId?.[order.giftTargetCharacterId]
        ) {
          const nextSharedItem = createCoupleSpaceSharedMallItem(item, {
            sourceOrderId: order.id,
            placedAt: now,
            placedBy: 'system',
            placementReason: 'gift_feedback',
          });
          const spaceUpdateResult = updatePartnerCoupleSpaceState(
            currentCoupleSpaceState,
            appData.coupleSpace,
            order.giftTargetCharacterId,
            (prevSpace) => ({
              sharedMallItems: upsertCoupleSpaceSharedMallItems(prevSpace.sharedMallItems, nextSharedItem),
            }),
          );
          nextCoupleSpaceState = spaceUpdateResult.coupleSpaceState;
          nextCoupleSpace = spaceUpdateResult.coupleSpace;
          nextOwnedItems = [
            {
              id: `mall-owned-${order.id}-shared-space`,
              sourceOrderId: order.id,
              itemId: item.id,
              ownership: 'shared_space',
              acquiredAt: now,
            },
            ...nextOwnedItems.filter((entry) => entry.sourceOrderId !== order.id),
          ];
        }
      } else if (order.status === 'signed') {
        nextStatus = 'fulfilled';
        nextDeliveryText = order.giftFeedback?.willMentionAgain
          ? `${order.giftTargetCharacterName || 'TA'} 后面大概率还会再提起这份礼物。`
          : `${item.title} 的送礼记录已经归档。`;
      } else {
        return;
      }
    } else if (order.mode === 'shared_space') {
      if (order.status === 'paid') {
        nextStatus = 'delivering';
        nextDeliveryText = `${item.title} 正在送往共同空间。`;
      } else if (order.status === 'delivering') {
        nextStatus = 'signed';
        nextDeliveryText = `${item.title} 已到共同空间仓库，等待摆放。`;
      } else if (order.status === 'signed') {
        nextStatus = 'fulfilled';
        nextDeliveryText = `${item.title} 已摆进共同空间。`;
        const nextSharedItem = createCoupleSpaceSharedMallItem(item, {
          sourceOrderId: order.id,
          placedAt: now,
          placedBy: 'user',
          placementReason: 'manual',
        });
        const spaceUpdateResult = updateCurrentCoupleSpaceState(
          currentCoupleSpaceState,
          appData.coupleSpace,
          (prevSpace) => ({
            sharedMallItems: upsertCoupleSpaceSharedMallItems(prevSpace.sharedMallItems, nextSharedItem),
          }),
        );
        nextCoupleSpaceState = spaceUpdateResult.coupleSpaceState;
        nextCoupleSpace = spaceUpdateResult.coupleSpace;
        if (!mallData.ownedItems.some((owned) => owned.sourceOrderId === order.id)) {
          nextOwnedItems = [
            {
              id: `mall-owned-${order.id}-space`,
              sourceOrderId: order.id,
              itemId: item.id,
              ownership: 'shared_space',
              acquiredAt: now,
            },
            ...mallData.ownedItems,
          ];
        }
      } else {
        return;
      }
    } else if (order.status === 'paid') {
      nextStatus = 'packing';
      nextDeliveryText = `${item.title} 正在备货中。`;
    } else if (order.status === 'packing') {
      nextStatus = 'delivering';
      nextDeliveryText = `${item.title} 已发出，正在配送中。`;
    } else if (order.status === 'delivering') {
      nextStatus = 'signed';
      nextDeliveryText = `${item.title} 已签收，已放入你的物品。`;
      if (!mallData.ownedItems.some((owned) => owned.sourceOrderId === order.id)) {
        nextOwnedItems = [
          {
            id: `mall-owned-${order.id}`,
            sourceOrderId: order.id,
            itemId: item.id,
            ownership: resolveOwnedOwnership(item),
            acquiredAt: now,
          },
          ...mallData.ownedItems,
        ];
      }
    } else if (order.status === 'signed') {
      nextStatus = 'fulfilled';
      nextDeliveryText = `${item.title} 已完成入库。`;
    } else {
      return;
    }

    updateMallAndCoupleSpace({
      ...mallData,
      orders: mallData.orders.map((entry) => (
        entry.id === orderId
          ? { ...nextOrder, status: nextStatus, updatedAt: now }
          : entry
      )),
      ownedItems: nextOwnedItems,
      deliveryFeed: [
        {
          id: `mall-delivery-${orderId}-${now}`,
          orderId,
          kind: 'delivery',
          text: nextDeliveryText,
          timestamp: now,
        },
        ...mallData.deliveryFeed,
      ],
    }, nextCoupleSpaceState, nextCoupleSpace);
    showDetailNotice('info', buildOrderProgressNotice({
      order,
      nextStatus,
      itemTitle: item.title,
    }));
  };

  const handleProgressOrderAction = (orderId: string) => {
    void runPendingAction(
      buildOrderProgressPendingKey(orderId),
      () => progressOrder(orderId),
      { minDurationMs: 320 },
    );
  };

  const renderSearchHeader = () => (
    <div className="space-y-3 rounded-[20px] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 rounded-[16px] bg-zinc-50 px-4 py-3">
        <Search size={18} className="text-zinc-400" />
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSearchCommitAction();
            }
          }}
          placeholder="搜索你想买的东西"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
        />
        <button
          type="button"
          onClick={handleSearchCommitAction}
          disabled={isActionPending(buildSearchCommitPendingKey())}
          className={`${PRESSABLE_CLASS} rounded-full bg-[#f4dbe1] px-3 py-1.5 text-[11px] font-semibold text-[#764e60]`}
        >
          {isActionPending(buildSearchCommitPendingKey()) ? <MallPendingSpinner className="h-4 w-4" /> : '搜索'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setCategory(entry)}
            className={`${PRESSABLE_CLASS} rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              entry === category ? ACTIVE_PILL_CLASS : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {entry}
          </button>
        ))}
      </div>
    </div>
  );

  const renderProductGrid = () => (
    filteredCatalog.length === 0 ? (
      <div className="rounded-[20px] bg-white px-6 py-10 text-center shadow-sm">
        <div className="text-[15px] font-bold text-zinc-800">这轮还没有筛出合适的商品</div>
        <div className="mt-2 text-[12px] leading-5 text-zinc-500">
          {committedSearch.trim()
            ? `“${committedSearch.trim()}” 在当前模式和分类里还没有命中，可以换个关键词，或者先把筛选放宽一点。`
            : category !== '全部'
              ? `当前分类「${category}」下暂时没有可展示的商品，先回到全部看看。`
              : '先换一个关键词，或者切到别的逛法看看。'}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {committedSearch.trim() ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setCommittedSearch('');
              }}
              className={SECONDARY_BUTTON_CLASS}
            >
              清空搜索
            </button>
          ) : null}
          {category !== '全部' ? (
            <button
              type="button"
              onClick={() => setCategory('全部')}
              className={SECONDARY_BUTTON_CLASS}
            >
              回到全部
            </button>
          ) : null}
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3">
        {filteredCatalog.map((item) => {
          const defaultActionMode = resolveDefaultModeAction(item);
          const cartPending = isActionPending(buildAddToCartPendingKey(item.id, defaultActionMode));
          const wishlistPending = isActionPending(buildWishlistPendingKey(item.id));

          return (
            <MallProductCard
              key={item.id}
              item={item}
              priceText={formatPrice(item.price)}
              onOpen={() => openMallItemDetail(item.id)}
              onAddToCart={() => handleAddToCartAction(item, defaultActionMode)}
              onToggleWishlist={() => handleToggleWishlistAction(item)}
              isWishlisted={wishlistedItemIds.has(item.id)}
              cartBusy={cartPending}
              wishlistBusy={wishlistPending}
            />
          );
        })}
      </div>
    )
  );

  const renderModeShelfGrid = () => (
    homeShelfItems.length === 0 ? (
      <div className="rounded-[20px] bg-white px-5 py-8 text-center shadow-sm">
        <div className="text-[15px] font-bold text-zinc-800">这一档模式还没有现成货架</div>
        <div className="mt-2 text-[12px] leading-5 text-zinc-500">先切到别的模式看看，或者等后面把这一层补得更完整。</div>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3">
        {homeShelfItems.map((item) => {
          const defaultActionMode = resolveDefaultModeAction(item);

          return (
            <MallProductCard
              key={item.id}
              item={item}
              priceText={formatPrice(item.price)}
              onOpen={() => openMallItemDetail(item.id)}
              onAddToCart={() => handleAddToCartAction(item, defaultActionMode)}
              onToggleWishlist={() => handleToggleWishlistAction(item)}
              isWishlisted={wishlistedItemIds.has(item.id)}
              cartBusy={isActionPending(buildAddToCartPendingKey(item.id, defaultActionMode))}
              wishlistBusy={isActionPending(buildWishlistPendingKey(item.id))}
            />
          );
        })}
      </div>
    )
  );

  const renderHome = () => (
    <div className="space-y-4 px-4 pb-28 pt-4">
      <div className="rounded-[22px] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 rounded-[16px] bg-zinc-50 px-4 py-3">
          <Search size={18} className="text-zinc-400" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSearchCommitAction();
              }
            }}
            placeholder="搜索你想买的东西"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          <button
            type="button"
            onClick={handleSearchCommitAction}
            disabled={isActionPending(buildSearchCommitPendingKey())}
            className={`${PRESSABLE_CLASS} rounded-full bg-[#f4dbe1] px-3 py-1.5 text-[11px] font-semibold text-[#764e60]`}
          >
            {isActionPending(buildSearchCommitPendingKey()) ? <MallPendingSpinner className="h-4 w-4" /> : '搜索'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsHomeControlCollapsed((current) => !current)}
          className={`${PRESSABLE_CLASS} mt-4 flex w-full items-center justify-between rounded-[16px] bg-zinc-50 px-4 py-3 text-left`}
        >
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-zinc-800">
              {HOME_MODE_OPTIONS.find((option) => option.value === homeMode)?.label || '自己买'}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500">
              <span>愿望单 {wishlistEntries.length}</span>
              <span>最近看过 {recentViewedEntries.length}</span>
              <span>共同空间 {ownedEntries.filter(({ entry }) => entry.ownership === 'shared_space').length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
            <span>{isHomeControlCollapsed ? '展开' : '收起'}</span>
            {isHomeControlCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
        </button>

        {!isHomeControlCollapsed ? (
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-[12px] font-semibold text-zinc-800">逛法</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {HOME_MODE_OPTIONS.map((option) => (
                  <MallFilterPill
                    key={option.value}
                    active={homeMode === option.value}
                    label={option.label}
                    onClick={() => setHomeMode(option.value)}
                  />
                ))}
              </div>
              <div className={`mt-3 rounded-[16px] px-4 py-3 text-[12px] leading-5 ${
                homeMode === 'private'
                  ? 'bg-[linear-gradient(135deg,#3a262a_0%,#241b1e_55%,#4b3234_100%)] text-white/82'
                  : 'bg-zinc-50 text-zinc-500'
              }`}>
                {homeMode === 'private'
                  ? '当前会只展示私密专区商品，搜索、推荐和分享都不会和普通货架混在一起。'
                  : HOME_MODE_OPTIONS.find((option) => option.value === homeMode)?.description || '慢慢挑一批适合现在的东西。'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MallQuickEntry title="愿望单" value={String(wishlistEntries.length)} onClick={() => {
                setActiveTab('me');
                setMePage('wishlist');
              }} />
              <MallQuickEntry title="最近看过" value={String(recentViewedEntries.length)} onClick={() => {
                const latestItem = recentViewedEntries[0];
                if (latestItem) {
                  openMallItemDetail(latestItem.id);
                }
              }} />
              <MallQuickEntry title="共同空间" value={String(ownedEntries.filter(({ entry }) => entry.ownership === 'shared_space').length)} onClick={() => {
                setActiveTab('me');
                setMePage('items');
              }} />
            </div>

            <div>
              <div className="text-[12px] font-semibold text-zinc-800">常逛类目</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.slice(1, 7).map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => {
                      setCategory(entry);
                      setActiveTab('browse');
                    }}
                    className={`${PRESSABLE_CLASS} rounded-full bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-700`}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <MallHeroCarousel
        slides={HOME_HERO_SLIDES.map((slide) => ({ ...slide }))}
        onAction={(nextCategory) => {
          setCategory(nextCategory);
          setActiveTab('browse');
        }}
      />
      <div className="rounded-[20px] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[16px] font-bold text-zinc-900">{resolvedHomeShelfPlan.title}</div>
            <div className="mt-1 text-[12px] text-zinc-500">{resolvedHomeShelfPlan.description}</div>
          </div>
          <button
            type="button"
            disabled={isActionPending(buildShelfRefreshPendingKey())}
            onClick={handleRefreshHomeShelfAction}
            className={SECONDARY_BUTTON_CLASS}
          >
            {isActionPending(buildShelfRefreshPendingKey()) ? <MallPendingSpinner className="h-4 w-4" /> : '刷新'}
          </button>
        </div>
        {currentCoupleSpacePartner ? (
          <div className="mt-4 rounded-[16px] bg-zinc-50 px-4 py-3 text-[12px] leading-5 text-zinc-600">
            {homeMode === 'gift'
              ? `${currentCoupleSpacePartner.name} 这条线会更适合先看能送出去、也会留下反馈的商品。`
              : homeMode === 'companion'
                ? `${currentCoupleSpacePartner.name} 这边更适合慢慢挑，尤其是能一起讨论或最后放进共同空间的东西。`
                : '当前这轮货架会优先照顾你最近更可能马上用上的那批商品。'}
          </div>
        ) : null}
          {homeMode === 'companion' ? (
            <div className="mt-4 rounded-[18px] bg-zinc-50 p-4">
          <div className="flex items-start gap-3">
            <ResolvedMallAvatar
              value={activeCompanion?.avatar}
              name={activeCompanion ? getCharacterDisplayName(activeCompanion) : 'TA'}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">一起逛状态</div>
              <div className="mt-1 text-[15px] font-bold text-zinc-900">
                {activeCompanion ? getCharacterDisplayName(activeCompanion) : '先选一个陪逛角色'}
              </div>
              <div className="mt-2 text-[12px] leading-5 text-zinc-600">
                {companionMoodText || '这一轮会更强调一起讨论和共同挑选。'}
              </div>
            </div>
          </div>
          {companionCommentItems.length > 0 ? (
            <div className="mt-4 space-y-2">
              {companionCommentItems.map((item) => (
                <div key={item.id} className="rounded-[16px] bg-white px-4 py-3 text-[12px] leading-5 text-zinc-600 shadow-sm">
                  {buildCompanionItemComment(item, activeCompanion ? getCharacterDisplayName(activeCompanion) : null)}
                </div>
              ))}
            </div>
          ) : null}
            </div>
          ) : null}
      </div>
      {renderModeShelfGrid()}
    </div>
  );

  const renderBrowse = () => (
    <div className="space-y-4 px-4 pb-28 pt-4">
      {renderSearchHeader()}
      <div className="rounded-[20px] bg-white p-4 shadow-sm">
        <div className="text-[16px] font-bold text-zinc-900">分类</div>
        <div className="mt-1 text-[12px] text-zinc-500">按类目慢慢挑，先从静态底库里选最适合你的那一批。</div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {categories.map((entry) => (
            <MallCategoryShortcut
              key={entry}
              icon={CATEGORY_ICON_MAP[entry] || '🛍️'}
              label={entry}
              hint={entry === '全部' ? '全部商品' : `${modeVisibleCatalog.filter((item) => item.category === entry).length} 件`}
              onClick={() => setCategory(entry)}
            />
          ))}
        </div>
      </div>
      <div className="rounded-[20px] bg-white px-4 py-3 shadow-sm">
        <div className="text-[12px] text-zinc-500">
          当前分类：<span className="font-semibold text-zinc-900">{category}</span>
        </div>
      </div>
      {mallData.recentSearches.length > 0 ? (
        <div className="rounded-[20px] bg-white p-4 shadow-sm">
          <div className="text-[13px] font-semibold text-zinc-700">最近搜索</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {mallData.recentSearches.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => {
                  setSearchInput(entry);
                  setCommittedSearch(entry);
                }}
                className={`${PRESSABLE_CLASS} rounded-full bg-zinc-100 px-3 py-1.5 text-[11px] font-medium text-zinc-500`}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {renderProductGrid()}
    </div>
  );

  const renderWishlistContent = () => (
    wishlistEntries.length === 0 ? (
      <div className="rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
          <Heart size={26} />
        </div>
        <div className="mt-4 text-[15px] font-bold text-zinc-800">想要清单还是空的</div>
        <div className="mt-2 text-[12px] leading-5 text-zinc-500">先把感兴趣的商品收进来，之后再慢慢决定。</div>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3">
        {wishlistEntries.map((item) => {
          const defaultActionMode = resolveDefaultModeAction(item);

          return (
            <MallProductCard
              key={item.id}
              item={item}
              priceText={formatPrice(item.price)}
              onOpen={() => openMallItemDetail(item.id)}
              onAddToCart={() => handleAddToCartAction(item, defaultActionMode)}
              onToggleWishlist={() => handleToggleWishlistAction(item)}
              isWishlisted={wishlistedItemIds.has(item.id)}
              cartBusy={isActionPending(buildAddToCartPendingKey(item.id, defaultActionMode))}
              wishlistBusy={isActionPending(buildWishlistPendingKey(item.id))}
            />
          );
        })}
      </div>
    )
  );

  const renderCartEntryList = (
    entries: Array<{ entry: MallCartEntry; item: MallCatalogItem | null }>,
    title: string,
    subtitle: string,
  ) => {
    if (entries.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3">
        <div className="px-1">
          <div className="text-[13px] font-semibold text-zinc-800">{title}</div>
          <div className="mt-1 text-[11px] text-zinc-500">{subtitle}</div>
        </div>
        {entries.map(({ entry, item }) => (
          <div key={entry.id} className="rounded-[20px] bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="w-[92px] shrink-0">
                <MallProductThumb item={item!} size="cart" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-zinc-900">{item!.title}</div>
                <div className="mt-1 text-[11px] text-zinc-500">{item!.subtitle || item!.subCategory || item!.category}</div>
                {entry.mode === 'gift' && entry.giftTargetCharacterName ? (
                  <div className="mt-2 text-[11px] font-medium text-[#9f4155]">送给 {entry.giftTargetCharacterName}</div>
                ) : entry.mode === 'shared_space' ? (
                  <div className="mt-2 text-[11px] font-medium text-[#4d7160]">
                    送到 {currentCoupleSpacePartner?.name ? `${currentCoupleSpacePartner.name} 的共同空间` : '共同空间'}
                  </div>
                ) : null}
                <ClampText text={item!.copy.cardBlurb} lines={2} className="mt-2 text-[12px] leading-5 text-zinc-500" />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[16px] font-black text-zinc-900">{formatPrice(item!.price)}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeCartQuantity(entry.id, -1)}
                      className={`${PRESSABLE_CLASS} flex h-8 w-8 items-center justify-center rounded-full bg-[#edf2fb] text-[#587097]`}
                    >
                      -
                    </button>
                    <span className="min-w-6 text-center text-[13px] font-semibold text-zinc-700">{entry.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeCartQuantity(entry.id, 1)}
                      className={`${PRESSABLE_CLASS} flex h-8 w-8 items-center justify-center rounded-full bg-[#edf2fb] text-[#587097]`}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCartEntry(entry.id)}
                      className={`${PRESSABLE_CLASS} ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-400`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCart = () => (
    <div className="space-y-4 px-4 pb-28 pt-4">
      <div className="rounded-[20px] bg-white p-4 shadow-sm">
        <div className="text-[16px] font-bold text-zinc-900">购物车</div>
        <div className="mt-1 text-[12px] text-zinc-500">已选 {cartEntries.length} 件商品，现在已经支持自购、送礼、共同空间和数字商品结算。</div>
      </div>
      {cartEntries.length === 0 ? (
        <div className="rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Package size={28} />
          </div>
          <div className="mt-4 text-[15px] font-bold text-zinc-800">购物车还是空的</div>
          <div className="mt-2 text-[12px] leading-5 text-zinc-500">先去首页挑一件东西，加入购物车后就能在这里结算。</div>
        </div>
      ) : (
        <>
          {renderCartEntryList(physicalCartEntries, '实物商品', '需要地址和配送，会进入你的物品或衣柜。')}
          {renderCartEntryList(giftCartEntries, '送礼清单', '会直接送给对应角色，送达后生成反馈记录。')}
          {renderCartEntryList(sharedSpaceCartEntries, '共同空间', '会直接送往共同空间，完成后进入空间陈列。')}
          {renderCartEntryList(digitalCartEntries, '数字商品', '支付后会立即发放到你的数字物品。')}

          {physicalCartEntries.length > 0 ? (
            <div className="rounded-[20px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-zinc-700">收货地址</div>
                  <div className="mt-1 text-[11px] text-zinc-400">实物商品下单会使用这里的地址。</div>
                </div>
                <button
                  type="button"
                  onClick={() => (selectedAddress ? openAddressEditor(selectedAddress.id) : openAddressCreator())}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {selectedAddress ? '编辑' : '新增'}
                </button>
              </div>
              {selectedAddress ? (
                <div className="mt-4 rounded-[16px] bg-zinc-50 p-4">
                  <div className="text-[14px] font-semibold text-zinc-900">
                    {selectedAddress.recipientName}
                    <span className="ml-2 text-[12px] font-medium text-zinc-500">{selectedAddress.phone}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">{selectedAddress.region}</div>
                  <div className="mt-2 text-[12px] leading-5 text-zinc-500">{selectedAddress.detail}</div>
                </div>
              ) : (
                <div className="mt-4 rounded-[16px] bg-zinc-50 px-4 py-5 text-center text-[12px] text-zinc-500">
                  还没有地址，先加一个收货地址再结算实物商品。
                </div>
              )}
            </div>
          ) : null}
          {sharedSpaceCartEntries.length > 0 ? (
            <div className="rounded-[20px] bg-white p-4 shadow-sm">
              <div className="text-[13px] font-semibold text-zinc-700">共同空间去向</div>
              <div className="mt-1 text-[11px] text-zinc-400">这批商品会直接送往共同空间，不再走普通收货地址。</div>
              <div className="mt-4 rounded-[16px] bg-zinc-50 p-4 text-[12px] leading-5 text-zinc-600">
                {currentCoupleSpacePartner?.name ? `${currentCoupleSpacePartner.name} 的共同空间` : '共同空间'}
              </div>
            </div>
          ) : null}

          <div className="rounded-[20px] bg-white p-4 shadow-sm">
            <div className="text-[13px] font-semibold text-zinc-700">支付方式</div>
            <div className="mt-3">
              <AppSelect
                value={selectedCardId}
                onChange={setSelectedCardId}
                options={paymentMethodOptions}
                placeholder="选择支付方式"
                emptyText="当前还没有可用支付方式"
              />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-[16px] bg-zinc-50 px-4 py-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">合计</div>
                <div className="mt-1 text-[22px] font-black text-zinc-900">{formatPrice(cartTotal)}</div>
              </div>
              <button
                type="button"
                onClick={handleCheckoutAction}
                disabled={cartEntries.length === 0 || !selectedCardId || isActionPending('checkout')}
                className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-40`}
              >
                {isActionPending('checkout') ? <MallPendingSpinner className="h-4 w-4" /> : '使用钱包支付'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderOrdersContent = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ORDER_FILTER_OPTIONS.map((option) => (
          <MallFilterPill
            key={option.value}
            active={orderFilter === option.value}
            label={`${option.label} ${getOrderFilterCount(mallData.orders, option.value)}`}
            onClick={() => setOrderFilter(option.value)}
          />
        ))}
      </div>
      {mallData.orders.length === 0 ? (
        <div className="rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Banknote size={28} />
          </div>
          <div className="mt-4 text-[15px] font-bold text-zinc-800">还没有订单</div>
          <div className="mt-2 text-[12px] leading-5 text-zinc-500">完成一次支付后，订单和状态时间线会出现在这里。</div>
        </div>
      ) : (
        filteredOrders.map((order) => {
          const item = mallData.catalog.find((entry) => entry.id === order.itemId);
          if (!item) {
            return null;
          }

          return (
            <div key={order.id} className="rounded-[20px] bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div className="w-[92px] shrink-0">
                  <MallProductThumb item={item} size="cart" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[14px] font-semibold text-zinc-900">{item.title}</div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-500">
                      {resolveOrderDisplayStatusLabel(order)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-zinc-500">
                    {resolveOrderModeLabel(order)} · 下单于 {new Date(order.createdAt).toLocaleString()}
                  </div>
                  {order.shippingAddressSnapshot ? (
                    <div className="mt-2 text-[11px] text-zinc-400">收货地址 · {buildAddressPreview(order.shippingAddressSnapshot)}</div>
                  ) : null}
                  {order.mode === 'gift' && order.giftTargetCharacterName ? (
                    <div className="mt-2 text-[11px] font-medium text-[#9f4155]">送礼对象 · {order.giftTargetCharacterName}</div>
                  ) : null}
                  <ClampText text={item.copy.cardBlurb} lines={2} className="mt-2 text-[12px] leading-5 text-zinc-500" />
                  {order.mode === 'gift' ? (
                    <div className="mt-3 rounded-[16px] bg-rose-50/70 px-3 py-3">
                      <div className="text-[11px] font-semibold text-[#9f4155]">礼物反馈</div>
                      <div className="mt-2 text-[12px] leading-5 text-zinc-600">
                        {order.giftFeedback?.summary || '送达后，这里会出现 TA 的反馈。'}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-[16px] font-black text-zinc-900">{formatPrice(item.price)}</div>
                    {order.mode !== 'digital' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setMePage('deliveries');
                          }}
                          className={`${PRESSABLE_CLASS} rounded-full bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-500`}
                        >
                          {order.mode === 'gift' ? '查看记录' : order.mode === 'shared_space' ? '查看空间进度' : '查看物流'}
                        </button>
                        {['paid', 'packing', 'delivering', 'signed'].includes(order.status) ? (
                          (() => {
                            const orderProgressPending = isActionPending(buildOrderProgressPendingKey(order.id));
                            return (
                              <button
                                type="button"
                                disabled={orderProgressPending}
                                onClick={() => handleProgressOrderAction(order.id)}
                                className={SECONDARY_BUTTON_CLASS}
                              >
                                {orderProgressPending
                                  ? <MallPendingSpinner className="h-4 w-4" />
                                  : order.mode === 'gift'
                                    ? resolveGiftProgressActionLabel(order)
                                    : order.mode === 'shared_space'
                                      ? resolveSharedSpaceProgressActionLabel(order)
                                    : order.status === 'paid'
                                      ? '开始备货'
                                      : order.status === 'packing'
                                        ? '推进配送'
                                        : order.status === 'delivering'
                                        ? '确认收货'
                                        : '完成入库'}
                              </button>
                            );
                          })()
                        ) : null}
                        {['paid', 'packing'].includes(order.status) ? (
                          <button
                            type="button"
                            disabled={isActionPending(buildCancelOrderPendingKey(order.id))}
                            onClick={() => handleCancelOrderAction(order.id)}
                            className={`${PRESSABLE_CLASS} rounded-full bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-400`}
                          >
                            {isActionPending(buildCancelOrderPendingKey(order.id))
                              ? <MallPendingSpinner className="h-4 w-4" />
                              : '取消订单'}
                          </button>
                        ) : null}
                        {order.mode === 'self' && ['signed', 'fulfilled'].includes(order.status) ? (
                          <button
                            type="button"
                            disabled={isActionPending(buildRefundOrderPendingKey(order.id))}
                            onClick={() => handleRefundOrderAction(order.id)}
                            className={`${PRESSABLE_CLASS} rounded-full bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-600`}
                          >
                            {isActionPending(buildRefundOrderPendingKey(order.id))
                              ? <MallPendingSpinner className="h-4 w-4" />
                              : '退款'}
                          </button>
                        ) : null}
                        {order.mode === 'shared_space' && ['signed', 'fulfilled'].includes(order.status) ? (
                          <button
                            type="button"
                            disabled={isActionPending(buildRefundOrderPendingKey(order.id))}
                            onClick={() => handleRefundOrderAction(order.id)}
                            className={`${PRESSABLE_CLASS} rounded-full bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-600`}
                          >
                            {isActionPending(buildRefundOrderPendingKey(order.id))
                              ? <MallPendingSpinner className="h-4 w-4" />
                              : '退款'}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] font-medium text-zinc-400">已直接发放</div>
                        {order.status === 'fulfilled' ? (
                          <button
                            type="button"
                            disabled={isActionPending(buildRefundOrderPendingKey(order.id))}
                            onClick={() => handleRefundOrderAction(order.id)}
                            className={`${PRESSABLE_CLASS} rounded-full bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-600`}
                          >
                            {isActionPending(buildRefundOrderPendingKey(order.id))
                              ? <MallPendingSpinner className="h-4 w-4" />
                              : '退款'}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
      {mallData.orders.length > 0 && filteredOrders.length === 0 ? (
        <div className="rounded-[20px] bg-white px-6 py-10 text-center shadow-sm">
          <div className="text-[14px] font-semibold text-zinc-800">这个筛选下还没有订单</div>
          <div className="mt-2 text-[12px] text-zinc-500">换一个状态看看，或者回首页继续逛逛。</div>
        </div>
      ) : null}
    </div>
  );

  const renderItemsContent = () => (
    <>
      {ownedEntries.length === 0 ? (
        <div className="rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <CheckCircle2 size={28} />
          </div>
          <div className="mt-4 text-[15px] font-bold text-zinc-800">你的物品还很空</div>
          <div className="mt-2 text-[12px] leading-5 text-zinc-500">签收后的实物和已发放的数字商品都会在这里出现。</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {ownedEntries.map(({ entry, item }) => {
            const canPlaceIntoSharedSpace = supportsMallSharedSpacePlacement(item!) && entry.ownership !== 'shared_space';
            const sharedSpacePending = isActionPending(buildSharedSpacePendingKey(entry.id));

            return (
              <div key={entry.id} className="overflow-hidden rounded-[20px] border border-zinc-100 bg-white shadow-sm">
                <div className="p-2.5">
                  <MallProductThumb item={item!} />
                </div>
                <div className="space-y-2 px-3.5 pb-3.5">
                  <div className="text-[14px] font-semibold text-zinc-900">{item!.title}</div>
                  <div className="text-[11px] text-zinc-500">{resolveOwnershipLabel(entry.ownership)}</div>
                  <ClampText text={item!.copy.cardBlurb} lines={2} className="text-[12px] leading-5 text-zinc-500" />
                  {entry.ownership === 'shared_space' ? (
                    <div className="pt-1 text-[11px] font-medium text-[#9f4155]">已经摆进共同空间</div>
                  ) : null}
                  {canPlaceIntoSharedSpace ? (
                    <button
                      type="button"
                      disabled={sharedSpacePending}
                      onClick={() => handlePlaceOwnedItemIntoSharedSpaceAction(entry.id)}
                      className={`${SECONDARY_BUTTON_CLASS} w-full justify-center`}
                    >
                      {sharedSpacePending ? <MallPendingSpinner className="h-4 w-4" /> : '放进共同空间'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const renderWalletContent = () => (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-white p-4 shadow-sm">
        <div className="text-[12px] font-medium text-zinc-500">钱包总览</div>
        <div className="mt-2 text-[26px] font-black tracking-tight text-zinc-900">
          {formatPrice(walletData.cards.reduce((sum, card) => sum + card.balance, 0))}
        </div>
        <div className="mt-2 text-[12px] text-zinc-500">
          {walletData.cards.length > 0 ? `${walletData.cards.length} 张可用卡片` : '还没有可用卡片'}
        </div>
      </div>
      <div className="space-y-3">
        {walletData.cards.map((card) => (
          <div key={card.id} className="rounded-[20px] bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-zinc-900">{card.bankName}</div>
                <div className="mt-1 text-[12px] text-zinc-500">{card.number}</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold text-zinc-900">{formatPrice(card.balance)}</div>
                <div className="mt-1 text-[11px] text-zinc-400">{card.cardType}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAddressesContent = () => (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openAddressCreator} className={SECONDARY_BUTTON_CLASS}>
          新增地址
        </button>
      </div>
      {mallData.addresses.length === 0 ? (
        <div className="rounded-[20px] bg-white px-4 py-6 text-center shadow-sm">
          <div className="text-[12px] text-zinc-500">你还没有收货地址，先加一个，后面买实物就能直接用。</div>
        </div>
      ) : (
        <div className="space-y-3">
          {mallData.addresses.map((address) => (
            <div key={address.id} className="rounded-[20px] bg-white px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-zinc-900">
                    {address.recipientName}
                    <span className="ml-2 text-[12px] font-medium text-zinc-500">{address.phone}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">{address.tag ? `${address.tag} · ` : ''}{address.region}</div>
                </div>
                {address.isDefault ? (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-500">默认</span>
                ) : null}
              </div>
              <div className="mt-3 text-[12px] leading-5 text-zinc-500">{address.detail}</div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isActionPending(buildAddressActionPendingKey('default', address.id))}
                  onClick={() => handleSetDefaultAddressAction(address)}
                  className={address.id === selectedAddress?.id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
                >
                  {isActionPending(buildAddressActionPendingKey('default', address.id))
                    ? <MallPendingSpinner className="h-4 w-4" />
                    : address.id === selectedAddress?.id ? '当前使用' : '设为默认'}
                </button>
                <button
                  type="button"
                  onClick={() => openAddressEditor(address.id)}
                  className={`${PRESSABLE_CLASS} rounded-full bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-500`}
                >
                  编辑
                </button>
                <button
                  type="button"
                  disabled={isActionPending(buildAddressActionPendingKey('remove', address.id))}
                  onClick={() => handleRemoveAddressAction(address.id)}
                  className={`${PRESSABLE_CLASS} rounded-full bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-400`}
                >
                  {isActionPending(buildAddressActionPendingKey('remove', address.id))
                    ? <MallPendingSpinner className="h-4 w-4" />
                    : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDeliveriesContent = () => (
    <div className="space-y-4">
      {selectedOrder ? (
        (() => {
          const selectedOrderItem = mallData.catalog.find((entry) => entry.id === selectedOrder.itemId) ?? null;
          if (!selectedOrderItem) {
            return null;
          }

          const timelineSteps = getOrderTimelineSteps(selectedOrder);

          return (
            <>
              <div className="rounded-[20px] bg-white p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="w-[92px] shrink-0">
                    <MallProductThumb item={selectedOrderItem} size="cart" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-zinc-900">{selectedOrderItem.title}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">订单号 {selectedOrder.id}</div>
                    <div className="mt-2 text-[11px] text-zinc-400">当前状态 · {resolveOrderDisplayStatusLabel(selectedOrder)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] bg-white p-4 shadow-sm">
                <div className="text-[13px] font-semibold text-zinc-900">
                  {selectedOrder.mode === 'gift' ? '送礼进度' : selectedOrder.mode === 'shared_space' ? '共同空间进度' : '物流进度'}
                </div>
                <div className="mt-4 space-y-3">
                  {timelineSteps.map((step) => (
                    <MallTimelineStep
                      key={step.key}
                      label={step.label}
                      reached={step.reached}
                    />
                  ))}
                </div>
              </div>

              {selectedOrder.mode === 'gift' ? (
                <div className="rounded-[20px] bg-white p-4 shadow-sm">
                  <div className="text-[13px] font-semibold text-zinc-900">礼物反馈</div>
                  <div className="mt-3 text-[12px] leading-5 text-zinc-600">
                    送给 {selectedOrder.giftTargetCharacterName || 'TA'}
                  </div>
                  {selectedOrder.giftFeedback ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-500">
                          {selectedOrder.giftFeedback.accepted ? '已收下' : '暂未收下'}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-500">
                          {selectedOrder.giftFeedback.liked ? '喜欢' : '比较克制'}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-500">
                          {selectedOrder.giftFeedback.willMentionAgain ? '后续会提起' : '这次先收着'}
                        </span>
                      </div>
                      <div className="mt-3 text-[13px] leading-6 text-zinc-600">
                        {selectedOrder.giftFeedback.summary}
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 text-[12px] text-zinc-500">礼物送达后，这里会出现 TA 的反馈。</div>
                  )}
                </div>
              ) : selectedOrder.mode === 'shared_space' ? (
                <div className="rounded-[20px] bg-white p-4 shadow-sm">
                  <div className="text-[13px] font-semibold text-zinc-900">空间去向</div>
                  <div className="mt-3 text-[12px] leading-5 text-zinc-600">
                    {currentCoupleSpacePartner?.name ? `${currentCoupleSpacePartner.name} 的共同空间` : '共同空间'}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                    完成后会直接进入共同空间陈列，不再进入普通收货地址。
                  </div>
                </div>
              ) : selectedOrder.shippingAddressSnapshot ? (
                <div className="rounded-[20px] bg-white p-4 shadow-sm">
                  <div className="text-[13px] font-semibold text-zinc-900">收货信息</div>
                  <div className="mt-3 text-[12px] leading-5 text-zinc-600">
                    {selectedOrder.shippingAddressSnapshot.recipientName} · {selectedOrder.shippingAddressSnapshot.phone}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                    {buildAddressPreview(selectedOrder.shippingAddressSnapshot)}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[20px] bg-white p-4 shadow-sm">
                <div className="text-[13px] font-semibold text-zinc-900">动态时间线</div>
                {selectedOrderDeliveryEvents.length === 0 ? (
                  <div className="mt-3 text-[12px] text-zinc-500">这笔订单暂时还没有更多物流动态。</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {selectedOrderDeliveryEvents.map((event) => (
                      <div key={event.id} className="rounded-[16px] bg-zinc-50 px-4 py-4">
                        <div className="text-[12px] leading-5 text-zinc-600">{event.text}</div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );
        })()
      ) : mallData.orders.filter((order) => order.mode !== 'digital').length === 0 ? (
        <div className="rounded-[20px] bg-white px-4 py-5 text-[12px] text-zinc-500 shadow-sm">
          还没有可查看的订单进度，下一次下单后这里会出现最新进展。
        </div>
      ) : (
        <div className="space-y-3">
          {mallData.orders
            .filter((order) => order.mode !== 'digital')
            .map((order) => {
              const item = mallData.catalog.find((entry) => entry.id === order.itemId);
              if (!item) {
                return null;
              }

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`${PRESSABLE_CLASS} flex w-full items-center gap-3 rounded-[20px] bg-white px-4 py-4 text-left shadow-sm`}
                >
                  <div className="w-[80px] shrink-0">
                    <MallProductThumb item={item} size="cart" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-zinc-900">{item.title}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{resolveOrderDisplayStatusLabel(order)}</div>
                    <div className="mt-2 text-[12px] text-zinc-400">
                      {order.mode === 'gift'
                        ? `点开查看这份送给 ${order.giftTargetCharacterName || 'TA'} 的礼物记录`
                        : order.mode === 'shared_space'
                          ? '点击查看这件商品进入共同空间的完整进度'
                          : '点击查看这笔订单的物流时间线'}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );

  const renderMeOverview = () => (
    <>
      <div className="rounded-[20px] bg-white px-4 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <ResolvedMallAvatar value={appData.userProfile.avatar} name={appData.userProfile.name} />
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-bold tracking-tight text-zinc-900">{appData.userProfile.name || '我的商城'}</div>
            <div className="mt-1 text-[12px] text-zinc-500">ID {appData.userProfile.id || 'bloom-user'}</div>
            <div className="mt-1 text-[12px] text-zinc-500">{appData.userProfile.mood || '今天也可以慢慢挑东西'}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <MallQuickEntry title="待处理" value={String(orderCounts.pending)} onClick={() => setMePage('orders')} />
          <MallQuickEntry title="配送中" value={String(orderCounts.delivering)} onClick={() => setMePage('deliveries')} />
          <MallQuickEntry title="物品" value={String(ownedEntries.length)} onClick={() => setMePage('items')} />
          <MallQuickEntry title="想要" value={String(wishlistEntries.length)} onClick={() => setMePage('wishlist')} />
          <MallQuickEntry title="数字" value={String(orderCounts.digital)} onClick={() => setMePage('orders')} />
        </div>
      </div>

      <div className="rounded-[20px] bg-white px-4 py-1 shadow-sm">
        <MallListEntry
          title="收货地址"
          subtitle={selectedAddress ? buildAddressPreview(selectedAddress) : '还没有默认地址'}
          value={selectedAddress ? selectedAddress.recipientName : '去设置'}
          onClick={() => setMePage('addresses')}
        />
        <div className="h-px bg-zinc-100" />
        <MallListEntry
          title="全部订单"
          subtitle="查看待处理、配送中、已完成和数字订单"
          value={`${mallData.orders.length} 笔`}
          onClick={() => setMePage('orders')}
        />
        <div className="h-px bg-zinc-100" />
        <MallListEntry
          title="我的物品"
          subtitle="查看签收后的实物、数字物品和已入库内容"
          value={`${ownedEntries.length} 件`}
          onClick={() => setMePage('items')}
        />
        <div className="h-px bg-zinc-100" />
        <MallListEntry
          title="想要清单"
          subtitle="把暂时不急着买、但还想留着看的商品放在这里"
          value={`${wishlistEntries.length} 件`}
          onClick={() => setMePage('wishlist')}
        />
        <div className="h-px bg-zinc-100" />
        <MallListEntry
          title="钱包概览"
          subtitle={walletData.cards.length > 0 ? `${walletData.cards.length} 张可用卡片` : '还没有可用卡片'}
          value={formatPrice(walletData.cards.reduce((sum, card) => sum + card.balance, 0))}
          onClick={() => setMePage('wallet')}
        />
        <div className="h-px bg-zinc-100" />
        <MallListEntry
          title="最近物流"
          subtitle={latestDeliveryEvents[0]?.text || '下一次下单后这里会出现物流动态'}
          value={`${latestDeliveryEvents.length} 条`}
          onClick={() => setMePage('deliveries')}
        />
      </div>
    </>
  );

  const renderMe = () => (
    <div className="space-y-4 px-4 pb-28 pt-4">
      {mePage === 'overview' ? renderMeOverview() : null}
      {mePage === 'wallet' ? renderWalletContent() : null}
      {mePage === 'addresses' ? renderAddressesContent() : null}
      {mePage === 'orders' ? renderOrdersContent() : null}
      {mePage === 'items' ? renderItemsContent() : null}
      {mePage === 'wishlist' ? renderWishlistContent() : null}
      {mePage === 'deliveries' ? renderDeliveriesContent() : null}
    </div>
  );

  const currentMeSubPageMeta = activeTab === 'me' && mePage !== 'overview'
    ? selectedOrder && mePage === 'deliveries'
      ? {
          title: selectedOrder.mode === 'gift' ? '送礼记录' : selectedOrder.mode === 'shared_space' ? '共同空间进度' : '订单物流',
          subtitle: selectedOrder.mode === 'gift'
            ? '查看这份礼物的进度、反馈和后续记录'
            : selectedOrder.mode === 'shared_space'
              ? '查看这件商品送进共同空间的完整进度和状态'
              : '查看这一笔订单的完整物流进度和动态',
        }
      : MALL_ME_PAGE_META[mePage]
    : null;
  const mainHeaderTitle = currentMeSubPageMeta
    ? currentMeSubPageMeta.title
    : activeTab === 'me'
      ? '我的'
      : activeTab === 'cart'
        ? '购物车'
        : activeTab === 'browse'
          ? '分类'
          : '商城';

  const handleRootBack = () => {
    if (activeTab === 'me' && mePage === 'deliveries' && selectedOrderId) {
      setSelectedOrderId(null);
      return;
    }

    if (activeTab === 'me' && mePage !== 'overview') {
      setMePage('overview');
      return;
    }

    onClose();
  };

  if (selectedItem) {
    return (
      <div className="relative flex h-full min-h-full flex-col bg-zinc-50 text-zinc-900">
        <div className="border-b border-zinc-100 bg-white/92 px-4 pb-4 pt-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedItemId(null)}
              className={`${PRESSABLE_CLASS} flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700`}
            >
              <ChevronLeft size={22} />
            </button>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">商品详情</div>
              <div className="truncate text-[16px] font-bold text-zinc-900">{selectedItem.title}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
          <div className="rounded-[20px] bg-white p-3 shadow-sm">
            <MallProductThumb item={selectedItem} size="detail" />
          </div>
          <div className="mt-4 rounded-[20px] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[20px] font-bold tracking-tight text-zinc-900">{selectedItem.title}</div>
                <div className="mt-1 text-[13px] text-zinc-500">{selectedItem.subtitle || selectedItem.subCategory || selectedItem.category}</div>
              </div>
              <button
                type="button"
                disabled={isActionPending(buildWishlistPendingKey(selectedItem.id))}
                onClick={() => handleToggleWishlistAction(selectedItem)}
                aria-label={wishlistedItemIds.has(selectedItem.id) ? `取消收藏 ${selectedItem.title}` : `收藏 ${selectedItem.title}`}
                className={`${PRESSABLE_CLASS} flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500`}
              >
                {isActionPending(buildWishlistPendingKey(selectedItem.id))
                  ? <MallPendingSpinner className="h-4 w-4" />
                  : <Heart size={18} className={wishlistedItemIds.has(selectedItem.id) ? 'fill-current text-[#c56a82]' : ''} />}
              </button>
            </div>
            <div className="mt-4 text-[24px] font-black text-zinc-900">{formatPrice(selectedItem.price)}</div>
            <div className="mt-1 text-[11px] text-zinc-400">
              {resolveCartMode(selectedItem) === 'digital' ? '数字解锁' : '送到我这里'}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {selectedItem.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-medium text-zinc-500">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-[20px] bg-white px-4 py-1 shadow-sm">
            <MallDetailRow
              label="配送方式"
              value={resolveCartMode(selectedItem) === 'digital'
                ? '数字解锁，下单后立即发放'
                : supportsMallSharedSpacePlacement(selectedItem) && currentCoupleSpace.partnerId
                  ? '支持自购、送礼，也可以直接送到共同空间'
                  : supportsMallGift(selectedItem)
                    ? '支持自购，也可以直接送给当前角色'
                  : '普通实物，送到我这里'}
            />
            {supportsMallGift(selectedItem) ? (
              <MallDetailRow
                label="送礼对象"
                value={activeCompanion ? `当前默认送给 ${getCharacterDisplayName(activeCompanion)}` : '先选一个角色'}
              />
            ) : null}
            {supportsMallSharedSpacePlacement(selectedItem) ? (
              <MallDetailRow
                label="共同空间"
                value={currentCoupleSpace.partnerId
                  ? `当前可直接送到 ${currentCoupleSpacePartner?.name || '共同空间'}`
                  : '先建立情侣空间，再使用这个去向'}
              />
            ) : null}
            <MallDetailRow
              label="购买后归属"
              value={resolveOwnedOwnership(selectedItem) === 'digital'
                ? '数字物品'
                : resolveOwnedOwnership(selectedItem) === 'wardrobe'
                  ? '我的衣柜'
                  : resolveOwnedOwnership(selectedItem) === 'prop'
                    ? '我的道具'
                    : '我的物品'}
            />
            <MallDetailRow
              label="适合场景"
              value={(selectedItem.sceneTags && selectedItem.sceneTags.length > 0)
                ? selectedItem.sceneTags.join(' / ')
                : '日常使用'}
            />
            <MallDetailRow
              label="风格"
              value={(selectedItem.styleTags && selectedItem.styleTags.length > 0)
                ? selectedItem.styleTags.join(' / ')
                : '基础款'}
            />
          </div>
          <div className="mt-4 rounded-[20px] bg-white p-4 shadow-sm">
            <div className="text-[13px] font-semibold text-zinc-900">商品说明</div>
            <div className="mt-3 text-[13px] leading-7 text-zinc-600">{selectedItem.copy.detailDescription}</div>
          </div>
          {selectedItem.copy.recommendationReason ? (
            <div className="mt-4 rounded-[20px] bg-white p-4 shadow-sm">
              <div className="text-[13px] font-semibold text-zinc-900">推荐原因</div>
              <div className="mt-3 text-[13px] leading-7 text-zinc-600">{selectedItem.copy.recommendationReason}</div>
            </div>
          ) : null}
        </div>
        {renderGlobalNotice()}
        {renderCompanionOverlay({
          orbBottomClass: 'bottom-[106px]',
          panelBottomClass: 'bottom-[176px]',
        })}
        <div className="absolute inset-x-0 bottom-0 border-t border-zinc-200 bg-white/96 px-4 pb-6 pt-4">
          <div className={`grid gap-3 ${
            supportsMallGift(selectedItem) && supportsMallSharedSpacePlacement(selectedItem)
              ? 'grid-cols-4'
              : supportsMallGift(selectedItem) || supportsMallSharedSpacePlacement(selectedItem)
                ? 'grid-cols-3'
                : 'grid-cols-2'
          }`}>
            <button
              type="button"
              disabled={isActionPending(buildAddToCartPendingKey(selectedItem.id))}
              onClick={() => handleAddToCartAction(selectedItem)}
              className={SECONDARY_BUTTON_CLASS}
            >
              {isActionPending(buildAddToCartPendingKey(selectedItem.id))
                ? <MallPendingSpinner className="h-4 w-4" />
                : '加入购物车'}
            </button>
            <button
              type="button"
              disabled={isActionPending(buildBuyNowPendingKey(selectedItem.id))}
              onClick={() => handleBuyNowAction(selectedItem)}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isActionPending(buildBuyNowPendingKey(selectedItem.id))
                ? <MallPendingSpinner className="h-4 w-4" />
                : '立即购买'}
            </button>
            {supportsMallGift(selectedItem) ? (
              <button
                type="button"
                disabled={isActionPending(buildBuyNowPendingKey(selectedItem.id, 'gift'))}
                onClick={() => handleBuyNowAction(selectedItem, 'gift')}
                className={`${PRESSABLE_CLASS} rounded-full bg-[linear-gradient(135deg,#ffe3ea_0%,#f5e8da_100%)] px-4 py-2.5 text-[12px] font-semibold text-[#9f4155] shadow-sm`}
              >
                {isActionPending(buildBuyNowPendingKey(selectedItem.id, 'gift'))
                  ? <MallPendingSpinner className="h-4 w-4" />
                  : '送给TA'}
              </button>
            ) : null}
            {supportsMallSharedSpacePlacement(selectedItem) ? (
              <button
                type="button"
                disabled={!currentCoupleSpace.partnerId || isActionPending(buildBuyNowPendingKey(selectedItem.id, 'shared_space'))}
                onClick={() => handleBuyNowAction(selectedItem, 'shared_space')}
                className={`${PRESSABLE_CLASS} rounded-full bg-[linear-gradient(135deg,#e7f1eb_0%,#edf4ef_100%)] px-4 py-2.5 text-[12px] font-semibold text-[#4d7160] shadow-sm`}
              >
                {isActionPending(buildBuyNowPendingKey(selectedItem.id, 'shared_space'))
                  ? <MallPendingSpinner className="h-4 w-4" />
                  : '送到共同空间'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-full flex-col bg-zinc-50 text-zinc-900">
      <div className="border-b border-zinc-100 bg-white/92 px-4 pb-4 pt-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRootBack}
            className={`${PRESSABLE_CLASS} flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700`}
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Bloom Mall</div>
            <div className="text-[18px] font-black text-zinc-900">{mainHeaderTitle}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'home' ? renderHome() : null}
        {activeTab === 'browse' ? renderBrowse() : null}
        {activeTab === 'cart' ? renderCart() : null}
        {activeTab === 'me' ? renderMe() : null}
      </div>

      {renderGlobalNotice()}
      {renderCompanionOverlay({
        orbBottomClass: 'bottom-[102px]',
        panelBottomClass: 'bottom-[164px]',
      })}

      {showAddressSheet ? (
        <div className="absolute inset-0 z-[40] flex items-end bg-black/18 p-3 backdrop-blur-[2px]">
          <div className="w-full rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4dbe1] text-[#764e60]">
                  <Edit3 size={16} />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-zinc-900">{editingAddressId ? '编辑地址' : '新增地址'}</div>
                  <div className="mt-1 text-[11px] text-zinc-400">后续实物结算会直接使用这里的信息。</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddressSheet(false);
                  setEditingAddressId(null);
                  setAddressSheetError(null);
                }}
                className={`${PRESSABLE_CLASS} rounded-full bg-zinc-100 px-3 py-1.5 text-[11px] font-semibold text-zinc-500`}
              >
                关闭
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <input
                value={addressDraft.recipientName}
                onChange={(event) => {
                  setAddressSheetError(null);
                  setAddressDraft((prev) => ({ ...prev, recipientName: event.target.value }));
                }}
                placeholder="收货人"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <input
                value={addressDraft.phone}
                onChange={(event) => {
                  setAddressSheetError(null);
                  setAddressDraft((prev) => ({ ...prev, phone: event.target.value }));
                }}
                placeholder="联系电话"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <input
                value={addressDraft.region}
                onChange={(event) => {
                  setAddressSheetError(null);
                  setAddressDraft((prev) => ({ ...prev, region: event.target.value }));
                }}
                placeholder="地区 / 城市 / 区"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <input
                value={addressDraft.detail}
                onChange={(event) => {
                  setAddressSheetError(null);
                  setAddressDraft((prev) => ({ ...prev, detail: event.target.value }));
                }}
                placeholder="详细地址"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <input
                value={addressDraft.tag}
                onChange={(event) => {
                  setAddressSheetError(null);
                  setAddressDraft((prev) => ({ ...prev, tag: event.target.value }));
                }}
                placeholder="地址标签，例如 家 / 公司"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
            {addressSheetError ? (
              <div role="alert" className="mt-4 rounded-[16px] bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-500">
                {addressSheetError}
              </div>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddressSheet(false);
                  setEditingAddressId(null);
                  setAddressSheetError(null);
                }}
                className={SECONDARY_BUTTON_CLASS}
              >
                稍后再填
              </button>
              <button
                type="button"
                disabled={isActionPending(buildAddressActionPendingKey('save'))}
                onClick={handleSaveAddressDraft}
                className={PRIMARY_BUTTON_CLASS}
              >
                {isActionPending(buildAddressActionPendingKey('save')) ? <MallPendingSpinner className="h-4 w-4" /> : '保存地址'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-zinc-100 bg-white/96 px-4 pb-6 pt-3">
        <div className="grid grid-cols-4 gap-2 rounded-[24px] bg-zinc-100 p-1.5">
          {([
            { id: 'home', label: '首页' },
            { id: 'browse', label: '分类' },
            { id: 'cart', label: '购物车' },
            { id: 'me', label: '我的' },
          ] as Array<{ id: MallTab; label: string }>).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'me') {
                  setMePage('overview');
                  setSelectedOrderId(null);
                }
              }}
              className={`${PRESSABLE_CLASS} rounded-[18px] px-3 py-2 text-[12px] font-semibold ${
                activeTab === tab.id ? ACTIVE_PILL_CLASS : 'text-zinc-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
