const UPLOADED_ASSET_PREFIX = 'asset://uploaded/';
const DIRECT_DISPLAY_VALUE_REGEX = /^(https?:|data:)/i;

export function createUploadedAssetRef(id: string): string {
  return `${UPLOADED_ASSET_PREFIX}${id}`;
}

export function isUploadedAssetRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(UPLOADED_ASSET_PREFIX);
}

export function parseUploadedAssetRef(value: string | null | undefined): { id: string } | null {
  if (!isUploadedAssetRef(value)) return null;
  const id = value.slice(UPLOADED_ASSET_PREFIX.length).trim();
  return id ? { id } : null;
}

export function getDisplayableAssetValue(
  value: string | null | undefined,
  resolvedUrl?: string | null,
): string | null {
  if (resolvedUrl) return resolvedUrl;
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isUploadedAssetRef(trimmed)) return null;
  return DIRECT_DISPLAY_VALUE_REGEX.test(trimmed) ? trimmed : null;
}
