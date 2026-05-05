const UPLOADED_ASSET_PREFIX = 'asset://uploaded/';
const DIRECT_DISPLAY_VALUE_REGEX = /^(https?:|data:)/i;
const VALID_DATA_IMAGE_REGEX = /^data:image\/[a-zA-Z0-9.+-]+(?:;[^,]+)?,.+$/i;

function isValidDirectDisplayValue(value: string): boolean {
  if (/^data:/i.test(value)) {
    return VALID_DATA_IMAGE_REGEX.test(value);
  }

  return DIRECT_DISPLAY_VALUE_REGEX.test(value);
}

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
  return isValidDirectDisplayValue(trimmed) ? trimmed : null;
}

export function getPreviewAssetValue(
  previewUrl: string | null | undefined,
): string | null {
  if (!previewUrl) return null;
  const trimmed = previewUrl.trim();
  if (!trimmed) return null;
  return isValidDirectDisplayValue(trimmed) ? trimmed : null;
}
