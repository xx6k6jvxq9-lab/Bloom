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
  iconSize: number;
  gap: number;
};

type DesktopIconLike = {
  id: string;
  x?: number;
  y?: number;
  iconUrl?: string;
  borderRadius?: number;
};

type WidgetLike = {
  id: string;
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

const SCREEN_WIDTH = 360;
const DESKTOP_PADDING_X = 18;
const DESKTOP_START_Y = 76;
const SLOT_WIDTH = 72;
const SLOT_HEIGHT = 92;
const TOP_WIDGET_ROW_SPAN = 2;
const TOP_WIDGET_HEIGHT = 122;

function getHorizontalGap(cols: number) {
  if (cols <= 1) return 0;
  const availableWidth = SCREEN_WIDTH - DESKTOP_PADDING_X * 2;
  return (availableWidth - cols * SLOT_WIDTH) / (cols - 1);
}

export function buildDesktopSlots(options: DesktopLayoutOptions): DesktopSlot[] {
  const cols = Math.max(1, options.cols);
  const rows = Math.max(1, options.rows);
  const horizontalGap = getHorizontalGap(cols);
  const slots: DesktopSlot[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      slots.push({
        id: `slot-${row}-${col}`,
        x: Math.round(DESKTOP_PADDING_X + col * (SLOT_WIDTH + horizontalGap)),
        y: Math.round(DESKTOP_START_Y + row * SLOT_HEIGHT),
        width: SLOT_WIDTH,
        height: SLOT_HEIGHT,
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

function toPlacement(id: string, footprint: DesktopSlot[]): DesktopWidgetPlacement {
  const xs = footprint.map(slot => slot.x);
  const ys = footprint.map(slot => slot.y);
  const rights = footprint.map(slot => slot.x + slot.width);
  const bottoms = footprint.map(slot => slot.y + slot.height);
  return {
    id,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...rights) - Math.min(...xs),
    height: Math.max(...bottoms) - Math.min(...ys),
    slotIds: footprint.map(slot => slot.id),
    anchorSlotId: footprint[0]?.id ?? null,
  };
}

function normalizeSlotId(x: number | undefined, y: number | undefined, slots: DesktopSlot[]) {
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  return getNearestDesktopSlot(x, y, slots)?.id ?? null;
}

export function buildTopWidgetPlacement(row: number, slots: DesktopSlot[]) {
  const slotMap = new Map(slots.map(slot => [slot.id, slot]));
  const start = slotMap.get(`slot-${row}-0`) || slots[0];
  const rowWidth = SCREEN_WIDTH - DESKTOP_PADDING_X * 2;
  if (!start) {
    return { x: DESKTOP_PADDING_X, y: DESKTOP_START_Y, width: rowWidth, height: TOP_WIDGET_HEIGHT };
  }

  return {
    x: start.x,
    y: start.y,
    width: rowWidth,
    height: TOP_WIDGET_HEIGHT,
  };
}

export function getNearestTopWidgetRow(rawY: number, slots: DesktopSlot[]) {
  const maxRow = Math.max(0, Math.max(...slots.map(slot => parseSlotId(slot.id)?.row ?? 0)) - (TOP_WIDGET_ROW_SPAN - 1));
  const candidates = Array.from({ length: maxRow + 1 }, (_, row) => {
    const placement = buildTopWidgetPlacement(row, slots);
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
    const preferredSlotId = normalizeSlotId(widget.x, widget.y, slots);
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
  const availableSlots = slots.filter(slot => !occupiedSlotIds.has(slot.id));
  const availableIds = new Set(availableSlots.map(slot => slot.id));
  const slotMap = new Map(slots.map(slot => [slot.id, slot]));
  const occupied = new Set<string>();
  const placements: Record<string, { x: number; y: number; slotId: string | null }> = {};

  appIds.forEach(appId => {
    const config = iconConfigs.find(icon => icon.id === appId);
    const preferredSlotId = normalizeSlotId(config?.x, config?.y, slots);
    let slot: DesktopSlot | undefined;

    if (preferredSlotId && availableIds.has(preferredSlotId) && !occupied.has(preferredSlotId)) {
      slot = slotMap.get(preferredSlotId);
    } else if (preferredSlotId && availableIds.has(preferredSlotId) && occupied.has(preferredSlotId)) {
      slot = availableSlots.find(candidate => !occupied.has(candidate.id));
    } else {
      slot = availableSlots.find(candidate => !occupied.has(candidate.id));
    }

    if (!slot) return;
    occupied.add(slot.id);
    placements[appId] = { x: slot.x, y: slot.y, slotId: slot.id };
  });

  return placements;
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

  return widgets.map(widget => (widget.id === draggedId ? { ...widget, x: placement.x, y: placement.y } : widget));
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
  const availableSlots = slots.filter(slot => !occupiedSlotIds.has(slot.id));
  const nearestSlot = getNearestDesktopSlot(rawX, rawY, availableSlots);
  if (!nearestSlot) return iconConfigs;

  const currentPlacements = buildDesktopIconPlacements(appIds, iconConfigs, slots, occupiedSlotIds);
  const draggedCurrent = currentPlacements[draggedId];
  const occupantId = appIds.find(id => id !== draggedId && currentPlacements[id]?.slotId === nearestSlot.id);

  return appIds.map(appId => {
    const previous = iconConfigs.find(icon => icon.id === appId) || { id: appId };

    if (appId === draggedId) {
      return { ...previous, id: appId, x: nearestSlot.x, y: nearestSlot.y };
    }

    if (occupantId && appId === occupantId && draggedCurrent?.slotId) {
      const previousSlot = slots.find(slot => slot.id === draggedCurrent.slotId);
      if (previousSlot) {
        return { ...previous, id: appId, x: previousSlot.x, y: previousSlot.y };
      }
    }

    return previous;
  });
}
