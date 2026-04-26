import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import { AppData, DesktopIconConfig, VisualSettings, UserProfileExtended, MusicData, WidgetConfig } from '../../../types';
import { DesktopWidget } from '../../shared/DesktopWidgets';
import { usePersistentFieldActions } from '../../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { useResolvedThemeTypographyCss } from '../../../features/theme/useResolvedThemeTypographyCss';
import { getThemeImportedFontFamily, resolveThemeFontPriority } from '../../../features/theme/themeTypography';
import { getDisplayableAssetValue } from '../../../features/persistence/persistentAssetRef';
import {
  buildDesktopIconPlacements,
  getDesktopLayoutMetrics,
  buildDesktopSlots,
  buildDesktopWidgetPlacements,
  buildDockPlacement,
  buildNavBarPlacement,
  type HomeScreenSizeTier,
  getNearestDesktopSlotId,
  resolveDesktopIconDrop,
  resolveWidgetDrop,
  resolveNavBarDrop,
} from './layout';
import './HomeScreen.css';

type UserProfile = UserProfileExtended;

type AppDefinition = {
  id: string;
  name: string;
  icon: string;
  onClick: () => void;
};

type DragGhostState =
  | {
      kind: 'icon';
      id: string;
      x: number;
      y: number;
      iconSize: number;
      app: AppDefinition;
    }
  | {
      kind: 'widget';
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      widget: WidgetConfig;
    };

function resolveDesktopFontFamily(visualSettings?: VisualSettings): string | undefined {
  const priority = resolveThemeFontPriority(visualSettings?.themeTypography);
  const selectedFontId = visualSettings?.themeTypography?.selectedFontId;

  if (selectedFontId && priority !== 'css-only') {
    return `"${getThemeImportedFontFamily(selectedFontId)}"`;
  }

  const fontFamily = visualSettings?.desktop?.fontFamily;
  return fontFamily === 'Mono'
    ? 'monospace'
    : fontFamily === 'Serif'
      ? 'serif'
      : fontFamily === 'Cursive'
        ? 'cursive'
        : fontFamily === 'Inter'
          ? 'sans-serif'
          : undefined;
}

function parseGridSlot(slotId?: string | null) {
  if (!slotId) return null;
  const match = slotId.match(/^slot-(\d+)-(\d+)$/);
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  return {
    gridRowStart: row + 1,
    gridColumnStart: col + 1,
  };
}

function getExplicitGridStyle(slotId?: string | null, w = 1, h = 1): React.CSSProperties | undefined {
  const gridPos = parseGridSlot(slotId);
  if (!gridPos) return undefined;
  return {
    gridRowStart: gridPos.gridRowStart,
    gridColumnStart: gridPos.gridColumnStart,
    gridRowEnd: `span ${h}`,
    gridColumnEnd: `span ${w}`,
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
    justifySelf: 'stretch',
  };
}

type DesktopAppId = 'chat' | 'settings' | 'worldbook' | 'monitor' | 'couple-space' | 'perception' | 'music' | 'forum';

const WALLPAPER_URL = 'https://tse4.mm.bing.net/th/id/OIP.Cg3l8e76ACyxyLdkdP_tSgAAAA?rs=1&pid=ImgDetMain&o=7&rm=3';
const APP_ICON_URL = 'https://tu.tuhenmei.com/tu2026/2025120917/gg0qhoi1q2j25922.jpeg';
const DESKTOP_ROWS = 7;
const MIN_DESKTOP_PAGE_COUNT = 2;
const DOCK_APP_IDS = ['wallet', 'dream', 'customization'] as const;

export function HomeScreen({
  onOpenApp,
  userProfile,
  setUserProfile,
  visualSettings,
  setVisualSettings,
  appData,
  setAppData,
}: {
  onOpenApp: (app: 'chat' | 'settings' | 'dream' | 'worldbook' | 'monitor' | 'customization' | 'couple-space' | 'perception' | 'music' | 'forum' | 'wallet') => void;
  userProfile: UserProfile;
  setUserProfile: (p: UserProfile) => void;
  visualSettings: VisualSettings;
  setVisualSettings: (s: VisualSettings) => void;
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  key?: string;
}) {
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showMoodMenu, setShowMoodMenu] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [isArrangeMode, setIsArrangeMode] = useState(false);
  const [draggingIconId, setDraggingIconId] = useState<string | null>(null);
  const [draggingIconPage, setDraggingIconPage] = useState<number | null>(null);
  const [draggingIconOriginPage, setDraggingIconOriginPage] = useState<number | null>(null);
  const [iconPreviewConfigs, setIconPreviewConfigs] = useState<DesktopIconConfig[] | null>(null);
  const [draggingNavBar, setDraggingNavBar] = useState(false);
  const [draggingNavBarPage, setDraggingNavBarPage] = useState<number | null>(null);
  const [navBarPreviewSlotId, setNavBarPreviewSlotId] = useState<string | null>(null);
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [draggingWidgetPage, setDraggingWidgetPage] = useState<number | null>(null);
  const [widgetPreviewConfigs, setWidgetPreviewConfigs] = useState<WidgetConfig[] | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);
  const [navBarMeasuredWidth, setNavBarMeasuredWidth] = useState<number | null>(null);
  const [desktopViewport, setDesktopViewport] = useState({ width: 360, height: 720 });
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);
  const [pageDirection, setPageDirection] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const { resolvedFonts } = useResolvedThemeTypographyCss(visualSettings?.themeTypography);
  const desktopFontFaceCss = resolvedFonts
    .map((font) => `@font-face {
  font-family: "${font.familyName}";
  src: url("${font.resolvedUrl}");
  font-display: swap;
}`)
    .join('\n\n');

  const fontSize = visualSettings?.desktop?.fontSize ?? 12;
  const fontColor = visualSettings?.desktop?.fontColor ?? '#ffffff';
  const fontWeight = visualSettings?.desktop?.fontWeight ?? 'normal';
  const cols = visualSettings?.desktop?.gridColumns ?? 4;
  const configuredIconSize = visualSettings?.desktop?.iconSize;
  const configuredGap = visualSettings?.desktop?.gridGap;

  const fontStyle: React.CSSProperties = {
    fontFamily: resolveDesktopFontFamily(visualSettings),
    fontSize: `${fontSize}px`,
    color: fontColor,
    fontWeight: fontWeight === 'bold' ? 'bold' : fontWeight === 'lighter' ? 'lighter' : 'normal',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  };
  const topBarTextStrongStyle: React.CSSProperties = {
    color: fontColor,
    textShadow: fontColor.toLowerCase() === '#ffffff' || fontColor.toLowerCase() === 'white'
      ? '0 1px 2px rgba(0,0,0,0.35)'
      : '0 1px 2px rgba(255,255,255,0.22)',
  };
  const topBarTextSoftStyle: React.CSSProperties = {
    color: fontColor,
    opacity: 0.72,
    textShadow: topBarTextStrongStyle.textShadow,
  };

  const [appOrder] = useState<DesktopAppId[]>(() => {
    const order = (visualSettings?.desktop?.appOrder as DesktopAppId[] | undefined) || [
      'chat',
      'settings',
      'worldbook',
      'monitor',
      'couple-space',
      'perception',
      'music',
    ];
    const filteredOrder = order.filter((id): id is DesktopAppId => id !== ('wallet' as DesktopAppId));
    if (!filteredOrder.includes('perception')) filteredOrder.push('perception');
    if (!filteredOrder.includes('music')) filteredOrder.push('music');
    if (!filteredOrder.includes('forum')) filteredOrder.push('forum');
    return filteredOrder;
  });

  useEffect(() => {
    if (JSON.stringify(appOrder) !== JSON.stringify(visualSettings?.desktop?.appOrder)) {
      setVisualSettings({
        ...visualSettings,
        desktop: {
          ...visualSettings.desktop,
          appOrder,
        },
      });
    }
  }, [appOrder, setVisualSettings, visualSettings]);

  const apps = useMemo<AppDefinition[]>(
    () => [
      { id: 'chat', name: '聊天', icon: APP_ICON_URL, onClick: () => onOpenApp('chat') },
      { id: 'settings', name: 'API 中心', icon: APP_ICON_URL, onClick: () => onOpenApp('settings') },
      { id: 'worldbook', name: '世界书', icon: APP_ICON_URL, onClick: () => onOpenApp('worldbook') },
      { id: 'monitor', name: '监控功能', icon: APP_ICON_URL, onClick: () => onOpenApp('monitor') },
      { id: 'couple-space', name: '情侣空间', icon: APP_ICON_URL, onClick: () => onOpenApp('couple-space') },
      { id: 'perception', name: '感知', icon: APP_ICON_URL, onClick: () => onOpenApp('perception') },
      {
        id: 'music',
        name: '音乐',
        icon: APP_ICON_URL,
        onClick: () => onOpenApp('music'),
      },
      { id: 'forum', name: '论坛', icon: APP_ICON_URL, onClick: () => onOpenApp('forum') },
      { id: 'wallet', name: '钱包', icon: APP_ICON_URL, onClick: () => onOpenApp('wallet') },
      { id: 'dream', name: '梦境', icon: APP_ICON_URL, onClick: () => onOpenApp('dream') },
      { id: 'customization', name: '自定义', icon: APP_ICON_URL, onClick: () => onOpenApp('customization') },
    ],
    [onOpenApp, setAppData],
  );

  const desktopApps = useMemo(() => apps.filter(app => appOrder.includes(app.id as DesktopAppId)), [apps, appOrder]);
  const currentIcons = (visualSettings.desktopIcons || []).map((icon) => (
    icon.id === 'sms'
      ? { ...icon, id: 'dream' }
      : icon
  ));
  const pageCount = useMemo(() => {
    const iconPages = currentIcons.map(icon => (typeof icon.page === 'number' ? icon.page : 0));
    const widgetPages = (visualSettings.widgets || []).map(widget => (typeof widget.page === 'number' ? widget.page : 0));
    const navBarPages = [typeof visualSettings.navBar?.page === 'number' ? visualSettings.navBar.page : 0];
    const maxPage = Math.max(0, ...iconPages, ...widgetPages, ...navBarPages);
    return Math.max(MIN_DESKTOP_PAGE_COUNT, maxPage + 1);
  }, [currentIcons, visualSettings.navBar?.page, visualSettings.widgets]);
  const normalizeDesktopPage = (page?: number) => {
    const resolved = typeof page === 'number' ? page : 0;
    return Math.min(Math.max(resolved, 0), pageCount - 1);
  };
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeEnabledRef = useRef(false);
  const ignoreSwipeUntilRef = useRef(0);
  const dragPageTurnUntilRef = useRef(0);
  const lastPreviewSlotIdRef = useRef<string | null>(null);
  const iconPointerSessionRef = useRef<{
    appId: string;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const draggingIconPageRef = useRef<number | null>(null);
  const widgetPointerSessionRef = useRef<{
    widgetId: string;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const draggingWidgetPageRef = useRef<number | null>(null);
  const navBarInnerRef = useRef<HTMLDivElement | null>(null);
  const desktopRootRef = useRef<HTMLDivElement | null>(null);
  const sizeTier: HomeScreenSizeTier =
    desktopViewport.width <= 375 ? 'compact' : desktopViewport.width >= 415 ? 'large' : 'regular';
  const aspectRatio = desktopViewport.height / Math.max(desktopViewport.width, 1);
  const isTallPhone =
    sizeTier !== 'compact'
    && desktopViewport.height >= (sizeTier === 'large' ? 880 : 820)
    && aspectRatio >= 2.05;
  const layoutMetrics = useMemo(
    () =>
      getDesktopLayoutMetrics({
        containerWidth: desktopViewport.width,
        containerHeight: desktopViewport.height,
        cols,
        rows: DESKTOP_ROWS,
        sizeTier,
        iconSize: configuredIconSize,
        gap: configuredGap,
        safeAreaBottom,
        isTallPhone,
      }),
    [cols, configuredGap, configuredIconSize, desktopViewport.height, desktopViewport.width, isTallPhone, safeAreaBottom, sizeTier],
  );
  const iconSize = layoutMetrics.iconSize;
  const gap = layoutMetrics.gridGap;
  const slots = useMemo(
    () => buildDesktopSlots({ cols, rows: DESKTOP_ROWS, metrics: layoutMetrics }),
    [cols, layoutMetrics],
  );
  const normalizedIcons = useMemo(
    () => currentIcons.map(icon => ({ ...icon, page: normalizeDesktopPage(icon.page) })),
    [currentIcons],
  );
  const normalizedWidgets = useMemo(
    () => (visualSettings.widgets || []).map(widget => ({ ...widget, page: normalizeDesktopPage(widget.page) })),
    [visualSettings.widgets],
  );
  const workingWidgetConfigs = useMemo(
    () => (widgetPreviewConfigs || normalizedWidgets).map(widget => ({ ...widget, page: normalizeDesktopPage(widget.page) })),
    [widgetPreviewConfigs, normalizedWidgets],
  );
  const navBarPage = normalizeDesktopPage(visualSettings.navBar?.page);

  useLayoutEffect(() => {
    const node = desktopRootRef.current;
    if (!node) return;

    const updateViewport = () => {
      const rect = node.getBoundingClientRect();
      const next = {
        width: Math.round(rect.width || 360),
        height: Math.round(rect.height || 720),
      };
      setDesktopViewport(current => (current.width === next.width && current.height === next.height ? current : next));

      const phoneContainer = document.getElementById('phone-container');
      const computed = phoneContainer ? window.getComputedStyle(phoneContainer) : null;
      const nextSafeAreaBottom = computed ? Math.round(parseFloat(computed.paddingBottom) || 0) : 0;
      setSafeAreaBottom(current => (current === nextSafeAreaBottom ? current : nextSafeAreaBottom));
    };

    updateViewport();

    const observer = new ResizeObserver(() => updateViewport());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const node = navBarInnerRef.current;
    if (!node) return;

    const updateWidth = () => {
      const nextWidth = Math.round(node.getBoundingClientRect().width);
      setNavBarMeasuredWidth(current => (current === nextWidth ? current : nextWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);

    return () => observer.disconnect();
  }, [visualSettings?.navBar?.show]);

  useEffect(() => {
    setCurrentPage(0);
  }, []);

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, pageCount - 1));
  }, [pageCount]);

  const navBarPlacement = useMemo(
    () =>
      buildNavBarPlacement({
        navBarSlotId: navBarPreviewSlotId || visualSettings.navBar?.slotId || undefined,
        slots,
        cols,
        renderWidth: navBarMeasuredWidth || undefined,
        metrics: layoutMetrics,
      }),
    [cols, layoutMetrics, navBarMeasuredWidth, navBarPreviewSlotId, slots, visualSettings.navBar?.slotId],
  );

  const currentPageWidgets = useMemo(
    () => workingWidgetConfigs.filter(widget => normalizeDesktopPage(widget.page) === currentPage),
    [currentPage, workingWidgetConfigs],
  );
  const navOccupiedSlotIds = useMemo(
    () => (navBarPage === currentPage ? new Set(navBarPlacement.slotIds) : new Set<string>()),
    [currentPage, navBarPage, navBarPlacement.slotIds],
  );
  const widgetLayout = useMemo(
    () => buildDesktopWidgetPlacements(currentPageWidgets, slots, cols, navOccupiedSlotIds),
    [cols, currentPageWidgets, navOccupiedSlotIds, slots],
  );
  const draggedWidgetPreviewSlotIds = useMemo(() => {
    if (!draggingWidgetId) return [];
    const targetPage = draggingWidgetPageRef.current ?? draggingWidgetPage ?? currentPage;
    const targetPageWidgets = workingWidgetConfigs.filter(widget => normalizeDesktopPage(widget.page) === targetPage);
    const targetPageNavOccupiedSlotIds = navBarPage === targetPage ? new Set(navBarPlacement.slotIds) : new Set<string>();
    const targetPreviewLayout = buildDesktopWidgetPlacements(targetPageWidgets, slots, cols, targetPageNavOccupiedSlotIds);
    return targetPreviewLayout.placements[draggingWidgetId]?.slotIds || [];
  }, [cols, currentPage, draggingWidgetId, draggingWidgetPage, navBarPage, navBarPlacement.slotIds, slots, workingWidgetConfigs]);

  const dockPlacement = useMemo(
    () =>
      buildDockPlacement({
        dockSlotId: visualSettings.desktop?.dockSlotId || undefined,
        slots,
        cols,
        occupiedSlotIds: widgetLayout.occupiedSlotIds,
        metrics: layoutMetrics,
      }),
    [cols, layoutMetrics, slots, visualSettings.desktop?.dockSlotId, widgetLayout.occupiedSlotIds],
  );

  const occupiedSlotIds = useMemo(() => {
    const next = new Set(widgetLayout.occupiedSlotIds);
    dockPlacement.slotIds.forEach(slotId => next.add(slotId));
    return next;
  }, [dockPlacement.slotIds, widgetLayout.occupiedSlotIds]);

  const workingIconConfigs = useMemo(
    () => (iconPreviewConfigs || normalizedIcons).map(icon => ({ ...icon, page: normalizeDesktopPage(icon.page) })),
    [iconPreviewConfigs, normalizedIcons],
  );
  const appsOnCurrentPage = useMemo(
    () =>
      appOrder.filter(appId => {
        const config = workingIconConfigs.find(icon => icon.id === appId);
        return normalizeDesktopPage(config?.page) === currentPage;
      }),
    [appOrder, currentPage, workingIconConfigs],
  );
  const currentPageIconConfigs = useMemo(
    () => normalizedIcons.filter(icon => normalizeDesktopPage(icon.page) === currentPage),
    [currentPage, normalizedIcons],
  );
  const workingPageIconConfigs = useMemo(
    () => workingIconConfigs.filter(icon => normalizeDesktopPage(icon.page) === currentPage),
    [currentPage, workingIconConfigs],
  );
  const committedIconPlacements = useMemo(
    () => buildDesktopIconPlacements(appsOnCurrentPage, currentPageIconConfigs, slots, occupiedSlotIds),
    [appsOnCurrentPage, currentPageIconConfigs, occupiedSlotIds, slots],
  );

  const previewIconPlacements = useMemo(
    () => buildDesktopIconPlacements(appsOnCurrentPage, workingPageIconConfigs, slots, occupiedSlotIds),
    [appsOnCurrentPage, occupiedSlotIds, slots, workingPageIconConfigs],
  );
  const draggedPreviewSlotId = useMemo(
    () => (draggingIconId ? workingIconConfigs.find(icon => icon.id === draggingIconId)?.slotId ?? null : null),
    [draggingIconId, workingIconConfigs],
  );
  const previewOccupiedSlotIds = useMemo(() => {
    const next = new Set(occupiedSlotIds);
    if (draggedPreviewSlotId) {
      next.add(draggedPreviewSlotId);
    }
    return next;
  }, [draggedPreviewSlotId, occupiedSlotIds]);
  const previewOtherIconPlacements = useMemo(
    () =>
      buildDesktopIconPlacements(
        appsOnCurrentPage.filter(appId => appId !== draggingIconId),
        workingPageIconConfigs,
        slots,
        previewOccupiedSlotIds,
      ),
    [appsOnCurrentPage, draggingIconId, previewOccupiedSlotIds, slots, workingPageIconConfigs],
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const { resolvedUrl: resolvedWallpaperUrl } = useResolvedPersistentValue(appData.visualSettings?.globalBackground);
  const { resolvedUrl: resolvedNavBarBackgroundUrl } = useResolvedPersistentValue(visualSettings.navBar?.backgroundImage);
  const { resolvedUrl: resolvedUserAvatarUrl } = useResolvedPersistentValue(userProfile.avatar);
  const { setRemoteUrl, setUploadedFile } = usePersistentFieldActions();
  const moodOptions = [
    '(^_^)', '(*^▽^*)', '(≧▽≦)', '(⌒▽⌒)', '(๑˃̵ᴗ˂̵)ﻭ', '(｡•̀ᴗ-)✧', '(´｡• ᵕ •｡)', '(=^･ω･^=)',
    '( ˘⌣˘)♡', '(๑•̀ㅂ•́)و', '(´▽ʃ♡ƪ)', '(￣▽￣)', '(•̀ω•́)✧', '(｡◕‿◕｡)', '(ง •̀_•́)ง', '(๑• . •๑)',
    '(╯▽╰ )', '(｡･ω･｡)', '(´∀)', '(＾▽＾)', '(≧ω≦)', '(●ˇ∀ˇ●)', '(๑¯ω¯๑)', '(o^ ^o)',
    '(¬‿¬)', '(￣︶￣)', '(๑˘︶˘๑)', '(>ω<)', '(≧∇≦)ﾉ', '(´-ω-)', '(｡•́︿•̀｡)', '(╥﹏╥)',
    '(｡•́︿•̀｡)', '(╯︵╰,)', '(；′⌒)', '(っ °Д °;)っ', '(⊙_⊙;)', '(•ˋ _ ˊ•)', '(╯°□°）╯', '(￣o￣) . z Z',
    '(－ω－) zzZ', '(｡•́ωก̀｡)', '(๑•﹏•)', '(╯︿╰)', '(っ- ‸ -ς)', '(＞﹏＜)', '(｡ŏ﹏ŏ)', '(´；ω；)',
  ];
  const defaultMood = '(^_^)';
  const currentMood = moodOptions.includes(userProfile.mood || '') ? userProfile.mood : defaultMood;

  useEffect(() => {
    if (!userProfile.mood || !moodOptions.includes(userProfile.mood)) {
      setUserProfile({ ...userProfile, mood: defaultMood });
    }
  }, [setUserProfile, userProfile]);

  const navBarShapeClass =
    visualSettings?.navBar?.shape === 'rectangle'
      ? 'rounded-2xl'
      : visualSettings?.navBar?.shape === 'circle'
        ? 'rounded-[40px]'
        : 'rounded-full';
  const navBarUi = useMemo(() => {
    if (sizeTier === 'compact') {
      return {
        horizontalPadding: 18,
        verticalPadding: 10,
        sideMinWidth: 68,
        timeFontSize: 16,
        dateFontSize: 9,
        avatarSize: 68,
        avatarLift: -32,
        nameFontSize: 11,
        moodFontSize: 14,
        moodLabelFontSize: 8,
      };
    }
    if (sizeTier === 'large') {
      return {
        horizontalPadding: isTallPhone ? 34 : 30,
        verticalPadding: isTallPhone ? 15 : 14,
        sideMinWidth: isTallPhone ? 118 : 104,
        timeFontSize: isTallPhone ? 22 : 20,
        dateFontSize: isTallPhone ? 12 : 11,
        avatarSize: isTallPhone ? 92 : 84,
        avatarLift: isTallPhone ? -46 : -42,
        nameFontSize: isTallPhone ? 14 : 13,
        moodFontSize: isTallPhone ? 20 : 18,
        moodLabelFontSize: isTallPhone ? 11 : 10,
      };
    }
    return {
      horizontalPadding: isTallPhone ? 28 : 25,
      verticalPadding: isTallPhone ? 11 : 11,
      sideMinWidth: isTallPhone ? 92 : 84,
      timeFontSize: isTallPhone ? 20 : 18.5,
      dateFontSize: isTallPhone ? 10.5 : 10,
      avatarSize: isTallPhone ? 86 : 80,
      avatarLift: isTallPhone ? -43 : -40,
      nameFontSize: isTallPhone ? 12.5 : 12,
      moodFontSize: isTallPhone ? 18 : 16.5,
      moodLabelFontSize: isTallPhone ? 9.5 : 9,
    };
  }, [isTallPhone, sizeTier]);

  const persistIconConfigs = (nextConfigs: DesktopIconConfig[]) => {
    const map = new Map(nextConfigs.map(icon => [icon.id, icon]));
    const currentMap = new Map((visualSettings.desktopIcons || []).map(icon => [icon.id, icon]));
    const mergedIds = new Set<string>([...currentMap.keys(), ...map.keys()]);
    const merged = [...mergedIds].map(id => {
      const previous = currentMap.get(id) || { id };
      const next = map.get(id);
      if (!next) return previous;
      return {
        ...previous,
        ...next,
        page: normalizeDesktopPage(next.page),
        slotId: next.slotId,
        x: undefined,
        y: undefined,
      };
    });

    setVisualSettings({
      ...visualSettings,
      desktopIcons: merged,
    });
  };

  const mergePageIconConfigs = (page: number, nextPageConfigs: DesktopIconConfig[], baseConfigs: DesktopIconConfig[]) => {
    const normalizedPage = normalizeDesktopPage(page);
    const nextMap = new Map(nextPageConfigs.map(icon => [icon.id, { ...icon, page: normalizedPage }]));
    const baseMap = new Map(baseConfigs.map(icon => [icon.id, { ...icon, page: normalizeDesktopPage(icon.page) }]));
    const mergedIds = new Set<string>([...baseMap.keys(), ...nextMap.keys()]);

    return [...mergedIds].map(id => {
      const next = nextMap.get(id);
      if (next) {
        return {
          ...baseMap.get(id),
          ...next,
          page: normalizedPage,
          x: undefined,
          y: undefined,
        };
      }
      return baseMap.get(id)!;
    });
  };

  const getLocalPointerPosition = (clientX: number, clientY: number) => {
    const rect = desktopRootRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleIconDragPreview = (appId: string, rawX: number, rawY: number) => {
    let targetPage = draggingIconPageRef.current ?? draggingIconPage ?? currentPage;
    setDragGhost(current =>
      current?.kind === 'icon' && current.id === appId
        ? { ...current, x: rawX, y: rawY }
        : current,
    );
    const probeX = rawX + layoutMetrics.slotWidth / 2;
    const probeY = rawY + layoutMetrics.slotHeight / 2;
    const edgeThreshold = Math.max(52, Math.round(desktopViewport.width * 0.14));
    if (
      Date.now() >= dragPageTurnUntilRef.current
      && rawX >= desktopViewport.width - edgeThreshold
      && targetPage < pageCount - 1
    ) {
      const nextPage = targetPage + 1;
      dragPageTurnUntilRef.current = Date.now() + 220;
      changePage(nextPage);
      draggingIconPageRef.current = nextPage;
      setDraggingIconPage(nextPage);
      lastPreviewSlotIdRef.current = null;
      targetPage = nextPage;
    }
    if (Date.now() >= dragPageTurnUntilRef.current && rawX <= edgeThreshold && targetPage > 0) {
      const nextPage = targetPage - 1;
      dragPageTurnUntilRef.current = Date.now() + 220;
      changePage(nextPage);
      draggingIconPageRef.current = nextPage;
      setDraggingIconPage(nextPage);
      lastPreviewSlotIdRef.current = null;
      targetPage = nextPage;
    }
    const baseConfigs = (iconPreviewConfigs || normalizedIcons).map(icon =>
      icon.id === appId && normalizeDesktopPage(icon.page) !== targetPage
        ? { ...icon, page: targetPage, slotId: undefined, x: undefined, y: undefined }
        : { ...icon, page: normalizeDesktopPage(icon.page) }
    );
    const targetPageConfigs = baseConfigs.map(icon =>
      icon.id === appId ? { ...icon, page: targetPage } : { ...icon, page: normalizeDesktopPage(icon.page) }
    );
    const targetPageWidgets = workingWidgetConfigs.filter(widget => normalizeDesktopPage(widget.page) === targetPage);
    const targetPageNavOccupiedSlotIds = navBarPage === targetPage ? new Set(navBarPlacement.slotIds) : new Set<string>();
    const targetPageWidgetLayout = buildDesktopWidgetPlacements(targetPageWidgets, slots, cols, targetPageNavOccupiedSlotIds);
    const targetPageOccupiedSlotIds = new Set(targetPageWidgetLayout.occupiedSlotIds);
    dockPlacement.slotIds.forEach(slotId => targetPageOccupiedSlotIds.add(slotId));
    const currentSlotId = lastPreviewSlotIdRef.current || targetPageConfigs.find(icon => icon.id === appId)?.slotId || null;
    const currentSlot = currentSlotId ? slots.find(slot => slot.id === currentSlotId) : null;
    const hysteresis = 10;

    let nextSlotId = getNearestDesktopSlotId(
      probeX,
      probeY,
      slots.filter(slot => !targetPageOccupiedSlotIds.has(slot.id) || slot.id === currentSlotId),
    );
    if (
      currentSlot &&
      probeX >= currentSlot.x - hysteresis &&
      probeX <= currentSlot.x + currentSlot.width + hysteresis &&
      probeY >= currentSlot.y - hysteresis &&
      probeY <= currentSlot.y + currentSlot.height + hysteresis
    ) {
      nextSlotId = currentSlot.id;
    }

    if (!nextSlotId || nextSlotId === lastPreviewSlotIdRef.current) {
      return;
    }

    const nextPageConfigs = resolveDesktopIconDrop({
      appIds: appOrder.filter(candidateId => {
        const config = targetPageConfigs.find(icon => icon.id === candidateId);
        return normalizeDesktopPage(config?.page) === targetPage;
      }),
      iconConfigs: targetPageConfigs.filter(icon => normalizeDesktopPage(icon.page) === targetPage),
      draggedId: appId,
      rawX: probeX,
      rawY: probeY,
      slots,
      occupiedSlotIds: targetPageOccupiedSlotIds,
    });
    const resolvedSlotId = nextPageConfigs.find(icon => icon.id === appId)?.slotId ?? null;
    if (!resolvedSlotId || resolvedSlotId === lastPreviewSlotIdRef.current) {
      return;
    }
    lastPreviewSlotIdRef.current = resolvedSlotId;
    setIconPreviewConfigs(mergePageIconConfigs(targetPage, nextPageConfigs as DesktopIconConfig[], targetPageConfigs));
  };

  const handleIconDragCommit = (appId: string, rawX: number, rawY: number) => {
    const targetPage = draggingIconPageRef.current ?? draggingIconPage ?? currentPage;
    const probeX = rawX + layoutMetrics.slotWidth / 2;
    const probeY = rawY + layoutMetrics.slotHeight / 2;
    const targetPageConfigs = (iconPreviewConfigs || normalizedIcons).map(icon =>
      icon.id === appId ? { ...icon, page: targetPage } : { ...icon, page: normalizeDesktopPage(icon.page) }
    );
    const targetPageWidgets = workingWidgetConfigs.filter(widget => normalizeDesktopPage(widget.page) === targetPage);
    const targetPageNavOccupiedSlotIds = navBarPage === targetPage ? new Set(navBarPlacement.slotIds) : new Set<string>();
    const targetPageWidgetLayout = buildDesktopWidgetPlacements(targetPageWidgets, slots, cols, targetPageNavOccupiedSlotIds);
    const targetPageOccupiedSlotIds = new Set(targetPageWidgetLayout.occupiedSlotIds);
    dockPlacement.slotIds.forEach(slotId => targetPageOccupiedSlotIds.add(slotId));
    const nextPageConfigs = resolveDesktopIconDrop({
      appIds: appOrder.filter(candidateId => {
        const config = targetPageConfigs.find(icon => icon.id === candidateId);
        return normalizeDesktopPage(config?.page) === targetPage;
      }),
      iconConfigs: targetPageConfigs.filter(icon => normalizeDesktopPage(icon.page) === targetPage),
      draggedId: appId,
      rawX: probeX,
      rawY: probeY,
      slots,
      occupiedSlotIds: targetPageOccupiedSlotIds,
    });
    lastPreviewSlotIdRef.current = null;
    persistIconConfigs(mergePageIconConfigs(targetPage, nextPageConfigs as DesktopIconConfig[], targetPageConfigs));
    ignoreSwipeUntilRef.current = Date.now() + 260;
    dragPageTurnUntilRef.current = 0;
    setDraggingIconId(null);
    draggingIconPageRef.current = null;
    setDraggingIconPage(null);
    setDraggingIconOriginPage(null);
    setIconPreviewConfigs(null);
    setDragGhost(null);
  };

  const beginIconPointerDrag = (app: AppDefinition, page: number, placement: { x: number; y: number; slotId: string | null }, clientX: number, clientY: number, pointerId: number, dragIconSize: number) => {
    const local = getLocalPointerPosition(clientX, clientY);
    if (!local) return;
    resetSwipeInteraction();
    iconPointerSessionRef.current = {
      appId: app.id,
      pointerId,
      offsetX: local.x - placement.x,
      offsetY: local.y - placement.y,
    };
    setDraggingIconId(app.id);
    draggingIconPageRef.current = page;
    setDraggingIconPage(page);
    setDraggingIconOriginPage(page);
    lastPreviewSlotIdRef.current = placement.slotId;
    setIconPreviewConfigs(null);
    setDragGhost({
      kind: 'icon',
      id: app.id,
      x: placement.x,
      y: placement.y,
      iconSize: dragIconSize,
      app,
    });
  };

  useEffect(() => {
    if (!draggingIconId) return;

    const handlePointerMove = (event: PointerEvent) => {
      const session = iconPointerSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const local = getLocalPointerPosition(event.clientX, event.clientY);
      if (!local) return;
      handleIconDragPreview(session.appId, local.x - session.offsetX, local.y - session.offsetY);
    };

    const finishPointerDrag = (event: PointerEvent) => {
      const session = iconPointerSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const local = getLocalPointerPosition(event.clientX, event.clientY);
      if (local) {
        handleIconDragCommit(session.appId, local.x - session.offsetX, local.y - session.offsetY);
      } else {
        setDraggingIconId(null);
        draggingIconPageRef.current = null;
        setDraggingIconPage(null);
        setDraggingIconOriginPage(null);
        setIconPreviewConfigs(null);
        setDragGhost(null);
      }
      iconPointerSessionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishPointerDrag);
    window.addEventListener('pointercancel', finishPointerDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishPointerDrag);
      window.removeEventListener('pointercancel', finishPointerDrag);
    };
  }, [currentPage, desktopViewport.width, draggingIconId, draggingIconPage, iconPreviewConfigs, layoutMetrics.slotHeight, layoutMetrics.slotWidth, normalizedIcons, workingWidgetConfigs]);

  const mergePageWidgetConfigs = (page: number, nextPageConfigs: WidgetConfig[], baseConfigs: WidgetConfig[]) => {
    const normalizedPage = normalizeDesktopPage(page);
    const nextMap = new Map(nextPageConfigs.map(widget => [widget.id, { ...widget, page: normalizedPage }]));
    return baseConfigs.map(widget => {
      if (normalizeDesktopPage(widget.page) !== normalizedPage) {
        return widget;
      }
      const next = nextMap.get(widget.id);
      return next
        ? {
            ...widget,
            ...next,
            page: normalizedPage,
            x: undefined,
            y: undefined,
          }
        : widget;
    });
  };

  const persistWidgetConfigs = (nextConfigs: WidgetConfig[]) => {
    setVisualSettings({
      ...visualSettings,
      widgets: nextConfigs.map(widget => ({
        ...widget,
        page: normalizeDesktopPage(widget.page),
      })),
    });
  };

  const handleWidgetDragPreview = (widgetId: string, rawX: number, rawY: number) => {
    let targetPage = draggingWidgetPageRef.current ?? draggingWidgetPage ?? currentPage;
    const edgeThreshold = Math.max(52, Math.round(desktopViewport.width * 0.14));
    if (
      Date.now() >= dragPageTurnUntilRef.current
      && rawX >= desktopViewport.width - edgeThreshold
      && targetPage < pageCount - 1
    ) {
      const nextPage = targetPage + 1;
      dragPageTurnUntilRef.current = Date.now() + 220;
      changePage(nextPage);
      draggingWidgetPageRef.current = nextPage;
      setDraggingWidgetPage(nextPage);
      targetPage = nextPage;
    }
    if (
      Date.now() >= dragPageTurnUntilRef.current
      && rawX <= edgeThreshold
      && targetPage > 0
    ) {
      const nextPage = targetPage - 1;
      dragPageTurnUntilRef.current = Date.now() + 220;
      changePage(nextPage);
      draggingWidgetPageRef.current = nextPage;
      setDraggingWidgetPage(nextPage);
      targetPage = nextPage;
    }
    const baseConfigs = (widgetPreviewConfigs || normalizedWidgets).map(widget => ({
      ...widget,
      page: widget.id === widgetId && normalizeDesktopPage(widget.page) !== targetPage ? targetPage : normalizeDesktopPage(widget.page),
      slotId: widget.id === widgetId && normalizeDesktopPage(widget.page) !== targetPage ? undefined : widget.slotId,
      x: widget.id === widgetId && normalizeDesktopPage(widget.page) !== targetPage ? undefined : widget.x,
      y: widget.id === widgetId && normalizeDesktopPage(widget.page) !== targetPage ? undefined : widget.y,
    }));
    const placement =
      buildDesktopWidgetPlacements(
        baseConfigs.filter(widget => normalizeDesktopPage(widget.page) === targetPage),
        slots,
        cols,
        navBarPage === targetPage ? new Set(navBarPlacement.slotIds) : new Set<string>(),
      ).placements[widgetId] || null;
    const centeredRawX = rawX + ((placement?.width ?? 0) / 2);
    const centeredRawY = rawY + ((placement?.height ?? 0) / 2);
    const baseOccupiedSlotIds = navBarPage === targetPage ? new Set(navBarPlacement.slotIds) : new Set<string>();
    const pageWidgets = baseConfigs.filter(widget => normalizeDesktopPage(widget.page) === targetPage);
    const nextPageConfigs = resolveWidgetDrop({
      widgets: pageWidgets,
      draggedId: widgetId,
      rawX: centeredRawX,
      rawY: centeredRawY,
      slots,
      cols,
      baseOccupiedSlotIds,
    }) as WidgetConfig[];
    setWidgetPreviewConfigs(mergePageWidgetConfigs(targetPage, nextPageConfigs, baseConfigs));
  };

  const handleWidgetDragCommit = (widgetId: string, rawX: number, rawY: number) => {
    const targetPage = draggingWidgetPageRef.current ?? draggingWidgetPage ?? currentPage;
    const baseConfigs = (widgetPreviewConfigs || normalizedWidgets).map(widget => ({
      ...widget,
      page: normalizeDesktopPage(widget.page),
    }));
    const placement =
      buildDesktopWidgetPlacements(
        baseConfigs.filter(widget => normalizeDesktopPage(widget.page) === targetPage),
        slots,
        cols,
        navBarPage === targetPage ? new Set(navBarPlacement.slotIds) : new Set<string>(),
      ).placements[widgetId] || null;
    const centeredRawX = rawX + ((placement?.width ?? 0) / 2);
    const centeredRawY = rawY + ((placement?.height ?? 0) / 2);
    const baseOccupiedSlotIds = navBarPage === targetPage ? new Set(navBarPlacement.slotIds) : new Set<string>();
    const pageWidgets = baseConfigs.filter(widget => normalizeDesktopPage(widget.page) === targetPage);
    const nextPageConfigs = resolveWidgetDrop({
      widgets: pageWidgets,
      draggedId: widgetId,
      rawX: centeredRawX,
      rawY: centeredRawY,
      slots,
      cols,
      baseOccupiedSlotIds,
    }) as WidgetConfig[];
    persistWidgetConfigs(mergePageWidgetConfigs(targetPage, nextPageConfigs, baseConfigs));
    setDraggingWidgetId(null);
    draggingWidgetPageRef.current = null;
    setDraggingWidgetPage(null);
    setWidgetPreviewConfigs(null);
    ignoreSwipeUntilRef.current = Date.now() + 260;
    dragPageTurnUntilRef.current = 0;
    setDragGhost(null);
  };

  const beginWidgetPointerDrag = (
    widget: WidgetConfig,
    page: number,
    placement: { x: number; y: number; width: number; height: number },
    clientX: number,
    clientY: number,
    pointerId: number,
  ) => {
    const local = getLocalPointerPosition(clientX, clientY);
    if (!local) return;
    resetSwipeInteraction();
    widgetPointerSessionRef.current = {
      widgetId: widget.id,
      pointerId,
      offsetX: local.x - placement.x,
      offsetY: local.y - placement.y,
    };
    setDraggingWidgetId(widget.id);
    draggingWidgetPageRef.current = page;
    setDraggingWidgetPage(page);
    setWidgetPreviewConfigs(null);
    setDragGhost({
      kind: 'widget',
      id: widget.id,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      widget,
    });
  };

  useEffect(() => {
    if (!draggingWidgetId) return;

    const handlePointerMove = (event: PointerEvent) => {
      const session = widgetPointerSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const local = getLocalPointerPosition(event.clientX, event.clientY);
      if (!local) return;
      const nextX = local.x - session.offsetX;
      const nextY = local.y - session.offsetY;
      setDragGhost(current =>
        current?.kind === 'widget' && current.id === session.widgetId
          ? { ...current, x: nextX, y: nextY }
          : current,
      );
      handleWidgetDragPreview(session.widgetId, nextX, nextY);
    };

    const finishPointerDrag = (event: PointerEvent) => {
      const session = widgetPointerSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const local = getLocalPointerPosition(event.clientX, event.clientY);
      if (local) {
        handleWidgetDragCommit(session.widgetId, local.x - session.offsetX, local.y - session.offsetY);
      } else {
        setDraggingWidgetId(null);
        draggingWidgetPageRef.current = null;
        setDraggingWidgetPage(null);
        setWidgetPreviewConfigs(null);
        setDragGhost(null);
      }
      widgetPointerSessionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishPointerDrag);
    window.addEventListener('pointercancel', finishPointerDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishPointerDrag);
      window.removeEventListener('pointercancel', finishPointerDrag);
    };
  }, [currentPage, desktopViewport.width, draggingWidgetId, draggingWidgetPage, normalizedWidgets, widgetPreviewConfigs]);

  const activeSlotIds = useMemo(() => {
    const ids = new Set<string>();
    if (draggingIconId && draggedPreviewSlotId) {
      ids.add(draggedPreviewSlotId);
    }
    if (draggingNavBar) {
      navBarPlacement.slotIds.forEach(slotId => ids.add(slotId));
    }
    if (draggingWidgetId) {
      draggedWidgetPreviewSlotIds.forEach(slotId => ids.add(slotId));
    }
    return ids;
  }, [draggedPreviewSlotId, draggedWidgetPreviewSlotIds, draggingIconId, draggingNavBar, draggingWidgetId, navBarPlacement.slotIds]);

  const isEditingDesktop = Boolean(isArrangeMode || draggingIconId || draggingNavBar || draggingWidgetId);
  const resetSwipeInteraction = () => {
    swipeEnabledRef.current = false;
    swipeStartRef.current = null;
    setIsSwipeDragging(false);
    setSwipeOffset(0);
  };
  const changePage = (nextPage: number) => {
    const resolved = normalizeDesktopPage(nextPage);
    if (resolved === currentPage) return;
    setPageDirection(resolved > currentPage ? 1 : -1);
    setSwipeOffset(0);
    setCurrentPage(resolved);
  };
  const handleSwipeStart = (clientX: number, clientY: number, target?: EventTarget | null) => {
    if (isArrangeMode) return;
    if (Date.now() < ignoreSwipeUntilRef.current) return;
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('.homeDesktop__pageDots')) {
      swipeEnabledRef.current = false;
      swipeStartRef.current = null;
      return;
    }
    swipeEnabledRef.current = true;
    swipeStartRef.current = { x: clientX, y: clientY };
    setIsSwipeDragging(false);
  };
  const handleSwipeMove = (clientX: number, clientY: number) => {
    if (!swipeEnabledRef.current || draggingIconId || draggingNavBar) return false;
    const start = swipeStartRef.current;
    if (!start) return false;
    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return false;
    let nextOffset = deltaX;
    if ((currentPage === 0 && deltaX > 0) || (currentPage === pageCount - 1 && deltaX < 0)) {
      nextOffset = deltaX * 0.28;
    }
    const limit = desktopViewport.width * 0.72;
    setIsSwipeDragging(true);
    setSwipeOffset(Math.max(Math.min(nextOffset, limit), -limit));
    return true;
  };
  const handleSwipeEnd = (clientX: number, clientY: number) => {
    if (!swipeEnabledRef.current) return;
    swipeEnabledRef.current = false;
    setIsSwipeDragging(false);
    if (Date.now() < ignoreSwipeUntilRef.current) return;
    if (draggingIconId || draggingNavBar) return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) {
      setSwipeOffset(0);
      return;
    }

    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    const threshold = Math.min(72, desktopViewport.width * 0.18);
    if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) {
      setSwipeOffset(0);
      return;
    }

    if (deltaX > 0 && currentPage > 0) {
      changePage(currentPage - 1);
    } else if (deltaX < 0 && currentPage < pageCount - 1) {
      changePage(currentPage + 1);
    } else {
      setSwipeOffset(0);
    }
  };

  const renderDesktopPage = (page: number) => {
    const pageWidgets = workingWidgetConfigs.filter(widget => normalizeDesktopPage(widget.page) === page);
    const pageNavOccupiedSlotIds = navBarPage === page ? new Set(navBarPlacement.slotIds) : new Set<string>();
    const pageWidgetLayout = buildDesktopWidgetPlacements(pageWidgets, slots, cols, pageNavOccupiedSlotIds);
    const pageOccupiedSlotIds = new Set(pageWidgetLayout.occupiedSlotIds);
    dockPlacement.slotIds.forEach(slotId => pageOccupiedSlotIds.add(slotId));

    const pageIconConfigs = normalizedIcons.filter(icon => normalizeDesktopPage(icon.page) === page);
    const pageWorkingIconConfigs = workingIconConfigs.filter(icon => normalizeDesktopPage(icon.page) === page);
    const pageApps = appOrder.filter(appId => {
      const config = workingIconConfigs.find(icon => icon.id === appId);
      return normalizeDesktopPage(config?.page) === page;
    });
    const pageCommittedPlacements = buildDesktopIconPlacements(pageApps, pageIconConfigs, slots, pageOccupiedSlotIds);
    const pagePreviewPlacements = buildDesktopIconPlacements(pageApps, pageWorkingIconConfigs, slots, pageOccupiedSlotIds);
    const pageDraggedPreviewSlotId = draggingIconId ? workingIconConfigs.find(icon => icon.id === draggingIconId)?.slotId ?? null : null;
    const pagePreviewOccupiedSlotIds = new Set(pageOccupiedSlotIds);
    if (pageDraggedPreviewSlotId) {
      pagePreviewOccupiedSlotIds.add(pageDraggedPreviewSlotId);
    }
    const pagePreviewOtherPlacements = buildDesktopIconPlacements(
      pageApps.filter(appId => appId !== draggingIconId),
      pageWorkingIconConfigs,
      slots,
      pagePreviewOccupiedSlotIds,
    );
    const desktopGridStyle: React.CSSProperties = {
      position: 'absolute',
      left: layoutMetrics.desktopPaddingX,
      top: layoutMetrics.desktopStartY,
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, ${layoutMetrics.slotWidth}px)`,
      gridTemplateRows: `repeat(${DESKTOP_ROWS}, ${layoutMetrics.slotHeight}px)`,
      columnGap: `${layoutMetrics.gridGap}px`,
      rowGap: '0px',
      gridAutoFlow: 'row',
      width: layoutMetrics.slotWidth * cols + layoutMetrics.gridGap * Math.max(0, cols - 1),
      height: layoutMetrics.slotHeight * DESKTOP_ROWS,
      pointerEvents: 'none',
    };

    return (
      <div
        key={page}
        className="homeDesktop__page"
        style={{ width: desktopViewport.width, minWidth: desktopViewport.width }}
      >
        {desktopFontFaceCss ? <style>{desktopFontFaceCss}</style> : null}
        {visualSettings?.navBar?.show && navBarPage === page && (
          <DraggableTopBar
            placement={navBarPlacement}
            dragging={draggingNavBar}
            onDragStart={() => {
              setDraggingNavBar(true);
              setDraggingNavBarPage(navBarPage);
              setNavBarPreviewSlotId(visualSettings.navBar?.slotId || navBarPlacement.anchorSlotId);
            }}
            onDrag={info => {
              const targetPage = draggingNavBarPage ?? currentPage;
              const rawX = navBarPlacement.x + info.offset.x;
              const edgeThreshold = 28;
              if (rawX >= desktopViewport.width - edgeThreshold && targetPage < pageCount - 1) {
                const nextPage = targetPage + 1;
                changePage(nextPage);
                setDraggingNavBarPage(nextPage);
                setNavBarPreviewSlotId(null);
                return;
              }
              if (rawX <= edgeThreshold && targetPage > 0) {
                const nextPage = targetPage - 1;
                changePage(nextPage);
                setDraggingNavBarPage(nextPage);
                setNavBarPreviewSlotId(null);
                return;
              }
              const placement = resolveNavBarDrop({
                rawY: navBarPlacement.y + info.offset.y,
                slots,
                cols,
                metrics: layoutMetrics,
              });
              if (placement.anchorSlotId && placement.anchorSlotId !== navBarPreviewSlotId) {
                setNavBarPreviewSlotId(placement.anchorSlotId);
              }
            }}
            onDragEnd={info => {
              const targetPage = draggingNavBarPage ?? currentPage;
              const placement = resolveNavBarDrop({
                rawY: navBarPlacement.y + info.offset.y,
                slots,
                cols,
                metrics: layoutMetrics,
              });
              setVisualSettings({
                ...visualSettings,
                navBar: {
                  ...visualSettings.navBar,
                  page: targetPage,
                  slotId: placement.anchorSlotId || visualSettings.navBar?.slotId,
                },
              });
              setDraggingNavBar(false);
              setDraggingNavBarPage(null);
              ignoreSwipeUntilRef.current = Date.now() + 260;
              setNavBarPreviewSlotId(null);
            }}
          >
            <div
              ref={navBarInnerRef}
              className={`homeDesktop__topBarInner bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-between ${navBarShapeClass} ${
                visualSettings.navBar.style === 'glass'
                  ? 'bg-white/10 backdrop-blur-xl border-white/20'
                  : visualSettings.navBar.style === 'minimal'
                    ? 'bg-transparent border-none backdrop-blur-none'
                    : ''
              }`}
              style={{
                padding: `${navBarUi.verticalPadding}px ${navBarUi.horizontalPadding}px`,
                backgroundImage: resolvedNavBarBackgroundUrl ? `url(${resolvedNavBarBackgroundUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: resolvedNavBarBackgroundUrl ? 'transparent' : undefined,
              }}
            >
                <div className="flex flex-col items-start" style={{ minWidth: navBarUi.sideMinWidth }}>
                  <span className="font-bold leading-tight" style={{ ...topBarTextStrongStyle, fontSize: navBarUi.timeFontSize }}>{timeStr}</span>
                  <span className="font-medium" style={{ ...topBarTextSoftStyle, fontSize: navBarUi.dateFontSize }}>{dateStr}</span>
              </div>

              <div className="flex flex-col items-center relative">
                <button
                  onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                  className="rounded-full border-2 border-white/50 overflow-hidden active:scale-90 transition-transform"
                  style={{ width: navBarUi.avatarSize, height: navBarUi.avatarSize, marginTop: navBarUi.avatarLift }}
                >
                  {(() => {
                    const avatarSrc = getDisplayableAssetValue(userProfile.avatar, resolvedUserAvatarUrl);
                    return avatarSrc ? <img src={avatarSrc} alt="User" className="w-full h-full object-cover" /> : null;
                  })()}
                </button>
                <span className="font-bold mt-1" style={{ ...topBarTextStrongStyle, fontSize: navBarUi.nameFontSize }}>{userProfile.name}</span>

                <AnimatePresence>
                  {showAvatarMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className="absolute top-14 left-1/2 -translate-x-1/2 w-48 bg-white rounded-2xl shadow-xl p-3 z-50 border border-zinc-100"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-400 ml-1">修改名称</label>
                          <input
                            type="text"
                            placeholder="输入名称..."
                            value={userProfile.name}
                            onChange={e => setUserProfile({ ...userProfile, name: e.target.value })}
                            className="text-[11px] bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="h-[1px] bg-zinc-100" />
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-400 ml-1">更换头像</label>
                          <input
                            type="text"
                            placeholder="粘贴图片链接..."
                            value={tempUrl}
                            onChange={e => setTempUrl(e.target.value)}
                            className="text-[11px] bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={async () => {
                                const nextAvatar = await setRemoteUrl(tempUrl);
                                setUserProfile({ ...userProfile, avatar: nextAvatar });
                                setShowAvatarMenu(false);
                                setTempUrl('');
                              }}
                              className="flex-1 text-[11px] bg-blue-500 text-white rounded-lg py-1.5 font-medium active:opacity-80"
                            >
                              确认链接
                            </button>
                            <label className="flex-1 text-[11px] bg-zinc-100 text-zinc-600 rounded-lg py-1.5 font-medium active:opacity-80 text-center cursor-pointer">
                              上传图片
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const nextAvatar = await setUploadedFile(file);
                                    setUserProfile({ ...userProfile, avatar: nextAvatar });
                                    setShowAvatarMenu(false);
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="h-[1px] bg-zinc-100" />
                        <button
                          onClick={() => {
                            setUserProfile({ ...userProfile, avatar: `https://picsum.photos/seed/${Math.random()}/200` });
                            setShowAvatarMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50 rounded-lg flex items-center gap-2"
                        >
                          <RefreshCw size={12} /> 随机头像
                        </button>
                        <button
                          onClick={() => {
                            setUserProfile({ ...userProfile, avatar: 'https://tu.tuhenmei.com/uploads/allimg/2021090521/s4ljgp4msrd.jpg' });
                            setShowAvatarMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 text-[11px] text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2"
                        >
                          <Trash2 size={12} /> 重置头像
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative flex justify-end" style={{ minWidth: navBarUi.sideMinWidth }}>
                <button
                  onClick={() => setShowMoodMenu(!showMoodMenu)}
                  className="flex items-center justify-end active:opacity-70 text-[0] [&>span:first-child]:hidden"
                >
                  <span className="font-bold uppercase tracking-wider" style={{ ...topBarTextSoftStyle, fontSize: navBarUi.moodLabelFontSize }}>今日心情</span>
                  <span className="font-medium" style={{ ...topBarTextStrongStyle, fontSize: navBarUi.moodFontSize }}>{currentMood}</span>
                </button>

                <AnimatePresence>
                  {showMoodMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className="absolute top-12 right-0 w-56 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-xl p-2 z-50 border border-zinc-100 grid grid-cols-1 gap-1"
                    >
                      {moodOptions.map(m => (
                        <button
                          key={m}
                          onClick={() => {
                            setUserProfile({ ...userProfile, mood: m });
                            setShowMoodMenu(false);
                          }}
                          className="text-[13px] py-2 px-2 text-left whitespace-nowrap hover:bg-zinc-50 rounded-lg transition-colors"
                        >
                          {m}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </DraggableTopBar>
        )}

        <div className={`homeDesktop__surface ${isEditingDesktop ? 'homeDesktop__surface--editing' : ''}`}>
          <div className="homeDesktop__grid" style={desktopGridStyle}>
          {pageWidgets.map(widget => {
            const placement = pageWidgetLayout.placements[widget.id];
            if (!placement) return null;
            return (
              <DraggableWidget
                key={widget.id}
                widget={widget}
                placement={placement}
                gridStyle={getExplicitGridStyle(placement.anchorSlotId || widget.slotId, widget.w || 1, widget.h || 1)}
                isArrangeMode={isArrangeMode}
                appData={appData}
                setAppData={setAppData}
                isDragging={draggingWidgetId === widget.id}
                hideWhileDragging={draggingWidgetId === widget.id}
                onPointerDragStart={(clientX, clientY, pointerId) => {
                  beginWidgetPointerDrag(widget, page, placement, clientX, clientY, pointerId);
                }}
                onWidgetChange={(updates) => {
                  const currentWidgets = visualSettings.widgets || [];
                  const existingIndex = currentWidgets.findIndex(w => w.id === widget.id);
                  if (existingIndex < 0) return;

                  const newWidgets = [...currentWidgets];
                  newWidgets[existingIndex] = {
                    ...newWidgets[existingIndex],
                    ...updates,
                  };

                  setVisualSettings({
                    ...visualSettings,
                    widgets: newWidgets,
                  });
                }}
                onPositionChange={(newX, newY) => {
                  const currentWidgets = visualSettings.widgets || [];
                  const existingIndex = currentWidgets.findIndex(w => w.id === widget.id);
                  if (existingIndex < 0) return;

                  const newWidgets = [...currentWidgets];
                  newWidgets[existingIndex] = {
                    ...newWidgets[existingIndex],
                    x: newX,
                    y: newY,
                  };

                  setVisualSettings({
                    ...visualSettings,
                    widgets: newWidgets,
                  });
                }}
              />
            );
          })}

          {desktopApps.filter(app => pageApps.includes(app.id as DesktopAppId)).map(app => {
            const committedPlacement = pageCommittedPlacements[app.id];
            const previewPlacement = draggingIconId === app.id ? pagePreviewPlacements[app.id] : pagePreviewOtherPlacements[app.id];
            const placement = previewPlacement || committedPlacement;
            if (!placement || (!committedPlacement && draggingIconId !== app.id)) return null;
            return (
              <DraggableAppIcon
                key={app.id}
                app={app}
                placement={placement}
                committedPlacement={committedPlacement}
                gridStyle={getExplicitGridStyle(placement.slotId, 1, 1)}
                visualSettings={visualSettings}
                iconSize={iconSize + (sizeTier === 'large' ? (isTallPhone ? 4 : 2) : sizeTier === 'regular' ? 2 : 0)}
                isPreviewing={draggingIconId !== null && (draggingIconPage ?? currentPage) === page}
                isDragging={draggingIconId === app.id}
                hideWhileDragging={draggingIconId === app.id}
                isArrangeMode={isArrangeMode}
                onEnterArrangeMode={() => {
                  resetSwipeInteraction();
                  ignoreSwipeUntilRef.current = Date.now() + 260;
                  setIsArrangeMode(true);
                }}
                onPointerDragStart={(clientX, clientY, pointerId) => {
                  beginIconPointerDrag(
                    app,
                    page,
                    committedPlacement,
                    clientX,
                    clientY,
                    pointerId,
                    iconSize + (sizeTier === 'large' ? (isTallPhone ? 4 : 2) : sizeTier === 'regular' ? 2 : 0),
                  );
                }}
              />
            );
          })}
          </div>

          <div className="homeDesktop__slots">
            {slots.map(slot => (
              <div
                key={slot.id}
                className={`homeDesktop__slot ${activeSlotIds.has(slot.id) ? 'homeDesktop__slot--active' : ''}`}
                style={{ left: slot.x, top: slot.y, width: slot.width, height: slot.height }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={desktopRootRef}
      className={`homeDesktop homeDesktop--${sizeTier} ${isTallPhone ? 'homeDesktop--tall' : ''}`}
      onPointerDown={e => {
        if (e.pointerType === 'mouse') {
          handleSwipeStart(e.clientX, e.clientY, e.target);
        }
      }}
      onPointerMove={e => {
        if (e.pointerType === 'mouse') {
          handleSwipeMove(e.clientX, e.clientY);
        }
      }}
      onPointerUp={e => {
        if (e.pointerType === 'mouse') {
          handleSwipeEnd(e.clientX, e.clientY);
        }
      }}
      onPointerCancel={() => {
        resetSwipeInteraction();
      }}
      onTouchStart={e => {
        const touch = e.touches[0];
        if (!touch) return;
        handleSwipeStart(touch.clientX, touch.clientY, e.target);
      }}
      onTouchMove={e => {
        const touch = e.touches[0];
        if (!touch) return;
        const isHorizontalSwipe = handleSwipeMove(touch.clientX, touch.clientY);
        if (isHorizontalSwipe) {
          e.preventDefault();
        }
      }}
      onTouchEnd={e => {
        const touch = e.changedTouches[0];
        if (!touch) {
          resetSwipeInteraction();
          return;
        }
        handleSwipeEnd(touch.clientX, touch.clientY);
      }}
      onTouchCancel={() => {
        resetSwipeInteraction();
      }}
      onClick={e => {
        if (!isArrangeMode || draggingIconId || draggingNavBar) return;
        const element = e.target instanceof HTMLElement ? e.target : null;
        if (element?.closest('.homeDesktop__item, .homeDesktop__topBar, .homeDesktop__dock, .homeDesktop__pageDots')) {
          return;
        }
        setDraggingWidgetId(null);
        setWidgetPreviewConfigs(null);
        setDragGhost(null);
        setIsArrangeMode(false);
      }}
      style={
        {
          '--home-desktop-dock-gap': sizeTier === 'compact' ? '4px' : sizeTier === 'large' ? (isTallPhone ? '11px' : '10px') : isTallPhone ? '9px' : '8px',
          '--home-desktop-dock-padding':
            sizeTier === 'compact'
              ? '8px 8px 6px'
              : sizeTier === 'large'
                ? (isTallPhone ? '12px 14px' : '11px 13px')
                : isTallPhone
                  ? '11px 13px'
                  : '10px 12px',
          '--home-desktop-dock-label-size': sizeTier === 'compact' ? '10px' : sizeTier === 'large' ? (isTallPhone ? '13px' : '12px') : isTallPhone ? '11.5px' : '11px',
        } as React.CSSProperties
      }
    >
      <img
        src={resolvedWallpaperUrl || WALLPAPER_URL}
        alt="Wallpaper"
        className="homeDesktop__wallpaper"
        referrerPolicy="no-referrer"
      />

      <div className="absolute inset-0 z-30 overflow-hidden">
        <div
          className="homeDesktop__pageTrack absolute inset-0 flex"
          style={{
            width: desktopViewport.width * pageCount,
            transform: `translate3d(${(-currentPage * desktopViewport.width) + swipeOffset}px, 0, 0)`,
            transition: isSwipeDragging || isEditingDesktop ? 'none' : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {Array.from({ length: pageCount }, (_, page) => renderDesktopPage(page))}
        </div>
      </div>

      {dragGhost && (
        <div
          className="pointer-events-none absolute z-[320]"
          style={{
            left: dragGhost.x,
            top: dragGhost.y,
            width: dragGhost.kind === 'widget' ? dragGhost.width : dragGhost.iconSize + 28,
            height: dragGhost.kind === 'widget' ? dragGhost.height : dragGhost.iconSize + 34,
          }}
        >
          <div className="homeDesktop__dragGhost">
            {dragGhost.kind === 'icon' ? (
              <AppIcon
                id={dragGhost.app.id}
                name={dragGhost.app.name}
                icon={dragGhost.app.icon}
                onClick={() => {}}
                visualSettings={visualSettings}
                iconSize={dragGhost.iconSize}
              />
            ) : (
              <DesktopWidget
                widget={dragGhost.widget}
                isPreview
                musicData={appData.musicData}
                setMusicData={setterOrValue =>
                  setAppData(prev => {
                    const prevMusicData = prev.musicData!;
                    const nextMusicData =
                      typeof setterOrValue === 'function'
                        ? (setterOrValue as (value: MusicData) => MusicData)(prevMusicData)
                        : setterOrValue;
                    return { ...prev, musicData: nextMusicData };
                  })
                }
              />
            )}
          </div>
        </div>
      )}

      {false && (<AnimatePresence initial={false} custom={pageDirection}>
        <motion.div
          key={currentPage}
          custom={pageDirection}
          initial={isEditingDesktop ? false : { x: pageDirection >= 0 ? desktopViewport.width * 0.55 : -desktopViewport.width * 0.55, opacity: 0.92, scale: 0.985 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={isEditingDesktop ? { opacity: 1 } : { x: pageDirection >= 0 ? -desktopViewport.width * 0.22 : desktopViewport.width * 0.22, opacity: 0.92, scale: 0.99 }}
          transition={isEditingDesktop ? { duration: 0 } : { type: 'spring', stiffness: 230, damping: 30, mass: 0.95 }}
          className="absolute inset-0 z-30"
        >
          <div
            className="absolute inset-0"
            style={{ transform: swipeOffset === 0 ? undefined : `translate3d(${swipeOffset}px, 0, 0)` }}
          >
          {visualSettings?.navBar?.show && navBarPage === currentPage && (
            <DraggableTopBar
              placement={navBarPlacement}
              dragging={draggingNavBar}
              onDragStart={() => {
                resetSwipeInteraction();
                setDraggingNavBar(true);
                setDraggingNavBarPage(navBarPage);
                setNavBarPreviewSlotId(visualSettings.navBar?.slotId || navBarPlacement.anchorSlotId);
              }}
              onDrag={info => {
                const targetPage = draggingNavBarPage ?? currentPage;
                const rawX = navBarPlacement.x + info.offset.x;
                const edgeThreshold = Math.max(36, Math.round(desktopViewport.width * 0.1));
                if (
                  Date.now() >= dragPageTurnUntilRef.current
                  && rawX >= desktopViewport.width - edgeThreshold
                  && targetPage < pageCount - 1
                ) {
                  const nextPage = targetPage + 1;
                  dragPageTurnUntilRef.current = Date.now() + 220;
                  changePage(nextPage);
                  setDraggingNavBarPage(nextPage);
                  setNavBarPreviewSlotId(null);
                  return;
                }
                if (Date.now() >= dragPageTurnUntilRef.current && rawX <= edgeThreshold && targetPage > 0) {
                  const nextPage = targetPage - 1;
                  dragPageTurnUntilRef.current = Date.now() + 220;
                  changePage(nextPage);
                  setDraggingNavBarPage(nextPage);
                  setNavBarPreviewSlotId(null);
                  return;
                }
                const placement = resolveNavBarDrop({
                  rawY: navBarPlacement.y + info.offset.y,
                  slots,
                  cols,
                  metrics: layoutMetrics,
                });
                if (placement.anchorSlotId && placement.anchorSlotId !== navBarPreviewSlotId) {
                  setNavBarPreviewSlotId(placement.anchorSlotId);
                }
              }}
              onDragEnd={info => {
                const targetPage = draggingNavBarPage ?? currentPage;
                const placement = resolveNavBarDrop({
                  rawY: navBarPlacement.y + info.offset.y,
                  slots,
                  cols,
                  metrics: layoutMetrics,
                });
                setVisualSettings({
                  ...visualSettings,
                  navBar: {
                    ...visualSettings.navBar,
                    page: targetPage,
                    slotId: placement.anchorSlotId || visualSettings.navBar?.slotId,
                  },
                });
                setDraggingNavBar(false);
                setDraggingNavBarPage(null);
                ignoreSwipeUntilRef.current = Date.now() + 260;
                dragPageTurnUntilRef.current = 0;
                setNavBarPreviewSlotId(null);
                resetSwipeInteraction();
              }}
            >
              <div
                ref={navBarInnerRef}
                className={`homeDesktop__topBarInner bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-between ${navBarShapeClass} ${
                  visualSettings.navBar.style === 'glass'
                    ? 'bg-white/10 backdrop-blur-xl border-white/20'
                    : visualSettings.navBar.style === 'minimal'
                      ? 'bg-transparent border-none backdrop-blur-none'
                      : ''
                }`}
                style={{
                  padding: `${navBarUi.verticalPadding}px ${navBarUi.horizontalPadding}px`,
                  backgroundImage: resolvedNavBarBackgroundUrl ? `url(${resolvedNavBarBackgroundUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: resolvedNavBarBackgroundUrl ? 'transparent' : undefined,
                }}
              >
                <div className="flex flex-col items-start" style={{ minWidth: navBarUi.sideMinWidth }}>
                  <span className="font-bold leading-tight" style={{ ...topBarTextStrongStyle, fontSize: navBarUi.timeFontSize }}>{timeStr}</span>
                  <span className="font-semibold" style={{ ...topBarTextSoftStyle, fontSize: navBarUi.dateFontSize }}>{dateStr}</span>
                </div>

            <div className="flex flex-col items-center relative">
              <button
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                className="rounded-full border-2 border-white/50 overflow-hidden active:scale-90 transition-transform"
                style={{ width: navBarUi.avatarSize, height: navBarUi.avatarSize, marginTop: navBarUi.avatarLift }}
              >
                {(() => {
                  const avatarSrc = getDisplayableAssetValue(userProfile.avatar, resolvedUserAvatarUrl);
                  return avatarSrc ? <img src={avatarSrc} alt="User" className="w-full h-full object-cover" /> : null;
                })()}
              </button>
              <span className="font-bold mt-1" style={{ ...topBarTextStrongStyle, fontSize: navBarUi.nameFontSize }}>{userProfile.name}</span>

              <AnimatePresence>
                {showAvatarMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute top-14 left-1/2 -translate-x-1/2 w-48 bg-white rounded-2xl shadow-xl p-3 z-50 border border-zinc-100"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400 ml-1">修改名称</label>
                        <input
                          type="text"
                          placeholder="输入名称..."
                          value={userProfile.name}
                          onChange={e => setUserProfile({ ...userProfile, name: e.target.value })}
                          className="text-[11px] bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="h-[1px] bg-zinc-100" />
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400 ml-1">更换头像</label>
                        <input
                          type="text"
                          placeholder="粘贴图片链接..."
                          value={tempUrl}
                          onChange={e => setTempUrl(e.target.value)}
                          className="text-[11px] bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              const nextAvatar = await setRemoteUrl(tempUrl);
                              setUserProfile({ ...userProfile, avatar: nextAvatar });
                              setShowAvatarMenu(false);
                              setTempUrl('');
                            }}
                            className="flex-1 text-[11px] bg-blue-500 text-white rounded-lg py-1.5 font-medium active:opacity-80"
                          >
                            确认链接
                          </button>
                          <label className="flex-1 text-[11px] bg-zinc-100 text-zinc-600 rounded-lg py-1.5 font-medium active:opacity-80 text-center cursor-pointer">
                            上传图片
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const nextAvatar = await setUploadedFile(file);
                                  setUserProfile({ ...userProfile, avatar: nextAvatar });
                                  setShowAvatarMenu(false);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="h-[1px] bg-zinc-100" />
                      <button
                        onClick={() => {
                          setUserProfile({ ...userProfile, avatar: `https://picsum.photos/seed/${Math.random()}/200` });
                          setShowAvatarMenu(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50 rounded-lg flex items-center gap-2"
                      >
                        <RefreshCw size={12} /> 随机头像
                      </button>
                      <button
                        onClick={() => {
                          setUserProfile({ ...userProfile, avatar: 'https://tu.tuhenmei.com/uploads/allimg/2021090521/s4ljgp4msrd.jpg' });
                          setShowAvatarMenu(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2"
                      >
                        <Trash2 size={12} /> 重置头像
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative flex justify-end" style={{ minWidth: navBarUi.sideMinWidth }}>
              <button
                onClick={() => setShowMoodMenu(!showMoodMenu)}
                className="flex items-center justify-end active:opacity-70 text-[0] [&>span:first-child]:hidden"
              >
                <span className="font-bold uppercase tracking-wider" style={{ ...topBarTextSoftStyle, fontSize: navBarUi.moodLabelFontSize }}>今日心情</span>
                <span className="font-semibold" style={{ ...topBarTextStrongStyle, fontSize: navBarUi.moodFontSize }}>{currentMood}</span>
              </button>

              <AnimatePresence>
                {showMoodMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute top-12 right-0 w-56 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-xl p-2 z-50 border border-zinc-100 grid grid-cols-1 gap-1"
                  >
                    {moodOptions.map(m => (
                      <button
                        key={m}
                        onClick={() => {
                          setUserProfile({ ...userProfile, mood: m });
                          setShowMoodMenu(false);
                        }}
                        className="text-[13px] py-2 px-2 text-left whitespace-nowrap hover:bg-zinc-50 rounded-lg transition-colors"
                      >
                        {m}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DraggableTopBar>
      )}

          <div className={`homeDesktop__surface ${isEditingDesktop ? 'homeDesktop__surface--editing' : ''}`}>
        <div className="homeDesktop__slots">
          {slots.map(slot => (
            <div
              key={slot.id}
              className={`homeDesktop__slot ${activeSlotIds.has(slot.id) ? 'homeDesktop__slot--active' : ''}`}
              style={{ left: slot.x, top: slot.y, width: slot.width, height: slot.height }}
            />
          ))}
        </div>

        {currentPageWidgets.map(widget => {
          const placement = widgetLayout.placements[widget.id];
          if (!placement) return null;
          return (
            <DraggableWidget
              key={widget.id}
              widget={widget}
              placement={placement}
              isArrangeMode={isArrangeMode}
              isDragging={draggingWidgetId === widget.id}
              hideWhileDragging={draggingWidgetId === widget.id}
              appData={appData}
              setAppData={setAppData}
              onPointerDragStart={(clientX, clientY, pointerId) => {
                beginWidgetPointerDrag(widget, currentPage, placement, clientX, clientY, pointerId);
              }}
              onWidgetChange={(updates) => {
                const currentWidgets = visualSettings.widgets || [];
                const existingIndex = currentWidgets.findIndex(w => w.id === widget.id);
                if (existingIndex < 0) return;

                const newWidgets = [...currentWidgets];
                newWidgets[existingIndex] = {
                  ...newWidgets[existingIndex],
                  ...updates,
                };

                setVisualSettings({
                  ...visualSettings,
                  widgets: newWidgets,
                });
              }}
              onPositionChange={(newX, newY) => {
                const currentWidgets = visualSettings.widgets || [];
                const existingIndex = currentWidgets.findIndex(w => w.id === widget.id);
                if (existingIndex < 0) return;

                const newWidgets = [...currentWidgets];
                newWidgets[existingIndex] = {
                  ...newWidgets[existingIndex],
                  x: newX,
                  y: newY,
                };

                setVisualSettings({
                  ...visualSettings,
                  widgets: newWidgets,
                });
              }}
            />
          );
        })}

        {desktopApps.filter(app => appsOnCurrentPage.includes(app.id as DesktopAppId)).map(app => {
          const committedPlacement = committedIconPlacements[app.id];
          const previewPlacement = draggingIconId === app.id ? previewIconPlacements[app.id] : previewOtherIconPlacements[app.id];
          const placement = previewPlacement || committedPlacement;
          if (!placement || (!committedPlacement && draggingIconId !== app.id)) return null;
          return (
            <DraggableAppIcon
              key={app.id}
              app={app}
              placement={placement}
              committedPlacement={committedPlacement}
              gridStyle={getExplicitGridStyle(placement.slotId, 1, 1)}
              visualSettings={visualSettings}
              iconSize={iconSize + (sizeTier === 'large' ? (isTallPhone ? 4 : 2) : sizeTier === 'regular' ? 2 : 0)}
              isPreviewing={draggingIconId !== null && draggingIconId !== app.id}
              isDragging={draggingIconId === app.id}
              hideWhileDragging={draggingIconId === app.id}
              isArrangeMode={isArrangeMode}
              onEnterArrangeMode={() => {
                resetSwipeInteraction();
                ignoreSwipeUntilRef.current = Date.now() + 260;
                setIsArrangeMode(true);
              }}
              onPointerDragStart={(clientX, clientY, pointerId) => {
                beginIconPointerDrag(
                  app,
                  currentPage,
                  committedPlacement,
                  clientX,
                  clientY,
                  pointerId,
                  iconSize + (sizeTier === 'large' ? (isTallPhone ? 4 : 2) : sizeTier === 'regular' ? 2 : 0),
                );
              }}
            />
          );
        })}
        <div className="hidden pointer-events-auto absolute bottom-[112px] left-1/2 z-[95] -translate-x-1/2 items-center gap-2">
          {Array.from({ length: pageCount }, (_, page) => (
            <button
              key={page}
              onClick={() => changePage(page)}
              className={`h-2.5 rounded-full border border-white/30 transition-all ${currentPage === page ? 'w-5 bg-white/95 shadow-[0_2px_10px_rgba(255,255,255,0.45)]' : 'w-2.5 bg-black/15 backdrop-blur-sm'}`}
              aria-label={`切换到第 ${page + 1} 页`}
            />
          ))}
        </div>

          </div>
          </div>
        </motion.div>
      </AnimatePresence>)}

      {pageCount > 1 && (
        <div className="homeDesktop__pageDots pointer-events-auto absolute bottom-[132px] left-1/2 z-[95] flex -translate-x-1/2 items-center gap-2">
          {Array.from({ length: pageCount }, (_, page) => (
            <button
              key={page}
              onClick={() => changePage(page)}
              className={`h-2.5 rounded-full border border-white/30 transition-all ${currentPage === page ? 'w-5 bg-white/95 shadow-[0_2px_10px_rgba(255,255,255,0.45)]' : 'w-2.5 bg-black/15 backdrop-blur-sm'}`}
              aria-label={`切换到第 ${page + 1} 页`}
            />
          ))}
        </div>
      )}

      <StaticDock
        placement={dockPlacement}
        visualSettings={visualSettings}
        apps={apps.filter(app => DOCK_APP_IDS.includes(app.id as (typeof DOCK_APP_IDS)[number]))}
        fontStyle={fontStyle}
        iconSize={sizeTier === 'large' ? iconSize + (isTallPhone ? 1 : 0) : sizeTier === 'regular' ? iconSize - 1 : iconSize - 2}
      />
    </div>
  );
}

function DraggableWidget({
  widget,
  placement,
  gridStyle,
  isArrangeMode,
  isDragging,
  hideWhileDragging,
  onPointerDragStart,
  onPositionChange,
  onWidgetChange,
  appData,
  setAppData,
}: {
  widget: any;
  placement: { x: number; y: number; width: number; height: number };
  gridStyle?: React.CSSProperties;
  isArrangeMode: boolean;
  isDragging: boolean;
  hideWhileDragging: boolean;
  onPointerDragStart: (clientX: number, clientY: number, pointerId: number) => void;
  onPositionChange: (x: number, y: number) => void;
  onWidgetChange: (updates: Partial<WidgetConfig>) => void;
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
}) {
  return (
    <motion.div
      className={`homeDesktop__item homeDesktop__item--widget ${gridStyle ? 'homeDesktop__item--grid' : ''}`}
      initial={false}
      animate={gridStyle ? undefined : (isDragging ? { x: placement.x, y: placement.y } : { x: placement.x, y: placement.y })}
      onPointerDown={event => {
        if (!isArrangeMode) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        onPointerDragStart(event.clientX, event.clientY, event.pointerId);
      }}
      style={{
        ...(gridStyle || { width: placement.width, height: placement.height }),
        opacity: hideWhileDragging ? 0 : undefined,
        pointerEvents: hideWhileDragging ? 'none' : undefined,
      }}
      whileTap={isArrangeMode ? { scale: 0.98 } : undefined}
      transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
    >
      <DesktopWidget
        widget={widget}
        onWidgetChange={onWidgetChange}
        musicData={appData.musicData}
        setMusicData={setterOrValue =>
          setAppData(prev => {
            const prevMusicData = prev.musicData!;
            const nextMusicData =
              typeof setterOrValue === 'function'
                ? (setterOrValue as (value: MusicData) => MusicData)(prevMusicData)
                : setterOrValue;
            return { ...prev, musicData: nextMusicData };
          })
        }
      />
    </motion.div>
  );
}

function DraggableAppIcon({
  app,
  placement,
  committedPlacement,
  gridStyle,
  visualSettings,
  iconSize,
  isPreviewing,
  isDragging,
  hideWhileDragging,
  isArrangeMode,
  onEnterArrangeMode,
  onPointerDragStart,
}: {
  app: AppDefinition;
  placement: { x: number; y: number; slotId: string | null };
  committedPlacement: { x: number; y: number; slotId: string | null };
  gridStyle?: React.CSSProperties;
  visualSettings: VisualSettings;
  iconSize: number;
  isPreviewing: boolean;
  isDragging: boolean;
  hideWhileDragging: boolean;
  isArrangeMode: boolean;
  onEnterArrangeMode: () => void;
  onPointerDragStart: (clientX: number, clientY: number, pointerId: number) => void;
}) {
  const dragLock = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isDragging) return;
    const timer = setTimeout(() => {
      dragLock.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [isDragging]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <motion.div
      className={`homeDesktop__item homeDesktop__item--icon ${gridStyle ? 'homeDesktop__item--grid' : ''} ${isDragging ? 'homeDesktop__item--dragging' : ''} ${isPreviewing ? 'homeDesktop__item--previewing' : ''} ${isArrangeMode ? 'homeDesktop__item--arranging' : ''}`}
      initial={false}
      animate={gridStyle ? undefined : (isDragging ? { x: committedPlacement.x, y: committedPlacement.y } : { x: placement.x, y: placement.y })}
      onDragStart={event => event.preventDefault()}
      onPointerDown={event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        pointerStartRef.current = { x: event.clientX, y: event.clientY };
        if (isArrangeMode) {
          dragLock.current = true;
          event.preventDefault();
          onPointerDragStart(event.clientX, event.clientY, event.pointerId);
          return;
        }
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          dragLock.current = true;
          onEnterArrangeMode();
          longPressTimerRef.current = null;
        }, 260);
      }}
      onPointerMove={event => {
        const start = pointerStartRef.current;
        if (!start || isArrangeMode) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
          clearLongPressTimer();
        }
      }}
      onPointerUp={() => {
        pointerStartRef.current = null;
        clearLongPressTimer();
      }}
      onPointerCancel={() => {
        pointerStartRef.current = null;
        clearLongPressTimer();
      }}
      style={{
        ...gridStyle,
        opacity: hideWhileDragging ? 0 : undefined,
        pointerEvents: hideWhileDragging ? 'none' : undefined,
      }}
      whileTap={isArrangeMode ? { scale: 0.96 } : undefined}
      transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 32 }}
    >
      <div
        className={isArrangeMode ? 'homeDesktop__itemBody homeDesktop__itemBody--arranging' : 'homeDesktop__itemBody'}
        onDragStart={event => event.preventDefault()}
        onClick={event => {
          if (dragLock.current) {
            event.stopPropagation();
            return;
          }
          if (isArrangeMode) {
            event.stopPropagation();
            return;
          }
          app.onClick();
        }}
      >
        <AppIcon id={app.id} name={app.name} icon={app.icon} onClick={() => {}} visualSettings={visualSettings} iconSize={iconSize} />
      </div>
    </motion.div>
  );
}

function StaticDock({
  placement,
  visualSettings,
  apps,
  fontStyle,
  iconSize,
}: {
  placement: { x: number; y: number; width: number; height: number };
  visualSettings: VisualSettings;
  apps: AppDefinition[];
  fontStyle: React.CSSProperties;
  iconSize: number;
}) {
  return (
    <motion.div className="homeDesktop__dock" initial={false} animate={{ x: placement.x, y: placement.y }} style={{ width: placement.width, height: placement.height }}>
      <div className="homeDesktop__dockBar">
        {apps.map(app => (
          <button key={app.id} onClick={app.onClick} className="homeDesktop__dockItem">
            <div
              className="homeDesktop__dockIcon"
              style={{
                width: iconSize,
                height: iconSize,
                borderRadius: visualSettings?.desktop?.iconBorderRadius ?? 14,
              }}
            >
              <DockAppIcon app={app} visualSettings={visualSettings} />
            </div>
            <span className="homeDesktop__dockLabel font-bold drop-shadow-sm" style={fontStyle}>
              {app.name}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function DockAppIcon({
  app,
  visualSettings,
}: {
  app: AppDefinition;
  visualSettings: VisualSettings;
}) {
  const customIcon = visualSettings?.desktopIcons?.find(i => i.id === app.id)?.iconUrl;
  const { resolvedUrl: resolvedCustomIconUrl } = useResolvedPersistentValue(customIcon);
  const finalIcon = getDisplayableAssetValue(customIcon, resolvedCustomIconUrl) || app.icon;

  return (
    <ResilientAppIconImage src={finalIcon} fallbackSrc={app.icon} alt={app.name} />
  );
}

function ResilientAppIconImage({
  src,
  fallbackSrc,
  alt,
}: {
  src: string;
  fallbackSrc: string;
  alt: string;
}) {
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    setImageSrc(src);
  }, [src]);

  return (
    <img
      src={imageSrc}
      className="absolute inset-0 w-full h-full object-cover"
      alt={alt}
      referrerPolicy="no-referrer"
      draggable={false}
      onContextMenu={event => event.preventDefault()}
      onError={() => {
        if (imageSrc !== fallbackSrc) {
          setImageSrc(fallbackSrc);
        }
      }}
    />
  );
}

function DraggableTopBar({
  placement,
  dragging,
  onDragStart,
  onDrag,
  onDragEnd,
  children,
}: {
  placement: { x: number; y: number; width: number; height: number };
  dragging: boolean;
  onDragStart: () => void;
  onDrag: (info: PanInfo) => void;
  onDragEnd: (info: PanInfo) => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={`homeDesktop__topBar ${dragging ? 'homeDesktop__topBar--dragging' : ''}`}
      initial={false}
      animate={{ x: placement.x, y: placement.y }}
      drag
      dragMomentum={false}
      onDragStart={onDragStart}
      onDrag={(_, info) => onDrag(info)}
      onDragEnd={(_, info) => onDragEnd(info)}
      style={{ width: placement.width, minHeight: placement.height }}
      whileDrag={{ scale: 1.01, zIndex: 165 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

function AppIcon({
  id,
  name,
  icon,
  onClick,
  visualSettings,
  iconSize,
}: {
  id: string;
  name: string;
  icon?: string;
  onClick: () => void;
  visualSettings?: VisualSettings;
  iconSize?: number;
}) {
  const customIcon = visualSettings?.desktopIcons?.find(i => i.id === id)?.iconUrl;
  const { resolvedUrl: resolvedCustomIconUrl } = useResolvedPersistentValue(customIcon);
  const finalIcon = getDisplayableAssetValue(customIcon, resolvedCustomIconUrl) || icon || APP_ICON_URL;
  const finalIconSize = iconSize ?? visualSettings?.desktop?.iconSize ?? 56;

  const fontSize = visualSettings?.desktop?.fontSize ?? 12;
  const fontColor = visualSettings?.desktop?.fontColor ?? '#ffffff';
  const fontWeight = visualSettings?.desktop?.fontWeight ?? 'normal';

  const fontStyle: React.CSSProperties = {
    fontFamily: resolveDesktopFontFamily(visualSettings),
    fontSize: `${fontSize}px`,
    color: fontColor,
    fontWeight: fontWeight === 'bold' ? 'bold' : fontWeight === 'lighter' ? 'lighter' : 'normal',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  };

  return (
    <div className="flex flex-col items-center gap-1.5 cursor-pointer group transition-transform active:scale-95" onClick={onClick}>
      <div
        className="homeDesktop__appIcon"
        style={{
          width: finalIconSize,
          height: finalIconSize,
          borderRadius: visualSettings?.desktop?.iconBorderRadius ?? 14,
        }}
      >
        <ResilientAppIconImage src={finalIcon} fallbackSrc={icon || APP_ICON_URL} alt={name} />
      </div>
      <span className="homeDesktop__appLabel drop-shadow-md tracking-wide" style={fontStyle}>
        {name}
      </span>
    </div>
  );
}
