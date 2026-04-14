export type DesktopSlot = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DesktopLayoutOptions = {
  cols: number;
  rows: number;
  metrics: DesktopLayoutMetrics;
};

export type HomeScreenSizeTier = 'compact' | 'regular' | 'large';

export type DesktopLayoutMetrics = {
  containerWidth: number;
  containerHeight: number;
  sizeTier: HomeScreenSizeTier;
  isTallPhone: boolean;
  safeAreaBottom: number;
  dockBottomGap: number;
  desktopPaddingX: number;
  desktopStartY: number;
  gridGap: number;
  slotWidth: number;
  slotHeight: number;
  navBarHeight: number;
  topWidgetHeight: number;
  dockHeight: number;
  iconSize: number;
  usableTop: number;
  usableBottom: number;
  usableHeight: number;
};

type DesktopIconLike = {
  id: string;
  slotId?: string;
  x?: number;
  y?: number;
  iconUrl?: string;
  borderRadius?: number;
};

type WidgetLike = {
  id: string;
  slotId?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export type DesktopWidgetPlacement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  slotIds: string[];
  anchorSlotId: string | null;
};

export type DesktopIconPlacement = {
  x: number;
  y: number;
  slotId: string | null;
};

export type DockPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  slotIds: string[];
  anchorSlotId: string | null;
};

export type NavBarPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  slotIds: string[];
  anchorSlotId: string | null;
};

const SCREEN_WIDTH = 360;
const SCREEN_HEIGHT = 720;
const DESKTOP_PADDING_X = 18;
const DESKTOP_START_Y = 76;
const SLOT_WIDTH = 72;
const SLOT_HEIGHT = 92;
const TOP_WIDGET_ROW_SPAN = 2;
const TOP_WIDGET_HEIGHT = 122;
const DOCK_HEIGHT = 104;
const NAV_BAR_HEIGHT = 110;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getDesktopLayoutMetrics({
  containerWidth,
  containerHeight,
  cols,
  rows,
  sizeTier,
  iconSize,
  gap,
  safeAreaBottom = 0,
  isTallPhone = false,
}: {
  containerWidth: number;
  containerHeight: number;
  cols: number;
  rows: number;
  sizeTier: HomeScreenSizeTier;
  iconSize?: number;
  gap?: number;
  safeAreaBottom?: number;
  isTallPhone?: boolean;
}): DesktopLayoutMetrics {
  const safeWidth = clamp(Math.round(containerWidth || SCREEN_WIDTH), 320, 520);
  const safeHeight = clamp(Math.round(containerHeight || SCREEN_HEIGHT), 568, 1100);
  const presets = {
    compact: {
      paddingX: 14,
      startY: 68,
      gridGap: 10,
      iconSize: 48,
      navBarHeight: 98,
      topWidgetHeight: 110,
      dockHeight: 92,
    },
    regular: {
      paddingX: 16,
      startY: 76,
      gridGap: 11,
      iconSize: 62,
      navBarHeight: 110,
      topWidgetHeight: 122,
      dockHeight: 110,
    },
    large: {
      paddingX: 18,
      startY: 84,
      gridGap: 14,
      iconSize: 68,
      navBarHeight: 126,
      topWidgetHeight: 132,
      dockHeight: 120,
    },
  } as const;
  const preset = presets[sizeTier];
  const isWideTallPhone = isTallPhone && safeWidth >= 410 && safeHeight >= 880;
  const desktopPaddingX = clamp(Math.round(safeWidth * 0.045), preset.paddingX - 2, preset.paddingX + 4);
  const gridGap = clamp(gap ?? preset.gridGap, Math.max(8, preset.gridGap - 2), preset.gridGap + 4);
  const slotWidth = Math.round((safeWidth - desktopPaddingX * 2 - gridGap * Math.max(0, cols - 1)) / Math.max(1, cols));
  const tallScale = isTallPhone && sizeTier !== 'compact' ? (sizeTier === 'large' ? 1.18 : 1.11) : 1;
  const resolvedIconSize = clamp(Math.round((iconSize ?? preset.iconSize) * tallScale), 46, slotWidth - 2);
  const navBarHeight = Math.round(
    preset.navBarHeight + (isTallPhone && sizeTier !== 'compact' ? (sizeTier === 'large' ? 8 : 5) : 0),
  );
  const topWidgetHeight = Math.round(preset.topWidgetHeight + (isTallPhone && sizeTier !== 'compact' ? (sizeTier === 'large' ? 14 : 10) : 0));
  const dockHeight = Math.round(preset.dockHeight + (isTallPhone && sizeTier !== 'compact' ? (sizeTier === 'large' ? 4 : 2) : 0));
  const dockBottomGap = sizeTier === 'compact' ? 6 : isTallPhone ? (sizeTier === 'large' ? 18 : 15) : sizeTier === 'large' ? 12 : 10;
  const desktopStartYBase = clamp(
    Math.round(safeHeight * (sizeTier === 'compact' ? 0.095 : sizeTier === 'large' ? 0.115 : 0.105)),
    preset.startY - 6,
    preset.startY + 10,
  );
  const desktopStartY = Math.max(
    sizeTier === 'compact' ? 62 : 58,
    desktopStartYBase - (isTallPhone && sizeTier !== 'compact' ? (sizeTier === 'large' ? 28 : 18) : sizeTier === 'regular' ? 4 : 0),
  );
  const usableTop = desktopStartY;
  const usableBottom = safeHeight - safeAreaBottom - dockHeight - dockBottomGap + (isTallPhone && sizeTier !== 'compact' ? (isWideTallPhone ? 18 : 12) : 0);
  const usableHeight = Math.max(320, usableBottom - usableTop);
  const slotHeight = clamp(
    Math.round(
      usableHeight
      / Math.max(
        1,
        rows - 1 - (isTallPhone && sizeTier !== 'compact' ? (sizeTier === 'large' ? (isWideTallPhone ? 0.95 : 0.8) : (isWideTallPhone ? 0.65 : 0.5)) : 0),
      )
    ),
    sizeTier === 'compact' ? 74 : sizeTier === 'regular' ? 86 : 80,
    sizeTier === 'large' ? (isWideTallPhone ? 138 : 132) : sizeTier === 'regular' ? (isWideTallPhone ? 122 : 116) : 96,
  );

  return {
    containerWidth: safeWidth,
    containerHeight: safeHeight,
    sizeTier,
    isTallPhone,
    safeAreaBottom,
    dockBottomGap,
    desktopPaddingX,
    desktopStartY,
    gridGap,
    slotWidth,
    slotHeight,
    navBarHeight,
    topWidgetHeight,
    dockHeight,
    iconSize: resolvedIconSize,
    usableTop,
    usableBottom,
    usableHeight,
  };
}

function getDesktopContentBounds(slots: DesktopSlot[], metrics?: DesktopLayoutMetrics) {
  if (slots.length === 0) {
    const fallbackPadding = metrics?.desktopPaddingX ?? DESKTOP_PADDING_X;
    const fallbackWidth = metrics?.containerWidth ?? SCREEN_WIDTH;
    return {
      left: fallbackPadding,
      right: fallbackWidth - fallbackPadding,
      width: fallbackWidth - fallbackPadding * 2,
      centerX: fallbackWidth / 2,
    };
  }

  const left = Math.min(...slots.map(slot => slot.x));
  const right = Math.max(...slots.map(slot => slot.x + slot.width));
  const width = right - left;
  return {
    left,
    right,
    width,
    centerX: left + width / 2,
  };
}

function getHorizontalGap(cols: number, metrics: DesktopLayoutMetrics) {
  if (cols <= 1) return 0;
  return metrics.gridGap;
}

export function buildDesktopSlots(options: DesktopLayoutOptions): DesktopSlot[] {
  const cols = Math.max(1, options.cols);
  const rows = Math.max(1, options.rows);
  const horizontalGap = getHorizontalGap(cols, options.metrics);
  const slots: DesktopSlot[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      slots.push({
        id: `slot-${row}-${col}`,
        x: Math.round(options.metrics.desktopPaddingX + col * (options.metrics.slotWidth + horizontalGap)),
        y: Math.round(options.metrics.desktopStartY + row * options.metrics.slotHeight),
        width: options.metrics.slotWidth,
        height: options.metrics.slotHeight,
      });
    }
  }

  return slots;
}

function parseSlotId(slotId: string) {
  const match = slotId.match(/^slot-(\d+)-(\d+)$/);
  if (!match) return null;
  return { row: Number(match[1]), col: Number(match[2]) };
}

function getSlotSortValue(slotId: string) {
  const parsed = parseSlotId(slotId);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  return parsed.row * 100 + parsed.col;
}

function getNearestDesktopSlot(x: number, y: number, slots: DesktopSlot[]) {
  if (slots.length === 0) return null;
  return slots.reduce((best, slot) => {
    const distance = Math.hypot(slot.x - x, slot.y - y);
    if (!best || distance < best.distance) {
      return { slot, distance };
    }
    return best;
  }, null as { slot: DesktopSlot; distance: number } | null)?.slot ?? null;
}

export function getNearestDesktopSlotId(x: number, y: number, slots: DesktopSlot[]) {
  return getNearestDesktopSlot(x, y, slots)?.id ?? null;
}

function getSlotById(slotId: string | undefined, slots: DesktopSlot[]) {
  if (!slotId) return null;
  return slots.find(slot => slot.id === slotId) ?? null;
}

function normalizeSlotId(slotId: string | undefined, x: number | undefined, y: number | undefined, slots: DesktopSlot[]) {
  if (slotId && getSlotById(slotId, slots)) {
    return slotId;
  }

  if (typeof x !== 'number' || typeof y !== 'number') return null;
  return getNearestDesktopSlot(x, y, slots)?.id ?? null;
}

function getWidgetFootprint(anchorSlot: DesktopSlot, widthSlots: number, heightSlots: number, slots: DesktopSlot[], cols: number) {
  const anchor = parseSlotId(anchorSlot.id);
  if (!anchor) return null;
  const slotMap = new Map(slots.map(slot => [slot.id, slot]));
  const footprint: DesktopSlot[] = [];

  for (let rowOffset = 0; rowOffset < heightSlots; rowOffset += 1) {
    for (let colOffset = 0; colOffset < widthSlots; colOffset += 1) {
      const col = anchor.col + colOffset;
      if (col >= cols) return null;
      const slot = slotMap.get(`slot-${anchor.row + rowOffset}-${col}`);
      if (!slot) return null;
      footprint.push(slot);
    }
  }

  return footprint;
}

function footprintIsFree(footprint: DesktopSlot[] | null, occupied: Set<string>) {
  if (!footprint || footprint.length === 0) return false;
  return footprint.every(slot => !occupied.has(slot.id));
}

function findFirstFreeWidgetFootprint(slots: DesktopSlot[], occupied: Set<string>, widthSlots: number, heightSlots: number, cols: number) {
  for (const slot of slots) {
    const footprint = getWidgetFootprint(slot, widthSlots, heightSlots, slots, cols);
    if (footprintIsFree(footprint, occupied)) {
      return footprint;
    }
  }
  return null;
}

function getNearestWidgetFootprint(rawX: number, rawY: number, slots: DesktopSlot[], occupied: Set<string>, widthSlots: number, heightSlots: number, cols: number) {
  const candidates = slots
    .map(slot => {
      const footprint = getWidgetFootprint(slot, widthSlots, heightSlots, slots, cols);
      if (!footprintIsFree(footprint, occupied)) return null;
      return {
        footprint,
        distance: Math.hypot(slot.x - rawX, slot.y - rawY),
      };
    })
    .filter((candidate): candidate is { footprint: DesktopSlot[]; distance: number } => Boolean(candidate))
    .sort((a, b) => a.distance - b.distance);

  return candidates[0]?.footprint ?? null;
}

function toPlacement(id: string, footprint: DesktopSlot[], heightOverride?: number): DesktopWidgetPlacement {
  const xs = footprint.map(slot => slot.x);
  const ys = footprint.map(slot => slot.y);
  const rights = footprint.map(slot => slot.x + slot.width);
  const bottoms = footprint.map(slot => slot.y + slot.height);
  return {
    id,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...rights) - Math.min(...xs),
    height: heightOverride ?? (Math.max(...bottoms) - Math.min(...ys)),
    slotIds: footprint.map(slot => slot.id),
    anchorSlotId: footprint[0]?.id ?? null,
  };
}

export function buildTopWidgetPlacement(row: number, slots: DesktopSlot[], metrics?: DesktopLayoutMetrics) {
  const slotMap = new Map(slots.map(slot => [slot.id, slot]));
  const start = slotMap.get(`slot-${row}-0`) || slots[0];
  const rowWidth = metrics ? metrics.containerWidth - metrics.desktopPaddingX * 2 : SCREEN_WIDTH - DESKTOP_PADDING_X * 2;
  if (!start) {
    return {
      x: metrics?.desktopPaddingX ?? DESKTOP_PADDING_X,
      y: metrics?.desktopStartY ?? DESKTOP_START_Y,
      width: rowWidth,
      height: metrics?.topWidgetHeight ?? TOP_WIDGET_HEIGHT,
    };
  }

  return {
    x: start.x,
    y: start.y,
    width: rowWidth,
    height: metrics?.topWidgetHeight ?? TOP_WIDGET_HEIGHT,
  };
}

export function getNearestTopWidgetRow(rawY: number, slots: DesktopSlot[], metrics?: DesktopLayoutMetrics) {
  const maxRow = Math.max(0, Math.max(...slots.map(slot => parseSlotId(slot.id)?.row ?? 0)) - (TOP_WIDGET_ROW_SPAN - 1));
  const candidates = Array.from({ length: maxRow + 1 }, (_, row) => {
    const placement = buildTopWidgetPlacement(row, slots, metrics);
    return {
      row,
      distance: Math.abs(placement.y - rawY),
    };
  }).sort((a, b) => a.distance - b.distance);
  return candidates[0]?.row ?? 0;
}

export function getReservedDesktopSlotIds(row: number, slots: DesktopSlot[]) {
  const reservedRows = new Set(Array.from({ length: TOP_WIDGET_ROW_SPAN }, (_, index) => row + index));
  return new Set(
    slots
      .filter(slot => {
        const parsed = parseSlotId(slot.id);
        return parsed ? reservedRows.has(parsed.row) : false;
      })
      .map(slot => slot.id)
  );
}

export function buildDesktopWidgetPlacements(widgets: WidgetLike[], slots: DesktopSlot[], cols: number, baseOccupiedSlotIds: Set<string> = new Set()) {
  const occupied = new Set(baseOccupiedSlotIds);
  const placements: Record<string, DesktopWidgetPlacement> = {};

  widgets.forEach(widget => {
    const widthSlots = Math.max(1, Math.min(cols, widget.w ?? 2));
    const heightSlots = Math.max(1, widget.h ?? 2);
    const preferredSlotId = normalizeSlotId(widget.slotId, widget.x, widget.y, slots);
    let footprint =
      preferredSlotId
        ? getWidgetFootprint(slots.find(slot => slot.id === preferredSlotId) || slots[0], widthSlots, heightSlots, slots, cols)
        : null;

    if (!footprintIsFree(footprint, occupied)) {
      footprint = findFirstFreeWidgetFootprint(slots, occupied, widthSlots, heightSlots, cols);
    }

    if (!footprint) return;

    footprint.forEach(slot => occupied.add(slot.id));
    placements[widget.id] = toPlacement(widget.id, footprint);
  });

  return {
    placements,
    occupiedSlotIds: occupied,
  };
}

export function buildDesktopIconPlacements(appIds: string[], iconConfigs: DesktopIconLike[], slots: DesktopSlot[], occupiedSlotIds: Set<string>) {
  const availableSlots = slots
    .filter(slot => !occupiedSlotIds.has(slot.id))
    .sort((a, b) => getSlotSortValue(a.id) - getSlotSortValue(b.id));
  const slotMap = new Map(availableSlots.map(slot => [slot.id, slot]));
  const occupied = new Set<string>();
  const placements: Record<string, DesktopIconPlacement> = {};

  appIds.forEach(appId => {
    const config = iconConfigs.find(icon => icon.id === appId);
    const preferredSlotId = normalizeSlotId(config?.slotId, config?.x, config?.y, slots);
    let slot: DesktopSlot | undefined;

    if (preferredSlotId && slotMap.has(preferredSlotId) && !occupied.has(preferredSlotId)) {
      slot = slotMap.get(preferredSlotId);
    } else {
      slot = availableSlots.find(candidate => !occupied.has(candidate.id));
    }

    if (!slot) return;
    occupied.add(slot.id);
    placements[appId] = { x: slot.x, y: slot.y, slotId: slot.id };
  });

  return placements;
}

function getBottomDockRows(slots: DesktopSlot[]) {
  const maxRow = Math.max(...slots.map(slot => parseSlotId(slot.id)?.row ?? 0));
  return new Set([Math.max(0, maxRow - 1), maxRow]);
}

function getTopNavRows() {
  return new Set([0, 1]);
}

export function buildNavBarPlacement({
  navBarSlotId,
  slots,
  cols,
  renderWidth,
  metrics,
}: {
  navBarSlotId?: string;
  slots: DesktopSlot[];
  cols: number;
  renderWidth?: number;
  metrics?: DesktopLayoutMetrics;
}): NavBarPlacement {
  const legalRows = getTopNavRows();
  const firstLegalSlot = slots.find(slot => {
    const parsed = parseSlotId(slot.id);
    return parsed ? parsed.col === 0 && legalRows.has(parsed.row) : false;
  });
  const anchorSlot = getSlotById(navBarSlotId, slots) || firstLegalSlot || slots[0] || null;
  if (!anchorSlot) {
    return {
      x: metrics?.desktopPaddingX ?? DESKTOP_PADDING_X,
      y: 24,
      width: (metrics?.containerWidth ?? SCREEN_WIDTH) - (metrics?.desktopPaddingX ?? DESKTOP_PADDING_X) * 2,
      height: metrics?.navBarHeight ?? NAV_BAR_HEIGHT,
      slotIds: [],
      anchorSlotId: null,
    };
  }

  const parsed = parseSlotId(anchorSlot.id);
  const row = parsed?.row ?? 0;
  const footprint = slots.filter(slot => {
    const candidate = parseSlotId(slot.id);
    return candidate ? candidate.row === row && candidate.col < cols : false;
  });
  const placement = toPlacement('nav', footprint, metrics?.navBarHeight ?? NAV_BAR_HEIGHT);
  const bounds = getDesktopContentBounds(slots, metrics);
  const isWideTallPhone = Boolean(metrics?.isTallPhone && (metrics?.containerWidth ?? 0) >= 410 && (metrics?.containerHeight ?? 0) >= 880);
  const targetWidth =
    metrics?.sizeTier === 'large'
      ? Math.round(bounds.width * (metrics?.isTallPhone ? (isWideTallPhone ? 0.988 : 0.982) : 0.94))
      : metrics?.sizeTier === 'regular'
        ? Math.round(bounds.width * (metrics?.isTallPhone ? (isWideTallPhone ? 0.955 : 0.945) : 0.9))
        : Math.round(bounds.width * 0.86);
  const width = Math.min(
    Math.max(Math.round(renderWidth ?? placement.width), targetWidth),
    Math.round(bounds.width),
  );
  return {
    x: Math.round(bounds.centerX - width / 2),
    y: Math.max(metrics?.sizeTier === 'compact' ? 10 : 12, placement.y - (metrics?.sizeTier === 'compact' ? 8 : metrics?.isTallPhone ? 16 : 12)),
    width,
    height: metrics?.navBarHeight ?? NAV_BAR_HEIGHT,
    slotIds: placement.slotIds,
    anchorSlotId: footprint[0]?.id ?? null,
  };
}

export function buildDockPlacement({
  dockSlotId,
  slots,
  cols,
  occupiedSlotIds = new Set<string>(),
  metrics,
}: {
  dockSlotId?: string;
  slots: DesktopSlot[];
  cols: number;
  occupiedSlotIds?: Set<string>;
  metrics?: DesktopLayoutMetrics;
}): DockPlacement {
  const bounds = getDesktopContentBounds(slots, metrics);
  if (slots.length === 0) {
    return {
      x: metrics?.desktopPaddingX ?? DESKTOP_PADDING_X,
      y:
        (metrics?.containerHeight ?? SCREEN_HEIGHT)
        - (metrics?.safeAreaBottom ?? 0)
        - (metrics?.dockHeight ?? DOCK_HEIGHT)
        - (metrics?.dockBottomGap ?? 8),
      width: (metrics?.containerWidth ?? SCREEN_WIDTH) - (metrics?.desktopPaddingX ?? DESKTOP_PADDING_X) * 2,
      height: metrics?.dockHeight ?? DOCK_HEIGHT,
      slotIds: [],
      anchorSlotId: null,
    };
  }

  const width = bounds.width;
  const height = metrics?.dockHeight ?? DOCK_HEIGHT;
  const y =
    (metrics?.containerHeight ?? SCREEN_HEIGHT)
    - (metrics?.safeAreaBottom ?? 0)
    - height
    - (metrics?.dockBottomGap ?? 8);
  const footprint = slots.filter(slot => slot.y < y + height && slot.y + slot.height > y);
  const legalRows = getBottomDockRows(slots);
  const anchorSlotId =
    dockSlotId && getSlotById(dockSlotId, slots)
      ? dockSlotId
      : slots.find(slot => {
          const parsed = parseSlotId(slot.id);
          return parsed ? parsed.col === 0 && legalRows.has(parsed.row) : false;
        })?.id ?? null;

  return {
    x: Math.round(bounds.centerX - width / 2),
    y,
    width,
    height,
    slotIds: footprint.map(slot => slot.id),
    anchorSlotId,
  };
}

export function resolveWidgetDrop({
  widgets,
  draggedId,
  rawX,
  rawY,
  slots,
  cols,
  baseOccupiedSlotIds = new Set<string>(),
}: {
  widgets: WidgetLike[];
  draggedId: string;
  rawX: number;
  rawY: number;
  slots: DesktopSlot[];
  cols: number;
  baseOccupiedSlotIds?: Set<string>;
}) {
  const draggedWidget = widgets.find(widget => widget.id === draggedId);
  if (!draggedWidget) return widgets;

  const otherWidgets = widgets.filter(widget => widget.id !== draggedId);
  const otherPlacements = buildDesktopWidgetPlacements(otherWidgets, slots, cols, baseOccupiedSlotIds);
  const occupied = new Set(otherPlacements.occupiedSlotIds);
  const widthSlots = Math.max(1, Math.min(cols, draggedWidget.w ?? 2));
  const heightSlots = Math.max(1, draggedWidget.h ?? 2);
  const footprint =
    getNearestWidgetFootprint(rawX, rawY, slots, occupied, widthSlots, heightSlots, cols) ||
    findFirstFreeWidgetFootprint(slots, occupied, widthSlots, heightSlots, cols);

  if (!footprint) return widgets;
  const placement = toPlacement(draggedId, footprint);

  return widgets.map(widget => (widget.id === draggedId ? { ...widget, slotId: placement.anchorSlotId, x: placement.x, y: placement.y } : widget));
}

export function resolveDesktopIconDrop({
  appIds,
  iconConfigs,
  draggedId,
  rawX,
  rawY,
  slots,
  occupiedSlotIds,
}: {
  appIds: string[];
  iconConfigs: DesktopIconLike[];
  draggedId: string;
  rawX: number;
  rawY: number;
  slots: DesktopSlot[];
  occupiedSlotIds: Set<string>;
}) {
  const availableSlots = slots
    .filter(slot => !occupiedSlotIds.has(slot.id))
    .sort((a, b) => getSlotSortValue(a.id) - getSlotSortValue(b.id));
  const nearestSlot = getNearestDesktopSlot(rawX, rawY, availableSlots);
  if (!nearestSlot) return iconConfigs;

  const currentPlacements = buildDesktopIconPlacements(appIds, iconConfigs, slots, occupiedSlotIds);
  const configMap = new Map(iconConfigs.map(icon => [icon.id, icon]));
  const draggedCurrentSlotId = currentPlacements[draggedId]?.slotId ?? null;
  const displacedId = appIds.find((id) => id !== draggedId && currentPlacements[id]?.slotId === nearestSlot.id) || null;
  const fallbackSlots = availableSlots.filter((slot) => (
    slot.id !== nearestSlot.id
    && slot.id !== draggedCurrentSlotId
    && !appIds.some((id) => id !== displacedId && currentPlacements[id]?.slotId === slot.id)
  ));

  return iconConfigs.map((icon) => {
    const previous = configMap.get(icon.id) || icon;

    if (icon.id === draggedId) {
      return {
        ...previous,
        slotId: nearestSlot.id,
        x: undefined,
        y: undefined,
      };
    }

    if (icon.id === displacedId) {
      const nextSlotId = draggedCurrentSlotId || fallbackSlots[0]?.id || previous.slotId;
      return {
        ...previous,
        slotId: nextSlotId ?? undefined,
        x: undefined,
        y: undefined,
      };
    }

    return previous;
  });
}

export function resolveDockDrop({
  rawY,
  slots,
  cols,
  occupiedSlotIds = new Set<string>(),
  metrics,
}: {
  rawY: number;
  slots: DesktopSlot[];
  cols: number;
  occupiedSlotIds?: Set<string>;
  metrics?: DesktopLayoutMetrics;
}) {
  const legalRows = [...getBottomDockRows(slots)];
  const candidates = legalRows
    .map(row => buildDockPlacement({ dockSlotId: `slot-${row}-0`, slots, cols, occupiedSlotIds, metrics }))
    .sort((a, b) => Math.abs(a.y - rawY) - Math.abs(b.y - rawY));

  return candidates[0] ?? buildDockPlacement({ slots, cols, occupiedSlotIds, metrics });
}

export function resolveNavBarDrop({
  rawY,
  slots,
  cols,
  metrics,
}: {
  rawY: number;
  slots: DesktopSlot[];
  cols: number;
  metrics?: DesktopLayoutMetrics;
}) {
  const legalRows = [...getTopNavRows()];
  const candidates = legalRows
    .map(row => buildNavBarPlacement({ navBarSlotId: `slot-${row}-0`, slots, cols, metrics }))
    .sort((a, b) => Math.abs(a.y - rawY) - Math.abs(b.y - rawY));

  return candidates[0] ?? buildNavBarPlacement({ slots, cols, metrics });
}
