import type {
  CoupleSpaceSharedMallItem,
  MallCatalogItem,
  MallOwnedItemOwnership,
} from '../../types';
import { createSharedMallItemSnapshot } from './mallShare';

export function supportsMallSharedSpacePlacement(
  item: Pick<MallCatalogItem, 'destinationKinds'>,
): boolean {
  return item.destinationKinds.includes('shared_space');
}

export function resolveMallOwnedOwnership(item: MallCatalogItem): MallOwnedItemOwnership {
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

export function createCoupleSpaceSharedMallItem(
  item: MallCatalogItem,
  input: {
    sourceOrderId?: string;
    sourceOwnedItemId?: string;
    placedAt?: number;
    placedBy?: CoupleSpaceSharedMallItem['placedBy'];
    placementReason?: CoupleSpaceSharedMallItem['placementReason'];
  } = {},
): CoupleSpaceSharedMallItem {
  const placedAt = input.placedAt ?? Date.now();

  return {
    id: `couple-space-mall-${item.id}-${placedAt}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: item.id,
    snapshot: createSharedMallItemSnapshot(item),
    ...(input.sourceOrderId ? { sourceOrderId: input.sourceOrderId } : {}),
    ...(input.sourceOwnedItemId ? { sourceOwnedItemId: input.sourceOwnedItemId } : {}),
    placedAt,
    placedBy: input.placedBy ?? 'user',
    ...(input.placementReason ? { placementReason: input.placementReason } : {}),
  };
}

export function upsertCoupleSpaceSharedMallItems(
  items: CoupleSpaceSharedMallItem[] | undefined,
  nextItem: CoupleSpaceSharedMallItem,
): CoupleSpaceSharedMallItem[] {
  const normalizedItems = Array.isArray(items) ? items : [];

  const duplicateIndex = normalizedItems.findIndex((entry) => (
    !!nextItem.sourceOwnedItemId
      ? entry.sourceOwnedItemId === nextItem.sourceOwnedItemId
      : !!nextItem.sourceOrderId
        ? entry.sourceOrderId === nextItem.sourceOrderId && entry.itemId === nextItem.itemId
        : entry.id === nextItem.id
  ));

  if (duplicateIndex < 0) {
    return [nextItem, ...normalizedItems];
  }

  return normalizedItems.map((entry, index) => (index === duplicateIndex ? nextItem : entry));
}

export function removeCoupleSpaceSharedMallItem(
  items: CoupleSpaceSharedMallItem[] | undefined,
  itemId: string,
): CoupleSpaceSharedMallItem[] {
  return (Array.isArray(items) ? items : []).filter((entry) => entry.id !== itemId);
}
