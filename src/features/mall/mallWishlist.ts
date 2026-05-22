export function isMallItemWishlisted(wishlist: string[], itemId: string): boolean {
  return Array.isArray(wishlist) && wishlist.includes(itemId);
}

export function toggleMallWishlistItem(wishlist: string[], itemId: string): string[] {
  const normalizedWishlist = Array.from(new Set(
    Array.isArray(wishlist)
      ? wishlist.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [],
  ));

  const alreadyWishlisted = normalizedWishlist.includes(itemId);
  if (alreadyWishlisted) {
    return normalizedWishlist.filter((entry) => entry !== itemId);
  }

  return [itemId, ...normalizedWishlist.filter((entry) => entry !== itemId)];
}
