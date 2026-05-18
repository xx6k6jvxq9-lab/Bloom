import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  Edit3,
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
import {
  buildMallShareDraftText,
  createMallShareChatMessage,
  type MallShareMode,
} from '../../../features/mall/mallShare';
import { generateMallCompanionReply } from '../../../features/mall/generateMallCompanionReply';
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
  ORDER_FILTER_OPTIONS,
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
  MallOwnedItemOwnership,
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
type MallMePage = 'overview' | 'wallet' | 'addresses' | 'orders' | 'items' | 'deliveries';
type MallFloatingAskState = {
  itemId: string;
  characterId: string;
  questionText: string;
  replyText: string;
  status: 'loading' | 'success' | 'error';
  updatedAt: number;
};

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
  'rounded-full bg-[linear-gradient(135deg,#f7d8df_0%,#f2e2cf_100%)] px-4 py-2.5 text-[12px] font-semibold text-[#764e60]';
const SECONDARY_BUTTON_CLASS =
  'rounded-full bg-[#edf2fb] px-4 py-2.5 text-[12px] font-semibold text-[#587097]';
const ACTIVE_PILL_CLASS =
  'bg-[linear-gradient(135deg,#f6d9df_0%,#f4e6d7_100%)] text-[#754e5d] shadow-[0_6px_16px_rgba(188,153,165,0.16)]';

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

function resolveCartMode(item: MallCatalogItem): Extract<MallCartEntry['mode'], 'self' | 'digital'> {
  return item.destinationKinds.includes('digital') && !item.destinationKinds.includes('self')
    ? 'digital'
    : 'self';
}

function resolveOwnedOwnership(item: MallCatalogItem): MallOwnedItemOwnership {
  if (item.destinationKinds.includes('digital') && !item.destinationKinds.includes('self')) {
    return 'digital';
  }

  if (item.isWearable) {
    return 'wardrobe';
  }

  if (item.isConsumable) {
    return 'prop';
  }

  return 'self';
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
    case 'all':
    default:
      return orders.length;
  }
}

export default function MallApp({ appData, settings, onUpdateAppData, onClose, onOpenChat }: MallAppProps) {
  const mallData: MallData = appData.mallData ?? createDefaultMallData();
  const walletData = appData.walletData ?? EMPTY_WALLET_DATA;
  const selectedAddress = resolveSelectedAddress(mallData);

  const [activeTab, setActiveTab] = useState<MallTab>('home');
  const [mePage, setMePage] = useState<MallMePage>('overview');
  const [orderFilter, setOrderFilter] = useState<MallOrderFilter>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [category, setCategory] = useState('全部');
  const [searchInput, setSearchInput] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showCompanionPanel, setShowCompanionPanel] = useState(false);
  const [detailNotice, setDetailNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [floatingAskState, setFloatingAskState] = useState<MallFloatingAskState | null>(null);
  const [addressDraft, setAddressDraft] = useState({
    recipientName: '',
    phone: '',
    region: '',
    detail: '',
    tag: '家',
  });

  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(mallData.catalog.map((item) => item.category)))],
    [mallData.catalog],
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

    return mallData.catalog.filter((item) => {
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
  }, [category, committedSearch, mallData.catalog]);
  const cartTotal = useMemo(
    () => cartEntries.reduce((sum, record) => sum + (record.item?.price || 0) * record.entry.quantity, 0),
    [cartEntries],
  );
  const orderCounts = useMemo(() => ({
    pending: mallData.orders.filter((entry) => entry.status === 'pending_payment' || entry.status === 'paid' || entry.status === 'packing').length,
    delivering: mallData.orders.filter((entry) => entry.status === 'delivering').length,
    done: mallData.orders.filter((entry) => entry.status === 'signed' || entry.status === 'fulfilled').length,
    digital: mallData.orders.filter((entry) => entry.mode === 'digital').length,
  }), [mallData.orders]);
  const latestDeliveryEvents = useMemo(
    () => mallData.deliveryFeed.slice(0, 4),
    [mallData.deliveryFeed],
  );
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
  const floatingAskRequestIdRef = useRef(0);

  useEffect(() => {
    if (!selectedCardId && walletData.cards.length > 0) {
      setSelectedCardId(walletData.cards[0].id);
    }
  }, [selectedCardId, walletData.cards]);

  useEffect(() => {
    setDetailNotice(null);
    setFloatingAskState((current) => {
      if (!current) return null;
      if (!selectedItemId) return null;
      return current.itemId === selectedItemId ? current : null;
    });
  }, [selectedItemId]);

  useEffect(() => {
    if (!detailNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setDetailNotice(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [detailNotice]);

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
  }, [editingAddressId, mallData.addresses, showAddressSheet]);

  const updateMallData = (nextMallData: MallData, nextWalletData?: WalletData) => {
    onUpdateAppData({
      ...appData,
      mallData: nextMallData,
      ...(nextWalletData ? { walletData: nextWalletData } : {}),
    });
  };

  const selectShoppingCompanion = (characterId: string) => {
    updateMallData({
      ...mallData,
      currentShoppingCompanionId: characterId,
    });
  };

  /*
  const pushMallMessageToChat = (item: MallCatalogItem, mode: MallShareMode) => {
    if (!activeCompanionId || !activeCompanion) {
      setDetailNotice({
        tone: 'error',
        text: '先选一个角色，再把商品带进聊天。',
      });
      return;
    }

    const disabledReason = getCompanionChatDisabledReason(activeCompanion);
    if (disabledReason) {
      setDetailNotice({
        tone: 'error',
        text: disabledReason,
      });
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
    setDetailNotice({
      tone: 'info',
      text: mode === 'ask'
        ? `已经把问题发给 ${getCharacterDisplayName(activeCompanion)}。`
        : `已经把商品分享给 ${getCharacterDisplayName(activeCompanion)}。`,
    });
    onOpenChat?.(activeCompanionId);
  };
  */
  const pushMallMessageToChat = (item: MallCatalogItem, mode: MallShareMode) => {
    if (!activeCompanionId || !activeCompanion) {
      setDetailNotice({
        tone: 'error',
        text: '\u5148\u9009\u4e00\u4e2a\u89d2\u8272\uff0c\u518d\u628a\u5546\u54c1\u5e26\u8fdb\u804a\u5929\u3002',
      });
      return;
    }

    const disabledReason = getCompanionChatDisabledReason(activeCompanion);
    if (disabledReason) {
      setDetailNotice({
        tone: 'error',
        text: disabledReason,
      });
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
    setDetailNotice({
      tone: 'info',
      text: `已经把商品分享给 ${getCharacterDisplayName(activeCompanion)}。`,
    });
    onOpenChat?.(activeCompanionId);
  };

  const askCompanionInline = (item: MallCatalogItem) => {
    if (!activeCompanionId || !activeCompanion) {
      setDetailNotice({
        tone: 'error',
        text: '先选一个角色，再问 TA。',
      });
      return;
    }

    const disabledReason = getCompanionChatDisabledReason(activeCompanion);
    if (disabledReason) {
      setDetailNotice({
        tone: 'error',
        text: disabledReason,
      });
      return;
    }

    const questionText = buildMallShareDraftText(item, 'ask');
    const requestId = floatingAskRequestIdRef.current + 1;
    floatingAskRequestIdRef.current = requestId;

    setShowCompanionPanel(true);
    setDetailNotice(null);
    setFloatingAskState({
      itemId: item.id,
      characterId: activeCompanionId,
      questionText,
      replyText: '',
      status: 'loading',
      updatedAt: Date.now(),
    });

    void generateMallCompanionReply({
      settings,
      character: activeCompanion,
      item,
      userName: appData.userProfile.name || '用户',
    }).then((replyText) => {
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
    }).catch((error) => {
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
    });
  };

  const renderCompanionOverlay = (layout: {
    orbBottomClass: string;
    panelBottomClass: string;
    noticeBottomClass: string;
  }) => {
    if (companionOptions.length === 0) {
      return null;
    }

    const hasSelectedItem = !!selectedItem;
    const hasFloatingConversation = !!(hasSelectedItem && activeFloatingAskState);

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
        {detailNotice ? (
          <div
            className={`absolute left-4 right-4 z-[28] ${layout.noticeBottomClass} rounded-[18px] px-4 py-3 text-[12px] font-medium shadow-[0_16px_40px_rgba(15,23,42,0.12)] ${
              detailNotice.tone === 'error'
                ? 'bg-[#fff1f2] text-[#9f4155]'
                : 'bg-[#eef6ff] text-[#476786]'
            }`}
          >
            {detailNotice.text}
          </div>
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
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
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
                    disabled={!activeCompanion || !!activeCompanionDisabledReason}
                    onClick={() => pushMallMessageToChat(selectedItem, 'share')}
                    className="flex items-center justify-center gap-2 rounded-full bg-[#edf2fb] px-4 py-3 text-[12px] font-semibold text-[#587097] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Share2 size={15} />
                    分享给TA
                  </button>
                  <button
                    type="button"
                    disabled={!activeCompanion || !!activeCompanionDisabledReason}
                    onClick={() => askCompanionInline(selectedItem)}
                    className="flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#f7d8df_0%,#f2e2cf_100%)] px-4 py-3 text-[12px] font-semibold text-[#764e60] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MessageCircle size={15} />
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
          className={`absolute right-4 z-[24] ${layout.orbBottomClass} flex items-center gap-3 rounded-full bg-white/96 px-3 py-2.5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.16)]`}
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

  const commitSearch = () => {
    const normalized = searchInput.trim();
    setCommittedSearch(normalized);
    if (!normalized) {
      return;
    }

    updateMallData({
      ...mallData,
      recentSearches: buildRecentSearches(mallData.recentSearches, normalized),
    });
  };

  const addToCart = (item: MallCatalogItem) => {
    const mode = resolveCartMode(item);
    const existing = mallData.cart.find((entry) => entry.itemId === item.id && entry.mode === mode);
    const nextCart = existing
      ? mallData.cart.map((entry) => (
          entry.id === existing.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        ))
      : [
          {
            id: `mall-cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            itemId: item.id,
            quantity: 1,
            mode,
            addedAt: Date.now(),
          },
          ...mallData.cart,
        ];

    updateMallData({
      ...mallData,
      cart: nextCart,
    });
  };

  const buyNow = (item: MallCatalogItem) => {
    addToCart(item);
    setActiveTab('cart');
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
    updateMallData({
      ...mallData,
      cart: mallData.cart.filter((entry) => entry.id !== entryId),
    });
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
      window.alert('请把收货人、电话、地区和详细地址补全。');
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
    setShowAddressSheet(false);
    setEditingAddressId(null);
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
  };

  const handleCheckout = () => {
    if (cartEntries.length === 0) {
      return;
    }

    const hasPhysicalItems = cartEntries.some(({ entry }) => entry.mode === 'self');
    if (hasPhysicalItems && !selectedAddress) {
      window.alert('请先添加并选择收货地址。');
      return;
    }

    const selectedCard = walletData.cards.find((card) => card.id === selectedCardId);
    if (!selectedCard) {
      window.alert('请先选择支付卡片。');
      return;
    }

    if (selectedCard.balance < cartTotal) {
      window.alert('余额不足。');
      return;
    }

    const now = Date.now();
    const walletTransactionId = `mall-wallet-${now}`;
    const nextCards = walletData.cards.map((card) => (
      card.id === selectedCardId
        ? { ...card, balance: Number((card.balance - cartTotal).toFixed(2)) }
        : card
    ));
    const nextWalletData: WalletData = {
      ...walletData,
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

    cartEntries.forEach(({ entry, item }, recordIndex) => {
      if (!item) {
        return;
      }

      for (let count = 0; count < entry.quantity; count += 1) {
        const orderId = `mall-order-${now}-${recordIndex}-${count}`;
        const status: MallOrder['status'] = entry.mode === 'digital' ? 'fulfilled' : 'packing';

        nextOrders.unshift({
          id: orderId,
          itemId: item.id,
          mode: entry.mode,
          status,
          walletTransactionId,
          ...(entry.mode === 'self' && selectedAddress
            ? {
                shippingAddressId: selectedAddress.id,
                shippingAddressSnapshot: buildAddressSnapshot(selectedAddress),
              }
            : {}),
          createdAt: now + recordIndex + count,
          updatedAt: now + recordIndex + count,
        });

        nextDeliveryFeed.unshift({
          id: `mall-delivery-${orderId}`,
          orderId,
          kind: entry.mode === 'digital' ? 'system' : 'status_update',
          text: entry.mode === 'digital'
            ? `${item.title} 已直接发放到你的数字物品。`
            : `${item.title} 已支付成功，正在备货，收货人是 ${selectedAddress?.recipientName || '你'}。`,
          timestamp: now + recordIndex + count,
        });

        if (entry.mode === 'digital') {
          nextOwnedItems.unshift({
            id: `mall-owned-${orderId}`,
            sourceOrderId: orderId,
            itemId: item.id,
            ownership: 'digital',
            acquiredAt: now + recordIndex + count,
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
    let nextOwnedItems = mallData.ownedItems;

    if (order.status === 'packing') {
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

    updateMallData({
      ...mallData,
      orders: mallData.orders.map((entry) => (
        entry.id === orderId
          ? { ...entry, status: nextStatus, updatedAt: now }
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
    });
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
              commitSearch();
            }
          }}
          placeholder="搜索你想买的东西"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
        />
        <button type="button" onClick={commitSearch} className="rounded-full bg-[#f4dbe1] px-3 py-1.5 text-[11px] font-semibold text-[#764e60]">
          搜索
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setCategory(entry)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
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
    <div className="grid grid-cols-2 gap-3">
      {filteredCatalog.map((item) => (
        <MallProductCard
          key={item.id}
          item={item}
          priceText={formatPrice(item.price)}
          onOpen={() => setSelectedItemId(item.id)}
          onAddToCart={() => addToCart(item)}
        />
      ))}
    </div>
  );

  const renderHome = () => (
    <div className="space-y-4 px-4 pb-28 pt-4">
      <MallHeroCarousel
        slides={HOME_HERO_SLIDES.map((slide) => ({ ...slide }))}
        onAction={(nextCategory) => {
          setCategory(nextCategory);
          setActiveTab('browse');
        }}
      />
      <div className="rounded-[20px] bg-white p-4 shadow-sm">
        <div className="text-[15px] font-bold text-zinc-900">常逛类目</div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {categories.slice(1, 9).map((entry) => (
            <MallCategoryShortcut
              key={entry}
              icon={CATEGORY_ICON_MAP[entry] || '🛍️'}
              label={entry}
              onClick={() => {
                setCategory(entry);
                setActiveTab('browse');
              }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-[20px] bg-white p-4 shadow-sm">
        <div className="text-[16px] font-bold text-zinc-900">为你推荐</div>
        <div className="mt-1 text-[12px] text-zinc-500">先从最基础的自购和数字商品开始，后面再接送礼和角色互动。</div>
      </div>
      {renderProductGrid()}
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
              hint={entry === '全部' ? '全部商品' : `${mallData.catalog.filter((item) => item.category === entry).length} 件`}
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
                className="rounded-full bg-zinc-100 px-3 py-1.5 text-[11px] font-medium text-zinc-500"
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
                <ClampText text={item!.copy.cardBlurb} lines={2} className="mt-2 text-[12px] leading-5 text-zinc-500" />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[16px] font-black text-zinc-900">{formatPrice(item!.price)}</div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => changeCartQuantity(entry.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf2fb] text-[#587097]">-</button>
                    <span className="min-w-6 text-center text-[13px] font-semibold text-zinc-700">{entry.quantity}</span>
                    <button type="button" onClick={() => changeCartQuantity(entry.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf2fb] text-[#587097]"><Plus size={14} /></button>
                    <button type="button" onClick={() => removeCartEntry(entry.id)} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-400"><Trash2 size={14} /></button>
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
        <div className="mt-1 text-[12px] text-zinc-500">已选 {cartEntries.length} 件商品，第一批先支持普通自购和数字商品结算。</div>
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
          {renderCartEntryList(digitalCartEntries, '数字商品', '支付后会立即发放到你的数字物品。')}

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

          <div className="rounded-[20px] bg-white p-4 shadow-sm">
            <div className="text-[13px] font-semibold text-zinc-700">支付方式</div>
            <div className="mt-3">
              <AppSelect
                value={selectedCardId}
                onChange={setSelectedCardId}
                options={walletData.cards.map((card) => ({
                  value: card.id,
                  label: `${card.bankName} ${card.number}`,
                  description: `余额 ${formatPrice(card.balance)}`,
                }))}
                placeholder="选择支付卡片"
                emptyText="当前还没有可用卡片"
              />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-[16px] bg-zinc-50 px-4 py-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">合计</div>
                <div className="mt-1 text-[22px] font-black text-zinc-900">{formatPrice(cartTotal)}</div>
              </div>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={cartEntries.length === 0 || !selectedCardId || walletData.cards.length === 0}
                className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-40`}
              >
                使用钱包支付
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
                      {resolveOrderStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-zinc-500">
                    {order.mode === 'digital' ? '数字解锁' : '送到我这里'} · 下单于 {new Date(order.createdAt).toLocaleString()}
                  </div>
                  {order.shippingAddressSnapshot ? (
                    <div className="mt-2 text-[11px] text-zinc-400">收货地址 · {buildAddressPreview(order.shippingAddressSnapshot)}</div>
                  ) : null}
                  <ClampText text={item.copy.cardBlurb} lines={2} className="mt-2 text-[12px] leading-5 text-zinc-500" />
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-[16px] font-black text-zinc-900">{formatPrice(item.price)}</div>
                    {order.mode === 'self' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setMePage('deliveries');
                          }}
                          className="rounded-full bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-500"
                        >
                          查看物流
                        </button>
                        {['packing', 'delivering', 'signed'].includes(order.status) ? (
                          <button type="button" onClick={() => progressOrder(order.id)} className={SECONDARY_BUTTON_CLASS}>
                            {order.status === 'packing' ? '推进配送' : order.status === 'delivering' ? '确认收货' : '完成入库'}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-[11px] font-medium text-zinc-400">已直接发放</div>
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
          {ownedEntries.map(({ entry, item }) => (
            <div key={entry.id} className="overflow-hidden rounded-[20px] border border-zinc-100 bg-white shadow-sm">
              <div className="p-2.5">
                <MallProductThumb item={item!} />
              </div>
              <div className="space-y-2 px-3.5 pb-3.5">
                <div className="text-[14px] font-semibold text-zinc-900">{item!.title}</div>
                <div className="text-[11px] text-zinc-500">{resolveOwnershipLabel(entry.ownership)}</div>
                <ClampText text={item!.copy.cardBlurb} lines={2} className="text-[12px] leading-5 text-zinc-500" />
              </div>
            </div>
          ))}
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
                  onClick={() => updateMallData({
                    ...mallData,
                    selectedAddressId: address.id,
                    addresses: mallData.addresses.map((entry) => ({
                      ...entry,
                      isDefault: entry.id === address.id,
                    })),
                  })}
                  className={address.id === selectedAddress?.id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
                >
                  {address.id === selectedAddress?.id ? '当前使用' : '设为默认'}
                </button>
                <button type="button" onClick={() => openAddressEditor(address.id)} className="rounded-full bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-500">编辑</button>
                <button type="button" onClick={() => removeAddress(address.id)} className="rounded-full bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-400">删除</button>
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
                    <div className="mt-2 text-[11px] text-zinc-400">当前状态 · {resolveOrderStatusLabel(selectedOrder.status)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] bg-white p-4 shadow-sm">
                <div className="text-[13px] font-semibold text-zinc-900">物流进度</div>
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

              {selectedOrder.shippingAddressSnapshot ? (
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
      ) : latestDeliveryEvents.length === 0 ? (
        <div className="rounded-[20px] bg-white px-4 py-5 text-[12px] text-zinc-500 shadow-sm">
          还没有物流动态，下一次下单后这里会出现最新进展。
        </div>
      ) : (
        <div className="space-y-3">
          {mallData.orders
            .filter((order) => order.mode === 'self')
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
                  className="flex w-full items-center gap-3 rounded-[20px] bg-white px-4 py-4 text-left shadow-sm"
                >
                  <div className="w-[80px] shrink-0">
                    <MallProductThumb item={item} size="cart" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-zinc-900">{item.title}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{resolveOrderStatusLabel(order.status)}</div>
                    <div className="mt-2 text-[12px] text-zinc-400">点击查看这笔订单的物流时间线</div>
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
      {mePage === 'deliveries' ? renderDeliveriesContent() : null}
    </div>
  );

  const currentMeSubPageMeta = activeTab === 'me' && mePage !== 'overview'
    ? selectedOrder && mePage === 'deliveries'
      ? { title: '订单物流', subtitle: '查看这一笔订单的完整物流进度和动态' }
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
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700"
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
            <div className="text-[20px] font-bold tracking-tight text-zinc-900">{selectedItem.title}</div>
            <div className="mt-1 text-[13px] text-zinc-500">{selectedItem.subtitle || selectedItem.subCategory || selectedItem.category}</div>
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
              value={resolveCartMode(selectedItem) === 'digital' ? '数字解锁，下单后立即发放' : '普通实物，送到我这里'}
            />
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
        {renderCompanionOverlay({
          orbBottomClass: 'bottom-[106px]',
          panelBottomClass: 'bottom-[176px]',
          noticeBottomClass: 'bottom-[176px]',
        })}
        <div className="absolute inset-x-0 bottom-0 border-t border-zinc-200 bg-white/96 px-4 pb-6 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => addToCart(selectedItem)} className={SECONDARY_BUTTON_CLASS}>加入购物车</button>
            <button type="button" onClick={() => buyNow(selectedItem)} className={PRIMARY_BUTTON_CLASS}>立即购买</button>
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700"
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

      {renderCompanionOverlay({
        orbBottomClass: 'bottom-[102px]',
        panelBottomClass: 'bottom-[164px]',
        noticeBottomClass: 'bottom-[164px]',
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
                }}
                className="rounded-full bg-zinc-100 px-3 py-1.5 text-[11px] font-semibold text-zinc-500"
              >
                关闭
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <input
                value={addressDraft.recipientName}
                onChange={(event) => setAddressDraft((prev) => ({ ...prev, recipientName: event.target.value }))}
                placeholder="收货人"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <input
                value={addressDraft.phone}
                onChange={(event) => setAddressDraft((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="联系电话"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <input
                value={addressDraft.region}
                onChange={(event) => setAddressDraft((prev) => ({ ...prev, region: event.target.value }))}
                placeholder="地区 / 城市 / 区"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <input
                value={addressDraft.detail}
                onChange={(event) => setAddressDraft((prev) => ({ ...prev, detail: event.target.value }))}
                placeholder="详细地址"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <input
                value={addressDraft.tag}
                onChange={(event) => setAddressDraft((prev) => ({ ...prev, tag: event.target.value }))}
                placeholder="地址标签，例如 家 / 公司"
                className="rounded-[16px] bg-zinc-50 px-4 py-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddressSheet(false);
                  setEditingAddressId(null);
                }}
                className={SECONDARY_BUTTON_CLASS}
              >
                稍后再填
              </button>
              <button type="button" onClick={saveAddressDraft} className={PRIMARY_BUTTON_CLASS}>
                保存地址
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
              className={`rounded-[18px] px-3 py-2 text-[12px] font-semibold ${
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
